// Spanish as a target language (Spanish step 1): Madrid's dictionary, slots and reactions, compared the Spanish way. A session learns
// Spanish with `new ConversationSession({ ..., language: ES })`, or every session does after `setTargetLanguage(ES)`.
import { ES_LEXICON, ES_REACTIONS, ES_SLOTS, ES_WORDS, segmentWords } from '@lw/content';
import { captureSpanishCountry, captureSpanishName, esContains, esFoldWord, esMatchForms, hasArabic, hasJapanese, parseSpanishNumbers } from '@lw/core';
import type { GlobalIntent, TargetLanguage } from './matching';

/** The things a learner says anywhere in a conversation, in Spanish; keys are compared from the start of a word, accents or not. */
export const ES_GLOBAL_INTENTS: GlobalIntent[] = [
  { id: 'slow', any: ['mas despacio', 'despacio', 'mas lento', 'mas lentamente'], priority: 9 },
  { id: 'repeat', any: ['otra vez', 'repetir', 'repite', 'repita', 'que has dicho', 'que ha dicho', 'como dices', 'como dice'], priority: 8 },
  { id: 'dont_understand', any: ['no entiendo', 'no lo entiendo', 'no he entendido', 'no comprendo'], priority: 8 },
  { id: 'how_are_you', any: ['que tal', 'como estas', 'como esta usted'], priority: 5 },
  { id: 'thanks', any: ['gracias', 'muchas gracias', 'mil gracias'], priority: 5 },
  { id: 'goodbye', any: ['adios', 'hasta luego', 'hasta manana', 'hasta pronto', 'chao', 'nos vemos'], priority: 5 },
  { id: 'greet', any: ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'buenas'], priority: 3 },
  { id: 'excuse', any: ['perdon', 'perdona', 'perdone', 'disculpa', 'disculpe', 'lo siento'], priority: 2 },
];

/** every dictionary word in its folded form: a typed 「cafe」 or 「espanol」 is a Spanish word */
const KNOWN = new Set(ES_WORDS.map((e) => esFoldWord(e.s)));
const PRICE = /^\s*€?\s*\d+(?:[.,]\d{1,2})?\s*(?:€|euros?|centimos?|céntimos?)?\s*$/i;

/**
 * Is a line Spanish (to be answered) rather than English or Arabic (to be helped with)? Arabic or Japanese script never is; a bare number
 * or price always is; otherwise at least half of its words must be Spanish dictionary words (「un café, por favor」 is, 「a coffee please」
 * is not).
 */
export function isSpanish(text: string): boolean {
  const t = text.normalize('NFKC').trim();
  if (!t || hasArabic(t) || hasJapanese(t)) return false;
  if (PRICE.test(t)) return true;
  const words = esMatchForms(t).folded.split(' ').filter((w) => w && !/^\d/.test(w));
  if (!words.length) return false;
  const known = words.filter((w) => KNOWN.has(w)).length;
  return known > 0 && known * 2 >= words.length;
}

export const ES: TargetLanguage = {
  id: 'es',
  locale: 'es-ES',
  lexicon: ES_LEXICON,
  slots: ES_SLOTS,
  reactions: ES_REACTIONS,
  globalIntents: ES_GLOBAL_INTENTS,
  matchForms: esMatchForms,
  keyUsable: (f) => f.loose.length >= 2 || /^\d$/.test(f.loose),
  contains: esContains,
  parseNumbers: parseSpanishNumbers,
  segment: (text) => segmentWords(text, ES_LEXICON),
  captureName: captureSpanishName,
  captureCountry: captureSpanishCountry,
  isTarget: isSpanish,
};
