import { describe, expect, it } from 'vitest';
import { clipDistance, resolveCircle } from '../src/collision';
import { BOUNDS, NPC_SPAWNS, SHOPS, shopRect, type Rect } from '../src/layout';

const R = 0.42;
const wall: Rect = { x0: 0, x1: 10, z0: 0, z1: 2 };
const world: Rect = { x0: -50, x1: 50, z0: -50, z1: 50 };

describe('resolveCircle', () => {
  it('leaves a free circle alone', () => {
    const p = { x: -5, z: -5 };
    resolveCircle(p, R, [wall], world);
    expect(p).toEqual({ x: -5, z: -5 });
  });
  it('pushes a circle out of a face, keeping its distance equal to the radius', () => {
    const p = { x: 5, z: -0.1 };
    resolveCircle(p, R, [wall], world);
    expect(p.z).toBeCloseTo(-R, 5);
    expect(p.x).toBeCloseTo(5, 5);
  });
  it('slides along a face instead of sticking', () => {
    const p = { x: 3, z: -0.1 };
    resolveCircle(p, R, [wall], world);
    p.x += 1; // keep walking along the wall
    p.z += 0.2; // while pressing into it
    resolveCircle(p, R, [wall], world);
    expect(p.x).toBeCloseTo(4, 5);
    expect(p.z).toBeLessThanOrEqual(-R + 1e-6);
  });
  it('rounds a corner', () => {
    const p = { x: 10.1, z: -0.1 };
    resolveCircle(p, R, [wall], world);
    expect(Math.hypot(p.x - 10, p.z - 0)).toBeCloseTo(R, 5);
  });
  it('gets a centre that ended up inside a box out through the nearest side', () => {
    const p = { x: 9.8, z: 1 };
    resolveCircle(p, R, [wall], world);
    expect(p.x).toBeCloseTo(10 + R, 5);
  });
  it('keeps the circle inside the world bounds', () => {
    const p = { x: 999, z: -999 };
    resolveCircle(p, R, [], world);
    expect(p).toEqual({ x: 50, z: -50 });
  });
});

describe('clipDistance', () => {
  const dir = { x: 0, y: 0, z: 1 };
  it('is unobstructed when nothing is in the way', () => {
    expect(clipDistance({ x: 0, y: 2, z: -20 }, dir, 8, [wall])).toBe(8);
  });
  it('stops short of a wall the camera would enter', () => {
    const d = clipDistance({ x: 5, y: 2, z: -6 }, dir, 8, [wall]);
    expect(d).toBeLessThan(8);
    expect(d).toBeGreaterThanOrEqual(1.8);
  });
  it('lets a high camera pass over a low hedge but not a low one', () => {
    const hedge = { x0: 0, x1: 10, z0: 0, z1: 1, y1: 1.2 };
    expect(clipDistance({ x: 5, y: 6, z: -4 }, dir, 8, [hedge])).toBe(8);
    expect(clipDistance({ x: 5, y: 1.5, z: -4 }, dir, 8, [hedge])).toBeLessThan(8);
  });
  it('never returns less than the minimum distance', () => {
    expect(clipDistance({ x: 5, y: 2, z: -0.5 }, dir, 8, [wall], 0.35, 1.8)).toBeGreaterThanOrEqual(1.8);
  });
});

describe('district layout', () => {
  it('puts every character where they can be reached from the walkable area', () => {
    for (const n of NPC_SPAWNS) {
      // the spot the player is teleported to / auto-walks to must lie inside the bounds
      const px = n.x + Math.sin(n.face) * n.radius * 0.72;
      const pz = n.z + Math.cos(n.face) * n.radius * 0.72;
      const p = { x: px, z: pz };
      resolveCircle(p, R, [], BOUNDS);
      expect(Math.hypot(n.x - p.x, n.z - p.z), n.id).toBeLessThanOrEqual(n.radius);
    }
  });
  it('keeps shops from overlapping each other', () => {
    const rects = SHOPS.map(shopRect);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
        expect(overlap, `${SHOPS[i].id} vs ${SHOPS[j].id}`).toBe(false);
      }
    }
  });
});
