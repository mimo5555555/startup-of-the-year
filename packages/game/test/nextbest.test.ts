import { describe, expect, it } from 'vitest';
import { chapterStatus, nextBestGoal, nextBestGoals, objectiveRows } from '../src/objectives';
import { apFor, DAILY, friendAt, mkQuestPack, mkRun, mkState, mkView, rng, withDone } from './fixtures-quest';
import type { DailyGoalState, GameState, NextGoal } from '../src/types';

const pack = mkQuestPack();
const kinds = (g: NextGoal[]): string[] => g.map((x) => x.kind);
const idsOf = (g: NextGoal[]): string[] => g.map((x) => x.id);

const goal = (id: string, day: number, over: Partial<DailyGoalState> = {}): DailyGoalState => {
  const t = DAILY.find((d) => d.id === id)!;
  return { id, slot: t.slot, counter: t.counter, target: t.target, day, done: false, paid: false, ...over };
};

describe('nextBestGoals (§11.7)', () => {
  it('(1) unfinished objectives with a pin come first, in chapter order', () => {
    const goals = nextBestGoals(pack, mkState(), mkView());
    expect(goals.slice(0, 2)).toEqual([
      { kind: 'objective', id: 'c1_1', text: pack.chapters[0].objectives[0].text, pin: { place: 'school' } },
      { kind: 'objective', id: 'c1_2', text: pack.chapters[0].objectives[1].text, pin: { place: 'place_konbini' } },
    ]);
    // a finished objective is not listed
    const done = { ...mkState(), chapter: { ...mkState().chapter, done: { c1_1: 'd0' } } };
    expect(idsOf(nextBestGoals(pack, done, mkView()))[0]).toBe('c1_2');
    // and a held predicate that has not been recorded yet is not listed either
    const held = nextBestGoals(pack, mkState(), mkView({ lessons: ['greetings'] }));
    expect(idsOf(held)).not.toContain('c1_1');
  });

  it('then the dream\'s next visible step, then the daily goals, due reviews, and practice', () => {
    const s: GameState = {
      ...mkState({ chapter: 2 }),
      // both pinned chapter-2 objectives done
      chapter: { ...mkState({ chapter: 2 }).chapter, done: { c2_1: 'd1', c2_2: 'd1' } },
      dream: { id: 'festival', steps: {}, done: false },
      daily: { ...mkState().daily, goals: [goal('g_lesson', 0), goal('g_buy', 0, { done: true })], carried: [goal('g_conv2', -1)] },
      runs: { konbini: mkRun({ stars: 1, bestR: 0.4 }), cafe: mkRun({ stars: 2 }) },
    };
    const goals = nextBestGoals(pack, s, mkView({ due: 12 }));
    expect(kinds(goals)).toEqual(['dream', 'daily', 'daily', 'review', 'practice', 'objective', 'objective']);
    expect(goals[0]).toMatchObject({ id: 'fe_s1' });
    // today's trio before yesterday's leftovers; the finished goal is skipped
    expect(idsOf(goals).slice(1, 3)).toEqual(['g_lesson', 'g_conv2']);
    expect(goals[3]).toMatchObject({ kind: 'review', id: 'review' });
    expect(goals[3].text.en).toContain('12');
    expect(goals[3].text.ar).toContain('12');
    // practise the lowest-star scenario, named by its interaction label
    expect(goals[4]).toMatchObject({ kind: 'practice', id: 'konbini' });
    expect(goals[4].text.en).toBe('Practise again: Konbini');
    // objectives that point nowhere come after the tiers above
    expect(idsOf(goals).slice(5)).toEqual(['c2_3', 'c2_4']);
  });

  it('(4) reviews are listed from 10 due cards on', () => {
    const base = mkState({ chapter: 2 });
    expect(kinds(nextBestGoals(pack, base, mkView({ due: 9 })))).not.toContain('review');
    expect(kinds(nextBestGoals(pack, base, mkView({ due: 10 })))).toContain('review');
  });

  it('(5) practice picks the played, open scenario with the fewest stars (ties: lower best score, then id), never a finished 3-star one', () => {
    const base = mkState({ chapter: 5 });
    const practise = (runs: GameState['runs']) => nextBestGoals(pack, { ...base, runs }, mkView()).find((g) => g.kind === 'practice')?.id;
    expect(practise({ konbini: mkRun({ stars: 2 }), cafe: mkRun({ stars: 1, bestR: 0.9 }), ramen: mkRun({ stars: 1, bestR: 0.3 }) })).toBe('ramen');
    expect(practise({ konbini: mkRun({ stars: 3 }), cafe: mkRun({ stars: 3 }) })).toBeUndefined();
    // a scenario the player has not played is not "again", an unopen one is not offered, a hearts-only one pays no yen
    expect(practise({})).toBeUndefined();
    expect(practise({ motors_visit: mkRun({ stars: 0 }) })).toBe('motors_visit');
    expect(nextBestGoals(pack, { ...mkState({ chapter: 4 }), runs: { motors_visit: mkRun({ stars: 0 }) } }, mkView()).some((g) => g.kind === 'practice')).toBe(false);
    expect(practise({ chat_first: mkRun({ stars: 0 }) })).toBeUndefined();
  });

  it('nothing to do: an empty list and a null tracker', () => {
    const s = { ...mkState({ chapter: 9 }), dream: { id: null, steps: {}, done: false }, beats: ['b_ch1_close'] };
    expect(nextBestGoals(pack, s, mkView())).toEqual([]);
    expect(nextBestGoal(pack, s, mkView())).toBeNull();
  });

  it('is deterministic and never mutates the state', () => {
    const s = { ...mkState({ chapter: 2 }), daily: { ...mkState().daily, goals: [goal('g_lesson', 0)] } };
    const frozen = JSON.stringify(s);
    expect(nextBestGoals(pack, s, mkView())).toEqual(nextBestGoals(pack, s, mkView()));
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe('waiting for days and a closed start gate', () => {
  it('only minDays left: the list falls through to the other tiers and ends with the waiting message', () => {
    const s: GameState = {
      ...withDone(mkState({ chapter: 2, activeDays: 1, dayIndex: 1, began: { dayIndex: 0, activeDays: 1 } }), 2),
      dream: { id: 'festival', steps: {}, done: false },
      daily: { ...mkState().daily, goals: [goal('g_lesson', 1)] },
    };
    const view = mkView({ due: 11 });
    const goals = nextBestGoals(pack, s, view);
    // chapter 2 has minDays 2 and one active day
    expect(chapterStatus(pack, s, view).waitDays).toBe(1);
    expect(kinds(goals)).toEqual(['dream', 'daily', 'review', 'wait']);
    const wait = goals[goals.length - 1];
    expect(wait).toMatchObject({ kind: 'wait', days: 1 });
    expect(wait.text.en).toContain('1 more days');
    expect(wait.text.ar).toContain('1');
    // the chapter's objectives are not offered again
    expect(idsOf(goals).some((id) => id.startsWith('c2_'))).toBe(false);
  });

  it('the wait shrinks with the days and disappears when the days are done', () => {
    const base = withDone(mkState({ chapter: 3, activeDays: 1, dayIndex: 1, began: { dayIndex: 0, activeDays: 0 } }), 3);
    expect(nextBestGoals(pack, base, mkView()).find((g) => g.kind === 'wait')?.days).toBe(3);
    expect(nextBestGoals(pack, { ...base, clock: { ...base.clock, activeDays: 3 } }, mkView()).find((g) => g.kind === 'wait')?.days).toBe(1);
    expect(nextBestGoals(pack, { ...base, clock: { ...base.clock, activeDays: 4 } }, mkView()).some((g) => g.kind === 'wait')).toBe(false);
  });

  it('a chapter that began today waits for tomorrow even when the days are already enough', () => {
    const s = withDone(mkState({ chapter: 2, activeDays: 9, dayIndex: 4, began: { dayIndex: 4, activeDays: 8 } }), 2);
    expect(chapterStatus(pack, s, mkView()).waitDays).toBe(1);
  });

  it('a closed start gate says to make a closer friend first', () => {
    const s: GameState = { ...withDone(mkState({ chapter: 4, activeDays: 12, dayIndex: 12 }), 4), chapter: { ...withDone(mkState({ chapter: 4 }), 4).chapter, completed: [4] } };
    const goals = nextBestGoals(pack, s, mkView());
    const gate = goals[goals.length - 1];
    expect(gate).toMatchObject({ kind: 'wait', id: 'chapter:4:gate' });
    expect(gate.text.en).toBe('Make a closer friend first');
    expect(gate.text.ar).not.toBe('');
    // the gate opens with a ♥3 friend: no more message
    const open = { ...s, friends: { mio: friendAt(apFor(3)) } };
    expect(nextBestGoals(pack, open, mkView()).some((g) => g.kind === 'wait')).toBe(false);
  });
});

describe('the stuck rule', () => {
  const stuckRuns = (fallbacks: number[]): GameState['coach'] => ({ recent: fallbacks.map((f, i) => ({ day: i, scenarioId: 'cafe', r: 0.1, fallbacks: f })), realFor: [], sinceChange: 0 });

  it('3 conversations in a row with 3 or more fallbacks offer a Hanako lesson first', () => {
    const s = { ...mkState(), coach: stuckRuns([3, 4, 5]) };
    const goals = nextBestGoals(pack, s, mkView());
    expect(goals[0]).toMatchObject({ kind: 'lesson', id: 'greetings' });
    expect(goals[0].text.en).toContain('Hanako');
    // the rest of the list follows
    expect(idsOf(goals)).toContain('c1_1');
    expect(nextBestGoal(pack, s, mkView())?.kind).toBe('lesson');
  });

  it('needs three, in a row, each with at least three fallbacks', () => {
    for (const fb of [[3, 3], [3, 2, 3], [2, 3, 3], [9, 9, 2]]) {
      expect(nextBestGoals(pack, { ...mkState(), coach: stuckRuns(fb) }, mkView())[0].kind).not.toBe('lesson');
    }
    // only the last three count: an old good conversation does not matter
    expect(nextBestGoals(pack, { ...mkState(), coach: stuckRuns([0, 3, 3, 3]) }, mkView())[0].kind).toBe('lesson');
  });

  it('offers a lesson that is not done yet; with none left, a lesson interaction; with neither, nothing', () => {
    const s = { ...mkState({ chapter: 2 }), coach: stuckRuns([4, 4, 4]) };
    expect(nextBestGoals(pack, s, mkView({ lessons: ['greetings'] }))[0]).toMatchObject({ kind: 'lesson', id: 'int_lesson' });
    const bare = mkQuestPack({ interactions: {} });
    expect(nextBestGoals(bare, s, mkView({ lessons: ['greetings'] })).some((g) => g.kind === 'lesson')).toBe(false);
  });
});

describe('nextBestGoal: the locked tracker target', () => {
  const s: GameState = { ...mkState(), daily: { ...mkState().daily, goals: [goal('g_lesson', 0)] } };

  it('without a lock it is the first goal', () => {
    expect(nextBestGoal(pack, s, mkView())?.id).toBe('c1_1');
    expect(nextBestGoal(pack, s, mkView(), null)?.id).toBe('c1_1');
  });

  it('stays on the locked target while it is unfinished, whatever else became more urgent', () => {
    // the player locked onto the daily goal; a pinned objective outranks it in the list but the tracker does not jump
    expect(nextBestGoals(pack, s, mkView()).findIndex((g) => g.id === 'g_lesson')).toBeGreaterThan(0);
    expect(nextBestGoal(pack, s, mkView(), 'g_lesson')?.id).toBe('g_lesson');
    expect(nextBestGoal(pack, s, mkView(), 'c1_2')?.id).toBe('c1_2');
  });

  it('moves on when the target is done or no longer exists', () => {
    const done = { ...s, daily: { ...s.daily, goals: [goal('g_lesson', 0, { done: true })] } };
    expect(nextBestGoal(pack, done, mkView(), 'g_lesson')?.id).toBe('c1_1');
    expect(nextBestGoal(pack, s, mkView(), 'gone')?.id).toBe('c1_1');
    // a held-but-unrecorded objective counts as done for the tracker
    expect(nextBestGoal(pack, s, mkView({ lessons: ['greetings'] }), 'c1_1')?.id).toBe('c1_2');
  });
});

describe('Free Walk', () => {
  it('has no chapter objectives, but the dream, daily goals and practice carry on', () => {
    const s: GameState = {
      ...mkState({ chapter: 9 }),
      dream: { id: 'car', steps: {}, done: false },
      daily: { ...mkState().daily, goals: [goal('g_lesson', 0)] },
      runs: { cafe: mkRun({ stars: 1 }) },
    };
    const goals = nextBestGoals(pack, s, mkView());
    expect(kinds(goals)).toEqual(['dream', 'daily', 'practice']);
    expect(goals[0].id).toBe('car_s1');
    // once the dream is done it drops out
    expect(kinds(nextBestGoals(pack, { ...s, dream: { ...s.dream, done: true } }, mkView()))).toEqual(['daily', 'practice']);
  });
});

describe('property: the list only ever holds unfinished things', () => {
  it('over random states, no listed objective is done, no daily goal is done, no dream step is done', () => {
    const view = mkView({ due: 4 });
    for (let seed = 1; seed <= 40; seed++) {
      const r = rng(seed);
      const chapter = 1 + Math.floor(r() * 9);
      const s: GameState = {
        ...mkState({ chapter, activeDays: Math.floor(r() * 12) }),
        dream: { id: ['festival', 'phone_pal', 'bike', null][Math.floor(r() * 4)] as string | null, steps: r() < 0.5 ? { fe_s1: 'd1', pp_s1: 'd1' } : {}, done: false },
        daily: { ...mkState().daily, goals: DAILY.slice(0, 3).map((t) => goal(t.id, 0, { done: r() < 0.5 })), carried: [] },
        runs: { konbini: mkRun({ stars: Math.floor(r() * 4) as 0 | 1 | 2 | 3 }) },
        friends: { mio: friendAt(Math.floor(r() * 200)) },
      };
      const withObjs = r() < 0.5 ? withDone(s, chapter, ['c1_1', 'c2_2', 'c3_3', 'c4_4', 'c5_1']) : s;
      const goals = nextBestGoals(pack, withObjs, view);
      const rows = objectiveRows(pack, withObjs, view);
      for (const g of goals) {
        if (g.kind === 'objective') expect(rows.find((x) => x.id === g.id)?.done).toBe(false);
        if (g.kind === 'daily') expect(withObjs.daily.goals.find((x) => x.id === g.id)?.done).toBe(false);
        if (g.kind === 'dream') expect(withObjs.dream.steps[g.id]).toBeUndefined();
      }
      // ids are unique, so a locked id names one thing
      expect(new Set(idsOf(goals)).size).toBe(goals.length);
    }
  });
});
