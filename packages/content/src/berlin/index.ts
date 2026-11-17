// Berlin: German content (German step 1). Kept apart from Tokyo's registries: the engine reads it through the `DE` target language.
export { DE_LEXICON, DE_WORDS } from './lexicon';
export { DE_SLOTS } from './slots';
export { BAKERY, BAKERY_PRICES, DE_REACTIONS, JANA } from './bakery';

import { BAKERY, JANA } from './bakery';
export const BERLIN_SCENARIOS = [BAKERY];
export const BERLIN_CHARACTERS = [JANA];
