import { describe, expect, it } from 'vitest';
import { kanaToRomaji, normJa, romajiAsKana, romajiToHiragana, toHiragana, toKatakana } from '../src';

describe('kanaToRomaji', () => {
  it.each([
    ['こんにちは', 'konnichiha'], // particle spelling is overridden per lexicon entry, not guessed here
    ['ありがとう', 'arigatō'],
    ['おはようございます', 'ohayōgozaimasu'],
    ['コーヒー', 'kōhī'],
    ['ラーメン', 'rāmen'],
    ['ください', 'kudasai'],
    ['きょう', 'kyō'],
    ['がっこう', 'gakkō'],
    ['まっちゃ', 'matcha'],
    ['しんぶん', 'shinbun'],
    ['しんあい', "shin'ai"],
    ['じゃあ', 'jā'],
    ['せんせい', 'sensei'],
    ['ファミリー', 'famirī'],
  ])('%s -> %s', (kana, rom) => {
    expect(kanaToRomaji(kana)).toBe(rom);
  });
});

describe('romajiToHiragana', () => {
  it('parses Hepburn and Kunrei', () => {
    expect(romajiToHiragana('kohi o kudasai').kana).toBe('こひおくだ さい'.replace(' ', ''));
    expect(romajiToHiragana('shinbun').kana).toBe('しんぶん');
    expect(romajiToHiragana('sinbun').kana).toBe('しんぶん');
    expect(romajiToHiragana('gakkou').kana).toBe('がっこう');
    expect(romajiToHiragana('konnichiwa').kana).toBe('こんにちわ');
  });
  it('reports failure for English text', () => {
    expect(romajiToHiragana('coffee please').ok).toBe(false);
    expect(romajiAsKana('coffee please')).toBeNull();
  });
  it('detects clean romaji', () => {
    expect(romajiAsKana('arigatou gozaimasu')).toBe('ありがとうございます');
    expect(romajiAsKana('ありがとう')).toBeNull();
  });
});

describe('normJa', () => {
  it('is script- and punctuation-insensitive', () => {
    expect(normJa('コーヒーを ください。')).toBe(normJa('こーひーをください'));
    expect(normJa('ラーメン')).toBe('らめん');
    expect(normJa('ｺｰﾋｰ')).toBe('こひ');
  });
  it('round-trips kana scripts', () => {
    expect(toKatakana('ひらがな')).toBe('ヒラガナ');
    expect(toHiragana('カタカナ')).toBe('かたかな');
  });
});
