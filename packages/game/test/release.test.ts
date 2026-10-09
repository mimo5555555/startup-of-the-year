// The release cap (docs/RELEASE_1.md): a pack that plays only its first chapters and then Free Walk. The generic support in @lw/game is
// small (`GamePack.release`, the Free Walk shop unlock, the `release_*` and `dream_blocked` checks of validatePack); these tests drive it
// over the synthetic quest pack so they do not depend on the Japanese content.
import { describe, expect, it } from 'vitest';
import { evaluateAll, chapterStatus } from '../src/objectives';
import { migrate } from '../src/persist';
import { validatePack, validateState, dreamBlockers } from '../src/validate';
import { BALANCE, CHAPTERS, ctxOf, DREAMS, ITEMS, mkQuestPack, mkState, mkView, SCENARIOS, SHOPS, withDone } from './fixtures-quest';
import type { DreamDef, GamePack, ScenarioMeta } from '../src/types';

const EPILOGUE = 'b_epilogue';
const FW = BALANCE.freeWalkChapter;
const meta = (id: string, extra: Partial<ScenarioMeta> = {}): ScenarioMeta => ({ id, kind: 'talk', band: 'A1', register: 'polite', pay: 'full', ...extra });

/** The released dreams of the fixture: the ones whose ladders only need what the fixture really has. */
const dream = (id: string): DreamDef => DREAMS.find((d) => d.id === id) as DreamDef;

/** The quest fixture capped at Chapter 4: motors and the unplayed gates move to Free Walk, the car has a sale route, Chapter 4 closes with the epilogue. */
function capped(over: Partial<GamePack> = {}): GamePack {
  return mkQuestPack({
    chapters: CHAPTERS.filter((c) => c.n <= 4).map((c) => (c.n === 4 ? { ...c, beats: { ...c.beats, close: EPILOGUE } } : c)),
    beats: { [EPILOGUE]: { id: EPILOGUE, place: 'school', lines: [{ who: 'hanako', line: { ja: 'また|ね', en: 'See you!', ar: 'إلى اللقاء' } }] } },
    shops: SHOPS.map((s) => (s.id === 'motors' ? { ...s, openChapter: FW } : s)),
    items: ITEMS.map((i) => (i.gate.ch > 4 && i.gate.ch < FW ? { ...i, gate: { ...i.gate, ch: FW } } : i)),
    scenarioMeta: [...SCENARIOS, meta('motors_car', { kind: 'shop', shop: { shopId: 'motors', payStep: 'pay', itemMap: { used: 'car_kei_used' } } })],
    dreams: [dream('travel'), dream('car')].map((d) => ({ ...d, steps: d.steps.map((s) => (s.gate > 4 && s.gate < FW ? { ...s, gate: FW } : s)) })),
    release: { lastChapter: 4, epilogue: EPILOGUE },
    ...over,
  });
}

const codes = (p: GamePack, level: 1 | 2 | 3 | 4 | 5 = 4): string[] => validatePack(p, { level }).map((i) => i.code);
const release = (p: GamePack, level: 1 | 2 | 3 | 4 | 5 = 4) => validatePack(p, { level }).filter((i) => i.code.startsWith('release_') || i.code === 'dream_blocked');

describe('a capped pack passes the release checks', () => {
  it('the fixture cut at Chapter 4 has no release issue and nothing else the cap could have broken', () => {
    expect(release(capped())).toEqual([]);
    expect(codes(capped())).not.toContain('release_cap');
  });

  it('a pack without `release` is not checked for a cap (the full eight-chapter design stays valid)', () => {
    expect(release(mkQuestPack())).toEqual([]);
  });
});

describe('the cap itself (level 2)', () => {
  it('lastChapter must equal the last chapter the pack holds', () => {
    expect(codes(capped({ release: { lastChapter: 3, epilogue: EPILOGUE } }), 2)).toContain('release_cap');
    expect(codes(capped({ release: { lastChapter: 5, epilogue: EPILOGUE } }), 2)).toContain('release_cap');
    // chapters above the cap in the pack are chapters that would be played
    expect(codes(capped({ chapters: CHAPTERS }), 2)).toContain('release_cap');
  });

  it('lastChapter is a chapter from 1 to 7: Free Walk follows, and 8 would leave no chapter for the epilogue handover', () => {
    for (const lastChapter of [0, 8, 9, 2.5]) expect(codes(capped({ release: { lastChapter, epilogue: EPILOGUE } }), 2), String(lastChapter)).toContain('release_cap');
  });

  it('the last chapter must close with the epilogue beat, and that beat must exist and say something', () => {
    expect(codes(capped({ release: { lastChapter: 4, epilogue: 'b_other' } }), 2)).toContain('release_epilogue');
    expect(codes(capped({ beats: { [EPILOGUE]: { id: EPILOGUE, lines: [] } } }), 2)).toContain('release_epilogue');
    expect(codes(capped({ release: { lastChapter: 4, epilogue: '' } }), 2)).toContain('release_epilogue');
  });
});

describe('gates on a chapter that is never played (level 3)', () => {
  it('an item, a shop or a dream step gated between the cap and Free Walk is reported, with the fix in the message', () => {
    const p = capped();
    const badItem = capped({ items: p.items.map((i) => (i.id === 'phone_pro' ? { ...i, gate: { ch: 6 } } : i)) });
    expect(validatePack(badItem, { level: 3 }).find((i) => i.code === 'release_gate')?.message).toMatch(/phone_pro.*Free Walk/);
    const badShop = capped({ shops: p.shops.map((s) => (s.id === 'motors' ? { ...s, openChapter: 5 } : s)) });
    expect(validatePack(badShop, { level: 3 }).filter((i) => i.code === 'release_gate').map((i) => i.path)).toEqual(['shops[6].openChapter']);
    const badStep = capped({ dreams: p.dreams.map((d) => (d.id === 'car' ? { ...d, steps: d.steps.map((s, i) => (i === 0 ? { ...s, gate: 7 } : s)) } : d)) });
    expect(validatePack(badStep, { level: 3 }).some((i) => i.code === 'release_gate' && i.path.includes('steps[0]'))).toBe(true);
    const badOpen = capped({ dreams: p.dreams.map((d) => (d.id === 'car' ? { ...d, openChapter: 6 } : d)) });
    expect(validatePack(badOpen, { level: 3 }).some((i) => i.code === 'release_gate' && i.path.endsWith('openChapter'))).toBe(true);
  });

  it('chapters 1-4 and Free Walk are fine, and the design pack is not affected without `release`', () => {
    const p = capped();
    expect(p.items.every((i) => i.gate.ch <= 4 || i.gate.ch === FW)).toBe(true);
    expect(validatePack(capped(), { level: 3 }).filter((i) => i.code === 'release_gate')).toEqual([]);
    expect(codes(mkQuestPack(), 3)).not.toContain('release_gate');
  });
});

describe('every offered dream is finishable (level 4)', () => {
  it('the released dreams of the fixture are', () => {
    for (const d of capped().dreams) expect(dreamBlockers(capped(), d), d.id).toEqual([]);
  });

  it('an item that no scenario sells blocks the dream that needs it', () => {
    const p = capped({ scenarioMeta: SCENARIOS });
    expect(dreamBlockers(p, dream('car')).join('|')).toMatch(/car_kei_used is sold nowhere/);
    expect(validatePack(capped({ scenarioMeta: SCENARIOS }), { level: 4 }).some((i) => i.code === 'dream_blocked')).toBe(true);
  });

  it('a friend nobody can talk to blocks a hearts step; a registered conversation unblocks it', () => {
    const phone = dream('phone_pal');
    const p = capped({ dreams: [phone] });
    expect(dreamBlockers(p, phone).join('|')).toMatch(/tanaka/);
    const withTanaka = capped({ dreams: [phone], scenarioMeta: [...SCENARIOS, meta('smalltalk_tanaka', { friendId: 'tanaka' })] });
    expect(dreamBlockers(withTanaka, phone).join('|')).not.toMatch(/tanaka/);
  });

  it('a flag that nothing raises, a trip nobody registered and a flat nobody sells block; an alternative (`any`) can rescue a step', () => {
    const one = (pred: DreamDef['steps'][number]['pred']): DreamDef => ({ ...dream('travel'), id: 'probe', steps: [{ id: 'probe_1', gate: FW, pred, text: { en: 'x', ar: 'x' } }] });
    const p = capped();
    expect(dreamBlockers(p, one({ k: 'flag', id: 'first_drive' })).join('|')).toMatch(/first_drive/);
    expect(dreamBlockers(p, one({ k: 'flag', id: 'ticket_bought' }))).toEqual([]);
    expect(dreamBlockers(p, one({ k: 'visit', place: 'trip:nowhere' })).join('|')).toMatch(/trip/);
    expect(dreamBlockers(p, one({ k: 'item_placed', n: 3 })).join('|')).toMatch(/flat/);
    expect(dreamBlockers(p, one({ k: 'any', of: [{ k: 'flag', id: 'first_drive' }, { k: 'own', category: 'car' }] }))).toEqual([]);
    expect(dreamBlockers(p, one({ k: 'any', of: [{ k: 'flag', id: 'first_drive' }, { k: 'flag', id: 'housewarming' }] })).join('|')).toMatch(/no alternative/);
  });
});

describe('completing the last released chapter starts Free Walk', () => {
  const finished = () => withDone(mkState({ chapter: 4, activeDays: 20, dayIndex: 30, began: { dayIndex: 25, activeDays: 12 } }), 4);

  it('pays the reward, plays the epilogue (not the designed closing beat) and makes chapter.n = 9 current', () => {
    const p = capped();
    const r = evaluateAll(finished(), ctxOf(p, mkView()));
    expect(r.state.chapter.n).toBe(FW);
    expect(r.state.chapter.completed).toContain(4);
    expect(r.derived).toContainEqual({ t: 'chapter_done', n: 4 });
    expect(r.derived).toContainEqual({ t: 'chapter_started', n: FW });
    expect(r.effects).toContainEqual({ t: 'beat', id: EPILOGUE });
    expect(r.effects).not.toContainEqual({ t: 'beat', id: 'b_ch4_close' });
    expect(r.state.wallet.cash).toBe(finished().wallet.cash + (CHAPTERS.find((c) => c.n === 4) as { reward: number }).reward);
  });

  it('opens the shops and the items gated on Free Walk: the garage, the car and the car dream', () => {
    const r = evaluateAll(finished(), ctxOf(capped(), mkView()));
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'shop', id: 'motors' });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'item', id: 'car_kei_used' });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'item', id: 'bike_mamachari' });
    // shops that were already open are not announced again
    expect(r.derived).not.toContainEqual({ t: 'unlocked', what: 'shop', id: 'denki' });
  });

  it('Free Walk has no chapter left to finish: a second evaluation changes nothing, and the status is Free Walk', () => {
    const p = capped();
    const r = evaluateAll(finished(), ctxOf(p, mkView()));
    expect(evaluateAll(r.state, ctxOf(p, mkView())).derived).toEqual([]);
    expect(chapterStatus(p, r.state, mkView())).toEqual({ n: FW, done: 0, total: 0, waitDays: 0, gated: false });
  });

  it('the epilogue plays once: a replay of the completion repeats nothing for the wallet', () => {
    const p = capped();
    const once = evaluateAll(finished(), ctxOf(p, mkView())).state;
    const replay = evaluateAll({ ...once, chapter: { ...once.chapter, n: 4, completed: [] } }, ctxOf(p, mkView())).state;
    expect(replay.wallet.cash).toBe(once.wallet.cash);
  });

  it('the fixture without a cap still goes on to its own Chapter 5 (the cap is data, not a rule)', () => {
    const full = mkQuestPack({ chapters: CHAPTERS.filter((c) => c.n <= 5 && c.n !== 5) });
    // with chapter 5 removed the pack is capped at 4 in effect: Free Walk follows even without a `release` row
    const r = evaluateAll(finished(), ctxOf(full, mkView()));
    expect(r.state.chapter.n).toBe(FW);
  });
});

describe('saves under a cap', () => {
  it('a state that was in a chapter this release does not play lands in Free Walk instead of a chapter that does not exist', () => {
    const p = capped();
    const old = { ...mkState({ chapter: 5 }) };
    const m = migrate(JSON.parse(JSON.stringify(old)), 1, p);
    expect(m.chapter.n).toBe(FW);
    expect(validateState(m, p).filter((e) => e.path === 'chapter.n')).toEqual([]);
  });

  it('validateState rejects a current chapter between the cap and Free Walk', () => {
    const p = capped();
    expect(validateState(mkState({ chapter: 5 }), p).some((e) => e.path === 'chapter.n')).toBe(true);
    expect(validateState(mkState({ chapter: 4 }), p).some((e) => e.path === 'chapter.n')).toBe(false);
    expect(validateState(mkState({ chapter: FW }), p).some((e) => e.path === 'chapter.n')).toBe(false);
  });
});
