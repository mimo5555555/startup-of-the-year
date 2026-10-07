import { Lexicon } from '../markup';
import type { LexEntry } from '../types';
import { CORE_LEXICON } from './core';
import { NUMBERS_LEXICON } from './numbers';
import { SHOP_LEXICON } from './shop';
import { STATION_LEXICON } from './station';
import { QUESTS_LEXICON } from './quests';
import { SHOP_DENKI_LEXICON } from './shop-denki';
import { SHOP_FUKU_LEXICON } from './shop-fuku';
import { SHOP_AIKO_LEXICON } from './shop-aiko';
import { SHOP_MOTORS_LEXICON } from './shop-motors';
import { SOCIAL_LEXICON } from './social';
import { SOCIAL_CHAT_LEXICON } from './social-chat';
import { SOCIAL_FRIENDS_LEXICON } from './social-friends';
import { SOCIAL_HEARTS_LEXICON } from './social-hearts';
import { JOBS_LEXICON } from './jobs';
import { CULTURE_LEXICON } from './culture';

export { w, g } from './helpers';

/** Registry rule (docs/GAME_DESIGN.md §15.1): one part file per owner, spread here. Order matters only for duplicate surfaces (first wins). */
const PARTS: LexEntry[][] = [
  CORE_LEXICON,
  NUMBERS_LEXICON,
  SHOP_LEXICON,
  STATION_LEXICON,
  QUESTS_LEXICON,
  SHOP_DENKI_LEXICON,
  SHOP_FUKU_LEXICON,
  SHOP_AIKO_LEXICON,
  SHOP_MOTORS_LEXICON,
  SOCIAL_LEXICON,
  SOCIAL_CHAT_LEXICON,
  SOCIAL_FRIENDS_LEXICON,
  SOCIAL_HEARTS_LEXICON,
  JOBS_LEXICON,
  CULTURE_LEXICON,
];

/** Every module's entries. A surface that appears in several modules keeps its first entry; clashing
 * readings are reported by the content tests rather than crashing every importer. */
export const LEXICON_ENTRIES: LexEntry[] = (() => {
  const seen = new Set<string>();
  const out: LexEntry[] = [];
  for (const part of PARTS) {
    for (const e of part) {
      if (seen.has(e.s)) continue;
      seen.add(e.s);
      out.push(e);
    }
  }
  return out;
})();

/** Entries per module, for the duplicate/clash checks. */
export const LEXICON_PARTS: Record<string, LexEntry[]> = {
  core: CORE_LEXICON,
  numbers: NUMBERS_LEXICON,
  shop: SHOP_LEXICON,
  station: STATION_LEXICON,
  quests: QUESTS_LEXICON,
  'shop-denki': SHOP_DENKI_LEXICON,
  'shop-fuku': SHOP_FUKU_LEXICON,
  'shop-aiko': SHOP_AIKO_LEXICON,
  'shop-motors': SHOP_MOTORS_LEXICON,
  social: SOCIAL_LEXICON,
  'social-chat': SOCIAL_CHAT_LEXICON,
  'social-friends': SOCIAL_FRIENDS_LEXICON,
  'social-hearts': SOCIAL_HEARTS_LEXICON,
  jobs: JOBS_LEXICON,
  culture: CULTURE_LEXICON,
};

export const LEXICON = new Lexicon(LEXICON_ENTRIES);
