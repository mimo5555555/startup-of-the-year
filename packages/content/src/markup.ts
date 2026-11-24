import { hasJapanese, hasKanji, kanaToRomaji } from '@lw/core';
import { NUMERAL_TOKEN, readNumeralTokens } from './lexicon/numbers';
import type { Gloss, LexEntry, Line, Token, Vars } from './types';

const PUNCT_CHARS = '。、！？!?,.「」『』…・（）()';
const isPunctOnly = (s: string, punct = PUNCT_CHARS) => s.length > 0 && Array.from(s).every((c) => punct.includes(c));
const VAR = /^\{(\w+)\}$/;
const ASCII_RAW = /^[A-Za-z0-9@#_.,+-]+$/;
/** Latin letters (with the accented ones) */
const LATIN = /[A-Za-z\u00c0-\u024f]/;
/** punctuation of Latin-script text, split off a word's edges (an apostrophe inside a word stays: geht's); Spanish opens with ¿ and ¡ */
const LATIN_PUNCT = PUNCT_CHARS + '„“”":;–¿¡«»';

/** Split trailing/leading punctuation off a piece so authors can write `ですか？`. */
function splitPunct(piece: string, punct = PUNCT_CHARS): string[] {
  const chars = Array.from(piece);
  let a = 0;
  let b = chars.length;
  while (a < b && punct.includes(chars[a])) a++;
  while (b > a && punct.includes(chars[b - 1])) b--;
  const out: string[] = [];
  for (let i = 0; i < a; i++) out.push(chars[i]);
  if (b > a) out.push(chars.slice(a, b).join(''));
  for (let i = b; i < chars.length; i++) out.push(chars[i]);
  return out;
}

export function entryToToken(e: LexEntry): Token {
  const reading = e.r;
  return {
    s: e.s,
    r: reading && hasKanji(e.s) ? reading : undefined,
    // a word of a Latin-script language is its own romanisation
    rom: e.rom ?? (hasJapanese(reading ?? e.s) ? kanaToRomaji(reading ?? e.s) : e.s),
    gloss: { en: e.en, ar: e.ar },
    grammar: e.g,
  };
}

export class Lexicon {
  private map = new Map<string, LexEntry>();
  /** the entries by their lower-case form: 「Ich」 at the start of a sentence and a typed 「brötchen」 are found */
  private lower = new Map<string, LexEntry>();
  /**
   * `latin`: the language is written in Latin letters (German), so an unknown Latin word in a line is a missing word, not raw ASCII
   * (Japanese lines keep `Wi-Fi` or a password as raw text)
   */
  readonly latin: boolean;
  constructor(entries: LexEntry[], opts: { latin?: boolean } = {}) {
    this.latin = !!opts.latin;
    for (const e of entries) {
      if (this.map.has(e.s)) throw new Error(`Duplicate lexicon entry: ${e.s}`);
      this.map.set(e.s, e);
      const k = e.s.toLowerCase();
      if (k !== e.s && !this.lower.has(k)) this.lower.set(k, e);
    }
  }
  /** the entry written exactly so, else one that differs only in letter case */
  get(s: string) {
    return this.map.get(s) ?? this.map.get(s.toLowerCase()) ?? this.lower.get(s.toLowerCase());
  }
  has(s: string) {
    return this.map.has(s);
  }
  all() {
    return [...this.map.values()];
  }
}

export interface TokenizeResult {
  tokens: Token[];
  missing: string[];
}

/**
 * The pieces of a markup string: split on `|`; a piece with spaces and no Japanese in it (German: `Guten Tag!`, a price `2,50 €`) is
 * also split on its spaces, and each word after a space is marked `sp`. A Japanese piece keeps its space (a name like 「高橋 凜」).
 */
function markupPieces(markup: string): Array<{ text: string; sp: boolean; latin: boolean }> {
  const out: Array<{ text: string; sp: boolean; latin: boolean }> = [];
  for (const piece of markup.split('|')) {
    if (!piece) continue;
    if (!/\s/.test(piece) || hasJapanese(piece)) {
      out.push({ text: piece, sp: false, latin: LATIN.test(piece) && !hasJapanese(piece) });
      continue;
    }
    const words = piece.split(/(\s+)/);
    let sp = false;
    for (const w of words) {
      if (!w) continue;
      if (/^\s+$/.test(w)) {
        sp = out.length > 0;
        continue;
      }
      out.push({ text: w, sp, latin: true });
      sp = false;
    }
  }
  return out;
}

export function tokenize(markup: string, lex: Lexicon, vars: Vars = {}): TokenizeResult {
  const tokens: Token[] = [];
  const missing: string[] = [];
  for (const piece of markupPieces(markup)) {
    let first = true;
    // the space before a word goes on the word's first token (not on punctuation split off its front: „Brezel“)
    const push = (t: Token) => {
      tokens.push(first && piece.sp ? { ...t, sp: true } : t);
      first = false;
    };
    for (const part of splitPunct(piece.text, piece.latin ? LATIN_PUNCT : PUNCT_CHARS)) {
      if (isPunctOnly(part, piece.latin ? LATIN_PUNCT : PUNCT_CHARS)) {
        push({ s: part, rom: part === '。' ? '.' : part === '、' ? ',' : part === '？' ? '?' : part === '！' ? '!' : part, punct: true });
        continue;
      }
      const v = VAR.exec(part);
      if (v) {
        const val = vars[v[1]];
        if (!val) {
          push({ s: '…', rom: '…', raw: true });
        } else if (val.raw) {
          push({ s: val.ja, rom: val.ja, raw: true });
        } else {
          const inner = tokenize(val.ja, lex);
          inner.tokens.forEach(push);
          missing.push(...inner.missing);
        }
        continue;
      }
      const e = lex.get(part);
      if (e) {
        // the word as written (「Ich」 at the start of a sentence), with the entry's reading and meaning
        push(e.s === part ? entryToToken(e) : { ...entryToToken(e), s: part, rom: e.rom ?? part });
      } else if (ASCII_RAW.test(part) && !(lex.latin && /\p{L}/u.test(part))) {
        push({ s: part, rom: part, raw: true });
      } else {
        missing.push(part);
        push({ s: part, rom: kanaToRomaji(part), raw: true });
      }
    }
  }
  return { tokens, missing };
}

/** The tokens' text joined as written: no spaces in Japanese, a space before each token marked `sp` (German words). */
export const plainText = (tokens: Token[]) => tokens.map((t) => (t.sp ? ' ' : '') + t.s).join('');
/** Text for the speech engine: user-supplied Arabic-script names are left out. */
export function speakableText(tokens: Token[]): string {
  const out: string[] = [];
  const spoken = tokens.filter((t) => !(t.raw && /[\u0600-\u06ff]/.test(t.s)));
  for (let i = 0; i < spoken.length; i++) {
    // a run of numeral tokens that ends in 円 is a price: read it by kana so 八百 / 六百 / 三千 / 四円 come out right (§14.4);
    // a run in front of a counter (九時, 十四日) stays as written because the counter picks its own reading
    let j = i;
    while (j < spoken.length && !spoken[j].raw && NUMERAL_TOKEN.test(spoken[j].s)) j++;
    if (j > i && spoken[j - 1].s === '円') {
      out.push((spoken[i].sp ? ' ' : '') + readNumeralTokens(spoken.slice(i, j).map((t) => t.s)));
      i = j - 1;
    } else out.push((spoken[i].sp ? ' ' : '') + spoken[i].s);
  }
  return out.join('').trim();
}
export const readingText = (tokens: Token[]) => tokens.map((t) => (t.sp ? ' ' : '') + (t.r ?? t.s)).join('');
/** Space-separated romaji with punctuation attached to the preceding word. */
export function romajiText(tokens: Token[]): string {
  let out = '';
  for (const t of tokens) {
    if (t.punct) out += t.rom;
    else out += (out && !/[「『(]$/.test(out) ? ' ' : '') + t.rom;
  }
  return out.trim();
}

/** Substitute {slot} placeholders in English/Arabic gloss text. */
export function fillGloss(text: string, vars: Vars, lang: 'en' | 'ar'): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = vars[k];
    if (!v) return '…';
    return v.raw ? v.ja : (v.gloss ? v.gloss[lang] : v.ja);
  });
}

const capitalise = (s: string) => s.replace(/^\p{Ll}/u, (m) => m.toUpperCase());

export function resolveLine(line: Line, lex: Lexicon, vars: Vars = {}) {
  const { tokens } = tokenize(line.ja, lex, vars);
  return {
    tokens,
    plain: line.tts ? line.tts : speakableText(tokens),
    written: plainText(tokens),
    // a filled-in word can land at the start of the sentence ("{item}, got it.")
    en: capitalise(fillGloss(line.en, vars, 'en')),
    ar: fillGloss(line.ar, vars, 'ar'),
  };
}

export type ResolvedLine = ReturnType<typeof resolveLine>;
export const emptyGloss = (): Gloss => ({ en: '', ar: '' });


/**
 * Break free text (what the learner typed or said) into tokens by greedy longest match against the
 * dictionary. Unknown runs stay together as raw tokens. A real build swaps this for a bundled analyser.
 */
export function segmentFree(text: string, lex: Lexicon, maxLen = 14): Token[] {
  // (Japanese: no spaces between words; a spaced language reads its words with `segmentWords`)
  const chars = Array.from(text);
  const tokens: Token[] = [];
  let raw = '';
  const flush = () => {
    if (raw) {
      tokens.push({ s: raw, rom: raw, raw: true });
      raw = '';
    }
  };
  let i = 0;
  while (i < chars.length) {
    let hit: LexEntry | undefined;
    let len = 0;
    for (let n = Math.min(maxLen, chars.length - i); n >= 1; n--) {
      const e = lex.get(chars.slice(i, i + n).join(''));
      if (e) {
        hit = e;
        len = n;
        break;
      }
    }
    if (hit) {
      flush();
      tokens.push(entryToToken(hit));
      i += len;
    } else if (PUNCT_CHARS.includes(chars[i])) {
      flush();
      tokens.push({ s: chars[i], rom: chars[i], punct: true });
      i++;
    } else if (/\s/.test(chars[i])) {
      flush();
      i++;
    } else {
      raw += chars[i];
      i++;
    }
  }
  flush();
  return tokens;
}

/**
 * Break free text of a language that spaces its words (German) into tokens: one per word, looked up in the dictionary whatever its
 * letter case; punctuation split off; an unknown word stays as a raw token. Each word after the first carries `sp`.
 */
export function segmentWords(text: string, lex: Lexicon): Token[] {
  const tokens: Token[] = [];
  const words = text.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  words.forEach((word, i) => {
    let first = i > 0;
    for (const part of splitPunct(word, LATIN_PUNCT)) {
      const sp = first;
      first = false;
      if (isPunctOnly(part, LATIN_PUNCT)) {
        tokens.push(sp ? { s: part, rom: part, punct: true, sp } : { s: part, rom: part, punct: true });
        continue;
      }
      const e = lex.get(part);
      const t: Token = e ? { ...entryToToken(e), s: part, rom: e.rom ?? part } : { s: part, rom: part, raw: true };
      tokens.push(sp ? { ...t, sp } : t);
    }
  });
  return tokens;
}
