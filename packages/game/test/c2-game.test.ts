// Release 2 wave C2: the smallest generic support the last chapters need, over the synthetic 1F pack. A chapter with two designed closings
// (`beats.closeIf`, Chapter 6's rented room), a chapter that asks to choose a dream (`dreamFlag`, Chapter 8's `dream_epilogue`), the Letter's
// c8_1 rule on `letter_saved`, the Real-mode flag every Real conversation files, and the capstone's one-time Guided fallback (§7.2 "No cliff").
// The Japanese pack's data over these rules is in packages/content/test/c2-content.test.ts.
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { closingBeat, closingPlayed } from '../src/objectives';
import { REAL_USED_FLAG, guidedFallbackOpen, guidedOnceFlag, realUsed, reduce } from '../src/reducer';
import { validatePack } from '../src/validate';
import type { ChapterDef, GamePack, GameState, InputEvent } from '../src/types';
import { NOW, ctx1f, facts1f, fresh1f, pack1f, turn, view1f } from './fixtures-1f';

const SPEECH = 'speech';
/** The 1F pack with a capstone scenario, Chapter 2 closing in two ways (by a story flag) and Chapter 3 asking to choose a dream. */
function packC2(): GamePack {
  const p = pack1f();
  const chapters: ChapterDef[] = p.chapters.map((c) =>
    c.n === 2 ? { ...c, beats: { ...c.beats, closeIf: { pred: { k: 'flag', id: 'moved_in' }, id: 'b_ch2_close_alt' } } } : c.n === 3 ? { ...c, dreamFlag: 'dream_epilogue' } : c,
  );
  return {
    ...p,
    chapters,
    beats: { ...p.beats, b_ch2_close_alt: { id: 'b_ch2_close_alt', lines: [{ who: 'hanako', line: { ja: 'はい', en: 'Yes', ar: 'نعم' } }] } },
    scenarioMeta: [...p.scenarioMeta, { id: SPEECH, kind: 'story', band: 'A2', register: 'polite', pay: 'full', real: true, capstone: true }],
  };
}
const P = packC2();
const step = (s: GameState, ev: InputEvent, pack: GamePack = P) => reduce(s, ev, ctx1f(pack, NOW, view1f()));
const inChapter = (n: number, extra: Partial<GameState['chapter']> = {}): GameState => {
  const s = fresh1f(P);
  return { ...s, chapter: { ...s.chapter, n, completed: Array.from({ length: n - 1 }, (_, i) => i + 1), ...extra } };
};

describe('beats.closeIf: a chapter with two designed closings (a beat has no condition)', () => {
  const ch2 = P.chapters.find((c) => c.n === 2)!;
  it('the closing is closeIf.id when its predicate holds, else beats.close', () => {
    const s = inChapter(3);
    expect(closingBeat(P, ch2, s, view1f())).toBe('b_ch2_close');
    const moved = { ...s, chapter: { ...s.chapter, flags: ['moved_in'] } };
    expect(closingBeat(P, ch2, moved, view1f())).toBe('b_ch2_close_alt');
  });
  it('either closing counts as played, so the other one never follows', () => {
    const s = inChapter(3);
    expect(closingPlayed(ch2, s)).toBe(false);
    expect(closingPlayed(ch2, { ...s, beats: ['b_ch2_close_alt'] })).toBe(true);
    expect(closingPlayed(ch2, { ...s, beats: ['b_ch2_close'] })).toBe(true);
  });
  it('day_observed replays the pending closing that the state picks, once', () => {
    const done = Object.fromEntries(ch2.objectives.filter((o) => !o.dream).map((o) => [o.id, 'd1']));
    const s = { ...inChapter(3), chapter: { ...inChapter(3).chapter, flags: ['moved_in'], done } };
    const r = step(s, { t: 'day_observed', nowMs: NOW });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch2_close_alt' });
    expect(r.effects).not.toContainEqual({ t: 'beat', id: 'b_ch2_close' });
    const played = step({ ...s, beats: ['b_ch2_close_alt'] }, { t: 'day_observed', nowMs: NOW });
    expect(played.effects.filter((e) => e.t === 'beat' && e.id.startsWith('b_ch2_close'))).toEqual([]);
  });
  it('a chapter that was never played to its end (a cache re-derived under a raised cap) gets no closing replayed', () => {
    const r = step({ ...inChapter(3), chapter: { ...inChapter(3).chapter, done: {} } }, { t: 'day_observed', nowMs: NOW });
    expect(r.effects.filter((e) => e.t === 'beat' && e.id.startsWith('b_ch2_close'))).toEqual([]);
  });
  it('a save far past the chapter (a raised release cap) does not replay a closing from the middle of the story', () => {
    // completed 1-2 but already in Chapter 4: the closing of Chapter 2 is not pending any more
    const s = inChapter(4, { completed: [1, 2] });
    const r = step(s, { t: 'day_observed', nowMs: NOW });
    expect(r.effects.filter((e) => e.t === 'beat' && e.id.startsWith('b_ch2_close'))).toEqual([]);
  });
  it('validatePack level 5 knows the second closing beat (a missing one is reported)', () => {
    const missing = { ...P, beats: Object.fromEntries(Object.entries(P.beats).filter(([id]) => id !== 'b_ch2_close_alt')) };
    expect(validatePack(missing, { level: 5 }).some((i) => i.path === 'chapters[1].beats.closeIf.id')).toBe(true);
    expect(validatePack(P, { level: 5 }).some((i) => i.path === 'chapters[1].beats.closeIf.id')).toBe(false);
  });
});

describe('ChapterDef.dreamFlag (Chapter 8: finish your dream, or choose a new one)', () => {
  it('choosing a dream while the chapter is current raises it, re-picking the same dream included', () => {
    const s0 = inChapter(3);
    const id = P.dreams[0]!.id;
    const once = step({ ...s0, dream: { ...s0.dream, id } }, { t: 'dream_chosen', id }).state;
    expect(once.chapter.flags).toContain('dream_epilogue');
  });
  it('not in another chapter', () => {
    const s = step(inChapter(2), { t: 'dream_chosen', id: P.dreams[0]!.id }).state;
    expect(s.chapter.flags).not.toContain('dream_epilogue');
  });
  it('a dream already finished counts too (no need to pick again)', () => {
    const s0 = inChapter(3);
    const done = { ...s0, dream: { id: P.dreams[0]!.id, steps: {}, done: true } };
    const r = step(done, { t: 'day_observed', nowMs: NOW });
    expect(r.state.chapter.flags).toContain('dream_epilogue');
  });
  it('validatePack: a flag objective that only a dreamFlag raises is reachable', () => {
    const p: GamePack = { ...P, chapters: P.chapters.map((c) => (c.n === 3 ? { ...c, objectives: [...c.objectives, { id: 'c3_x', pred: { k: 'flag', id: 'dream_epilogue' }, text: { en: 'x', ar: 'س' } }] } : c)) };
    expect(validatePack(p, { level: 4 }).filter((i) => i.code === 'bot_unreachable')).toEqual([]);
    const none: GamePack = { ...p, chapters: p.chapters.map((c) => ({ ...c, dreamFlag: undefined })) };
    expect(validatePack(none, { level: 4 }).some((i) => i.code === 'bot_unreachable' && /dream_epilogue/.test(i.message))).toBe(true);
  });
});

describe('letter_saved: c8_1 (5 sentences, 3 of the learner\'s own)', () => {
  const own = (n: number, assisted: number) => [...Array.from({ length: n }, (_, i) => ({ ja: `わたしは${i}です。`, assisted: false })), ...Array.from({ length: assisted }, (_, i) => ({ ja: `日本${i}です。`, assisted: true }))];
  it('raises letter_written with five sentences, three of them own; the sentences are stored either way', () => {
    expect(BALANCE.letter).toEqual({ sentences: 5, minOwn: 3 });
    const ok = step(inChapter(5), { t: 'letter_saved', sentences: own(3, 2) }).state;
    expect(ok.chapter.flags).toContain('letter_written');
    expect(ok.letter).toHaveLength(5);
    const fewOwn = step(inChapter(5), { t: 'letter_saved', sentences: own(2, 3) }).state;
    expect(fewOwn.chapter.flags).not.toContain('letter_written');
    expect(fewOwn.letter).toHaveLength(5);
    const short = step(inChapter(5), { t: 'letter_saved', sentences: own(4, 0) }).state;
    expect(short.chapter.flags).not.toContain('letter_written');
  });
  it('blank sentences do not count', () => {
    const s = step(inChapter(5), { t: 'letter_saved', sentences: [...own(3, 1), { ja: '  ', assisted: false }] }).state;
    expect(s.letter).toHaveLength(4);
    expect(s.chapter.flags).not.toContain('letter_written');
  });
});

describe('Real mode and the capstone\'s one-time Guided fallback', () => {
  const run = (s: GameState, mode: 'guided' | 'real', ind: number, ass: number, sessionId: string, scenarioId = SPEECH) =>
    step(s, { t: 'conversation_done', facts: facts1f({ scenarioId, characterId: 'hanako', sessionId, mode, ind, ass, done: 5, total: 5 }) }).state;

  it('a Real-mode conversation files real_used; Chapter 6\'s try (real_try_done) counts as having used Real mode', () => {
    const s = fresh1f(P);
    expect(realUsed(s)).toBe(false);
    expect(run(s, 'real', 3, 0, 'r1', 'konbini').chapter.flags).toContain(REAL_USED_FLAG);
    expect(realUsed({ ...s, chapter: { ...s.chapter, flags: ['real_try_done'] } })).toBe(true);
  });

  it('the fallback is open only to a player who never used Real mode, and only once', () => {
    const s = fresh1f(P);
    expect(guidedFallbackOpen(P, s, SPEECH)).toBe(true);
    expect(guidedFallbackOpen(P, s, 'konbini')).toBe(false);
    const used = run(s, 'guided', 1, 4, 'g1');
    expect(used.chapter.flags).toContain(guidedOnceFlag(SPEECH));
    expect(guidedFallbackOpen(P, used, SPEECH)).toBe(false);
    expect(guidedFallbackOpen(P, run(s, 'real', 2, 0, 'r1', 'konbini'), SPEECH)).toBe(false);
  });

  it('the fallback counts class-I lines plus half the class-S lines (rounded down) toward minIndependent', () => {
    const s = run(fresh1f(P), 'guided', 2, 5, 'g1');
    expect(s.runs[SPEECH]!.bestIndependent).toBe(2 + Math.floor(5 / 2));
  });

  it('any other Guided run of the capstone adds nothing to bestIndependent; a Real run counts its class-I lines', () => {
    const once = run(fresh1f(P), 'guided', 1, 2, 'g1');
    expect(once.runs[SPEECH]!.bestIndependent).toBe(2);
    const again = run(once, 'guided', 5, 0, 'g2');
    expect(again.runs[SPEECH]!.bestIndependent).toBe(2);
    const real = run(again, 'real', 5, 0, 'r1');
    expect(real.runs[SPEECH]!.bestIndependent).toBe(5);
    // a player who used Real mode before gets no fallback credit from a Guided run
    const veteran = run(run(fresh1f(P), 'real', 2, 0, 'r0', 'konbini'), 'guided', 4, 2, 'g3');
    expect(veteran.runs[SPEECH]!.bestIndependent).toBe(0);
  });

  it('an abandoned conversation files nothing', () => {
    const s = step(fresh1f(P), { t: 'conversation_done', facts: facts1f({ scenarioId: SPEECH, sessionId: 'a1', mode: 'real', abandoned: true, turns: [turn(0, 'I')] }) }).state;
    expect(s.chapter.flags).not.toContain(REAL_USED_FLAG);
  });
});
