import * as THREE from 'three';
import { Batch } from '../batch';
import type { BuildCtx } from '../buildctx';
import { AIKO_STALL } from '../layout';
import type { FrontInfo, FrontOverride } from './index';

/** Look of the stall, in one place (everything else is geometry). */
const LOOK = {
  cedar: '#c79556',
  wood: '#9c6b3f',
  darkWood: '#6f4a2e',
  lacquer: '#4a2f23',
  persimmon: '#d9653b',
  cream: '#f6ead2',
  indigo: '#33507f',
  matcha: '#2f4a3a',
  tin: '#8a8f98',
  iron: '#34343c',
  steam: '#fff6dd',
  green: '#5f9a55',
  tea: '#b9c98a',
  cups: '#f4f1e6',
  lantern: '#e5453d',
  /** wagashi: sakura pink, white, matcha green, chestnut brown, yuzu yellow */
  wagashi: ['#f4a3bb', '#fffaf0', '#a8d08d', '#8b5a3c', '#f5d76e'],
  /** the flower buckets keep the florist's colours */
  blooms: ['#ff6b8b', '#ffd166', '#b8a1ff', '#ffffff', '#ff9f68'],
};

const DIM = {
  /** the awning meets the fascia this far off the wall and this high; its front edge height is AIKO_STALL.awningY */
  awningBackOff: 0.7,
  awningBackY: 3.15,
  awningGap: 0.2, // the front edge stands this far in front of the counter, so walkers on the sidewalk pass its edge
  stripes: 10,
  flapH: 0.2,
  /** counter */
  bodyH: 0.82,
  postW: 0.14,
  /** the noren hangs from the awning front edge: panel height, count and the slit between panels */
  norenH: 0.7,
  norenPanels: 5,
  norenSlit: 0.08,
  /** window behind the counter (the city's lit window: x cx +- 2.8, y 0.5..2.7) and the shelf above Aiko's head */
  windowHalf: 2.8,
  windowY0: 0.5,
  windowY1: 2.7,
  shelfY: 2.0,
  /** top of the header band the city draws (trim box at y 3.2, 0.2 high) */
  headerY: 3.2,
  /** the main sign plane and its pixel size */
  signW: 5.2,
  signH: 1.9,
  signY: 4.4,
  signTex: { w: 384, h: 140 },
  /** nameplate of the noren, in pixels */
  norenTex: { w: 160, h: 200 },
  /** sphere detail of the small round props */
  ball: { ws: 5, hs: 3 },
  /** cylinder segments of the small round props */
  seg: 6,
  /** stall shutter: slab in front of the awning edge, so a closed stall reads as one wooden panel */
  shutterOff: 0.07,
  shutterRibPitch: 0.28,
  shutterOverhang: 0.6,
  lanternY: 2.3,
  lanternR: 0.24,
  bucketR: 0.2,
  bucketH: 0.4,
};

/** hanging paper lanterns: how far each hangs in from the stall's sides */
const LANTERN_INSET = 0.5;

/**
 * Aiko's stall (Ono Tea House 小野茶房): restyles the florist front (hanaya) as a street tea stall. Returning true from
 * the override replaces the florist's default sign and flower pots. The city draws the wall, lit window and header band; this
 * adds the persimmon awning with a noren curtain (茶), the wooden counter with wagashi trays, a tea kettle on a brazier,
 * flower buckets at both ends, paper lanterns, and a 準備中 shutter. Aiko stands behind the counter on the sidewalk
 * and faces the street (the spawn is in NPC_SPAWNS; `markBuilt('aiko_stall')` lets her appear).
 * The counter collider comes from layout (counter:aiko), so only the two end caps that close the nook are added here.
 */
export const buildAiko: FrontOverride = (ctx: BuildCtx, front: FrontInfo): boolean => {
  const { solid, glow } = ctx;
  const rnd = ctx.rng('aiko');
  const pickOf = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)];
  const L = LOOK;
  const D = DIM;
  const { cx, zf } = front;
  const x0 = cx - front.w / 2;
  const x1 = cx + front.w / 2;
  const c = AIKO_STALL.counter;
  const ccx = (c.x0 + c.x1) / 2;
  const ccz = (c.z0 + c.z1) / 2;
  const cw = c.x1 - c.x0;
  const cd = c.z1 - c.z0;
  const top = AIKO_STALL.counterH;
  const ball = (x: number, y: number, z: number, r: number, col: string, o: { sx?: number; sy?: number; sz?: number } = {}) => solid.sphere(x, y, z, r, col, { ...D.ball, ...o });

  // ---- wall behind her: cedar boards around the lit window, a lattice over it, a shelf of tea tins above her head ----
  const wallZ = zf - 0.08; // board centres, 0.12 deep, just off the wall face
  const winL = cx - D.windowHalf;
  const winR = cx + D.windowHalf;
  solid.boxB(cx, 0, wallZ, front.w, D.windowY0, 0.12, L.cedar);
  solid.boxB(cx, D.windowY1, wallZ, front.w, D.headerY - D.windowY1, 0.12, L.cedar);
  solid.boxB((x0 + winL) / 2, D.windowY0, wallZ, winL - x0, D.windowY1 - D.windowY0, 0.12, L.cedar);
  solid.boxB((winR + x1) / 2, D.windowY0, wallZ, x1 - winR, D.windowY1 - D.windowY0, 0.12, L.cedar);
  const latticeZ = zf - 0.1;
  for (let i = 0; i < 5; i++) solid.boxB(winL + (i * (winR - winL)) / 4, D.windowY0, latticeZ, 0.05, D.windowY1 - D.windowY0, 0.04, L.darkWood);
  for (const y of [(D.windowY0 + D.windowY1) / 2, D.windowY1 - 0.05]) solid.boxB(cx, y, latticeZ, winR - winL, 0.05, 0.04, L.darkWood);
  const shelfZ = zf - 0.25;
  solid.boxB(cx, D.shelfY, shelfZ, 3.6, 0.05, 0.28, L.darkWood);
  for (let i = 0; i < 6; i++) {
    const x = cx - 1.5 + i * 0.6;
    solid.cyl(x, D.shelfY + 0.05, shelfZ, 0.09, 0.1, 0.22, i % 2 ? L.green : L.tea, { seg: D.seg });
  }

  // ---- the sign: 小野茶房 hung flat on the wall above the header band, in a wooden frame ----
  const signZ = zf - 0.1;
  const sx = D.signW / 2;
  const sh = D.signH / 2;
  const signCy = D.signY;
  const frameT = 0.1;
  solid.boxB(cx, signCy + sh, signZ + 0.04, D.signW + 0.2, frameT, 0.1, L.darkWood);
  solid.boxB(cx, signCy - sh - frameT, signZ + 0.04, D.signW + 0.2, frameT, 0.1, L.darkWood);
  for (const sgn of [-1, 1]) solid.boxB(cx + sgn * (sx + frameT / 2), signCy - sh, signZ + 0.04, frameT, D.signH, 0.1, L.darkWood);
  ctx.signPlane(AIKO_STALL.sign.text, { bg: L.matcha, fg: L.cream, sub: AIKO_STALL.sign.sub, subColor: L.cream, border: L.cedar, round: 14 }, { x: cx, y: signCy, z: signZ - 0.02, w: D.signW, h: D.signH, texW: D.signTex.w, texH: D.signTex.h, ry: Math.PI });

  // ---- fascia board over the city's pink header band, and the awning with its flap ----
  const fasciaZ = zf - D.awningBackOff - 0.04;
  solid.boxB(cx, D.awningBackY, fasciaZ, front.w + 0.1, 0.27, 0.08, L.darkWood);
  const backZ = zf - D.awningBackOff;
  const frontZ = c.z0 - D.awningGap;
  const span = backZ - frontZ;
  const rise = D.awningBackY - AIKO_STALL.awningY;
  const slope = Math.atan2(rise, span);
  const len = Math.hypot(span, rise);
  const stripeW = front.w / D.stripes;
  for (let i = 0; i < D.stripes; i++) {
    const x = x0 + stripeW * (i + 0.5);
    const col = i % 2 ? L.cream : L.persimmon;
    solid.box(x, (D.awningBackY + AIKO_STALL.awningY) / 2 + 0.02, (backZ + frontZ) / 2, stripeW, 0.05, len, col, { rx: -slope });
    solid.boxB(x, AIKO_STALL.awningY - D.flapH, frontZ, stripeW, D.flapH, 0.04, col);
  }

  // ---- counter: wooden body, slatted front, cedar top, two corner posts that carry the awning, an indigo runner ----
  solid.boxB(ccx, 0, ccz, cw - 0.1, D.bodyH, cd - 0.1, L.wood);
  solid.boxB(ccx, D.bodyH, ccz, cw, top - D.bodyH, cd, L.cedar);
  for (let i = 0; i < 4; i++) solid.boxB(c.x0 + 0.5 + (i * (cw - 1)) / 3, 0.08, c.z0 - 0.005, 0.05, D.bodyH - 0.2, 0.02, L.darkWood);
  solid.boxB(ccx, 0.18, c.z0 - 0.025, 1.3, 0.5, 0.03, L.indigo);
  for (const x of [c.x0 + D.postW / 2 + 0.04, c.x1 - D.postW / 2 - 0.04]) solid.boxB(x, top, c.z0 + D.postW, D.postW, AIKO_STALL.awningY - top, D.postW, L.darkWood);

  // wagashi trays on the front half of the counter
  const trayZ = c.z0 + 0.3;
  const trayXs = [-1.2, 0, 1.2].map((dx) => ccx + dx);
  for (const x of trayXs) {
    solid.boxB(x, top, trayZ, 0.95, 0.04, 0.42, L.lacquer);
    for (let i = 0; i < 3; i++) {
      const col = L.wagashi[(i + Math.floor(rnd() * L.wagashi.length)) % L.wagashi.length];
      ball(x - 0.3 + i * 0.3, top + 0.1, trayZ + (i % 2 ? 0.07 : -0.07), 0.08, col, { sy: 0.7 });
    }
  }
  // tea tins and a teapot with cups on the back half
  const backRowZ = c.z0 + 0.7;
  for (let i = 0; i < 3; i++) solid.cyl(c.x0 + 0.5, top + i * 0.2, backRowZ, 0.11, 0.11, 0.2, i === 1 ? L.tea : L.green, { seg: D.seg });
  ball(c.x0 + 1.3, top + 0.12, backRowZ, 0.13, L.cups, { sy: 0.85 });
  solid.cyl(c.x0 + 1.3, top + 0.2, backRowZ, 0.04, 0.05, 0.06, L.cups, { seg: D.seg });
  for (let i = 0; i < 3; i++) solid.cyl(c.x0 + 1.75 + i * 0.2, top, backRowZ - 0.04, 0.05, 0.035, 0.07, L.cups, { seg: D.seg });
  // the kettle on a little charcoal brazier, steam rising as a pale wisp
  const kx = c.x1 - 0.65;
  solid.boxB(kx, top, backRowZ, 0.38, 0.2, 0.34, L.iron);
  glow.boxB(kx, top + 0.2, backRowZ, 0.24, 0.02, 0.2, L.lantern);
  ball(kx, top + 0.36, backRowZ, 0.17, L.iron, { sy: 0.85 });
  solid.cyl(kx, top + 0.5, backRowZ, 0.05, 0.08, 0.05, L.iron, { seg: D.seg });
  solid.boxB(kx + 0.17, top + 0.28, backRowZ, 0.14, 0.05, 0.05, L.iron, { rz: 0.7 });
  solid.boxB(kx, top + 0.52, backRowZ, 0.3, 0.025, 0.025, L.iron);
  glow.sphere(kx + 0.2, top + 0.72, backRowZ, 0.06, L.steam, { ...D.ball });
  glow.sphere(kx + 0.26, top + 0.86, backRowZ, 0.045, L.steam, { ...D.ball });

  // ---- noren: indigo panels with a slit between them hang from the awning's front edge; the middle one carries 茶 ----
  const norenW = (cw - D.norenSlit * (D.norenPanels - 1)) / D.norenPanels;
  const norenZ = frontZ - 0.01;
  const norenTop = AIKO_STALL.awningY - D.flapH;
  for (let i = 0; i < D.norenPanels; i++) {
    const x = c.x0 + norenW / 2 + i * (norenW + D.norenSlit);
    solid.boxB(x, norenTop - D.norenH, norenZ, norenW, D.norenH, 0.02, L.indigo);
  }
  solid.boxB(ccx, norenTop - 0.03, norenZ, cw + 0.1, 0.03, 0.04, L.darkWood);
  ctx.signPlane('茶', { bg: L.indigo, fg: L.cream, round: 6 }, { x: ccx, y: norenTop - D.norenH / 2, z: norenZ - 0.02, w: norenW * 0.92, h: D.norenH * 0.9, texW: D.norenTex.w, texH: D.norenTex.h, ry: Math.PI });

  // ---- paper lanterns under the awning at both ends (the 提灯 sign word) ----
  const lanternZ = frontZ + 0.2;
  for (const x of [x0 + LANTERN_INSET, x1 - LANTERN_INSET]) {
    solid.boxB(x, D.lanternY + D.lanternR * 1.25, lanternZ, 0.025, AIKO_STALL.awningY - D.lanternY - D.lanternR * 1.25, 0.025, L.darkWood);
    glow.sphere(x, D.lanternY, lanternZ, D.lanternR, L.lantern, { sy: 1.25, ws: 6, hs: 4 });
    solid.boxB(x, D.lanternY + D.lanternR * 1.2, lanternZ, 0.14, 0.04, 0.14, L.iron);
    solid.boxB(x, D.lanternY - D.lanternR * 1.25, lanternZ, 0.14, 0.04, 0.14, L.iron);
    ctx.pickAt('lantern', x, D.lanternY, lanternZ, 0.7);
  }

  // ---- floor: duckboard behind the counter, so Aiko stands on slats ----
  solid.boxB(ccx, 0.01, c.z1 + (zf - c.z1) / 2, cw - 0.2, 0.025, zf - c.z1 - 0.1, L.darkWood);

  // ---- end caps: they close the nook between the counter and the wall; flower buckets stand at the pots from layout ----
  const capZ0 = c.z1;
  const capD = zf - capZ0;
  const capCz = capZ0 + capD / 2;
  ctx.collideRect(c); // the counter itself (the layout lists it as counter:aiko)
  const left = { x0, x1: c.x0, z0: capZ0, z1: zf };
  const right = { x0: c.x1, x1, z0: capZ0, z1: zf };
  ctx.collideRect(left);
  ctx.collideRect(right);
  const crate = (r: { x0: number; x1: number }, h: number, z: number, d: number) => solid.boxB((r.x0 + r.x1) / 2, 0, z, r.x1 - r.x0 - 0.1, h, d, L.wood);
  const bucket = (x: number, y: number, z: number) => {
    solid.cyl(x, y, z, D.bucketR, D.bucketR * 0.8, D.bucketH, L.tin, { seg: D.seg });
    ball(x, y + D.bucketH + 0.05, z, D.bucketR * 1.05, L.green, { sy: 0.7 });
    for (let k = 0; k < 2; k++) ball(x + (rnd() - 0.5) * 0.3, y + D.bucketH + 0.2 + rnd() * 0.12, z + (rnd() - 0.5) * 0.25, 0.1, pickOf(L.blooms));
  };
  // left: a two-step flower stand
  crate(left, 0.28, capZ0 + capD * 0.35, capD * 0.6);
  crate(left, 0.56, capZ0 + capD * 0.75, capD * 0.4);
  bucket(left.x0 + 0.38, 0.28, capZ0 + capD * 0.35);
  bucket(left.x1 - 0.38, 0.56, capZ0 + capD * 0.75);
  bucket(left.x0 + 0.55, 0.28, capCz + 0.15);
  // right: tea chests and the florist's last buckets
  crate(right, 0.4, capZ0 + capD * 0.7, capD * 0.5);
  solid.boxB((right.x0 + right.x1) / 2, 0.4, capZ0 + capD * 0.7, right.x1 - right.x0 - 0.3, 0.05, capD * 0.4, L.darkWood);
  for (const p of AIKO_STALL.pots.filter((q) => q.x > cx)) bucket(p.x, 0, p.z);

  // ---- the 準備中 shutter: one wooden panel that drops across the front of the stall ----
  registerStallShutter(ctx, { x0: c.x0 - D.shutterOverhang, x1: c.x1 + D.shutterOverhang, z: frontZ - D.shutterOff });

  ctx.mapRect({ x0, x1, z0: frontZ, z1: zf }, L.persimmon, 'aiko');
  ctx.markBuilt('aiko_stall');
  return true;
};

/** The shutter in the stall's wood: a ribbed slab from the sidewalk to the awning edge with a 準備中 plate facing the street. Hidden until the stall closes. */
function registerStallShutter(ctx: BuildCtx, o: { x0: number; x1: number; z: number }): void {
  const g = new THREE.Group();
  const w = o.x1 - o.x0;
  const h = AIKO_STALL.awningY;
  const cx = (o.x0 + o.x1) / 2;
  const b = new Batch();
  b.boxB(cx, 0, o.z, w, h, 0.05, LOOK.cedar, { jitter: 0 });
  for (let i = 1; i * DIM.shutterRibPitch < h; i++) b.boxB(cx, i * DIM.shutterRibPitch, o.z - 0.03, w, 0.04, 0.03, LOOK.wood, { jitter: 0 });
  const slab = b.build(ctx.toon, { cast: false, receive: false, name: 'aiko-shutter' });
  if (slab) {
    g.add(slab);
    ctx.own(slab.geometry);
  }
  const pw = Math.min(4.2, w - 1);
  const plate = ctx.signPlane('準備中', { bg: LOOK.cream, fg: '#b3402f', sub: 'junbi-chū', subColor: LOOK.darkWood, border: '#b3402f', round: 14 }, { x: cx, y: h * 0.5, z: o.z - 0.09, w: pw, h: pw * 0.36, ry: Math.PI });
  ctx.group.remove(plate); // signPlane parks it in the city group; it lives in the shutter group instead
  g.add(plate);
  ctx.registerShutter('aiko', g);
}
