import { hasArabic } from '@lw/core';
import { PHRASEBOOK, SLOTS, type L1, type PhraseEntry, type SlotOption, type Vars } from '@lw/content';
import { contentWords, escapeRe, jaccard, norm, stripAl, stripQuantity } from './normalize';

export interface TranslationResult {
  phraseIds: string[];
  /** Japanese markup, possibly with {slot} variables resolved through `vars` */
  ja: string;
  vars: Vars;
  /** 1 for an exact phrasebook hit, lower for a close match */
  confidence: number;
  exact: boolean;
  lang: L1;
}

export interface TranslatePort {
  translate(text: string, from?: L1): Promise<TranslationResult | null>;
}

interface Compiled {
  phrase: PhraseEntry;
  lang: L1;
  pattern: string; // normalised pattern
  re?: RegExp; // present when the pattern has a slot
  slot?: string;
  literalLen: number;
  words: string[];
}

const SLOT_RE = /\{(\w+)\}/;
const optionKeyCache = new Map<string, Array<{ opt: SlotOption; key: string }>>();

function slotKeys(slot: string, lang: L1) {
  const ck = `${slot}:${lang}`;
  let hit = optionKeyCache.get(ck);
  if (!hit) {
    hit = [];
    for (const opt of SLOTS[slot] ?? []) for (const k of opt.keys[lang]) hit.push({ opt, key: norm(k, lang) });
    hit.sort((a, b) => b.key.length - a.key.length);
    optionKeyCache.set(ck, hit);
  }
  return hit;
}

export function findOptionByText(slot: string, value: string, lang: L1): SlotOption | undefined {
  let v = stripQuantity(norm(value, lang), lang);
  if (!v) return undefined;
  const candidates = lang === 'ar' ? [v, stripAl(v)] : [v];
  const keys = slotKeys(slot, lang);
  for (const c of candidates) {
    const exact = keys.find((k) => k.key === c || (lang === 'ar' && stripAl(k.key) === c));
    if (exact) return exact.opt;
  }
  return undefined;
}

function compile(): Compiled[] {
  const out: Compiled[] = [];
  for (const phrase of PHRASEBOOK) {
    for (const lang of ['en', 'ar'] as const) {
      for (const raw of phrase[lang]) {
        const pattern = norm(raw, lang);
        const m = SLOT_RE.exec(pattern);
        if (m) {
          const [before, after] = [pattern.slice(0, m.index), pattern.slice(m.index + m[0].length)];
          const re = new RegExp(`^${escapeRe(before)}(.+?)${escapeRe(after)}$`);
          out.push({ phrase, lang, pattern, re, slot: m[1], literalLen: before.length + after.length, words: [] });
        } else {
          out.push({ phrase, lang, pattern, literalLen: pattern.length, words: contentWords(pattern, lang) });
        }
      }
    }
  }
  return out;
}

const COMPILED = compile();

/** Realign a captured (normalised) value with the user's original spelling and casing. */
function originalCase(original: string, captured: string, lang: L1): string {
  const words = original.split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''));
  const wanted = captured.split(' ');
  const picked: string[] = [];
  for (const w of wanted) {
    const hit = words.find((o) => norm(o, lang) === w);
    picked.push(hit ?? (lang === 'en' ? w.charAt(0).toUpperCase() + w.slice(1) : w));
  }
  return picked.join(' ');
}

interface Hit {
  c: Compiled;
  score: number;
  vars: Vars;
  exact: boolean;
}

function matchOne(original: string, text: string, lang: L1): Hit | null {
  let best: Hit | null = null;
  const consider = (h: Hit) => {
    if (!best || h.score > best.score) best = h;
  };
  const words = contentWords(text, lang);
  for (const c of COMPILED) {
    if (c.lang !== lang) continue;
    if (c.re) {
      const m = c.re.exec(text);
      if (!m) continue;
      const value = m[1];
      const slot = c.slot!;
      let vars: Vars | null = null;
      if (slot === 'name') {
        const nm = originalCase(original, value, lang);
        if (nm.split(' ').length <= 3) vars = { name: { ja: nm, raw: true } };
      } else {
        const opt = findOptionByText(slot, value, lang);
        if (opt) vars = { [slot]: { ja: opt.ja, gloss: opt.gloss } };
        else if (!c.phrase.closedSlot && value.split(' ').length <= 3) vars = { [slot]: { ja: originalCase(original, value, lang), raw: true } };
      }
      if (!vars) continue;
      consider({ c, score: 0.95 + Math.min(c.literalLen, 40) / 1000, vars, exact: true });
    } else if (c.pattern === text) {
      consider({ c, score: 1, vars: {}, exact: true });
    }
  }
  if (best) return best;
  // fuzzy: only against slot-free patterns
  for (const c of COMPILED) {
    if (c.lang !== lang || c.re) continue;
    const s = jaccard(words, c.words);
    if (s >= 0.6 && c.words.length >= 2) consider({ c, score: s * 0.9, vars: {}, exact: false });
  }
  return best;
}

const FILLERS = /^(hi|hello|hey|well|so|um|uh|okay|ok|yes|yeah|excuse me|sorry|and)\s+(?=\S)/;
const SPLIT = /[.!?;,،؟]+/;

function translateWhole(text: string, lang: L1): Hit | null {
  const n = norm(text, lang);
  if (!n) return null;
  let hit = matchOne(text, n, lang);
  const stripped = n.replace(FILLERS, '');
  if (stripped !== n && stripped.split(' ').length >= 2) {
    const alt = matchOne(text, stripped, lang);
    if (alt && (!hit || alt.score > hit.score)) hit = alt;
  }
  return hit;
}

export function detectL1(text: string): L1 {
  return hasArabic(text) ? 'ar' : 'en';
}

function mergeVars(a: Vars, b: Vars): Vars {
  return { ...a, ...b };
}

export function translatePhrase(text: string, from?: L1): TranslationResult | null {
  const lang = from ?? detectL1(text);
  const whole = translateWhole(text, lang);
  if (whole && whole.exact) {
    return { phraseIds: [whole.c.phrase.id], ja: whole.c.phrase.ja, vars: whole.vars, confidence: whole.score, exact: true, lang };
  }
  // several short sentences: translate each and join
  const parts = text.split(SPLIT).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const hits = parts.map((p) => translateWhole(p, lang));
    if (hits.every(Boolean)) {
      const list = (hits as Hit[])
        .filter((h, i, all) => !(h.c.phrase.id === 'please' && all.length > 1))
        // "No thanks, that is all" says the same thing twice
        .filter((h, i, all) => i === 0 || h.c.phrase.id !== all[i - 1].c.phrase.id);
      return {
        phraseIds: list.map((h) => h.c.phrase.id),
        ja: list.map((h) => h.c.phrase.ja).join('|'),
        vars: list.reduce<Vars>((acc, h) => mergeVars(acc, h.vars), {}),
        confidence: Math.min(...list.map((h) => h.score)),
        exact: list.every((h) => h.exact),
        lang,
      };
    }
  }
  if (whole) {
    return { phraseIds: [whole.c.phrase.id], ja: whole.c.phrase.ja, vars: whole.vars, confidence: whole.score, exact: false, lang };
  }
  return null;
}

/** Stand-in for the on-device translation model: a phrasebook with fuzzy matching. */
export class PhrasebookTranslator implements TranslatePort {
  async translate(text: string, from?: L1) {
    return translatePhrase(text, from);
  }
}
