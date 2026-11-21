// Amsterdam (Dutch step 2): one canal in De Pijp. North side: the open fronts of Café De Gracht, Kaashandel Bakker, Snackbar Mo and the
// GVB service point, each under a narrow canal house with a gable (stepped, neck or cornice) and a hoist beam. In front of them the
// pavement, a brick street with tram tracks, the red bike path and the quay with elms, bike racks and Daan with his bike. Then the
// canal: houseboats along the quay (Sanne's is the green one), a little tour boat going by, a bridge across to the south quay where Noor
// waits outside the language café. At the east end the street becomes the Albert Cuyp market (Jesse's stroopwafel stall). Dutch step 4
// adds three fronts to the north side: the gemeente's city desk at the west end (Ilse), the drogist (Mirjam) between the cheese shop
// and the snack bar, and the brown café ’t Hoekje by the bridge (Joop). Units are metres, +x east, +z south, the north fronts face +z.
import * as THREE from 'three';
import { Batch, resetJitter } from './batch';
import { createBuildCtx, makeShutter, type BuildCtx } from './buildctx';
import type { City } from './city';
import type { District } from './district';
import { FRONT_Z, shopRect, type NpcSpawn, type Rect, type ShopBox, type WalkerDef } from './layout';
import { asphaltTexture, blobTexture, sidewalkTexture, skyMaterial } from './textures';

/** the four open fronts of the north side, named as the Amsterdam pack names its shops */
export const AMSTERDAM_SHOPS: ShopBox[] = [
  { id: 'cafe', cx: -30, w: 9, d: 9, h: 4.8 },
  { id: 'kaas', cx: -16, w: 8, d: 9, h: 4.8 },
  { id: 'snackbar', cx: 0, w: 8, d: 9, h: 4.6 },
  { id: 'gvb', cx: 16, w: 9, d: 10, h: 5.0 },
  // Dutch step 4: the drogist (Chapter 4), the brown café (Chapter 5) and the gemeente (Chapter 6; no shop of the pack, so it never closes)
  { id: 'drogist', cx: -8, w: 8, d: 9, h: 4.6 },
  { id: 'bruincafe', cx: 7.75, w: 7.5, d: 9, h: 4.6 },
  { id: 'gemeente', cx: -40.25, w: 11.5, d: 10, h: 5.0 },
];

/** the canal's water between its two quay walls */
export const CANAL: Rect = { x0: -120, x1: 140, z0: 3, z1: 15 };
/** the bridge across it */
export const BRIDGE: Rect = { x0: 7, x1: 13, z0: CANAL.z0, z1: CANAL.z1 };
const SOUTH_Z = 18.6; // the front plane of the south side
/** the market: the street east of the tram's turn, car-free */
const MARKET_X0 = 32;
export const AMSTERDAM_BOUNDS: Rect = { x0: -46, x1: 60, z0: -8.3, z1: 18 };

export const AMSTERDAM_SPAWNS: NpcSpawn[] = [
  { id: 'femke', x: -30, z: -12.2, face: 0, radius: 5.2, kind: 'scenario', y: 0.12, site: 'cafe' },
  { id: 'kees', x: -16, z: -12.2, face: 0, radius: 5.2, kind: 'scenario', y: 0.12, site: 'kaas' },
  { id: 'mo', x: 0, z: -12.0, face: 0, radius: 5.2, kind: 'scenario', y: 0.12, site: 'snackbar' },
  { id: 'ingrid', x: 16, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.12, site: 'gvb' },
  // Dutch step 4: behind the drogist's counter, behind the brown café's bar, at the city desk
  { id: 'mirjam', x: -8, z: -12.2, face: 0, radius: 5.2, kind: 'scenario', y: 0.12, site: 'drogist' },
  { id: 'joop', x: 7.75, z: -12.0, face: 0, radius: 5.2, kind: 'scenario', y: 0.12, site: 'bruincafe' },
  { id: 'ilse', x: -40.25, z: -12.4, face: 0, radius: 5.4, kind: 'scenario', y: 0.12, site: 'gemeente' },
  // behind the stroopwafel stall in the market street, facing the quay
  { id: 'jesse', x: 42, z: -4.3, face: 0, radius: 4.8, kind: 'scenario', site: 'markt' },
  // on the quay, their backs to the canal (facing the street, -z)
  { id: 'sanne', x: -20, z: 2.3, face: Math.PI, radius: 4.6, kind: 'scenario', site: 'woonboot' },
  { id: 'daan', x: -4.5, z: 1.9, face: Math.PI, radius: 4.6, kind: 'scenario', site: 'fietsenrek' },
  // across the bridge, outside the language café on the south quay
  { id: 'noor', x: 20, z: 17.9, face: Math.PI, radius: 4.6, kind: 'scenario', site: 'taalcafe' },
];

const WALKERS: WalkerDef[] = [
  { spec: 0, route: { points: [[-42, -7.4], [28, -7.4]], speed: 1.15, loop: false } },
  { spec: 1, route: { points: [[28, 0.7], [-42, 0.7]], speed: 1.0, loop: false } },
  { spec: 3, route: { points: [[-12, 16.4], [56, 16.4]], speed: 0.9, loop: false } },
];

/** canal-house colours: dark brick, red brick, black, bottle green, grey, cream */
const FACADE = ['#6e3428', '#8b4532', '#5a2a22', '#2f2c2b', '#36493b', '#6b6862', '#e3dac6', '#7a4a3a'];
const TRIM = '#f4f1ea';

export const AMSTERDAM_DISTRICT: District = {
  id: 'amsterdam',
  bounds: AMSTERDAM_BOUNDS,
  shops: AMSTERDAM_SHOPS,
  npcSpawns: AMSTERDAM_SPAWNS,
  doors: [],
  spots: [],
  walkers: WALKERS,
  playerStart: { x: -24, z: -2.6, heading: Math.PI },
  build(ctx) {
    buildAmsterdamFronts(ctx);
  },
  buildCity: () => buildAmsterdamCity(),
};

type Gable = 'step' | 'neck' | 'cornice';

/**
 * A narrow canal house over a ground floor that starts at `y0`: tall white-framed windows, the gable on top (stepped, a neck gable, or a
 * flat cornice) and the hoist beam under it; the front faces `face`.
 */
function pand(ctx: BuildCtx, x0: number, x1: number, zFront: number, depth: number, y0: number, top: number, colour: string, face: 1 | -1, gable: Gable): void {
  const { solid, glow } = ctx;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const zc = zFront - (face * depth) / 2;
  solid.boxB(cx, y0, zc, w, top - y0, depth, colour);
  const zWin = zFront + face * 0.03;
  const cols = Math.max(2, Math.floor((w - 0.8) / 1.7));
  const pitch = (w - 0.8) / cols;
  for (let y = y0 + 0.8; y + 2.0 < top; y += 2.9) {
    for (let i = 0; i < cols; i++) {
      const x = x0 + 0.4 + pitch * (i + 0.5);
      solid.boxB(x, y - 0.1, zFront + face * 0.015, pitch * 0.66 + 0.2, 2.1, 0.03, TRIM);
      glow.boxB(x, y, zWin, pitch * 0.66, 1.9, 0.02, (Math.round(x * 5 + y) & 3) === 0 ? '#f5d58a' : '#33414f');
      // the glazing bars: one across, one down
      glow.boxB(x, y + 0.95, zWin + face * 0.005, pitch * 0.66, 0.05, 0.01, TRIM);
      glow.boxB(x, y, zWin + face * 0.005, 0.05, 1.9, 0.01, TRIM);
    }
  }
  // the gable: the roof's ridge runs from the street to the back, so the street sees its end
  if (gable === 'step') {
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const sw = w * (1 - (i + 1) / (steps + 1.2));
      solid.boxB(cx, top + i * 0.85, zc, sw, 0.85, depth, colour);
      solid.boxB(cx, top + (i + 1) * 0.85 - 0.08, zFront + face * 0.02, sw + 0.12, 0.1, 0.16, TRIM);
    }
    glow.boxB(cx, top + 0.5, zWin, 0.9, 1.1, 0.02, '#33414f');
  } else if (gable === 'neck') {
    solid.boxB(cx, top, zc, w * 0.5, 2.6, depth, colour);
    for (const s of [-1, 1]) solid.boxB(cx + s * w * 0.3, top, zFront + face * 0.05, w * 0.12, 0.9, 0.3, TRIM, { rz: s * 0.5 });
    solid.boxB(cx, top + 2.6, zFront + face * 0.04, w * 0.58, 0.18, 0.3, TRIM);
    solid.sphere(cx, top + 2.85, zFront + face * 0.04, 0.32, TRIM, { sy: 0.7, ws: 8, hs: 6 });
    glow.boxB(cx, top + 0.6, zWin, 0.9, 1.4, 0.02, '#33414f');
  } else {
    // a flat front with a heavy white cornice, the pitched roof behind it
    solid.boxB(cx, top, zFront + face * 0.2, w + 0.3, 0.55, 0.7, TRIM);
    solid.boxB(cx, top, zc - face * 0.6, w * 0.8, 1.2, depth - 1.6, '#3b3734');
  }
  // the hoist beam that brings furniture up to the attic
  solid.boxB(cx, top - 0.5, zFront + face * 0.6, 0.18, 0.18, 1.2, '#2a2522');
}

function buildAmsterdamFronts(ctx: BuildCtx): void {
  const { solid, glow, collide, occlude, shopFrame, hangSign, signPlane, markBuilt, mapRect, pickAt } = ctx;
  const R = ctx.rng('amsterdam');
  const shop = (id: string) => AMSTERDAM_SHOPS.find((s) => s.id === id)!;
  const pick = <T,>(a: readonly T[]) => a[Math.floor(R() * a.length)]!;
  const gables: Gable[] = ['step', 'neck', 'cornice'];

  // ---------- north side: the four shops under canal houses ----------
  const cafe = shop('cafe');
  shopFrame(cafe, { wall: '#3f5a46', inner: '#f3ead9', trim: '#2a3d30', roof: '#33493a', floor: '#a9876a', ceil: '#f8f0e2', openH: 3.3 });
  hangSign('cafe', cafe, 'Café De Gracht', 'koffie · appeltaart', '#2a3d30', '#f4efe6', 3.3, 1.5, '#c9a75a');
  solid.boxB(cafe.cx + 1, 0.12, FRONT_Z - 2.3, 6, 0.95, 1.0, '#6b4a33'); // the bar
  solid.cyl(cafe.cx + 2.6, 1.07, FRONT_Z - 2.3, 0.3, 0.3, 0.5, '#c0c4c8', { seg: 10 }); // the espresso machine
  for (let i = 0; i < 4; i++) solid.cyl(cafe.cx - 1.2 + i * 0.7, 1.07, FRONT_Z - 2.2, 0.2, 0.2, 0.08, '#e6c38b', { seg: 10 }); // apple pies
  glow.boxB(cafe.cx, 2.4, FRONT_Z - 8.7, 5, 0.9, 0.03, '#1f1f1f'); // the chalk board
  mapRect(shopRect(cafe), '#3f5a46', 'Café');

  const kaas = shop('kaas');
  shopFrame(kaas, { wall: '#f1d36b', inner: '#fbf3dc', trim: '#7a5520', roof: '#d9b84f', floor: '#bfa77e', ceil: '#fff8e6', openH: 3.3 });
  hangSign('kaas', kaas, 'Kaashandel Bakker', 'Gouda · Edam · geitenkaas', '#f4c430', '#4a3410', 3.3, 1.5, '#7a5520');
  solid.boxB(kaas.cx, 0.12, FRONT_Z - 2.3, 6.4, 0.95, 1.0, '#7a5520');
  // wheels of Gouda on the shelves at the back, and a few on the counter
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 6; i++) solid.cyl(kaas.cx - 2.6 + i * 1.04, 0.5 + r * 0.8, FRONT_Z - 8.4, 0.45, 0.45, 0.32, pick(['#f2b632', '#e8a33d', '#d98e2b', '#f4d03f']), { seg: 14, rx: Math.PI / 2 });
  for (let i = 0; i < 3; i++) solid.cyl(kaas.cx - 1.5 + i * 1.5, 1.07, FRONT_Z - 2.3, 0.4, 0.4, 0.26, '#f2b632', { seg: 14 });
  mapRect(shopRect(kaas), '#f4c430', 'Kaas');

  const snack = shop('snackbar');
  shopFrame(snack, { wall: '#e9e4dc', inner: '#fbf8f2', trim: '#d62828', roof: '#d8d1c6', floor: '#c9c1b5', ceil: '#fffaf2', openH: 3.2 });
  hangSign('snackbar', snack, 'Snackbar Mo', 'patat · kroket · frikandel', '#d62828', '#ffffff', 3.2, 1.4, '#ffd166');
  solid.boxB(snack.cx, 0.12, FRONT_Z - 2.3, 6.4, 0.95, 1.0, '#cfd4d9');
  // the wall of little hatches (the automatiek) and the fryer's glow
  for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) glow.boxB(snack.cx - 2.5 + i * 1.0, 0.7 + r * 0.7, FRONT_Z - 8.7, 0.8, 0.55, 0.03, (i + r) % 4 === 0 ? '#6c757d' : '#ffe8a3');
  glow.boxB(snack.cx + 2.4, 1.0, FRONT_Z - 4.6, 1.2, 0.6, 0.8, '#ffb347');
  mapRect(shopRect(snack), '#d62828', 'Snackbar');

  const gvb = shop('gvb');
  shopFrame(gvb, { wall: '#f5f5f2', inner: '#f2f4f7', trim: '#1b3d8f', roof: '#dcdcd8', floor: '#bfc3c9', ceil: '#fbfbfb', openH: 3.5 });
  hangSign('gvb', gvb, 'GVB', 'Kaartjes · Service', '#1b3d8f', '#ffffff', 3.5, 1.5, '#ffffff');
  solid.boxB(gvb.cx, 0.12, FRONT_Z - 2.3, 7, 1.0, 1.0, '#e4e6ea');
  glow.boxB(gvb.cx, 1.5, FRONT_Z - 2.3, 6.8, 0.9, 0.04, '#d9eef7'); // the glass over the counter
  glow.boxB(gvb.cx, 2.5, FRONT_Z - 9.3, 6, 1.8, 0.04, '#eef1f4'); // the tram map
  for (let i = 0; i < 8; i++) glow.boxB(gvb.cx - 2.6 + i * 0.75, 2.2 + (i % 3) * 0.5, FRONT_Z - 9.26, 0.7, 0.06, 0.02, pick(['#e30613', '#009fe3', '#f39200', '#95c11f', '#a3195b', '#ffcc00']));
  solid.boxB(gvb.cx - 3, 0.12, FRONT_Z - 1.2, 0.5, 1.3, 0.4, '#1b3d8f'); // the card reader by the door
  glow.boxB(gvb.cx - 3, 1.2, FRONT_Z - 0.98, 0.34, 0.2, 0.02, '#5fd35f');
  mapRect(shopRect(gvb), '#1b3d8f', 'GVB');

  // the drogist: bright and white, shelves of little boxes and bottles
  const drog = shop('drogist');
  shopFrame(drog, { wall: '#f4f6f5', inner: '#ffffff', trim: '#2a9d8f', roof: '#dfe4e2', floor: '#cfd8d5', ceil: '#ffffff', openH: 3.2 });
  hangSign('drogist', drog, 'De Drogist', 'verzorging · gezondheid', '#2a9d8f', '#ffffff', 3.2, 1.4, '#ffffff');
  solid.boxB(drog.cx, 0.12, FRONT_Z - 2.3, 5.6, 0.95, 1.0, '#e8ecea'); // the counter
  for (let r = 0; r < 4; r++) for (let i = 0; i < 8; i++) glow.boxB(drog.cx - 3.1 + i * 0.88, 0.5 + r * 0.6, FRONT_Z - 8.7, 0.62, 0.42, 0.06, pick(['#ffffff', '#e76f51', '#2a9d8f', '#f4a261', '#a8dadc', '#ffd166', '#e9c46a']));
  mapRect(shopRect(drog), '#2a9d8f', 'Drogist');

  // the brown café: dark wood, a bar with its taps, bottles glowing behind, warm low light
  const bruin = shop('bruincafe');
  shopFrame(bruin, { wall: '#3b2a20', inner: '#5a3a24', trim: '#2a1a10', roof: '#4a3428', floor: '#4a3020', ceil: '#6b4a33', openH: 3.1 });
  hangSign('bruincafe', bruin, 'Café ’t Hoekje', 'bruin café', '#2a1a10', '#f2d38a', 3.1, 1.4, '#c9a227');
  solid.boxB(bruin.cx, 0.12, FRONT_Z - 2.3, 5.4, 1.0, 1.0, '#6b4226'); // the bar
  for (const dx of [-0.8, 0, 0.8]) solid.cyl(bruin.cx + dx, 1.12, FRONT_Z - 2.3, 0.05, 0.05, 0.45, '#c9a227', { seg: 6 }); // the taps
  for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) glow.cyl(bruin.cx - 2.6 + i * 0.65, 1.4 + r * 0.7, FRONT_Z - 8.6, 0.09, 0.09, 0.4, pick(['#7a4a1a', '#2f6b3a', '#c9a227', '#8a2a2a']), { seg: 6 });
  glow.boxB(bruin.cx, 2.7, FRONT_Z - 5, 1.2, 0.12, 1.2, '#f2b55a'); // the lamp over the bar
  mapRect(shopRect(bruin), '#5a3a24', '’t Hoekje');

  // the gemeente's city desk: white and red, Amsterdam's three crosses, a desk, the number display, waiting chairs
  const gem = shop('gemeente');
  shopFrame(gem, { wall: '#ecece6', inner: '#f6f6f2', trim: '#e30613', roof: '#d8d8d2', floor: '#c4c6c8', ceil: '#fafaf8', openH: 3.5 });
  hangSign('gemeente', gem, 'Gemeente Amsterdam', 'Stadsloket', '#e30613', '#ffffff', 3.5, 1.5, '#ffffff');
  solid.boxB(gem.cx, 0.12, FRONT_Z - 2.3, 4.6, 0.9, 1.1, '#9aa0a6'); // the desk
  glow.boxB(gem.cx + 1.2, 1.02, FRONT_Z - 2.5, 0.6, 0.4, 0.04, '#bcd4e6'); // the screen
  glow.boxB(gem.cx - 3.6, 2.6, FRONT_Z - 9.6, 2.2, 0.8, 0.04, '#1a1a1a'); // the number display
  for (let i = 0; i < 3; i++) glow.boxB(gem.cx - 4.2 + i * 0.6, 2.7, FRONT_Z - 9.55, 0.4, 0.55, 0.02, '#ff3b30');
  for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) solid.boxB(gem.cx + 0.6 + i * 1.0, 0.12, FRONT_Z - 6.2 - r * 1.6, 0.7, 0.45, 0.6, '#e30613');
  // the three St Andrew's crosses of Amsterdam's arms, white on a black band beside the door
  glow.boxB(gem.cx + gem.w / 2 + 0.45, 3.4, FRONT_Z + 0.08, 0.7, 1.9, 0.04, '#1a1a1a');
  for (let k = 0; k < 3; k++)
    for (const r of [0.785, -0.785]) glow.boxB(gem.cx + gem.w / 2 + 0.45, 3.55 + k * 0.55, FRONT_Z + 0.11, 0.42, 0.08, 0.02, '#ffffff', { rz: r });
  mapRect(shopRect(gem), '#e30613', 'Gemeente');

  // the canal houses over the shops, and the narrow houses between them
  AMSTERDAM_SHOPS.forEach((s, i) => pand(ctx, s.cx - s.w / 2, s.cx + s.w / 2, FRONT_Z, s.d, s.h, 15 + (i % 2) * 1.5, pick(FACADE), 1, gables[i % 3]!));
  const northGaps: Array<[number, number]> = [[-25.5, -20], [20.5, 26], [26, 31], [31, 36], [36, 41], [41, 47], [47, 53], [53, 60]];
  northGaps.forEach(([x0, x1], i) => {
    const top = 13.5 + ((i * 7) % 4) * 0.9;
    pand(ctx, x0, x1, FRONT_Z, 12, 0, top, pick(FACADE), 1, gables[(i + 1) % 3]!);
    // a front door up two steps, and a ground-floor window
    solid.boxB(x0 + 1.1, 0, FRONT_Z + 0.25, 1.4, 0.32, 0.5, '#8d8478');
    solid.boxB(x0 + 1.1, 0.32, FRONT_Z + 0.02, 1.1, 2.4, 0.06, pick(['#1f3b2c', '#2a2522', '#5a1e1e', '#1d2f4a']));
    glow.boxB(x0 + 1.1, 2.3, FRONT_Z + 0.06, 0.9, 0.3, 0.01, '#f5d58a');
    if (x1 - x0 > 4) glow.boxB(x0 + 3.2, 0.9, FRONT_Z + 0.04, 1.6, 1.5, 0.02, '#33414f');
    collide((x0 + x1) / 2, FRONT_Z - 6, x1 - x0, 12);
    occlude({ x0, x1, z0: FRONT_Z - 12, z1: FRONT_Z });
  });
  // flowers in a window box on the house between the café and the cheese shop
  for (let i = 0; i < 6; i++) solid.sphere(-24.9 + i * 0.4, 3.35, FRONT_Z + 0.32, 0.16, pick(['#e63946', '#ff8fab', '#ffd166', '#f77f00']), { ws: 6, hs: 5 });
  solid.boxB(-23.9, 3.0, FRONT_Z + 0.3, 2.6, 0.3, 0.4, '#5b3a29');
  pickAt('bloemen', -23.9, 3.3, FRONT_Z + 0.4, 1.0);

  // ---------- the market street: Albert Cuyp's stalls, Jesse's first ----------
  const stall = (x: number, roof: string, goods: readonly string[]) => {
    const z = -3.1;
    solid.boxB(x, 0, z, 3.4, 0.85, 1.1, '#9a7b55');
    for (let i = 0; i < 6; i++) solid.boxB(x - 1.3 + i * 0.52, 0.85, z, 0.42, 0.14, 0.42, pick(goods));
    for (const [dx, dz] of [[-1.6, -0.6], [1.6, -0.6], [-1.6, 1.0], [1.6, 1.0]] as const) solid.cyl(x + dx, 0, z - 0.6 + dz, 0.04, 0.04, 2.4, '#4a4a4a', { seg: 6 });
    // a striped awning
    for (let i = 0; i < 6; i++) solid.boxB(x - 1.45 + i * 0.58, 2.4, z - 0.2, 0.58, 0.08, 2.2, i % 2 ? roof : '#f4efe6', { rx: 0.12 });
    collide(x, z - 0.1, 3.5, 1.3);
  };
  stall(42, '#c1121f', ['#b5753c', '#c68a4e', '#8e5326']); // the stroopwafels
  glow.cyl(43.2, 0.85, -3.1, 0.32, 0.32, 0.1, '#ffb347', { seg: 12 }); // the waffle iron, warm
  signPlane('Verse Stroopwafels', { bg: '#c1121f', fg: '#ffffff', round: 8 }, { x: 42, y: 2.1, z: -2.0, w: 3.0, h: 0.6, pickId: 'markt' });
  markBuilt('markt');
  stall(48, '#2a9d8f', ['#e63946', '#2a9d8f', '#ffd166', '#f4a261']); // fabric
  stall(54, '#f4a261', ['#ff595e', '#8ac926', '#ffca3a', '#6a4c93']); // fruit and vegetables
  stall(36, '#457b9d', ['#f2b632', '#e8a33d', '#f4d03f']); // more cheese
  signPlane('Albert Cuypmarkt', { bg: '#1d3557', fg: '#ffffff', round: 8 }, { x: MARKET_X0, y: 3.4, z: -6.2, w: 3.8, h: 0.7 });
  for (const dx of [-1.8, 1.8]) solid.cyl(MARKET_X0 + dx, 0, -6.2, 0.06, 0.06, 3.4, '#3a3a3a', { seg: 6 });
  mapRect({ x0: MARKET_X0, x1: 60, z0: -5, z1: -1.6 }, '#e9c46a', 'Albert Cuyp');

  // ---------- the canal: houseboats along the quay, Sanne's the green one ----------
  const boat = (x0: number, x1: number, hull: string, house: string, roof: string) => {
    const cx = (x0 + x1) / 2;
    const z = CANAL.z0 + 1.9;
    solid.boxB(cx, -0.55, z, x1 - x0, 0.75, 3.0, hull);
    solid.boxB(cx, 0.2, z, x1 - x0 - 1.2, 2.0, 2.6, house);
    solid.boxB(cx, 2.2, z, x1 - x0 - 0.9, 0.16, 2.9, roof);
    for (let x = x0 + 1.4; x + 1 < x1; x += 1.8) glow.boxB(x + 0.4, 0.9, z - 1.32, 0.9, 0.8, 0.02, (Math.round(x) & 1) === 0 ? '#f5d58a' : '#33414f');
    // plants on the roof
    for (let i = 0; i < 4; i++) solid.sphere(x0 + 1.5 + i * ((x1 - x0 - 3) / 3), 2.55, z + 0.8, 0.3, pick(['#5a8f4e', '#6fa35a', '#e76f51']), { ws: 7, hs: 5 });
  };
  boat(-27, -13, '#1f3b2c', '#5f8f6b', '#2f4a39'); // Sanne's
  solid.boxB(-20, -0.05, CANAL.z0 + 0.15, 1.0, 0.1, 0.9, '#8a6a4a'); // the gangplank
  for (let i = 0; i < 5; i++) solid.cyl(-24 + i * 1.6, 2.36, CANAL.z0 + 1.0, 0.18, 0.14, 0.32, '#b5653c', { seg: 8 }); // her flower pots
  pickAt('woonboot', -20, 1.4, CANAL.z0 + 2.0, 2.0);
  markBuilt('woonboot');
  boat(-44, -31, '#2b2b2b', '#c9b38a', '#3a3a3a');
  boat(22, 34, '#1d2f4a', '#e3dac6', '#2a2a2a');
  pickAt('gracht', -6, 0.1, 9, 2.5);

  // the bridge: a thin brick deck (the little boats pass under it), white railings, a row of bulbs along both sides
  const bx = (BRIDGE.x0 + BRIDGE.x1) / 2;
  const bz = (BRIDGE.z0 + BRIDGE.z1) / 2;
  const blen = BRIDGE.z1 - BRIDGE.z0;
  solid.boxB(bx, -0.15, bz, BRIDGE.x1 - BRIDGE.x0, 0.17, blen + 0.4, '#8e4a36');
  for (const side of [-1, 1]) {
    const x = bx + side * ((BRIDGE.x1 - BRIDGE.x0) / 2 - 0.12);
    solid.boxB(x, 0.02, bz, 0.16, 0.95, blen, TRIM);
    for (let z = BRIDGE.z0 + 0.5; z < BRIDGE.z1; z += 0.7) glow.sphere(bx + side * ((BRIDGE.x1 - BRIDGE.x0) / 2 + 0.02), -0.08, z, 0.05, '#ffe9b0', { ws: 6, hs: 4 });
    collide(x, bz, 0.3, blen);
  }
  pickAt('brug', bx, 0.8, bz, 2.2);

  // ---------- south side: the language café and the houses along the south quay ----------
  const south: Array<[number, number]> = [[-46, -40], [-40, -33], [-33, -27], [-27, -20], [-20, -14], [-14, -8], [-8, -2], [-2, 4], [4, 10], [10, 15], [15, 25], [25, 31], [31, 37], [37, 44], [44, 51], [51, 60]];
  south.forEach(([x0, x1], i) => pand(ctx, x0, x1, SOUTH_Z, 12, 0, 13 + ((i * 5) % 4) * 0.8, pick(FACADE), -1, gables[i % 3]!));
  collide(7, SOUTH_Z + 6, 106, 12);
  occlude({ x0: -46, x1: 60, z0: SOUTH_Z, z1: SOUTH_Z + 12 });
  mapRect({ x0: -46, x1: 60, z0: SOUTH_Z, z1: SOUTH_Z + 12 }, '#b48a72');
  // the language café: warm windows, an awning, a table outside, its name over the door
  glow.boxB(20, 0.5, SOUTH_Z - 0.03, 8, 2.6, 0.04, '#f6d9a1');
  for (let i = 0; i < 9; i++) solid.boxB(16.4 + i * 0.9, 3.25, SOUTH_Z - 0.75, 0.9, 0.12, 1.5, i % 2 ? '#e76f51' : '#f4efe6', { rx: -0.25 });
  signPlane('Taalcafé', { bg: '#264653', fg: '#f4efe6', round: 8 }, { x: 20, y: 3.85, z: SOUTH_Z - 0.1, w: 2.8, h: 0.62, ry: Math.PI });
  solid.cyl(23.4, 0, 16.9, 0.05, 0.05, 0.72, '#3a3a3a', { seg: 6 });
  solid.cyl(23.4, 0.72, 16.9, 0.42, 0.42, 0.04, '#e8e2d8', { seg: 14 });
  collide(23.4, 16.9, 0.9, 0.9);
  markBuilt('taalcafe');
  mapRect(CANAL, '#5e8fa0', 'Gracht');
}

/** a Dutch city bike (an omafiets): upright, black, a basket in front */
function fiets(ctx: BuildCtx, x: number, z: number, ry: number, colour = '#1f1f1f'): void {
  const b = new Batch();
  for (const dx of [-0.58, 0.58]) b.torus(dx, 0.36, 0, 0.36, 0.035, '#222', { ry: Math.PI / 2 });
  b.boxB(0, 0.36, 0, 1.15, 0.045, 0.045, colour, { rz: 0.3 });
  b.boxB(0.12, 0.62, 0, 0.9, 0.045, 0.045, colour, { rz: -0.12 });
  b.boxB(-0.22, 0.86, 0, 0.32, 0.06, 0.14, '#3a2a20');
  b.boxB(0.52, 1.0, 0, 0.05, 0.05, 0.56, colour);
  b.boxB(0.78, 0.7, 0, 0.32, 0.26, 0.36, '#8a6a4a'); // the basket
  const m = b.build(ctx.toon);
  if (m) {
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    m.castShadow = true;
    ctx.group.add(m);
  }
}

/** The whole canal: sky, ground and water, the fronts, elms and furniture, a tour boat going by. */
export function buildAmsterdamCity(): City {
  resetJitter(11);
  const { ctx, out } = createBuildCtx();
  const { group, solid, glow, collide, pickAt, own, ramp, toon, glowMat } = ctx;

  // sky: a soft, high Dutch sky with big clouds' light
  const skyGeo = new THREE.SphereGeometry(400, 24, 16);
  const skyMat = skyMaterial('#6f9fd0', '#b9d1e8', '#f1f2ec');
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  group.add(sky);
  own(skyGeo, skyMat);
  const sunDir = new THREE.Vector3(-0.45, 0.42, 0.79).normalize();
  const sunTex = blobTexture('rgba(255,242,220,1)', 'rgba(255,216,176,0)', 256);
  const sunMat = new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const sunSprite = new THREE.Sprite(sunMat);
  sunSprite.scale.setScalar(140);
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
  const X1 = 140;
  const mid = (X0 + X1) / 2;
  const len = X1 - X0;
  // the ground is in two halves: the canal's water lies lower between them
  const groundMat = new THREE.MeshToonMaterial({ color: '#b9ad9c', gradientMap: ramp });
  own(groundMat);
  flat(600, 300 + CANAL.z0, 0, (CANAL.z0 - 300) / 2, -0.04, groundMat);
  flat(600, 300 - CANAL.z1, 0, (CANAL.z1 + 300) / 2, -0.04, groundMat);
  // the brick street (klinkers), warm red-brown; pavements of grey tiles; the red bike path; the quay's grey-brown bricks
  flat(len, 3.8, mid, -3.7, 0, planeMat(asphaltTexture(), len / 6, 1, '#b27a62'));
  flat(len, 3.4, mid, -7.3, 0.015, planeMat(sidewalkTexture(), len / 4, 1));
  flat(len, 1.6, mid, -1.0, 0.012, planeMat(asphaltTexture(), len / 6, 1, '#c0503a'));
  flat(len, 3.2, mid, 1.4, 0.015, planeMat(sidewalkTexture(), len / 4, 1, '#c9bba6'));
  flat(len, 3.4, mid, CANAL.z1 + 1.7, 0.015, planeMat(sidewalkTexture(), len / 4, 1, '#c9bba6'));
  for (const z of [-5.6, -1.8]) solid.boxB(mid, 0, z, len, 0.1, 0.2, '#a9a49b'); // the kerbs
  glow.boxB(mid, 0.014, -1.0, len, 0.01, 0.06, '#f2f0ea'); // the bike path's white line
  pickAt('fietspad', -10, 0.2, -1.0, 1.4);
  // the tram tracks, west of the market
  for (const z of [-4.4, -3.0]) for (const dz of [-0.36, 0.36]) glow.boxB((X0 + MARKET_X0) / 2, 0.016, z + dz, MARKET_X0 - X0, 0.01, 0.07, '#8a8d91');

  // the canal: green-grey water a little below the quays, its brick walls, the quay's edge stones
  const waterMat = new THREE.MeshToonMaterial({ color: '#4e7f86', gradientMap: ramp, transparent: true, opacity: 0.94 });
  own(waterMat);
  const water = flat(600, CANAL.z1 - CANAL.z0, 0, (CANAL.z0 + CANAL.z1) / 2, -0.75, waterMat);
  ctx.animate((_dt, t) => {
    water.position.y = -0.75 + Math.sin(t * 0.6) * 0.02;
  });
  const bedMat = new THREE.MeshToonMaterial({ color: '#253c3f', gradientMap: ramp });
  own(bedMat);
  flat(600, CANAL.z1 - CANAL.z0, 0, (CANAL.z0 + CANAL.z1) / 2, -2.2, bedMat);
  for (const z of [CANAL.z0, CANAL.z1]) {
    solid.boxB(mid, -2.2, z, len, 2.2, 0.3, '#7a4636');
    solid.boxB(mid, 0, z, len, 0.12, 0.45, '#9c968c');
  }
  // the canal is water: the player stays on the quays and crosses on the bridge
  collide((CANAL.x0 + BRIDGE.x0) / 2, (CANAL.z0 + CANAL.z1) / 2, BRIDGE.x0 - CANAL.x0, CANAL.z1 - CANAL.z0);
  collide((BRIDGE.x1 + CANAL.x1) / 2, (CANAL.z0 + CANAL.z1) / 2, CANAL.x1 - BRIDGE.x1, CANAL.z1 - CANAL.z0);

  buildAmsterdamFronts(ctx);

  // elms along the quays
  const iep = (x: number, z: number) => {
    solid.cyl(x, 0, z, 0.17, 0.24, 3.4, '#5b4a3c', { seg: 8 });
    for (const [dx, dy, dz, r] of [[0, 4.6, 0, 1.9], [0.9, 4.0, 0.5, 1.3], [-0.8, 4.1, -0.5, 1.35], [0.2, 5.6, -0.2, 1.2]] as const) solid.sphere(x + dx, dy, z + dz, r, '#5f9a4f', { ws: 10, hs: 8 });
    collide(x, z, 0.5, 0.5);
  };
  for (const x of [-42, -34, -12, 4, 18, 27]) iep(x, 2.3);
  for (const x of [-38, -24, -10, 2, 30, 40, 50]) iep(x, 15.9);
  pickAt('iep', -12, 2.4, 2.3, 1.0);

  // the street lamps: dark green poles with a lantern on top
  const lantaarn = (x: number, z: number) => {
    solid.cyl(x, 0, z, 0.07, 0.1, 3.8, '#2c3f35', { seg: 8 });
    solid.cyl(x, 3.8, z, 0.12, 0.26, 0.55, '#2c3f35', { seg: 6 });
    glow.cyl(x, 3.85, z, 0.2, 0.2, 0.42, '#ffe9b0', { seg: 6 });
    solid.cone(x, 4.35, z, 0.3, 0.3, '#2c3f35', { seg: 6 });
    collide(x, z, 0.3, 0.3);
  };
  for (const x of [-44, -27.5, -16, 0.5, 24, 36, 52]) lantaarn(x, 2.5);
  for (const x of [-33, -17, -1, 16, 31, 47]) lantaarn(x, 16.6);
  lantaarn(BRIDGE.x0 - 0.4, CANAL.z0 - 0.4);
  lantaarn(BRIDGE.x1 + 0.4, CANAL.z1 + 0.4);
  pickAt('lantaarn', -16, 3.2, 2.5, 0.9);

  // bikes: the racks on the quay (Daan's bike among them), bikes leaning everywhere
  for (const x of [-7.4, -6.4, -5.4]) solid.torus(x, 0.02, 2.4, 0.42, 0.035, '#8d9399', { arc: Math.PI, ry: Math.PI / 2 });
  collide(-6.4, 2.4, 3.2, 0.8);
  pickAt('fietsenrek', -6.4, 0.5, 2.4, 1.2);
  fiets(ctx, -3.2, 2.3, 0.1, '#2f6b5a');
  ctx.collide(-3.2, 2.3, 1.4, 0.5);
  pickAt('fiets', -3.2, 0.7, 2.3, 1.0);
  ctx.markBuilt('fietsenrek');
  const leaning: Array<[number, number, number, string]> = [
    [-38.5, -8.5, 0.05, '#1f1f1f'],
    [-21, -8.5, -0.04, '#6b2d2d'],
    [-10.5, -8.5, 0.03, '#1f1f1f'],
    [6, -8.5, 0.05, '#2b4a6b'],
    [-30, 2.6, 0, '#1f1f1f'],
    [-36, 2.6, 0.1, '#7a6a55'],
    [14.5, 16.8, -0.06, '#1f1f1f'],
  ];
  for (const [x, z, ry, c] of leaning) {
    fiets(ctx, x, z, ry, c);
    collide(x, z, 1.4, 0.5);
  }

  // the tram stop by the GVB: its sign, a shelter
  solid.cyl(24, 0, -6.2, 0.06, 0.06, 3.0, '#3a3a3a', { seg: 6 });
  glow.boxB(24, 2.5, -6.2, 0.9, 0.6, 0.06, '#1b3d8f');
  pickAt('tram_sign', 24, 2.7, -6.2, 0.9);
  solid.boxB(27, 0, -7.6, 3.4, 0.06, 1.2, '#3a3a3a');
  glow.boxB(27, 0.4, -8.2, 3.4, 2.0, 0.04, '#cfe4ee');
  solid.boxB(27, 2.4, -7.6, 3.6, 0.1, 1.4, '#3a3a3a');
  collide(27, -7.7, 3.6, 1.4);

  // a bench on the quay and a green rubbish bin
  solid.boxB(-14, 0.42, 2.45, 1.7, 0.1, 0.55, '#6b5444');
  solid.boxB(-14, 0.7, 2.15, 1.7, 0.45, 0.08, '#6b5444');
  collide(-14, 2.4, 1.8, 0.7);
  solid.cyl(-9, 0, -6.4, 0.3, 0.26, 0.95, '#2f6b3a', { seg: 10 });
  collide(-9, -6.4, 0.7, 0.7);
  pickAt('prullenbak', -9, 0.6, -6.4, 0.7);

  const solidMesh = solid.build(toon, { cast: true, receive: true, name: 'amsterdam-solid' });
  if (solidMesh) group.add(solidMesh);
  const glowMesh = glow.build(glowMat, { cast: false, receive: false, name: 'amsterdam-glow' });
  if (glowMesh) group.add(glowMesh);
  out.mapRects.push({ x0: X0, x1: X1, z0: -5.6, z1: -1.8, color: '#b27a62' });

  // a low open boat (a sloep) with a few people in it, gliding along the canal and under the bridge now and then
  const tb = new Batch();
  tb.boxB(0, -0.95, 0, 5.2, 0.55, 1.8, '#f4efe6');
  tb.boxB(0, -0.42, 0, 5.3, 0.06, 1.9, '#8a5a32');
  for (const [dx, c] of [[-1.4, '#e63946'], [0, '#1d3557'], [1.3, '#ffd166']] as const) {
    tb.boxB(dx, -0.62, 0, 0.5, 0.18, 1.5, '#8a5a32');
    tb.sphere(dx, -0.3, 0.3, 0.2, c, { sy: 1.3, ws: 8, hs: 6 });
  }
  const tour = tb.build(toon, { cast: false, receive: false, name: 'amsterdam-sloep' });
  if (tour) {
    tour.position.set(-80, 0, 10.6);
    group.add(tour);
    own(tour.geometry);
    ctx.animate((_dt, t) => {
      // 90 s a crossing from west to east, then 30 s away
      const p = (t % 120) / 90;
      tour.visible = p <= 1;
      tour.position.x = -80 + Math.min(1, p) * 190;
    });
  }

  // Amsterdam has no shrine: the ritual hooks are inert
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
        shutter = makeShutter(ctx, opening, { text: 'Gesloten' });
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
