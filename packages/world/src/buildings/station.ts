import * as THREE from 'three';
import { Batch } from '../batch';
import type { BuildCtx } from '../buildctx';
import { FRONT_Z, shopRect, type ShopDef } from '../layout';
import { signTexture } from '../textures';

// Station: hall with ticket machines, fare gates, a platform behind it, a parked train and a passing one.
export function buildStation(ctx: BuildCtx, s: ShopDef): void {
  const { group, solid, glow, toon, R, pickAt, own, animate, shopFrame } = ctx;
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
    own(tex, mat, g);
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
    own(t, g);
  }
  for (const [text, dx, bg] of [['出口', 8.2, '#1d7a45'], ['入口', -8.2, '#1d7a45']] as const) {
    const tex = signTexture(text, { bg, fg: '#fff', border: '#a7e3bd', round: 14 }, 256, 128);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const g = new THREE.PlaneGeometry(1.9, 0.95);
    const m = new THREE.Mesh(g, mat);
    m.position.set(s.cx + dx, openH - 0.65, FRONT_Z + 0.34);
    group.add(m);
    own(tex, mat, g);
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
    animate((dt) => {
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
  ctx.mapRect(shopRect(s), '#2e9e5b', 'station');
}
