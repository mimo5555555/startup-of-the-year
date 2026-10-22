// Release 2 wave C2 (docs/RELEASE_2.md): Chapters 7 and 8 become playable and the story is complete. Over the real pack: the chapter table of
// §7.2, the release cap at 8 with the real ending, old saves, Chapter 6's two closings, the festival day rule and its guests, the beats and the
// diary, the Letter Home's frames (from remembered facts, with fallbacks), the speech rehearsal, cc_matsuri, the festival stalls and the dreams.
// The two festival conversations are played in packages/engine/test/c2-matsuri.test.ts; the generic rules in packages/game/test/c2-game.test.ts.
import { describe, expect, it } from 'vitest';
import { BALANCE, createGameState, dreamBlockers, evaluateAll, migrate, reduce, validatePack, type GameState, type GameView, type Line } from '@lw/game';
import {
  DIARY_FEELINGS,
  DIARY_PROMPTS,
  FESTIVAL,
  FESTIVAL_ROWS,
  JP_PACK,
  LETTER_DREAMS,
  LETTER_FRAMES,
  LETTER_HANAKO,
  LETTER_HEADER,
  LETTER_PREVIEW_LINE,
  LETTER_RULE,
  LETTER_SIGN,
  LEXICON,
  MATSURI_PRICES,
  SPEECH_LINES,
  diaryLine,
  diaryPrompt,
  festivalGuests,
  festivalOpen,
  festivalReturned,
  isSaturday,
  letterAssisted,
  letterComplete,
  letterFacts,
  letterFrames,
  letterLineOk,
  speechRehearsal,
  speechText,
  tokenize,
} from '../src';
import { CHAPTERS, FREE_WALK, RELEASE_ENDING } from '../src/tokyo/game/chapters';
import { BEATS } from '../src/tokyo/game/beats';
import { CULTURE } from '../src/tokyo/game/culture';

const NOW = new Date(2030, 0, 15, 12).getTime();
const VIEW: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
};
const ctx = { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 };
const hasAr = (s: string) => /[؀-ۿ]/.test(s);
const ch = (n: number) => JP_PACK.chapters.find((c) => c.n === n)!;
const bare = (ja: string) => ja.replace(/\|/g, '');
/** Every token of a line is a lexicon word (or punctuation, or a filled-in fact), and it has English and Arabic. */
const noGap = (line: Line, where: string) => {
  const t = tokenize(line.ja.replace(/\{\w+\}/g, ''), LEXICON);
  expect(t.missing ?? [], `${where}: unknown words`).toEqual([]);
  expect(t.tokens.filter((x) => !x.punct && !x.raw && !x.gloss).map((x) => x.s), `${where}: tokens without a gloss`).toEqual([]);
  expect(line.en.trim() && hasAr(line.ar), `${where}: EN + AR`).toBeTruthy();
};
const fresh = (): GameState => createGameState(JP_PACK, NOW);
/** A save in chapter `n` with chapters 1..n-1 done and every objective of `n` met (minDays and the day rule satisfied). */
const finish = (n: number, extra: Partial<GameState> = {}) => {
  const s0 = fresh();
  const def = ch(n);
  const done = Object.fromEntries(def.objectives.filter((o) => !o.dream).map((o) => [o.id, 'd5']));
  const s: GameState = {
    ...s0,
    clock: { ...s0.clock, dayIndex: 40, activeDays: 40 },
    chapter: { ...s0.chapter, n, done, completed: Array.from({ length: n - 1 }, (_, i) => i + 1), began: { dayIndex: 5, activeDays: 5 } },
    ...extra,
  };
  return { s, r: evaluateAll(s, ctx) };
};

// ---------------------------------------------------------------------------------------------------------------------------------
describe('Chapters 7 and 8 as the design table has them (§7.2)', () => {
  it('Chapter 7 "Festival": four objectives, the capstone at 5 own lines, ¥8,000, t_resident, cc_matsuri; the festival feature opens with it', () => {
    const c = ch(7);
    expect(c).toMatchObject({ minDays: 19, reward: 8000, rewardTitle: 't_resident', rewardCulture: ['cc_matsuri'], beats: { open: 'b_ch7_open', close: 'b_ch7_close' } });
    expect(c.title).toMatchObject({ ja: 'お祭り', en: 'Festival' });
    expect(c.objectives.filter((o) => !o.dream).map((o) => [o.id, o.pred])).toEqual([
      ['c7_1', { k: 'hearts_count', atLeast: 2, n: 4 }],
      ['c7_2', { k: 'scenario', id: 'matsuri_stalls', minIndependent: 3 }],
      ['c7_3', { k: 'scenario', id: 'matsuri_speech', minIndependent: 5 }],
      ['c7_4', { k: 'culture_said', n: 6 }],
    ]);
    expect(c.objectives.find((o) => o.id === 'c7_dream')?.dream).toBe(true);
    // D40: the two "own words" objectives have an easier alternative after three attempts
    expect(c.objectives.find((o) => o.id === 'c7_2')!.easier).toEqual({ pred: { k: 'scenario', id: 'matsuri_stalls', minIndependent: 2 }, afterTries: 3 });
    expect(c.objectives.find((o) => o.id === 'c7_3')!.easier).toEqual({ pred: { k: 'scenario', id: 'matsuri_speech', minIndependent: 3 }, afterTries: 3 });
    expect(c.opens).toEqual([{ kind: 'feature', id: 'festival' }]);
  });

  it('Chapter 8 "Letter Home": the Letter, 150 words, ★★ in 12 conversations, the dream; ¥10,000 and t_lives_in_ja; the game raises dream_epilogue', () => {
    const c = ch(8);
    expect(c).toMatchObject({ minDays: 25, reward: 10000, rewardTitle: 't_lives_in_ja', dreamFlag: 'dream_epilogue', beats: { open: 'b_ch8_open', close: RELEASE_ENDING } });
    expect(c.objectives.map((o) => [o.id, o.pred])).toEqual([
      ['c8_1', { k: 'flag', id: 'letter_written' }],
      ['c8_2', { k: 'words_known', n: 150 }],
      ['c8_3', { k: 'stars', atLeast: 2, n: 12 }],
      ['c8_4', { k: 'flag', id: 'dream_epilogue' }],
    ]);
    expect(c.opens).toEqual([{ kind: 'feature', id: 'letter' }]);
  });

  it('every objective of 7 and 8 has EN and AR text and a hint; the chapter rewards add up to the design\'s ¥41,000', () => {
    for (const c of [ch(7), ch(8)]) for (const o of c.objectives.filter((x) => !x.dream)) expect(o.text.en.trim() && hasAr(o.text.ar) && o.hint?.en && hasAr(o.hint.ar), o.id).toBeTruthy();
    expect(JP_PACK.chapters.reduce((s, c) => s + c.reward, 0)).toBe(41_000);
  });

  it('the level-4 bot finishes all eight chapters and every offered dream is finishable', () => {
    const issues = validatePack(JP_PACK, { level: 4 }).filter((i) => i.severity === 'error');
    expect(issues.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
    for (const d of JP_PACK.dreams) expect(dreamBlockers(JP_PACK, d), d.id).toEqual([]);
  });

  it('nothing in level 5 is about the festival, the speech or the Letter', () => {
    // (title_missing is the known level-5 gap of every chapter and dream: TITLES is empty and no screen shows titles yet)
    const issues = validatePack(JP_PACK, { level: 5 }).filter((i) => i.severity === 'error' && i.code !== 'title_missing' && /matsuri|festival|letter|ch7|ch8|b_ch6/i.test(`${i.path} ${i.message}`));
    expect(issues.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the real ending and old saves', () => {
  it('Chapter 6 closes with Aiko\'s "come for tea any time" without the room, and "this is your home" once it is rented (the game picks)', () => {
    const tea = finish(6).r;
    expect(tea.state.chapter.n).toBe(7);
    expect(tea.effects).toContainEqual({ t: 'beat', id: 'b_ch6_close' });
    const s0 = fresh();
    const home = finish(6, { owned: { ...s0.owned, home_room_ono: { qty: 1, day: 'd3' } } }).r;
    expect(home.state.chapter.n).toBe(7);
    expect(home.effects).toContainEqual({ t: 'beat', id: 'b_ch6_close_flat' });
    expect(home.effects).not.toContainEqual({ t: 'beat', id: 'b_ch6_close' });
  });

  it('Chapter 7 continues into Chapter 8 with its closing under the fireworks; Chapter 8 ends the story with Hanako and starts Free Walk', () => {
    const seven = finish(7).r;
    expect(seven.state.chapter.n).toBe(8);
    expect(seven.state.titles).toContain('t_resident');
    expect(seven.state.culture.cc_matsuri).toBeDefined();
    expect(seven.effects).toContainEqual({ t: 'beat', id: FESTIVAL.fireworksBeat });
    const eight = finish(8).r;
    expect(eight.state.chapter.n).toBe(FREE_WALK);
    expect(eight.effects).toContainEqual({ t: 'beat', id: RELEASE_ENDING });
    expect(eight.derived).toContainEqual({ t: 'unlocked', what: 'dream', id: 'car' });
  });

  it('a save made mid Chapter 6 under the old cap loads and continues into Chapter 7', () => {
    const s0 = fresh();
    const old = { ...s0, chapter: { ...s0.chapter, n: 6, completed: [1, 2, 3, 4, 5] } };
    const loaded = migrate(JSON.parse(JSON.stringify(old)), 1, JP_PACK);
    expect(loaded.chapter.n).toBe(6);
    expect(loaded.chapter.completed).toEqual([1, 2, 3, 4, 5]);
    const done = Object.fromEntries(ch(6).objectives.filter((o) => !o.dream).map((o) => [o.id, 'd5']));
    const r = evaluateAll({ ...loaded, clock: { ...loaded.clock, dayIndex: 30, activeDays: 30 }, chapter: { ...loaded.chapter, done } }, ctx);
    expect(r.state.chapter.n).toBe(7);
  });

  it('a save already in Free Walk (it played the old epilogue) stays there: no chapter, reward or closing beat replays', () => {
    const s0 = fresh();
    const fw = { ...s0, beats: ['b_ch1_open', 'b_ch1_close', 'b_release_epilogue'], chapter: { ...s0.chapter, n: FREE_WALK, completed: [1, 2, 3, 4, 5, 6] } };
    const loaded = migrate(JSON.parse(JSON.stringify(fw)), 1, JP_PACK);
    expect(loaded.chapter.n).toBe(FREE_WALK);
    expect(loaded.chapter.completed).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const r = reduce(loaded, { t: 'day_observed', nowMs: NOW }, ctx);
    expect(r.state.chapter.n).toBe(FREE_WALK);
    expect(r.state.wallet.cash).toBe(loaded.wallet.cash);
    expect(r.effects.filter((e) => e.t === 'beat' && /^b_ch\d_close/.test(e.id))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the festival day rule and its guests', () => {
  const at = (n: number, dayIndex: number, began: number, date: string): Pick<GameState, 'chapter' | 'clock'> => {
    const s = fresh();
    return { chapter: { ...s.chapter, n, began: { dayIndex: began, activeDays: began } }, clock: { ...s.clock, dayIndex, lastLocalDate: date } };
  };
  it('Saturday is read from the local date', () => {
    expect(isSaturday('2026-10-17')).toBe(true);
    expect(isSaturday('2026-10-18')).toBe(false);
    expect(isSaturday('')).toBe(false);
  });
  it('Chapter 7: from the next play day after it began, every day; the very first day only on a Saturday', () => {
    expect(festivalOpen(at(7, 10, 10, '2026-10-15'))).toBe(false);
    expect(festivalOpen(at(7, 10, 10, '2026-10-17'))).toBe(true);
    expect(festivalOpen(at(7, 11, 10, '2026-10-19'))).toBe(true);
    expect(festivalOpen(at(7, 30, 10, '2026-10-20'))).toBe(true);
  });
  it('before Chapter 7 never; Chapter 8 and Free Walk on Saturdays', () => {
    expect(festivalOpen(at(6, 50, 10, '2026-10-17'))).toBe(false);
    expect(festivalOpen(at(8, 50, 10, '2026-10-17'))).toBe(true);
    expect(festivalOpen(at(8, 50, 10, '2026-10-16'))).toBe(false);
    expect(festivalOpen(at(FREE_WALK, 50, 10, '2026-10-17'))).toBe(true);
  });
  it('a Saturday that brings the festival back after Chapter 7 is noticed once (the app toasts it); Chapter 7, a reload on the Saturday and Sunday are not', () => {
    expect(festivalReturned(at(8, 50, 10, '2026-10-16'), at(8, 51, 10, '2026-10-17'))).toBe(true);
    expect(festivalReturned(at(FREE_WALK, 50, 10, '2026-10-15'), at(FREE_WALK, 51, 10, '2026-10-17'))).toBe(true);
    expect(festivalReturned(at(FREE_WALK, 51, 10, '2026-10-17'), at(FREE_WALK, 51, 10, '2026-10-17'))).toBe(false);
    expect(festivalReturned(at(FREE_WALK, 51, 10, '2026-10-17'), at(FREE_WALK, 52, 10, '2026-10-18'))).toBe(false);
    expect(festivalReturned(at(7, 10, 10, '2026-10-16'), at(7, 11, 10, '2026-10-17'))).toBe(false);
    // the festival dream's last step says when the stalls are open after Chapter 7
    expect(JP_PACK.dreams.find((d) => d.id === 'festival')!.steps.at(-1)!.text.en).toContain('every Saturday');
  });
  it('cannot deadlock: the wait is one play day at most, and Chapter 7\'s minDays already asks for more active days than Chapter 6\'s', () => {
    expect(ch(7).minDays - ch(6).minDays).toBeGreaterThanOrEqual(1);
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']) expect(festivalOpen(at(7, 11, 10, date)), date).toBe(true);
  });
  it('friends at two hearts or more come (Hanako on the stage first), most hearts first; the rows of the festival are Kenji\'s stall and Hanako\'s speech', () => {
    const hearts: Record<string, number> = { mio: 4, yuki: 1, tanaka: 2, kenji: 3, sato: 2, aiko: 0 };
    expect(festivalGuests(JP_PACK, (id) => hearts[id] ?? 0)).toEqual(['hanako', 'mio', 'kenji', 'tanaka', 'sato'].sort((a, b) => (a === 'hanako' ? -1 : b === 'hanako' ? 1 : (hearts[b] ?? 0) - (hearts[a] ?? 0) || JP_PACK.friends.findIndex((f) => f.id === a) - JP_PACK.friends.findIndex((f) => f.id === b))));
    expect(festivalGuests(JP_PACK, () => 0)).toEqual(['hanako']);
    const rows = Object.values(JP_PACK.interactions).flat();
    for (const id of FESTIVAL_ROWS) expect(rows.find((r) => r.id === id)?.ch, id).toBe(7);
    expect(rows.find((r) => r.id === 'kenji_stall')!.scenarioId).toBe(FESTIVAL.stallsScenario);
    expect(rows.find((r) => r.id === 'hanako_speech')!.scenarioId).toBe(FESTIVAL.speechScenario);
    // the festival rows are never the first option of their character (Talk on a normal day stays what it was)
    expect(JP_PACK.interactions.kenji![0]!.id).toBe('kenji_shop');
    expect(JP_PACK.interactions.hanako![0]!.id).not.toBe('hanako_speech');
    // the car browse opens with the cars, at Free Walk
    expect(rows.find((r) => r.id === 'nakamura_car')!.ch).toBe(FREE_WALK);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the beats of Chapters 4-8 and the diary', () => {
  it('the new and changed beats are authored, with every token in the lexicon and EN + AR', () => {
    for (const id of ['b_ch4_close', 'b_ch6_close', 'b_ch6_close_flat', 'b_ch7_open', 'b_ch7_close', 'b_ch8_open', 'b_ch8_close']) {
      const b = BEATS[id];
      expect(b, id).toBeTruthy();
      b!.lines.forEach((l, i) => noGap(l.line, `${id}[${i}]`));
    }
  });
  it('the design\'s lines: Chapter 7 opens with Mio, Kenji (his ramen stall) and Hanako; it closes with 「皆さん、ありがとうございました。」; Chapter 8 ends with 「これがあなたの日本語です。」', () => {
    expect(BEATS.b_ch7_open!.lines.map((l) => l.who)).toEqual(['mio', 'kenji', 'hanako']);
    // Mio is casual with a friend: no polite あります before her 行こう (review)
    expect(bare(BEATS.b_ch7_open!.lines[0]!.line.ja)).toBe('土曜日にお祭りがあるよ。いっしょに行こう！');
    expect(bare(BEATS.b_ch7_open!.lines[1]!.line.ja)).toBe('ラーメンの屋台を出します！');
    expect(bare(BEATS.b_ch7_close!.lines[0]!.line.ja)).toBe('皆さん、ありがとうございました。');
    expect(bare(BEATS.b_ch8_close!.lines[0]!.line.ja)).toBe(bare(LETTER_HANAKO.ja));
    // Chapter 4 promises the festival again; both Chapter 6 closings end with the Letter preview
    expect(BEATS.b_ch4_close!.lines.some((l) => bare(l.line.ja) === '来週、お祭りがあるよ！')).toBe(true);
    for (const id of ['b_ch6_close', 'b_ch6_close_flat']) expect(BEATS[id]!.lines.at(-1), id).toEqual(LETTER_PREVIEW_LINE);
  });
  it('every closing beat from Chapter 2 to 7 asks for the diary; Chapter 1 asks for the dream; the ending asks nothing', () => {
    for (const id of ['b_ch2_close', 'b_ch3_close', 'b_ch4_close', 'b_ch5_close', 'b_ch6_close', 'b_ch6_close_flat', 'b_ch7_close']) expect(BEATS[id]!.ask, id).toBe('diary');
    expect(BEATS.b_ch1_close!.ask).toBe('dream');
    expect(BEATS.b_ch8_close!.ask).toBeUndefined();
  });
  it('the diary: two taps (what happened, how it felt) for every chapter that asks; lines in the lexicon; stored by the game as assisted', () => {
    for (let n = 2; n <= 7; n++) {
      const p = DIARY_PROMPTS[n]!;
      expect(p.chapter).toBe(n);
      expect(p.what).toHaveLength(3);
      p.what.forEach((l, i) => noGap(l, `diary ${n}/${i}`));
    }
    DIARY_FEELINGS.forEach((l, i) => noGap(l, `feel ${i}`));
    expect(diaryPrompt(9)).toBe(DIARY_PROMPTS[7]);
    const e = diaryLine(5, 0, 0);
    expect(e).toMatchObject({ chapter: 5, ja: '電車に乗りました。今日は楽しかったです。', assisted: true });
    noGap(e.line, 'diaryLine');
    const s = reduce(fresh(), { t: 'diary_added', entry: { chapter: e.chapter, ja: e.ja, assisted: e.assisted } }, ctx).state;
    expect(s.diary).toEqual([{ chapter: 5, ja: e.ja, assisted: true }]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the Letter Home', () => {
  const withFacts = (): GameState => {
    const s = fresh();
    const friends = { ...s.friends, mio: { ...s.friends.mio!, met: true, ap: 40, facts: { name: 'Layla', country: 'エジプト', hobby: 'music' } }, kenji: { ...s.friends.kenji!, met: true, ap: 10 } };
    return {
      ...s,
      me: { nameKana: 'レイラ' },
      friends,
      runs: { ramen: { count: 6, complete: true, stars: 2, bestIndependent: 3, bestShare: 1, bestR: 1, steps: [] }, cafe: { count: 2, complete: true, stars: 1, bestIndependent: 1, bestShare: 1, bestR: 1, steps: [] } },
      owned: { ...s.owned, phone_used: { qty: 1, day: 'd3' }, g_choco: { qty: 2, day: 'd2' } },
      dream: { id: 'festival', steps: {}, done: false },
    };
  };

  it('five frames in the design\'s order (name, country, a friend, a place, the dream or a purchase), each with 3 suggestions; every line in the lexicon', () => {
    expect(LETTER_FRAMES.map((f) => f.source)).toEqual(['name', 'country', 'friend', 'place', 'thing']);
    for (const f of LETTER_FRAMES) {
      expect(f.suggestions).toHaveLength(3);
      expect(f.fallback.suggestions).toHaveLength(3);
      for (const l of [f.starter, ...f.suggestions, f.fallback.starter, ...f.fallback.suggestions]) noGap(l, f.id);
      expect(f.prompt.en && hasAr(f.prompt.ar), f.id).toBeTruthy();
    }
    for (const l of [LETTER_HEADER, LETTER_SIGN, LETTER_HANAKO, LETTER_PREVIEW_LINE.line]) noGap(l, 'letter decoration');
    expect(LETTER_RULE).toEqual(BALANCE.letter);
  });

  it('the frames are pre-filled from remembered facts: the katakana name, Mio\'s country and the friend, the place played most, the dearest purchase', () => {
    const facts = letterFacts(JP_PACK, withFacts(), 'Layla');
    expect(facts.name).toMatchObject({ ja: 'レイラ', known: true });
    expect(facts.country).toMatchObject({ ja: 'エジプト', en: 'Egypt', known: true });
    expect(facts.hobby).toMatchObject({ ja: '音楽', known: true });
    expect(facts.friend).toMatchObject({ en: 'Mio', known: true });
    expect(facts.place).toMatchObject({ ja: 'ラーメン屋', known: true });
    // the phone, not the chocolate (a present is not "a purchase" for the letter)
    expect(facts.thing.ja).toBe(JP_PACK.items.find((i) => i.id === 'phone_used')!.name.ja);
    const frames = letterFrames(JP_PACK, withFacts(), 'Layla');
    expect(frames.map((f) => f.fromFact)).toEqual([true, true, true, true, true]);
    expect(bare(frames[0]!.starter.ja)).toBe('レイラです。');
    expect(bare(frames[1]!.suggestions[0]!.ja)).toBe('エジプトの皆さん、お元気ですか。');
    expect(frames[2]!.suggestions[0]!.en).toContain('Mio');
    for (const f of frames) for (const l of [f.starter, ...f.suggestions]) expect(`${l.ja}${l.en}${l.ar}`, f.id).not.toContain('{x}');
  });

  it('a fact the save does not know falls back to a frame that needs none (a new save can still write the Letter); the dream stands in for a purchase', () => {
    const empty = letterFrames(JP_PACK, fresh());
    expect(empty.map((f) => f.fromFact)).toEqual([false, false, false, false, false]);
    for (const f of empty) for (const l of [f.starter, ...f.suggestions]) expect(l.ja, f.id).not.toContain('{x}');
    // the profile name alone is enough for the first frame
    expect(letterFrames(JP_PACK, fresh(), 'Sam')[0]!.fromFact).toBe(true);
    const dreamer = { ...fresh(), dream: { id: 'festival', steps: {}, done: false } };
    const last = letterFrames(JP_PACK, dreamer)[4]!;
    expect(last.fromFact).toBe(true);
    expect(bare(last.starter.ja)).toBe('ミオさんとお祭りに行きたいです。');
  });

  it('the dream sentence reads naturally for every dream: its own sentence, not the quoted title (review: 「わたしの夢は「ICカードでたび」です。」); "came true" only once it did', () => {
    for (const d of JP_PACK.dreams) {
      for (const done of [false, true]) {
        const f = letterFrames(JP_PACK, { ...fresh(), dream: { id: d.id, steps: {}, done } })[4]!;
        expect(f.fromFact, d.id).toBe(true);
        for (const l of [f.starter, ...f.suggestions]) {
          noGap(l, `${d.id} ${done}`);
          expect(bare(l.ja), d.id).not.toMatch(/「|」/);
        }
        expect(f.suggestions.some((l) => l.ja.includes('かないました')), `${d.id} came true`).toBe(done);
      }
    }
    expect(Object.keys(LETTER_DREAMS).sort()).toEqual(JP_PACK.dreams.map((d) => d.id).sort());
    const travel = letterFrames(JP_PACK, { ...fresh(), dream: { id: 'travel', steps: {}, done: false } })[4]!;
    expect(bare(travel.starter.ja)).toBe('電車で旅行したいです。');
    expect(bare(travel.suggestions[1]!.ja)).toBe('電車で旅行したいです。それがわたしの夢です。');
  });

  it('independent vs assisted: typed or spoken is the learner\'s own; picked, translated, or a copy of a suggestion on screen is assisted', () => {
    const shown = ['エジプトの|皆さん|、|お元気|です|か|。'];
    expect(letterAssisted('エジプトはあついです。', {})).toBe(false);
    expect(letterAssisted('エジプトはあついです。', { picked: true })).toBe(true);
    expect(letterAssisted('エジプトはあついです。', { translated: true })).toBe(true);
    expect(letterAssisted('エジプトの皆さん、お元気ですか', { shown })).toBe(true);
    expect(letterLineOk('こんにちは')).toBe(true);
    expect(letterLineOk('hello')).toBe(false);
    expect(letterLineOk('')).toBe(false);
  });

  it('letterComplete agrees with the game: the Letter that raises letter_written (no audio: only text is stored)', () => {
    const five = (own: number) => Array.from({ length: 5 }, (_, i) => ({ ja: `わたしは元気です${i}。`, assisted: i >= own }));
    for (const own of [2, 3, 5]) {
      const s = reduce(fresh(), { t: 'letter_saved', sentences: five(own) }, ctx).state;
      expect(s.chapter.flags.includes('letter_written'), `own ${own}`).toBe(letterComplete(five(own)));
      expect(Object.keys(s.letter[0]!).sort()).toEqual(['assisted', 'ja']);
    }
    expect(letterComplete(five(3))).toBe(true);
    expect(letterComplete(five(2))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the speech (matsuri_speech): five lines and the Prepare rehearsal', () => {
  it('the five lines assemble into the target speech of §7.2', () => {
    const lines = SPEECH_LINES.map((l) => ({ line: { ...l.line, ja: l.line.ja.replace('{x}', l.slot === 'name' ? 'レイラ' : l.slot === 'country' ? 'エジプト' : '音楽') } }));
    expect(speechText(lines)).toBe('はじめまして。レイラです。エジプトから来ました。音楽が好きです。桜町はとてもいい町です。ありがとうございました。');
    for (const l of SPEECH_LINES) noGap(l.line, `speech ${l.slot}`);
  });
  it('the rehearsal fills the player\'s facts; an unknown fact is an example, marked so', () => {
    const s = fresh();
    const known = { ...s, me: { nameKana: 'レイラ' }, friends: { ...s.friends, mio: { ...s.friends.mio!, facts: { country: 'エジプト', hobby: 'anime' } } } };
    const r = speechRehearsal(JP_PACK, known, 'en');
    expect(r.map((x) => x.slot)).toEqual(['name', 'country', 'hobby', 'town', 'thanks']);
    expect(speechText(r)).toBe('はじめまして。レイラです。エジプトから来ました。アニメが好きです。桜町はとてもいい町です。ありがとうございました。');
    expect(r.every((x) => !x.example)).toBe(true);
    const blank = speechRehearsal(JP_PACK, s, 'ar');
    expect(bare(blank[0]!.line.ja)).toBe('はじめまして。');
    expect(blank.filter((x) => x.example).map((x) => x.slot)).toEqual(['country', 'hobby']);
    expect(bare(blank[1]!.line.ja)).toBe('エジプトから来ました。');
  });
  it('is the capstone: Real mode, pays like a conversation, with a pocket of the three lines that need no fact', () => {
    const m = JP_PACK.scenarioMeta.find((x) => x.id === 'matsuri_speech')!;
    expect(m).toMatchObject({ capstone: true, real: true, pay: 'full', place: 'park' });
    expect(m.pocket).toHaveLength(3);
    for (const id of m.pocket!) expect(JP_PACK.pockets[id], id).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe('the festival stalls, cc_matsuri and the dreams', () => {
  it('matsuri_stalls sells the matsuri menu, cash only, at the scenario\'s own fallback prices', () => {
    const m = JP_PACK.scenarioMeta.find((x) => x.id === 'matsuri_stalls')!;
    expect(m).toMatchObject({ kind: 'shop', real: true, pay: 'full', shop: { shopId: 'matsuri', itemSlot: 'yatai', payStep: 'pay' } });
    const shop = JP_PACK.shops.find((s) => s.id === 'matsuri')!;
    expect(shop).toMatchObject({ placeId: 'park', openChapter: 7, pay: ['cash'] });
    for (const [opt, yen] of Object.entries(MATSURI_PRICES)) {
      const row = JP_PACK.menu.find((x) => x.id === m.shop!.itemMap[opt]);
      expect(row?.price, opt).toBe(yen);
      expect(shop.sells, opt).toContain(row!.id);
    }
    expect(Object.keys(m.shop!.itemMap).sort()).toEqual(Object.keys(MATSURI_PRICES).sort());
  });

  it('cc_matsuri is collectable now (not deferred): entering the festival unlocks it, and Chapter 7 guarantees it', () => {
    const card = CULTURE.find((c) => c.id === 'cc_matsuri')!;
    expect(card.deferred).toBeUndefined();
    expect(CULTURE.filter((c) => c.deferred)).toEqual([]);
    const s = { ...fresh(), chapter: { ...fresh().chapter, n: 7 } };
    const r = reduce(s, { t: 'visit', place: FESTIVAL.visit }, ctx);
    expect(r.state.culture.cc_matsuri).toBeDefined();
  });

  it('the festival dream is offered (its yukata at Fuku-Fuku from Chapter 4, its last step the stalls) and is the casual goal\'s default; the car opens at Free Walk', () => {
    const festival = JP_PACK.dreams.find((d) => d.id === 'festival')!;
    expect(festival.defaultFor).toEqual(['casual']);
    expect(JP_PACK.items.find((i) => i.id === 'yukata')).toMatchObject({ shop: 'fukufuku', gate: { ch: 4 }, price: 8900 });
    expect(festival.steps.at(-1)!.pred).toEqual({ k: 'scenario', id: 'matsuri_stalls', minIndependent: 3 });
    expect(JP_PACK.dreams.find((d) => d.id === 'car')!.openChapter).toBe(FREE_WALK);
    // every onboarding goal still has a dream to suggest
    for (const goal of ['work', 'casual', 'relocation', 'travel']) expect(JP_PACK.dreams.some((d) => d.defaultFor?.includes(goal)), goal).toBe(true);
  });

  it('Chapter 8\'s c8_4: choosing a dream (the same one counts) raises dream_epilogue; a finished dream counts too', () => {
    const s0 = fresh();
    const in8 = { ...s0, chapter: { ...s0.chapter, n: 8, completed: [1, 2, 3, 4, 5, 6, 7] }, dream: { id: 'bike', steps: {}, done: false } };
    expect(reduce(in8, { t: 'dream_chosen', id: 'bike' }, ctx).state.chapter.flags).toContain('dream_epilogue');
    const finished = { ...in8, dream: { id: 'bike', steps: {}, done: true } };
    expect(reduce(finished, { t: 'day_observed', nowMs: NOW }, ctx).state.chapter.flags).toContain('dream_epilogue');
    // in Chapter 7 a choice is only a choice
    const in7 = { ...in8, chapter: { ...in8.chapter, n: 7 } };
    expect(reduce(in7, { t: 'dream_chosen', id: 'bike' }, ctx).state.chapter.flags).not.toContain('dream_epilogue');
  });

  it('the table of the design is unchanged by the cap: the released chapters are the authored ones', () => {
    expect(JP_PACK.chapters).toEqual(CHAPTERS);
  });
});
