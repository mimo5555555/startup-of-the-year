import * as THREE from 'three';
import type { BuildCtx } from '../buildctx';
import { FRONT_Z, shopRect, type ShopDef } from '../layout';
import { bannerTexture } from '../textures';

// Ramen shop: U counter with stools, noren, lanterns, nobori banners and animated steam.
export function buildRamen(ctx: BuildCtx, s: ShopDef): void {
  const { group, solid, glow, pickAt, own, animate, hangSign, shopFrame } = ctx;
  shopFrame(s, { wall: '#5a4540', inner: '#3d2f2b', trim: '#c0392b', roof: '#33282a', floor: '#6b5047', ceil: '#2f2523', openH: 3.3 });
  hangSign('ramen', s, 'ラーメン', 'ramen', '#d8433f', '#fff8ef', 3.3, 1.75, '#ffd9c9');
  // noren curtain
  for (let i = 0; i < 5; i++) {
    solid.boxB(s.cx - 3.6 + i * 1.8, 2.15, FRONT_Z - 0.55, 1.62, 1.05, 0.05, i % 2 ? '#f6eee2' : '#2c3555');
  }
  // U counter with stools
  solid.boxB(s.cx, 0.12, FRONT_Z - 3.8, 8.2, 0.16, 1.8, '#7a5a4a');
  solid.boxB(s.cx, 0.12, FRONT_Z - 2.5, 8, 0.8, 1.0, '#8a5a3a');
  solid.boxB(s.cx, 0.92, FRONT_Z - 2.5, 8.3, 0.08, 1.2, '#d9b48a');
  for (const sx of [-3.3, -1.1, 1.1, 3.3]) {
    solid.cyl(s.cx + sx, 0.12, FRONT_Z - 1.55, 0.26, 0.2, 0.62, '#c0392b', { seg: 10 });
    solid.cyl(s.cx + sx, 0.74, FRONT_Z - 1.55, 0.3, 0.3, 0.06, '#3d2f2b', { seg: 10 });
  }
  // bowls on the counter and steaming pots behind
  for (const bx of [-2.4, 0.6, 2.9]) {
    solid.cyl(s.cx + bx, 1.0, FRONT_Z - 2.35, 0.24, 0.16, 0.2, '#f4f1ea', { seg: 12 });
    solid.cyl(s.cx + bx, 1.2, FRONT_Z - 2.35, 0.2, 0.2, 0.02, '#e8a64c', { seg: 12 });
  }
  solid.cyl(s.cx - 2.6, 0.12, FRONT_Z - 5.3, 0.8, 0.75, 0.9, '#bfc4cd', { seg: 14 });
  solid.cyl(s.cx + 2.4, 0.12, FRONT_Z - 5.3, 0.8, 0.75, 0.9, '#bfc4cd', { seg: 14 });
  solid.boxB(s.cx, 0.12, FRONT_Z - 5.3, 7, 0.95, 1.2, '#4a4a54');
  // wall menus
  for (let i = 0; i < 5; i++) {
    solid.boxB(s.cx - 3.6 + i * 1.8, 1.7, FRONT_Z - 9.0, 0.8, 1.6, 0.05, '#f1e7d2');
    glow.boxB(s.cx - 3.6 + i * 1.8, 2.1, FRONT_Z - 8.97, 0.5, 0.06, 0.01, '#d8433f');
  }
  // lanterns outside
  for (const dx of [-5.9, 5.9]) {
    const lx = s.cx + dx;
    glow.sphere(lx, 2.6, FRONT_Z + 0.7, 0.42, '#e5453d', { sy: 1.25, ws: 12, hs: 10 });
    solid.cyl(lx, 2.9, FRONT_Z + 0.7, 0.18, 0.18, 0.1, '#222');
    solid.cyl(lx, 2.28, FRONT_Z + 0.7, 0.16, 0.16, 0.08, '#222');
    pickAt('lantern', lx, 2.6, FRONT_Z + 0.7, 0.8);
  }
  // nobori banners
  for (const dx of [-7.3, 7.3]) {
    const tex = bannerTexture('ラーメン', '#d8433f', '#fff8ef', 128, 384);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const g = new THREE.PlaneGeometry(0.8, 2.4);
    const m = new THREE.Mesh(g, mat);
    m.position.set(s.cx + dx, 1.5, FRONT_Z + 1.3);
    group.add(m);
    solid.cyl(s.cx + dx - 0.45, 0, FRONT_Z + 1.3, 0.03, 0.03, 2.8, '#333');
    solid.boxB(s.cx + dx, 2.7, FRONT_Z + 1.3, 1.0, 0.05, 0.05, '#333');
    own(tex, mat, g);
    animate((_d, tm) => {
      m.rotation.y = Math.sin(tm * 1.7 + dx) * 0.15;
    });
  }
  // steam
  const steamG = new THREE.SphereGeometry(0.18, 8, 6);
  const steamM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(steamG, steamM.clone());
    puffs.push(m);
    group.add(m);
  }
  animate((_d, tm) => {
    puffs.forEach((p, i) => {
      const k = ((tm * 0.35 + i / puffs.length) % 1);
      const side = i % 2 ? 2.4 : -2.6;
      p.position.set(s.cx + side + Math.sin(tm + i) * 0.15, 1.1 + k * 1.8, FRONT_Z - 5.3);
      p.scale.setScalar(0.6 + k * 1.6);
      (p.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    });
  });
  own(steamG, steamM);
  ctx.mapRect(shopRect(s), '#d8433f', 'ramen');
}
