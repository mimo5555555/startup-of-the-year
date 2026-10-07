// Daily goals: generation, two-day window, counters and payment (agent 1D).
// A goal lives for `BALANCE.goals.windowDays` days (the day it is generated and the next); its predicate is a per-day counter read
// from its own creation day on, so a goal carried over from yesterday keeps counting yesterday's actions too.
import { BALANCE } from './balance';
import { dreamPickerShown } from './dreams';
import { applyLedger, dayKey, LEDGER_IDS } from './ledger';
import { scaleAmount, walletLimits } from './money';
import { evalPred, isOpen } from './objectives';
import type {
  DailyCounter,
  DailyGoalState,
  DailySlot,
  DailyState,
  DailyTemplate,
  DerivedEvent,
  GamePack,
  GameState,
  GameView,
  InputEvent,
  PredProgress,
  ReduceCtx,
  ReduceResult,
  UiEffect,
} from './types';

/** The §7.4 priority overrides name their templates: the rules are tied to these ids, the template data (text, target) is the pack's. */
const ID = { review: 'g_review8', shift: 'g_shift', friend: 'g_friend', conv: 'g_conv2', newPhrase: 'g_newphrase2' } as const;

const SLOTS: DailySlot[] = ['speak', 'do', 'review'];

/** Counters that count distinct keys (scenario ids, places) rather than events. */
const DISTINCT: ReadonlySet<DailyCounter> = new Set<DailyCounter>(['conv_distinct', 'places_distinct']);

/** FNV-1a over a string: the seed of a day's trio, `hash(dayIndex + profile.createdAt)`. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small deterministic PRNG. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seedOf = (state: GameState, view: GameView, salt = ''): number => hash(`${state.clock.dayIndex}|${view.profile.createdAt}${salt}`);

/** Daily goals appear after Chapter 1's closing beat (§2.5); a chapter beyond 1 implies it. */
export function dailyUnlocked(pack: GamePack, state: GameState): boolean {
  return state.chapter.n >= 2 || dreamPickerShown(pack, state);
}

/** What a counter shows over the days a goal has existed (`goal.day` .. today): distinct counters by union, the rest by sum. */
function counterValue(daily: DailyState, counter: DailyCounter, fromDay: number, today: number): number {
  if (DISTINCT.has(counter)) {
    const keys = new Set<string>();
    for (let d = fromDay; d <= today; d++) for (const k of daily.sets[d]?.[counter] ?? []) keys.add(k);
    return keys.size;
  }
  let v = 0;
  for (let d = fromDay; d <= today; d++) v += daily.counters[d]?.[counter] ?? 0;
  return v;
}

/** A goal's progress ("1/2"): its counter from the goal's own creation day. */
export function dailyGoalProgress(state: GameState, goal: DailyGoalState): PredProgress {
  const v = counterValue(state.daily, goal.counter, goal.day, state.clock.dayIndex);
  return { done: Math.min(v, goal.target), total: goal.target };
}

// ---------------------------------------------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------------------------------------------

/** Whether a template may be offered now: its `requires`, the age group, and nothing locked behind a later chapter. */
function eligible(t: DailyTemplate, pack: GamePack, state: GameState, view: GameView): boolean {
  const rq = t.requires;
  if (view.profile.age === 'kids' && t.kids === false) return false;
  if (!rq) return true;
  if (rq.chapter !== undefined && state.chapter.n < rq.chapter) return false;
  if (rq.job && !pack.jobs.some((j) => isOpen(pack, state, 'job', j.id) && evalPred(j.unlock, state, { pack, view }))) return false;
  if (rq.friends && !pack.friends.some((f) => f.unlockChapter <= state.chapter.n)) return false;
  if (rq.vocabCards && view.vocab.reviewedKeys.size < 1 && view.vocab.dueCount < 1) return false;
  if (rq.unseenCulture) {
    const adult = view.profile.age === 'adults' || view.profile.age === 'seniors';
    if (!pack.culture.some((c) => state.culture[c.id] === undefined && (adult || !c.adultOnly))) return false;
  }
  return true;
}

/** `g_review8` aims at the cards that are due: with fewer than the target, the goal is "all due". */
function targetFor(t: DailyTemplate, view: GameView): number {
  return t.id === ID.review && view.vocab.dueCount > 0 ? Math.max(1, Math.min(t.target, view.vocab.dueCount)) : t.target;
}

function makeGoal(t: DailyTemplate, view: GameView, day: number): DailyGoalState {
  return { id: t.id, slot: t.slot, counter: t.counter, target: targetFor(t, view), day, done: false, paid: false };
}

/** The dayIndex parsed from a `d<n>` key, or -Infinity for none. */
function dayOf(key: string | undefined): number {
  const n = key ? Number(key.slice(1)) : Number.NaN;
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

/** Days since the last shift of any job / the last contact with any friend (Infinity when it never happened). */
const idleDays = (today: number, last: number): number => today - last;

/**
 * The day's trio, deterministic from seed = hash(dayIndex + profile.createdAt): one template per slot, requires filtered, priority
 * overrides (§7.4). Excludes yesterday's templates (`daily.recent`) and the ones still open from yesterday (`daily.carried`), and a
 * template today's counters already satisfy (a goal never starts finished). 3 goals, 2 for kids (`AgeProfile.dailyGoals`).
 */
export function generateDaily(pack: GamePack, state: GameState, view: GameView): DailyGoalState[] {
  const today = state.clock.dayIndex;
  const rand = seeded(seedOf(state, view));
  const count = pack.ageProfiles[view.profile.age]?.dailyGoals ?? BALANCE.goals.perDay;
  const recent = new Set(state.daily.recent);
  const carried = new Set(state.daily.carried.map((g) => g.id));
  const fresh = (t: DailyTemplate): boolean => counterValue(state.daily, t.counter, today, today) < t.target;
  const usable = pack.daily.filter((t) => eligible(t, pack, state, view) && !carried.has(t.id) && fresh(t));
  const byId = (id: string): DailyTemplate | undefined => usable.find((t) => t.id === id);

  // the priority overrides read the player's recent behaviour
  const lastShift = Math.max(Number.NEGATIVE_INFINITY, ...Object.values(state.jobs).map((j) => dayOf(j.lastDay)));
  const lastContact = Math.max(Number.NEGATIVE_INFINITY, ...Object.values(state.friends).map((f) => f.lastContactDay ?? Number.NEGATIVE_INFINITY));
  const recentConvs = state.coach.recent.filter((r) => r.day > today - BALANCE.goalPriority.convRecentDays).length;
  const P = BALANCE.goalPriority;
  const override: Record<DailySlot, string | undefined> = {
    review: view.vocab.dueCount >= P.reviewDue ? ID.review : undefined,
    do: idleDays(today, lastShift) >= P.shiftIdleDays && byId(ID.shift) ? ID.shift : idleDays(today, lastContact) >= P.friendIdleDays ? ID.friend : undefined,
    speak: recentConvs <= P.convRecentMax ? ID.conv : undefined,
  };

  const chosen: DailyTemplate[] = [];
  const has = (id: string): boolean => chosen.some((c) => c.id === id);
  for (const slot of SLOTS) {
    // one draw per slot, used or not, so an override never shifts the later slots' draws
    const draw = rand();
    if (chosen.length >= count) continue;
    const inSlot = usable.filter((t) => t.slot === slot && !has(t.id));
    const fresher = inSlot.filter((t) => !recent.has(t.id));
    const pool = fresher.length > 0 ? fresher : inSlot;
    let pick = override[slot] ? byId(override[slot] as string) : undefined;
    if (!pick || has(pick.id)) pick = pool[Math.floor(draw * pool.length)];
    // review with nothing due is swapped for new ways of saying things (§7.4)
    if (pick?.id === ID.review && view.vocab.dueCount === 0) {
      const alt = byId(ID.newPhrase);
      pick = alt && !has(alt.id) ? alt : pool.find((t) => t.id !== ID.review);
    }
    if (pick) chosen.push(pick);
  }
  // a slot with nothing eligible (a kid with no review template, an early chapter) is filled from any other slot
  if (chosen.length < count) {
    const rest = usable.filter((t) => !has(t.id));
    while (chosen.length < count && rest.length > 0) chosen.push(rest.splice(Math.floor(rand() * rest.length), 1)[0]);
  }
  return chosen.map((t) => makeGoal(t, view, today));
}

/** Keeps the counter days still inside the window (today and yesterday). */
function trimDays<T>(rec: Record<number, T>, today: number): Record<number, T> {
  return Object.fromEntries(Object.entries(rec).filter(([d]) => Number(d) > today - BALANCE.goals.windowDays)) as Record<number, T>;
}

/**
 * Run once after `observeClock` reports a rollover: carries unfinished goals one day, drops older ones, trims counters, generates the
 * new trio. Safe to call again on the same day (it returns the state), and it also starts the first trio once daily goals unlock.
 */
export function rolloverDaily(pack: GamePack, state: GameState, view: GameView): GameState {
  const today = state.clock.dayIndex;
  const d = state.daily;
  const unlocked = dailyUnlocked(pack, state);
  const rolled = d.day < today;
  if (!rolled && (d.goals.length > 0 || !unlocked)) return state;

  const base: DailyState = rolled
    ? {
        ...d,
        day: today,
        // an unfinished goal stays open for its second day; anything older quietly goes away
        carried: d.goals.filter((g) => !g.done && g.day > today - BALANCE.goals.windowDays),
        goals: [],
        counters: trimDays(d.counters, today),
        sets: trimDays(d.sets, today),
        swapUsed: false,
        allPaid: false,
        streakPaid: false,
        recent: d.goals.map((g) => g.id),
      }
    : d;
  if (!unlocked) return { ...state, daily: base };
  return { ...state, daily: { ...base, goals: generateDaily(pack, { ...state, daily: base }, view) } };
}

/** The free once-a-day swap of a goal for another template of the same slot (never pays more). */
export function swapDaily(pack: GamePack, state: GameState, view: GameView, goalId: string): GameState {
  const d = state.daily;
  if (d.swapUsed) return state;
  const at = d.goals.findIndex((g) => g.id === goalId);
  const old = d.goals[at];
  if (!old || old.done) return state;
  const today = state.clock.dayIndex;
  const taken = new Set([...d.goals, ...d.carried].map((g) => g.id));
  // every template pays the same, so a swap can only change the task; one that is already satisfied today would be free yen
  const alts = pack.daily.filter((t) => t.slot === old.slot && !taken.has(t.id) && eligible(t, pack, state, view) && counterValue(d, t.counter, today, today) < t.target);
  const recent = new Set(d.recent);
  const pool = alts.some((t) => !recent.has(t.id)) ? alts.filter((t) => !recent.has(t.id)) : alts;
  if (pool.length === 0) return state;
  const pick = pool[Math.floor(seeded(seedOf(state, view, `|swap|${goalId}`))() * pool.length)];
  const goals = d.goals.map((g, i) => (i === at ? makeGoal(pick, view, today) : g));
  return { ...state, daily: { ...d, goals, swapUsed: true } };
}

// ---------------------------------------------------------------------------------------------------------------
// Counters and payment (the daily stage of the reducer)
// ---------------------------------------------------------------------------------------------------------------

/** Where a conversation took place, for `g_place`: the scenario's place, its shop's place, else the character. */
function placeOf(pack: GamePack, scenarioId: string, characterId: string): string {
  const meta = pack.scenarioMeta.find((m) => m.id === scenarioId);
  const shopId = meta?.shop?.shopId;
  return meta?.place ?? pack.shops.find((s) => s.id === shopId)?.placeId ?? characterId;
}

type Bumps = { counts: Partial<Record<DailyCounter, number>>; keys: Partial<Record<DailyCounter, string[]>> };

/** What one event (and the derived events earlier stages made from it) adds to today's counters. */
function bumpsFor(ev: InputEvent, derived: DerivedEvent[], pack: GamePack): Bumps {
  const b: Bumps = { counts: {}, keys: {} };
  const add = (c: DailyCounter, n = 1): void => {
    if (n > 0) b.counts[c] = (b.counts[c] ?? 0) + n;
  };
  const key = (c: DailyCounter, k: string): void => {
    (b.keys[c] ??= []).push(k);
  };
  const lines = (f: { turns: Array<{ cls: string; substantive: boolean }> }): number => f.turns.filter((t) => t.cls === 'I' && t.substantive).length;
  const friend = (id: string): boolean => pack.friends.some((f) => f.id === id);

  switch (ev.t) {
    case 'conversation_done': {
      const f = ev.facts;
      add('indep_lines', lines(f));
      if (!f.abandoned && f.goalTotal > 0 && f.goalDone / f.goalTotal >= BALANCE.goals.convFrac) {
        key('conv_distinct', f.scenarioId);
        key('places_distinct', placeOf(pack, f.scenarioId, f.characterId));
      }
      if (!f.abandoned && friend(f.characterId)) add('friend_contact');
      break;
    }
    case 'phone_chat_done':
      add('indep_lines', lines(ev.facts));
      add('friend_contact');
      break;
    case 'gift_given':
      // a refused hand-over made no reaction
      if (derived.some((d) => d.t === 'gift_reacted' && d.friendId === ev.friendId)) add('friend_contact');
      break;
    case 'purchase': {
      // a completed charge in a conversation: the wallet moved, and not at a panel machine
      const world = pack.shops.find((s) => s.id === ev.shopId)?.surface !== 'panel';
      if (world && derived.some((d) => d.t === 'wallet_changed' && d.kind === 'purchase' && d.delta < 0)) add('purchase');
      break;
    }
    case 'lesson_done':
      add('lesson');
      break;
    case 'srs_review':
      add('review_checked', ev.due);
      break;
    default:
      break;
  }
  for (const d of derived) {
    if (d.t === 'shift_settled' && d.score.good) add('shift_good');
    // first independent uses of intents: the settlement lists them (the lifetime `seenIntents` is already updated by now)
    else if (d.t === 'loop_settled') add('new_intents', d.settlement.firstPhrases.length);
    // a culture card read for the first time is one the player has just unlocked
    else if (d.t === 'culture_unlocked') add('culture_new');
  }
  return b;
}

function applyBumps(daily: DailyState, day: number, b: Bumps): DailyState {
  const counts = Object.entries(b.counts) as Array<[DailyCounter, number]>;
  const keyed = Object.entries(b.keys) as Array<[DailyCounter, string[]]>;
  if (counts.length === 0 && keyed.length === 0) return daily;
  const counters = { ...daily.counters, [day]: { ...daily.counters[day] } };
  const sets = { ...daily.sets, [day]: { ...daily.sets[day] } };
  for (const [c, n] of counts) counters[day][c] = (counters[day][c] ?? 0) + n;
  for (const [c, ks] of keyed) {
    const merged = [...new Set([...(sets[day][c] ?? []), ...ks])];
    sets[day][c] = merged;
    counters[day][c] = merged.length;
  }
  return { ...daily, counters, sets };
}

interface DailyOut {
  derived: DerivedEvent[];
  effects: UiEffect[];
}

/** Applies one daily payout; true once the entry is settled (paid, already paid, or the wallet had no room: never retried). */
function pay(state: GameState, ctx: ReduceCtx, id: string, kind: 'goal' | 'streak', amount: number, out: DailyOut): { state: GameState; settled: boolean; paid: number } {
  const r = applyLedger(state, { id, at: ctx.now, kind, delta: amount, pocket: 'cash', ref: id }, walletLimits(state, ctx.pack));
  if (r.applied) {
    const paid = r.state.wallet.cash - state.wallet.cash;
    out.derived.push({ t: 'wallet_changed', delta: paid, balance: r.state.wallet.cash, kind });
    return { state: r.state, settled: true, paid };
  }
  return { state: r.state, settled: r.reason === 'duplicate' || r.reason === 'capped', paid: 0 };
}

/** The daily stage of the reducer: bumps counters from the event, completes goals, pays ¥100 each, the all-three chest and the streak bonus through the ledger. */
export function updateDaily(state: GameState, ev: InputEvent, derived: DerivedEvent[], ctx: ReduceCtx): ReduceResult {
  const out: DailyOut = { derived: [], effects: [] };
  const { pack, view } = ctx;
  // a missed rollover (the shell's `day_observed` ran no daily stage) or the first trio after the unlock is made here
  let s = rolloverDaily(pack, state, view);
  const today = s.clock.dayIndex;
  s = { ...s, daily: applyBumps(s.daily, today, bumpsFor(ev, derived, pack)) };

  const each = scaleAmount(BALANCE.goals.each, pack.economy, pack.currency);
  let firstDoneToday = false;
  const settle = (g: DailyGoalState): DailyGoalState => {
    let goal = g;
    if (!goal.done && counterValue(s.daily, goal.counter, goal.day, today) >= goal.target) {
      goal = { ...goal, done: true };
      out.derived.push({ t: 'goal_done', id: goal.id });
      firstDoneToday = true;
    }
    if (goal.done && !goal.paid) {
      const r = pay(s, ctx, LEDGER_IDS.goal(goal.day, goal.id), 'goal', each, out);
      if (r.settled) {
        s = r.state;
        goal = { ...goal, paid: true };
        if (r.paid > 0) out.effects.push({ t: 'toast', key: 'quests.goalDone', vars: { id: goal.id, n: r.paid } });
      }
    }
    return goal;
  };
  const goals = s.daily.goals.map(settle);
  const carried = s.daily.carried.map(settle);
  s = { ...s, daily: { ...s.daily, goals, carried } };

  // the streak bonus rides on the first goal finished today (¥15 per streak day, at most 10 days)
  if (firstDoneToday && !s.daily.streakPaid) {
    const days = Math.min(view.streakDays, BALANCE.goals.streakDaysMax);
    // scaled as a whole so that rounding to the currency step does not compound per day
    const amount = scaleAmount(Math.min(BALANCE.goals.streakPer * days, BALANCE.goals.streakMax), pack.economy, pack.currency);
    // no streak yet: leave it unpaid so a later goal today, after the streak has started, can still earn it
    if (amount > 0) {
      const r = pay(s, ctx, LEDGER_IDS.streak(today), 'streak', amount, out);
      if (r.settled) {
        s = { ...r.state, daily: { ...r.state.daily, streakPaid: true } };
        if (r.paid > 0) out.effects.push({ t: 'toast', key: 'quests.streak', vars: { n: r.paid, days } });
      }
    }
  }

  // the chest: each day's own trio, all done
  if (!s.daily.allPaid && s.daily.goals.length > 0 && s.daily.goals.every((g) => g.done)) {
    const r = pay(s, ctx, LEDGER_IDS.goal(today, 'all'), 'goal', scaleAmount(BALANCE.goals.all, pack.economy, pack.currency), out);
    if (r.settled) {
      s = { ...r.state, daily: { ...r.state.daily, allPaid: true } };
      out.derived.push({ t: 'daily_done', day: dayKey(today) });
      out.effects.push({ t: 'toast', key: 'quests.trio', vars: { n: r.paid } });
    }
  }
  return { state: s, derived: out.derived, effects: out.effects };
}
