import * as THREE from 'three';
import { Batch } from '../batch';
import type { BuildCtx, ShopOpening } from '../buildctx';
import { FRONT_Z, KEI, MOTORS_BIKES, MOTORS_CARS, SHOP_COUNTERS, bikeRect, keiRect, shopRect, type ShopDef } from '../layout';
import type { BuildingBuilder } from './index';
import { addBike, addKei, dome, ring, type BikeLook, type KeiLook } from './vehicles';

/** The two kei cars on show: distinct colours, each with a contrasting side stripe. */
export const MOTORS_CAR_LOOKS: readonly KeiLook[] = [
  { body: '#7fd6b8', accent: '#2e9e5b' },
  { body: '#f3b63a', accent: '#c0392b' },
];

/** Look of the garage, in one place (everything else is geometry). */
const LOOK = {
  openH: 3.7,
  band: 1.6,
  wall: '#efe6d2',
  inner: '#ddd3bd',
  orange: '#e8702a',
  navy: '#26334d',
  roof: '#4b505e',
  floor: '#9a9ca3',
  ceil: '#d9d4c6',
  steel: '#bfc7d4',
  dark: '#2b303c',
  red: '#c0392b',
  yellow: '#ffc83d',
  white: '#f7f4ec',
  wood: '#8a6a4a',
  tyre: '#23242b',
  cars: MOTORS_CAR_LOOKS,
  /** the three bicycles outside (frame colours) */
  bikes: [{ frame: '#3b6fb6' }, { frame: '#d8433f' }, { frame: '#4caf7a' }] satisfies BikeLook[],
  pennants: ['#d8433f', '#ffc83d', '#3b6fb6', '#f7f4ec', '#e8702a'],
  cans: ['#d8433f', '#ffc83d', '#3b6fb6', '#2e9e5b'],
  helmets: ['#f7f4ec', '#d8433f', '#3b6fb6', '#ffc83d'],
};

const FLOOR_Y = 0.12;
/** the staff floor behind the counter: the NPC `nakamura` stands on it (NPC_SPAWNS.y 0.28) */
const STAFF = { x: 71.0, z: FRONT_Z - 3.4, d: 2.0, w: 3.6, top: 0.28 };
/** the pegboard tool wall and workbench that stand behind Nakamura, left of the first car */
const TOOL_WALL = { x0: 69.0, x1: 74.3, benchZ: FRONT_Z - 6.1, boardZ: FRONT_Z - 6.7 };
const PENNANT_COUNT = 16;

/** Nakamura Motors: an open-front garage, two kei cars on show, a counter, a tool wall; three bicycles out front. */
export const buildMotors: BuildingBuilder = (ctx: BuildCtx, s: ShopDef) => {
  const { solid, glow, collide, collideRect, hangSign, shopFrame, pickAt } = ctx;
  const L = LOOK;
  const cx = s.cx;
  const counter = SHOP_COUNTERS.motors!;
  const counterX = (counter.x0 + counter.x1) / 2;
  const counterZ = (counter.z0 + counter.z1) / 2;
  const innerL = cx - s.w / 2 + 0.3 + 0.03 + 0.025; // face of the left inner wall panel
  const innerR = cx + s.w / 2 - 0.3 - 0.03 - 0.025;
  const backZ = FRONT_Z - s.d + 0.3 + 0.02 + 0.025; // face of the back inner wall panel

  shopFrame(s, { wall: L.wall, inner: L.inner, trim: L.orange, roof: L.roof, floor: L.floor, ceil: L.ceil, openH: L.openH });
  hangSign('motors', s, '中村モータース', 'nakamura motors', L.navy, '#ffd9a8', L.openH, L.band, L.orange);
  glow.boxB(cx, L.openH - 0.1, FRONT_Z + 0.08, s.w - 1.2, 0.07, 0.05, '#ffe2b8'); // light strip under the header
  solid.boxB(cx, FLOOR_Y, FRONT_Z - 0.45, s.w - 1.2, 0.02, 0.2, L.yellow); // threshold stripe

  // ---- the cars on show (collider = keiRect), each in a painted bay; one faces each way so they stand nose-out ----
  MOTORS_CARS.forEach((c, i) => {
    addKei(solid, glow, c.x, c.z, i % 2 ? 0 : Math.PI, L.cars[i % L.cars.length], FLOOR_Y);
    collideRect(keiRect(c));
    const bay = { w: KEI.len + 0.5, d: KEI.wid + 0.5 };
    for (const sz of [-1, 1]) solid.boxB(c.x, FLOOR_Y, c.z + sz * bay.d / 2, bay.w, 0.012, 0.07, L.white); // bay lines
    for (const sx of [-1, 1]) solid.boxB(c.x + sx * bay.w / 2, FLOOR_Y, c.z, 0.07, 0.012, bay.d, L.white);
    const stain = 0.42 + 0.1 * i;
    solid.cyl(c.x + (i ? -0.5 : 0.6), FLOOR_Y, c.z + 0.2, stain, stain, 0.008, '#74767e', { seg: 14 }); // oil stain
    // a price card behind the windscreen side of the bay
    solid.boxB(c.x, FLOOR_Y, c.z + 1.25, 0.34, 0.5, 0.03, L.white, { rx: -0.15 });
    solid.boxB(c.x, FLOOR_Y + 0.28, c.z + 1.268, 0.26, 0.1, 0.01, L.red, { rx: -0.15 });
  });

  // ---- counter, staff floor, things on the counter ----
  solid.boxB(STAFF.x, FLOOR_Y, STAFF.z, STAFF.w, STAFF.top - FLOOR_Y, STAFF.d, '#7c7f88');
  solid.boxB(counterX, FLOOR_Y, counterZ, counter.x1 - counter.x0, 0.82, counter.z1 - counter.z0, L.orange);
  solid.boxB(counterX, FLOOR_Y + 0.82, counterZ, counter.x1 - counter.x0 + 0.2, 0.08, counter.z1 - counter.z0 + 0.2, '#e9dcc0');
  glow.boxB(counterX, FLOOR_Y + 0.5, counterZ + (counter.z1 - counter.z0) / 2 + 0.01, counter.x1 - counter.x0 - 0.5, 0.06, 0.01, '#ffe2b8'); // lit strip on the counter front
  const top = FLOOR_Y + 0.9;
  solid.boxB(counterX - 0.6, top, counterZ, 0.4, 0.2, 0.3, L.dark); // register
  glow.boxB(counterX - 0.6, top + 0.2, counterZ + 0.1, 0.3, 0.01, 0.1, '#8be0c5');
  solid.boxB(counterX + 0.2, top, counterZ - 0.05, 0.3, 0.05, 0.2, L.steel); // service bell on a tray
  solid.cyl(counterX + 0.2, top + 0.05, counterZ - 0.05, 0.05, 0.07, 0.05, L.yellow, { seg: 8 });
  L.helmets.slice(0, 2).forEach((c, i) => dome(solid, counterX + 0.85 + i * 0.3, top + 0.02, counterZ + 0.05, 0.16, c)); // helmets for sale
  solid.boxB(counterX - 1.0, top, counterZ + 0.2, 0.18, 0.28, 0.02, L.white, { rx: -0.2 }); // price list card
  glow.boxB(counterX - 1.0, top + 0.18, counterZ + 0.21, 0.14, 0.04, 0.01, '#d8433f', { rx: -0.2 });

  // ---- behind the staff: pegboard tool wall over a workbench ----
  const tw = TOOL_WALL;
  const twCx = (tw.x0 + tw.x1) / 2;
  const twW = tw.x1 - tw.x0;
  solid.boxB(twCx, FLOOR_Y + 0.9, tw.boardZ, twW, 1.65, 0.08, '#c9a97a'); // pegboard
  solid.boxB(twCx, FLOOR_Y + 2.55, tw.boardZ, twW + 0.1, 0.08, 0.14, L.orange); // top rail
  const front = tw.boardZ + 0.06; // face of the board
  for (let i = 0; i < 6; i++) { // spanners in a row
    const x = tw.x0 + 0.5 + i * 0.22;
    solid.boxB(x, FLOOR_Y + 1.9 + (i % 2) * 0.05, front, 0.05, 0.5 - i * 0.03, 0.025, L.steel, { rz: 0.06 * (i % 3) });
  }
  solid.boxB(tw.x0 + 2.2, FLOOR_Y + 2.0, front, 0.05, 0.4, 0.03, L.wood); // hammer
  solid.boxB(tw.x0 + 2.2, FLOOR_Y + 2.34, front, 0.24, 0.1, 0.05, L.dark);
  for (const dx of [2.6, 2.85]) { // pliers
    solid.boxB(tw.x0 + dx, FLOOR_Y + 1.95, front, 0.06, 0.2, 0.03, L.steel);
    solid.boxB(tw.x0 + dx, FLOOR_Y + 1.7, front, 0.07, 0.26, 0.035, L.red);
  }
  solid.boxB(tw.x0 + 3.5, FLOOR_Y + 1.85, front, 0.5, 0.14, 0.02, L.steel); // saw blade
  solid.boxB(tw.x0 + 3.2, FLOOR_Y + 1.85, front, 0.14, 0.16, 0.04, L.wood);
  for (const dx of [4.4, 4.85]) { // spare bicycle wheels on hooks
    ring(solid, tw.x0 + dx, FLOOR_Y + 1.55, front, 0.3, 0.035, L.tyre);
    solid.cyl(tw.x0 + dx, FLOOR_Y + 1.52, front, 0.04, 0.04, 0.06, L.steel, { rx: Math.PI / 2, seg: 8 });
  }
  solid.boxB(tw.x0 + 1.1, FLOOR_Y + 1.1, front, 0.55, 0.12, 0.04, L.yellow); // tape and a tray of small parts
  solid.boxB(tw.x0 + 2.4, FLOOR_Y + 1.1, front, 0.8, 0.12, 0.05, L.steel);
  for (let i = 0; i < 4; i++) solid.boxB(tw.x0 + 2.1 + i * 0.2, FLOOR_Y + 1.2, front, 0.1, 0.1, 0.04, L.cans[i]);
  glow.boxB(twCx, FLOOR_Y + 2.45, front + 0.04, twW - 0.4, 0.04, 0.03, '#fff2d6'); // work lamp strip
  solid.boxB(twCx, FLOOR_Y, tw.benchZ, twW - 0.3, 0.84, 0.75, L.wood); // workbench
  solid.boxB(twCx, FLOOR_Y + 0.84, tw.benchZ, twW - 0.2, 0.06, 0.85, '#6b4f3a');
  const bench = FLOOR_Y + 0.9;
  solid.boxB(tw.x0 + 0.8, bench, tw.benchZ, 0.22, 0.18, 0.2, L.dark); // vice
  solid.cyl(tw.x0 + 2.0, bench, tw.benchZ, 0.3, 0.3, 0.2, L.tyre, { seg: 12 }); // a tyre being mended
  solid.cyl(tw.x0 + 2.0, bench + 0.2, tw.benchZ, 0.16, 0.16, 0.01, L.steel, { seg: 10 });
  solid.cyl(tw.x0 + 3.1, bench, tw.benchZ + 0.1, 0.04, 0.04, 0.45, L.steel, { seg: 6 }); // pump
  solid.boxB(tw.x0 + 3.1, bench + 0.4, tw.benchZ + 0.1, 0.18, 0.04, 0.04, L.red);
  solid.boxB(tw.x0 + 4.1, bench, tw.benchZ, 0.5, 0.2, 0.3, L.red); // tool box
  solid.boxB(tw.x0 + 4.1, bench + 0.2, tw.benchZ, 0.2, 0.03, 0.05, L.steel);

  // ---- left wall: helmets and parts shelves ----
  const shelfX = innerL + 0.2;
  for (let r = 0; r < 3; r++) {
    const y = FLOOR_Y + 0.8 + r * 0.55;
    solid.boxB(shelfX, y, FRONT_Z - 4.4, 0.4, 0.04, 3.0, L.wood);
    for (let c = 0; c < 4; c++) {
      const z = FRONT_Z - 3.2 - c * 0.7;
      if (r === 2) dome(solid, shelfX, y + 0.04, z, 0.17, L.helmets[c % L.helmets.length]); // helmets
      else solid.boxB(shelfX, y + 0.04, z, 0.28, 0.2 + (c % 2) * 0.06, 0.4, c % 2 ? L.white : L.cans[(c + r) % L.cans.length]); // boxed parts
    }
  }
  solid.boxB(shelfX, FLOOR_Y, FRONT_Z - 4.4, 0.4, 0.8, 3.0, L.navy); // cabinet under the shelves

  // ---- back wall: oil shelf, tyre stacks, rolling tool chest, compressor ----
  for (const y of [1.3, 1.9]) solid.boxB(cx + 3.4, y, backZ + 0.2, 6.0, 0.05, 0.4, L.wood);
  for (let i = 0; i < 12; i++) {
    const y = i < 6 ? 1.3 : 1.9;
    solid.cyl(cx + 0.9 + (i % 6) * 0.9, y + 0.05, backZ + 0.2, 0.13, 0.13, 0.32, L.cans[i % L.cans.length], { seg: 6 });
  }
  for (const [x, n] of [[innerR - 0.7, 4], [innerR - 1.5, 3]] as const) { // tyre stacks
    for (let i = 0; i < n; i++) {
      solid.cyl(x, FLOOR_Y + i * 0.2, backZ + 1.0, 0.33, 0.33, 0.2, L.tyre, { seg: 10 });
    }
    solid.cyl(x, FLOOR_Y + n * 0.2, backZ + 1.0, 0.18, 0.18, 0.005, '#4a4c58', { seg: 8 }); // the top tyre's rim
  }
  solid.boxB(cx - 0.8, FLOOR_Y, backZ + 0.5, 0.9, 1.0, 0.5, L.red); // rolling tool chest
  solid.boxB(cx - 0.8, FLOOR_Y + 1.0, backZ + 0.5, 0.96, 0.05, 0.54, L.dark);
  for (let i = 0; i < 3; i++) solid.boxB(cx - 0.8, FLOOR_Y + 0.15 + i * 0.28, backZ + 0.76, 0.5, 0.03, 0.02, L.steel);
  solid.cyl(cx - 2.8, FLOOR_Y + 0.35, backZ + 0.7, 0.28, 0.28, 0.9, '#3b6fb6', { seg: 10, rz: Math.PI / 2 }); // air compressor
  for (const dx of [-0.3, 0.3]) solid.boxB(cx - 2.8 + dx, FLOOR_Y, backZ + 0.7, 0.05, 0.36, 0.4, L.dark);
  glow.boxB(cx + 3.4, 2.7, backZ + 0.05, 2.4, 0.5, 0.02, '#ffe2b8'); // a backlit poster panel
  solid.boxB(cx + 3.4, 2.62, backZ + 0.03, 2.6, 0.66, 0.03, L.orange);

  // ---- garland of pennants over the open front ----
  const gy = L.openH - 0.4;
  solid.boxB(cx, gy + 0.18, FRONT_Z + 0.35, s.w - 1.6, 0.012, 0.012, L.dark);
  for (let i = 0; i < PENNANT_COUNT; i++) {
    const u = (i + 0.5) / PENNANT_COUNT;
    const x = cx - (s.w - 2) / 2 + u * (s.w - 2);
    const sag = 0.12 * Math.sin(u * Math.PI);
    solid.boxB(x, gy - sag + 0.02, FRONT_Z + 0.35, 0.16, 0.16, 0.01, L.pennants[i % L.pennants.length], { rz: Math.PI / 4 });
  }

  // ---- outside: bicycles for sale, oil drums, a roof wheel emblem ----
  MOTORS_BIKES.forEach((b, i) => {
    addBike(solid, glow, b.x, b.z, i === 1 ? -b.ry : b.ry, L.bikes[i % L.bikes.length]);
    collideRect(bikeRect(b));
  });
  const mid = MOTORS_BIKES[1];
  pickAt('bicycle', mid.x, 0.6, mid.z, 1.3);
  for (const [dx, c] of [[s.w / 2 + 1.2, L.red], [s.w / 2 + 1.9, '#3b6fb6']] as const) { // oil drums by the east wall
    const x = cx + dx;
    solid.cyl(x, 0, FRONT_Z + 0.7, 0.3, 0.3, 0.85, c, { seg: 10 });
    solid.cyl(x, 0.4, FRONT_Z + 0.7, 0.31, 0.31, 0.06, L.white, { seg: 10 });
    solid.cyl(x, 0.85, FRONT_Z + 0.7, 0.26, 0.26, 0.02, L.dark, { seg: 10 });
    collide(x, FRONT_Z + 0.7, 0.62, 0.62);
  }
  const roofY = s.h + 0.42;
  const wheelX = cx + 4.6;
  const wheelY = roofY + 1.25;
  for (const dx of [-0.5, 0.5]) solid.cyl(wheelX + dx, roofY, FRONT_Z - 1.6, 0.04, 0.05, 0.5, L.steel, { seg: 6 });
  ring(solid, wheelX, wheelY, FRONT_Z - 1.6, 0.8, 0.12, L.orange);
  solid.cyl(wheelX, wheelY - 0.08, FRONT_Z - 1.6, 0.14, 0.14, 0.16, L.steel, { rx: Math.PI / 2, seg: 10 });
  for (let i = 0; i < 3; i++) solid.boxB(wheelX, wheelY - 0.01, FRONT_Z - 1.6, 1.4, 0.04, 0.05, L.steel, { rz: (i * Math.PI) / 3 });
  glow.sphere(wheelX, wheelY, FRONT_Z - 1.5, 0.1, '#ffe2b8', { ws: 8, hs: 6 });

  registerShutter(ctx, { cx, w: s.w, openH: L.openH });
  ctx.mapRect(shopRect(s), L.orange, 'motors');
};

/** The 準備中 shutter in the shop's colours: a ribbed slate slab over the opening with a cream plate. Hidden until the shop closes. */
function registerShutter(ctx: BuildCtx, o: ShopOpening): void {
  const g = new THREE.Group();
  const w = o.w - 0.6;
  const h = o.openH - 0.12;
  const z = FRONT_Z + 0.05;
  const b = new Batch();
  b.boxB(o.cx, FLOOR_Y, z, w, h, 0.06, '#8a8f9e', { jitter: 0 });
  for (let i = 0; i < Math.floor(h / 0.22); i++) b.boxB(o.cx, 0.2 + i * 0.22, z + 0.04, w, 0.05, 0.03, '#737889', { jitter: 0 });
  const slab = b.build(ctx.toon, { cast: false, receive: false, name: 'motors-shutter' });
  if (slab) {
    g.add(slab);
    ctx.own(slab.geometry);
  }
  const pw = Math.min(4.2, w - 1);
  const plate = ctx.signPlane('準備中', { bg: '#f4ecd6', fg: '#b3402f', sub: 'junbi-chū', subColor: LOOK.navy, border: LOOK.orange, round: 14 }, { x: o.cx, y: FLOOR_Y + h * 0.55, z: z + 0.09, w: pw, h: pw * 0.36 });
  ctx.group.remove(plate); // signPlane parks it in the city group; it lives in the shutter group instead
  g.add(plate);
  ctx.registerShutter('motors', g);
}
