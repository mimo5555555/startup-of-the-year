// SRS hooks (agent 2E, docs/GAME_DESIGN.md §11.5): the daily cap on new goal cards and their release, the Quick sprint amnesty, the
// once-a-day implicit review, and the srs_review event that only a checked answer on an already-reviewed due card makes count.
import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { newSrsCard, reviewCard } from '@lw/core';
import { BALANCE } from '@lw/game';
import { wipeSaved } from './_fakeStorage';
import { dispatch, init, resetBridgeForTests } from '../src/game/bridge';
import { getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import {
  PARKED_DUE,
  applyCapPlan,
  applyImplicitReview,
  applyRespace,
  enforceGoalCaps,
  goalCardCap,
  implicitReviewAllowed,
  isParked,
  keepLineOp,
  planGoalCaps,
  planReview,
  reviewEvent,
} from '../src/game/srsHooks';
import { useStore, type Profile, type VocabItem } from '../src/store';
import { useUi } from '../src/ui';

const DAY = 86_400_000;
const NOON = new Date(2031, 5, 10, 12, 0, 0).getTime();
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0].avatar, createdAt: '2030-01-15T00:00:00.000Z' };

let n = 0;
function card(o: { source?: VocabItem['source']; savedAt?: number; due?: number; stability?: number; reps?: number; last?: number } = {}): VocabItem {
  n++;
  let c = newSrsCard(new Date(NOON));
  for (let i = 0; i < (o.reps ?? 0); i++) c = reviewCard(c, 'good', new Date(NOON - (10 - i) * DAY));
  c.due = new Date(o.due ?? NOON - 1000).toISOString();
  if (o.stability !== undefined) c.stability = o.stability;
  if (o.last) c.last_review = new Date(o.last).toISOString();
  return { id: `w${n}`, kind: 'word', s: `s${n}`, rom: `s${n}`, meaning: { en: 'x' }, source: o.source ?? 'conversation', savedAt: new Date(o.savedAt ?? NOON - 3_600_000).toISOString(), card: c };
}

beforeEach(async () => {
  n = 0;
  wipeSaved();
  useStore.getState().reset();
  useUi.getState().clearRequests();
  resetBridgeForTests();
  useGame.getState().resetGame();
  wipeSaved();
  await init();
  useStore.getState().completeOnboarding(profile);
});

describe('the daily cap on new goal cards', () => {
  it('is 8, kids 5, seniors 6 (the age profile)', () => {
    expect(goalCardCap(PACK, 'adults')).toBe(8);
    expect(goalCardCap(PACK, 'teens')).toBe(8);
    expect(goalCardCap(PACK, 'kids')).toBe(5);
    expect(goalCardCap(PACK, 'seniors')).toBe(6);
  });

  it('parks the goal cards beyond the cap, latest first, and only goal cards', () => {
    const goal = Array.from({ length: 10 }, (_, i) => card({ source: 'goal', savedAt: NOON - 1000 * (10 - i), due: NOON + DAY }));
    const others = [card({ source: 'echo' }), card({ source: 'correction' }), card({ source: 'sign' }), card({ source: 'lesson' })];
    const plan = planGoalCaps([...others, ...goal], { cap: 8, now: NOON });
    expect(plan.park).toEqual([goal[8].id, goal[9].id]);
    expect(plan.release).toEqual([]);
  });

  it('counts a day at a time: yesterday\'s goal cards do not use up today\'s cap', () => {
    const yesterday = Array.from({ length: 8 }, () => card({ source: 'goal', savedAt: NOON - DAY, due: NOON }));
    const today = Array.from({ length: 8 }, () => card({ source: 'goal', savedAt: NOON - 1000, due: NOON + DAY }));
    expect(planGoalCaps([...yesterday, ...today], { cap: 8, now: NOON }).park).toEqual([]);
  });

  it('releases cards parked on an earlier day, oldest first and at most a cap, only while the backlog is small', () => {
    const parked = Array.from({ length: 10 }, (_, i) => card({ source: 'goal', savedAt: NOON - DAY - 1000 * (10 - i), due: Date.parse(PARKED_DUE) }));
    expect(parked.every(isParked)).toBe(true);
    const small = planGoalCaps(parked, { cap: 8, now: NOON });
    expect(small.release).toEqual(parked.slice(0, 8).map((v) => v.id));
    const backlog = Array.from({ length: BALANCE.srs.parkReleaseBelowDue }, () => card());
    expect(planGoalCaps([...parked, ...backlog], { cap: 8, now: NOON }).release).toEqual([]);
    expect(planGoalCaps([...parked, ...backlog.slice(1)], { cap: 8, now: NOON }).release.length).toBe(8);
  });

  it('never releases a card parked today, whatever the backlog', () => {
    const today = Array.from({ length: 10 }, (_, i) => card({ source: 'goal', savedAt: NOON - 10_000 + i * 100, due: NOON + DAY }));
    const first = planGoalCaps(today, { cap: 8, now: NOON });
    applyCapPlanTo(today, first);
    expect(planGoalCaps(today, { cap: 8, now: NOON }).release).toEqual([]);
  });

  it('the store follows the vocabulary: the 9th goal card of a day is parked when it is saved', () => {
    const st = useStore.getState();
    for (let i = 0; i < 10; i++) st.saveWord({ kind: 'word', s: `かーど${i}`, rom: `c${i}`, meaning: { en: 'x' }, source: 'goal' }, { dueInMin: BALANCE.srs.goalDueMin });
    const goal = useStore.getState().vocab.filter((v) => v.source === 'goal');
    expect(goal.length).toBe(10);
    expect(goal.filter(isParked).length).toBe(2);
    // saved last = parked (vocab is newest first)
    expect(goal.slice(0, 2).every(isParked)).toBe(true);
    // a parked card is not due, so the queue never sees it
    expect(useStore.getState().vocab.filter((v) => !isParked(v) && Date.parse(v.card.due) <= Date.now()).length).toBeLessThanOrEqual(goal.length - 2 + 5);
    // enforcing again changes nothing
    const before = useStore.getState().vocab;
    enforceGoalCaps();
    expect(useStore.getState().vocab).toEqual(before);
  });

  it('applyCapPlan moves due only: reps, stability and lapses stay', () => {
    const v = card({ source: 'goal', reps: 3, savedAt: Date.now() - 1000 });
    useStore.setState({ vocab: [v] });
    applyCapPlan({ park: [v.id], release: [] });
    const after = useStore.getState().vocab[0];
    expect(after.card.due).toBe(PARKED_DUE);
    expect({ ...after.card, due: v.card.due }).toEqual(v.card);
  });
});

function applyCapPlanTo(vocab: VocabItem[], plan: { park: string[] }) {
  for (const v of vocab) if (plan.park.includes(v.id)) v.card.due = PARKED_DUE;
}

describe('amnesty: the Quick sprint', () => {
  it('shows every due card, oldest first, up to the amnesty limit', () => {
    const vocab = Array.from({ length: BALANCE.srs.amnestyDue }, (_, i) => card({ due: NOON - 100_000 + i }));
    const plan = planReview(vocab, NOON);
    expect(plan.sprint).toBe(false);
    expect(plan.queue).toEqual(vocab.map((v) => v.id));
    expect(plan.respace).toEqual([]);
  });

  it('past the limit: the 12 lowest-stability cards, the rest re-spaced forward over the next days', () => {
    const vocab = Array.from({ length: BALANCE.srs.amnestyDue + 8 }, (_, i) => card({ stability: i + 1, reps: 2 }));
    const plan = planReview(vocab, NOON);
    expect(plan.sprint).toBe(true);
    expect(plan.queue).toEqual(vocab.slice(0, BALANCE.srs.sprint).map((v) => v.id));
    expect(plan.respace.length).toBe(vocab.length - BALANCE.srs.sprint);
    const dues = plan.respace.map((r) => Date.parse(r.due));
    expect(Math.min(...dues)).toBeGreaterThanOrEqual(NOON + DAY);
    expect(dues).toEqual([...dues].sort((a, b) => a - b));
    // a sprint's worth a day
    expect(dues.filter((d) => d < NOON + 2 * DAY).length).toBe(BALANCE.srs.sprint);
    // the sprint is not in the re-spacing
    expect(plan.respace.some((r) => plan.queue.includes(r.id))).toBe(false);
  });

  it('parked and not-yet-due cards are not in the queue and are never re-spaced', () => {
    const vocab = [...Array.from({ length: 45 }, () => card()), card({ due: NOON + DAY }), card({ source: 'goal', due: Date.parse(PARKED_DUE) })];
    const plan = planReview(vocab, NOON);
    const ids = new Set([...plan.queue, ...plan.respace.map((r) => r.id)]);
    expect(ids.size).toBe(45);
  });

  it('re-spacing keeps reps, lapses and stability (no lapse is counted)', () => {
    const vocab = Array.from({ length: 50 }, (_, i) => card({ stability: i + 1, reps: 4 }));
    useStore.setState({ vocab });
    const plan = planReview(useStore.getState().vocab, NOON);
    applyRespace(plan);
    const after = useStore.getState().vocab;
    for (const v of after) {
      const was = vocab.find((x) => x.id === v.id)!;
      expect({ ...v.card, due: '' }).toEqual({ ...was.card, due: '' });
    }
    expect(after.filter((v) => Date.parse(v.card.due) <= NOON).length).toBe(BALANCE.srs.sprint);
  });
});

describe('use = review (implicit, once a day)', () => {
  it('a due, queued card not yet reviewed today gets one; not due, parked or reviewed today does not', () => {
    expect(implicitReviewAllowed(card(), NOON)).toBe(true);
    expect(implicitReviewAllowed(card({ due: NOON + 1000 }), NOON)).toBe(false);
    expect(implicitReviewAllowed(card({ due: Date.parse(PARKED_DUE) }), NOON)).toBe(false);
    expect(implicitReviewAllowed(card({ last: NOON - 1000 }), NOON)).toBe(false);
    expect(implicitReviewAllowed(card({ last: NOON - DAY }), NOON)).toBe(true);
  });

  it('applies through the store once per card per day', () => {
    const v = { ...card({ reps: 1 }), s: '水', key: undefined };
    v.card.due = new Date(Date.now() - 1000).toISOString();
    delete v.card.last_review;
    useStore.setState({ vocab: [v] });
    expect(applyImplicitReview('水')).toBe(true);
    const after = useStore.getState().vocab[0];
    expect(after.card.reps).toBe(2);
    expect(applyImplicitReview('水')).toBe(false);
    expect(useStore.getState().vocab[0].card.reps).toBe(2);
    expect(applyImplicitReview('みず')).toBe(false);
  });
});

describe('the checked review (g_review8)', () => {
  const dueTwice = () => ({ ...card({ reps: 2 }), key: undefined });
  it('counts only a checked answer on a due card that already had a review', () => {
    expect(reviewEvent(dueTwice(), true, NOON)).toEqual({ t: 'srs_review', keys: [expect.any(String)], due: 1 });
    expect(reviewEvent(dueTwice(), false, NOON).due).toBe(0);
    expect(reviewEvent(card({ reps: 0 }), true, NOON).due).toBe(0);
    expect(reviewEvent(card({ reps: 2, due: NOON + DAY }), true, NOON).due).toBe(0);
    expect(reviewEvent(card({ reps: 2, due: Date.parse(PARKED_DUE) }), true, NOON).due).toBe(0);
  });

  it('keys the pocket line by its pack key, a plain card by its text', () => {
    expect(reviewEvent({ ...dueTwice(), key: 'p_konbini_1' }, true, NOON).keys).toEqual(['p_konbini_1']);
  });

  it('through the reducer: checked reviews of due, earlier-reviewed cards tick g_review8 and a self-rated flip does not', () => {
    const g = () => getGame().daily;
    const counted = () => Object.values(g().counters).reduce((s, day) => s + (day.review_checked ?? 0), 0);
    expect(counted()).toBe(0);
    dispatch({ t: 'srs_review', keys: ['a'], due: 0 });
    expect(counted()).toBe(0);
    dispatch({ t: 'srs_review', keys: ['b'], due: 1 });
    dispatch({ t: 'srs_review', keys: ['c'], due: 1 });
    expect(counted()).toBe(2);
    expect(getGame().stats.srsReviews).toBe(3);
  });

  it('a card reviewed once is the earliest a checked answer can count', () => {
    const fresh = card({ reps: 0 });
    expect(reviewEvent(fresh, true, NOON).due).toBe(0);
    const again = { ...fresh, card: reviewCard(newSrsCard(new Date(NOON - DAY)), 'good', new Date(NOON - DAY)) };
    again.card.due = new Date(NOON - 1).toISOString();
    expect(again.card.reps).toBe(1);
    expect(reviewEvent(again, true, NOON).due).toBe(1);
  });
});

describe('cards of a debrief keep-these line', () => {
  it('are phrase cards due in 10 minutes with their own source', () => {
    const line = { ja: 'これ|を|ください。', en: 'This one, please.', ar: 'هذا من فضلك.' };
    for (const source of ['correction', 'conversation'] as const) {
      const op = keepLineOp('d:これをください', line, source);
      expect(op).toMatchObject({ op: 'add', kind: 'phrase', source, dueInMin: BALANCE.srs.echoDueMin, line });
    }
  });
});
