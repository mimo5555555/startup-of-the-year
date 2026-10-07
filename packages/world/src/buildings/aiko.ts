import type { FrontOverride } from './index';

/**
 * Aiko's stall, slice 3B: restyles the florist front (hanaya) as the tea-house stall. Returning true from the override
 * replaces the florist's default dressing (sign, flower pots); call `ctx.markBuilt('aiko_stall')` so `aiko` spawns.
 * Stub: returning nothing keeps the florist as it is and keeps `aiko` from spawning.
 */
export const buildAiko: FrontOverride = () => {};
