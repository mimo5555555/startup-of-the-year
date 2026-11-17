import type { BuildCtx } from '../buildctx';
import { IZAKAYA } from '../layout';
import type { FrontInfo, FrontOverride } from './index';

/** Look of 居酒屋「なごみ」: dark wood, a red noren, red paper lanterns, a warm lit room, a chalk menu board. */
const LOOK = {
  wood: '#4a3226',
  woodLight: '#7a5636',
  noren: '#9b2a2a',
  lantern: '#e5453d',
  warm: '#ffc97a',
  board: '#2c3a2e',
  chalk: '#f4ecd8',
  gold: '#e8b04a',
};

/**
 * The south row's west end, restyled as the izakaya: a warm doorway under a red noren (Misaki stands in it), two red lanterns, a wooden
 * lattice window with the room's light, the 居酒屋なごみ board above, and the chalk menu board on the sidewalk against the wall.
 */
export const buildIzakaya: FrontOverride = (ctx: BuildCtx, front: FrontInfo): boolean => {
  const { solid, glow } = ctx;
  const L = LOOK;
  const { cx, zf, w } = front;

  // ---- the doorway: the warm room behind the noren ----
  solid.boxB(cx, 0, zf - 0.05, 2.6, 2.6, 0.1, '#2a1c16');
  glow.boxB(cx, 0.3, zf - 0.11, 2.3, 2.1, 0.01, L.warm);
  for (const sx of [-1, 1]) solid.boxB(cx + sx * 1.36, 0, zf - 0.12, 0.14, 2.7, 0.14, L.wood);
  solid.boxB(cx, 2.62, zf - 0.12, 2.86, 0.16, 0.16, L.wood);
  ctx.signPlane('なごみ', { bg: L.noren, fg: '#ffffff', round: 4 }, { x: cx, y: 2.15, z: zf - 0.2, w: 2.5, h: 0.85, texW: 300, texH: 102, ry: Math.PI, pickId: 'noren', pickRadius: 0.9 });

  // ---- a lattice window on the other side, lit from inside ----
  const wx = cx + 2.4;
  glow.boxB(wx, 0.9, zf - 0.04, 1.8, 1.3, 0.02, L.warm);
  for (let k = 0; k <= 6; k++) solid.boxB(wx - 0.9 + k * 0.3, 0.9, zf - 0.07, 0.06, 1.3, 0.04, L.wood);
  for (const y of [0.9, 2.2]) solid.boxB(wx, y, zf - 0.08, 1.9, 0.07, 0.05, L.wood);

  // ---- the eaves, the lanterns and the board above ----
  solid.boxB(cx, 3.0, zf - 0.45, w + 0.2, 0.18, 0.9, L.wood);
  for (const dx of [-3, 3]) {
    solid.cyl(cx + dx, 2.95, zf - 0.7, 0.05, 0.05, 0.1, '#2b2b36');
    glow.sphere(cx + dx, 2.45, zf - 0.7, 0.36, L.lantern, { sy: 1.3, ws: 10, hs: 8 });
    solid.cyl(cx + dx, 2.0, zf - 0.7, 0.2, 0.2, 0.06, '#2b2b36');
    ctx.pickAt('lantern', cx + dx, 2.45, zf - 0.7, 0.7);
  }
  ctx.signPlane(IZAKAYA.sign.text, { bg: L.wood, fg: L.gold, sub: IZAKAYA.sign.sub, subColor: '#f4ecd8', border: L.gold, round: 10 }, { x: cx, y: 4.3, z: zf - 0.12, w: Math.min(5.2, w - 1), h: 1.4, texW: 420, texH: 112, ry: Math.PI, pickId: 'izakaya', pickRadius: 1.3 });

  // ---- the chalk menu board on the sidewalk: 焼き鳥 680 / 枝豆 380 ----
  const b = IZAKAYA.board;
  const bx = (b.x0 + b.x1) / 2;
  const bz = (b.z0 + b.z1) / 2;
  solid.box(bx, 0.62, bz, 0.84, 1.24, 0.06, L.woodLight, { rx: -0.12 });
  ctx.signPlane('焼き鳥 680円', { bg: L.board, fg: L.chalk, sub: '枝豆 380円', subColor: L.chalk, border: L.woodLight, round: 6 }, { x: bx, y: 0.72, z: bz - 0.07, w: 0.74, h: 0.62, texW: 256, texH: 214, ry: Math.PI });
  ctx.collideRect(b);

  ctx.markBuilt('izakaya');
  ctx.mapRect({ x0: cx - w / 2, x1: cx + w / 2, z0: zf, z1: zf + 2 }, L.noren, 'izakaya');
  return true;
};
