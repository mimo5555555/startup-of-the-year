// The release cap (docs/RELEASE_1.md; Release 2 wave C1 moved it from Chapter 4 to Chapter 6, wave C2 to Chapter 8: the whole story): chapters 1-8, then Free
// Walk, with the Dream picker offering only dreams that can be finished.
// The generic machinery (GamePack.release, the release_* and dream_blocked checks) is proven over a fixture in packages/game/test/release.test.ts;
// this file proves the Japanese pack's DATA against it.
import { describe, expect, it } from 'vitest';
import { BALANCE, createGameState, evaluateAll, validatePack, type ChapterDef, type ContentIndex, type FriendDef, type GamePack, type GameView, type Pred, type ValidationIssue } from '@lw/game';
import { CHARACTERS, JP_PACK, LEXICON, SCENARIOS, SLOTS, tokenize } from '../src';
import { CHAPTERS, FREE_WALK, RELEASED_CHAPTERS, RELEASE_ENDING, RELEASE_EPILOGUE, RELEASE_LAST_CHAPTER, releasedGate } from '../src/tokyo/game/chapters';
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
  it('JP_PACK.release plays the whole story: Chapter 8 is the last chapter and its own closing beat is the ending (wave C2)', () => {
    expect(JP_PACK.release).toEqual({ lastChapter: 8, epilogue: RELEASE_ENDING });
    expect(RELEASE_ENDING).toBe('b_ch8_close');
    expect(RELEASE_LAST_CHAPTER).toBe(8);
    expect(FREE_WALK).toBe(BALANCE.freeWalkChapter);
  });

  it('plays chapters 1 to 8, in order: the festival and the Letter Home are played', () => {
    expect(JP_PACK.chapters.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(CHAPTERS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(RELEASED_CHAPTERS).toBe(JP_PACK.chapters);
  });

  it('every chapter keeps the design\'s own beats: nothing is replaced by the epilogue any more', () => {
    const close = (list: ChapterDef[]) => list.map((c) => c.beats.close);
    expect(close(JP_PACK.chapters)).toEqual(close(CHAPTERS));
    expect(close(JP_PACK.chapters)).not.toContain(RELEASE_EPILOGUE);
    expect(JP_PACK.chapters).toEqual(CHAPTERS);
  });

  it('releasedGate is the identity now that every chapter is played', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(releasedGate)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('no gate of the pack names a chapter between the cap and Free Walk', () => {
    const gates = [
      ...JP_PACK.items.map((i) => ['item ' + i.id, i.gate.ch] as const),
      ...JP_PACK.shops.map((s) => ['shop ' + s.id, s.openChapter] as const),
      ...JP_PACK.dreams.map((d) => ['dream ' + d.id, d.openChapter ?? 1] as const),
      ...JP_PACK.dreams.flatMap((d) => d.steps.map((s) => [`step ${s.id}`, s.gate] as const)),
      ...JP_PACK.friends.map((f) => ['friend ' + f.id, f.unlockChapter] as const),
    ];
    expect(gates.filter(([, ch]) => ch > RELEASE_LAST_CHAPTER && ch < 9).map(([w, ch]) => `${w}: ${ch}`)).toEqual([]);
  });
});

// the "to be continued" closed the capped releases (1-4, 1-6); it stays authored for a lower cap and for the saves that played it
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
    // (電車, the train they rode, is the one 車 the epilogue may have; a car is for Free Walk)
    for (const word of ['祭', '手紙', '部屋', '車']) expect(ja.replace(/電車/g, ''), word).not.toContain(word);
    const en = beat.lines.map((l) => l.line.en).join(' ').toLowerCase();
    for (const word of ['festival', 'letter', 'flat']) expect(en, word).not.toContain(word);
  });

  it('has no effect that could dead-end (it adds nothing to wait for)', () => {
    expect(beat.ask).toBeUndefined();
    expect(beat.effects ?? []).toEqual([]);
  });
});

describe('the Dream picker offers only dreams that can be finished', () => {
  it('all seven dreams of the design, in its order (wave B2 adds the flat ones, wave C1 travel, wave C2 the festival)', () => {
    expect(JP_PACK.dreams.map((d) => d.id)).toEqual(['phone_pal', 'bike', 'flat', 'festival', 'travel', 'fresh_start', 'car']);
    expect(RELEASED_DREAMS).toBe(JP_PACK.dreams);
    expect(DREAMS.map((d) => d.id)).toEqual(JP_PACK.dreams.map((d) => d.id));
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
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9], `${d.id}/${s.id}`).toContain(s.gate);
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
  it('the bot finishes Chapters 1 to 6 and every dream is finishable (no bot_*, dream_blocked, release_* or catalog issue)', () => {
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

  it('no objective text or hint of a released chapter points at something the release does not build (the flat; Fuku-Fuku and the tea house are built in Release 2 wave A)', () => {
    const words = /\bflat\b|الشقة|furniture|أثاث/i;
    for (const c of RELEASED_CHAPTERS) for (const ob of c.objectives) for (const g of [ob.text, ob.hint].filter(Boolean)) expect(`${g!.en} ${g!.ar}`, `${c.n}/${ob.id}`).not.toMatch(words);
  });

  it('every played chapter has a story scene to open it and one to close it (Chapters 3 and 4 used to start in silence), with EN and AR', () => {
    for (const c of RELEASED_CHAPTERS) {
      for (const id of [c.beats.open, c.beats.close]) {
        const b = JP_PACK.beats[id];
        expect(b, `${c.n}: ${id}`).toBeDefined();
        expect(b!.lines.length, id).toBeGreaterThan(0);
        for (const l of b!.lines) expect(l.line.en.trim() && hasAr(l.line.ar), id).toBeTruthy();
      }
    }
  });

  it('c2_4 (say two culture phrases) tells the player where to say a phrase (the stamp book), in both languages', () => {
    const c24 = RELEASED_CHAPTERS[1]!.objectives.find((o) => o.id === 'c2_4')!;
    expect(c24.hint?.en).toMatch(/stamp book/);
    expect(c24.hint?.en).toMatch(/Say it/);
    expect(hasAr(c24.hint?.ar ?? '')).toBe(true);
  });

  it('the pack validates green at level 4, and the café and station shift rows are in the table now that their jobs are (wave C1)', () => {
    expect(errorsOf(JP_PACK, 4).map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
    const rows = Object.values(JP_PACK.interactions).flat();
    for (const id of ['tanaka_shift', 'yuki_shift', 'sato_shift']) expect(rows.some((r) => r.id === id), id).toBe(true);
    for (const r of rows.filter((x) => x.kind === 'shift')) expect(JP_PACK.jobs.some((j) => j.id === r.jobId), r.id).toBe(true);
  });

  it('what the pack still reports without friends is only about friends and the deferred shifts, never about the catalog, the cap or the dreams', () => {
    if (JP_PACK.friends.length > 0) return;
    const pending = ['meta_friend', 'job', 'interaction_ref', 'prereq_unknown', 'bot_unreachable', 'bot_blocked', 'dream_blocked'];
    const bad = errorsOf(JP_PACK, 4).filter((i) => !pending.includes(i.code) || (i.code === 'dream_blocked' && !/friend/.test(i.message)));
    expect(bad.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
  });

  it('the garage opens with Chapter 5 as designed (bikes and helmet), the e-bike and the flagship phone with Chapter 7, the cars at Free Walk', () => {
    const motors = JP_PACK.shops.find((s) => s.id === 'motors')!;
    expect(motors.openChapter).toBe(5);
    expect(JP_PACK.shops.find((s) => s.id === 'denki')!.openChapter).toBe(4);
    for (const id of ['bike_mamachari', 'bike_helmet', 'g_carfresh']) expect(JP_PACK.items.find((i) => i.id === id)!.gate.ch, id).toBe(5);
    for (const id of ['ebike', 'phone_pro']) expect(JP_PACK.items.find((i) => i.id === id)!.gate.ch, id).toBe(7);
    for (const id of ['car_kei_used', 'car_kei_good']) expect(JP_PACK.items.find((i) => i.id === id)!.gate.ch, id).toBe(FREE_WALK);
    expect(JP_PACK.items.find((i) => i.id === 'tv_small')!.gate.ch).toBe(6);
    // Chapter 5 opens the garage and nothing else announces it a second time; Free Walk announces the e-bike and the cars, not the garage again
    expect(RELEASED_CHAPTERS[4]!.opens).toEqual(expect.arrayContaining([{ kind: 'shop', id: 'motors' }, { kind: 'place', id: 'motors' }]));
  });
});

describe('finishing Chapters 5, 6 and 8 over the real pack', () => {
  const finish = (n: number, completed: number[], extra: Partial<ReturnType<typeof createGameState>> = {}) => {
    const p = provable();
    const s0 = createGameState(p, NOW);
    const def = p.chapters[n - 1]!;
    const done = Object.fromEntries(def.objectives.filter((o) => !o.dream).map((o) => [o.id, 'd5']));
    const s: typeof s0 = { ...s0, clock: { ...s0.clock, dayIndex: 30, activeDays: 30 }, chapter: { ...s0.chapter, n, done, completed, began: { dayIndex: 5, activeDays: 5 } }, ...extra };
    return { p, s, r: evaluateAll(s, { pack: p, view: VIEW, now: NOW, rng: () => 0.5 }) };
  };

  it('Chapter 6 pays ¥6,000, plays Aiko\'s closing and continues into Chapter 7 (the festival) with the e-bike and the flagship phone open', () => {
    const { s, r } = finish(6, [1, 2, 3, 4, 5]);
    expect(r.state.chapter.n).toBe(7);
    expect(r.state.chapter.completed).toContain(6);
    expect(r.state.wallet.cash - s.wallet.cash).toBe(6_000);
    expect(r.state.titles).toContain('t_guest');
    for (const id of ['cc_shoesoff', 'cc_rent', 'cc_trash']) expect(r.state.culture[id], id).toBeDefined();
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch6_close' });
    expect(r.effects).not.toContainEqual({ t: 'beat', id: RELEASE_EPILOGUE });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'item', id: 'ebike' });
    expect(r.derived).not.toContainEqual({ t: 'unlocked', what: 'item', id: 'car_kei_used' });
  });

  it('Chapter 8 pays ¥10,000 and the last title, plays the real ending (Hanako reads the Letter) and starts Free Walk with the cars and the car dream open', () => {
    const { p, s, r } = finish(8, [1, 2, 3, 4, 5, 6, 7]);
    expect(r.state.chapter.n).toBe(FREE_WALK);
    expect(r.state.chapter.completed).toContain(8);
    expect(r.state.wallet.cash - s.wallet.cash).toBe(10_000);
    expect(r.state.titles).toContain('t_lives_in_ja');
    expect(r.effects).toContainEqual({ t: 'beat', id: RELEASE_ENDING });
    // the garage opened with Chapter 5, so Free Walk only announces what is still closed: the cars and the car dream
    expect(r.derived).not.toContainEqual({ t: 'unlocked', what: 'shop', id: 'motors' });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'item', id: 'car_kei_used' });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'dream', id: 'car' });
    // Free Walk: nothing left to finish and nothing re-announced
    expect(evaluateAll(r.state, { pack: p, view: VIEW, now: NOW, rng: () => 0.5 }).derived).toEqual([]);
  });

  it('Chapter 5 pays ¥5,000, the Traveller title and its four culture cards, and Chapter 6 then waits for a friend at three hearts (its start gate)', () => {
    const { s, r } = finish(5, [1, 2, 3, 4]);
    expect(r.state.wallet.cash - s.wallet.cash).toBe(5_000);
    expect(r.state.titles).toContain('t_traveller');
    for (const id of ['cc_ic', 'cc_trainmanner', 'cc_ticketmachine', 'cc_refuse']) expect(r.state.culture[id], id).toBeDefined();
    // nobody is at three hearts: Chapter 5 is done, Chapter 6 has not begun
    expect(r.state.chapter.completed).toContain(5);
    expect(r.state.chapter.n).toBe(5);
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch5_close' });
  });
});
