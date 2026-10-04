import { LEXICON } from '../lexicon';
import type { SlotOption } from '../types';

/** Build a slot option from a lexicon word; throws if the word is missing so authors notice at once. */
export const opt = (id: string, ja: string, ja_keys: string[], en: string[], ar: string[]): SlotOption => {
  const e = LEXICON.get(ja);
  if (!e) throw new Error(`Slot option ${id}: ${ja} is not in the lexicon`);
  return { id, ja, gloss: { en: e.en.replace(/ \(.*\)$/, ''), ar: e.ar.replace(/ \(.*\)$/, '') }, keys: { ja: [ja, ...ja_keys], en, ar } };
};
