// Madrid (Spanish step 2): one street and its plaza in Lavapiés. North side: the open fronts of Bar El Rincón, the panadería, the
// churrería, the Metro entrance (the red diamond, the ticket office inside) and the market hall, each under a five-storey Madrid block in
// ochre, terracotta or cream, with French windows, little wrought-iron balconies, green shutters and a cornice. In front of them the
// pavement and a narrow cobbled street; then the plaza: plane trees, benches, a fountain, the black Fernandine street lamps, Javi in the
// middle. On the south side, the portal of your flat (Lucía waits at the door) and the language-exchange bar with its terraza (Nadia).
// Units are metres, +x east, +z south, the north fronts face +z.
import * as THREE from 'three';
import { Batch, resetJitter } from './batch';
import { createBuildCtx, makeShutter, type BuildCtx } from './buildctx';
import type { City } from './city';
import type { District } from './district';
import { FRONT_Z, shopRect, type NpcSpawn, type Rect, type ShopBox, type WalkerDef } from './layout';
import { asphaltTexture, blobTexture, sidewalkTexture, skyMaterial } from './textures';

/** the five open fronts of the north side, named as the Madrid pack names its shops */
export const MADRID_SHOPS: ShopBox[] = [
  { id: 'bar', cx: -30, w: 9, d: 9, h: 4.8 },
  { id: 'panaderia', cx: -18, w: 8, d: 9, h: 4.6 },
  { id: 'churreria', cx: -6, w: 8, d: 9, h: 4.6 },
  { id: 'metro', cx: 6, w: 9, d: 10, h: 5.0 },
  { id: 'mercado', cx: 21, w: 12, d: 10, h: 5.4 },
];

const SOUTH_Z = 18.6; // the front plane of the south side
/** the plaza between the street and the south side: trees, benches, the fountain */
export const PLAZA: Rect = { x0: -40, x1: 40, z0: 0, z1: 15 };
/** the fountain in the middle of the plaza */
export const FOUNTAIN = { x: 10, z: 8, r: 1.6 };
export const MADRID_BOUNDS: Rect = { x0: -46, x1: 46, z0: -8.3, z1: 18 };

export const MADRID_SPAWNS: NpcSpawn[] = [
  { id: 'lola', x: -30, z: -12.2, face: 0, radius: 5.2, kind: 'scenario', y: 0.12, site: 'bar' },
  { id: 'carmen', x: -18, z: -12.2, face: 0, radius: 5.2, kind: 'scenario', y: 0.12, site: 'panaderia' },
  { id: 'rafa', x: -6, z: -12.0, face: 0, radius: 5.2, kind: 'scenario', y: 0.12, site: 'churreria' },
  { id: 'marisa', x: 6, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.12, site: 'metro' },
  { id: 'andres', x: 21, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.12, site: 'mercado' },
  // in the plaza, facing the street (-z)
  { id: 'javi', x: -4, z: 6, face: Math.PI, radius: 4.6, kind: 'scenario', site: 'plaza' },
  // on the south side: Lucía at the portal of your building, Nadia at the language-exchange bar
  { id: 'lucia', x: -22, z: 17.9, face: Math.PI, radius: 4.6, kind: 'scenario', site: 'piso' },
  { id: 'nadia', x: 24, z: 17.9, face: Math.PI, radius: 4.6, kind: 'scenario', site: 'intercambio' },
];

const WALKERS: WalkerDef[] = [
  { spec: 0, route: { points: [[-42, -7.2], [40, -7.2]], speed: 1.1, loop: false } },
  { spec: 2, route: { points: [[40, 16.2], [-42, 16.2]], speed: 0.95, loop: false } },
  { spec: 3, route: { points: [[-36, 1.2], [36, 1.2]], speed: 1.0, loop: false } },
];

/** Madrid's façades: ochre, terracotta, cream, salmon, pale yellow, brick */
const FACADE = ['#d9a25b', '#c46a45', '#efe2c4', '#e8a984', '#f0d58c', '#b3563b', '#e9cfa8', '#d98f6b'];
const TRIM = '#f6efe2';
const IRON = '#262421';
const SHUTTER = ['#3e6b48', '#5b3a29', '#2f5a3f'];

export const MADRID_DISTRICT: District = {
  id: 'madrid',
  bounds: MADRID_BOUNDS,
  shops: MADRID_SHOPS,
  npcSpawns: MADRID_SPAWNS,
  doors: [],
  spots: [],
  walkers: WALKERS,
  playerStart: { x: -24, z: -2.6, heading: Math.PI },
  build(ctx) {
    buildMadridFronts(ctx);
  },
  buildCity: () => buildMadridCity(),
};

/**
 * A Madrid block over a ground floor that starts at `y0`: rows of tall French windows, each with a little wrought-iron balcony and two
 * shutters, a white band between the floors and a cornice on top; the front faces `face`.
 */
function edificio(ctx: BuildCtx, x0: number, x1: number, zFront: number, depth: number, y0: number, top: number, colour: string, face: 1 | -1, R: () => number): void {
  const { solid, glow } = ctx;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const zc = zFront - (face * depth) / 2;
  solid.boxB(cx, y0, zc, w, top - y0, depth, colour);
  const zWin = zFront + face * 0.03;
  const cols = Math.max(2, Math.floor((w - 0.6) / 2.1));
  const pitch = (w - 0.6) / cols;
  const shutter = SHUTTER[Math.floor(R() * SHUTTER.length)]!;
  for (let y = y0 + 0.7; y + 2.2 < top - 0.6; y += 3.0) {
    // the white band of each floor
    solid.boxB(cx, y - 0.35, zFront + face * 0.04, w, 0.14, 0.1, TRIM);
    for (let i = 0; i < cols; i++) {
      const x = x0 + 0.3 + pitch * (i + 0.5);
      const lit = (Math.round(x * 3 + y) & 3) === 0;
      glow.boxB(x, y, zWin, 0.9, 2.1, 0.02, lit ? '#f5d58a' : '#3a4450');
      solid.boxB(x, y + 2.1, zFront + face * 0.02, 1.2, 0.18, 0.08, TRIM); // the lintel
      // the shutters, folded open on both sides
      for (const s of [-1, 1]) solid.boxB(x + s * 0.68, y, zFront + face * 0.05, 0.42, 2.1, 0.05, shutter);
      // the little balcony: a slab and its iron railing
      solid.boxB(x, y - 0.12, zFront + face * 0.32, 1.3, 0.1, 0.62, '#b7ada0');
      solid.boxB(x, y - 0.02, zFront + face * 0.62, 1.3, 0.9, 0.03, IRON);
      for (const s of [-1, 1]) solid.boxB(x + s * 0.64, y - 0.02, zFront + face * 0.32, 0.03, 0.9, 0.6, IRON);
      // a geranium on some balconies
      if (R() < 0.35) solid.sphere(x + 0.35, y + 0.95, zFront + face * 0.45, 0.17, ['#e63946', '#ff8fab', '#f77f00'][Math.floor(R() * 3)]!, { ws: 6, hs: 5 });
    }
  }
  // the cornice and the tiled roof behind it
  solid.boxB(cx, top - 0.35, zFront + face * 0.18, w + 0.2, 0.35, 0.5, TRIM);
  solid.boxB(cx, top, zc - face * 0.4, w, 0.9, depth - 0.8, '#a0573c');
}

function buildMadridFronts(ctx: BuildCtx): void {
  const { solid, glow, collide, occlude, shopFrame, hangSign, signPlane, markBuilt, mapRect, pickAt } = ctx;
  const R = ctx.rng('madrid');
  const pick = <T,>(a: readonly T[]) => a[Math.floor(R() * a.length)]!;
  const shop = (id: string) => MADRID_SHOPS.find((s) => s.id === id)!;

  // ---------- north side: the five fronts ----------
  const bar = shop('bar');
  shopFrame(bar, { wall: '#7a2e24', inner: '#f2e3c6', trim: '#4a1d17', roof: '#5e241c', floor: '#a8835f', ceil: '#f8ecd4', openH: 3.3 });
  hangSign('bar', bar, 'Bar El Rincón', 'cafés · tostadas · tortilla', '#4a1d17', '#f6e7c8', 3.3, 1.5, '#d4a24c');
  solid.boxB(bar.cx, 0.12, FRONT_Z - 2.3, 7, 1.0, 1.0, '#8a5a35'); // the zinc-topped bar
  solid.boxB(bar.cx, 1.12, FRONT_Z - 2.3, 7, 0.05, 1.05, '#b9bec4');
  solid.cyl(bar.cx + 2.6, 1.17, FRONT_Z - 2.3, 0.3, 0.3, 0.5, '#c0c4c8', { seg: 10 }); // the coffee machine
  for (let i = 0; i < 3; i++) solid.cyl(bar.cx - 1.6 + i * 0.9, 1.17, FRONT_Z - 2.25, 0.26, 0.26, 0.08, '#e9c46a', { seg: 10 }); // tortillas
  for (let i = 0; i < 6; i++) glow.cyl(bar.cx - 2.6 + i * 1.0, 1.8, FRONT_Z - 8.6, 0.1, 0.1, 0.42, pick(['#7a4a1a', '#2f6b3a', '#c9a227', '#8a2a2a']), { seg: 6 });
  glow.boxB(bar.cx - 3.2, 2.2, FRONT_Z - 8.7, 1.4, 1.0, 0.03, '#1f1f1f'); // the menu board
  mapRect(shopRect(bar), '#7a2e24', 'Bar');

  const pan = shop('panaderia');
  shopFrame(pan, { wall: '#f3e6c8', inner: '#fbf3df', trim: '#9c6b2f', roof: '#e3d3ad', floor: '#c9a97b', ceil: '#fffaf0', openH: 3.2 });
  hangSign('panaderia', pan, 'Panadería', 'pan · bollería', '#9c6b2f', '#fff8e6', 3.2, 1.4, '#e0b860');
  solid.boxB(pan.cx, 0.12, FRONT_Z - 2.3, 6.2, 0.95, 1.0, '#b88a55');
  glow.boxB(pan.cx, 0.6, FRONT_Z - 1.78, 6.0, 0.45, 0.02, '#fff1cf'); // the glass of the counter
  // barras of bread standing in baskets at the back, napolitanas on the counter
  for (let i = 0; i < 9; i++) solid.cyl(pan.cx - 3 + i * 0.75, 0.9, FRONT_Z - 8.5, 0.08, 0.08, 1.3, '#d8a35c', { seg: 6, rz: (i % 2 ? 0.15 : -0.15) });
  for (let i = 0; i < 5; i++) solid.boxB(pan.cx - 1.8 + i * 0.9, 1.07, FRONT_Z - 2.3, 0.5, 0.12, 0.3, '#c98b3c');
  mapRect(shopRect(pan), '#d9a25b', 'Panadería');

  const chu = shop('churreria');
  shopFrame(chu, { wall: '#f1f0ea', inner: '#fff9ee', trim: '#2f6b8f', roof: '#dedbd2', floor: '#c4c0b7', ceil: '#ffffff', openH: 3.2 });
  hangSign('churreria', chu, 'Churrería', 'chocolate con churros', '#2f6b8f', '#ffffff', 3.2, 1.4, '#f2d38a');
  solid.boxB(chu.cx, 0.12, FRONT_Z - 2.3, 6.2, 0.95, 1.0, '#dfe3e6');
  glow.cyl(chu.cx + 2.0, 1.07, FRONT_Z - 2.3, 0.5, 0.5, 0.18, '#ffb347', { seg: 14 }); // the fryer
  for (let i = 0; i < 4; i++) solid.torus(chu.cx - 1.6 + i * 0.5, 1.12, FRONT_Z - 2.3, 0.2, 0.05, '#c98b3c'); // churros in loops
  for (let i = 0; i < 3; i++) solid.cyl(chu.cx - 2.4 + i * 0.5, 1.07, FRONT_Z - 2.05, 0.12, 0.1, 0.16, '#5a3420', { seg: 8 }); // cups of chocolate
  mapRect(shopRect(chu), '#2f6b8f', 'Churrería');

  // the Metro: a hall with its ticket office, the red diamond and the blue band over the door
  const met = shop('metro');
  shopFrame(met, { wall: '#e9edf1', inner: '#f4f6f8', trim: '#1f4e9a', roof: '#d9dde2', floor: '#b8bec6', ceil: '#fbfbfb', openH: 3.5 });
  hangSign('metro', met, 'Metro', 'Lavapiés', '#1f4e9a', '#ffffff', 3.5, 1.5, '#c8102e');
  solid.boxB(met.cx, 0.12, FRONT_Z - 2.3, 6.4, 1.0, 1.0, '#cfd4da');
  glow.boxB(met.cx, 1.55, FRONT_Z - 2.3, 6.2, 0.9, 0.04, '#d9eef7'); // the glass of the ticket office
  glow.boxB(met.cx, 2.6, FRONT_Z - 9.3, 6, 1.8, 0.04, '#eef1f4'); // the network map
  for (let i = 0; i < 10; i++) glow.boxB(met.cx - 2.7 + i * 0.6, 2.2 + (i % 3) * 0.55, FRONT_Z - 9.26, 0.55, 0.06, 0.02, pick(['#36a9e1', '#e30613', '#ffcc00', '#009640', '#a3195b', '#f39200', '#7d4f9a', '#95c11f']));
  // the logo: a red diamond with a blue band, on a post at the kerb
  solid.cyl(met.cx - 4.2, 0, -5.9, 0.07, 0.07, 3.0, '#3a3a3a', { seg: 6 });
  glow.boxB(met.cx - 4.2, 3.1, -5.9, 0.95, 0.95, 0.06, '#c8102e', { rz: Math.PI / 4 });
  glow.boxB(met.cx - 4.2, 3.32, -5.85, 1.5, 0.36, 0.06, '#1f4e9a');
  pickAt('metro_sign', met.cx - 4.2, 3.4, -5.9, 0.9);
  collide(met.cx - 4.2, -5.9, 0.3, 0.3);
  mapRect(shopRect(met), '#1f4e9a', 'Metro');

  // the market hall: its iron and glass front, stalls of fruit inside, Andrés's at the front
  const mer = shop('mercado');
  shopFrame(mer, { wall: '#8a5a3c', inner: '#f2e6cf', trim: '#2b3a32', roof: '#6f4a33', floor: '#9b968c', ceil: '#e8dcc4', openH: 3.6 });
  hangSign('mercado', mer, 'Mercado', 'fruta · verdura · aceite', '#2b3a32', '#f2e6cf', 3.6, 1.6, '#c9a227');
  solid.boxB(mer.cx, 0.12, FRONT_Z - 2.3, 8.4, 0.85, 1.1, '#9a7b55'); // Andrés's stall
  for (let i = 0; i < 9; i++) solid.boxB(mer.cx - 3.6 + i * 0.9, 0.97, FRONT_Z - 2.3, 0.75, 0.18, 0.8, pick(['#f39c12', '#e74c3c', '#c0392b', '#f1c40f', '#e67e22']));
  for (let i = 0; i < 3; i++) solid.cyl(mer.cx + 3.0 + i * 0.3, 0.97, FRONT_Z - 2.0, 0.1, 0.1, 0.36, '#6b8e23', { seg: 8 }); // tins of oil
  for (const dx of [-3.4, 0, 3.4]) solid.boxB(mer.cx + dx, 0.12, FRONT_Z - 7.0, 2.8, 0.85, 1.2, pick(['#7a5a3a', '#8a6a4a']));
  mapRect(shopRect(mer), '#8a5a3c', 'Mercado');

  // the blocks over the shops, and the blocks between them
  MADRID_SHOPS.forEach((s) => edificio(ctx, s.cx - s.w / 2, s.cx + s.w / 2, FRONT_Z, s.d, s.h, 15 + Math.floor(R() * 3) * 1.2, pick(FACADE), 1, R));
  const northGaps: Array<[number, number]> = [[-46, -34.5], [-25.5, -22], [-14, -10], [-2, 1.5], [10.5, 15], [27, 33], [33, 40], [40, 46]];
  northGaps.forEach(([x0, x1]) => {
    edificio(ctx, x0, x1, FRONT_Z, 12, 0, 14 + Math.floor(R() * 3) * 1.1, pick(FACADE), 1, R);
    // the street door of the block
    if (x1 - x0 > 3) {
      solid.boxB(x0 + 1.4, 0, FRONT_Z + 0.04, 1.4, 2.6, 0.08, pick(['#5b3a29', '#2f2a26', '#3e6b48']));
      glow.boxB(x0 + 1.4, 2.65, FRONT_Z + 0.06, 1.2, 0.35, 0.02, '#f5d58a');
    }
    collide((x0 + x1) / 2, FRONT_Z - 6, x1 - x0, 12);
    occlude({ x0, x1, z0: FRONT_Z - 12, z1: FRONT_Z });
  });
  pickAt('balcon', -32, 4.0, FRONT_Z + 0.5, 1.0);
  signPlane('Calle del Ave María', { bg: '#1f3d6b', fg: '#ffffff', round: 6 }, { x: -22, y: 3.2, z: FRONT_Z + 0.06, w: 2.6, h: 0.5, pickId: 'calle' });

  // ---------- south side: your building, the language-exchange bar, the blocks between ----------
  const south: Array<[number, number]> = [[-46, -38], [-38, -30], [-30, -26], [-26, -18], [-18, -10], [-10, -2], [-2, 6], [6, 14], [14, 19], [19, 29], [29, 37], [37, 46]];
  south.forEach(([x0, x1]) => edificio(ctx, x0, x1, SOUTH_Z, 12, 0, 13.5 + Math.floor(R() * 3) * 1.1, pick(FACADE), -1, R));
  collide(0, SOUTH_Z + 6, 92, 12);
  occlude({ x0: -46, x1: 46, z0: SOUTH_Z, z1: SOUTH_Z + 12 });
  mapRect({ x0: -46, x1: 46, z0: SOUTH_Z, z1: SOUTH_Z + 12 }, '#d9a25b');
  // the portal of your building: a big wooden door, its number, the bells
  solid.boxB(-22, 0, SOUTH_Z - 0.05, 2.2, 3.2, 0.1, '#5b3a29');
  glow.boxB(-22, 3.25, SOUTH_Z - 0.08, 2.0, 0.5, 0.02, '#f5d58a');
  signPlane('12', { bg: '#1f3d6b', fg: '#ffffff', round: 6 }, { x: -20.5, y: 2.4, z: SOUTH_Z - 0.1, w: 0.45, h: 0.35, ry: Math.PI });
  pickAt('portal', -22, 1.6, SOUTH_Z - 0.2, 1.2);
  markBuilt('piso');
  // the language-exchange bar: warm windows, an awning, its name, the terraza with tables and umbrellas
  glow.boxB(24, 0.5, SOUTH_Z - 0.03, 9, 2.6, 0.04, '#f6d9a1');
  for (let i = 0; i < 10; i++) solid.boxB(19.95 + i * 0.9, 3.25, SOUTH_Z - 0.75, 0.9, 0.12, 1.5, i % 2 ? '#c46a45' : '#f6efe2', { rx: -0.25 });
  signPlane('Intercambio de idiomas', { bg: '#264653', fg: '#f6efe2', round: 8 }, { x: 24, y: 3.85, z: SOUTH_Z - 0.1, w: 3.6, h: 0.6, ry: Math.PI, pickId: 'intercambio_sign' });
  for (const tx of [19.2, 28.8]) {
    solid.cyl(tx, 0, 15.6, 0.05, 0.05, 0.72, '#3a3a3a', { seg: 6 });
    solid.cyl(tx, 0.72, 15.6, 0.45, 0.45, 0.04, '#e8e2d8', { seg: 14 });
    solid.cyl(tx, 0, 15.6, 0.04, 0.04, 2.3, '#e8e2d8', { seg: 6 });
    solid.cone(tx, 2.3, 15.6, 1.4, 0.5, '#f6efe2', { seg: 10 });
    for (const s of [-1, 1]) solid.boxB(tx + s * 0.8, 0, 15.6, 0.42, 0.85, 0.42, '#6b4a33');
    collide(tx, 15.6, 2.2, 1.0);
  }
  pickAt('terraza', 19.2, 1.0, 15.6, 1.0);
  markBuilt('intercambio');
}

/** a Fernandine street lamp: Madrid's black cast-iron post and its four-sided lantern */
function farola(ctx: BuildCtx, x: number, z: number): void {
  const { solid, glow, collide } = ctx;
  solid.cyl(x, 0, z, 0.16, 0.22, 0.6, '#1f1f1f', { seg: 8 });
  solid.cyl(x, 0.6, z, 0.07, 0.09, 3.0, '#1f1f1f', { seg: 8 });
  solid.boxB(x, 3.6, z, 0.42, 0.06, 0.42, '#1f1f1f');
  glow.boxB(x, 3.66, z, 0.34, 0.55, 0.34, '#ffe6a8');
  solid.cone(x, 4.21, z, 0.32, 0.35, '#1f1f1f', { seg: 4 });
  collide(x, z, 0.35, 0.35);
}

/** The whole street and plaza: sky, ground, the fronts, the plaza's trees, benches and fountain, the lamps. */
export function buildMadridCity(): City {
  resetJitter(17);
  const { ctx, out } = createBuildCtx();
  const { group, solid, glow, collide, pickAt, own, ramp, toon, glowMat } = ctx;

  // sky: Madrid's clear, deep blue sky
  const skyGeo = new THREE.SphereGeometry(400, 24, 16);
  const skyMat = skyMaterial('#3f7fd0', '#9cc2ee', '#f3eee2');
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  group.add(sky);
  own(skyGeo, skyMat);
  const sunDir = new THREE.Vector3(-0.4, 0.55, 0.73).normalize();
  const sunTex = blobTexture('rgba(255,246,224,1)', 'rgba(255,214,160,0)', 256);
  const sunMat = new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const sunSprite = new THREE.Sprite(sunMat);
  sunSprite.scale.setScalar(150);
  group.add(sunSprite);
  own(sunTex, sunMat);

  const planeMat = (tex: THREE.Texture, repX: number, repY: number, tint?: string) => {
    tex.repeat.set(repX, repY);
    const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp, ...(tint ? { color: tint } : {}) });
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
  const X0 = -120;
  const X1 = 120;
  const mid = (X0 + X1) / 2;
  const len = X1 - X0;
  const groundMat = new THREE.MeshToonMaterial({ color: '#c9b79a', gradientMap: ramp });
  own(groundMat);
  flat(600, 600, 0, 0, -0.04, groundMat);
  // the north pavement, the narrow cobbled street, the plaza's pale granite, the south pavement
  flat(len, 3.4, mid, -7.3, 0.015, planeMat(sidewalkTexture(), len / 4, 1, '#d8cfc0'));
  flat(len, 3.8, mid, -3.7, 0, planeMat(asphaltTexture(), len / 6, 1, '#8f8578'));
  flat(PLAZA.x1 - PLAZA.x0, PLAZA.z1 - PLAZA.z0 + 1.8, (PLAZA.x0 + PLAZA.x1) / 2, (PLAZA.z0 + PLAZA.z1) / 2 - 0.9, 0.012, planeMat(sidewalkTexture(), 12, 4, '#e2d9c8'));
  flat(len, 3.6, mid, SOUTH_Z - 1.8, 0.015, planeMat(sidewalkTexture(), len / 4, 1, '#d8cfc0'));
  for (const z of [-5.6, -1.8]) solid.boxB(mid, 0, z, len, 0.1, 0.2, '#a9a49b'); // the kerbs
  pickAt('plaza_sign', -30, 0.2, 8, 1.2);

  buildMadridFronts(ctx);

  // the fountain in the plaza: a round basin, a column, water glinting
  solid.cyl(FOUNTAIN.x, 0, FOUNTAIN.z, FOUNTAIN.r, FOUNTAIN.r + 0.1, 0.55, '#d8d0c2', { seg: 20 });
  glow.cyl(FOUNTAIN.x, 0.5, FOUNTAIN.z, FOUNTAIN.r - 0.15, FOUNTAIN.r - 0.15, 0.04, '#7fb7d4', { seg: 20 });
  solid.cyl(FOUNTAIN.x, 0.55, FOUNTAIN.z, 0.22, 0.28, 1.4, '#cfc6b6', { seg: 10 });
  solid.cyl(FOUNTAIN.x, 1.95, FOUNTAIN.z, 0.6, 0.4, 0.18, '#cfc6b6', { seg: 14 });
  collide(FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r * 2 + 0.2, FOUNTAIN.r * 2 + 0.2);
  pickAt('fuente', FOUNTAIN.x, 1.2, FOUNTAIN.z, 1.6);
  // the plaza is where Javi stands
  ctx.markBuilt('plaza');

  // plane trees in the plaza, their pale trunks
  const arbol = (x: number, z: number) => {
    solid.cyl(x, 0, z, 0.18, 0.26, 3.6, '#b8ad96', { seg: 8 });
    for (const [dx, dy, dz, r] of [[0, 4.8, 0, 2.0], [1.0, 4.2, 0.5, 1.4], [-0.9, 4.3, -0.5, 1.4], [0.2, 5.8, -0.2, 1.3]] as const) solid.sphere(x + dx, dy, z + dz, r, '#6a9b4f', { ws: 10, hs: 8 });
    // the square of earth around it
    solid.boxB(x, 0.01, z, 1.4, 0.02, 1.4, '#8a6a4a');
    collide(x, z, 0.6, 0.6);
  };
  for (const [x, z] of [[-34, 4], [-22, 11], [-12, 3.6], [2, 12], [18, 4], [30, 11], [36, 4]] as const) arbol(x, z);
  pickAt('arbol', -12, 2.4, 3.6, 1.0);

  // benches facing the fountain
  const banco = (x: number, z: number, ry: number) => {
    const b = new Batch();
    b.boxB(0, 0.42, 0, 1.8, 0.08, 0.5, '#7a5a3a');
    b.boxB(0, 0.62, -0.25, 1.8, 0.4, 0.06, '#7a5a3a');
    for (const dx of [-0.8, 0.8]) b.boxB(dx, 0, 0, 0.08, 0.42, 0.5, '#2a2622');
    const m = b.build(ctx.toon);
    if (m) {
      m.position.set(x, 0, z);
      m.rotation.y = ry;
      m.castShadow = true;
      group.add(m);
    }
    collide(x, z, 2.0, 0.8);
  };
  banco(10, 12, Math.PI);
  banco(15, 8, Math.PI / 2);
  banco(-26, 6, 0);
  pickAt('banco', -26, 0.6, 6, 1.0);

  // the street lamps along the pavements and in the plaza
  for (const x of [-42, -24, -12, 0, 13, 30, 42]) farola(ctx, x, -5.95);
  for (const [x, z] of [[-36, 13], [-8, 13], [6, 3], [26, 13]] as const) farola(ctx, x, z);
  pickAt('farola', -12, 3.6, -5.95, 0.8);

  // a green bin, and bikes from the city's bike share
  solid.cyl(-38, 0, -6.6, 0.28, 0.25, 0.95, '#2f6b3a', { seg: 10 });
  collide(-38, -6.6, 0.7, 0.7);
  pickAt('papelera', -38, 0.6, -6.6, 0.7);

  const solidMesh = solid.build(toon, { cast: true, receive: true, name: 'madrid-solid' });
  if (solidMesh) group.add(solidMesh);
  const glowMesh = glow.build(glowMat, { cast: false, receive: false, name: 'madrid-glow' });
  if (glowMesh) group.add(glowMesh);
  out.mapRects.push({ x0: X0, x1: X1, z0: -5.6, z1: -1.8, color: '#8f8578' });
  out.mapRects.push({ ...PLAZA, color: '#e2d9c8', label: 'Plaza' });

  // Madrid has no shrine: the ritual hooks are inert
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
        shutter = makeShutter(ctx, opening, { text: 'Cerrado' });
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
