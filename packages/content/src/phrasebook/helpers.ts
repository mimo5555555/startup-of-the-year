import type { PhraseEntry } from '../types';

/** A phrasebook entry: Japanese markup plus the English and Arabic sentences that map onto it. */
export const P = (
  id: string,
  ja: string,
  en: string[],
  ar: string[],
  extra: Partial<PhraseEntry> = {},
): PhraseEntry => ({ id, ja, en, ar, ...extra });
