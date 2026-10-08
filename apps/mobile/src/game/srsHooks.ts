// SRS hooks (docs/GAME_DESIGN.md §11.5): cards without chores. Pure planners (what to park, release, re-space, review) that the tests
// drive directly, thin appliers over the v1 store, and the ops other agents hand to `bridge.applySrsOps`.
//
// What the reducer already does: `prepare_done` asks for the phrase cards of studied lines (source 'goal', due in a day), `echo` asks
// for the phrase card of a hidden-line Say it (source 'conversation', due in 10 minutes), `sign_found` for the sign word. What lives
// here: the daily cap on new goal cards (parked until the backlog is small), the word cards of a pocket, the keep-these card, the
// amnesty for a big backlog, the once-a-day implicit review, and the srs_review event of the checked review mode.
import { localDate } from '@lw/core';
import { BALANCE, type AgeGroup, type GamePack, type Line, type PocketLine, type SrsOp } from '@lw/game';
import { useStore, type VocabItem } from '../store';
import { PACK } from './pack';
import { wordKeysOf } from './prepareLogic';

// ---------------------------------------------------------------------------------------------------------------
// Parked cards: no due date
// ---------------------------------------------------------------------------------------------------------------

/** The v1 card has to carry a `due`; a parked card gets a date no review queue will ever reach, and `isParked` recognises it. */
export const PARKED_DUE = '9999-12-31T00:00:00.000Z';
const PARKED_FROM = Date.parse('9000-01-01T00:00:00.000Z');

export const isParked = (v: Pick<VocabItem, 'card'>): boolean => Date.parse(v.card.due) >= PARKED_FROM;
const dueAt = (v: Pick<VocabItem, 'card'>): number => Date.parse(v.card.due);
/** a card is in the review queue: due, and not parked */
export const isQueued = (v: Pick<VocabItem, 'card'>, now: number): boolean => !isParked(v) && dueAt(v) <= now;

/** New goal cards a day (§11.5): the age profile's `newCardsPerDay` (kids 5, seniors 6, others 8). */
export const goalCardCap = (pack: GamePack, age: AgeGroup): number => pack.ageProfiles[age].newCardsPerDay;

// ---------------------------------------------------------------------------------------------------------------
// Caps: park the cards beyond the daily limit, release them when the queue is small
// ---------------------------------------------------------------------------------------------------------------

export interface CapPlan {
  /** ids to park (set `due` to PARKED_DUE) */
  park: string[];
  /** ids to release (due now) */
  release: string[];
}

/**
 * At most `cap` new `goal` cards a day count (the earliest saved ones); the later ones are parked. A parked card made on an earlier
 * day comes back, oldest first and at most `cap` at a time, when fewer than BALANCE.srs.parkReleaseBelowDue cards are due. The cards
 * parked today never come back today, whatever the backlog, or the cap would not cap anything.
 */
export function planGoalCaps(vocab: VocabItem[], opts: { cap: number; now: number }): CapPlan {
  const { cap, now } = opts;
  const today = localDate(new Date(now));
  const dayOf = (v: VocabItem) => localDate(new Date(v.savedAt));
  // oldest first; the vocabulary is newest first, so cards saved in the same millisecond (one Prepare makes several) go by position
  const goal = vocab
    .map((v, at) => ({ v, at }))
    .filter(({ v }) => v.source === 'goal')
    .sort((a, b) => a.v.savedAt.localeCompare(b.v.savedAt) || b.at - a.at)
    .map(({ v }) => v);
  const park = goal.filter((v) => dayOf(v) === today && !isParked(v)).slice(cap).map((v) => v.id);
  const backlog = vocab.filter((v) => isQueued(v, now)).length;
  let release: string[] = [];
  if (backlog < BALANCE.srs.parkReleaseBelowDue) {
    release = goal
      .filter((v) => isParked(v) && dayOf(v) !== today)
      .slice(0, cap)
      .map((v) => v.id);
  }
  return { park, release };
}

/** Applies the plan to the v1 store (`due` only: reps, lapses and stability stay as they are). */
export function applyCapPlan(plan: CapPlan, now: number = Date.now()): void {
  if (plan.park.length === 0 && plan.release.length === 0) return;
  const park = new Set(plan.park);
  const release = new Set(plan.release);
  const iso = new Date(now).toISOString();
  useStore.setState((s) => ({
    vocab: s.vocab.map((v) => (park.has(v.id) ? withDue(v, PARKED_DUE) : release.has(v.id) ? withDue(v, iso) : v)),
  }));
}

const withDue = (v: VocabItem, due: string): VocabItem => ({ ...v, card: { ...v.card, due } });

/** Runs the cap rules over the whole vocabulary now (safe to call any time; a no-op when nothing is over). */
export function enforceGoalCaps(now: number = Date.now()): void {
  const { vocab, profile } = useStore.getState();
  if (!profile) return;
  applyCapPlan(planGoalCaps(vocab, { cap: goalCardCap(PACK, profile.age), now }), now);
}

// Cards are made by several doors (the reducer's srsOps through the bridge, the pocket's word cards, a Save in the debrief): the caps
// follow the vocabulary itself instead of each door. Idempotent, so the setState inside the listener settles in one extra pass.
let capsWatched = false;
function watchGoalCaps(): void {
  if (capsWatched) return;
  capsWatched = true;
  let last = useStore.getState().vocab;
  useStore.subscribe((s) => {
    if (s.vocab === last) return;
    last = s.vocab;
    if (s.ready && s.profile) enforceGoalCaps();
    last = useStore.getState().vocab;
  });
}
watchGoalCaps();

// ---------------------------------------------------------------------------------------------------------------
// Cards other screens ask for
// ---------------------------------------------------------------------------------------------------------------

/** The word cards of a pocket's lines (one per lexicon word, due in a day like the phrase cards, §11.5). Hand them to `bridge.applySrsOps`. */
export function pocketWordOps(lines: PocketLine[]): SrsOp[] {
  return wordKeysOf(lines).map((key): SrsOp => ({ op: 'add', key, kind: 'word', source: 'goal', dueInMin: BALANCE.srs.goalDueMin }));
}

/**
 * The phrase card of a debrief "keep these" line: `correction` for a corrected line of the learner's own, `conversation` for an
 * echoed one (what the reducer's echo op uses), first due 10 minutes later. Hand it to `bridge.applySrsOps`.
 */
export function keepLineOp(key: string, line: Line, source: 'correction' | 'conversation'): SrsOp {
  return { op: 'add', key, kind: 'phrase', line, source, dueInMin: BALANCE.srs.echoDueMin };
}

// ---------------------------------------------------------------------------------------------------------------
// Use = review
// ---------------------------------------------------------------------------------------------------------------

/**
 * §11.5: a due card whose word the learner used in a class-I turn gets one implicit `good` review a day. Due now, not parked, and
 * not already reviewed today (by this rule or by the review screen). The reducer asks for a review of every word of such a turn, so
 * this is the gate `bridge.applySrsOps` applies before it calls `reviewWord`.
 */
export function implicitReviewAllowed(v: Pick<VocabItem, 'card'>, now: number = Date.now()): boolean {
  if (!isQueued(v, now)) return false;
  const last = v.card.last_review;
  return !last || localDate(new Date(last)) !== localDate(new Date(now));
}

/** Applies the gate to one card of the store: returns true when a review was recorded. */
export function applyImplicitReview(key: string, now: number = Date.now()): boolean {
  const st = useStore.getState();
  const have = st.vocab.find((v) => v.key === key || v.s === key);
  if (!have || !implicitReviewAllowed(have, now)) return false;
  st.reviewWord(have.id, 'good');
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// The review queue: amnesty
// ---------------------------------------------------------------------------------------------------------------

export interface ReviewPlan {
  /** the cards to show, in order */
  queue: string[];
  /** true when the backlog was past BALANCE.srs.amnestyDue and only the sprint is shown */
  sprint: boolean;
  /** with a sprint: the other due cards, each moved forward (no lapse is counted) */
  respace: Array<{ id: string; due: string }>;
}

const DAY_MS = 86_400_000;

/**
 * The cards to review now. Up to BALANCE.srs.amnestyDue due cards are shown oldest first. Past that, the "Quick sprint": the
 * BALANCE.srs.sprint lowest-stability cards, and every other due card is re-spaced forward over the next days (a sprint's worth a day),
 * keeping its reps, lapses and stability.
 */
export function planReview(vocab: VocabItem[], now: number = Date.now()): ReviewPlan {
  const due = vocab.filter((v) => isQueued(v, now));
  const byDue = [...due].sort((a, b) => a.card.due.localeCompare(b.card.due));
  if (due.length <= BALANCE.srs.amnestyDue) return { queue: byDue.map((v) => v.id), sprint: false, respace: [] };
  const weakest = [...due].sort((a, b) => a.card.stability - b.card.stability || a.card.due.localeCompare(b.card.due));
  const sprint = weakest.slice(0, BALANCE.srs.sprint);
  const rest = weakest.slice(BALANCE.srs.sprint);
  const respace = rest.map((v, i) => ({ id: v.id, due: new Date(now + (1 + Math.floor(i / BALANCE.srs.sprint)) * DAY_MS).toISOString() }));
  return { queue: sprint.map((v) => v.id), sprint: true, respace };
}

/** Moves the re-spaced cards forward in the store (`due` only). */
export function applyRespace(plan: ReviewPlan): void {
  if (plan.respace.length === 0) return;
  const to = new Map(plan.respace.map((r) => [r.id, r.due]));
  useStore.setState((s) => ({ vocab: s.vocab.map((v) => (to.has(v.id) ? withDue(v, to.get(v.id)!) : v)) }));
}

// ---------------------------------------------------------------------------------------------------------------
// The checked review mode (g_review8)
// ---------------------------------------------------------------------------------------------------------------

/**
 * The `srs_review` event of one answered card. `due` is 1 only when the card was due, already had an earlier review, and was answered
 * through a check (the pick-the-answer mode or a typed answer that matched): a first review of a fresh Prepare card and a self-rated
 * flip never count towards `g_review8`. Read the card BEFORE `reviewWord` changes it.
 */
export function reviewEvent(item: Pick<VocabItem, 'key' | 's' | 'card'>, checked: boolean, now: number = Date.now()): { t: 'srs_review'; keys: string[]; due: number } {
  const wasDue = !isParked(item) && dueAt(item) <= now;
  return { t: 'srs_review', keys: [item.key ?? item.s], due: checked && wasDue && item.card.reps >= 1 ? 1 : 0 };
}
