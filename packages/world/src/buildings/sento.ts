import * as THREE from 'three';
import type { BuildCtx } from '../buildctx';
import { SENTO } from '../layout';
import type { FrontInfo, FrontOverride } from './index';

/** Look of 銭湯「桜の湯」: cream plaster, dark wood lattice, a grey tiled curved gable, indigo and crimson curtains, a brick chimney. */
const LOOK = {
  wood: '#5b4130',
  woodLight: '#8a6748',
  lattice: '#3f2e22',
  tile: '#434a57',
  tileEdge: '#2f343e',
  gold: '#c9a227',
  men: '#24467a',
  women: '#b0303a',
  board: '#3a2b22',
  boardText: '#f3e2b3',
  brick: '#a9553f',
  band: '#f2ece2',
  stone: '#8d8577',
  warm: '#ffcf8a',
  bottle: '#f0e2c8',
  cap: '#7a4a2a',
};

/**
 * The game-centre row's east end restyled as the neighbourhood public bath: a lit doorway with the 男 (indigo) and 女 (crimson) noren under a
 * curved karahafu gable, wooden lattice on both sides, the 桜の湯 board above, a wooden bench with bottles of coffee milk (west) and the
 * shoe lockers (east) against the wall, and the brick chimney with ゆ on it rising from the roof, steam drifting from its top.
 */
export const buildSento: FrontOverride = (ctx: BuildCtx, front: FrontInfo): boolean => {
  const { solid, glow } = ctx;
  const L = LOOK;
  const { cx, zf, w } = front;

  // ---- the doorway: a warm lobby behind the curtains ----
  solid.boxB(cx, 0, zf - 0.05, 3.2, 2.75, 0.1, '#2a211c');
  glow.boxB(cx, 0.3, zf - 0.11, 2.9, 2.2, 0.01, L.warm);
  glow.boxB(cx, 0.02, zf - 0.14, 3.0, 0.03, 0.4, L.warm);
  for (const sx of [-1, 1]) solid.boxB(cx + sx * 1.66, 0, zf - 0.12, 0.14, 2.8, 0.14, L.wood);
  solid.boxB(cx, 2.75, zf - 0.12, 3.46, 0.16, 0.16, L.wood);
  // the curtains: 男 on indigo, 女 on crimson, each with the ゆ of a bath
  ctx.signPlane('ゆ', { bg: L.men, fg: '#ffffff', sub: '男', subColor: '#ffffff', round: 4 }, { x: cx + 0.76, y: 2.12, z: zf - 0.2, w: 1.44, h: 1.1, texW: 200, texH: 152, ry: Math.PI, pickId: 'noren', pickRadius: 0.8 });
  ctx.signPlane('ゆ', { bg: L.women, fg: '#ffffff', sub: '女', subColor: '#ffffff', round: 4 }, { x: cx - 0.76, y: 2.12, z: zf - 0.2, w: 1.44, h: 1.1, texW: 200, texH: 152, ry: Math.PI, pickId: 'noren', pickRadius: 0.8 });

  // ---- the lattice (格子) over the lit band on both sides of the door, on a stone base ----
  solid.boxB(cx, 0, zf - 0.04, w, 0.5, 0.08, L.stone);
  for (const sx of [-1, 1]) {
    const x0 = cx + sx * 1.75;
    const x1 = cx + sx * (w / 2 - 0.7);
    const n = Math.round(Math.abs(x1 - x0) / 0.28);
    for (let k = 0; k <= n; k++) solid.boxB(x0 + ((x1 - x0) * k) / n, 0.5, zf - 0.07, 0.07, 2.2, 0.05, L.lattice);
    for (const y of [0.5, 1.6, 2.7]) solid.boxB((x0 + x1) / 2, y, zf - 0.08, Math.abs(x1 - x0) + 0.1, 0.08, 0.06, L.lattice);
  }

  // ---- the curved gable (唐破風) over the door, cantilevered from the wall on brackets ----
  const gz = zf - 0.75;
  for (const sx of [-1, 1]) {
    // the two slopes rise to the middle; the lower ends curl up (the karahafu's bow)
    solid.box(cx + sx * 1.35, 3.42, gz, 2.9, 0.2, 1.7, L.tile, { rz: -sx * 0.3 });
    solid.box(cx + sx * 2.95, 3.06, gz, 0.6, 0.18, 1.7, L.tile, { rz: sx * 0.32 });
    solid.box(cx + sx * 1.35, 3.3, gz - 0.86, 2.9, 0.12, 0.06, L.tileEdge, { rz: -sx * 0.3 });
    solid.boxB(cx + sx * 1.9, 2.85, zf - 0.35, 0.16, 0.3, 0.7, L.wood);
  }
  solid.sphere(cx, 3.82, gz, 0.42, L.tile, { sx: 2.2, sy: 0.5, sz: 2.05, ws: 12, hs: 6 });
  // the gable's face board and its gold ornament (懸魚)
  solid.box(cx, 3.2, gz - 0.8, 2.6, 0.32, 0.06, L.woodLight);
  glow.box(cx, 3.12, gz - 0.84, 0.42, 0.3, 0.03, L.gold);
  // paper lanterns at the gable's ends
  for (const sx of [-1, 1]) {
    glow.sphere(cx + sx * 2.45, 2.45, gz - 0.35, 0.26, '#fff1d6', { sy: 1.3, ws: 10, hs: 8 });
    solid.cyl(cx + sx * 2.45, 2.75, gz - 0.35, 0.12, 0.12, 0.07, '#2b2b36');
    ctx.pickAt('lantern', cx + sx * 2.45, 2.45, gz - 0.35, 0.6);
  }

  // ---- the board above: 桜の湯 (a pick: 銭湯) ----
  ctx.signPlane(SENTO.sign.text, { bg: L.board, fg: L.boardText, sub: SENTO.sign.sub, subColor: '#e8c98a', border: L.gold, round: 8 }, { x: cx, y: 4.95, z: zf - 0.12, w: Math.min(4.6, w - 4), h: 1.25, texW: 420, texH: 116, ry: Math.PI, pickId: 'sento', pickRadius: 1.3 });

  // ---- the wooden bench (west) with bottles of coffee milk on its end ----
  {
    const b = SENTO.bench;
    const bx = (b.x0 + b.x1) / 2;
    const bz = (b.z0 + b.z1) / 2;
    solid.boxB(bx, 0.4, bz, 1.7, 0.08, 0.5, L.woodLight);
    solid.boxB(bx, 0.48, b.z1 - 0.06, 1.7, 0.45, 0.06, L.woodLight);
    for (const dx of [-0.7, 0.7]) solid.boxB(bx + dx, 0, bz, 0.08, 0.4, 0.44, L.wood);
    for (let k = 0; k < 3; k++) {
      const x = b.x1 - 0.18 - k * 0.12;
      solid.cyl(x, 0.48, bz - 0.08, 0.045, 0.05, 0.19, L.bottle, { seg: 8 });
      solid.cyl(x, 0.67, bz - 0.08, 0.048, 0.048, 0.025, L.cap, { seg: 8 });
    }
    ctx.collideRect(b);
    ctx.occlude({ ...b, y1: 1.2 });
    ctx.pickAt('bench', bx, 0.6, bz, 0.9);
  }

  // ---- the shoe lockers (下駄箱, east): small doors with wooden key plates ----
  {
    const r = SENTO.lockers;
    const lx = (r.x0 + r.x1) / 2;
    const lz = (r.z0 + r.z1) / 2;
    const h = SENTO.lockersH;
    solid.boxB(lx, 0, lz, r.x1 - r.x0, h, r.z1 - r.z0, L.wood);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const x = r.x0 + 0.2 + col * 0.4;
        const y = 0.12 + row * 0.34;
        solid.boxB(x, y, r.z0 - 0.01, 0.34, 0.28, 0.02, L.woodLight);
        solid.boxB(x, y + 0.1, r.z0 - 0.025, 0.12, 0.07, 0.02, '#e9dcc0');
      }
    }
    ctx.collideRect(r);
    ctx.occlude({ ...r, y1: h + 0.2 });
  }

  // ---- the chimney (煙突) with ゆ, and steam from its top ----
  const c = SENTO.chimney;
  const roof = front.style.h;
  solid.cyl(c.x, roof, c.z, c.r * 0.82, c.r * 1.1, c.top - roof, L.brick, { seg: 14 });
  for (const y of [roof + 3.4, c.top - 1.6]) solid.cyl(c.x, y, c.z, c.r * 1.02, c.r * 1.02, 0.3, L.band, { seg: 14 });
  solid.cyl(c.x, c.top - 0.25, c.z, c.r * 0.95, c.r * 0.95, 0.25, '#3b3333', { seg: 14 });
  ctx.signPlane('ゆ', { bg: L.band, fg: L.women, round: 6 }, { x: c.x, y: roof + 6.2, z: c.z - c.r - 0.06, w: 1.0, h: 1.0, texW: 160, texH: 160, ry: Math.PI, pickId: 'chimney', pickRadius: 1.4 });
  const steamG = new THREE.SphereGeometry(0.4, 8, 6);
  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(steamG, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false }));
    puffs.push(m);
    ctx.group.add(m);
    ctx.own(m.material as THREE.Material);
  }
  ctx.own(steamG);
  ctx.animate((_dt, t) => {
    puffs.forEach((p, i) => {
      const k = (t * 0.12 + i / puffs.length) % 1;
      p.position.set(c.x + k * 1.6 + Math.sin(t * 0.7 + i) * 0.2, c.top + 0.2 + k * 3.2, c.z - k * 0.4);
      p.scale.setScalar(0.6 + k * 1.8);
      (p.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - k);
    });
  });

  ctx.markBuilt('sento');
  ctx.mapRect({ x0: cx - w / 2, x1: cx + w / 2, z0: zf, z1: zf + 2 }, L.men, 'sento');
  return true;
};
