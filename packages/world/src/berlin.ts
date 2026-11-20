// Berlin (German step 3): one street in Kreuzberg. North side: the open fronts of Bäckerei Krüger, the Späti, the Döner stand and the
// BVG ticket counter, each under four floors of Altbau. South side: the WG's front door (Lena), the courtyard gate (Kofi) and the café
// (Jonas); at the east end, Mauerpark with the Sunday flea market (Greta's stall). Linden trees, a Litfaß column, the blue U sign, bike
// stands, old street lamps; no overhead wires, no vending machines. Units are metres, +x east, +z south, the north fronts face +z.
import * as THREE from 'three';
import { Batch, resetJitter } from './batch';
import { createBuildCtx, makeShutter, type BuildCtx } from './buildctx';
import type { City } from './city';
import type { District } from './district';
import { FRONT_Z, shopRect, type NpcSpawn, type Rect, type ShopBox, type WalkerDef } from './layout';
import { asphaltTexture, blobTexture, grassTexture, sidewalkTexture, skyMaterial } from './textures';

/** the four open fronts of the north side (their staff stand behind the counter, on the raised floor) */
export const BERLIN_SHOPS: ShopBox[] = [
  { id: 'bakery', cx: -28, w: 12, d: 10, h: 5.2 },
  { id: 'spaeti', cx: -13, w: 10, d: 9, h: 5.0 },
  { id: 'doener', cx: 1, w: 10, d: 9, h: 5.0 },
  { id: 'ubahn', cx: 17, w: 12, d: 10, h: 5.4 },
];

const SOUTH_Z = 9.7; // the front plane of the south side
const PARK: Rect = { x0: 30, x1: 60, z0: SOUTH_Z, z1: 30 };
export const BERLIN_BOUNDS: Rect = { x0: -46, x1: 60, z0: -8.3, z1: 29 };

export const BERLIN_SPAWNS: NpcSpawn[] = [
  { id: 'jana', x: -28, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.28, site: 'bakery' },
  { id: 'murat', x: -13, z: -12.0, face: 0, radius: 5.2, kind: 'scenario', y: 0.28, site: 'spaeti' },
  { id: 'emre', x: 1, z: -12.0, face: 0, radius: 5.2, kind: 'scenario', y: 0.28, site: 'doener' },
  { id: 'sabine', x: 17, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.28, site: 'ubahn' },
  // the south side faces the street (-z)
  { id: 'lena', x: -21, z: 9.0, face: Math.PI, radius: 4.6, kind: 'scenario', site: 'wg' },
  { id: 'kofi', x: -3.2, z: 9.0, face: Math.PI, radius: 4.6, kind: 'scenario', site: 'hof' },
  { id: 'jonas', x: 15.6, z: 8.3, face: Math.PI, radius: 4.6, kind: 'scenario', site: 'berlin_cafe' },
  // behind her table at the flea market, facing the path
  { id: 'greta', x: 40, z: 13.7, face: Math.PI, radius: 4.8, kind: 'scenario', site: 'flohmarkt' },
];

const WALKERS: WalkerDef[] = [
  { spec: 0, route: { points: [[-40, -7.4], [26, -7.4]], speed: 1.2, loop: false } },
  { spec: 1, route: { points: [[26, 7.6], [-40, 7.6]], speed: 1.0, loop: false } },
  { spec: 3, route: { points: [[34, 18], [54, 18], [54, 24], [34, 24]], speed: 0.9, loop: true } },
];

/** pastel Altbau plaster, Berlin's colours: cream, ochre, grey-blue, old pink, sand, pale green */
const PLASTER = ['#efe3c8', '#e2c48f', '#b9c6cf', '#e6c2b8', '#d8cbb3', '#c9d6bf'];

export const BERLIN_DISTRICT: District = {
  id: 'berlin',
  bounds: BERLIN_BOUNDS,
  shops: BERLIN_SHOPS,
  npcSpawns: BERLIN_SPAWNS,
  doors: [],
  spots: [],
  walkers: WALKERS,
  playerStart: { x: -24, z: 3, heading: Math.PI },
  build(ctx) {
    buildBerlinFronts(ctx);
  },
  buildCity: () => buildBerlinCity(),
};

/** Four (or three) floors of Altbau over a ground floor, with tall windows, small balconies and a cornice; the front faces `face`. */
function altbau(ctx: BuildCtx, x0: number, x1: number, zFront: number, depth: number, y0: number, top: number, colour: string, face: 1 | -1): void {
  const { solid, glow } = ctx;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const zc = zFront - (face * depth) / 2;
  solid.boxB(cx, y0, zc, w, top - y0, depth, colour);
  // cornice and roof
  solid.boxB(cx, top, zFront - (face * depth) / 2, w + 0.3, 0.45, depth + 0.5, '#8d8478');
  solid.boxB(cx, top + 0.45, zc - face * 0.8, w, 1.4, depth - 1.6, '#8a4b3a');
  const zWin = zFront + face * 0.03;
  for (let y = y0 + 0.9; y + 1.9 < top; y += 3.1) {
    for (let x = x0 + 1.1; x + 0.9 <= x1; x += 2.3) {
      solid.boxB(x + 0.55, y - 0.12, zFront + face * 0.015, 1.34, 2.14, 0.03, '#f6f1e7');
      glow.boxB(x + 0.55, y, zWin, 1.1, 1.9, 0.02, (Math.round(x * 3 + y) & 3) === 0 ? '#f5d58a' : '#3b4a5e');
      glow.boxB(x + 0.55, y + 0.55, zWin + face * 0.005, 1.1, 0.06, 0.01, '#f6f1e7');
    }
    // a small balcony every other bay on the second and fourth floors
    if (((y - y0) / 3.1) % 2 < 1 && y > y0 + 2) {
      for (let x = x0 + 2.2; x + 1 <= x1; x += 4.6) {
        solid.boxB(x + 0.55, y - 0.3, zFront + face * 0.45, 1.9, 0.14, 0.9, '#9a9184');
        solid.boxB(x + 0.55, y - 0.16, zFront + face * 0.88, 1.9, 0.75, 0.05, '#4a4f55');
      }
    }
  }
}

function buildBerlinFronts(ctx: BuildCtx): void {
  const { solid, glow, collide, occlude, shopFrame, hangSign, signPlane, markBuilt, mapRect } = ctx;
  const R = ctx.rng('berlin');
  const shop = (id: string) => BERLIN_SHOPS.find((s) => s.id === id)!;
  const pick = <T,>(a: readonly T[]) => a[Math.floor(R() * a.length)]!;

  // ---------- north side: the four shops under Altbau ----------
  const bakery = shop('bakery');
  shopFrame(bakery, { wall: '#f4ead8', inner: '#f7efe0', trim: '#8a5a32', roof: '#d7c6a8', floor: '#d9c7a6', ceil: '#fbf5ea', openH: 3.4 });
  hangSign('bakery', bakery, 'Bäckerei Krüger', 'Brot · Brötchen · Kuchen', '#f1e2c6', '#6b3f22', 3.4, 1.6, '#8a5a32');
  solid.boxB(bakery.cx, 0.12, FRONT_Z - 2.3, 8, 0.95, 1.1, '#8a5a32'); // the counter
  glow.boxB(bakery.cx, 1.07, FRONT_Z - 2.3, 7.6, 0.5, 0.9, '#fdf4df'); // the glass display
  for (let i = 0; i < 14; i++) solid.sphere(bakery.cx - 3.4 + i * 0.52, 1.15, FRONT_Z - 2.3 + (i % 2) * 0.25, 0.17, i % 3 ? '#c68a4e' : '#a8672f', { sy: 0.6, ws: 8, hs: 6 });
  for (let r = 0; r < 3; r++) for (let i = 0; i < 9; i++) solid.boxB(bakery.cx - 4 + i, 0.6 + r * 0.7, FRONT_Z - 9.2, 0.7, 0.32, 0.4, pick(['#b9773e', '#d29a5c', '#8e5326']));
  mapRect(shopRect(bakery), '#c68a4e', 'Bäckerei');

  const spaeti = shop('spaeti');
  shopFrame(spaeti, { wall: '#2b3a55', inner: '#eef1f5', trim: '#ffd166', roof: '#3a4a66', floor: '#c9ced6', ceil: '#f4f6f9', openH: 3.3 });
  hangSign('spaeti', spaeti, 'Späti', 'Spätkauf · bis 2 Uhr', '#1d3557', '#ffd166', 3.3, 1.5, '#ffd166');
  solid.boxB(spaeti.cx + 1.5, 0.12, FRONT_Z - 2.3, 5, 0.95, 1.0, '#ffd166');
  for (const dx of [-3.2, -1.2, 1.2, 3.2]) {
    solid.boxB(spaeti.cx + dx, 0.12, FRONT_Z - 8.5, 1.8, 2.4, 0.6, '#ffffff');
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) glow.cyl(spaeti.cx + dx - 0.7 + k * 0.35, 0.5 + r * 0.55, FRONT_Z - 8.15, 0.07, 0.07, 0.34, pick(['#5fbf6a', '#e8a33d', '#c94b4b', '#5b8fd6', '#f2e3b3']), { seg: 6 });
  }
  glow.boxB(spaeti.cx - 4.3, 0.4, FRONT_Z - 5, 0.04, 1.9, 4.5, '#cfe9f7'); // the drinks fridge
  mapRect(shopRect(spaeti), '#1d3557', 'Späti');

  const doener = shop('doener');
  shopFrame(doener, { wall: '#f5efe6', inner: '#fbf6ee', trim: '#c0392b', roof: '#d9cfc2', floor: '#d6cbbd', ceil: '#fffaf2', openH: 3.3 });
  hangSign('doener', doener, 'Döner am Kotti', 'Döner · Dürüm · Falafel', '#c0392b', '#ffffff', 3.3, 1.5, '#ffffff');
  solid.boxB(doener.cx, 0.12, FRONT_Z - 2.3, 7, 0.95, 1.0, '#e8e2d8');
  solid.cyl(doener.cx - 2.2, 1.1, FRONT_Z - 4.2, 0.36, 0.28, 1.2, '#9a5a2b', { seg: 12 }); // the spit
  glow.boxB(doener.cx - 2.2, 1.0, FRONT_Z - 4.75, 0.9, 1.5, 0.05, '#ff9a4a'); // the grill's glow
  glow.boxB(doener.cx + 1.5, 2.5, FRONT_Z - 8.9, 4.5, 1.1, 0.03, '#2b2b2b'); // the menu board
  for (let i = 0; i < 5; i++) glow.boxB(doener.cx - 0.3 + i * 0.9, 2.55, FRONT_Z - 8.86, 0.7, 0.5, 0.02, pick(['#f2c14e', '#ffffff', '#e05a47']));
  mapRect(shopRect(doener), '#c0392b', 'Döner');

  const ubahn = shop('ubahn');
  shopFrame(ubahn, { wall: '#f0d722', inner: '#f6f3e6', trim: '#1a1a1a', roof: '#d8c21f', floor: '#bdbdb5', ceil: '#fbfaf2', openH: 3.6 });
  hangSign('ubahn', ubahn, 'BVG', 'Fahrkarten · Tickets', '#f0d722', '#1a1a1a', 3.6, 1.6, '#1a1a1a');
  solid.boxB(ubahn.cx, 0.12, FRONT_Z - 2.3, 8, 1.0, 1.0, '#e9e4d2');
  glow.boxB(ubahn.cx, 1.5, FRONT_Z - 2.3, 7.8, 0.9, 0.04, '#d9eef7'); // the glass over the counter
  glow.boxB(ubahn.cx, 2.6, FRONT_Z - 9.3, 7, 1.8, 0.04, '#e8eef3'); // the network map
  for (let i = 0; i < 9; i++) glow.boxB(ubahn.cx - 3 + i * 0.75, 2.2 + (i % 3) * 0.5, FRONT_Z - 9.26, 0.7, 0.06, 0.02, pick(['#55a822', '#e44c16', '#f0d722', '#2e76b6', '#8c6dab', '#b1662c']));
  mapRect(shopRect(ubahn), '#f0d722', 'BVG');

  // the Altbau over the shops, and the houses between them
  for (const s of BERLIN_SHOPS) altbau(ctx, s.cx - s.w / 2, s.cx + s.w / 2, FRONT_Z, s.d, s.h, 17, pick(PLASTER), 1);
  const northGaps: Array<[number, number]> = [[-46, -34], [-22, -18], [-8, -4], [6, 11], [23, 60]];
  for (const [x0, x1] of northGaps) {
    altbau(ctx, x0, x1, FRONT_Z, 12, 0, 17, pick(PLASTER), 1);
    for (let x = x0 + 1.5; x + 1 < x1; x += 4) {
      solid.boxB(x + 0.6, 0, FRONT_Z + 0.02, 1.4, 2.6, 0.06, '#5a4636'); // a front door
      glow.boxB(x + 0.6, 2.25, FRONT_Z + 0.06, 1.0, 0.25, 0.01, '#f5d58a');
    }
    collide((x0 + x1) / 2, FRONT_Z - 6, x1 - x0, 12);
    occlude({ x0, x1, z0: FRONT_Z - 12, z1: FRONT_Z });
  }

  // ---------- south side: the WG, the courtyard gate, the café ----------
  const south: Array<[number, number]> = [[-46, -28], [-28, -14], [-14, 6], [6, 28]];
  for (const [x0, x1] of south) altbau(ctx, x0, x1, SOUTH_Z, 12, 0, 16.5, pick(PLASTER), -1);
  collide(-9, SOUTH_Z + 6, 74, 12);
  occlude({ x0: -46, x1: 28, z0: SOUTH_Z, z1: SOUTH_Z + 12 });
  mapRect({ x0: -46, x1: 28, z0: SOUTH_Z, z1: SOUTH_Z + 12 }, '#d8cbb3');
  // the WG: a green front door, its number, the bell panel
  solid.boxB(-21, 0, SOUTH_Z - 0.04, 1.6, 2.9, 0.1, '#2f5d46');
  solid.boxB(-21, 2.9, SOUTH_Z - 0.04, 1.9, 0.5, 0.1, '#e8e0cf');
  signPlane('12', { bg: '#1f3c5a', fg: '#ffffff', round: 6 }, { x: -21, y: 3.15, z: SOUTH_Z - 0.12, w: 0.5, h: 0.32, ry: Math.PI });
  solid.boxB(-19.9, 1.1, SOUTH_Z - 0.06, 0.3, 0.6, 0.05, '#c9a75a');
  markBuilt('wg');
  // the courtyard gate: an arched passage into the Hof, a bike leaning beside it
  glow.boxB(-3.2, 0, SOUTH_Z - 0.02, 3.4, 3.6, 0.04, '#2a2622');
  solid.boxB(-3.2, 3.6, SOUTH_Z - 0.06, 3.9, 0.45, 0.12, '#8d8478');
  bike(ctx, -1.2, 8.9, 0.15);
  ctx.pickAt('fahrrad', -1.2, 0.7, 8.9, 1.0);
  markBuilt('hof');
  // the café: big warm windows, an awning, two tables outside
  glow.boxB(14, 0.5, SOUTH_Z - 0.03, 7, 2.6, 0.04, '#f6d9a1');
  for (let i = 0; i < 8; i++) solid.boxB(10.85 + i * 0.9, 3.3, SOUTH_Z - 0.8, 0.9, 0.12, 1.6, i % 2 ? '#2f6b5a' : '#f4efe6', { rx: -0.25 });
  signPlane('Café Tandem', { bg: '#2f6b5a', fg: '#f4efe6', round: 8 }, { x: 14, y: 3.9, z: SOUTH_Z - 0.1, w: 3.4, h: 0.7, ry: Math.PI, pickId: 'cafe_sign' });
  for (const tx of [12.2, 15.6]) {
    solid.cyl(tx, 0, 7.4, 0.05, 0.05, 0.72, '#3a3a3a', { seg: 6 });
    solid.cyl(tx, 0.72, 7.4, 0.42, 0.42, 0.04, '#e8e2d8', { seg: 14 });
    for (const dx of [-0.65, 0.65]) solid.boxB(tx + dx, 0, 7.4, 0.42, 0.45, 0.42, '#3a3a3a');
    collide(tx, 7.4, 1.8, 0.9);
  }
  markBuilt('berlin_cafe');

  // ---------- Mauerpark: the Sunday flea market ----------
  signPlane('Mauerpark · Flohmarkt', { bg: '#3f5a3c', fg: '#ffffff', round: 8 }, { x: 33, y: 2.4, z: SOUTH_Z + 0.1, w: 3.6, h: 0.7, ry: Math.PI, pickId: 'flohmarkt_sign' });
  for (const dx of [-1.7, 1.7]) solid.cyl(33 + dx, 0, SOUTH_Z + 0.12, 0.06, 0.06, 2.4, '#3a3a3a', { seg: 6 });
  const stall = (x: number, z: number, roof: string) => {
    solid.boxB(x, 0, z, 3, 0.8, 1.1, '#b08a5a');
    for (const [dx, dz] of [[-1.5, -0.6], [1.5, -0.6], [-1.5, 0.9], [1.5, 0.9]] as const) solid.cyl(x + dx, 0, z + dz, 0.04, 0.04, 2.4, '#4a4a4a', { seg: 6 });
    solid.boxB(x, 2.4, z + 0.15, 3.3, 0.08, 1.9, roof);
    collide(x, z, 3.1, 1.2);
  };
  stall(40, 12.6, '#e07a5f'); // Greta's
  solid.cyl(39, 0.8, 12.6, 0.05, 0.12, 0.6, '#b9a07a', { seg: 8 }); // her lamp
  solid.cyl(39, 1.4, 12.6, 0.15, 0.32, 0.3, '#f1e3c4', { seg: 10 });
  for (let i = 0; i < 6; i++) solid.boxB(40.2 + i * 0.12, 0.8, 12.5, 0.04, 0.32, 0.32, pick(['#1a1a1a', '#c0392b', '#2e76b6', '#f2c14e'])); // records
  bike(ctx, 42.4, 12.2, 0.2); // the second-hand bike
  stall(47, 13.2, '#81b29a');
  stall(53, 14, '#f2cc8f');
  // the graffiti wall at the back of the park (a piece of the old Wall)
  solid.boxB(45, 0, 27.6, 30, 3.6, 0.5, '#bdb6aa');
  for (let i = 0; i < 18; i++) glow.boxB(31.5 + i * 1.6 + R() * 0.6, 0.4 + R() * 2.2, 27.33, 1 + R() * 1.4, 0.6 + R() * 1.2, 0.01, pick(['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c']));
  collide(45, 27.6, 30, 0.6);
  ctx.pickAt('mauer', 38, 1.8, 27.2, 1.6);
  // the park's edges
  collide(29.6, 19.5, 0.6, 19.6);
  collide(60.2, 19.5, 0.6, 21);
  markBuilt('flohmarkt');
  mapRect(PARK, '#8fd081', 'Mauerpark');
}

/** a city bike, leaning on its stand */
function bike(ctx: BuildCtx, x: number, z: number, ry: number): void {
  const b = new Batch();
  for (const dx of [-0.55, 0.55]) b.torus(dx, 0.34, 0, 0.34, 0.035, '#222', { ry: Math.PI / 2 });
  b.boxB(0, 0.35, 0, 1.1, 0.04, 0.04, '#2f6b5a', { rz: 0.35 });
  b.boxB(0.15, 0.55, 0, 0.9, 0.04, 0.04, '#2f6b5a', { rz: -0.15 });
  b.boxB(-0.1, 0.72, 0, 0.3, 0.05, 0.12, '#222');
  b.boxB(0.55, 0.9, 0, 0.05, 0.05, 0.5, '#222');
  const m = b.build(ctx.toon);
  if (m) {
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    m.castShadow = true;
    ctx.group.add(m);
  }
  ctx.collide(x, z, 1.3, 0.5);
}

/** The whole Berlin street: sky, ground, the fronts, trees and furniture. */
export function buildBerlinCity(): City {
  resetJitter(7);
  const { ctx, out } = createBuildCtx();
  const { group, solid, glow, collide, pickAt, own, ramp, toon, glowMat } = ctx;

  // sky: a paler, cooler Berlin sky
  const skyGeo = new THREE.SphereGeometry(400, 24, 16);
  const skyMat = skyMaterial('#7fa6cf', '#bcd3e6', '#eef1ec');
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  group.add(sky);
  own(skyGeo, skyMat);
  const sunDir = new THREE.Vector3(-0.5, 0.45, 0.74).normalize();
  const sunTex = blobTexture('rgba(255,240,214,1)', 'rgba(255,214,170,0)', 256);
  const sunMat = new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const sunSprite = new THREE.Sprite(sunMat);
  sunSprite.scale.setScalar(140);
  group.add(sunSprite);
  own(sunTex, sunMat);

  // ground: the road, two sidewalks of granite slabs with a cobble strip, a red bike lane each way
  const planeMat = (tex: THREE.Texture, repX: number, repY: number) => {
    tex.repeat.set(repX, repY);
    const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp });
    own(tex, m);
    return m;
  };
  const flat = (w: number, d: number, x: number, z: number, y: number, mat: THREE.Material) => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    own(g);
    return m;
  };
  const groundMat = new THREE.MeshToonMaterial({ color: '#c9c3b8', gradientMap: ramp });
  own(groundMat);
  flat(600, 600, 0, 0, -0.04, groundMat);
  const X0 = -120;
  const X1 = 140;
  flat(X1 - X0, 10, (X0 + X1) / 2, 0, 0, planeMat(asphaltTexture(), (X1 - X0) / 7, 10 / 7));
  flat(X1 - X0, 4, (X0 + X1) / 2, -7, 0.015, planeMat(sidewalkTexture(), (X1 - X0) / 4, 1));
  flat(X1 - X0, 4, (X0 + X1) / 2, 7, 0.015, planeMat(sidewalkTexture(), (X1 - X0) / 4, 1));
  flat(PARK.x1 - PARK.x0, PARK.z1 - PARK.z0, (PARK.x0 + PARK.x1) / 2, (PARK.z0 + PARK.z1) / 2, 0.02, planeMat(grassTexture(), 8, 6));
  const mid = (X0 + X1) / 2;
  const len = X1 - X0;
  for (const z of [-5.12, 5.12]) solid.boxB(mid, 0, z, len, 0.1, 0.24, '#a9a49b');
  for (const z of [-5.6, 5.6]) glow.boxB(mid, 0.017, z, len, 0.01, 0.5, '#8e8a82'); // the cobble strip
  for (const z of [-4.2, 4.2]) glow.boxB(mid, 0.012, z, len, 0.01, 1.2, '#b5654f'); // the bike lanes
  for (let x = X0 + 3; x < X1; x += 6) glow.boxB(x, 0.013, 0, 3, 0.01, 0.14, '#f2f0ea'); // white centre dashes
  for (let i = 0; i < 8; i++) glow.boxB(26, 0.014, -3.6 + i * 1.0, 3.4, 0.01, 0.5, '#f2f0ea'); // a zebra crossing
  pickAt('zebra', 26, 0.3, 0, 1.6);

  buildBerlinFronts(ctx);

  // linden trees along both sidewalks
  const linden = (x: number, z: number) => {
    solid.cyl(x, 0, z, 0.16, 0.22, 3.2, '#6b5444', { seg: 8 });
    for (const [dx, dy, dz, r] of [[0, 4.2, 0, 1.7], [0.8, 3.6, 0.4, 1.2], [-0.7, 3.7, -0.5, 1.25], [0.2, 5.2, -0.2, 1.1]] as const) solid.sphere(x + dx, dy, z + dz, r, '#6fa35a', { ws: 10, hs: 8 });
    solid.cyl(x, 0.01, z, 0.75, 0.75, 0.04, '#7a6a55', { seg: 12 });
    collide(x, z, 0.5, 0.5);
  };
  for (const x of [-40, -33, -20.5, -6, 13.5, 24, 33]) linden(x, -6.4);
  for (const x of [-38, -30, -11, 5, 22]) linden(x, 6.5);
  pickAt('linde', -11, 2.2, 6.5, 1.0);

  // old Berlin street lamps (no overhead wires here)
  const lamp = (x: number, z: number) => {
    solid.cyl(x, 0, z, 0.08, 0.12, 4.6, '#2f3a33', { seg: 8 });
    solid.cyl(x, 4.6, z, 0.28, 0.12, 0.5, '#2f3a33', { seg: 6 });
    glow.cyl(x, 4.2, z, 0.22, 0.18, 0.42, '#ffe9b0', { seg: 6 });
    collide(x, z, 0.3, 0.3);
  };
  for (const x of [-44, -26, -8, 12, 30, 48]) lamp(x, -5.9);
  for (const x of [-35, -17, 1, 19, 37, 55]) lamp(x, 5.9);
  pickAt('laterne', -17, 3.4, 5.9, 0.9);

  // the Litfaß column with its posters
  solid.cyl(28.5, 0, -6.5, 0.62, 0.62, 3.2, '#3e5a46', { seg: 16 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    glow.boxB(28.5 + Math.sin(a) * 0.63, 0.7, -6.5 + Math.cos(a) * 0.63, 0.55, 1.6, 0.02, ['#ff595e', '#ffca3a', '#1982c4', '#f4efe6', '#8ac926', '#6a4c93'][i]!, { ry: a });
  }
  solid.cyl(28.5, 3.2, -6.5, 0.75, 0.68, 0.3, '#2f4436', { seg: 16 });
  solid.sphere(28.5, 3.5, -6.5, 0.3, '#2f4436', { sy: 0.8, ws: 10, hs: 6 });
  collide(28.5, -6.5, 1.3, 1.3);
  pickAt('litfass', 28.5, 1.6, -6.5, 1.3);

  // the U-Bahn entrance beside the BVG counter: the blue U on its pole, the stairs' railing
  solid.cyl(9.2, 0, -6.6, 0.06, 0.06, 3.4, '#3a3a3a', { seg: 6 });
  glow.boxB(9.2, 3.0, -6.6, 0.8, 0.8, 0.08, '#1d5aa8');
  glow.boxB(9.2, 3.12, -6.55, 0.42, 0.56, 0.02, '#ffffff');
  glow.boxB(9.2, 3.2, -6.53, 0.2, 0.44, 0.02, '#1d5aa8');
  for (const dx of [-1.2, 1.2]) solid.boxB(9.2 + dx, 0, -7.6, 0.06, 1.0, 1.6, '#3a3a3a');
  collide(9.2, -7.6, 2.6, 1.7);
  pickAt('ubahn_sign', 9.2, 3, -6.6, 1);

  // bike stands, a bench, a bin
  for (const x of [-9, -7.6, -6.2]) {
    solid.boxB(x, 0, 6.6, 0.06, 0.8, 0.06, '#8d9399');
    solid.boxB(x, 0.8, 6.6, 0.06, 0.06, 0.9, '#8d9399');
    collide(x, 6.6, 0.2, 0.9);
  }
  solid.boxB(36, 0.42, 16.5, 1.7, 0.1, 0.55, '#8a6a4a');
  solid.boxB(36, 0.7, 16.8, 1.7, 0.45, 0.08, '#8a6a4a');
  collide(36, 16.6, 1.8, 0.7);
  solid.boxB(-15, 0, -7.9, 0.5, 0.9, 0.5, '#e05a1b'); // the orange BSR bin
  collide(-15, -7.9, 0.6, 0.6);
  pickAt('muell', -15, 0.6, -7.9, 0.8);

  const solidMesh = solid.build(toon, { cast: true, receive: true, name: 'berlin-solid' });
  if (solidMesh) group.add(solidMesh);
  const glowMesh = glow.build(glowMat, { cast: false, receive: false, name: 'berlin-glow' });
  if (glowMesh) group.add(glowMesh);
  out.mapRects.push({ x0: X0, x1: X1, z0: -5, z1: 5, color: '#8f95a8' });

  // Berlin has no shrine: the ritual hooks are inert
  const shrine: City['shrine'] = { group: new THREE.Group(), play: () => undefined, busy: () => false, info: () => ({ meshes: 0, triangles: 0 }) };
  return {
    group,
    colliders: out.colliders,
    occluders: out.occluders,
    pickables: out.pickables,
    mapRects: out.mapRects,
    sky,
    sunDir,
    materials: { toon, glow: glowMat },
    built: out.built,
    shrine,
    setShopOpen(shopId, open) {
      let shutter = out.shutters.get(shopId);
      if (!shutter && !open) {
        const opening = out.openings.get(shopId);
        if (!opening) return;
        shutter = makeShutter(ctx, opening, { text: 'Geschlossen' });
        group.add(shutter);
        out.shutters.set(shopId, shutter);
      }
      if (shutter) shutter.visible = !open;
    },
    update(dt, t, player) {
      sky.position.copy(player);
      sunSprite.position.copy(player).addScaledVector(sunDir, 330);
      for (const a of out.animators) a(dt, t, player);
    },
    setShadows(on) {
      if (solidMesh) solidMesh.castShadow = on;
    },
    dispose() {
      for (const d of out.disposables) d.dispose();
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
