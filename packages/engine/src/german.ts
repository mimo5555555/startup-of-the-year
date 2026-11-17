// German as a target language (German step 1): Berlin's dictionary, slots and reactions, compared the German way. A session
// learns German with `new ConversationSession({ ..., language: DE })`, or every session does after `setTargetLanguage(DE)`.
import { DE_LEXICON, DE_REACTIONS, DE_SLOTS, DE_WORDS, segmentWords } from '@lw/content';
import { captureGermanCountry, captureGermanName, deContains, deFoldWord, deMatchForms, hasArabic, hasGermanLetters, hasJapanese, parseGermanNumbers } from '@lw/core';
import type { GlobalIntent, TargetLanguage } from './matching';

/** The things a learner says anywhere in a conversation, in German; keys are compared from the start of a word. */
export const DE_GLOBAL_INTENTS: GlobalIntent[] = [
  { id: 'slow', any: ['langsam', 'langsamer'], priority: 9 },
  { id: 'repeat', any: ['noch einmal', 'nochmal', 'noch mal', 'wiederholen', 'wie bitte'], priority: 8 },
  { id: 'dont_understand', any: ['verstehe nicht', 'versteh nicht', 'verstehe das nicht', 'verstehe ich nicht', 'nicht verstanden'], priority: 8 },
  { id: 'how_are_you', any: ['wie geht', 'wie gehts'], priority: 5 },
  { id: 'thanks', any: ['danke', 'vielen dank'], priority: 5 },
  { id: 'goodbye', any: ['tschuss', 'auf wiedersehen', 'wiedersehen', 'bis bald', 'bis dann', 'ciao'], priority: 5 },
  { id: 'greet', any: ['hallo', 'guten tag', 'guten morgen', 'guten abend', 'moin', 'servus'], priority: 3 },
  { id: 'excuse', any: ['entschuldigung', 'entschuldigen sie', 'verzeihung'], priority: 2 },
];

/** every dictionary word in its folded form: a typed 「brotchen」 or 「broetchen」 is a German word */
const KNOWN = new Set(DE_WORDS.map((e) => deFoldWord(e.s)));
const PRICE = /^\s*€?\s*\d+(?:[.,]\d{1,2})?\s*(?:€|euro|cent)?\s*$/i;

/**
 * Is a line German (to be answered) rather than English or Arabic (to be helped with)? Arabic or Japanese script never is; ä/ö/ü/ß
 * or a bare number or price always is; otherwise at least half of its words must be German dictionary words (「Kaffee, bitte」 is,
 * 「a coffee please」 is not).
 */
export function isGerman(text: string): boolean {
  const t = text.normalize('NFKC').trim();
  if (!t || hasArabic(t) || hasJapanese(t)) return false;
  if (hasGermanLetters(t) || PRICE.test(t)) return true;
  const words = deMatchForms(t).folded.split(' ').filter((w) => w && !/^\d/.test(w));
  if (!words.length) return false;
  const known = words.filter((w) => KNOWN.has(w)).length;
  return known > 0 && known * 2 >= words.length;
}

export const DE: TargetLanguage = {
  id: 'de',
  locale: 'de-DE',
  lexicon: DE_LEXICON,
  slots: DE_SLOTS,
  reactions: DE_REACTIONS,
  globalIntents: DE_GLOBAL_INTENTS,
  matchForms: deMatchForms,
  keyUsable: (f) => f.loose.length >= 2 || /^\d$/.test(f.loose),
  contains: deContains,
  parseNumbers: parseGermanNumbers,
  segment: (text) => segmentWords(text, DE_LEXICON),
  captureName: captureGermanName,
  captureCountry: captureGermanCountry,
  isTarget: isGerman,
};
