import type { BuildCtx } from '../buildctx';
import { FRONT_Z, shopRect, type ShopDef } from '../layout';

const SNACKS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#f78fb3', '#ffa94d', '#9b8cf0', '#ffffff'];

// Konbini: a bright convenience store, shelves on the back wall, fridges on the left, a counter with a register.
export function buildKonbini(ctx: BuildCtx, s: ShopDef): void {
  const { solid, R, pick, glow, collide, hangSign, shopFrame } = ctx;
  const C = ctx.palette;
  const products = (x0: number, x1: number, y: number, z: number, rows: number, count: number, h = 0.26) => {
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < count; i++) {
        const x = x0 + ((i + 0.5) * (x1 - x0)) / count;
        solid.boxB(x, y + r * 0.62, z, ((x1 - x0) / count) * 0.72, h + R() * 0.12, 0.28, pick(SNACKS), { jitter: 0.1 });
      }
    }
  };
  shopFrame(s, { wall: '#f3f5f7', inner: '#e9f1f4', trim: C.teal, roof: '#cfd8e0', floor: '#e4e9ec', ceil: '#f6f8fa', openH: 3.5 });
  hangSign('konbini', s, 'コンビニ', 'konbini', '#1f9d8f', '#ffffff', 3.5, 1.7, '#ffffff');
  // shelves on the back wall
  for (const dx of [-3.6, 0, 3.6]) {
    solid.boxB(s.cx + dx, 0.12, FRONT_Z - 9.45, 3.2, 2.5, 0.6, '#ffffff');
    for (let r = 0; r < 4; r++) solid.boxB(s.cx + dx, 0.5 + r * 0.55, FRONT_Z - 9.1, 3.0, 0.06, 0.05, '#cfd6dc');
    products(s.cx + dx - 1.5, s.cx + dx + 1.5, 0.58, FRONT_Z - 9.12, 4, 7);
  }
  // fridges along the left wall
  solid.boxB(s.cx - 5.35, 0.12, FRONT_Z - 5.5, 0.7, 2.4, 6, '#dfe9ee');
  glow.boxB(s.cx - 5.0, 0.4, FRONT_Z - 5.5, 0.04, 1.9, 5.6, '#bfe4f3');
  for (let i = 0; i < 18; i++) glow.boxB(s.cx - 4.97, 0.5 + (i % 3) * 0.6, FRONT_Z - 2.9 - (i % 6) * 0.95, 0.03, 0.3, 0.55, pick(SNACKS));
  solid.boxB(s.cx + 1.5, 0.12, FRONT_Z - 3.5, 6.4, 0.16, 1.7, '#cfd8dc');
  // counter
  solid.boxB(s.cx + 1.5, 0.12, FRONT_Z - 2.3, 6.2, 0.82, 1.1, C.teal);
  solid.boxB(s.cx + 1.5, 0.94, FRONT_Z - 2.3, 6.4, 0.08, 1.25, '#ffffff');
  solid.boxB(s.cx + 3.4, 1.02, FRONT_Z - 2.3, 0.6, 0.4, 0.5, '#2e3340'); // register
  glow.boxB(s.cx + 3.4, 1.27, FRONT_Z - 2.05, 0.4, 0.2, 0.02, '#8be0c5');
  for (let i = 0; i < 6; i++) solid.boxB(s.cx - 0.2 + i * 0.35, 1.02, FRONT_Z - 2.0, 0.28, 0.2, 0.22, i % 2 ? '#ffffff' : '#222');
  // A-frame sign + plant
  solid.boxB(s.cx + 4.6, 0, FRONT_Z + 0.9, 0.9, 1.0, 0.1, '#ffffff', { rx: 0.12 });
  glow.boxB(s.cx + 4.6, 0.55, FRONT_Z + 0.97, 0.7, 0.55, 0.01, '#ffd166');
  collide(s.cx + 4.6, FRONT_Z + 0.9, 1, 0.5);
  // bright door-side glow
  glow.boxB(s.cx - 5.7, 0.12, FRONT_Z - 0.4, 0.04, 3.2, 0.5, '#bfe6f5');
  ctx.mapRect(shopRect(s), '#2aa198', 'konbini');
}
