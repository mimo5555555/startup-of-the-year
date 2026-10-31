// Goen stage 1's three looks (docs/GOEN.md): the momiji kimono (avatar accessory 'kimono'), the sakura paint on the bike and the e-bike
// (`world.setRideSkin`) and the momiji decor for the player's rooms (furniture models `room_momiji`, `plant_momiji`), each within the
// budgets its kind already has.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { Avatar, DEFAULT_PLAYER, KIMONO_ACCESSORY, KIMONO_MOMIJI_LOOK } from '../src/avatar';
import { buildRide, RIDE_LOOKS, RIDE_SKINS } from '../src/buildings/rides';
import { DORM, DORM_SLOTS } from '../src/stages/dorm';
import { DECOR_IDS, FURNITURE_SLOT } from '../src/stages/furniture';
import { ONO_FLAT, ONO_SLOTS } from '../src/stages/ono_flat';
import type { StageHandle, StageSlot } from '../src/stage';
import { TokyoWorld } from '../src/world';

beforeAll(installFakeDom);

const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
const meshesOf = (o: THREE.Object3D) => {
  const out: THREE.Mesh[] = [];
  o.traverse((c) => (c as THREE.Mesh).isMesh && out.push(c as THREE.Mesh));
  return out;
};
const tris = (o: THREE.Object3D) => meshesOf(o).reduce((n, m) => n + m.geometry.getAttribute('position').count / 3, 0);
/** how many vertices carry this colour */
const colourCount = (o: THREE.Object3D, hex: string) => {
  const c = new THREE.Color(hex);
  let n = 0;
  for (const m of meshesOf(o)) {
    const col = m.geometry.getAttribute('color');
    if (!col) continue;
    for (let i = 0; i < col.count; i++) if (Math.abs(col.getX(i) - c.r) < 0.004 && Math.abs(col.getY(i) - c.g) < 0.004 && Math.abs(col.getZ(i) - c.b) < 0.004) n++;
  }
  return n;
};
const KIMONO = { ...DEFAULT_PLAYER, ...KIMONO_MOMIJI_LOOK, accessories: [...DEFAULT_PLAYER.accessories, KIMONO_ACCESSORY] } as typeof DEFAULT_PLAYER;

describe('the momiji kimono (accessory "kimono")', () => {
  it('draws a robe to the ankles with an obi, at most one draw call and a third more triangles than the plain avatar', () => {
    const plain = new Avatar(DEFAULT_PLAYER, mat);
    const kimono = new Avatar(KIMONO, mat);
    const robe = kimono.root.getObjectByName('kimono-robe') as THREE.Mesh;
    expect(robe).toBeTruthy();
    expect(plain.root.getObjectByName('kimono-robe')).toBeUndefined();
    robe.geometry.computeBoundingBox();
    const box = robe.geometry.boundingBox!;
    expect(box.min.y).toBeLessThan(0.12); // to the ankles
    expect(box.max.y).toBeGreaterThan(0.6); // up under the obi
    expect(meshesOf(kimono.root).length).toBe(meshesOf(plain.root).length + 1);
    expect(tris(kimono.root)).toBeLessThan(tris(plain.root) * 1.35);
    expect(colourCount(kimono.root, KIMONO_MOMIJI_LOOK.accent)).toBeGreaterThan(30); // the obi and its knot
  });

  it('leaves out the backpack (it would sit on the obi knot) and puts white tabi on zori', () => {
    const withPack = new Avatar(KIMONO, mat);
    const noPack = new Avatar({ ...KIMONO, accessories: [KIMONO_ACCESSORY] }, mat);
    expect(tris(withPack.root)).toBe(tris(noPack.root));
    expect(colourCount(withPack.root, '#f7f4ec')).toBeGreaterThan(0);
  });

  it('takes small steps: the legs swing less than in trousers', () => {
    const swing = (a: Avatar) => {
      a.setWalking(3);
      let max = 0;
      for (let i = 0; i < 120; i++) {
        a.update(1 / 60, i / 60);
        max = Math.max(max, Math.abs((a as unknown as { legL: THREE.Group }).legL.rotation.x));
      }
      return max;
    };
    const plain = swing(new Avatar(DEFAULT_PLAYER, mat));
    const kimono = swing(new Avatar(KIMONO, mat));
    expect(kimono).toBeGreaterThan(0.05);
    expect(kimono).toBeLessThan(plain * 0.5);
  });

  it('is what the world wears through setPlayerSpec', () => {
    const world = new TokyoWorld({ canvas: fakeCanvas(), characters: CHARACTERS, quality: 'high' });
    world.setPlayerSpec(KIMONO);
    const p = (world as unknown as { player: Avatar }).player;
    expect(p.root.getObjectByName('kimono-robe')).toBeTruthy();
    world.dispose();
  });
});

describe('the sakura paint (ride skin)', () => {
  const mats = { toon: new THREE.MeshToonMaterial(), glow: new THREE.MeshBasicMaterial() };

  it.each(['bike', 'ebike'] as const)('%s: pink frame, white fenders, blossom stickers, the same draw calls and within the ride budget', (kind) => {
    const plain = buildRide(kind, mats)!;
    const sakura = buildRide(kind, mats, 'sakura')!;
    expect(meshesOf(sakura).length).toBe(meshesOf(plain).length);
    expect(tris(sakura)).toBeLessThan(1500);
    expect(tris(sakura)).toBeGreaterThan(tris(plain)); // the stickers
    expect(colourCount(sakura, RIDE_SKINS.sakura[kind].frame)).toBeGreaterThan(0);
    expect(colourCount(plain, RIDE_SKINS.sakura[kind].frame)).toBe(0);
    expect(colourCount(sakura, RIDE_LOOKS[kind].frame)).toBe(0);
    expect(colourCount(sakura, RIDE_SKINS.sakura[kind].paint!.petal)).toBeGreaterThan(0);
    expect(sakura.userData.skin).toBe('sakura');
  });

  it('the car has no paint: the same mesh with or without it', () => {
    const a = meshesOf(buildRide('car', mats)!).map((m) => Array.from(m.geometry.getAttribute('color').array));
    const b = meshesOf(buildRide('car', mats, 'sakura')!).map((m) => Array.from(m.geometry.getAttribute('color').array));
    expect(b).toEqual(a);
  });

  it('world.setRideSkin repaints the mounted bike at once and stays chosen across setRide', () => {
    const world = new TokyoWorld({ canvas: fakeCanvas(), characters: CHARACTERS, quality: 'high' });
    const ride = () => (world as unknown as { rideMesh: THREE.Object3D | null }).rideMesh;
    world.setRide('bike');
    expect(ride()!.userData.skin).toBeUndefined();
    world.setRideSkin('sakura');
    expect(world.getRideSkin()).toBe('sakura');
    expect(world.getRide()).toBe('bike');
    expect(ride()!.userData.skin).toBe('sakura');
    world.setRide('ebike');
    expect(ride()!.userData.skin).toBe('sakura');
    world.setRide('car');
    expect(ride()!.userData.skin).toBeUndefined();
    world.setRide(null);
    world.setRideSkin(null);
    world.setRide('bike');
    expect(ride()!.userData.skin).toBeUndefined();
    world.dispose();
  });
});

describe('the momiji decor (furniture models)', () => {
  const toon = new THREE.MeshToonMaterial({ vertexColors: true });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const ctxOf = (placed: Record<string, string> = {}) => ({ toon, glow, placed, playerShoes: '#f5f5f5' });
  const furnitureTris = (h: StageHandle) => meshesOf(h.group).filter((m) => m.name.startsWith('stage-furniture')).reduce((n, m) => n + m.geometry.getAttribute('position').count / 3, 0);
  const cases: Array<[string, string, typeof ONO_FLAT, readonly StageSlot[]]> = [];
  for (const id of DECOR_IDS) {
    // room_momiji is the shrine's decor set (its item names the shelf slot; it fits any), plant_momiji the season's plant
    for (const slot of id === 'room_momiji' ? ['shelf', 'plant'] : ['plant']) {
      cases.push([id, slot, ONO_FLAT, ONO_SLOTS], [id, slot, DORM, DORM_SLOTS]);
    }
  }

  it('are decor, not one of the eight furniture items the slots are named after', () => {
    expect(DECOR_IDS).toEqual(['room_momiji', 'plant_momiji']);
    for (const id of DECOR_IDS) expect(FURNITURE_SLOT[id]).toBeUndefined();
  });

  it.each(cases)('%s in the %s slot of %s: drawn (not the parcel), inside the footprint, under the ceiling, within the per-piece budget', (id, slotName, stage, slots) => {
    const slot = slots.find((s) => s.name === slotName)!;
    const h0 = stage.build(ctxOf());
    const h1 = stage.build(ctxOf({ [slotName]: id }));
    const parcel = stage.build(ctxOf({ [slotName]: 'no_such_item' }));
    expect(furnitureTris(h1)).toBeGreaterThan(furnitureTris(parcel)); // a model of its own, not the cardboard box
    expect(furnitureTris(h1) - furnitureTris(h0)).toBeLessThan(1600);
    const box = new THREE.Box3();
    for (const m of meshesOf(h1.group).filter((x) => x.name.startsWith('stage-furniture'))) {
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!);
    }
    // the room's own pieces in other slots (the dorm's cot and desk) are in the same mesh: measure against an empty build
    if (stage === ONO_FLAT) {
      const slack = 0.25;
      expect(box.min.x).toBeGreaterThanOrEqual(slot.rect.x0 - slack);
      expect(box.max.x).toBeLessThanOrEqual(slot.rect.x1 + slack);
      expect(box.min.z).toBeGreaterThanOrEqual(slot.rect.z0 - slack);
      expect(box.max.z).toBeLessThanOrEqual(slot.rect.z1 + slack);
      expect(box.min.y).toBeGreaterThanOrEqual(slot.y0 - 1e-6);
      expect(box.max.y - box.min.y).toBeGreaterThan(0.15);
    }
    expect(box.max.y).toBeLessThanOrEqual(1.95);
    expect(h1.colliders).toContainEqual(slot.rect);
    for (const h of [h0, h1, parcel]) h.dispose();
  });
});
