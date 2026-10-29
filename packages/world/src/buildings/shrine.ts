// The shrine at the park's torii (桜町神社, Goen stage 1, docs/GOEN.md): a haiden front with a gabled copper roof, chigi and
// katsuogi, a shimenawa, the saisen box (pick `shrine:box`) with the bell (鈴) and its rope above it, an ema rack against the hedge
// and a chōzuya (pick `shrine:chozuya`) by the stepping stones from the path. The positions and colliders are layout data (SHRINE).
//
// Everything that stands still is merged into the city's two batches (no draw call of its own); the plaque is one textured plane
// and the bell with its rope one small mesh (it sways). The ritual's coin and sparkle are two more objects that exist only while
// they play: idle, the shrine adds 2 draw calls to the park view.
import * as THREE from 'three';
import { Batch } from '../batch';
import type { BuildCtx } from '../buildctx';
import { SHRINE, SHRINE_PICKS } from '../layout';
import { sparkleTexture } from '../textures';

/** The world side of the wish ritual's steps (the app runs the order and the taps). */
export type ShrineRitualStep = 'coin' | 'bow' | 'clap' | 'bell' | 'done';
export const SHRINE_RITUAL_STEPS: readonly ShrineRitualStep[] = ['coin', 'bow', 'clap', 'bell', 'done'];

export interface ShrineHandle {
  /** the moving parts (bell and rope, coin, sparkle); the rest is in the city's batches */
  readonly group: THREE.Group;
  /** start the shrine's part of a step: the coin's arc from `from` (the hand) into the box, the rope's sway, the closing shimmer */
  play(step: ShrineRitualStep, from?: THREE.Vector3): void;
  /** something is still moving */
  busy(): boolean;
  /** what the shrine's own objects cost to draw right now (visible meshes and sprites, triangles) */
  info(): { meshes: number; triangles: number };
}

const C = {
  vermilion: '#d8433f',
  plaster: '#f4ede0',
  wood: '#c89a62',
  woodMid: '#a97a48',
  woodDark: '#6b4a3c',
  interior: '#3d2c26',
  roof: '#4f8a78',
  roofDark: '#3c6e60',
  stone: '#b4b0a8',
  stoneDark: '#9a968e',
  gravel: '#ddd8cb',
  gold: '#e2b13c',
  straw: '#d9c27a',
  white: '#fbf8ef',
};

/** the coin flies this long, then the sparkle on the box this long */
const COIN_S = 0.8;
const SPARK_S = 0.6;
/** the rope sways this long after 'bell', the shimmer after 'done' this long */
const RING_S = 2.6;
const SHIMMER_S = 1.6;

const PRISM = new THREE.CylinderGeometry(1, 1, 1, 3);

/**
 * A triangular gable plate in the plane z = `z`: apex at (`x`, `apex`), base `halfW` either side at `base`, `t` thick. A 3-sided
 * cylinder turned on its side (its apex vertex points up after the turn) and scaled to the triangle.
 */
function gable(b: Batch, x: number, z: number, base: number, apex: number, halfW: number, t: number, color: string) {
  const h = apex - base;
  b.raw(PRISM, x, base + h / 3, z, halfW / 0.866, t, h / 1.5, color, { rx: -Math.PI / 2 });
}

/** a round rod between two points */
function rod(b: Batch, a: THREE.Vector3, c: THREE.Vector3, r: number, color: string, seg = 6) {
  const d = c.clone().sub(a);
  const len = d.length();
  const mid = a.clone().add(c).multiplyScalar(0.5);
  b.cyl(mid.x, mid.y - len / 2, mid.z, r, r, len, color, { seg, rx: Math.acos(Math.max(-1, Math.min(1, d.y / len))), ry: Math.atan2(d.x, d.z) });
}

/** Builds the shrine into the city (call it from the torii block of `buildCity`). */
export function buildShrine(ctx: BuildCtx): ShrineHandle {
  const { solid, glow } = ctx;
  const R = ctx.rng('shrine');
  const H = SHRINE.hall;
  const FX = H.x1; // the hall's front plane
  const BX = H.x0;
  const ZC = (H.z0 + H.z1) / 2;
  const XC = (H.x0 + H.x1) / 2;
  const ZW = H.z1 - H.z0;

  // ---- the precinct: gravel and stepping stones from the path ----
  solid.boxB(-18.4, 0, 12.275, 5.0, 0.035, 4.65, C.gravel);
  for (const [i, x] of [-15.45, -14.8, -14.15].entries()) solid.disc(x, 0.045, SHRINE.stand.z + (i % 2 ? 0.12 : -0.1), 0.27 + R() * 0.04, i % 2 ? C.stone : C.stoneDark, { seg: 9 });

  // ---- the hall: stone base, deck, plaster walls, vermilion posts and beams ----
  solid.boxB(XC, 0, ZC, H.x1 - H.x0 + 0.1, 0.26, ZW, C.stone);
  solid.boxB(XC + 0.05, 0.26, ZC, H.x1 - H.x0 - 0.1, 0.1, ZW - 0.1, C.woodMid);
  const F = 0.36; // floor level
  const TOP = 2.38; // top of the posts and beams
  solid.boxB(BX + 0.15, F, ZC, 0.1, TOP - F, ZW - 0.3, C.plaster);
  for (const z of [H.z0 + 0.1, H.z1 - 0.1]) solid.boxB(XC, F, z, H.x1 - H.x0 - 0.4, TOP - F, 0.1, C.plaster);
  // the front: a dark interior behind lattice doors in the side bays and a golden mirror in the open middle bay
  solid.boxB(FX - 0.22, F, ZC, 0.06, TOP - F - 0.1, ZW - 0.3, C.interior);
  glow.cyl(FX - 0.18, 1.12, ZC, 0.15, 0.15, 0.025, '#ffe6a0', { rz: Math.PI / 2, seg: 16 });
  glow.cyl(FX - 0.185, 1.12, ZC, 0.19, 0.19, 0.02, '#c9a24a', { rz: Math.PI / 2, seg: 16 });
  solid.boxB(FX - 0.17, F, ZC, 0.12, 0.6, 0.34, C.woodDark); // the mirror's stand
  for (const [z0, z1] of [[H.z0 + 0.2, ZC - 0.4], [ZC + 0.4, H.z1 - 0.2]] as const) {
    const zc = (z0 + z1) / 2;
    const w = z1 - z0;
    solid.boxB(FX - 0.16, F, zc, 0.05, 0.34, w, C.woodMid); // kickboard
    for (let k = 0; k < 5; k++) solid.boxB(FX - 0.15, F + 0.34, z0 + (k + 0.5) * (w / 5), 0.04, TOP - F - 0.5, 0.035, C.wood);
    for (const y of [1.1, 1.62]) solid.boxB(FX - 0.15, y, zc, 0.04, 0.035, w, C.wood);
  }
  for (const x of [FX - 0.1, BX + 0.15]) for (const z of [H.z0 + 0.1, H.z1 - 0.1]) solid.cyl(x, F, z, 0.075, 0.08, TOP - F, C.vermilion, { seg: 8 });
  for (const z of [ZC - 0.4, ZC + 0.4]) solid.cyl(FX - 0.1, F, z, 0.07, 0.075, TOP - F, C.vermilion, { seg: 8 });
  solid.boxB(FX - 0.1, 1.98, ZC, 0.1, 0.1, ZW + 0.1, C.vermilion); // nuki
  for (const x of [FX - 0.1, BX + 0.15]) solid.boxB(x, TOP - 0.14, ZC, 0.14, 0.14, ZW + 0.2, C.vermilion);
  for (const z of [H.z0 + 0.1, H.z1 - 0.1]) solid.boxB(XC, TOP - 0.14, z, H.x1 - H.x0 - 0.2, 0.14, 0.12, C.vermilion);
  // the frieze under the front eave (the plaque hangs on it) and the plaster above the back and side beams
  solid.boxB(FX - 0.12, TOP, ZC, 0.06, 0.5, ZW - 0.1, C.wood);
  solid.boxB(BX + 0.15, TOP, ZC, 0.08, 0.5, ZW - 0.1, C.plaster);

  // ---- the roof: ridge along z, copper slabs, gable plates, barge boards, chigi and katsuogi ----
  const RIDGE = { x: XC, y: 3.55 };
  const SPAN = 1.65; // ridge to eave, horizontally
  const DROP = 0.93;
  const a = Math.atan2(DROP, SPAN);
  const slope = Math.hypot(SPAN, DROP) + 0.06;
  const RZ0 = H.z0 - 0.225;
  const RZ1 = H.z1 + 0.225;
  const RL = RZ1 - RZ0;
  for (const s of [1, -1]) {
    const cx = RIDGE.x + (s * SPAN) / 2;
    solid.box(cx, RIDGE.y - DROP / 2, ZC, slope, 0.12, RL, C.roof, { rz: -s * a });
    for (const z of [RZ0 + 0.03, RZ1 - 0.03]) solid.box(cx, RIDGE.y - DROP / 2 - 0.04, z, slope, 0.12, 0.06, C.woodDark, { rz: -s * a });
  }
  for (const z of [H.z0 + 0.1, H.z1 - 0.1]) {
    gable(solid, RIDGE.x, z, RIDGE.y - DROP - 0.07, RIDGE.y - 0.07, SPAN, 0.08, C.plaster);
    solid.boxB(XC, TOP, z, H.x1 - H.x0 - 0.2, 0.2, 0.09, C.plaster);
  }
  solid.box(RIDGE.x, RIDGE.y + 0.05, ZC, 0.24, 0.14, RL - 0.1, C.roofDark);
  for (const z of [ZC - 0.75, ZC, ZC + 0.75]) solid.cyl(RIDGE.x, RIDGE.y + 0.2 - 0.21, z, 0.065, 0.065, 0.42, C.wood, { rz: Math.PI / 2, seg: 8 });
  for (const z of [RZ0 + 0.08, RZ1 - 0.08]) {
    for (const s of [1, -1]) {
      const k = 0.2;
      solid.box(RIDGE.x - s * Math.cos(a) * k, RIDGE.y + 0.06 + Math.sin(a) * k, z, 0.78, 0.09, 0.05, C.wood, { rz: -s * a });
    }
  }

  // ---- the shimenawa: a straw rope across the front with white shide ----
  {
    const x = FX + 0.06;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push(new THREE.Vector3(x, 2.2 - Math.sin(Math.PI * t) * 0.12, H.z0 + 0.12 + t * (ZW - 0.24)));
    }
    for (let i = 0; i < 6; i++) rod(solid, pts[i], pts[i + 1], 0.05, C.straw, 6);
    for (const z of [ZC - 0.75, ZC + 0.75]) {
      const y0 = 2.2 - Math.sin(Math.PI * ((z - H.z0 - 0.12) / (ZW - 0.24))) * 0.12 - 0.06;
      for (let k = 0; k < 3; k++) solid.box(x + 0.01, y0 - 0.06 - k * 0.075, z + (k % 2 ? 0.03 : -0.03), 0.012, 0.075, 0.06, C.white);
    }
  }

  // ---- the plaque: 桜町神社 on the frieze, above the bell ----
  const plaque = ctx.signPlane(
    '桜町神社',
    { bg: '#3d2c26', fg: '#f2d38a', border: '#c9a24a', sub: 'sakura-chō jinja · shrine', subColor: '#f2d38a', round: 6 },
    { x: FX - 0.07, y: TOP + 0.21, z: ZC, w: 0.92, h: 0.36, texW: 384, ry: Math.PI / 2 },
  );
  plaque.name = 'shrine-plaque';

  // ---- the saisen box ----
  const BOX = { x0: -18.35, x1: -17.8, z0: ZC - 0.5, z1: ZC + 0.5, h: 0.62 };
  {
    const bx = (BOX.x0 + BOX.x1) / 2;
    const bw = BOX.x1 - BOX.x0;
    const bd = BOX.z1 - BOX.z0;
    solid.boxB(bx, 0, ZC, bw, BOX.h - 0.08, bd, '#7a5236');
    solid.boxB(bx, 0, ZC, bw + 0.04, 0.06, bd + 0.04, '#4a3328'); // plinth
    // the slatted top: a dark well with slanted slats
    solid.boxB(bx, BOX.h - 0.1, ZC, bw - 0.04, 0.04, bd - 0.04, '#2c201a');
    for (let i = 0; i < 4; i++) solid.box(BOX.x0 + 0.08 + i * 0.13, BOX.h - 0.04, ZC, 0.1, 0.025, bd - 0.06, C.wood, { rz: 0.5 });
    for (const z of [BOX.z0 + 0.02, BOX.z1 - 0.02]) solid.boxB(bx, BOX.h - 0.1, z, bw + 0.02, 0.09, 0.04, '#5a3b28');
    for (const z of [BOX.z0 + 0.03, BOX.z1 - 0.03]) for (const x of [BOX.x0 + 0.03, BOX.x1 - 0.03]) solid.boxB(x, 0, z, 0.05, BOX.h, 0.05, C.gold); // brass corners
    // 賽銭 on the front, as two gold marks
    for (const z of [ZC - 0.16, ZC + 0.16]) glow.boxB(BOX.x1 + 0.006, 0.22, z, 0.01, 0.2, 0.14, '#e8c56a');
  }

  // ---- the ema rack against the hedge, plaques facing south ----
  {
    const E = SHRINE.ema;
    const ex = (E.x0 + E.x1) / 2;
    const zf = E.z1 - 0.08;
    for (const x of [E.x0 + 0.1, E.x1 - 0.1]) solid.boxB(x, 0, zf - 0.1, 0.07, 1.78, 0.07, C.woodDark);
    for (const y of [1.0, 1.38]) solid.boxB(ex, y, zf - 0.05, E.x1 - E.x0 - 0.1, 0.035, 0.035, C.woodDark);
    for (const s of [1, -1]) solid.box(ex, 1.86, zf - 0.1 + s * 0.13, E.x1 - E.x0 + 0.15, 0.04, 0.3, C.roof, { rx: s * 0.5 });
    const marks = ['#d8433f', '#f08fb0', '#5f9a55', '#3b6fb6', '#f2b134'];
    for (const [row, y] of [1.0, 1.38].entries()) {
      for (let i = 0; i < 4; i++) {
        const x = E.x0 + 0.2 + i * 0.22 + (row ? 0.04 : 0);
        const tilt = (R() - 0.5) * 0.16;
        const cy = y - 0.11;
        solid.box(x, cy, zf, 0.17, 0.11, 0.015, '#e9c98f', { rz: tilt });
        solid.box(x, cy + 0.055, zf, 0.085, 0.085, 0.015, '#e9c98f', { rz: tilt + Math.PI / 4 });
        solid.box(x, cy - 0.005, zf + 0.009, 0.07, 0.045, 0.004, marks[Math.floor(R() * marks.length)], { rz: tilt });
      }
    }
  }

  // ---- the chōzuya: a stone basin under a little roof, a bamboo spout and two ladles ----
  {
    const W = SHRINE.chozuya;
    const cx = (W.x0 + W.x1) / 2;
    const cz = (W.z0 + W.z1) / 2;
    const wx = W.x1 - W.x0;
    const wz = W.z1 - W.z0;
    for (const x of [W.x0 + 0.06, W.x1 - 0.06]) for (const z of [W.z0 + 0.06, W.z1 - 0.06]) solid.boxB(x, 0, z, 0.08, 1.98, 0.08, C.woodDark);
    for (const s of [1, -1]) solid.box(cx + s * 0.27, 2.08, cz, 0.62, 0.05, wz + 0.3, C.roof, { rz: -s * 0.43 });
    solid.box(cx, 2.2, cz, 0.1, 0.07, wz + 0.3, C.roofDark);
    // the basin: four stone walls round the water
    const bw = 0.6;
    const bd = 0.8;
    const t = 0.07;
    for (const s of [1, -1]) {
      solid.boxB(cx + (s * (bw - t)) / 2, 0, cz, t, 0.6, bd, C.stone);
      solid.boxB(cx, 0, cz + (s * (bd - t)) / 2, bw - 2 * t, 0.6, t, C.stone);
    }
    solid.boxB(cx, 0, cz, bw + 0.08, 0.08, bd + 0.08, C.stoneDark);
    glow.boxB(cx, 0.52, cz, bw - 2 * t, 0.012, bd - 2 * t, '#9fd4ea');
    rod(solid, new THREE.Vector3(W.x0 + 0.06, 0.98, cz), new THREE.Vector3(cx - 0.12, 0.84, cz), 0.03, '#7fae5a');
    glow.boxB(cx - 0.12, 0.53, cz, 0.015, 0.3, 0.015, '#cfe9f5');
    for (const z of [cz - 0.16, cz + 0.16]) {
      solid.box(cx, 0.615, z, wx - 0.12, 0.015, 0.02, C.wood);
      solid.cyl(cx + 0.2, 0.6, z, 0.045, 0.04, 0.07, C.wood, { seg: 8 });
    }
  }

  // ---- registration ----
  ctx.collideRect(SHRINE.hall);
  ctx.collideRect(SHRINE.box);
  ctx.collideRect(SHRINE.ema);
  ctx.collideRect(SHRINE.chozuya);
  ctx.occlude({ ...SHRINE.hall, y1: 2.7 });
  ctx.occlude({ x0: RIDGE.x - SPAN, x1: RIDGE.x + SPAN, z0: RZ0, z1: RZ1, y0: 2.5, y1: 3.9 });
  ctx.occlude({ ...SHRINE.ema, y1: 2.0 });
  ctx.occlude({ ...SHRINE.chozuya, y1: 2.3 });
  for (const p of SHRINE_PICKS) ctx.pickAt(p.id, p.x, p.y, p.z, p.radius);
  ctx.mapRect({ x0: H.x0, x1: SHRINE.box.x1, z0: H.z0, z1: H.z1 }, C.vermilion, 'shrine');

  // ---- the moving parts ----
  const group = new THREE.Group();
  group.name = 'shrine';
  ctx.group.add(group);

  // the bell and its rope hang from the front eave and swing about the top
  const pivot = new THREE.Vector3(-17.86, 2.55, ZC); // just under the front eave, over the box's front edge
  const bell = new THREE.Group();
  bell.name = 'shrine-bell';
  bell.position.copy(pivot);
  {
    const b = new Batch();
    b.boxB(0, -0.16, 0, 0.02, 0.16, 0.02, C.woodDark);
    b.sphere(0, -0.28, 0, 0.115, C.gold, { ws: 12, hs: 9 });
    b.torus(0, -0.3, 0, 0.1, 0.012, '#9c7a24', { rx: Math.PI / 2 });
    const cols = [C.vermilion, C.white, '#7a4a9a', C.vermilion, C.white, '#7a4a9a', C.vermilion];
    const top = -0.38;
    const seg = 0.18;
    cols.forEach((c, i) => b.cyl(0, top - (i + 1) * seg, 0, 0.034, 0.034, seg, c, { seg: 7, ry: i * 0.4 }));
    b.cone(0, top - cols.length * seg - 0.12, 0, 0.06, 0.14, C.vermilion, { seg: 7 });
    const m = b.build(ctx.toon, { cast: true, receive: false, name: 'shrine-bell' });
    if (m) bell.add(m);
  }
  group.add(bell);

  // the 5-yen coin (a brass ring) and the sparkle where it lands; both hidden until they play
  const coinB = new Batch();
  coinB.torus(0, 0, 0, 0.045, 0.02, '#e8c04a');
  const coin = coinB.build(ctx.glowMat, { cast: false, receive: false, name: 'shrine-coin' })!;
  coin.visible = false;
  group.add(coin);
  const sparkTex = sparkleTexture();
  const sparkMat = new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const spark = new THREE.Sprite(sparkMat);
  spark.name = 'shrine-sparkle';
  spark.visible = false;
  group.add(spark);
  ctx.own(sparkTex, sparkMat);

  const boxTop = new THREE.Vector3((BOX.x0 + BOX.x1) / 2, BOX.h + 0.02, ZC);
  const from = new THREE.Vector3();
  const defaultFrom = new THREE.Vector3(SHRINE.stand.x - 0.3, 1.05, SHRINE.stand.z);
  let coinT = -1;
  let sparkT = -1;
  let ringT = -1;
  let shimmerT = -1;

  ctx.animate((dt) => {
    if (coinT < 0 && sparkT < 0 && ringT < 0 && shimmerT < 0) return; // idle: nothing to do
    if (coinT >= 0) {
      coinT += dt;
      const k = Math.min(1, coinT / COIN_S);
      coin.position.lerpVectors(from, boxTop, k);
      coin.position.y += Math.sin(Math.PI * k) * 0.32;
      coin.rotation.set(coinT * 13, 0.6, 0);
      if (k >= 1) {
        coinT = -1;
        coin.visible = false;
        sparkT = 0;
      }
    }
    if (shimmerT >= 0) {
      shimmerT += dt;
      const k = shimmerT / SHIMMER_S;
      spark.visible = k < 1;
      spark.position.set(pivot.x + 0.1, 1.5 + k * 0.9, ZC);
      spark.scale.setScalar(0.5 + Math.sin(Math.PI * Math.min(1, k)) * 0.9);
      sparkMat.opacity = Math.max(0, 1 - k * k);
      sparkMat.rotation = k * 2;
      if (k >= 1) shimmerT = -1;
    } else if (sparkT >= 0) {
      sparkT += dt;
      const k = sparkT / SPARK_S;
      spark.visible = k < 1;
      spark.position.copy(boxTop).setY(boxTop.y + 0.12 + k * 0.2);
      spark.scale.setScalar(0.2 + k * 0.55);
      sparkMat.opacity = Math.max(0, 1 - k);
      sparkMat.rotation = k * 3;
      if (k >= 1) sparkT = -1;
    } else spark.visible = false;
    if (ringT >= 0) {
      ringT += dt;
      bell.rotation.x = 0.3 * Math.exp(-ringT * 1.3) * Math.sin(ringT * 6.2);
      bell.rotation.z = 0.05 * Math.exp(-ringT * 1.6) * Math.sin(ringT * 9.1);
      if (ringT >= RING_S) {
        ringT = -1;
        bell.rotation.set(0, 0, 0);
      }
    }
  });

  const tris = (m: THREE.Mesh) => {
    const g = m.geometry;
    return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  };

  return {
    group,
    play(step, at) {
      if (step === 'coin') {
        from.copy(at ?? defaultFrom);
        coinT = 0;
        sparkT = -1;
        coin.visible = true;
        coin.position.copy(from);
      } else if (step === 'bell') ringT = 0;
      else if (step === 'done') {
        shimmerT = 0;
        if (ringT < 0) ringT = RING_S * 0.45; // a last gentle swing
      }
    },
    busy: () => coinT >= 0 || sparkT >= 0 || ringT >= 0 || shimmerT >= 0,
    info() {
      let meshes = 0;
      let triangles = 0;
      for (const o of [plaque, ...group.children.flatMap((c) => (c === bell ? bell.children : [c]))]) {
        if (!o.visible || (o.parent && !o.parent.visible)) continue;
        meshes++;
        if ((o as THREE.Mesh).isMesh && !(o as THREE.Sprite).isSprite) triangles += tris(o as THREE.Mesh);
        else triangles += 2;
      }
      return { meshes, triangles };
    },
  };
}
