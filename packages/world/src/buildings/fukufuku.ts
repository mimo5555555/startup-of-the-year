import * as THREE from 'three';
import { Batch } from '../batch';
import type { BuildCtx, ShopOpening } from '../buildctx';
import { FRONT_Z, shopRect, type ShopDef } from '../layout';
import type { BuildingBuilder } from './index';

/** Look of the shop, in one place (everything else is geometry). */
const LOOK = {
  openH: 3.6,
  band: 1.9,
  wall: '#fff0e2',
  inner: '#ffe0cc',
  raspberry: '#e0457b',
  roof: '#d9b3a2',
  floor: '#e6c49c',
  ceil: '#fff8ee',
  cream: '#fff6ea',
  wood: '#b5794f',
  darkWood: '#7e4f33',
  dark: '#3a3340',
  steel: '#c4c9d4',
  mint: '#7fd8c0',
  plush: '#c9895a',
  skin: '#e6c8a8',
  /** garment colours: bright, a little retro */
  garments: ['#ff6f91', '#ffbf3c', '#2ec4b6', '#6bb8ff', '#b79cff', '#f4f1e6', '#ff9a62', '#3d5a99', '#8fd16b', '#e0457b'],
  /** denim, khaki, charcoal: the quieter things a rack also holds */
  trousers: ['#3d5a99', '#c9a66b', '#4a4a5a', '#7a8cc4'],
};

const FLOOR_Y = 0.12;
/** the staff floor behind the counter: the NPC `rin` stands on it (NPC_SPAWNS.y 0.28) */
const STAFF = { z: FRONT_Z - 3.4, d: 2.2, w: 5, top: 0.28 };
/** the counter's depth-wise centre and size match SHOP_COUNTERS.fukufuku (4.4 x 0.9 at z -10.8) */
const COUNTER = { z: FRONT_Z - 1.8, w: 4.4, d: 0.9 };
/** garment rails: z and the height of the bar the hangers hang from */
const RAIL = { z: FRONT_Z - 5.8, y: 1.75, pitch: 0.52, count: 5 };
/** how far off the facade the street-side props stand: the gap to the wall must stay wider than the player (0.84 m) */
const STREET_OFF = 1.3;
/** segments of the small round props */
const BALL_SEG = { w: 6, h: 4 };

/** Fuku-Fuku: a cheerful clothes and second-hand shop, raspberry and cream, with garment racks, a fitting room, a mirror and a retro shelf. */
export const buildFukufuku: BuildingBuilder = (ctx: BuildCtx, s: ShopDef) => {
  const { solid, glow, collide, hangSign, shopFrame } = ctx;
  const rnd = ctx.rng('fukufuku');
  const pickOf = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
  /** a low-poly ball: toon shading carries the roundness, so 6 x 4 segments are enough for props this small */
  const ball = (x: number, y: number, z: number, r: number, c: string, o: { sx?: number; sy?: number; sz?: number } = {}) => solid.sphere(x, y, z, r, c, { ws: BALL_SEG.w, hs: BALL_SEG.h, ...o });
  const L = LOOK;
  const PLUSH = L.plush;
  const SKIN = L.skin;
  const cx = s.cx;
  const innerL = cx - s.w / 2 + 0.3 + 0.03 + 0.025; // face of the left inner wall panel
  const innerR = cx + s.w / 2 - 0.3 - 0.03 - 0.025;
  const backZ = FRONT_Z - s.d + 0.3 + 0.02 + 0.025; // face of the back inner wall panel

  shopFrame(s, { wall: L.wall, inner: L.inner, trim: L.raspberry, roof: L.roof, floor: L.floor, ceil: L.ceil, openH: L.openH });
  hangSign('fukufuku', s, 'フクフク', 'fuku-fuku · clothes & second-hand', L.cream, L.raspberry, L.openH, L.band, L.raspberry);
  glow.boxB(cx, L.openH - 0.1, FRONT_Z + 0.08, s.w - 1.2, 0.07, 0.05, '#fff2d6'); // light strip under the header
  solid.boxB(cx, FLOOR_Y, FRONT_Z - 0.45, s.w - 1.2, 0.02, 0.2, L.raspberry); // threshold stripe

  // ---- striped valance under the header, and bunting across the shop ----
  const stripes = Math.floor((s.w - 1.2) / 1.2);
  for (let i = 0; i < stripes; i++) solid.box(cx + (i - (stripes - 1) / 2) * 1.2, L.openH - 0.26, FRONT_Z + 0.34, 1.2, 0.05, 0.7, i % 2 ? L.cream : L.raspberry, { rx: 0.38 });
  const flags = 9;
  for (let i = 0; i < flags; i++) {
    const t = i / (flags - 1);
    const y = L.openH - 0.42 - Math.sin(t * Math.PI) * 0.22;
    solid.box(cx - 4.6 + t * 9.2, y, FRONT_Z - 3.3, 0.2, 0.2, 0.02, L.garments[i % L.garments.length], { rz: Math.PI / 4 });
  }

  // ---- counter, staff floor, things on the counter ----
  solid.boxB(cx, FLOOR_Y, STAFF.z, STAFF.w, STAFF.top - FLOOR_Y, STAFF.d, L.wood);
  solid.boxB(cx, FLOOR_Y, COUNTER.z, COUNTER.w, 0.82, COUNTER.d, L.raspberry);
  solid.boxB(cx, FLOOR_Y + 0.82, COUNTER.z, COUNTER.w + 0.2, 0.08, COUNTER.d + 0.2, L.cream);
  glow.boxB(cx, FLOOR_Y + 0.5, COUNTER.z + COUNTER.d / 2 + 0.01, COUNTER.w - 0.6, 0.06, 0.01, '#fff2d6'); // lit strip on the counter front
  const top = FLOOR_Y + 0.9;
  solid.boxB(cx - 0.6, top, COUNTER.z - 0.1, 0.46, 0.14, 0.34, L.dark); // register
  solid.box(cx - 0.6, top + 0.3, COUNTER.z - 0.2, 0.4, 0.28, 0.03, L.dark, { rx: -0.25 });
  glow.box(cx - 0.6, top + 0.3, COUNTER.z - 0.18, 0.34, 0.22, 0.01, '#8fe3ff', { rx: -0.25 });
  solid.boxB(cx + 0.1, top, COUNTER.z, 0.26, 0.08, 0.18, L.dark); // card reader
  glow.boxB(cx + 0.1, top + 0.08, COUNTER.z + 0.04, 0.18, 0.01, 0.06, '#8be0c5');
  for (let i = 0; i < 2; i++) solid.boxB(cx - 1.6, top + i * 0.16, COUNTER.z, 0.5, 0.16, 0.4, L.garments[(i * 3) % L.garments.length]); // folded sweaters
  for (const [dx, c] of [[1.3, L.cream], [1.75, L.mint]] as const) {
    solid.boxB(cx + dx, top, COUNTER.z + 0.05, 0.34, 0.42, 0.18, c); // paper shopping bags
    solid.boxB(cx + dx, top + 0.42, COUNTER.z + 0.05, 0.14, 0.05, 0.02, L.raspberry); // the cord handle
  }
  ball(cx + 0.9, top + 0.13, COUNTER.z + 0.08, 0.12, PLUSH); // the plush on the counter
  ball(cx + 0.9, top + 0.33, COUNTER.z + 0.08, 0.1, PLUSH);
  for (const sx of [-1, 1]) ball(cx + 0.9 + sx * 0.08, top + 0.43, COUNTER.z + 0.08, 0.04, PLUSH);
  solid.cyl(cx + 1.9, top, COUNTER.z - 0.15, 0.1, 0.1, 0.1, L.wood, { seg: 6 }); // dish of guitar picks
  glow.disc(cx + 1.9, top + 0.105, COUNTER.z - 0.15, 0.08, '#ffd166', { seg: 6 });

  // ---- pendant lamps over the counter ----
  for (const dx of [-1.5, 0, 1.5]) {
    solid.boxB(cx + dx, L.openH - 0.7, COUNTER.z - 0.3, 0.015, 0.58, 0.015, L.dark);
    solid.cone(cx + dx, L.openH - 1.0, COUNTER.z - 0.3, 0.26, 0.32, L.raspberry, { seg: 6 });
    glow.sphere(cx + dx, L.openH - 1.03, COUNTER.z - 0.3, 0.1, '#fff2c0', { ws: BALL_SEG.w, hs: BALL_SEG.h });
  }

  // ---- back wall: the second-hand shelf (centre), the fitting room (left), the mirror (right) ----
  const shelfZ = backZ + 0.32;
  const shelfW = 3.8;
  const tiers = [FLOOR_Y + 0.9, FLOOR_Y + 1.5, FLOOR_Y + 2.1];
  solid.boxB(cx - shelfW / 2, FLOOR_Y, shelfZ, 0.08, 2.4, 0.6, L.darkWood); // uprights
  solid.boxB(cx + shelfW / 2, FLOOR_Y, shelfZ, 0.08, 2.4, 0.6, L.darkWood);
  solid.boxB(cx, FLOOR_Y + 1.1, shelfZ - 0.25, shelfW, 1.3, 0.04, L.floor); // back panel above the crates
  for (const y of [FLOOR_Y + 0.05, ...tiers, FLOOR_Y + 2.4]) solid.boxB(cx, y - 0.04, shelfZ, shelfW + 0.08, 0.05, 0.6, L.wood);
  const sz = shelfZ + 0.04;
  for (const dx of [-1.0, 0.6]) { // record crates on the floor tier
    solid.boxB(cx + dx, FLOOR_Y + 0.09, sz, 1.1, 0.4, 0.45, L.darkWood);
    for (let i = 0; i < 5; i++) solid.boxB(cx + dx - 0.4 + i * 0.2, FLOOR_Y + 0.14, sz + 0.02, 0.14, 0.62, 0.34, pickOf(L.garments));
  }
  solid.boxB(cx + 1.5, FLOOR_Y + 0.09, sz, 0.5, 0.35, 0.4, L.mint); // a basket
  solid.boxB(cx + 1.5, FLOOR_Y + 0.44, sz, 0.42, 0.14, 0.34, L.garments[1]);
  // tier 1: radio, vase, folded stack, clock
  solid.boxB(cx - 1.3, tiers[0], sz, 0.5, 0.3, 0.2, L.wood);
  glow.boxB(cx - 1.4, tiers[0] + 0.1, sz + 0.105, 0.2, 0.1, 0.01, '#ffe9a8');
  for (const dx of [-1.05, -0.9]) solid.cyl(cx + dx, tiers[0] + 0.1, sz + 0.1, 0.03, 0.03, 0.04, L.cream, { seg: 4 });
  solid.cyl(cx - 0.5, tiers[0], sz, 0.1, 0.07, 0.28, L.mint, { seg: 6 });
  ball(cx - 0.5, tiers[0] + 0.36, sz, 0.09, '#ff8fab');
  for (let i = 0; i < 3; i++) solid.boxB(cx + 0.15, tiers[0] + i * 0.13, sz, 0.6, 0.13, 0.4, L.garments[(i * 3 + 2) % L.garments.length]);
  solid.cyl(cx + 1.0, tiers[0], sz, 0.17, 0.17, 0.32, L.cream, { seg: 8 }); // alarm clock
  glow.disc(cx + 1.0, tiers[0] + 0.325, sz, 0.12, '#ffe9a8', { seg: 6 });
  ball(cx + 1.5, tiers[0] + 0.15, sz, 0.14, '#ff9a62'); // teapot
  solid.boxB(cx + 1.64, tiers[0] + 0.14, sz, 0.12, 0.04, 0.04, '#ff9a62');
  // tier 2: camera, books, lamp
  solid.boxB(cx - 1.4, tiers[1], sz, 0.34, 0.2, 0.18, L.dark);
  solid.cyl(cx - 1.4, tiers[1] + 0.1, sz + 0.12, 0.07, 0.07, 0.1, L.steel, { seg: 6, rx: Math.PI / 2 });
  for (let i = 0; i < 4; i++) solid.boxB(cx - 0.8 + i * 0.16, tiers[1], sz, 0.14, 0.3 + (i % 3) * 0.04, 0.26, L.garments[(i * 3) % L.garments.length]);
  solid.cyl(cx + 0.35, tiers[1], sz, 0.1, 0.12, 0.1, L.darkWood, { seg: 6 });
  solid.boxB(cx + 0.35, tiers[1] + 0.1, sz, 0.03, 0.25, 0.03, L.steel);
  solid.cone(cx + 0.35, tiers[1] + 0.28, sz, 0.17, 0.2, '#ffd166', { seg: 6 });
  glow.sphere(cx + 0.35, tiers[1] + 0.3, sz, 0.07, '#fff2c0', { ws: BALL_SEG.w, hs: BALL_SEG.h });
  for (let i = 0; i < 2; i++) solid.boxB(cx + 1.1, tiers[1] + i * 0.14, sz, 0.5, 0.14, 0.34, pickOf(L.garments));
  // tier 3: plant, boxes, a stuffed rabbit
  solid.cyl(cx - 1.2, tiers[2], sz, 0.13, 0.1, 0.16, L.raspberry, { seg: 6 });
  for (const a of [0, 1, 2]) solid.cone(cx - 1.2 + Math.cos(a * 1.3) * 0.08, tiers[2] + 0.16, sz + Math.sin(a * 1.3) * 0.06, 0.07, 0.3, '#5fae6b', { seg: 4, rz: Math.cos(a * 1.3) * 0.35 });
  for (const [dx, w, h, c] of [[-0.4, 0.5, 0.2, L.mint], [0.2, 0.4, 0.28, L.cream], [0.8, 0.5, 0.18, '#ffbf3c']] as const) solid.boxB(cx + dx, tiers[2], sz, w, h, 0.34, c);
  ball(cx + 1.5, tiers[2] + 0.12, sz, 0.12, L.cream);
  ball(cx + 1.5, tiers[2] + 0.3, sz, 0.09, L.cream);
  for (const sx of [-1, 1]) solid.boxB(cx + 1.5 + sx * 0.05, tiers[2] + 0.36, sz, 0.04, 0.2, 0.03, L.cream);
  // the 古着 (second-hand clothes) plate over the shelf
  const furugi = ctx.signPlane('古着', { bg: L.raspberry, fg: L.cream, sub: 'furugi · second-hand', subColor: L.cream, border: L.cream, round: 12 }, { x: cx, y: FLOOR_Y + 2.78, z: backZ + 0.04, w: 2.4, h: 0.56 });
  void furugi;

  // fitting room (left): a booth with a striped curtain half drawn
  const fitW = 2.6;
  const fitX = cx - 3.6;
  const fitZ = backZ + 1.7; // front plane of the booth
  solid.boxB(fitX, FLOOR_Y, backZ + 0.85, fitW, 2.5, 1.7, L.darkWood); // the booth body, dark inside
  glow.boxB(fitX, FLOOR_Y + 0.05, fitZ + 0.02, fitW - 0.4, 2.2, 0.01, '#6b5568'); // dim inside, seen through the open half
  for (const sgn of [-1, 1]) solid.boxB(fitX + sgn * (fitW / 2 - 0.04), FLOOR_Y, fitZ + 0.03, 0.14, 2.5, 0.16, L.raspberry); // posts
  solid.boxB(fitX, FLOOR_Y + 2.38, fitZ + 0.03, fitW, 0.16, 0.18, L.raspberry); // header with cream stripes
  for (let i = 0; i < 4; i++) solid.boxB(fitX - 0.9 + i * 0.6, FLOOR_Y + 2.4, fitZ + 0.13, 0.3, 0.12, 0.01, L.cream);
  const stripeN = 6;
  for (let i = 0; i < stripeN; i++) { // the curtain: pink and cream strips gathered on the left, a tie-back, the right third open
    const x = fitX - fitW / 2 + 0.25 + i * 0.25;
    solid.boxB(x, FLOOR_Y + 0.02, fitZ + 0.08 + (i % 2) * 0.03, 0.26, 2.36, 0.04, i % 2 ? L.cream : '#ff8fab');
  }
  solid.boxB(fitX - fitW / 2 + 1.0, FLOOR_Y + 1.0, fitZ + 0.15, 0.12, 0.12, 0.08, L.mint); // tie-back band
  solid.cyl(fitX + 0.55, FLOOR_Y, backZ + 0.8, 0.22, 0.2, 0.42, L.mint, { seg: 6 }); // stool inside
  solid.boxB(fitX + 0.55, FLOOR_Y + 1.7, backZ + 0.3, 0.5, 0.05, 0.05, L.steel); // coat hooks
  solid.box(fitX + 0.5, FLOOR_Y + 1.6, backZ + 0.33, 0.34, 0.5, 0.05, L.garments[3]);

  // standing mirror (right) with a pouf
  const mirX = cx + 3.4;
  solid.boxB(mirX, FLOOR_Y, backZ + 0.55, 1.1, 2.15, 0.07, L.wood, { rx: -0.07 });
  glow.boxB(mirX, FLOOR_Y + 0.12, backZ + 0.6, 0.9, 1.92, 0.01, '#d9eefc', { rx: -0.07 });
  glow.boxB(mirX - 0.1, FLOOR_Y + 0.5, backZ + 0.61, 0.09, 1.1, 0.01, '#ffffff', { rx: -0.07, rz: 0.35 }); // sheen
  solid.cyl(mirX - 0.9, FLOOR_Y, backZ + 1.4, 0.3, 0.32, 0.38, L.raspberry, { seg: 8 });
  solid.cyl(mirX - 0.9, FLOOR_Y + 0.38, backZ + 1.4, 0.3, 0.3, 0.05, '#ff8fab', { seg: 8 });

  // ---- garments ----
  const hanger = (x: number, yTop: number, z: number, w: number) => {
    solid.boxB(x, yTop - 0.1, z, w, 0.025, 0.025, L.wood);
  };
  const tee = (x: number, yTop: number, z: number, c: string, long = false) => {
    hanger(x, yTop, z, 0.46);
    solid.boxB(x, yTop - 0.7, z, 0.4, 0.6, 0.06, c);
    for (const sgn of [-1, 1]) solid.box(x + sgn * 0.26, yTop - 0.22, z, 0.2, long ? 0.45 : 0.17, 0.06, c, { rz: sgn * (long ? 0.12 : 0.7) });
  };
  const dress = (x: number, yTop: number, z: number, c: string) => {
    hanger(x, yTop, z, 0.36);
    solid.boxB(x, yTop - 0.46, z, 0.28, 0.34, 0.05, c);
    solid.cyl(x, yTop - 1.05, z, 0.13, 0.3, 0.62, c, { seg: 5 });
    solid.boxB(x, yTop - 0.5, z + 0.03, 0.3, 0.05, 0.03, L.cream); // belt
  };
  const trousers = (x: number, yTop: number, z: number, c: string) => {
    hanger(x, yTop, z, 0.34);
    solid.boxB(x, yTop - 0.3, z, 0.34, 0.2, 0.06, c);
    for (const sgn of [-1, 1]) solid.boxB(x + sgn * 0.09, yTop - 0.95, z, 0.15, 0.7, 0.06, c);
  };
  const jacket = (x: number, yTop: number, z: number, c: string) => {
    hanger(x, yTop, z, 0.5);
    solid.boxB(x, yTop - 0.82, z, 0.46, 0.74, 0.07, c);
    for (const sgn of [-1, 1]) solid.boxB(x + sgn * 0.3, yTop - 0.9, z, 0.13, 0.74, 0.07, c, { rz: sgn * 0.06 });
    solid.boxB(x, yTop - 0.82, z + 0.04, 0.12, 0.6, 0.02, L.cream); // shirt front
  };
  const skirt = (x: number, yTop: number, z: number, c: string) => {
    hanger(x, yTop, z, 0.34);
    solid.cyl(x, yTop - 0.64, z, 0.14, 0.27, 0.52, c, { seg: 5 });
  };
  const garment = (x: number, yTop: number, z: number, i: number) => {
    const c = L.garments[(i * 7 + Math.floor(rnd() * 3)) % L.garments.length];
    const k = (i + Math.floor(rnd() * 2)) % 6;
    if (k === 0 || k === 5) tee(x, yTop, z, c, k === 5);
    else if (k === 1) dress(x, yTop, z, c);
    else if (k === 2) trousers(x, yTop, z, pickOf(L.trousers));
    else if (k === 3) jacket(x, yTop, z, c);
    else skirt(x, yTop, z, c);
  };
  const rail = (x0: number, z: number, y: number, n: number, seed: number) => {
    const len = n * RAIL.pitch + 0.3;
    const xm = x0 + len / 2 - 0.15;
    solid.boxB(xm, y, z, len, 0.04, 0.04, L.steel); // bar
    for (const x of [x0 - 0.15, x0 - 0.15 + len]) {
      solid.boxB(x, FLOOR_Y, z, 0.05, y - FLOOR_Y, 0.05, L.steel); // poles and feet
      solid.boxB(x, FLOOR_Y, z, 0.12, 0.04, 0.9, L.dark);
    }
    for (let i = 0; i < n; i++) garment(x0 + 0.1 + i * RAIL.pitch, y - 0.03, z, i + seed);
  };
  rail(cx - 3.95, RAIL.z, RAIL.y, RAIL.count, 0);
  rail(cx + 1.0, RAIL.z, RAIL.y, RAIL.count, 2);

  // ---- front-left: two mannequins on a low platform ----
  solid.boxB(cx - 3.7, FLOOR_Y, FRONT_Z - 1.9, 2.5, 0.1, 1.5, '#ff8fab');
  const mannequin = (x: number, z: number, top: string, bottom: string, long: boolean) => {
    const y = FLOOR_Y + 0.1;
    solid.cyl(x, y, z, 0.2, 0.22, 0.04, L.dark, { seg: 6 }); // base
    if (long) solid.cyl(x, y + 0.35, z, 0.11, 0.3, 0.7, bottom, { seg: 6 }); // a skirt
    else for (const sgn of [-1, 1]) solid.boxB(x + sgn * 0.08, y + 0.2, z, 0.14, 0.72, 0.14, bottom); // trousers
    solid.cyl(x, y + 0.88, z, 0.17, 0.12, 0.52, top, { seg: 6 }); // torso
    for (const sgn of [-1, 1]) solid.boxB(x + sgn * 0.22, y + 0.9, z, 0.08, 0.42, 0.1, top, { rz: sgn * 0.12 });
    solid.boxB(x, y + 1.4, z, 0.08, 0.1, 0.08, SKIN); // neck
    ball(x, y + 1.6, z, 0.11, SKIN, { sy: 1.25 });
  };
  mannequin(cx - 4.2, FRONT_Z - 1.9, L.garments[0], L.trousers[0], false);
  mannequin(cx - 3.2, FRONT_Z - 1.9, L.garments[3], L.garments[1], true);

  // ---- front-right: a sale table of folded stacks, a shoe step and a hat stand ----
  const tableX = cx + 3.3;
  solid.boxB(tableX, FLOOR_Y + 0.62, FRONT_Z - 1.9, 2.3, 0.07, 1.1, L.wood);
  for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) solid.boxB(tableX + sx * 1.05, FLOOR_Y, FRONT_Z - 1.9 + sz2 * 0.45, 0.07, 0.62, 0.07, L.darkWood);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 2; i++) solid.boxB(tableX - 0.85 + c * 0.55, FLOOR_Y + 0.69 + i * (0.1 + ((c + r) % 3) * 0.04), FRONT_Z - 1.9 - 0.25 + r * 0.5, 0.44, 0.1 + ((c + r) % 3) * 0.04, 0.4, L.garments[(c * 3 + r * 2 + i) % L.garments.length]);
  }
  solid.boxB(tableX, FLOOR_Y + 1.2, FRONT_Z - 2.45, 0.9, 0.3, 0.03, L.raspberry, { rx: -0.2 }); // price sign
  solid.cyl(cx + 1.0, FLOOR_Y, FRONT_Z - 1.9, 0.18, 0.2, 0.04, L.dark, { seg: 6 }); // hat stand
  solid.boxB(cx + 1.0, FLOOR_Y, FRONT_Z - 1.9, 0.04, 1.3, 0.04, L.steel);
  for (const [dy, c] of [[1.2, L.garments[1]], [0.85, L.garments[0]]] as const) {
    solid.cyl(cx + 1.0 + (dy - 1) * 0.3, FLOOR_Y + dy, FRONT_Z - 1.9, 0.18, 0.18, 0.02, c, { seg: 6 });
    ball(cx + 1.0 + (dy - 1) * 0.3, FLOOR_Y + dy + 0.02, FRONT_Z - 1.9, 0.13, c, { sy: 0.7 });
  }

  // ---- side walls: shelving of folded clothes (left) and bags and shoes (right) ----
  const unitZ0 = FRONT_Z - 3.2;
  const unitLen = 3.4;
  const left = innerL + 0.27;
  const right = innerR - 0.27;
  for (const [x, dir] of [[left, 1], [right, -1]] as const) {
    solid.boxB(x, FLOOR_Y, unitZ0, 0.54, 2.2, 0.06, L.darkWood); // end boards
    solid.boxB(x, FLOOR_Y, unitZ0 - unitLen, 0.54, 2.2, 0.06, L.darkWood);
    for (const y of [0.5, 1.1, 1.7]) {
      solid.boxB(x, FLOOR_Y + y - 0.04, unitZ0 - unitLen / 2, 0.54, 0.05, unitLen, L.wood);
      const n = 4;
      for (let i = 0; i < n; i++) {
        const z = unitZ0 - 0.4 - i * ((unitLen - 0.5) / n);
        if (dir === 1) for (let k = 0; k < 2; k++) solid.boxB(x, FLOOR_Y + y + k * 0.1, z, 0.44, 0.1 + ((i + k) % 2) * 0.05, 0.5, pickOf(L.garments)); // folded stacks
        else if (y === 1.7) { // hats
          const c = pickOf(L.garments);
          solid.cyl(x, FLOOR_Y + y, z, 0.17, 0.17, 0.03, c, { seg: 6 });
          ball(x, FLOOR_Y + y + 0.03, z, 0.11, c, { sy: 0.8 });
        } else if (y === 1.1) { // bags
          solid.boxB(x, FLOOR_Y + y, z, 0.3, 0.3, 0.26, pickOf(L.garments));
          solid.boxB(x, FLOOR_Y + y + 0.3, z, 0.04, 0.12, 0.12, L.dark); // handle
        } else { // shoes in pairs
          const c = pickOf(L.garments);
          solid.boxB(x - 0.05, FLOOR_Y + y, z, 0.3, 0.1, 0.3, c); // a pair of shoes
        }
      }
    }
  }

  // ---- outside: a sandwich board and a rolling sale rack, off the facade so the gap stays wider than the player ----
  const SZ = FRONT_Z + STREET_OFF;
  const boardX = cx - 3.9;
  const boardW = 0.9;
  for (const sgn of [-1, 1]) solid.boxB(boardX, 0, SZ + sgn * 0.12, boardW, 1.0, 0.05, L.darkWood, { rx: -sgn * 0.14 }); // A-frame legs
  const board = ctx.signPlane('セール', { bg: L.cream, fg: L.raspberry, sub: 'sale', subColor: L.raspberry, border: L.raspberry, round: 10 }, { x: boardX, y: 0.5, z: SZ + 0.2, w: boardW - 0.1, h: 0.82 });
  board.rotation.x = -0.14;
  collide(boardX, SZ, boardW + 0.1, 0.6);
  const rackX = cx + 4.0;
  const rackW = 1.7;
  solid.boxB(rackX, 0.1, SZ, rackW, 0.04, 0.05, L.steel); // rolling rack: base, poles, rail, castors
  solid.boxB(rackX, 0.14, SZ, 0.05, 0.05, 0.4, L.steel);
  for (const sgn of [-1, 1]) {
    solid.boxB(rackX + sgn * (rackW / 2 - 0.03), 0.1, SZ, 0.04, 1.4, 0.04, L.steel);
    solid.boxB(rackX + sgn * (rackW / 2 - 0.03), 0.1, SZ, 0.1, 0.04, 0.5, L.steel);
    for (const dz of [-0.22, 0.22]) solid.cyl(rackX + sgn * (rackW / 2 - 0.03), 0, SZ + dz, 0.05, 0.05, 0.1, L.dark, { seg: 4 });
  }
  solid.boxB(rackX, 1.45, SZ, rackW, 0.04, 0.04, L.steel);
  for (let i = 0; i < 3; i++) {
    const x = rackX - 0.5 + i * 0.5;
    const c = L.garments[(i * 3 + 4) % L.garments.length];
    if (i % 2) tee(x, 1.43, SZ, c, true);
    else dress(x, 1.43, SZ, c);
  }
  collide(rackX, SZ, rackW + 0.1, 0.5);

  // ---- roof: a coat-hanger emblem and a clothes line with laundry ----
  const roofY = s.h + 0.42;
  const hx = cx + 4.3;
  const hz = FRONT_Z - 1.4;
  solid.boxB(hx, roofY, hz, 0.1, 0.5, 0.1, L.steel); // hook neck
  for (const sgn of [-1, 1]) solid.box(hx + sgn * 0.52, roofY + 0.45, hz, 1.1, 0.1, 0.1, L.raspberry, { rz: sgn * -0.42 });
  solid.boxB(hx, roofY + 0.1, hz, 1.9, 0.1, 0.1, L.raspberry);
  glow.boxB(hx, roofY + 0.2, hz + 0.06, 1.5, 0.03, 0.01, '#fff2d6');
  const lineX0 = cx - 4.6;
  const lineZ = FRONT_Z - 2.2;
  for (const dx of [0, 4.6]) solid.boxB(lineX0 + dx, roofY, lineZ, 0.07, 1.3, 0.07, L.steel);
  solid.boxB(lineX0 + 2.3, roofY + 1.15, lineZ, 4.7, 0.02, 0.02, L.steel);
  for (let i = 0; i < 4; i++) {
    const x = lineX0 + 0.7 + i * 1.05;
    const c = L.garments[(i * 2) % L.garments.length];
    solid.boxB(x, roofY + 0.5, lineZ, 0.4, 0.6, 0.04, c);
    for (const sgn of [-1, 1]) solid.box(x + sgn * 0.26, roofY + 1.0, lineZ, 0.18, 0.16, 0.04, c, { rz: sgn * 0.7 });
  }

  registerShutter(ctx, { cx, w: s.w, openH: L.openH });
  ctx.mapRect(shopRect(s), L.raspberry, 'fukufuku');
};

/** The 準備中 shutter in the shop's colours: a ribbed pink slab over the opening with a cream plate. Hidden until the shop closes. */
function registerShutter(ctx: BuildCtx, o: ShopOpening): void {
  const g = new THREE.Group();
  const w = o.w - 0.6;
  const h = o.openH - 0.12;
  const z = FRONT_Z + 0.05;
  const b = new Batch();
  b.boxB(o.cx, FLOOR_Y, z, w, h, 0.06, '#e8a4b8', { jitter: 0 });
  for (let i = 0; i < Math.floor(h / 0.22); i++) b.boxB(o.cx, 0.2 + i * 0.22, z + 0.04, w, 0.05, 0.03, '#d98aa3', { jitter: 0 });
  const slab = b.build(ctx.toon, { cast: false, receive: false, name: 'fukufuku-shutter' });
  if (slab) {
    g.add(slab);
    ctx.own(slab.geometry);
  }
  const pw = Math.min(4.2, w - 1);
  const plate = ctx.signPlane('準備中', { bg: LOOK.cream, fg: LOOK.raspberry, sub: 'junbi-chū', subColor: LOOK.darkWood, border: LOOK.raspberry, round: 14 }, { x: o.cx, y: FLOOR_Y + h * 0.55, z: z + 0.09, w: pw, h: pw * 0.36 });
  ctx.group.remove(plate); // signPlane parks it in the city group; it lives in the shutter group instead
  g.add(plate);
  ctx.registerShutter('fukufuku', g);
}
