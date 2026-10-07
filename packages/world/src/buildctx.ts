// Everything a building builder needs from the city, so a shop is one function in buildings/ instead of a block in a
// 1,100-line buildCity(). The ctx owns the shared merged batches and the registration lists the world reads back
// (colliders, occluders, picks, minimap rects), so a builder never touches the city's internals.
import * as THREE from 'three';
import { Batch, rng, toonRamp } from './batch';
import { COLORS } from './palette';
import { FRONT_Z, shopRect, type MapRect, type Occluder, type Rect, type ShopDef, type SpawnSite } from './layout';
import { signTexture, type SignStyle } from './textures';

export interface Pickable {
  id: string;
  pos: THREE.Vector3;
  radius: number;
}

/** The open front of a shop diorama: what a 準備中 shutter has to cover. */
export interface ShopOpening {
  cx: number;
  w: number;
  openH: number;
}

export interface ShopFrameStyle {
  wall: string;
  inner: string;
  trim: string;
  roof: string;
  floor: string;
  ceil: string;
  openH: number;
  band?: number;
}

export interface SignPlaneOpts {
  x: number;
  y: number;
  z: number;
  /** plane size in metres */
  w: number;
  h: number;
  /** canvas size in pixels (default 512 wide, same aspect as the plane) */
  texW?: number;
  texH?: number;
  /** rotation.y; PI for a sign that faces -z (the south fronts face the street from the other side) */
  ry?: number;
  /** also make the sign tappable under this pick id */
  pickId?: string;
  pickRadius?: number;
}

export interface BuildCtx {
  /** the city's scene root; unmerged meshes (signs, flags, animated bits) go here */
  readonly group: THREE.Group;
  /** merged, vertex-coloured batches. `solid` is lit toon; `glow` is unlit (lit windows, light strips). One draw call each. */
  readonly solid: Batch;
  readonly glow: Batch;
  /** the materials those batches are built with, for builders that make their own small Batch */
  readonly toon: THREE.MeshToonMaterial;
  readonly glowMat: THREE.MeshBasicMaterial;
  readonly ramp: THREE.DataTexture;
  readonly palette: typeof COLORS;

  /**
   * The city's shared random stream. The existing district's colours depend on the exact order of its draws, so only
   * the original blocks use it; new builders take their own stream from `rng()`.
   */
  readonly R: () => number;
  pick<T>(items: readonly T[]): T;
  /**
   * An independent seeded stream per key, so adding or editing one building never recolours another.
   * Also do not pass a non-zero `jitter` to the Batch calls: that stream is shared with the park's trees and hedges.
   */
  rng(key: string): () => number;

  /** a box collider centred on (x, z) */
  collide(x: number, z: number, w: number, d: number): void;
  collideRect(r: Rect): void;
  /** something the conversation/follow camera has to stay out of */
  occlude(r: Occluder): void;
  /** a tappable spot; picks are ray-based and need no proximity */
  pickAt(id: string, x: number, y: number, z: number, radius?: number): void;
  /** a minimap rectangle */
  mapRect(rect: Rect, color: string, label?: string): void;
  /** per-frame callback (flags, steam, koi...) */
  animate(fn: (dt: number, t: number, player: THREE.Vector3) => void): void;
  /** have the city dispose these with itself */
  own(...items: Array<{ dispose(): void }>): void;

  /** Says the building exists. NPCs whose spawn `site` is this are only spawned when it was built (shopFrame calls it for a shop). */
  markBuilt(site: SpawnSite): void;
  /** Use a custom 準備中 shutter for this shop; otherwise the city makes a plain one from the shop's opening on first close. */
  registerShutter(shopId: string, shutter: THREE.Object3D): void;

  /** the open-front diorama box shared by every north-side shop (floor, walls, roof, header band, ceiling lights) */
  shopFrame(s: ShopDef, o: ShopFrameStyle): void;
  /** the hanging sign in the header band; also a pick */
  hangSign(id: string, s: ShopDef, text: string, sub: string, bg: string, fg: string, openH: number, band: number, border?: string, low?: boolean): THREE.Mesh;
  /** a flat textured sign in the world, optionally tappable */
  signPlane(text: string, style: SignStyle, o: SignPlaneOpts): THREE.Mesh;
}

/** What the city reads back after the builders have run. */
export interface BuildOutput {
  colliders: Rect[];
  occluders: Occluder[];
  pickables: Pickable[];
  mapRects: MapRect[];
  animators: Array<(dt: number, t: number, player: THREE.Vector3) => void>;
  disposables: Array<{ dispose(): void }>;
  built: Set<SpawnSite>;
  shutters: Map<string, THREE.Object3D>;
  openings: Map<string, ShopOpening>;
}

/** FNV-1a of a string, for per-key rng seeds. */
const seedOf = (key: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

export function createBuildCtx(): { ctx: BuildCtx; out: BuildOutput } {
  const R = rng(42);
  const group = new THREE.Group();
  const out: BuildOutput = {
    colliders: [],
    occluders: [],
    pickables: [],
    mapRects: [],
    animators: [],
    disposables: [],
    built: new Set(),
    shutters: new Map(),
    openings: new Map(),
  };

  const ramp = toonRamp();
  const toon = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  out.disposables.push(ramp, toon, glowMat);

  const solid = new Batch();
  const glow = new Batch();

  const collide: BuildCtx['collide'] = (x, z, w, d) => out.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  const occlude: BuildCtx['occlude'] = (r) => out.occluders.push(r);
  const pickAt: BuildCtx['pickAt'] = (id, x, y, z, radius = 1.2) => out.pickables.push({ id, pos: new THREE.Vector3(x, y, z), radius });
  const own: BuildCtx['own'] = (...items) => out.disposables.push(...items);

  const signPlane: BuildCtx['signPlane'] = (text, style, o) => {
    const texW = o.texW ?? 512;
    const tex = signTexture(text, style, texW, o.texH ?? Math.round((texW * o.h) / o.w));
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const g = new THREE.PlaneGeometry(o.w, o.h);
    const m = new THREE.Mesh(g, mat);
    m.position.set(o.x, o.y, o.z);
    if (o.ry) m.rotation.y = o.ry;
    group.add(m);
    own(tex, mat, g);
    if (o.pickId) pickAt(o.pickId, o.x, o.y, o.z + (o.ry ? -0.34 : 0.34), o.pickRadius ?? Math.min(o.w, 5) / 2);
    return m;
  };

  const shopFrame: BuildCtx['shopFrame'] = (s, o) => {
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
    out.openings.set(s.id, { cx, w, openH: o.openH });
    out.built.add(s.id);
  };

  const hangSign: BuildCtx['hangSign'] = (id, s, text, sub, bg, fg, openH, band, border, low = false) => {
    const w = s.w - 1.4;
    const tex = signTexture(text, { bg, fg, sub, subColor: fg, border }, 512, Math.round((512 * band) / w));
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false });
    const g = new THREE.PlaneGeometry(w, band);
    const m = new THREE.Mesh(g, mat);
    m.position.set(s.cx, low ? openH + band / 2 + 0.12 : openH + (s.h - openH - band) / 2 + band / 2 + 0.02, FRONT_Z + 0.06);
    group.add(m);
    own(tex, mat, g);
    pickAt(id, s.cx, m.position.y, FRONT_Z + 0.4, Math.min(w, 5) / 2);
    return m;
  };

  const ctx: BuildCtx = {
    group,
    solid,
    glow,
    toon,
    glowMat,
    ramp,
    palette: COLORS,
    R,
    pick: (items) => items[Math.floor(R() * items.length)],
    rng: (key) => rng(seedOf(key)),
    collide,
    collideRect: (r) => out.colliders.push({ ...r }),
    occlude,
    pickAt,
    mapRect: (rect, color, label) => out.mapRects.push({ ...rect, color, ...(label ? { label } : {}) }),
    animate: (fn) => out.animators.push(fn),
    own,
    markBuilt: (site) => out.built.add(site),
    registerShutter: (shopId, shutter) => {
      shutter.visible = false; // shops start open
      if (!shutter.parent) group.add(shutter);
      out.shutters.set(shopId, shutter);
    },
    shopFrame,
    hangSign,
    signPlane,
  };
  return { ctx, out };
}

/**
 * The plain closed-shop shutter: a ribbed slab across the opening with a 準備中 plate, in front of the diorama.
 * Built on first close, so a world where every shop stays open pays nothing for it.
 */
export function makeShutter(ctx: BuildCtx, o: ShopOpening): THREE.Group {
  const g = new THREE.Group();
  const w = o.w - 0.6;
  const h = o.openH - 0.12;
  const z = FRONT_Z + 0.05;
  const b = new Batch();
  b.boxB(o.cx, 0.12, z, w, h, 0.06, '#8d95a8', { jitter: 0 });
  for (let i = 0; i < Math.floor(h / 0.22); i++) b.boxB(o.cx, 0.2 + i * 0.22, z + 0.04, w, 0.05, 0.03, '#79819a', { jitter: 0 });
  const slab = b.build(ctx.toon, { cast: false, receive: false, name: 'shutter' });
  if (slab) g.add(slab);
  const pw = Math.min(4.2, w - 1);
  const plate = ctx.signPlane('準備中', { bg: '#f4f1e6', fg: '#b3402f', sub: 'junbi-chū', subColor: '#6b7080', border: '#b3402f', round: 14 }, { x: o.cx, y: 0.12 + h * 0.55, z: z + 0.09, w: pw, h: pw * 0.36 });
  ctx.group.remove(plate); // signPlane parks it in the city group; it lives in the shutter group instead
  g.add(plate);
  return g;
}
