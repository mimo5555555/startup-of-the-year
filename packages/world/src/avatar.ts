import * as THREE from 'three';
import type { AvatarSpec, Emotion, HairStyle } from '@lw/content';
import { Batch } from './batch';

const BLUSH = '#ff9fa8';
const EYE = '#2a2230';
const MOUTH = '#8a3b45';

const shade = (hex: string, k: number) => {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l * k)));
  return `#${c.getHexString()}`;
};

export const DEFAULT_PLAYER: AvatarSpec = {
  skin: '#f3cdb0',
  hair: { style: 'short', color: '#3a2b2a' },
  top: '#4f86f7',
  bottom: '#343b55',
  shoes: '#f5f5f5',
  accent: '#ffd166',
  accessories: ['backpack'],
};

const ease = (x: number) => x * x * (3 - 2 * x);
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

interface EmotionLook {
  eyeY: number;
  mouthW: number;
  mouthH: number;
  blush: number;
  tilt: number;
}

const LOOKS: Record<Emotion, EmotionLook> = {
  neutral: { eyeY: 1, mouthW: 1, mouthH: 0.35, blush: 1, tilt: 0 },
  happy: { eyeY: 0.7, mouthW: 1.35, mouthH: 0.5, blush: 1.4, tilt: 0.03 },
  excited: { eyeY: 1.15, mouthW: 1.3, mouthH: 0.8, blush: 1.5, tilt: -0.03 },
  surprised: { eyeY: 1.3, mouthW: 0.6, mouthH: 1.1, blush: 1, tilt: 0 },
  confused: { eyeY: 1, mouthW: 0.7, mouthH: 0.3, blush: 0.8, tilt: 0.2 },
  sad: { eyeY: 0.85, mouthW: 0.7, mouthH: 0.25, blush: 0.6, tilt: 0.1 },
};

export class Avatar {
  readonly root = new THREE.Group();
  private upper = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private eyes!: THREE.Mesh;
  private mouth!: THREE.Mesh;
  private blob: THREE.Mesh;
  private parts: THREE.Mesh[] = [];

  private phase = Math.random() * 6;
  private walkBlend = 0;
  private walkSpeed = 0;
  private talking = false;
  private talkBlend = 0;
  private mouthLevel: number | null = null;
  private emotion: Emotion = 'neutral';
  private look = { ...LOOKS.neutral };
  private bowT = 1;
  private waveT = 0;
  private blinkAt = 1 + Math.random() * 3;
  private blinkT = 0;
  private lookYaw = 0;
  private seed = Math.random() * 100;
  private gesture = 0;

  constructor(readonly spec: AvatarSpec, material: THREE.Material, blobMaterial?: THREE.Material) {
    const stocky = spec.stocky ?? 1;
    this.build(spec, material, stocky);
    const scale = spec.height ?? 1;
    this.root.scale.setScalar(scale);
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), blobMaterial ?? new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.02;
    this.blob.scale.set(stocky, stocky, 1);
    this.root.add(this.blob);
  }

  private mesh(b: Batch, material: THREE.Material, cast = true) {
    const m = b.build(material, { cast, receive: false });
    if (m) this.parts.push(m);
    return m;
  }

  private build(spec: AvatarSpec, material: THREE.Material, stocky: number) {
    const skin = spec.skin;
    const skinShade = shade(skin, 0.9);
    const hairC = spec.hair.color;
    const acc = new Set(spec.accessories);

    // ---- legs ----
    for (const side of [-1, 1] as const) {
      const g = side < 0 ? this.legL : this.legR;
      g.position.set(side * 0.115 * stocky, 0.56, 0);
      const b = new Batch();
      b.cyl(0, -0.46, 0, 0.098 * stocky, 0.088 * stocky, 0.46, spec.bottom, { seg: 10 });
      b.box(0, -0.51, 0.045, 0.17 * stocky, 0.1, 0.3, spec.shoes, { jitter: 0.0 });
      b.sphere(0, -0.47, 0.17, 0.085, spec.shoes, { sx: 0.95, sy: 0.7, sz: 0.9, ws: 8, hs: 6 });
      const m = this.mesh(b, material);
      if (m) g.add(m);
      this.root.add(g);
    }

    this.upper.position.set(0, 0.56, 0);
    this.root.add(this.upper);

    // ---- torso ----
    const t = new Batch();
    t.cyl(0, 0, 0, 0.205 * stocky, 0.225 * stocky, 0.5, spec.top, { seg: 14 });
    t.cyl(0, -0.02, 0, 0.23 * stocky, 0.235 * stocky, 0.14, spec.bottom, { seg: 14 });
    t.sphere(0, 0.5, 0, 0.205 * stocky, spec.top, { sy: 0.5, ws: 14, hs: 8 });
    t.cyl(0, 0.52, 0, 0.07, 0.075, 0.1, skinShade, { seg: 8 });
    // collar
    t.torus(0, 0.545, 0, 0.1, 0.022, shade(spec.top, 1.12), { rx: Math.PI / 2 });
    if (acc.has('apron')) {
      t.box(0, 0.26, 0.215 * stocky, 0.34 * stocky, 0.4, 0.045, spec.accent, { jitter: 0 });
      t.box(0, 0.12, 0.245 * stocky, 0.2, 0.09, 0.03, shade(spec.accent, 0.82));
      t.box(0, 0.49, 0.2 * stocky, 0.07, 0.1, 0.03, spec.accent);
    }
    if (acc.has('tie')) {
      t.box(0, 0.4, 0.222 * stocky, 0.055, 0.2, 0.02, spec.accent);
      t.sphere(0, 0.5, 0.215 * stocky, 0.04, spec.accent, { ws: 8, hs: 6 });
    }
    if (acc.has('scarf')) {
      t.torus(0, 0.54, 0, 0.115, 0.045, spec.accent, { rx: Math.PI / 2 });
      t.box(0.09, 0.36, 0.2 * stocky, 0.075, 0.28, 0.035, spec.accent, { rz: 0.1 });
    }
    if (acc.has('backpack')) {
      t.box(0, 0.29, -0.27 * stocky, 0.3, 0.38, 0.16, spec.accent);
      t.box(0, 0.2, -0.36 * stocky, 0.2, 0.15, 0.04, shade(spec.accent, 0.8));
      for (const s of [-1, 1]) t.box(s * 0.11, 0.33, 0.04, 0.035, 0.34, 0.37 * stocky, shade(spec.accent, 0.75));
    }
    if (acc.has('camera')) {
      t.box(0.02, 0.2, 0.245 * stocky, 0.18, 0.11, 0.08, '#2c2c36');
      t.cyl(0.02, 0.2, 0.3 * stocky, 0.042, 0.042, 0.06, '#15151b', { seg: 10, rx: Math.PI / 2 });
      t.box(-0.12, 0.38, 0.2 * stocky, 0.025, 0.36, 0.015, '#d86b6b', { rz: -0.35 });
      t.box(0.16, 0.38, 0.2 * stocky, 0.025, 0.36, 0.015, '#d86b6b', { rz: 0.35 });
    }
    const torso = this.mesh(t, material);
    if (torso) this.upper.add(torso);

    // ---- arms ----
    for (const side of [-1, 1] as const) {
      const g = side < 0 ? this.armL : this.armR;
      g.position.set(side * (0.215 * stocky + 0.065), 0.47, 0);
      g.rotation.z = side * 0.07;
      const b = new Batch();
      b.cyl(0, -0.27, 0, 0.072, 0.066, 0.27, spec.top, { seg: 10 });
      b.cyl(0, -0.5, 0, 0.056, 0.05, 0.24, skin, { seg: 10 });
      b.sphere(0, -0.52, 0.01, 0.066, skin, { ws: 8, hs: 6 });
      b.sphere(0, 0.0, 0, 0.078, spec.top, { ws: 8, hs: 6 });
      const m = this.mesh(b, material);
      if (m) g.add(m);
      this.upper.add(g);
    }

    // ---- head ----
    this.head.position.set(0, 0.6, 0);
    this.upper.add(this.head);
    const h = new Batch();
    const cy = 0.27;
    h.sphere(0, cy, 0, 0.3, skin, { sy: 0.97, ws: 22, hs: 16 });
    h.sphere(-0.3, cy - 0.01, 0, 0.05, skinShade, { sx: 0.5, ws: 8, hs: 6 });
    h.sphere(0.3, cy - 0.01, 0, 0.05, skinShade, { sx: 0.5, ws: 8, hs: 6 });
    h.sphere(0, cy - 0.05, 0.3, 0.02, shade(skin, 0.85), { ws: 6, hs: 4 });
    for (const s of [-1, 1]) {
      h.sphere(s * 0.175, cy - 0.065, 0.235, 0.05, BLUSH, { sy: 0.6, sz: 0.3, ws: 8, hs: 6 });
      h.box(s * 0.115, cy + 0.09, 0.278, 0.075, 0.016, 0.012, shade(hairC, 0.7), { rz: s * -0.12 });
    }
    this.hair(h, spec.hair.style, hairC, cy, spec.accent);
    if (acc.has('glasses')) {
      for (const s of [-1, 1]) h.torus(s * 0.115, cy + 0.005, 0.282, 0.078, 0.011, '#2b2b36');
      h.box(0, cy + 0.01, 0.285, 0.05, 0.012, 0.012, '#2b2b36');
    }
    if (acc.has('headband')) {
      h.torus(0, cy + 0.12, 0, 0.3, 0.032, spec.accent, { rx: Math.PI / 2 });
      h.sphere(0.2, cy + 0.12, -0.2, 0.05, spec.accent, { ws: 6, hs: 4 });
      h.box(0.26, cy + 0.08, -0.22, 0.04, 0.16, 0.025, spec.accent, { rz: 0.2 });
    }
    if (acc.has('cap')) {
      h.cap(0, cy + 0.02, 0, 0.325, Math.PI * 0.5, spec.top, { sy: 0.9 });
      h.torus(0, cy + 0.15, 0, 0.318, 0.03, spec.accent, { rx: Math.PI / 2 });
      h.box(0, cy + 0.15, 0.37, 0.4, 0.035, 0.22, shade(spec.top, 0.85), { rx: -0.12 });
      h.sphere(0, cy + 0.17, 0.33, 0.04, spec.accent, { ws: 6, hs: 4 });
    }
    if (acc.has('beanie')) {
      h.cap(0, cy + 0.03, 0, 0.33, Math.PI * 0.52, spec.accent, { sy: 0.95 });
      h.torus(0, cy + 0.13, 0, 0.31, 0.04, shade(spec.accent, 0.85), { rx: Math.PI / 2 });
    }
    if (acc.has('mask')) h.box(0, cy - 0.11, 0.255, 0.26, 0.15, 0.07, '#f3f3f6', { jitter: 0 });
    const headMesh = this.mesh(h, material);
    if (headMesh) this.head.add(headMesh);

    // eyes blink as one mesh
    const e = new Batch();
    for (const s of [-1, 1]) {
      e.sphere(s * 0.118, 0, 0, 0.054, EYE, { sy: 1.3, sz: 0.5, ws: 12, hs: 10 });
      e.sphere(s * 0.118 + 0.017, 0.03, 0.022, 0.017, '#ffffff', { ws: 6, hs: 4 });
      e.sphere(s * 0.118 - 0.014, -0.025, 0.02, 0.009, '#ffffff', { ws: 6, hs: 4 });
    }
    const eyes = this.mesh(e, material, false);
    if (eyes) {
      eyes.position.set(0, cy + 0.01, 0.272);
      this.head.add(eyes);
      this.eyes = eyes;
    }

    // mouth is its own mesh so it can open and close
    const m = new Batch();
    m.sphere(0, 0, 0, 0.052, MOUTH, { sy: 0.5, sz: 0.35, ws: 10, hs: 8 });
    const mouth = this.mesh(m, material, false);
    if (mouth && !acc.has('mask')) {
      mouth.position.set(0, cy - 0.115, 0.285);
      this.head.add(mouth);
      this.mouth = mouth;
    } else if (mouth) {
      this.mouth = mouth;
    }
  }

  private hair(h: Batch, style: HairStyle, c: string, cy: number, accent: string) {
    if (style === 'bald') return;
    const dark = shade(c, 0.85);
    // cap tilted back so the forehead shows
    h.cap(0, cy + 0.015, -0.015, 0.325, Math.PI * 0.6, c, { sy: 0.98 });
    // bangs
    h.sphere(0, cy + 0.2, 0.17, 0.15, c, { sx: 1.75, sy: 0.5, sz: 1, ws: 12, hs: 8 });
    for (const s of [-1, 1]) h.sphere(s * 0.2, cy + 0.12, 0.17, 0.09, c, { sx: 0.9, sy: 1.1, sz: 0.8, ws: 8, hs: 6 });
    switch (style) {
      case 'short':
        for (const s of [-1, 1]) h.box(s * 0.285, cy - 0.04, 0.02, 0.05, 0.16, 0.13, dark);
        break;
      case 'bob':
        h.sphere(0, cy - 0.04, -0.1, 0.31, c, { sx: 1.02, sy: 0.95, sz: 0.9, ws: 14, hs: 10 });
        for (const s of [-1, 1]) {
          h.sphere(s * 0.265, cy - 0.12, 0.02, 0.1, c, { sx: 0.6, sy: 1.5, sz: 1.2, ws: 8, hs: 8 });
        }
        break;
      case 'ponytail':
        h.sphere(0, cy + 0.04, -0.27, 0.1, c, { ws: 8, hs: 6 });
        h.cyl(0, cy - 0.38, -0.34, 0.07, 0.04, 0.5, c, { rx: -0.35, seg: 8 });
        h.torus(0, cy + 0.02, -0.285, 0.07, 0.018, accent, { rx: Math.PI / 2 + 0.2 });
        for (const s of [-1, 1]) h.box(s * 0.285, cy - 0.04, 0.02, 0.05, 0.14, 0.12, dark);
        break;
      case 'bun':
        h.sphere(0, cy + 0.36, -0.04, 0.14, c, { ws: 10, hs: 8 });
        h.torus(0, cy + 0.28, -0.04, 0.1, 0.02, accent, { rx: Math.PI / 2 });
        for (const s of [-1, 1]) h.box(s * 0.285, cy - 0.04, 0.02, 0.05, 0.16, 0.12, dark);
        break;
      case 'spiky':
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          h.cone(Math.cos(a) * 0.15, cy + 0.26, Math.sin(a) * 0.15, 0.08, 0.22, c, { rx: Math.sin(a) * 0.5, rz: -Math.cos(a) * 0.5, seg: 6 });
        }
        break;
      case 'long':
        h.box(0, cy - 0.25, -0.2, 0.56, 0.72, 0.14, c, { jitter: 0 });
        for (const s of [-1, 1]) h.sphere(s * 0.27, cy - 0.2, 0.0, 0.1, c, { sx: 0.6, sy: 2.2, sz: 1.1, ws: 8, hs: 8 });
        break;
      default:
        break;
    }
  }

  // ----- control -----
  setWalking(speed: number) {
    this.walkSpeed = speed;
  }
  setTalking(on: boolean) {
    this.talking = on;
  }
  /** direct mouth control (0..1), e.g. from real audio amplitude; null returns to the built-in envelope */
  setMouthLevel(v: number | null) {
    this.mouthLevel = v;
  }
  setEmotion(e: Emotion) {
    this.emotion = e;
  }
  bow() {
    this.bowT = 0;
  }
  wave() {
    this.waveT = 1.6;
  }
  /** turn the head toward a point (world space), relative to the body's facing */
  lookToward(target: THREE.Vector3 | null) {
    if (!target) {
      this.lookYaw = 0;
      return;
    }
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;
    let yaw = Math.atan2(dx, dz) - this.root.rotation.y;
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    this.lookYaw = Math.max(-0.9, Math.min(0.9, yaw));
  }
  setBlob(visible: boolean) {
    this.blob.visible = visible;
  }

  update(dt: number, time: number) {
    const t = time + this.seed;
    // walking
    const moving = this.walkSpeed > 0.05;
    this.walkBlend = damp(this.walkBlend, moving ? Math.min(1, this.walkSpeed / 3.2) : 0, 12, dt);
    if (moving) this.phase += dt * (5.5 + this.walkSpeed * 1.6);
    const sw = Math.sin(this.phase) * 0.75 * this.walkBlend;
    this.legL.rotation.x = -sw;
    this.legR.rotation.x = sw;
    this.armL.rotation.x = sw * 0.85;
    this.armR.rotation.x = -sw * 0.85;

    const bob = Math.abs(Math.sin(this.phase)) * 0.045 * this.walkBlend;
    const breathe = Math.sin(t * 2.1) * 0.012;
    this.upper.position.y = 0.56 + bob;
    this.upper.scale.set(1, 1 + breathe, 1);

    // bow
    let lean = 0;
    if (this.bowT < 1) {
      this.bowT = Math.min(1, this.bowT + dt / 1.5);
      lean = Math.sin(Math.PI * ease(this.bowT)) * 0.55;
    }
    this.upper.rotation.x = lean + this.walkBlend * 0.06;

    // talking
    this.talkBlend = damp(this.talkBlend, this.talking ? 1 : 0, 9, dt);
    const env = 0.5 + 0.5 * Math.sin(t * 2.3);
    this.gesture = damp(this.gesture, this.talking ? env : 0, 6, dt);
    if (this.talkBlend > 0.02) {
      this.armR.rotation.x = -0.15 - this.gesture * 1.05 + Math.sin(t * 6) * 0.08 * this.gesture;
      this.armR.rotation.z = 0.07 + this.gesture * 0.25;
    } else {
      this.armR.rotation.z = 0.07;
    }
    // waving overrides the right arm
    if (this.waveT > 0) {
      this.waveT = Math.max(0, this.waveT - dt);
      const k = Math.min(1, this.waveT / 0.25, (1.6 - this.waveT) / 0.2);
      this.armL.rotation.x = 0;
      this.armL.rotation.z = -(0.07 + k * (2.4 + Math.sin(t * 13) * 0.25));
    } else {
      this.armL.rotation.z = -0.07;
    }

    // face
    const target = LOOKS[this.emotion];
    for (const k of Object.keys(target) as Array<keyof EmotionLook>) this.look[k] = damp(this.look[k], target[k], 8, dt);
    const nodAmp = 0.05 * this.talkBlend;
    this.head.rotation.x = Math.sin(t * 7.3) * nodAmp * (0.5 + this.gesture) + Math.sin(t * 1.3) * 0.015;
    this.head.rotation.z = Math.sin(t * 0.9) * 0.02 + this.look.tilt;
    this.head.rotation.y = damp(this.head.rotation.y, this.lookYaw, 5, dt);

    // blinking
    this.blinkAt -= dt;
    if (this.blinkAt <= 0 && this.blinkT <= 0) {
      this.blinkT = 0.14;
      this.blinkAt = 1.8 + Math.random() * 3.6;
    }
    let blink = 1;
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      blink = 0.12;
    }
    if (this.eyes) this.eyes.scale.set(1, this.look.eyeY * blink, 1);

    if (this.mouth) {
      let open: number;
      if (this.mouthLevel !== null) open = this.mouthLevel;
      else if (this.talking) open = Math.min(1, 0.15 + 0.85 * Math.abs(Math.sin(t * 12.5) * Math.sin(t * 4.7 + 1.3)) * 1.4);
      else open = 0;
      this.mouth.scale.set(this.look.mouthW * (1 - open * 0.15), Math.max(0.18, this.look.mouthH * 0.6 + open * 1.3), 1);
    }
  }

  dispose() {
    for (const m of this.parts) m.geometry.dispose();
    this.blob.geometry.dispose();
  }
}
