// A district is data plus a builder, so a second country pack adds a district instead of forking the world.
import type { BuildCtx } from './buildctx';
import { buildBuildings } from './buildings';
import type { City } from './city';
import { BOUNDS, DOORS, NPC_SPAWNS, SHOPS, SPOTS, WALKERS, type DoorDef, type NpcSpawn, type Rect, type ShopBox, type SpotDef, type WalkerDef } from './layout';

export interface District {
  id: string;
  bounds: Rect;
  shops: readonly ShopBox[];
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
  /**
   * A district with a street of its own (Berlin) builds the whole city itself: ground, fronts and furniture; Tokyo leaves this out and
   * `buildCity()` lays its own ground, park and skyline around `build`.
   */
  buildCity?(district: District): City;
  /** where the player stands at the start (default: Tokyo's, in front of the school) */
  playerStart?: { x: number; z: number; heading: number };
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
