import type { PocketLine } from '@lw/game';
import { CORE_POCKETS } from './pockets-core';
import { DENKI_FUKU_POCKETS } from './pockets-denki-fuku';
import { AIKO_MOTORS_POCKETS } from './pockets-aiko-motors';
import { SOCIAL_POCKETS } from './pockets-social';
import { JOBS_POCKETS } from './pockets-jobs';

/** Registry rule (docs/GAME_DESIGN.md §15.1): one part file per owner, spread here. */
export const POCKETS: Record<string, PocketLine> = {
  ...CORE_POCKETS,
  ...DENKI_FUKU_POCKETS,
  ...AIKO_MOTORS_POCKETS,
  ...SOCIAL_POCKETS,
  ...JOBS_POCKETS,
};
