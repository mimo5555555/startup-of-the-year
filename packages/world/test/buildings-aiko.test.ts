// Aiko's tea stall: the florist front (hanaya) is restyled by an override. The builder registers what the world needs
// (collider caps, lantern pick, minimap, shutter, built site), stays inside the stall and above the sidewalk, leaves no gap
// narrower than the player, and Aiko stands behind the counter facing the street once her character is registered.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { createBuildCtx } from '../src/buildctx';
import { buildAiko } from '../src/buildings/aiko';
import { FRONT_OVERRIDES, FRONT_STYLES, type FrontInfo } from '../src/buildings';
import { buildCity } from '../src/city';
import { AIKO_STALL, BOUNDS, NPC_SPAWNS, POLES, SOUTH_FRONT, SOUTH_FRONTS, layoutColliders, type Rect } from '../src/layout';
import { TokyoWorld } from '../src/world';

beforeAll(installFakeDom);

/** the player is 0.84 m wide: any gap between two obstacles must be at least this, or be fully closed */
const PLAYER_W = 0.84;
/** the render budget of the stall (Release 2 wave A: at most 2 draw calls and 2k triangles) */
const MAX_TRIANGLES = 2000;
const MAX_NEW_DRAW_CALLS = 2;
/** the tallest part is the sign frame; nothing should rise above the front itself */
const AVATAR_HEAD = 1.8;

const sf = SOUTH_FRONTS.find((f) => f.id === AIKO_STALL.front)!;
const spawn = NPC_SPAWNS.find((s) => s.id === 'aiko')!;
const front: FrontInfo = { id: 'hanaya', cx: sf.cx, w: sf.w, zf: SOUTH_FRONT.z0, d: SOUTH_FRONT.d, style: FRONT_STYLES.hanaya };
const build = () => {
  const { ctx, out } = createBuildCtx();
  const handled = buildAiko(ctx, front);
  return { ctx, out, handled };
};
const within = (inner: Rect, outer: Rect) => inner.x0 >= outer.x0 - 1e-9 && inner.x1 <= outer.x1 + 1e-9 && inner.z0 >= outer.z0 - 1e-9 && inner.z1 <= outer.z1 + 1e-9;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const inside = (r: Rect, x: number, z: number, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
/** the two end caps (everything but the counter itself), left to right */
const capsOf = (colliders: Rect[]) => colliders.filter((r) => !(r.x0 === AIKO_STALL.counter.x0 && r.x1 === AIKO_STALL.counter.x1)).sort((a, b) => a.x0 - b.x0);
const triangles = (ctx: ReturnType<typeof build>['ctx']) => {
  let n = 0;
  for (const b of [ctx.solid, ctx.glow]) {
    const m = b.build(ctx.toon);
    if (m) n += m.geometry.getAttribute('position').count / 3;
  }
  return n;
};

describe('buildAiko', () => {
  it('is the hanaya front override, takes over the dressing (returns true) and marks the aiko_stall site built', () => {
    expect(FRONT_OVERRIDES.hanaya).toBe(buildAiko);
    const { out, handled } = build();
    expect(handled).toBe(true);
    expect(out.built.has('aiko_stall')).toBe(true);
  });

  it('collides the counter and closes the nook behind it with two end caps that run from the counter to the wall', () => {
    const { out } = build();
    const c = AIKO_STALL.counter;
    expect(out.colliders).toHaveLength(3);
    expect(out.colliders).toContainEqual(c);
    const [left, right] = capsOf(out.colliders);
    expect(capsOf(out.colliders)).toHaveLength(2);
    expect(left).toMatchObject({ x0: sf.rect.x0, x1: c.x0, z0: c.z1, z1: sf.rect.z0 });
    expect(right).toMatchObject({ x0: c.x1, x1: sf.rect.x1, z0: c.z1, z1: sf.rect.z0 });
    // with the counter (a layout collider) in front, the nook cannot be entered, and Aiko is not inside any of them
    for (const r of [left, right, c]) expect(inside(r, spawn.x, spawn.z)).toBe(false);
  });

  it('keeps the caps clear of the other street colliders and leaves no slot narrower than the player', () => {
    const { out } = build();
    const others = layoutColliders().filter((o) => o.id !== 'counter:aiko' && o.id !== `front:${AIKO_STALL.front}`);
    for (const c of capsOf(out.colliders)) {
      expect(within(c, { x0: BOUNDS.x0, x1: BOUNDS.x1, z0: BOUNDS.z0, z1: BOUNDS.z1 })).toBe(true);
      for (const o of others) {
        expect(overlap(c, o.rect), o.id).toBe(false);
        const dx = Math.max(o.rect.x0 - c.x1, c.x0 - o.rect.x1);
        const dz = Math.max(o.rect.z0 - c.z1, c.z0 - o.rect.z1);
        if ((dx <= 0 && dz < 0) || (dz <= 0 && dx < 0)) {
          const g = Math.max(dx, dz);
          expect(g <= 0 || g >= PLAYER_W, `${o.id}: gap ${g}`).toBe(true);
        }
      }
    }
    // the pole that used to stand in the stall is clear of it (it moved to x 30.5)
    for (const x of POLES.x) expect(x + 0.25 <= sf.rect.x0 || x - 0.25 >= sf.rect.x1, `pole ${x}`).toBe(true);
  });

  it('fills the counter space between the caps: a gap of 0 on both sides, so nobody can walk into the nook', () => {
    const { out } = build();
    const c = AIKO_STALL.counter;
    const [left, right] = capsOf(out.colliders);
    expect(left.x1).toBeCloseTo(c.x0, 9);
    expect(right.x0).toBeCloseTo(c.x1, 9);
    expect(left.x0).toBeCloseTo(sf.rect.x0, 9);
    expect(right.x1).toBeCloseTo(sf.rect.x1, 9);
  });

  it('registers the lantern pick (the 提灯 sign word) twice and a minimap rect labelled aiko over the stall', () => {
    const { out } = build();
    const lanterns = out.pickables.filter((p) => p.id === 'lantern');
    expect(lanterns).toHaveLength(2);
    for (const p of lanterns) {
      expect(p.pos.x).toBeGreaterThan(sf.rect.x0);
      expect(p.pos.x).toBeLessThan(sf.rect.x1);
      expect(p.pos.z).toBeLessThan(sf.rect.z0); // under the awning, in front of the wall
      expect(p.pos.y).toBeGreaterThan(AVATAR_HEAD);
    }
    const m = out.mapRects.filter((r) => r.label === 'aiko');
    expect(m).toHaveLength(1);
    expect(m[0].x0).toBeCloseTo(sf.rect.x0, 9);
    expect(m[0].x1).toBeCloseTo(sf.rect.x1, 9);
    expect(m[0].z1).toBeCloseTo(sf.rect.z0, 9);
  });

  it("registers a hidden 'aiko-shutter' (slab + 準備中 plate) across the counter, in front of it, under the awning edge", () => {
    const { ctx, out } = build();
    const shutter = out.shutters.get('aiko');
    expect(shutter).toBeDefined();
    expect(shutter!.visible).toBe(false);
    expect(shutter!.parent).toBe(ctx.group);
    expect(shutter!.getObjectByName('aiko-shutter')).toBeDefined();
    const box = new THREE.Box3().setFromObject(shutter!);
    const c = AIKO_STALL.counter;
    expect(box.min.x).toBeLessThanOrEqual(c.x0);
    expect(box.max.x).toBeGreaterThanOrEqual(c.x1);
    expect(box.max.z).toBeLessThan(c.z0); // in front of the counter, on the street side
    expect(box.max.y).toBeLessThanOrEqual(AIKO_STALL.awningY + 1e-6);
    expect(box.min.y).toBeGreaterThanOrEqual(0);
    let meshes = 0;
    shutter!.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBe(2);
    // the plate faces the street (-z)
    const plate = shutter!.children.find((o) => (o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry instanceof THREE.PlaneGeometry)!;
    expect(Math.cos(plate.rotation.y)).toBeLessThan(0);
  });

  it('keeps all its geometry inside the stall: x within the front, z from the awning edge to the wall, below the sign frame', () => {
    const { ctx } = build();
    const box = new THREE.Box3();
    for (const o of ctx.group.children) if (o.visible) box.expandByObject(o);
    for (const b of [ctx.solid, ctx.glow]) {
      const m = b.build(ctx.toon);
      expect(m).not.toBeNull();
      box.expandByObject(m!);
    }
    expect(box.min.x).toBeGreaterThanOrEqual(sf.rect.x0 - 0.1);
    expect(box.max.x).toBeLessThanOrEqual(sf.rect.x1 + 0.1);
    expect(box.max.z).toBeLessThanOrEqual(sf.rect.z0 + 0.3); // not through the wall (the front box starts at z 9.7)
    expect(box.min.z).toBeGreaterThanOrEqual(AIKO_STALL.counter.z0 - 0.5); // the awning reaches only a little past the counter
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
    expect(box.max.y).toBeLessThanOrEqual(front.style.h);
  });

  it("keeps the counter's air clear: nothing hangs below head height over Aiko's spot or the walkers' lane", () => {
    const { ctx } = build();
    const m = ctx.solid.build(ctx.toon)!;
    const pos = m.geometry.getAttribute('position');
    const c = AIKO_STALL.counter;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      // the awning, noren, lanterns and posts are all in front of the wall and above the counter; the head-high band over the counter's
      // front half (z < the counter's back edge) holds only the posts, lanterns and noren, never anything lower than the noren hem
      if (z < c.z0 - 0.4 && y > 0.05) expect(y).toBeGreaterThan(AVATAR_HEAD); // in front of the counter: only things above heads (awning flap, noren, lanterns)
      expect(Number.isFinite(x + y + z)).toBe(true);
    }
  });

  it('puts Aiko on the sidewalk behind the counter, facing the street (-z), not in the wall', () => {
    const c = AIKO_STALL.counter;
    expect(spawn.face).toBeCloseTo(Math.PI, 9);
    expect(spawn.z).toBeGreaterThan(c.z1);
    expect(spawn.z).toBeLessThan(sf.rect.z0);
    expect(spawn.x).toBeGreaterThan(c.x0);
    expect(spawn.x).toBeLessThan(c.x1);
    expect(spawn.site).toBe('aiko_stall');
  });

  it('uses only the shared batches plus two sign planes, within the triangle budget, and builds the same stall every time', () => {
    const a = build();
    const b = build();
    const pieces = (x: typeof a) => x.ctx.solid.count + x.ctx.glow.count; // read before build(), which empties the batches
    expect(pieces(a)).toBe(pieces(b));
    expect(a.ctx.solid.count).toBeGreaterThan(100);
    expect(triangles(a.ctx)).toBeLessThanOrEqual(MAX_TRIANGLES);
    const visible: THREE.Object3D[] = [];
    a.ctx.group.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) visible.push(o); });
    expect(visible.length).toBeLessThanOrEqual(MAX_NEW_DRAW_CALLS); // the 小野茶房 sign and the 茶 noren plate
    expect(a.out.animators).toHaveLength(0);
  });

  it('does not touch the shared random stream (the original district keeps its colours)', () => {
    const a = createBuildCtx();
    const b = createBuildCtx();
    const before = a.ctx.R();
    buildAiko(b.ctx, front);
    expect(b.ctx.R()).toBe(before);
  });
});

describe('Aiko in the real city and world', () => {
  it('buildCity runs the override: the stall is built, the lanterns are pickable, the shutter is registered lazily and the florist pots are gone', () => {
    const city = buildCity();
    expect(city.built.has('aiko_stall')).toBe(true);
    expect(city.pickables.filter((p) => p.id === 'lantern' && p.pos.x > sf.rect.x0 && p.pos.x < sf.rect.x1)).toHaveLength(2);
    expect(city.mapRects.some((m) => m.label === 'aiko')).toBe(true);
    // the layout counter and the two caps are colliders; the front box is still solid
    expect(city.colliders).toContainEqual(AIKO_STALL.counter);
    expect(city.colliders.filter((r) => r.z0 === AIKO_STALL.counter.z1 && r.z1 === sf.rect.z0)).toHaveLength(2);
  });

  type Npcs = { npcs: Array<{ id: string; avatar: { root: THREE.Object3D } }> };
  const make = (characters: unknown[]) => new TokyoWorld({ canvas: fakeCanvas(), characters: characters as never, quality: 'high' });

  it('spawns Aiko behind the counter once the character is registered, and not before', async () => {
    const { CHARACTERS } = await import('@lw/content');
    const without = make(CHARACTERS.filter((c) => c.id !== 'aiko'));
    expect(without.snapshot().npcs.map((n) => n.id)).not.toContain('aiko');
    without.dispose();
    const base = CHARACTERS.find((c) => c.id === 'aiko') ?? { ...CHARACTERS[0], id: 'aiko' };
    const world = make([...CHARACTERS.filter((c) => c.id !== 'aiko'), base]);
    expect(world.snapshot().npcs.map((n) => n.id).filter((id) => id === 'aiko')).toHaveLength(1);
    const n = (world as unknown as Npcs).npcs.find((x) => x.id === 'aiko')!;
    const p = n.avatar.root.position;
    expect(p.x).toBeCloseTo(spawn.x, 3);
    expect(p.z).toBeCloseTo(spawn.z, 3);
    expect(p.z).toBeGreaterThan(AIKO_STALL.counter.z1);
    expect(p.z).toBeLessThan(sf.rect.z0);
    world.dispose();
  });

  it("the 'aiko' shutter hides Aiko and shows the plate; opening restores her", async () => {
    const { CHARACTERS } = await import('@lw/content');
    const base = CHARACTERS.find((c) => c.id === 'aiko') ?? { ...CHARACTERS[0], id: 'aiko' };
    const world = make([...CHARACTERS.filter((c) => c.id !== 'aiko'), base]);
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('aiko');
    world.setShopOpen('aiko', false);
    expect(world.snapshot().npcs.map((n) => n.id)).not.toContain('aiko');
    const city = (world as unknown as { city: { group: THREE.Group } }).city;
    const shutters: THREE.Object3D[] = [];
    city.group.traverse((o) => { if (o.name === 'aiko-shutter' && o.parent) shutters.push(o.parent); });
    expect(shutters).toHaveLength(1);
    expect(shutters[0].visible).toBe(true);
    expect(Math.abs(new THREE.Box3().setFromObject(shutters[0]).getCenter(new THREE.Vector3()).x - AIKO_STALL.counter.x0 - (AIKO_STALL.counter.x1 - AIKO_STALL.counter.x0) / 2)).toBeLessThan(0.5);
    world.setShopOpen('aiko', true);
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('aiko');
    expect(shutters[0].visible).toBe(false);
    world.dispose();
  });
});
