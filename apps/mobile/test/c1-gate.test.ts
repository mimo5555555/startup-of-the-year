// Wave C1 gate: the release cap moved from Chapter 4 to Chapter 6 under saves that already exist. A save in the middle of Chapter 4 goes on into
// Chapter 5 (not the old epilogue), a save already in Free Walk stays there (no chapter is replayed, nothing is paid twice), and both load cleanly.
import './_fakeStorage';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { JP_PACK, scenarioById } from '@lw/content';
import { BALANCE, createGameState, migrate, reduce, validateState, type GameState, type InputEvent } from '@lw/game';
import { ctxOf } from '../../../packages/game/test/fixtures-1e';
import { gameView } from '../src/game/selectors';
import { interactionRows } from '../src/game/worldSync';

const fixture = (name: string): GameState => JSON.parse(readFileSync(new URL(`../../../packages/game/test/saves/${name}.json`, import.meta.url), 'utf8'));
const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

/** A loaded save at chapter `n` with chapters 1..n-1 (or `completed`) finished, every objective of chapter 4 recorded, and the days long passed. */
function saveAt(n: number, completed: number[]): GameState {
  const s = migrate(fixture('v1-typical'), 1, JP_PACK);
  const done: Record<string, number> = { ...s.chapter.done };
  for (const id of ['c4_1', 'c4_2', 'c4_3', 'c4_4']) done[id] = 1;
  return {
    ...s,
    clock: { ...s.clock, dayIndex: 40, activeDays: 40, lastActiveDay: 40 },
    chapter: { ...s.chapter, n, completed, done, began: { dayIndex: 30, activeDays: 30 } },
  };
}
const observe = (s: GameState, days = 1) => reduce(s, { t: 'day_observed', nowMs: NOW + days * DAY } as InputEvent, ctxOf(JP_PACK, { now: NOW + days * DAY }));

describe('wave C1: the cap moves to Chapter 6 under existing saves', () => {
  it('a save in the middle of Chapter 4 completes it into Chapter 5, with its own closing beat and its reward once', () => {
    const s0 = saveAt(4, [1, 2, 3]);
    expect(validateState(s0, JP_PACK)).toEqual([]);
    const r = observe(s0);
    expect(r.state.chapter.n).toBe(5);
    expect(r.state.chapter.completed).toEqual([1, 2, 3, 4]);
    const beats = r.effects.filter((e) => e.t === 'beat').map((e) => (e as { id: string }).id);
    expect(beats).toContain('b_ch4_close');
    expect(beats).toContain('b_ch5_open');
    expect(beats).not.toContain(JP_PACK.release.epilogue);
    const paid = r.state.ledger.filter((x) => x.kind === 'chapter' && x.ref === 'ch4');
    expect(paid).toHaveLength(1);
    // observing again (a reload, the next day) pays nothing more and does not restart the chapter
    const r2 = observe(r.state, 2);
    expect(r2.state.ledger.filter((x) => x.kind === 'chapter')).toHaveLength(r.state.ledger.filter((x) => x.kind === 'chapter').length);
    expect(r2.state.chapter.n).toBe(5);
    expect(r2.derived.some((d) => d.t === 'chapter_started')).toBe(false);
  });

  it('a save already in Free Walk (chapters 1-4 under the old cap) stays in Free Walk: nothing replays, nothing is paid', () => {
    const s0 = { ...saveAt(BALANCE.freeWalkChapter, [1, 2, 3, 4]), beats: ['b_release_epilogue'] };
    // the save goes through the loader as it is stored; `chapter.completed` is a cache of `chapter.n`, so Free Walk re-derives it as 1-6
    const loaded = migrate(JSON.parse(JSON.stringify(s0)), 1, JP_PACK);
    expect(validateState(loaded, JP_PACK)).toEqual([]);
    expect(loaded.chapter.n).toBe(BALANCE.freeWalkChapter);
    expect(loaded.chapter.completed).toEqual([1, 2, 3, 4, 5, 6]);
    let s = loaded;
    for (let d = 1; d <= 3; d++) {
      const r = observe(s, d);
      expect(r.state.chapter.n).toBe(BALANCE.freeWalkChapter);
      expect(r.derived.some((x) => x.t === 'chapter_started' || x.t === 'chapter_done')).toBe(false);
      expect(r.effects.some((e) => e.t === 'beat' && ['b_ch5_open', 'b_ch6_open', JP_PACK.release.epilogue].includes((e as { id: string }).id))).toBe(false);
      s = r.state;
    }
    expect(s.ledger.filter((x) => x.kind === 'chapter')).toHaveLength(loaded.ledger.filter((x) => x.kind === 'chapter').length);
    expect(validateState(s, JP_PACK)).toEqual([]);
  });
});

describe('wave C1: the rows of the new jobs and the trip follow the chapters', () => {
  const view = gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: { name: 'Sam', level: 'A1', goal: 'travel', age: 'adults', createdAt: '2030-01-15T00:00:00.000Z' } as never });
  // only scenarios that are really registered (what the app passes)
  const scenarios = new Set(Object.values(JP_PACK.interactions).flat().map((i) => i.scenarioId).filter((id): id is string => !!id && !!scenarioById(id)));
  const rows = (n: number, who: string) => {
    const s = createGameState(JP_PACK, NOW);
    return interactionRows({ pack: JP_PACK, state: { ...s, chapter: { ...s.chapter, n } }, view, scenarios, lessons: new Set() }, who);
  };
  const lockOf = (n: number, who: string, id: string) => {
    const r = rows(n, who).find((x) => x.it.id === id);
    return r ? r.lock : 'absent';
  };
  it('the trip and the station shift: absent two chapters ahead, a teaser in Chapter 4, open from Chapter 5 and in Free Walk', () => {
    for (const id of ['trip_hikarigaoka', 'sato_shift']) {
      expect(lockOf(3, 'sato', id), id).toBe('absent');
      expect(lockOf(4, 'sato', id), id).toEqual({ ch: 5 });
      expect(lockOf(5, 'sato', id), id).toBeNull();
      expect(lockOf(BALANCE.freeWalkChapter, 'sato', id), id).toBeNull();
    }
  });
  it("the café shift is Yuki's from Chapter 3", () => {
    expect(lockOf(2, 'yuki', 'yuki_shift')).toEqual({ ch: 3 });
    expect(lockOf(3, 'yuki', 'yuki_shift')).toBeNull();
  });
});
