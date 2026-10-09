import * as THREE from 'three';
import { Batch } from '../batch';
import { KEI } from '../layout';

// ---------------------------------------------------------------------------------------------------------------
// Shared parts. The same bicycle and kei car are parked in Nakamura Motors (buildings/motors.ts, merged into the
// city's batches) and mounted under the player (buildings/rides.ts), so both look the same. Parts are written in a local
// frame (x forward, z to the side, y up, origin on the ground at the middle of the vehicle) and placed with a yaw.
// ---------------------------------------------------------------------------------------------------------------


type Rot = { rx?: number; ry?: number; rz?: number };

const geoCache = new Map<string, THREE.BufferGeometry>();
const cached = (key: string, make: () => THREE.BufferGeometry) => {
  let g = geoCache.get(key);
  if (!g) geoCache.set(key, (g = make()));
  return g;
};

/** A low-poly ring (4 x 16 segments, 128 triangles instead of the Batch default's 216): tyres and wheels are small on screen. */
export function ring(b: Batch, x: number, y: number, z: number, r: number, tube: number, color: string, o: Rot = {}): void {
  const ratio = Math.round((tube / r) * 1000) / 1000;
  b.raw(cached(`ring:${ratio}`, () => new THREE.TorusGeometry(1, ratio, 4, 16)), x, y, z, r, r, r, color, o);
}

/** The upper half of a squashed ball (56 triangles): a helmet. */
export function dome(b: Batch, x: number, y0: number, z: number, r: number, color: string, o: Rot = {}): void {
  b.raw(cached('dome', () => new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2)), x, y0, z, r, r * 0.9, r, color, o);
}

/** Writes local-frame boxes, cylinders and rings into a Batch at a world position and yaw (and an optional uniform scale). */
class Frame {
  private readonly c: number;
  private readonly s: number;

  constructor(private readonly b: Batch, private readonly x0: number, private readonly y0: number, private readonly z0: number, private readonly ry: number, private readonly k = 1) {
    this.c = Math.cos(ry);
    this.s = Math.sin(ry);
  }

  private wx(lx: number, lz: number) {
    return this.x0 + (lx * this.c + lz * this.s) * this.k;
  }
  private wz(lx: number, lz: number) {
    return this.z0 + (-lx * this.s + lz * this.c) * this.k;
  }
  private rot(o: { rx?: number; ry?: number; rz?: number }) {
    return { ...o, ry: this.ry + (o.ry ?? 0) };
  }

  /** box standing on local height `ly0` */
  box(lx: number, ly0: number, lz: number, w: number, h: number, d: number, color: string, o: { rx?: number; ry?: number; rz?: number } = {}) {
    const k = this.k;
    this.b.boxB(this.wx(lx, lz), this.y0 + ly0 * k, this.wz(lx, lz), w * k, h * k, d * k, color, this.rot(o));
  }
  cyl(lx: number, ly0: number, lz: number, rTop: number, rBottom: number, h: number, color: string, o: { rx?: number; ry?: number; rz?: number; seg?: number } = {}) {
    const k = this.k;
    this.b.cyl(this.wx(lx, lz), this.y0 + ly0 * k, this.wz(lx, lz), rTop * k, rBottom * k, h * k, color, { ...this.rot(o), seg: o.seg });
  }
  sphere(lx: number, ly: number, lz: number, r: number, color: string, o: { ws?: number; hs?: number } = {}) {
    this.b.sphere(this.wx(lx, lz), this.y0 + ly * this.k, this.wz(lx, lz), r * this.k, color, { ...this.rot({}), ...o });
  }
  /** a ring centred at height `ly`; its plane is the local XY plane unless rotated */
  torus(lx: number, ly: number, lz: number, r: number, tube: number, color: string, o: { rx?: number; ry?: number; rz?: number } = {}) {
    ring(this.b, this.wx(lx, lz), this.y0 + ly * this.k, this.wz(lx, lz), r * this.k, tube * this.k, color, this.rot(o));
  }
  /** a square-section rod between two points of the local XY plane (z = lz) */
  bar(ax: number, ay: number, bx: number, by: number, t: number, color: string, lz = 0) {
    this.box((ax + bx) / 2, (ay + by) / 2 - t / 2, lz, Math.hypot(bx - ax, by - ay), t, t, color, { rz: Math.atan2(by - ay, bx - ax) });
  }
}

/** Where the local origin of a vehicle goes so that its local point (lx, 0) stands at the world origin when yawed by `ry`. */
export const anchorFor = (lx: number, ry: number) => ({ x: -lx * Math.cos(ry), z: lx * Math.sin(ry) });

export interface BikeLook {
  frame: string;
  /** electric-assist: battery, hub motor, display */
  ebike?: boolean;
}

/** Bike dimensions at scale 1: about 1.45 m long (the layout's bikeRect is 1.4 x 0.5). */
export const BIKE = {
  tireR: 0.27,
  tube: 0.035,
  hubX: 0.42,
  /** the saddle's x: the rider's seat on a ride mesh */
  saddleX: -0.22,
  /** a ride is drawn a little larger than a parked bike so the avatar does not look like it rides a toy */
  rideScale: 1.2,
};
const TIRE = '#23242b';
const STEEL = '#c9ced8';
const GRIP = '#2b2b36';

/**
 * A mamachari (city bicycle with a basket), or an e-bike when `look.ebike`. Local x is forward. `x`/`z` is where the
 * middle of the bike stands, `ry` its yaw; `y0` the ground height. The glow batch gets the lamp (and the e-bike's display).
 */
export function addBike(solid: Batch, glow: Batch, x: number, z: number, ry: number, look: BikeLook, o: { y0?: number; k?: number } = {}): void {
  const f = new Frame(solid, x, o.y0 ?? 0, z, ry, o.k ?? 1);
  const g = new Frame(glow, x, o.y0 ?? 0, z, ry, o.k ?? 1);
  const hub = BIKE.tireR + BIKE.tube;
  const wb = BIKE.hubX;
  const t = look.ebike ? 0.05 : 0.036;
  const frame = look.frame;

  for (const hx of [-wb, wb]) {
    f.torus(hx, hub, 0, BIKE.tireR, BIKE.tube, TIRE);
    f.cyl(hx, hub - 0.04, 0, 0.035, 0.035, 0.08, STEEL, { rx: Math.PI / 2, seg: 6 });
    for (let i = 0; i < 3; i++) f.box(hx, hub - 0.005, 0, 0.5, 0.01, 0.01, STEEL, { rz: (i * Math.PI) / 3 });
  }
  const bb = { x: -0.04, y: 0.27 };
  f.bar(-wb, hub, bb.x, bb.y, t, frame); // chain stay
  f.bar(-wb, hub, -0.2, 0.62, 0.025, frame); // seat stay
  f.bar(bb.x, bb.y, -0.2, 0.74, t, frame); // seat tube
  f.bar(bb.x, bb.y, 0.27, 0.58, t, frame); // down tube (step-through, as on a mamachari)
  f.bar(0.27, 0.58, 0.31, 0.78, t, frame); // head tube
  f.bar(0.31, 0.72, wb, hub, 0.03, frame); // fork
  f.box(-wb, 0.58, 0, 0.5, 0.025, 0.09, frame); // fenders
  f.box(wb, 0.58, 0, 0.46, 0.025, 0.09, frame);
  f.bar(-0.2, 0.72, -0.22, 0.8, 0.03, STEEL); // seat post
  f.box(BIKE.saddleX, 0.8, 0, 0.26, 0.06, 0.15, GRIP); // saddle
  f.bar(0.31, 0.76, 0.29, 0.92, 0.035, STEEL); // stem
  f.box(0.29, 0.9, 0, 0.04, 0.04, 0.44, STEEL); // handlebar
  for (const sz of [-1, 1]) f.box(0.29, 0.885, sz * 0.23, 0.05, 0.05, 0.08, GRIP); // grips
  f.box(0.5, 0.74, 0, 0.3, 0.17, 0.32, '#cdd2da'); // basket
  f.box(0.5, 0.9, 0, 0.32, 0.02, 0.34, '#9aa0ad');
  f.box(-0.5, 0.5, 0, 0.3, 0.03, 0.18, '#9aa0ad'); // carrier
  for (const sz of [-1, 1]) f.box(bb.x, bb.y - 0.01, sz * 0.12, 0.12, 0.02, 0.06, GRIP); // pedals
  f.sphere(0.29, 0.97, 0.12, 0.03, STEEL, { ws: 6, hs: 4 }); // bell
  g.sphere(0.4, 0.88, 0, 0.035, '#fff2a8', { ws: 6, hs: 4 }); // lamp
  if (look.ebike) {
    f.box(-0.17, 0.42, 0, 0.1, 0.27, 0.1, '#2b2f3a'); // battery on the seat tube
    f.cyl(-wb, hub - 0.06, 0, 0.075, 0.075, 0.12, '#2b2f3a', { rx: Math.PI / 2, seg: 10 }); // hub motor
    g.box(0.29, 0.95, 0, 0.05, 0.02, 0.09, '#8be0c5'); // handlebar display
  }
}

export interface KeiLook {
  body: string;
  accent: string;
  /** no roof, side glass or rear glass: the player (a standing avatar) shows through */
  open?: boolean;
}

/** The kei car's seat, in local x: the avatar of a ride mesh sits here. */
export const KEI_SEAT_X = 0.15;
const KEI_GLASS = '#a9d4ea';
const KEI_DARK = '#2b2f3a';
const KEI_TRIM = '#e9edf2';

/**
 * A kei car, KEI.len x KEI.wid (3.4 x 1.5 m) so it matches `keiRect`: boxy toon body, four wheels, lamps in the glow batch.
 * Local x is forward. `y0` is the floor height.
 */
export function addKei(solid: Batch, glow: Batch, x: number, z: number, ry: number, look: KeiLook, y0 = 0): void {
  const f = new Frame(solid, x, y0, z, ry);
  const g = new Frame(glow, x, y0, z, ry);
  const L = KEI.len;
  const W = KEI.wid;
  const half = W / 2 - 0.04; // body side plane
  const body = look.body;

  f.box(0, 0.14, 0, L - 0.3, 0.14, W - 0.2, KEI_DARK); // underbody
  f.box(0, 0.26, 0, L - 0.12, 0.6, W - 0.08, body); // lower body up to the belt line (0.86)
  for (const sz of [-1, 1]) {
    f.box(0, 0.5, sz * (half + 0.005), L - 0.5, 0.08, 0.02, look.accent); // side stripe
    for (const sx of [0.78, -0.3, -1.45]) f.box(sx, 0.3, sz * (half + 0.005), 0.02, 0.54, 0.02, KEI_DARK); // door seams
    for (const sx of [0.5, -0.45]) f.box(sx, 0.74, sz * (half + 0.012), 0.12, 0.03, 0.03, KEI_TRIM); // handles
    f.box(0.7, 0.95, sz * (half + 0.07), 0.07, 0.1, 0.08, KEI_DARK); // mirrors
  }
  // windscreen and its pillars
  f.box(0.8, 0.88, 0, 0.04, 0.62, W - 0.2, KEI_GLASS, { rz: 0.2 });
  for (const sz of [-1, 1]) f.box(0.8, 0.86, sz * 0.64, 0.06, 0.68, 0.06, body, { rz: 0.2 });
  f.box(0.62, 1.5, 0, 0.07, 0.06, W - 0.14, body); // windscreen header
  if (!look.open) {
    f.box(-0.4, 1.5, 0, 2.15, 0.07, W - 0.14, body); // roof
    for (const sz of [-1, 1]) {
      for (const sx of [-0.3, -1.5]) f.box(sx, 0.86, sz * 0.64, 0.07, 0.65, 0.07, body); // B and C pillars
      f.box(0.24, 0.95, sz * 0.645, 1.0, 0.5, 0.03, KEI_GLASS); // side windows
      f.box(-0.9, 0.95, sz * 0.645, 1.1, 0.5, 0.03, KEI_GLASS);
    }
    f.box(-1.5, 0.9, 0, 0.04, 0.55, W - 0.24, KEI_GLASS); // rear window
  } else {
    // a bench seat, dashboard and steering wheel instead of a cabin, so the rider reads as sitting in the car
    f.box(KEI_SEAT_X - 0.05, 0.86, 0, 0.5, 0.2, 1.0, '#3a3f50');
    f.box(KEI_SEAT_X - 0.4, 0.86, 0, 0.1, 0.6, 1.0, '#3a3f50');
    f.box(0.62, 0.86, 0, 0.26, 0.2, W - 0.2, KEI_DARK);
    f.torus(0.45, 1.12, 0, 0.12, 0.02, KEI_DARK, { ry: Math.PI / 2, rz: 0.4 });
  }
  // front: bumper, grille, plate, headlamps
  f.box(L / 2 - 0.05, 0.14, 0, 0.1, 0.22, W - 0.06, KEI_DARK);
  f.box(L / 2 - 0.07, 0.4, 0, 0.02, 0.2, 0.7, KEI_DARK);
  f.box(L / 2, 0.2, 0, 0.02, 0.14, 0.34, '#f4f4f4');
  // rear: bumper, plate
  f.box(-L / 2 + 0.05, 0.14, 0, 0.1, 0.22, W - 0.06, KEI_DARK);
  f.box(-L / 2, 0.2, 0, 0.02, 0.14, 0.34, '#f4f4f4');
  for (const sz of [-1, 1]) {
    g.box(L / 2 - 0.07, 0.5, sz * 0.5, 0.04, 0.14, 0.24, '#fff6c8'); // headlamps
    g.box(-L / 2 + 0.07, 0.56, sz * 0.58, 0.04, 0.16, 0.2, '#ff5a5a'); // tail lamps
  }
  // wheels
  const r = 0.27;
  for (const wx of [1.1, -1.1]) {
    for (const sz of [-1, 1]) {
      f.cyl(wx, r - 0.1, sz * 0.65, r, r, 0.2, TIRE, { rx: Math.PI / 2, seg: 10 });
      f.cyl(wx, r - 0.105, sz * 0.65, 0.13, 0.13, 0.21, STEEL, { rx: Math.PI / 2, seg: 6 });
    }
  }
}
