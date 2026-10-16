// Wave B2, the player's own rooms: the dorm (4.0 x 3.6, four slots) and the Ono-so flat (3.6 x 4.5, eight slots). Their shape and
// budget, the furniture (one model per catalog item, drawn into the slots from `StageBuildCtx.placed`, rebuilt live without a leak),
// the slot picks and markers, the colliders the furniture adds, the guest's spot, and the same reachability the friend homes
// have, with every slot filled. Then the engine side: `enterStage(id, { placed, guest })`, `setStagePlaced`, the way out.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { DOOR_RETURN } from '../src/layout';
import { PLAYER_R, STEP } from '../src/stages/room';
import { FURNITURE_IDS, FURNITURE_SLOT, furnitureColliders, parseSlotPick, slotPickId, slotSize } from '../src/stages/furniture';
import { DORM, DORM_SLOTS } from '../src/stages/dorm';
import { ONO_FLAT, ONO_SLOTS } from '../src/stages/ono_flat';
import { OWN_STAGES, STAGES, STAGE_EXIT_PICK } from '../src/stages';
import type { Rect } from '../src/layout';
import type { Stage, StageHandle, StageSlot } from '../src/stage';
import { TokyoWorld } from '../src/world';

beforeAll(installFakeDom);

const toon = new THREE.MeshToonMaterial({ vertexColors: true });
const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
const ctxOf = (placed: Record<string, string> = {}) => ({ toon, glow, placed, playerShoes: '#f5f5f5' });
const OWN = [DORM, ONO_FLAT] as const;
const SLOTS: Record<string, readonly StageSlot[]> = { dorm: DORM_SLOTS, ono_flat: ONO_SLOTS };
const filled = (id: string): Record<string, string> => {
  const bySlot = Object.fromEntries(Object.entries(FURNITURE_SLOT).map(([item, slot]) => [slot, item]));
  return Object.fromEntries(SLOTS[id].map((s) => [s.name, bySlot[s.name]]));
};
const meshes = (h: StageHandle) => {
  const out: THREE.Mesh[] = [];
  h.group.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o as THREE.Mesh));
  return out;
};
const tris = (m: THREE.Mesh) => m.geometry.getAttribute('position').count / 3;
const furnitureMeshes = (h: StageHandle) => meshes(h).filter((m) => m.name.startsWith('stage-furniture'));
const furnitureTris = (h: StageHandle) => furnitureMeshes(h).reduce((n, m) => n + tris(m), 0);

const hits = (r: Rect, x: number, z: number, radius: number) => {
  const dx = x - Math.min(Math.max(x, r.x0), r.x1);
  const dz = z - Math.min(Math.max(z, r.z0), r.z1);
  return dx * dx + dz * dz < radius * radius - 1e-9;
};
/** is the player's circle free at (x, z): inside the bounds, clear of the stage's colliders, the furniture and (shut) the gate */
const free = (s: Stage, placed: Record<string, string>, x: number, z: number, gateShut: boolean) => {
  const b = s.bounds;
  if (x < b.x0 - 1e-9 || x > b.x1 + 1e-9 || z < b.z0 - 1e-9 || z > b.z1 + 1e-9) return false;
  const rects = [...s.colliders, ...furnitureColliders(s.slots!, placed), ...(gateShut ? [s.gate] : [])];
  return rects.every((r) => !hits(r, x, z, PLAYER_R));
};
const reachable = (s: Stage, placed: Record<string, string>, a: { x: number; z: number }, to: (x: number, z: number) => boolean, gateShut: boolean) => {
  const h = 0.05;
  const key = (i: number, j: number) => i * 4096 + j;
  const seen = new Set([key(Math.round(a.x / h), Math.round(a.z / h))]);
  const queue: Array<[number, number]> = [[Math.round(a.x / h), Math.round(a.z / h)]];
  while (queue.length) {
    const [i, j] = queue.pop()!;
    if (to(i * h, j * h)) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const k = key(i + di, j + dj);
      if (seen.has(k) || !free(s, placed, (i + di) * h, (j + dj) * h, gateShut)) continue;
      seen.add(k);
      queue.push([i + di, j + dj]);
    }
  }
  return false;
};
const inExit = (s: Stage, x: number, z: number) => x >= s.exit.x0 && x <= s.exit.x1 && z >= s.exit.z0 && z <= s.exit.z1;
const near = (p: { x: number; z: number }, q: { x: number; z: number }, d: number) => Math.hypot(p.x - q.x, p.z - q.z) <= d;

describe('the player\'s own rooms: shape', () => {
  it('are registered and are the design\'s rooms: no host, the dorm 4.0 x 3.6 with four slots, the flat 3.6 x 4.5 with eight', () => {
    expect(OWN_STAGES).toEqual(['dorm', 'ono_flat']);
    expect(STAGES.dorm).toBe(DORM);
    expect(STAGES.ono_flat).toBe(ONO_FLAT);
    expect(DORM.actors).toEqual([]);
    expect(ONO_FLAT.actors).toEqual([]);
    expect(DORM.bounds.x1 - DORM.bounds.x0).toBeCloseTo(4.0 - 0.6, 6);
    expect(DORM.bounds.z1 - DORM.bounds.z0).toBeCloseTo(3.6 - 0.5, 6);
    expect(ONO_FLAT.bounds.x1 - ONO_FLAT.bounds.x0).toBeCloseTo(3.6 - 0.6, 6);
    expect(ONO_FLAT.bounds.z1 - ONO_FLAT.bounds.z0).toBeCloseTo(4.5 - 0.5, 6);
    expect(DORM_SLOTS.map((s) => s.name).sort()).toEqual(['bed', 'desk', 'plant', 'shelf']);
    expect(ONO_SLOTS.map((s) => s.name).sort()).toEqual(['bed', 'desk', 'kitchen', 'light', 'plant', 'shelf', 'table', 'tv']);
    expect(DORM.returnDoor).toBe('door:dorm');
    expect(ONO_FLAT.returnDoor).toBe('door:flat');
    for (const s of OWN) {
      expect(s.floor.step).toBe(STEP);
      expect(STEP).toBe(0.15);
      expect(s.camera.minDist).toBeLessThan(s.camera.dist);
      expect(s.camera.maxDist).toBeGreaterThan(s.camera.dist);
    }
  });

  it('the eight catalog items go to the eight slots the game names (HOME_SLOTS) and each room offers exactly its own', () => {
    expect(Object.keys(FURNITURE_SLOT).sort()).toEqual(['bookshelf', 'desk_study', 'futon_set', 'kotatsu', 'paper_lamp', 'plant_pothos', 'rice_cooker', 'tv_small']);
    expect(FURNITURE_IDS).toHaveLength(8);
    expect([...new Set(Object.values(FURNITURE_SLOT))].sort()).toEqual(ONO_SLOTS.map((s) => s.name).sort());
    expect(DORM_SLOTS.every((s) => Object.values(FURNITURE_SLOT).includes(s.name))).toBe(true);
  });

  it('slot pick ids round-trip', () => {
    expect(slotPickId('bed')).toBe('slot:bed');
    expect(parseSlotPick('slot:kitchen')).toBe('kitchen');
    expect(parseSlotPick('prop:mio_1r:kamera')).toBeNull();
    expect(parseSlotPick('door:flat')).toBeNull();
  });
});

describe.each(OWN)('$id: what is built', (stage) => {
  const id = stage.id;

  it('with every slot filled it is a handful of draw calls (merged vertex-colour geometry), far under the 12 of the design, and the furniture is two of them', () => {
    const h = stage.build(ctxOf(filled(id)));
    const ms = meshes(h);
    for (const m of ms) {
      expect(m.geometry.getAttribute('color'), `${m.name} vertex colours`).toBeDefined();
      expect(Array.isArray(m.material)).toBe(false);
    }
    expect(ms.length).toBeLessThanOrEqual(8);
    expect(furnitureMeshes(h)).toHaveLength(2);
    expect(ms.reduce((n, m) => n + tris(m), 0)).toBeLessThanOrEqual(8000);
    // with the placement view on there is one more (the markers) and still nowhere near the budget
    h.setState!({ shoesOff: true, slippersOn: true, showSlots: true });
    expect(meshes(h).filter((m) => m.visible).length).toBeLessThanOrEqual(8);
    expect(meshes(h).length).toBeLessThanOrEqual(12);
    h.dispose();
  });

  it('is lit by one hemisphere light and one warm point light, and nothing else (the furniture adds no light)', () => {
    const h = stage.build(ctxOf(filled(id)));
    const lights: THREE.Light[] = [];
    h.group.traverse((o) => (o as THREE.Light).isLight && lights.push(o as THREE.Light));
    expect(lights).toHaveLength(2);
    h.dispose();
  });

  it('keeps the exit, the two genkan picks and one slot pick per slot, and no prop picks', () => {
    const h = stage.build(ctxOf());
    const ids = h.pickables.map((p) => p.id);
    expect(ids).toContain(STAGE_EXIT_PICK);
    expect(ids).toContain('genkan:shoes');
    expect(ids).toContain('genkan:slippers');
    expect(ids.filter((i) => i.startsWith('prop:'))).toEqual([]);
    expect(ids.filter((i) => i.startsWith('slot:')).sort()).toEqual(SLOTS[id].map((s) => slotPickId(s.name)).sort());
    expect(new Set(ids).size).toBe(ids.length);
    h.dispose();
  });
});

describe('the furniture', () => {
  it('an empty slot shows nothing: the flat with nothing placed has no furniture mesh at all', () => {
    const h = ONO_FLAT.build(ctxOf());
    expect(furnitureMeshes(h)).toEqual([]);
    expect(h.colliders).toEqual([]);
    h.dispose();
  });

  it('the dorm\'s own cot and desk stand there while their slots are empty (and block the floor), the shelf has a plank and the plant slot is bare', () => {
    const h = DORM.build(ctxOf());
    expect(furnitureMeshes(h).length).toBeGreaterThanOrEqual(1);
    expect(h.colliders!.length).toBe(2);
    const names = DORM_SLOTS.filter((s) => s.basic).map((s) => s.name).sort();
    expect(names).toEqual(['bed', 'desk']);
    h.dispose();
  });

  it.each(Object.entries(FURNITURE_SLOT))('%s is drawn in the %s slot: more triangles than the empty slot, inside the footprint (a chair or a cushion may poke out a hand) and under the ceiling', (item, slot) => {
    const stage = ONO_FLAT;
    const s = ONO_SLOTS.find((x) => x.name === slot)!;
    const h0 = stage.build(ctxOf());
    const h1 = stage.build(ctxOf({ [slot]: item }));
    expect(furnitureTris(h1)).toBeGreaterThan(furnitureTris(h0));
    expect(furnitureTris(h1)).toBeLessThan(1600); // one piece is a small share of the 8000 triangles
    const box = new THREE.Box3();
    for (const m of furnitureMeshes(h1)) {
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!);
    }
    const slack = 0.25;
    expect(box.min.x).toBeGreaterThanOrEqual(s.rect.x0 - slack);
    expect(box.max.x).toBeLessThanOrEqual(s.rect.x1 + slack);
    expect(box.min.z).toBeGreaterThanOrEqual(s.rect.z0 - slack);
    expect(box.max.z).toBeLessThanOrEqual(s.rect.z1 + slack);
    expect(box.min.y).toBeGreaterThanOrEqual(s.y0 - 1e-6);
    expect(box.max.y).toBeLessThanOrEqual(1.95);
    expect(box.max.y - box.min.y).toBeGreaterThan(0.15);
    expect(h1.colliders).toEqual([s.rect]);
    h0.dispose();
    h1.dispose();
  });

  it('every model is deterministic: two builds of the same room are the same geometry', () => {
    const a = ONO_FLAT.build(ctxOf(filled('ono_flat')));
    const b = ONO_FLAT.build(ctxOf(filled('ono_flat')));
    expect(furnitureTris(a)).toBe(furnitureTris(b));
    const pa = furnitureMeshes(a)[0].geometry.getAttribute('position').array;
    const pb = furnitureMeshes(b)[0].geometry.getAttribute('position').array;
    expect(Array.from(pa)).toEqual(Array.from(pb));
    a.dispose();
    b.dispose();
  });

  it('an item the stage has no model for is a cardboard box, never an invisible piece', () => {
    const h = ONO_FLAT.build(ctxOf({ table: 'mystery_item' }));
    expect(furnitureTris(h)).toBeGreaterThan(0);
    expect(h.colliders).toHaveLength(1);
    h.dispose();
  });

  it('the dorm draws the same eight models in its own four slots (the dorm\'s pieces give way to them)', () => {
    const h0 = DORM.build(ctxOf());
    const h1 = DORM.build(ctxOf(filled('dorm')));
    expect(furnitureTris(h1)).toBeGreaterThan(furnitureTris(h0));
    expect(h1.colliders).toHaveLength(4);
    h0.dispose();
    h1.dispose();
  });
});

describe('setPlaced: the furniture is rebuilt live, only the furniture', () => {
  it.each(OWN)('$id: 20 rebuilds leave the room alone, keep the mesh count, dispose what they replace and free everything at the end', (stage) => {
    const id = stage.id;
    const h = stage.build(ctxOf());
    const room = meshes(h).filter((m) => !m.name.startsWith('stage-furniture'));
    const roomGeos = room.map((m) => m.geometry);
    const disposed = new Set<THREE.BufferGeometry>();
    const seen = new Set<THREE.BufferGeometry>();
    const spy = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose').mockImplementation(function (this: THREE.BufferGeometry) {
      disposed.add(this);
    });
    try {
      for (let i = 0; i < 20; i++) {
        for (const m of furnitureMeshes(h)) seen.add(m.geometry);
        h.setPlaced!(i % 2 ? filled(id) : {});
        const fm = furnitureMeshes(h);
        expect(fm.length).toBeLessThanOrEqual(2);
        expect(meshes(h).filter((m) => m.name.startsWith('stage-furniture') && !h.group.getObjectById(m.id))).toEqual([]);
      }
      for (const m of furnitureMeshes(h)) seen.add(m.geometry);
      // the room itself was not touched: the same meshes with the same geometries
      expect(meshes(h).filter((m) => !m.name.startsWith('stage-furniture')).map((m) => m.geometry)).toEqual(roomGeos);
      for (const g of roomGeos) expect(disposed.has(g)).toBe(false);
      // every furniture geometry but the live ones has been disposed
      const live = new Set(furnitureMeshes(h).map((m) => m.geometry));
      expect(seen.size).toBeGreaterThan(18);
      for (const g of seen) if (!live.has(g)) expect(disposed.has(g), 'an old furniture geometry leaked').toBe(true);
      h.dispose();
      for (const g of seen) expect(disposed.has(g)).toBe(true);
      for (const g of roomGeos) expect(disposed.has(g)).toBe(true);
    } finally {
      spy.mockRestore();
    }
    expect(h.group.children).toHaveLength(0);
  });

  it('the colliders follow the furniture, and taking a piece away frees its floor', () => {
    const h = ONO_FLAT.build(ctxOf({ bed: 'futon_set' }));
    expect(h.colliders).toHaveLength(1);
    h.setPlaced!({ bed: 'futon_set', table: 'kotatsu', tv: 'tv_small' });
    expect(h.colliders).toHaveLength(3);
    h.setPlaced!({ table: 'kotatsu' });
    expect(h.colliders).toEqual([ONO_SLOTS.find((s) => s.name === 'table')!.rect]);
    h.setPlaced!({});
    expect(h.colliders).toEqual([]);
    expect(furnitureMeshes(h)).toEqual([]);
    h.dispose();
  });
});

describe('the placement view: slot picks and markers', () => {
  it.each(OWN)('$id: slot picks are off until showSlots, then tappable; the marker mesh exists only while the view is on', (stage) => {
    const h = stage.build(ctxOf({}));
    const slotPicks = () => h.pickables.filter((p) => p.id.startsWith('slot:'));
    const markers = () => meshes(h).filter((m) => m.name === 'stage-slot-markers');
    expect(slotPicks().every((p) => p.off)).toBe(true);
    expect(markers()).toHaveLength(0);
    h.setState!({ shoesOff: true, slippersOn: true, showSlots: true });
    expect(slotPicks().every((p) => !p.off)).toBe(true);
    expect(markers()).toHaveLength(1);
    expect((markers()[0].material as THREE.Material).transparent).toBe(true);
    // a focus on one slot rebuilds the markers (a different, brighter ring)
    const before = markers()[0].geometry;
    h.setState!({ shoesOff: true, slippersOn: true, showSlots: true, slotFocus: SLOTS[stage.id][0].name });
    expect(markers()).toHaveLength(1);
    expect(markers()[0].geometry).not.toBe(before);
    // the same state again does not rebuild
    const same = markers()[0].geometry;
    h.setState!({ shoesOff: true, slippersOn: true, showSlots: true, slotFocus: SLOTS[stage.id][0].name });
    expect(markers()[0].geometry).toBe(same);
    h.setState!({ shoesOff: true, slippersOn: true, showSlots: false });
    expect(slotPicks().every((p) => p.off)).toBe(true);
    expect(markers()).toHaveLength(0);
    h.dispose();
  });

  it('the picks stand on their slots, inside the room, at reachable heights', () => {
    for (const stage of OWN) {
      const h = stage.build(ctxOf({}));
      for (const s of SLOTS[stage.id]) {
        const p = h.pickables.find((q) => q.id === slotPickId(s.name))!;
        expect((s.rect.x0 + s.rect.x1) / 2).toBeCloseTo(p.pos.x, 6);
        expect((s.rect.z0 + s.rect.z1) / 2).toBeCloseTo(p.pos.z, 6);
        expect(p.pos.y).toBeGreaterThan(s.y0);
        expect(p.pos.y).toBeLessThan(1);
        expect(p.radius).toBeGreaterThanOrEqual(0.5);
      }
      h.dispose();
    }
  });
});

describe.each(OWN)('$id: the player can move with every slot filled', (stage) => {
  const id = stage.id;
  const full = filled(id);
  const slots = SLOTS[id];

  it('keeps every footprint inside the raised floor, off the tokonoma and off every other footprint', () => {
    const raised = stage.floor.raised;
    for (const s of slots) {
      expect(s.rect.x0, s.name).toBeGreaterThanOrEqual(raised.x0 - 1e-9);
      expect(s.rect.x1, s.name).toBeLessThanOrEqual(raised.x1 + 1e-9);
      expect(s.rect.z0, s.name).toBeGreaterThanOrEqual(raised.z0 - 1e-9);
      expect(s.rect.z1, s.name).toBeLessThanOrEqual(raised.z1 + 1e-9);
      const { w, d } = slotSize(s);
      expect(w, s.name).toBeGreaterThanOrEqual(0.3);
      expect(d, s.name).toBeGreaterThanOrEqual(0.3);
    }
    const all = [...slots.map((s) => s.rect), ...stage.colliders];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        expect(a.x0 < b.x1 - 1e-9 && b.x0 < a.x1 - 1e-9 && a.z0 < b.z1 - 1e-9 && b.z0 < a.z1 - 1e-9, `footprints ${i} and ${j} overlap`).toBe(false);
      }
    }
  });

  it('spawns on clear floor, outside the exit strip, and the way out is open with the shoes on (no dead end)', () => {
    expect(free(stage, full, stage.spawn.x, stage.spawn.z, true)).toBe(true);
    expect(inExit(stage, stage.spawn.x, stage.spawn.z)).toBe(false);
    expect(reachable(stage, full, stage.spawn, (x, z) => inExit(stage, x, z), true)).toBe(true);
    expect(reachable(stage, full, stage.spawn, (x, z) => z < stage.floor.raised.z1, true)).toBe(false); // the gate holds until the shoes are off
  });

  it('the guest stands on clear floor, whatever is placed, and the player can walk to the talking spot and back out (shoes off)', () => {
    const g = stage.guest!;
    for (const placed of [{}, full]) {
      for (const c of [...stage.colliders, ...furnitureColliders(slots, placed)]) expect(hits(c, g.x, g.z, 0.3), `guest vs a collider (${Object.keys(placed).length} placed)`).toBe(false);
      expect(free(stage, placed, g.talk.x, g.talk.z, false)).toBe(true);
      expect(reachable(stage, placed, stage.spawn, (x, z) => near({ x, z }, g.talk, 0.1), false)).toBe(true);
      expect(reachable(stage, placed, g.talk, (x, z) => inExit(stage, x, z), false)).toBe(true);
    }
    expect(g.z).toBeLessThan(stage.floor.raised.z1);
    const d = Math.hypot(g.talk.x - g.x, g.talk.z - g.z);
    expect(d).toBeGreaterThan(0.95);
    expect(d).toBeLessThan(g.radius);
  });

  it('with the shoes off the player can get to every slot: a standable spot within 1.5 m of each footprint, reachable from the door', () => {
    for (const s of slots) {
      const cx = (s.rect.x0 + s.rect.x1) / 2;
      const cz = (s.rect.z0 + s.rect.z1) / 2;
      const r = Math.max(s.rect.x1 - s.rect.x0, s.rect.z1 - s.rect.z0) / 2 + 1.0;
      expect(reachable(stage, full, stage.spawn, (x, z) => Math.hypot(x - cx, z - cz) <= r, false), `slot ${s.name}`).toBe(true);
    }
  });

  it('no two pieces (or a piece and a wall) leave a gap the player could half enter: a gap is closed or at least 0.84 m', () => {
    const b = stage.bounds;
    const walls: Rect[] = [
      { x0: -50, x1: b.x0 - 0.3, z0: -50, z1: 50 },
      { x0: b.x1 + 0.3, x1: 50, z0: -50, z1: 50 },
      { x0: -50, x1: 50, z0: -50, z1: b.z0 - 0.3 },
      stage.gate,
    ];
    const all = [...stage.colliders, ...slots.map((s) => s.rect), ...walls];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const c = all[j];
        const dx = Math.max(c.x0 - a.x1, a.x0 - c.x1);
        const dz = Math.max(c.z0 - a.z1, a.z0 - c.z1);
        if (dx >= 0 && dz >= 0) continue; // a corner apart: not a corridor
        const gap = Math.max(dx, dz);
        if (gap <= 1e-6) continue; // touching: closed
        const overlap = dx > 0 ? Math.min(a.z1, c.z1) - Math.max(a.z0, c.z0) : Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0);
        if (overlap <= 0) continue;
        const corridor: Rect = dx > 0 ? { x0: Math.min(a.x1, c.x1), x1: Math.max(a.x0, c.x0), z0: Math.max(a.z0, c.z0), z1: Math.min(a.z1, c.z1) } : { x0: Math.max(a.x0, c.x0), x1: Math.min(a.x1, c.x1), z0: Math.min(a.z1, c.z1), z1: Math.max(a.z0, c.z0) };
        if (all.some((o, k) => k !== i && k !== j && o.x0 < corridor.x1 && o.x1 > corridor.x0 && o.z0 < corridor.z1 && o.z1 > corridor.z0)) continue;
        expect(gap, `pieces ${i} and ${j}`).toBeGreaterThanOrEqual(0.84);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------------------------------------------------------

type Internals = {
  playerPos: THREE.Vector3;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sparkles: Array<{ id: string; sprite: THREE.Sprite }>;
  stage: { colliders: Rect[]; handle: StageHandle; npcs: Array<{ id: string; home: THREE.Vector3 }>; sparkles: Array<{ id: string; sprite: THREE.Sprite }>; state: Record<string, unknown> } | null;
  step(dt: number): void;
};
const make = () => {
  const world = new TokyoWorld({ canvas: fakeCanvas(), characters: CHARACTERS, quality: 'high' });
  return { world, w: world as unknown as Internals };
};
const tick = (w: Internals, frames: number) => {
  for (let i = 0; i < frames; i++) w.step(1 / 60);
  w.scene.updateMatrixWorld(true);
  w.camera.updateMatrixWorld();
};

describe('TokyoWorld: the own rooms', () => {
  it.each(OWN)('$id: enterStage draws the placed furniture, lists its slots and has nobody in it; the way out lands in front of the door', (stage) => {
    const { world, w } = make();
    const full = filled(stage.id);
    expect(world.enterStage(stage.id, { placed: full })).toBe(true);
    const info = world.stageInfo()!;
    expect(info.id).toBe(stage.id);
    expect(info.people).toEqual([]);
    expect(info.slots.sort()).toEqual(SLOTS[stage.id].map((s) => s.name).sort());
    expect(info.meshes).toBeLessThanOrEqual(12);
    expect(info.picks).not.toContain('slot:bed'); // not in the placement view
    expect(w.stage!.colliders.length).toBeGreaterThanOrEqual(SLOTS[stage.id].length + 1); // the pieces and the gate
    expect(world.getStageState()).toEqual({ shoesOff: false, slippersOn: false, showSlots: false, slotFocus: null });
    expect(world.exitStage()).toBe(true);
    const p = world.snapshot().player;
    const door = DOOR_RETURN[stage.returnDoor]!;
    expect(Math.hypot(p.x - door.x, p.z - door.z)).toBeLessThan(0.6);
    world.dispose();
  });

  it('setStagePlaced redraws the furniture and the world\'s colliders follow; it does nothing on the street or in a friend\'s home', () => {
    const { world, w } = make();
    world.setStagePlaced({ bed: 'futon_set' }); // the street: nothing happens, nothing throws
    world.enterStage('ono_flat', { state: { shoesOff: true, slippersOn: true } });
    expect(w.stage!.colliders).toHaveLength(1); // only the tokonoma
    const tri0 = furnitureTris(w.stage!.handle);
    world.setStagePlaced({ bed: 'futon_set', table: 'kotatsu' });
    expect(w.stage!.colliders).toHaveLength(3);
    expect(furnitureTris(w.stage!.handle)).toBeGreaterThan(tri0);
    world.setStagePlaced({});
    expect(w.stage!.colliders).toHaveLength(1);
    world.exitStage();
    world.enterStage('mio_1r');
    const n = w.stage!.colliders.length;
    world.setStagePlaced({ bed: 'futon_set' });
    expect(w.stage!.colliders).toHaveLength(n);
    world.dispose();
  });

  it('a piece placed on the player pushes them out of it, and the walk onto it is blocked', () => {
    const { world, w } = make();
    world.enterStage('ono_flat', { state: { shoesOff: true, slippersOn: true } });
    const t = ONO_SLOTS.find((s) => s.name === 'table')!.rect;
    w.playerPos.set((t.x0 + t.x1) / 2, 0.15, (t.z0 + t.z1) / 2);
    world.setStagePlaced({ table: 'kotatsu' });
    tick(w, 5);
    const { x, z } = w.playerPos;
    expect(hits(t, x, z, PLAYER_R - 0.02), 'still inside the kotatsu').toBe(false);
    world.dispose();
  });

  it('the placement view: showSlots turns the slot picks on (and no sparkle shows on them), focus and off again', () => {
    const { world, w } = make();
    world.enterStage('dorm', { state: { shoesOff: true, slippersOn: true } });
    world.setStageState({ showSlots: true, slotFocus: 'bed' });
    const info = world.stageInfo()!;
    for (const s of DORM_SLOTS) expect(info.picks).toContain(slotPickId(s.name));
    expect(info.meshes).toBeLessThanOrEqual(12);
    tick(w, 10);
    for (const sp of w.stage!.sparkles.filter((s) => s.id.startsWith('slot:'))) expect(sp.sprite.visible).toBe(false);
    expect(world.getStageState()).toMatchObject({ showSlots: true, slotFocus: 'bed' });
    world.setStageState({ showSlots: false });
    expect(world.stageInfo()!.picks.filter((p) => p.startsWith('slot:'))).toEqual([]);
    const ids: string[] = [];
    world.on((e) => e.type === 'pick' && ids.push(e.id));
    world.setStageState({ showSlots: true });
    world.simulatePick('slot:desk');
    expect(ids).toEqual(['slot:desk']);
    world.dispose();
  });

  it('the housewarming guest: enterStage(id, { guest }) puts that friend on the guest spot, who can be talked to; without it the room is empty; a friend\'s home ignores it', () => {
    const { world, w } = make();
    for (const stage of OWN) {
      world.enterStage(stage.id, { placed: filled(stage.id), state: { shoesOff: true, slippersOn: true } });
      expect(world.stageInfo()!.people).toEqual([]);
      world.exitStage();
      expect(world.enterStage(stage.id, { placed: filled(stage.id), guest: 'mio', state: { shoesOff: true, slippersOn: true } })).toBe(true);
      expect(world.stageInfo()!.people).toEqual(['mio']);
      const g = stage.guest!;
      const npc = w.stage!.npcs[0];
      expect(npc.home.x).toBeCloseTo(g.x, 6);
      expect(npc.home.z).toBeCloseTo(g.z, 6);
      world.teleportNear('mio');
      expect(world.snapshot().player.x).toBeCloseTo(g.talk.x, 1);
      expect(world.snapshot().player.z).toBeCloseTo(g.talk.z, 1);
      tick(w, 30);
      expect(world.nearby).toBe('mio');
      world.exitStage();
    }
    world.enterStage('mio_1r', { guest: 'kenji' });
    expect(world.stageInfo()!.people).toEqual(['mio']);
    world.dispose();
  });

  it('20 rounds of enter, furnish, placement view, exit leave the scene as it was (no leaked meshes, lights or sprites)', () => {
    const { world, w } = make();
    const census = () => {
      let n = 0;
      w.scene.traverse(() => n++);
      return n;
    };
    const before = census();
    for (let i = 0; i < 20; i++) {
      const stage = OWN[i % 2];
      expect(world.enterStage(stage.id, { placed: i % 3 ? filled(stage.id) : {}, guest: i % 4 === 0 ? 'mio' : undefined })).toBe(true);
      world.setStageState({ shoesOff: true, slippersOn: true, showSlots: i % 2 === 0, slotFocus: i % 2 === 0 ? SLOTS[stage.id][i % SLOTS[stage.id].length].name : null });
      tick(w, 5);
      world.setStagePlaced(i % 2 ? {} : filled(stage.id));
      world.setStagePlaced(filled(stage.id));
      expect(world.exitStage()).toBe(true);
    }
    expect(census()).toBe(before);
    world.dispose();
  });

  it('door:dorm is open from the start (it is your own room), door:flat opens with setDoorOpen', () => {
    const { world } = make();
    expect(world.isDoorOpen('dorm')).toBe(true);
    expect(world.isDoorOpen('flat')).toBe(false);
    world.setDoorOpen('flat', true);
    expect(world.isDoorOpen('door:flat')).toBe(true);
    world.setDoorOpen('dorm', false);
    expect(world.isDoorOpen('door:dorm')).toBe(false);
    world.dispose();
  });
});
