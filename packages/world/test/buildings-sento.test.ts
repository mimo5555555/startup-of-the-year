// 銭湯「桜の湯」: the public bath extends the south row past the game centre. The override takes over the front's dressing, marks the
// sento site built (Genzō spawns), adds exactly two colliders (the bench and the shoe lockers, flush against the wall, leaving no gap
// narrower than the player), registers the picks that teach 銭湯 / 煙突 / のれん (and the bench and lanterns), keeps the doorway clear for
// Genzō and the chimney inside the front's own footprint.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { SIGNS } from '@lw/content';
import { createBuildCtx } from '../src/buildctx';
import { FRONT_OVERRIDES, FRONT_STYLES, type FrontInfo } from '../src/buildings';
import { buildSento } from '../src/buildings/sento';
import { BOUNDS, LAMPS, NPC_SPAWNS, POLES, SENTO, SOUTH_FRONT, SOUTH_FRONTS, boxRect, layoutColliders, type Rect } from '../src/layout';

beforeAll(installFakeDom);

/** the player is 0.84 m wide: any gap between two obstacles must be at least this, or be fully closed */
const PLAYER_W = 0.84;
const sf = SOUTH_FRONTS.find((f) => f.id === SENTO.front)!;
const front: FrontInfo = { id: 'sento', cx: sf.cx, w: sf.w, zf: SOUTH_FRONT.z0, d: SOUTH_FRONT.d, style: FRONT_STYLES.sento };
const build = () => {
  const { ctx, out } = createBuildCtx();
  const handled = buildSento(ctx, front);
  return { ctx, out, handled };
};
const same = (a: Rect, b: Rect) => Math.abs(a.x0 - b.x0) < 1e-9 && Math.abs(a.x1 - b.x1) < 1e-9 && Math.abs(a.z0 - b.z0) < 1e-9 && Math.abs(a.z1 - b.z1) < 1e-9;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
/** the gap between two boxes: along x when they face each other across x, along z when across z, the larger when they are corner to corner */
const gap = (a: Rect, b: Rect) => {
  const dx = Math.max(a.x0 - b.x1, b.x0 - a.x1);
  const dz = Math.max(a.z0 - b.z1, b.z0 - a.z1);
  return Math.max(dx, dz);
};

describe('buildSento', () => {
  it('is the sento front override at the east end of the south row, takes over the dressing and marks the site built', () => {
    expect(FRONT_OVERRIDES.sento).toBe(buildSento);
    expect(SOUTH_FRONTS[SOUTH_FRONTS.length - 1].id).toBe('sento');
    expect(sf.rect.x1).toBeLessThan(BOUNDS.x1);
    const { out, handled } = build();
    expect(handled).toBe(true);
    expect(out.built.has('sento')).toBe(true);
  });

  it('adds exactly the bench and the shoe lockers as colliders, both flush against the front wall', () => {
    const { out } = build();
    expect(out.colliders).toHaveLength(2);
    expect(out.colliders.some((r) => same(r, SENTO.bench))).toBe(true);
    expect(out.colliders.some((r) => same(r, SENTO.lockers))).toBe(true);
    for (const r of [SENTO.bench, SENTO.lockers]) {
      expect(r.z1).toBeCloseTo(SOUTH_FRONT.z0, 9);
      expect(r.x0 >= sf.rect.x0 && r.x1 <= sf.rect.x1, 'in front of the bath').toBe(true);
    }
  });

  it('leaves no gap narrower than the player between its colliders and anything else on the sidewalk', () => {
    const others = layoutColliders().filter((c) => !c.id.startsWith('front:') && !c.id.startsWith('sento:'));
    for (const r of [SENTO.bench, SENTO.lockers]) {
      for (const o of [...others, { id: 'other sento', rect: r === SENTO.bench ? SENTO.lockers : SENTO.bench }]) {
        const g = gap(r, o.rect);
        expect(g <= 0 || g >= PLAYER_W, `${o.id}: gap ${g}`).toBe(true);
        expect(overlap(r, o.rect), o.id).toBe(false);
      }
    }
    // the lamps and poles of the south sidewalk
    for (const x of [...LAMPS.southX.map((lx) => boxRect(lx, LAMPS.southZ, LAMPS.size, LAMPS.size)), ...POLES.x.map((px) => boxRect(px, POLES.z, POLES.size, POLES.size))]) {
      for (const r of [SENTO.bench, SENTO.lockers]) {
        const g = gap(r, x);
        expect(g <= 0 || g >= PLAYER_W, `lamp/pole: gap ${g}`).toBe(true);
      }
    }
  });

  it('keeps the doorway clear for Genzō, who stands in it facing the street', () => {
    const g = NPC_SPAWNS.find((s) => s.id === 'genzo')!;
    expect(g.site).toBe('sento');
    expect(g.face).toBeCloseTo(Math.PI, 9);
    expect(Math.abs(g.x - sf.cx)).toBeLessThan(0.5);
    const body = boxRect(g.x, g.z, 0.6, 0.6);
    for (const r of [SENTO.bench, SENTO.lockers]) expect(gap(body, r)).toBeGreaterThanOrEqual(PLAYER_W);
  });

  it('registers the picks that teach a word (銭湯, 煙突, のれん) plus the bench and the lanterns, and every one is in the SIGNS table', () => {
    const { out } = build();
    const ids = new Set(out.pickables.map((p) => p.id));
    for (const id of ['sento', 'chimney', 'noren', 'bench', 'lantern']) expect(ids.has(id), id).toBe(true);
    for (const id of ['sento', 'chimney', 'noren']) expect(SIGNS.some((s) => s.id === id), id).toBe(true);
  });

  it('stands the chimney on the roof, inside the front footprint', () => {
    const c = SENTO.chimney;
    expect(c.x - c.r).toBeGreaterThan(sf.rect.x0);
    expect(c.x + c.r).toBeLessThan(sf.rect.x1);
    expect(c.z - c.r).toBeGreaterThan(sf.rect.z0);
    expect(c.z + c.r).toBeLessThan(sf.rect.z1);
    expect(c.top).toBeGreaterThan(FRONT_STYLES.sento.h + 8);
  });
});
