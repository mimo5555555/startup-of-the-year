// Release 1 (docs/RELEASE_1.md): chapters 1-4, then Free Walk, with the Dream picker offering only dreams that can be finished.
// The generic machinery (GamePack.release, the release_* and dream_blocked checks) is proven over a fixture in packages/game/test/release.test.ts;
// this file proves the Japanese pack's DATA against it.
import { describe, expect, it } from 'vitest';
import { BALANCE, createGameState, evaluateAll, validatePack, type ChapterDef, type ContentIndex, type FriendDef, type GamePack, type GameView, type Pred, type ValidationIssue } from '@lw/game';
import { CHARACTERS, JP_PACK, LEXICON, SCENARIOS, SLOTS, tokenize } from '../src';
import { CHAPTERS, FREE_WALK, RELEASED_CHAPTERS, RELEASE_EPILOGUE, RELEASE_LAST_CHAPTER, releasedGate } from '../src/tokyo/game/chapters';
import { DREAMS, RELEASED_DREAMS } from '../src/tokyo/game/dreams';
import { BEATS } from '../src/tokyo/game/beats';

const NOW = new Date(2030, 0, 15, 12).getTime();
const VIEW: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
};
const hasAr = (s: string) => /[؀-ۿ]/.test(s);
const allNodes = (s: { nodes: Record<string, unknown> }) => Object.values(s.nodes) as Array<{ intents: Array<{ id: string }> }>;
const index = (): ContentIndex => ({
  scenarios: Object.fromEntries(SCENARIOS.map((s) => [s.id, { steps: s.steps.map((x) => x.id), intents: allNodes(s).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId }])),
  lexiconSurfaces: new Set(LEXICON.all().map((e) => e.s)),
  slots: Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
  characters: CHARACTERS.map((c) => c.id),
});
const walk = (p: Pred, fn: (q: Pred) => void): void => {
  fn(p);
  if (p.k === 'all' || p.k === 'any') p.of.forEach((q) => walk(q, fn));
};

/**
 * The pack as it validates once the friends (agent 4A) and the café/station jobs exist: until then the six friend ids are stood in by plain
 * rows so the chapters and dreams can be proven NOW against the real scenarios, the real catalog and the real shops.
 */
const STAND_IN = (id: string): FriendDef => ({ id, tier: 'A', register: 'polite', casualAt: 99, unlockChapter: 1, loves: [], likes: [], dislikes: [], facts: ['a', 'b', 'c'], perks: [] });
const FRIEND_IDS = ['mio', 'yuki', 'tanaka', 'kenji', 'sato', 'hanako'];
const provable = (): GamePack => ({ ...JP_PACK, friends: JP_PACK.friends.length > 0 ? JP_PACK.friends : FRIEND_IDS.map(STAND_IN) });
const errorsOf = (p: GamePack, level: 1 | 2 | 3 | 4 | 5): ValidationIssue[] => validatePack(p, { level, index: index() }).filter((i) => i.severity === 'error');

describe('the release cap in the pack', () => {
  it('JP_PACK.release caps the story at Chapter 4 with the epilogue as its closing beat', () => {
    expect(JP_PACK.release).toEqual({ lastChapter: 4, epilogue: RELEASE_EPILOGUE });
    expect(RELEASE_LAST_CHAPTER).toBe(4);
    expect(FREE_WALK).toBe(BALANCE.freeWalkChapter);
  });

  it('plays chapters 1 to 4 only, in order; the other four stay authored for the release that lifts the cap', () => {
    expect(JP_PACK.chapters.map((c) => c.n)).toEqual([1, 2, 3, 4]);
    expect(CHAPTERS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(RELEASED_CHAPTERS).toBe(JP_PACK.chapters);
  });

  it('Chapter 4 closes with the epilogue, and the first three chapters keep the closing beats of the design', () => {
    const close = (list: ChapterDef[]) => list.map((c) => c.beats.close);
    expect(JP_PACK.chapters[3]!.beats.close).toBe(RELEASE_EPILOGUE);
    expect(close(JP_PACK.chapters).slice(0, 3)).toEqual(close(CHAPTERS).slice(0, 3));
    // only the closing beat of the last chapter is replaced: the objectives, reward and opening beat are the design's
    expect({ ...JP_PACK.chapters[3]!, beats: CHAPTERS[3]!.beats }).toEqual(CHAPTERS[3]);
  });

  it('releasedGate sends the chapters that are never played to Free Walk and leaves the played ones alone', () => {
    expect([1, 2, 3, 4].map(releasedGate)).toEqual([1, 2, 3, 4]);
    expect([5, 6, 7, 8].map(releasedGate)).toEqual([9, 9, 9, 9]);
    expect(releasedGate(9)).toBe(9);
  });

  it('no gate of the pack names a chapter between the cap and Free Walk', () => {
    const gates = [
      ...JP_PACK.items.map((i) => ['item ' + i.id, i.gate.ch] as const),
      ...JP_PACK.shops.map((s) => ['shop ' + s.id, s.openChapter] as const),
      ...JP_PACK.dreams.map((d) => ['dream ' + d.id, d.openChapter ?? 1] as const),
      ...JP_PACK.dreams.flatMap((d) => d.steps.map((s) => [`step ${s.id}`, s.gate] as const)),
      ...JP_PACK.friends.map((f) => ['friend ' + f.id, f.unlockChapter] as const),
    ];
    expect(gates.filter(([, ch]) => ch > 4 && ch < 9).map(([w, ch]) => `${w}: ${ch}`)).toEqual([]);
  });
});

describe('the epilogue beat (Hanako: "to be continued")', () => {
  const beat = BEATS[RELEASE_EPILOGUE]!;

  it('exists, is Hanako at the school, and is short', () => {
    expect(beat).toBeTruthy();
    expect(beat.id).toBe(RELEASE_EPILOGUE);
    expect(beat.lines.length).toBeGreaterThanOrEqual(3);
    expect(beat.lines.length).toBeLessThanOrEqual(5);
    expect(new Set(beat.lines.map((l) => l.who))).toEqual(new Set(['hanako']));
    expect(beat.place).toBe('school');
  });

  it('every line has Japanese, English and Arabic, with the same placeholders, and its words are in the lexicon', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const [i, l] of beat.lines.entries()) {
      const where = `${RELEASE_EPILOGUE}[${i}]`;
      expect(l.line.ja.trim(), where).not.toBe('');
      expect(l.line.en.trim(), where).not.toBe('');
      expect(hasAr(l.line.ar), where).toBe(true);
      expect(ph(l.line.en), where).toBe(ph(l.line.ja));
      expect(ph(l.line.ar), where).toBe(ph(l.line.ja));
      expect(tokenize(l.line.ja, LEXICON, { name: { ja: 'ミオ', raw: true } }).missing, where).toEqual([]);
    }
  });

  it('promises more to come and never a feature this release does not have (no festival, flat or letter)', () => {
    const ja = beat.lines.map((l) => tokenize(l.line.ja, LEXICON, { name: { ja: '', raw: true } }).tokens.map((t) => t.s).join('')).join('');
    expect(ja).toContain('これから');
    for (const word of ['祭', '手紙', '部屋', '車']) expect(ja, word).not.toContain(word);
    const en = beat.lines.map((l) => l.line.en).join(' ').toLowerCase();
    for (const word of ['festival', 'letter', 'flat']) expect(en, word).not.toContain(word);
  });

  it('is the only closing beat that is replaced, and has no effect that could dead-end (it adds nothing to wait for)', () => {
    expect(beat.ask).toBeUndefined();
    expect(beat.effects ?? []).toEqual([]);
  });
});

describe('the Dream picker offers only dreams that can be finished', () => {
  it('phone_pal, bike and car: the dreams of the released content, in the design\'s order', () => {
    expect(JP_PACK.dreams.map((d) => d.id)).toEqual(['phone_pal', 'bike', 'car']);
    expect(RELEASED_DREAMS).toBe(JP_PACK.dreams);
    // the others stay authored (flat, festival, travel, fresh_start need the flat, the festival and Hikarigaoka)
    expect(DREAMS.map((d) => d.id)).toEqual(['phone_pal', 'bike', 'flat', 'festival', 'travel', 'fresh_start', 'car']);
  });

  it('the car dream opens at Free Walk and is for adults; the others are for everyone and open from the start', () => {
    const d = (id: string) => JP_PACK.dreams.find((x) => x.id === id)!;
    expect(d('car')).toMatchObject({ openChapter: 9, ageMin: 18 });
    expect(d('phone_pal').ageMin).toBeUndefined();
    expect(d('bike').ageMin).toBeUndefined();
  });

  it('each onboarding goal has a released dream to suggest, and a child never gets the car', () => {
    const suggestFor = (goal: string) => JP_PACK.dreams.find((d) => d.defaultFor?.includes(goal))?.id;
    for (const goal of ['work', 'casual', 'relocation', 'travel']) expect(suggestFor(goal), goal).toBeTruthy();
    expect(JP_PACK.dreams.find((d) => d.id === 'car')!.defaultFor ?? []).toEqual([]);
  });

  it('every step is visible in a played chapter or at Free Walk, and every step has EN and AR text', () => {
    for (const d of JP_PACK.dreams) {
      expect(d.steps.length, d.id).toBeGreaterThanOrEqual(3);
      for (const s of d.steps) {
        expect([1, 2, 3, 4, 9], `${d.id}/${s.id}`).toContain(s.gate);
        expect(s.text.en.trim(), s.id).not.toBe('');
        expect(hasAr(s.text.ar), s.id).toBe(true);
      }
    }
  });

  it('the car steps ask only for things this release has: the dealer\'s total question, cash or the car, the east end of the street', () => {
    const car = JP_PACK.dreams.find((d) => d.id === 'car')!;
    const preds: Pred[] = [];
    for (const s of car.steps) walk(s.pred, (p) => preds.push(p));
    expect(preds.filter((p) => p.k === 'hearts' || p.k === 'flag')).toEqual([]);
    expect(preds).toContainEqual({ k: 'said', scenario: 'motors_car', intent: 'ask_total' });
    expect(preds).toContainEqual({ k: 'own', category: 'car' });
  });

  it('the items of each dream are sold in this release', () => {
    for (const d of JP_PACK.dreams) for (const id of d.items) expect(JP_PACK.items.some((i) => i.id === id), `${d.id}: ${id}`).toBe(true);
  });
});

describe('the level-4 proof: every released objective and every offered dream can be finished', () => {
  it('the bot finishes Chapters 1 to 4 and every dream is finishable (no bot_*, dream_blocked, release_* or catalog issue)', () => {
    // (the interaction rows of the café and station shifts name jobs that are deferred; they stay hidden until those jobs register)
    const issues = errorsOf(provable(), 4).filter((i) => /^(bot_|dream_blocked|release_|prereq_)/.test(i.code) || /^(no_sale_route|not_sold|item_shop|shop_after_item|itemmap_|meta_shop|gate_range)/.test(i.code));
    expect(issues.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
  });

  it('the proof bites: take the phone out of the shop and Chapter 4 can no longer be finished', () => {
    const p = provable();
    const noPhone: GamePack = { ...p, scenarioMeta: p.scenarioMeta.map((m) => (m.id === 'denki_phone' ? { ...m, shop: { ...m.shop!, itemMap: { ...m.shop!.itemMap, used: 'phone_case' } } } : m)) };
    const codes = errorsOf(noPhone, 4).map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(['no_sale_route']));
    expect(codes.some((c) => c === 'bot_unreachable' || c === 'dream_blocked')).toBe(true);
  });

  it('with the friends of the pack nothing is left at level 4 but the interaction rows of the deferred café and station shifts (this goes live when agent 4A lands the friends)', () => {
    if (JP_PACK.friends.length === 0) return;
    const rest = errorsOf(JP_PACK, 4).filter((i) => !(i.code === 'interaction_ref' && /job_(cafe|station)/.test(i.message)));
    expect(rest.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
  });

  it('what the pack still reports without friends is only about friends and the deferred shifts, never about the catalog, the cap or the dreams', () => {
    if (JP_PACK.friends.length > 0) return;
    const pending = ['meta_friend', 'job', 'interaction_ref', 'prereq_unknown', 'bot_unreachable', 'bot_blocked', 'dream_blocked'];
    const bad = errorsOf(JP_PACK, 4).filter((i) => !pending.includes(i.code) || (i.code === 'dream_blocked' && !/friend/.test(i.message)));
    expect(bad.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
  });

  it('the garage and the cars are proven open at Free Walk and closed before it, by the same rule the shops use', () => {
    const motors = JP_PACK.shops.find((s) => s.id === 'motors')!;
    expect(motors.openChapter).toBe(FREE_WALK);
    expect(JP_PACK.shops.find((s) => s.id === 'denki')!.openChapter).toBe(4);
    for (const id of ['bike_mamachari', 'bike_helmet', 'ebike', 'car_kei_used', 'car_kei_good', 'g_carfresh', 'phone_pro', 'tv_small']) {
      expect(JP_PACK.items.find((i) => i.id === id)!.gate.ch, id).toBe(FREE_WALK);
    }
  });
});

describe('finishing Chapter 4 over the real pack', () => {
  it('pays Chapter 4\'s ¥4,000, plays the epilogue and starts Free Walk with the garage open', () => {
    const p = provable();
    const s0 = createGameState(p, NOW);
    const chapter4 = p.chapters[3]!;
    const done = Object.fromEntries(chapter4.objectives.filter((o) => !o.dream).map((o) => [o.id, 'd5']));
    const s: typeof s0 = { ...s0, clock: { ...s0.clock, dayIndex: 12, activeDays: 12 }, chapter: { ...s0.chapter, n: 4, done, completed: [1, 2, 3], began: { dayIndex: 5, activeDays: 5 } } };
    const r = evaluateAll(s, { pack: p, view: VIEW, now: NOW, rng: () => 0.5 });
    expect(r.state.chapter.n).toBe(FREE_WALK);
    expect(r.state.chapter.completed).toContain(4);
    expect(r.state.wallet.cash - s.wallet.cash).toBe(4_000);
    expect(r.effects).toContainEqual({ t: 'beat', id: RELEASE_EPILOGUE });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'shop', id: 'motors' });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'item', id: 'car_kei_used' });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'dream', id: 'car' });
    // Free Walk: nothing left to finish and nothing re-announced
    expect(evaluateAll(r.state, { pack: p, view: VIEW, now: NOW, rng: () => 0.5 }).derived).toEqual([]);
  });
});
