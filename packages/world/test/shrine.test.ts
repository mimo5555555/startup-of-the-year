// The shrine at the park's torii (Goen stage 1, docs/GOEN.md): its render budget in the park view, its picks, colliders that leave no
// slit narrower than the player (with the festival on too), nothing the street needs standing inside it, and the wish ritual's
// animations (`world.shrineRitual`): the coin, the bow, the clap, the bell, the closing shimmer and the camera shot, which cost nothing
// once they are over. Runs the real buildCity / TokyoWorld with a renderer that draws nothing.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { createBuildCtx } from '../src/buildctx';
import { buildShrine, SHRINE_RITUAL_STEPS } from '../src/buildings/shrine';
import { buildCity } from '../src/city';
import { FESTIVAL_SPOTS, FESTIVAL_STALLS, festivalExtras, stallRect, stageRect } from '../src/festival';
import { BOUNDS, DOOR_RETURN, NPC_SPAWNS, PLAYER_RADIUS, SHRINE, SHRINE_BOX_PICK, SHRINE_CHOZUYA_PICK, SHRINE_PICKS, SPOTS, WALKERS, shrineColliders, type Rect } from '../src/layout';
import { TokyoWorld } from '../src/world';

beforeAll(installFakeDom);
installFakeDom(); // the describe blocks below build a city while they are collected

/** the shrine's share of the park view: at most this many extra draw calls and triangles (the brief's budget) */
const MAX_DRAW_CALLS = 3;
const MAX_TRIANGLES = 5_000;
/** the player is 0.84 m wide: any gap between two obstacles must be at least this, or be fully closed */
const PLAYER_W = 0.84;
const EPS = 1e-6;

type Internals = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  playerPos: THREE.Vector3;
  playerHeading: number;
  player: { root: THREE.Object3D; upper: THREE.Group; armL: THREE.Group; armR: THREE.Group };
  city: { colliders: Rect[]; occluders: Array<Rect & { y0?: number; y1?: number }>; pickables: Array<{ id: string; pos: THREE.Vector3; radius: number }>; mapRects: Array<Rect & { label?: string }> };
  ritualBlend: number;
  step(dt: number): void;
  walkTo(x: number, z: number): void;
};

const make = () => {
  const world = new TokyoWorld({ canvas: fakeCanvas(), characters: CHARACTERS, quality: 'high' });
  return { world, w: world as unknown as Internals };
};
const tick = (w: Internals, seconds: number, dt = 1 / 30) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) w.step(dt);
};
const tris = (m: THREE.Mesh) => {
  const g = m.geometry;
  return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
};
const gap = (a: Rect, b: Rect) => Math.hypot(Math.max(a.x0 - b.x1, b.x0 - a.x1, 0), Math.max(a.z0 - b.z1, b.z0 - a.z1, 0));
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS;
const inside = (r: Rect, x: number, z: number) => x > r.x0 + EPS && x < r.x1 - EPS && z > r.z0 + EPS && z < r.z1 - EPS;
const hits = (r: Rect, x: number, z: number, radius: number) => {
  const dx = x - Math.min(Math.max(x, r.x0), r.x1);
  const dz = z - Math.min(Math.max(z, r.z0), r.z1);
  return dx * dx + dz * dz < radius * radius - EPS;
};
/** the open space between two rects that do not touch (the slot a player would have to squeeze through) */
const between = (a: Rect, b: Rect): Rect => ({
  x0: Math.min(a.x1, b.x1) < Math.max(a.x0, b.x0) ? Math.min(a.x1, b.x1) : Math.max(a.x0, b.x0),
  x1: Math.min(a.x1, b.x1) < Math.max(a.x0, b.x0) ? Math.max(a.x0, b.x0) : Math.min(a.x1, b.x1),
  z0: Math.min(a.z1, b.z1) < Math.max(a.z0, b.z0) ? Math.min(a.z1, b.z1) : Math.max(a.z0, b.z0),
  z1: Math.min(a.z1, b.z1) < Math.max(a.z0, b.z0) ? Math.max(a.z0, b.z0) : Math.min(a.z1, b.z1),
});

describe('the shrine: budget', () => {
  it(`adds <= ${MAX_DRAW_CALLS} draw calls and <= ${MAX_TRIANGLES} triangles to the park view (the rest is merged into the street)`, () => {
    // what the builder merges into the city's two batches, built on its own
    const { ctx } = createBuildCtx();
    const handle = buildShrine(ctx);
    const merged = [ctx.solid.build(ctx.toon), ctx.glow.build(ctx.glowMat)].filter((m): m is THREE.Mesh => !!m);
    const mergedTris = merged.reduce((n, m) => n + tris(m), 0);
    const own = handle.info();
    console.log(`shrine: ${own.meshes} own draw calls idle (plaque, bell), ${mergedTris} merged + ${own.triangles} own triangles`);
    expect(own.meshes).toBeLessThanOrEqual(MAX_DRAW_CALLS);
    expect(mergedTris + own.triangles).toBeLessThanOrEqual(MAX_TRIANGLES);
    expect(mergedTris).toBeGreaterThan(1000); // a hall, not a placeholder
  });

  it('draws nothing extra while idle: the coin and the sparkle exist only while they play, and go again', () => {
    const { world, w } = make();
    tick(w, 0.1);
    const idle = world.shrineInfo();
    expect(idle.meshes).toBe(2);
    expect(idle.busy).toBe(false);
    world.shrineRitual('coin');
    tick(w, 0.5);
    const playing = world.shrineInfo();
    expect(playing.meshes).toBeGreaterThan(idle.meshes);
    expect(playing.meshes).toBeLessThanOrEqual(idle.meshes + 2);
    for (const step of SHRINE_RITUAL_STEPS) {
      world.shrineRitual(step);
      tick(w, 0.6);
    }
    tick(w, 4);
    expect(world.shrineInfo()).toMatchObject({ meshes: idle.meshes, triangles: idle.triangles, busy: false, framing: false });
    world.dispose();
  });
});

describe('the shrine: picks, colliders, minimap', () => {
  const city = buildCity();
  const others = city.colliders.filter((c) => !shrineColliders().some((s) => s.x0 === c.x0 && s.x1 === c.x1 && s.z0 === c.z0 && s.z1 === c.z1));

  it('registers the box and the chōzuya picks where the layout says, and a minimap rect', () => {
    for (const p of SHRINE_PICKS) {
      const got = city.pickables.filter((q) => q.id === p.id);
      expect(got, p.id).toHaveLength(1);
      expect(got[0].pos.toArray()).toEqual([p.x, p.y, p.z]);
    }
    expect(SHRINE_PICKS.map((p) => p.id)).toEqual([SHRINE_BOX_PICK, SHRINE_CHOZUYA_PICK]);
    expect([SHRINE_BOX_PICK, SHRINE_CHOZUYA_PICK]).toEqual(['shrine:box', 'shrine:chozuya']);
    expect(city.mapRects.some((r) => (r as { label?: string }).label === 'shrine')).toBe(true);
  });

  it('blocks walking at the hall, the box, the ema rack and the chōzuya, inside the walkable bounds', () => {
    for (const r of shrineColliders()) {
      expect(city.colliders).toContainEqual(r);
      expect(r.x0).toBeGreaterThanOrEqual(BOUNDS.x0);
      expect(r.z1).toBeLessThanOrEqual(BOUNDS.z1);
    }
  });

  it('overlaps nothing and leaves no slit narrower than the player: flush, >= 0.84 m, or the slit is filled by another collider', () => {
    const all = [...city.colliders, ...festivalExtras().colliders];
    for (const a of shrineColliders()) {
      for (const b of all) {
        if (a.x0 === b.x0 && a.x1 === b.x1 && a.z0 === b.z0 && a.z1 === b.z1) continue;
        expect(overlap(a, b), `${JSON.stringify(a)} overlaps ${JSON.stringify(b)}`).toBe(false);
        const g = gap(a, b);
        if (g <= EPS || g >= PLAYER_W) continue;
        const slit = between(a, b);
        const cx = (slit.x0 + slit.x1) / 2;
        const cz = (slit.z0 + slit.z1) / 2;
        const filled = all.some((c) => c !== b && c !== a && cx >= c.x0 - EPS && cx <= c.x1 + EPS && cz >= c.z0 - EPS && cz <= c.z1 + EPS);
        expect(filled, `${JSON.stringify(a)} / ${JSON.stringify(b)}: an open slit of ${g.toFixed(3)} m`).toBe(true);
      }
    }
  });

  it('keeps the festival dressing clear of it (stalls, stage, people, picks), the festival being on', () => {
    const fest = festivalExtras();
    const precinct: Rect = { x0: SHRINE.hall.x0 - 0.6, x1: SHRINE.chozuya.x1 + 0.6, z0: SHRINE.hall.z0, z1: SHRINE.hall.z1 + 0.6 };
    for (const r of [...FESTIVAL_STALLS.map(stallRect), stageRect(), ...fest.occluders]) expect(overlap(r, precinct)).toBe(false);
    for (const s of [FESTIVAL_SPOTS.stage, FESTIVAL_SPOTS.mc, ...FESTIVAL_SPOTS.guests]) for (const r of shrineColliders()) expect(hits(r, s.x, s.z, PLAYER_RADIUS)).toBe(false);
    for (const p of fest.picks) expect(inside(precinct, p.pos.x, p.pos.z)).toBe(false);
  });

  it('puts nothing the street needs inside it: spawns, walker routes, spots, door returns, the stand itself', () => {
    const rects = shrineColliders();
    for (const n of NPC_SPAWNS) for (const r of rects) expect(hits(r, n.x, n.z, 0.3), n.id).toBe(false);
    for (const d of Object.values(DOOR_RETURN)) for (const r of rects) expect(hits(r, d!.x, d!.z, PLAYER_RADIUS)).toBe(false);
    // the walkers' legs: sample every route segment
    for (const wk of WALKERS) {
      const pts = wk.route.points;
      for (let i = 0; i + 1 < pts.length; i++) {
        for (let k = 0; k <= 20; k++) {
          const x = pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * k) / 20;
          const z = pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * k) / 20;
          for (const r of rects) expect(hits(r, x, z, 0.3), `walker ${wk.spec} at ${x},${z}`).toBe(false);
        }
      }
    }
    const torii = SPOTS.find((s) => s.id === 'spot:torii')!;
    expect(rects.every((r) => !inside(r, torii.x, torii.z))).toBe(true);
    // the worshipper's spot is open ground, in front of the box and facing it
    for (const c of city.colliders) expect(hits(c, SHRINE.stand.x, SHRINE.stand.z, PLAYER_RADIUS), JSON.stringify(c)).toBe(false);
    expect(SHRINE.stand.x - SHRINE.box.x1).toBeLessThan(0.6);
    expect(Math.sin(SHRINE.stand.heading)).toBeCloseTo(-1, 6); // facing west, at the box
    expect(SHRINE.stand.z).toBeGreaterThan(SHRINE.box.z0);
    expect(SHRINE.stand.z).toBeLessThan(SHRINE.box.z1);
    expect(others.length).toBe(city.colliders.length - 4);
  });

  it('moved the park bin off the stepping stones (regression: it stood at (-14.8, 11.5), on the line from the path to the box)', () => {
    const bin = (x: number, z: number) => ({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3 });
    expect(city.colliders).not.toContainEqual(bin(-14.8, 11.5));
    expect(city.colliders).toContainEqual(bin(SHRINE.bin.x, SHRINE.bin.z));
    // the walk from the path to the stand along the stand's z is clear
    for (let x = -13.6; x >= SHRINE.stand.x; x -= 0.1) for (const c of city.colliders) expect(hits(c, x, SHRINE.stand.z, PLAYER_RADIUS), `${x}`).toBe(false);
  });
});

describe('world.shrineRitual', () => {
  it('puts the player at the box facing it, plays every step and turns the camera to the ritual shot', () => {
    const { world, w } = make();
    expect(world.shrineRitual('coin')).toBe(true);
    expect(w.playerPos.x).toBeCloseTo(SHRINE.stand.x, 6);
    expect(w.playerPos.z).toBeCloseTo(SHRINE.stand.z, 6);
    expect(w.playerHeading).toBeCloseTo(SHRINE.stand.heading, 6);
    expect(world.shrineInfo().framing).toBe(true);
    tick(w, 1.5);
    expect(w.ritualBlend).toBeGreaterThan(0.9);
    // the shot frames the box from the path side, outside every camera occluder
    const c = w.camera.position;
    expect(c.x).toBeGreaterThan(SHRINE.stand.x);
    for (const o of w.city.occluders) {
      const inBox = c.x > o.x0 && c.x < o.x1 && c.z > o.z0 && c.z < o.z1 && c.y >= (o.y0 ?? 0) && c.y <= (o.y1 ?? 99);
      expect(inBox, JSON.stringify(o)).toBe(false);
    }
    world.dispose();
  });

  it('tosses the coin from the hand into the box, then sparkles there', () => {
    const { world, w } = make();
    world.shrineRitual('coin');
    const shrine = w.scene.getObjectByName('shrine')!;
    const coin = shrine.getObjectByName('shrine-coin')!;
    const spark = shrine.getObjectByName('shrine-sparkle')!;
    let maxY = 0;
    let seen = false;
    for (let i = 0; i < 40; i++) {
      w.step(1 / 30);
      if (coin.visible) {
        seen = true;
        maxY = Math.max(maxY, coin.position.y);
      }
    }
    expect(seen).toBe(true);
    expect(maxY).toBeGreaterThan(1.3); // an arc, not a drop
    tick(w, 0.3);
    expect(coin.visible).toBe(false);
    expect(spark.visible).toBe(true);
    expect(spark.position.x).toBeLessThan(SHRINE.box.x1);
    expect(spark.position.x).toBeGreaterThan(SHRINE.box.x0);
    tick(w, 1);
    expect(spark.visible).toBe(false);
    world.dispose();
  });

  it('bows deep, claps with both hands before the chest, holds the rope while the bell sways', () => {
    const { world, w } = make();
    world.shrineRitual('bow');
    tick(w, 0.75);
    expect(w.player.upper.rotation.x).toBeGreaterThan(0.6);
    tick(w, 1.2);
    world.shrineRitual('clap');
    tick(w, 0.5);
    for (const arm of [w.player.armL, w.player.armR]) expect(arm.rotation.x).toBeLessThan(-1.2);
    expect(w.player.armL.rotation.z).toBeGreaterThan(0.4); // turned in, towards the other hand
    expect(w.player.armR.rotation.z).toBeLessThan(-0.4);
    tick(w, 0.6);
    expect(Math.abs(w.player.armL.rotation.x)).toBeLessThan(0.1); // back down
    world.shrineRitual('bell');
    const bell = w.scene.getObjectByName('shrine-bell')!;
    let swing = 0;
    for (let i = 0; i < 30; i++) {
      w.step(1 / 30);
      swing = Math.max(swing, Math.abs(bell.rotation.x));
    }
    expect(swing).toBeGreaterThan(0.1);
    expect(w.player.armL.rotation.x).toBeLessThan(-1.2);
    tick(w, 3);
    expect(bell.rotation.x).toBe(0);
    world.dispose();
  });

  it("ends the shot 2.5 s after 'done', or at once when the player walks away", () => {
    const { world, w } = make();
    world.shrineRitual('done');
    tick(w, 1);
    expect(world.shrineInfo().framing).toBe(true);
    tick(w, 2);
    expect(world.shrineInfo().framing).toBe(false);
    world.shrineRitual('bow');
    tick(w, 0.2);
    w.walkTo(-12, 16);
    tick(w, 0.2);
    expect(world.shrineInfo().framing).toBe(false);
    world.dispose();
  });

  it('setShrineGuest brings Hanako beside the shrine for the wish (talkable from the stand, clear of everything) and home again', () => {
    const { world, w } = make();
    const home = world.npcPosition('hanako')!;
    world.setShrineGuest('hanako');
    expect(world.npcPosition('hanako')).toEqual({ x: SHRINE.guest.x, z: SHRINE.guest.z });
    for (const c of w.city.colliders) expect(hits(c, SHRINE.guest.x, SHRINE.guest.z, 0.3), JSON.stringify(c)).toBe(false);
    // after the ritual she is in reach without a teleport, and a teleport would also land on open ground near the shrine
    world.shrineRitual('done');
    tick(w, 0.2);
    expect(world.nearby).toBe('hanako');
    world.teleportNear('hanako');
    for (const c of w.city.colliders) expect(hits(c, w.playerPos.x, w.playerPos.z, PLAYER_RADIUS), JSON.stringify(c)).toBe(false);
    expect(Math.hypot(w.playerPos.x - SHRINE.stand.x, w.playerPos.z - SHRINE.stand.z)).toBeLessThan(2);
    world.setShrineGuest(null);
    expect(world.npcPosition('hanako')).toEqual(home);
    world.dispose();
  });

  it('does nothing inside a room, and refuses an unknown step', () => {
    const { world, w } = make();
    expect(world.enterStage('dorm')).toBe(true);
    expect(world.shrineRitual('coin')).toBe(false);
    expect(world.shrineInfo().framing).toBe(false);
    world.exitStage();
    expect(world.shrineRitual('dance' as never)).toBe(false);
    expect(w.playerPos.x).not.toBeCloseTo(SHRINE.stand.x, 3);
    world.dispose();
  });
});
