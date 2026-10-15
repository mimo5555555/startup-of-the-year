// The shared shell of a friend's home: a cut-away room (floor slab, a raised main floor behind a 0.15 m step, three
// one-sided walls, no ceiling, no front wall) with the genkan strip at the front, the entrance door in one side wall,
// the two genkan props the learner taps (their shoes on the mat, the slippers on the step) and the two lights.
//
// Everything static is merged into two vertex-coloured batches (solid toon + unlit glow = 2 draw calls); the learner's
// shoes and the slippers are two more tiny meshes so they can be shown and hidden. So a stage is 4 draw calls before the
// people in it. Walls are single quads facing into the room: the dollhouse trick, a wall seen from behind is culled, so
// the camera can swing out past a side wall without anything standing in front of the room.
import * as THREE from 'three';
import { Batch } from '../batch';
import type { Rect } from '../layout';
import type { Stage, StageBuildCtx, StageHandle, StageId, StagePick, StageState } from '../stage';

/** Height of the walls, the step at the genkan and the bounds inset that keeps the avatar's shoulders off the walls. */
export const WALL_H = 2.5;
export const STEP = 0.15;
const INSET = 0.3;
/** the player's collision radius in the world (a path test uses the same) */
export const PLAYER_R = 0.42;

export interface RoomLook {
  /** wall above the wainscot, the wainscot, the cap and skirting trim */
  wall: string;
  wainscot: string;
  trim: string;
  /** raised main floor, genkan floor, the beam on the step edge, the slab edge under the room */
  floor: string;
  genkan: string;
  beam: string;
  slab: string;
  door: string;
  /** what the window looks onto, and the mat */
  sky: string;
  mat: string;
}

export interface RoomLights {
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  warm: string;
  point: number;
  pointAt: [number, number, number];
  /** the clear colour round the dollhouse */
  backdrop: string;
}

export interface RoomSpec {
  id: StageId;
  w: number;
  d: number;
  genkanDepth: number;
  /** +1: the entrance is in the +x wall; -1: in the -x wall */
  doorSide: 1 | -1;
  look: RoomLook;
  lights: RoomLights;
}

export interface Hole {
  a0: number;
  a1: number;
  y0: number;
  y1: number;
}

const PLANE = new THREE.PlaneGeometry(1, 1);

export class RoomKit {
  readonly solid = new Batch();
  readonly glow = new Batch();
  readonly shoes = new Batch();
  readonly slippers = new Batch();
  readonly picks: StagePick[] = [];
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** z of the step line: the raised floor is at z < stepZ, the genkan strip at z > stepZ */
  readonly stepZ: number;
  /** z of the door's centre, and the doorway's x */
  readonly doorZ: number;
  readonly doorX: number;
  /** where the learner appears, the mat, the slippers */
  readonly spawn: { x: number; z: number };
  readonly mat: { x: number; z: number };
  readonly slip: { x: number; z: number };
  readonly wainH = 0.95;

  /** `ctx` is needed only by `genkan()` and `finish()`: the static plan (bounds, spawn, exit) is read from a kit without one */
  constructor(readonly spec: RoomSpec, private readonly buildCtx?: StageBuildCtx) {
    this.x0 = -spec.w / 2;
    this.x1 = spec.w / 2;
    this.z0 = -spec.d / 2;
    this.z1 = spec.d / 2;
    this.stepZ = this.z1 - spec.genkanDepth;
    this.doorZ = (this.stepZ + this.z1) / 2;
    this.doorX = spec.doorSide * this.x1;
    this.spawn = { x: spec.doorSide * (this.x1 - 1.4), z: this.doorZ + 0.12 };
    this.mat = { x: spec.doorSide * (this.x1 - 2.2), z: this.doorZ + 0.05 };
    this.slip = { x: this.spawn.x, z: this.stepZ - 0.3 };
  }

  private need(): StageBuildCtx {
    if (!this.buildCtx) throw new Error(`stage ${this.spec.id}: no build context`);
    return this.buildCtx;
  }

  // ---- geometry helpers ----

  /** a flat quad facing along +z rotated by ry (walls, posters, panels); its normal points into the room */
  quad(cx: number, cy: number, cz: number, w: number, h: number, ry: number, color: string, into: Batch = this.solid) {
    into.raw(PLANE, cx, cy, cz, w, h, 1, color, { ry });
  }

  /** a quad on a side or back wall, `off` metres in front of the wall plane */
  onWall(side: 'back' | 'left' | 'right', a: number, cy: number, w: number, h: number, color: string, off = 0.01, into: Batch = this.solid) {
    if (side === 'back') this.quad(a, cy, this.z0 + off, w, h, 0, color, into);
    else if (side === 'left') this.quad(this.x0 + off, cy, a, w, h, Math.PI / 2, color, into);
    else this.quad(this.x1 - off, cy, a, w, h, -Math.PI / 2, color, into);
  }

  /** a box fixed to a wall: along-wall centre `a`, depth `t` into the room, standing on y0 */
  onWallBox(side: 'back' | 'left' | 'right', a: number, y0: number, w: number, h: number, t: number, color: string, into: Batch = this.solid) {
    if (side === 'back') into.boxB(a, y0, this.z0 + t / 2, w, h, t, color);
    else if (side === 'left') into.boxB(this.x0 + t / 2, y0, a, t, h, w, color);
    else into.boxB(this.x1 - t / 2, y0, a, t, h, w, color);
  }

  /** one wall, in two colour bands, with holes cut out (their along-wall extents must not overlap) */
  wall(side: 'back' | 'left' | 'right', holes: Hole[] = []) {
    const [lo, hi] = side === 'back' ? [this.x0, this.x1] : [this.z0, this.z1];
    const sorted = [...holes].sort((p, q) => p.a0 - q.a0);
    const piece = (a0: number, a1: number, y0: number, y1: number) => {
      if (a1 - a0 < 1e-4 || y1 - y0 < 1e-4) return;
      const cut = this.wainH;
      if (y0 < cut) {
        const top = Math.min(y1, cut);
        this.onWall(side, (a0 + a1) / 2, (y0 + top) / 2, a1 - a0, top - y0, this.spec.look.wainscot, 0);
      }
      if (y1 > cut) {
        const bot = Math.max(y0, cut);
        this.onWall(side, (a0 + a1) / 2, (bot + y1) / 2, a1 - a0, y1 - bot, this.spec.look.wall, 0);
      }
    };
    let cursor = lo;
    for (const h of sorted) {
      piece(cursor, h.a0, 0, WALL_H);
      piece(h.a0, h.a1, 0, h.y0);
      piece(h.a0, h.a1, h.y1, WALL_H);
      cursor = h.a1;
    }
    piece(cursor, hi, 0, WALL_H);
    // the cap along the top and a chair rail between the bands (the only parts with an outside)
    const T = this.spec.look.trim;
    if (side === 'back') this.solid.boxB(0, WALL_H, this.z0 - 0.04, this.spec.w + 0.16, 0.1, 0.16, T);
    else this.solid.boxB(side === 'left' ? this.x0 - 0.04 : this.x1 + 0.04, WALL_H, 0, 0.16, 0.1, this.spec.d + 0.16, T);
    if (side === 'back') this.solid.boxB(0, this.wainH - 0.02, this.z0 + 0.02, this.spec.w, 0.05, 0.04, T);
    else this.solid.boxB(side === 'left' ? this.x0 + 0.02 : this.x1 - 0.02, this.wainH - 0.02, 0, 0.04, 0.05, this.spec.d, T);
  }

  // ---- the shell ----

  /** slab under the room, genkan stone, raised floor, the beam on the step edge */
  floors() {
    const { w, d } = this.spec;
    const L = this.spec.look;
    this.solid.boxB(0, -0.32, 0, w + 0.3, 0.3, d + 0.3, L.slab); // the thick edge the cut-away shows (its top sits under the genkan stone)
    this.solid.boxB(0, -0.02, 0, w, 0.02, d, L.genkan); // genkan stone, top at y 0
    this.solid.boxB(0, 0, (this.z0 + this.stepZ) / 2, w, STEP, this.stepZ - this.z0, L.floor); // raised main floor
    this.solid.boxB(0, STEP - 0.05, this.stepZ + 0.03, w, 0.05, 0.08, L.beam); // the beam: a visible line on the step
    this.solid.boxB(0, 0, this.stepZ + 0.015, w, STEP - 0.05, 0.03, L.beam); // its front face, darker than the stone
  }

  /** the entrance door in the side wall at the genkan, with the `stage:exit` pick */
  door() {
    const s = this.spec.doorSide;
    const L = this.spec.look;
    const x = s * (this.x1 - 0.03);
    const hw = 0.46; // half width along z
    this.solid.boxB(x, 0, this.doorZ, 0.06, 2.1, 2 * hw + 0.16, L.trim); // frame
    this.solid.boxB(x - s * 0.04, 0, this.doorZ, 0.05, 2.0, 2 * hw, L.door); // leaf
    this.glow.boxB(x - s * 0.075, 1.35, this.doorZ, 0.02, 0.5, 0.3, '#fff3cf'); // frosted slit: daylight at the door
    this.solid.boxB(x - s * 0.1, 0.98, this.doorZ - hw * 0.7, 0.05, 0.05, 0.12, '#d6cbb8'); // handle
    this.solid.boxB(x - s * 0.04, 2.0, this.doorZ, 0.07, 0.1, 2 * hw + 0.16, L.trim);
    this.picks.push({ id: 'stage:exit', pos: new THREE.Vector3(x - s * 0.2, 1.05, this.doorZ), radius: 0.62 });
  }

  /** the mat, the learner's shoes and the slippers; fills the two dynamic batches and the two genkan picks */
  genkan() {
    const L = this.spec.look;
    const s = this.spec.doorSide;
    this.solid.boxB(this.mat.x, 0, this.mat.z, 0.95, 0.03, 0.6, L.mat);
    for (const dz of [-0.17, 0, 0.17]) this.solid.boxB(this.mat.x, 0.03, this.mat.z + dz, 0.8, 0.005, 0.05, '#e9e4d6');
    // the learner's shoes, set neatly side by side with the toes towards the door
    for (const dz of [-0.13, 0.13]) {
      this.shoes.boxB(this.mat.x - s * 0.02, 0.03, this.mat.z + dz, 0.26, 0.07, 0.11, this.need().playerShoes);
      this.shoes.sphere(this.mat.x + s * 0.12, 0.07, this.mat.z + dz, 0.065, this.need().playerShoes, { sx: 1.1, sy: 0.7, ws: 6, hs: 4 });
    }
    // slippers on the raised floor, toes towards the room
    for (const dx of [-0.1, 0.1]) {
      this.slippers.boxB(this.slip.x + dx, STEP, this.slip.z, 0.13, 0.045, 0.3, '#e8789e');
      this.slippers.boxB(this.slip.x + dx, STEP + 0.045, this.slip.z - 0.05, 0.11, 0.03, 0.16, '#f6c7d8');
    }
    this.picks.push({ id: 'genkan:shoes', pos: new THREE.Vector3(this.mat.x, 0.12, this.mat.z), radius: 0.5 });
    this.picks.push({ id: 'genkan:slippers', pos: new THREE.Vector3(this.slip.x, STEP + 0.08, this.slip.z), radius: 0.42 });
  }

  // ---- furniture ----

  /** a box on the raised floor (the stage lists its colliders as data next to the furniture it draws) */
  furn(cx: number, cz: number, w: number, d: number, h: number, color: string, y0 = STEP) {
    this.solid.boxB(cx, y0, cz, w, h, d, color);
  }

  pickProp(prop: string, x: number, y: number, z: number, radius = 0.45) {
    this.picks.push({ id: `prop:${this.spec.id}:${prop}`, pos: new THREE.Vector3(x, y, z), radius });
  }

  /** a pair of shoes lying on the genkan stone */
  shoePair(x: number, z: number, color: string, scale = 1, ry = 0) {
    for (const dz of [-0.09, 0.09]) {
      const c = Math.cos(ry);
      const sn = Math.sin(ry);
      const px = x + sn * dz * scale;
      const pz = z + c * dz * scale;
      this.solid.boxB(px, 0, pz, 0.2 * scale, 0.06 * scale, 0.085 * scale, color, { ry });
    }
  }

  // ---- the stage ----

  bounds(): Rect {
    return { x0: this.x0 + INSET, x1: this.x1 - INSET, z0: this.z0 + INSET, z1: this.z1 - 0.2 };
  }

  floor(): Stage['floor'] {
    return { raised: { x0: this.x0, x1: this.x1, z0: this.z0, z1: this.stepZ }, step: STEP };
  }

  gate(): Rect {
    return { x0: this.x0, x1: this.x1, z0: this.stepZ - 0.04, z1: this.stepZ + 0.04 };
  }

  /** the strip along the door: walking into it asks to leave */
  exit(): Rect {
    const s = this.spec.doorSide;
    const edge = s * (this.x1 - 0.8);
    return { x0: Math.min(edge, s * this.x1), x1: Math.max(edge, s * this.x1), z0: this.stepZ + 0.04, z1: this.z1 };
  }

  /** merges the batches into meshes, adds the lights and returns the handle the world drives */
  finish(update?: (dt: number, t: number) => void): StageHandle {
    const ctx = this.need();
    const { spec } = this;
    const group = new THREE.Group();
    group.name = `stage:${spec.id}`;
    const owned: Array<{ dispose(): void }> = [];
    const add = (b: Batch, mat: THREE.Material, name: string) => {
      const m = b.build(mat, { cast: false, receive: false, name });
      if (!m) return null;
      group.add(m);
      owned.push(m.geometry);
      return m;
    };
    add(this.solid, ctx.toon, 'stage-solid');
    add(this.glow, ctx.glow, 'stage-glow');
    const shoes = add(this.shoes, ctx.toon, 'stage-shoes');
    const slippers = add(this.slippers, ctx.toon, 'stage-slippers');
    if (shoes) shoes.visible = false;

    const L = spec.lights;
    const hemi = new THREE.HemisphereLight(L.hemiSky, L.hemiGround, L.hemi);
    const warm = new THREE.PointLight(L.warm, L.point, 11, 1.6);
    warm.position.set(...L.pointAt);
    group.add(hemi, warm);

    const picks = this.picks;
    const pickOf = (id: string) => picks.find((p) => p.id === id);
    const state: StageState = { shoesOff: false, slippersOn: false };
    const apply = (s: Readonly<StageState>) => {
      state.shoesOff = s.shoesOff;
      state.slippersOn = s.slippersOn;
      if (shoes) shoes.visible = s.shoesOff;
      if (slippers) slippers.visible = !s.slippersOn;
      const a = pickOf('genkan:shoes');
      const b = pickOf('genkan:slippers');
      if (a) a.off = s.shoesOff;
      if (b) b.off = s.slippersOn;
    };
    return {
      group,
      pickables: picks,
      update,
      setState: apply,
      dispose() {
        group.removeFromParent();
        for (const o of owned) o.dispose();
        hemi.dispose?.();
        warm.dispose?.();
        group.clear();
      },
    };
  }
}

/** The common fields of a Stage that follow from the room's shape (the caller adds `id`, `camera`, `returnDoor`, `actors`, `colliders`, `build`). */
export function stageShell(kit: RoomKit) {
  return {
    bounds: kit.bounds(),
    spawn: { x: kit.spawn.x, z: kit.spawn.z, heading: Math.PI },
    floor: kit.floor(),
    gate: kit.gate(),
    exit: kit.exit(),
    backdrop: kit.spec.lights.backdrop,
  };
}
