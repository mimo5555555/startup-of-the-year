import { describe, expect, it } from 'vitest';
import { normJa } from '@lw/core';
import { BALANCE } from '@lw/game';
import {
  DEFAULT_SPEECH_POLICY,
  SIMILARITY_GREAT,
  alternativesOf,
  bestAlternativeScore,
  confidenceBucket,
  isReliableSpeech,
  lev,
  levenshtein,
  lexiconTokens,
  pickBestAlternative,
  selectBestAlternative,
  similarityVerdict,
  speechSimilarity,
  tokenDice,
} from '../src';

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
const HIRA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわんがぎぐげござじずぜぞだでどばびぶべぼ';
const randKana = (r: () => number, max = 10) => Array.from({ length: Math.floor(r() * (max + 1)) }, () => HIRA[Math.floor(r() * HIRA.length)]).join('');

/** the similarity() that lived in Conversation.tsx before §12.4 moved it here */
function legacySimilarity(a: string, b: string): number {
  const x = normJa(a);
  const y = normJa(b);
  if (!x || !y) return 0;
  const dp = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)] as number[]);
  for (let j = 1; j <= y.length; j++) dp[0][j] = j;
  for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
  return 1 - dp[x.length][y.length] / Math.max(x.length, y.length);
}

describe('levenshtein', () => {
  it.each([
    ['', '', 0],
    ['', 'あい', 2],
    ['あい', '', 2],
    ['kitten', 'sitting', 3],
    ['これをください', 'これおください', 1],
    ['ありがとう', 'ありがとうございます', 5],
  ])('%j vs %j = %i', (a, b, d) => {
    expect(levenshtein(a, b)).toBe(d);
  });

  it('counts code points, not UTF-16 units (an astral kanji is one edit)', () => {
    expect(levenshtein('𠮷野家', '吉野家')).toBe(1);
    expect(levenshtein('😀', 'a')).toBe(1);
  });

  it('lev is the same function (the §3.2 name 1C reuses)', () => {
    expect(lev).toBe(levenshtein);
  });

  it('property: identity, symmetry, triangle inequality and the length bounds', () => {
    const r = rng(11);
    for (let i = 0; i < 400; i++) {
      const a = randKana(r);
      const b = randKana(r);
      const c = randKana(r);
      expect(levenshtein(a, a)).toBe(0);
      expect(levenshtein(a, b)).toBe(levenshtein(b, a));
      expect(levenshtein(a, c)).toBeLessThanOrEqual(levenshtein(a, b) + levenshtein(b, c));
      const [la, lb] = [Array.from(a).length, Array.from(b).length];
      expect(levenshtein(a, b)).toBeGreaterThanOrEqual(Math.abs(la - lb));
      expect(levenshtein(a, b)).toBeLessThanOrEqual(Math.max(la, lb));
    }
  });
});

describe('speechSimilarity', () => {
  it('is 1 for the same text and 0 when either side has nothing left after normalising', () => {
    expect(speechSimilarity('ありがとうございます', 'ありがとうございます')).toBe(1);
    expect(speechSimilarity('', 'あ')).toBe(0);
    expect(speechSimilarity('あ', '')).toBe(0);
    expect(speechSimilarity('。、！', 'あ')).toBe(0);
    expect(speechSimilarity('えーと', 'あ')).toBe(0); // a filler alone is nothing
  });

  it('treats what normalisation unifies as identical: kana script, long vowels, fillers, punctuation', () => {
    expect(speechSimilarity('コーヒーをください', 'こうひいをください')).toBe(1);
    expect(speechSimilarity('えーと、これをください。', 'これをください')).toBe(1);
    expect(speechSimilarity('ありがとー', 'ありがとう')).toBe(1);
    expect(speechSimilarity('ありがとうございます！', 'ありがとう ございます')).toBe(1);
  });

  it('is the price rule: 450円 = 四百五十円 = よんひゃくごじゅうえん, but 450円 is not 540円', () => {
    expect(speechSimilarity('450円', '四百五十円')).toBe(1);
    expect(speechSimilarity('450円', 'よんひゃくごじゅうえん')).toBe(1);
    expect(speechSimilarity('四百五十円です', 'よんひゃくごじゅうえんです')).toBe(1);
    expect(speechSimilarity('450円', '540円')).toBeLessThan(1);
  });

  it('the irregular hundreds and thousands compare equal in every script', () => {
    for (const [digits, kanji, kana] of [
      ['300円', '三百円', 'さんびゃくえん'],
      ['600円', '六百円', 'ろっぴゃくえん'],
      ['800円', '八百円', 'はっぴゃくえん'],
      ['3,000円', '三千円', 'さんぜんえん'],
      ['8,000円', '八千円', 'はっせんえん'],
    ])
      expect(speechSimilarity(digits, kana), digits).toBe(1), expect(speechSimilarity(kanji, kana), kanji).toBe(1);
  });

  it('a mis-heard digit-word is not rescued by sharing a unit: 300 vs 600 is well below great', () => {
    expect(speechSimilarity('300円', '600円')).toBeLessThan(SIMILARITY_GREAT);
  });

  it('"great" is 0.85 (BALANCE) and one wrong kana in a long line stays great, a short one does not', () => {
    expect(SIMILARITY_GREAT).toBe(0.85);
    expect(SIMILARITY_GREAT).toBe(BALANCE.speech.great);
    expect(speechSimilarity('おにぎりをふたつください', 'おにぎりおふたつくだざい')).toBeGreaterThanOrEqual(SIMILARITY_GREAT); // 1 edit in 12
    expect(speechSimilarity('ください', 'くだざい')).toBeLessThan(SIMILARITY_GREAT); // 1 edit in 4
  });

  it('property: in [0, 1], symmetric, 1 only for equal normalised text', () => {
    const r = rng(5);
    for (let i = 0; i < 400; i++) {
      const a = randKana(r);
      const b = randKana(r);
      const s = speechSimilarity(a, b);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
      expect(s).toBe(speechSimilarity(b, a));
      if (a && b && s === 1) expect(a).toBe(b); // plain hiragana normalises to itself apart from を/づ/ぢ, which this alphabet lacks
    }
  });

  it('property: one more edit never raises the score (monotone along an edit path)', () => {
    const r = rng(23);
    for (let i = 0; i < 300; i++) {
      const target = randKana(r, 12) || 'あ';
      const chars = Array.from(target);
      let prev = 1;
      for (let k = 0; k < chars.length; k++) {
        chars[k] = chars[k] === 'ん' ? 'あ' : 'ん'; // guaranteed substitution, no length change
        const s = speechSimilarity(chars.join(''), target);
        expect(s).toBeLessThanOrEqual(prev + 1e-12);
        prev = s;
      }
    }
  });

  it('matches the Conversation.tsx similarity it replaces, wherever normJa and speechNormalize agree (plain hiragana)', () => {
    const r = rng(77);
    for (let i = 0; i < 500; i++) {
      const a = randKana(r);
      const b = randKana(r);
      expect(speechSimilarity(a, b), `${a} | ${b}`).toBeCloseTo(legacySimilarity(a, b), 12);
    }
    expect(speechSimilarity('こんにちは', 'こんばんは')).toBeCloseTo(legacySimilarity('こんにちは', 'こんばんは'), 12);
  });

  it('an injected number parser is honoured on both sides', () => {
    const parse = (t: string) => ({ text: t.replace(/ひゃっこ/g, 'ごひゃく'), numbers: [] });
    expect(speechSimilarity('ひゃっこ', 'ごひゃく', { parseNumbers: parse })).toBe(1);
    expect(speechSimilarity('ひゃっこ', 'ごひゃく')).toBeLessThan(1);
  });
});

describe('tokenDice and the copy-rule building blocks (§3.2)', () => {
  /** copyScore as 1C will write it, from the exported pieces */
  const copy = (a: string, b: string) => {
    const x = normJa(a);
    const y = normJa(b);
    const len = Math.max(Array.from(x).length, Array.from(y).length) || 1;
    return Math.max(1 - lev(x, y) / len, tokenDice(a, b));
  };

  it('lexiconTokens reads a known word by its reading, so 水 and みず (and コーヒー and こうひい) are one token', () => {
    expect([...lexiconTokens('みず')]).toEqual([...lexiconTokens('水')]);
    expect([...lexiconTokens('こうひい')]).toEqual([...lexiconTokens('コーヒー')]);
    expect(lexiconTokens('。、！').size).toBe(0);
  });

  it('is 0 for empty sides, 1 for the same tokens in any order, and never above 1', () => {
    expect(tokenDice('', 'これをください')).toBe(0);
    expect(tokenDice('これをください', '')).toBe(0);
    expect(tokenDice('これをください', 'これをください')).toBe(1);
    expect(tokenDice('これをください', 'ください これを')).toBe(1);
    expect(tokenDice('コーヒーをください', 'ホットをください')).toBeLessThan(1);
    expect(tokenDice('コーヒーをください', 'ホットをください')).toBeGreaterThan(0);
  });

  it('accepts another tokenizer (a pack own)', () => {
    const words = (t: string) => t.split(' ');
    expect(tokenDice('a b c', 'b c d', words)).toBeCloseTo(2 / 3);
  });

  it('property: symmetric and in [0, 1]', () => {
    const r = rng(31);
    for (let i = 0; i < 200; i++) {
      const a = randKana(r, 12);
      const b = randKana(r, 12);
      const d = tokenDice(a, b);
      expect(d).toBe(tokenDice(b, a));
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(1);
    }
  });

  it('a one-edit copy of a 9-character chip scores >= 0.80, the case the first design (0.90) let through', () => {
    const chip = 'コーヒーをください'; // 9 characters
    const edited = 'コーヒーおください'; // を -> お: still the same sound
    const oneEdit = 'コーヒーをくださ'; // one character dropped
    expect(copy(chip, oneEdit)).toBeGreaterThanOrEqual(BALANCE.copyScore);
    expect(copy(chip, edited)).toBeGreaterThanOrEqual(BALANCE.copyScore);
    expect(1 - lev(chip, oneEdit) / 9).toBeLessThan(0.9); // the old threshold would have missed it
  });

  it('a different sentence with the same structure is not a copy', () => {
    expect(copy('コーヒーをください', 'おにぎりをふたつください')).toBeLessThan(BALANCE.copyScore);
  });
});

describe('alternativesOf', () => {
  it('is the single text when there are no alternatives', () => {
    expect(alternativesOf({ text: 'こんにちは', confidence: 0.9 })).toEqual([{ text: 'こんにちは', confidence: 0.9 }]);
  });

  it('puts the primary text first, drops blanks and duplicates, keeps the recogniser order', () => {
    expect(
      alternativesOf({
        text: ' よんひゃくえん ',
        confidence: 0.6,
        alternatives: [
          { text: 'よんひゃくえん', confidence: 0.6 },
          { text: '', confidence: 0.5 },
          { text: 'よんじゅうえん', confidence: 0.3 },
          { text: 'よんじゅうえん', confidence: 0.2 },
        ],
      }),
    ).toEqual([
      { text: 'よんひゃくえん', confidence: 0.6 },
      { text: 'よんじゅうえん', confidence: 0.3 },
    ]);
  });

  it('is empty for a blank result', () => {
    expect(alternativesOf({ text: '  ', confidence: 0 })).toEqual([]);
  });
});

describe('n-best selection', () => {
  const alts = [
    { text: 'よんじゅうえん', confidence: 0.5 },
    { text: 'よんひゃくえん', confidence: 0.3 },
    { text: 'ほんひゃくえん', confidence: 0.2 },
  ];

  it('the best (alternative, expected) pair wins, even when it is not the first alternative', () => {
    const m = selectBestAlternative(alts, ['400円です', '4000円です'])!;
    expect(m.altIndex).toBe(1);
    expect(m.alt.text).toBe('よんひゃくえん');
    expect(m.expected).toBe('400円です');
    expect(m.expectedIndex).toBe(0);
    expect(m.score).toBeGreaterThan(0.7);
  });

  it('a recogniser that heard 40 first still gets the 400 line when the expected line is 400', () => {
    expect(selectBestAlternative(alts, ['400円'])!.score).toBe(1);
    expect(speechSimilarity(alts[0].text, '400円')).toBeLessThan(1);
  });

  it('ties go to the earlier alternative, then the earlier expected line', () => {
    const tie = selectBestAlternative(
      [
        { text: 'あ', confidence: 0.4 },
        { text: 'あ', confidence: 0.9 },
      ],
      ['あ', 'あ'],
    )!;
    expect(tie.altIndex).toBe(0);
    expect(tie.expectedIndex).toBe(0);
  });

  it('is null when either list is empty', () => {
    expect(selectBestAlternative([], ['あ'])).toBeNull();
    expect(selectBestAlternative(alts, [])).toBeNull();
  });

  it('property: the chosen score is the maximum over all pairs, and never below any single alternative', () => {
    const r = rng(8);
    for (let i = 0; i < 200; i++) {
      const a = Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ text: randKana(r, 6) || 'あ', confidence: r() }));
      const e = Array.from({ length: 1 + Math.floor(r() * 3) }, () => randKana(r, 6) || 'い');
      const best = selectBestAlternative(a, e)!;
      let max = 0;
      for (const x of a) for (const y of e) max = Math.max(max, speechSimilarity(x.text, y));
      expect(best.score).toBeCloseTo(max, 12);
      expect(best.score).toBeGreaterThanOrEqual(speechSimilarity(a[0].text, e[0]) - 1e-12);
    }
  });

  it('bestAlternativeScore is the same maximum against one target, 0 for none', () => {
    expect(bestAlternativeScore(alts, '400円')).toBe(1);
    expect(bestAlternativeScore([], '400円')).toBe(0);
  });

  it('pickBestAlternative keeps the best-ranked hit, skips misses, and ties go to the earlier alternative', () => {
    const pick = pickBestAlternative(
      alts,
      (t) => (t.startsWith('よんひゃく') ? { rank: 5, t } : t.startsWith('よんじゅう') ? { rank: 2, t } : null),
      (h) => h.rank,
    )!;
    expect(pick.altIndex).toBe(1);
    expect(pick.hit.t).toBe('よんひゃくえん');
    const tie = pickBestAlternative(alts, (t) => ({ t }), () => 1)!;
    expect(tie.altIndex).toBe(0);
    expect(pickBestAlternative(alts, () => null, () => 1)).toBeNull();
    expect(pickBestAlternative([], () => ({}), () => 1)).toBeNull();
  });

  it('a session-style use: displays the first alternative but submits the best-matching one', () => {
    const intents = [
      { id: 'pay_400', says: 'よんひゃくえん' },
      { id: 'pay_300', says: 'さんびゃくえん' },
    ];
    const hit = pickBestAlternative(
      alts,
      (t) => {
        const found = intents.find((i) => speechSimilarity(t, i.says) >= 0.85);
        return found ?? null;
      },
      (i) => (i.id === 'pay_400' ? 1 : 0),
    )!;
    expect(hit.hit.id).toBe('pay_400');
    expect(alts[0].text).toBe('よんじゅうえん'); // what the screen shows is untouched
  });
});

describe('confidence buckets (§12.4)', () => {
  it('>= 0.75 submits directly, 0.45 up to 0.75 asks "I heard...", below 0.45 is unmatched', () => {
    expect(confidenceBucket(1)).toBe('direct');
    expect(confidenceBucket(0.75)).toBe('direct');
    expect(confidenceBucket(0.7499)).toBe('confirm');
    expect(confidenceBucket(0.6)).toBe('confirm');
    expect(confidenceBucket(0.45)).toBe('confirm');
    expect(confidenceBucket(0.4499)).toBe('unmatched');
    expect(confidenceBucket(0)).toBe('unmatched');
  });

  it('the thresholds are the BALANCE numbers', () => {
    expect(BALANCE.speech.directConfidence).toBe(0.75);
    expect(BALANCE.speech.confirmConfidence).toBe(0.45);
    expect(confidenceBucket(BALANCE.speech.directConfidence)).toBe('direct');
    expect(confidenceBucket(BALANCE.speech.confirmConfidence)).toBe('confirm');
  });

  it('NaN and negatives are unmatched, never submitted', () => {
    expect(confidenceBucket(NaN)).toBe('unmatched');
    expect(confidenceBucket(-1)).toBe('unmatched');
  });

  it('property: monotone, so a higher confidence never lands in a lower bucket', () => {
    const rank = { unmatched: 0, confirm: 1, direct: 2 } as const;
    let prev = 0;
    for (let c = 0; c <= 1.0001; c += 0.01) {
      const b = rank[confidenceBucket(c)];
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  it('corrections trust a speech turn only at >= 0.8 (§11.4)', () => {
    expect(isReliableSpeech(0.8)).toBe(true);
    expect(isReliableSpeech(0.79)).toBe(false);
    expect(isReliableSpeech(0.5)).toBe(false); // the neutral confidence of an engine that reports none
    expect(isReliableSpeech(NaN)).toBe(false);
  });
});

describe('similarityVerdict', () => {
  it('great at 0.85, pass at the given mark (Prepare 0.7, beginner 0.6, echo 0.6), else again', () => {
    expect(similarityVerdict(0.85, BALANCE.recallPass.default)).toBe('great');
    expect(similarityVerdict(0.84, BALANCE.recallPass.default)).toBe('pass');
    expect(similarityVerdict(BALANCE.recallPass.default, BALANCE.recallPass.default)).toBe('pass');
    expect(similarityVerdict(0.69, BALANCE.recallPass.default)).toBe('again');
    expect(similarityVerdict(0.6, BALANCE.recallPass.beginner)).toBe('pass');
    expect(similarityVerdict(0.54, BALANCE.recallPass.kids)).toBe('again');
  });
});

describe('the engine copy of BALANCE.speech', () => {
  it('is pinned to BALANCE (the engine may only `import type` from @lw/game, so it restates the numbers; this test keeps them one source)', () => {
    expect(DEFAULT_SPEECH_POLICY).toEqual(BALANCE.speech);
  });

  it('every policy-taking function honours an explicit policy', () => {
    const strict = { ...BALANCE.speech, directConfidence: 0.9, confirmConfidence: 0.6, correctionConfidence: 0.95, great: 0.95 };
    expect(confidenceBucket(0.8)).toBe('direct');
    expect(confidenceBucket(0.8, strict)).toBe('confirm');
    expect(confidenceBucket(0.5, strict)).toBe('unmatched');
    expect(isReliableSpeech(0.9)).toBe(true);
    expect(isReliableSpeech(0.9, strict)).toBe(false);
    expect(similarityVerdict(0.9, 0.7)).toBe('great');
    expect(similarityVerdict(0.9, 0.7, strict)).toBe('pass');
  });
});
