// Fuku-Fuku: the building registers what the world needs (collider, picks, minimap, shutter, built site), stays
// inside its footprint and the walkable bounds, keeps its street props a player can pass, and Rin appears behind the
// counter once the character is registered.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { createBuildCtx } from '../src/buildctx';
import { buildFukufuku } from '../src/buildings/fukufuku';
import { buildCity } from '../src/city';
import { BOUNDS, FRONT_Z, NPC_SPAWNS, SHOPS, SHOP_COUNTERS, layoutColliders, shopRect, type Rect } from '../src/layout';
import { TokyoWorld } from '../src/world';

beforeAll(installFakeDom);

/** the player is 0.84 m wide: any gap between two obstacles must be at least this, or be fully closed */
const PLAYER_W = 0.84;
/** the render budget of the building (the whole Release 2 wave A district adds <= 6k triangles for two buildings) */
const MAX_TRIANGLES = 5000;
const MAX_NEW_DRAW_CALLS = 4;

const fuku = SHOPS.find((s) => s.id === 'fukufuku')!;
const rinSpawn = NPC_SPAWNS.find((s) => s.id === 'rin')!;
const build = () => {
  const { ctx, out } = createBuildCtx();
  buildFukufuku(ctx, fuku);
  return { ctx, out };
};
const within = (inner: Rect, outer: Rect) => inner.x0 >= outer.x0 - 1e-9 && inner.x1 <= outer.x1 + 1e-9 && inner.z0 >= outer.z0 - 1e-9 && inner.z1 <= outer.z1 + 1e-9;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
const isShopBox = (c: Rect) => within(c, shopRect(fuku)) && within(shopRect(fuku), c);
const triangles = (ctx: ReturnType<typeof build>['ctx']) => {
  let n = 0;
  for (const b of [ctx.solid, ctx.glow]) {
    const m = b.build(ctx.toon);
    if (m) n += m.geometry.getAttribute('position').count / 3;
  }
  return n;
};

describe('buildFukufuku', () => {
  it('marks its site built, with the diorama collider, an occluder and its opening', () => {
    const { out } = build();
    expect(out.built.has('fukufuku')).toBe(true);
    expect(out.colliders.some(isShopBox)).toBe(true);
    expect(out.occluders).toHaveLength(1);
    expect(out.openings.get('fukufuku')).toMatchObject({ cx: fuku.cx, w: fuku.w });
  });

  it('registers the hanging sign pick and a minimap rect over the footprint', () => {
    const { out } = build();
    const sign = out.pickables.find((p) => p.id === 'fukufuku')!;
    expect(sign).toBeDefined();
    expect(sign.pos.x).toBeCloseTo(fuku.cx, 6);
    expect(out.mapRects).toHaveLength(1);
    expect(out.mapRects[0]).toMatchObject({ label: 'fukufuku', ...shopRect(fuku) });
  });

  it('registers a hidden custom 準備中 shutter covering the opening, in front of the diorama', () => {
    const { ctx, out } = build();
    const shutter = out.shutters.get('fukufuku');
    expect(shutter).toBeDefined();
    expect(shutter!.visible).toBe(false);
    expect(shutter!.parent).toBe(ctx.group);
    const box = new THREE.Box3().setFromObject(shutter!);
    const op = out.openings.get('fukufuku')!;
    expect(box.min.x).toBeLessThanOrEqual(op.cx - op.w / 2 + 0.7);
    expect(box.max.x).toBeGreaterThanOrEqual(op.cx + op.w / 2 - 0.7);
    expect(box.max.y).toBeLessThanOrEqual(op.openH);
    expect(box.min.z).toBeGreaterThanOrEqual(FRONT_Z - 0.01);
    let meshes = 0;
    shutter!.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
    expect(meshes).toBe(2); // slab + 準備中 plate
  });

  it('keeps every extra collider on the sidewalk in front of the shop, in bounds and clear of the other street colliders', () => {
    const { out } = build();
    const shop = shopRect(fuku);
    const extra = out.colliders.filter((c) => !isShopBox(c));
    expect(extra.length).toBeGreaterThanOrEqual(2); // the sandwich board and the sale rack
    const others = layoutColliders().filter((c) => !c.id.startsWith('shop:fukufuku'));
    for (const c of extra) {
      expect(c.x0).toBeGreaterThanOrEqual(shop.x0);
      expect(c.x1).toBeLessThanOrEqual(shop.x1);
      expect(c.z0).toBeGreaterThanOrEqual(FRONT_Z); // in front of the shop, never inside it
      expect(c.z1).toBeLessThan(-5); // leaves the walking lane free
      for (const o of others) expect(overlap(c, o.rect), o.id).toBe(false);
    }
  });

  it('leaves no gap narrower than the player (0.84 m) between a prop and the wall, the map edge or another prop', () => {
    const { out } = build();
    const shop = shopRect(fuku);
    const extra = out.colliders.filter((c) => !isShopBox(c));
    const gaps = (g: number, what: string) => expect(g <= 0 || g >= PLAYER_W, `${what}: gap ${g}`).toBe(true);
    for (const c of extra) {
      gaps(c.z0 - shop.z1, 'wall');
      gaps(c.x0 - BOUNDS.x0, 'west edge');
      gaps(BOUNDS.x1 - c.x1, 'east edge');
      gaps(BOUNDS.z0 - c.z0, 'sidewalk edge');
      for (const o of layoutColliders()) {
        if (o.id.startsWith('shop:fukufuku') || overlap(c, o.rect)) continue;
        const dx = Math.max(o.rect.x0 - c.x1, c.x0 - o.rect.x1);
        const dz = Math.max(o.rect.z0 - c.z1, c.z0 - o.rect.z1);
        if (dx <= 0 || dz <= 0) gaps(Math.max(dx, dz), o.id); // side by side or one behind the other: a slot, not a corner
      }
      for (const d of extra) {
        if (d === c) continue;
        gaps(Math.max(d.x0 - c.x1, c.x0 - d.x1), 'between props');
      }
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
    const r = shopRect(fuku);
    expect(box.min.x).toBeGreaterThanOrEqual(r.x0 - 1);
    expect(box.max.x).toBeLessThanOrEqual(r.x1 + 1);
    expect(box.max.z).toBeLessThanOrEqual(FRONT_Z + 1.9);
    expect(box.min.z).toBeGreaterThanOrEqual(FRONT_Z - fuku.d - 0.6);
    expect(box.max.y).toBeLessThanOrEqual(fuku.h + 2.6);
    expect(box.min.x).toBeGreaterThanOrEqual(BOUNDS.x0 - 1); // the west edge of the walkable street
  });

  it('puts the counter where the layout expects it, with the staff floor behind it', () => {
    const counter = SHOP_COUNTERS.fukufuku!;
    expect(counter.z0).toBeGreaterThan(rinSpawn.z); // Rin stands behind (further from the street than) the counter
    expect(rinSpawn.z).toBeGreaterThan(FRONT_Z - fuku.d);
    expect(rinSpawn.x).toBeGreaterThan(counter.x0);
    expect(rinSpawn.x).toBeLessThan(counter.x1);
  });

  it('fills the shop with racks of garments, a fitting room and a mirror: enough geometry to read as a clothes shop', () => {
    const { ctx } = build();
    expect(ctx.solid.count).toBeGreaterThan(300);
    expect(ctx.glow.count).toBeGreaterThan(15); // lit strips, mirror, lamps
  });

  it('uses no legacy shared random draws, and builds the same shop every time', () => {
    const a = createBuildCtx();
    const b = createBuildCtx();
    const before = a.ctx.R();
    buildFukufuku(b.ctx, fuku);
    expect(b.ctx.R()).toBe(before); // the shared stream was untouched
    buildFukufuku(a.ctx, fuku);
    expect(a.ctx.solid.count + a.ctx.glow.count).toBe(b.ctx.solid.count + b.ctx.glow.count);
    expect(a.ctx.solid.count + a.ctx.glow.count).toBeGreaterThan(300);
  });

  it(`stays inside the render budget: <= ${MAX_TRIANGLES} triangles and <= ${MAX_NEW_DRAW_CALLS} new draw calls (merged batches are shared; only the signs are their own meshes)`, () => {
    const { ctx, out } = build();
    expect(triangles(ctx)).toBeLessThanOrEqual(MAX_TRIANGLES);
    const visible: THREE.Object3D[] = [];
    ctx.group.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) visible.push(o); });
    expect(visible.length).toBeLessThanOrEqual(MAX_NEW_DRAW_CALLS); // hanging sign, 古着 plate, sale board (the shutter is hidden)
    expect(out.animators).toHaveLength(0); // nothing to run per frame
  });
});

describe('Fuku-Fuku in the real city and world', () => {
  it('buildCity builds it, with its collider, pick, minimap rect and shutter', () => {
    const city = buildCity();
    expect(city.built.has('fukufuku')).toBe(true);
    expect(city.pickables.some((p) => p.id === 'fukufuku')).toBe(true);
    expect(city.colliders.some(isShopBox)).toBe(true);
    expect(city.mapRects.some((m) => m.label === 'fukufuku')).toBe(true);
  });

  type Npcs = { npcs: Array<{ id: string; avatar: { root: THREE.Object3D } }> };
  const make = (characters: unknown[]) => new TokyoWorld({ canvas: fakeCanvas(), characters: characters as never, quality: 'high' });
  const withRin = async () => {
    const { CHARACTERS } = await import('@lw/content');
    const base = CHARACTERS.find((c) => c.id === 'rin') ?? { ...CHARACTERS[0], id: 'rin' };
    return [...CHARACTERS.filter((c) => c.id !== 'rin'), base];
  };

  it('spawns Rin behind the counter once the character is registered, and not before', async () => {
    const { CHARACTERS } = await import('@lw/content');
    const without = make(CHARACTERS.filter((c) => c.id !== 'rin'));
    expect(without.snapshot().npcs.map((n) => n.id)).not.toContain('rin');
    without.dispose();
    const world = make(await withRin());
    expect(world.snapshot().npcs.map((n) => n.id).filter((id) => id === 'rin')).toHaveLength(1); // once
    const n = (world as unknown as Npcs).npcs.find((x) => x.id === 'rin')!;
    expect(n.avatar.root.position.x).toBeCloseTo(rinSpawn.x, 3);
    expect(n.avatar.root.position.z).toBeCloseTo(rinSpawn.z, 3);
    expect(n.avatar.root.position.y).toBeCloseTo(rinSpawn.y!, 3);
    world.dispose();
  });

  it('keeps Rin inside the shop footprint and behind the counter', async () => {
    const world = make(await withRin());
    const n = (world as unknown as Npcs).npcs.find((x) => x.id === 'rin')!;
    const p = n.avatar.root.position;
    const r = shopRect(fuku);
    expect(p.x).toBeGreaterThan(r.x0);
    expect(p.x).toBeLessThan(r.x1);
    expect(p.z).toBeLessThan(SHOP_COUNTERS.fukufuku!.z0);
    expect(p.z).toBeGreaterThan(r.z0);
    world.dispose();
  });

  it('the shutter hides Rin and shows the fukufuku 準備中 plate, and opening restores her', async () => {
    const world = make(await withRin());
    world.setShopOpen('fukufuku', false);
    expect(world.snapshot().npcs.map((n) => n.id)).not.toContain('rin');
    const city = (world as unknown as { city: { group: THREE.Group } }).city;
    const shutters: THREE.Object3D[] = [];
    city.group.traverse((o) => { if (o.name === 'fukufuku-shutter' && o.parent) shutters.push(o.parent); });
    expect(shutters.some((g) => g.visible && Math.abs(new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()).x - fuku.cx) < 0.5)).toBe(true);
    world.setShopOpen('fukufuku', true);
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('rin');
    world.dispose();
  });
});
