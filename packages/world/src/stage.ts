// Interior stages (types only; the dorm, own flat and three friend homes are implemented in slice 5).
// A stage is a small procedural room loaded on demand. Entering swaps the world's colliders, bounds and camera
// limits for the stage's and restores the player to the door on exit; the panel fallback never depends on them.
import type * as THREE from 'three';
import type { Pickable } from './city';
import type { DoorId, Rect } from './layout';

export type StageId = 'dorm' | 'mio_1r' | 'aiko_tatami' | 'kenji_flat' | 'ono_flat';

export interface StageCamera {
  /** orbit distance when the stage opens (the design uses 4.4) */
  dist: number;
  minDist: number;
  maxDist: number;
  /** radians above the horizon */
  pitch: number;
  minPitch: number;
  maxPitch: number;
}

export interface StageSpawn {
  x: number;
  z: number;
  /** rotation.y; 0 faces +z (the genkan side) */
  heading: number;
}

/** What `Stage.build` receives: the world's shared materials and the furniture the player has placed. */
export interface StageBuildCtx {
  toon: THREE.Material;
  glow: THREE.Material;
  /** furniture slot -> item id (`bed`, `desk`, `shelf`, `table`, `plant`, `kitchen`, `light`, `tv`) */
  placed: Readonly<Record<string, string>>;
}

export interface StageHandle {
  group: THREE.Group;
  pickables: Pickable[];
  update?(dt: number, t: number): void;
  dispose(): void;
}

export interface Stage {
  id: StageId;
  /** local metres; the origin is the room centre and +z is the genkan side */
  bounds: Rect;
  colliders: Rect[];
  camera: StageCamera;
  /** where the player appears; the exit puts them back at `returnDoor` outside */
  spawn: StageSpawn;
  returnDoor: DoorId;
  build(ctx: StageBuildCtx): StageHandle;
}
