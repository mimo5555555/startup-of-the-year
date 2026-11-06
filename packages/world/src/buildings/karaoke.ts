import type { BuildCtx } from '../buildctx';
import { KARAOKE } from '../layout';
import type { FrontInfo, FrontOverride } from './index';

/** Look of カラオケ「うたひろば」: deep blue and violet, gold and pink neon, a big microphone over the door. */
const LOOK = {
  violet: '#5b3cc4',
  blue: '#24206b',
  gold: '#ffd166',
  pink: '#ff5d8f',
  cyan: '#7bdff2',
  dark: '#1b1638',
  board: '#fff6d8',
};

/**
 * The hotel front restyled as the karaoke box: a lit door (Nanami stands in it), a neon sign and microphone, lit room windows on the floors
 * above with singers' silhouettes, and the price board on the sidewalk. The door is the `karaoke:room` pick (a booked room, with a friend).
 */
export const buildKaraoke: FrontOverride = (ctx: BuildCtx, front: FrontInfo): boolean => {
  const { solid, glow } = ctx;
  const L = LOOK;
  const { cx, zf, w } = front;
  const doorX = cx - 0.9;

  // ---- the door: dark glass with a lit lobby, neon trim ----
  solid.boxB(doorX, 0, zf - 0.05, 2.4, 2.7, 0.1, L.dark);
  glow.boxB(doorX, 0.02, zf - 0.12, 2.2, 0.03, 0.4, L.gold);
  glow.boxB(doorX - 0.6, 1.3, zf - 0.11, 0.7, 0.9, 0.01, L.violet);
  glow.boxB(doorX + 0.6, 1.5, zf - 0.11, 0.5, 0.5, 0.01, L.pink);
  for (const sx of [-1, 1]) glow.boxB(doorX + sx * 1.25, 0, zf - 0.14, 0.06, 2.75, 0.04, L.cyan);
  glow.boxB(doorX, 2.75, zf - 0.14, 2.56, 0.06, 0.04, L.cyan);
  // the sign, and a big neon microphone beside it
  ctx.signPlane(KARAOKE.sign.text, { bg: L.violet, fg: L.gold, sub: KARAOKE.sign.sub, subColor: '#fff', border: L.pink, round: 16 }, { x: cx - 0.6, y: 4.3, z: zf - 0.75, w: Math.min(5.4, w - 2.4), h: 1.6, texW: 420, texH: 130, ry: Math.PI });
  const micX = cx + 3.8;
  glow.sphere(micX, 4.75, zf - 0.6, 0.38, L.gold, { ws: 12, hs: 10 });
  solid.cyl(micX, 3.55, zf - 0.6, 0.12, 0.17, 0.9, L.dark, { seg: 10 });
  glow.boxB(micX, 3.5, zf - 0.6, 0.5, 0.05, 0.05, L.pink);

  // ---- room windows above: coloured light and a singer's silhouette in some ----
  const rooms: Array<[number, number, string, boolean]> = [
    [-3.6, 5.2, L.pink, true], [-1.2, 5.2, L.cyan, false], [1.2, 5.2, L.violet, true], [3.6, 5.2, L.gold, false],
  ];
  for (const [dx, y, col, singer] of rooms) {
    glow.boxB(cx + dx, y, zf - 0.03, 1.8, 1.0, 0.04, col);
    if (singer) {
      solid.boxB(cx + dx - 0.25, y + 0.05, zf - 0.06, 0.28, 0.55, 0.02, L.dark);
      solid.sphere(cx + dx - 0.25, y + 0.72, zf - 0.06, 0.13, L.dark, { ws: 8, hs: 6, sz: 0.2 });
    }
  }

  // ---- the price board on the sidewalk: 1時間 ¥1,000 / 2時間 ¥1,800 ----
  const b = KARAOKE.board;
  const bx = (b.x0 + b.x1) / 2;
  const bz = (b.z0 + b.z1) / 2;
  solid.box(bx, 0.6, bz, 0.9, 1.2, 0.06, L.blue, { rx: 0.12 });
  ctx.signPlane('1時間 ¥1,000', { bg: L.board, fg: L.blue, sub: '2時間 ¥1,800', subColor: L.violet, border: L.gold, round: 10 }, { x: bx, y: 0.72, z: bz - 0.07, w: 0.8, h: 0.62, texW: 256, texH: 200, ry: Math.PI });
  ctx.collideRect(b);

  ctx.pickAt(KARAOKE.pick, doorX, 1.3, zf - 0.2, 1.1);
  ctx.markBuilt('karaoke');
  ctx.mapRect({ x0: cx - w / 2, x1: cx + w / 2, z0: zf, z1: zf + 2 }, L.violet, 'karaoke');
  return true;
};
