// Wave C2, the app side of Chapters 7-8: the festival in the world (on with the content's festival-day rule, the friends at two hearts, off after,
// held on for the fireworks beat), the festival rows and picks, the capstone's mode (Real; Guided only as the one-time fallback), the Letter's
// drafts (own vs assisted, the finish rule, what `letter_saved` stores and the flag it raises), the card, the diary chapter of a closing beat, and
// a source check that no screen of the wave records or keeps audio (the microphone is recognition only).
import './_fakeStorage';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { JP_PACK, FESTIVAL, diaryLine, letterFrames, scenarioById } from '@lw/content';
import { BALANCE, createGameState, reduce, type GameState, type InputEvent } from '@lw/game';
import { ctxOf } from '../../../packages/game/test/fixtures-1e';
import { gameView } from '../src/game/selectors';
import { festivalPlan, interactionRows, planFor, routePick, LETTER_ROW_ID } from '../src/game/worldSync';
import { festivalLineOf, fireworksBeat, guestsFor, resetFestivalSync, syncFestival } from '../src/game/festivalSync';
import { STRINGS } from '../src/i18n';
import { capstoneMode } from '../src/game/realTry';
import { cardOf, freeTokens, closingChapterOf, diaryGloss, letterSentences, readBackText, sentenceOf, tallyOf, typedJapanese, wrapText, type LetterDraft } from '../src/game/letterLogic';

const NOW = 1_800_000_000_000;
const view = gameView({ vocab: [], discovered: [], lessonsDone: ['greetings'], streak: { days: 0 }, profile: { name: 'Sam', level: 'A1', goal: 'travel', age: 'adults', createdAt: '2030-01-15T00:00:00.000Z' } as never });
const scenarios = new Set(Object.values(JP_PACK.interactions).flat().map((i) => i.scenarioId).filter((id): id is string => !!id && !!scenarioById(id)));
const lessons = new Set(['greetings', 'numbers']);

/** A save in chapter `n`, `days` play days after the chapter began, on a weekday (2030-01-15 is a Tuesday), with friends at the given AP. */
function at(n: number, days = 1, ap: Record<string, number> = {}): GameState {
  const s = createGameState(JP_PACK, NOW);
  const friends = { ...s.friends };
  for (const [id, v] of Object.entries(ap)) friends[id] = { ...(s.friends[id] ?? (s.friends.mio as never)), met: true, ap: v } as never;
  return {
    ...s,
    friends,
    clock: { ...s.clock, dayIndex: 10 + days, lastLocalDate: '2030-01-15' },
    chapter: { ...s.chapter, n, began: { dayIndex: 10, activeDays: 10 } },
  };
}
const env = (state: GameState) => ({ pack: JP_PACK, state, view, scenarios, lessons });

/** A stand-in world that records what the festival code asks of it. */
function fakeWorld() {
  const calls: string[] = [];
  let on = false;
  const w = {
    calls,
    setFestival: (x: boolean) => (calls.push(`festival:${x}`), (on = x)),
    isFestival: () => on,
    setFestivalGuests: (ids: string[]) => calls.push(`guests:${ids.join(',')}`),
    fireworks: (x: boolean) => calls.push(`fireworks:${x}`),
    teleportNear: (id: string) => calls.push(`near:${id}`),
    walkTo: (x: number, z: number) => calls.push(`walk:${x},${z}`),
    setActive: (x: boolean) => calls.push(`active:${x}`),
  };
  return w as typeof w & never;
}

describe('wave C2: the festival in the world', () => {
  const two = BALANCE.ap.thresholds[1];
  it('is off before Chapter 7 and on the first day of Chapter 7 (a weekday); on from the next play day, with the friends at 2+ hearts', () => {
    resetFestivalSync();
    const w = fakeWorld();
    syncFestival(w, JP_PACK, at(6, 3, { mio: two }));
    expect(w.calls).toEqual([]);
    syncFestival(w, JP_PACK, at(7, 0, { mio: two }));
    expect(w.calls).toEqual([]);
    syncFestival(w, JP_PACK, at(7, 1, { mio: two, kenji: two, yuki: 10 }));
    expect(w.calls).toEqual(['guests:hanako,mio,kenji', 'festival:true']);
    // the same state again touches nothing (syncWorld runs after every change)
    syncFestival(w, JP_PACK, at(7, 1, { mio: two, kenji: two, yuki: 10 }));
    expect(w.calls).toHaveLength(2);
    // a friend reaching two hearts joins; the chapter over (a weekday in Chapter 8), the park is the park again
    syncFestival(w, JP_PACK, at(7, 1, { mio: two, kenji: two, yuki: two }));
    expect(w.calls.at(-1)).toBe('guests:hanako,mio,yuki,kenji');
    syncFestival(w, JP_PACK, at(8, 1, { mio: two }));
    expect(w.calls.at(-1)).toBe('festival:false');
  });

  it('guests: Hanako first, then every friend at two hearts or more, most hearts first', () => {
    const g = guestsFor(JP_PACK, at(7, 1, { mio: BALANCE.ap.thresholds[2], kenji: two, yuki: two - 1 }));
    expect(g).toEqual(['hanako', 'mio', 'kenji']);
  });

  it("the fireworks beat holds the festival on after the chapter ended, and lets it go after (regression: the day rule alone turned it off before Chapter 7's closing)", () => {
    resetFestivalSync();
    const w = fakeWorld();
    vi.stubGlobal('window', { __world: w });
    syncFestival(w, JP_PACK, at(8, 0));
    expect(w.isFestival()).toBe(false);
    vi.useFakeTimers();
    fireworksBeat(true);
    expect(w.isFestival()).toBe(true);
    // the learner steps to the speaker's spot first, then the shells go up
    expect(w.calls).toContain('near:hanako');
    expect(w.calls.some((c) => c.startsWith('walk:'))).toBe(true);
    expect(w.calls).not.toContain('fireworks:true');
    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
    expect(w.calls).toContain('fireworks:true');
    expect(w.calls).toContain('active:true');
    // a state change while the beat plays (the beat is filed) keeps it on
    syncFestival(w, JP_PACK, { ...at(8, 0), beats: ['b_ch7_close'] });
    expect(w.isFestival()).toBe(true);
    fireworksBeat(false);
    expect(w.calls.slice(-2)).toEqual(['festival:false', 'fireworks:false']);
    vi.unstubAllGlobals();
    resetFestivalSync();
  });
});

describe('wave C2: festival rows, picks and the Letter row', () => {
  const ids = (s: GameState, who: string) => interactionRows(env(s), who).map((r) => r.it.id);
  it("Kenji's stall and Hanako's speech are listed only while the park is the festival", () => {
    expect(ids(at(7, 0), 'kenji')).not.toContain('kenji_stall');
    expect(ids(at(7, 0), 'hanako')).not.toContain('hanako_speech');
    expect(ids(at(7, 1), 'kenji')).toContain('kenji_stall');
    expect(ids(at(7, 1), 'hanako')).toContain('hanako_speech');
    expect(ids(at(8, 1), 'kenji')).not.toContain('kenji_stall');
  });
  it('the stall and stage picks route to the festival plans; the speech always opens on its rehearsal', () => {
    expect(routePick('stall:takoyaki')).toEqual({ t: 'festival', pick: { t: 'stall', stall: 'takoyaki' } });
    expect(routePick('festival:stage')).toEqual({ t: 'festival', pick: { t: 'stage' } });
    expect(festivalPlan(env(at(7, 0)), { t: 'stage' })).toBeNull();
    expect(festivalPlan(env(at(7, 1)), { t: 'stage' })).toEqual({ t: 'prepare', scenarioId: 'matsuri_speech', characterId: 'hanako' });
    const stall = festivalPlan(env(at(7, 1)), { t: 'stall', stall: 'ramen' });
    expect(stall && 'scenarioId' in stall && stall.scenarioId).toBe(FESTIVAL.stallsScenario);
    expect(stall && 'characterId' in stall && stall.characterId).toBe('kenji');
  });
  it("the goldfish scoop sells no food: a line of its own, not Kenji's food conversation (regression, review)", () => {
    const kingyo = { t: 'stall', stall: 'kingyo' } as const;
    expect(routePick('stall:kingyo')).toEqual({ t: 'festival', pick: kingyo });
    expect(festivalPlan(env(at(7, 1)), kingyo)).toBeNull();
    expect(festivalLineOf(kingyo)).toBe('fest.kingyo');
    expect(STRINGS.en['fest.kingyo']).toMatch(/goldfish/i);
    expect(STRINGS.ar['fest.kingyo']).toMatch(/[\u0600-\u06ff]/);
    // the food stalls and the stage keep their rows
    for (const stall of ['takoyaki', 'yakisoba', 'kakigori', 'ramen', 'ringoame']) expect(festivalLineOf({ t: 'stall', stall })).toBeNull();
    expect(festivalLineOf({ t: 'stage' })).toBeNull();
    expect(festivalPlan(env(at(7, 1)), { t: 'stall', stall: 'ringoame' })).not.toBeNull();
  });
  it('Hanako opens the Letter from Chapter 8 (and at Free Walk, to read it again), never before', () => {
    expect(ids(at(7, 1), 'hanako')).not.toContain(LETTER_ROW_ID);
    expect(ids(at(8, 1), 'hanako')).toContain(LETTER_ROW_ID);
    expect(ids(at(BALANCE.freeWalkChapter, 1), 'hanako')).toContain(LETTER_ROW_ID);
    const row = interactionRows(env(at(8, 1)), 'hanako').find((r) => r.it.id === LETTER_ROW_ID)!;
    expect(planFor(env(at(8, 1)), row.it, 'hanako')).toEqual({ t: 'letter' });
  });
});

describe('wave C2: the capstone mode', () => {
  it('Real by default; Guided only as the one-time fallback of a player who never used Real mode', () => {
    const s = at(7, 1);
    expect(capstoneMode(JP_PACK, s, 'matsuri_speech', undefined)).toBe('real');
    expect(capstoneMode(JP_PACK, s, 'matsuri_speech', 'guided')).toBe('guided');
    const used = { ...s, chapter: { ...s.chapter, flags: [...s.chapter.flags, 'real_try_done'] } };
    expect(capstoneMode(JP_PACK, used, 'matsuri_speech', 'guided')).toBe('real');
    const once = { ...s, chapter: { ...s.chapter, flags: [...s.chapter.flags, 'guided_once:matsuri_speech'] } };
    expect(capstoneMode(JP_PACK, once, 'matsuri_speech', 'guided')).toBe('real');
    // any other scenario keeps the asked mode
    expect(capstoneMode(JP_PACK, s, 'matsuri_stalls', 'guided')).toBe('guided');
    expect(capstoneMode(JP_PACK, s, 'matsuri_stalls', undefined)).toBeUndefined();
  });
});

describe('wave C2: the Letter drafts', () => {
  const d = (ja: string, how: LetterDraft['how'], shown: string[] = []): LetterDraft => ({ frameId: 'lf', ja, how, shown });
  it('typed text is kept as Japanese: kana and kanji as typed, romaji read as kana, anything else refused', () => {
    expect(typedJapanese('サムです。')).toBe('サムです。');
    expect(typedJapanese('genki desu')).toBe('げんきです。');
    expect(typedJapanese('I am well')).toBeNull();
    expect(typedJapanese('   ')).toBeNull();
  });
  it('typed or spoken is own; picked, translated or a copy of shown text is assisted', () => {
    expect(sentenceOf(d('わたしは元気です。', 'typed')).assisted).toBe(false);
    expect(sentenceOf(d('わたしは元気です。', 'spoken')).assisted).toBe(false);
    expect(sentenceOf(d('わたしは元気です。', 'picked')).assisted).toBe(true);
    expect(sentenceOf(d('わたしは元気です。', 'translated')).assisted).toBe(true);
    expect(sentenceOf(d('わたしは元気です', 'typed', ['わたしは元気です。'])).assisted).toBe(true);
  });
  it('the Letter finishes with five sentences, three of them own; it stores only the Japanese and the game raises letter_written', () => {
    const own = ['サムです。', 'エジプトがすきです。', 'ミオさんはやさしいです。'].map((x) => d(x, 'typed'));
    const help = ['公園が好きです。', 'また書きます。'].map((x) => d(x, 'picked'));
    expect(tallyOf([...own.slice(0, 2), ...help, null]).complete).toBe(false);
    expect(tallyOf([...own.slice(0, 2), ...help, d('もう一つ。', 'translated')]).complete).toBe(false);
    const drafts = [...own, ...help];
    expect(tallyOf(drafts)).toMatchObject({ written: 5, own: 3, complete: true });
    const sentences = letterSentences(drafts, [{ chapter: 7, ja: 'お祭りに行きました。', assisted: true }]);
    expect(sentences).toHaveLength(6);
    for (const s of sentences) expect(Object.keys(s).sort()).toEqual(['assisted', 'ja']);
    const s0 = at(8, 1);
    const r = reduce(s0, { t: 'letter_saved', sentences } as InputEvent, ctxOf(JP_PACK, { now: NOW }));
    expect(r.state.chapter.flags).toContain('letter_written');
    expect(r.state.letter).toEqual(sentences);
  });
  it('the frames are five and pre-filled from the save (the name when known)', () => {
    const s = { ...at(8, 1), me: { nameKana: 'サム' } };
    const fs = letterFrames(JP_PACK, s, 'Sam');
    expect(fs).toHaveLength(5);
    expect(fs[0]!.starter.ja).toContain('サム');
    for (const f of fs) expect(f.suggestions).toHaveLength(3);
    // regression (gate): the English gloss said 「サム」 ("I'm サム", "From サム"); it now says the name as typed in the profile
    expect(fs[0]!.starter.en).toContain('Sam');
    expect(fs[0]!.starter.en).not.toContain('サム');
    // regression (gate): the dream, a title, is quoted (「わたしの夢はICカードでたびです」 was broken Japanese)
    const thing = letterFrames(JP_PACK, { ...s, dream: { ...s.dream, id: 'travel' } }, 'Sam').find((f) => f.id === 'lf_thing')!;
    expect(thing.starter.ja.replace(/\|/g, '')).toContain('わたしの夢は「ICカードでたび」です。');
    expect(cardOf([], [], 'サム', 'en', 0, 'Sam').sign.gloss).toBe('From Sam');
    expect(cardOf([], [], 'サム', 'en').sign.gloss).toBe('From サム');
  });
  it('the card carries the header, the sentences with a meaning, the signature; the read-back text is all of it', () => {
    const card = cardOf([{ ja: 'わたしは元気です。', assisted: false }], [undefined], 'サム', 'en');
    expect(card.lines[0]!.gloss).not.toBe('');
    expect(card.sign.ja).toContain('サム');
    const text = readBackText(card);
    expect(text).toContain('わたしは元気です。');
    expect(text).toContain(card.header.ja);
  });
  it("the learner's own line reads as a short labelled word list in EN and AR, or shows no meaning when a word is unknown (regression, review: 'friend · a lot · is (doing), am, exists')", () => {
    const card = (ja: string, lang: 'en' | 'ar') => cardOf([{ ja, assisted: false }], [undefined], 'サム', lang).lines[0]!;
    const en = card('友だちがたくさんいます。', 'en');
    expect(en).toMatchObject({ gloss: 'friend · a lot · is', literal: true });
    const ar = card('友だちがたくさんいます。', 'ar');
    expect(ar.literal).toBe(true);
    expect(ar.gloss).not.toMatch(/[()،]/);
    expect(ar.gloss.split(' · ')).toHaveLength(3);
    expect(card('公園によく行きます。', 'en').gloss).toBe('park · well/often · go');
    // a word the dictionary does not know (kana it cannot place): no half translation
    expect(card('にほんごをべんきょうしています。', 'en')).toMatchObject({ gloss: '' });
    expect(card('にほんごをべんきょうしています。', 'en').literal).toBeUndefined();
    // a sentence with a meaning of its own (a picked idea, a translation) is not labelled
    const known = cardOf([{ ja: '公園が好きです。', assisted: true }], [{ en: 'I like the park.', ar: 'أحب الحديقة.' }], 'サム', 'ar').lines[0]!;
    expect(known).toMatchObject({ gloss: 'أحب الحديقة.' });
    expect(known.literal).toBeUndefined();
    // the card labels it in both languages
    expect(STRINGS.en['letter.wordByWord'].replace('{words}', en.gloss)).toBe('Word by word: friend · a lot · is');
    expect(STRINGS.ar['letter.wordByWord']).toContain('{words}');
  });
  it('a kana word the dictionary does not know gets real romaji on the card (regression, gate: the romaji row read 「ICkādo de たび」)', () => {
    const card = cardOf([{ ja: 'わたしの夢は「ICカードでたび」です。', assisted: true }], [undefined], 'サム', 'en');
    expect(card.lines[0]!.romaji).not.toMatch(/[\u3040-\u30ff]/);
    expect(card.lines[0]!.romaji).toContain('tabi');
    expect(freeTokens('たび').map((t) => t.rom)).toEqual(['tabi']);
  });
  it('wraps Japanese by character and other text by word', () => {
    const m = (s: string) => s.length * 10;
    expect(wrapText(m, 'あいうえおかきくけこ', 50)).toEqual(['あいうえお', 'かきくけこ']);
    expect(wrapText(m, 'one two three', 70)).toEqual(['one two', 'three']);
  });
});

describe('wave C2: the diary chapter of a closing beat', () => {
  it("is the chapter the beat closes (the next chapter is current when it plays), either of Chapter 6's two closings", () => {
    expect(closingChapterOf(JP_PACK, 'b_ch7_close')).toBe(7);
    expect(closingChapterOf(JP_PACK, 'b_ch6_close')).toBe(6);
    expect(closingChapterOf(JP_PACK, 'b_ch6_close_flat')).toBe(6);
    expect(closingChapterOf(JP_PACK, 'b_ch7_open')).toBeUndefined();
  });
  it('a two-tap diary line keeps its meaning on the Letter card; a typed one has none of its own', () => {
    const d = diaryLine(7, 0, 0);
    expect(diaryGloss(d.ja)).toEqual({ en: d.line.en, ar: d.line.ar });
    expect(diaryGloss('お祭りはとても楽しかったです。')).toBeUndefined();
  });
});

describe('wave C2: no audio is ever recorded or stored', () => {
  const files = ['screens/Letter.tsx', 'components/game/LetterCard.tsx', 'components/game/DiaryPrompt.tsx', 'components/game/SpeechRehearsal.tsx', 'game/letterLogic.ts', 'game/festivalSync.ts'];
  it.each(files)('%s uses the microphone for recognition only', (f) => {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    expect(src).not.toMatch(/MediaRecorder|getUserMedia|audio\/|AudioContext|createMediaStream/);
  });
});
