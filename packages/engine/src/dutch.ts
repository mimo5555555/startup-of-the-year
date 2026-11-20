// Dutch as a target language (Dutch step 1): Amsterdam's dictionary, slots and reactions, compared the Dutch way. A session learns
// Dutch with `new ConversationSession({ ..., language: NL })`, or every session does after `setTargetLanguage(NL)`.
import { NL_LEXICON, NL_REACTIONS, NL_SLOTS, NL_WORDS, segmentWords } from '@lw/content';
import { captureDutchCountry, captureDutchName, hasArabic, hasJapanese, nlContains, nlFoldWord, nlMatchForms, parseDutchNumbers } from '@lw/core';
import type { GlobalIntent, TargetLanguage } from './matching';

/** The things a learner says anywhere in a conversation, in Dutch; keys are compared from the start of a word. */
export const NL_GLOBAL_INTENTS: GlobalIntent[] = [
  { id: 'slow', any: ['langzaam', 'langzamer', 'rustig'], priority: 9 },
  { id: 'repeat', any: ['nog een keer', 'nog eens', 'herhalen', 'wat zegt u', 'wat zei u', 'pardon'], priority: 8 },
  { id: 'dont_understand', any: ['begrijp het niet', 'begrijp ik niet', 'snap het niet', 'niet begrepen', 'versta het niet'], priority: 8 },
  { id: 'how_are_you', any: ['hoe gaat het', 'hoe gaat', 'alles goed'], priority: 5 },
  { id: 'thanks', any: ['dank u', 'dank je', 'bedankt', 'dankjewel', 'dankuwel'], priority: 5 },
  { id: 'goodbye', any: ['doei', 'tot ziens', 'dag dag', 'tot straks', 'tot later', 'fijne dag'], priority: 5 },
  { id: 'greet', any: ['hallo', 'hoi', 'goedemorgen', 'goedemiddag', 'goedenavond', 'goedendag', 'hey'], priority: 3 },
  { id: 'excuse', any: ['sorry', 'excuseer', 'neem me niet kwalijk'], priority: 2 },
];

/** every dictionary word in its folded form: a typed 「cafe」 or 「een」 is a Dutch word */
const KNOWN = new Set(NL_WORDS.map((e) => nlFoldWord(e.s)));
const PRICE = /^\s*€?\s*\d+(?:[.,]\d{1,2})?\s*(?:€|euro|cent)?\s*$/i;

/**
 * Is a line Dutch (to be answered) rather than English or Arabic (to be helped with)? Arabic or Japanese script never is; a bare number
 * or price always is; otherwise at least half of its words must be Dutch dictionary words (「een koffie graag」 is, 「a coffee please」 is not).
 */
export function isDutch(text: string): boolean {
  const t = text.normalize('NFKC').trim();
  if (!t || hasArabic(t) || hasJapanese(t)) return false;
  if (PRICE.test(t)) return true;
  const words = nlMatchForms(t).folded.split(' ').filter((w) => w && !/^\d/.test(w));
  if (!words.length) return false;
  const known = words.filter((w) => KNOWN.has(w)).length;
  return known > 0 && known * 2 >= words.length;
}

export const NL: TargetLanguage = {
  id: 'nl',
  locale: 'nl-NL',
  lexicon: NL_LEXICON,
  slots: NL_SLOTS,
  reactions: NL_REACTIONS,
  globalIntents: NL_GLOBAL_INTENTS,
  matchForms: nlMatchForms,
  keyUsable: (f) => f.loose.length >= 2 || /^\d$/.test(f.loose),
  contains: nlContains,
  parseNumbers: parseDutchNumbers,
  segment: (text) => segmentWords(text, NL_LEXICON),
  captureName: captureDutchName,
  captureCountry: captureDutchCountry,
  isTarget: isDutch,
};
