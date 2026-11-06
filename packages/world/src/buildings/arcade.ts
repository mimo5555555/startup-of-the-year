import type { BuildCtx } from '../buildctx';
import { ARCADE } from '../layout';
import type { FrontInfo, FrontOverride } from './index';

/** Look of ゲームセンター「ピコピコ」: a bright arcade front, red and yellow with neon trim, two crane machines full of plush. */
const LOOK = {
  red: '#d8433f',
  yellow: '#ffd23f',
  neonPink: '#ff5d8f',
  neonBlue: '#7bdff2',
  cabinet: '#f4f1ff',
  cabTrim: '#ff5d8f',
  glass: '#d9f1ff',
  dark: '#2b2d42',
  /** plush colours in the machines (bears, cats, the cat ninjas) */
  plush: ['#f4c64a', '#f7b3d0', '#9bd4f5', '#e5453d', '#3b6fe0', '#f7f7fb', '#b28dff'],
};

/**
 * The game front restyled as the game centre: a lit entrance, a neon sign, the two crane machines on the sidewalk (colliders and the
 * `arcade:crane` pick) and a row of lit windows of game screens. Shota appears once `markBuilt('arcade')` is called.
 */
export const buildArcade: FrontOverride = (ctx: BuildCtx, front: FrontInfo): boolean => {
  const { solid, glow } = ctx;
  const rnd = ctx.rng('arcade');
  const pickOf = <T>(items: readonly T[]): T => items[Math.floor(rnd() * items.length)]!;
  const L = LOOK;
  const { cx, zf } = front;

  // ---- the entrance: a dark doorway with a lit floor strip and blinking screens inside ----
  solid.boxB(cx, 0, zf - 0.05, 2.2, 2.6, 0.1, L.dark);
  glow.boxB(cx, 0.02, zf - 0.12, 2.0, 0.03, 0.4, L.neonBlue);
  for (const [dx, y, c] of [[-0.6, 1.0, L.neonPink], [0.5, 1.4, L.neonBlue], [-0.2, 1.9, L.yellow]] as const) glow.boxB(cx + dx, y, zf - 0.11, 0.5, 0.35, 0.01, c);
  // neon trim round the door and along the header
  for (const sx of [-1, 1]) glow.boxB(cx + sx * 1.15, 0, zf - 0.14, 0.06, 2.65, 0.04, L.neonPink);
  glow.boxB(cx, 2.65, zf - 0.14, 2.36, 0.06, 0.04, L.neonPink);
  glow.boxB(cx, 3.25, zf - 0.4, front.w - 0.6, 0.06, 0.05, L.neonBlue);

  // ---- the sign: ゲームセンター over the door ----
  ctx.signPlane(ARCADE.sign.text, { bg: L.red, fg: '#fff', sub: ARCADE.sign.sub, subColor: L.yellow, border: L.yellow, round: 16 }, { x: cx, y: 4.35, z: zf - 0.75, w: Math.min(5.4, front.w - 1), h: 1.6, texW: 420, texH: 130, ry: Math.PI });

  // ---- the two crane machines ----
  for (const r of ARCADE.cranes) {
    const x = (r.x0 + r.x1) / 2;
    const z = (r.z0 + r.z1) / 2;
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;
    const H = ARCADE.craneH;
    solid.boxB(x, 0, z, w, 0.8, d, L.cabinet); // base
    glow.boxB(x, 0.55, z - d / 2 - 0.005, w * 0.5, 0.12, 0.01, L.yellow); // coin slot plate
    solid.boxB(x - w * 0.3, 0.6, z - d / 2 - 0.08, 0.12, 0.2, 0.12, L.dark); // joystick
    solid.sphere(x - w * 0.3, 0.86, z - d / 2 - 0.08, 0.06, L.red, { ws: 8, hs: 6 });
    solid.cyl(x - w * 0.05, 0.8, z - d / 2 - 0.06, 0.06, 0.06, 0.04, L.neonBlue, { seg: 10 }); // the drop button
    solid.boxB(x, H - 0.25, z, w, 0.25, d, L.cabTrim); // the top box
    glow.boxB(x, H - 0.2, z - d / 2 - 0.005, w * 0.8, 0.14, 0.01, '#fff6d8');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.boxB(x + sx * (w / 2 - 0.03), 0.8, z + sz * (d / 2 - 0.03), 0.06, H - 1.05, 0.06, L.cabTrim); // posts
    glow.boxB(x, 0.8, z - d / 2 + 0.01, w - 0.08, H - 1.05, 0.01, L.glass); // the front glass (a faint glow)
    // the prize pile and the claw
    for (let i = 0; i < 9; i++) {
      const px = x - w / 2 + 0.2 + (i % 3) * ((w - 0.4) / 2) + (rnd() - 0.5) * 0.08;
      const pz = z - d / 2 + 0.25 + Math.floor(i / 3) * ((d - 0.4) / 3);
      const py = 0.86 + (rnd() < 0.4 ? 0.12 : 0);
      solid.sphere(px, py, pz, 0.11, pickOf(L.plush), { ws: 8, hs: 6, sy: 0.9 });
    }
    solid.boxB(x + w * 0.25, 0.8, z - d / 2 + 0.2, 0.3, 0.25, 0.3, L.dark); // the chute
    solid.cyl(x + 0.1, 1.4, z, 0.01, 0.01, H - 1.65, '#9aa3b8', { seg: 5 }); // claw cable
    solid.cyl(x + 0.1, 1.32, z, 0.07, 0.05, 0.1, '#c9ced9', { seg: 8 }); // claw
    for (const a of [0, 2.1, 4.2]) solid.box(x + 0.1 + Math.cos(a) * 0.05, 1.27, z + Math.sin(a) * 0.05, 0.02, 0.1, 0.02, '#c9ced9');
    ctx.collideRect(r);
    ctx.pickAt(ARCADE.pick, x, 1.2, z, 0.9);
  }
  ctx.markBuilt('arcade');
  ctx.mapRect({ x0: cx - front.w / 2, x1: cx + front.w / 2, z0: zf, z1: zf + 2 }, L.red, 'arcade');
  return true;
};
