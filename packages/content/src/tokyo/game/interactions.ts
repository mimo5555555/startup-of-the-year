import type { Interaction } from '@lw/game';

/** Pack data: characterId -> interactions: the full table (2B). */
export const INTERACTIONS: Record<string, Interaction[]> = {};
