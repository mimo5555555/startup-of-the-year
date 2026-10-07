import { hasKanji, kanaToRomaji } from '@lw/core';
import { NUMERAL_TOKEN, readNumeralTokens } from './lexicon/numbers';
import type { Gloss, LexEntry, Line, Token, Vars } from './types';

const PUNCT_CHARS = '。、！？!?,.「」『』…・（）()';
const isPunctOnly = (s: string) => s.length > 0 && Array.from(s).every((c) => PUNCT_CHARS.includes(c));
const VAR = /^\{(\w+)\}$/;
const ASCII_RAW = /^[A-Za-z0-9@#_.+-]+$/;

/** Split trailing/leading punctuation off a piece so authors can write `ですか？`. */
function splitPunct(piece: string): string[] {
  const chars = Array.from(piece);
  let a = 0;
  let b = chars.length;
  while (a < b && PUNCT_CHARS.includes(chars[a])) a++;
  while (b > a && PUNCT_CHARS.includes(chars[b - 1])) b--;
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
    rom: e.rom ?? kanaToRomaji(reading ?? e.s),
    gloss: { en: e.en, ar: e.ar },
    grammar: e.g,
  };
}

export class Lexicon {
  private map = new Map<string, LexEntry>();
  constructor(entries: LexEntry[]) {
    for (const e of entries) {
      if (this.map.has(e.s)) throw new Error(`Duplicate lexicon entry: ${e.s}`);
      this.map.set(e.s, e);
    }
  }
  get(s: string) {
    return this.map.get(s);
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

export function tokenize(markup: string, lex: Lexicon, vars: Vars = {}): TokenizeResult {
  const tokens: Token[] = [];
  const missing: string[] = [];
  for (const piece of markup.split('|')) {
    if (!piece) continue;
    for (const part of splitPunct(piece)) {
      if (isPunctOnly(part)) {
        tokens.push({ s: part, rom: part === '。' ? '.' : part === '、' ? ',' : part === '？' ? '?' : part === '！' ? '!' : part, punct: true });
        continue;
      }
      const v = VAR.exec(part);
      if (v) {
        const val = vars[v[1]];
        if (!val) {
          tokens.push({ s: '…', rom: '…', raw: true });
        } else if (val.raw) {
          tokens.push({ s: val.ja, rom: val.ja, raw: true });
        } else {
          const inner = tokenize(val.ja, lex);
          tokens.push(...inner.tokens);
          missing.push(...inner.missing);
        }
        continue;
      }
      const e = lex.get(part);
      if (e) {
        tokens.push(entryToToken(e));
      } else if (ASCII_RAW.test(part)) {
        tokens.push({ s: part, rom: part, raw: true });
      } else {
        missing.push(part);
        tokens.push({ s: part, rom: kanaToRomaji(part), raw: true });
      }
    }
  }
  return { tokens, missing };
}

export const plainText = (tokens: Token[]) => tokens.map((t) => t.s).join('');
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
      out.push(readNumeralTokens(spoken.slice(i, j).map((t) => t.s)));
      i = j - 1;
    } else out.push(spoken[i].s);
  }
  return out.join('');
}
export const readingText = (tokens: Token[]) => tokens.map((t) => (t.r ?? t.s)).join('');
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
