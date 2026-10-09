import * as THREE from 'three';
import { Batch } from '../batch';
import type { BuildCtx, ShopOpening } from '../buildctx';
import { FRONT_Z, shopRect, type ShopDef } from '../layout';
import type { BuildingBuilder } from './index';

/** Look of the shop, in one place (everything else is geometry). */
const LOOK = {
  openH: 3.6,
  band: 1.9,
  wall: '#eef1f8',
  inner: '#dde5f2',
  blue: '#2a4bb8',
  navy: '#1d2f7a',
  yellow: '#ffd23f',
  roof: '#b9c3d8',
  floor: '#c9d2e2',
  ceil: '#f5f8fd',
  white: '#f7f9fc',
  steel: '#bfc7d4',
  dark: '#2b303c',
  /** phone body colours (cases) drawn from the shop's own stream */
  cases: ['#222831', '#e8eaf0', '#4cc9f0', '#f78fb3', '#ffd166', '#06d6a0', '#9b8cf0', '#ff6b6b'],
  /** TV pictures: [upper, lower] glow colours */
  scenes: [['#6ec6ff', '#3fa86b'], ['#ff9a62', '#7a4a9e'], ['#8fe3ff', '#2a6fd6'], ['#ffd78a', '#e0654a'], ['#b8f0c8', '#2e8a73']],
};

const FLOOR_Y = 0.12;
/** the staff floor behind the counter: the NPC `aoi` stands on it (NPC_SPAWNS.y 0.28) */
const STAFF = { z: FRONT_Z - 3.4, d: 2.2, w: 6, top: 0.28 };
const COUNTER = { z: FRONT_Z - 1.8, w: 5, d: 0.9 };
const PHONE_COLS = 12;
const PHONE_ROWS = 3;

/** Hikari Denki: a bright electronics shop, blue and yellow, with a phone wall, a TV wall and an appliance wall. */
export const buildDenki: BuildingBuilder = (ctx: BuildCtx, s: ShopDef) => {
  const { solid, glow, collide, hangSign, shopFrame } = ctx;
  const rnd = ctx.rng('denki');
  const pickOf = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
  const L = LOOK;
  const cx = s.cx;
  const innerL = cx - s.w / 2 + 0.3 + 0.03 + 0.025; // face of the left inner wall panel
  const innerR = cx + s.w / 2 - 0.3 - 0.03 - 0.025;
  const backZ = FRONT_Z - s.d + 0.3 + 0.02 + 0.025; // face of the back inner wall panel

  shopFrame(s, { wall: L.wall, inner: L.inner, trim: L.blue, roof: L.roof, floor: L.floor, ceil: L.ceil, openH: L.openH });
  hangSign('denki', s, 'ヒカリ電機', 'hikari denki', L.yellow, L.navy, L.openH, L.band, L.blue);
  glow.boxB(cx, L.openH - 0.1, FRONT_Z + 0.08, s.w - 1.2, 0.07, 0.05, '#fff2a8'); // light strip under the header
  solid.boxB(cx, FLOOR_Y, FRONT_Z - 0.45, s.w - 1.2, 0.02, 0.2, L.yellow); // threshold stripe

  // ---- counter, staff floor, things on the counter ----
  solid.boxB(cx, FLOOR_Y, STAFF.z, STAFF.w, STAFF.top - FLOOR_Y, STAFF.d, '#9aa5bd');
  solid.boxB(cx, FLOOR_Y, COUNTER.z, COUNTER.w, 0.82, COUNTER.d, L.blue);
  solid.boxB(cx, FLOOR_Y + 0.82, COUNTER.z, COUNTER.w + 0.2, 0.08, COUNTER.d + 0.2, L.white);
  glow.boxB(cx, FLOOR_Y + 0.5, COUNTER.z + COUNTER.d / 2 + 0.01, COUNTER.w - 0.6, 0.06, 0.01, '#fff2a8'); // lit strip on the counter front
  const top = FLOOR_Y + 0.9;
  solid.boxB(cx - 1.4, top, COUNTER.z, 0.5, 0.06, 0.34, L.dark); // tablet stand
  solid.box(cx - 1.4, top + 0.3, COUNTER.z - 0.04, 0.46, 0.34, 0.03, L.dark, { rx: -0.3 });
  glow.box(cx - 1.4, top + 0.3, COUNTER.z - 0.02, 0.4, 0.28, 0.01, '#8fe3ff', { rx: -0.3 });
  solid.boxB(cx + 0.2, top, COUNTER.z - 0.05, 0.3, 0.1, 0.2, L.dark); // card reader
  glow.boxB(cx + 0.2, top + 0.1, COUNTER.z + 0.04, 0.2, 0.01, 0.07, '#8be0c5');
  for (let i = 0; i < 3; i++) solid.boxB(cx + 1.5 + i * 0.05, top + i * 0.2, COUNTER.z, 0.5 - i * 0.05, 0.2, 0.3, [L.white, L.yellow, L.blue][i]); // phone boxes
  for (const dx of [-0.5, 2.1]) {
    solid.boxB(cx + dx, top, COUNTER.z + 0.1, 0.22, 0.04, 0.2, L.steel); // phone display stands
    solid.box(cx + dx, top + 0.19, COUNTER.z + 0.09, 0.15, 0.3, 0.02, pickOf(L.cases), { rx: -0.25 });
    glow.box(cx + dx, top + 0.19, COUNTER.z + 0.105, 0.12, 0.25, 0.01, '#9fd8ff', { rx: -0.25 });
  }

  // ---- back wall: TV wall over a low cabinet ----
  const cabZ = backZ + 0.32;
  solid.boxB(cx, FLOOR_Y, cabZ, 9.8, 0.7, 0.6, L.white);
  solid.boxB(cx, FLOOR_Y + 0.7, cabZ, 9.9, 0.05, 0.64, L.blue);
  [[-4.2, 1.4, 0.8, 1.45], [-2.2, 1.8, 1.0, 1.5], [0, 2.6, 1.5, 1.2], [2.2, 1.8, 1.0, 1.5], [4.2, 1.4, 0.8, 1.45]].forEach(([dx, w, h, y], i) => {
    const [up, lo] = L.scenes[i % L.scenes.length];
    const z = backZ + 0.06;
    solid.boxB(cx + dx, y, z, w, h, 0.1, L.dark); // bezel
    const lowH = (h - 0.12) * 0.4;
    glow.boxB(cx + dx, y + 0.06, z + 0.06, w - 0.12, lowH, 0.01, lo);
    glow.boxB(cx + dx, y + 0.06 + lowH, z + 0.06, w - 0.12, h - 0.12 - lowH, 0.01, up);
    if (dx === 0) glow.boxB(cx + 0.5, y + 0.06 + lowH + 0.1, z + 0.07, 0.3, 0.3, 0.012, '#fff6c8'); // the big screen's sun
  });
  for (const [dx, h, c] of [[-3.6, 0.2, L.dark], [-2.2, 0.28, L.yellow], [3.1, 0.24, L.dark], [4.0, 0.2, L.white]] as const) solid.boxB(cx + dx, FLOOR_Y + 0.75, cabZ, 0.7, h, 0.35, c); // consoles, boxes, soundbar
  for (const dx of [-1, 1]) solid.cyl(cx + dx, FLOOR_Y + 0.75, cabZ, 0.14, 0.16, 0.3, L.dark, { seg: 8 }); // speakers

  // ---- left wall: phone wall ----
  const rackX = innerL + 0.27;
  const rackZ0 = FRONT_Z - 1.6;
  const rackLen = 7.0;
  solid.boxB(rackX, FLOOR_Y, rackZ0 - rackLen / 2, 0.54, 0.8, rackLen, L.blue);
  solid.boxB(rackX, FLOOR_Y + 0.8, rackZ0 - rackLen / 2, 0.58, 0.05, rackLen + 0.04, L.white);
  for (let r = 0; r < PHONE_ROWS; r++) {
    const y = FLOOR_Y + 1.0 + r * 0.55;
    solid.boxB(rackX + 0.02, y - 0.04, rackZ0 - rackLen / 2, 0.52, 0.04, rackLen, L.white);
    for (let c = 0; c < PHONE_COLS; c++) {
      const z = rackZ0 - (c + 0.5) * (rackLen / PHONE_COLS);
      solid.boxB(rackX + 0.2, y, z, 0.05, 0.38, 0.19, pickOf(L.cases));
      glow.boxB(rackX + 0.232, y + 0.03, z, 0.012, 0.32, 0.15, rnd() < 0.5 ? '#9fd8ff' : '#ffe9a8');
    }
  }
  solid.boxB(rackX, FLOOR_Y + 2.62, rackZ0 - rackLen / 2, 0.52, 0.3, rackLen, L.navy);
  glow.boxB(rackX + 0.1, FLOOR_Y + 2.92, rackZ0 - rackLen / 2, 0.3, 0.1, rackLen, L.yellow); // lit header

  // ---- right wall: appliances (fridges, washers, a shelf of small things, an air conditioner) ----
  const appX = innerR - 0.42;
  const door = (x: number, y: number, z: number, w: number, h: number, d: number) => solid.boxB(x, y, z, w, h, d, L.dark);
  solid.boxB(appX, FLOOR_Y, FRONT_Z - 2.4, 0.8, 2.1, 0.95, L.white); // tall fridge
  door(appX - 0.41, FLOOR_Y + 1.15, FRONT_Z - 2.4, 0.02, 0.04, 0.9);
  door(appX - 0.42, FLOOR_Y + 1.3, FRONT_Z - 2.12, 0.03, 0.5, 0.05);
  solid.boxB(appX, FLOOR_Y, FRONT_Z - 3.5, 0.8, 1.7, 0.9, L.steel); // small fridge
  door(appX - 0.41, FLOOR_Y + 0.85, FRONT_Z - 3.5, 0.02, 0.04, 0.86);
  for (const z of [FRONT_Z - 4.7, FRONT_Z - 5.7]) {
    solid.boxB(appX, FLOOR_Y, z, 0.8, 0.95, 0.85, L.white); // washing machine
    door(appX - 0.405, FLOOR_Y + 0.25, z, 0.02, 0.5, 0.5);
    glow.boxB(appX - 0.42, FLOOR_Y + 0.31, z, 0.012, 0.38, 0.38, '#9cc8e8');
    glow.boxB(appX - 0.41, FLOOR_Y + 0.8, z + 0.25, 0.012, 0.07, 0.2, '#8be0c5');
  }
  solid.boxB(appX + 0.1, FLOOR_Y, FRONT_Z - 7.3, 0.55, 0.9, 1.8, L.blue); // shelf with small appliances
  solid.boxB(appX + 0.1, FLOOR_Y + 0.9, FRONT_Z - 7.3, 0.6, 0.05, 1.85, L.white);
  solid.cyl(appX + 0.05, FLOOR_Y + 0.95, FRONT_Z - 6.8, 0.17, 0.2, 0.3, L.white, { seg: 10 }); // rice cooker
  solid.cyl(appX + 0.05, FLOOR_Y + 1.25, FRONT_Z - 6.8, 0.1, 0.17, 0.06, L.steel, { seg: 10 });
  solid.boxB(appX + 0.05, FLOOR_Y + 0.95, FRONT_Z - 7.5, 0.4, 0.26, 0.5, L.steel); // microwave
  glow.boxB(appX - 0.16, FLOOR_Y + 1.02, FRONT_Z - 7.5, 0.012, 0.2, 0.34, '#ffe9a8');
  solid.cyl(appX + 0.05, FLOOR_Y + 0.95, FRONT_Z - 8.0, 0.1, 0.14, 0.26, L.yellow, { seg: 8 }); // kettle
  solid.boxB(innerR - 0.2, FLOOR_Y + 2.45, FRONT_Z - 5.2, 0.35, 0.4, 1.7, L.white); // air conditioner
  glow.boxB(innerR - 0.39, FLOOR_Y + 2.52, FRONT_Z - 5.2, 0.012, 0.05, 1.5, '#9fd8ff');

  // ---- display tables ----
  const laptop = (x: number, y: number, z: number) => {
    solid.boxB(x, y, z, 0.38, 0.02, 0.27, L.steel);
    solid.box(x, y + 0.14, z - 0.12, 0.38, 0.26, 0.02, L.dark, { rx: -0.22 });
    glow.box(x, y + 0.14, z - 0.104, 0.33, 0.21, 0.01, pickOf(['#8fe3ff', '#ffd78a', '#b8f0c8']), { rx: -0.22 });
  };
  const table = (x: number, z: number) => {
    solid.cyl(x, FLOOR_Y, z, 0.35, 0.4, 0.04, L.blue, { seg: 12 });
    solid.cyl(x, FLOOR_Y, z, 0.1, 0.12, 0.66, L.steel, { seg: 8 });
    solid.boxB(x, FLOOR_Y + 0.66, z, 1.7, 0.07, 1.0, L.white);
    solid.boxB(x, FLOOR_Y + 0.7, z + 0.5, 1.72, 0.04, 0.04, L.yellow);
    return FLOOR_Y + 0.73;
  };
  const tl = table(cx - 3.4, FRONT_Z - 6.2);
  laptop(cx - 3.8, tl, FRONT_Z - 6.2);
  laptop(cx - 3.0, tl, FRONT_Z - 6.2);
  const tr = table(cx + 3.4, FRONT_Z - 6.2);
  for (const dx of [-0.55, 0, 0.55]) { // tablets on stands
    solid.boxB(cx + 3.4 + dx, tr, FRONT_Z - 6.15, 0.2, 0.03, 0.16, L.steel);
    solid.box(cx + 3.4 + dx, tr + 0.2, FRONT_Z - 6.2, 0.3, 0.22, 0.02, pickOf(L.cases), { rx: -0.3 });
    glow.box(cx + 3.4 + dx, tr + 0.2, FRONT_Z - 6.185, 0.26, 0.18, 0.01, pickOf(['#8fe3ff', '#ffd78a', '#f7b3d0']), { rx: -0.3 });
  }
  solid.torus(cx + 3.95, tr + 0.2, FRONT_Z - 5.9, 0.13, 0.025, L.dark, { arc: Math.PI }); // headphones
  solid.cyl(cx + 3.82, tr, FRONT_Z - 5.9, 0.06, 0.06, 0.1, L.blue, { seg: 8 });
  solid.cyl(cx + 4.08, tr, FRONT_Z - 5.9, 0.06, 0.06, 0.1, L.blue, { seg: 8 });

  // ---- hanging pop banners ----
  for (const [dx, dz] of [[-3.4, -6.2], [0, -8.0], [3.4, -6.2]] as const) {
    const y = L.openH - 0.12;
    solid.cyl(cx + dx - 0.4, y - 0.3, FRONT_Z + dz, 0.01, 0.01, 0.3, '#555');
    solid.cyl(cx + dx + 0.4, y - 0.3, FRONT_Z + dz, 0.01, 0.01, 0.3, '#555');
    solid.boxB(cx + dx, y - 0.72, FRONT_Z + dz, 1.1, 0.42, 0.05, '#e5453d');
    glow.boxB(cx + dx, y - 0.62, FRONT_Z + dz + 0.03, 0.8, 0.12, 0.01, '#fff2a8');
  }

  // ---- outside: phone and TV standees, roof dish and light-bulb emblem ----
  const standee = (x: number, w: number, h: number, screen: string) => {
    solid.boxB(x, 0, FRONT_Z + 0.9, w, h, 0.1, L.blue, { rx: 0.12 });
    glow.boxB(x, 0.12, FRONT_Z + 0.97, w - 0.2, h - 0.35, 0.01, screen, { rx: 0.12 });
    glow.boxB(x, h - 0.2, FRONT_Z + 0.97, w - 0.2, 0.1, 0.01, L.yellow, { rx: 0.12 });
    collide(x, FRONT_Z + 0.9, w + 0.1, 0.5);
  };
  standee(cx - 4.6, 0.9, 1.6, '#8fe3ff');
  standee(cx + 4.6, 1.2, 1.2, '#ffd78a');
  const roofY = s.h + 0.42;
  solid.cyl(cx - 3.5, roofY, FRONT_Z - 4, 0.05, 0.07, 0.9, L.steel, { seg: 6 }); // satellite dish
  solid.cyl(cx - 3.5, roofY + 0.85, FRONT_Z - 3.8, 0.7, 0.12, 0.3, L.white, { seg: 12, rx: 0.9 });
  solid.cyl(cx + 3.5, roofY, FRONT_Z - 5, 0.04, 0.06, 1.8, L.steel, { seg: 6 }); // antenna
  for (const dy of [1.0, 1.4, 1.7]) solid.boxB(cx + 3.5, roofY + dy, FRONT_Z - 5, 0.8 - (dy - 1) * 0.5, 0.04, 0.04, L.steel);
  solid.cyl(cx + 4.7, roofY, FRONT_Z - 1.4, 0.14, 0.18, 0.5, L.blue, { seg: 8 }); // light-bulb emblem (hikari = light)
  glow.sphere(cx + 4.7, roofY + 0.95, FRONT_Z - 1.4, 0.5, '#fff2a8', { ws: 12, hs: 10 });

  registerShutter(ctx, { cx, w: s.w, openH: L.openH });
  ctx.mapRect(shopRect(s), L.blue, 'denki');
};

/** The 準備中 shutter in the shop's colours: a ribbed blue slab over the opening with a yellow plate. Hidden until the shop closes. */
function registerShutter(ctx: BuildCtx, o: ShopOpening): void {
  const g = new THREE.Group();
  const w = o.w - 0.6;
  const h = o.openH - 0.12;
  const z = FRONT_Z + 0.05;
  const b = new Batch();
  b.boxB(o.cx, FLOOR_Y, z, w, h, 0.06, '#7d8cc4', { jitter: 0 });
  for (let i = 0; i < Math.floor(h / 0.22); i++) b.boxB(o.cx, 0.2 + i * 0.22, z + 0.04, w, 0.05, 0.03, '#6676b4', { jitter: 0 });
  const slab = b.build(ctx.toon, { cast: false, receive: false, name: 'denki-shutter' });
  if (slab) {
    g.add(slab);
    ctx.own(slab.geometry);
  }
  const pw = Math.min(4.2, w - 1);
  const plate = ctx.signPlane('準備中', { bg: LOOK.yellow, fg: '#b3402f', sub: 'junbi-chū', subColor: LOOK.navy, border: LOOK.blue, round: 14 }, { x: o.cx, y: FLOOR_Y + h * 0.55, z: z + 0.09, w: pw, h: pw * 0.36 });
  ctx.group.remove(plate); // signPlane parks it in the city group; it lives in the shutter group instead
  g.add(plate);
  ctx.registerShutter('denki', g);
}
