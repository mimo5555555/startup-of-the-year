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

import type { Character, Scenario, SignDef } from '../types';
import { BAKERY, JANA } from './bakery';
import { DOENER, EMRE } from './doener';
import { FLOHMARKT, GRETA } from './flohmarkt';
import { JONAS, JONAS_MEET, KOFI, KOFI_MEET, LENA, LENA_MEET } from './friends';
import { MURAT, SPAETI } from './spaeti';
import { SABINE, UBAHN } from './ubahn';
import { withBerlinTalk } from './smalltalk';

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
];

/** the street's shops (with their regulars' greetings and small talk, `smalltalk.ts`), then the friends' first meetings */
export const BERLIN_SCENARIOS: Scenario[] = [...[BAKERY, SPAETI, DOENER, UBAHN, FLOHMARKT].map(withBerlinTalk), LENA_MEET, KOFI_MEET, JONAS_MEET];
export const BERLIN_CHARACTERS: Character[] = [JANA, MURAT, EMRE, SABINE, GRETA, LENA, KOFI, JONAS];
export const berlinScenarioById = (id: string): Scenario | undefined => BERLIN_SCENARIOS.find((s) => s.id === id);
export const berlinCharacterById = (id: string): Character | undefined => BERLIN_CHARACTERS.find((c) => c.id === id);
export { BERLIN_PACK, DE_LANGUAGE, EUR } from './game';
