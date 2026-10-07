import { hasKanji, normJa, toKatakana } from '@lw/core';
import { JP_PACK, LEXICON, SLOTS, segmentFree, type IntentDef, type SceneNode, type SlotOption } from '@lw/content';
import { speechNormalize, stripFillers, type NumberParser } from './speechNormalize';

let numberParser: NumberParser | null = null;
/** Replaces the pack's number reader (tests, or a pack whose language plugin is not the Japanese one); `null` restores `JP_PACK.lang.parseNumbers`. */
export function setNumberParser(fn: NumberParser | null): void {
  numberParser = fn;
  keyCache.clear(); // keys were normalised with the previous reader
}

/** Digits, kanji and kana numerals in free text: the unified text and the integers found (D26). */
export function parseNumbersIn(text: string): { text: string; numbers: number[] } {
  return (numberParser ?? JP_PACK.lang.parseNumbers)(text);
}

/** A text normalised two ways; a keyword matches in either (§12.4). */
export interface MatchForms {
  /** long-vowel marks dropped: 「kohi」 is コーヒー typed the way beginners type it */
  loose: string;
  /** long-vowel marks lengthen the vowel and づ/ず, ぢ/じ, を/お fold: ありがとー is ありがとう */
  folded: string;
}

/**
 * Normalise for matching (§12.4): numbers are unified (450円, 四百五十円 and よんひゃくごじゅうえん become one token); dictionary
 * words written with kanji are replaced by their reading, so 辛い and からい (or 水 and みず) match the same keyword; then fillers
 * (えーと), script and punctuation are flattened.
 */
export function matchForms(text: string): MatchForms {
  const tokens = segmentFree(parseNumbersIn(text.normalize('NFKC')).text, LEXICON);
  const read = tokens.map((t) => (!t.raw && !t.punct && t.r ? t.r : t.s)).join('');
  return { loose: normJa(stripFillers(read)), folded: normJa(speechNormalize(read)) };
}

/** The one normal form other modules compare with (the copy rule, duplicate turns, `TurnFacts.norm`): the folded one. */
export const normMatch = (text: string): string => matchForms(text).folded;

/** Normalised keyword; one-character kana would match inside almost anything, so they are ignored. */
const keyCache = new Map<string, MatchForms | null>();
function nk(k: string): MatchForms | null {
  let v = keyCache.get(k);
  if (v === undefined) {
    const f = matchForms(k);
    v = f.loose.length >= 2 || (f.loose.length === 1 && hasKanji(f.loose)) ? f : null;
    keyCache.set(k, v);
  }
  return v;
}

/** How much of the text a keyword covers (its length), 0 when it is not in the text. */
function keyHit(norm: MatchForms, k: string): number {
  const key = nk(k);
  if (!key) return 0;
  if (norm.loose.includes(key.loose)) return key.loose.length;
  return key.folded && norm.folded.includes(key.folded) ? key.folded.length : 0;
}

export function findSlotJa(slot: string, norm: MatchForms, allowed?: string[]): { opt: SlotOption; len: number } | null {
  let best: { opt: SlotOption; len: number } | null = null;
  for (const opt of SLOTS[slot] ?? []) {
    if (allowed && !allowed.includes(opt.id)) continue;
    for (const k of opt.keys.ja) {
      const len = keyHit(norm, k);
      if (len && (!best || len > best.len)) best = { opt, len };
    }
  }
  return best;
}

export interface IntentHit {
  intent: IntentDef;
  score: number;
  option?: SlotOption;
  /** `IntentDef.alsoSlots` that the same utterance filled; they never block a turn */
  also?: Array<{ slot: string; option: SlotOption }>;
  rawCountry?: string;
  rawName?: string;
  /** the first number in the utterance (`say_total`, `haggle`), however it was written */
  number?: number;
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

function evalIntent(it: IntentDef, norm: MatchForms, raw: string): IntentHit | null {
  if (it.none?.some((k) => keyHit(norm, k))) return null;
  let score = 0;
  let matchedSomething = false;

  if (it.all) {
    for (const group of it.all) {
      const hits = group.map((k) => keyHit(norm, k)).filter(Boolean);
      if (!hits.length) return null;
      score += 10 + Math.max(...hits);
      matchedSomething = true;
    }
  }
  if (it.any) {
    const hits = it.any.map((k) => keyHit(norm, k)).filter(Boolean);
    if (!hits.length) return null;
    score += 5 + Math.max(...hits);
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
  const hit: IntentHit = { intent: it, score, option, rawCountry, rawName };
  if (it.alsoSlots) {
    const also: NonNullable<IntentHit['also']> = [];
    for (const slot of it.alsoSlots) {
      const f = findSlotJa(slot, norm);
      if (f) also.push({ slot, option: f.opt });
    }
    if (also.length) hit.also = also;
  }
  return hit;
}

export function matchNodeIntent(node: SceneNode, text: string): IntentHit | null {
  const norm = matchForms(text);
  if (!norm.loose) return null;
  let best: IntentHit | null = null;
  for (const it of node.intents) {
    const hit = evalIntent(it, norm, text);
    if (hit && (!best || hit.score > best.score)) best = hit;
  }
  if (best) {
    const [n] = parseNumbersIn(text.normalize('NFKC')).numbers;
    if (n !== undefined) best.number = n;
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
  const norm = matchForms(text);
  let best: GlobalIntent | null = null;
  for (const g of GLOBAL_INTENTS) {
    if (g.any.some((k) => keyHit(norm, k)) && (!best || g.priority > best.priority)) best = g;
  }
  return best;
}

export { toKatakana };
