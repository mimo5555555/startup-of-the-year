// 耳トレ, the daily ear training, over the real pack: once a day it records the lines heard and understood and ticks the daily `ears`
// counter (the g_ears goal); a second session the same day, or nonsense, records nothing; it never moves yen by itself.
import { describe, expect, it } from 'vitest';
import { createGameState, reduce, validateState, type GameState, type GameView, type InputEvent } from '@lw/game';
import { JP_PACK } from '../src';

const pack = JP_PACK;
const DAY = 86_400_000;
const T0 = new Date(2026, 9, 21, 12).getTime();
const view = (): GameView => ({
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'travel', level: 'A1', createdAt: '' },
});
const run = (s: GameState, ev: InputEvent, now = T0) => reduce(s, ev, { pack, now, view: view(), rng: () => 0.3 });
const fresh = (): GameState => run(createGameState(pack, T0), { t: 'day_observed', nowMs: T0 }).state;

describe('耳トレ (the ear training)', () => {
  it('records once a day, ticks the daily counter, and leaves the wallet alone', () => {
    let s = fresh();
    const day = s.clock.dayIndex;
    const r = run(s, { t: 'ears_done', right: 4, total: 5 });
    s = r.state;
    expect(s.ears).toEqual({ day, days: 1, heard: 5, right: 4 });
    expect(s.daily.counters[day]?.ears).toBe(1);
    expect(s.wallet).toEqual(fresh().wallet);
    expect(validateState(s, pack)).toEqual([]);
    // the same day again: practice only
    expect(run(s, { t: 'ears_done', right: 5, total: 5 }).state.ears).toEqual(s.ears);
    // the next day counts again
    const t1 = T0 + DAY;
    s = run(s, { t: 'day_observed', nowMs: t1 }, t1).state;
    s = run(s, { t: 'ears_done', right: 3, total: 5 }, t1).state;
    expect(s.ears).toMatchObject({ days: 2, heard: 10, right: 7 });
  });

  it('refuses nonsense', () => {
    const s = fresh();
    for (const ev of [
      { t: 'ears_done', right: 6, total: 5 },
      { t: 'ears_done', right: -1, total: 5 },
      { t: 'ears_done', right: 0, total: 0 },
      { t: 'ears_done', right: 1, total: 99 },
    ] as InputEvent[])
      expect(run(s, ev).state.ears).toEqual(s.ears);
  });

  it('the g_ears goal exists for every player from the start', () => {
    const g = pack.daily.find((d) => d.id === 'g_ears');
    expect(g).toMatchObject({ slot: 'review', counter: 'ears', target: 1 });
    expect(g?.requires).toBeUndefined();
  });
});
