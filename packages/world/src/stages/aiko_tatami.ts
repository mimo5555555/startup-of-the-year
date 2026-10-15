// Aiko's tatami room above the tea shop (3.6 x 4.5 m, §8.8): six tatami mats, a kotatsu with zabuton, shoji on the right
// wall, a tokonoma with a scroll and a flower, a fusuma to the room next door, a teapot and cups. The genkan runs along
// the front with the door in the left wall. Props the learner can tap: tatami, kotatsu, zabuton, shoji, kyusu, hana.
import type { Rect } from '../layout';
import type { Stage, StageBuildCtx } from '../stage';
import { RoomKit, STEP, stageShell, type RoomSpec } from './room';

const F = STEP;

const SPEC: RoomSpec = {
  id: 'aiko_tatami',
  w: 3.6,
  d: 4.5,
  genkanDepth: 1.0,
  doorSide: -1,
  look: { wall: '#e6d3ae', wainscot: '#9c7a55', trim: '#5a4030', floor: '#b08a60', genkan: '#9ea29c', beam: '#4a3426', slab: '#6f5a46', door: '#8a6a4a', sky: '#f6f0dc', mat: '#7a8f6a' },
  lights: { hemiSky: '#fff0d8', hemiGround: '#d9ae88', hemi: 2.3, warm: '#ffc27a', point: 15, pointAt: [0.1, 2.0, -0.3], backdrop: '#e7d4c0' },
};

const plan = new RoomKit(SPEC);
const rect = (cx: number, cz: number, w: number, d: number): Rect => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });

const KOTATSU = rect(0.25, -0.75, 1.3, 1.3);
const LAMP = rect(1.6, 0.3, 0.4, 0.4);
const TOKO = rect(-1.15, -2.0, 1.3, 0.5);
const CHEST = rect(-1.6, -0.2, 0.4, 1.1);
const SHOJI_HOLE = { a0: -2.0, a1: 0.45, y0: 0.5, y1: 2.15 };

export const AIKO_TATAMI: Stage = {
  id: 'aiko_tatami',
  ...stageShell(plan),
  colliders: [KOTATSU, LAMP, TOKO, CHEST],
  camera: { dist: 4.4, minDist: 3.2, maxDist: 7.4, pitch: 0.66, minPitch: 0.35, maxPitch: 1.1 },
  returnDoor: 'door:aiko',
  actors: [{ id: 'aiko', x: -0.75, z: 0.15, heading: 0.3, radius: 2.5, talk: { x: 0.2, z: 1.0 } }],
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

    // ---- six tatami mats (0.9 x 1.8 m, long side along x), a wooden strip between them and the step ----
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const cx = -0.9 + c * 1.8;
        const cz = -1.8 + r * 0.9;
        solid.boxB(cx, F, cz, 1.78, 0.035, 0.88, c === r % 2 ? igusa : '#c0ca87');
        for (const dz of [-0.435, 0.435]) solid.boxB(cx, F + 0.035, cz + dz, 1.78, 0.006, 0.03, heri);
      }
    }
    k.pickProp('tatami', 1.0, F + 0.07, -1.3, 0.65);

    // ---- the shoji: glowing paper in a lattice (right wall), with a low sill ----
    const sx = k.x1;
    const a = (SHOJI_HOLE.a0 + SHOJI_HOLE.a1) / 2;
    const w = SHOJI_HOLE.a1 - SHOJI_HOLE.a0;
    k.quad(sx + 0.3, (SHOJI_HOLE.y0 + SHOJI_HOLE.y1) / 2, a, w, SHOJI_HOLE.y1 - SHOJI_HOLE.y0, -Math.PI / 2, '#fff7dc', glow);
    const hh = SHOJI_HOLE.y1 - SHOJI_HOLE.y0;
    for (let i = 0; i <= 8; i++) solid.boxB(sx - 0.03, SHOJI_HOLE.y0, SHOJI_HOLE.a0 + (i * w) / 8, 0.04, hh, 0.035, dark);
    for (let j = 0; j <= 5; j++) solid.boxB(sx - 0.03, SHOJI_HOLE.y0 + (j * (hh - 0.035)) / 5, a, 0.04, 0.035, w, dark);
    solid.boxB(sx - 0.06, SHOJI_HOLE.y0 - 0.04, a, 0.12, 0.05, w + 0.1, '#5a4030');
    k.pickProp('shoji', sx - 0.1, 1.35, a, 0.85);

    // ---- the fusuma to the next room (back wall, right): two cream sliding panels with a soft pattern ----
    for (const [x, tone] of [[0.65, '#efe3c6'], [1.25, '#e9dcbc']] as const) {
      k.onWall('back', x, 1.15, 0.6, 1.9, tone, 0.012);
      solid.boxB(x, 0.5, k.z0 + 0.025, 0.07, 0.07, 0.03, '#2b2b36');
      for (let i = 0; i < 3; i++) k.onWall('back', x + (i - 1) * 0.15, 0.6 + i * 0.45, 0.18, 0.04, '#cdb98f', 0.02);
    }
    solid.boxB(0.95, F, k.z0 + 0.025, 1.34, 0.04, 0.05, dark);
    solid.boxB(0.95, 2.02, k.z0 + 0.025, 1.34, 0.05, 0.05, dark);

    // ---- the tokonoma: a raised platform, two posts, the scroll and a vase of flowers (hana) ----
    const tc = (TOKO.x0 + TOKO.x1) / 2;
    solid.boxB(tc, F, -2.0, 1.3, 0.1, 0.5, '#7d5238');
    for (const x of [TOKO.x0 + 0.04, TOKO.x1 - 0.04]) solid.cyl(x, F, TOKO.z1 - 0.03, 0.04, 0.04, 2.1, '#4a3426', { seg: 6 });
    solid.boxB(tc, 2.0, TOKO.z1 - 0.03, 1.3, 0.08, 0.08, '#4a3426');
    k.onWall('back', tc - 0.1, 1.2, 0.5, 1.3, '#f4ecd4', 0.012);
    k.onWall('back', tc - 0.1, 1.28, 0.1, 0.8, '#2b2b36', 0.02);
    k.onWall('back', tc + 0.0, 0.95, 0.18, 0.1, '#2b2b36', 0.02);
    solid.boxB(tc - 0.1, 1.9, k.z0 + 0.02, 0.56, 0.05, 0.03, '#7d5238');
    const vx = tc + 0.38;
    solid.cyl(vx, F + 0.1, -2.05, 0.07, 0.09, 0.2, '#4f86a8', { seg: 8 });
    solid.cyl(vx, F + 0.3, -2.05, 0.02, 0.02, 0.35, '#5f9a55', { seg: 4 });
    solid.cyl(vx - 0.07, F + 0.3, -2.05, 0.015, 0.015, 0.25, '#5f9a55', { seg: 4, rz: 0.4 });
    for (const [dx, dy, c] of [[0, 0.68, '#ff6b8b'], [-0.14, 0.58, '#ffd166'], [0.1, 0.5, '#ffffff'], [-0.05, 0.5, '#f4a3bb']] as const) {
      solid.sphere(vx + dx, F + dy, -2.05, 0.07, c, { ws: 6, hs: 4 });
    }
    k.pickProp('hana', vx - 0.03, F + 0.55, -2.05, 0.4);

    // ---- the kotatsu: a quilted skirt, the wooden top, tea things on a tray; zabuton round it ----
    const kz = (KOTATSU.z0 + KOTATSU.z1) / 2;
    const kx = (KOTATSU.x0 + KOTATSU.x1) / 2;
    solid.boxB(kx, F + 0.04, kz, 1.3, 0.3, 1.3, '#b8566a');
    solid.boxB(kx, F + 0.04, kz, 1.34, 0.05, 1.34, '#8a3b4d');
    solid.boxB(kx, F + 0.34, kz, 1.0, 0.04, 1.0, '#c18b5a');
    solid.boxB(kx, F + 0.38, kz, 0.5, 0.012, 0.34, '#4a3426'); // tray
    k.pickProp('kotatsu', kx - 0.4, F + 0.36, kz + 0.35, 0.55);
    // the teapot (kyusu): a round body, a side handle, a spout, and two cups
    const px = kx + 0.1;
    const py = F + 0.4;
    solid.sphere(px, py + 0.07, kz, 0.085, '#3d5a6c', { sy: 0.85, ws: 8, hs: 6 });
    solid.cyl(px, py + 0.14, kz, 0.02, 0.03, 0.04, '#3d5a6c', { seg: 6 });
    solid.cyl(px - 0.1, py + 0.07, kz, 0.015, 0.025, 0.1, '#3d5a6c', { seg: 5, rz: 1.0 });
    solid.torus(px + 0.1, py + 0.07, kz, 0.04, 0.012, '#3d5a6c', { rx: 0 });
    for (const dx of [-0.16, 0.2]) solid.cyl(kx + dx, py, kz + 0.1, 0.035, 0.028, 0.045, '#f4f1e6', { seg: 8 });
    k.pickProp('kyusu', px, py + 0.1, kz, 0.28);
    for (const [zx, zz, c] of [[-0.9, -0.75, '#7a4a8a'], [1.38, -0.75, '#5f9a55'], [0.2, -1.88, '#c0392b']] as const) {
      solid.boxB(zx, F + 0.035, zz, 0.55, 0.07, 0.55, c);
      solid.boxB(zx, F + 0.1, zz, 0.18, 0.012, 0.18, '#f6e2a8');
    }
    k.pickProp('zabuton', -0.9, F + 0.15, -0.75, 0.36);

    // ---- an andon floor lamp by the shoji, and a low tea chest on the left wall ----
    solid.boxB(1.6, F, 0.3, 0.3, 0.08, 0.3, dark);
    glow.boxB(1.6, F + 0.08, 0.3, 0.26, 0.5, 0.26, '#ffe2a0');
    solid.boxB(1.6, F + 0.58, 0.3, 0.32, 0.03, 0.32, dark);
    solid.boxB(-1.6, F, -0.2, 0.4, 0.55, 1.1, '#8a6a4a');
    for (const z of [-0.5, -0.2, 0.1]) solid.boxB(-1.395, F + 0.1, z, 0.012, 0.36, 0.26, '#6f5236');

    // ---- the genkan: Aiko's sandals on the stone ----
    k.shoePair(1.15, 1.85, '#7a4a3a', 1, 1.2);
    k.shoePair(1.45, 1.7, '#e8c547', 0.8, 1.4);
    return k.finish();
  },
};
