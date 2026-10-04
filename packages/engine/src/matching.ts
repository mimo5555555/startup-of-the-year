import { hasKanji, normJa, toKatakana } from '@lw/core';
import { LEXICON, SLOTS, segmentFree, type IntentDef, type SceneNode, type SlotOption } from '@lw/content';

/**
 * Normalise for matching: dictionary words written with kanji are replaced by their reading, so
 * 辛い and からい (or 水 and みず) match the same keyword; then script and punctuation are flattened.
 */
export function normMatch(text: string): string {
  const tokens = segmentFree(text.normalize('NFKC'), LEXICON);
  return normJa(tokens.map((t) => (!t.raw && !t.punct && t.r ? t.r : t.s)).join(''));
}

/** Normalised keyword; one-character kana would match inside almost anything, so they are ignored. */
const keyCache = new Map<string, string>();
function nk(k: string): string {
  let v = keyCache.get(k);
  if (v === undefined) {
    const n = normMatch(k);
    v = n.length >= 2 || (n.length === 1 && hasKanji(n)) ? n : '';
    keyCache.set(k, v);
  }
  return v;
}

export function findSlotJa(slot: string, norm: string, allowed?: string[]): { opt: SlotOption; len: number } | null {
  let best: { opt: SlotOption; len: number } | null = null;
  for (const opt of SLOTS[slot] ?? []) {
    if (allowed && !allowed.includes(opt.id)) continue;
    for (const k of opt.keys.ja) {
      const key = nk(k);
      if (key && norm.includes(key) && (!best || key.length > best.len)) best = { opt, len: key.length };
    }
  }
  return best;
}

export interface IntentHit {
  intent: IntentDef;
  score: number;
  option?: SlotOption;
  rawCountry?: string;
  rawName?: string;
}

const GREETING_PREFIX = /^(?:はじめまして|こんにちは|こんばんは|おはようございます|おはよう|どうも)[、。!！\s]*/;

/** Pull a spoken name out of "わたしは〇〇です" style sentences. */
export function captureName(text: string): string | null {
  let t = text.normalize('NFKC').trim();
  t = t.replace(GREETING_PREFIX, '').replace(GREETING_PREFIX, '');
  const m =
    /(?:わたし|私|わたくし|ぼく|僕|おれ|俺)(?:の名前)?は\s*(.+?)\s*(?:です|と申します|といいます|と言います|だ)/.exec(t) ??
    /^\s*(.+?)\s*(?:です|と申します|といいます|と言います)[。.!！]*$/.exec(t);
  if (!m) return null;
  const name = m[1].replace(/^[、。\s]+|[、。\s]+$/g, '').replace(/さん$/, '');
  if (!name || name.length > 20 || /^(わたし|私|ぼく|僕|おれ|俺|はい|いいえ)$/.test(name)) return null;
  return name;
}

/** Pull a country out of "〇〇から来ました" when it is not in the slot list. */
export function captureCountry(text: string): string | null {
  const t = text.normalize('NFKC').trim().replace(GREETING_PREFIX, '');
  const m = /^(?:わたし|私|ぼく|僕)?(?:は)?\s*([^\s、。]{1,14}?)\s*(?:から|の出身|出身|です)/.exec(t);
  if (!m) return null;
  const v = m[1];
  if (!v || /^(わたし|私|ぼく|僕|どこ|なに|何)$/.test(v)) return null;
  return v;
}

function evalIntent(it: IntentDef, norm: string, raw: string): IntentHit | null {
  if (it.none?.some((k) => nk(k) && norm.includes(nk(k)))) return null;
  let score = 0;
  let matchedSomething = false;

  if (it.all) {
    for (const group of it.all) {
      const hits = group.map(nk).filter((k) => k && norm.includes(k));
      if (!hits.length) return null;
      score += 10 + Math.max(...hits.map((h) => h.length));
      matchedSomething = true;
    }
  }
  if (it.any) {
    const hits = it.any.map(nk).filter((k) => k && norm.includes(k));
    if (!hits.length) return null;
    score += 5 + Math.max(...hits.map((h) => h.length));
    matchedSomething = true;
  }
  let option: SlotOption | undefined;
  let rawCountry: string | undefined;
  if (it.slot) {
    const f = findSlotJa(it.slot, norm, it.slotOptions);
    if (f) {
      option = f.opt;
      score += 8 + f.len;
      matchedSomething = true;
    } else if (it.capture === 'country') {
      const c = captureCountry(raw);
      if (c) rawCountry = c;
      else if (it.slotRequired) return null;
    } else if (it.slotRequired) {
      return null;
    }
  }
  let rawName: string | undefined;
  if (it.capture === 'name') {
    const n = captureName(raw);
    if (n) rawName = n;
  }
  if (!matchedSomething && !rawCountry) return null;
  return { intent: it, score, option, rawCountry, rawName };
}

export function matchNodeIntent(node: SceneNode, text: string): IntentHit | null {
  const norm = normMatch(text);
  if (!norm) return null;
  let best: IntentHit | null = null;
  for (const it of node.intents) {
    const hit = evalIntent(it, norm, text);
    if (hit && (!best || hit.score > best.score)) best = hit;
  }
  return best;
}

export interface GlobalIntent {
  id: 'slow' | 'repeat' | 'dont_understand' | 'thanks' | 'excuse' | 'how_are_you' | 'greet' | 'goodbye';
  any: string[];
  priority: number;
}

export const GLOBAL_INTENTS: GlobalIntent[] = [
  { id: 'slow', any: ['ゆっくり'], priority: 9 },
  { id: 'repeat', any: ['もういちど', 'もう一度', 'くりかえ', 'もういっかい', 'もうすこし'], priority: 8 },
  { id: 'dont_understand', any: ['わかりません', 'わからない', 'わかんない', 'わからなかった'], priority: 8 },
  { id: 'how_are_you', any: ['おげんき', 'げんきですか'], priority: 5 },
  { id: 'thanks', any: ['ありがとう'], priority: 5 },
  { id: 'goodbye', any: ['さようなら', 'じゃあね', 'またね', 'ばいばい'], priority: 5 },
  { id: 'greet', any: ['こんにちは', 'こんばんは', 'おはよう'], priority: 3 },
  { id: 'excuse', any: ['すみません', 'すいません', 'ごめん'], priority: 2 },
];

export function matchGlobal(text: string): GlobalIntent | null {
  const norm = normMatch(text);
  let best: GlobalIntent | null = null;
  for (const g of GLOBAL_INTENTS) {
    if (g.any.some((k) => nk(k) && norm.includes(nk(k))) && (!best || g.priority > best.priority)) best = g;
  }
  return best;
}

export { toKatakana };
