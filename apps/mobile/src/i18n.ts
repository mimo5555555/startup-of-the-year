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
import * as friendsVisit from './strings/friends-visit';
import * as homeOwn from './strings/home-own';
import * as trip from './strings/trip';
import * as storyC1 from './strings/story-c1';
import * as storyC2 from './strings/story-c2';
import * as letter from './strings/letter';
import * as festival from './strings/festival';
import * as goen from './strings/goen';
import * as goenContent from './strings/goen-content';
import * as goenPay from './strings/goen-pay';
import * as ears from './strings/ears';
import { IS_GERMAN } from './target';

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
  | keyof typeof story.en
  | keyof typeof friendsVisit.en
  | keyof typeof homeOwn.en
  | keyof typeof trip.en
  | keyof typeof storyC1.en
  | keyof typeof storyC2.en
  | keyof typeof letter.en
  | keyof typeof festival.en
  | keyof typeof goen.en
  | keyof typeof goenContent.en
  | keyof typeof goenPay.en
  | keyof typeof ears.en;

/** One module per key prefix (docs/GAME_DESIGN.md §7.6); each owner edits only its own file. */
const MODULES = [core, wallet, quests, social, jobs, culture, audio, hud, debrief, prepare, phone, home, story, friendsVisit, homeOwn, trip, storyC1, storyC2, letter, festival, goen, goenContent, goenPay, ears];
const merge = (lang: UiLang) => Object.assign({}, ...MODULES.map((m) => m[lang])) as Record<Key, string>;
export const STRINGS: Record<UiLang, Record<Key, string>> = { en: merge('en'), ar: merge('ar') };
export type StringKey = Key;

/**
 * Learning German, the app's own words name the language and the city being learned: "Japanese" reads "German", Tokyo reads Berlin
 * (the screens that are Tokyo's alone are not reachable from Berlin). Longest words first, so 「باليابانية」 is not cut.
 */
const TO_GERMAN: Array<[string, string]> = [
  ['Japanese', 'German'],
  ['Japan', 'Germany'],
  ['Tokyo', 'Berlin'],
  ['日本語', 'Deutsch'],
  // the example of something to say into the microphone
  ['こんにちは', 'Hallo'],
  ['باليابانية', 'بالألمانية'],
  ['اليابانية', 'الألمانية'],
  ['الياباني', 'الألماني'],
  ['يابانيًا', 'ألمانيًا'],
  ['يابانية', 'ألمانية'],
  ['ياباني', 'ألماني'],
  ['اليابان', 'ألمانيا'],
  ['طوكيو', 'برلين'],
];
const forTarget = (s: string): string => (IS_GERMAN ? TO_GERMAN.reduce((acc, [a, b]) => acc.replaceAll(a, b), s) : s);

/** cents as German writes them: 3000 -> 30,00 € */
const euros = (cents: number): string => {
  const neg = cents < 0;
  const c = Math.abs(Math.round(cents));
  const whole = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '−' : ''}${whole},${String(c % 100).padStart(2, '0')} €`;
};

/** strings that name the languages one can learn: they say what they say whichever language is being learned */
const OWN_WORDS = new Set<string>(['ob.learn.ja', 'ob.learn.de', 'ob.learn.title', 'ob.learn.note', 'st.learn']);

export function translate(lang: UiLang, key: StringKey, vars?: Record<string, string | number>): string {
  const raw = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  let s = OWN_WORDS.has(key) ? raw : forTarget(raw);
  // learning German, an amount the string writes as yen (¥{n}) is the pack's cents: it reads in euros
  if (IS_GERMAN && vars)
    s = s.replace(/¥\{(\w+)\}/g, (m, k: string) => {
      const v = vars[k];
      const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d-]/g, ''));
      return v !== undefined && Number.isFinite(n) ? euros(n) : m;
    });
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export const pickGloss = (g: Gloss, lang: UiLang) => g[lang];
export const dirOf = (lang: UiLang) => (lang === 'ar' ? 'rtl' : 'ltr');

/** Western digits throughout: they read the same in both languages and match the Japanese lines. */
export const num = (n: number) => String(n);
