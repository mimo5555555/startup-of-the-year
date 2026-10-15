// Interior stages. A stage is a small procedural room loaded on demand. Entering swaps the world's colliders, bounds and
// camera limits for the stage's and restores the player to the door on exit; the panel fallback never depends on them.
// Wave B1 builds the three friend homes (`mio_1r`, `aiko_tatami`, `kenji_flat`); the dorm and the Ono flat are wave B2.
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
  /** rotation.y; 0 faces +z (the genkan side), PI faces into the room */
  heading: number;
}

/** A person standing in the room (the host first; Hina in Kenji's flat). Built from the world's registered characters. */
export interface StageActor {
  /** the Character id (`mio`, `aiko`, `kenji`, `hina`): the pick is `host:<id>` and the conversation helpers take the same id */
  id: string;
  x: number;
  z: number;
  /** rotation.y; 0 faces +z */
  heading: number;
  /** talk range: `nearby` fires inside it */
  radius: number;
  /** where `teleportNear(id)` puts the learner: about 1.5 m off, on clear floor, facing the actor */
  talk: { x: number; z: number };
}

/** What the learner has done at the genkan. Shoes off opens the step; the slippers are the second button. */
export interface StageState {
  shoesOff: boolean;
  slippersOn: boolean;
}

/** What `Stage.build` receives: the world's shared materials and the furniture the player has placed. */
export interface StageBuildCtx {
  toon: THREE.Material;
  glow: THREE.Material;
  /** furniture slot -> item id (`bed`, `desk`, `shelf`, `table`, `plant`, `kitchen`, `light`, `tv`) */
  placed: Readonly<Record<string, string>>;
  /** colour of the learner's shoes: the pair that is set down on the genkan mat */
  playerShoes: string;
}

/** A stage pick; `off` hides it from tapping and from the sparkles (the genkan buttons once they are done). */
export interface StagePick extends Pickable {
  off?: boolean;
}

export interface StageHandle {
  group: THREE.Group;
  pickables: StagePick[];
  update?(dt: number, t: number): void;
  /** the genkan changed: show the neat pair of shoes, hide the slippers, switch the matching picks off */
  setState?(s: Readonly<StageState>): void;
  /** frees the geometries, materials and textures the stage made (never the shared toon and glow materials) */
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
  /** the host first, then anyone else in the room */
  actors: StageActor[];
  /** the raised main floor: the player and the actors stand `step` metres higher on it (the genkan strip is at 0) */
  floor: { raised: Rect; step: number };
  /** the clear colour round the cut-away room */
  backdrop: string;
  /** a wall across the step, solid until the shoes are off */
  gate: Rect;
  /** walking into this (the door side) asks to leave: the world emits `{type:'stage', phase:'leave'}` once per entry */
  exit: Rect;
  build(ctx: StageBuildCtx): StageHandle;
}
