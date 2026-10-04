import type { Occluder, Rect } from './layout';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 extends Vec2 {
  y: number;
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function clampToBounds(p: Vec2, bounds: Rect) {
  p.x = clamp(p.x, bounds.x0, bounds.x1);
  p.z = clamp(p.z, bounds.z0, bounds.z1);
}

/** Push a circle out of axis-aligned boxes (sliding along their faces) and keep it inside the world bounds. */
export function resolveCircle(p: Vec2, radius: number, rects: readonly Rect[], bounds: Rect) {
  clampToBounds(p, bounds);
  for (const r of rects) {
    const cx = clamp(p.x, r.x0, r.x1);
    const cz = clamp(p.z, r.z0, r.z1);
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * radius;
      p.z = cz + (dz / d) * radius;
    } else {
      // the centre is inside the box: leave by the nearest side
      const left = p.x - r.x0;
      const right = r.x1 - p.x;
      const top = p.z - r.z0;
      const bottom = r.z1 - p.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) p.x = r.x0 - radius;
      else if (m === right) p.x = r.x1 + radius;
      else if (m === top) p.z = r.z0 - radius;
      else p.z = r.z1 + radius;
    }
  }
  clampToBounds(p, bounds);
}

/**
 * How far a camera can travel from `origin` along `dir` before it would end up inside something.
 * Occluders have a height range, so a low hedge only blocks a low camera. Never returns less than `minD`.
 */
export function clipDistance(origin: Vec3, dir: Vec3, maxD: number, occluders: readonly Occluder[], pad = 0.35, minD = 2.8): number {
  let best = maxD;
  for (const r of occluders) {
    const x0 = r.x0 - pad;
    const x1 = r.x1 + pad;
    const z0 = r.z0 - pad;
    const z1 = r.z1 + pad;
    let tmin = 0;
    let tmax = best;
    const slab = (o: number, d: number, lo: number, hi: number) => {
      if (Math.abs(d) < 1e-6) return o >= lo && o <= hi;
      let t1 = (lo - o) / d;
      let t2 = (hi - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      return tmin <= tmax;
    };
    if (slab(origin.x, dir.x, x0, x1) && slab(origin.z, dir.z, z0, z1) && tmin > 0.01) {
      const yAt = origin.y + dir.y * tmin;
      if (yAt > (r.y0 ?? 0) - 0.4 && yAt < (r.y1 ?? 9) + 0.4) best = Math.min(best, Math.max(minD, tmin - 0.3));
    }
  }
  return best;
}
