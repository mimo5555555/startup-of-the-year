import { hasJapanese, hasKanji, normJa, toKatakana } from '@lw/core';
import { JP_PACK, LEXICON, REACTIONS, SLOTS, segmentFree, type IntentDef, type Lexicon, type Line, type SceneNode, type SlotOption, type Token } from '@lw/content';
import { speechNormalize, stripFillers, type NumberParser } from './speechNormalize';

// ---------------------------------------------------------------------------------------------------------------
// The target language: everything the engine needs to know about the language the learner is learning
// ---------------------------------------------------------------------------------------------------------------

/** The global moves a learner can make anywhere (ask to slow down, say thanks…), with the keys that call them. */
export interface GlobalIntent {
  id: 'slow' | 'repeat' | 'dont_understand' | 'thanks' | 'excuse' | 'how_are_you' | 'greet' | 'goodbye';
  any: string[];
  priority: number;
}

/** What the character says to a global move (and when nothing was understood). */
export type Reactions = Record<'greet' | 'thanks' | 'excuse' | 'how_are_you' | 'slow' | 'goodbye' | 'fallback', Line>;

/**
 * The language being learned (docs/ROADMAP.md, "other languages"). The engine reads text only through this: how free text is
 * normalised and searched for keywords, how it is split into words, how numbers are read, what a name sounds like, and its own tables
 * (the dictionary, the slots, the global moves and the character's reactions). Japanese is the default (`JA`); a session can be given
 * another (`SessionOptions.language`), and `setTargetLanguage` changes the default for the calls that take none.
 */
export interface TargetLanguage {
  /** 'ja', 'de' */
  id: string;
  /** BCP-47 for speech recognition and synthesis: 'ja-JP', 'de-DE' */
  locale: string;
  lexicon: Lexicon;
  slots: Record<string, SlotOption[]>;
  reactions: Reactions;
  globalIntents: GlobalIntent[];
  /** a text normalised two ways for keyword search (§12.4) */
  matchForms(text: string): MatchForms;
  /** a normalised keyword is long enough to mean something (a one-kana key would match inside anything) */
  keyUsable(key: MatchForms): boolean;
  /** whether a normalised keyword occurs in a normalised text (Japanese: anywhere; a spaced language: at a word start) */
  contains(text: string, key: string): boolean;
  /** numerals in free text unified to digits, and the integers found */
  parseNumbers(text: string): { text: string; numbers: number[] };
  /** free text (what the learner typed or said) as dictionary tokens */
  segment(text: string): Token[];
  /** a spoken name ("I am Sam") and a country ("I am from Egypt"), as written */
  captureName(text: string): string | null;
  captureCountry(text: string): string | null;
  /** whether typed text is in this language (else it is the learner's own, to be translated) */
  isTarget(text: string): boolean;
}

let currentLanguage: TargetLanguage | null = null;
/** The default target language of the calls that are given none; `null` restores Japanese. */
export function setTargetLanguage(lang: TargetLanguage | null): void {
  currentLanguage = lang;
}
/** The default target language: Japanese unless `setTargetLanguage` said otherwise. */
export function targetLanguage(): TargetLanguage {
  return currentLanguage ?? JA;
}

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
function jaMatchForms(text: string): MatchForms {
  const tokens = segmentFree(parseNumbersIn(text.normalize('NFKC')).text, LEXICON);
  const read = tokens.map((t) => (!t.raw && !t.punct && t.r ? t.r : t.s)).join('');
  return { loose: normJa(stripFillers(read)), folded: normJa(speechNormalize(read)) };
}

/** Normalise free text for keyword search in the target language (Japanese by default). */
export function matchForms(text: string, lang: TargetLanguage = targetLanguage()): MatchForms {
  return lang.matchForms(text);
}

/** The one normal form other modules compare with (the copy rule, duplicate turns, `TurnFacts.norm`): the folded one. */
export const normMatch = (text: string, lang: TargetLanguage = targetLanguage()): string => lang.matchForms(text).folded;

/** Normalised keywords, per language; a key too short to mean anything is null. */
const keyCache = new Map<string, MatchForms | null>();
function nk(k: string, lang: TargetLanguage): MatchForms | null {
  const id = `${lang.id}\u0000${k}`;
  let v = keyCache.get(id);
  if (v === undefined) {
    const f = lang.matchForms(k);
    v = lang.keyUsable(f) ? f : null;
    keyCache.set(id, v);
  }
  return v;
}

/** How much of the text a keyword covers (its length), 0 when it is not in the text. */
function keyHit(norm: MatchForms, k: string, lang: TargetLanguage): number {
  const key = nk(k, lang);
  if (!key) return 0;
  if (lang.contains(norm.loose, key.loose)) return key.loose.length;
  return key.folded && lang.contains(norm.folded, key.folded) ? key.folded.length : 0;
}

export function findSlotJa(slot: string, norm: MatchForms, allowed?: string[], lang: TargetLanguage = targetLanguage()): { opt: SlotOption; len: number } | null {
  let best: { opt: SlotOption; len: number } | null = null;
  for (const opt of lang.slots[slot] ?? []) {
    if (allowed && !allowed.includes(opt.id)) continue;
    for (const k of opt.keys.ja) {
      const len = keyHit(norm, k, lang);
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
  /** every number in the utterance, in order (`say_total`: 「三万円と三万円で六万円です」 says the total as its last number) */
  numbers?: number[];
}

const GREETING_PREFIX = /^(?:はじめまして|こんにちは|こんばんは|おはようございます|おはよう|どうも)[、。!！\s]*/;

/** Pull a spoken name out of "わたしは〇〇です" style sentences. */
export function captureName(text: string): string | null {
  let t = text.normalize('NFKC').trim();
  t = t.replace(GREETING_PREFIX, '').replace(GREETING_PREFIX, '');
  // 「はい、サムです。」 answers 「お名前は？」: the name is サム
  t = t.replace(/^(?:はい|ええ)[、,\s]+/, '');
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

function evalIntent(it: IntentDef, norm: MatchForms, raw: string, lang: TargetLanguage): IntentHit | null {
  if (it.none?.some((k) => keyHit(norm, k, lang))) return null;
  let score = 0;
  let matchedSomething = false;

  if (it.all) {
    for (const group of it.all) {
      const hits = group.map((k) => keyHit(norm, k, lang)).filter(Boolean);
      if (!hits.length) return null;
      score += 10 + Math.max(...hits);
      matchedSomething = true;
    }
  }
  if (it.any) {
    const hits = it.any.map((k) => keyHit(norm, k, lang)).filter(Boolean);
    if (!hits.length) return null;
    score += 5 + Math.max(...hits);
    matchedSomething = true;
  }
  let option: SlotOption | undefined;
  let rawCountry: string | undefined;
  if (it.slot) {
    const f = findSlotJa(it.slot, norm, it.slotOptions, lang);
    if (f) {
      option = f.opt;
      score += 8 + f.len;
      matchedSomething = true;
    } else if (it.capture === 'country') {
      const c = lang.captureCountry(raw);
      if (c) rawCountry = c;
      else if (it.slotRequired) return null;
    } else if (it.slotRequired) {
      return null;
    }
  }
  let rawName: string | undefined;
  if (it.capture === 'name') {
    const n = lang.captureName(raw);
    if (n) rawName = n;
    else if (it.captureRequired) return null;
  }
  if (!matchedSomething && !rawCountry) return null;
  score += it.boost ?? 0;
  const hit: IntentHit = { intent: it, score, option, rawCountry, rawName };
  if (it.alsoSlots) {
    const also: NonNullable<IntentHit['also']> = [];
    for (const slot of it.alsoSlots) {
      const f = findSlotJa(slot, norm, undefined, lang);
      if (f) also.push({ slot, option: f.opt });
    }
    if (also.length) hit.also = also;
  }
  return hit;
}

export function matchNodeIntent(node: SceneNode, text: string, lang: TargetLanguage = targetLanguage()): IntentHit | null {
  const norm = lang.matchForms(text);
  if (!norm.loose) return null;
  let best: IntentHit | null = null;
  for (const it of node.intents) {
    const hit = evalIntent(it, norm, text, lang);
    if (hit && (!best || hit.score > best.score)) best = hit;
  }
  if (best) {
    const { numbers } = lang.parseNumbers(text.normalize('NFKC'));
    if (numbers[0] !== undefined) {
      best.number = numbers[0];
      best.numbers = numbers;
    }
  }
  return best;
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

export function matchGlobal(text: string, lang: TargetLanguage = targetLanguage()): GlobalIntent | null {
  const norm = lang.matchForms(text);
  let best: GlobalIntent | null = null;
  for (const g of lang.globalIntents) {
    if (g.any.some((k) => keyHit(norm, k, lang)) && (!best || g.priority > best.priority)) best = g;
  }
  return best;
}

export { toKatakana };

/** Only digits (any width, with separators), optionally with ¥ in front or 円 / えん behind: a price or a quantity said as a number (§6.2). */
export const JA_NUMERIC = /^[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*(?:円|えん)?$/;

/** Japanese, the first target language: everything above, read through the dictionary and folded as kana (§12.4). */
export const JA: TargetLanguage = {
  id: 'ja',
  locale: 'ja-JP',
  lexicon: LEXICON,
  slots: SLOTS,
  reactions: REACTIONS,
  globalIntents: GLOBAL_INTENTS,
  matchForms: jaMatchForms,
  keyUsable: (f) => f.loose.length >= 2 || (f.loose.length === 1 && hasKanji(f.loose)),
  contains: (text, key) => text.includes(key),
  parseNumbers: (text) => parseNumbersIn(text),
  segment: (text) => segmentFree(text, LEXICON),
  captureName,
  captureCountry,
  isTarget: (text) => hasJapanese(text) || JA_NUMERIC.test(text),
};
