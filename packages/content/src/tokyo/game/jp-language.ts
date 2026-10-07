// Japanese numbers, prices and the LanguagePlugin the game core receives (agent 1B, docs/GAME_DESIGN.md §11.4, §12.4, §14.3-§14.4).
// Pure functions, no lexicon import: `yenToJa` emits only the surfaces defined in lexicon/numbers.ts, whose reading table it shares.
import { toHiragana } from '@lw/core';
import type { CurrencyDef, Gloss, LanguagePlugin } from '@lw/game';
import { readNumeralTokens } from '../../lexicon/numbers';

/** The domain of `readNumber` / `parseJaNumber`: the 万 group holds at most 9,999. `yenToJa` is narrower: 1..9,999,999 (the wallet cap). */
export const JA_NUMBER_MAX = 99_999_999;
export const YEN_MAX = 9_999_999;

const DIGIT = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** A 千 or 百 digit whose compound is its own lexicon entry (reading is not digit + unit). */
const IRREGULAR_THOUSAND = new Set([3, 8]);
const IRREGULAR_HUNDRED = new Set([3, 6, 8]);

/** One 万 group (1..9999) as tokens: thousands, hundreds, tens, ones; the digit 一 is dropped before 十 / 百 / 千 but a lone 1 stays. */
function groupTokens(g: number): string[] {
  const th = Math.floor(g / 1000);
  const h = Math.floor(g / 100) % 10;
  const t = Math.floor(g / 10) % 10;
  const o = g % 10;
  const out: string[] = [];
  if (th) {
    if (IRREGULAR_THOUSAND.has(th)) out.push(`${DIGIT[th]}千`);
    else out.push(...(th === 1 ? ['千'] : [DIGIT[th], '千']));
  }
  if (h) {
    if (IRREGULAR_HUNDRED.has(h)) out.push(`${DIGIT[h]}百`);
    else out.push(...(h === 1 ? ['百'] : [DIGIT[h], '百']));
  }
  if (t) out.push(...(t === 1 ? ['十'] : [DIGIT[t], '十']));
  if (o) out.push(DIGIT[o]);
  return out;
}

/** The numeral tokens of 1..99,999,999 (no 円): `450` -> 四 百 五 十, `24800` -> 二 万 四 千 八百. */
export function numberTokens(n: number): string[] {
  if (!Number.isInteger(n) || n < 1 || n > JA_NUMBER_MAX) throw new RangeError(`numberTokens: ${n} is outside 1..${JA_NUMBER_MAX}`);
  const man = Math.floor(n / 10000);
  const rest = n % 10000;
  return [...(man ? [...groupTokens(man), '万'] : []), ...(rest ? groupTokens(rest) : [])];
}

/** Reads numeral tokens by their kana (shared with `speakableText`). */
export const readTokens = readNumeralTokens;

/** 2980 -> 'にせんきゅうひゃくはちじゅう'; 0 -> 'ぜろ'. */
export function readNumber(n: number): string {
  if (n === 0) return 'ぜろ';
  return readTokens(numberTokens(n));
}

const grouped = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * A price as markup of `|`-separated lexicon tokens, its reading and its gloss. Passed as a non-raw `Vars` value so it tokenises and
 * ruby-annotates like any line. 160 -> 百|六|十|円; 450 -> 四|百|五|十|円; 24,800 -> 二|万|四|千|八百|円; 198,000 -> 十|九|万|八千|円.
 * (The §14.4 prose lists 八百 and 八千 as single tokens, its example strings split them; the rule wins: their reading is irregular.)
 * Throws outside 1..9,999,999: callers guard a zero price themselves.
 */
export function yenToJa(n: number): { markup: string; reading: string; gloss: Gloss } {
  if (!Number.isInteger(n) || n < 1 || n > YEN_MAX) throw new RangeError(`yenToJa: ${n} is outside 1..${YEN_MAX}`);
  const tokens = [...numberTokens(n), '円'];
  return { markup: tokens.join('|'), reading: readTokens(tokens), gloss: { en: `${grouped(n)} yen`, ar: `${grouped(n)} ين` } };
}

// ---------------------------------------------------------------------------------------------------------------
// Parsing: digits, kanji and kana numerals, mixed
// ---------------------------------------------------------------------------------------------------------------

type Tok = { k: 'd'; v: number; arabic: boolean } | { k: 'u'; v: number };

/** Kana numerals, longest first. Rendaku forms (びゃく ぴゃく ぜん) and sokuon (いっ ろっ はっ) are accepted anywhere; so are the plain readings (ろくひゃく). */
const KANA: Array<[string, Tok]> = (
  [
    ['きゅう', 9], ['きゅー', 9], ['じゅう', 10], ['じゅー', 10], ['ひゃく', 100], ['びゃく', 100], ['ぴゃく', 100], ['まん', 10000],
    ['さん', 3], ['よん', 4], ['しち', 7], ['なな', 7], ['はち', 8], ['ろく', 6], ['ろっ', 6], ['はっ', 8], ['いっ', 1], ['いち', 1], ['ぜろ', 0], ['れい', 0],
    ['せん', 1000], ['ぜん', 1000], ['じゅっ', 10],
    ['に', 2], ['ご', 5], ['し', 4], ['よ', 4], ['く', 9],
  ] as Array<[string, number]>
)
  .map<[string, Tok]>(([s, v]) => [s, v >= 10 ? { k: 'u', v } : { k: 'd', v, arabic: false }])
  .sort((a, b) => b[0].length - a[0].length);

const KANJI_DIGIT: Record<string, number> = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const KANJI_UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 万: 10000 };

/** The numeral tokens of `s` from `from`, stopping at the first character that is not part of a number. Returns the end index. */
function scanTokens(s: string, from: number): { toks: Tok[]; end: number } {
  const toks: Tok[] = [];
  let i = from;
  scan: while (i < s.length) {
    const c = s[i];
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < s.length && s[j] >= '0' && s[j] <= '9') j++;
      toks.push({ k: 'd', v: Number(s.slice(i, j)), arabic: true });
      i = j;
    } else if (c in KANJI_DIGIT) {
      toks.push({ k: 'd', v: KANJI_DIGIT[c], arabic: false });
      i++;
    } else if (c in KANJI_UNIT) {
      toks.push({ k: 'u', v: KANJI_UNIT[c] });
      i++;
    } else {
      for (const [kana, tok] of KANA) {
        if (s.startsWith(kana, i)) {
          toks.push(tok);
          i += kana.length;
          continue scan;
        }
      }
      break;
    }
  }
  return { toks, end: i };
}

/** The value of a numeral token sequence, or null when it is not a well-formed number (百百, 十百, 三万万, a digit pair without a unit between). */
function evaluate(toks: Tok[]): number | null {
  if (!toks.length) return null;
  const units = toks.some((t) => t.k === 'u');
  if (!units) {
    if (toks.length === 1) return (toks[0] as Extract<Tok, { k: 'd' }>).v;
    // positional kanji / kana digits: 四五〇 = 450
    let v = 0;
    for (const t of toks) {
      if (t.k !== 'd' || t.arabic || t.v > 9) return null;
      v = v * 10 + t.v;
    }
    return v;
  }
  let total = 0;
  let sec = 0;
  let d: number | null = null;
  let last = Infinity;
  let sawMan = false;
  for (const t of toks) {
    if (t.k === 'd') {
      if (d !== null || t.v === 0) return null;
      d = t.v;
    } else if (t.v === 10000) {
      if (sawMan) return null;
      const c = d === null && sec === 0 ? 1 : sec + (d ?? 0);
      if (sec > 0 && d !== null && d > 9) return null;
      if (c < 1 || c > 9999) return null;
      total += c * 10000;
      sec = 0;
      d = null;
      last = Infinity;
      sawMan = true;
    } else {
      if (t.v >= last || (d !== null && d > 9)) return null;
      sec += (d ?? 1) * t.v;
      last = t.v;
      d = null;
    }
  }
  if (d !== null) {
    if (sec > 0 && d > 9) return null;
    sec += d;
  }
  total += sec;
  return total <= JA_NUMBER_MAX ? total : null;
}

/** NFKC (full-width digits, ￥), katakana -> hiragana, no spaces or digit separators, no leading yen sign or trailing 円 / えん / yen. */
function normalise(text: string): string {
  return toHiragana(text.normalize('NFKC').toLowerCase())
    .replace(/[\s,，、_']/g, '')
    .replace(/^[¥￥]/, '')
    .replace(/(?:円|えん|yen|jpy)$/, '');
}

/**
 * The integer a whole text says, or null: '450円', '450', '4,50', '24,800', '四百五十円', 'よんひゃくごじゅうえん', '2万4千', '三千円',
 * 'ろっぴゃく'. Positional kanji ('四五〇') also works. Ill-formed or oversized (> 99,999,999) input is null.
 */
export function parseJaNumber(text: string): number | null {
  const s = normalise(text);
  if (!s) return null;
  const { toks, end } = scanTokens(s, 0);
  if (end !== s.length) return null;
  const v = evaluate(toks);
  return v !== null && v <= JA_NUMBER_MAX ? v : null;
}

const SPAN = /[¥￥]?(?:[0-9０-９][0-9０-９,，]*|[〇零一二三四五六七八九十百千万])+(?:円|えん|yen)?/g;
const IDEOGRAPH = /^[一-鿿々つ]/;
const CLOSING = /[\s。、．.!！?？]|です|でございます/g;

/** A number followed by 円 is read with the yen's quirk: 四円 is よえん. */
function canonical(n: number, yen: boolean): string {
  return yen ? readTokens([...(n === 0 ? [] : numberTokens(n)), '円']) || 'ぜろえん' : readNumber(n);
}

/**
 * Finds the numbers in free text (typed or recognised) and unifies them: each numeric span is re-rendered as canonical kana, so
 * '450円', '四百五十円' and 'よんひゃくごじゅうえん' become the same string (§12.4). Spans are digits, kanji and kana numerals, with an
 * optional 円 / えん / ¥. A bare span before another ideograph is a counter compound (三番線, 二十分, 一度) and is left alone; a
 * kana run counts only with えん, or when it is the whole utterance (so 'ごはん' and 'じゅうぶん' are not numbers).
 */
export function parseNumbers(text: string): { text: string; numbers: number[] } {
  const hits: Array<{ start: number; end: number; n: number; yen: boolean }> = [];
  for (const m of text.matchAll(SPAN)) {
    const raw = m[0];
    const start = m.index ?? 0;
    const end = start + raw.length;
    const yen = /^[¥￥]/.test(raw) || /(?:円|えん|yen)$/.test(raw);
    const n = parseJaNumber(raw);
    if (n === null || n < 1) continue;
    if (!yen && IDEOGRAPH.test(text.slice(end, end + 1))) continue;
    hits.push({ start, end, n, yen });
  }
  const taken = (i: number) => hits.some((h) => i >= h.start && i < h.end);
  // kana runs: scan the hiragana the regex above cannot see
  const hira = toHiragana(text);
  for (let i = 0; i < text.length; ) {
    if (taken(i)) {
      i++;
      continue;
    }
    const { toks, end } = scanTokens(hira, i);
    // a kana run never starts on, or swallows, digits or kanji: those spans belong to the pass above
    const run = hira.slice(i, end);
    if (!toks.length || /[0-9〇零一-九十百千万]/.test(run)) {
      i++;
      continue;
    }
    const n = evaluate(toks);
    const yen = /^(?:えん)/.test(hira.slice(end));
    const hasUnit = toks.some((t) => t.k === 'u');
    const whole = hira.slice(0, i) + hira.slice(end);
    const alone = hasUnit && whole.replace(CLOSING, '') === '';
    if (n !== null && n >= 1 && (yen || alone)) {
      hits.push({ start: i, end: yen ? end + 2 : end, n, yen });
      i = yen ? end + 2 : end;
    } else i++;
  }
  hits.sort((a, b) => a.start - b.start);
  let out = '';
  let at = 0;
  for (const h of hits) {
    out += text.slice(at, h.start) + canonical(h.n, h.yen);
    at = h.end;
  }
  return { text: out + text.slice(at), numbers: hits.map((h) => h.n) };
}

// ---------------------------------------------------------------------------------------------------------------
// Speech folding (a basic pipeline; engine/speechNormalize.ts (1G) may replace it through `setSpeechNormalizer`)
// ---------------------------------------------------------------------------------------------------------------

const ROW: Array<[string, string]> = [
  ['あかがさざただなはばぱまやらわゃぁ', 'あ'],
  ['いきぎしじちぢにひびぴみりぃ', 'い'],
  ['うくぐすずつづぬふぶぷむゆるゅぅゔ', 'う'],
  ['えけげせぜてでねへべぺめれぇ', 'い'],
  ['おこごそぞとどのほぼぽもよろをょぉ', 'う'],
];
const FILLERS = /えーと|えっと|ええと|あのー|あのう|うーん|んー/g;
const PUNCT = /[\s、。！？!?.,，・「」『』（）()…~〜"'’“”:;：；*-]/g;

function basicSpeechNormalize(text: string): string {
  const folded = toHiragana(text.normalize('NFKC').toLowerCase()).replace(FILLERS, '').replace(PUNCT, '');
  const { text: unified } = parseNumbers(folded);
  return unified
    .replace(/(.)ー/g, (m, c: string) => ROW.find(([chars]) => chars.includes(c))?.[1] ? c + ROW.find(([chars]) => chars.includes(c))![1] : m)
    .replace(/ー/g, '')
    .replace(/を/g, 'お')
    .replace(/づ/g, 'ず')
    .replace(/ぢ/g, 'じ');
}

let speechNormalizer: ((text: string) => string) | null = null;
/** Lets the engine's richer `speechNormalize` (1G) stand in for the basic one; `null` restores it. */
export function setSpeechNormalizer(fn: ((text: string) => string) | null): void {
  speechNormalizer = fn;
}

/** The Japanese plugin the game core is handed (`GamePack.lang`). */
export const JP_LANGUAGE: LanguagePlugin = {
  readNumber,
  priceMarkup: (n: number, _cur: CurrencyDef) => yenToJa(n),
  parseNumbers,
  speechNormalize: (text) => (speechNormalizer ? speechNormalizer(text) : basicSpeechNormalize(text)),
  // §11.4: forms that mark the register. `good` shows the register in use, `bad` a form that does not belong with it (the engine's
  // casualWithStaff / stiffWithFriend rules read these; keigo with a friend who switched is "distant, not wrong").
  registerMarkers: {
    casual: {
      good: ['だよ', 'だね', 'じゃん', 'いいよ', 'ありがとう', 'ごめん', 'うん'],
      bad: ['ございます', 'でございます', 'いたします', 'おります', 'いらっしゃいます', 'させていただ'],
    },
    polite: {
      good: ['です', 'ます', 'ください', 'お願いします', 'ありがとうございます', 'すみません'],
      bad: ['だよ', 'だね', 'じゃん', 'ちょうだい', 'くれ', 'だぜ'],
    },
    keigo: {
      good: ['ございます', 'いたします', 'おります', 'いらっしゃいませ', 'かしこまりました', '申し訳', '恐れ入ります', 'お待たせ'],
      bad: ['だよ', 'だね', 'じゃん', 'ちょうだい', 'くれ', 'うん', 'ごめん', 'いいよ'],
    },
  },
};
