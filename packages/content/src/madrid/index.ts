// Madrid: Spanish content (Spanish step 1). Kept apart from Tokyo's, Berlin's and Amsterdam's registries: the engine reads it through the
// `ES` target language.
export { ES_LEXICON, ES_WORDS } from './lexicon';
export { ES_SLOTS } from './slots';
export { ANDRES, CARMEN, LOLA, MADRID_PRICES, MAD_BAR, MAD_CHURRERIA, MAD_MERCADO, MAD_METRO, MAD_PANADERIA, MARISA, RAFA } from './shops';
export { ES_REACTIONS, JAVI, JAVI_MEET, LUCIA, LUCIA_MEET, NADIA, NADIA_MEET } from './friends';

import type { Character, Scenario, SignDef } from '../types';
import { ANDRES, CARMEN, LOLA, MAD_BAR, MAD_CHURRERIA, MAD_MERCADO, MAD_METRO, MAD_PANADERIA, MARISA, RAFA } from './shops';
import { JAVI, JAVI_MEET, LUCIA, LUCIA_MEET, NADIA, NADIA_MEET } from './friends';

/** things on the Madrid street to tap and read (the world's pick id -> the dictionary word), like Tokyo's signs */
export const MADRID_SIGNS: SignDef[] = [
  { id: 'bar', lex: 'bar' },
  { id: 'panaderia', lex: 'panadería' },
  { id: 'churreria', lex: 'churrería' },
  { id: 'metro', lex: 'metro' },
  { id: 'metro_sign', lex: 'metro' },
  { id: 'mercado', lex: 'mercado' },
  { id: 'balcon', lex: 'balcón' },
  { id: 'calle', lex: 'calle' },
  { id: 'portal', lex: 'portal' },
  { id: 'intercambio_sign', lex: 'intercambio' },
  { id: 'terraza', lex: 'terraza' },
  { id: 'plaza_sign', lex: 'plaza' },
  { id: 'fuente', lex: 'fuente' },
  { id: 'arbol', lex: 'árbol' },
  { id: 'banco', lex: 'banco' },
  { id: 'farola', lex: 'farola' },
  { id: 'papelera', lex: 'papelera' },
];

/** the street's shops, then the friends' first meetings */
export const MADRID_SCENARIOS: Scenario[] = [MAD_BAR, MAD_PANADERIA, MAD_MERCADO, MAD_CHURRERIA, MAD_METRO, LUCIA_MEET, JAVI_MEET, NADIA_MEET];
export const MADRID_CHARACTERS: Character[] = [LOLA, CARMEN, ANDRES, RAFA, MARISA, LUCIA, JAVI, NADIA];
export const madridScenarioById = (id: string): Scenario | undefined => MADRID_SCENARIOS.find((s) => s.id === id);
export const madridCharacterById = (id: string): Character | undefined => MADRID_CHARACTERS.find((c) => c.id === id);
export { ES_LANGUAGE, EUR_ES, MADRID_PACK } from './game';
