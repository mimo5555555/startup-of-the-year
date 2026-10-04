import { Lexicon } from '../markup';
import type { LexEntry } from '../types';
import { CORE_LEXICON } from './core';
import { SHOP_LEXICON } from './shop';
import { SOCIAL_LEXICON } from './social';
import { JOBS_LEXICON } from './jobs';
import { QUESTS_LEXICON } from './quests';
import { CULTURE_LEXICON } from './culture';

export { w, g } from './helpers';

const PARTS: LexEntry[][] = [CORE_LEXICON, SHOP_LEXICON, SOCIAL_LEXICON, JOBS_LEXICON, QUESTS_LEXICON, CULTURE_LEXICON];

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
  shop: SHOP_LEXICON,
  social: SOCIAL_LEXICON,
  jobs: JOBS_LEXICON,
  quests: QUESTS_LEXICON,
  culture: CULTURE_LEXICON,
};

export const LEXICON = new Lexicon(LEXICON_ENTRIES);
