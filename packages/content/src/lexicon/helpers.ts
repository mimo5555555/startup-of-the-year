import type { LexEntry } from '../types';

export type LexOpts = { g?: boolean; rom?: string };
/** A dictionary word. `r` is the kana reading (required when `s` has kanji). */
export const w = (s: string, r: string, en: string, ar: string, o: LexOpts = {}): LexEntry => ({ s, r: r || undefined, en, ar, ...o });
/** A grammar/function word: shown in lines but not offered for saving. */
export const g = (s: string, en: string, ar: string, rom?: string): LexEntry => ({ s, en, ar, g: true, rom });
