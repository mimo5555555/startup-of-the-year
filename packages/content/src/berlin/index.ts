// Berlin: German content. Kept apart from Tokyo's registries: the engine reads it through the `DE` target language.
export { DE_LEXICON, DE_WORDS } from './lexicon';
export { DE_SLOTS } from './slots';
export { BAKERY, BAKERY_PRICES, DE_REACTIONS, JANA } from './bakery';
export { MURAT, SPAETI, SPAETI_PRICES } from './spaeti';
export { DOENER, DOENER_PRICES, EMRE } from './doener';
export { SABINE, TICKET_PRICES, UBAHN } from './ubahn';
export { FLOHMARKT, FLOHMARKT_PRICES, GRETA } from './flohmarkt';
export { JONAS, JONAS_MEET, KOFI, KOFI_MEET, LENA, LENA_MEET } from './friends';
export { BERLIN_SHOP_TALK, BERLIN_TALK_TOPICS, withBerlinTalk } from './smalltalk';
export { DE_GIVE_GIFT, DE_SMALLTALK, DE_SMALLTALK_CALLBACKS, DE_SMALLTALK_FRIENDS, DE_TOPICS } from './social';
export { DE_HANGOUTS, HANG_JONAS, HANG_KOFI, HANG_LENA } from './hangouts';
export { ANKE, APOTHEKE, APOTHEKE_PRICES, BUERGERAMT, DE_PLACES, KNEIPE, KNEIPE_PRICES, KRAUSE, UWE } from './places';
export { JOBINTRO_SPAETI } from './jobs';

import type { Character, Scenario, SignDef } from '../types';
import { BAKERY, JANA } from './bakery';
import { DOENER, EMRE } from './doener';
import { FLOHMARKT, GRETA } from './flohmarkt';
import { JONAS, JONAS_MEET, KOFI, KOFI_MEET, LENA, LENA_MEET } from './friends';
import { MURAT, SPAETI } from './spaeti';
import { SABINE, UBAHN } from './ubahn';
import { withBerlinTalk } from './smalltalk';
import { DE_GIVE_GIFT, DE_SMALLTALK } from './social';
import { DE_HANGOUTS } from './hangouts';
import { ANKE, APOTHEKE, BUERGERAMT, KNEIPE, KRAUSE, UWE } from './places';
import { JOBINTRO_SPAETI } from './jobs';

/** things on the Berlin street to tap and read (the world's pick id -> the dictionary word), like Tokyo's signs */
export const BERLIN_SIGNS: SignDef[] = [
  { id: 'bakery', lex: 'Bäckerei' },
  { id: 'spaeti', lex: 'Späti' },
  { id: 'doener', lex: 'Döner' },
  { id: 'ubahn', lex: 'Fahrkarten' },
  { id: 'ubahn_sign', lex: 'U-Bahn' },
  { id: 'litfass', lex: 'Litfaßsäule' },
  { id: 'linde', lex: 'Linde' },
  { id: 'laterne', lex: 'Laterne' },
  { id: 'fahrrad', lex: 'Fahrrad' },
  { id: 'cafe_sign', lex: 'Café' },
  { id: 'flohmarkt_sign', lex: 'Flohmarkt' },
  { id: 'mauer', lex: 'Mauer' },
  { id: 'zebra', lex: 'Zebrastreifen' },
  { id: 'muell', lex: 'Mülleimer' },
  // German step 5: the new fronts
  { id: 'apotheke', lex: 'Apotheke' },
  { id: 'buergeramt', lex: 'Bürgeramt' },
  { id: 'kneipe_sign', lex: 'Kneipe' },
];

/** the street's shops (with their regulars' greetings and small talk, `smalltalk.ts`), the friends' first meetings, then their chats and the
 * hand-over of a present (`social.ts`), the hang-outs at three hearts (`hangouts.ts`), and Murat's job offer (`jobs.ts`) */
export const BERLIN_SCENARIOS: Scenario[] = [
  ...[BAKERY, SPAETI, DOENER, UBAHN, FLOHMARKT, APOTHEKE, KNEIPE].map(withBerlinTalk),
  BUERGERAMT,
  LENA_MEET,
  KOFI_MEET,
  JONAS_MEET,
  ...DE_SMALLTALK,
  DE_GIVE_GIFT,
  ...DE_HANGOUTS,
  JOBINTRO_SPAETI,
];
export const BERLIN_CHARACTERS: Character[] = [JANA, MURAT, EMRE, SABINE, GRETA, LENA, KOFI, JONAS, ANKE, UWE, KRAUSE];
export const berlinScenarioById = (id: string): Scenario | undefined => BERLIN_SCENARIOS.find((s) => s.id === id);
export const berlinCharacterById = (id: string): Character | undefined => BERLIN_CHARACTERS.find((c) => c.id === id);
export { BERLIN_PACK, DE_LANGUAGE, EUR } from './game';
