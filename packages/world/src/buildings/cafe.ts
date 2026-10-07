import type { BuildCtx } from '../buildctx';
import { FRONT_Z, shopRect, type ShopDef } from '../layout';

// Cafe: striped awning, espresso machine and cakes on the counter, jars on the back shelves, two outdoor tables.
export function buildCafe(ctx: BuildCtx, s: ShopDef): void {
  const { solid, glow, pick, collide, hangSign, shopFrame } = ctx;
  shopFrame(s, { wall: '#fbeee1', inner: '#f9e2d2', trim: '#ee9ab4', roof: '#e7b9a6', floor: '#d8b48c', ceil: '#fff3e6', openH: 3.4 });
  hangSign('cafe', s, 'カフェ', 'sakura cafe', '#f28aa6', '#ffffff', 3.4, 2.1, '#ffe3ec');
  // striped awning
  for (let i = 0; i < 12; i++) {
    solid.boxB(s.cx - 5.5 + i * 1.0, 3.0, FRONT_Z + 0.6, 0.99, 0.08, 1.25, i % 2 ? '#ffffff' : '#f28aa6', { rx: 0.28 });
  }
  // counter with espresso machine and cakes
  solid.boxB(s.cx, 0.12, FRONT_Z - 3.6, 8.6, 0.16, 1.7, '#c9a07a');
  solid.boxB(s.cx, 0.12, FRONT_Z - 2.3, 8.4, 0.82, 1.1, '#a8714a');
  solid.boxB(s.cx, 0.94, FRONT_Z - 2.3, 8.7, 0.08, 1.3, '#f1e4d3');
  solid.boxB(s.cx - 2.8, 1.02, FRONT_Z - 2.45, 1.0, 0.45, 0.55, '#cfd5dc');
  solid.boxB(s.cx - 2.8, 1.47, FRONT_Z - 2.45, 0.9, 0.16, 0.45, '#2b2b36');
  glow.boxB(s.cx + 2.6, 1.02, FRONT_Z - 1.85, 2.2, 0.3, 0.02, '#fff6ea');
  for (let i = 0; i < 5; i++) solid.boxB(s.cx + 1.8 + i * 0.4, 1.04, FRONT_Z - 2.0, 0.28, 0.2, 0.28, pick(['#f6b3c8', '#ffe29a', '#d9a066', '#ffffff', '#c7e8b5']));
  // back shelves with jars and a plant
  solid.boxB(s.cx, 0.12, FRONT_Z - 9.4, 9, 0.1, 0.5, '#8a5a3a');
  for (let r = 0; r < 3; r++) {
    solid.boxB(s.cx, 1.0 + r * 0.7, FRONT_Z - 9.4, 9, 0.07, 0.45, '#a8714a');
    for (let i = 0; i < 14; i++) solid.boxB(s.cx - 4.2 + i * 0.65, 1.07 + r * 0.7, FRONT_Z - 9.4, 0.28, 0.4, 0.28, pick(['#fff1d0', '#f7c9d4', '#d9e8c8', '#ffd8a8']));
  }
  // chalkboard menu
  solid.boxB(s.cx - 2.8, 1.2, FRONT_Z - 9.15, 3.2, 1.5, 0.08, '#2c3e37');
  for (let i = 0; i < 6; i++) glow.boxB(s.cx - 3.9 + (i % 2) * 1.6, 2.3 - Math.floor(i / 2) * 0.35, FRONT_Z - 9.1, 1.0, 0.05, 0.01, '#f2efe6');
  // hanging lamps
  for (let i = 0; i < 4; i++) {
    solid.cyl(s.cx - 4 + i * 2.6, 2.7, FRONT_Z - 5, 0.01, 0.01, 0.7, '#555');
    glow.cone(s.cx - 4 + i * 2.6, 2.3, FRONT_Z - 5, 0.38, 0.32, '#ffd9a0', { seg: 10 });
  }
  // outdoor tables
  for (const dx of [-3.4, 3.2]) {
    solid.cyl(s.cx + dx, 0, FRONT_Z + 1.2, 0.5, 0.5, 0.06, '#fff', { seg: 14 });
    solid.cyl(s.cx + dx, 0, FRONT_Z + 1.2, 0.06, 0.06, 0.8, '#7d5238');
    solid.cyl(s.cx + dx, 0.8, FRONT_Z + 1.2, 0.52, 0.52, 0.05, '#f6b3c8', { seg: 14 });
    for (const [ox, oz] of [[-0.8, 0], [0.8, 0], [0, 0.7]] as const) solid.cyl(s.cx + dx + ox, 0, FRONT_Z + 1.2 + oz, 0.2, 0.2, 0.45, '#8a5a3a', { seg: 8 });
    collide(s.cx + dx, FRONT_Z + 1.2, 1.9, 1.7);
  }
  solid.cyl(s.cx + 5.2, 0, FRONT_Z + 0.8, 0.35, 0.28, 0.45, '#8a5a3a');
  solid.sphere(s.cx + 5.2, 0.85, FRONT_Z + 0.8, 0.5, '#5aa86a', { sy: 0.9 });
  ctx.mapRect(shopRect(s), '#f28aa6', 'cafe');
}
