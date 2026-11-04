import * as THREE from 'three';
import { Batch } from '../batch';
import type { BuildCtx, ShopOpening } from '../buildctx';
import { FRONT_Z, shopRect, type ShopDef } from '../layout';
import type { BuildingBuilder } from './index';

/** Look of ほしぞらホビー (Hoshizora Hobby, "starry-sky hobby"): a night-sky shop, deep purple and navy, pink neon and gold stars. */
const LOOK = {
  openH: 3.7,
  band: 2.0,
  wall: '#2d2352',
  inner: '#3a2f68',
  pink: '#ff5d8f',
  gold: '#ffd166',
  navy: '#1b1638',
  roof: '#433a73',
  floor: '#4a3f7a',
  ceil: '#2a2350',
  glass: '#bfe8ff',
  shelf: '#f4f1ff',
  dark: '#211b3d',
  /** the cat ninjas' three colours (the shop's red, blue and white figures) */
  neko: ['#e5453d', '#3b6fe0', '#f7f7fb'],
  /** box art colours of the figure boxes on the side wall */
  boxes: ['#ff5d8f', '#7bdff2', '#ffd166', '#b28dff', '#06d6a0', '#ff9f43', '#f7f7fb'],
};

const FLOOR_Y = 0.12;
/** the staff floor behind the counter: the NPC `daichi` stands on it (NPC_SPAWNS.y 0.28) */
const STAFF = { z: FRONT_Z - 3.4, d: 2.2, w: 6, top: 0.28 };
const COUNTER = { z: FRONT_Z - 1.8, w: 5, d: 0.9 };

type Ink = Pick<Batch, 'box' | 'boxB' | 'cyl' | 'sphere' | 'cone'>;

/** A chibi cat ninja (the shop's own figure line): body, head, ears, the dark mask band and a scarf tail. `s` 1 = 0.42 m tall. */
function catNinja(b: Ink, x: number, y: number, z: number, s: number, colour: string): void {
  b.cyl(x, y, z, 0.07 * s, 0.09 * s, 0.17 * s, colour, { seg: 10 });
  b.sphere(x, y + 0.26 * s, z, 0.11 * s, colour, { ws: 12, hs: 10 });
  b.cone(x - 0.065 * s, y + 0.32 * s, z, 0.04 * s, 0.08 * s, colour, { seg: 6 });
  b.cone(x + 0.065 * s, y + 0.32 * s, z, 0.04 * s, 0.08 * s, colour, { seg: 6 });
  b.box(x, y + 0.27 * s, z + 0.005 * s, 0.235 * s, 0.045 * s, 0.215 * s, '#1b1638'); // the mask band
  b.box(x, y + 0.27 * s, z + 0.11 * s, 0.03 * s, 0.03 * s, 0.03 * s, '#f7f7fb'); // a glint of an eye
  b.box(x + 0.09 * s, y + 0.16 * s, z - 0.05 * s, 0.03 * s, 0.03 * s, 0.14 * s, '#ffd166', { ry: 0.6 }); // the scarf tail
}

/** A small chunky robot: body, head with an antenna, two arms. `s` 1 = 0.42 m tall. */
function robot(b: Ink, x: number, y: number, z: number, s: number, colour: string): void {
  b.boxB(x, y, z, 0.16 * s, 0.16 * s, 0.12 * s, colour);
  b.boxB(x, y + 0.17 * s, z, 0.13 * s, 0.11 * s, 0.11 * s, '#d9dde8');
  b.box(x, y + 0.23 * s, z + 0.057 * s, 0.09 * s, 0.025 * s, 0.01 * s, '#7bdff2'); // the visor
  b.cyl(x, y + 0.28 * s, z, 0.006 * s, 0.006 * s, 0.07 * s, '#9aa3b8', { seg: 5 });
  b.sphere(x, y + 0.36 * s, z, 0.018 * s, '#ff5d8f', { ws: 6, hs: 5 });
  for (const dx of [-0.1, 0.1]) b.boxB(x + dx * s, y + 0.04 * s, z, 0.035 * s, 0.11 * s, 0.05 * s, '#9aa3b8');
}

/** The limited Fox Samurai: an orange fox head with white cheeks, red armour and a little sword. `s` 1 = 0.46 m tall. */
function foxSamurai(b: Ink, x: number, y: number, z: number, s: number): void {
  b.cyl(x, y, z, 0.08 * s, 0.1 * s, 0.19 * s, '#c62f3a', { seg: 10 });
  b.boxB(x, y + 0.08 * s, z, 0.22 * s, 0.05 * s, 0.13 * s, '#ffd166'); // the armour's gold band
  b.sphere(x, y + 0.29 * s, z, 0.11 * s, '#ff8a3d', { ws: 12, hs: 10 });
  b.sphere(x, y + 0.27 * s, z + 0.07 * s, 0.06 * s, '#fff4e6', { ws: 10, hs: 8 });
  b.cone(x - 0.06 * s, y + 0.35 * s, z, 0.04 * s, 0.11 * s, '#ff8a3d', { seg: 6 });
  b.cone(x + 0.06 * s, y + 0.35 * s, z, 0.04 * s, 0.11 * s, '#ff8a3d', { seg: 6 });
  b.box(x + 0.12 * s, y + 0.12 * s, z + 0.02 * s, 0.02 * s, 0.26 * s, 0.02 * s, '#d9dde8', { rz: -0.5 }); // the sword
  b.sphere(x - 0.1 * s, y + 0.06 * s, z - 0.08 * s, 0.06 * s, '#fff4e6', { ws: 8, hs: 6, sy: 1.6 }); // the tail tip
}

/** ほしぞらホビー: the figure shop at the east end of the street (Daichi). Glass cases of figures, a box wall, posters, a turning showpiece. */
export const buildHobby: BuildingBuilder = (ctx: BuildCtx, s: ShopDef) => {
  const { solid, glow, collide, hangSign, shopFrame } = ctx;
  const rnd = ctx.rng('hobby');
  const pickOf = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)]!;
  const L = LOOK;
  const cx = s.cx;
  const innerL = cx - s.w / 2 + 0.3 + 0.03 + 0.025;
  const innerR = cx + s.w / 2 - 0.3 - 0.03 - 0.025;
  const backZ = FRONT_Z - s.d + 0.3 + 0.02 + 0.025;

  shopFrame(s, { wall: L.wall, inner: L.inner, trim: L.pink, roof: L.roof, floor: L.floor, ceil: L.ceil, openH: L.openH });
  hangSign('hobby', s, 'ほしぞらホビー', 'hoshizora hobby', L.navy, L.gold, L.openH, L.band, L.pink);
  glow.boxB(cx, L.openH - 0.1, FRONT_Z + 0.08, s.w - 1.2, 0.07, 0.05, L.pink); // pink neon under the header
  solid.boxB(cx, FLOOR_Y, FRONT_Z - 0.45, s.w - 1.2, 0.02, 0.2, L.gold); // threshold stripe

  // ---- counter, staff floor, things on the counter (a cat ninja, a robot, the till) ----
  solid.boxB(cx, FLOOR_Y, STAFF.z, STAFF.w, STAFF.top - FLOOR_Y, STAFF.d, '#5a4f8f');
  solid.boxB(cx, FLOOR_Y, COUNTER.z, COUNTER.w, 0.82, COUNTER.d, L.pink);
  solid.boxB(cx, FLOOR_Y + 0.82, COUNTER.z, COUNTER.w + 0.2, 0.08, COUNTER.d + 0.2, L.shelf);
  glow.boxB(cx, FLOOR_Y + 0.5, COUNTER.z + COUNTER.d / 2 + 0.01, COUNTER.w - 0.6, 0.06, 0.01, L.gold);
  const top = FLOOR_Y + 0.9;
  solid.boxB(cx + 1.6, top, COUNTER.z, 0.45, 0.22, 0.35, L.dark); // till
  glow.boxB(cx + 1.6, top + 0.22, COUNTER.z + 0.1, 0.3, 0.1, 0.01, '#7bdff2');
  catNinja(solid, cx - 1.6, top, COUNTER.z, 1, L.neko[0]!);
  robot(solid, cx - 1.0, top, COUNTER.z, 1, '#3b6fe0');
  for (let i = 0; i < 3; i++) solid.boxB(cx + 0.4 + i * 0.05, top + i * 0.16, COUNTER.z, 0.42 - i * 0.06, 0.16, 0.3, [L.pink, '#7bdff2', L.gold][i]!); // wrapped boxes

  // ---- back wall: three lit glass cases, five shelves of figures each ----
  const caseZ = backZ + 0.35;
  [-3.6, 0, 3.6].forEach((dx, ci) => {
    const x = cx + dx;
    solid.boxB(x, FLOOR_Y, caseZ, 2.6, 0.5, 0.6, L.dark); // plinth
    solid.boxB(x, FLOOR_Y + 2.9, caseZ, 2.6, 0.12, 0.6, L.dark); // case top
    glow.boxB(x, FLOOR_Y + 2.85, caseZ, 2.4, 0.03, 0.5, '#fff6d8'); // case light
    for (const ex of [-1.27, 1.27]) solid.boxB(x + ex, FLOOR_Y + 0.5, caseZ, 0.06, 2.4, 0.6, L.dark); // case posts
    for (let r = 0; r < 4; r++) {
      const y = FLOOR_Y + 0.5 + r * 0.6;
      solid.boxB(x, y, caseZ, 2.48, 0.03, 0.56, L.glass, { jitter: 0 });
      for (let k = 0; k < 4; k++) {
        const fx = x - 0.9 + k * 0.6;
        // the left case: the cat ninjas; the middle: robots; the right: a mix with the fox samurai on top
        if (ci === 0) catNinja(solid, fx, y + 0.03, caseZ, 0.9, L.neko[(k + r) % 3]!);
        else if (ci === 1) robot(solid, fx, y + 0.03, caseZ, r % 2 ? 0.8 : 1.05, pickOf(['#3b6fe0', '#e5453d', '#06d6a0', '#b28dff']));
        else if (r === 3) foxSamurai(solid, fx, y + 0.03, caseZ, 0.85);
        else (k + r) % 2 ? catNinja(solid, fx, y + 0.03, caseZ, 0.85, pickOf(L.neko)) : robot(solid, fx, y + 0.03, caseZ, 0.9, pickOf(['#ffd166', '#ff5d8f']));
      }
    }
    glow.boxB(x, FLOOR_Y + 3.1, caseZ + 0.31, 1.6, 0.25, 0.01, [L.pink, '#7bdff2', L.gold][ci]!); // the case's lit name plate
  });

  // ---- left wall: the box wall (figures in their boxes, a window in each box) ----
  const rackX = innerL + 0.27;
  const rackZ0 = FRONT_Z - 1.4;
  const rackLen = 7.4;
  solid.boxB(rackX, FLOOR_Y, rackZ0 - rackLen / 2, 0.54, 0.5, rackLen, L.dark);
  for (let r = 0; r < 4; r++) {
    const y = FLOOR_Y + 0.5 + r * 0.58;
    solid.boxB(rackX + 0.02, y - 0.04, rackZ0 - rackLen / 2, 0.5, 0.04, rackLen, L.shelf);
    for (let c = 0; c < 10; c++) {
      const z = rackZ0 - (c + 0.5) * (rackLen / 10);
      solid.boxB(rackX + 0.08, y, z, 0.32, 0.46, 0.5, pickOf(L.boxes));
      glow.boxB(rackX + 0.245, y + 0.12, z, 0.01, 0.26, 0.3, L.glass); // the box's clear window
    }
  }
  glow.boxB(rackX + 0.1, FLOOR_Y + 2.9, rackZ0 - rackLen / 2, 0.3, 0.12, rackLen, L.pink); // lit header

  // ---- right wall: posters of the two series and a big robot on a stand ----
  const posterX = innerR - 0.04;
  [
    [FRONT_Z - 2.6, L.pink, L.neko[0]!],
    [FRONT_Z - 4.6, '#7bdff2', '#3b6fe0'],
    [FRONT_Z - 6.6, L.gold, '#ff8a3d'],
  ].forEach(([z, frame, art]) => {
    solid.boxB(posterX, FLOOR_Y + 1.4, z as number, 0.04, 1.5, 1.2, frame as string);
    glow.boxB(posterX - 0.03, FLOOR_Y + 1.5, z as number, 0.01, 1.3, 1.0, art as string);
    glow.boxB(posterX - 0.035, FLOOR_Y + 2.45, z as number, 0.01, 0.22, 0.9, '#fff6d8');
  });
  solid.boxB(innerR - 0.6, FLOOR_Y, FRONT_Z - 8.2, 0.9, 0.6, 0.9, L.dark);
  robot(solid, innerR - 0.6, FLOOR_Y + 0.6, FRONT_Z - 8.2, 3.2, '#3b6fe0');

  // ---- the showpiece: the limited fox samurai turning on a lit pedestal under a glass dome ----
  const pedX = cx - 2.2;
  const pedZ = FRONT_Z - 5.6;
  solid.cyl(pedX, FLOOR_Y, pedZ, 0.45, 0.5, 0.9, L.dark, { seg: 16 });
  glow.cyl(pedX, FLOOR_Y + 0.9, pedZ, 0.42, 0.42, 0.04, L.gold, { seg: 16 });
  glow.sphere(pedX, FLOOR_Y + 1.35, pedZ, 0.5, '#d9f1ff', { ws: 14, hs: 10, sy: 1.1 }); // the dome's glow (a soft halo behind the figure)
  const spin = new Batch();
  foxSamurai(spin, 0, 0, 0, 1.7);
  const turner = spin.build(ctx.toon, { cast: false, receive: false, name: 'hobby-showpiece' });
  if (turner) {
    turner.position.set(pedX, FLOOR_Y + 0.95, pedZ);
    ctx.group.add(turner);
    ctx.own(turner.geometry);
    ctx.animate((_dt, t) => {
      turner.rotation.y = t * 0.7;
    });
  }
  // a low table of cat ninjas in front of the pedestal's twin (the new release)
  const tableX = cx + 2.2;
  solid.cyl(tableX, FLOOR_Y, pedZ, 0.35, 0.4, 0.04, L.pink, { seg: 12 });
  solid.cyl(tableX, FLOOR_Y, pedZ, 0.1, 0.12, 0.7, L.shelf, { seg: 8 });
  solid.boxB(tableX, FLOOR_Y + 0.7, pedZ, 1.6, 0.06, 0.9, L.shelf);
  L.neko.forEach((c, i) => catNinja(solid, tableX - 0.5 + i * 0.5, FLOOR_Y + 0.76, pedZ, 1.15, c));

  // ---- hanging stars ----
  for (const [dx, dz, r] of [[-4.2, -3.0, 0.22], [-1.2, -7.5, 0.18], [1.4, -3.4, 0.2], [4.1, -7.0, 0.24], [0.2, -5.4, 0.16]] as const) {
    solid.cyl(cx + dx, L.openH - 0.6, FRONT_Z + dz, 0.006, 0.006, 0.55, '#888');
    glow.sphere(cx + dx, L.openH - 0.7, FRONT_Z + dz, r, L.gold, { ws: 8, hs: 6 });
  }

  // ---- outside: the big cat ninja mascot by the door, gold stars on the roof and a crescent moon ----
  // 1.3 m off the facade (as the standees of the other shops): the gap to the wall stays wider than the player
  const SZ = FRONT_Z + 1.3;
  const mx = cx + 5.0;
  solid.cyl(mx, 0, SZ, 0.45, 0.5, 0.2, L.dark, { seg: 14 });
  catNinja(solid, mx, 0.2, SZ, 4.2, L.neko[0]!);
  collide(mx, SZ, 1.1, 0.9);
  const roofY = s.h + 0.42;
  for (const [dx, dz, r] of [[-4.6, -2.0, 0.42], [-2.0, -4.5, 0.3], [1.0, -2.6, 0.36], [3.6, -5.0, 0.28]] as const) {
    solid.cyl(cx + dx, roofY, FRONT_Z + dz, 0.04, 0.05, 0.8, '#9aa3b8', { seg: 6 });
    glow.sphere(cx + dx, roofY + 0.8 + r, FRONT_Z + dz, r, L.gold, { ws: 10, hs: 8 });
  }
  glow.torus(cx + 5.0, roofY + 1.3, FRONT_Z - 2.0, 0.6, 0.12, '#fff2a8', { arc: Math.PI * 1.2 });

  registerShutter(ctx, { cx, w: s.w, openH: L.openH });
  ctx.mapRect(shopRect(s), L.pink, 'hobby');
};

/** The 準備中 shutter in the shop's colours: a ribbed purple slab with a gold plate. Hidden until the shop closes. */
function registerShutter(ctx: BuildCtx, o: ShopOpening): void {
  const g = new THREE.Group();
  const w = o.w - 0.6;
  const h = o.openH - 0.12;
  const z = FRONT_Z + 0.05;
  const b = new Batch();
  b.boxB(o.cx, FLOOR_Y, z, w, h, 0.06, '#5a4f8f', { jitter: 0 });
  for (let i = 0; i < Math.floor(h / 0.22); i++) b.boxB(o.cx, 0.2 + i * 0.22, z + 0.04, w, 0.05, 0.03, '#4a3f7a', { jitter: 0 });
  const slab = b.build(ctx.toon, { cast: false, receive: false, name: 'hobby-shutter' });
  if (slab) {
    g.add(slab);
    ctx.own(slab.geometry);
  }
  const pw = Math.min(4.2, w - 1);
  const plate = ctx.signPlane('準備中', { bg: LOOK.gold, fg: '#b3402f', sub: 'junbi-chū', subColor: LOOK.navy, border: LOOK.pink, round: 14 }, { x: o.cx, y: FLOOR_Y + h * 0.55, z: z + 0.09, w: pw, h: pw * 0.36 });
  ctx.group.remove(plate);
  g.add(plate);
  ctx.registerShutter('hobby', g);
}
