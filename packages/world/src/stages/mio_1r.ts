// Mio's 1R apartment (5.2 x 3.8 m, §8.8): a kitchenette, a desk under the window onto a cherry tree, a folded futon,
// a poster wall and a bookshelf; the genkan runs along the front with the door in the right wall. Props the learner can
// tap (word cards): kutsu, tsukue, kamera, poster, hondana, mado.
import { rng } from '../batch';
import type { Rect } from '../layout';
import type { Stage, StageBuildCtx } from '../stage';
import { RoomKit, STEP, stageShell, WALL_H, type RoomSpec } from './room';

const F = STEP;

const SPEC: RoomSpec = {
  id: 'mio_1r',
  w: 5.2,
  d: 3.8,
  genkanDepth: 1.1,
  doorSide: 1,
  look: { wall: '#fbf0e2', wainscot: '#f0c8cf', trim: '#caa07a', floor: '#d6ac7e', genkan: '#aeb3c0', beam: '#7a5238', slab: '#8d7b6b', door: '#b98757', sky: '#cfeaf7', mat: '#4f86a8' },
  lights: { hemiSky: '#fff1dc', hemiGround: '#e2b99c', hemi: 2.4, warm: '#ffcf8f', point: 16, pointAt: [0.2, 2.1, 0.2], backdrop: '#e9d3d6' },
};

const plan = new RoomKit(SPEC);
const rect = (cx: number, cz: number, w: number, d: number): Rect => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });

/** footprints (also the colliders): the desk and its chair, the fridge and counter on the right wall, the bookshelf and futon on the left, the genkan shoe cabinet */
const DESK = rect(1.0, -1.55, 1.6, 0.7);
const CHAIR = rect(1.0, -0.95, 0.5, 0.6); // pulled up to the desk: its collider touches the desk's
const FRIDGE = rect(2.2, -1.6, 0.8, 0.6);
const COUNTER = rect(2.3, -0.6, 0.6, 1.6); // the drawn counter starts at z -1.3: the collider runs under the fridge's, so no slit is left between them
const SHELF = rect(-2.44, -1.2, 0.32, 1.4);
const FUTON = rect(-2.15, 0.2, 0.9, 1.5); // the pile is 0.9 long; the collider runs from the bookshelf to the shoe cabinet so no 0.3 m slit is left
const CABINET = rect(-2.44, 1.35, 0.32, 0.8);
const WINDOW = { a0: 0.2, a1: 1.8, y0: 0.95, y1: 2.05 };

export const MIO_1R: Stage = {
  id: 'mio_1r',
  ...stageShell(plan),
  colliders: [DESK, CHAIR, FRIDGE, COUNTER, SHELF, FUTON, CABINET],
  camera: { dist: 4.4, minDist: 3.2, maxDist: 7.4, pitch: 0.62, minPitch: 0.35, maxPitch: 1.1 },
  returnDoor: 'door:mio',
  actors: [{ id: 'mio', x: -0.35, z: -0.5, heading: 0, radius: 2.5, talk: { x: 0.25, z: 0.6 } }],
  build(ctx: StageBuildCtx) {
    const k = new RoomKit(SPEC, ctx);
    const { solid, glow } = k;
    const rnd = rng(0x4d10);
    const ink = '#2b2b36';

    k.floors();
    k.wall('back', [WINDOW]);
    k.wall('left');
    k.wall('right');
    k.door();
    k.genkan();

    // ---- the window onto the cherry tree: frame, sill, a glowing sky behind, the tree between ----
    const wx = (WINDOW.a0 + WINDOW.a1) / 2;
    const wy = (WINDOW.y0 + WINDOW.y1) / 2;
    const ww = WINDOW.a1 - WINDOW.a0;
    const wh = WINDOW.y1 - WINDOW.y0;
    const T = SPEC.look.trim;
    solid.boxB(wx, WINDOW.y1, k.z0 + 0.06, ww + 0.2, 0.08, 0.14, T);
    solid.boxB(wx, WINDOW.y0 - 0.06, k.z0 + 0.1, ww + 0.24, 0.06, 0.22, T);
    for (const x of [WINDOW.a0 - 0.04, WINDOW.a1 + 0.04]) solid.boxB(x, WINDOW.y0, k.z0 + 0.06, 0.08, wh, 0.14, T);
    solid.boxB(wx, WINDOW.y0, k.z0 + 0.04, 0.05, wh, 0.06, T); // the muntin
    k.quad(wx, 1.35, k.z0 - 0.75, 2.6, 2.1, 0, SPEC.look.sky, glow);
    const tz = k.z0 - 0.45;
    solid.cyl(1.35, -1, tz, 0.09, 0.15, 2.9, '#6a4a3a', { seg: 7 });
    solid.cyl(0.9, 1.35, tz, 0.04, 0.06, 0.9, '#6a4a3a', { seg: 5, rz: 0.9 });
    for (const [bx, by, bz, r, c] of [[0.5, 1.55, tz, 0.5, '#f4a3bb'], [1.2, 1.95, tz + 0.05, 0.62, '#f7b6cc'], [1.75, 1.5, tz, 0.5, '#f4a3bb'], [0.95, 1.2, tz + 0.1, 0.4, '#fbd0dc'], [1.55, 2.3, tz, 0.42, '#f7b6cc']] as const) {
      solid.sphere(bx, by, bz, r, c, { sy: 0.85, ws: 7, hs: 5 });
    }
    k.pickProp('mado', wx, wy, k.z0 + 0.12, 0.85);

    // ---- string lights along the top of the back wall ----
    for (let i = 0; i < 13; i++) {
      const x = -2.4 + i * 0.4;
      glow.sphere(x, WALL_H - 0.18 - 0.1 * Math.sin((i / 12) * Math.PI), k.z0 + 0.12, 0.035, i % 3 === 0 ? '#ffb8cf' : '#ffe2a0', { ws: 5, hs: 3 });
    }

    // ---- poster wall: four posters at different heights, the big one is the pick ----
    const poster = (a: number, cy: number, w: number, h: number, base: string, inset: string, accent: string) => {
      k.onWall('back', a, cy, w, h, base, 0.012);
      k.onWall('back', a, cy - h * 0.08, w * 0.82, h * 0.7, inset, 0.02);
      k.onWall('back', a + w * 0.12, cy + h * 0.28, w * 0.34, h * 0.16, accent, 0.03);
    };
    poster(-2.0, 1.55, 0.6, 0.85, '#fff6e6', '#e8789e', '#fff6e6');
    poster(-1.3, 1.45, 0.55, 0.78, '#fff6e6', '#2aa198', '#f4c64a');
    poster(-0.72, 1.62, 0.42, 0.6, '#ffffff', '#4f86f7', '#ffd166');
    poster(-1.65, 0.9 + 0.08, 0.7, 0.34, '#2b2b36', '#f4c64a', '#d8433f');
    k.pickProp('poster', -1.3, 1.45, k.z0 + 0.1, 0.7);

    // ---- desk under the window: top, legs, a chair, the camera, a laptop and a lamp ----
    const desk = DESK;
    solid.boxB((desk.x0 + desk.x1) / 2, F + 0.69, (desk.z0 + desk.z1) / 2, 1.6, 0.05, 0.7, '#a97b52');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.boxB((desk.x0 + desk.x1) / 2 + sx * 0.74, F, (desk.z0 + desk.z1) / 2 + sz * 0.29, 0.06, 0.69, 0.06, '#7d5238');
    solid.boxB(1.0, F + 0.4, -1.78, 1.5, 0.3, 0.03, '#8e6540'); // modesty panel
    // chair
    solid.cyl(1.0, F + 0.42, -0.9, 0.22, 0.22, 0.05, '#e8789e', { seg: 9 });
    solid.cyl(1.0, F, -0.9, 0.04, 0.04, 0.42, '#6d6f7a', { seg: 5 });
    solid.cyl(1.0, F, -0.9, 0.2, 0.2, 0.03, '#6d6f7a', { seg: 7 });
    solid.boxB(1.0, F + 0.47, -0.69, 0.4, 0.4, 0.05, '#e8789e');
    // the camera (kamera): body, silver top, lens, flash
    const cx = 0.55;
    const cz = -1.62;
    const dy = F + 0.74;
    solid.boxB(cx, dy, cz, 0.22, 0.12, 0.09, ink);
    solid.boxB(cx, dy + 0.12, cz, 0.22, 0.03, 0.09, '#c9ccd4');
    solid.cyl(cx + 0.02, dy + 0.01, cz + 0.07, 0.045, 0.05, 0.08, '#15151b', { seg: 9, rx: Math.PI / 2 });
    glow.sphere(cx + 0.02, dy + 0.065, cz + 0.115, 0.022, '#9fd0e6', { ws: 5, hs: 3 });
    solid.boxB(cx - 0.07, dy + 0.15, cz, 0.05, 0.03, 0.05, '#e5453d');
    k.pickProp('kamera', cx, dy + 0.08, cz + 0.02, 0.24);
    k.pickProp('tsukue', 1.45, dy + 0.02, -1.5, 0.4);
    // laptop and desk lamp
    solid.boxB(1.2, dy, -1.5, 0.34, 0.015, 0.24, '#b8bcc8');
    solid.boxB(1.2, dy, -1.64, 0.34, 0.22, 0.015, '#9aa0ae', { rx: -0.25 });
    glow.boxB(1.2, dy + 0.02, -1.628, 0.3, 0.17, 0.005, '#bfe7ff', { rx: -0.25 });
    solid.cyl(1.68, dy, -1.75, 0.05, 0.06, 0.03, '#2b2b36', { seg: 6 });
    solid.cyl(1.68, dy + 0.03, -1.75, 0.012, 0.012, 0.28, '#2b2b36', { seg: 4 });
    glow.cone(1.68, dy + 0.3, -1.7, 0.1, 0.12, '#ffe2a0', { seg: 7, rx: 0.5 });

    // ---- kitchenette on the right wall: fridge, counter with sink and hob, a kettle ----
    solid.boxB((FRIDGE.x0 + FRIDGE.x1) / 2, F, (FRIDGE.z0 + FRIDGE.z1) / 2, FRIDGE.x1 - FRIDGE.x0, 1.12, 0.6, '#eef0f2');
    solid.boxB(FRIDGE.x0 - 0.002, F + 0.72, (FRIDGE.z0 + FRIDGE.z1) / 2, 0.02, 0.01, 0.58, '#9aa3ad');
    solid.boxB(FRIDGE.x0 - 0.01, F + 0.8, FRIDGE.z0 + 0.1, 0.03, 0.2, 0.03, '#9aa3ad');
    solid.boxB(COUNTER.x0 + 0.3, F, (COUNTER.z0 + COUNTER.z1) / 2, 0.6, 0.82, 1.5, '#f3ead7');
    solid.boxB(COUNTER.x0 + 0.3, F + 0.82, (COUNTER.z0 + COUNTER.z1) / 2, 0.62, 0.04, 1.52, '#c9ced6');
    for (const zz of [-1.0, -0.55, -0.1]) solid.boxB(COUNTER.x0 - 0.004, F + 0.1, zz, 0.012, 0.62, 0.38, '#e3d6bc');
    solid.boxB(COUNTER.x0 + 0.3, F + 0.84, -0.95, 0.4, 0.015, 0.36, '#7f8892'); // sink
    solid.cyl(COUNTER.x0 + 0.46, F + 0.86, -0.95, 0.015, 0.015, 0.22, '#9aa3ad', { seg: 5 });
    for (const zz of [-0.35, 0.05]) solid.disc(COUNTER.x0 + 0.3, F + 0.865, zz, 0.11, '#2b2b36', { seg: 10 });
    solid.cyl(COUNTER.x0 + 0.3, F + 0.865, -0.35, 0.09, 0.11, 0.13, '#e8789e', { seg: 9 }); // kettle
    solid.sphere(COUNTER.x0 + 0.3, F + 1.0, -0.35, 0.03, '#2b2b36', { ws: 5, hs: 3 });
    solid.boxB(COUNTER.x0 + 0.1, F + 1.45, -0.55, 0.2, 0.05, 1.3, '#d9b48a'); // shelf of jars above
    for (let i = 0; i < 4; i++) solid.cyl(COUNTER.x0 + 0.1, F + 1.5, -1.0 + i * 0.3, 0.06, 0.06, 0.14, ['#f4c64a', '#e8789e', '#a8d08d', '#ffffff'][i], { seg: 7 });

    // ---- bookshelf on the left wall ----
    const sh = SHELF;
    const sz = (sh.z0 + sh.z1) / 2;
    solid.boxB(-2.6 + 0.02, F, sz, 0.04, 1.75, 1.4, '#8e6540'); // back
    for (const z of [sh.z0 + 0.02, sh.z1 - 0.02]) solid.boxB(-2.44, F, z, 0.32, 1.75, 0.04, '#a97b52');
    const cols = ['#e5453d', '#4f86f7', '#f4c64a', '#2aa198', '#e8789e', '#7d5238', '#ffffff', '#8aa6c9'];
    for (let r = 0; r < 4; r++) {
      const y = F + r * 0.42;
      solid.boxB(-2.44, y, sz, 0.32, 0.03, 1.36, '#a97b52');
      let z = sh.z0 + 0.08;
      while (z < sh.z1 - 0.12) {
        const bw = 0.04 + rnd() * 0.04;
        const bh = 0.22 + rnd() * 0.12;
        solid.boxB(-2.46, y + 0.03, z + bw / 2, 0.2, bh, bw, cols[Math.floor(rnd() * cols.length)]);
        z += bw + 0.005;
      }
    }
    solid.boxB(-2.44, F + 1.75, sz, 0.34, 0.04, 1.44, '#a97b52');
    k.pickProp('hondana', -2.34, F + 1.0, sz, 0.7);

    // ---- the folded futon: three layers, the top one folded over ----
    solid.boxB(-2.18, F, 0.2, 0.84, 0.22, 0.86, '#bcd3ee');
    solid.boxB(-2.16, F + 0.22, 0.2, 0.8, 0.2, 0.82, '#fff6e6');
    solid.boxB(-2.2, F + 0.42, 0.2, 0.74, 0.12, 0.78, '#f2a9bd');
    solid.cyl(-2.4, F + 0.3, 0.2, 0.1, 0.1, 0.04, '#ffffff', { seg: 6 }); // a pillow
    solid.boxB(-2.02, F + 0.54, 0.2, 0.36, 0.1, 0.56, '#ffffff');

    // ---- the genkan: the shoe cabinet with Mio's shoes (kutsu) ----
    solid.boxB(-2.44, 0, 1.35, 0.32, 0.9, 0.8, '#b98757');
    solid.boxB(-2.27, 0.1, 1.35, 0.01, 0.6, 0.7, '#a97b52');
    solid.boxB(-2.27, 0.45, 1.35, 0.012, 0.01, 0.72, '#7d5238');
    for (const dz of [-0.14, 0.14]) {
      solid.boxB(-2.46, 0.9, 1.35 + dz, 0.2, 0.07, 0.085, '#f4f4f4');
      solid.boxB(-2.5, 0.97, 1.35 + dz, 0.12, 0.03, 0.08, '#e8789e');
    }
    k.shoePair(-1.6, 1.62, '#e8789e', 1, 0.25);
    k.pickProp('kutsu', -2.4, 0.98, 1.35, 0.42);

    // ---- rug, cushions and a floor lamp ----
    solid.disc(-0.2, F + 0.012, 0.1, 0.95, '#e7a3b8', { seg: 20 });
    solid.disc(-0.2, F + 0.02, 0.1, 0.62, '#f3c6d3', { seg: 20 });
    solid.disc(-0.2, F + 0.028, 0.1, 0.28, '#fbe3e8', { seg: 14 });
    solid.boxB(-0.9, F, 0.45, 0.5, 0.08, 0.5, '#8aa6c9', { ry: 0.3 });
    solid.boxB(0.3, F, 0.55, 0.5, 0.08, 0.5, '#f4c64a', { ry: -0.2 });

    return k.finish();
  },
};
