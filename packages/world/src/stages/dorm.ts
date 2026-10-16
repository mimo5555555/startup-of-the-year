// The dorm (4.0 x 3.6 m, §8.8): the room the player starts in, Hanako-sensei's dormitory. A window onto the street above the
// desk, a cot, a plank for books, a bare corner for a plant; four furniture slots (bed, desk, shelf, plant) that the
// player's own furniture replaces (`StageBuildCtx.placed`). The genkan runs along the front with the door in the right wall.
// Nobody lives here but the player; a housewarming guest stands on a clear spot (`enterStage('dorm', { guest })`).
import type { Rect } from '../layout';
import type { Stage, StageBuildCtx, StageSlot } from '../stage';
import { dormCot, dormDesk, dormPlank, withFurniture } from './furniture';
import { RoomKit, STEP, stageShell, type RoomSpec } from './room';

const F = STEP;

const SPEC: RoomSpec = {
  id: 'dorm',
  w: 4.0,
  d: 3.6,
  genkanDepth: 0.9,
  doorSide: 1,
  look: { wall: '#f3e8d2', wainscot: '#9db8a6', trim: '#c9ae86', floor: '#cfa676', genkan: '#a9adb6', beam: '#7a5238', slab: '#8d7b6b', door: '#a8825a', sky: '#d6ecf7', mat: '#6b8f7b' },
  lights: { hemiSky: '#fff1dc', hemiGround: '#e2b99c', hemi: 2.4, warm: '#ffcf8f', point: 15, pointAt: [0, 2.1, -0.1], backdrop: '#e6dccb' },
};

const plan = new RoomKit(SPEC);
const rect = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });

/**
 * The four slots. They stand against the walls and touch each other (or the wall), so no slit narrower than a person is left:
 * the cot and the desk are the dorm's own and block the floor whether or not anything of the player's stands there.
 */
export const DORM_SLOTS: readonly StageSlot[] = [
  { name: 'bed', rect: rect(-2.0, -1.1, -1.8, 0.0), face: 'front', y0: F, basic: true },
  { name: 'shelf', rect: rect(-1.1, -0.2, -1.8, -1.5), face: 'front', y0: F },
  { name: 'desk', rect: rect(-0.2, 1.1, -1.8, -1.15), face: 'front', y0: F, basic: true },
  { name: 'plant', rect: rect(1.5, 2.0, 0.4, 0.9), face: 'front', y0: F },
];

/** the window above the desk (back wall, along-wall extent in x) */
const WINDOW = { a0: 0.2, a1: 1.04, y0: 0.98, y1: 1.98 };

export const DORM: Stage = {
  id: 'dorm',
  ...stageShell(plan),
  colliders: [],
  slots: DORM_SLOTS,
  camera: { dist: 4.9, minDist: 3.2, maxDist: 7.4, pitch: 0.64, minPitch: 0.35, maxPitch: 1.1 },
  returnDoor: 'door:dorm',
  actors: [],
  guest: { x: 0.45, z: -0.45, heading: 0, radius: 2.5, talk: { x: 0.6, z: 0.5 } },
  build(ctx: StageBuildCtx) {
    const k = new RoomKit(SPEC, ctx);
    const { solid, glow } = k;
    const L = SPEC.look;

    k.floors();
    k.wall('back', [WINDOW]);
    k.wall('left');
    k.wall('right');
    k.door();
    k.genkan();

    // ---- the window onto the street: frame, sill, a glowing sky and the roofs of Sakura-cho beyond ----
    const wx = (WINDOW.a0 + WINDOW.a1) / 2;
    const ww = WINDOW.a1 - WINDOW.a0;
    const wh = WINDOW.y1 - WINDOW.y0;
    const T = L.trim;
    solid.boxB(wx, WINDOW.y1, k.z0 + 0.06, ww + 0.2, 0.08, 0.14, T);
    solid.boxB(wx, WINDOW.y0 - 0.06, k.z0 + 0.1, ww + 0.24, 0.06, 0.22, T);
    for (const x of [WINDOW.a0 - 0.04, WINDOW.a1 + 0.04]) solid.boxB(x, WINDOW.y0, k.z0 + 0.06, 0.08, wh, 0.14, T);
    solid.boxB(wx, WINDOW.y0, k.z0 + 0.04, 0.05, wh, 0.06, T);
    k.quad(wx, 1.45, k.z0 - 0.75, 2.4, 2.1, 0, L.sky, glow);
    const bz = k.z0 - 0.5;
    for (const [bx, bw, bh, c] of [[wx - 0.5, 0.7, 0.9, '#c9d3e0'], [wx + 0.15, 0.6, 1.3, '#dcc7c0'], [wx + 0.65, 0.5, 0.7, '#cfd9c7']] as const) solid.boxB(bx, 0.5, bz, bw, bh, 0.2, c);
    glow.sphere(wx - 0.3, 1.85, bz - 0.1, 0.1, '#fff3c4', { ws: 6, hs: 4 });
    // curtains tied back at both sides, and a small cactus on the sill
    for (const s of [-1, 1]) {
      solid.boxB(wx + s * (ww / 2 + 0.16), WINDOW.y0 - 0.05, k.z0 + 0.1, 0.16, wh + 0.2, 0.06, '#e8b9a6');
      solid.boxB(wx + s * (ww / 2 + 0.16), WINDOW.y0 + wh * 0.4, k.z0 + 0.13, 0.17, 0.04, 0.05, '#c9856a');
    }
    solid.boxB(wx, WINDOW.y1 + 0.1, k.z0 + 0.1, ww + 0.62, 0.03, 0.04, '#7a5238');
    solid.cyl(wx + 0.28, WINDOW.y0 - 0.03, k.z0 + 0.12, 0.04, 0.035, 0.07, '#c46a45', { seg: 7 });
    solid.cyl(wx + 0.28, WINDOW.y0 + 0.04, k.z0 + 0.12, 0.025, 0.03, 0.09, '#4f9a55', { seg: 6 });

    // ---- the walls: a calendar and a notice board over the bed, a coat hook rail by the door ----
    k.onWall('left', -1.0, 1.55, 0.34, 0.46, '#fffdf4', 0.012);
    k.onWall('left', -1.0, 1.7, 0.34, 0.12, '#d8433f', 0.02);
    k.onWall('left', -1.0, 1.4, 0.26, 0.04, '#cdbfa0', 0.02);
    k.onWall('left', -0.2, 1.5, 0.6, 0.4, '#e6d2a6', 0.012);
    solid.boxB(k.x1 - 0.04, 1.65, 0.45, 0.06, 0.04, 0.9, '#7a5238');
    for (const z of [0.1, 0.45, 0.8]) solid.boxB(k.x1 - 0.08, 1.58, z, 0.06, 0.12, 0.03, '#c9b99a');
    glow.sphere(k.x0 + 0.5, 2.2, k.z0 + 0.1, 0.05, '#ffe2a0', { ws: 5, hs: 3 }); // a night light over the bed

    // ---- a rug by the cot, so the room reads as lived in ----
    solid.boxB(-0.2, F, -0.25, 1.4, 0.012, 1.0, '#c98a82');
    solid.boxB(-0.2, F + 0.012, -0.25, 1.2, 0.004, 0.8, '#e5b9a8');

    // ---- the genkan: the player's own sandals and the shoe rack ----
    k.shoePair(-1.0, 1.72, '#8a6a4a', 0.9, 0.3);
    solid.boxB(-1.45, 0, 1.45, 0.5, 0.18, 0.28, '#7a5238'); // a shoe rack at the far end of the stone, off the way to the door

    const base = k.finish();
    return withFurniture(base, ctx, {
      slots: DORM_SLOTS,
      basics: { bed: dormCot, desk: dormDesk, shelf: dormPlank },
    });
  },
};
