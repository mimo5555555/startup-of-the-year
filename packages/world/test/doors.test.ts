// The door facades of the homes: door:mio, door:kenji, door:aiko (wave B1), door:dorm and door:flat (wave B2, the player's own
// rooms). They are merged into the city's batches (the only meshes of their own are the five door plates), keep the layout's
// colliders, and the player comes out on walkable ground in front of each.
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { createBuildCtx } from '../src/buildctx';
import { buildDoors } from '../src/buildings/doors';
import { buildCity } from '../src/city';
import { BOUNDS, DOORS, DOOR_RETURN, PLAYER_RADIUS, layoutColliders, type Rect } from '../src/layout';
import { TokyoWorld } from '../src/world';
import { CHARACTERS } from '@lw/content';

installFakeDom(); // at collection time: the DOOR_RETURN block builds a city while the file is read

/** the door facades together: one draw call each (five plates) and 3k triangles; the plates are the only meshes of their own */
const MAX_DOOR_CALLS = 5;
const MAX_DOOR_TRIANGLES = 3000;
const ALL_DOORS = ['door:aiko', 'door:dorm', 'door:flat', 'door:kenji', 'door:mio'];
const hits = (r: Rect, x: number, z: number, radius: number) => {
  const dx = x - Math.min(Math.max(x, r.x0), r.x1);
  const dz = z - Math.min(Math.max(z, r.z0), r.z1);
  return dx * dx + dz * dz < radius * radius - 1e-9;
};
const run = () => {
  const { ctx, out } = createBuildCtx();
  buildDoors(ctx, DOORS);
  return { ctx, out };
};
const plates = (group: THREE.Group) => group.children.filter((o) => o.name.startsWith('door:')) as THREE.Mesh[];

describe('buildDoors', () => {
  it('builds the friends\' doors, the dorm and the flat', () => {
    const { ctx, out } = run();
    const ids = new Set(out.pickables.map((p) => p.id));
    expect([...ids].sort()).toEqual(ALL_DOORS);
    expect(plates(ctx.group).map((m) => m.name).sort()).toEqual(ALL_DOORS);
    expect(out.colliders.some((c) => c.x0 === -5.8 && c.x1 === -2.2)).toBe(true); // the dorm box (cx -4, w 3.6)
  });

  it('keeps the layout picks (the exact points the design names) and adds the balcony door as a second pick of door:aiko and door:flat', () => {
    const { out } = run();
    for (const d of DOORS) {
      const p = out.pickables.find((q) => q.id === d.id)!;
      expect(p.pos.toArray(), d.id).toEqual([d.pick.x, d.pick.y, d.pick.z]);
      expect(p.radius).toBe(d.radius);
    }
    for (const id of ['door:aiko', 'door:flat']) {
      const balcony = out.pickables.filter((p) => p.id === id);
      expect(balcony, id).toHaveLength(2);
      expect(balcony.some((p) => p.pos.y > 3), id).toBe(true); // the visible door is on the balcony above the awning
    }
    // the two balconies are at the two ends of the sign, 6 m apart
    const flat = out.pickables.find((p) => p.id === 'door:flat' && p.pos.y > 3)!;
    const aiko = out.pickables.find((p) => p.id === 'door:aiko' && p.pos.y > 3)!;
    expect(aiko.pos.x - flat.pos.x).toBeGreaterThan(5.5);
  });

  it('is a collider and a camera occluder of the facade box, the layout\'s own rect and height (door:aiko and door:flat have no box)', () => {
    const { out } = run();
    for (const d of DOORS.filter((x) => x.body)) {
      expect(out.colliders, d.id).toContainEqual(d.body!.rect);
      expect(out.occluders.find((o) => o.x0 === d.body!.rect.x0 && o.x1 === d.body!.rect.x1 && o.z0 === d.body!.rect.z0), d.id).toMatchObject({ y1: d.body!.h });
    }
    expect(out.colliders).toHaveLength(3);
  });

  it(`costs at most ${MAX_DOOR_CALLS} draw calls and ${MAX_DOOR_TRIANGLES} triangles in all`, () => {
    const { ctx } = run();
    expect(plates(ctx.group)).toHaveLength(MAX_DOOR_CALLS);
    let tris = 0;
    for (const m of plates(ctx.group)) tris += m.geometry.getAttribute('position').count / 3;
    for (const b of [ctx.solid, ctx.glow]) {
      const mesh = b.build(ctx.toon);
      if (mesh) tris += mesh.geometry.getAttribute('position').count / 3;
    }
    expect(tris).toBeGreaterThan(300); // they are real facades, not a sign
    expect(tris).toBeLessThanOrEqual(MAX_DOOR_TRIANGLES);
    // and in the city they add exactly the five plates to the group (the batches are the city's own)
    expect(plates(buildCity().group)).toHaveLength(MAX_DOOR_CALLS);
  });

  it('keeps every facade inside its gap: nothing is drawn beyond the box by more than a trim\'s width', () => {
    const { ctx } = run();
    const mesh = ctx.solid.build(ctx.toon)!;
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    // the facades span x -5.8..-2.2 (dorm), 10.2..13.8 (mio), 25.9..29.5 (kenji), 31.8..32.6 (flat), 38..38.8 (aiko)
    expect(bb.min.x).toBeGreaterThanOrEqual(-5.8 - 0.3);
    expect(bb.max.x).toBeLessThanOrEqual(39.2);
    expect(bb.min.z).toBeGreaterThanOrEqual(-13.2);
    expect(bb.max.z).toBeLessThanOrEqual(10);
    expect(bb.max.y).toBeLessThanOrEqual(6.8);
  });
});

describe('the plate: sign and door leaf in one plane', () => {
  it('starts closed (the default) and swaps its texture when opened, back again when closed', () => {
    const { ctx } = run();
    for (const m of plates(ctx.group)) {
      const mat = m.material as THREE.MeshBasicMaterial;
      const setOpen = m.userData.setOpen as (o: boolean) => void;
      expect(m.userData.doorId).toBe(m.name);
      expect(typeof setOpen).toBe('function');
      const closed = mat.map;
      expect(closed).toBeTruthy();
      setOpen(true);
      const open = mat.map;
      expect(open).toBeTruthy();
      expect(open).not.toBe(closed);
      setOpen(false);
      expect(mat.map).toBe(closed);
      setOpen(true);
      expect(mat.map).toBe(open); // drawn once, not on every toggle
      expect(mat.transparent).toBe(true);
      expect(mat.alphaTest).toBeGreaterThan(0); // the open leaf is cut out, so the plate needs no sorting
    }
  });

  it('faces the street: mio, aiko and the flat look north (-z), kenji and the dorm south (+z)', () => {
    const { ctx } = run();
    const by = Object.fromEntries(plates(ctx.group).map((m) => [m.name, m]));
    expect(by['door:mio'].rotation.y).toBeCloseTo(Math.PI, 6);
    expect(by['door:aiko'].rotation.y).toBeCloseTo(Math.PI, 6);
    expect(by['door:flat'].rotation.y).toBeCloseTo(Math.PI, 6);
    expect(by['door:kenji'].rotation.y).toBe(0);
    expect(by['door:dorm'].rotation.y).toBe(0);
  });
});

describe('DOOR_RETURN: where the player comes out', () => {
  const city = buildCity();
  const solids: Rect[] = [...city.colliders, ...layoutColliders().map((c) => c.rect)];

  it('has a spot for every door, the dorm and the flat included', () => {
    expect(Object.keys(DOOR_RETURN).sort()).toEqual(ALL_DOORS);
  });

  it.each(['door:mio', 'door:kenji', 'door:aiko', 'door:dorm', 'door:flat'] as const)('%s: in the bounds, clear of every collider with the player\'s radius, within a couple of metres of the door', (id) => {
    const r = DOOR_RETURN[id]!;
    const d = DOORS.find((x) => x.id === id)!;
    expect(r.x).toBeGreaterThanOrEqual(BOUNDS.x0);
    expect(r.x).toBeLessThanOrEqual(BOUNDS.x1);
    expect(r.z).toBeGreaterThanOrEqual(BOUNDS.z0);
    expect(r.z).toBeLessThanOrEqual(BOUNDS.z1);
    for (const c of solids) expect(hits(c, r.x, r.z, PLAYER_RADIUS), `${id} stands in a collider`).toBe(false);
    expect(Math.hypot(r.x - d.pick.x, r.z - d.pick.z)).toBeLessThanOrEqual(2.6);
  });
});

describe('world.setDoorOpen', () => {
  const make = () => {
    const world = new TokyoWorld({ canvas: fakeCanvas(), characters: CHARACTERS, quality: 'high' });
    return { world, w: world as unknown as { step(dt: number): void; sparkles: Array<{ id: string; sprite: THREE.Sprite }>; playerPos: THREE.Vector3; doorSigns: Map<string, THREE.Mesh> } };
  };

  it('starts closed, toggles with or without the door: prefix, ignores nothing it was told, and swaps the plate', () => {
    const { world, w } = make();
    for (const who of ['mio', 'kenji', 'aiko', 'flat']) expect(world.isDoorOpen(who)).toBe(false);
    expect(world.isDoorOpen('dorm')).toBe(true); // your own dorm is never locked
    expect([...w.doorSigns.keys()].sort()).toEqual(ALL_DOORS);
    const map = (id: string) => (w.doorSigns.get(id)!.material as THREE.MeshBasicMaterial).map;
    const closed = map('door:mio');
    world.setDoorOpen('mio', true);
    expect(world.isDoorOpen('mio')).toBe(true);
    expect(world.isDoorOpen('door:mio')).toBe(true);
    expect(world.isDoorOpen('kenji')).toBe(false);
    expect(map('door:mio')).not.toBe(closed);
    world.setDoorOpen('door:mio', false);
    expect(world.isDoorOpen('mio')).toBe(false);
    expect(map('door:mio')).toBe(closed);
    world.dispose();
  });

  it('a closed door has no sparkle; an open one does (the pick itself is always there, for 「まだ入れません」)', () => {
    const { world, w } = make();
    const stand = DOORS.find((d) => d.id === 'door:mio')!.pick;
    w.playerPos.set(stand.x, 0, stand.z - 1.5);
    const sparkle = () => w.sparkles.find((s) => s.id === 'door:mio')!.sprite.visible;
    w.step(1 / 60);
    expect(sparkle()).toBe(false);
    world.setDoorOpen('mio', true);
    w.step(1 / 60);
    expect(sparkle()).toBe(true);
    world.setDoorOpen('mio', false);
    w.step(1 / 60);
    expect(sparkle()).toBe(false);
    // closed or open, a tap on the door is still a pick event the app can answer
    const ids: string[] = [];
    world.on((e) => e.type === 'pick' && ids.push(e.id));
    world.simulatePick('door:mio');
    expect(ids).toEqual(['door:mio']);
    world.dispose();
  });
});
