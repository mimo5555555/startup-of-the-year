import type { Gloss } from '@lw/content';

export type UiLang = 'en' | 'ar';

import * as core from './strings/core';
import * as wallet from './strings/wallet';
import * as quests from './strings/quests';
import * as social from './strings/social';
import * as jobs from './strings/jobs';
import * as culture from './strings/culture';
import * as audio from './strings/audio';
import * as hud from './strings/hud';
import * as debrief from './strings/debrief';
import * as prepare from './strings/prepare';
import * as phone from './strings/phone';
import * as home from './strings/home';
import * as story from './strings/story';

type Key =
  | keyof typeof core.en
  | keyof typeof wallet.en
  | keyof typeof quests.en
  | keyof typeof social.en
  | keyof typeof jobs.en
  | keyof typeof culture.en
  | keyof typeof audio.en
  | keyof typeof hud.en
  | keyof typeof debrief.en
  | keyof typeof prepare.en
  | keyof typeof phone.en
  | keyof typeof home.en
  | keyof typeof story.en;

/** One module per key prefix (docs/GAME_DESIGN.md §7.6); each owner edits only its own file. */
const MODULES = [core, wallet, quests, social, jobs, culture, audio, hud, debrief, prepare, phone, home, story];
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
