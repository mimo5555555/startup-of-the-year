// The stage engine in TokyoWorld (§8.8): enterStage / exitStage / currentStage, the swap of colliders, bounds, camera and
// people, the genkan state and gate, picking in a room, the leave event, the leak check, and a fallback when a stage will not
// build. Runs the real world with a renderer that draws nothing and steps it by hand.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { DOOR_RETURN, PLAYER_START } from '../src/layout';
import { STAGES } from '../src/stages';
import type { Stage, StageId } from '../src/stage';
import { TokyoWorld, type WorldEvent } from '../src/world';

beforeAll(installFakeDom);

type Internals = {
  playerPos: THREE.Vector3;
  playerHeading: number;
  yaw: number;
  dist: number;
  pitch: number;
  convBlend: number;
  moveTarget: THREE.Vector3 | null;
  stick: THREE.Vector2;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  npcs: Array<{ id: string; avatar: { root: THREE.Object3D }; badge: THREE.Sprite; label: THREE.Sprite }>;
  walkers: Array<{ avatar: { root: THREE.Object3D } }>;
  sparkles: Array<{ id: string; sprite: THREE.Sprite }>;
  city: { group: THREE.Group };
  festivalScenery: { group: THREE.Group } | null;
  stage: { def: Stage; handle: { group: THREE.Group; pickables: Array<{ id: string; pos: THREE.Vector3; off?: boolean }> }; npcs: Array<{ id: string; avatar: { root: THREE.Object3D }; badge: THREE.Sprite; label: THREE.Sprite }>; sparkles: Array<{ id: string; sprite: THREE.Sprite }> } | null;
  step(dt: number): void;
  tap(x: number, y: number): void;
  renderer: { clearColor?: unknown };
};

const make = (stages?: Partial<Record<StageId, Stage>>) => {
  const world = new TokyoWorld({ canvas: fakeCanvas(), characters: CHARACTERS, quality: 'high', stages });
  const w = world as unknown as Internals;
  const events: WorldEvent[] = [];
  world.on((e) => events.push(e));
  return { world, w, events };
};
const tick = (w: Internals, frames: number, dt = 1 / 60) => {
  for (let i = 0; i < frames; i++) w.step(dt);
  w.scene.updateMatrixWorld(true);
  w.camera.updateMatrixWorld();
};
/** hold the stick for a while: stick y +1 walks along the camera's forward (-z at yaw 0) */
const walk = (world: TokyoWorld, w: Internals, x: number, y: number, frames: number) => {
  world.setMove(x, y);
  tick(w, frames);
  world.setMove(0, 0);
};
const kinds = (events: WorldEvent[]) => events.filter((e) => e.type === 'stage').map((e) => (e as Extract<WorldEvent, { type: 'stage' }>).phase);
/** the scene graph's size: objects, meshes and sprites (what a leak would grow) */
const census = (scene: THREE.Scene) => {
  let objects = 0;
  let meshes = 0;
  let sprites = 0;
  let lights = 0;
  scene.traverse((o) => {
    objects++;
    if ((o as THREE.Mesh).isMesh) meshes++;
    if ((o as THREE.Sprite).isSprite) sprites++;
    if ((o as THREE.Light).isLight) lights++;
  });
  return { objects, meshes, sprites, lights, children: scene.children.length };
};

describe('enterStage', () => {
  it('goes inside: the street is hidden, the player stands at the spawn on the genkan, the people of the room are there', () => {
    const { world, w, events } = make();
    expect(world.currentStage()).toBeNull();
    expect(world.enterStage('mio_1r')).toBe(true);
    expect(world.currentStage()).toBe('mio_1r');
    const def = STAGES.mio_1r!;
    expect(kinds(events)).toEqual(['enter']);
    expect(w.city.group.visible).toBe(false);
    expect(w.npcs.every((n) => !n.avatar.root.visible && !n.badge.visible && !n.label.visible)).toBe(true);
    expect(w.walkers.every((x) => !x.avatar.root.visible)).toBe(true);
    expect(w.sparkles.every((s) => !s.sprite.visible)).toBe(true);
    expect(w.sun.visible).toBe(false);
    expect(w.hemi.visible).toBe(false);
    expect(w.playerPos.x).toBeCloseTo(def.spawn.x, 6);
    expect(w.playerPos.z).toBeCloseTo(def.spawn.z, 6);
    expect(w.playerPos.y).toBe(0); // the genkan is at floor level
    const snap = world.snapshot();
    expect(snap.stage).toBe('mio_1r');
    expect(snap.npcs).toEqual([]); // nothing to put on the street's minimap
    expect(snap.player.x).toBeCloseTo(def.spawn.x, 6);
    expect(world.stageInfo()!.people).toEqual(['mio']);
    expect(world.getStageState()).toEqual({ shoesOff: false, slippersOn: false });
    world.dispose();
  });

  it('returns false for a stage that is unknown, not built yet (the dorm, the Ono flat) or fails to build, and stays on the street', () => {
    const boom: Stage = { ...STAGES.mio_1r!, id: 'dorm', build: () => { throw new Error('no GL'); } };
    const { world, w, events } = make({ ...STAGES, dorm: boom });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(world.enterStage('ono_flat')).toBe(false); // not registered
    expect(world.enterStage('nonsense' as StageId)).toBe(false);
    expect(world.enterStage('dorm')).toBe(false); // build throws: the app shows the panel fallback
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    expect(world.currentStage()).toBeNull();
    expect(w.city.group.visible).toBe(true);
    expect(w.sun.visible).toBe(true);
    expect(kinds(events)).toEqual([]);
    expect(world.exitStage()).toBe(false);
    // and the street still works afterwards
    tick(w, 5);
    expect(world.snapshot().npcs.length).toBeGreaterThan(0);
    world.dispose();
  });

  it('entering the stage you are in is a no-op; entering another leaves the first one', () => {
    const { world, events } = make();
    expect(world.enterStage('mio_1r')).toBe(true);
    expect(world.enterStage('mio_1r')).toBe(true);
    expect(kinds(events)).toEqual(['enter']);
    expect(world.enterStage('kenji_flat')).toBe(true);
    expect(kinds(events)).toEqual(['enter', 'exit', 'enter']);
    expect(world.currentStage()).toBe('kenji_flat');
    expect(world.stageInfo()!.people).toEqual(['kenji', 'hina']);
    world.dispose();
  });

  it('starts the genkan as asked (e.g. a return visit that skips it), with the gate open', () => {
    const { world, w } = make();
    world.enterStage('aiko_tatami', { state: { shoesOff: true, slippersOn: true } });
    expect(world.getStageState()).toEqual({ shoesOff: true, slippersOn: true });
    expect(w.stage!.def.id).toBe('aiko_tatami');
    expect(world.stageInfo()!.picks).not.toContain('genkan:shoes');
    expect(world.stageInfo()!.picks).not.toContain('genkan:slippers');
    world.dispose();
  });

  it('puts the camera in front of the room at the design distance, inside its limits, and limits the orbit', () => {
    const { world, w } = make();
    world.enterStage('mio_1r');
    const cam = STAGES.mio_1r!.camera;
    expect(w.yaw).toBe(0);
    expect(w.pitch).toBeCloseTo(cam.pitch, 6);
    expect(w.dist).toBeGreaterThanOrEqual(cam.dist); // the phone's portrait view stands back
    expect(w.dist).toBeLessThanOrEqual(cam.maxDist);
    tick(w, 30);
    expect(w.camera.position.z).toBeGreaterThan(w.playerPos.z); // on the open (genkan) side
    expect(w.camera.position.y).toBeGreaterThan(2);
    world.dispose();
  });
});

describe('moving in a room', () => {
  it('keeps the player inside the room\'s bounds and out of its furniture, whatever the stick says', () => {
    const { world, w } = make();
    world.enterStage('mio_1r', { state: { shoesOff: true } });
    const def = STAGES.mio_1r!;
    for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [-1, -1]] as const) {
      walk(world, w, sx, sy, 400);
      expect(w.playerPos.x).toBeGreaterThanOrEqual(def.bounds.x0 - 1e-6);
      expect(w.playerPos.x).toBeLessThanOrEqual(def.bounds.x1 + 1e-6);
      expect(w.playerPos.z).toBeGreaterThanOrEqual(def.bounds.z0 - 1e-6);
      expect(w.playerPos.z).toBeLessThanOrEqual(def.bounds.z1 + 1e-6);
      for (const c of def.colliders) {
        const dx = w.playerPos.x - Math.min(Math.max(w.playerPos.x, c.x0), c.x1);
        const dz = w.playerPos.z - Math.min(Math.max(w.playerPos.z, c.z0), c.z1);
        expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(0.42 - 1e-6);
      }
    }
    world.dispose();
  });

  it('the shoes on, the step is a wall: the learner cannot walk up to the host; the shoes off, they can, and they stand 0.15 m higher', () => {
    const { world, w } = make();
    world.enterStage('mio_1r');
    const def = STAGES.mio_1r!;
    // forward from the spawn at yaw 0 is -z: straight at the step
    walk(world, w, 0, 1, 300);
    expect(w.playerPos.z).toBeGreaterThan(def.floor.raised.z1); // still in the genkan
    expect(w.playerPos.y).toBeLessThan(0.01);
    world.setStageState({ shoesOff: true });
    walk(world, w, 0, 1, 300);
    expect(w.playerPos.z).toBeLessThan(def.floor.raised.z1 - 0.5);
    expect(w.playerPos.y).toBeCloseTo(0.15, 2);
    world.setStageState({ shoesOff: false }); // shoes back on (e.g. the app resets): the gate is back
    expect(world.getStageState()!.shoesOff).toBe(false);
    world.dispose();
  });

  it('a tap on the floor walks there; a tap beyond the wall is clamped to the bounds', () => {
    const { world, w } = make();
    world.enterStage('kenji_flat', { state: { shoesOff: true } });
    tick(w, 10);
    // project a floor point two metres in front of the player to the screen and tap it
    const target = new THREE.Vector3(w.playerPos.x - 0.6, 0.1, w.playerPos.z - 1.2);
    const p = target.clone().project(w.camera);
    w.tap(((p.x + 1) / 2) * 400, ((1 - p.y) / 2) * 800);
    expect(w.moveTarget).not.toBeNull();
    const def = STAGES.kenji_flat!;
    expect(w.moveTarget!.x).toBeGreaterThanOrEqual(def.bounds.x0);
    expect(w.moveTarget!.x).toBeLessThanOrEqual(def.bounds.x1);
    tick(w, 240);
    expect(Math.hypot(w.playerPos.x - target.x, w.playerPos.z - target.z)).toBeLessThan(0.5);
    world.dispose();
  });
});

describe('the door and leaving', () => {
  it('walking into the door strip emits one leave event per entry, and the world does not exit by itself', () => {
    const { world, w, events } = make();
    world.enterStage('mio_1r');
    const def = STAGES.mio_1r!;
    tick(w, 5);
    expect(kinds(events)).toEqual(['enter']); // the spawn is outside the strip
    // the door is on the right (+x): walk right along the camera's x
    walk(world, w, 1, 0, 120);
    expect(w.playerPos.x).toBeGreaterThanOrEqual(def.exit.x0);
    expect(kinds(events)).toEqual(['enter', 'leave']);
    walk(world, w, 1, 0, 60); // standing in it does not repeat the event
    expect(kinds(events)).toEqual(['enter', 'leave']);
    expect(world.currentStage()).toBe('mio_1r');
    walk(world, w, -1, 0, 120); // out of the strip, then back in: it fires again
    walk(world, w, 1, 0, 120);
    expect(kinds(events)).toEqual(['enter', 'leave', 'leave']);
    expect((events.find((e) => e.type === 'stage' && e.phase === 'leave') as { id: string }).id).toBe('mio_1r');
    world.dispose();
  });

  it('exitStage puts the player on the walkable strip in front of the door, facing away, with the street back as it was', () => {
    const { world, w, events } = make();
    world.setFestival(true, true);
    const before = census(w.scene);
    const seen: StageId[] = [];
    const off = world.onStageExit((id) => seen.push(id));
    for (const [id, door] of [['mio_1r', 'door:mio'], ['kenji_flat', 'door:kenji'], ['aiko_tatami', 'door:aiko']] as const) {
      world.enterStage(id);
      tick(w, 5);
      expect(world.exitStage()).toBe(true);
      const at = DOOR_RETURN[door]!;
      expect(w.playerPos.x).toBeCloseTo(at.x, 3);
      expect(w.playerPos.z).toBeCloseTo(at.z, 3);
      expect(w.playerPos.y).toBe(0);
      expect(w.playerHeading).toBeCloseTo(at.heading, 6);
      expect(world.currentStage()).toBeNull();
      expect(w.city.group.visible).toBe(true);
      expect(w.sun.visible).toBe(true);
      expect(w.hemi.visible).toBe(true);
      expect(w.npcs.every((n) => n.avatar.root.visible)).toBe(true);
      expect(w.walkers.every((x) => x.avatar.root.visible)).toBe(true);
      expect(world.snapshot().stage).toBeNull();
      expect(world.snapshot().npcs.length).toBeGreaterThan(0);
    }
    off();
    expect(seen).toEqual(['mio_1r', 'kenji_flat', 'aiko_tatami']);
    expect(kinds(events)).toEqual(['enter', 'exit', 'enter', 'exit', 'enter', 'exit']);
    expect(census(w.scene)).toEqual(before);
    world.dispose();
  });

  it('exitStage({toPrevious}) goes back to where the player stood before entering', () => {
    const { world, w } = make();
    w.playerPos.set(PLAYER_START.x, 0, PLAYER_START.z);
    world.enterStage('mio_1r');
    world.exitStage({ toPrevious: true });
    expect(w.playerPos.x).toBeCloseTo(PLAYER_START.x, 6);
    expect(w.playerPos.z).toBeCloseTo(PLAYER_START.z, 6);
    world.dispose();
  });

  it('regression: coming out does not swoop the camera round a street NPC when a conversation had just ended in the room', () => {
    const { world, w } = make();
    world.enterStage('mio_1r', { state: { shoesOff: true, slippersOn: true } });
    world.teleportNear('mio');
    world.enterConversation('mio');
    tick(w, 120);
    expect(w.convBlend).toBeGreaterThan(0.9);
    world.exitConversation();
    world.exitStage(); // before the conversation blend has run down
    expect(w.convBlend).toBe(0);
    tick(w, 6);
    // the camera looks at the player, not along the street towards whichever NPC is first in the list
    const look = (w as unknown as { camLook: THREE.Vector3 }).camLook;
    expect(look.distanceTo(w.playerPos)).toBeLessThan(3);
    expect(w.camera.position.distanceTo(w.playerPos)).toBeLessThan(11);
    world.dispose();
  });
});

describe('the leak check', () => {
  it('20 rounds of enter / look around / exit leave the scene exactly as it was, and everything the stage made is disposed', () => {
    const { world, w } = make();
    const before = census(w.scene);
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    const disposed = new Set<unknown>();
    const watch = (o: THREE.Object3D) =>
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        const sp = c as THREE.Sprite;
        if (m.geometry && !sp.isSprite && !geos.has(m.geometry)) { // every sprite shares one built-in quad
          geos.add(m.geometry);
          m.geometry.addEventListener('dispose', () => disposed.add(m.geometry));
        }
        for (const mat of ([] as THREE.Material[]).concat(m.material ?? [])) {
          // the shared toon, blob and glow materials and the cached label and badge textures belong to the world and the city
          const shared = w as unknown as { toon: THREE.Material; blobMat: THREE.Material; city: { materials: { glow: THREE.Material } } };
          if (mat === shared.toon || mat === shared.blobMat || mat === shared.city.materials.glow) continue;
          if (!mats.has(mat)) {
            mats.add(mat);
            mat.addEventListener('dispose', () => disposed.add(mat));
          }
        }
        if (sp.isSprite && !mats.has(sp.material)) {
          mats.add(sp.material);
          sp.material.addEventListener('dispose', () => disposed.add(sp.material));
        }
      });
    for (let i = 0; i < 20; i++) {
      const id = (['mio_1r', 'aiko_tatami', 'kenji_flat'] as const)[i % 3];
      expect(world.enterStage(id)).toBe(true);
      const st = w.stage!;
      watch(st.handle.group);
      for (const n of st.npcs) watch(n.avatar.root), watch(n.badge), watch(n.label);
      for (const s of st.sparkles) watch(s.sprite);
      world.setStageState({ shoesOff: i % 2 === 0, slippersOn: i % 4 === 0 });
      tick(w, 20);
      if (i % 5 === 0) {
        world.teleportNear(STAGES[id]!.actors[0].id);
        world.enterConversation(STAGES[id]!.actors[0].id);
        tick(w, 30);
        world.exitConversation();
      }
      expect(world.exitStage()).toBe(true);
    }
    expect(census(w.scene)).toEqual(before);
    expect(geos.size).toBeGreaterThan(40); // 20 rooms and their people, so the watch really saw them
    for (const g of geos) expect(disposed.has(g), 'a geometry was not disposed').toBe(true);
    for (const m of mats) expect(disposed.has(m), 'a material was not disposed').toBe(true);
    world.dispose();
  });

  it('world.dispose() inside a room frees the room too', () => {
    const { world, w } = make();
    world.enterStage('kenji_flat');
    const geos: THREE.BufferGeometry[] = [];
    const flags: boolean[] = [];
    w.stage!.handle.group.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g) {
        geos.push(g);
        flags.push(false);
        g.addEventListener('dispose', () => (flags[geos.indexOf(g)] = true));
      }
    });
    world.dispose();
    expect(geos.length).toBeGreaterThan(0);
    expect(flags.every(Boolean)).toBe(true);
  });
});

describe('picking in a room', () => {
  const screenOf = (w: Internals, p: THREE.Vector3) => {
    const v = p.clone().project(w.camera);
    return { x: ((v.x + 1) / 2) * 400, y: ((1 - v.y) / 2) * 800 };
  };

  it('a tap on each prop, the door, the shoes and the slippers is the pick with that id, the nearest to the finger wins', () => {
    for (const id of ['mio_1r', 'aiko_tatami', 'kenji_flat'] as const) {
      const { world, w, events } = make();
      world.enterStage(id);
      tick(w, 60);
      // the people are in the way of nothing here: look at each pick from the spawn camera
      for (const p of w.stage!.handle.pickables) {
        events.length = 0;
        const s = screenOf(w, p.pos);
        w.tap(s.x, s.y);
        const picks = events.filter((e) => e.type === 'pick').map((e) => (e as { id: string }).id);
        // another body in front of the pick turns the tap into the host pick (that is the host's own test below)
        expect(picks.length, `${id} ${p.id}`).toBe(1);
        expect(picks[0] === p.id || picks[0].startsWith('host:'), `${id}: tapped ${p.id}, got ${picks[0]}`).toBe(true);
      }
      world.dispose();
    }
  });

  it('a pick that is switched off cannot be tapped and has no sparkle; the genkan picks go off with the state', () => {
    const { world, w, events } = make();
    world.enterStage('mio_1r');
    tick(w, 30);
    const shoes = w.stage!.handle.pickables.find((p) => p.id === 'genkan:shoes')!;
    const vis = (pick: string) => w.stage!.sparkles.find((s) => s.id === pick)!.sprite.visible;
    expect(vis('genkan:shoes')).toBe(true);
    world.setStageState({ shoesOff: true });
    tick(w, 5);
    expect(vis('genkan:shoes')).toBe(false);
    expect(vis('genkan:slippers')).toBe(true);
    events.length = 0;
    const s = screenOf(w, shoes.pos);
    w.tap(s.x, s.y);
    expect(events.filter((e) => e.type === 'pick' && e.id === 'genkan:shoes')).toEqual([]);
    world.setStageState({ slippersOn: true });
    tick(w, 5);
    expect(vis('genkan:slippers')).toBe(false);
    world.dispose();
  });

  it('a tap on the host is the pick host:<id> (and walks up to them); Hina is host:hina', () => {
    const { world, w, events } = make();
    world.enterStage('kenji_flat', { state: { shoesOff: true } });
    tick(w, 60);
    for (const id of ['kenji', 'hina']) {
      events.length = 0;
      const npc = w.stage!.npcs.find((n) => n.id === id)!;
      const s = screenOf(w, new THREE.Vector3(npc.avatar.root.position.x, npc.avatar.root.position.y + (id === 'hina' ? 0.5 : 1.1), npc.avatar.root.position.z));
      w.tap(s.x, s.y);
      expect(events.filter((e) => e.type === 'pick').map((e) => (e as { id: string }).id), id).toEqual([`host:${id}`]);
      expect(w.moveTarget).not.toBeNull();
    }
    world.dispose();
  });
});

describe('people in a room', () => {
  it('the host turns to the learner who comes near, `nearby` fires inside the talk range, and the talking helpers find the host by id', () => {
    const { world, w, events } = make();
    world.enterStage('aiko_tatami', { state: { shoesOff: true, slippersOn: true } });
    tick(w, 5);
    world.teleportNear('aiko');
    tick(w, 60);
    expect(world.nearby).toBe('aiko');
    expect(events.some((e) => e.type === 'nearby' && e.id === 'aiko')).toBe(true);
    const def = STAGES.aiko_tatami!;
    expect(w.playerPos.x).toBeCloseTo(def.actors[0].talk.x, 6);
    expect(w.playerPos.z).toBeCloseTo(def.actors[0].talk.z, 6);
    expect(w.playerPos.y).toBeCloseTo(0.15, 2);
    const host = w.stage!.npcs[0].avatar.root;
    const toPlayer = Math.atan2(w.playerPos.x - host.position.x, w.playerPos.z - host.position.z);
    expect(Math.cos(host.rotation.y - toPlayer)).toBeGreaterThan(0.9); // facing the learner
    world.enterConversation('aiko');
    world.setSpeaker('aiko', true);
    world.setEmotion('aiko', 'happy');
    world.npcWave('aiko');
    world.setNpcBadge('aiko', 'done'); // the street's Aiko: a stage person carries no bubble
    expect(w.stage!.npcs[0].badge.visible).toBe(false);
    tick(w, 120);
    expect(world.snapshot().inConversation).toBe(true);
    for (const v of w.camera.position.toArray()) expect(Number.isFinite(v)).toBe(true);
    // the conversation camera is in front of the room, both people in view
    for (const p of [w.playerPos, host.position]) {
      const ndc = p.clone().add(new THREE.Vector3(0, 1.1, 0)).project(w.camera);
      expect(Math.abs(ndc.x), 'in view across').toBeLessThan(1);
      expect(ndc.z).toBeLessThan(1);
    }
    world.exitConversation();
    world.dispose();
  });

  it('Hina is a small avatar with her label and badge lower than a grown-up\'s', () => {
    const { world, w } = make();
    world.enterStage('kenji_flat');
    tick(w, 30);
    const [kenji, hina] = w.stage!.npcs;
    expect(hina.id).toBe('hina');
    expect(hina.avatar.root.scale.y).toBeLessThan(0.7);
    expect(hina.label.position.y).toBeLessThan(kenji.label.position.y - 0.5);
    world.dispose();
  });
});

describe('day, night and settings while inside', () => {
  it('the festival keeps its scenery out of the room and shows it again outside; quality changes do not break the room', () => {
    const { world, w } = make();
    world.enterStage('mio_1r');
    world.setFestival(true, true);
    expect(w.festivalScenery!.group.visible).toBe(false);
    tick(w, 30);
    expect(w.sun.visible).toBe(false); // the lighting update does not switch the street's lights back on
    expect(w.hemi.visible).toBe(false);
    world.setQuality('low');
    world.setQuality('high');
    tick(w, 10);
    expect(world.currentStage()).toBe('mio_1r');
    world.exitStage();
    expect(w.festivalScenery!.group.visible).toBe(true);
    expect(w.sun.visible).toBe(true);
    world.setFestival(false, true);
    tick(w, 5);
    expect(w.festivalScenery!.group.visible).toBe(false);
    world.dispose();
  });

  it('a ride is put away in the room and comes back on the street', () => {
    const { world, w } = make();
    world.setRide('bike');
    const ride = (w as unknown as { rideMesh: THREE.Object3D | null }).rideMesh;
    if (!ride) return; // the ride meshes are built by buildings/rides.ts; nothing to check if it makes none
    world.enterStage('mio_1r');
    expect(ride.visible).toBe(false);
    world.setRide('ebike'); // changing the ride in the room stays hidden
    expect((w as unknown as { rideMesh: THREE.Object3D }).rideMesh.visible).toBe(false);
    world.exitStage();
    expect((w as unknown as { rideMesh: THREE.Object3D }).rideMesh.visible).toBe(true);
    world.dispose();
  });
});
