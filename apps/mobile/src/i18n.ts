import type { Gloss } from '@lw/content';

export type UiLang = 'en' | 'ar';

import * as core from './strings/core';
import * as wallet from './strings/wallet';
import * as quests from './strings/quests';
import * as social from './strings/social';
import * as jobs from './strings/jobs';
import * as culture from './strings/culture';
import * as audio from './strings/audio';

type Key =
  | keyof typeof core.en
  | keyof typeof wallet.en
  | keyof typeof quests.en
  | keyof typeof social.en
  | keyof typeof jobs.en
  | keyof typeof culture.en
  | keyof typeof audio.en;

const MODULES = [core, wallet, quests, social, jobs, culture, audio];
const merge = (lang: UiLang) => Object.assign({}, ...MODULES.map((m) => m[lang])) as Record<Key, string>;
export const STRINGS: Record<UiLang, Record<Key, string>> = { en: merge('en'), ar: merge('ar') };
export type StringKey = Key;

export function translate(lang: UiLang, key: StringKey, vars?: Record<string, string | number>): string {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export const pickGloss = (g: Gloss, lang: UiLang) => g[lang];
export const dirOf = (lang: UiLang) => (lang === 'ar' ? 'rtl' : 'ltr');

/** Western digits throughout: they read the same in both languages and match the Japanese lines. */
export const num = (n: number) => String(n);
