// The Ono-sō flat (3.6 x 4.5 m, §8.8): the six-jō tatami room above Aiko's tea shop that the player rents, UNFURNISHED. Six
// tatami mats, shoji on the right wall, a bare tokonoma in the back corner and the genkan along the front with the door in the
// left wall. Eight furniture slots (bed, desk, shelf, table, plant, kitchen, light, tv) take the player's furniture
// (`StageBuildCtx.placed`); a housewarming guest stands on a clear spot (`enterStage('ono_flat', { guest })`).
import type { Rect } from '../layout';
import type { Stage, StageBuildCtx, StageSlot } from '../stage';
import { withFurniture } from './furniture';
import { RoomKit, STEP, stageShell, type RoomSpec } from './room';

const F = STEP;
const MAT = 0.035; // the tatami top above the raised floor

const SPEC: RoomSpec = {
  id: 'ono_flat',
  w: 3.6,
  d: 4.5,
  genkanDepth: 1.0,
  doorSide: -1,
  look: { wall: '#eddcb4', wainscot: '#a07f58', trim: '#5a4030', floor: '#b08a60', genkan: '#9ea29c', beam: '#4a3426', slab: '#6f5a46', door: '#8a6a4a', sky: '#f6f0dc', mat: '#7a8f6a' },
  lights: { hemiSky: '#fff0d8', hemiGround: '#d9ae88', hemi: 2.3, warm: '#ffc27a', point: 14, pointAt: [0.1, 2.0, -0.3], backdrop: '#e7d4c0' },
};

const plan = new RoomKit(SPEC);
const rect = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });

const TOKO = rect(-1.8, -0.5, -2.25, -1.75);
const SHOJI_HOLE = { a0: -2.0, a1: 0.45, y0: 0.5, y1: 2.15 };

/**
 * The eight slots run round the walls and touch each other, the walls, the tokonoma or the genkan step wherever they meet, so
 * the middle of the room stays one clear floor (1.7 m wide) for the kotatsu, the guest and the player, and no slit narrower
 * than a person is left between two pieces (tests/stages-own.test.ts checks every pair, with all eight filled).
 */
export const ONO_SLOTS: readonly StageSlot[] = [
  { name: 'kitchen', rect: rect(-1.8, -1.4, -1.75, -0.75), face: 'right', y0: F + MAT },
  { name: 'bed', rect: rect(-1.8, -0.85, -0.75, 1.25), face: 'front', y0: F + 0.02 },
  { name: 'desk', rect: rect(-0.5, 0.5, -2.25, -1.62), face: 'front', y0: F + MAT },
  { name: 'tv', rect: rect(0.5, 1.4, -2.25, -1.85), face: 'front', y0: F + MAT },
  { name: 'plant', rect: rect(1.4, 1.8, -2.25, -1.8), face: 'front', y0: F + MAT },
  { name: 'light', rect: rect(1.45, 1.8, -1.8, -1.45), face: 'front', y0: F + MAT },
  { name: 'table', rect: rect(0.85, 1.8, -0.6, 0.35), face: 'front', y0: F + MAT },
  { name: 'shelf', rect: rect(1.45, 1.8, 0.35, 1.25), face: 'left', y0: F },
];

export const ONO_FLAT: Stage = {
  id: 'ono_flat',
  ...stageShell(plan),
  colliders: [TOKO],
  slots: ONO_SLOTS,
  camera: { dist: 5.2, minDist: 3.2, maxDist: 7.4, pitch: 0.66, minPitch: 0.35, maxPitch: 1.1 },
  returnDoor: 'door:flat',
  actors: [],
  guest: { x: 0.0, z: -0.45, heading: 0, radius: 2.5, talk: { x: 0.2, z: 0.65 } },
  build(ctx: StageBuildCtx) {
    const k = new RoomKit(SPEC, ctx);
    const { solid, glow } = k;
    const dark = '#4a3426';
    const igusa = '#b9c47e';
    const heri = '#3d5236';

    k.floors();
    k.wall('back');
    k.wall('left');
    k.wall('right', [SHOJI_HOLE]);
    k.door();
    k.genkan();

    // ---- six tatami mats (0.9 x 1.8 m, long side along x) with their dark edging; a wooden strip between them and the step ----
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const cx = -0.9 + c * 1.8;
        const cz = -1.8 + r * 0.9;
        solid.boxB(cx, F, cz, 1.78, MAT, 0.88, c === r % 2 ? igusa : '#c0ca87');
        for (const dz of [-0.435, 0.435]) solid.boxB(cx, F + MAT, cz + dz, 1.78, 0.006, 0.03, heri);
      }
    }

    // ---- the shoji on the right wall: glowing paper in a lattice, with a low sill ----
    const sx = k.x1;
    const a = (SHOJI_HOLE.a0 + SHOJI_HOLE.a1) / 2;
    const w = SHOJI_HOLE.a1 - SHOJI_HOLE.a0;
    const hh = SHOJI_HOLE.y1 - SHOJI_HOLE.y0;
    k.quad(sx + 0.3, (SHOJI_HOLE.y0 + SHOJI_HOLE.y1) / 2, a, w, hh, -Math.PI / 2, '#fff7dc', glow);
    for (let i = 0; i <= 8; i++) solid.boxB(sx - 0.03, SHOJI_HOLE.y0, SHOJI_HOLE.a0 + (i * w) / 8, 0.04, hh, 0.035, dark);
    for (let j = 0; j <= 5; j++) solid.boxB(sx - 0.03, SHOJI_HOLE.y0 + (j * (hh - 0.035)) / 5, a, 0.04, 0.035, w, dark);
    solid.boxB(sx - 0.06, SHOJI_HOLE.y0 - 0.04, a, 0.12, 0.05, w + 0.1, '#5a4030');

    // ---- the tokonoma, bare: a raised platform, two posts, a beam and a plain wall panel with a hook for a scroll ----
    const tc = (TOKO.x0 + TOKO.x1) / 2;
    solid.boxB(tc, F, -2.0, 1.3, 0.1, 0.5, '#7d5238');
    for (const x of [TOKO.x0 + 0.04, TOKO.x1 - 0.04]) solid.cyl(x, F, TOKO.z1 - 0.03, 0.04, 0.04, 2.1, dark, { seg: 6 });
    solid.boxB(tc, 2.0, TOKO.z1 - 0.03, 1.3, 0.08, 0.08, dark);
    k.onWall('back', tc, 1.1, 1.1, 1.7, '#e3d1a6', 0.012);
    solid.boxB(tc, 1.82, k.z0 + 0.03, 0.04, 0.04, 0.04, '#2b2b36');

    // ---- the genkan: a low shoe rack at the front end of the stone, off the way to the door ----
    solid.boxB(1.4, 0, 2.05, 0.6, 0.16, 0.2, '#7a5238');

    return withFurniture(k.finish(), ctx, { slots: ONO_SLOTS });
  },
};
