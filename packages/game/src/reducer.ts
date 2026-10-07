// The single entry point (agent 1F): integrity -> economy -> friends -> inventory -> mastery -> srs bridge -> objectives -> daily -> effects.
// Deterministic given (state, event, ctx); never mutates `state`. Every owner module does the arithmetic; this file only wires
// the stages, files the facts no owner module owns (runs of scripted events, stats, flags, beats, culture cards, the coach, the
// income ring) and keeps replays harmless: an event that is a duplicate or is refused changes nothing and bumps no daily counter.
import { BALANCE } from './balance';
import { updateDaily, swapDaily } from './daily';
import { emptyFriend, emptyPay } from './defaults';
import { availableDreams } from './dreams';
import { applyGift, applyHeartEvent, applyTalk, queueThreads } from './friends';
import { dedupe, localDateString, markActive, observeClock, payForDay } from './integrity';
import { applyOutfit, grantItem, hasFeature, placeItem } from './inventory';
import { applyLedger, dayKey, LEDGER_IDS, ledgerHas, refundIc, topUp } from './ledger';
import { walletLimits } from './money';
import { acceptEasier, chapterDef, evaluateAll } from './objectives';
import { applyEcho, applySettlement, echoPassMark, settleLoop } from './payout';
import { commitPurchase, fareFor } from './pricing';
import { applyShift } from './shifts';
import type {
  BeatEffect,
  ConversationFacts,
  CultureOn,
  CultureTrigger,
  DerivedEvent,
  GamePack,
  GameState,
  InputEvent,
  ReduceCtx,
  ReduceResult,
  ScenarioMeta,
  SrsOp,
  TalkKind,
  UiEffect,
} from './types';

// ---------------------------------------------------------------------------------------------------------------
// State of a new game
// ---------------------------------------------------------------------------------------------------------------

/** A fresh state: wallet = startCash, chapter 1, empty rings, `seeded` false (the legacy seed runs separately, see persist.seedFromLegacy). */
export function createGameState(pack: GamePack, now: number): GameState {
  const cash = pack.economy.startCash;
  return {
    v: 1,
    packId: pack.id,
    clock: { dayIndex: 0, lastLocalDate: localDateString(now), lastSeenAt: now, activeDays: 0, lastActiveDay: -1 },
    wallet: { cash, ic: 0, points: 0 },
    totals: { earned: 0, spent: 0, checksum: { cash, ic: 0, points: 0 } },
    ledger: [],
    seen: [],
    pay: emptyPay(dayKey(0)),
    runs: {},
    stats: { purchases: 0, spentOnPurchases: 0, gifts: { n: 0, liked: 0, loved: 0 }, chats: { n: 0, friends: {} }, hangouts: {}, visits: [], spots: [], tickets: 0, sayNew: 0, srsReviews: 0, cultureSaid: [], perksUsed: [], perkBuys: {} },
    owned: {},
    outfit: { equipped: [], colours: {} },
    home: { tier: 'dorm', placed: {} },
    tickets: {},
    chapter: { n: 1, done: {}, completed: [], flags: [], easier: [], tries: {}, began: { dayIndex: 0, activeDays: 0 } },
    dream: { id: null, steps: {}, done: false },
    daily: { day: 0, goals: [], carried: [], counters: {}, sets: {}, swapUsed: false, allPaid: false, streakPaid: false, recent: [] },
    friends: {},
    jobs: {},
    prep: {},
    culture: {},
    titles: [],
    activeTitle: null,
    stickers: [],
    keepsakes: [],
    beats: [],
    words: { said: [] },
    diary: [],
    letter: [],
    income: [],
    coach: { recent: [], realFor: [], sinceChange: 0 },
    audio: { sttConsent: 'unset', micPref: 'auto', listenPref: 'on' },
    me: { nameKana: '' },
    flags: {},
    seeded: false,
  };
}

/** Events that move money, buy things or move the story flush the store at once (`flushNow()`); the rest is debounced (§14.7). */
export function needsFlush(ev: InputEvent): boolean {
  switch (ev.t) {
    case 'conversation_done':
    case 'purchase':
    case 'topup':
    case 'refund':
    case 'fare':
    case 'gift_given':
    case 'shift_done':
    case 'echo':
    case 'beat_done':
    case 'letter_saved':
    case 'flag':
    case 'dream_chosen':
    case 'easier_accept':
    case 'heart_event_done':
    case 'phone_chat_done':
    case 'ticket_bought':
    case 'trip_done':
    case 'culture_say':
    case 'dev':
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The accumulator one `reduce` call threads through the stages
// ---------------------------------------------------------------------------------------------------------------

/** What an event told the culture stage ("the first time its trigger happens", §10). */
interface Probe {
  on: CultureOn;
  keys?: string[];
  count?: number;
}

interface Acc {
  s: GameState;
  derived: DerivedEvent[];
  effects: UiEffect[];
  probes: Probe[];
  /** false for a duplicate or a refused event: nothing changed, so no daily counter may be bumped from it */
  effective: boolean;
  /** the day's first meaningful action counts the day as active (`clock.activeDays`) */
  active: boolean;
  /** cash spent on catalog items this call: it is the goal being saved for, so it stays out of the pace estimate (`state.income`) */
  catalogSpent: number;
}

const absorb = (a: Acc, r: ReduceResult): void => {
  a.s = r.state;
  a.derived.push(...r.derived);
  a.effects.push(...r.effects);
};

const addUnique = <T>(list: readonly T[], v: T): T[] => (list.includes(v) ? [...list] : [...list, v]);

const metaOf = (pack: GamePack, id: string): ScenarioMeta | undefined => pack.scenarioMeta.find((m) => m.id === id);

const friendOf = (s: GameState, id: string) => s.friends[id] ?? emptyFriend(s.clock.dayIndex);

/** Flags that belong to the friend the conversation was with; every other flag is a story flag (`chapter.flags`). */
const FRIEND_FLAGS: ReadonlySet<string> = new Set(['number_note', 'casual']);

function setFlag(a: Acc, id: string, friendId?: string): void {
  if (typeof id !== 'string' || !id || id.length > 64) return;
  if (friendId !== undefined) {
    const f = friendOf(a.s, friendId);
    if (f.flags.includes(id)) return;
    a.s = { ...a.s, friends: { ...a.s.friends, [friendId]: { ...f, flags: [...f.flags, id] } } };
    if (id === 'casual') a.probes.push({ on: 'casual_switch', keys: [friendId] });
    return;
  }
  if (a.s.chapter.flags.includes(id)) return;
  a.s = { ...a.s, chapter: { ...a.s.chapter, flags: [...a.s.chapter.flags, id] } };
  if (id === 'festival') a.probes.push({ on: 'festival' });
}

/** The flags a scenario raised: friend flags go to the friend of the conversation, the rest to the story. */
function fileFlags(a: Acc, flags: string[] | undefined, friendId: string | undefined, pack: GamePack): void {
  for (const id of flags ?? []) {
    if (FRIEND_FLAGS.has(id) && friendId !== undefined && pack.friends.some((f) => f.id === friendId)) setFlag(a, id, friendId);
    else setFlag(a, id);
  }
}

const itemKnown = (pack: GamePack, id: string): boolean => pack.items.some((i) => i.id === id) || pack.menu.some((m) => m.id === id);

/** A culture card: state, derived event, the pop-up and the cosmetic XP. A known or unknown card id is a no-op. */
function unlockCulture(a: Acc, pack: GamePack, id: string, ctx: ReduceCtx): void {
  if (a.s.culture[id] !== undefined) return;
  const card = pack.culture.find((c) => c.id === id);
  if (!card) return;
  // adult-flagged topics stay hidden for kids and teens (§11.9)
  if (card.adultOnly && pack.ageProfiles[ctx.view.profile.age]?.adultTopics === false) return;
  a.s = { ...a.s, culture: { ...a.s.culture, [id]: dayKey(a.s.clock.dayIndex) } };
  a.derived.push({ t: 'culture_unlocked', id });
  a.effects.push({ t: 'culture', id }, { t: 'xp', amount: BALANCE.cultureXp, why: 'culture' });
}

/** The effects of a beat (and of a scenario's first completion), filed once. */
function applyBeatEffects(a: Acc, effects: BeatEffect[] | undefined, ctx: ReduceCtx): void {
  const { pack } = ctx;
  const day = dayKey(a.s.clock.dayIndex);
  for (const fx of effects ?? []) {
    switch (fx.t) {
      case 'flag':
        setFlag(a, fx.id);
        break;
      case 'friendFlag':
        if (pack.friends.some((f) => f.id === fx.friend)) setFlag(a, fx.id, fx.friend);
        break;
      case 'item': {
        if (!itemKnown(pack, fx.id)) break;
        const next = grantItem(a.s, pack, fx.id, fx.qty ?? 1, day);
        if (next !== a.s) a.derived.push({ t: 'unlocked', what: 'item', id: fx.id });
        a.s = next;
        break;
      }
      case 'keepsake':
        a.s = { ...a.s, keepsakes: addUnique(a.s.keepsakes, fx.id) };
        break;
      case 'culture':
        unlockCulture(a, pack, fx.id, ctx);
        break;
      case 'title':
        if (!a.s.titles.includes(fx.id)) {
          a.s = { ...a.s, titles: [...a.s.titles, fx.id] };
          a.derived.push({ t: 'title_earned', id: fx.id });
        }
        break;
      case 'sticker':
        if (!a.s.stickers.includes(fx.id)) {
          a.s = { ...a.s, stickers: [...a.s.stickers, fx.id] };
          a.derived.push({ t: 'sticker_earned', id: fx.id });
        }
        break;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------------------------------------------

/** ScenarioMeta.kind -> how the friend counts the contact; every other kind is an ordinary counted talk (§8.3). */
function talkKind(meta: ScenarioMeta | undefined): TalkKind {
  switch (meta?.kind) {
    case 'hangout':
      return 'hangout';
    case 'home':
      return 'home';
    case 'heart':
      return 'heart';
    case 'chat':
      return 'chat';
    default:
      return 'talk';
  }
}

/** Katakana to hiragana, punctuation and spacing out: the same folding `normJa` applies to a spoken or typed turn. */
function foldJa(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s|。、！？!?,.「」『』…・（）()~〜ー-]/g, '')
    .toLowerCase();
}

/** The parts of a culture card's key phrase a learner may say ('いただきます / ごちそうさまでした' is two phrases), folded. */
const phraseParts = (ja: string): string[] =>
  ja
    .split(/\s+[/／]\s+/)
    .map(foldJa)
    .filter((p) => p.length >= 2);

/** `say:true` cards whose key phrase a class-I turn contains (§10: a conversation counts as the Say-it). */
function saidCards(a: Acc, facts: ConversationFacts, pack: GamePack): string[] {
  const cards = pack.culture.filter((c) => c.say && !a.s.stats.cultureSaid.includes(c.id));
  if (cards.length === 0) return [];
  const turns = facts.turns.filter((t) => t.substantive && t.cls === 'I' && typeof t.norm === 'string').map((t) => foldJa(t.norm));
  return cards.filter((c) => phraseParts(c.phrase.ja).some((p) => turns.some((n) => n.includes(p)))).map((c) => c.id);
}

/** Implicit "use = review" ops for the words of class-I turns (§11.5); the app applies them to due cards, once per card per day. */
function useReviews(facts: ConversationFacts): SrsOp[] {
  const words = new Set<string>();
  for (const t of facts.turns) {
    if (!t.substantive || t.cls !== 'I' || t.copied) continue;
    for (const w of t.words ?? []) words.add(w);
  }
  return [...words].map((key): SrsOp => ({ op: 'review', key, kind: 'word', grade: 'good' }));
}

function onConversation(a: Acc, facts: ConversationFacts, ctx: ReduceCtx): void {
  const { pack } = ctx;
  if (ledgerHas(a.s, LEDGER_IDS.loop(facts.sessionId))) {
    a.effective = false;
    return;
  }
  const meta = metaOf(pack, facts.scenarioId);
  const complete = !facts.abandoned && facts.goalTotal > 0 && facts.goalDone >= facts.goalTotal;
  const firstComplete = complete && !a.s.runs[facts.scenarioId]?.complete;

  // economy: the settlement is pure on (facts, state, pack) and written once
  const settlement = settleLoop(facts, a.s, pack);
  absorb(a, applySettlement(a.s, facts, settlement, ctx));

  // friends
  const friendId = meta?.friendId ?? facts.characterId;
  if (pack.friends.some((f) => f.id === friendId)) absorb(a, applyTalk(a.s, friendId, facts, talkKind(meta), ctx));
  fileFlags(a, facts.flags, friendId, pack);

  // inventory and story: what the scenario hands over on its first completion, tickets, homes visited
  if (firstComplete) applyBeatEffects(a, meta?.effects, ctx);
  if (!facts.abandoned && a.s.tickets.ramen && facts.scenarioId === 'ramen' && facts.startNode) {
    const { ramen: _used, ...rest } = a.s.tickets;
    void _used;
    a.s = { ...a.s, tickets: rest };
  }
  if (meta?.kind === 'home' && !facts.abandoned && facts.goalDone > 0 && friendId) {
    const key = `home:${friendId}`;
    if (!a.s.stats.visits.includes(key)) a.s = { ...a.s, stats: { ...a.s.stats, visits: [...a.s.stats.visits, key] } };
    a.probes.push({ on: 'visit', keys: [key] });
  }

  // mastery: culture phrases said in the conversation, the coach's window
  const said = saidCards(a, facts, pack);
  if (said.length) a.s = { ...a.s, stats: { ...a.s.stats, cultureSaid: [...a.s.stats.cultureSaid, ...said] } };
  const stats = settlement.stats;
  a.s = {
    ...a.s,
    coach: {
      ...a.s.coach,
      recent: [...a.s.coach.recent, { day: a.s.clock.dayIndex, scenarioId: facts.scenarioId, r: stats.r, fallbacks: facts.fallbacks }].slice(-BALANCE.coach.recent),
      sinceChange: a.s.coach.sinceChange + 1,
    },
  };

  // srs bridge
  const ops = useReviews(facts);
  if (ops.length) a.effects.push({ t: 'srsOps', ops });

  // culture probes
  if (!facts.abandoned) {
    if (meta?.kind === 'shop') a.probes.push({ on: 'shop_start' });
    a.probes.push({ on: 'talk_start', keys: [facts.characterId] });
    if (complete) a.probes.push({ on: 'scenario_done', keys: [facts.scenarioId] });
    if (facts.goalDone > 0) a.probes.push({ on: 'served', keys: [facts.scenarioId] });
  }
  const intents = facts.turns.filter((t) => t.substantive && t.intentId).map((t) => `${facts.scenarioId}:${t.intentId}`);
  if (intents.length) a.probes.push({ on: 'intent', keys: intents });

  a.active = !facts.abandoned;
}

// ---------------------------------------------------------------------------------------------------------------
// The culture stage
// ---------------------------------------------------------------------------------------------------------------

function triggerHits(t: CultureTrigger, p: Probe, chapter: number): boolean {
  if (t.on !== p.on) return false;
  if (t.ch !== undefined && chapter < t.ch) return false;
  if (t.ids && t.ids.length > 0 && !(p.keys ?? []).some((k) => t.ids?.includes(k))) return false;
  if (t.n !== undefined && (p.count ?? 0) < t.n) return false;
  return true;
}

/** Purchases made at a shop or of an item, read from the ledger ring (a card asks for the 3rd, so its 200 entries are plenty). */
function purchasesOf(s: GameState, pack: GamePack, id: string): number {
  return s.ledger.filter((e) => {
    if (e.kind !== 'purchase' || e.pocket === 'points' || e.delta >= 0 || !e.ref) return false;
    if (e.ref === id) return true;
    const item = pack.items.find((i) => i.id === e.ref);
    const menu = pack.menu.find((m) => m.id === e.ref);
    return (item?.shop ?? menu?.shop) === id;
  }).length;
}

/** What `n` of a trigger is counted against: the purchases at (or of) its first id, every purchase when it names none, the perfect shifts so far. */
function countFor(s: GameState, pack: GamePack, t: CultureTrigger, p: Probe): number | undefined {
  if (p.on === 'perfect_shift') return Object.values(s.jobs).reduce((n, j) => n + j.perfect, 0);
  if (p.on !== 'purchase') return p.count;
  return t.ids && t.ids.length > 0 ? Math.max(...t.ids.map((id) => purchasesOf(s, pack, id))) : s.stats.purchases;
}

function fireCulture(a: Acc, ctx: ReduceCtx): void {
  if (a.probes.length === 0) return;
  const { pack } = ctx;
  for (const card of pack.culture) {
    if (a.s.culture[card.id] !== undefined) continue;
    const triggers = [card.trigger, ...(card.also ?? [])];
    const hit = a.probes.some((p) => triggers.some((t) => triggerHits(t, { ...p, count: countFor(a.s, pack, t, p) }, a.s.chapter.n)));
    if (hit) unlockCulture(a, pack, card.id, ctx);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Small events
// ---------------------------------------------------------------------------------------------------------------

const clampText = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function onPrepare(a: Acc, ev: Extract<InputEvent, { t: 'prepare_done' }>, ctx: ReduceCtx): void {
  const { pack } = ctx;
  const day = a.s.clock.dayIndex;
  const meta = metaOf(pack, ev.scenarioId);
  const known = (id: string): boolean => pack.pockets[id] !== undefined || (meta?.pocket?.includes(id) ?? false);
  const prep = { ...a.s.prep };
  const ops: SrsOp[] = [];
  const fresh = (id: string): boolean => {
    const cur = prep[id];
    return !cur || (cur.s === 'ready' && day - cur.at >= BALANCE.readyDays);
  };
  for (const id of ev.seen ?? []) {
    if (!known(id)) continue;
    if (prep[id] === undefined) {
      const line = pack.pockets[id]?.line;
      if (line) ops.push({ op: 'add', key: id, kind: 'phrase', line, source: 'goal', dueInMin: BALANCE.srs.goalDueMin });
    }
    // a fresh ready stamp is never downgraded by studying the line again
    if (fresh(id)) prep[id] = { s: 'seen', at: day };
  }
  for (const id of ev.ready) {
    if (!known(id)) continue;
    if (prep[id] === undefined) {
      const line = pack.pockets[id]?.line;
      if (line) ops.push({ op: 'add', key: id, kind: 'phrase', line, source: 'goal', dueInMin: BALANCE.srs.goalDueMin });
    }
    prep[id] = { s: 'ready', at: day };
  }
  a.s = { ...a.s, prep };
  if (ops.length) a.effects.push({ t: 'srsOps', ops });
  a.active = true;
}

function onCultureSay(a: Acc, ev: Extract<InputEvent, { t: 'culture_say' }>, ctx: ReduceCtx): void {
  const card = ctx.pack.culture.find((c) => c.id === ev.id && c.say);
  if (!card || a.s.culture[card.id] === undefined) {
    a.effective = false;
    return;
  }
  if (!(ev.similarity >= echoPassMark(ctx.pack, ctx.view))) return;
  a.s = { ...a.s, stats: { ...a.s.stats, cultureSaid: addUnique(a.s.stats.cultureSaid, card.id) } };
  a.effects.push({ t: 'srsOps', ops: [{ op: 'add', key: card.id, kind: 'phrase', line: card.phrase, source: 'goal', dueInMin: BALANCE.srs.goalDueMin }] });
  a.active = true;
}

function onBeat(a: Acc, id: string, ctx: ReduceCtx): void {
  if (a.s.beats.includes(id)) {
    a.effective = false;
    return;
  }
  a.s = { ...a.s, beats: [...a.s.beats, id] };
  applyBeatEffects(a, ctx.pack.beats[id]?.effects, ctx);
}

function onDream(a: Acc, id: string | null, ctx: ReduceCtx): void {
  if (id === null) {
    a.s = { ...a.s, dream: { ...a.s.dream, id: null, done: false } };
    return;
  }
  const def = availableDreams(ctx.pack, a.s, ctx.view).find((d) => d.id === id);
  if (!def) {
    a.effective = false;
    return;
  }
  // progress is derived from state, so switching loses nothing: a dream whose steps were all seen before is already finished
  const done = def.steps.length > 0 && def.steps.every((st) => a.s.dream.steps[st.id] !== undefined);
  a.s = { ...a.s, dream: { ...a.s.dream, id, done } };
}

function onCoach(a: Acc, ev: Extract<InputEvent, { t: 'coach_choice' }>, ctx: ReduceCtx): void {
  let { realFor } = a.s.coach;
  let { audio } = a.s;
  if (ev.card === 'real' && ev.scenarioId && metaOf(ctx.pack, ev.scenarioId)?.real !== false) realFor = addUnique(realFor, ev.scenarioId);
  if (ev.card === 'help') audio = { ...audio, ttsRateScale: BALANCE.adaptive.helpTtsRate };
  a.s = { ...a.s, audio, coach: { ...a.s.coach, realFor, sinceChange: 0 } };
}

function onProfile(a: Acc, ev: Extract<InputEvent, { t: 'profile_set' }>): void {
  let s = a.s;
  if (typeof ev.nameKana === 'string') s = { ...s, me: { ...s.me, nameKana: clampText(ev.nameKana, 24) } };
  if (ev.activeTitle !== undefined && (ev.activeTitle === null || s.titles.includes(ev.activeTitle))) s = { ...s, activeTitle: ev.activeTitle };
  if (ev.audio) {
    const p = ev.audio;
    const audio = { ...s.audio };
    if (p.sttConsent === 'unset' || p.sttConsent === 'allowed' || p.sttConsent === 'declined') audio.sttConsent = p.sttConsent;
    if (p.micPref === 'auto' || p.micPref === 'off') audio.micPref = p.micPref;
    if (p.listenPref === 'on' || p.listenPref === 'off') audio.listenPref = p.listenPref;
    if (typeof p.ttsRateScale === 'number' && p.ttsRateScale >= 0.5 && p.ttsRateScale <= 1.5) audio.ttsRateScale = p.ttsRateScale;
    if (typeof p.lastMode === 'string') audio.lastMode = p.lastMode.slice(0, 32);
    if (typeof p.lastCheckedAt === 'number' && Number.isFinite(p.lastCheckedAt)) audio.lastCheckedAt = p.lastCheckedAt;
    s = { ...s, audio };
  }
  const flags = { ...s.flags };
  if (typeof ev.dev === 'boolean') flags.dev = ev.dev;
  if (typeof ev.welcomeSeenDay === 'number' && Number.isInteger(ev.welcomeSeenDay)) flags.welcomeSeenDay = ev.welcomeSeenDay;
  a.s = { ...s, flags };
}

function onDev(a: Acc, ev: Extract<InputEvent, { t: 'dev' }>, ctx: ReduceCtx): void {
  const { pack, now } = ctx;
  if (!a.s.flags.dev) {
    a.effective = false;
    return;
  }
  const def = chapterDef(pack, a.s.chapter.n);
  const day = dayKey(a.s.clock.dayIndex);
  switch (ev.cmd) {
    case 'cash': {
      const amount = Math.trunc(ev.amount ?? 10_000);
      const r = applyLedger(a.s, { id: `${LEDGER_IDS.perk('dev')}:${now}:${a.s.wallet.cash}`, at: now, kind: 'perk', delta: amount, pocket: 'cash', ref: 'dev' }, walletLimits(a.s, pack));
      if (r.applied) a.derived.push({ t: 'wallet_changed', delta: r.state.wallet.cash - a.s.wallet.cash, balance: r.state.wallet.cash, kind: 'perk' });
      a.s = r.state;
      break;
    }
    case 'complete_objective': {
      const o = def?.objectives.find((x) => !x.dream && a.s.chapter.done[x.id] === undefined);
      if (o) a.s = { ...a.s, chapter: { ...a.s.chapter, done: { ...a.s.chapter.done, [o.id]: day } } };
      break;
    }
    case 'advance_chapter': {
      if (!def) break;
      const done = { ...a.s.chapter.done };
      for (const o of def.objectives) if (!o.dream && done[o.id] === undefined) done[o.id] = day;
      // the days the chapter still needs pass (each an active day, so `activeDays <= dayIndex + 1` holds), which also meets the
      // one-completion-per-day rule: the evaluation below completes the chapter
      const wait = Math.max(0, def.minDays - a.s.clock.activeDays);
      const dayIndex = a.s.clock.dayIndex + Math.max(1, wait);
      a.s = {
        ...a.s,
        clock: { ...a.s.clock, dayIndex, activeDays: a.s.clock.activeDays + Math.max(1, wait), lastActiveDay: dayIndex },
        pay: payForDay(a.s.pay, dayKey(dayIndex)),
        chapter: { ...a.s.chapter, done },
      };
      rollover(a, ctx);
      break;
    }
    case 'advance_day': {
      const dayIndex = a.s.clock.dayIndex + 1;
      a.s = { ...a.s, clock: { ...a.s.clock, dayIndex }, pay: payForDay(a.s.pay, dayKey(dayIndex)) };
      rollover(a, ctx);
      break;
    }
  }
}

/** Run once per accepted day rollover: queues the phone threads (daily goals roll in their own stage). */
function rollover(a: Acc, ctx: ReduceCtx): void {
  a.s = queueThreads(ctx.pack, a.s, ctx.view, ctx.rng);
}

function onFare(a: Acc, ev: Extract<InputEvent, { t: 'fare' }>, ctx: ReduceCtx): void {
  const { pack } = ctx;
  const unit = fareFor(pack, a.s, ev.place, ev.method);
  if (pack.fares[ev.place] === undefined || !(unit > 0)) {
    a.effective = false;
    return;
  }
  const total = unit * (ev.legs === 2 ? BALANCE.fares.tripLegs : 1);
  const pocket = ev.method === 'ic' ? 'ic' : 'cash';
  const r = applyLedger(a.s, { id: LEDGER_IDS.fare(ev.id), at: ctx.now, kind: 'fare', delta: -total, pocket, ref: ev.place }, walletLimits(a.s, pack));
  if (!r.applied) {
    a.effective = false;
    return;
  }
  a.s = r.state;
  a.derived.push({ t: 'wallet_changed', delta: -total, balance: r.state.wallet[pocket], kind: 'fare' });
  a.probes.push({ on: 'ride' });
}

function onPurchase(a: Acc, ev: Extract<InputEvent, { t: 'purchase' }>, ctx: ReduceCtx): void {
  const { pack } = ctx;
  const before = a.s;
  const r = commitPurchase(a.s, ev, ctx);
  if (!r.ok) {
    a.effective = false;
    return;
  }
  absorb(a, r);
  const shop = pack.shops.find((s) => s.id === ev.shopId);
  if (pack.items.some((i) => i.id === ev.itemId)) a.catalogSpent += a.s.totals.spent - before.totals.spent;

  // an owned item switches a feature on: Messages and Map pins for the phone, tap-to-pay for the IC card
  for (const feature of ['phone', 'ic'] as const) {
    if (!hasFeature(pack, before, feature) && hasFeature(pack, a.s, feature)) {
      a.derived.push({ t: 'unlocked', what: 'feature', id: feature });
      // the first threads arrive the day the phone does
      if (feature === 'phone') a.s = queueThreads(pack, a.s, ctx.view, ctx.rng);
    }
  }
  // the first use of each vending drink is worth a little XP (§6.5)
  if (shop?.surface === 'panel' && ev.shopId === 'vending') {
    const d = dedupe(a.s, `vend:${ev.itemId}`);
    if (d.fresh) {
      a.s = d.state;
      a.effects.push({ t: 'xp', amount: BALANCE.vendingXp, why: 'vending' });
    }
    a.probes.push({ on: 'machine', keys: ['vending'] });
  }
  a.probes.push({ on: 'payment', keys: [ev.shopId] }, { on: 'purchase', keys: [ev.shopId, ev.itemId] });
  a.active = true;
}

function onTicket(a: Acc, ev: Extract<InputEvent, { t: 'ticket_bought' }>): void {
  // one ticket at a time: a second press with the first still unused is the same ticket
  if (ev.kind === 'ramen') {
    if (a.s.tickets.ramen) {
      a.effective = false;
      return;
    }
    a.s = { ...a.s, tickets: { ...a.s.tickets, ramen: { flavor: String(ev.flavor) } } };
    a.probes.push({ on: 'machine', keys: ['ramen_machine'] });
  } else {
    if (a.s.tickets.station) {
      a.effective = false;
      return;
    }
    a.s = { ...a.s, tickets: { ...a.s.tickets, station: { place: String(ev.place) } } };
    a.probes.push({ on: 'machine', keys: ['ticket'] });
  }
  a.s = { ...a.s, stats: { ...a.s.stats, tickets: a.s.stats.tickets + 1 } };
}

/** A distinct set that stops growing at `max` (a place or spot list is bounded by the world, not by whatever a caller sends). */
const distinct = (list: string[], v: string, max = 500): string[] => (list.includes(v) || list.length >= max ? list : [...list, v]);

/** Everything that is one event, switched by `ev.t`. */
function apply(a: Acc, ev: InputEvent, ctx: ReduceCtx): void {
  const { pack } = ctx;
  switch (ev.t) {
    case 'conversation_done':
      onConversation(a, ev.facts, ctx);
      break;
    case 'phone_chat_done': {
      const d = dedupe(a.s, `chat:${ev.sessionId}`);
      if (!d.fresh) {
        a.effective = false;
        break;
      }
      a.s = d.state;
      const r = applyTalk(a.s, ev.friendId, ev.facts, 'chat', ctx);
      absorb(a, r);
      fileFlags(a, ev.facts.flags, ev.friendId, pack);
      a.active = r.ap > 0;
      break;
    }
    case 'purchase':
      onPurchase(a, ev, ctx);
      break;
    case 'topup': {
      const r = topUp(a.s, pack, ev.id, ev.amount, ctx.now);
      if (!r.applied) {
        a.effective = false;
        break;
      }
      a.derived.push({ t: 'wallet_changed', delta: r.state.wallet.cash - a.s.wallet.cash, balance: r.state.wallet.cash, kind: 'topup' });
      a.s = r.state;
      break;
    }
    case 'refund': {
      const r = refundIc(a.s, pack, ev.id, ctx.now);
      if (!r.applied) {
        a.effective = false;
        break;
      }
      a.derived.push({ t: 'wallet_changed', delta: r.state.wallet.cash - a.s.wallet.cash, balance: r.state.wallet.cash, kind: 'refund' });
      a.s = r.state;
      break;
    }
    case 'fare':
      onFare(a, ev, ctx);
      break;
    case 'gift_given': {
      const id = LEDGER_IDS.gift(ev.sessionId);
      const d = dedupe(a.s, id);
      const r = d.fresh ? applyGift(a.s, ev, ctx) : null;
      if (!r || r.state === a.s) {
        a.effective = false;
        break;
      }
      absorb(a, r);
      a.s = dedupe(a.s, id).state;
      a.probes.push({ on: 'gift_given' });
      a.active = true;
      break;
    }
    case 'shift_done': {
      const r = applyShift(a.s, ev.jobId, ev.result, ctx);
      if (r.state === a.s) {
        a.effective = false;
        break;
      }
      absorb(a, r);
      a.probes.push({ on: 'perfect_shift' });
      a.active = true;
      break;
    }
    case 'lesson_done': {
      // a lesson counts once per day: replaying the event cannot farm `g_lesson`
      const d = dedupe(a.s, `lesson:${ev.id}:${dayKey(a.s.clock.dayIndex)}`);
      if (!d.fresh) {
        a.effective = false;
        break;
      }
      a.s = d.state;
      a.active = true;
      break;
    }
    case 'word_saved':
      // `words_saved` reads the vocabulary in the v1 store: nothing to file, the objectives re-evaluate below
      break;
    case 'sign_found':
      a.effects.push({ t: 'srsOps', ops: [{ op: 'add', key: ev.id, kind: 'word', source: 'sign', dueInMin: BALANCE.srs.signDueMin }] });
      break;
    case 'culture_seen':
      unlockCulture(a, pack, ev.id, ctx);
      break;
    case 'srs_review': {
      const n = ev.keys.filter((k) => typeof k === 'string').length;
      if (n === 0) {
        a.effective = false;
        break;
      }
      a.s = { ...a.s, stats: { ...a.s.stats, srsReviews: a.s.stats.srsReviews + n } };
      a.active = true;
      break;
    }
    case 'prepare_done':
      onPrepare(a, ev, ctx);
      break;
    case 'echo': {
      const r = applyEcho(a.s, ev, ctx);
      absorb(a, r);
      a.active = r.derived.some((d) => d.t === 'wallet_changed');
      break;
    }
    case 'culture_say':
      onCultureSay(a, ev, ctx);
      break;
    case 'beat_done':
      onBeat(a, ev.id, ctx);
      break;
    case 'letter_saved': {
      const letter = ev.sentences
        .filter((x) => x && typeof x.ja === 'string' && x.ja.trim())
        .slice(0, 12)
        .map((x) => ({ ja: x.ja.trim().slice(0, 300), assisted: x.assisted === true }));
      a.s = { ...a.s, letter };
      setFlag(a, 'letter_written');
      break;
    }
    case 'easier_accept': {
      const next = acceptEasier(a.s, pack, ev.objective);
      if (next === a.s) a.effective = false;
      a.s = next;
      break;
    }
    case 'coach_choice':
      onCoach(a, ev, ctx);
      break;
    case 'visit': {
      if (typeof ev.place !== 'string' || !ev.place) break;
      a.s = { ...a.s, stats: { ...a.s.stats, visits: distinct(a.s.stats.visits, ev.place.slice(0, 64)) } };
      a.probes.push({ on: 'visit', keys: [ev.place] });
      if (ev.place === 'festival') a.probes.push({ on: 'festival' });
      break;
    }
    case 'spot':
      if (typeof ev.id === 'string' && ev.id) a.s = { ...a.s, stats: { ...a.s.stats, spots: distinct(a.s.stats.spots, ev.id.slice(0, 64), 100) } };
      break;
    case 'ticket_bought':
      onTicket(a, ev);
      break;
    case 'trip_done': {
      const key = `trip:${ev.id}`;
      // the paper ticket of the trip is used up
      const { station: _used, ...tickets } = a.s.tickets;
      void _used;
      a.s = { ...a.s, tickets, stats: { ...a.s.stats, visits: distinct(a.s.stats.visits, key) } };
      a.probes.push({ on: 'visit', keys: [key, ev.id] }, { on: 'ride' });
      a.active = true;
      break;
    }
    case 'item_placed': {
      const r = placeItem(a.s, pack, ev.slot, ev.itemId);
      if (!r.ok) a.effective = false;
      a.s = r.state;
      break;
    }
    case 'outfit_changed':
      a.s = applyOutfit(a.s, pack, ev.equipped, ev.colours);
      break;
    case 'flag':
      if (ev.friendId !== undefined && !pack.friends.some((f) => f.id === ev.friendId)) {
        a.effective = false;
        break;
      }
      setFlag(a, ev.id, ev.friendId);
      break;
    case 'dream_chosen':
      onDream(a, ev.id, ctx);
      break;
    case 'day_observed':
      break;
    case 'audio_mode':
      if (typeof ev.mode === 'string' && ev.mode) a.s = { ...a.s, audio: { ...a.s.audio, lastMode: ev.mode.slice(0, 32) } };
      break;
    case 'profile_set':
      onProfile(a, ev);
      break;
    case 'diary_added': {
      const e = ev.entry;
      const ja = clampText(e?.ja, 400);
      if (!ja || !Number.isInteger(e.chapter) || e.chapter < 1 || e.chapter > BALANCE.freeWalkChapter || a.s.diary.some((d) => d.chapter === e.chapter && d.ja === ja)) {
        a.effective = false;
        break;
      }
      a.s = { ...a.s, diary: [...a.s.diary, { chapter: e.chapter, ja, assisted: e.assisted === true }].slice(-40) };
      break;
    }
    case 'daily_swap': {
      const next = swapDaily(pack, a.s, ctx.view, ev.goalId);
      if (next === a.s) a.effective = false;
      a.s = next;
      break;
    }
    case 'heart_event_done': {
      const r = applyHeartEvent(a.s, ev.friendId, ev.level, ctx);
      if (r.state === a.s) a.effective = false;
      absorb(a, r);
      break;
    }
    case 'dev':
      onDev(a, ev, ctx);
      break;
    default: {
      // a future event type: unknown to this build, so nothing to do
      const never: never = ev;
      void never;
      a.effective = false;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------------------------------------------

/** Removes the effects that repeat (the same beat from the chapter stage and the shell's focus event, say), keeping the first. */
function uniqueEffects(effects: UiEffect[]): UiEffect[] {
  const seen = new Set<string>();
  return effects.filter((e) => {
    const key = JSON.stringify(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** On the shell's `day_observed` (mount, focus): the open beat of the current chapter and the close beat of the last finished one, until they have played. */
function pendingBeats(s: GameState, pack: GamePack): UiEffect[] {
  const out: UiEffect[] = [];
  const lastDone = chapterDef(pack, Math.max(0, ...s.chapter.completed));
  if (lastDone && !s.beats.includes(lastDone.beats.close)) out.push({ t: 'beat', id: lastDone.beats.close });
  const cur = chapterDef(pack, s.chapter.n);
  if (cur && !s.beats.includes(cur.beats.open)) out.push({ t: 'beat', id: cur.beats.open });
  return out;
}

/** Deterministic given (state, event, ctx). Never mutates `state`. */
export function reduce(state: GameState, ev: InputEvent, ctx: ReduceCtx): ReduceResult {
  // integrity: the clock first, on the event's own time (`day_observed` carries the shell's)
  const nowMs = ev.t === 'day_observed' ? ev.nowMs : ctx.now;
  const c: ReduceCtx = nowMs === ctx.now ? ctx : { ...ctx, now: nowMs };
  const clock = observeClock(state, nowMs);
  const a: Acc = { s: clock.state, derived: [], effects: [], probes: [], effective: true, active: false, catalogSpent: 0 };
  const netBefore = a.s.totals.earned - a.s.totals.spent;
  if (clock.rolled) rollover(a, c);

  // economy -> friends -> inventory -> mastery -> srs bridge
  apply(a, ev, c);
  if (a.active && a.effective) a.s = markActive(a.s);
  fireCulture(a, c);

  // objectives, chapters, dreams (queue-processed inside, depth <= 4)
  absorb(a, evaluateAll(a.s, c, a.derived));

  // daily: a duplicate or refused event bumps no counter
  const dailyEv: InputEvent = a.effective ? ev : { t: 'day_observed', nowMs };
  const daily = updateDaily(a.s, dailyEv, a.derived, c);
  const paidToday = daily.derived.some((d) => d.t === 'wallet_changed');
  absorb(a, daily);
  // a goal's yen can complete a wallet objective: judge once more (idempotent when nothing changed)
  if (paidToday) absorb(a, evaluateAll(a.s, c));

  // effects
  if (ev.t === 'day_observed') a.effects.push(...pendingBeats(a.s, c.pack));
  const net = a.s.totals.earned - a.s.totals.spent - netBefore + a.catalogSpent;
  if (net !== 0) a.s = bookIncome(a.s, net);
  return { state: a.s, derived: a.derived, effects: uniqueEffects(a.effects) };
}

/** Cash net (earned - spent, catalog purchases aside) of today, for the dream tracker's pace estimate; the last BALANCE.dream.etaWindowDays days are kept. */
function bookIncome(s: GameState, net: number): GameState {
  const day = s.clock.dayIndex;
  const income = [...s.income];
  const last = income[income.length - 1];
  if (last && last.day === day) income[income.length - 1] = { day, net: last.net + net };
  else income.push({ day, net });
  return { ...s, income: income.slice(-BALANCE.dream.etaWindowDays) };
}
