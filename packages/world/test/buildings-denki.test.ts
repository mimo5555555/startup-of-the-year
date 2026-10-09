// Hikari Denki: the building registers what the world needs (collider, picks, minimap, shutter, built site), stays
// inside its footprint and the walkable bounds, and Aoi appears behind the counter once the character is registered.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { createBuildCtx } from '../src/buildctx';
import { buildDenki } from '../src/buildings/denki';
import { buildCity } from '../src/city';
import { BOUNDS, FRONT_Z, NPC_SPAWNS, SHOPS, SHOP_COUNTERS, layoutColliders, shopRect, type Rect } from '../src/layout';
import { TokyoWorld } from '../src/world';

beforeAll(installFakeDom);

const denki = SHOPS.find((s) => s.id === 'denki')!;
const aoiSpawn = NPC_SPAWNS.find((s) => s.id === 'aoi')!;
const build = () => {
  const { ctx, out } = createBuildCtx();
  buildDenki(ctx, denki);
  return { ctx, out };
};
const within = (inner: Rect, outer: Rect) => inner.x0 >= outer.x0 - 1e-9 && inner.x1 <= outer.x1 + 1e-9 && inner.z0 >= outer.z0 - 1e-9 && inner.z1 <= outer.z1 + 1e-9;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;

describe('buildDenki', () => {
  it('marks its site built, with the diorama collider, an occluder and its opening', () => {
    const { out } = build();
    expect(out.built.has('denki')).toBe(true);
    const r = shopRect(denki);
    expect(out.colliders.some((c) => within(c, r) && within(r, c))).toBe(true);
    expect(out.occluders).toHaveLength(1);
    expect(out.openings.get('denki')).toMatchObject({ cx: denki.cx, w: denki.w });
  });

  it('registers the hanging sign pick and a minimap rect over the footprint', () => {
    const { out } = build();
    expect(out.pickables.map((p) => p.id)).toContain('denki');
    const sign = out.pickables.find((p) => p.id === 'denki')!;
    expect(sign.pos.x).toBeCloseTo(denki.cx, 6);
    expect(out.mapRects).toHaveLength(1);
    expect(out.mapRects[0]).toMatchObject({ label: 'denki', ...shopRect(denki) });
  });

  it('registers a hidden custom 準備中 shutter covering the opening, in front of the diorama', () => {
    const { ctx, out } = build();
    const shutter = out.shutters.get('denki');
    expect(shutter).toBeDefined();
    expect(shutter!.visible).toBe(false);
    expect(shutter!.parent).toBe(ctx.group);
    const box = new THREE.Box3().setFromObject(shutter!);
    const op = out.openings.get('denki')!;
    expect(box.min.x).toBeLessThanOrEqual(op.cx - op.w / 2 + 0.7);
    expect(box.max.x).toBeGreaterThanOrEqual(op.cx + op.w / 2 - 0.7);
    expect(box.max.y).toBeLessThanOrEqual(op.openH);
    expect(box.min.z).toBeGreaterThanOrEqual(FRONT_Z - 0.01);
    let meshes = 0;
    shutter!.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBe(2); // slab + 準備中 plate
  });

  it('keeps every extra collider on the sidewalk outside the shop, in bounds and clear of the other street colliders', () => {
    const { out } = build();
    const shop = shopRect(denki);
    const extra = out.colliders.filter((c) => !(within(c, shop) && within(shop, c)));
    expect(extra.length).toBeGreaterThan(0);
    const others = layoutColliders().filter((c) => !c.id.startsWith('shop:denki'));
    for (const c of extra) {
      expect(c.x0).toBeGreaterThanOrEqual(shop.x0);
      expect(c.x1).toBeLessThanOrEqual(shop.x1);
      expect(c.z0).toBeGreaterThanOrEqual(BOUNDS.z0 - 0.5);
      expect(c.z0).toBeGreaterThanOrEqual(FRONT_Z); // in front of the shop, never inside it
      expect(c.z1).toBeLessThan(-5); // leaves the walking lane free
      for (const o of others) expect(overlap(c, o.rect), o.id).toBe(false);
    }
  });

  it('keeps all its geometry inside the footprint (plus the sign, roof overhang and the street-side props)', () => {
    const { ctx } = build();
    const box = new THREE.Box3();
    for (const o of ctx.group.children) box.expandByObject(o);
    for (const b of [ctx.solid, ctx.glow]) {
      const m = b.build(ctx.toon);
      expect(m).not.toBeNull();
      box.expandByObject(m!);
    }
    const r = shopRect(denki);
    expect(box.min.x).toBeGreaterThanOrEqual(r.x0 - 1);
    expect(box.max.x).toBeLessThanOrEqual(r.x1 + 1);
    expect(box.max.z).toBeLessThanOrEqual(FRONT_Z + 1.5);
    expect(box.min.z).toBeGreaterThanOrEqual(FRONT_Z - denki.d - 0.6);
    expect(box.max.y).toBeLessThanOrEqual(denki.h + 2.6);
  });

  it('puts the counter where the layout expects it, with the staff floor behind it', () => {
    const counter = SHOP_COUNTERS.denki!;
    expect(counter.z0).toBeGreaterThan(aoiSpawn.z); // Aoi stands behind (further from the street than) the counter
    expect(aoiSpawn.z).toBeGreaterThan(FRONT_Z - denki.d);
    expect(aoiSpawn.x).toBeGreaterThan(counter.x0);
    expect(aoiSpawn.x).toBeLessThan(counter.x1);
  });

  it('uses no legacy shared random draws, and builds the same shop every time', () => {
    const a = createBuildCtx();
    const b = createBuildCtx();
    const before = a.ctx.R();
    buildDenki(b.ctx, denki);
    expect(b.ctx.R()).toBe(before); // the shared stream was untouched
    buildDenki(a.ctx, denki);
    const mesh = (c: ReturnType<typeof build>['ctx']) => c.solid.count + c.glow.count;
    expect(mesh(a.ctx)).toBe(mesh(b.ctx));
    expect(a.ctx.solid.count).toBeGreaterThan(100);
    expect(a.ctx.solid.count + a.ctx.glow.count).toBeLessThan(450); // the triangle budget: about 12 triangles per box, so a few thousand for the shop
  });

  it('adds one small draw call to the street: only the sign is its own mesh (the shutter is hidden)', () => {
    const { ctx, out } = build();
    const visible: THREE.Object3D[] = [];
    ctx.group.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) visible.push(o); });
    expect(visible).toHaveLength(1);
    expect(out.animators).toHaveLength(0); // nothing to run per frame
  });
});

describe('Hikari Denki in the real city and world', () => {
  it('buildCity builds it, with its collider, pick, minimap rect and shutter', () => {
    const city = buildCity();
    expect(city.built.has('denki')).toBe(true);
    expect(city.pickables.some((p) => p.id === 'denki')).toBe(true);
    expect(city.colliders.some((c) => within(shopRect(denki), c) && within(c, shopRect(denki)))).toBe(true);
    expect(city.mapRects.some((m) => m.label === 'denki')).toBe(true);
  });

  const aoi = { id: 'aoi', name: 'Aoi' } as never;
  type Npcs = { npcs: Array<{ id: string; avatar: { root: THREE.Object3D } }> };
  const make = (characters: unknown[]) => new TokyoWorld({ canvas: fakeCanvas(), characters: characters as never, quality: 'high' });

  it('spawns Aoi behind the counter once the character is registered, and not before', async () => {
    const { CHARACTERS } = await import('@lw/content');
    const without = make(CHARACTERS.filter((c) => c.id !== 'aoi'));
    expect(without.snapshot().npcs.map((n) => n.id)).not.toContain('aoi');
    without.dispose();
    const base = CHARACTERS.find((c) => c.id === 'aoi') ?? { ...CHARACTERS[0], id: 'aoi' };
    const world = make([...CHARACTERS.filter((c) => c.id !== 'aoi'), base]);
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('aoi');
    const n = (world as unknown as Npcs).npcs.find((x) => x.id === 'aoi')!;
    expect(n.avatar.root.position.x).toBeCloseTo(aoiSpawn.x, 3);
    expect(n.avatar.root.position.z).toBeCloseTo(aoiSpawn.z, 3);
    expect(n.avatar.root.position.y).toBeCloseTo(aoiSpawn.y!, 3);
    world.dispose();
    void aoi;
  });

  it('the shutter hides Aoi and shows the denki 準備中 plate, and opening restores her', async () => {
    const { CHARACTERS } = await import('@lw/content');
    const base = CHARACTERS.find((c) => c.id === 'aoi') ?? { ...CHARACTERS[0], id: 'aoi' };
    const world = make([...CHARACTERS.filter((c) => c.id !== 'aoi'), base]);
    world.setShopOpen('denki', false);
    expect(world.snapshot().npcs.map((n) => n.id)).not.toContain('aoi');
    const city = (world as unknown as { city: { group: THREE.Group } }).city;
    const shutters: THREE.Object3D[] = [];
    city.group.traverse((o) => { if (o.name === 'denki-shutter' && o.parent) shutters.push(o.parent); });
    expect(shutters.some((g) => g.visible && Math.abs(new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()).x - denki.cx) < 0.5)).toBe(true);
    world.setShopOpen('denki', true);
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('aoi');
    world.dispose();
  });
});
