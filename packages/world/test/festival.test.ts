// The festival in the park (slice 5B, chapter 7): the render budget of the dressing, the day look untouched while it is off,
// toggling without a leak, the stall and stage picks, the colliders and their gaps, the guests at their spots and back home,
// and the fireworks. Runs the real world with a renderer that draws nothing and steps it by hand.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { buildCity } from '../src/city';
import {
  FESTIVAL_SPOTS,
  FESTIVAL_STAGE_PICK,
  FESTIVAL_STALL_IDS,
  FESTIVAL_STALLS,
  festivalExtras,
  stallPickId,
  stallRect,
  stageRect,
} from '../src/festival';
import { BOUNDS, NPC_SPAWNS, type Rect } from '../src/layout';
import { TokyoWorld } from '../src/world';

beforeAll(installFakeDom);

/** the festival's share of the park view at dusk (slice 5B): at most this many extra draw calls and triangles */
const MAX_DRAW_CALLS = 8;
const MAX_TRIANGLES = 12_000;
/** the player is 0.84 m wide: any gap between two obstacles must be at least this, or be fully closed */
const PLAYER_W = 0.84;

type Npc = { id: string; hidden: boolean; shop: string | null; home: THREE.Vector3; face: number; radius: number; avatar: { root: THREE.Object3D } };
type Internals = {
  scene: THREE.Scene;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  npcs: Npc[];
  city: { colliders: Rect[]; occluders: Rect[]; pickables: Array<{ id: string }>; mapRects: Rect[] };
  festivalScenery: { group: THREE.Group } | null;
  step(dt: number): void;
};

const make = () => {
  const world = new TokyoWorld({ canvas: fakeCanvas(), characters: CHARACTERS, quality: 'high' });
  return { world, w: world as unknown as Internals };
};
const tick = (w: Internals, frames: number, dt = 1 / 60) => {
  for (let i = 0; i < frames; i++) w.step(dt);
};

/** what the renderer would draw: every visible mesh, line and point cloud (an invisible parent hides its subtree) */
function census(w: Internals) {
  const out: string[] = [];
  const walk = (o: THREE.Object3D) => {
    if (!o.visible) return;
    const m = o as THREE.Mesh;
    if (m.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) {
      const g = m.geometry;
      const n = g ? (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) : 0;
      out.push(`${o.type}:${o.name}:${n}`);
    }
    o.children.forEach(walk);
  };
  walk(w.scene);
  const light = [w.hemi.color, w.hemi.groundColor, w.sun.color, w.scene.fog!.color].map((c) => c.getHexString()).join(',');
  return { objects: out.sort(), light: `${light}|${w.hemi.intensity}|${w.sun.intensity}` };
}
const counts = (w: Internals) => ({ colliders: w.city.colliders.length, occluders: w.city.occluders.length, picks: w.city.pickables.length, map: w.city.mapRects.length });
const gap = (a: Rect, b: Rect) => Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), Math.max(a.z0 - b.z1, b.z0 - a.z1, 0));
const inside = (r: Rect, x: number, z: number, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

describe('the festival dressing', () => {
  it(`stays inside the render budget: <= ${MAX_DRAW_CALLS} draw calls and <= ${MAX_TRIANGLES} triangles`, () => {
    const { world, w } = make();
    expect(world.festivalInfo()).toBeNull(); // nothing is built before the first festival
    world.setFestival(true, true);
    world.fireworks(true);
    tick(w, 120);
    const info = world.festivalInfo()!;
    console.log(`festival dressing: ${info.meshes} draw calls, ${info.triangles} triangles`);
    expect(info.meshes).toBeLessThanOrEqual(MAX_DRAW_CALLS);
    expect(info.triangles).toBeLessThanOrEqual(MAX_TRIANGLES);
    world.dispose();
  });

  it('leaves the day look exactly as it was while the festival is off (same objects, same lights)', () => {
    const { world, w } = make();
    tick(w, 2);
    const day = census(w);
    const before = counts(w);
    world.setFestival(true, true);
    world.fireworks(true);
    tick(w, 30);
    expect(census(w).objects.length).toBeGreaterThan(day.objects.length);
    world.setFestival(false, true);
    tick(w, 2);
    expect(census(w)).toEqual(day);
    expect(counts(w)).toEqual(before);
    world.dispose();
  });

  it('toggles ten times without a leak: one group, built once, and the lists back to their size', () => {
    const { world, w } = make();
    const before = counts(w);
    const children = w.scene.children.length;
    world.setFestival(true, true);
    const group = w.festivalScenery!.group;
    const on = counts(w);
    for (let i = 0; i < 10; i++) {
      world.setFestival(false, i % 2 === 0);
      tick(w, 3);
      expect(counts(w)).toEqual(before);
      world.setFestival(true, i % 2 === 1);
      world.setFestival(true); // twice on adds nothing twice
      tick(w, 3);
      expect(counts(w)).toEqual(on);
    }
    expect(w.festivalScenery!.group).toBe(group);
    expect(w.scene.children.length).toBe(children + 1);
    world.setFestival(false, true);
    expect(counts(w)).toEqual(before);
    world.dispose();
  });

  it('takes the dressing away at once when the festival ends (the lighting still fades)', () => {
    const { world, w } = make();
    world.setFestival(true);
    expect(w.festivalScenery!.group.visible).toBe(true);
    tick(w, 20);
    world.setFestival(false);
    expect(w.festivalScenery!.group.visible).toBe(false); // the stalls stop blocking at once, so they go at once
    world.dispose();
  });
});

describe('picks, colliders and the minimap while the festival is on', () => {
  it('registers a pick for every stall and the stage, and takes them away again', () => {
    const { world, w } = make();
    const ids = () => w.city.pickables.map((p) => p.id);
    const all = [...FESTIVAL_STALL_IDS.map(stallPickId), FESTIVAL_STAGE_PICK];
    for (const id of all) expect(ids()).not.toContain(id);
    world.setFestival(true, true);
    for (const id of all) expect(ids()).toContain(id);
    expect(world.festivalInfo()!.picks.sort()).toEqual([...all].sort());
    expect(FESTIVAL_STALL_IDS).toEqual(expect.arrayContaining(['takoyaki', 'yakisoba', 'kakigori', 'ramen', 'kingyo', 'ringoame']));
    world.setFestival(false, true);
    for (const id of all) expect(ids()).not.toContain(id);
    world.dispose();
  });

  it('blocks walking at the stalls and the stage, and shows them on the minimap', () => {
    const { world, w } = make();
    world.setFestival(true, true);
    for (const r of [...FESTIVAL_STALLS.map(stallRect), stageRect()]) expect(w.city.colliders).toContainEqual(r);
    expect(w.city.mapRects.some((r) => (r as { label?: string }).label === 'festival')).toBe(true);
    world.dispose();
  });

  it('keeps the follow camera out of the stall across a 5 m aisle (it may come closer than the street minimum here)', () => {
    const { world, w } = make();
    world.setFestival(true, true);
    const x = w as unknown as { playerPos: THREE.Vector3; player: { root: THREE.Object3D }; yaw: number; camera: THREE.Camera; snapCamera(): void };
    const rects = FESTIVAL_STALLS.map(stallRect);
    // the middle of the aisle, looking east at the kakigori stall: the camera swings west, towards the yakisoba stall
    for (const [px, pz, yaw] of [[5.475, 29.6, -Math.PI / 2], [5.475, 27.8, Math.PI / 2], [4.2, 33.8, -Math.PI / 2]] as const) {
      x.playerPos.set(px, 0, pz);
      x.player.root.position.copy(x.playerPos);
      x.yaw = yaw;
      x.snapCamera();
      tick(w, 2);
      const c = x.camera.position;
      for (const r of rects) expect(inside(r, c.x, c.z, 0.1) && c.y < 3.2, `camera ${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)} in ${JSON.stringify(r)}`).toBe(false);
    }
    world.dispose();
  });

  it('leaves no gap narrower than the player between a stall or the stage and anything else (flush or >= 0.84 m)', () => {
    const city = buildCity();
    const fest = festivalExtras().colliders;
    for (const a of fest) {
      for (const b of [...city.colliders, ...fest]) {
        if (a === b) continue;
        const g = gap(a, b);
        expect(g === 0 || g >= PLAYER_W, `${JSON.stringify(a)} / ${JSON.stringify(b)}: gap ${g.toFixed(3)}`).toBe(true);
      }
    }
  });

  it('keeps every person spot, the speaker spot and the pick points on open ground inside the walkable bounds', () => {
    const city = buildCity();
    const blocks = [...city.colliders, ...festivalExtras().colliders];
    const spots = [FESTIVAL_SPOTS.stage, FESTIVAL_SPOTS.mc, ...FESTIVAL_SPOTS.guests];
    for (const s of spots) {
      expect(inside(BOUNDS, s.x, s.z, -0.42), `${s.x},${s.z}`).toBe(true);
      for (const r of blocks) expect(inside(r, s.x, s.z, 0.42), `${s.x},${s.z} in ${JSON.stringify(r)}`).toBe(false);
    }
    // two people never stand on top of each other
    for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) expect(Math.hypot(spots[i].x - spots[j].x, spots[i].z - spots[j].z)).toBeGreaterThan(1);
    // Kenji stands behind his counter, inside his stall
    const ramen = stallRect(FESTIVAL_STALLS.find((s) => s.id === 'ramen')!);
    expect(inside(ramen, FESTIVAL_SPOTS.kenji.x, FESTIVAL_SPOTS.kenji.z)).toBe(true);
    // a stall's pick sits in front of its counter, where the player can walk up to it
    for (const p of festivalExtras().picks) {
      if (p.id === FESTIVAL_STAGE_PICK) continue;
      for (const r of blocks) expect(inside(r, p.pos.x, p.pos.z), p.id).toBe(false);
    }
  });
});

describe('festival guests', () => {
  const home = (id: string) => NPC_SPAWNS.find((s) => s.id === id)!;
  const npc = (w: Internals, id: string) => w.npcs.find((n) => n.id === id)!;

  it('puts Kenji at his stall, Hanako by the stage and the friends at their spots, and everyone back home after', () => {
    const { world, w } = make();
    const ids = ['hanako', 'mio', 'kenji', 'tanaka'];
    const saved = new Map(w.npcs.map((n) => [n.id, { home: n.home.clone(), face: n.face, radius: n.radius }]));
    world.setFestivalGuests(ids); // remembered while the festival is off: nobody moves yet
    expect(npc(w, 'mio').home.x).toBe(home('mio').x);
    world.setFestival(true, true);
    expect(npc(w, 'kenji').home.x).toBeCloseTo(FESTIVAL_SPOTS.kenji.x, 6);
    expect(npc(w, 'kenji').home.z).toBeCloseTo(FESTIVAL_SPOTS.kenji.z, 6);
    expect(npc(w, 'hanako').home.x).toBeCloseTo(FESTIVAL_SPOTS.mc.x, 6);
    expect(npc(w, 'mio').home.x).toBeCloseTo(FESTIVAL_SPOTS.guests[0].x, 6);
    expect(npc(w, 'tanaka').home.z).toBeCloseTo(FESTIVAL_SPOTS.guests[1].z, 6);
    expect(npc(w, 'mio').avatar.root.position.distanceTo(npc(w, 'mio').home)).toBe(0);
    expect(world.festivalInfo()!.guests.sort()).toEqual(['hanako', 'kenji', 'mio', 'tanaka']);
    const snap = world.snapshot().npcs.find((n) => n.id === 'mio')!;
    expect(snap.x).toBeCloseTo(FESTIVAL_SPOTS.guests[0].x, 6); // the minimap dot follows
    // a friend dropped from the list goes home at once
    world.setFestivalGuests(['hanako', 'tanaka']);
    expect(npc(w, 'mio').home.equals(saved.get('mio')!.home)).toBe(true);
    world.setFestival(false, true);
    for (const n of w.npcs) {
      const s = saved.get(n.id)!;
      expect(n.home.equals(s.home), n.id).toBe(true);
      expect(n.face, n.id).toBe(s.face);
      expect(n.radius, n.id).toBe(s.radius);
      expect(n.avatar.root.position.equals(s.home), n.id).toBe(true);
    }
    expect(world.festivalInfo()!.guests).toEqual([]);
    world.dispose();
  });

  it('brings a friend whose shop is shuttered, and shutters them again afterwards', () => {
    const { world, w } = make();
    world.setShopOpen('ramen', false);
    expect(npc(w, 'kenji').hidden).toBe(true);
    world.setFestival(true, true);
    expect(npc(w, 'kenji').hidden).toBe(false);
    expect(npc(w, 'kenji').avatar.root.visible).toBe(true);
    world.setFestival(false, true);
    expect(npc(w, 'kenji').hidden).toBe(true);
    expect(npc(w, 'kenji').shop).toBe('ramen');
    world.dispose();
  });

  it('ignores unknown ids and guests beyond the spots', () => {
    const { world } = make();
    world.setFestival(true, true);
    expect(() => world.setFestivalGuests(['nobody', 'mio', 'yuki', 'sato', 'tanaka', 'rin', 'aoi', 'nakamura', 'aiko', 'hanako'])).not.toThrow();
    const g = world.festivalInfo()!.guests;
    expect(g).not.toContain('nobody');
    expect(g).toContain('hanako');
    expect(g.length).toBeLessThanOrEqual(FESTIVAL_SPOTS.guests.length + 2);
    world.dispose();
  });
});

describe('fireworks', () => {
  it('only go off while the festival is on, and stop with it', () => {
    const { world, w } = make();
    world.fireworks(true); // nothing to show yet
    expect(world.isFireworks()).toBe(false);
    world.setFestival(true, true);
    world.fireworks(true);
    expect(world.isFireworks()).toBe(true);
    tick(w, 90);
    const points = w.festivalScenery!.group.getObjectByName('festival:fireworks') as THREE.Points;
    expect(points.visible).toBe(true);
    const col = points.geometry.getAttribute('color').array as Float32Array;
    expect(col.some((v) => v > 0.1)).toBe(true); // a burst is in the sky
    world.setFestival(false, true);
    expect(world.isFireworks()).toBe(false);
    expect(points.visible).toBe(false);
    world.setFestival(true, true);
    expect(world.isFireworks()).toBe(false); // a new festival starts with a quiet sky
    world.dispose();
  });

  it('turns the follow camera towards them and tilts it up, and back down when they stop', () => {
    const { world, w } = make();
    const cam = (w as unknown as { camera: THREE.Camera }).camera;
    const up = () => cam.getWorldDirection(new THREE.Vector3()).y;
    world.setFestival(true, true);
    // where the closing beat finds the learner: at the speaker's spot, the stage behind them
    const p = (w as unknown as { playerPos: THREE.Vector3 }).playerPos;
    p.set(FESTIVAL_SPOTS.stage.x, 0, FESTIVAL_SPOTS.stage.z);
    tick(w, 60);
    world.fireworks(true);
    tick(w, 180);
    const looking = cam.getWorldDirection(new THREE.Vector3());
    expect(looking.z).toBeLessThan(-0.5); // north, over the stage
    for (const r of [...FESTIVAL_STALLS.map(stallRect), stageRect()]) expect(inside(r, cam.position.x, cam.position.z), 'camera clear of the stage and stalls').toBe(false);
    expect(up()).toBeGreaterThan(0); // above the horizon
    const dist = () => (w as unknown as { dist: number }).dist;
    expect(dist()).toBeLessThan(6); // in over the shoulder
    world.fireworks(false);
    tick(w, 240);
    expect(up()).toBeLessThan(0); // the usual look down at the player
    expect(dist()).toBe(9.2); // and the portrait follow distance back
    world.fireworks(true);
    tick(w, 30);
    world.setFestival(false, true); // the festival ending also ends the shot, at once (no tilt left fading out)
    expect(dist()).toBe(9.2);
    expect((w as unknown as { fireworksLift: number }).fireworksLift).toBe(0);
    world.dispose();
  });

  it('lets the shells in the air finish when turned off, then stops drawing', () => {
    const { world, w } = make();
    world.setFestival(true, true);
    world.fireworks(true);
    tick(w, 60);
    world.fireworks(false);
    const points = w.festivalScenery!.group.getObjectByName('festival:fireworks') as THREE.Points;
    expect(points.visible).toBe(true);
    tick(w, 60 * 5);
    expect(points.visible).toBe(false);
    world.dispose();
  });
});
