// Shared geometry of the Tokyo district. Units are metres; +x east, +z south, shops face +z.

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export const FRONT_Z = -9; // front plane of the north-side shops
export const ROAD = { z0: -5, z1: 5 };
/** Something the camera must stay out of. Heights default to a full-height building. */
export interface Occluder extends Rect {
  y0?: number;
  y1?: number;
}

/** East edge is 90 so Nakamura Motors (x 68.5..82.5) and the east end spot fit; the ground, sidewalks and curbs already reach x 170. */
export const BOUNDS: Rect = { x0: -46, x1: 90, z0: -8.3, z1: 37.5 };
/** x extent of the ground, sidewalks and curbs that city.ts lays down (traffic wraps inside it). */
export const GROUND_X = { x0: -130, x1: 170 };

/** A box centred on (cx, cz). */
export const boxRect = (cx: number, cz: number, w: number, d: number): Rect => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });

export interface ShopDef {
  id: 'konbini' | 'cafe' | 'school' | 'ramen' | 'station' | 'fukufuku' | 'denki' | 'motors';
  cx: number;
  w: number;
  d: number;
  h: number;
}

// The first five keep their indices (city.ts reads SHOPS[0..4]); the new open-front dioramas are appended.
export const SHOPS: ShopDef[] = [
  { id: 'konbini', cx: -28, w: 12, d: 10, h: 5.4 },
  { id: 'cafe', cx: -12, w: 12, d: 10, h: 5.8 },
  { id: 'school', cx: 4, w: 12, d: 12, h: 8.6 },
  { id: 'ramen', cx: 20, w: 11, d: 9.5, h: 5.2 },
  { id: 'station', cx: 40, w: 20, d: 13, h: 8.2 },
  { id: 'fukufuku', cx: -40.4, w: 11, d: 9.5, h: 5.6 }, // x -45.9..-34.9, 0.9 m from the konbini
  { id: 'denki', cx: 57.5, w: 12, d: 10, h: 6.2 }, // x 51.5..63.5, 1.5 m from the station
  { id: 'motors', cx: 75.5, w: 14, d: 10, h: 5.6 }, // x 68.5..82.5, the east extension
];

export const shopRect = (s: ShopDef): Rect => ({ x0: s.cx - s.w / 2, x1: s.cx + s.w / 2, z0: FRONT_Z - s.d, z1: FRONT_Z });

/** Something a spawn can stand inside of: a shop diorama, or Aiko's street stall (the restyled florist front). */
export type SpawnSite = ShopDef['id'] | 'aiko_stall';

export interface NpcSpawn {
  id: string;
  x: number;
  z: number;
  /** rotation.y: 0 faces +z (south, toward the street) */
  face: number;
  radius: number;
  kind: 'scenario' | 'lesson';
  /** floor height under the character (staff stand on a raised floor behind the counter) */
  y?: number;
  /** the building that must be built for this NPC to appear (world.ts also needs the character to be registered) */
  site?: SpawnSite;
}

export const NPC_SPAWNS: NpcSpawn[] = [
  { id: 'tanaka', x: -28, z: -12.5, face: 0, radius: 5.4, kind: 'scenario', y: 0.28 },
  { id: 'yuki', x: -12, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.28 },
  { id: 'hanako', x: 4, z: -11.6, face: 0, radius: 5.4, kind: 'lesson' },
  { id: 'kenji', x: 20, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.28 },
  { id: 'sato', x: 40, z: -11.4, face: 0, radius: 5.6, kind: 'scenario' },
  { id: 'mio', x: -9, z: 17.2, face: Math.PI, radius: 4.4, kind: 'scenario' },
  { id: 'rin', x: -40.4, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.28, site: 'fukufuku' },
  { id: 'aoi', x: 57.5, z: -12.5, face: 0, radius: 5.4, kind: 'scenario', y: 0.28, site: 'denki' },
  { id: 'nakamura', x: 71.0, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.28, site: 'motors' },
  // on the sidewalk in front of the stall wall (z 9.7), behind her counter, facing the street
  { id: 'aiko', x: 35.3, z: 9.15, face: Math.PI, radius: 5.0, kind: 'scenario', site: 'aiko_stall' },
];

export const PLAYER_START = { x: 3.2, z: -6.7, heading: Math.PI };
/** Collision radii used when checking that data leaves room (the world's own constants live in world.ts). */
export const PLAYER_RADIUS = 0.42;
export const NPC_RADIUS = 0.3;
export const WALKER_RADIUS = 0.3;

export interface WalkerRoute {
  points: Array<[number, number]>;
  speed: number;
  loop: boolean;
}

export interface WalkerDef {
  spec: number;
  route: WalkerRoute;
}

export const WALKERS: WalkerDef[] = [
  { spec: 0, route: { points: [[-42, -7], [58, -7]], speed: 1.3, loop: false } },
  // starts at the new east end (x 86) so the extension has foot traffic
  { spec: 1, route: { points: [[86, 7.2], [-30, 7.2]], speed: 1.15, loop: false } },
  { spec: 2, route: { points: [[30, -7], [30, 7.4], [30, -7]], speed: 1.25, loop: true } },
  { spec: 3, route: { points: [[-12, 15], [-12, 22], [-26, 22], [-26, 30], [-12, 30], [-12, 22]], speed: 1.0, loop: true } },
  // keeps to the south sidewalk: the old leg along z = 12 ran through the solid shop fronts (z 9.7..18.7)
  { spec: 4, route: { points: [[-40, 7.4], [10, 7.4], [48, 7.4], [10, 7.4]], speed: 1.2, loop: true } },
];

export interface MapRect extends Rect {
  color: string;
  label?: string;
}

// ---------------------------------------------------------------------------------------------
// §6.4 data for the game expansion. city.ts / world.ts read these in slice 1H-b; nothing here
// changes the look of the six existing places.
// ---------------------------------------------------------------------------------------------

/** Interior counters of the new shop dioramas (the NPC stands at z about -12.4, behind this). */
export const SHOP_COUNTERS: Partial<Record<ShopDef['id'], Rect>> = {
  fukufuku: boxRect(-40.4, -10.8, 4.4, 0.9),
  denki: boxRect(57.5, -10.8, 5.0, 0.9),
  motors: boxRect(71.0, -10.8, 2.6, 0.9),
};

/** Two kei cars inside Nakamura Motors: 3.4 x 1.5 m, lying along x, 0.2 m apart. */
export const KEI = { len: 3.4, wid: 1.5 };
export const MOTORS_CARS: Array<{ x: number; z: number }> = [
  { x: 76.8, z: -14.2 },
  { x: 80.4, z: -14.2 },
];
export const keiRect = (c: { x: number; z: number }): Rect => boxRect(c.x, c.z, KEI.len, KEI.wid);

/** Three bikes parked outside Nakamura Motors, lying along z so their 0.5 m colliders do not overlap (ry = PI/2). */
export const MOTORS_BIKES: Array<{ x: number; z: number; ry: number }> = [66.2, 67.0, 67.8].map((x) => ({ x, z: -7.4, ry: Math.PI / 2 }));
/** A bike is 1.4 m long and 0.5 m wide along its own x axis. */
export const bikeRect = (b: { x: number; z: number; ry: number }): Rect => {
  const c = Math.abs(Math.cos(b.ry));
  const s = Math.abs(Math.sin(b.ry));
  return boxRect(b.x, b.z, c * 1.4 + s * 0.5, s * 1.4 + c * 0.5);
};

/** South-side decorative fronts: solid boxes at front plane z = 9.7, depth 9 (an NPC cannot stand inside them). */
export const SOUTH_FRONT = { z0: 9.7, d: 9, gap: 0.4, x0: 15 };
export const SOUTH_FRONTS: Array<{ id: 'izakaya' | 'yakkyoku' | 'hanaya' | 'honya' | 'hotel' | 'game'; w: number; cx: number; rect: Rect }> = (() => {
  const defs = [['izakaya', 8], ['yakkyoku', 8], ['hanaya', 7], ['honya', 8], ['hotel', 11], ['game', 8]] as const;
  let x = SOUTH_FRONT.x0;
  return defs.map(([id, w]) => {
    const cx = x + w / 2;
    x += w + SOUTH_FRONT.gap;
    return { id, w, cx, rect: { x0: cx - w / 2, x1: cx + w / 2, z0: SOUTH_FRONT.z0, z1: SOUTH_FRONT.z0 + SOUTH_FRONT.d } };
  });
})();
/** The alley between the park and the first south front. */
export const ALLEY: Rect = boxRect(12, 15, 4, 12);

/** Aiko's tea house: the florist front (x 31.8..38.8) restyled as a street stall. The NPC spawn is in NPC_SPAWNS. */
export const AIKO_STALL = {
  front: 'hanaya' as const,
  sign: { text: '小野茶房', sub: 'ono sabō' },
  plate: '小野荘', // balcony plate of the flat above
  counter: boxRect(35.3, 8.3, 4.6, 0.9), // h 0.95, collider
  counterH: 0.95,
  awningY: 2.8,
  /** flower pots kept at the two sides of the counter (the florist's six pots shrink to three) */
  pots: [{ x: 32.4, z: 8.8 }, { x: 38.0, z: 8.8 }, { x: 38.5, z: 8.8 }],
};

export type DoorId = 'door:dorm' | 'door:mio' | 'door:kenji' | 'door:aiko';

export interface DoorDef {
  id: DoorId;
  /** the small facade box (collider and occluder); door:aiko is a pick on the stall, with no box of its own */
  body?: { rect: Rect; h: number };
  sign: { text: string; sub: string };
  /** ray pick point (picks are ray-based and need no proximity) */
  pick: { x: number; y: number; z: number };
  radius: number;
}

export const DOORS: DoorDef[] = [
  { id: 'door:dorm', body: { rect: boxRect(-4, -10.5, 3.6, 3), h: 4.2 }, sign: { text: '寮', sub: 'ryō' }, pick: { x: -4, y: 1.2, z: -8.8 }, radius: 1.2 },
  // stairs lead up to the flat above the ramen shop
  { id: 'door:kenji', body: { rect: boxRect(27.7, -11, 3.6, 4), h: 6.4 }, sign: { text: '住居', sub: 'jūkyo' }, pick: { x: 27.7, y: 1.2, z: -8.8 }, radius: 1.2 },
  // flush against the north face of the alley block (z 9..21)
  { id: 'door:mio', body: { rect: boxRect(12, 8.6, 3.6, 0.8), h: 6.4 }, sign: { text: 'ミオ', sub: 'mio' }, pick: { x: 12, y: 1.2, z: 8.2 }, radius: 1.2 },
  { id: 'door:aiko', sign: { text: '小野荘', sub: 'ono-sō' }, pick: { x: 38.2, y: 1.2, z: 9.55 }, radius: 1.2 },
];

export type SpotId = 'spot:torii' | 'spot:pond' | 'spot:east_end' | 'spot:west_end' | 'spot:station_plaza';

/** Invisible circles; walking into one emits the world event `{type:'spot', id}` (dream `bike` and `visit` objectives). */
export interface SpotDef {
  id: SpotId;
  x: number;
  z: number;
  r: number;
}

export const SPOTS: SpotDef[] = [
  { id: 'spot:torii', x: -12, z: 10.5, r: 3 },
  { id: 'spot:pond', x: -23, z: 28.5, r: 4 },
  { id: 'spot:east_end', x: 88, z: 0, r: 3 },
  { id: 'spot:west_end', x: -44, z: 0, r: 3 },
  { id: 'spot:station_plaza', x: 40, z: -6, r: 4 },
];

/** Spots that contain the point (a spot at a pick-less place has no sparkle, so the world polls this). */
export const spotsAt = (x: number, z: number, spots: readonly SpotDef[] = SPOTS): SpotDef[] => spots.filter((s) => Math.hypot(x - s.x, z - s.z) <= s.r);

export interface VendingDef {
  x: number;
  z: number;
  /** rotation.y: 0 faces +z */
  face: number;
  body: string;
}

/** The fourth machine moved from (51.4, -8.2), which now stands in front of Hikari Denki, to the shop's east side. */
export const VENDING: VendingDef[] = [
  { x: -21.0, z: -9.6, face: 0, body: '#d8433f' },
  { x: -19.4, z: -9.6, face: 0, body: '#3b6fb6' },
  { x: -14.4, z: 9.9, face: Math.PI, body: '#e8a640' },
  { x: 64.6, z: -8.2, face: 0, body: '#2e9e5b' },
];
export const VENDING_SIZE = { w: 1.1, d: 0.9 };

/** Street lamps: x positions along the north (z -6) and south (z 6) sidewalks; 70 and 84 light the east extension. */
export const LAMPS = {
  northZ: -6,
  southZ: 6,
  northX: [-44, -34, -20, -4, 12, 28, 52, 62, 70],
  southX: [-38, -24, -9.5, 2, 16, 34, 46, 60, 84],
  size: 0.3,
};

/** Utility poles on the south sidewalk. The pole at x 32 stood inside Aiko's stall footprint (x 31.8..38.8), so it moved to 30.5; 80 is new. */
export const POLES = { z: 8.4, x: [-40, -16, 8, 30.5, 56, 80], size: 0.5 };

/** Cars wrap at +-130 (inside the ground, which reaches x 170) so they never pop in or out at the new east edge. */
export const TRAFFIC = { wrapX: 130 };

/** Skyline bands. The east band stood at x 100-114, past the new edge (90); it now starts at 110 (towers are at most 16 wide). */
export const SKYLINE = { eastX0: 110, eastSpan: 14, maxTowerW: 16 };

/** Every collider this module has data for, keyed for tests and for 1H-b (shop footprints stand in for whole buildings). */
export function layoutColliders(): Array<{ id: string; rect: Rect }> {
  const out: Array<{ id: string; rect: Rect }> = [];
  for (const s of SHOPS) out.push({ id: `shop:${s.id}`, rect: shopRect(s) });
  for (const [id, rect] of Object.entries(SHOP_COUNTERS)) out.push({ id: `counter:${id}`, rect: rect! });
  for (const f of SOUTH_FRONTS) out.push({ id: `front:${f.id}`, rect: f.rect });
  out.push({ id: 'alley', rect: ALLEY });
  out.push({ id: 'counter:aiko', rect: AIKO_STALL.counter });
  for (const d of DOORS) if (d.body) out.push({ id: d.id, rect: d.body.rect });
  VENDING.forEach((v, i) => out.push({ id: `vending:${i}`, rect: boxRect(v.x, v.z, VENDING_SIZE.w, VENDING_SIZE.d) }));
  MOTORS_BIKES.forEach((b, i) => out.push({ id: `bike:motors:${i}`, rect: bikeRect(b) }));
  for (const x of LAMPS.northX) out.push({ id: `lamp:n:${x}`, rect: boxRect(x, LAMPS.northZ, LAMPS.size, LAMPS.size) });
  for (const x of LAMPS.southX) out.push({ id: `lamp:s:${x}`, rect: boxRect(x, LAMPS.southZ, LAMPS.size, LAMPS.size) });
  for (const x of POLES.x) out.push({ id: `pole:${x}`, rect: boxRect(x, POLES.z, POLES.size, POLES.size) });
  return out;
}
