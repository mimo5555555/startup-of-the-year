// Madrid: Spanish content (Spanish step 1). Kept apart from Tokyo's, Berlin's and Amsterdam's registries: the engine reads it through the
// `ES` target language.
export { ES_LEXICON, ES_WORDS } from './lexicon';
export { ES_SLOTS } from './slots';
export { ANDRES, CARMEN, LOLA, MADRID_PRICES, MAD_BAR, MAD_CHURRERIA, MAD_MERCADO, MAD_METRO, MAD_PANADERIA, MARISA, RAFA } from './shops';
export { ES_REACTIONS, JAVI, JAVI_MEET, LUCIA, LUCIA_MEET, NADIA, NADIA_MEET } from './friends';

import type { Character, Scenario } from '../types';
import { ANDRES, CARMEN, LOLA, MAD_BAR, MAD_CHURRERIA, MAD_MERCADO, MAD_METRO, MAD_PANADERIA, MARISA, RAFA } from './shops';
import { JAVI, JAVI_MEET, LUCIA, LUCIA_MEET, NADIA, NADIA_MEET } from './friends';

/** the street's shops, then the friends' first meetings */
export const MADRID_SCENARIOS: Scenario[] = [MAD_BAR, MAD_PANADERIA, MAD_MERCADO, MAD_CHURRERIA, MAD_METRO, LUCIA_MEET, JAVI_MEET, NADIA_MEET];
export const MADRID_CHARACTERS: Character[] = [LOLA, CARMEN, ANDRES, RAFA, MARISA, LUCIA, JAVI, NADIA];
export const madridScenarioById = (id: string): Scenario | undefined => MADRID_SCENARIOS.find((s) => s.id === id);
export const madridCharacterById = (id: string): Character | undefined => MADRID_CHARACTERS.find((c) => c.id === id);
