// A district is data plus a builder, so a second country pack adds a district instead of forking the world.
import type { BuildCtx } from './buildctx';
import { buildBuildings } from './buildings';
import { BOUNDS, DOORS, NPC_SPAWNS, SHOPS, SPOTS, WALKERS, type DoorDef, type NpcSpawn, type Rect, type ShopDef, type SpotDef, type WalkerDef } from './layout';

export interface District {
  id: string;
  bounds: Rect;
  shops: readonly ShopDef[];
  npcSpawns: readonly NpcSpawn[];
  doors: readonly DoorDef[];
  spots: readonly SpotDef[];
  walkers: readonly WalkerDef[];
  /**
   * Adds the district's shops, door facades and props to the world through the building registry. The ground, park,
   * street furniture and skyline are still built by `buildCity()` itself (their random draws are interleaved with the
   * fronts, so moving them would recolour the street); a second district brings its own ground when it exists.
   */
  build(ctx: BuildCtx): void;
}

export const TOKYO_DISTRICT: District = {
  id: 'tokyo',
  bounds: BOUNDS,
  shops: SHOPS,
  npcSpawns: NPC_SPAWNS,
  doors: DOORS,
  spots: SPOTS,
  walkers: WALKERS,
  build(ctx) {
    buildBuildings(ctx, TOKYO_DISTRICT);
  },
};
