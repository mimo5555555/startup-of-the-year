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

export const BOUNDS: Rect = { x0: -46, x1: 64, z0: -8.3, z1: 37.5 };

export interface ShopDef {
  id: 'konbini' | 'cafe' | 'school' | 'ramen' | 'station';
  cx: number;
  w: number;
  d: number;
  h: number;
}

export const SHOPS: ShopDef[] = [
  { id: 'konbini', cx: -28, w: 12, d: 10, h: 5.4 },
  { id: 'cafe', cx: -12, w: 12, d: 10, h: 5.8 },
  { id: 'school', cx: 4, w: 12, d: 12, h: 8.6 },
  { id: 'ramen', cx: 20, w: 11, d: 9.5, h: 5.2 },
  { id: 'station', cx: 40, w: 20, d: 13, h: 8.2 },
];

export const shopRect = (s: ShopDef): Rect => ({ x0: s.cx - s.w / 2, x1: s.cx + s.w / 2, z0: FRONT_Z - s.d, z1: FRONT_Z });

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
}

export const NPC_SPAWNS: NpcSpawn[] = [
  { id: 'tanaka', x: -28, z: -12.5, face: 0, radius: 5.4, kind: 'scenario', y: 0.28 },
  { id: 'yuki', x: -12, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.28 },
  { id: 'hanako', x: 4, z: -11.6, face: 0, radius: 5.4, kind: 'lesson' },
  { id: 'kenji', x: 20, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.28 },
  { id: 'sato', x: 40, z: -11.4, face: 0, radius: 5.6, kind: 'scenario' },
  { id: 'mio', x: -9, z: 17.2, face: Math.PI, radius: 4.4, kind: 'scenario' },
];

export const PLAYER_START = { x: 3.2, z: -6.7, heading: Math.PI };

export interface WalkerRoute {
  points: Array<[number, number]>;
  speed: number;
  loop: boolean;
}

export const WALKERS: Array<{ spec: number; route: WalkerRoute }> = [
  { spec: 0, route: { points: [[-42, -7], [58, -7]], speed: 1.3, loop: false } },
  { spec: 1, route: { points: [[56, 7.2], [-30, 7.2]], speed: 1.15, loop: false } },
  { spec: 2, route: { points: [[30, -7], [30, 7.4], [30, -7]], speed: 1.25, loop: true } },
  { spec: 3, route: { points: [[-12, 15], [-12, 22], [-26, 22], [-26, 30], [-12, 30], [-12, 22]], speed: 1.0, loop: true } },
  { spec: 4, route: { points: [[-40, 7.4], [10, 7.4], [10, 12], [48, 12], [48, 7.4], [10, 7.4]], speed: 1.2, loop: true } },
];

export interface MapRect extends Rect {
  color: string;
  label?: string;
}
