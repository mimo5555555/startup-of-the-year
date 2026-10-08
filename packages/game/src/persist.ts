// Persistence helpers for the `useGame` store (agent 1F). The store itself lives in the app (docs/GAME_DESIGN.md §14.7).
// `migrate` is the one door every saved value goes through: it never throws, never drops an id it does not know (it moves it
// under `_extra`, and moves it back when a later pack knows it again), and repairs what a hand edit or a half-written save broke.
import { BALANCE } from './balance';
import { emptyFriend, emptyJob, emptyPay, emptyRun } from './defaults';
import { payForDay } from './integrity';
import { dayKey, reconcile } from './ledger';
import { walletLimits } from './money';
import { deriveCompleted } from './objectives';
import { createGameState } from './reducer';
import type {
  DailyCounter,
  DailyGoalState,
  DailySlot,
  FriendState,
  GamePack,
  GameState,
  GameView,
  JobState,
  LedgerEntry,
  LedgerKind,
  LegacySeed,
  RunRecord,
} from './types';

/** `version` of the persisted blob and of `migrate`. */
export const GAME_STORE_VERSION = 1;

/** The storage key of a pack's game save (§14.7). */
export const gameStorageKey = (packId: string): string => `lw.game.${packId}.v${GAME_STORE_VERSION}`;

/** The JSON text the store writes. States are JSON-safe by contract, so this cannot throw on a real GameState. */
export const serializeState = (state: GameState): string => JSON.stringify(state);

/** The value of a saved string, or `undefined` for nothing readable (an absent key, broken JSON). Never throws. */
export function parseSaved(raw: string | null | undefined): unknown {
  if (typeof raw !== 'string' || raw === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Coercion helpers: every one returns a usable value for any input
// ---------------------------------------------------------------------------------------------------------------

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const rec = (v: unknown): Rec => (isRec(v) ? v : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const bool = (v: unknown, def = false): boolean => (typeof v === 'boolean' ? v : def);
const text = (v: unknown, def = '', max = 400): string => (typeof v === 'string' ? v.slice(0, max) : def);
const num = (v: unknown, def: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
const int = (v: unknown, def: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number => Math.trunc(num(v, def, min, max));
const strs = (v: unknown, max = 2000): string[] => arr(v).filter((x): x is string => typeof x === 'string').slice(-max);
const uniq = (v: string[]): string[] => [...new Set(v)];
/** a record of string -> string, entries that are not strings dropped */
const strMap = (v: unknown): Record<string, string> => Object.fromEntries(Object.entries(rec(v)).filter((e): e is [string, string] => typeof e[1] === 'string'));
const intMap = (v: unknown, min = 0): Record<string, number> =>
  Object.fromEntries(Object.entries(rec(v)).filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1])).map(([k, n]) => [k, Math.max(min, Math.trunc(n))]));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LEDGER_KINDS: readonly string[] = ['loop', 'shift', 'goal', 'streak', 'chapter', 'star', 'phrase', 'echo', 'purchase', 'fare', 'topup', 'refund', 'gift', 'perk'];
const COUNTERS: readonly string[] = ['conv_distinct', 'indep_lines', 'new_intents', 'purchase', 'shift_good', 'friend_contact', 'places_distinct', 'review_checked', 'lesson', 'culture_new'];
const SLOTS: readonly string[] = ['speak', 'do', 'review'];

/** A view with nothing in it: the cache `chapter.completed` is judged from state alone (its only view-dependent input is a start gate that needs vocabulary). */
const NO_VIEW: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: '', level: 'A1', createdAt: '' },
};

// ---------------------------------------------------------------------------------------------------------------
// Slice sanitisers
// ---------------------------------------------------------------------------------------------------------------

function cleanLedger(v: unknown): LedgerEntry[] {
  const seen = new Set<string>();
  const out: LedgerEntry[] = [];
  for (const raw of arr(v)) {
    const e = rec(raw);
    const pocket = e.pocket;
    if (typeof e.id !== 'string' || !e.id || seen.has(e.id) || !LEDGER_KINDS.includes(e.kind as string)) continue;
    if (pocket !== 'cash' && pocket !== 'ic' && pocket !== 'points') continue;
    if (typeof e.delta !== 'number' || !Number.isFinite(e.delta)) continue;
    seen.add(e.id);
    const entry: LedgerEntry = { id: e.id, at: num(e.at, 0), kind: e.kind as LedgerKind, delta: Math.trunc(e.delta), pocket };
    if (typeof e.ref === 'string') entry.ref = e.ref;
    if (typeof e.note === 'string') entry.note = e.note;
    out.push(entry);
  }
  return out.slice(-BALANCE.ledger.entries);
}

function cleanPay(v: unknown, day: string, fallback: GameState['pay']): GameState['pay'] {
  const p = rec(v);
  if (Object.keys(p).length === 0) return fallback;
  const echo = rec(p.echoSession);
  return payForDay(
    {
      day: typeof p.day === 'string' && /^d\d+$/.test(p.day) ? p.day : day,
      langToday: int(p.langToday, 0, 0),
      firstPhraseToday: int(p.firstPhraseToday, 0, 0),
      echoToday: int(p.echoToday, 0, 0),
      echoSession: typeof echo.sessionId === 'string' ? { sessionId: echo.sessionId, n: int(echo.n, 0, 0) } : null,
      scenarioToday: intMap(p.scenarioToday),
      lastPaid: strMap(p.lastPaid),
      shiftsToday: intMap(p.shiftsToday),
      seenIntents: uniq(strs(p.seenIntents, 5000)),
      pointsToday: int(p.pointsToday, 0, 0),
      perkToday: int(p.perkToday, 0, 0),
      haggleToday: strs(p.haggleToday),
      perkFreeToday: strs(p.perkFreeToday),
    },
    day,
  );
}

function cleanRun(v: unknown): RunRecord {
  const r = rec(v);
  const stars = int(r.stars, 0, 0, 3) as RunRecord['stars'];
  return {
    ...emptyRun(),
    count: int(r.count, 0, 0),
    complete: bool(r.complete),
    stars,
    bestIndependent: int(r.bestIndependent, 0, 0),
    bestShare: num(r.bestShare, 0, 0, 1),
    bestR: num(r.bestR, 0, 0, 1),
    steps: uniq(strs(r.steps)),
  };
}

function cleanFriend(v: unknown, day: number): FriendState {
  const f = rec(v);
  const base = emptyFriend(day);
  const threads = arr(f.threads)
    .map(rec)
    .filter((t) => typeof t.template === 'string')
    .map((t) => ({ template: t.template as string, day: int(t.day, day, 0) }))
    .slice(-BALANCE.ap.chat.unreadMax);
  const optDay = (x: unknown): { v: number } | null => (typeof x === 'number' && Number.isFinite(x) ? { v: Math.trunc(x) } : null);
  const out: FriendState = {
    ...base,
    ap: int(f.ap, 0, 0),
    met: bool(f.met),
    apDay: int(f.apDay, day, 0),
    apToday: int(f.apToday, 0, 0),
    chatApToday: int(f.chatApToday, 0, 0),
    threads,
    unread: threads.length,
    chatRecent: strs(f.chatRecent, 10),
    facts: strMap(f.facts),
    learned: uniq(strs(f.learned)),
    gold: uniq(strs(f.gold)),
    callbacks: intMap(f.callbacks, Number.NEGATIVE_INFINITY),
    topicDay: intMap(f.topicDay, Number.NEGATIVE_INFINITY),
    events: arr(f.events).filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= BALANCE.ap.thresholds.length),
    flags: uniq(strs(f.flags)),
    giftHistory: arr(f.giftHistory)
      .map(rec)
      .filter((g) => typeof g.item === 'string')
      .map((g) => ({ item: g.item as string, day: int(g.day, 0) })),
    gifts: int(f.gifts, 0, 0),
    giftsLiked: int(f.giftsLiked, 0, 0),
    giftsLoved: int(f.giftsLoved, 0, 0),
  };
  for (const k of ['talkDay', 'giftDay', 'hangoutDay', 'lastContactDay', 'chatDay'] as const) {
    const d = optDay(f[k]);
    if (d) out[k] = d.v;
  }
  return out;
}

function cleanJob(v: unknown): JobState {
  const j = rec(v);
  const job: JobState = { ...emptyJob(), shifts: int(j.shifts, 0, 0), good: int(j.good, 0, 0), perfect: int(j.perfect, 0, 0), rank: int(j.rank, 0, 0, BALANCE.shift.rankMult.length - 1), recent: strs(j.recent, 30) };
  if (typeof j.lastDay === 'string' && /^d\d+$/.test(j.lastDay)) job.lastDay = j.lastDay;
  return job;
}

function cleanGoal(v: unknown): DailyGoalState | null {
  const g = rec(v);
  if (typeof g.id !== 'string' || !SLOTS.includes(g.slot as string) || !COUNTERS.includes(g.counter as string)) return null;
  return { id: g.id, slot: g.slot as DailySlot, counter: g.counter as DailyCounter, target: int(g.target, 1, 1), day: int(g.day, 0, 0), done: bool(g.done), paid: bool(g.paid) };
}

function cleanDaily(v: unknown, dayIndex: number): GameState['daily'] {
  const d = rec(v);
  const goals = (list: unknown): DailyGoalState[] => arr(list).map(cleanGoal).filter((g): g is DailyGoalState => g !== null).slice(0, 8);
  const counters: GameState['daily']['counters'] = {};
  for (const [k, row] of Object.entries(rec(d.counters))) {
    const day = Number(k);
    if (!Number.isInteger(day) || day < 0) continue;
    counters[day] = Object.fromEntries(Object.entries(rec(row)).filter(([c, n]) => COUNTERS.includes(c) && typeof n === 'number' && Number.isFinite(n)).map(([c, n]) => [c, Math.max(0, Math.trunc(n as number))]));
  }
  const sets: GameState['daily']['sets'] = {};
  for (const [k, row] of Object.entries(rec(d.sets))) {
    const day = Number(k);
    if (!Number.isInteger(day) || day < 0) continue;
    sets[day] = Object.fromEntries(Object.entries(rec(row)).filter(([c]) => COUNTERS.includes(c)).map(([c, list]) => [c, uniq(strs(list, 50))]));
  }
  return {
    day: int(d.day, dayIndex, 0, dayIndex),
    goals: goals(d.goals),
    carried: goals(d.carried),
    counters,
    sets,
    swapUsed: bool(d.swapUsed),
    allPaid: bool(d.allPaid),
    streakPaid: bool(d.streakPaid),
    recent: strs(d.recent, 12),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Ids: renames, unknown ids, restoring
// ---------------------------------------------------------------------------------------------------------------

/** Follows `pack.idAliases` (old -> new) to the current id; a cycle or a long chain stops at the last id reached. */
function aliasOf(pack: GamePack): (id: string) => string {
  const map = pack.idAliases ?? {};
  return (id) => {
    let cur = id;
    for (let i = 0; i < 8; i++) {
      const next = map[cur];
      if (next === undefined || next === cur) break;
      cur = next;
    }
    return cur;
  };
}

/** Re-keys a record through `alias`; two old ids that meet in one new id are merged by `merge`. */
function rekey<T>(m: Record<string, T>, alias: (id: string) => string, merge: (a: T, b: T) => T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(m)) {
    const id = alias(k);
    out[id] = id in out ? merge(out[id]!, v) : v;
  }
  return out;
}

const ids = {
  items: (pack: GamePack): Set<string> => new Set([...pack.items.map((i) => i.id), ...pack.menu.map((m) => m.id)]),
  objectives: (pack: GamePack): Set<string> => new Set(pack.chapters.flatMap((c) => c.objectives.map((o) => o.id))),
  dreamSteps: (pack: GamePack): Set<string> => new Set(pack.dreams.flatMap((d) => d.steps.map((s) => s.id))),
};

/** Splits a record into the part the pack knows and the rest; with an empty registry (a pack that does not list this kind of id) nothing is unknown. */
function split<T>(m: Record<string, T>, known: Set<string>): { keep: Record<string, T>; extra: Record<string, T> } {
  if (known.size === 0) return { keep: m, extra: {} };
  const keep: Record<string, T> = {};
  const extra: Record<string, T> = {};
  for (const [k, v] of Object.entries(m)) (known.has(k) ? keep : extra)[k] = v;
  return { keep, extra };
}

const splitList = (l: string[], known: Set<string>): { keep: string[]; extra: string[] } =>
  known.size === 0 ? { keep: l, extra: [] } : { keep: l.filter((x) => known.has(x)), extra: l.filter((x) => !known.has(x)) };

const nonEmpty = (o: Rec): boolean => Object.values(o).some((v) => (Array.isArray(v) ? v.length > 0 : isRec(v) ? Object.keys(v).length > 0 : v !== undefined && v !== null));

// ---------------------------------------------------------------------------------------------------------------
// migrate
// ---------------------------------------------------------------------------------------------------------------

/** The top-level keys of a GameState: any other key of a saved value is an unknown field and is kept under `_extra.fields`. */
const KNOWN_FIELDS: ReadonlySet<string> = new Set(Object.keys(createGameState({ id: 'x', economy: { startCash: 0 } } as unknown as GamePack, 0)));

/**
 * Brings any persisted value to the current GameState: fills missing fields, applies `pack.idAliases`, keeps unknown ids and
 * fields under `_extra`, re-derives `chapter.completed`, repairs corrupt shapes. Never throws on bad input.
 */
export function migrate(persisted: unknown, from: number, pack: GamePack): GameState {
  void from; // one schema so far: a later version adds `if (from < 2) ...` steps here before the repair below
  const fresh = createGameState(pack, 0);
  // an unreadable clock is re-anchored by `observeClock` without a rollover
  const base: GameState = { ...fresh, clock: { ...fresh.clock, lastLocalDate: '', lastSeenAt: 0 } };
  if (!isRec(persisted)) {
    const unreadable = persisted === undefined || persisted === null ? undefined : persisted;
    return unreadable === undefined ? base : { ...base, _extra: { fields: { unreadable: JSON.stringify(unreadable)?.slice(0, 100_000) ?? String(unreadable) } } };
  }
  const src = persisted;
  const alias = aliasOf(pack);
  const prior = rec(src._extra);
  const priorIds = rec(prior.ids);
  const extraIds: Rec = {};
  const extraFields: Rec = { ...rec(prior.fields) };

  // clock
  const c = rec(src.clock);
  const dayIndex = int(c.dayIndex, 0, 0, 1_000_000);
  const clock: GameState['clock'] = {
    dayIndex,
    lastLocalDate: typeof c.lastLocalDate === 'string' && DATE_RE.test(c.lastLocalDate) ? c.lastLocalDate : '',
    lastSeenAt: num(c.lastSeenAt, 0, 0),
    activeDays: int(c.activeDays, 0, 0, dayIndex + 1),
    lastActiveDay: int(c.lastActiveDay, -1, -1, dayIndex),
  };

  // chapter (needed by the wallet caps)
  const ch = rec(src.chapter);
  const lastChapter = pack.chapters.reduce((m, x) => Math.max(m, x.n), 0);
  let chapterN = int(ch.n, 1, 1, BALANCE.freeWalkChapter);
  if (lastChapter > 0 && chapterN > lastChapter) chapterN = BALANCE.freeWalkChapter;
  const objectiveIds = ids.objectives(pack);
  const doneRaw = rekey(strMap(ch.done), alias, (a) => a);
  const triesRaw = rekey(intMap(ch.tries), alias, (a, b) => Math.max(a, b));
  const doneSplit = split(doneRaw, objectiveIds);
  const easierSplit = splitList(uniq(strs(ch.easier).map(alias)), objectiveIds);
  const triesSplit = split(triesRaw, objectiveIds);
  const began = rec(ch.began);

  // wallet and totals: integers, never negative, inside the caps; a total that no longer reconciles is rebuilt from the wallet
  const w = rec(src.wallet);
  const probe = { ...base, chapter: { ...base.chapter, n: chapterN } };
  const lim = walletLimits(probe, pack);
  const wallet = { cash: int(w.cash, pack.economy.startCash, 0, lim.cash), ic: int(w.ic, 0, 0, lim.ic), points: int(w.points, 0, 0, lim.cash) };
  const t = rec(src.totals);
  const ck = rec(t.checksum);
  let totals: GameState['totals'] = {
    earned: int(t.earned, 0, 0),
    spent: int(t.spent, 0, 0),
    checksum: { cash: int(ck.cash, wallet.cash), ic: int(ck.ic, wallet.ic), points: int(ck.points, wallet.points) },
  };
  if (!reconcile({ ...base, wallet, totals }, pack.economy.startCash).ok) {
    const held = wallet.cash + wallet.ic;
    totals = { earned: Math.max(0, held - pack.economy.startCash), spent: Math.max(0, pack.economy.startCash - held), checksum: { ...wallet } };
  }

  // owned: renames merged, ids the pack does not sell kept aside
  const ownedRaw: GameState['owned'] = {};
  for (const [k, v] of Object.entries(rec(src.owned))) {
    const e = rec(v);
    const qty = int(e.qty, 0, 0);
    if (qty < 1) continue;
    const id = alias(k);
    const prev = ownedRaw[id];
    ownedRaw[id] = { qty: (prev?.qty ?? 0) + qty, day: prev && prev.day < text(e.day, 'd0', 16) ? prev.day : text(e.day, 'd0', 16) };
  }
  // single-ownership items never exceed one (a rename that merged two copies, a hand edit)
  for (const it of pack.items) if (it.once && ownedRaw[it.id] && ownedRaw[it.id]!.qty > 1) ownedRaw[it.id] = { ...ownedRaw[it.id]!, qty: 1 };
  const ownedSplit = split(ownedRaw, ids.items(pack));

  // runs, friends, jobs, culture, prep
  const runsSplit = split(
    rekey(Object.fromEntries(Object.entries(rec(src.runs)).map(([k, v]) => [k, cleanRun(v)])), alias, (a, b): RunRecord => ({
      count: a.count + b.count,
      complete: a.complete || b.complete,
      stars: Math.max(a.stars, b.stars) as RunRecord['stars'],
      bestIndependent: Math.max(a.bestIndependent, b.bestIndependent),
      bestShare: Math.max(a.bestShare, b.bestShare),
      bestR: Math.max(a.bestR, b.bestR),
      steps: uniq([...a.steps, ...b.steps]),
    })),
    new Set(pack.scenarioMeta.map((m) => m.id)),
  );
  const friendsSplit = split(
    rekey(Object.fromEntries(Object.entries(rec(src.friends)).map(([k, v]) => [k, cleanFriend(v, dayIndex)])), alias, (a, b) => (b.ap > a.ap ? b : a)),
    new Set(pack.friends.map((f) => f.id)),
  );
  const jobsSplit = split(
    rekey(Object.fromEntries(Object.entries(rec(src.jobs)).map(([k, v]) => [k, cleanJob(v)])), alias, (a, b) => (b.shifts > a.shifts ? b : a)),
    new Set(pack.jobs.map((j) => j.id)),
  );
  const cultureSplit = split(rekey(strMap(src.culture), alias, (a) => a), new Set(pack.culture.map((x) => x.id)));
  const prepRaw: GameState['prep'] = {};
  for (const [k, v] of Object.entries(rec(src.prep))) {
    const p = rec(v);
    if (p.s === 'seen' || p.s === 'ready') prepRaw[alias(k)] = { s: p.s, at: int(p.at, 0, 0) };
  }
  const prepSplit = split(prepRaw, new Set(Object.keys(pack.pockets)));

  // titles, beats, dream
  const titlesSplit = splitList(uniq(strs(src.titles).map(alias)), new Set(pack.titles.map((x) => x.id)));
  const beatsSplit = splitList(uniq(strs(src.beats).map(alias)), new Set(Object.keys(pack.beats)));
  const d = rec(src.dream);
  const dreamId = typeof d.id === 'string' ? alias(d.id) : null;
  const dreamKnown = dreamId === null || pack.dreams.length === 0 || pack.dreams.some((x) => x.id === dreamId);
  const stepSplit = split(rekey(strMap(d.steps), alias, (a) => a), ids.dreamSteps(pack));
  const activeTitle = typeof src.activeTitle === 'string' ? alias(src.activeTitle) : null;

  const me = rec(src.me);
  const a = rec(src.audio);
  const co = rec(src.coach);
  const stats = rec(src.stats);
  const gifts = rec(stats.gifts);
  const chats = rec(stats.chats);
  const flags = rec(src.flags);
  const audio: GameState['audio'] = {
    sttConsent: a.sttConsent === 'allowed' || a.sttConsent === 'declined' ? a.sttConsent : 'unset',
    micPref: a.micPref === 'off' ? 'off' : 'auto',
    listenPref: a.listenPref === 'off' ? 'off' : 'on',
  };
  if (typeof a.ttsRateScale === 'number' && Number.isFinite(a.ttsRateScale)) audio.ttsRateScale = num(a.ttsRateScale, 1, 0.5, 1.5);
  if (typeof a.lastMode === 'string') audio.lastMode = a.lastMode.slice(0, 32);
  if (typeof a.lastCheckedAt === 'number' && Number.isFinite(a.lastCheckedAt)) audio.lastCheckedAt = a.lastCheckedAt;
  const homeSrc = rec(src.home);
  const holds = (id: string): boolean => (ownedSplit.keep[id]?.qty ?? 0) >= 1;
  const out: GameState = {
    v: 1,
    packId: pack.id,
    clock,
    wallet,
    totals,
    ledger: cleanLedger(src.ledger),
    seen: uniq(strs(src.seen, BALANCE.ledger.seen * 4)).slice(-BALANCE.ledger.seen),
    pay: cleanPay(src.pay, dayKey(dayIndex), emptyPay(dayKey(dayIndex))),
    runs: runsSplit.keep,
    stats: {
      purchases: int(stats.purchases, 0, 0),
      spentOnPurchases: int(stats.spentOnPurchases, 0, 0),
      gifts: { n: int(gifts.n, 0, 0), liked: int(gifts.liked, 0, 0), loved: int(gifts.loved, 0, 0) },
      chats: { n: int(chats.n, 0, 0), friends: split(rekey(intMap(chats.friends), alias, (x, y) => x + y), new Set(pack.friends.map((f) => f.id))).keep },
      hangouts: intMap(stats.hangouts),
      visits: uniq(strs(stats.visits, 500)),
      spots: uniq(strs(stats.spots, 100)),
      tickets: int(stats.tickets, 0, 0),
      sayNew: int(stats.sayNew, 0, 0),
      srsReviews: int(stats.srsReviews, 0, 0),
      cultureSaid: uniq(strs(stats.cultureSaid).map(alias)),
      perksUsed: uniq(strs(stats.perksUsed)),
      perkBuys: intMap(stats.perkBuys),
    },
    owned: ownedSplit.keep,
    // what is worn or placed must be owned (an item the pack dropped, or a hand-edited save, would otherwise wear or place a ghost)
    outfit: { equipped: uniq(strs(rec(src.outfit).equipped, 30).map(alias)).filter(holds), colours: strMap(rec(src.outfit).colours) },
    home: { tier: homeSrc.tier === 'ono' ? 'ono' : 'dorm', placed: Object.fromEntries(Object.entries(strMap(homeSrc.placed)).filter(([, id]) => holds(id))) },
    tickets: {
      ...(typeof rec(rec(src.tickets).ramen).flavor === 'string' ? { ramen: { flavor: rec(rec(src.tickets).ramen).flavor as string } } : {}),
      ...(typeof rec(rec(src.tickets).station).place === 'string' ? { station: { place: rec(rec(src.tickets).station).place as string } } : {}),
    },
    chapter: {
      n: chapterN,
      done: doneSplit.keep,
      completed: [],
      flags: uniq(strs(ch.flags)),
      easier: easierSplit.keep,
      tries: triesSplit.keep,
      began: { dayIndex: int(began.dayIndex, 0, 0, dayIndex), activeDays: int(began.activeDays, 0, 0, clock.activeDays) },
    },
    dream: { id: dreamKnown ? dreamId : null, steps: stepSplit.keep, done: dreamKnown && bool(d.done) },
    daily: cleanDaily(src.daily, dayIndex),
    friends: friendsSplit.keep,
    jobs: jobsSplit.keep,
    prep: prepSplit.keep,
    culture: cultureSplit.keep,
    titles: titlesSplit.keep,
    activeTitle: activeTitle !== null && titlesSplit.keep.includes(activeTitle) && (pack.titles.length === 0 || pack.titles.some((x) => x.id === activeTitle)) ? activeTitle : null,
    stickers: uniq(strs(src.stickers)),
    keepsakes: uniq(strs(src.keepsakes)),
    beats: beatsSplit.keep,
    words: { said: uniq(strs(rec(src.words).said, 5000)) },
    diary: arr(src.diary)
      .map(rec)
      .filter((e) => typeof e.ja === 'string' && e.ja !== '')
      .map((e) => ({ chapter: int(e.chapter, 1, 1, BALANCE.freeWalkChapter), ja: text(e.ja), assisted: bool(e.assisted) }))
      .slice(-40),
    letter: arr(src.letter)
      .map(rec)
      .filter((e) => typeof e.ja === 'string')
      .map((e) => ({ ja: text(e.ja, '', 300), assisted: bool(e.assisted) }))
      .slice(0, 12),
    income: arr(src.income)
      .map(rec)
      .filter((e) => typeof e.day === 'number' && typeof e.net === 'number' && Number.isFinite(e.day) && Number.isFinite(e.net))
      .map((e) => ({ day: Math.trunc(e.day as number), net: Math.trunc(e.net as number) }))
      .slice(-BALANCE.dream.etaWindowDays),
    coach: {
      recent: arr(co.recent)
        .map(rec)
        .filter((r) => typeof r.scenarioId === 'string')
        .map((r) => ({ day: int(r.day, 0, 0), scenarioId: r.scenarioId as string, r: num(r.r, 0, 0, 1), fallbacks: int(r.fallbacks, 0, 0) }))
        .slice(-BALANCE.coach.recent),
      realFor: uniq(strs(co.realFor)),
      sinceChange: int(co.sinceChange, 0, 0),
    },
    audio,
    me: { nameKana: text(me.nameKana, '', 24) },
    flags: {
      ...(typeof flags.dev === 'boolean' ? { dev: flags.dev } : {}),
      ...(typeof flags.welcomeSeenDay === 'number' && Number.isFinite(flags.welcomeSeenDay) ? { welcomeSeenDay: Math.trunc(flags.welcomeSeenDay) } : {}),
    },
    seeded: bool(src.seeded),
  };

  // what the pack does not know is parked, not dropped
  const park = (key: string, value: Rec | string[]): void => {
    if (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0) extraIds[key] = value;
  };
  park('owned', ownedSplit.extra);
  park('runs', runsSplit.extra);
  park('friends', friendsSplit.extra);
  park('jobs', jobsSplit.extra);
  park('culture', cultureSplit.extra);
  park('prep', prepSplit.extra);
  park('done', doneSplit.extra);
  park('tries', triesSplit.extra);
  park('easier', easierSplit.extra);
  park('titles', titlesSplit.extra);
  park('beats', beatsSplit.extra);
  park('dreamSteps', stepSplit.extra);
  if (!dreamKnown && dreamId !== null) extraIds.dreamId = dreamId;
  for (const [k, v] of Object.entries(src)) if (!KNOWN_FIELDS.has(k) && k !== '_extra') extraFields[k] = v;

  const { state: result, parked } = restore(out, priorIds, extraIds, pack);
  const fields = extraFields;
  if (nonEmpty(parked) || nonEmpty(fields)) result._extra = { ...(nonEmpty(parked) ? { ids: parked } : {}), ...(nonEmpty(fields) ? { fields } : {}) };
  result.chapter = { ...result.chapter, completed: deriveCompleted(pack, result, NO_VIEW) };
  return result;
}

/** A parked section: how to tell whether the pack knows an id (again) and how to put a parked value back into the state. */
interface Section {
  key: string;
  known: (id: string) => boolean;
  /** the state with the value put back, 'have' when the state already holds the id (the parked value is superseded), 'bad' for a value that does not fit (it stays parked) */
  put: (s: GameState, id: string, v: unknown) => GameState | 'have' | 'bad';
}

function sections(pack: GamePack): Section[] {
  const items = ids.items(pack);
  const objectives = ids.objectives(pack);
  const steps = ids.dreamSteps(pack);
  const pockets = new Set(Object.keys(pack.pockets));
  return [
    {
      key: 'owned',
      known: (id) => items.has(id),
      put: (s, id, v) => (id in s.owned ? 'have' : int(rec(v).qty, 0, 0) < 1 ? 'bad' : { ...s, owned: { ...s.owned, [id]: { qty: int(rec(v).qty, 1, 1), day: text(rec(v).day, 'd0', 16) } } }),
    },
    { key: 'runs', known: (id) => pack.scenarioMeta.some((m) => m.id === id), put: (s, id, v) => (id in s.runs ? 'have' : { ...s, runs: { ...s.runs, [id]: cleanRun(v) } }) },
    { key: 'friends', known: (id) => pack.friends.some((f) => f.id === id), put: (s, id, v) => (id in s.friends ? 'have' : { ...s, friends: { ...s.friends, [id]: cleanFriend(v, s.clock.dayIndex) } }) },
    { key: 'jobs', known: (id) => pack.jobs.some((j) => j.id === id), put: (s, id, v) => (id in s.jobs ? 'have' : { ...s, jobs: { ...s.jobs, [id]: cleanJob(v) } }) },
    { key: 'culture', known: (id) => pack.culture.some((x) => x.id === id), put: (s, id, v) => (id in s.culture ? 'have' : typeof v !== 'string' ? 'bad' : { ...s, culture: { ...s.culture, [id]: v } }) },
    {
      key: 'prep',
      known: (id) => pockets.has(id),
      put: (s, id, v) => (id in s.prep ? 'have' : rec(v).s !== 'seen' && rec(v).s !== 'ready' ? 'bad' : { ...s, prep: { ...s.prep, [id]: { s: rec(v).s as 'seen' | 'ready', at: int(rec(v).at, 0, 0) } } }),
    },
    { key: 'done', known: (id) => objectives.has(id), put: (s, id, v) => (id in s.chapter.done ? 'have' : typeof v !== 'string' ? 'bad' : { ...s, chapter: { ...s.chapter, done: { ...s.chapter.done, [id]: v } } }) },
    { key: 'tries', known: (id) => objectives.has(id), put: (s, id, v) => (id in s.chapter.tries ? 'have' : { ...s, chapter: { ...s.chapter, tries: { ...s.chapter.tries, [id]: int(v, 0, 0) } } }) },
    { key: 'dreamSteps', known: (id) => steps.has(id), put: (s, id, v) => (id in s.dream.steps ? 'have' : typeof v !== 'string' ? 'bad' : { ...s, dream: { ...s.dream, steps: { ...s.dream.steps, [id]: v } } }) },
  ];
}

/** The list sections (a list holds ids, a record holds id -> value). */
const LIST_SECTIONS = ['titles', 'beats', 'easier'] as const;

/**
 * Ids parked by an earlier load come back when the pack knows them (again): a removed item that a later version re-adds returns to
 * the inventory. `now` holds what this load parked; whatever is still unknown stays parked, merged with what was parked before.
 */
function restore(state: GameState, before: Rec, now: Rec, pack: GamePack): { state: GameState; parked: Rec } {
  const alias = aliasOf(pack);
  const parked: Rec = {};
  // union of both loads: a record section keeps the newer value of an id, a list section keeps every id
  for (const key of new Set([...Object.keys(before), ...Object.keys(now)])) {
    const a = before[key];
    const b = now[key];
    if (Array.isArray(a) || Array.isArray(b)) parked[key] = uniq([...strs(a), ...strs(b)]);
    else if (isRec(a) || isRec(b)) parked[key] = { ...rec(a), ...rec(b) };
    else parked[key] = b ?? a;
  }
  let s = state;
  for (const sec of sections(pack)) {
    const held = rec(parked[sec.key]);
    for (const [raw, v] of Object.entries(held)) {
      const id = alias(raw);
      if (!sec.known(id)) continue;
      const next = sec.put(s, id, v);
      if (next === 'bad') continue;
      if (next !== 'have') s = next;
      delete held[raw];
    }
    if (Object.keys(held).length > 0) parked[sec.key] = held;
    else delete parked[sec.key];
  }
  const titles = new Set(pack.titles.map((x) => x.id));
  const beats = new Set(Object.keys(pack.beats));
  const objectives = ids.objectives(pack);
  for (const key of LIST_SECTIONS) {
    const known = key === 'titles' ? titles : key === 'beats' ? beats : objectives;
    const held = strs(parked[key]);
    const back = held.map(alias).filter((id) => known.has(id));
    if (back.length === 0) continue;
    if (key === 'titles') s = { ...s, titles: uniq([...s.titles, ...back]) };
    else if (key === 'beats') s = { ...s, beats: uniq([...s.beats, ...back]) };
    else s = { ...s, chapter: { ...s.chapter, easier: uniq([...s.chapter.easier, ...back]) } };
    const rest = held.filter((id) => !known.has(alias(id)));
    if (rest.length > 0) parked[key] = rest;
    else delete parked[key];
  }
  // a dream id parked because the pack did not list it returns when it does
  if (typeof parked.dreamId === 'string' && state.dream.id === null && pack.dreams.some((d) => d.id === alias(parked.dreamId as string))) {
    s = { ...s, dream: { ...s.dream, id: alias(parked.dreamId as string) } };
    delete parked.dreamId;
  }
  return { state: s, parked };
}

// ---------------------------------------------------------------------------------------------------------------
// Seed from the legacy store
// ---------------------------------------------------------------------------------------------------------------

/**
 * First-run seed from the legacy store: friends[id].met and runs[id].stars from `completed` (count >= 1 -> ★1, best >= 100 -> ★2),
 * no retroactive yen; sets `seeded`. Idempotent. A character is "met" through the scenarios `pack.interactions` lists for it; a
 * scenario the pack does not know is kept under `_extra.fields.legacyCompleted` (never dropped).
 */
export function seedFromLegacy(state: GameState, pack: GamePack, legacy: LegacySeed): GameState {
  if (state.seeded) return state;
  const alias = aliasOf(pack);
  const runs = { ...state.runs };
  const friends = { ...state.friends };
  const unknown: Record<string, { count: number; best: number }> = {};
  const known = new Set(pack.scenarioMeta.map((m) => m.id));
  const characterOf = new Map<string, string>();
  for (const [character, list] of Object.entries(pack.interactions)) for (const i of list) if (i.scenarioId) characterOf.set(i.scenarioId, character);
  for (const [raw, c] of Object.entries(rec(legacy?.completed))) {
    const count = int(rec(c).count, 0, 0);
    const best = num(rec(c).best, 0);
    if (count < 1) continue;
    const id = alias(raw);
    if (known.size > 0 && !known.has(id)) {
      unknown[raw] = { count, best };
      continue;
    }
    const stars = (best >= 100 ? 2 : 1) as RunRecord['stars'];
    const run = runs[id] ?? emptyRun();
    // the legacy store has no goal steps, so `complete` stays false: it is only set by a settled conversation
    runs[id] = { ...run, count: Math.max(run.count, count), stars: Math.max(run.stars, stars) as RunRecord['stars'] };
    const who = characterOf.get(id) ?? metaFriend(pack, id);
    if (who && pack.friends.some((f) => f.id === who)) friends[who] = { ...(friends[who] ?? emptyFriend(state.clock.dayIndex)), met: true };
  }
  const next: GameState = { ...state, runs, friends, seeded: true };
  if (Object.keys(unknown).length === 0) return next;
  const extra = rec(state._extra);
  const fields = rec(extra.fields);
  return { ...next, _extra: { ...extra, fields: { ...fields, legacyCompleted: { ...rec(fields.legacyCompleted), ...unknown } } } };
}

const metaFriend = (pack: GamePack, scenarioId: string): string | undefined => pack.scenarioMeta.find((m) => m.id === scenarioId)?.friendId;
