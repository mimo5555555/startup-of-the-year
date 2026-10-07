import * as THREE from 'three';
import type { BuildCtx } from '../buildctx';
import { FRONT_Z, shopRect, type ShopDef } from '../layout';

// Language school: classroom with desks, a hiragana whiteboard, a waving flag and a second-floor facade.
export function buildSchool(ctx: BuildCtx, s: ShopDef): void {
  const { group, solid, glow, pick, own, animate, hangSign, shopFrame } = ctx;
  shopFrame(s, { wall: '#f8efc9', inner: '#fbf6df', trim: '#3f4a86', roof: '#4a5185', floor: '#e9d9b0', ceil: '#fff9e8', openH: 3.5 });
  hangSign('school', s, '学校', 'gakkō · school', '#3f4a86', '#ffffff', 3.5, 1.45, '#9aa6e8', true);
  // second floor facade
  const upperY0 = 5.4;
  for (let i = 0; i < 4; i++) {
    const wx = s.cx - 4.5 + i * 3;
    glow.boxB(wx, upperY0 + 0.5, FRONT_Z + 0.04, 2.0, 1.9, 0.04, '#a8d3ef');
    solid.boxB(wx, upperY0 + 0.45, FRONT_Z + 0.02, 2.25, 0.12, 0.08, '#fff');
    solid.boxB(wx, upperY0 + 2.35, FRONT_Z + 0.02, 2.25, 0.12, 0.08, '#fff');
    solid.boxB(wx, upperY0 + 0.45, FRONT_Z + 0.03, 0.06, 1.95, 0.08, '#fff');
  }
  // flag pole
  solid.cyl(s.cx - 5, s.h + 0.2, FRONT_Z - 1.2, 0.05, 0.06, 3.4, '#cfd3da');
  const flagG = new THREE.PlaneGeometry(1.5, 1.0);
  {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 64;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 96, 64);
    x.fillStyle = '#d8433f';
    x.beginPath();
    x.arc(48, 32, 18, 0, Math.PI * 2);
    x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const flag = new THREE.Mesh(flagG, new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
    flag.position.set(s.cx - 4.25, s.h + 2.8, FRONT_Z - 1.2);
    group.add(flag);
    animate((_dt, tm) => {
      flag.rotation.y = Math.sin(tm * 2.2) * 0.25;
    });
    own(t, flagG);
  }
  // whiteboard with hiragana
  {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const draw = () => {
      const x = c.getContext('2d')!;
      x.fillStyle = '#fbfbf7';
      x.fillRect(0, 0, 512, 256);
      x.fillStyle = '#2f5ec4';
      x.font = '700 120px "Zen Maru Gothic","Hiragino Sans","Yu Gothic","IPAGothic",sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('あいうえお', 256, 100);
      x.fillStyle = '#d8433f';
      x.font = '600 56px "Zen Maru Gothic","Hiragino Sans","Yu Gothic","IPAGothic",sans-serif';
      x.fillText('おはよう', 256, 205);
    };
    draw();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    (globalThis as any).document?.fonts?.ready?.then(() => {
      draw();
      t.needsUpdate = true;
    });
    const g = new THREE.PlaneGeometry(6.4, 2.6);
    const board = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t }));
    board.position.set(s.cx, 2.0, FRONT_Z - s.d + 0.4);
    group.add(board);
    solid.boxB(s.cx, 0.7, FRONT_Z - s.d + 0.33, 6.7, 2.9, 0.06, '#8a8f98');
    own(t, g);
  }
  // desks and chairs
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const x = s.cx - 3.6 + i * 2.4;
      const z = FRONT_Z - 5.2 - row * 2.2;
      solid.boxB(x, 0.75, z, 1.3, 0.07, 0.8, '#d9b48a');
      solid.boxB(x - 0.55, 0.12, z, 0.07, 0.65, 0.07, '#8a8f98');
      solid.boxB(x + 0.55, 0.12, z, 0.07, 0.65, 0.07, '#8a8f98');
      solid.boxB(x, 0.12, z - 0.7, 0.5, 0.45, 0.5, '#7a95d8');
    }
  }
  solid.boxB(s.cx + 3.8, 0.12, FRONT_Z - 2.6, 2.4, 0.85, 1.0, '#8a5a3a');
  solid.boxB(s.cx - 5.2, 0.12, FRONT_Z - 6, 0.5, 2.8, 5.5, '#a8714a');
  for (let i = 0; i < 22; i++) solid.boxB(s.cx - 5.0, 0.4 + (i % 4) * 0.6, FRONT_Z - 3.8 - Math.floor(i / 4) * 0.8, 0.3, 0.45, 0.6, pick(['#d8433f', '#3f4a86', '#2e9e5b', '#f4c64a', '#ffffff']));
  ctx.mapRect(shopRect(s), '#7a86d8', 'school');
}
