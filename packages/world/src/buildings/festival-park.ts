// The festival in the park (slice 5B, chapter 7): six yatai stalls along an aisle on the east lawn, a small yagura stage
// north of the east path, strings of chōchin lanterns and fireworks over the south hedge. Built lazily by the world on
// the first `setFestival(true)`; everything is merged into a handful of draw calls (the budget is +8 calls, +12k triangles).
//
// The east lawn is the one open stretch of the park with no tree canopy low enough to clip a 3 m roof: the aisle runs
// x 2.9..8.05, z 25..38, the stalls stand with their backs to the east and south hedges, and the stage faces the path.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batch, rng } from '../batch';
import type { FestivalHandle, FestivalMaterials } from '../festival';
import { boxRect, type MapRect, type Rect } from '../layout';
import { blobTexture, signTexture, type SignStyle } from '../textures';

export type FestivalStallId = 'takoyaki' | 'yakisoba' | 'kakigori' | 'ramen' | 'kingyo' | 'ringoame';

export interface FestivalStall {
  id: FestivalStallId;
  /** footprint centre */
  x: number;
  z: number;
  /** rotation.y: the counter faces local +z (PI/2 faces east, -PI/2 west, PI north) */
  ry: number;
  sign: { text: string; sub: string } & Pick<SignStyle, 'bg' | 'fg' | 'border'>;
  /** awning stripes, counter front, noren */
  colors: { awning: [string, string]; counter: string; noren: string };
}

/** A stall is 2.4 m wide (along its counter) and 1.5 m deep; the front posts carry the sign up to 2.95 m. */
export const STALL = { w: 2.4, d: 1.5, eave: 2.35, top: 2.95 };

export const FESTIVAL_STALLS: readonly FestivalStall[] = [
  // west row (x 1.4..2.9), facing east across the aisle
  { id: 'takoyaki', x: 2.15, z: 26.4, ry: Math.PI / 2, sign: { text: 'たこ焼き', sub: 'takoyaki', bg: '#fff3d6', fg: '#b8322a', border: '#b8322a' }, colors: { awning: ['#d8433f', '#fff6ec'], counter: '#c23a2b', noren: '#2c3555' } },
  { id: 'yakisoba', x: 2.15, z: 29.8, ry: Math.PI / 2, sign: { text: '焼きそば', sub: 'yakisoba', bg: '#ffe7a3', fg: '#3d2a1c', border: '#3d2a1c' }, colors: { awning: ['#f2b134', '#fff6ec'], counter: '#e09a28', noren: '#3b4a8a' } },
  // east row (x 8.05..9.55), backs to the east hedge, facing west
  { id: 'kakigori', x: 8.8, z: 27.8, ry: -Math.PI / 2, sign: { text: 'かき氷', sub: 'kakigōri', bg: '#ffffff', fg: '#d1263b', border: '#3b7fd1' }, colors: { awning: ['#3b7fd1', '#ffffff'], counter: '#3b7fd1', noren: '#2f6fbf' } },
  { id: 'ramen', x: 8.8, z: 31.2, ry: -Math.PI / 2, sign: { text: 'ラーメン', sub: 'rāmen · けんじ', bg: '#d8433f', fg: '#fff8ef', border: '#ffd9c9' }, colors: { awning: ['#2c3555', '#f6eee2'], counter: '#8a5a3a', noren: '#d8433f' } },
  { id: 'kingyo', x: 8.8, z: 34.6, ry: -Math.PI / 2, sign: { text: '金魚すくい', sub: 'kingyo-sukui', bg: '#e6f7ff', fg: '#e8503a', border: '#3fa7e0' }, colors: { awning: ['#ff7f50', '#ffffff'], counter: '#3fa7e0', noren: '#e8503a' } },
  // the end of the aisle, back to the south hedge, facing north
  { id: 'ringoame', x: 6.8, z: 38.8, ry: Math.PI, sign: { text: 'りんご飴', sub: 'ringo-ame', bg: '#fff0f4', fg: '#c81e4a', border: '#c81e4a' }, colors: { awning: ['#e0457b', '#fff6f8'], counter: '#e0457b', noren: '#7a2a4a' } },
];
export const FESTIVAL_STALL_IDS: readonly FestivalStallId[] = FESTIVAL_STALLS.map((s) => s.id);

/** The speech stage: a low yagura north of the east path, facing south (the audience stands on the path). */
export const FESTIVAL_STAGE = { x: 4, z: 19.6, w: 3.6, d: 1.8, h: 0.6, roof: 3.0 };

export const stallPickId = (id: FestivalStallId) => `stall:${id}` as const;
export const FESTIVAL_STAGE_PICK = 'festival:stage';

/** local (lx, lz) of a stall -> world (x, z) */
const toWorld = (s: { x: number; z: number; ry: number }, lx: number, lz: number) => ({
  x: s.x + lx * Math.cos(s.ry) + lz * Math.sin(s.ry),
  z: s.z - lx * Math.sin(s.ry) + lz * Math.cos(s.ry),
});

/** A stall's footprint (it blocks walking; its back sits flush on the hedge). */
export const stallRect = (s: FestivalStall): Rect => {
  const across = Math.abs(Math.sin(s.ry)) > 0.5;
  return boxRect(s.x, s.z, across ? STALL.d : STALL.w, across ? STALL.w : STALL.d);
};
export const stageRect = (): Rect => boxRect(FESTIVAL_STAGE.x, FESTIVAL_STAGE.z, FESTIVAL_STAGE.w, FESTIVAL_STAGE.d);

export interface FestivalSpot {
  x: number;
  z: number;
  /** rotation.y (0 faces +z) */
  face: number;
}

const facing = (x: number, z: number, tx: number, tz: number): FestivalSpot => ({ x, z, face: Math.atan2(tx - x, tz - z) });
/** where the speaker stands, in front of the stage and facing the audience on the path */
const SPEAKER = { x: FESTIVAL_STAGE.x, z: 21.5 };
const ramenStall = FESTIVAL_STALLS.find((s) => s.id === 'ramen')!;
const behindRamen = toWorld(ramenStall, 0, -0.25);

/**
 * Festival spots: `stage` is where the learner stands for the speech (heading = facing the audience), `mc` is Hanako's
 * place beside the stage, `kenji` is behind his ramen counter and `guests` are the friends' places in order (the first
 * four watch the stage from the path, the rest stand along the aisle).
 */
export const FESTIVAL_SPOTS = {
  stage: { x: SPEAKER.x, z: SPEAKER.z, heading: 0 },
  mc: facing(1.5, 20.9, SPEAKER.x, SPEAKER.z + 1.5),
  kenji: { x: behindRamen.x, z: behindRamen.z, face: ramenStall.ry },
  guests: [
    facing(1.2, 23.6, SPEAKER.x, SPEAKER.z),
    facing(2.7, 24.2, SPEAKER.x, SPEAKER.z),
    facing(5.4, 24.1, SPEAKER.x, SPEAKER.z),
    facing(6.9, 23.2, SPEAKER.x, SPEAKER.z),
    facing(4.3, 28.6, 8.8, 27.8),
    facing(6.4, 30.4, 2.15, 29.8),
    facing(4.6, 33.4, 8.8, 34.6),
    facing(6.0, 36.4, 6.8, 38.8),
  ] as readonly FestivalSpot[],
};
/** talk radius of a person at the festival (the street's 4.4-5.4 m would overlap in a crowd this close) */
export const FESTIVAL_TALK_RADIUS = 2.4;

/** The colliders, picks and minimap rects the world adds while the festival is on (and takes away again). */
export function festivalExtras(): { colliders: Rect[]; picks: Array<{ id: string; pos: THREE.Vector3; radius: number }>; mapRects: MapRect[] } {
  const colliders: Rect[] = [...FESTIVAL_STALLS.map(stallRect), stageRect()];
  const picks = FESTIVAL_STALLS.map((s) => {
    const p = toWorld(s, 0, STALL.d / 2 + 0.1);
    return { id: stallPickId(s.id), pos: new THREE.Vector3(p.x, 1.7, p.z), radius: 1.3 };
  });
  picks.push({ id: FESTIVAL_STAGE_PICK, pos: new THREE.Vector3(FESTIVAL_STAGE.x, 1.6, FESTIVAL_STAGE.z + 0.4), radius: 1.7 });
  const mapRects: MapRect[] = [...FESTIVAL_STALLS.map((s) => ({ ...stallRect(s), color: '#ff8a5c' })), { ...stageRect(), color: '#e2504a', label: 'festival' }];
  return { colliders, picks, mapRects };
}

// ---------------------------------------------------------------------------------------------
// geometry
// ---------------------------------------------------------------------------------------------

/** A stall-local box: (lx, lz) is turned with the stall; `rx` tilts it before the turn (Batch rotates YXZ). */
type Local = (lx: number, y0: number, lz: number, w: number, h: number, d: number, color: string, rx?: number) => void;
const localBox = (b: Batch, s: { x: number; z: number; ry: number }): Local => (lx, y0, lz, w, h, d, color, rx = 0) => {
  const p = toWorld(s, lx, lz);
  b.boxB(p.x, y0, p.z, w, h, d, color, { ry: s.ry, rx });
};

/** Food on each counter, built from a few low-poly primitives (y0 is the counter top). */
function counterFood(solid: Batch, s: FestivalStall, y0: number) {
  const at = (lx: number, lz: number) => toWorld(s, lx, lz);
  const front = STALL.d / 2 - 0.3;
  if (s.id === 'takoyaki') {
    const g = at(0.3, front);
    solid.boxB(g.x, y0, g.z, 0.8, 0.08, 0.8, '#2b2b36', { ry: s.ry });
    for (let i = 0; i < 6; i++) {
      const p = at(0.05 + (i % 3) * 0.25, front - 0.12 + Math.floor(i / 3) * 0.24);
      solid.sphere(p.x, y0 + 0.13, p.z, 0.08, '#c7843d', { ws: 5, hs: 4 });
    }
  } else if (s.id === 'yakisoba') {
    const g = at(0, front);
    solid.boxB(g.x, y0, g.z, 1.4, 0.05, 0.6, '#3a3a44', { ry: s.ry });
    solid.boxB(g.x, y0 + 0.05, g.z, 1.1, 0.06, 0.45, '#b9773a', { ry: s.ry });
  } else if (s.id === 'kakigori') {
    for (const [lx, col] of [[-0.5, '#e8453c'], [0, '#3fa34d'], [0.5, '#3b7fd1']] as const) {
      const p = at(lx, front);
      solid.cyl(p.x, y0, p.z, 0.1, 0.07, 0.14, '#f6f6f6', { seg: 6 });
      solid.sphere(p.x, y0 + 0.2, p.z, 0.11, col, { ws: 6, hs: 4 });
    }
  } else if (s.id === 'ramen') {
    const p = at(0.55, -0.35);
    solid.cyl(p.x, 0.8, p.z, 0.3, 0.28, 0.42, '#bfc4cd', { seg: 8 });
    for (const lx of [-0.6, -0.15]) {
      const b = at(lx, front);
      solid.cyl(b.x, y0, b.z, 0.15, 0.1, 0.13, '#f4f1ea', { seg: 8 });
    }
  } else if (s.id === 'kingyo') {
    // the counter is a shallow tub of water with goldfish
    const p = at(0, front);
    solid.boxB(p.x, y0 - 0.02, p.z, 1.9, 0.04, 0.5, '#7cc6e8', { ry: s.ry });
    for (let i = 0; i < 5; i++) {
      const f = at(-0.7 + i * 0.35, front + (i % 2 ? 0.1 : -0.1));
      solid.boxB(f.x, y0 + 0.02, f.z, 0.14, 0.03, 0.06, '#ff7a2f', { ry: s.ry + i });
    }
  } else if (s.id === 'ringoame') {
    for (let i = 0; i < 5; i++) {
      const p = at(-0.6 + i * 0.3, front);
      solid.cyl(p.x, y0, p.z, 0.012, 0.012, 0.3, '#e9d8b4', { seg: 4 });
      solid.sphere(p.x, y0 + 0.36, p.z, 0.09, '#d1263b', { ws: 6, hs: 4 });
    }
  }
}

/** One stall: counter, back shelf, posts, striped awning, noren, sign board, a stand-in vendor (not at Kenji's). */
function buildStall(solid: Batch, s: FestivalStall, R: () => number) {
  const { w, d, eave, top } = STALL;
  const box = localBox(solid, s);
  const { awning, counter, noren } = s.colors;
  // counter with a white band and a wooden top; a low shelf behind
  box(0, 0, d / 2 - 0.3, w - 0.1, 0.9, 0.6, counter);
  box(0, 0.5, d / 2 + 0.005, w - 0.1, 0.14, 0.02, '#fbf6ee');
  box(0, 0.9, d / 2 - 0.3, w, 0.06, 0.7, '#d9b48a');
  box(0, 0, -d / 2 + 0.25, w - 0.2, 0.8, 0.45, '#8a6a52');
  // posts: the front ones run up to the top of the sign board
  for (const sx of [-1, 1]) {
    box(sx * (w / 2 - 0.05), 0, d / 2 - 0.05, 0.08, top, 0.08, '#6b4a3c');
    box(sx * (w / 2 - 0.05), 0, -d / 2 + 0.05, 0.08, eave + 0.3, 0.08, '#6b4a3c');
  }
  // the awning slopes up to the back in six stripes, with a valance along the front
  const slope = Math.atan2(0.3, d + 0.3);
  const n = 6;
  for (let i = 0; i < n; i++) box(-w / 2 - 0.1 + ((i + 0.5) * (w + 0.2)) / n, eave + 0.12, 0.05, (w + 0.2) / n, 0.05, d + 0.35, awning[i % 2], slope);
  box(0, eave - 0.12, d / 2 + 0.21, w + 0.2, 0.18, 0.03, awning[0]);
  // noren: three panels under the eave
  for (const lx of [-0.75, 0, 0.75]) box(lx, 1.78, d / 2 + 0.2, 0.68, eave - 0.14 - 1.78, 0.02, noren);
  // the sign's backing board (the text plane sits just in front of it)
  box(0, eave + 0.05, d / 2 - 0.08, w - 0.06, top - eave - 0.05, 0.05, '#4a3328');
  counterFood(solid, s, 0.96);
  // a vendor behind the counter: shirt, head, hachimaki (Kenji stands at his own stall)
  if (s.id !== 'ramen') {
    const v = toWorld(s, 0, -0.2);
    const shirt = ['#f7f4ee', '#2c3555', '#3fa34d', '#e8c547'][Math.floor(R() * 4)];
    solid.cyl(v.x, 0, v.z, 0.2, 0.26, 1.2, shirt, { seg: 7 });
    solid.sphere(v.x, 1.38, v.z, 0.17, '#efc39a', { ws: 7, hs: 5 });
    solid.sphere(v.x, 1.44, v.z, 0.172, '#2a2224', { ws: 7, hs: 4, sy: 0.75 });
    solid.cyl(v.x, 1.4, v.z, 0.18, 0.18, 0.05, '#f6f6f6', { seg: 7 });
  }
}

/** The yagura stage: platform with a kōhaku skirt, a red-and-white backdrop, four red posts and a dark roof. */
function buildStage(solid: Batch, glow: Batch) {
  const st = FESTIVAL_STAGE;
  const s = { x: st.x, z: st.z, ry: 0 };
  const box = localBox(solid, s);
  const lit = localBox(glow, s);
  box(0, 0, 0, st.w, st.h, st.d, '#a8754f');
  box(0, st.h, 0, st.w + 0.1, 0.06, st.d + 0.1, '#c89466');
  // kōhaku skirt on the front and the sides
  const strips = 9;
  for (let i = 0; i < strips; i++) {
    const c = i % 2 ? '#fbf6ee' : '#d8433f';
    box(-st.w / 2 + ((i + 0.5) * st.w) / strips, 0.04, st.d / 2 + 0.02, st.w / strips, st.h - 0.08, 0.02, c);
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) box(sx * (st.w / 2 + 0.02), 0.04, -st.d / 2 + ((i + 0.5) * st.d) / 4, 0.02, st.h - 0.08, st.d / 4, i % 2 ? '#fbf6ee' : '#d8433f');
  // backdrop curtain: unlit, so it stays bright behind the speaker at dusk
  for (let i = 0; i < strips; i++) lit(-st.w / 2 + ((i + 0.5) * st.w) / strips, st.h + 0.06, -st.d / 2 + 0.06, st.w / strips, 1.5, 0.03, i % 2 ? '#fbf6ee' : '#d8433f');
  // posts, roof, ridge
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.cyl(st.x + sx * (st.w / 2 - 0.08), st.h, st.z + sz * (st.d / 2 - 0.08), 0.06, 0.06, st.roof - st.h, '#c0392b', { seg: 6 });
  box(0, st.roof, 0, st.w + 0.5, 0.14, st.d + 0.5, '#3a2e2c');
  box(0, st.roof + 0.14, 0, st.w - 0.4, 0.2, 0.35, '#2b2224');
  // banner board under the front of the roof (the text plane sits on it)
  box(0, 2.15, st.d / 2 - 0.02, st.w - 0.2, 0.8, 0.04, '#4a3328');
}

/** Sample a sagging string between a and b (a parabola is close enough to a catenary at this scale). */
const sagPoint = (a: THREE.Vector3, b: THREE.Vector3, t: number, sag: number) => new THREE.Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));

/** The lantern strings: [from, to, sag]; ends sit on stall front posts and stage roof corners, above head height. */
const STRINGS: Array<[THREE.Vector3, THREE.Vector3, number]> = (() => {
  const top = STALL.top - 0.05;
  const corner = (id: FestivalStallId, side: -1 | 1) => {
    const s = FESTIVAL_STALLS.find((x) => x.id === id)!;
    const p = toWorld(s, side * (STALL.w / 2 - 0.05), STALL.d / 2 - 0.05);
    return new THREE.Vector3(p.x, top, p.z);
  };
  const st = FESTIVAL_STAGE;
  const roofL = new THREE.Vector3(st.x - st.w / 2 + 0.08, st.roof, st.z + st.d / 2 - 0.08);
  const roofR = new THREE.Vector3(st.x + st.w / 2 - 0.08, st.roof, st.z + st.d / 2 - 0.08);
  return [
    // from the stage down to the two mouths of the aisle
    [roofL, corner('takoyaki', 1), 0.3],
    [roofR, corner('kakigori', -1), 0.3],
    // across the aisle, zig-zag
    [corner('takoyaki', -1), corner('ramen', 1), 0.28],
    [corner('yakisoba', -1), corner('kingyo', 1), 0.28],
    [corner('kingyo', -1), corner('ringoame', 1), 0.22],
    // along the stage front
    [roofL, roofR, 0.12],
  ];
})();

/** Lantern centres: hanging under each string and at the front corners of every stall. */
function lanternSpots(): Array<{ p: THREE.Vector3; red: boolean }> {
  const out: Array<{ p: THREE.Vector3; red: boolean }> = [];
  for (const [a, b, sag] of STRINGS) {
    const len = a.distanceTo(b);
    const k = Math.max(2, Math.round(len / 0.95));
    for (let i = 1; i < k; i++) out.push({ p: sagPoint(a, b, i / k, sag).add(new THREE.Vector3(0, -0.3, 0)), red: i % 2 === 1 });
  }
  for (const s of FESTIVAL_STALLS) {
    for (const side of [-1, 1]) {
      const p = toWorld(s, side * (STALL.w / 2 + 0.05), STALL.d / 2 + 0.25);
      out.push({ p: new THREE.Vector3(p.x, STALL.eave - 0.32, p.z), red: true });
    }
  }
  return out;
}

const LANTERN_RED = '#ef4a3a';
const LANTERN_WHITE = '#fff1cf';

// ---------------------------------------------------------------------------------------------
// fireworks: one Points cloud, each burst a slot of particles animated on the CPU
// ---------------------------------------------------------------------------------------------

const BURSTS = 6;
const PER_BURST = 72;
const RISE_S = 0.9;
const LIFE_S = 2.6;
/** a new burst every this many seconds */
const EVERY_S = 0.85;
const FW_COLORS = ['#ff6a8a', '#ffd166', '#7ad7ff', '#b28cff', '#8dffb0', '#ffffff'];

interface Burst {
  t0: number;
  centre: THREE.Vector3;
  color: THREE.Color;
  /** false: the slot is free (its particles are black, so additive blending draws nothing) */
  alive: boolean;
}

/** Fireworks over the south hedge of the park, where the follow camera sees them when it looks up at the stage area. */
export const FIREWORKS_AREA = { x0: -14, x1: 16, y0: 15, y1: 22, z0: 50, z1: 62 };

function makeFireworks(dot: THREE.Texture) {
  const n = BURSTS * PER_BURST;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3((FIREWORKS_AREA.x0 + FIREWORKS_AREA.x1) / 2, 18, (FIREWORKS_AREA.z0 + FIREWORKS_AREA.z1) / 2), 40);
  const mat = new THREE.PointsMaterial({ size: 0.75, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const points = new THREE.Points(geo, mat);
  points.name = 'festival:fireworks';
  points.frustumCulled = false;
  points.visible = false;

  // unit directions on a sphere (Fibonacci), one set shared by every burst, with a per-particle speed
  const dirs: THREE.Vector3[] = [];
  const speed: number[] = [];
  const R = rng(77);
  for (let i = 0; i < PER_BURST; i++) {
    const y = 1 - ((i + 0.5) / PER_BURST) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.399963;
    dirs.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    speed.push(0.8 + R() * 0.3);
  }
  const bursts: Burst[] = Array.from({ length: BURSTS }, () => ({ t0: 0, centre: new THREE.Vector3(), color: new THREE.Color(), alive: false }));
  let clock = 0;
  let next = 0;
  let k = 0;
  let on = false;

  const launch = () => {
    const b = bursts[k % BURSTS];
    const A = FIREWORKS_AREA;
    b.t0 = clock;
    b.centre.set(A.x0 + R() * (A.x1 - A.x0), A.y0 + R() * (A.y1 - A.y0), A.z0 + R() * (A.z1 - A.z0));
    b.color.set(FW_COLORS[k % FW_COLORS.length]);
    b.alive = true;
    k++;
  };

  const update = (dt: number) => {
    if (!points.visible) return;
    clock += dt;
    if (on && clock >= next) {
      launch();
      next = clock + EVERY_S * (0.75 + R() * 0.5);
    }
    // off and the last shell has faded: stop drawing the cloud at all
    if (!on && bursts.every((b) => !b.alive || clock - b.t0 > RISE_S + LIFE_S)) {
      points.visible = false;
      return;
    }
    for (let bi = 0; bi < BURSTS; bi++) {
      const b = bursts[bi];
      const age = clock - b.t0;
      if (b.alive && age > RISE_S + LIFE_S) b.alive = false;
      for (let i = 0; i < PER_BURST; i++) {
        const j = (bi * PER_BURST + i) * 3;
        if (!b.alive) {
          col[j] = col[j + 1] = col[j + 2] = 0;
          continue;
        }
        if (age < RISE_S) {
          // the shell climbs as one faint dot (72 of them stack into a bright one)
          const u = age / RISE_S;
          pos[j] = b.centre.x;
          pos[j + 1] = b.centre.y - 14 * (1 - u) * (1 - u);
          pos[j + 2] = b.centre.z;
          col[j] = col[j + 1] = col[j + 2] = 0.03;
          continue;
        }
        const t = age - RISE_S;
        const out = 6.5 * speed[i] * (1 - Math.exp(-2.6 * t));
        const d = dirs[i];
        pos[j] = b.centre.x + d.x * out;
        pos[j + 1] = b.centre.y + d.y * out - 0.9 * t * t;
        pos[j + 2] = b.centre.z + d.z * out;
        const fade = Math.pow(Math.max(0, 1 - t / LIFE_S), 1.6) * (t < 0.12 ? 1.6 : 1) * (0.85 + 0.15 * Math.sin(clock * 30 + i));
        col[j] = b.color.r * fade;
        col[j + 1] = b.color.g * fade;
        col[j + 2] = b.color.b * fade;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  };

  return {
    points,
    update,
    /** on: bursts start at once; off: no new shells, the ones in the air finish */
    set(v: boolean) {
      if (v && !on) next = clock;
      on = v;
      if (v) points.visible = true;
    },
    get on() {
      return on;
    },
    /** stops at once and clears the sky (the festival is over) */
    reset() {
      on = false;
      for (const b of bursts) b.alive = false;
      col.fill(0);
      geo.attributes.color.needsUpdate = true;
      points.visible = false;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// signs: one canvas atlas for the six stalls and the stage banner, drawn as one merged mesh
// ---------------------------------------------------------------------------------------------

const ATLAS = { w: 512, slotH: 128, slots: 8 };

function signAtlas(): { texture: THREE.CanvasTexture; slot: (i: number) => [number, number] } {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS.w;
  canvas.height = ATLAS.slotH * ATLAS.slots;
  const ctx = canvas.getContext('2d')!;
  const signs: Array<{ text: string; style: SignStyle }> = FESTIVAL_STALLS.map((s) => ({ text: s.sign.text, style: { bg: s.sign.bg, fg: s.sign.fg, border: s.sign.border, sub: s.sign.sub, subColor: s.sign.fg, round: 14 } }));
  signs.push({ text: '桜町まつり', style: { bg: '#fbf6ee', fg: '#c0392b', border: '#c0392b', sub: 'sakura-chō matsuri', subColor: '#3d2f2b', round: 14 } });
  // each sign is drawn with the street's own sign painter, then copied into its slot
  signs.forEach((s, i) => {
    const t = signTexture(s.text, s.style, ATLAS.w, ATLAS.slotH);
    ctx.drawImage(t.image as HTMLCanvasElement, 0, i * ATLAS.slotH);
    t.dispose();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  // v runs bottom-up in three.js (flipY): slot i covers v from 1 - (i+1)/slots to 1 - i/slots
  return { texture, slot: (i) => [1 - (i + 1) / ATLAS.slots, 1 - i / ATLAS.slots] };
}

/** a sign plane (w x h) with its uvs set to one atlas slot, placed and turned */
function signQuad(w: number, h: number, v: [number, number], x: number, y: number, z: number, ry: number) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) > 0.5 ? v[1] : v[0]);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
  return g;
}

// ---------------------------------------------------------------------------------------------

export interface FestivalPark extends FestivalHandle {
  /** start or stop the fireworks (the festival group must be visible for them to show) */
  setFireworks(on: boolean): void;
  fireworksOn(): boolean;
  /** clear the sky at once */
  resetFireworks(): void;
}

export function buildFestivalPark(materials: FestivalMaterials): FestivalPark {
  const group = new THREE.Group();
  group.name = 'festival';
  const disposables: Array<{ dispose(): void }> = [];
  const solid = new Batch();
  const glow = new Batch();
  const R = rng(5150);

  for (const s of FESTIVAL_STALLS) buildStall(solid, s, R);
  buildStage(solid, glow);

  // strings (thin dark segments) and lanterns
  for (const [a, b, sag] of STRINGS) {
    const k = 8;
    for (let i = 0; i < k; i++) {
      const p0 = sagPoint(a, b, i / k, sag);
      const p1 = sagPoint(a, b, (i + 1) / k, sag);
      const d = p1.clone().sub(p0);
      const len = d.length();
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      glow.box(mid.x, mid.y, mid.z, 0.025, 0.025, len, '#2b2224', { ry: Math.atan2(d.x, d.z), rx: -Math.asin(d.y / len) });
    }
  }
  const lanterns = lanternSpots();
  for (const { p, red } of lanterns) {
    glow.sphere(p.x, p.y, p.z, 0.17, red ? LANTERN_RED : LANTERN_WHITE, { sy: 1.3, ws: 6, hs: 4 });
    glow.cyl(p.x, p.y + 0.19, p.z, 0.08, 0.08, 0.07, '#2b2224', { seg: 5 });
  }

  const solidMesh = solid.build(materials.toon, { name: 'festival:solid' });
  const glowMesh = glow.build(materials.glow, { cast: false, receive: false, name: 'festival:lanterns' });
  for (const m of [solidMesh, glowMesh]) {
    if (!m) continue;
    group.add(m);
    disposables.push(m.geometry);
  }

  // signs: one mesh over the atlas
  const atlas = signAtlas();
  const quads: THREE.BufferGeometry[] = FESTIVAL_STALLS.map((s, i) => {
    const p = toWorld(s, 0, STALL.d / 2 - 0.05);
    return signQuad(STALL.w - 0.16, (STALL.w - 0.16) / 4, atlas.slot(i), p.x, STALL.eave + 0.05 + (STALL.top - STALL.eave - 0.05) / 2, p.z, s.ry);
  });
  const st = FESTIVAL_STAGE;
  quads.push(signQuad(st.w - 0.3, (st.w - 0.3) / 4, atlas.slot(FESTIVAL_STALLS.length), st.x, 2.55, st.z + st.d / 2 + 0.005, 0));
  const signGeo = mergeGeometries(quads, false)!;
  quads.forEach((q) => q.dispose());
  const signMat = new THREE.MeshBasicMaterial({ map: atlas.texture, transparent: true, toneMapped: false });
  const signs = new THREE.Mesh(signGeo, signMat);
  signs.name = 'festival:signs';
  group.add(signs);
  disposables.push(signGeo, signMat, atlas.texture);

  // lantern glow: one additive point per lantern
  const dot = blobTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)', 64);
  const haloGeo = new THREE.BufferGeometry().setFromPoints(lanterns.map((l) => l.p));
  const haloMat = new THREE.PointsMaterial({ size: 0.95, map: dot, color: '#ffb46b', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
  const halos = new THREE.Points(haloGeo, haloMat);
  halos.name = 'festival:halos';
  group.add(halos);
  disposables.push(haloGeo, haloMat, dot);

  const fw = makeFireworks(dot);
  group.add(fw.points);
  disposables.push(fw);

  return {
    group,
    update(dt, t) {
      haloMat.opacity = 0.55 + Math.sin(t * 2.3) * 0.05;
      fw.update(dt);
    },
    setFireworks: (on) => fw.set(on),
    fireworksOn: () => fw.on,
    resetFireworks: () => fw.reset(),
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
