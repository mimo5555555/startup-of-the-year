// Kenji's family flat above the ramen shop (5.2 x 4.4 m, §8.8): a chabudai with zabuton, a kitchen corner with the rice
// cooker, family photos on a sideboard, a baseball poster, a child's drawing at Hina's height, a window with curtains.
// Kenji and his daughter Hina (a small avatar) are in the room. The genkan runs along the front, the door is in the right
// wall. Props the learner can tap: chabudai, suihanki, shashin, yakyu, e, zabuton.
import type { Rect } from '../layout';
import type { Stage, StageBuildCtx } from '../stage';
import { RoomKit, STEP, stageShell, type RoomSpec } from './room';

const F = STEP;

const SPEC: RoomSpec = {
  id: 'kenji_flat',
  w: 5.2,
  d: 4.4,
  genkanDepth: 1.1,
  doorSide: 1,
  look: { wall: '#f5e6c8', wainscot: '#cfae86', trim: '#8a5a3a', floor: '#cfa273', genkan: '#a7a29a', beam: '#6a432c', slab: '#7d6650', door: '#a8744a', sky: '#d6ecf5', mat: '#9a5a4a' },
  lights: { hemiSky: '#fff0d6', hemiGround: '#dcb08c', hemi: 2.4, warm: '#ffbf75', point: 16, pointAt: [-0.1, 2.1, -0.2], backdrop: '#ead6c0' },
};

const plan = new RoomKit(SPEC);
const rect = (cx: number, cz: number, w: number, d: number): Rect => ({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 });

const TABLE = rect(-0.1, -0.15, 1.2, 1.2);
const COUNTER = rect(1.15, -1.9, 1.7, 0.6);
const FRIDGE = rect(2.3, -1.85, 0.6, 0.7);
const SIDEBOARD = rect(-1.75, -2.0, 1.7, 0.4);
const CABINET = rect(-2.44, 1.65, 0.32, 0.8);

export const KENJI_FLAT: Stage = {
  id: 'kenji_flat',
  ...stageShell(plan),
  colliders: [TABLE, COUNTER, FRIDGE, SIDEBOARD, CABINET],
  camera: { dist: 4.4, minDist: 3.2, maxDist: 7.6, pitch: 0.62, minPitch: 0.35, maxPitch: 1.1 },
  returnDoor: 'door:kenji',
  actors: [
    { id: 'kenji', x: 1.3, z: -0.75, heading: -0.2, radius: 2.5, talk: { x: 1.3, z: 0.6 } },
    { id: 'hina', x: -1.1, z: 0.55, heading: 0.4, radius: 1.4, talk: { x: -0.2, z: 1.0 } },
  ],
  build(ctx: StageBuildCtx) {
    const k = new RoomKit(SPEC, ctx);
    const { solid, glow } = k;
    const ink = '#2b2b36';
    const wood = '#a97b52';

    k.floors();
    k.wall('back');
    k.wall('left');
    k.wall('right');
    k.door();
    k.genkan();

    // ---- the chabudai: a round folding table, four short legs, dinner on top, a rug under it ----
    const tx = -0.1;
    const tz = -0.15;
    solid.disc(tx, F + 0.012, tz, 1.15, '#d9b48a', { seg: 22 });
    solid.disc(tx, F + 0.02, tz, 0.95, '#c98f6a', { seg: 22 });
    solid.cyl(tx, F, tz, 0.62, 0.62, 0.05, wood, { seg: 18, rx: 0 });
    solid.cyl(tx, F + 0.3, tz, 0.64, 0.64, 0.05, '#c18b5a', { seg: 18 });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      solid.cyl(tx + Math.cos(a) * 0.42, F, tz + Math.sin(a) * 0.42, 0.035, 0.035, 0.3, '#7d5238', { seg: 5 });
    }
    k.pickProp('chabudai', tx + 0.35, F + 0.4, tz + 0.2, 0.5);
    // bowls, a plate of gyoza and chopsticks
    for (const [dx, dz, c] of [[-0.3, -0.15, '#f4f1ea'], [0.1, 0.3, '#2b2b36'], [0.3, -0.2, '#f4f1ea']] as const) {
      solid.cyl(tx + dx, F + 0.35, tz + dz, 0.09, 0.055, 0.07, c, { seg: 10 });
      solid.cyl(tx + dx, F + 0.415, tz + dz, 0.08, 0.08, 0.01, c === '#2b2b36' ? '#d8433f' : '#f2c14e', { seg: 10 });
    }
    solid.cyl(tx - 0.05, F + 0.35, tz + 0.05, 0.13, 0.13, 0.02, '#8aa6c9', { seg: 10 });
    for (let i = 0; i < 4; i++) solid.sphere(tx - 0.1 + i * 0.05, F + 0.385, tz + 0.05, 0.025, '#e8c898', { sy: 0.7, ws: 5, hs: 3 });
    solid.boxB(tx + 0.05, F + 0.35, tz + 0.5, 0.2, 0.01, 0.012, '#7d5238');
    // zabuton: left, front and back (right side is open for Kenji)
    for (const [zx, zz, c] of [[-1.2, -0.15, '#c0392b'], [-0.1, 0.65, '#2f5d8a'], [-0.1, -1.18, '#5f9a55']] as const) {
      solid.boxB(zx, F, zz, 0.55, 0.07, 0.55, c);
      solid.boxB(zx, F + 0.07, zz, 0.18, 0.012, 0.18, '#f6e2a8');
    }
    k.pickProp('zabuton', -1.2, F + 0.12, -0.15, 0.36);

    // ---- the kitchen corner: counter, sink and hob, the rice cooker (suihanki), a hanging cabinet, the fridge ----
    const c = COUNTER;
    solid.boxB((c.x0 + c.x1) / 2, F, (c.z0 + c.z1) / 2, 1.7, 0.84, 0.6, '#efe4cd');
    solid.boxB((c.x0 + c.x1) / 2, F + 0.84, (c.z0 + c.z1) / 2, 1.72, 0.04, 0.62, '#c9ced6');
    for (const x of [0.65, 1.15, 1.65]) solid.boxB(x, F + 0.1, c.z1 + 0.004, 0.44, 0.62, 0.012, '#dccaa3');
    solid.boxB(0.65, F + 0.86, -1.9, 0.5, 0.012, 0.4, '#7f8892'); // sink
    solid.cyl(0.65, F + 0.88, -2.08, 0.015, 0.015, 0.2, '#9aa3ad', { seg: 5 });
    solid.disc(1.7, F + 0.88, -1.9, 0.11, ink, { seg: 10 });
    solid.cyl(1.7, F + 0.88, -1.9, 0.1, 0.12, 0.12, '#bfc4cd', { seg: 9 }); // a pot
    // the rice cooker: white body, a rounded lid, a red switch and a little display
    const rx = 1.18;
    const ry = F + 0.88;
    const rz = -1.95;
    solid.cyl(rx, ry, rz, 0.17, 0.18, 0.22, '#f4f4f0', { seg: 12 });
    solid.sphere(rx, ry + 0.22, rz, 0.17, '#e8ebef', { sy: 0.45, ws: 10, hs: 5 });
    solid.cyl(rx, ry + 0.3, rz, 0.04, 0.04, 0.025, '#9aa3ad', { seg: 6 });
    solid.boxB(rx, ry + 0.07, rz + 0.18, 0.12, 0.05, 0.02, ink);
    glow.boxB(rx + 0.03, ry + 0.085, rz + 0.192, 0.05, 0.02, 0.004, '#9be7a8');
    solid.boxB(rx - 0.03, ry + 0.07, rz + 0.19, 0.03, 0.03, 0.015, '#d8433f');
    k.pickProp('suihanki', rx, ry + 0.2, rz + 0.05, 0.3);
    solid.boxB(1.15, F + 1.55, -2.04, 1.7, 0.55, 0.32, '#c9a77c'); // hanging cabinet
    for (const x of [0.73, 1.57]) solid.boxB(x, F + 1.6, -1.875, 0.4, 0.45, 0.012, '#b98757');
    solid.boxB(FRIDGE.x0 + 0.3, F, (FRIDGE.z0 + FRIDGE.z1) / 2, 0.6, 1.5, 0.7, '#eef0f2');
    solid.boxB(FRIDGE.x0 - 0.002, F + 0.95, (FRIDGE.z0 + FRIDGE.z1) / 2, 0.012, 0.012, 0.68, '#9aa3ad');
    solid.boxB(FRIDGE.x0 - 0.01, F + 1.05, FRIDGE.z0 + 0.12, 0.03, 0.25, 0.03, '#9aa3ad');
    // magnets on the fridge: Hina's
    for (const [dz, dy, col] of [[0.2, 1.25, '#e5453d'], [0.4, 1.12, '#f4c64a'], [0.3, 1.38, '#4f86f7']] as const) solid.sphere(FRIDGE.x0 - 0.014, F + dy, FRIDGE.z0 + dz, 0.025, col, { ws: 5, hs: 3 });
    // a wall clock above the cabinet line
    solid.cyl(0.0, 1.9, k.z0 + 0.02, 0.17, 0.17, 0.03, '#fff8ef', { seg: 14, rx: Math.PI / 2 });
    solid.boxB(0.0, 1.9, k.z0 + 0.04, 0.012, 0.11, 0.01, ink);
    solid.boxB(0.04, 1.9, k.z0 + 0.04, 0.08, 0.012, 0.01, ink);

    // ---- family photos (shashin) on the wall over a sideboard ----
    const sb = SIDEBOARD;
    solid.boxB((sb.x0 + sb.x1) / 2, F, (sb.z0 + sb.z1) / 2, 1.7, 0.72, 0.4, '#a97b52');
    for (const x of [-2.1, -1.6, -1.1]) solid.boxB(x, F + 0.08, sb.z1 + 0.004, 0.46, 0.56, 0.012, '#8e6540');
    const frames: Array<[number, number, number, number, string, string]> = [
      [-2.0, 1.55, 0.42, 0.52, '#8aa6c9', '#f3c6a8'],
      [-1.5, 1.42, 0.5, 0.38, '#a8d08d', '#f6e2a8'],
      [-1.0, 1.6, 0.36, 0.48, '#f2a9bd', '#9fd0e6'],
      [-0.6, 1.4, 0.3, 0.38, '#ffd166', '#c9a77c'],
    ];
    for (const [x, y, w, h, a, b] of frames) {
      k.onWall('back', x, y, w + 0.07, h + 0.07, '#5a4030', 0.012);
      k.onWall('back', x, y, w, h, a, 0.02);
      k.onWall('back', x, y - h * 0.15, w * 0.45, h * 0.4, b, 0.028);
      k.onWall('back', x, y + h * 0.18, w * 0.2, h * 0.2, '#f3c6a8', 0.03);
    }
    // a standing frame on the sideboard
    solid.boxB(-1.0, F + 0.72, -1.92, 0.2, 0.16, 0.02, '#5a4030', { rx: -0.2 });
    solid.boxB(-1.0, F + 0.74, -1.905, 0.15, 0.11, 0.01, '#f6e2a8', { rx: -0.2 });
    k.pickProp('shashin', -1.3, 1.5, k.z0 + 0.1, 0.8);

    // ---- the baseball poster (yakyu): a green field, a diamond, a bat and a ball ----
    k.onWall('left', -1.0, 1.45, 1.0, 0.75, '#e8d9b0', 0.012);
    k.onWall('left', -1.0, 1.42, 0.9, 0.62, '#4f9a55', 0.02);
    k.onWall('left', -1.0, 1.38, 0.34, 0.34, '#d9b48a', 0.028);
    solid.box(k.x0 + 0.04, 1.38, -1.0, 0.012, 0.3, 0.3, '#d9b48a', { rx: Math.PI / 4 });
    k.onWall('left', -1.0, 1.38, 0.1, 0.1, '#ffffff', 0.036);
    k.onWall('left', -0.7, 1.58, 0.1, 0.28, '#7d5238', 0.03);
    solid.sphere(k.x0 + 0.05, 1.62, -1.3, 0.05, '#ffffff', { ws: 6, hs: 4 });
    k.onWall('left', -1.0, 1.82, 0.7, 0.1, '#d8433f', 0.03);
    k.pickProp('yakyu', k.x0 + 0.1, 1.45, -1.0, 0.6);

    // ---- Hina's drawing (e) taped low on the left wall: a house, a sun, a tree ----
    k.onWall('left', 0.25, 0.95, 0.55, 0.42, '#fffdf2', 0.012);
    k.onWall('left', 0.25, 0.9, 0.2, 0.14, '#e5453d', 0.02);
    k.onWall('left', 0.25, 1.02, 0.16, 0.1, '#8a5a3a', 0.02);
    k.onWall('left', 0.4, 1.1, 0.1, 0.1, '#f4c64a', 0.02);
    k.onWall('left', 0.08, 0.9, 0.07, 0.2, '#2e9e5b', 0.02);
    k.pickProp('e', k.x0 + 0.1, 0.95, 0.25, 0.32);

    // ---- a window on the right wall: a glowing pane, frame and curtains ----
    const wz = -0.65;
    k.onWall('right', wz, 1.45, 1.3, 1.0, '#e9f5fb', 0.014, glow);
    solid.boxB(k.x1 - 0.04, 0.88, wz, 0.08, 0.06, 1.5, '#8a5a3a');
    solid.boxB(k.x1 - 0.04, 1.95, wz, 0.08, 0.06, 1.5, '#8a5a3a');
    for (const dz of [-0.7, 0, 0.7]) solid.boxB(k.x1 - 0.04, 0.9, wz + dz, 0.07, 1.07, 0.05, '#8a5a3a');
    solid.boxB(k.x1 - 0.1, 0.95, wz - 0.62, 0.08, 1.1, 0.24, '#e8789e');
    solid.boxB(k.x1 - 0.1, 0.95, wz + 0.62, 0.08, 1.1, 0.24, '#e8789e');

    // ---- the genkan: a shoe cabinet with Kenji's boots, the rubber boots and Hina's small shoes ----
    const cb = CABINET;
    solid.boxB((cb.x0 + cb.x1) / 2, 0, (cb.z0 + cb.z1) / 2, 0.32, 0.9, 0.8, '#b98757');
    solid.boxB(cb.x1 + 0.002, 0.1, 1.65, 0.01, 0.6, 0.7, '#a97b52');
    k.shoePair(-1.9, 1.95, '#2b2b36', 1.2, 0.2);
    k.shoePair(-1.4, 1.55, '#e5453d', 0.6, -0.3);
    k.shoePair(-1.7, 1.4, '#5a4030', 1, 0.5);
    return k.finish();
  },
};
