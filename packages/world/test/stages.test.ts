// The three friend homes (wave B1): each stage's data (spawn, host, exit, props), its draw budget, and that the learner can
// walk from the genkan to the host and back to the door with a 0.42 m radius, with the gate closed and open.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PLAYER_R, STEP } from '../src/stages/room';
import { GENKAN_SHOES_PICK, GENKAN_SLIPPERS_PICK, hostPickId, parsePropPick, propPickId, STAGES, STAGE_EXIT_PICK, STAGE_PROPS } from '../src/stages';
import type { Rect } from '../src/layout';
import type { Stage, StageHandle, StageId } from '../src/stage';

const HOMES = ['mio_1r', 'aiko_tatami', 'kenji_flat'] as const satisfies readonly StageId[];
const HOSTS: Record<(typeof HOMES)[number], string> = { mio_1r: 'mio', aiko_tatami: 'aiko', kenji_flat: 'kenji' };
const DOORS: Record<(typeof HOMES)[number], string> = { mio_1r: 'door:mio', aiko_tatami: 'door:aiko', kenji_flat: 'door:kenji' };
/** the design's room sizes (docs/GAME_DESIGN.md 8.8): width x depth in metres */
const SIZE: Record<(typeof HOMES)[number], [number, number]> = { mio_1r: [5.2, 3.8], aiko_tatami: [3.6, 4.5], kenji_flat: [5.2, 4.4] };
/** §8.8: each stage is at most 12 draw calls */
const MAX_DRAW_CALLS = 12;
const MAX_TRIANGLES = 6000;

const buildCtx = { toon: new THREE.MeshToonMaterial({ vertexColors: true }), glow: new THREE.MeshBasicMaterial({ vertexColors: true }), placed: {}, playerShoes: '#f5f5f5' };
const build = (s: Stage): StageHandle => s.build(buildCtx);
const stage = (id: (typeof HOMES)[number]) => STAGES[id]!;

const hits = (r: Rect, x: number, z: number, radius: number) => {
  const dx = x - Math.min(Math.max(x, r.x0), r.x1);
  const dz = z - Math.min(Math.max(z, r.z0), r.z1);
  return dx * dx + dz * dz < radius * radius - 1e-9;
};
const free = (s: Stage, x: number, z: number, gateShut: boolean) => {
  const b = s.bounds;
  if (x < b.x0 - 1e-9 || x > b.x1 + 1e-9 || z < b.z0 - 1e-9 || z > b.z1 + 1e-9) return false;
  const rects = gateShut ? [...s.colliders, s.gate] : s.colliders;
  return rects.every((r) => !hits(r, x, z, PLAYER_R));
};
/** can a circle of the player's radius walk from a to b? (breadth first over a 5 cm grid, 8 neighbours) */
const reachable = (s: Stage, a: { x: number; z: number }, to: (x: number, z: number) => boolean, gateShut: boolean) => {
  const h = 0.05;
  const key = (i: number, j: number) => i * 4096 + j;
  const i0 = Math.round(a.x / h);
  const j0 = Math.round(a.z / h);
  const seen = new Set([key(i0, j0)]);
  const queue: Array<[number, number]> = [[i0, j0]];
  while (queue.length) {
    const [i, j] = queue.pop()!;
    if (to(i * h, j * h)) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = i + di;
      const nj = j + dj;
      const k = key(ni, nj);
      if (seen.has(k) || !free(s, ni * h, nj * h, gateShut)) continue;
      seen.add(k);
      queue.push([ni, nj]);
    }
  }
  return false;
};
const inExit = (s: Stage, x: number, z: number) => x >= s.exit.x0 && x <= s.exit.x1 && z >= s.exit.z0 && z <= s.exit.z1;
const near = (p: { x: number; z: number }, q: { x: number; z: number }, d: number) => Math.hypot(p.x - q.x, p.z - q.z) <= d;

describe('the stage registry', () => {
  it('registers the three friend homes (the dorm and the Ono flat are wave B2)', () => {
    expect(Object.keys(STAGES).sort()).toEqual(['aiko_tatami', 'kenji_flat', 'mio_1r']);
    expect(STAGES.dorm).toBeUndefined();
    expect(STAGES.ono_flat).toBeUndefined();
  });

  it.each(HOMES)('%s: the design room size, the host first, the door it returns to', (id) => {
    const s = stage(id);
    expect(s.id).toBe(id);
    expect(s.actors[0].id).toBe(HOSTS[id]);
    expect(s.returnDoor).toBe(DOORS[id]);
    const [w, d] = SIZE[id];
    // the bounds keep the avatar's shoulders off the walls: 0.3 m in on the sides and the back, 0.2 at the open front
    expect(s.bounds.x1 - s.bounds.x0).toBeCloseTo(w - 0.6, 6);
    expect(s.bounds.z1 - s.bounds.z0).toBeCloseTo(d - 0.5, 6);
    expect(s.camera.dist).toBe(4.4);
    expect(s.camera.minDist).toBeLessThan(s.camera.dist);
    expect(s.camera.maxDist).toBeGreaterThan(s.camera.dist);
    expect(s.floor.step).toBe(STEP);
    expect(STEP).toBe(0.15);
  });

  it('puts Hina in Kenji flat as a second, smaller person', () => {
    expect(stage('kenji_flat').actors.map((a) => a.id)).toEqual(['kenji', 'hina']);
    expect(stage('mio_1r').actors).toHaveLength(1);
    expect(stage('aiko_tatami').actors).toHaveLength(1);
  });
});

describe.each(HOMES)('%s: what is built', (id) => {
  const s = stage(id);

  it(`is at most ${MAX_DRAW_CALLS} draw calls and ${MAX_TRIANGLES} triangles: merged vertex-colour geometry, no per-prop meshes`, () => {
    const h = build(s);
    let meshes = 0;
    let tris = 0;
    h.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      meshes++;
      tris += m.geometry.getAttribute('position').count / 3;
      expect(m.geometry.getAttribute('color'), 'vertex colours').toBeDefined();
      expect(Array.isArray(m.material)).toBe(false);
    });
    expect(meshes).toBeGreaterThanOrEqual(2);
    expect(meshes).toBeLessThanOrEqual(MAX_DRAW_CALLS);
    expect(meshes).toBeLessThanOrEqual(4); // solid, glow and the two genkan props
    expect(tris).toBeLessThanOrEqual(MAX_TRIANGLES);
    h.dispose();
  });

  it('is lit by one hemisphere light and one warm point light, and nothing else', () => {
    const h = build(s);
    const lights: THREE.Light[] = [];
    h.group.traverse((o) => {
      if ((o as THREE.Light).isLight) lights.push(o as THREE.Light);
    });
    expect(lights.filter((l) => (l as THREE.HemisphereLight).isHemisphereLight)).toHaveLength(1);
    expect(lights.filter((l) => (l as THREE.PointLight).isPointLight)).toHaveLength(1);
    expect(lights).toHaveLength(2);
    h.dispose();
  });

  it('has the exit, the two genkan picks and exactly the design props, each at a position inside the room', () => {
    const h = build(s);
    const ids = h.pickables.map((p) => p.id);
    expect(ids).toContain(STAGE_EXIT_PICK);
    expect(ids).toContain(GENKAN_SHOES_PICK);
    expect(ids).toContain(GENKAN_SLIPPERS_PICK);
    expect(new Set(ids).size).toBe(ids.length);
    const wanted = STAGE_PROPS[id]!.map((p) => propPickId(id, p.id)).sort();
    expect(wanted).toHaveLength(6);
    expect(ids.filter((i) => i.startsWith('prop:')).sort()).toEqual(wanted);
    const [w, d] = SIZE[id];
    for (const p of h.pickables) {
      expect(Math.abs(p.pos.x), p.id).toBeLessThanOrEqual(w / 2);
      expect(Math.abs(p.pos.z), p.id).toBeLessThanOrEqual(d / 2);
      expect(p.pos.y, p.id).toBeGreaterThanOrEqual(0);
      expect(p.pos.y, p.id).toBeLessThanOrEqual(2.5);
      expect(p.radius, p.id).toBeGreaterThan(0);
    }
    h.dispose();
  });

  it('the genkan: shoes on the mat and slippers on the step switch with the state; the picks go away once done', () => {
    const h = build(s);
    const meshes: Record<string, THREE.Mesh> = {};
    h.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes[o.name] = o as THREE.Mesh;
    });
    const pick = (i: string) => h.pickables.find((p) => p.id === i)!;
    // shoes are on: no pair of shoes on the mat yet, the slippers wait on the step
    expect(meshes['stage-shoes'].visible).toBe(false);
    expect(meshes['stage-slippers'].visible).toBe(true);
    expect(pick(GENKAN_SHOES_PICK).off).toBeFalsy();
    h.setState!({ shoesOff: true, slippersOn: false });
    expect(meshes['stage-shoes'].visible).toBe(true);
    expect(meshes['stage-slippers'].visible).toBe(true);
    expect(pick(GENKAN_SHOES_PICK).off).toBe(true);
    expect(pick(GENKAN_SLIPPERS_PICK).off).toBeFalsy();
    h.setState!({ shoesOff: true, slippersOn: true });
    expect(meshes['stage-slippers'].visible).toBe(false);
    expect(pick(GENKAN_SLIPPERS_PICK).off).toBe(true);
    h.setState!({ shoesOff: false, slippersOn: false });
    expect(pick(GENKAN_SHOES_PICK).off).toBe(false);
    h.dispose();
  });

  it('the shoes pick is on the mat, the slippers on the raised floor beside the step, the exit on the door', () => {
    const h = build(s);
    const at = (i: string) => h.pickables.find((p) => p.id === i)!.pos;
    expect(at(GENKAN_SHOES_PICK).z).toBeGreaterThan(s.floor.raised.z1); // the genkan strip
    expect(at(GENKAN_SLIPPERS_PICK).z).toBeLessThan(s.floor.raised.z1); // on the raised floor, a step up
    expect(at(GENKAN_SLIPPERS_PICK).y).toBeGreaterThanOrEqual(STEP);
    // the door is in a side wall, in the genkan strip, and the exit strip is next to it
    expect(Math.abs(at(STAGE_EXIT_PICK).x)).toBeGreaterThan(s.bounds.x1 - 0.1);
    expect(at(STAGE_EXIT_PICK).z).toBeGreaterThan(s.floor.raised.z1);
    h.dispose();
  });
});

describe.each(HOMES)('%s: the learner can move', (id) => {
  const s = stage(id);
  const host = s.actors[0];

  it('spawns inside the bounds, clear of every collider and of the gate, outside the exit strip, on the genkan side of the step', () => {
    expect(free(s, s.spawn.x, s.spawn.z, true)).toBe(true);
    expect(inExit(s, s.spawn.x, s.spawn.z)).toBe(false);
    expect(s.spawn.z).toBeGreaterThan(s.floor.raised.z1);
    // a comfortable margin: stepping towards the door takes a stride before it asks to leave
    const door = Math.sign(s.exit.x0 + s.exit.x1);
    const toExit = door > 0 ? s.exit.x0 - s.spawn.x : s.spawn.x - s.exit.x1;
    expect(toExit).toBeGreaterThanOrEqual(0.5);
  });

  it('keeps the host, the people and every talk spot on clear floor', () => {
    for (const a of s.actors) {
      expect(a.x, a.id).toBeGreaterThan(s.bounds.x0 - 0.3);
      expect(a.x, a.id).toBeLessThan(s.bounds.x1 + 0.3);
      expect(s.floor.raised.z1, `${a.id} stands on the raised floor`).toBeGreaterThan(a.z);
      for (const c of s.colliders) expect(hits(c, a.x, a.z, 0.3), `${a.id} vs a collider`).toBe(false);
      expect(free(s, a.talk.x, a.talk.z, false), `${a.id} talk spot`).toBe(true);
      const d = Math.hypot(a.talk.x - a.x, a.talk.z - a.z);
      expect(d, `${a.id} talk distance`).toBeGreaterThan(0.95);
      expect(d, `${a.id} talk distance`).toBeLessThan(a.radius);
    }
  });

  it('with the shoes off: spawn -> the host\'s talking spot and spawn -> the door are both open (with a 0.84 m wide walker)', () => {
    expect(reachable(s, s.spawn, (x, z) => near({ x, z }, host.talk, 0.1), false)).toBe(true);
    for (const a of s.actors) expect(reachable(s, s.spawn, (x, z) => near({ x, z }, a.talk, 0.1), false), `${a.id}`).toBe(true);
    expect(reachable(s, host.talk, (x, z) => inExit(s, x, z), false)).toBe(true);
  });

  it('with the shoes on: the gate holds the learner in the genkan, and the door is still open (no dead end)', () => {
    expect(reachable(s, s.spawn, (x, z) => near({ x, z }, host.talk, 0.2), true)).toBe(false);
    expect(reachable(s, s.spawn, (x, z) => z < s.floor.raised.z1, true)).toBe(false);
    expect(reachable(s, s.spawn, (x, z) => inExit(s, x, z), true)).toBe(true);
  });

  it('the gate is a thin wall across the whole width of the step', () => {
    expect(s.gate.x0).toBeLessThanOrEqual(s.bounds.x0);
    expect(s.gate.x1).toBeGreaterThanOrEqual(s.bounds.x1);
    expect(s.gate.z1 - s.gate.z0).toBeLessThanOrEqual(0.1);
    expect(Math.abs((s.gate.z0 + s.gate.z1) / 2 - s.floor.raised.z1)).toBeLessThan(0.05);
  });

  it('every prop is reachable: there is a standable spot within 1.5 m of it (taps are ray-based, but nothing is walled in)', () => {
    const h = build(s);
    for (const p of h.pickables.filter((q) => q.id.startsWith('prop:'))) {
      let ok = false;
      for (let dx = -1.5; dx <= 1.5 && !ok; dx += 0.1) {
        for (let dz = -1.5; dz <= 1.5 && !ok; dz += 0.1) ok = Math.hypot(dx, dz) <= 1.5 && free(s, p.pos.x + dx, p.pos.z + dz, false);
      }
      expect(ok, p.id).toBe(true);
    }
    h.dispose();
  });

  it('no two colliders leave a gap the learner could half-enter (a gap is closed or at least 0.84 m)', () => {
    const rects = [...s.colliders];
    const wallLeft: Rect = { x0: -50, x1: s.bounds.x0 - 0.3, z0: -50, z1: 50 };
    const wallRight: Rect = { x0: s.bounds.x1 + 0.3, x1: 50, z0: -50, z1: 50 };
    const wallBack: Rect = { x0: -50, x1: 50, z0: -50, z1: s.bounds.z0 - 0.3 };
    const all = [...rects, wallLeft, wallRight, wallBack];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const dx = Math.max(b.x0 - a.x1, a.x0 - b.x1);
        const dz = Math.max(b.z0 - a.z1, a.z0 - b.z1);
        if (dx >= 0 && dz >= 0) continue; // a corner apart: the diagonal is not a corridor
        const gap = Math.max(dx, dz);
        if (gap <= 1e-6) continue; // touching or overlapping: closed
        // a real corridor is only as long as the overlap of the two faces
        const overlap = dx > 0 ? Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) : Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        if (overlap <= 0) continue;
        // the corridor itself: if a third collider stands in it, it is not a corridor
        const corridor: Rect =
          dx > 0
            ? { x0: Math.min(a.x1, b.x1), x1: Math.max(a.x0, b.x0), z0: Math.max(a.z0, b.z0), z1: Math.min(a.z1, b.z1) }
            : { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), z0: Math.min(a.z1, b.z1), z1: Math.max(a.z0, b.z0) };
        if (all.some((c, k) => k !== i && k !== j && c.x0 < corridor.x1 && c.x1 > corridor.x0 && c.z0 < corridor.z1 && c.z1 > corridor.z0)) continue;
        expect(gap, `colliders ${i} and ${j}`).toBeGreaterThanOrEqual(0.84);
      }
    }
  });
});

describe('prop labels', () => {
  it('lists the six design props per home with a Japanese label and a kana reading, ids are the romaji', () => {
    expect(STAGE_PROPS.mio_1r!.map((p) => p.id)).toEqual(['kutsu', 'tsukue', 'kamera', 'poster', 'hondana', 'mado']);
    expect(STAGE_PROPS.aiko_tatami!.map((p) => p.id)).toEqual(['tatami', 'kotatsu', 'zabuton', 'shoji', 'kyusu', 'hana']);
    expect(STAGE_PROPS.kenji_flat!.map((p) => p.id)).toEqual(['chabudai', 'suihanki', 'shashin', 'yakyu', 'e', 'zabuton']);
    for (const list of Object.values(STAGE_PROPS)) {
      for (const p of list!) {
        expect(p.ja.length, p.id).toBeGreaterThan(0);
        expect(p.reading, p.id).toMatch(/^[\u3040-\u309f\u30fc]+$/); // hiragana (and the long-vowel mark), also for the katakana words
        expect(p.id, p.id).toMatch(/^[a-z]+$/);
      }
    }
    expect(STAGE_PROPS.mio_1r!.find((p) => p.id === 'hondana')).toEqual({ id: 'hondana', ja: '本棚', reading: 'ほんだな' });
  });

  it('pick ids: prop:<stage>:<prop> round-trips and a `host:` id is the character id', () => {
    expect(propPickId('mio_1r', 'kamera')).toBe('prop:mio_1r:kamera');
    expect(parsePropPick('prop:kenji_flat:suihanki')).toEqual({ stage: 'kenji_flat', prop: 'suihanki', label: { id: 'suihanki', ja: '炊飯器', reading: 'すいはんき' } });
    expect(parsePropPick('prop:kenji_flat:nothing')?.label).toBeNull();
    expect(parsePropPick('door:mio')).toBeNull();
    expect(parsePropPick('stage:exit')).toBeNull();
    expect(hostPickId('mio')).toBe('host:mio');
  });
});
