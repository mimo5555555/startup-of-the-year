// The objective engine: predicates over saved state, chapters, prerequisites, next best goal (agent 1D).
// Objectives are re-derived from state after every event (§7.1): `done` records the first day an objective held and never
// reverts, so a later wallet drop or a replay cannot un-tick it, and a second evaluation changes nothing.
import { BALANCE } from './balance';
import { heartsForAp } from './friends';
import { applyLedger, dayKey, LEDGER_IDS } from './ledger';
import { walletLimits } from './money';
import { dreamProgress, effectiveDream, evaluateDream } from './dreams';
import type {
  ChapterDef,
  ChapterStatus,
  DerivedEvent,
  Gloss,
  GamePack,
  GameState,
  GameView,
  Interaction,
  ItemDef,
  NextGoal,
  Objective,
  Pred,
  PredProgress,
  ReduceCtx,
  ReduceResult,
  Requirement,
  UiEffect,
  ValidationIssue,
} from './types';

type Ctx = Pick<ReduceCtx, 'pack' | 'view'>;

/** Derived events and UI effects collected by the stages of one `evaluateAll`. */
export interface EvalOut {
  derived: DerivedEvent[];
  effects: UiEffect[];
}

/** The catch-up stipend's flag, ledger id and beat (`b_phone_fund`, §4.5); the one catch-up of the story is the phone's. */
const CATCHUP = 'phone_fund';
/** Passes of the fixpoint loop: the derived events of one pass (a chapter reward, a new chapter) feed the next (§14.5: depth <= 4). */
const MAX_PASSES = 4;

// ---------------------------------------------------------------------------------------------------------------
// Predicate progress
// ---------------------------------------------------------------------------------------------------------------

/** A capped progress: `done` never exceeds `total`, so `done === total` is exactly "satisfied". */
const prog = (done: number, total: number): PredProgress => {
  const t = Math.max(0, Math.trunc(total));
  return { done: Math.max(0, Math.min(Math.trunc(done), t)), total: t };
};
const flag = (b: boolean): PredProgress => prog(b ? 1 : 0, 1);
const sum = (parts: PredProgress[]): PredProgress => prog(parts.reduce((a, p) => a + p.done, 0), parts.reduce((a, p) => a + p.total, 0));
const complete = (p: PredProgress): boolean => p.done >= p.total;

const ownedQty = (state: GameState, id: string): number => state.owned[id]?.qty ?? 0;

/** An owned item carries the category tag (phone, bicycle, car, flat, yukata). */
function ownsTag(pack: GamePack, state: GameState, category: string): boolean {
  return pack.items.some((it) => it.tags.includes(category) && ownedQty(state, it.id) > 0);
}

/** `home:*`, `trip:*` and `spot:*` match any entry of their family; `spot:` reads `stats.spots`, everything else `stats.visits`. */
function visited(state: GameState, place: string): boolean {
  if (place.startsWith('spot:')) {
    const id = place.slice(5);
    return id === '*' ? state.stats.spots.length > 0 : state.stats.spots.includes(id);
  }
  if (place.endsWith(':*')) {
    const prefix = place.slice(0, -1);
    return state.stats.visits.some((v) => v.startsWith(prefix));
  }
  return state.stats.visits.includes(place);
}

/** Friends of the pack with at least `atLeast` hearts (state entries for ids the pack does not know are ignored). */
function friendsAtHearts(pack: GamePack, state: GameState, atLeast: number): number {
  const known = new Set(pack.friends.map((f) => f.id));
  return Object.entries(state.friends).filter(([id, f]) => (known.size === 0 || known.has(id)) && heartsForAp(f.ap) >= atLeast).length;
}

/** How far a predicate is ("2/4 lines"); `done === total` iff `evalPred` is true. */
export function predProgress(pred: Pred, state: GameState, ctx: Pick<ReduceCtx, 'pack' | 'view'>): PredProgress {
  const { pack, view } = ctx;
  switch (pred.k) {
    case 'lesson':
      return flag(view.lessonsDone.includes(pred.id));
    case 'scenario': {
      const run = state.runs[pred.id];
      const parts: PredProgress[] = [];
      if (pred.complete) parts.push(flag(!!run?.complete));
      if (pred.steps?.length) parts.push(prog(pred.steps.filter((s) => run?.steps?.includes(s)).length, pred.steps.length));
      if (pred.minIndependent) parts.push(prog(run?.bestIndependent ?? 0, pred.minIndependent));
      if (pred.minShare) parts.push(prog(Math.floor((run?.bestShare ?? 0) * 100), Math.round(pred.minShare * 100)));
      if (pred.minStars) parts.push(prog(run?.stars ?? 0, pred.minStars));
      // no constraint: the scenario has been played at least once
      if (parts.length === 0) parts.push(flag((run?.count ?? 0) > 0));
      return sum(parts);
    }
    case 'stars':
      return prog(Object.values(state.runs).filter((r) => r.stars >= pred.atLeast).length, pred.n);
    case 'own': {
      const parts: boolean[] = [];
      if (pred.item) parts.push(ownedQty(state, pred.item) > 0);
      if (pred.category) parts.push(ownsTag(pack, state, pred.category));
      if (parts.length === 0) parts.push(false);
      return prog(parts.filter(Boolean).length, parts.length);
    }
    case 'purchases':
      return prog(state.stats.purchases, pred.n);
    case 'hearts':
      return prog(heartsForAp(state.friends[pred.friend]?.ap ?? 0), pred.atLeast);
    case 'hearts_count':
      return prog(friendsAtHearts(pack, state, pred.atLeast), pred.n);
    case 'gift': {
      const g = pred.friend ? state.friends[pred.friend] : undefined;
      const have = pred.friend
        ? pred.reaction === 'loved'
          ? g?.giftsLoved
          : pred.reaction === 'liked'
            ? g?.giftsLiked
            : g?.gifts
        : pred.reaction === 'loved'
          ? state.stats.gifts.loved
          : pred.reaction === 'liked'
            ? state.stats.gifts.liked
            : state.stats.gifts.n;
      return prog(have ?? 0, pred.n);
    }
    case 'phone_chat': {
      const parts = [prog(state.stats.chats.n, pred.n)];
      if (pred.friends) parts.push(prog(Object.values(state.stats.chats.friends).filter((v) => v > 0).length, pred.friends));
      return sum(parts);
    }
    case 'hangout': {
      const need = pred.n ?? 1;
      const have = pred.friend ? (state.stats.hangouts[pred.friend] ?? 0) : Object.values(state.stats.hangouts).reduce((a, b) => a + b, 0);
      return prog(have, need);
    }
    case 'visit':
      return flag(visited(state, pred.place));
    case 'shift': {
      // only the default accuracy is stored per job (`JobState.good`), so a stricter `minAcc` cannot be told apart and is not checked
      const have = pred.job ? (state.jobs[pred.job]?.good ?? 0) : Object.values(state.jobs).reduce((a, j) => a + j.good, 0);
      return prog(have, pred.n);
    }
    case 'earn_total':
      return prog(state.totals.earned, pred.yen);
    case 'wallet':
      // cash only: the IC card and points never count toward a savings goal (§4.1)
      return prog(state.wallet.cash, pred.atLeast);
    case 'words_saved':
      return prog(view.vocab.total, pred.n);
    case 'words_known': {
      if (!pred.tag) return prog(view.vocab.reviewedKeys.size, pred.n);
      const surfaces = new Set(pack.wordTags[pred.tag] ?? []);
      let have = 0;
      for (const s of surfaces) if (view.vocab.reviewedSurfaces.has(s)) have++;
      return prog(have, pred.n);
    }
    case 'say_new':
      // `stats.sayNew` is the counter and `words.said` the lifetime set; either one proves a new word, so take the larger
      return prog(Math.max(state.stats.sayNew, state.words.said.length), pred.n);
    case 'discover':
      return prog(view.discovered.length, pred.n);
    case 'culture':
      return pred.id ? flag(state.culture[pred.id] !== undefined) : prog(Object.keys(state.culture).length, pred.n);
    case 'culture_said':
      return prog(new Set(state.stats.cultureSaid).size, pred.n);
    case 'said':
      return flag(state.pay.seenIntents.includes(`${pred.scenario}:${pred.intent}`));
    case 'srs_reviews':
      return prog(state.stats.srsReviews, pred.n);
    case 'item_placed':
      return prog(Object.values(state.home.placed).filter(Boolean).length, pred.n);
    case 'flag':
      return flag(state.chapter.flags.includes(pred.id));
    case 'all':
      return sum(pred.of.map((p) => predProgress(p, state, ctx)));
    case 'any': {
      if (pred.of.length === 0) return prog(0, 1);
      const parts = pred.of.map((p) => predProgress(p, state, ctx));
      // a stable scale (the widest alternative) with the closest alternative's share of it, so the bar never jumps back when the
      // closest alternative changes; only a finished alternative reaches the full scale
      const scale = Math.max(1, ...parts.map((p) => p.total));
      if (parts.some(complete)) return prog(scale, scale);
      return prog(Math.max(...parts.map((p) => Math.floor((p.done * scale) / p.total))), scale);
    }
    default: {
      const never: never = pred;
      void never;
      return prog(0, 1);
    }
  }
}

/** Evaluates one predicate from state (idempotent, retroactive, §7.1). `easier` alternatives are chosen by the caller (`objectivePred`). */
export function evalPred(pred: Pred, state: GameState, ctx: Pick<ReduceCtx, 'pack' | 'view'>): boolean {
  return complete(predProgress(pred, state, ctx));
}

// ---------------------------------------------------------------------------------------------------------------
// Chapters, objectives and the easier alternative
// ---------------------------------------------------------------------------------------------------------------

/** The definition of chapter `n`, or null at Free Walk (and for an unknown n). */
export function chapterDef(pack: GamePack, n: number): ChapterDef | null {
  return pack.chapters.find((c) => c.n === n) ?? null;
}

/** The chapter that follows `n`: the next one of the pack, or Free Walk after the last. */
function nextChapterN(pack: GamePack, n: number): number {
  const last = pack.chapters.reduce((m, c) => Math.max(m, c.n), 0);
  return n >= last ? BALANCE.freeWalkChapter : n + 1;
}

/** The predicate an objective is judged by: its `easier` alternative once accepted (D40). */
export function objectivePred(obj: Objective, state: GameState): Pred {
  return obj.easier && state.chapter.easier.includes(obj.id) ? obj.easier.pred : obj.pred;
}

/** An objective is done once recorded, or when its predicate holds right now (so the UI is right between two evaluations). */
function objectiveDone(obj: Objective, state: GameState, ctx: Ctx): boolean {
  return state.chapter.done[obj.id] !== undefined || evalPred(objectivePred(obj, state), state, ctx);
}

/** The non-dream objectives of a chapter: what completes it. */
const storyObjectives = (def: ChapterDef): Objective[] => def.objectives.filter((o) => !o.dream);

/** Unfinished non-dream objectives of chapters `from` .. `to` (inclusive), judged live. Feeds the dream tracker's language gate. */
export function objectivesLeft(pack: GamePack, state: GameState, view: GameView, from: number, to: number): number {
  let left = 0;
  for (const def of pack.chapters) {
    if (def.n < from || def.n > to) continue;
    left += storyObjectives(def).filter((o) => !objectiveDone(o, state, { pack, view })).length;
  }
  return left;
}

/** Whether the row offers *Make it easier*: the objective has an alternative, is unfinished, not yet eased, and `afterTries` attempts were made. */
export function easierOffered(pack: GamePack, state: GameState, objectiveId: string): boolean {
  const def = chapterDef(pack, state.chapter.n);
  const obj = def?.objectives.find((o) => o.id === objectiveId);
  if (!obj?.easier || obj.dream) return false;
  if (state.chapter.done[obj.id] !== undefined || state.chapter.easier.includes(obj.id)) return false;
  return (state.chapter.tries[obj.id] ?? 0) >= obj.easier.afterTries;
}

/** The `easier_accept` event: free, permanent and only when it is offered; anything else returns the state untouched. */
export function acceptEasier(state: GameState, pack: GamePack, objectiveId: string): GameState {
  if (!easierOffered(pack, state, objectiveId)) return state;
  return { ...state, chapter: { ...state.chapter, easier: [...state.chapter.easier, objectiveId] } };
}

/** A row of the Story tab / tracker: the current chapter's objective with its progress and easier state. */
export interface ObjectiveRow {
  id: string;
  text: Gloss;
  hint?: Gloss;
  pin?: { place?: string; friend?: string };
  done: boolean;
  progress: PredProgress;
  easier: 'none' | 'offered' | 'accepted';
}

/** The current chapter's non-dream objectives as UI rows (§7.5). Empty at Free Walk. */
export function objectiveRows(pack: GamePack, state: GameState, view: GameView): ObjectiveRow[] {
  const def = chapterDef(pack, state.chapter.n);
  if (!def) return [];
  return storyObjectives(def).map((o) => {
    const accepted = state.chapter.easier.includes(o.id);
    const row: ObjectiveRow = {
      id: o.id,
      text: o.text,
      done: objectiveDone(o, state, { pack, view }),
      progress: predProgress(objectivePred(o, state), state, { pack, view }),
      easier: accepted ? 'accepted' : easierOffered(pack, state, o.id) ? 'offered' : 'none',
    };
    if (o.hint) row.hint = o.hint;
    if (o.pin) row.pin = o.pin;
    return row;
  });
}

/** Done / total of the current chapter's non-dream objectives and the "Done! The next chapter opens after {n} more days" wait (§7.1). */
export function chapterStatus(pack: GamePack, state: GameState, view: GameView): ChapterStatus {
  const n = state.chapter.n;
  const def = chapterDef(pack, n);
  if (!def) return { n, done: 0, total: 0, waitDays: 0, gated: false };
  const objs = storyObjectives(def);
  const done = objs.filter((o) => objectiveDone(o, state, { pack, view })).length;
  // the chapter is complete (reward paid) but the next one's start gate is still shut (Chapter 6: someone must like you enough)
  const limbo = state.chapter.completed.includes(n);
  const next = chapterDef(pack, nextChapterN(pack, n));
  const gated = limbo && !!next?.startGate && !evalPred(next.startGate, state, { pack, view });
  let waitDays = 0;
  if (done === objs.length && !limbo) {
    const short = Math.max(0, def.minDays - state.clock.activeDays);
    // one completion per day: a chapter that began today cannot complete today
    const sameDay = n > 1 && state.chapter.began.dayIndex >= state.clock.dayIndex ? 1 : 0;
    waitDays = Math.max(short, sameDay);
  }
  return { n, done, total: objs.length, waitDays, gated };
}

// ---------------------------------------------------------------------------------------------------------------
// Open chapters and prerequisites (§4.5 D36, §7.1)
// ---------------------------------------------------------------------------------------------------------------

/** The first chapter whose `opens` lists a thing, 0 when none does. */
function firstOpen(pack: GamePack, kind: string, id: string): number {
  let best = 0;
  for (const c of pack.chapters) {
    if (c.opens.some((o) => o.kind === kind && o.id === id) && (best === 0 || c.n < best)) best = c.n;
  }
  return best;
}

const maxCh = (reqs: Requirement[]): number => reqs.reduce((m, r) => Math.max(m, r.ch), 0);

/**
 * The chapter at which a thing opens (chapter.n >= it; 9 = Free Walk). One source per kind: item = `ItemDef.gate.ch`, shop =
 * `ShopDef.openChapter` (the `ChapterDef.opens` shop entries must agree: a level-3 validation error), friend =
 * `FriendDef.unlockChapter`, scenario = the later of its shop and the requirements of `ScenarioMeta.gate`, place / job / feature /
 * interaction = the first chapter whose `opens` lists it. An id no source knows returns 0 (`validatePack` reports it); 1 = open from the start.
 */
export function openChapter(pack: GamePack, kind: Requirement['kind'], id: string): number {
  return openCh(pack, kind, id, new Set());
}

function openCh(pack: GamePack, kind: Requirement['kind'], id: string, seen: Set<string>): number {
  switch (kind) {
    case 'item': {
      const item = pack.items.find((i) => i.id === id);
      if (item) return item.gate.ch;
      // a menu id ('<shop>:<option>') opens with its shop
      const menu = pack.menu.find((m) => m.id === id);
      return menu ? openCh(pack, 'shop', menu.shop, seen) : 0;
    }
    case 'shop':
      return pack.shops.find((s) => s.id === id)?.openChapter ?? 0;
    case 'friend':
      return pack.friends.find((f) => f.id === id)?.unlockChapter ?? 0;
    case 'scenario': {
      const meta = pack.scenarioMeta.find((m) => m.id === id);
      if (!meta) return 0;
      const key = `scenario:${id}`;
      // a gate that (indirectly) names the scenario itself adds nothing
      if (seen.has(key)) return 1;
      seen.add(key);
      let ch = 1;
      if (meta.shop) ch = Math.max(ch, openCh(pack, 'shop', meta.shop.shopId, seen));
      if (meta.gate) ch = Math.max(ch, maxCh(reqs(meta.gate, pack, seen)));
      return ch;
    }
    default:
      return firstOpen(pack, kind, id);
  }
}

/** Whether a thing is open now: `state.chapter.n >= openChapter(...)` (D36). */
export function isOpen(pack: GamePack, state: GameState, kind: Requirement['kind'], id: string): boolean {
  return state.chapter.n >= openChapter(pack, kind, id);
}

const interactionsOf = (pack: GamePack): Interaction[] => Object.values(pack.interactions).flat();

/** The requirement list of an item: the item, its shop and the items it needs. */
function itemReqs(pack: GamePack, item: ItemDef, seen: Set<string>): Requirement[] {
  const out: Requirement[] = [
    { kind: 'item', id: item.id, ch: item.gate.ch },
    { kind: 'shop', id: item.shop, ch: openCh(pack, 'shop', item.shop, seen) },
  ];
  for (const need of item.gate.needs ?? []) {
    const dep = pack.items.find((i) => i.id === need);
    if (!dep) out.push({ kind: 'item', id: need, ch: 0 });
    else if (!seen.has(`item:${need}`)) {
      seen.add(`item:${need}`);
      out.push(...itemReqs(pack, dep, seen));
    }
  }
  return out;
}

/** The cheapest way in: of several items that would satisfy a category / feature, the one that opens earliest (then the cheaper). */
function earliestItem(pack: GamePack, pick: (i: ItemDef) => boolean, label: string, seen: Set<string>): Requirement[] {
  const options = pack.items.filter(pick).map((i) => ({ i, reqs: itemReqs(pack, i, new Set(seen)) }));
  if (options.length === 0) return [{ kind: 'item', id: label, ch: 0 }];
  options.sort((a, b) => maxCh(a.reqs) - maxCh(b.reqs) || a.i.price - b.i.price);
  return options[0].reqs;
}

/** The friend that opens `nth`-earliest (a phone chat or a hang-out needs one; chatting with k friends needs the k-th). */
function nthFriend(pack: GamePack, nth = 1): Requirement[] {
  const sorted = [...pack.friends].sort((a, b) => a.unlockChapter - b.unlockChapter);
  const f = sorted[Math.max(0, nth - 1)];
  return f ? [{ kind: 'friend', id: f.id, ch: f.unlockChapter }] : [{ kind: 'friend', id: '*', ch: 0 }];
}

function dedupe(list: Requirement[]): Requirement[] {
  const best = new Map<string, Requirement>();
  for (const r of list) {
    const k = `${r.kind}:${r.id}`;
    const have = best.get(k);
    if (!have || r.ch > have.ch) best.set(k, r);
  }
  return [...best.values()];
}

function scenarioReqs(pack: GamePack, id: string, seen: Set<string>): Requirement[] {
  const meta = pack.scenarioMeta.find((m) => m.id === id);
  const out: Requirement[] = [{ kind: 'scenario', id, ch: openCh(pack, 'scenario', id, seen) }];
  if (meta?.shop) out.push({ kind: 'shop', id: meta.shop.shopId, ch: openCh(pack, 'shop', meta.shop.shopId, seen) });
  return out;
}

function reqs(pred: Pred, pack: GamePack, seen: Set<string>): Requirement[] {
  switch (pred.k) {
    case 'scenario':
      return scenarioReqs(pack, pred.id, seen);
    case 'said':
      return scenarioReqs(pack, pred.scenario, seen);
    case 'own': {
      const out: Requirement[] = [];
      if (pred.item) {
        const item = pack.items.find((i) => i.id === pred.item);
        out.push(...(item ? itemReqs(pack, item, seen) : [{ kind: 'item' as const, id: pred.item, ch: 0 }]));
      }
      if (pred.category) {
        const cat = pred.category;
        out.push(...earliestItem(pack, (i) => i.tags.includes(cat), `category:${cat}`, seen));
      }
      return out;
    }
    case 'hearts':
      return [{ kind: 'friend', id: pred.friend, ch: openCh(pack, 'friend', pred.friend, seen) }];
    case 'hearts_count':
      // n friends at the level need n friends to exist: the n-th earliest unlock decides
      return nthFriend(pack, pred.n);
    case 'gift': {
      const out: Requirement[] = [{ kind: 'feature', id: 'gift', ch: firstOpen(pack, 'feature', 'gift') }];
      if (pred.friend) out.push({ kind: 'friend', id: pred.friend, ch: openCh(pack, 'friend', pred.friend, seen) });
      return out;
    }
    case 'phone_chat':
      return [...earliestItem(pack, (i) => i.fx.some((e) => e.t === 'feature' && e.id === 'phone'), 'feature:phone', seen), ...nthFriend(pack, pred.friends)];
    case 'hangout':
      return pred.friend ? [{ kind: 'friend', id: pred.friend, ch: openCh(pack, 'friend', pred.friend, seen) }] : nthFriend(pack);
    case 'visit': {
      const { place } = pred;
      // spots are scenery of an already-open place (the pond, the torii): nothing to open
      if (place.startsWith('spot:')) return [];
      if (place.startsWith('trip:')) {
        const rest = place.slice(5);
        const trips = interactionsOf(pack).filter((i) => i.kind === 'trip');
        const hit = trips.find((i) => i.id === place || i.id === rest || i.id.endsWith(rest) || i.scenarioId === rest) ?? trips[0];
        return hit ? [{ kind: 'interaction', id: hit.id, ch: firstOpen(pack, 'interaction', hit.id) }] : [{ kind: 'interaction', id: place, ch: 0 }];
      }
      if (place.startsWith('home:')) {
        const who = place.slice(5);
        const homes = pack.friends.filter((f) => f.home && (who === '*' || f.id === who));
        const f = [...homes].sort((a, b) => a.unlockChapter - b.unlockChapter)[0];
        const out: Requirement[] = f ? [{ kind: 'friend', id: f.id, ch: f.unlockChapter }] : [{ kind: 'friend', id: who, ch: 0 }];
        const visits = interactionsOf(pack).filter((i) => i.kind === 'visit');
        const v = visits.map((i) => ({ i, ch: firstOpen(pack, 'interaction', i.id) })).sort((a, b) => a.ch - b.ch)[0];
        if (v) out.push({ kind: 'interaction', id: v.i.id, ch: v.ch });
        return out;
      }
      return [{ kind: 'place', id: place, ch: firstOpen(pack, 'place', place) }];
    }
    case 'shift': {
      if (pred.job) return [{ kind: 'job', id: pred.job, ch: firstOpen(pack, 'job', pred.job) }];
      const jobs = pack.jobs.map((j) => ({ id: j.id, ch: firstOpen(pack, 'job', j.id) })).sort((a, b) => a.ch - b.ch);
      return jobs[0] ? [{ kind: 'job', id: jobs[0].id, ch: jobs[0].ch }] : [];
    }
    case 'all':
      return pred.of.flatMap((p) => reqs(p, pack, new Set(seen)));
    case 'any': {
      // one satisfiable alternative is enough: judge by the branch that opens earliest
      const branches = pred.of.map((p) => reqs(p, pack, new Set(seen)));
      branches.sort((a, b) => maxCh(a) - maxCh(b));
      return branches[0] ?? [];
    }
    default:
      // lesson, stars, purchases, earn_total, wallet, words_*, say_new, discover, culture*, srs_reviews, item_placed, flag: language or
      // collection counts that need no chapter-gated thing
      return [];
  }
}

/** The things a predicate needs to be satisfiable (`validatePack` level 4): jobs, items, scenarios, friends, places, with their opening chapter. */
export function requires(pred: Pred, pack: GamePack): Requirement[] {
  return dedupe(reqs(pred, pack, new Set()));
}

// ---------------------------------------------------------------------------------------------------------------
// evaluateAll
// ---------------------------------------------------------------------------------------------------------------

/**
 * The `chapter.completed` cache re-derived from the rest of the state (§7.1: it is a cache, never the source): every chapter before
 * the current one, plus the current one when it is finished and only the next chapter's start gate is shut. Use it on load.
 */
export function deriveCompleted(pack: GamePack, state: GameState, view: GameView): number[] {
  const n = state.chapter.n;
  const done = pack.chapters.filter((c) => c.n < n).map((c) => c.n);
  const def = chapterDef(pack, n);
  const next = def ? chapterDef(pack, nextChapterN(pack, n)) : null;
  if (def && chapterReady(def, state) && next?.startGate && !evalPred(next.startGate, state, { pack, view })) done.push(n);
  return done.sort((a, b) => a - b);
}

/**
 * Level-4 prerequisite check (§7.1): every objective (and its `easier` alternative) must be satisfiable with what is open at its
 * chapter's start, every dream step with what is open at its gate, every start gate with what is open in the chapter before. An id
 * no source knows is reported too. This is the check that catches "Chapter 2's reward unlocks the shift Chapter 2 asks for".
 */
export function prerequisiteIssues(pack: GamePack): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const check = (pred: Pred, ch: number, path: string, what: string): void => {
    for (const r of requires(pred, pack)) {
      if (r.ch === 0) {
        issues.push({ level: 4, severity: 'error', code: 'prereq_unknown', path, message: `${what} needs ${r.kind} "${r.id}", which nothing in the pack opens` });
      } else if (r.ch > ch) {
        issues.push({ level: 4, severity: 'error', code: 'prereq_locked', path, message: `${what} needs ${r.kind} "${r.id}", open from chapter ${r.ch}, but is asked at chapter ${ch}` });
      }
    }
  };
  pack.chapters.forEach((c, ci) => {
    c.objectives.forEach((o, oi) => {
      if (o.dream) return;
      check(o.pred, c.n, `chapters[${ci}].objectives[${oi}].pred`, `objective ${o.id}`);
      if (o.easier) check(o.easier.pred, c.n, `chapters[${ci}].objectives[${oi}].easier.pred`, `the easier alternative of ${o.id}`);
    });
    // a start gate is judged when the chapter before it completes
    if (c.startGate) check(c.startGate, c.n - 1, `chapters[${ci}].startGate`, `the start gate of chapter ${c.n}`);
  });
  pack.dreams.forEach((d, di) => d.steps.forEach((s, si) => check(s.pred, s.gate, `dreams[${di}].steps[${si}].pred`, `dream step ${s.id}`)));
  return issues;
}

/** Files a culture card (state, derived event, the card pop-up and the cosmetic XP); a known card is a no-op. */
function unlockCulture(state: GameState, id: string, out: EvalOut): GameState {
  if (state.culture[id] !== undefined) return state;
  out.derived.push({ t: 'culture_unlocked', id });
  out.effects.push({ t: 'culture', id }, { t: 'xp', amount: BALANCE.cultureXp, why: 'culture' });
  return { ...state, culture: { ...state.culture, [id]: dayKey(state.clock.dayIndex) } };
}

/** Grants a title once (state + derived event). */
function grantTitle(state: GameState, id: string, out: EvalOut): GameState {
  if (state.titles.includes(id)) return state;
  out.derived.push({ t: 'title_earned', id });
  return { ...state, titles: [...state.titles, id] };
}

/** Whether an objective's predicate is touched by a conversation of `scenarioId`; say_new and stars count any conversation (D40). */
function touchesConversation(pred: Pred, scenarioId: string): boolean {
  switch (pred.k) {
    case 'scenario':
      return pred.id === scenarioId;
    case 'said':
      return pred.scenario === scenarioId;
    case 'say_new':
    case 'stars':
      return true;
    case 'all':
    case 'any':
      return pred.of.some((p) => touchesConversation(p, scenarioId));
    default:
      return false;
  }
}

/** Attempts toward `easier.afterTries`: each settled conversation counts once for every unfinished objective with an alternative that it touches. */
function bumpTries(state: GameState, pack: GamePack, incoming: DerivedEvent[]): GameState {
  const settled = incoming.filter((e): e is Extract<DerivedEvent, { t: 'loop_settled' }> => e.t === 'loop_settled');
  const def = chapterDef(pack, state.chapter.n);
  if (settled.length === 0 || !def) return state;
  let tries = state.chapter.tries;
  for (const o of def.objectives) {
    if (o.dream || !o.easier || state.chapter.done[o.id] !== undefined || state.chapter.easier.includes(o.id)) continue;
    const hits = settled.filter((e) => touchesConversation(o.pred, e.scenarioId)).length;
    if (hits > 0) tries = { ...tries, [o.id]: (tries[o.id] ?? 0) + hits };
  }
  return tries === state.chapter.tries ? state : { ...state, chapter: { ...state.chapter, tries } };
}

/** Records the current chapter's objectives that hold now. */
function tickObjectives(state: GameState, ctx: Ctx, out: EvalOut): GameState {
  const def = chapterDef(ctx.pack, state.chapter.n);
  if (!def) return state;
  let done = state.chapter.done;
  for (const o of storyObjectives(def)) {
    if (done[o.id] !== undefined || !evalPred(objectivePred(o, state), state, ctx)) continue;
    done = { ...done, [o.id]: dayKey(state.clock.dayIndex) };
    out.derived.push({ t: 'objective_done', id: o.id });
    out.effects.push({ t: 'toast', key: 'quests.objectiveDone', vars: { id: o.id } });
  }
  return done === state.chapter.done ? state : { ...state, chapter: { ...state.chapter, done } };
}

/** Whether chapter `def` can complete now: every non-dream objective recorded, minDays met, and not on the day it began (one per day). */
function chapterReady(def: ChapterDef, state: GameState): boolean {
  if (!storyObjectives(def).every((o) => state.chapter.done[o.id] !== undefined)) return false;
  if (state.clock.activeDays < def.minDays) return false;
  return def.n === 1 || state.chapter.began.dayIndex < state.clock.dayIndex;
}

/** Pays the chapter's reward and grants its title, culture cards and closing beat. */
function completeChapter(state: GameState, def: ChapterDef, ctx: Ctx & { now: number }, out: EvalOut): GameState {
  let s = state;
  if (def.reward > 0) {
    const r = applyLedger(s, { id: LEDGER_IDS.chapter(def.n), at: ctx.now, kind: 'chapter', delta: def.reward, pocket: 'cash', ref: `ch${def.n}` }, walletLimits(s, ctx.pack));
    if (r.applied) {
      out.derived.push({ t: 'wallet_changed', delta: r.state.wallet.cash - s.wallet.cash, balance: r.state.wallet.cash, kind: 'chapter' });
      s = r.state;
    }
  }
  if (def.rewardTitle) s = grantTitle(s, def.rewardTitle, out);
  for (const c of def.rewardCulture ?? []) s = unlockCulture(s, c, out);
  out.derived.push({ t: 'chapter_done', n: def.n });
  out.effects.push({ t: 'toast', key: 'quests.chapterDone', vars: { n: def.n } }, { t: 'fanfare', kind: 'chapter' });
  if (!s.beats.includes(def.beats.close)) out.effects.push({ t: 'beat', id: def.beats.close });
  return { ...s, chapter: { ...s.chapter, completed: [...new Set([...s.chapter.completed, def.n])].sort((a, b) => a - b) } };
}

/** Chapter `n` becomes current: its `opens` (and the items, shops and dreams gated on it) take effect (D36) and its opening beat plays. */
function startChapter(state: GameState, n: number, pack: GamePack, out: EvalOut): GameState {
  const s: GameState = { ...state, chapter: { ...state.chapter, n, began: { dayIndex: state.clock.dayIndex, activeDays: state.clock.activeDays } } };
  out.derived.push({ t: 'chapter_started', n });
  const def = chapterDef(pack, n);
  for (const o of def?.opens ?? []) out.derived.push({ t: 'unlocked', what: o.kind, id: o.id });
  for (const i of pack.items) if (i.gate.ch === n) out.derived.push({ t: 'unlocked', what: 'item', id: i.id });
  for (const d of pack.dreams) if (d.openChapter === n) out.derived.push({ t: 'unlocked', what: 'dream', id: d.id });
  // Free Walk has no chapter row to list its shops: a capped release gates them on it (docs/RELEASE_1.md)
  if (!def) for (const sh of pack.shops) if (sh.openChapter === n) out.derived.push({ t: 'unlocked', what: 'shop', id: sh.id });
  if (def && !s.beats.includes(def.beats.open)) out.effects.push({ t: 'beat', id: def.beats.open });
  return s;
}

/**
 * Completes the current chapter when it is ready, then makes the next one current. A next chapter with a `startGate` (Chapter 6) waits:
 * the finished chapter keeps `chapter.n`, is in `completed`, and `chapterStatus.gated` says so.
 */
function settleChapter(state: GameState, ctx: Ctx & { now: number }, out: EvalOut): GameState {
  const def = chapterDef(ctx.pack, state.chapter.n);
  if (!def) return state;
  let s = state;
  if (!s.chapter.completed.includes(def.n)) {
    if (!chapterReady(def, s)) return s;
    s = completeChapter(s, def, ctx, out);
  }
  const nextN = nextChapterN(ctx.pack, def.n);
  const next = chapterDef(ctx.pack, nextN);
  if (next?.startGate && !evalPred(next.startGate, s, ctx)) return s;
  return startChapter(s, nextN, ctx.pack, out);
}

/** Whether an objective cannot be done without the item (the catch-up skips those: they wait for the phone itself). */
function needsItem(pred: Pred, item: ItemDef): boolean {
  switch (pred.k) {
    case 'own':
      return pred.item === item.id || (!!pred.category && item.tags.includes(pred.category));
    case 'phone_chat':
      return item.fx.some((e) => e.t === 'feature' && e.id === 'phone');
    case 'all':
      return pred.of.some((p) => needsItem(p, item));
    case 'any':
      return pred.of.length > 0 && pred.of.every((p) => needsItem(p, item));
    default:
      return false;
  }
}

/** §4.5 catch-up: after N active days in the chapter, with everything that does not need the item done, a one-time stipend closes the gap. */
function catchUp(state: GameState, ctx: Ctx & { now: number }, out: EvalOut): GameState {
  const def = chapterDef(ctx.pack, state.chapter.n);
  const cu = def?.catchUp;
  if (!def || !cu || state.chapter.completed.includes(def.n) || state.chapter.flags.includes(CATCHUP)) return state;
  if (state.clock.activeDays - state.chapter.began.activeDays < cu.afterActiveDays) return state;
  const item = ctx.pack.items.find((i) => i.id === cu.item);
  if (!item || ownedQty(state, item.id) > 0) return state;
  const needing = storyObjectives(def).filter((o) => needsItem(o.pred, item));
  // an objective that is "own the item" and already done means the player has bought it another way
  if (needing.some((o) => o.pred.k === 'own' && state.chapter.done[o.id] !== undefined)) return state;
  if (!storyObjectives(def).every((o) => needing.includes(o) || state.chapter.done[o.id] !== undefined)) return state;
  const shortfall = item.price - state.wallet.cash;
  // enough cash: nothing to hand over now (the flag stays unset so a later shortfall within the chapter still gets it)
  if (shortfall <= 0) return state;
  const next: GameState = { ...state, chapter: { ...state.chapter, flags: [...state.chapter.flags, CATCHUP] } };
  const r = applyLedger(next, { id: LEDGER_IDS.perk(CATCHUP), at: ctx.now, kind: 'perk', delta: Math.min(shortfall, cu.maxYen), pocket: 'cash', ref: CATCHUP }, walletLimits(next, ctx.pack));
  if (!r.applied) return next;
  const paid = r.state.wallet.cash - next.wallet.cash;
  out.derived.push({ t: 'wallet_changed', delta: paid, balance: r.state.wallet.cash, kind: 'perk' });
  out.effects.push({ t: 'toast', key: 'quests.catchUp', vars: { n: paid } });
  if (!r.state.beats.includes(`b_${CATCHUP}`)) out.effects.push({ t: 'beat', id: `b_${CATCHUP}` });
  return r.state;
}

/**
 * Re-evaluates every objective, chapter and dream from state after an event: ticks objectives, pays chapter rewards through
 * the ledger, advances the chapter (one per day), grants titles, culture cards and stickers, plays catch-up. Processes the
 * derived events it creates in a queue (depth <= 4). `incoming` are the derived events from earlier stages.
 *
 * Evaluation is state-based, so it is idempotent: a second call with no `incoming` changes nothing and returns no events. Only
 * `loop_settled` in `incoming` matters (it counts an attempt toward `easier.afterTries`), so pass each event batch once.
 * The result holds only the events and effects created here, not `incoming`.
 */
export function evaluateAll(state: GameState, ctx: ReduceCtx, incoming: DerivedEvent[] = []): ReduceResult {
  const out: EvalOut = { derived: [], effects: [] };
  let s = bumpTries(state, ctx.pack, incoming);
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const before = s;
    s = tickObjectives(s, ctx, out);
    s = settleChapter(s, ctx, out);
    s = catchUp(s, ctx, out);
    s = evaluateDream(s, ctx, out);
    if (s === before) break;
  }
  return { state: s, derived: out.derived, effects: out.effects };
}

// ---------------------------------------------------------------------------------------------------------------
// Next best goal (§11.7)
// ---------------------------------------------------------------------------------------------------------------

const PRACTISE: Gloss = { en: 'Practise again', ar: 'تدرّب مرة أخرى' };
const LESSON: Gloss = { en: "Let's do a lesson with Hanako-sensei", ar: 'لنقم بدرس مع المعلّمة هاناكو' };
const CLOSER_FRIEND: Gloss = { en: 'Make a closer friend first', ar: 'كوّن صديقًا مقرّبًا أولًا' };
const NEXT_GATE: Gloss = { en: 'One thing is still missing before the next chapter', ar: 'ينقصك أمر واحد قبل الفصل التالي' };

const reviewText = (n: number): Gloss => ({ en: `Review ${n} words that are due`, ar: `راجع ${n} كلمة مستحقة` });
const waitText = (n: number): Gloss => ({
  en: `Done! The next chapter opens after ${n} more days of practice`,
  ar: `أنجزت! يُفتح الفصل التالي بعد ${n} أيام أخرى من التدريب`,
});

/** The lesson the stuck rule offers: the first `lesson` objective not yet done, else the first lesson interaction. */
function stuckLesson(pack: GamePack, state: GameState, view: GameView): { id: string; text: Gloss } | null {
  const seen = (p: Pred): string[] => (p.k === 'lesson' ? [p.id] : p.k === 'all' || p.k === 'any' ? p.of.flatMap(seen) : []);
  for (const def of [...pack.chapters].sort((a, b) => a.n - b.n)) {
    if (def.n > state.chapter.n) break;
    for (const o of def.objectives) {
      const id = seen(o.pred).find((l) => !view.lessonsDone.includes(l));
      if (id) return { id, text: LESSON };
    }
  }
  const lesson = interactionsOf(pack).find((i) => i.kind === 'lesson');
  return lesson ? { id: lesson.id, text: LESSON } : null;
}

/** The deterministic priority list of §11.7 (objective with pin, dream step, daily goal, due reviews, lowest-star scenario; waits and the stuck rule). */
export function nextBestGoals(pack: GamePack, state: GameState, view: GameView): NextGoal[] {
  const ctx = { pack, view };
  const goals: NextGoal[] = [];

  // stuck rule: 3 conversations in a row with >= 3 fallbacks -> a Hanako lesson comes first
  const recent = state.coach.recent.slice(-BALANCE.nextGoal.stuckConvs);
  if (recent.length >= BALANCE.nextGoal.stuckConvs && recent.every((r) => r.fallbacks >= BALANCE.nextGoal.stuckFallbacks)) {
    const lesson = stuckLesson(pack, state, view);
    if (lesson) goals.push({ kind: 'lesson', id: lesson.id, text: lesson.text });
  }

  // (1) unfinished current-chapter objectives that point somewhere, in chapter order
  const def = chapterDef(pack, state.chapter.n);
  const open = def ? storyObjectives(def).filter((o) => !objectiveDone(o, state, ctx)) : [];
  const done = def ? open.length === 0 : false;
  for (const o of open) if (o.pin) goals.push({ kind: 'objective', id: o.id, text: o.text, pin: o.pin });

  // (2) the dream's next visible step
  const dream = effectiveDream(pack, state, view);
  if (dream && !state.dream.done) {
    const dp = dreamProgress(state, ctx, dream);
    const step = dp.nextStep ? pack.dreams.find((d) => d.id === dream)?.steps.find((s) => s.id === dp.nextStep) : undefined;
    if (step) goals.push({ kind: 'dream', id: step.id, text: step.text });
  }

  // (3) unfinished daily goals: today's trio, then yesterday's leftovers
  for (const g of [...state.daily.goals, ...state.daily.carried]) {
    if (g.done) continue;
    const t = pack.daily.find((d) => d.id === g.id);
    if (t) goals.push({ kind: 'daily', id: g.id, text: t.text });
  }

  // (4) due reviews
  if (view.vocab.dueCount >= BALANCE.nextGoal.reviewDue) goals.push({ kind: 'review', id: 'review', text: reviewText(view.vocab.dueCount) });

  // (5) practise again: the played, open scenario with the fewest stars
  const labels = new Map(interactionsOf(pack).filter((i) => i.scenarioId).map((i) => [i.scenarioId as string, i.label]));
  const played = Object.entries(state.runs)
    .filter(([id, r]) => r.count > 0 && r.stars < 3 && pack.scenarioMeta.some((m) => m.id === id && m.pay === 'full') && isOpen(pack, state, 'scenario', id))
    .sort(([ia, a], [ib, b]) => a.stars - b.stars || a.bestR - b.bestR || (ia < ib ? -1 : ia > ib ? 1 : 0));
  if (played[0]) {
    const [id] = played[0];
    const label = labels.get(id);
    goals.push({ kind: 'practice', id, text: label ? { en: `${PRACTISE.en}: ${label.en}`, ar: `${PRACTISE.ar}: ${label.ar}` } : PRACTISE });
  }

  // objectives without a pin are not trackable on the map but still belong to the list, after the tiers above
  for (const o of open) if (!o.pin) goals.push({ kind: 'objective', id: o.id, text: o.text });

  // the waiting message: only the minimum number of days (or a closed start gate) is left
  const status = chapterStatus(pack, state, view);
  if (def && done && status.waitDays > 0) goals.push({ kind: 'wait', id: `chapter:${def.n}:wait`, text: waitText(status.waitDays), days: status.waitDays });
  else if (status.gated) {
    const gate = chapterDef(pack, nextChapterN(pack, state.chapter.n))?.startGate;
    goals.push({ kind: 'wait', id: `chapter:${state.chapter.n}:gate`, text: gate && gate.k === 'hearts_count' ? CLOSER_FRIEND : NEXT_GATE });
  }
  return goals;
}

/** The HUD tracker target: the first of `nextBestGoals`, kept stable while `locked` (the previous target's id) is still unfinished. */
export function nextBestGoal(pack: GamePack, state: GameState, view: GameView, locked?: string | null): NextGoal | null {
  const goals = nextBestGoals(pack, state, view);
  // only unfinished things are listed, so a locked id that is still present is still unfinished
  if (locked) {
    const kept = goals.find((g) => g.id === locked);
    if (kept) return kept;
  }
  return goals[0] ?? null;
}
