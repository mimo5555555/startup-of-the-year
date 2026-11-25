// The words of the Shift screen in each language being learned (docs/GAME_DESIGN.md §9; jobs in Berlin and Amsterdam): how a total and
// the change are said, how a typed or spoken amount or thanks is checked, the wrong chips, the welcome, the boss's lines and the rank
// names. Japanese is the konbini's, word for word as it always was. German and Dutch write a price as one piece (「3,50 €」, 「€ 3,50」):
// the tiles of 「Das macht 3,50 €.」 are Das, macht and the amount, with two near amounts as the wrong tiles.
import {
  deContains,
  deMatchForms,
  esContains,
  esMatchForms,
  euroText,
  euroTextEs,
  euroTextNl,
  nlContains,
  nlMatchForms,
  normJa,
  parseDutchNumbers,
  parseGermanNumbers,
  parseSpanishNumbers,
  romajiAsKana,
} from '@lw/core';
import type { Line } from './types';
import { L } from './tokyo/dsl';
import { parseNumbers, yenToJa } from './tokyo/game/jp-language';

export type ShiftBand = 'perfect' | 'nice' | 'almost' | 'retry';
export type ShiftLangId = 'ja' | 'de' | 'nl' | 'es';

export interface ShiftTalk {
  id: ShiftLangId;
  /** an amount as markup: 三百|二十|円 (its words are tiles) or 「3,50 €」 (one tile) */
  amount(n: number): string;
  /** the staff's sentence for a total: 三百二十円です。 / Das macht 3,20 €. / Dat is dan € 3,20. */
  total(n: number): string;
  /** the staff's sentence for the change: お釣りは…です。 / Sie bekommen 1,50 € zurück. / U krijgt € 1,50 terug. */
  change(n: number): string;
  /** the pieces of a phrase that are words (no punctuation), in order: what the tiles are */
  pieces(markup: string): string[];
  /** a typed or spoken answer names exactly one amount, the expected one (minor units) */
  amountSaid(text: string, expected: number): boolean;
  /** a typed or spoken staff phrase contains one of the accepted ones */
  thanksSaid(text: string, accepted: string[]): boolean;
  /** two wrong pieces for the tiles of an amount */
  amountDistractors(n: number): string[];
  /** other things a worker says at a counter: the wrong chips of a thanks answer */
  thanksWrong: string[];
  /** what the welcome button says */
  welcome: string;
  /** an example amount for the answer box (never anyone's answer); null: the UI's own example (Japanese) */
  example: { digits: string; words: string } | null;
  /** the example of a thanks answer; null: the UI's own (Japanese) */
  placeholderThanks: string | null;
  /** the word for the change, in the prompt that asks for it */
  changeWord: string;
  /** the job card's tag for a young player who is helping out */
  helping: string;
  /** the counter's switches, by flag id (the konbini's and the Tokyo café's) */
  flagWords: Record<string, string>;
  /** rank 0 (trainee) to 4 (the boss's stand-in) */
  ranks: Array<{ ja: string; reading: string }>;
  /** the boss: no third shift today, a shift to try again, the verdict, the rank-up (index = the new rank) */
  refuse: Line;
  retry: Line;
  bands: Record<ShiftBand, Line>;
  rankUp: Array<Line | null>;
}

/** Two wrong totals near the right one (positive, different from each other and from it): yen or cents alike (±100, ±50, ±150...). */
export function nearAmounts(n: number): [number, number] {
  const offsets = [100, -100, 50, -50, 150, 30, -30, 200];
  const out: number[] = [];
  for (const o of offsets) {
    const v = n + o;
    if (v >= 10 && v !== n && !out.includes(v)) out.push(v);
    if (out.length === 2) break;
  }
  return [out[0] ?? n + 10, out[1] ?? n + 20];
}

/** Whether one number in the list, and only one, is the expected amount. */
const exactlyOne = (found: number[], expected: number): boolean => found.length === 1 && found[0] === expected;

// ---------------------------------------------------------------------------------------------------------------
// Japanese: the konbini, as it always was
// ---------------------------------------------------------------------------------------------------------------

const RETRY_JA: Line = L('大丈夫|です|。|もう一度|やりましょう|。', "It's okay. Let's try again.", 'لا بأس. لنحاول مرة أخرى.');
/** the pieces of a markup phrase that are words: split at the bars, punctuation dropped */
const piecesJa = (markup: string): string[] => markup.split('|').filter((p) => p && !/^[。、？！.,?!]+$/.test(p));
/** the text of a thanks phrase up to its first sentence mark, folded to kana */
const coreJa = (markup: string): string => normJa(markup.replace(/\|/g, '').split(/[。！？]/)[0] ?? '');

export const JA_SHIFT_TALK: ShiftTalk = {
  id: 'ja',
  amount: (n) => yenToJa(n).markup,
  total: (n) => `${yenToJa(n).markup}|です|。`,
  change: (n) => `お釣り|は|${yenToJa(n).markup}|です|。`,
  pieces: piecesJa,
  // digits (320, ¥320), kanji (三百二十円) or kana, romaji included
  amountSaid: (text, expected) =>
    [text, romajiAsKana(text)].filter((x): x is string => !!x && x.trim().length > 0).some((t) => exactlyOne(parseNumbers(t).numbers, expected)),
  // script-insensitive, romaji included
  thanksSaid: (text, accepted) => {
    const said = [normJa(text), romajiAsKana(text) ? normJa(romajiAsKana(text)!) : ''].filter(Boolean);
    return accepted.some((a) => {
      const want = coreJa(a);
      return want.length > 0 && said.some((s) => s.includes(want));
    });
  },
  amountDistractors: (n) => {
    const own = new Set(piecesJa(yenToJa(n).markup));
    const out: string[] = [];
    for (const v of [...nearAmounts(n), n + 300, n + 1000]) {
      for (const p of piecesJa(yenToJa(v).markup)) if (p !== '円' && !own.has(p) && !out.includes(p)) out.push(p);
    }
    // small amounts share most of their words with the near ones: fall back to plain digits that are not in the answer
    for (const d of ['五', '三', '七', '四', '二', '八', '六', '九']) if (out.length < 2 && !own.has(d) && !out.includes(d)) out.push(d);
    return out.slice(0, 2);
  },
  thanksWrong: ['いらっしゃいませ|。', 'どういたしまして|。', 'すみません|。', 'いただきます|。'],
  welcome: 'いらっしゃいませ',
  example: null,
  placeholderThanks: null,
  changeWord: 'お釣り',
  helping: 'お手伝い',
  flagWords: { heat: '温めて', nobag: '袋', hot: 'ホット', iced: 'アイス' },
  ranks: [
    { ja: '見習い', reading: 'みならい' },
    { ja: '一人前', reading: 'いちにんまえ' },
    { ja: 'ベテラン', reading: '' },
    { ja: 'エース', reading: '' },
    { ja: '店長代理', reading: 'てんちょうだいり' },
  ],
  refuse: L('今日|は|もう|大丈夫|です|。|ゆっくり|休んで|ください|。', 'That is enough for today. Please rest.', 'يكفي لهذا اليوم. ارتح قليلًا.'),
  retry: RETRY_JA,
  bands: {
    perfect: L('完璧|です|！', 'Perfect!', 'ممتاز!'),
    nice: L('いい|です|ね|！', 'Nice!', 'جميل!'),
    almost: L('もう少し|！', 'A little more!', 'قليلًا بعد!'),
    retry: RETRY_JA,
  },
  rankUp: [
    null,
    L('一人前|に|なりました|！|時給|が|上がります|。', "You're a full-fledged worker now! Your wage goes up.", 'أصبحت عاملًا متمكّنًا! سيرتفع أجرك.'),
    L('ベテラン|に|なりました|！|時給|が|上がります|。', "You're a veteran now! Your wage goes up.", 'أصبحت محترفًا! سيرتفع أجرك.'),
    L('エース|に|なりました|！|時給|が|上がります|。', "You're an ace now! Your wage goes up.", 'أصبحت نجمًا! سيرتفع أجرك.'),
    L('店長代理|に|なりました|！|時給|が|上がります|。', "You're the acting manager now! Your wage goes up.", 'أصبحت نائب المدير! سيرتفع أجرك.'),
  ],
};

// ---------------------------------------------------------------------------------------------------------------
// German and Dutch: words between spaces, a price as one piece
// ---------------------------------------------------------------------------------------------------------------

/** a price as German or Dutch write it: 3,50 € or € 3,50 (thousands with a point) */
const PRICE = /€\s?\d[\d.]*,\d\d|\d[\d.]*,\d\d\s?€/g;

/** holds a price's space while the sentence is split at its spaces (not a space itself: \s matches a no-break space) */
const GLUE = '';

/** The words of a sentence, a price kept whole and the punctuation dropped: 「Das macht 3,50 €.」 → Das, macht, 3,50 €. */
export function latinPieces(markup: string): string[] {
  return markup
    .replace(/\|/g, ' ')
    .replace(PRICE, (m) => m.replace(/\s/g, GLUE))
    .split(/\s+/)
    .map((w) => w.replace(/^[¿¡„“"'(«]+|[.,!?;:…"“”')»]+$/gu, ''))
    .filter((w) => /[\p{L}\p{N}€]/u.test(w))
    .map((w) => w.replaceAll(GLUE, ' '));
}

/** the first sentence of a phrase (what has to be said for it to count): 「Danke schön! Schönen Abend noch!」 → 「Danke schön」 */
const firstSentence = (markup: string): string => markup.replace(/\|/g, ' ').split(/[.!?]/)[0] ?? '';

function latinTalk(o: {
  id: 'de' | 'nl' | 'es';
  amount(n: number): string;
  total(a: string): string;
  change(a: string): string;
  /** the numbers of an utterance, in euros */
  numbers(text: string): number[];
  fold(text: string): string;
  contains(text: string, key: string): boolean;
  rest: Pick<ShiftTalk, 'thanksWrong' | 'welcome' | 'example' | 'placeholderThanks' | 'changeWord' | 'helping' | 'ranks' | 'refuse' | 'retry' | 'bands' | 'rankUp'>;
}): ShiftTalk {
  return {
    id: o.id,
    amount: o.amount,
    total: (n) => o.total(o.amount(n)),
    change: (n) => o.change(o.amount(n)),
    pieces: latinPieces,
    // digits (3,50 · 3.50 · 3,50 €) or words (drei Euro fünfzig), in cents
    amountSaid: (text, expected) => exactlyOne(o.numbers(text).map((x) => Math.round(x * 100)), expected),
    // any letter case, umlauts typed or not, from the start of a word
    thanksSaid: (text, accepted) => {
      const said = o.fold(text);
      return accepted.some((a) => {
        const want = o.fold(firstSentence(a));
        return want.length > 0 && o.contains(said, want);
      });
    },
    amountDistractors: (n) => nearAmounts(n).map(o.amount),
    flagWords: {},
    ...o.rest,
  };
}

/** Berlin: Murat at the Späti, who says du to his staff (「Wir duzen uns hier」) */
export const DE_SHIFT_TALK: ShiftTalk = latinTalk({
  id: 'de',
  amount: (n) => euroText(Math.max(0, Math.round(n))).written,
  total: (a) => `Das macht ${a}.`,
  change: (a) => `Sie bekommen ${a} zurück.`,
  numbers: (text) => parseGermanNumbers(text).numbers,
  fold: (text) => deMatchForms(text).folded,
  contains: deContains,
  rest: {
    thanksWrong: ['Guten Morgen!', 'Entschuldigung!', 'Guten Appetit!', 'Gern geschehen!'],
    welcome: 'Hallo!',
    example: { digits: '12,34', words: 'zwölf Euro vierunddreißig' },
    placeholderThanks: 'Danke schön!',
    changeWord: 'Rückgeld',
    helping: 'Aushilfe',
    ranks: [
      { ja: 'Neuling', reading: '' },
      { ja: 'Profi', reading: '' },
      { ja: 'alter Hase', reading: '' },
      { ja: 'Ass', reading: '' },
      { ja: 'rechte Hand', reading: '' },
    ],
    refuse: L('Für heute ist genug. Ruh dich aus!', 'That’s enough for today. Get some rest!', 'يكفي لهذا اليوم. ارتح قليلًا!'),
    retry: L('Kein Problem. Wir versuchen es noch mal.', 'No problem. Let’s try again.', 'لا مشكلة. لنحاول مرة أخرى.'),
    bands: {
      perfect: L('Perfekt!', 'Perfect!', 'ممتاز!'),
      nice: L('Gut gemacht!', 'Well done!', 'أحسنت!'),
      almost: L('Fast! Noch ein bisschen!', 'Almost! A little more!', 'تقريبًا! قليلًا بعد!'),
      retry: L('Kein Problem. Wir versuchen es noch mal.', 'No problem. Let’s try again.', 'لا مشكلة. لنحاول مرة أخرى.'),
    },
    rankUp: [
      null,
      L('Du bist jetzt ein Profi! Dein Lohn steigt.', 'You’re a pro now! Your wage goes up.', 'أصبحت محترفًا الآن! سيرتفع أجرك.'),
      L('Du bist jetzt ein alter Hase! Dein Lohn steigt.', 'You’re an old hand now! Your wage goes up.', 'أصبحت خبيرًا متمرّسًا الآن! سيرتفع أجرك.'),
      L('Du bist jetzt ein Ass! Dein Lohn steigt.', 'You’re an ace now! Your wage goes up.', 'أصبحت نجمًا الآن! سيرتفع أجرك.'),
      L('Du bist jetzt meine rechte Hand! Dein Lohn steigt.', 'You’re my right hand now! Your wage goes up.', 'أصبحت يدي اليمنى الآن! سيرتفع أجرك.'),
    ],
  },
});

/** Amsterdam: Femke at Café De Gracht, who says je to her staff (staff say u to the guests) */
export const NL_SHIFT_TALK: ShiftTalk = latinTalk({
  id: 'nl',
  amount: (n) => euroTextNl(Math.max(0, Math.round(n))).written,
  total: (a) => `Dat is dan ${a}.`,
  change: (a) => `U krijgt ${a} terug.`,
  numbers: (text) => parseDutchNumbers(text).numbers,
  fold: (text) => nlMatchForms(text).folded,
  contains: nlContains,
  rest: {
    thanksWrong: ['Goedemorgen!', 'Sorry!', 'Eet smakelijk!', 'Graag gedaan!'],
    welcome: 'Hallo, welkom!',
    example: { digits: '12,34', words: 'twaalf euro vierendertig' },
    placeholderThanks: 'Dank u wel!',
    changeWord: 'wisselgeld',
    helping: 'meehelpen',
    ranks: [
      { ja: 'nieuweling', reading: '' },
      { ja: 'vakkracht', reading: '' },
      { ja: 'ouwe rot', reading: '' },
      { ja: 'topper', reading: '' },
      { ja: 'rechterhand', reading: '' },
    ],
    refuse: L('Genoeg voor vandaag. Rust lekker uit!', 'Enough for today. Have a good rest!', 'يكفي لهذا اليوم. ارتح جيدًا!'),
    retry: L('Geeft niks. We proberen het nog een keer.', 'Never mind. Let’s try again.', 'لا بأس. لنحاول مرة أخرى.'),
    bands: {
      perfect: L('Perfect!', 'Perfect!', 'ممتاز!'),
      nice: L('Goed gedaan!', 'Well done!', 'أحسنت!'),
      almost: L('Bijna! Nog een beetje!', 'Almost! A little more!', 'تقريبًا! قليلًا بعد!'),
      retry: L('Geeft niks. We proberen het nog een keer.', 'Never mind. Let’s try again.', 'لا بأس. لنحاول مرة أخرى.'),
    },
    rankUp: [
      null,
      L('Je bent nu een vakkracht! Je loon gaat omhoog.', 'You’re a skilled hand now! Your wage goes up.', 'أصبحت عاملًا ماهرًا الآن! سيرتفع أجرك.'),
      L('Je bent nu een ouwe rot! Je loon gaat omhoog.', 'You’re an old hand now! Your wage goes up.', 'أصبحت خبيرًا متمرّسًا الآن! سيرتفع أجرك.'),
      L('Je bent nu een topper! Je loon gaat omhoog.', 'You’re a star now! Your wage goes up.', 'أصبحت نجمًا الآن! سيرتفع أجرك.'),
      L('Je bent nu mijn rechterhand! Je loon gaat omhoog.', 'You’re my right hand now! Your wage goes up.', 'أصبحت يدي اليمنى الآن! سيرتفع أجرك.'),
    ],
  },
});

/**
 * Madrid: a boss who says tú to the staff, as Madrid does. No line guesses the player's gender: the ranks are nouns that fit anyone
 * (aprendiz, profesional, estrella, mano derecha) and nothing is 「listo / lista」.
 */
export const ES_SHIFT_TALK: ShiftTalk = latinTalk({
  id: 'es',
  amount: (n) => euroTextEs(Math.max(0, Math.round(n))).written,
  total: (a) => `Son ${a}.`,
  change: (a) => `Le devuelvo ${a}.`,
  numbers: (text) => parseSpanishNumbers(text).numbers,
  fold: (text) => esMatchForms(text).folded,
  contains: esContains,
  rest: {
    thanksWrong: ['¡Buenas noches!', '¡Perdón!', '¡Que aproveche!', 'De nada.'],
    welcome: '¡Hola, buenos días!',
    example: { digits: '12,34', words: 'doce euros con treinta y cuatro' },
    placeholderThanks: '¡Muchas gracias!',
    changeWord: 'el cambio',
    helping: 'ayudar',
    ranks: [
      { ja: 'aprendiz', reading: '' },
      { ja: 'profesional', reading: '' },
      { ja: 'de confianza', reading: '' },
      { ja: 'estrella', reading: '' },
      { ja: 'mano derecha', reading: '' },
    ],
    refuse: L('Ya está bien por hoy. ¡Descansa!', 'That’s enough for today. Get some rest!', 'يكفي لهذا اليوم. ارتح!'),
    retry: L('No pasa nada. Lo intentamos otra vez.', 'No problem. Let’s try again.', 'لا مشكلة. لنحاول مرة أخرى.'),
    bands: {
      perfect: L('¡Perfecto!', 'Perfect!', 'ممتاز!'),
      nice: L('¡Muy bien!', 'Very good!', 'جيد جدًا!'),
      almost: L('¡Casi! Un poco más.', 'Almost! A little more.', 'تقريبًا! قليلًا بعد.'),
      retry: L('No pasa nada. Lo intentamos otra vez.', 'No problem. Let’s try again.', 'لا مشكلة. لنحاول مرة أخرى.'),
    },
    rankUp: [
      null,
      L('¡Ya eres profesional! Te subo el sueldo.', 'You’re a professional now! I’m raising your wage.', 'أصبحت محترفًا الآن! سأرفع أجرك.'),
      L('¡Ya eres de confianza! Te subo el sueldo.', 'I can count on you now! I’m raising your wage.', 'أصبحت محلّ ثقة الآن! سأرفع أجرك.'),
      L('¡Eres una estrella! Te subo el sueldo.', 'You’re a star! I’m raising your wage.', 'أنت نجم! سأرفع أجرك.'),
      L('¡Ahora eres mi mano derecha! Te subo el sueldo.', 'You’re my right hand now! I’m raising your wage.', 'أصبحت يدي اليمنى الآن! سأرفع أجرك.'),
    ],
  },
});

export const SHIFT_TALK: Record<ShiftLangId, ShiftTalk> = { ja: JA_SHIFT_TALK, de: DE_SHIFT_TALK, nl: NL_SHIFT_TALK, es: ES_SHIFT_TALK };

/**
 * The recorded voice of a customer: Tokyo's one customer voice; in Berlin and Amsterdam a woman's or a man's, fixed per customer
 * (the app plays it and tools/voice records it, so both ask here).
 */
export function customerVoice(lang: ShiftLangId, templateId: string): string {
  if (lang === 'ja') return 'customer';
  let h = 0;
  for (const ch of templateId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 2 === 0 ? 'customer' : 'customer_m';
}
