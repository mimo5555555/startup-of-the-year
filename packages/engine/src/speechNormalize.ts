// Speech normalisation (docs/GAME_DESIGN.md §12.4). Pure and deterministic; no lexicon, so the same string always
// normalises the same way on both sides of a comparison (heard vs expected, turn vs shown line).
import { toHiragana } from '@lw/core';

/** Reads digits, kanji and kana numerals as integers; injected so the engine need not import the content pack's language plugin. */
export type NumberParser = (text: string) => { text: string; numbers: number[] };

export interface SpeechNormalizeOptions {
  /** unify numbers: '450円', '四百五十円' and 'よんひゃくごじゅうえん' become the same token. Runs first; its `text` (numerals already rewritten) feeds the built-in unifier, which finishes whatever is left. */
  parseNumbers?: NumberParser;
}

// ---------- fillers ----------

// Longest first. Written in hiragana: matching runs on a katakana-folded copy (same length, so offsets carry over).
const FILLER = new RegExp(
  '(?:' +
    [
      'えーっと|えっと|ええっと|ええと|えーと',
      'あのー+|あのう|あのぉ|あの(?=[、,。…]|$)',
      'そのー+|そのう',
      'うーん|うーむ|んー+|えー+|あー+',
    ].join('|') +
    ')[ー〜~、,.\\s…]*',
  'y',
);
const BOUNDARY = /[\s、。,.!！?？…・「」『』（）()]/;

/** Removes filler words and hesitation sounds (えーと, あのー, うーん) at the start of an utterance or clause; everything else is kept. Returns NFKC text. */
export function stripFillers(text: string): string {
  const n = text.normalize('NFKC');
  const h = toHiragana(n); // 1:1 per code unit
  let out = '';
  let atStart = true;
  for (let i = 0; i < n.length; ) {
    if (atStart) {
      FILLER.lastIndex = i;
      const m = FILLER.exec(h);
      if (m && m[0].length) {
        i += m[0].length;
        continue;
      }
    }
    out += n[i];
    atStart = BOUNDARY.test(n[i]);
    i++;
  }
  return out;
}

// ---------- numbers ----------

const DIGIT_KANA = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
const KANJI_DIGIT: Record<string, number> = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const KANJI_SMALL: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const KANJI_BIG: Record<string, number> = { 万: 1e4, 億: 1e8, 兆: 1e12 };
const BIG_KANA: Array<[number, string]> = [
  [1e12, 'ちょう'],
  [1e8, 'おく'],
  [1e4, 'まん'],
];

/** The reading of 1..9999 (no leading いち before じゅう/ひゃく/せん; the irregular 300/600/800/3000/8000 forms). */
function below10k(n: number): string {
  let out = '';
  const th = Math.floor(n / 1000);
  const hu = Math.floor((n % 1000) / 100);
  const te = Math.floor((n % 100) / 10);
  const on = n % 10;
  if (th) out += th === 1 ? 'せん' : th === 3 ? 'さんぜん' : th === 8 ? 'はっせん' : DIGIT_KANA[th] + 'せん';
  if (hu) out += hu === 1 ? 'ひゃく' : hu === 3 ? 'さんびゃく' : hu === 6 ? 'ろっぴゃく' : hu === 8 ? 'はっぴゃく' : DIGIT_KANA[hu] + 'ひゃく';
  if (te) out += te === 1 ? 'じゅう' : DIGIT_KANA[te] + 'じゅう';
  if (on) out += DIGIT_KANA[on];
  return out;
}

/** Canonical kana reading of a non-negative integer below 10^16: 450 -> よんひゃくごじゅう, 3000 -> さんぜん. */
export function numberToKana(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e16) throw new RangeError(`numberToKana: ${n}`);
  if (n === 0) return DIGIT_KANA[0];
  let rest = n;
  let out = '';
  for (const [unit, name] of BIG_KANA) {
    const q = Math.floor(rest / unit);
    if (q) out += below10k(q) + name; // 10000 is いちまん: the digit is always said before まん
    rest -= q * unit;
  }
  return out + below10k(rest);
}

/** Before 円 a final 4 is よ, not よん: 4円 よえん, 14円 じゅうよえん, but 400円 よんひゃくえん. */
function yenKana(n: number): string {
  const r = numberToKana(n);
  return n % 10 === 4 ? r.slice(0, -2) + 'よ' : r;
}

const digitByDigit = (s: string) => [...s].map((c) => DIGIT_KANA[+c]).join('');

// A run of arabic digits (with 1,234 grouping and one decimal part) and kanji numerals.
const ATOM = '\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|[〇一二三四五六七八九十百千万億兆]';
const NUM_RUN = new RegExp(`(?:${ATOM})+(?:円)?`, 'gu');
const ATOM_RE = new RegExp(ATOM, 'gu');
/** a lone kanji digit (一, 五) is a number only before 円 or a counter: 一緒 and 五反田 stay words */
const COUNTER = /^[円時分秒個本枚杯台歳回階月日人番]/;

/**
 * Sums numeral parts left to right. `part(t)` classifies a token: a digit value, a small unit (十 百 千), a big unit (万 億) or null
 * (not a numeral). Units must descend (千百十, 億万) and a digit may not follow a digit, so garbage like じゅうじゅう is not a number.
 */
type Part = { digit: number } | { small: number } | { big: number };
function sum(parts: Part[], bigAloneOk: boolean): number | null {
  let total = 0;
  let section = 0;
  let cur: number | null = null;
  let lastSmall = Infinity;
  let lastBig = Infinity;
  for (const p of parts) {
    if ('digit' in p) {
      if (cur !== null) return null;
      cur = p.digit;
    } else if ('small' in p) {
      if (p.small >= lastSmall) return null;
      lastSmall = p.small;
      section += (cur ?? 1) * p.small;
      cur = null;
    } else {
      if (p.big >= lastBig) return null;
      lastBig = p.big;
      const base = section + (cur ?? 0);
      if (!base && !bigAloneOk) return null; // まん on its own is a word start, not 10,000
      total += (base || 1) * p.big;
      section = 0;
      cur = null;
      lastSmall = Infinity;
    }
  }
  const v = total + section + (cur ?? 0);
  return Number.isSafeInteger(v) && v < 1e16 ? v : null;
}

/** Value of a run of arabic and kanji numerals, or null when it is not one number. */
function parseRun(run: string): number | null {
  const parts: Part[] = [];
  let positional = false; // 二〇二四 reads digit by digit
  for (const a of run.match(ATOM_RE) ?? []) {
    if (/^\d/.test(a)) {
      if (a.includes('.')) return null; // a decimal is read whole by renderNumber, never inside a compound
      parts.push({ digit: Number(a.replace(/,/g, '')) });
      positional = false;
    } else if (a in KANJI_DIGIT) {
      const last = parts[parts.length - 1];
      if (positional && last && 'digit' in last) last.digit = last.digit * 10 + KANJI_DIGIT[a];
      else parts.push({ digit: KANJI_DIGIT[a] });
      positional = true;
    } else {
      parts.push(a in KANJI_SMALL ? { small: KANJI_SMALL[a] } : { big: KANJI_BIG[a] });
      positional = false;
    }
  }
  return sum(parts, true);
}

function renderNumber(run: string): string | null {
  const yen = run.endsWith('円');
  const body = yen ? run.slice(0, -1) : run;
  const en = yen ? 'えん' : '';
  if (/^\d+\.\d+$/.test(body)) {
    const [i, f] = body.split('.');
    return (i.length > 1 && i.startsWith('0') ? digitByDigit(i) : numberToKana(Number(i))) + 'てん' + digitByDigit(f) + en;
  }
  if (/^\d+$/.test(body) && (body.length > 12 || (body.length > 1 && body.startsWith('0')))) return digitByDigit(body) + en; // phone and id numbers
  const v = parseRun(body);
  if (v === null) return null;
  return yen ? yenKana(v) + en : numberToKana(v);
}

/** Digits and kanji numerals -> canonical kana (a ¥ sign counts as 円). */
function unifyDigits(text: string): string {
  const src = text.replace(/¥\s*(\d[\d,]*)/g, '$1円');
  return src.replace(NUM_RUN, (run, offset: number) => {
    const body = run.endsWith('円') ? run.slice(0, -1) : run;
    if (body.length === 1 && !/\d/.test(body) && !run.endsWith('円') && !COUNTER.test(src.slice(offset + run.length))) return run;
    return renderNumber(run) ?? run;
  });
}

// Kana numerals, read after punctuation is gone so '3 100' and 'さん ひゃく' merge the same way. A run is a number only when it holds
// a unit (じゅう ひゃく せん まん おく), or is one unambiguous digit word right before えん. し, く, ぜろ and れい are not numerals here
// (しじゅう, じゅうしょ, れいぞうこ stay words); よ is 4 only in よえん. Every canonical reading is a fixed point of this pass.
const KANA_TOKEN = 'いち|いっ|さん|よん|よ(?=えん)|しち|なな|ろっ|ろく|はっ|はち|きゅう|じゅう|じゅっ|ひゃく|びゃく|ぴゃく|せん|ぜん|まん|おく|に|ご';
const KANA_RUN = new RegExp(`(?:${KANA_TOKEN})+(円)?`, 'g');
const KANA_TOKENS = new RegExp(KANA_TOKEN.replace('よ(?=えん)', 'よ'), 'g'); // the run was already vetted, so its よ needs no lookahead
const KANA_VALUE: Record<string, number> = { いち: 1, いっ: 1, に: 2, さん: 3, よん: 4, よ: 4, ご: 5, ろく: 6, ろっ: 6, しち: 7, なな: 7, はっ: 8, はち: 8, きゅう: 9 };
const KANA_SMALL: Record<string, number> = { じゅう: 10, じゅっ: 10, ひゃく: 100, びゃく: 100, ぴゃく: 100, せん: 1000, ぜん: 1000 };
const KANA_BIG: Record<string, number> = { まん: 1e4, おく: 1e8 };
const SOLO_BEFORE_YEN = new Set(['いち', 'に', 'さん', 'よん', 'よ', 'ご', 'ろく', 'なな', 'しち', 'はち', 'きゅう']);

function parseKanaRun(tokens: string[], beforeYen: boolean): number | null {
  if (tokens.length === 1 && beforeYen && SOLO_BEFORE_YEN.has(tokens[0])) return KANA_VALUE[tokens[0]];
  if (!tokens.some((t) => t in KANA_SMALL || t in KANA_BIG)) return null;
  const parts: Part[] = tokens.map((t) => (t in KANA_VALUE ? { digit: KANA_VALUE[t] } : t in KANA_SMALL ? { small: KANA_SMALL[t] } : { big: KANA_BIG[t] }));
  return sum(parts, beforeYen && tokens.length === 1 && tokens[0] === 'まん'); // まんえん only; a bare おく is 奥, not 100,000,000
}

function unifyKana(text: string): string {
  return text.replace(KANA_RUN, (run, sign: string | undefined, offset: number) => {
    const body = sign ? run.slice(0, -1) : run;
    const beforeYen = !!sign || text.startsWith('えん', offset + run.length);
    const v = parseKanaRun(body.match(KANA_TOKENS) ?? [], beforeYen);
    if (v === null) return run;
    return (beforeYen ? yenKana(v) : numberToKana(v)) + (sign ? 'えん' : '');
  });
}

// ---------- kana folding ----------

const A_ROW = 'あかさたなはまやらわがざだばぱぁゃゎ';
const I_ROW = 'いきしちにひみりゐぎじぢびぴぃ';
const U_ROW = 'うくすつぬふむゆるぐずづぶぷゔぅゅ';
const E_ROW = 'えけせてねへめれゑげぜでべぺぇ';
const O_ROW = 'おこそとのほもよろをごぞどぼぽぉょ';

const VOWEL_OF = new Map<string, string>();
for (const [row, v] of [[A_ROW, 'あ'], [I_ROW, 'い'], [U_ROW, 'う'], [E_ROW, 'え'], [O_ROW, 'お']] as const) for (const c of row) VOWEL_OF.set(c, v);

/** ー lengthens the vowel before it (コーヒー = こおひい); おう and えい are the same long vowel as おお and ええ. */
function foldLongVowels(s: string): string {
  let out = '';
  for (const c of s) {
    const v = out ? VOWEL_OF.get(out[out.length - 1]) : undefined;
    if (c === 'ー') {
      if (v) out += v; // after ん, っ, latin text or at the start there is nothing to lengthen
    } else if ((c === 'う' && v === 'お') || (c === 'い' && v === 'え')) {
      out += v; // one char at a time, so ええい... and おうう... collapse fully
    } else {
      out += c;
    }
  }
  return out;
}

const DROP = /[\p{P}\p{S}\p{Z}\p{C}\s]/gu;

/**
 * NFKC; strips fillers (えーと, あのー) and punctuation; unifies numbers; katakana -> hiragana; long-vowel equivalences
 * (ありがとー = ありがとう); を/お, づ/ず, ぢ/じ. Idempotent.
 */
export function speechNormalize(text: string, opts?: SpeechNormalizeOptions): string {
  let s = text;
  if (opts?.parseNumbers) s = opts.parseNumbers(s.normalize('NFKC')).text;
  // one pass can expose work for the next (ー dropped from 'ーえーと' makes the filler a start-of-text filler); a fixed point is idempotent by construction
  for (let i = 0; i < 4; i++) {
    const next = normalizeOnce(s);
    if (next === s) break;
    s = next;
  }
  return s;
}

function normalizeOnce(text: string): string {
  let s = stripFillers(text).toLowerCase();
  s = foldLongVowels(unifyDigits(toHiragana(s)));
  s = s.replace(/を/g, 'お').replace(/づ/g, 'ず').replace(/ぢ/g, 'じ').replace(/ゐ/g, 'い').replace(/ゑ/g, 'え').replace(DROP, '');
  return unifyKana(s);
}
