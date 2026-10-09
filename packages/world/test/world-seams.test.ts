// The TokyoWorld seams the game drives: shutters, speed boosts, rides, festival, spot events and the spawn guard.
// Runs the real TokyoWorld with a renderer that draws nothing and steps it by hand.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));
// ride meshes are slice 3B; a stand-in lets the mount/dismount path be tested now
vi.mock('../src/buildings/rides', async () => {
  const T = await import('three');
  return {
    buildRide: (kind: string) => (kind === 'car' ? null : Object.assign(new T.Mesh(new T.BoxGeometry(1, 1, 2)), { name: `ride:${kind}` })),
  };
});

import { resolveCircle } from '../src/collision';
import { TOKYO_DISTRICT, type District } from '../src/district';
import { DAY_LIGHTING, DUSK_LIGHTING, FESTIVAL_FADE_S } from '../src/festival';
import { BOUNDS, LAMPS, NPC_SPAWNS, SHOPS, SPOTS, boxRect } from '../src/layout';
import { COLORS } from '../src/palette';
import { MAX_STEP, shopIdOf, TokyoWorld, type WorldEvent } from '../src/world';

beforeAll(installFakeDom);

type Internals = {
  playerPos: THREE.Vector3;
  yaw: number;
  npcs: Array<{ id: string; hidden: boolean; shop: string | null; avatar: { root: THREE.Object3D }; badge: THREE.Sprite; label: THREE.Sprite }>;
  city: { group: THREE.Group; built: Set<string> };
  badgeTexture(k: string): THREE.Texture;
  step(dt: number): void;
  scene: THREE.Scene;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  moveTarget: THREE.Vector3 | null;
  rideMesh: THREE.Object3D | null;
};

const make = (district?: District, characters = CHARACTERS) => {
  const world = new TokyoWorld({ canvas: fakeCanvas(), characters, quality: 'high', district });
  return { world, w: world as unknown as Internals };
};
const tick = (w: Internals, frames: number, dt = 1 / 60) => {
  for (let i = 0; i < frames; i++) w.step(dt);
};
const ids = (world: TokyoWorld) => world.snapshot().npcs.map((n) => n.id).sort();
/** Tokyo plus the claim that Fuku-Fuku and Aiko's stall are built (what slices 3A/3B will do for real). */
const withNewSites: District = { ...TOKYO_DISTRICT, build: (ctx) => { TOKYO_DISTRICT.build(ctx); ctx.markBuilt('fukufuku'); ctx.markBuilt('aiko_stall'); } };

describe('NPC spawn guard: the building AND the character must be registered', () => {
  it('spawns an NPC with a site only when that building was built', () => {
    const { world, w } = make();
    const expected = NPC_SPAWNS.filter((s) => (!s.site || w.city.built.has(s.site)) && CHARACTERS.some((c) => c.id === s.id)).map((s) => s.id).sort();
    expect(ids(world)).toEqual(expected);
    // whatever is registered, an unbuilt site never gets its NPC
    for (const s of NPC_SPAWNS) if (s.site && !w.city.built.has(s.site)) expect(ids(world), s.id).not.toContain(s.id);
    world.dispose();
  });

  it('the six original characters always spawn (no site to wait for)', () => {
    const { world } = make();
    expect(ids(world)).toEqual(expect.arrayContaining(['tanaka', 'yuki', 'hanako', 'kenji', 'sato', 'mio']));
    world.dispose();
  });

  it('spawns rin and aiko once their buildings exist, aoi and nakamura because Hikari Denki and Nakamura Motors are built', () => {
    const { world } = make(withNewSites);
    expect(ids(world)).toEqual(expect.arrayContaining(['rin', 'aiko', 'aoi', 'nakamura']));
    world.dispose();
  });

  it('skips an NPC whose building exists but whose character is not registered', () => {
    const { world } = make(withNewSites, CHARACTERS.filter((c) => c.id !== 'rin'));
    expect(ids(world)).not.toContain('rin');
    expect(ids(world)).toContain('aiko');
    world.dispose();
  });
});

describe('shopIdOf', () => {
  it('maps each spawn to the shutter that hides it', () => {
    const of = (id: string) => shopIdOf(NPC_SPAWNS.find((s) => s.id === id)!, SHOPS);
    expect(of('tanaka')).toBe('konbini');
    expect(of('yuki')).toBe('cafe');
    expect(of('hanako')).toBe('school');
    expect(of('kenji')).toBe('ramen');
    expect(of('sato')).toBe('station');
    expect(of('mio')).toBeNull(); // in the park
    expect(of('rin')).toBe('fukufuku');
    expect(of('aoi')).toBe('denki');
    expect(of('nakamura')).toBe('motors');
    expect(of('aiko')).toBe('aiko'); // the stall, not a diorama
  });
});

describe('setShopOpen', () => {
  it('hides the NPC, its label and its minimap dot, and shows the padlock; opening restores them', () => {
    const { world, w } = make();
    const tanaka = () => w.npcs.find((n) => n.id === 'tanaka')!;
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('tanaka');
    world.setShopOpen('konbini', false);
    expect(world.isShopOpen('konbini')).toBe(false);
    expect(world.snapshot().npcs.map((n) => n.id)).not.toContain('tanaka');
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('yuki'); // other shops unaffected
    expect(tanaka().hidden).toBe(true);
    expect(tanaka().avatar.root.visible).toBe(false);
    expect((tanaka().badge.material as THREE.SpriteMaterial).map).toBe(w.badgeTexture('locked'));
    tick(w, 3);
    expect(tanaka().label.visible).toBe(false);
    expect(tanaka().badge.visible).toBe(true); // the padlock hangs over the door
    world.setShopOpen('konbini', true);
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('tanaka');
    expect(tanaka().avatar.root.visible).toBe(true);
    expect((tanaka().badge.material as THREE.SpriteMaterial).map).toBe(w.badgeTexture('talk')); // 'new' badges show the speech bubble
    world.dispose();
  });

  it('puts the 準備中 shutter up and takes it down', () => {
    const { world, w } = make();
    const shutter = () => w.city.group.getObjectByName('shutter')?.parent;
    expect(shutter()).toBeUndefined();
    world.setShopOpen('cafe', false);
    expect(shutter()?.visible).toBe(true);
    world.setShopOpen('cafe', true);
    expect(shutter()?.visible).toBe(false);
    world.dispose();
  });

  it('a closed shop cannot be talked to, is not "nearby", and keeps its padlock when the badge changes', () => {
    const { world, w } = make();
    world.setShopOpen('cafe', false);
    world.teleportNear('yuki');
    tick(w, 3);
    expect(world.nearby).toBeNull();
    world.enterConversation('yuki');
    expect(world.snapshot().inConversation).toBe(false);
    world.setNpcBadge('yuki', 'done');
    const yuki = w.npcs.find((n) => n.id === 'yuki')!;
    expect((yuki.badge.material as THREE.SpriteMaterial).map).toBe(w.badgeTexture('locked'));
    world.setShopOpen('cafe', true);
    expect((yuki.badge.material as THREE.SpriteMaterial).map).toBe(w.badgeTexture('done'));
    world.dispose();
  });

  it('closing the shop mid-conversation waits until the conversation ends', () => {
    const { world, w } = make();
    world.teleportNear('yuki');
    tick(w, 3);
    world.enterConversation('yuki');
    world.setShopOpen('cafe', false);
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('yuki');
    expect(w.city.group.getObjectByName('shutter')).toBeUndefined();
    world.exitConversation();
    expect(world.snapshot().npcs.map((n) => n.id)).not.toContain('yuki');
    expect(w.city.group.getObjectByName('shutter')?.parent?.visible).toBe(true);
    world.dispose();
  });

  it("hides rin with Fuku-Fuku's shutter and aiko with the 'aiko' shop, and accepts shops nobody stands in", () => {
    const { world } = make(withNewSites);
    world.setShopOpen('fukufuku', false);
    expect(ids(world)).not.toContain('rin');
    expect(ids(world)).toContain('aiko');
    world.setShopOpen('aiko', false);
    expect(ids(world)).not.toContain('aiko');
    expect(() => world.setShopOpen('motors', false)).not.toThrow();
    world.setShopOpen('fukufuku', true);
    expect(ids(world)).toContain('rin');
    world.dispose();
  });
});

describe('setMoveMultiplier: sub-steps never tunnel', () => {
  // a lamp on the north sidewalk: 0.3 m thick, the thinnest collider on the street
  const lampX = LAMPS.northX.find((x) => x === -34)!;
  const lamp = boxRect(lampX, LAMPS.northZ, LAMPS.size, LAMPS.size);
  const limit = lamp.x0 - 0.42; // the player's centre cannot get closer than its radius

  const runAt = (mult: number, startX: number, dt: number) => {
    const { world, w } = make(undefined, []);
    world.setMoveMultiplier(mult);
    w.playerPos.set(startX, 0, LAMPS.northZ);
    w.yaw = -Math.PI / 2; // forward is +x
    world.setMove(0, 1);
    let maxX = -Infinity;
    let maxFrame = 0;
    let prev = startX;
    for (let i = 0; i < 90; i++) {
      w.step(dt);
      maxX = Math.max(maxX, w.playerPos.x);
      maxFrame = Math.max(maxFrame, Math.abs(w.playerPos.x - prev));
      prev = w.playerPos.x;
    }
    world.dispose();
    return { maxX, maxFrame };
  };

  it('one big step does jump through the lamp (this is the failure the sub-steps prevent)', () => {
    const p = { x: limit - 0.01, z: LAMPS.northZ };
    p.x += 0.62; // x3 walk speed at the 0.05 s frame cap
    resolveCircle(p, 0.42, [lamp], BOUNDS);
    expect(p.x).toBeGreaterThan(lamp.x1); // came out the far side
  });

  it('x3 at the 0.05 s frame cap never gets past the lamp, from any starting phase', () => {
    for (let k = 0; k < 12; k++) {
      const { maxX, maxFrame } = runAt(3, limit - 3 + k * 0.047, 0.05);
      expect(maxFrame, `phase ${k}`).toBeGreaterThan(0.1); // it really was moving fast
      expect(maxX, `phase ${k}`).toBeLessThanOrEqual(limit + 1e-6);
    }
  });

  it('holds at the top of the range and at a 1/60 frame', () => {
    expect(runAt(10, limit - 5, 0.05).maxX).toBeLessThanOrEqual(limit + 1e-6);
    expect(runAt(2.5, limit - 3, 1 / 60).maxX).toBeLessThanOrEqual(limit + 1e-6);
  });

  it('a x1 frame is a single step, so normal movement is the same as before', () => {
    expect(4.1 * 0.05).toBeLessThan(MAX_STEP);
    const { world, w } = make(undefined, []);
    w.playerPos.set(0, 0, -6.5);
    const before = w.playerPos.clone();
    w.yaw = -Math.PI / 2;
    world.setMove(0, 1);
    tick(w, 30);
    expect(w.playerPos.x - before.x).toBeGreaterThan(1.5);
    world.dispose();
  });

  it('scales speed by the multiplier and clamps nonsense', () => {
    const dist = (mult: number) => {
      const { world, w } = make(undefined, []);
      world.setMoveMultiplier(mult);
      w.playerPos.set(-30, 0, -6.5);
      w.yaw = -Math.PI / 2;
      world.setMove(0, 1);
      tick(w, 40);
      const d = w.playerPos.x + 30;
      world.dispose();
      return d;
    };
    const d1 = dist(1);
    expect(dist(2.5) / d1).toBeGreaterThan(2.2);
    expect(dist(2.5) / d1).toBeLessThan(2.8);
    const { world } = make(undefined, []);
    world.setMoveMultiplier(Number.NaN);
    expect(world.getMoveMultiplier()).toBe(1);
    world.setMoveMultiplier(-5);
    expect(world.getMoveMultiplier()).toBeGreaterThan(0);
    world.setMoveMultiplier(1000);
    expect(world.getMoveMultiplier()).toBeLessThanOrEqual(10);
    world.dispose();
  });

  it('tap-to-move at x2.5 arrives and stops instead of orbiting the target', () => {
    const { world, w } = make(undefined, []);
    world.setMoveMultiplier(2.5);
    w.playerPos.set(-30, 0, -6.5);
    world.walkTo(-20, -6.5);
    tick(w, 240);
    expect(w.moveTarget).toBeNull();
    expect(Math.hypot(w.playerPos.x + 20, w.playerPos.z + 6.5)).toBeLessThan(1.2);
    world.dispose();
  });
});

describe('spot events', () => {
  const run = () => {
    const { world, w } = make(undefined, []);
    const spots: string[] = [];
    world.on((e: WorldEvent) => {
      if (e.type === 'spot') spots.push(e.id);
    });
    const put = (x: number, z: number, frames = 2) => {
      w.playerPos.set(x, 0, z);
      tick(w, frames);
    };
    return { world, spots, put };
  };
  const plaza = SPOTS.find((s) => s.id === 'spot:station_plaza')!;

  it('fires once when the player enters, not every frame while they stand in it', () => {
    const { world, spots, put } = run();
    put(plaza.x - 10, plaza.z);
    expect(spots).toEqual([]);
    put(plaza.x, plaza.z, 30);
    expect(spots).toEqual(['spot:station_plaza']);
    world.dispose();
  });

  it('fires again after leaving and re-entering', () => {
    const { world, spots, put } = run();
    put(plaza.x, plaza.z);
    put(plaza.x - 10, plaza.z);
    put(plaza.x, plaza.z);
    expect(spots).toEqual(['spot:station_plaza', 'spot:station_plaza']);
    world.dispose();
  });

  it('does not re-fire when the player jitters on the edge of the circle', () => {
    const { world, spots, put } = run();
    put(plaza.x - plaza.r + 0.2, plaza.z); // just inside
    for (let i = 0; i < 10; i++) {
      put(plaza.x - plaza.r - 0.1, plaza.z); // just outside, inside the exit margin
      put(plaza.x - plaza.r + 0.1, plaza.z);
    }
    expect(spots).toEqual(['spot:station_plaza']);
    world.dispose();
  });

  it('reaches every spot, including the east end of the extension (x 88) and the west end', () => {
    const { world, spots, put } = run();
    for (const s of SPOTS) {
      expect(s.x).toBeGreaterThanOrEqual(BOUNDS.x0);
      expect(s.x).toBeLessThanOrEqual(BOUNDS.x1);
      put(s.x, s.z);
    }
    expect(spots).toEqual(SPOTS.map((s) => s.id));
    world.dispose();
  });

  it('fires when the player is placed in a spot with teleportNear as well as when they walk', () => {
    const { world, w } = make(undefined, CHARACTERS);
    const spots: string[] = [];
    world.on((e) => {
      if (e.type === 'spot') spots.push(e.id);
    });
    world.teleportNear('sato'); // stands 4 m south of Sato, inside the plaza circle
    expect(spots).toEqual(['spot:station_plaza']);
    tick(w, 5);
    expect(spots).toHaveLength(1);
    world.dispose();
  });
});

describe('setRide', () => {
  it('mounts the ride mesh under the player, follows them, and removes it on dismount', () => {
    const { world, w } = make(undefined, []);
    expect(world.getRide()).toBeNull();
    world.setRide('bike');
    expect(world.getRide()).toBe('bike');
    expect(w.rideMesh?.name).toBe('ride:bike');
    expect(w.scene.children).toContain(w.rideMesh);
    w.playerPos.set(5, 0, -6.5);
    tick(w, 2);
    expect(w.rideMesh!.position.x).toBeCloseTo(w.playerPos.x, 5);
    const mesh = w.rideMesh!;
    world.setRide('ebike');
    expect(w.scene.children).not.toContain(mesh);
    expect(w.rideMesh?.name).toBe('ride:ebike');
    world.setRide(null);
    expect(w.rideMesh).toBeNull();
    expect(world.getRide()).toBeNull();
    world.setRide('bike');
    world.setRide('none');
    expect(w.rideMesh).toBeNull();
    world.dispose();
  });

  it('keeps the state when there is no mesh yet (the car stand-in) and never touches speed', () => {
    const { world, w } = make(undefined, []);
    world.setRide('car');
    expect(world.getRide()).toBe('car');
    expect(w.rideMesh).toBeNull();
    expect(world.getMoveMultiplier()).toBe(1);
    world.dispose();
  });
});

describe('setFestival and the dusk preset', () => {
  const colour = (c: THREE.Color) => `#${c.getHexString()}`;
  const hex = (s: string) => `#${new THREE.Color(s).getHexString()}`;
  const sky = (w: Internals) => (w.city as unknown as { sky: THREE.Mesh }).sky.material as THREE.ShaderMaterial;

  it('starts as the day look, with the original colours and light levels', () => {
    const { world, w } = make(undefined, []);
    expect(world.isFestival()).toBe(false);
    expect(colour(w.scene.fog!.color)).toBe(hex(COLORS.fog));
    expect(colour(w.hemi.color)).toBe(hex(COLORS.hemiSky));
    expect(colour(w.hemi.groundColor)).toBe(hex(COLORS.hemiGround));
    expect(colour(w.sun.color)).toBe(hex(COLORS.sun));
    expect(w.hemi.intensity).toBe(1.95);
    expect(w.sun.intensity).toBe(2.2);
    expect(colour(sky(w).uniforms.top.value)).toBe(hex(COLORS.sky.top));
    world.dispose();
  });

  it('applies the dusk preset to the sky, fog, hemisphere and sun, and returns to the day look exactly', () => {
    const { world, w } = make(undefined, []);
    world.setFestival(true, true);
    expect(world.isFestival()).toBe(true);
    expect(colour(w.scene.fog!.color)).toBe(hex(DUSK_LIGHTING.fog));
    expect(colour(w.scene.background as THREE.Color)).toBe(hex(DUSK_LIGHTING.fog));
    expect(colour(sky(w).uniforms.top.value)).toBe(hex(DUSK_LIGHTING.sky.top));
    expect(colour(sky(w).uniforms.bottom.value)).toBe(hex(DUSK_LIGHTING.sky.bottom));
    expect(colour(w.hemi.color)).toBe(hex(DUSK_LIGHTING.hemiSky));
    expect(colour(w.sun.color)).toBe(hex(DUSK_LIGHTING.sun));
    expect(w.hemi.intensity).toBeCloseTo(1.95 * DUSK_LIGHTING.hemiK, 9);
    expect(w.sun.intensity).toBeCloseTo(2.2 * DUSK_LIGHTING.sunK, 9);
    world.setFestival(false, true);
    expect(world.isFestival()).toBe(false);
    expect(colour(w.scene.fog!.color)).toBe(hex(DAY_LIGHTING.fog));
    expect(colour(sky(w).uniforms.mid.value)).toBe(hex(COLORS.sky.mid));
    expect(colour(w.sun.color)).toBe(hex(COLORS.sun));
    expect(w.hemi.intensity).toBe(1.95);
    expect(w.sun.intensity).toBe(2.2);
    world.dispose();
  });

  it('lowers the sun at dusk', () => {
    const { world, w } = make(undefined, []);
    const elevation = () => (w.city as unknown as { sunDir: THREE.Vector3 }).sunDir.y;
    const day = elevation();
    world.setFestival(true, true);
    expect(elevation()).toBeLessThan(day);
    world.setFestival(false, true);
    expect(elevation()).toBeCloseTo(day, 9);
    world.dispose();
  });

  it('fades over FESTIVAL_FADE_S seconds, in both directions', () => {
    const { world, w } = make(undefined, []);
    world.setFestival(true);
    expect(colour(w.scene.fog!.color)).toBe(hex(COLORS.fog)); // nothing has happened yet
    tick(w, 10, 0.05); // 0.5 s
    const mid = colour(w.scene.fog!.color);
    expect(mid).not.toBe(hex(COLORS.fog));
    expect(mid).not.toBe(hex(DUSK_LIGHTING.fog));
    tick(w, Math.ceil(FESTIVAL_FADE_S / 0.05) + 2, 0.05);
    expect(colour(w.scene.fog!.color)).toBe(hex(DUSK_LIGHTING.fog));
    world.setFestival(false);
    tick(w, Math.ceil(FESTIVAL_FADE_S / 0.05) + 2, 0.05);
    expect(colour(w.scene.fog!.color)).toBe(hex(COLORS.fog));
    world.dispose();
  });

  it('keeps the quality-dependent light levels under the preset', () => {
    const { world, w } = make(undefined, []);
    world.setFestival(true, true);
    world.setQuality('low', true);
    expect(w.hemi.intensity).toBeCloseTo(2.3 * DUSK_LIGHTING.hemiK, 9);
    expect(w.sun.intensity).toBeCloseTo(1.2 * DUSK_LIGHTING.sunK, 9);
    world.setFestival(false, true);
    expect(w.hemi.intensity).toBe(2.3);
    world.dispose();
  });

  it('builds the festival scenery lazily and shows it only while the festival is on', () => {
    const { world, w } = make(undefined, []);
    const before = w.scene.children.length;
    world.setFestival(true, true);
    expect(w.scene.children.length).toBe(before + 1);
    const group = w.scene.children[w.scene.children.length - 1];
    expect(group.visible).toBe(true);
    world.setFestival(false, true);
    expect(group.visible).toBe(false);
    world.setFestival(true, true);
    expect(w.scene.children.length).toBe(before + 1); // not rebuilt
    world.dispose();
  });
});

describe('an unchanged street', () => {
  it('walks, collides and talks as before: the world boots with every original NPC and no new events', () => {
    const { world, w } = make();
    const events: WorldEvent['type'][] = [];
    world.on((e) => events.push(e.type));
    tick(w, 30);
    expect(events.filter((t) => t === 'spot')).toEqual([]);
    world.teleportNear('hanako');
    expect(world.nearby).toBe('hanako');
    world.enterConversation('hanako');
    expect(world.snapshot().inConversation).toBe(true);
    world.exitConversation();
    world.dispose();
  });
});
