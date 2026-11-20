// Amsterdam: Dutch content (Dutch step 1). Kept apart from Tokyo's and Berlin's registries: the engine reads it through the `NL` target language.
export { NL_LEXICON, NL_WORDS } from './lexicon';
export { NL_SLOTS } from './slots';
export { AMSTERDAM_PRICES, AMS_CAFE, AMS_GVB, AMS_KAAS, AMS_MARKT, AMS_SNACKBAR, FEMKE, INGRID, JESSE, KEES, MO } from './shops';
export { DAAN, DAAN_MEET, NL_REACTIONS, NOOR, NOOR_MEET, SANNE, SANNE_MEET } from './friends';

import type { Character, Scenario } from '../types';
import { AMS_CAFE, AMS_GVB, AMS_KAAS, AMS_MARKT, AMS_SNACKBAR, FEMKE, INGRID, JESSE, KEES, MO } from './shops';
import { DAAN, DAAN_MEET, NOOR, NOOR_MEET, SANNE, SANNE_MEET } from './friends';

/** the street's shops, then the friends' first meetings */
export const AMSTERDAM_SCENARIOS: Scenario[] = [AMS_CAFE, AMS_KAAS, AMS_MARKT, AMS_SNACKBAR, AMS_GVB, SANNE_MEET, DAAN_MEET, NOOR_MEET];
export const AMSTERDAM_CHARACTERS: Character[] = [FEMKE, KEES, JESSE, MO, INGRID, SANNE, DAAN, NOOR];
export const amsterdamScenarioById = (id: string): Scenario | undefined => AMSTERDAM_SCENARIOS.find((s) => s.id === id);
export const amsterdamCharacterById = (id: string): Character | undefined => AMSTERDAM_CHARACTERS.find((c) => c.id === id);
export { AMSTERDAM_PACK, EUR_NL, NL_LANGUAGE } from './game';
