import { describe, expect, it } from 'vitest';
import { normJa } from '@lw/core';
import { numberToKana, speechNormalize, stripFillers, type NumberParser } from '../src';

const n = (s: string) => speechNormalize(s);

/** deterministic PRNG so failures reproduce */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KD = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** the usual kanji writing of 1..9999 (一 dropped before 十/百/千) */
function kanjiBelow10k(v: number): string {
  let out = '';
  const th = Math.floor(v / 1000);
  const hu = Math.floor((v % 1000) / 100);
  const te = Math.floor((v % 100) / 10);
  const on = v % 10;
  if (th) out += (th > 1 ? KD[th] : '') + '千';
  if (hu) out += (hu > 1 ? KD[hu] : '') + '百';
  if (te) out += (te > 1 ? KD[te] : '') + '十';
  return out + KD[on];
}
function toKanji(v: number): string {
  const man = Math.floor(v / 10000);
  const rest = v % 10000;
  return (man ? kanjiBelow10k(man) + '万' : '') + (rest ? kanjiBelow10k(rest) : '');
}
const withCommas = (v: number) => v.toLocaleString('en-US');

describe('numberToKana', () => {
  const table: Array<[number, string]> = [
    [0, 'ぜろ'],
    [1, 'いち'],
    [4, 'よん'],
    [7, 'なな'],
    [9, 'きゅう'],
    [10, 'じゅう'],
    [11, 'じゅういち'],
    [20, 'にじゅう'],
    [100, 'ひゃく'],
    [300, 'さんびゃく'],
    [600, 'ろっぴゃく'],
    [800, 'はっぴゃく'],
    [450, 'よんひゃくごじゅう'],
    [1000, 'せん'],
    [3000, 'さんぜん'],
    [8000, 'はっせん'],
    [2980, 'にせんきゅうひゃくはちじゅう'],
    [10000, 'いちまん'],
    [24800, 'にまんよんせんはっぴゃく'],
    [198000, 'じゅうきゅうまんはっせん'],
    [1211910, 'ひゃくにじゅういちまんせんきゅうひゃくじゅう'],
    [100000000, 'いちおく'],
  ];
  it.each(table)('%i', (v, kana) => expect(numberToKana(v)).toBe(kana));
  it('rejects negatives, fractions and absurd sizes', () => {
    expect(() => numberToKana(-1)).toThrow();
    expect(() => numberToKana(1.5)).toThrow();
    expect(() => numberToKana(1e16)).toThrow();
  });
});

describe('speechNormalize: numbers (the §12.4 price rule)', () => {
  it('450円, 四百五十円 and よんひゃくごじゅうえん are one token', () => {
    const want = 'よんひゃくごじゅうえん';
    for (const w of ['450円', '４５０円', '四百五十円', 'よんひゃくごじゅうえん', 'ヨンヒャクゴジュウエン', '450えん', '¥450', '￥450', '四五〇円', '450 円']) expect(n(w)).toBe(want);
  });

  const irregular: Array<[number, string[]]> = [
    [300, ['300円', '三百円', 'さんびゃくえん', 'さんひゃくえん']], // a sloppy さんひゃく is still 300
    [600, ['600円', '六百円', 'ろっぴゃくえん', 'ろくひゃくえん']],
    [800, ['800円', '八百円', 'はっぴゃくえん', 'はちひゃくえん']],
    [3000, ['3000円', '3,000円', '三千円', 'さんぜんえん', 'さんせんえん']],
    [8000, ['8000円', '8,000円', '八千円', 'はっせんえん', 'はちせんえん']],
  ];
  it.each(irregular)('irregular %i reads one way however it is written', (v, forms) => {
    const want = numberToKana(v) + 'えん';
    for (const f of forms) expect(n(f), f).toBe(want);
  });

  it('1,000 and 10,000, with and without the leading いち', () => {
    for (const f of ['1000円', '1,000円', '千円', '一千円', 'せんえん', 'いっせんえん'.replace('いっせん', 'せん')]) expect(n(f), f).toBe('せんえん');
    for (const f of ['10000円', '10,000円', '1万円', '一万円', '万円', 'いちまんえん', 'まんえん']) expect(n(f), f).toBe('いちまんえん');
  });

  it('a final 4 before 円 is よ: 4円, 14円, but 400円 keeps よん', () => {
    expect(n('4円')).toBe('よえん');
    expect(n('四円')).toBe('よえん');
    expect(n('よえん')).toBe('よえん');
    expect(n('14円')).toBe('じゅうよえん');
    expect(n('400円')).toBe('よんひゃくえん');
    expect(n('よんえん')).toBe('よえん');
  });

  it('prices inside a sentence', () => {
    expect(n('これは450円です')).toBe(n('これは四百五十円です'));
    expect(n('合計は2,980円です。')).toBe(n('ごうけいはにせんきゅうひゃくはちじゅうえんです'.replace('ごうけい', '合計')));
    expect(n('1万5000円')).toBe('いちまんごせんえん');
    expect(n('1万5千円')).toBe('いちまんごせんえん');
    expect(n('三万円')).toBe('さんまんえん');
  });

  it('zero, decimals, ids and phone numbers', () => {
    expect(n('0')).toBe('ぜろ');
    expect(n('3.5')).toBe('さんてんご');
    expect(n('0.05')).toBe('ぜろてんぜろご');
    expect(n('090')).toBe('ぜろきゅうぜろ');
    expect(n('0312345678')).toBe('ぜろさんいちにさんよんごろくななはち');
  });

  it('a lone kanji digit is a number only before 円 or a counter', () => {
    expect(n('一緒に')).toBe('一緒に');
    expect(n('五反田')).toBe('五反田');
    expect(n('五円')).toBe('ごえん');
    expect(n('三人')).toBe('さん人');
    expect(n('3人')).toBe('さん人');
  });

  it('kana that merely look like numbers stay words', () => {
    expect(n('ごはん')).toBe('ごはん');
    expect(n('いちご')).toBe('いちご');
    expect(n('にほん')).toBe('にほん');
    expect(n('じゅうしょ')).toBe('じゅうしょ');
    expect(n('しじゅう')).toBe('しじゅう'); // し is not read as 4 outside よえん
    expect(n('ごえん')).toBe('ごえん');
    expect(n('まんが')).toBe('まんが'); // まん is 10,000 only as まんえん
    expect(n('これをください')).toBe('これおください'); // ...おく... is not 億
    expect(n('おくさん')).toBe('おくさん');
    expect(n('じゅうじゅう')).toBe('じゅうじゅう'); // not a well-formed number
    expect(n('せんせい')).toBe('せんせえ');
  });

  it('an injected parseNumbers runs first and its rewritten text is finished by the built-in unifier', () => {
    const calls: string[] = [];
    const parser: NumberParser = (t) => {
      calls.push(t);
      return { text: t.replace('よんひゃくごじゅう', '450'), numbers: [450] };
    };
    expect(speechNormalize('よんひゃくごじゅうえん', { parseNumbers: parser })).toBe('よんひゃくごじゅうえん');
    expect(calls).toEqual(['よんひゃくごじゅうえん']);
    // a parser that returns canonical kana is accepted too
    const kana: NumberParser = (t) => ({ text: t.replace('450', 'よんひゃくごじゅう'), numbers: [450] });
    expect(speechNormalize('450円', { parseNumbers: kana })).toBe('よんひゃくごじゅうえん');
  });

  it('property: digits, commas and kanji all normalise like the kana reading, for random prices', () => {
    const r = rng(7);
    for (let i = 0; i < 400; i++) {
      const digits = 1 + Math.floor(r() * 8);
      const v = 1 + Math.floor(r() * Math.pow(10, digits));
      const want = n(`${v}円`);
      expect(n(`${withCommas(v)}円`), String(v)).toBe(want);
      expect(n(`${toKanji(v)}円`), `${v} ${toKanji(v)}`).toBe(want);
      expect(n(`${numberToKana(v)}えん`), `${v} ${numberToKana(v)}`).toBe(want);
    }
  });
});

describe('speechNormalize: kana folding, long vowels, punctuation', () => {
  it('katakana folds to hiragana, half-width and full-width forms to NFKC', () => {
    expect(n('コンニチハ')).toBe('こんにちは');
    expect(n('ｺﾝﾆﾁﾊ')).toBe('こんにちは');
    expect(n('ＡＢＣ')).toBe('abc');
    expect(n('ハンバーガー')).toBe('はんばあがあ');
  });

  it('ー and う/お/い are the same long vowel: ありがとー = ありがとう', () => {
    expect(n('ありがとー')).toBe(n('ありがとう'));
    expect(n('ありがとお')).toBe(n('ありがとう'));
    expect(n('コーヒー')).toBe(n('こおひい'));
    expect(n('こうひい')).toBe(n('コーヒー'));
    expect(n('せんせー')).toBe(n('せんせい'));
    expect(n('とーきょー')).toBe(n('東京'.replace('東京', 'とうきょう')));
    expect(n('きょーは')).toBe(n('きょうは'));
    expect(n('じゅー')).toBe(n('じゅう'));
  });

  it('ー after ん, っ, latin text or at the start has nothing to lengthen', () => {
    expect(n('ーあ')).toBe('あ');
    expect(n('んー')).toBe(''); // a hesitation
    expect(n('かっー')).toBe('かっ');
    expect(n('wi-fi')).toBe('wifi');
  });

  it('を/お, づ/ず, ぢ/じ', () => {
    expect(n('これをください')).toBe(n('これおください'));
    expect(n('つづく')).toBe(n('つずく'));
    expect(n('はなぢ')).toBe(n('はなじ'));
    expect(n('こづつみ')).toBe(n('こずつみ'));
  });

  it('punctuation, brackets, spaces and symbols are dropped', () => {
    expect(n('「こんにちは！」')).toBe('こんにちは');
    expect(n(' これ を ください。 ')).toBe('これおください');
    expect(n('すみません…？')).toBe('すみません');
    expect(n('いくら〜?')).toBe('いくら');
    expect(n('')).toBe('');
    expect(n('、。')).toBe('');
  });

  it('is a superset of the legacy normJa on plain kana: same string, same result', () => {
    for (const w of ['これをください', 'いくらですか', 'ふくろはいりません', 'おねがいします', 'レシトをおねがいします']) {
      expect(n(w)).toBe(normJa(w));
    }
  });
});

describe('stripFillers / speechNormalize: fillers', () => {
  it('drops hesitations at the start and after a clause break', () => {
    expect(n('えーと、これをください')).toBe(n('これをください'));
    expect(n('えっとコーヒーをください')).toBe(n('コーヒーをください'));
    expect(n('あのー、すみません')).toBe(n('すみません'));
    expect(n('あのう、すみません')).toBe(n('すみません'));
    expect(n('うーん、いくらですか')).toBe(n('いくらですか'));
    expect(n('ええと、あのー、これ')).toBe(n('これ'));
    expect(n('えーとあのーこれ')).toBe(n('これ'));
    expect(n('これ、えーと、ください')).toBe(n('これください'));
    expect(n('エート、ください'.replace('エート', 'ええっと'))).toBe(n('ください'));
  });

  it('keeps words that only begin like a filler', () => {
    expect(n('あの人は先生です')).toBe(n('あの人は先生です'));
    expect(n('あの人')).toContain('人');
    expect(n('ケーキをください')).toBe('けえきおください');
    expect(n('ええ、そうです')).toBe(n('ええそうです'));
    expect(n('ええ')).toBe('ええ');
  });

  it('stripFillers changes nothing but the fillers', () => {
    expect(stripFillers('えーと、これをください。')).toBe('これをください。');
    expect(stripFillers('あのー…ハンバーガー')).toBe('ハンバーガー');
    expect(stripFillers('これをください')).toBe('これをください');
    expect(stripFillers('あの、')).toBe('');
    expect(stripFillers('')).toBe('');
  });
});

describe('speechNormalize: properties', () => {
  const pieces = ['えーと、', 'あのー', '450円', '四百五十円', 'よんひゃくごじゅうえん', 'コーヒー', 'ありがとー', 'これを', 'ください', '。', '、', ' ', 'せん', '三百', 'さんびゃく', '5万', 'ごえん', '一', '人', 'ー', 'づ', 'ＡＢＣ', 'じゅう', 'ひゃく'];
  const sample = (r: () => number) => Array.from({ length: 1 + Math.floor(r() * 8) }, () => pieces[Math.floor(r() * pieces.length)]).join('');

  it('is idempotent', () => {
    const r = rng(42);
    for (let i = 0; i < 1500; i++) {
      const s = sample(r);
      const once = n(s);
      expect(n(once), JSON.stringify(s)).toBe(once);
    }
  });

  it('is deterministic and never throws on arbitrary code points', () => {
    const r = rng(9);
    for (let i = 0; i < 300; i++) {
      const s = String.fromCodePoint(...Array.from({ length: 12 }, () => 0x20 + Math.floor(r() * 0x3100)));
      expect(n(s)).toBe(n(s));
    }
  });

  it('leaves no punctuation, whitespace or ー behind', () => {
    const r = rng(3);
    for (let i = 0; i < 500; i++) expect(n(sample(r))).not.toMatch(/[\s、。,.!！?？ー「」]/);
  });
});
