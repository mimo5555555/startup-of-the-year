import * as THREE from 'three';
import { Batch, rng, toonRamp, resetJitter } from './batch';
import { COLORS as C } from './palette';
import { FRONT_Z, SHOPS, shopRect, type MapRect, type Occluder, type Rect, type ShopDef } from './layout';
import {
  asphaltTexture,
  bannerTexture,
  blobTexture,
  grassTexture,
  pathTexture,
  sidewalkTexture,
  signTexture,
  skyMaterial,
  windowsTexture,
} from './textures';

export interface Pickable {
  id: string;
  pos: THREE.Vector3;
  radius: number;
}

export interface City {
  group: THREE.Group;
  colliders: Rect[];
  occluders: Occluder[];
  pickables: Pickable[];
  mapRects: MapRect[];
  sky: THREE.Mesh;
  sunDir: THREE.Vector3;
  update(dt: number, t: number, player: THREE.Vector3): void;
  setShadows(on: boolean): void;
  dispose(): void;
}

const SNACKS = ['#ff6b6b', '#ffd166', '#06d6a0', '#4cc9f0', '#f78fb3', '#ffa94d', '#9b8cf0', '#ffffff'];
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];

export function buildCity(): City {
  resetJitter(11);
  const R = rng(42);
  const group = new THREE.Group();
  const colliders: Rect[] = [];
  const occluders: Occluder[] = [];
  const pickables: Pickable[] = [];
  const mapRects: MapRect[] = [];
  const animators: Array<(dt: number, t: number, player: THREE.Vector3) => void> = [];
  const disposables: Array<{ dispose(): void }> = [];

  const ramp = toonRamp();
  const toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  disposables.push(ramp, toon, glowMat);

  const solid = new Batch();
  const glow = new Batch();

  const collide = (x: number, z: number, w: number, d: number) => colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  const occlude = (r: Occluder) => occluders.push(r);
  const pickAt = (id: string, x: number, y: number, z: number, radius = 1.2) => pickables.push({ id, pos: new THREE.Vector3(x, y, z), radius });

  // ============ sky & lights are owned by the world; the dome lives here so it travels with the city ============
  const skyGeo = new THREE.SphereGeometry(400, 24, 16);
  const skyMat = skyMaterial(C.sky.top, C.sky.mid, C.sky.bottom);
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -10;
  group.add(sky);
  disposables.push(skyGeo, skyMat);

  const sunDir = new THREE.Vector3(-0.55, 0.42, 0.72).normalize();
  const sunTex = blobTexture('rgba(255,236,196,1)', 'rgba(255,200,150,0)', 256);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
  sunSprite.scale.setScalar(150);
  sunSprite.position.copy(sunDir).multiplyScalar(330);
  group.add(sunSprite);

  // ============ ground ============
  const planeMat = (tex: THREE.Texture, repX: number, repY: number) => {
    tex.repeat.set(repX, repY);
    const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp });
    disposables.push(tex, m);
    return m;
  };
  const flat = (w: number, d: number, x: number, z: number, y: number, mat: THREE.Material, receive = true) => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.receiveShadow = receive;
    group.add(m);
    disposables.push(g);
    return m;
  };

  flat(900, 900, 0, 0, -0.04, new THREE.MeshToonMaterial({ color: '#cdc5b8', gradientMap: ramp }));
  const X0 = -130;
  const X1 = 170;
  flat(X1 - X0, 10, (X0 + X1) / 2, 0, 0.0, planeMat(asphaltTexture(), (X1 - X0) / 7, 10 / 7));
  flat(X1 - X0, 4, (X0 + X1) / 2, -7, 0.015, planeMat(sidewalkTexture(), (X1 - X0) / 4, 1));
  flat(X1 - X0, 4, (X0 + X1) / 2, 7, 0.015, planeMat(sidewalkTexture(), (X1 - X0) / 4, 1));

  // curbs, tactile paving, road markings
  const len = X1 - X0;
  const mid = (X0 + X1) / 2;
  for (const z of [-5.12, 5.12]) solid.boxB(mid, 0, z, len, 0.1, 0.24, C.curb);
  for (const z of [-5.75, 5.75]) glow.boxB(mid, 0.016, z, len, 0.012, 0.3, C.tactile);
  for (const z of [-4.55, 4.55]) glow.boxB(mid, 0.012, z, len, 0.01, 0.12, '#f1eee4');
  for (let x = X0 + 3; x < X1; x += 6) glow.boxB(x, 0.012, 0, 3, 0.01, 0.16, C.roadYellow);
  // zebra crossing
  for (let i = 0; i < 10; i++) glow.boxB(30, 0.014, -4.5 + i * 1.0, 3.6, 0.01, 0.52, '#f7f5ee');
  // manholes
  for (const [x, z] of [[-18, 1.6], [12, -1.8], [46, 2]] as const) glow.cyl(x, 0.012, z, 0.45, 0.45, 0.01, '#4a5068', { seg: 14 });

  // ============ shops ============
  const shopFrame = (s: ShopDef, o: { wall: string; inner: string; trim: string; roof: string; floor: string; ceil: string; openH: number; band?: number }) => {
    const { cx, w, d, h } = s;
    const zc = FRONT_Z - d / 2;
    const T = 0.3;
    solid.boxB(cx, 0, zc, w, 0.12, d, o.floor, { jitter: 0 });
    solid.boxB(cx, 0, FRONT_Z - d + T / 2, w, h, T, o.wall); // back
    solid.boxB(cx, 0.12, FRONT_Z - d + T + 0.02, w - 0.6, o.openH - 0.12, 0.05, o.inner, { jitter: 0 });
    for (const sgn of [-1, 1]) {
      solid.boxB(cx + sgn * (w / 2 - T / 2), 0, zc, T, h, d, o.wall);
      solid.boxB(cx + sgn * (w / 2 - T - 0.03), 0.12, zc, 0.05, o.openH - 0.12, d - 0.6, o.inner, { jitter: 0 });
    }
    solid.boxB(cx, h, zc + 0.3, w + 0.9, 0.42, d + 1.1, o.roof); // roof with overhang
    solid.boxB(cx, o.openH, FRONT_Z - 0.25, w, h - o.openH, 0.5, o.trim); // header band
    solid.boxB(cx, o.openH - 0.12, zc, w - 0.6, 0.14, d - 0.5, o.ceil, { jitter: 0 }); // ceiling
    for (const sgn of [-1, 1]) solid.boxB(cx + sgn * (w / 2 - 0.3), 0, FRONT_Z - 0.25, 0.6, o.openH, 0.55, o.trim);
    for (let i = 0; i < Math.floor(d / 3.2); i++) glow.boxB(cx, o.openH - 0.19, FRONT_Z - 1.6 - i * 3.2, w * 0.6, 0.05, 0.7, '#fff6dd');
    const r = shopRect(s);
    collide((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2, w, d);
    occlude(r);
  };

  const hangSign = (id: string, s: ShopDef, text: string, sub: string, bg: string, fg: string, openH: number, band: number, border?: string, low = false) => {
    const w = s.w - 1.4;
    const tex = signTexture(text, { bg, fg, sub, subColor: fg, border }, 512, Math.round((512 * band) / w));
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const g = new THREE.PlaneGeometry(w, band);
    const m = new THREE.Mesh(g, mat);
    m.position.set(s.cx, low ? openH + band / 2 + 0.12 : openH + (s.h - openH - band) / 2 + band / 2 + 0.02, FRONT_Z + 0.06);
    group.add(m);
    disposables.push(tex, mat, g);
    pickAt(id, s.cx, m.position.y, FRONT_Z + 0.4, Math.min(w, 5) / 2);
    return m;
  };

  const products = (x0: number, x1: number, y: number, z: number, rows: number, count: number, h = 0.26) => {
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < count; i++) {
        const x = x0 + ((i + 0.5) * (x1 - x0)) / count;
        solid.boxB(x, y + r * 0.62, z, ((x1 - x0) / count) * 0.72, h + R() * 0.12, 0.28, pick(R, SNACKS), { jitter: 0.1 });
      }
    }
  };

  // ---- Konbini ----
  {
    const s = SHOPS[0];
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
    for (let i = 0; i < 18; i++) glow.boxB(s.cx - 4.97, 0.5 + (i % 3) * 0.6, FRONT_Z - 2.9 - (i % 6) * 0.95, 0.03, 0.3, 0.55, pick(R, SNACKS));
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
    mapRects.push({ ...shopRect(s), color: '#2aa198', label: 'konbini' });
  }

  // ---- Café ----
  {
    const s = SHOPS[1];
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
    for (let i = 0; i < 5; i++) solid.boxB(s.cx + 1.8 + i * 0.4, 1.04, FRONT_Z - 2.0, 0.28, 0.2, 0.28, pick(R, ['#f6b3c8', '#ffe29a', '#d9a066', '#ffffff', '#c7e8b5']));
    // back shelves with jars and a plant
    solid.boxB(s.cx, 0.12, FRONT_Z - 9.4, 9, 0.1, 0.5, '#8a5a3a');
    for (let r = 0; r < 3; r++) {
      solid.boxB(s.cx, 1.0 + r * 0.7, FRONT_Z - 9.4, 9, 0.07, 0.45, '#a8714a');
      for (let i = 0; i < 14; i++) solid.boxB(s.cx - 4.2 + i * 0.65, 1.07 + r * 0.7, FRONT_Z - 9.4, 0.28, 0.4, 0.28, pick(R, ['#fff1d0', '#f7c9d4', '#d9e8c8', '#ffd8a8']));
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
    mapRects.push({ ...shopRect(s), color: '#f28aa6', label: 'cafe' });
  }

  // ---- Language school ----
  {
    const s = SHOPS[2];
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
      animators.push((_dt, tm) => {
        flag.rotation.y = Math.sin(tm * 2.2) * 0.25;
      });
      disposables.push(t, flagG);
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
      disposables.push(t, g);
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
    for (let i = 0; i < 22; i++) solid.boxB(s.cx - 5.0, 0.4 + (i % 4) * 0.6, FRONT_Z - 3.8 - Math.floor(i / 4) * 0.8, 0.3, 0.45, 0.6, pick(R, ['#d8433f', '#3f4a86', '#2e9e5b', '#f4c64a', '#ffffff']));
    mapRects.push({ ...shopRect(s), color: '#7a86d8', label: 'school' });
  }

  // ---- Ramen shop ----
  {
    const s = SHOPS[3];
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
      disposables.push(tex, mat, g);
      animators.push((_d, tm) => {
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
    animators.push((_d, tm) => {
      puffs.forEach((p, i) => {
        const k = ((tm * 0.35 + i / puffs.length) % 1);
        const side = i % 2 ? 2.4 : -2.6;
        p.position.set(s.cx + side + Math.sin(tm + i) * 0.15, 1.1 + k * 1.8, FRONT_Z - 5.3);
        p.scale.setScalar(0.6 + k * 1.6);
        (p.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
      });
    });
    disposables.push(steamG, steamM);
    mapRects.push({ ...shopRect(s), color: '#d8433f', label: 'ramen' });
  }

  // ---- Station ----
  {
    const s = SHOPS[4];
    const openH = 4.6;
    shopFrame(s, { wall: '#e9edf2', inner: '#f2f4f7', trim: '#2e9e5b', roof: '#c9cfd8', floor: '#dfe3ea', ceil: '#f4f6f9', openH });
    // big sign + clock
    {
      const tex = signTexture('駅', { bg: '#2e9e5b', fg: '#ffffff', sub: 'eki · station', border: '#a7e3bd' }, 512, 300);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
      const g = new THREE.PlaneGeometry(8, 3.2);
      const m = new THREE.Mesh(g, mat);
      m.position.set(s.cx, openH + 1.75, FRONT_Z + 0.06);
      group.add(m);
      disposables.push(tex, mat, g);
      pickAt('station', s.cx, m.position.y, FRONT_Z + 0.4, 3);
    }
    {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d')!;
      x.fillStyle = '#fff';
      x.beginPath();
      x.arc(64, 64, 60, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#2b2b36';
      x.lineWidth = 6;
      x.stroke();
      x.lineCap = 'round';
      x.lineWidth = 6;
      x.beginPath();
      x.moveTo(64, 64);
      x.lineTo(64, 28);
      x.stroke();
      x.lineWidth = 5;
      x.beginPath();
      x.moveTo(64, 64);
      x.lineTo(92, 78);
      x.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        x.fillStyle = '#2b2b36';
        x.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 2, 4, 4);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.CircleGeometry(1.2, 28);
      const clock = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t }));
      clock.position.set(s.cx + 6.6, openH + 1.7, FRONT_Z + 0.07);
      group.add(clock);
      disposables.push(t, g);
    }
    for (const [text, dx, bg] of [['出口', 8.2, '#1d7a45'], ['入口', -8.2, '#1d7a45']] as const) {
      const tex = signTexture(text, { bg, fg: '#fff', border: '#a7e3bd', round: 14 }, 256, 128);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
      const g = new THREE.PlaneGeometry(1.9, 0.95);
      const m = new THREE.Mesh(g, mat);
      m.position.set(s.cx + dx, openH - 0.65, FRONT_Z + 0.34);
      group.add(m);
      disposables.push(tex, mat, g);
      pickAt(text === '出口' ? 'exit' : 'entrance', s.cx + dx, m.position.y, FRONT_Z + 0.6, 1.2);
    }
    // ticket machines
    for (let i = 0; i < 3; i++) {
      const x = s.cx - 8 + i * 1.4;
      solid.boxB(x, 0.12, FRONT_Z - 2.2, 1.1, 1.7, 0.75, '#3b6fb6');
      glow.boxB(x, 1.1, FRONT_Z - 1.82, 0.7, 0.45, 0.02, '#bfe9ff');
      glow.boxB(x, 0.8, FRONT_Z - 1.82, 0.5, 0.12, 0.02, '#ffd166');
    }
    pickAt('ticket', s.cx - 7.2, 1.0, FRONT_Z - 1.6, 1.6);
    // staff booth
    solid.boxB(s.cx, 0.12, FRONT_Z - 2.9, 3.4, 1.05, 0.9, '#2e9e5b');
    solid.boxB(s.cx, 1.17, FRONT_Z - 2.9, 3.6, 0.07, 1.0, '#f4f6f9');
    solid.boxB(s.cx + 1.2, 1.24, FRONT_Z - 2.9, 0.5, 0.3, 0.4, '#3a3f50');
    // fare gates and timetable
    for (let i = 0; i < 4; i++) {
      const x = s.cx - 3.4 + i * 2.3;
      for (const dx of [-0.45, 0.45]) solid.boxB(x + dx, 0.12, FRONT_Z - 8.2, 0.3, 1.0, 1.4, '#cfd5dd');
      glow.boxB(x - 0.45, 1.12, FRONT_Z - 8.2, 0.2, 0.06, 0.4, i === 1 ? '#ff6b6b' : '#6be28f');
      glow.boxB(x + 0.45, 1.12, FRONT_Z - 8.2, 0.2, 0.06, 0.4, '#6be28f');
    }
    glow.boxB(s.cx - 7.8, 2.2, FRONT_Z - 8.7, 3.2, 1.4, 0.05, '#fdfdfa');
    for (let i = 0; i < 10; i++) glow.boxB(s.cx - 9 + (i % 5) * 0.55, 2.55 - Math.floor(i / 5) * 0.4, FRONT_Z - 8.66, 0.4, 0.1, 0.01, i % 3 ? '#2e9e5b' : '#3b6fb6');
    // platform behind the hall
    solid.boxB(s.cx, 0, FRONT_Z - s.d - 7.5, 40, 0.35, 8, '#cfd3da');
    glow.boxB(s.cx, 0.36, FRONT_Z - s.d - 4.2, 40, 0.012, 0.4, '#f2c94c');
    solid.boxB(s.cx, -0.02, FRONT_Z - s.d - 14.5, 40, 0.1, 5, '#4d4a4f');
    for (const dz of [-13.2, -15.8]) solid.boxB(s.cx, 0.08, FRONT_Z - s.d + dz, 40, 0.07, 0.12, '#a3a7b0');
    // parked train
    const train = new Batch();
    const carriage = (cx: number, cz: number, color = '#f1f3f6') => {
      train.boxB(cx, 0.5, cz, 9.6, 2.6, 3.0, color, { jitter: 0 });
      train.boxB(cx, 1.2, cz + 1.51, 9.6, 0.3, 0.02, '#2e9e5b');
      train.boxB(cx, 0.55, cz + 1.52, 9.6, 0.12, 0.02, '#2e9e5b');
      for (let i = 0; i < 4; i++) train.boxB(cx - 3.4 + i * 2.3, 1.55, cz + 1.51, 1.7, 1.0, 0.03, '#35465f');
      train.boxB(cx, 3.15, cz, 9.0, 0.22, 2.4, '#b9bec8');
    };
    for (let i = 0; i < 3; i++) carriage(s.cx - 10 + i * 10, FRONT_Z - s.d - 14.5);
    const parked = train.build(toon);
    if (parked) group.add(parked);
    // passing train on the far track
    const mover = new Batch();
    for (let i = 0; i < 5; i++) {
      const cx = i * 10;
      mover.boxB(cx, 0.5, 0, 9.6, 2.6, 3.0, '#e8f0f7', { jitter: 0 });
      mover.boxB(cx, 1.3, 1.51, 9.6, 0.3, 0.02, '#1e88e5');
      for (let k = 0; k < 4; k++) mover.boxB(cx - 3.4 + k * 2.3, 1.55, 1.51, 1.7, 1.0, 0.03, '#35465f');
    }
    const moverMesh = mover.build(toon);
    if (moverMesh) {
      moverMesh.position.set(-200, 0, FRONT_Z - s.d - 20);
      group.add(moverMesh);
      let timer = 8;
      let x = -200;
      let active = false;
      animators.push((dt) => {
        timer -= dt;
        if (!active && timer <= 0) {
          active = true;
          x = -120;
        }
        if (active) {
          x += dt * 26;
          moverMesh.position.x = x;
          if (x > 190) {
            active = false;
            timer = 28 + R() * 20;
            moverMesh.position.x = -400;
          }
        }
      });
    }
    mapRects.push({ ...shopRect(s), color: '#2e9e5b', label: 'station' });
  }

  // ============ south side: park + shop fronts ============
  const PARK: Rect = { x0: -34, x1: 10, z0: 9.5, z1: 40 };
  mapRects.push({ ...PARK, color: '#8fd081', label: 'park' });
  const parkG = flat(PARK.x1 - PARK.x0, PARK.z1 - PARK.z0, (PARK.x0 + PARK.x1) / 2, (PARK.z0 + PARK.z1) / 2, 0.02, planeMat(grassTexture(), 12, 8));
  parkG.receiveShadow = true;
  const pathMat = planeMat(pathTexture(), 6, 6);
  flat(3.2, 13, -12, 16, 0.03, pathMat);
  flat(40, 2.6, -12, 22, 0.03, pathMat);
  flat(3, 18, -12, 31, 0.03, pathMat);
  {
    const g = new THREE.CircleGeometry(5.6, 36);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, pathMat);
    m.position.set(-12, 0.035, 22);
    m.receiveShadow = true;
    group.add(m);
    disposables.push(g);
  }

  // hedges / fences around the park
  const hedge = (x: number, z: number, w: number, d: number) => {
    solid.boxB(x, 0, z, w, 0.9, d, '#4f9a5c', { jitter: 0.12 });
    solid.boxB(x, 0.9, z, w * 0.96, 0.18, d * 0.9, '#5fae6b', { jitter: 0.12 });
    collide(x, z, w, d);
    occlude({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y1: 3.4 });
  };
  hedge(-24, 9.5, 20, 0.9);
  hedge(0, 9.5, 20, 0.9);
  hedge(-34, 25, 0.9, 31);
  hedge(-12, 40, 44, 0.9);
  hedge(10, 28, 0.9, 25);
  // construction fence west of the park
  for (let z = 10; z < 40; z += 3) solid.boxB(-36.5, 0, z + 1.5, 0.12, 2.2, 3, '#c9d3dc', { jitter: 0.05 });
  collide(-41.5, 25, 13, 31);

  // torii gate
  {
    const x = -12;
    const z = 9.2;
    for (const dx of [-2.2, 2.2]) {
      solid.cyl(x + dx, 0, z, 0.24, 0.28, 4.4, '#d8433f', { seg: 12 });
      solid.cyl(x + dx, 0, z, 0.36, 0.36, 0.3, '#2b2b36', { seg: 12 });
      collide(x + dx, z, 0.8, 0.8);
    }
    solid.boxB(x, 3.5, z, 5.6, 0.28, 0.4, '#d8433f');
    solid.boxB(x, 4.3, z, 6.8, 0.3, 0.55, '#2b2b36', { rz: 0 });
    solid.boxB(x, 4.52, z, 7.2, 0.14, 0.65, '#2b2b36');
    solid.boxB(x, 3.8, z, 0.28, 0.7, 0.4, '#d8433f');
    const tex = signTexture('公園', { bg: '#f1e3c4', fg: '#3d2f2b', sub: 'kōen · park', border: '#b07a52', round: 10 }, 256, 140);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const g = new THREE.PlaneGeometry(1.8, 1.0);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, 2.55, z + 0.05);
    group.add(m);
    disposables.push(tex, mat, g);
    pickAt('park', x, 2.6, z + 0.4, 1.4);
    pickAt('torii', x + 2.2, 2.4, z + 0.3, 1.2);
    // stone lanterns
    for (const dx of [-3.7, 3.7]) {
      solid.cyl(x + dx, 0, z + 0.4, 0.28, 0.34, 0.45, '#9ca3a8');
      solid.cyl(x + dx, 0.45, z + 0.4, 0.12, 0.14, 0.7, '#a8aeb2');
      solid.boxB(x + dx, 1.15, z + 0.4, 0.62, 0.42, 0.62, '#b4babd');
      glow.boxB(x + dx, 1.22, z + 0.4, 0.3, 0.26, 0.64, '#ffd9a0');
      solid.cone(x + dx, 1.57, z + 0.4, 0.55, 0.34, '#8d9498', { seg: 4, ry: Math.PI / 4 });
      collide(x + dx, z + 0.4, 0.7, 0.7);
    }
  }

  // cherry trees
  const sakuraSpots: Array<[number, number, number]> = [
    [-12, 24.8, 1.2],
    [-4.5, 17.6, 1.1],
    [-18.5, 15.5, 1.05],
    [-26, 17, 1.2],
    [-3.5, 28, 1.15],
    [-22, 25.8, 1.0],
    [4.5, 13.8, 1.05],
    [-29, 34, 1.15],
    [-12, 36, 1.2],
    [3, 35, 1.05],
    [-19.5, 21.5, 0.9],
    [-1.5, 22.5, 0.9],
  ];
  const pinks = ['#f9b8cd', '#f6a5c0', '#fbc9da', '#f4a0bd', '#ffd3e0', '#f08fb0'];
  sakuraSpots.forEach(([x, z, s], idx) => {
    solid.cyl(x, 0, z, 0.2 * s, 0.34 * s, 2.6 * s, '#6b4a3c', { seg: 8 });
    for (let b = 0; b < 3; b++) {
      const a = b * 2.1 + idx;
      solid.cyl(x + Math.cos(a) * 0.5 * s, 2.0 * s, z + Math.sin(a) * 0.5 * s, 0.07 * s, 0.14 * s, 1.5 * s, '#6b4a3c', { rx: Math.sin(a) * 0.7, rz: -Math.cos(a) * 0.7, seg: 6 });
    }
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + idx;
      const rr = (i === 0 ? 0 : 1.0 + R() * 0.9) * s;
      solid.sphere(x + Math.cos(a) * rr, (3.6 + R() * 1.2) * s, z + Math.sin(a) * rr, (1.15 + R() * 0.7) * s, pick(R, pinks), { ws: 9, hs: 7, jitter: 0.06 });
    }
    // petals on the ground
    solid.disc(x, 0.045, z, 3.0 * s, '#fbd9e4', { seg: 16, jitter: 0.04 });
    for (let i = 0; i < 6; i++) solid.disc(x + (R() - 0.5) * 5 * s, 0.05, z + (R() - 0.5) * 5 * s, 0.4 + R() * 0.5, '#f7b5cb', { seg: 8 });
    collide(x, z, 0.9 * s, 0.9 * s);
    occlude({ x0: x - 0.5, x1: x + 0.5, z0: z - 0.5, z1: z + 0.5, y1: 3 });
    occlude({ x0: x - 2.7 * s, x1: x + 2.7 * s, z0: z - 2.7 * s, z1: z + 2.7 * s, y0: 2.2 * s, y1: 6.4 * s });
    if (idx < 6) pickAt('sakura', x, 4.2 * s, z, 2.4 * s);
  });
  // a few green and gold trees for contrast
  for (const [x, z, col] of [[-30, 12.5, '#5aa86a'], [7, 12, '#d9c24a'], [-1.5, 36.5, '#5aa86a'], [-33, 28, '#d9c24a'], [8, 24, '#5aa86a']] as const) {
    solid.cyl(x, 0, z, 0.18, 0.28, 2.2, '#7a5a44', { seg: 8 });
    solid.sphere(x, 3.4, z, 1.7, col, { sy: 1.15, ws: 10, hs: 8, jitter: 0.08 });
    solid.sphere(x + 0.7, 4.3, z - 0.3, 1.1, col, { ws: 8, hs: 6, jitter: 0.08 });
    collide(x, z, 0.7, 0.7);
    occlude({ x0: x - 2, x1: x + 2, z0: z - 2, z1: z + 2, y0: 1.6, y1: 5.6 });
  }

  // pond with a bridge
  {
    const px = -23;
    const pz = 31;
    const g = new THREE.CircleGeometry(1, 40);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: '#7cc6e8', transparent: true, opacity: 0.88 });
    const pond = new THREE.Mesh(g, mat);
    pond.scale.set(6.5, 1, 4.2);
    pond.position.set(px, 0.05, pz);
    group.add(pond);
    disposables.push(g, mat);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      solid.sphere(px + Math.cos(a) * 6.8, 0.1, pz + Math.sin(a) * 4.5, 0.45 + R() * 0.3, '#a5aab0', { sy: 0.7, ws: 7, hs: 5, jitter: 0.1 });
    }
    collide(px, pz, 12.5, 7.5);
    // bridge
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      solid.boxB(px - 3 + t * 6, 0.25 + Math.sin(t * Math.PI) * 0.7, pz, 0.9, 0.18, 1.6, '#c0392b');
    }
    for (const dz of [-0.8, 0.8]) for (let i = 0; i < 5; i++) solid.boxB(px - 3 + (i / 4) * 6, 0.65 + Math.sin((i / 4) * Math.PI) * 0.7, pz + dz, 0.12, 0.7, 0.12, '#c0392b');
    // lily pads and koi
    const lilyG = new THREE.CircleGeometry(0.4, 10);
    lilyG.rotateX(-Math.PI / 2);
    const lilyM = new THREE.MeshBasicMaterial({ color: '#5fb36e' });
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(lilyG, lilyM);
      const a = R() * Math.PI * 2;
      const r = 0.8 + R() * 0.8;
      m.position.set(px + Math.cos(a) * r * 3.2, 0.07, pz + Math.sin(a) * r * 2.0);
      group.add(m);
    }
    disposables.push(lilyG, lilyM);
    const koiG = new THREE.SphereGeometry(0.28, 8, 6);
    const koi: THREE.Mesh[] = [];
    for (const col of ['#ff8a3d', '#fff2e0', '#e8503a']) {
      const m = new THREE.Mesh(koiG, new THREE.MeshBasicMaterial({ color: col }));
      m.scale.set(1.9, 0.5, 0.8);
      group.add(m);
      koi.push(m);
    }
    disposables.push(koiG);
    animators.push((_d, tm) => {
      koi.forEach((k, i) => {
        const a = tm * (0.35 + i * 0.08) + i * 2.1;
        k.position.set(px + Math.cos(a) * (3.2 + i * 0.8), 0.08, pz + Math.sin(a) * (1.9 + i * 0.4));
        k.rotation.y = -a - Math.PI / 2;
      });
      mat.opacity = 0.84 + Math.sin(tm * 1.4) * 0.04;
    });
    pickAt('pond', px, 0.3, pz + 2.5, 3);
  }

  // benches, lamps and bins in the park
  const bench = (x: number, z: number, ry: number, id?: string) => {
    solid.boxB(x, 0.42, z, 1.7, 0.1, 0.55, '#b07a52', { ry });
    solid.boxB(x, 0.7, z - Math.cos(ry) * 0.3, 1.7, 0.45, 0.08, '#b07a52', { ry, rx: -0.12 });
    for (const dx of [-0.7, 0.7]) solid.boxB(x + Math.cos(ry) * dx, 0, z - Math.sin(ry) * dx, 0.1, 0.42, 0.45, '#4a4a54', { ry });
    const bw = Math.abs(Math.cos(ry)) * 1.7 + Math.abs(Math.sin(ry)) * 0.6;
    const bd = Math.abs(Math.sin(ry)) * 1.7 + Math.abs(Math.cos(ry)) * 0.6;
    collide(x, z, bw, bd);
    occlude({ x0: x - bw / 2, x1: x + bw / 2, z0: z - bd / 2, z1: z + bd / 2, y1: 2.2 });
    if (id) pickAt(id, x, 0.6, z, 1.0);
  };
  bench(-12, 27.6, 0, 'bench');
  bench(-16.5, 22, Math.PI / 2);
  bench(-7.5, 22, -Math.PI / 2);
  bench(-8.8, 12.5, Math.PI, 'bench');
  bench(-26, 22.8, 0);
  bench(-0.5, 22.8, 0);
  const lamp = (x: number, z: number, h = 4.6, col = '#2b2b36') => {
    solid.cyl(x, 0, z, 0.07, 0.1, h, col, { seg: 8 });
    solid.boxB(x, h, z, 0.5, 0.08, 0.5, col);
    glow.cyl(x, h - 0.34, z, 0.2, 0.26, 0.34, '#ffe3a8', { seg: 8 });
    collide(x, z, 0.3, 0.3);
  };
  for (const [x, z] of [[-14.2, 20.2], [-9.8, 24], [-14.2, 24], [-9.8, 20.2], [-12, 13], [-26, 21], [-1, 21], [-12, 33]] as const) lamp(x, z, 4.0);
  const bin = (x: number, z: number) => {
    solid.boxB(x, 0, z, 0.55, 0.85, 0.55, '#6d7a85');
    solid.boxB(x, 0.85, z, 0.62, 0.1, 0.62, '#4a545c');
    collide(x, z, 0.6, 0.6);
    pickAt('bin', x, 0.6, z, 0.8);
  };
  bin(-14.8, 11.5);
  bin(-9.2, 28.6);
  // low wall for the cat
  solid.boxB(-5.2, 0, 11.3, 3.4, 0.6, 0.55, '#b9b3a6');
  collide(-5.2, 11.3, 3.4, 0.6);

  // ---- cat ----
  {
    const cat = new THREE.Group();
    const cb = new Batch();
    cb.sphere(0, 0.2, 0, 0.26, '#f0e1cf', { sx: 0.9, sy: 0.85, sz: 1.2, ws: 10, hs: 8 });
    cb.sphere(0, 0.5, 0.2, 0.2, '#f0e1cf', { ws: 10, hs: 8 });
    for (const s of [-1, 1]) {
      cb.cone(s * 0.12, 0.62, 0.2, 0.07, 0.13, '#e0b98a', { seg: 4 });
      cb.sphere(s * 0.07, 0.52, 0.37, 0.025, '#2b2b36', { ws: 6, hs: 4 });
    }
    cb.sphere(0.1, 0.35, -0.1, 0.12, '#e0b98a', { sx: 0.8, ws: 6, hs: 5 });
    const body = cb.build(toon, { receive: false });
    if (body) cat.add(body);
    const tailG = new THREE.CylinderGeometry(0.04, 0.05, 0.5, 6);
    tailG.translate(0, 0.25, 0);
    const tail = new THREE.Mesh(tailG, new THREE.MeshToonMaterial({ color: '#e0b98a', gradientMap: ramp }));
    tail.position.set(0, 0.12, -0.3);
    tail.rotation.x = -1.1;
    cat.add(tail);
    cat.position.set(-5.2, 0.6, 11.3);
    cat.rotation.y = 0.4;
    group.add(cat);
    disposables.push(tailG);
    animators.push((_d, tm) => {
      tail.rotation.z = Math.sin(tm * 2.4) * 0.5;
      cat.rotation.y = 0.4 + Math.sin(tm * 0.35) * 0.25;
      cat.scale.y = 1 + Math.sin(tm * 2.0) * 0.015;
    });
    pickAt('cat', -5.2, 1.0, 11.4, 1.0);
  }

  // ---- shop fronts across the street ----
  const frontStyles = [
    { w: 8, h: 7, wall: '#e8d5bd', trim: '#8a5a3a', text: '居酒屋', bg: '#2b2b36', fg: '#ffd166', sub: 'izakaya', lantern: true },
    { w: 8, h: 6.4, wall: '#d9e7e0', trim: '#2e9e5b', text: '薬局', bg: '#2e9e5b', fg: '#ffffff', sub: 'yakkyoku' },
    { w: 7, h: 6, wall: '#f3dfe3', trim: '#e8789e', text: '花屋', bg: '#e8789e', fg: '#ffffff', sub: 'hanaya', flowers: true },
    { w: 8, h: 8, wall: '#dfe4f0', trim: '#3f4a86', text: '本屋', bg: '#3f4a86', fg: '#ffffff', sub: 'honya' },
    { w: 11, h: 12, wall: '#f0ece4', trim: '#9a8f7c', text: 'ホテル', bg: '#6b5b95', fg: '#ffffff', sub: 'hotel' },
    { w: 8, h: 6.6, wall: '#f6e6c7', trim: '#d8433f', text: 'ゲーム', bg: '#d8433f', fg: '#fff', sub: 'geemu' },
  ];
  {
    let x = 15;
    for (const f of frontStyles) {
      const cx = x + f.w / 2;
      const zf = 9.7;
      const d = 9;
      solid.boxB(cx, 0, zf + d / 2, f.w, f.h, d, f.wall);
      solid.boxB(cx, 0, zf + 0.15, f.w, 3.2, 0.3, f.trim);
      glow.boxB(cx, 0.5, zf - 0.02, f.w - 1.4, 2.2, 0.06, '#f6e8c6');
      solid.boxB(cx, 3.2, zf - 0.25, f.w + 0.2, 0.2, 0.9, f.trim);
      solid.boxB(cx, f.h, zf + d / 2, f.w + 0.4, 0.3, d + 0.4, '#8b8f9a');
      // upper windows
      for (let fl = 0; fl < Math.floor((f.h - 4.2) / 2.5); fl++) {
        for (let k = 0; k < Math.floor(f.w / 2.6); k++) {
          const wx = cx - f.w / 2 + 1.6 + k * 2.6;
          glow.boxB(wx, 4.1 + fl * 2.5, zf - 0.02, 1.6, 1.4, 0.05, R() > 0.7 ? '#ffe3a1' : '#a9cbe6');
        }
      }
      const tex = signTexture(f.text, { bg: f.bg, fg: f.fg, sub: f.sub, subColor: f.fg, round: 14 }, 384, 140);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
      const g = new THREE.PlaneGeometry(Math.min(5.2, f.w - 1), 1.9);
      const m = new THREE.Mesh(g, mat);
      m.rotation.y = Math.PI;
      m.position.set(cx, 3.2 + 1.2, zf - 0.75);
      group.add(m);
      disposables.push(tex, mat, g);
      if (f.lantern) {
        for (const dx of [-3, 3]) {
          glow.sphere(cx + dx, 2.5, zf - 0.7, 0.36, '#e5453d', { sy: 1.25, ws: 10, hs: 8 });
          pickAt('lantern', cx + dx, 2.5, zf - 0.7, 0.7);
        }
      }
      if (f.flowers) {
        for (let i = 0; i < 6; i++) {
          solid.cyl(cx - 2.6 + i * 1.0, 0, zf - 0.9, 0.22, 0.17, 0.4, '#8a8f98');
          for (let k = 0; k < 4; k++) solid.sphere(cx - 2.6 + i * 1.0 + (R() - 0.5) * 0.3, 0.55 + R() * 0.2, zf - 0.9 + (R() - 0.5) * 0.3, 0.16, pick(R, ['#ff6b8b', '#ffd166', '#b8a1ff', '#ffffff', '#ff9f68']), { ws: 6, hs: 5 });
        }
      }
      collide(cx, zf + d / 2, f.w, d);
      occlude({ x0: cx - f.w / 2, x1: cx + f.w / 2, z0: zf, z1: zf + d });
      mapRects.push({ x0: cx - f.w / 2, x1: cx + f.w / 2, z0: zf, z1: zf + d, color: '#d8d0c4' });
      x += f.w + 0.4;
    }
    collide(12, 15, 4, 12); // alley between park and the first shop
  }

  // ============ street furniture ============
  for (let x = -42; x <= 62; x += 14) {
    lamp(x, -6, 5.2);
    lamp(x + 7, 6, 5.2);
  }
  // utility poles with sagging wires
  const polesX = [-40, -16, 8, 32, 56];
  const wireMat = new THREE.LineBasicMaterial({ color: '#3a3a44' });
  disposables.push(wireMat);
  polesX.forEach((x) => {
    solid.cyl(x, 0, 8.4, 0.11, 0.14, 9.2, '#7d746a', { seg: 8 });
    solid.boxB(x, 8.0, 8.4, 0.12, 0.12, 2.4, '#6a6258');
    solid.boxB(x, 7.4, 8.4, 0.12, 0.12, 2.0, '#6a6258');
    solid.cyl(x, 5.8, 8.4, 0.2, 0.2, 0.5, '#9a9fa8', { seg: 8 });
    collide(x, 8.4, 0.5, 0.5);
  });
  for (let i = 0; i < polesX.length - 1; i++) {
    for (const [y, dz] of [[8.1, -1.1], [8.1, 1.1], [7.5, -0.9], [7.5, 0.9]] as const) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        pts.push(new THREE.Vector3(polesX[i] + (polesX[i + 1] - polesX[i]) * t, y - Math.sin(t * Math.PI) * 0.9, 8.4 + dz));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }
  }
  // bunting over the street
  {
    const b = new Batch();
    for (const x0 of [-6, 14]) {
      for (let i = 0; i < 24; i++) {
        const t = (i + 0.5) / 24;
        const z = -6.2 + 12.4 * t;
        const y = 6.6 - Math.sin(t * Math.PI) * 0.8;
        b.cone(x0, y - 0.45, z, 0.2, 0.45, ['#f4a3bb', '#ffffff', '#6fcfc4', '#ffd166'][i % 4], { rx: Math.PI, seg: 3 });
      }
    }
    const m = b.build(glowMat, { cast: false, receive: false });
    if (m) group.add(m);
  }
  // traffic lights at the crossing
  for (const [x, z, sgn] of [[27.4, 5.7, 1], [32.6, -5.7, -1]] as const) {
    solid.cyl(x, 0, z, 0.07, 0.09, 3.6, '#3a3f4a', { seg: 8 });
    solid.boxB(x, 3.3, z - sgn * 0.12, 0.34, 0.95, 0.28, '#2b2b36');
    glow.sphere(x, 3.35 + 0.28, z - sgn * 0.28, 0.1, '#ff5a5a', { ws: 8, hs: 6 });
    glow.sphere(x, 3.35, z - sgn * 0.28, 0.1, '#5a4a20', { ws: 8, hs: 6 });
    glow.sphere(x, 3.35 - 0.28, z - sgn * 0.28, 0.1, '#58e08a', { ws: 8, hs: 6 });
    solid.boxB(x, 2.5, z - sgn * 0.12, 0.28, 0.5, 0.14, '#2b2b36');
    glow.boxB(x, 2.55, z - sgn * 0.2, 0.18, 0.28, 0.02, '#58e08a');
    collide(x, z, 0.4, 0.4);
    pickAt('signal', x, 3.2, z, 1.1);
  }
  // post box
  solid.cyl(-2.6, 0, 8.6, 0.28, 0.28, 0.95, '#d8433f', { seg: 12 });
  solid.sphere(-2.6, 0.95, 8.6, 0.28, '#d8433f', { sy: 0.7, ws: 12, hs: 8 });
  glow.boxB(-2.6, 0.6, 8.32, 0.3, 0.05, 0.02, '#222');
  collide(-2.6, 8.6, 0.6, 0.6);
  pickAt('post', -2.6, 0.7, 8.6, 0.9);
  bin(-16, -8.2);
  bin(28, 8.2);
  bench(6, 8.3, Math.PI, undefined);
  bench(-30, -8, 0);
  // vending machines
  const vending = (x: number, z: number, face: number, body: string) => {
    solid.boxB(x, 0, z, 1.0, 1.9, 0.8, body, { ry: face });
    const nx = Math.sin(face) * 0.41;
    const nz = Math.cos(face) * 0.41;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) {
      glow.boxB(x + nx + Math.cos(face) * (-0.32 + k * 0.21), 1.2 + r * 0.22 - 0.4 + 0.35, z + nz - Math.sin(face) * (-0.32 + k * 0.21), 0.14, 0.18, 0.02, pick(R, ['#ff6b6b', '#4cc9f0', '#ffd166', '#06d6a0', '#f78fb3']), { ry: face });
    }
    glow.boxB(x + nx * 1.05, 0.35, z + nz * 1.05, 0.5, 0.2, 0.03, '#fff6dd', { ry: face });
    collide(x, z, 1.1, 0.9);
    pickAt('vending', x, 1.0, z + Math.cos(face) * 0.6, 1.2);
  };
  vending(-21.0, -9.6, 0, '#d8433f');
  vending(-19.4, -9.6, 0, '#3b6fb6');
  vending(-14.4, 9.9, Math.PI, '#e8a640');
  vending(51.4, -8.2, 0, '#2e9e5b');
  // bicycles
  const bike = (x: number, z: number, ry: number) => {
    const b = new Batch();
    for (const dx of [-0.55, 0.55]) b.torus(dx, 0.34, 0, 0.34, 0.035, '#222', { ry: Math.PI / 2 });
    b.boxB(0, 0.35, 0, 1.1, 0.04, 0.04, '#3b6fb6', { rz: 0.35 });
    b.boxB(0.15, 0.55, 0, 0.9, 0.04, 0.04, '#3b6fb6', { rz: -0.15 });
    b.boxB(-0.1, 0.72, 0, 0.3, 0.05, 0.12, '#222');
    b.boxB(0.55, 0.9, 0, 0.05, 0.05, 0.5, '#222');
    b.box(0.72, 0.8, 0, 0.3, 0.25, 0.4, '#bfc4cd');
    const m = b.build(toon);
    if (m) {
      m.position.set(x, 0, z);
      m.rotation.y = ry;
      group.add(m);
    }
    collide(x, z, 1.4, 0.5);
    pickAt('bicycle', x, 0.6, z, 1.0);
  };
  bike(-19.8, -7.3, 0.2);
  bike(11, -7.2, 0.1);
  bike(24.5, -7.8, -0.1);
  bike(-3.6, 8.2, 1.2);

  // ============ skyline ============
  {
    const winTex = windowsTexture();
    winTex.repeat.set(1, 1);
    const mat = new THREE.MeshBasicMaterial({ map: winTex, vertexColors: true });
    disposables.push(winTex, mat);
    const sky = new Batch(true);
    const tints = ['#dfe6f2', '#f0e1d8', '#d8e8e4', '#e9e0f0', '#f4ecd8', '#cfd9e8'];
    const place = (x: number, z: number) => {
      const w = 8 + R() * 8;
      const d = 8 + R() * 8;
      const h = 16 + R() * 44;
      sky.tower(x, 0, z, w, h, d, pick(R, tints), 3.4);
    };
    for (let x = -120; x < 170; x += 12 + R() * 4) place(x, -62 - R() * 24);
    for (let x = -120; x < 170; x += 14 + R() * 5) place(x, -102 - R() * 20);
    for (let x = -120; x < 170; x += 13 + R() * 5) place(x, 70 + R() * 20);
    for (let z = -50; z < 60; z += 14 + R() * 4) {
      place(-72 - R() * 14, z);
      place(100 + R() * 14, z);
    }
    for (let z = -50; z < 60; z += 18) place(-110 - R() * 20, z);
    const m = sky.build(mat, { cast: false, receive: false });
    if (m) group.add(m);

    // a tall red-and-white lattice tower on the horizon
    const tw = new Batch();
    const tx = 78;
    const tz = -150;
    const seg = [[9, 5, 24, '#e8552d'], [5, 2.6, 22, '#f6f2ea'], [2.6, 1.2, 20, '#e8552d'], [1.2, 0.4, 16, '#f6f2ea']] as const;
    let y = 0;
    for (const [rb, rt, h, col] of seg) {
      tw.cyl(tx, y, tz, rt, rb, h, col, { seg: 4, ry: Math.PI / 4 });
      y += h;
    }
    tw.boxB(tx, 24, tz, 11, 2.2, 11, '#f6f2ea');
    tw.boxB(tx, 46, tz, 6, 1.6, 6, '#e8552d');
    const tm = tw.build(glowMat, { cast: false, receive: false });
    if (tm) group.add(tm);
  }

  // ============ clouds ============
  {
    const cloudMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, fog: false, depthWrite: false });
    const clouds: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const b = new Batch();
      const n = 4 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) b.sphere((k - n / 2) * 7 + R() * 3, R() * 3, R() * 6, 6 + R() * 5, '#ffffff', { sy: 0.55, ws: 10, hs: 6 });
      const m = b.build(cloudMat, { cast: false, receive: false });
      if (m) {
        m.position.set(-150 + i * 55, 70 + R() * 30, -170 + R() * 120);
        group.add(m);
        clouds.push(m);
      }
    }
    animators.push((dt) => {
      clouds.forEach((c, i) => {
        c.position.x += dt * (0.8 + i * 0.15);
        if (c.position.x > 220) c.position.x = -220;
      });
    });
    disposables.push(cloudMat);
  }

  // ============ traffic ============
  {
    const carMesh = (body: string, roof: string, taxi = false) => {
      const b = new Batch();
      b.boxB(0, 0.35, 0, 4.0, 0.75, 1.8, body, { jitter: 0 });
      b.boxB(-0.1, 1.1, 0, 2.2, 0.7, 1.64, '#2c3a52', { jitter: 0 });
      b.boxB(-0.1, 1.74, 0, 2.0, 0.1, 1.5, roof, { jitter: 0 });
      b.boxB(-0.1, 1.1, 0, 2.25, 0.06, 1.7, body);
      for (const dx of [-1.25, 1.25]) for (const dz of [-0.9, 0.9]) b.cyl(dx, 0.0, dz, 0.34, 0.34, 0.28, '#1d1d24', { rx: Math.PI / 2, seg: 10 });
      b.boxB(2.0, 0.55, 0.6, 0.06, 0.18, 0.3, '#fff3b0');
      b.boxB(2.0, 0.55, -0.6, 0.06, 0.18, 0.3, '#fff3b0');
      b.boxB(-2.0, 0.55, 0.6, 0.06, 0.18, 0.3, '#ff4a4a');
      b.boxB(-2.0, 0.55, -0.6, 0.06, 0.18, 0.3, '#ff4a4a');
      if (taxi) b.boxB(-0.1, 1.84, 0, 0.7, 0.22, 0.3, '#fff3b0');
      return b.build(toon)!;
    };
    const cars = [
      { m: carMesh('#f5c518', '#f5c518', true), lane: 2.6, dir: 1, x: -60, v: 6.2 },
      { m: carMesh('#f1f3f6', '#e3e6ea'), lane: -2.6, dir: -1, x: 30, v: 5.2 },
      { m: carMesh('#d8433f', '#c63a36'), lane: 2.6, dir: 1, x: 40, v: 4.4 },
      { m: carMesh('#2aa198', '#23897f'), lane: -2.6, dir: -1, x: -30, v: 5.8 },
    ].map((c) => ({ ...c, speed: c.v }));
    cars.forEach((c) => {
      c.m.position.set(c.x, 0, c.lane);
      c.m.rotation.y = c.dir > 0 ? 0 : Math.PI;
      group.add(c.m);
    });
    animators.push((dt, _t, player) => {
      for (const c of cars) {
        // brake for anyone stepping into the lane ahead
        const ahead = (player.x - c.x) * c.dir;
        const blocked = Math.abs(player.z - c.lane) < 1.7 && ahead > 0 && ahead < 8;
        const target = blocked ? 0 : c.v;
        c.speed += (target - c.speed) * Math.min(1, dt * (blocked ? 4 : 1.2));
        c.x += c.dir * c.speed * dt;
        if (c.dir > 0 && c.x > 90) c.x = -110;
        if (c.dir < 0 && c.x < -110) c.x = 90;
        c.m.position.x = c.x;
      }
    });
  }

  // ============ falling petals ============
  {
    const n = 240;
    const pos = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (R() - 0.5) * 70;
      pos[i * 3 + 1] = R() * 10;
      pos[i * 3 + 2] = (R() - 0.5) * 70;
      seeds[i] = R() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const petal = blobTexture('rgba(255,190,214,1)', 'rgba(255,190,214,0)', 32);
    const mat = new THREE.PointsMaterial({ map: petal, size: 0.34, transparent: true, depthWrite: false, opacity: 0.95, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    group.add(pts);
    disposables.push(geo, petal, mat);
    animators.push((dt, tm, player) => {
      const a = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) {
        let x = a.getX(i) + (Math.sin(tm * 0.8 + seeds[i]) * 0.5 + 0.6) * dt;
        let y = a.getY(i) - (0.55 + (seeds[i] % 1) * 0.5) * dt;
        let z = a.getZ(i) + Math.cos(tm * 0.6 + seeds[i]) * 0.3 * dt;
        if (y < 0) y += 10;
        if (x - player.x > 35) x -= 70;
        if (x - player.x < -35) x += 70;
        if (z - player.z > 35) z -= 70;
        if (z - player.z < -35) z += 70;
        a.setXYZ(i, x, y, z);
      }
      a.needsUpdate = true;
    });
  }

  // ============ finish: build the merged meshes ============
  const solidMesh = solid.build(toon, { cast: true, receive: true, name: 'city-solid' });
  if (solidMesh) group.add(solidMesh);
  const glowMesh = glow.build(glowMat, { cast: false, receive: false, name: 'city-glow' });
  if (glowMesh) group.add(glowMesh);

  mapRects.push({ x0: -130, x1: 170, z0: -5, z1: 5, color: '#8f95a8' });

  const walk = new THREE.Vector3();
  return {
    group,
    colliders,
    occluders,
    pickables,
    mapRects,
    sky,
    sunDir,
    update(dt, t, player) {
      walk.copy(player);
      sky.position.copy(player);
      sunSprite.position.copy(player).addScaledVector(sunDir, 330);
      for (const a of animators) a(dt, t, walk);
    },
    setShadows(on) {
      if (solidMesh) solidMesh.castShadow = on;
    },
    dispose() {
      for (const d of disposables) d.dispose();
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}
