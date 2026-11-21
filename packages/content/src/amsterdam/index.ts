// Amsterdam: Dutch content (Dutch step 1). Kept apart from Tokyo's and Berlin's registries: the engine reads it through the `NL` target language.
export { NL_LEXICON, NL_WORDS } from './lexicon';
export { NL_SLOTS } from './slots';
export { AMSTERDAM_PRICES, AMS_CAFE, AMS_GVB, AMS_KAAS, AMS_MARKT, AMS_SNACKBAR, FEMKE, INGRID, JESSE, KEES, MO } from './shops';
export { DAAN, DAAN_MEET, NL_REACTIONS, NOOR, NOOR_MEET, SANNE, SANNE_MEET } from './friends';
export { AMSTERDAM_SHOP_TALK, AMSTERDAM_TALK_TOPICS, withAmsterdamTalk } from './smalltalk';
export { NL_GIVE_GIFT, NL_SMALLTALK, NL_SMALLTALK_CALLBACKS, NL_SMALLTALK_FRIENDS, NL_TOPICS } from './social';
export { HANG_DAAN, HANG_NOOR, HANG_SANNE, NL_HANGOUTS } from './hangouts';
export { AMS_DROGIST, AMS_GEMEENTE, AMS_KROEG, DROGIST_PRICES, ILSE, JOOP, KROEG_PRICES, MIRJAM, NL_PLACES } from './places';

import type { Character, Scenario, SignDef } from '../types';
import { AMS_CAFE, AMS_GVB, AMS_KAAS, AMS_MARKT, AMS_SNACKBAR, FEMKE, INGRID, JESSE, KEES, MO } from './shops';
import { DAAN, DAAN_MEET, NOOR, NOOR_MEET, SANNE, SANNE_MEET } from './friends';
import { withAmsterdamTalk } from './smalltalk';
import { NL_GIVE_GIFT, NL_SMALLTALK } from './social';
import { NL_HANGOUTS } from './hangouts';
import { AMS_DROGIST, AMS_GEMEENTE, AMS_KROEG, ILSE, JOOP, MIRJAM } from './places';

/** things on the Amsterdam street to tap and read (the world's pick id -> the dictionary word), like Tokyo's and Berlin's signs */
export const AMSTERDAM_SIGNS: SignDef[] = [
  { id: 'cafe', lex: 'Café' },
  { id: 'kaas', lex: 'Kaashandel' },
  { id: 'markt', lex: 'Stroopwafels' },
  { id: 'snackbar', lex: 'Snackbar' },
  { id: 'gvb', lex: 'Kaartjes' },
  { id: 'tram_sign', lex: 'Tram' },
  { id: 'gracht', lex: 'Gracht' },
  { id: 'brug', lex: 'Brug' },
  { id: 'woonboot', lex: 'Woonboot' },
  { id: 'fiets', lex: 'Fiets' },
  { id: 'fietsenrek', lex: 'Fietsenrek' },
  { id: 'lantaarn', lex: 'Lantaarnpaal' },
  { id: 'iep', lex: 'Iep' },
  { id: 'bloemen', lex: 'Bloemen' },
  { id: 'fietspad', lex: 'Fietspad' },
  { id: 'prullenbak', lex: 'Prullenbak' },
  // Dutch step 4: the new fronts
  { id: 'drogist', lex: 'Drogist' },
  { id: 'bruincafe', lex: 'Kroeg' },
  { id: 'gemeente', lex: 'Gemeente' },
];

/** the street's shops (with their regulars' greetings and small talk, `smalltalk.ts`), the friends' first meetings, then their chats and
 * the hand-over of a present (`social.ts`), the hang-outs (`hangouts.ts`) and the places of Chapters 4-6 (`places.ts`) */
export const AMSTERDAM_SCENARIOS: Scenario[] = [
  ...[AMS_CAFE, AMS_KAAS, AMS_MARKT, AMS_SNACKBAR, AMS_GVB, AMS_DROGIST, AMS_KROEG].map(withAmsterdamTalk),
  AMS_GEMEENTE,
  SANNE_MEET,
  DAAN_MEET,
  NOOR_MEET,
  ...NL_SMALLTALK,
  NL_GIVE_GIFT,
  ...NL_HANGOUTS,
];
export const AMSTERDAM_CHARACTERS: Character[] = [FEMKE, KEES, JESSE, MO, INGRID, SANNE, DAAN, NOOR, MIRJAM, JOOP, ILSE];
export const amsterdamScenarioById = (id: string): Scenario | undefined => AMSTERDAM_SCENARIOS.find((s) => s.id === id);
export const amsterdamCharacterById = (id: string): Character | undefined => AMSTERDAM_CHARACTERS.find((c) => c.id === id);
export { AMSTERDAM_PACK, EUR_NL, NL_LANGUAGE } from './game';
