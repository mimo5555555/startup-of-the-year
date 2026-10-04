import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Small deterministic RNG so the city looks identical on every run. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rot = { rx?: number; ry?: number; rz?: number };
type Opts = Rot & { jitter?: number };

const tmpColor = new THREE.Color();
const tmpHsl = { h: 0, s: 0, l: 0 };
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

let jitterRand = rng(7);

/**
 * Collects many primitives into one BufferGeometry with per-vertex colour,
 * so a whole street can be drawn with a handful of draw calls.
 */
export class Batch {
  private geos: THREE.BufferGeometry[] = [];

  constructor(private keepUv = false) {}

  get count() {
    return this.geos.length;
  }

  private colorize(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0) {
    tmpColor.set(color);
    if (jitter) {
      tmpColor.getHSL(tmpHsl);
      tmpColor.setHSL(tmpHsl.h, tmpHsl.s, Math.min(1, Math.max(0, tmpHsl.l + (jitterRand() - 0.5) * jitter)));
    }
    const n = g.getAttribute('position').count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = tmpColor.r;
      arr[i * 3 + 1] = tmpColor.g;
      arr[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }

  raw(base: THREE.BufferGeometry, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation, o: Opts = {}) {
    _e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    let g = base.clone().applyMatrix4(_m);
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv1' as never);
    if (!this.keepUv) g.deleteAttribute('uv');
    this.colorize(g, color, o.jitter);
    this.geos.push(g);
    return g;
  }

  /** box centred on (x, y, z) */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: THREE.ColorRepresentation, o: Opts = {}) {
    return this.raw(UNIT_BOX, x, y, z, w, h, d, color, o);
  }

  /** box standing on y0 */
  boxB(x: number, y0: number, z: number, w: number, h: number, d: number, color: THREE.ColorRepresentation, o: Opts = {}) {
    return this.box(x, y0 + h / 2, z, w, h, d, color, o);
  }

  cyl(x: number, y0: number, z: number, rTop: number, rBottom: number, h: number, color: THREE.ColorRepresentation, o: Opts & { seg?: number } = {}) {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, o.seg ?? 10);
    return this.raw(g, x, y0 + h / 2, z, 1, 1, 1, color, o);
  }

  sphere(x: number, y: number, z: number, r: number, color: THREE.ColorRepresentation, o: Opts & { sx?: number; sy?: number; sz?: number; ws?: number; hs?: number } = {}) {
    const key = `${o.ws ?? 10}:${o.hs ?? 8}`;
    let base = SPHERES.get(key);
    if (!base) SPHERES.set(key, (base = new THREE.SphereGeometry(1, o.ws ?? 10, o.hs ?? 8)));
    return this.raw(base, x, y, z, r * (o.sx ?? 1), r * (o.sy ?? 1), r * (o.sz ?? 1), color, o);
  }

  /** partial sphere, e.g. a hair cap: `thetaLength` of PI/2 is a hemisphere */
  cap(x: number, y: number, z: number, r: number, thetaLength: number, color: THREE.ColorRepresentation, o: Opts & { sx?: number; sy?: number; sz?: number } = {}) {
    const g = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, thetaLength);
    return this.raw(g, x, y, z, r * (o.sx ?? 1), r * (o.sy ?? 1), r * (o.sz ?? 1), color, o);
  }

  cone(x: number, y0: number, z: number, r: number, h: number, color: THREE.ColorRepresentation, o: Opts & { seg?: number } = {}) {
    const g = new THREE.ConeGeometry(r, h, o.seg ?? 8);
    return this.raw(g, x, y0 + h / 2, z, 1, 1, 1, color, o);
  }

  torus(x: number, y: number, z: number, r: number, tube: number, color: THREE.ColorRepresentation, o: Opts & { arc?: number } = {}) {
    const g = new THREE.TorusGeometry(r, tube, 6, 18, o.arc ?? Math.PI * 2);
    return this.raw(g, x, y, z, 1, 1, 1, color, o);
  }

  /** flat disc lying on the ground */
  disc(x: number, y: number, z: number, r: number, color: THREE.ColorRepresentation, o: Opts & { seg?: number; sx?: number; sz?: number } = {}) {
    const g = new THREE.CircleGeometry(r, o.seg ?? 18);
    g.rotateX(-Math.PI / 2);
    return this.raw(g, x, y, z, o.sx ?? 1, 1, o.sz ?? 1, color, o);
  }

  /** box with uv tiled for a repeating window texture (batch must be created with keepUv) */
  tower(x: number, y0: number, z: number, w: number, h: number, d: number, color: THREE.ColorRepresentation, tile = 3.2) {
    const g = this.box(x, y0 + h / 2, z, w, h, d, color);
    const uv = g.getAttribute('uv');
    const sizes: Array<[number, number]> = [
      [d, h], [d, h], [w, d], [w, d], [w, h], [w, h],
    ];
    // after toNonIndexed each face is 6 vertices in the original face order
    for (let f = 0; f < 6; f++) {
      const [u, v] = sizes[f];
      for (let k = 0; k < 6; k++) {
        const i = f * 6 + k;
        uv.setXY(i, uv.getX(i) * (u / tile), uv.getY(i) * (v / tile));
      }
    }
    uv.needsUpdate = true;
    return g;
  }

  build(material: THREE.Material, o: { cast?: boolean; receive?: boolean; name?: string } = {}): THREE.Mesh | null {
    if (!this.geos.length) return null;
    const merged = mergeGeometries(this.geos, false);
    if (!merged) return null;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = o.cast ?? true;
    mesh.receiveShadow = o.receive ?? true;
    mesh.name = o.name ?? 'batch';
    this.geos.forEach((g) => g.dispose());
    this.geos = [];
    return mesh;
  }
}

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const SPHERES = new Map<string, THREE.SphereGeometry>();

export function resetJitter(seed = 7) {
  jitterRand = rng(seed);
}

/** Three-step toon ramp, shared by all lit materials. */
export function toonRamp(steps = [0.42, 0.68, 0.88, 1]): THREE.DataTexture {
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => {
    const c = Math.round(v * 255);
    data.set([c, c, c, 255], i * 4);
  });
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
