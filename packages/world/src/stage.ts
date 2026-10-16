// Interior stages. A stage is a small procedural room loaded on demand. Entering swaps the world's colliders, bounds and
// camera limits for the stage's and restores the player to the door on exit; the panel fallback never depends on them.
// Wave B1 builds the three friend homes (`mio_1r`, `aiko_tatami`, `kenji_flat`); wave B2 adds the player's own rooms (`dorm`,
// `ono_flat`): no host, furniture slots (`slots`, drawn from `StageBuildCtx.placed`) and an optional guest (`guest`).
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

/**
 * What the learner has done at the genkan (shoes off opens the step; the slippers are the second button), and, in the
 * player's own rooms, the placement view: `showSlots` draws a faint marker on every furniture slot and turns the
 * `slot:<name>` picks on; `slotFocus` brightens one slot's marker (the one the player is about to fill).
 */
export interface StageState {
  shoesOff: boolean;
  slippersOn: boolean;
  showSlots?: boolean;
  slotFocus?: string | null;
}

/** A furniture slot of the player's own room. `rect` is the footprint on the floor (it is also the collider while the slot holds a piece). */
export interface StageSlot {
  /** `bed`, `desk`, `shelf`, `table`, `plant`, `kitchen`, `light`, `tv` (the dorm has the first three and `plant`); the pick is `slot:<name>` */
  name: string;
  rect: Rect;
  /** the way the piece faces: `front` looks towards +z (the open side), `left` towards -x (a piece on the right wall), `right` towards +x */
  face: 'front' | 'left' | 'right';
  /** the floor the piece stands on (the raised floor, or the tatami top) */
  y0: number;
  /** the dorm's own plain piece stands here while the slot is empty (so it is a collider either way) */
  basic?: boolean;
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
  /** furniture footprints that block the player right now (the placed pieces); the world adds them to the stage's own colliders */
  colliders?: readonly Rect[];
  update?(dt: number, t: number): void;
  /** the genkan changed: show the neat pair of shoes, hide the slippers, switch the matching picks off */
  setState?(s: Readonly<StageState>): void;
  /** the player placed or took away furniture: redraw only the furniture (slot -> item id) and refresh `colliders` */
  setPlaced?(placed: Readonly<Record<string, string>>): void;
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
  /** the host first, then anyone else in the room (the player's own rooms have nobody) */
  actors: StageActor[];
  /** the player's own rooms: where the furniture goes */
  slots?: readonly StageSlot[];
  /** the player's own rooms: where a guest (the housewarming friend; `enterStage(id, { guest })`) stands, on clear floor whatever is placed */
  guest?: Omit<StageActor, 'id'>;
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
