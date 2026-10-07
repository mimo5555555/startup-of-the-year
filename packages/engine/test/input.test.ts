// Input classification for numbers, number-aware matching and multi-slot matching (agent 1C; docs/GAME_DESIGN.md §6.2, §12.4, E17).
import { beforeAll, describe, expect, it } from 'vitest';
import { L, S, SLOTS, node, type IntentDef, type SlotOption } from '@lw/content';
import { classifyInput, findSlotJa, matchForms, matchGlobal, matchNodeIntent, normMatch, parseNumbersIn, setNumberParser } from '../src';
// the pack's language plugin is wired by the lead; the test pins the real reader so it does not depend on that wiring
import { parseNumbers } from '../../content/src/tokyo/game/jp-language';

beforeAll(() => setNumberParser(parseNumbers));

describe('classifyInput: a number is Japanese, not English', () => {
  const ja = (t: string) => classifyInput(t).kind === 'ja';
  it('bare digits, with separators, a yen sign or 円 / えん, in any width', () => {
    for (const t of ['60000', '450', '4,500', '24,800', '¥450', '￥450', '450円', '450えん', '450 円', '６００００', '４５０円', '  60000  ']) {
      expect(ja(t), t).toBe(true);
    }
  });
  it('keeps the text as the learner typed it', () => {
    expect(classifyInput(' 450円 ')).toEqual({ kind: 'ja', text: '450円' });
    expect(classifyInput('60000')).toEqual({ kind: 'ja', text: '60000' });
  });
  it('kanji and kana numbers were already Japanese', () => {
    for (const t of ['四百五十円', 'よんひゃくごじゅうえん', '六万円']) expect(ja(t), t).toBe(true);
  });
  it('everything else keeps its old route', () => {
    expect(classifyInput('Hello').kind).toBe('l1');
    expect(classifyInput("I'd like a coffee").kind).toBe('l1');
    expect(classifyInput('kohi o kudasai').kind).toBe('romaji');
    expect(classifyInput('أريد قهوة')).toMatchObject({ kind: 'l1', lang: 'ar' });
    // digits glued to words are not "only a number"
    expect(classifyInput('450 yen please').kind).toBe('l1');
    expect(classifyInput('2 coffees').kind).toBe('l1');
  });
});

describe('numbers are one token however they are written (§12.4)', () => {
  const same = (...forms: string[]) => {
    const [first, ...rest] = forms.map(normMatch);
    for (const f of rest) expect(f, forms.join(' = ')).toBe(first);
  };
  it('450円 = 四百五十円 = よんひゃくごじゅうえん', () => same('450円', '四百五十円', 'よんひゃくごじゅうえん', '４５０円', '¥450'));
  it('the irregular readings: 300 / 600 / 800 / 3,000 / 8,000', () => {
    same('300円', '三百円', 'さんびゃくえん');
    same('600円', '六百円', 'ろっぴゃくえん');
    same('800円', '八百円', 'はっぴゃくえん');
    same('3000円', '三千円', 'さんぜんえん', '3,000円');
    same('8000円', '八千円', 'はっせんえん');
  });
  it('a large price reads the same typed, written in kanji or said', () => same('60000円', '六万円', 'ろくまんえん', '60,000円'));
  it('different numbers stay different', () => {
    expect(normMatch('450円')).not.toBe(normMatch('540円'));
    expect(normMatch('300円')).not.toBe(normMatch('3000円'));
  });
  it('counters are left alone: 三番線 is not a price', () => {
    expect(normMatch('三番線')).toBe(normMatch('さんばんせん'));
    expect(parseNumbersIn('三番線').numbers).toEqual([]);
  });
  it('text without numbers normalises exactly as before', () => {
    expect(normMatch('コーヒーをください。')).toBe(normMatch('こーひーおください'));
    expect(normMatch('辛い')).toBe(normMatch('からい'));
  });
  it('fillers, long vowels and を/お fold (ありがとー = ありがとう)', () => {
    expect(normMatch('えーと、お願いします')).toBe(normMatch('お願いします'));
    expect(normMatch('ありがとー')).toBe(normMatch('ありがとう'));
    expect(normMatch('ずっと')).toBe(normMatch('づっと'));
  });
});

describe('matching reads the number out of the utterance (IntentHit.number)', () => {
  const total: IntentDef = { id: 'say_total', any: ['円', 'えん', '60000'], econ: 'say_total', next: 'done' };
  const nd = node({ id: 'q', say: [{ line: L('x', 'x', 'x') }], suggestions: [S('x', 'x', 'x'), S('y', 'y', 'y')], intents: [total] });
  const numberOf = (t: string) => matchNodeIntent(nd, t)?.number;
  it('digits, kanji and kana give the same integer', () => {
    for (const t of ['450円', '四百五十円', 'よんひゃくごじゅうえん', '450えん', '全部で450円です']) expect(numberOf(t), t).toBe(450);
    for (const t of ['60000円', '六万円', '60,000円', 'ろくまんえん']) expect(numberOf(t), t).toBe(60000);
    expect(numberOf('三千円')).toBe(3000);
    expect(numberOf('八百円')).toBe(800);
  });
  it('a bare number reaches an intent keyed on the same number, however the key is written', () => {
    expect(matchNodeIntent(nd, '60000')?.number).toBe(60000);
  });
  it('is absent when the utterance has no number', () => {
    const plain = node({ id: 'p', say: [{ line: L('x', 'x', 'x') }], suggestions: [S('x', 'x', 'x'), S('y', 'y', 'y')], intents: [{ id: 'yes', any: ['はい'], next: 'done' }] });
    expect(matchNodeIntent(plain, 'はい')?.number).toBeUndefined();
  });
  it('a keyword written with digits matches the kanji', () => {
    const k = node({ id: 'k', say: [{ line: L('x', 'x', 'x') }], suggestions: [S('x', 'x', 'x'), S('y', 'y', 'y')], intents: [{ id: 'five', any: ['450円'], next: 'done' }] });
    expect(matchNodeIntent(k, '四百五十円です')?.intent.id).toBe('five');
    expect(matchNodeIntent(k, '五百円です')).toBeNull();
  });
});

describe('alsoSlots fill extra slots from the same utterance', () => {
  const qty: SlotOption[] = [
    { id: 'one', ja: '一つ', gloss: { en: 'one', ar: 'واحد' }, keys: { ja: ['ひとつ', '一つ'], en: ['one'], ar: ['واحد'] } },
    { id: 'two', ja: '二つ', gloss: { en: 'two', ar: 'اثنان' }, keys: { ja: ['ふたつ', '二つ'], en: ['two'], ar: ['اثنان'] } },
  ];
  beforeAll(() => {
    SLOTS.zzQty = qty;
  });
  const order: IntentDef = { id: 'order', slot: 'item', slotOptions: ['coffee', 'onigiri'], slotRequired: true, alsoSlots: ['zzQty'], next: 'quote' };
  const nd = node({ id: 's', say: [{ line: L('x', 'x', 'x') }], suggestions: [S('x', 'x', 'x'), S('y', 'y', 'y')], intents: [order] });

  it('「コーヒーをふたつ」 fills item and qty', () => {
    const hit = matchNodeIntent(nd, 'コーヒーをふたつください');
    expect(hit?.option?.id).toBe('coffee');
    expect(hit?.also).toEqual([{ slot: 'zzQty', option: qty[1] }]);
  });
  it('a kanji count works too', () => expect(matchNodeIntent(nd, 'おにぎりを二つください')?.also?.[0].option.id).toBe('two'));
  it('never blocks the turn: without a count the intent still matches', () => {
    const hit = matchNodeIntent(nd, 'コーヒーをください');
    expect(hit?.intent.id).toBe('order');
    expect(hit?.also).toBeUndefined();
  });
  it('the count alone does not match the intent (the main slot is still required)', () => {
    expect(matchNodeIntent(nd, 'ふたつください')).toBeNull();
  });
  it('findSlotJa finds a slot option in either normal form', () => {
    expect(findSlotJa('zzQty', matchForms('ふたつです'))?.opt.id).toBe('two');
  });
});

describe('matching keeps its old tolerance', () => {
  const nd = node({ id: 'm', say: [{ line: L('x', 'x', 'x') }], suggestions: [S('x', 'x', 'x'), S('y', 'y', 'y')], intents: [{ id: 'coffee', slot: 'item', slotOptions: ['coffee'], slotRequired: true, next: 'n' }] });
  it('コーヒー is found when the long vowels are not typed (kohi)', () => {
    expect(matchNodeIntent(nd, 'こひをください')?.option?.id).toBe('coffee');
    expect(matchNodeIntent(nd, 'コーヒーをください')?.option?.id).toBe('coffee');
    expect(matchNodeIntent(nd, 'こおひいをください')?.option?.id).toBe('coffee');
  });
  it('a filler before the sentence changes nothing', () => {
    expect(matchNodeIntent(nd, 'えーと、コーヒーをください')?.option?.id).toBe('coffee');
  });
  it('global phrases still match through the new normal forms', () => {
    expect(matchGlobal('ありがとー')?.id).toBe('thanks');
    expect(matchGlobal('もう一度お願いします')?.id).toBe('repeat');
    expect(matchGlobal('ゆっくりお願いします')?.id).toBe('slow');
  });
});
