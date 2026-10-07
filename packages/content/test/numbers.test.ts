import { describe, expect, it } from 'vitest';
import { BALANCE, haggleLimit, menuPrice, type GamePack, type MenuItem } from '@lw/game';
import { LEXICON, LEXICON_PARTS, resolveLine, speakableText, tokenize, type Token } from '../src';
import { NUMBERS_LEXICON, NUMBER_READINGS, NUMERAL_TOKEN } from '../src/lexicon/numbers';
import { JP_AGE_PROFILES, JP_CURRENCY, JP_ECONOMY, JP_RULES, JP_TAX } from '../src/tokyo/game/economy';
import { JA_NUMBER_MAX, JP_LANGUAGE, YEN_MAX, numberTokens, parseJaNumber, parseNumbers, readNumber, setSpeechNormalizer, yenToJa } from '../src/tokyo/game/jp-language';

/** Every price and money amount named in docs/GAME_DESIGN.md §4-§5 plus the derived ones (eat-in, fees, haggle, floors, caps). */
const PRICES: number[] = [
  // §5.1 menu: konbini, cafe, ramen, vending
  160, 110, 320, 580, 150, 330, 130, 450, 420, 400, 520, 480, 900, 950, 1050, 100, 120, 380,
  // §5.4 fares and fees
  170, 190, 210, 230, 260, 10, 500, 1000, 2000, 3000, 5000, 220, 2200, 600, 20000,
  // §5.2 catalog
  1990, 2490, 4990, 5990, 7990, 12900, 8900, 9900, 6900, 19800, 24800, 1980, 128000, 2980, 89000, 198000, 148000, 50000, 548000, 458000, 90000,
  60000, 30000, 8000, 6000, 4500, 1200, 7000, 3500,
  // §5.3 gifts
  680, 1280, 1100, 800, 300, 3300, 220,
  // derived: eat-in, haggle, floors, caps, totals
  458, 8880, 3552, 189120, 181120, 18000, 14000, 9999999, 1211910, 446910, 248910, 765000, 12000, 2780, 21600,
  // every irregular and boundary
  1, 4, 7, 9, 11, 14, 40, 44, 99, 101, 303, 306, 308, 333, 404, 600, 666, 808, 888, 3000, 3003, 8000, 8008, 10000, 10001, 40000, 40400, 100000, 300000, 800000, 1000000, 3333333, 8888888,
];
const UNIQUE_PRICES = [...new Set(PRICES)];

/** What a TTS engine or a learner's reading aloud would be compared with: the reading of the markup. */
const reading = (n: number) => yenToJa(n).reading;

describe('yenToJa: the spec examples (§14.4)', () => {
  it('splits into 万 groups, drops 一 before 十/百/千 and keeps 一万', () => {
    const m = (n: number) => yenToJa(n).markup;
    expect(m(160)).toBe('百|六|十|円');
    expect(m(450)).toBe('四|百|五|十|円');
    expect(m(1050)).toBe('千|五|十|円');
    expect(m(10000)).toBe('一|万|円');
    expect(m(198000)).toBe('十|九|万|八千|円');
    expect(m(24800)).toBe('二|万|四|千|八百|円');
    expect(m(1)).toBe('一|円');
    expect(m(110000)).toBe('十|一|万|円');
  });
  it('irregular compounds are single tokens with their rendaku/sokuon reading', () => {
    const cases: Array<[number, string, string]> = [
      [300, '三百|円', 'さんびゃくえん'],
      [600, '六百|円', 'ろっぴゃくえん'],
      [800, '八百|円', 'はっぴゃくえん'],
      [3000, '三千|円', 'さんぜんえん'],
      [8000, '八千|円', 'はっせんえん'],
    ];
    for (const [n, markup, kana] of cases) expect(yenToJa(n)).toMatchObject({ markup, reading: kana });
  });
  it('readings: 4 yen is よえん, 14 is じゅうよえん, 40 stays よんじゅう', () => {
    expect(reading(4)).toBe('よえん');
    expect(reading(14)).toBe('じゅうよえん');
    expect(reading(40)).toBe('よんじゅうえん');
    expect(reading(400)).toBe('よんひゃくえん');
    expect(reading(4000)).toBe('よんせんえん');
    expect(reading(24800)).toBe('にまんよんせんはっぴゃくえん');
    expect(reading(160)).toBe('ひゃくろくじゅうえん');
    expect(reading(450)).toBe('よんひゃくごじゅうえん');
  });
  it('the gloss carries grouped Latin digits in both languages', () => {
    expect(yenToJa(24800).gloss).toEqual({ en: '24,800 yen', ar: '24,800 ين' });
    expect(yenToJa(450).gloss).toEqual({ en: '450 yen', ar: '450 ين' });
    expect(yenToJa(9_999_999).gloss.en).toBe('9,999,999 yen');
  });
  it('is defined for 1..9,999,999 only', () => {
    for (const bad of [0, -1, 10_000_000, 1.5, Number.NaN, Infinity]) expect(() => yenToJa(bad)).toThrow(RangeError);
    expect(yenToJa(YEN_MAX).markup.endsWith('円')).toBe(true);
  });
});

describe('round trip: parseJaNumber(reading(yenToJa(n))) === n', () => {
  it(`a table of ${UNIQUE_PRICES.length} prices from §4-§5`, () => {
    expect(UNIQUE_PRICES.length).toBeGreaterThanOrEqual(80);
    for (const n of UNIQUE_PRICES) {
      const y = yenToJa(n);
      expect(parseJaNumber(y.reading), `${n} reading ${y.reading}`).toBe(n);
      // the kanji the learner reads, and the digits they would type
      expect(parseJaNumber(y.markup.replaceAll('|', '')), `${n} kanji`).toBe(n);
      expect(parseJaNumber(String(n)), `${n} digits`).toBe(n);
      expect(parseJaNumber(`${n}円`)).toBe(n);
      expect(parseJaNumber(`¥${n.toLocaleString('en-US')}`)).toBe(n);
    }
  });
  it('every number up to 100,000 and a seeded sample of the rest of the wallet range', () => {
    for (let n = 1; n <= 100_000; n++) {
      const got = parseJaNumber(reading(n));
      if (got !== n) throw new Error(`${n}: ${reading(n)} parsed as ${got}`);
    }
    let a = 12345;
    for (let i = 0; i < 20_000; i++) {
      a = (Math.imul(a, 1103515245) + 12345) >>> 0;
      const n = 100_001 + (a % (YEN_MAX - 100_000));
      if (parseJaNumber(reading(n)) !== n) throw new Error(`${n}: ${reading(n)}`);
      if (parseJaNumber(yenToJa(n).markup.replaceAll('|', '')) !== n) throw new Error(`${n} kanji`);
    }
  });
  it('readNumber agrees with the reading of the price minus the yen (a final 四 is よん alone, よ before 円)', () => {
    for (const n of UNIQUE_PRICES) expect(reading(n)).toBe(n % 10 === 4 ? readNumber(n).replace(/よん$/, 'よ') + 'えん' : readNumber(n) + 'えん');
  });
});

describe('tokens are lexicon entries with EN + AR', () => {
  it('every token of every price in the table resolves with a reading, English and Arabic', () => {
    const seen = new Set<string>();
    for (const n of [...UNIQUE_PRICES, ...Array.from({ length: 2000 }, (_, i) => i + 1)]) {
      const { tokens, missing } = tokenize(yenToJa(n).markup, LEXICON);
      expect(missing, `${n}`).toEqual([]);
      for (const t of tokens) {
        if (seen.has(t.s)) continue;
        seen.add(t.s);
        const e = LEXICON.get(t.s)!;
        expect(e, t.s).toBeDefined();
        expect(e.en.length, t.s).toBeGreaterThan(0);
        expect(e.ar.length, t.s).toBeGreaterThan(0);
        expect(e.r, `${t.s} reading`).toBeTruthy();
      }
    }
    // the whole numeral vocabulary is reached
    expect([...seen].sort()).toEqual(['一', '七', '万', '三', '三千', '三百', '九', '二', '五', '八', '八千', '八百', '六', '六百', '十', '千', '四', '円', '百'].sort());
  });
  it('the module defines every numeral, the irregulars and the price words, each with a kana reading', () => {
    const by = new Map(NUMBERS_LEXICON.map((e) => [e.s, e]));
    for (const s of ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万', '円', '三百', '六百', '八百', '三千', '八千', '何円', '合計', 'お釣り', '税込']) {
      const e = by.get(s);
      expect(e, s).toBeDefined();
      expect(e!.r, `${s} reading`).toMatch(/^[ぁ-ゟー]+$/);
      expect(e!.en && e!.ar, s).toBeTruthy();
    }
    expect(by.get('三百')!.r).toBe('さんびゃく');
    expect(by.get('六百')!.r).toBe('ろっぴゃく');
    expect(by.get('八百')!.r).toBe('はっぴゃく');
    expect(by.get('三千')!.r).toBe('さんぜん');
    expect(by.get('八千')!.r).toBe('はっせん');
    expect(by.get('何円')!.r).toBe('なんえん');
    expect(by.get('お釣り')!.r).toBe('おつり');
  });
  it('the shared reading table is exactly the numeral entries, and no other module defines these surfaces', () => {
    for (const [s, r] of Object.entries(NUMBER_READINGS)) expect(LEXICON.get(s)?.r, s).toBe(r);
    const mine = new Set(NUMBERS_LEXICON.map((e) => e.s));
    expect(mine.size).toBe(NUMBERS_LEXICON.length);
    for (const [mod, entries] of Object.entries(LEXICON_PARTS)) {
      if (mod === 'numbers') continue;
      expect(entries.filter((e) => mine.has(e.s)).map((e) => `${mod}:${e.s}`)).toEqual([]);
    }
    for (const s of Object.keys(NUMBER_READINGS)) expect(NUMERAL_TOKEN.test(s)).toBe(true);
  });
});

describe('parseJaNumber', () => {
  const ok: Array<[string, number]> = [
    ['450円', 450],
    ['450', 450],
    ['4,50', 450],
    ['24,800', 24800],
    ['¥24,800', 24800],
    ['￥24,800', 24800],
    ['２４，８００円', 24800],
    ['四百五十円', 450],
    ['よんひゃくごじゅうえん', 450],
    ['ヨンヒャクゴジュウエン', 450],
    ['2万4千', 24000],
    ['2万4千8百円', 24800],
    ['二万四千八百円', 24800],
    ['にまんよんせんはっぴゃくえん', 24800],
    ['ろっぴゃく', 600],
    ['ろくひゃく', 600],
    ['さんびゃくえん', 300],
    ['さんぜんえん', 3000],
    ['はっせん', 8000],
    ['せんえん', 1000],
    ['ひゃくえん', 100],
    ['じゅうえん', 10],
    ['いちまんえん', 10000],
    ['一万', 10000],
    ['十万円', 100000],
    ['よえん', 4],
    ['四五〇', 450],
    ['百九十円', 190],
    ['二千円', 2000],
    ['１２０円', 120],
    ['  450 円 ', 450],
    ['4万', 40000],
    ['五百', 500],
    ['0', 0],
    ['ぜろ', 0],
  ];
  it.each(ok)('%s -> %i', (text, n) => expect(parseJaNumber(text)).toBe(n));
  const bad = ['', '円', 'abc', '百百', '十百', '三万万', '24千', '3.5', '-5', 'ごはん', 'こんにちは', '450個', '一二三万', '100000000', '百万万'];
  it.each(bad)('%s is not a number', (text) => expect(parseJaNumber(text)).toBeNull());
  it('never throws, whatever the input', () => {
    for (const t of ['\u0000', '😀', '１２３円円', '円円', '..', '١٢٣', 'じゅうじゅう', '万万万', '9'.repeat(40)]) expect(() => parseJaNumber(t)).not.toThrow();
  });
  it('the upper bound of the domain is 99,999,999', () => {
    expect(parseJaNumber(String(JA_NUMBER_MAX))).toBe(JA_NUMBER_MAX);
    expect(parseJaNumber(String(JA_NUMBER_MAX + 1))).toBeNull();
  });
});

describe('readNumber and numberTokens', () => {
  it('the spec example', () => {
    expect(readNumber(2980)).toBe('にせんきゅうひゃくはちじゅう');
    expect(readNumber(0)).toBe('ぜろ');
    expect(numberTokens(2980)).toEqual(['二', '千', '九', '百', '八', '十']);
  });
  it('rejects what it cannot say', () => {
    for (const bad of [-1, 1.5, JA_NUMBER_MAX + 1]) expect(() => readNumber(bad)).toThrow(RangeError);
  });
});

describe('parseNumbers (free text, §12.4)', () => {
  it('unifies digits, kanji and kana prices to one string', () => {
    const forms = ['450円', '四百五十円', 'よんひゃくごじゅうえん', '¥450'];
    const outs = forms.map((f) => parseNumbers(f));
    for (const o of outs) {
      expect(o.numbers).toEqual([450]);
      expect(o.text).toBe('よんひゃくごじゅうえん');
    }
  });
  it('rewrites only the number, in a sentence', () => {
    expect(parseNumbers('これは450円です')).toEqual({ text: 'これはよんひゃくごじゅうえんです', numbers: [450] });
    expect(parseNumbers('60000')).toEqual({ text: 'ろくまん', numbers: [60000] });
    expect(parseNumbers('二万円と三千円')).toMatchObject({ numbers: [20000, 3000] });
  });
  it('leaves counters, words and plain text alone', () => {
    for (const t of ['三番線です', 'ごはんをください', 'こんにちは', '二十分かかります', 'おいしい']) expect(parseNumbers(t)).toEqual({ text: t, numbers: [] });
  });
  it('a kana number alone, with units, counts (the learner answers "ろっぴゃく")', () => {
    expect(parseNumbers('ろっぴゃくです').numbers).toEqual([600]);
  });
});

describe('JP_LANGUAGE (LanguagePlugin, §14.3)', () => {
  it('delegates to the number functions', () => {
    expect(JP_LANGUAGE.readNumber(2980)).toBe('にせんきゅうひゃくはちじゅう');
    expect(JP_LANGUAGE.priceMarkup(450, JP_CURRENCY)).toEqual(yenToJa(450));
    expect(JP_LANGUAGE.parseNumbers('450円').numbers).toEqual([450]);
  });
  it('speechNormalize folds fillers, punctuation, katakana, ー and numbers', () => {
    const n = JP_LANGUAGE.speechNormalize;
    expect(n('えーと、450円ください。')).toBe(n('四百五十円ください'));
    expect(n('コーヒー')).toBe(n('こうひい'));
    expect(n('ラーメン')).toBe(n('らあめん'));
    expect(n('  ください！ ')).toBe('ください');
  });
  it('the engine can swap in a richer normaliser and restore the basic one', () => {
    setSpeechNormalizer((t) => `[${t}]`);
    expect(JP_LANGUAGE.speechNormalize('x')).toBe('[x]');
    setSpeechNormalizer(null);
    expect(JP_LANGUAGE.speechNormalize('x')).toBe('x');
  });
  it('register markers: every register lists good and bad forms, and no form is both good and bad in one register', () => {
    for (const reg of ['casual', 'polite', 'keigo'] as const) {
      const { good, bad } = JP_LANGUAGE.registerMarkers[reg];
      expect(good.length).toBeGreaterThan(0);
      expect(bad.length).toBeGreaterThan(0);
      expect(good.filter((g) => bad.includes(g))).toEqual([]);
    }
  });
});

describe('speakableText reads prices by their kana (§14.4)', () => {
  const say = (n: number) => speakableText(tokenize(yenToJa(n).markup, LEXICON).tokens);
  it('rendaku and sokuon come out right for TTS', () => {
    expect(say(300)).toBe('さんびゃくえん');
    expect(say(600)).toBe('ろっぴゃくえん');
    expect(say(800)).toBe('はっぴゃくえん');
    expect(say(3000)).toBe('さんぜんえん');
    expect(say(8000)).toBe('はっせんえん');
    expect(say(4)).toBe('よえん');
    expect(say(24800)).toBe('にまんよんせんはっぴゃくえん');
  });
  it('equals the reading of the markup for every price in the table', () => {
    for (const n of UNIQUE_PRICES) expect(say(n)).toBe(reading(n));
  });
  it('a price inside a line: the rest of the line keeps its written form', () => {
    const line = resolveLine({ ja: 'これは|{price}|です。', en: 'It is {price}.', ar: '{price}' }, LEXICON, { price: { ja: yenToJa(800).markup, gloss: yenToJa(800).gloss } });
    expect(line.plain).toBe('これははっぴゃくえんです。');
    expect(line.written).toBe('これは八百円です。');
    expect(line.en).toBe('It is 800 yen.');
    expect(line.ar).toBe('800 ين');
  });
  it('numerals that are not a price keep their written form: the counter picks its reading (九時, 十四日)', () => {
    const tok = (s: string): Token => ({ s, rom: s });
    expect(speakableText([tok('九'), tok('時')])).toBe('九時');
    expect(speakableText([tok('十'), tok('四'), tok('日')])).toBe('十四日');
    expect(speakableText([tok('八百'), tok('屋')])).toBe('八百屋');
  });
  it('unchanged for everything else: plain text, punctuation and Arabic names left out', () => {
    expect(speakableText(tokenize('いらっしゃいませ。', LEXICON).tokens)).toBe('いらっしゃいませ。');
    expect(speakableText([{ s: 'ليلى', rom: 'layla', raw: true }, { s: 'です', rom: 'desu' }])).toBe('です');
    expect(speakableText([])).toBe('');
  });
  it('an authored tts override still wins', () => {
    expect(resolveLine({ ja: '百|円', en: '', ar: '', tts: 'ひゃくえん' }, LEXICON).plain).toBe('ひゃくえん');
  });
});

describe('JP economy data (economy.ts)', () => {
  it('copies the BALANCE reference values (content cannot import them at runtime)', () => {
    expect(JP_ECONOMY.startCash).toBe(BALANCE.startCash);
    expect(JP_ECONOMY.walletCap).toBe(BALANCE.walletCap);
    expect(JP_ECONOMY.refWage).toBe(BALANCE.refWage);
    expect(JP_ECONOMY.incomeScale).toBe(JP_ECONOMY.refWage / BALANCE.refWage);
    expect(JP_ECONOMY.icCap).toEqual({ early: BALANCE.icCap.early, late: BALANCE.icCap.late });
    expect(JP_RULES.negotiation.motors).toEqual({ maxPct: BALANCE.haggle.pct, maxAmount: BALANCE.haggle.max, assistedShare: BALANCE.haggle.assisted, items: ['car_kei_used', 'car_kei_good'] });
    expect(JP_ECONOMY.walletCap).toBe(YEN_MAX);
    expect(JP_CURRENCY).toMatchObject({ code: 'JPY', symbol: '¥', minorPerMajor: 1, spoken: '円' });
  });
  it('rules: no haggling except the car dealer, no tipping, delivery 2,200, bicycle registration 600', () => {
    expect(Object.keys(JP_RULES.negotiation)).toEqual(['motors']);
    expect(JP_RULES).toMatchObject({ tipping: 'none', shoesOff: true, pointsCard: true, deliveryFee: 2200, registrationFee: 600 });
    const pack = { rules: JP_RULES } as unknown as GamePack;
    expect(haggleLimit(pack, 'motors', 148_000, false)).toBe(8880);
    expect(haggleLimit(pack, 'motors', 148_000, true)).toBe(3552);
    expect(haggleLimit(pack, 'konbini', 148_000, false)).toBe(0);
  });
  it('tax: inclusive, take-out 8%, eat-in 10%: a 450 yen coffee is 458 eating in', () => {
    expect(JP_TAX).toMatchObject({ inclusive: true, takeOutRate: 0.08, eatInRate: 0.1 });
    expect(JP_TAX.rates).toEqual({ standard: 0.1, food: 0.08 });
    const coffee = { id: 'cafe:coffee', shop: 'cafe', slot: 'item', option: 'coffee', name: { ja: 'コーヒー', en: 'Coffee', ar: 'قهوة' }, price: 450, taxClass: 'food', eatInCapable: true, tags: [] } as MenuItem;
    expect(menuPrice(coffee, JP_TAX, true)).toBe(458);
    expect(menuPrice(coffee, JP_TAX, false)).toBe(450);
  });
  it('age profiles follow the §11.9 table', () => {
    const a = JP_AGE_PROFILES;
    expect(Object.keys(a).sort()).toEqual(['adults', 'kids', 'seniors', 'teens']);
    expect([a.kids.dailyGoals, a.teens.dailyGoals, a.adults.dailyGoals, a.seniors.dailyGoals]).toEqual([2, 3, 3, 3]);
    expect([a.kids.ttsRate, a.teens.ttsRate, a.adults.ttsRate, a.seniors.ttsRate]).toEqual([0.8, 0.92, 1, 0.85]);
    expect([a.kids.echoThreshold, a.teens.echoThreshold, a.adults.echoThreshold, a.seniors.echoThreshold]).toEqual([0.55, 0.6, 0.7, 0.6]);
    expect([a.kids.newCardsPerDay, a.teens.newCardsPerDay, a.adults.newCardsPerDay, a.seniors.newCardsPerDay]).toEqual([5, 8, 8, 6]);
    expect([a.kids.textScale, a.seniors.textScale, a.seniors.minTapPx]).toEqual([1.15, 1.3, 52]);
    expect(a.kids).toMatchObject({ voiceDefault: 'off', adultGate: true, walletStyle: 'coins', adultTopics: false });
    expect(a.teens).toMatchObject({ voiceDefault: 'consent', adultGate: false, adultTopics: false });
    expect(a.adults.adultTopics && a.seniors.adultTopics).toBe(true);
    // the flat and the cars (ageMin 18) are hidden for kids and teens only
    expect([a.kids.ageFloor, a.teens.ageFloor, a.adults.ageFloor, a.seniors.ageFloor].map((f) => f >= 18)).toEqual([false, false, true, true]);
    for (const p of Object.values(a)) expect(p.minTapPx).toBeGreaterThanOrEqual(44);
  });
});
