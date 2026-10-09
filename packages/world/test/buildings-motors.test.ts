// Nakamura Motors, the ramen / station ticket-machine props and the three ride meshes: what each registers with the
// world (colliders, picks, minimap, shutter, built site), that it stays where the layout says, that it is cheap, and that
// a tap on a machine reaches the pick id the app routes to a panel.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { fakeCanvas, installFakeDom } from './fakeDom';

vi.mock('three', async (importOriginal) => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: (await import('./fakeDom')).FakeRenderer }));

import { Batch } from '../src/batch';
import { createBuildCtx } from '../src/buildctx';
import { buildMotors, MOTORS_CAR_LOOKS } from '../src/buildings/motors';
import { buildProps, PROP_MACHINES } from '../src/buildings/props';
import { buildRide, RIDE_LOOKS, type RideKind } from '../src/buildings/rides';
import { addBike, addKei, BIKE, KEI_SEAT_X } from '../src/buildings/vehicles';
import { buildCity } from '../src/city';
import { BOUNDS, FRONT_Z, KEI, MOTORS_BIKES, MOTORS_CARS, NPC_SPAWNS, SHOPS, SHOP_COUNTERS, VENDING, bikeRect, keiRect, layoutColliders, shopRect, type Rect } from '../src/layout';
import { TokyoWorld, type WorldEvent } from '../src/world';

beforeAll(installFakeDom);

const motors = SHOPS.find((s) => s.id === 'motors')!;
const ramen = SHOPS.find((s) => s.id === 'ramen')!;
const station = SHOPS.find((s) => s.id === 'station')!;
const nakamura = NPC_SPAWNS.find((s) => s.id === 'nakamura')!;

const build = () => {
  const made = createBuildCtx();
  buildMotors(made.ctx, motors);
  return made;
};
const sameRect = (a: Rect, b: Rect) => ['x0', 'x1', 'z0', 'z1'].every((k) => Math.abs(a[k as keyof Rect] - b[k as keyof Rect]) < 1e-9);
const within = (inner: Rect, outer: Rect) => inner.x0 >= outer.x0 - 1e-9 && inner.x1 <= outer.x1 + 1e-9 && inner.z0 >= outer.z0 - 1e-9 && inner.z1 <= outer.z1 + 1e-9;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
/** triangles and a bounding box of whatever a batch holds (build() empties the batch) */
const measure = (b: Batch, mat: THREE.Material) => {
  const m = b.build(mat)!;
  const pos = m.geometry.getAttribute('position');
  return { tris: pos.count / 3, box: new THREE.Box3().setFromObject(m), mesh: m };
};

describe('buildMotors', () => {
  it('marks its site built, with the diorama collider, an occluder and its opening', () => {
    const { out } = build();
    expect(out.built.has('motors')).toBe(true);
    expect(out.colliders.some((c) => sameRect(c, shopRect(motors)))).toBe(true);
    expect(out.occluders).toHaveLength(1);
    expect(out.openings.get('motors')).toMatchObject({ cx: motors.cx, w: motors.w });
  });

  it('registers the 中村モータース sign pick, a bicycle pick over the bikes, and a minimap rect over the footprint', () => {
    const { out } = build();
    const sign = out.pickables.find((p) => p.id === 'motors')!;
    expect(sign).toBeDefined();
    expect(sign.pos.x).toBeCloseTo(motors.cx, 6);
    const bike = out.pickables.find((p) => p.id === 'bicycle')!;
    expect(bike.pos.x).toBeCloseTo(MOTORS_BIKES[1].x, 6);
    expect(bike.pos.z).toBeCloseTo(MOTORS_BIKES[1].z, 6);
    expect(out.mapRects).toHaveLength(1);
    expect(out.mapRects[0]).toMatchObject({ label: 'motors', ...shopRect(motors) });
  });

  it('collides the two kei cars (keiRect) and the three bikes (bikeRect), and nothing else but drums beside the shop', () => {
    const { out } = build();
    for (const c of MOTORS_CARS) expect(out.colliders.some((r) => sameRect(r, keiRect(c))), `car ${c.x}`).toBe(true);
    for (const b of MOTORS_BIKES) expect(out.colliders.some((r) => sameRect(r, bikeRect(b))), `bike ${b.x}`).toBe(true);
    expect(out.colliders).toHaveLength(1 + MOTORS_CARS.length + MOTORS_BIKES.length + 2);
  });

  it('keeps the cars inside the shop and clear of each other and of the counter; the bikes and drums outside, off the walking lane', () => {
    const { out } = build();
    const shop = shopRect(motors);
    const cars = MOTORS_CARS.map(keiRect);
    for (const c of cars) expect(within(c, shop)).toBe(true);
    expect(overlap(cars[0], cars[1])).toBe(false);
    const counter = SHOP_COUNTERS.motors!;
    for (const c of cars) expect(overlap(c, counter)).toBe(false);
    expect(KEI).toEqual({ len: 3.4, wid: 1.5 });
    const outside = out.colliders.filter((c) => !within(c, shop));
    expect(outside).toHaveLength(MOTORS_BIKES.length + 2);
    const others = layoutColliders().filter((c) => !c.id.startsWith('shop:motors') && !c.id.startsWith('bike:motors'));
    for (const c of outside) {
      expect(c.z0).toBeGreaterThanOrEqual(FRONT_Z - 0.01); // in front of the shop, never inside it
      expect(c.z1).toBeLessThan(-5); // leaves the walking lane free
      expect(c.x1).toBeLessThanOrEqual(BOUNDS.x1);
      for (const o of others) expect(overlap(c, o.rect), o.id).toBe(false);
    }
  });

  it('registers a hidden themed 準備中 shutter covering the opening, in front of the diorama', () => {
    const { ctx, out } = build();
    const shutter = out.shutters.get('motors');
    expect(shutter).toBeDefined();
    expect(shutter!.visible).toBe(false);
    expect(shutter!.parent).toBe(ctx.group);
    const box = new THREE.Box3().setFromObject(shutter!);
    const op = out.openings.get('motors')!;
    expect(box.min.x).toBeLessThanOrEqual(op.cx - op.w / 2 + 0.7);
    expect(box.max.x).toBeGreaterThanOrEqual(op.cx + op.w / 2 - 0.7);
    expect(box.max.y).toBeLessThanOrEqual(op.openH + 1e-3);
    expect(box.min.z).toBeGreaterThanOrEqual(FRONT_Z - 0.01);
    const names: string[] = [];
    let meshes = 0;
    shutter!.traverse((o) => { if ((o as THREE.Mesh).isMesh) { meshes++; names.push(o.name); } });
    expect(meshes).toBe(2); // slab + 準備中 plate
    expect(names).toContain('motors-shutter');
    expect(names).not.toContain('shutter'); // the generic name world-seams looks up
  });

  it('puts Nakamura behind the counter on a raised staff floor', () => {
    const counter = SHOP_COUNTERS.motors!;
    expect(counter.z0).toBeGreaterThan(nakamura.z);
    expect(nakamura.z).toBeGreaterThan(FRONT_Z - motors.d);
    expect(nakamura.x).toBeGreaterThan(counter.x0);
    expect(nakamura.x).toBeLessThan(counter.x1);
    const { ctx } = build();
    const m = measure(ctx.solid, ctx.toon);
    // the staff floor is a box whose top is at nakamura.y, under his spawn point
    const pos = m.mesh.geometry.getAttribute('position');
    let found = false;
    for (let i = 0; i < pos.count && !found; i++) {
      if (Math.abs(pos.getY(i) - nakamura.y!) < 1e-4 && Math.abs(pos.getX(i) - (nakamura.x + 1.8)) < 1e-3) found = true;
    }
    expect(found).toBe(true);
  });

  it('keeps all its geometry inside the footprint plus the sign, roof overhang and street-side props', () => {
    const { ctx } = build();
    const box = new THREE.Box3();
    for (const o of ctx.group.children) box.expandByObject(o);
    for (const b of [ctx.solid, ctx.glow]) box.union(measure(b, ctx.toon).box);
    const r = shopRect(motors);
    expect(box.min.x).toBeGreaterThanOrEqual(BOUNDS.x0);
    expect(box.max.x).toBeLessThanOrEqual(BOUNDS.x1);
    expect(box.min.x).toBeGreaterThanOrEqual(r.x0 - 3); // bikes by the west wall
    expect(box.max.x).toBeLessThanOrEqual(r.x1 + 3); // drums by the east wall
    expect(box.max.z).toBeLessThanOrEqual(-6.5); // the bikes' tail ends are the nearest thing to the road (bikeRect z -6.7)
    expect(box.min.z).toBeGreaterThanOrEqual(FRONT_Z - motors.d - 0.6);
    expect(box.max.y).toBeLessThanOrEqual(motors.h + 3.2);
  });

  it('is cheap: one extra draw call (the sign; the shutter is hidden), no animators, a few thousand triangles', () => {
    const { ctx, out } = build();
    const visible: THREE.Object3D[] = [];
    ctx.group.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) visible.push(o); });
    expect(visible).toHaveLength(1);
    expect(out.animators).toHaveLength(0);
    const solid = measure(ctx.solid, ctx.toon).tris;
    const glow = measure(ctx.glow, ctx.glowMat).tris;
    expect(solid + glow).toBeLessThan(8000); // Hikari Denki is about 3.5k; together they stay inside the +12k budget
    expect(solid + glow).toBeGreaterThan(2000);
  });

  it('uses no legacy shared random draws, and builds the same shop every time', () => {
    const a = createBuildCtx();
    const b = createBuildCtx();
    const before = a.ctx.R();
    buildMotors(b.ctx, motors);
    expect(b.ctx.R()).toBe(before);
    buildMotors(a.ctx, motors);
    expect(a.ctx.solid.count).toBe(b.ctx.solid.count);
    expect(a.ctx.glow.count).toBe(b.ctx.glow.count);
  });

  it('shows two cars in distinct colours', () => {
    expect(MOTORS_CAR_LOOKS).toHaveLength(MOTORS_CARS.length);
    expect(new Set(MOTORS_CAR_LOOKS.map((l) => l.body)).size).toBe(MOTORS_CAR_LOOKS.length);
    expect(MOTORS_CAR_LOOKS.every((l) => l.accent !== l.body)).toBe(true);
  });
});

describe('vehicle parts', () => {
  const dims = (fn: (s: Batch, g: Batch) => void) => {
    const s = new Batch();
    const g = new Batch();
    fn(s, g);
    const solid = measure(s, new THREE.MeshBasicMaterial());
    return { solid, glow: g.count ? measure(g, new THREE.MeshBasicMaterial()) : null };
  };

  it('a kei car is the 3.4 x 1.5 m the layout reserves, at either yaw, standing on the floor', () => {
    for (const ry of [0, Math.PI]) {
      const { solid } = dims((s, g) => addKei(s, g, 10, 20, ry, MOTORS_CAR_LOOKS[0], 0.12));
      const size = solid.box.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(KEI.len - 0.15);
      expect(size.x).toBeLessThanOrEqual(KEI.len + 0.1);
      expect(size.z).toBeLessThanOrEqual(KEI.wid + 0.2);
      expect(size.z).toBeGreaterThan(KEI.wid - 0.1);
      expect(solid.box.min.y).toBeCloseTo(0.12, 3);
      expect(solid.box.max.y).toBeLessThan(2.0); // a kei car is tall and boxy but not a van
      expect((solid.box.min.x + solid.box.max.x) / 2).toBeCloseTo(10, 1);
    }
  });

  it('a parked bike fits the 1.4 x 0.5 m bikeRect lying along its own x axis', () => {
    const { solid } = dims((s, g) => addBike(s, g, 0, 0, 0, { frame: '#3b6fb6' }));
    const size = solid.box.getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(1.3);
    expect(size.x).toBeLessThan(1.6);
    expect(size.z).toBeLessThan(0.6);
    expect(solid.box.min.y).toBeCloseTo(0, 2);
    const turned = dims((s, g) => addBike(s, g, 0, 0, Math.PI / 2, { frame: '#3b6fb6' })).solid.box.getSize(new THREE.Vector3());
    expect(turned.z).toBeCloseTo(size.x, 2); // ry PI/2 lies along z, as MOTORS_BIKES says
  });
});

describe('buildRide', () => {
  const mats = { toon: new THREE.MeshToonMaterial(), glow: new THREE.MeshBasicMaterial() };
  const kinds: RideKind[] = ['bike', 'ebike', 'car'];
  const meshesOf = (o: THREE.Object3D) => {
    const out: THREE.Mesh[] = [];
    o.traverse((c) => { if ((c as THREE.Mesh).isMesh) out.push(c as THREE.Mesh); });
    return out;
  };
  const tris = (o: THREE.Object3D) => meshesOf(o).reduce((n, m) => n + m.geometry.getAttribute('position').count / 3, 0);

  it.each(kinds)('%s: a small merged mesh from the shared materials, on the ground, longer along +z than wide', (kind) => {
    const ride = buildRide(kind, mats)!;
    expect(ride).not.toBeNull();
    const meshes = meshesOf(ride);
    expect(meshes.length).toBeGreaterThanOrEqual(1);
    expect(meshes.length).toBeLessThanOrEqual(2); // body + lamps: at most two draw calls
    for (const m of meshes) expect([mats.toon, mats.glow]).toContain(m.material);
    expect(meshes[0].material).toBe(mats.toon);
    const box = new THREE.Box3().setFromObject(ride);
    const size = box.getSize(new THREE.Vector3());
    expect(box.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(box.min.y).toBeLessThan(0.02);
    expect(size.z).toBeGreaterThan(size.x * (kind === 'car' ? 2 : 2.5));
    expect(tris(ride)).toBeLessThan(kind === 'car' ? 2000 : 1500);
    expect(tris(ride)).toBeGreaterThan(200);
  });

  it('puts the rider at the origin: the seat is under (0, 0)', () => {
    for (const kind of kinds) {
      const box = new THREE.Box3().setFromObject(buildRide(kind, mats)!);
      expect(box.min.z, kind).toBeLessThan(-0.5);
      expect(box.max.z, kind).toBeGreaterThan(0.5);
      expect(box.min.x, kind).toBeLessThan(-0.2);
      expect(box.max.x, kind).toBeGreaterThan(0.2);
    }
    const car = new THREE.Box3().setFromObject(buildRide('car', mats)!);
    expect(car.max.z).toBeCloseTo(KEI.len / 2 - KEI_SEAT_X, 1); // the bonnet is ahead of the seat
    expect(car.min.z).toBeCloseTo(-KEI.len / 2 - KEI_SEAT_X, 1);
    const bike = new THREE.Box3().setFromObject(buildRide('bike', mats)!);
    expect(bike.max.z - bike.min.z).toBeCloseTo((2 * BIKE.hubX + 2 * (BIKE.tireR + BIKE.tube)) * BIKE.rideScale, 1);
  });

  it('draws the front forward: the lamps at +z are the headlights, the tail at -z', () => {
    const car = buildRide('car', mats)!;
    const lamps = meshesOf(car).find((m) => m.material === mats.glow)!;
    const pos = lamps.geometry.getAttribute('position');
    const col = lamps.geometry.getAttribute('color');
    let head = 0;
    let tail = 0;
    for (let i = 0; i < pos.count; i++) {
      if (col.getX(i) > 0.9 && col.getY(i) > 0.9) head += pos.getZ(i) > 0 ? 1 : -1; // the pale yellow lamps
      else if (col.getX(i) > 0.9 && col.getY(i) < 0.5) tail += pos.getZ(i) < 0 ? 1 : -1; // the red ones
    }
    expect(head).toBeGreaterThan(0);
    expect(tail).toBeGreaterThan(0);
  });

  it('gives each kind its own look, the e-bike its battery and display, the car an open cabin', () => {
    expect(new Set([RIDE_LOOKS.bike.frame, RIDE_LOOKS.ebike.frame]).size).toBe(2);
    const bike = tris(buildRide('bike', mats)!);
    const ebike = tris(buildRide('ebike', mats)!);
    expect(ebike).toBeGreaterThan(bike);
    expect(RIDE_LOOKS.car.open).toBe(true);
  });

  it('is deterministic', () => {
    for (const kind of kinds) {
      const a = meshesOf(buildRide(kind, mats)!).map((m) => Array.from(m.geometry.getAttribute('position').array));
      const b = meshesOf(buildRide(kind, mats)!).map((m) => Array.from(m.geometry.getAttribute('position').array));
      expect(a).toEqual(b);
    }
  });

  it('returns null for a kind it does not know', () => {
    expect(buildRide('boat' as RideKind, mats)).toBeNull();
  });
});

describe('props: ramen and station ticket machines', () => {
  const props = () => {
    const made = createBuildCtx();
    buildProps(made.ctx);
    return made;
  };

  it('registers the ramen_machine and ticket picks, each over its machine', () => {
    const { out } = props();
    const ramenPick = out.pickables.find((p) => p.id === 'ramen_machine')!;
    const ticket = out.pickables.find((p) => p.id === 'ticket')!;
    expect(ramenPick.pos.x).toBeCloseTo(15.6, 6); // GAME_DESIGN 6.4
    expect(ramenPick.pos.x).toBeGreaterThan(ramen.cx - ramen.w / 2);
    expect(ramenPick.pos.x).toBeLessThan(ramen.cx + ramen.w / 2);
    expect(ticket.pos.x).toBeGreaterThan(station.cx - station.w / 2);
    expect(ticket.pos.x).toBeLessThan(station.cx + station.w / 2);
    for (const p of [ramenPick, ticket]) {
      expect(p.pos.z).toBeGreaterThan(FRONT_Z - 0.2);
      expect(p.pos.y).toBeGreaterThan(0.5);
      expect(p.pos.y).toBeLessThan(1.6);
      expect(p.radius).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('adds no colliders (beyond the walkable bounds), no animators, and two small sign planes as the only extra draw calls', () => {
    const { ctx, out } = props();
    expect(out.colliders).toHaveLength(0);
    expect(PROP_MACHINES.z + PROP_MACHINES.d / 2).toBeLessThan(BOUNDS.z0 + 0.1);
    expect(out.animators).toHaveLength(0);
    const visible: THREE.Object3D[] = [];
    ctx.group.traverseVisible((o) => { if ((o as THREE.Mesh).isMesh) visible.push(o); });
    expect(visible).toHaveLength(2);
    const solid = measure(ctx.solid, ctx.toon);
    expect(solid.tris).toBeLessThan(1000);
    // machines stand in the shop openings, clear of the posts and in front of the shop line
    expect(solid.box.min.z).toBeGreaterThanOrEqual(FRONT_Z - 0.1);
    expect(solid.box.max.y).toBeLessThan(2.2);
  });

  it('keeps clear of the ramen and station door posts (0.6 m trim at each end of the opening), and of the vending machines', () => {
    expect(VENDING.every((v) => Math.abs(v.x - PROP_MACHINES.ramen.x) > 1 && Math.abs(v.x - PROP_MACHINES.station.x) > 1)).toBe(true);
    for (const s of [ramen, station]) {
      const x = s === ramen ? PROP_MACHINES.ramen.x : PROP_MACHINES.station.x;
      expect(x - PROP_MACHINES.w / 2).toBeGreaterThan(s.cx - s.w / 2 + 0.6);
    }
  });
});

describe('the real city and world', () => {
  it('buildCity builds Motors and both machines, and the vending machines are still picks', () => {
    const city = buildCity();
    expect(city.built.has('motors')).toBe(true);
    expect(city.pickables.some((p) => p.id === 'motors')).toBe(true);
    expect(city.colliders.some((c) => sameRect(c, shopRect(motors)))).toBe(true);
    expect(city.mapRects.some((m) => m.label === 'motors')).toBe(true);
    const ids = city.pickables.map((p) => p.id);
    expect(ids).toContain('ramen_machine');
    expect(ids).toContain('ticket');
    expect(ids.filter((i) => i === 'vending')).toHaveLength(VENDING.length);
  });

  const nak = () => CHARACTERS.find((c) => c.id === 'nakamura')!;
  const make = (characters: unknown[] = CHARACTERS) => new TokyoWorld({ canvas: fakeCanvas(), characters: characters as never, quality: 'high' });
  type Internals = { camera: THREE.PerspectiveCamera; tap(x: number, y: number): void; rideMesh: THREE.Object3D | null; playerPos: THREE.Vector3; npcs: Array<{ id: string; avatar: { root: THREE.Object3D } }> };

  it('spawns Nakamura behind the counter once the character is registered, and not before', () => {
    const without = make(CHARACTERS.filter((c) => c.id !== 'nakamura'));
    expect(without.snapshot().npcs.map((n) => n.id)).not.toContain('nakamura');
    without.dispose();
    const world = make();
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('nakamura');
    const n = (world as unknown as Internals).npcs.find((x) => x.id === 'nakamura')!;
    expect(n.avatar.root.position.x).toBeCloseTo(nakamura.x, 3);
    expect(n.avatar.root.position.z).toBeCloseTo(nakamura.z, 3);
    expect(n.avatar.root.position.y).toBeCloseTo(nakamura.y!, 3);
    expect(nak()).toBeDefined();
    world.dispose();
  });

  it('the shutter hides Nakamura and shows the motors 準備中 plate, and opening restores him', () => {
    const world = make();
    world.setShopOpen('motors', false);
    expect(world.snapshot().npcs.map((n) => n.id)).not.toContain('nakamura');
    const city = (world as unknown as { city: { group: THREE.Group } }).city;
    const shutters: THREE.Object3D[] = [];
    city.group.traverse((o) => { if (o.name === 'motors-shutter' && o.parent) shutters.push(o.parent); });
    expect(shutters.some((g) => g.visible && Math.abs(new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3()).x - motors.cx) < 0.5)).toBe(true);
    world.setShopOpen('motors', true);
    expect(world.snapshot().npcs.map((n) => n.id)).toContain('nakamura');
    world.dispose();
  });

  it('a tap on the ramen machine and on the station kiosk emits the pick ids the app routes to the ticket panel', async () => {
    const world = make();
    const w = world as unknown as Internals;
    const events: WorldEvent[] = [];
    world.on((e) => events.push(e));
    const aim = (x: number) => {
      w.camera.position.set(x, 1.6, 2.5);
      w.camera.lookAt(x, 1.0, FRONT_Z + 0.2);
      w.camera.updateProjectionMatrix();
      w.camera.updateMatrixWorld(true);
      w.tap(200, 400); // the middle of the fake 400 x 800 canvas
    };
    aim(PROP_MACHINES.ramen.x);
    aim(PROP_MACHINES.station.x);
    const picks = events.filter((e): e is Extract<WorldEvent, { type: 'pick' }> => e.type === 'pick').map((e) => e.id);
    expect(picks).toEqual(['ramen_machine', 'ticket']);
    world.dispose();

    const { routePick } = await import('../../../apps/mobile/src/game/worldSync');
    expect(routePick(picks[0])).toEqual({ t: 'ticket', kind: 'ramen' });
    expect(routePick(picks[1])).toEqual({ t: 'ticket', kind: 'station' });
    expect(routePick('vending')).toEqual({ t: 'vending' });
  });

  it('mounts the real ride meshes under the player, follows them, and disposes their geometry (never the shared materials)', () => {
    const world = make();
    const w = world as unknown as Internals;
    const shared = (world as unknown as { city: { materials: { toon: THREE.Material; glow: THREE.Material } } }).city.materials;
    const disposed: string[] = [];
    const matSpy = vi.spyOn(shared.toon, 'dispose');
    for (const kind of ['bike', 'ebike', 'car'] as const) {
      world.setRide(kind);
      const mesh = w.rideMesh!;
      expect(mesh, kind).not.toBeNull();
      expect(mesh.name).toBe(`ride-${kind}`);
      expect(mesh.position.x).toBeCloseTo(w.playerPos.x, 5);
      expect(mesh.position.z).toBeCloseTo(w.playerPos.z, 5);
      mesh.traverse((c) => { const g = (c as THREE.Mesh).geometry; if (g) g.addEventListener('dispose', () => disposed.push(c.name)); });
    }
    world.setRide('none');
    expect(w.rideMesh).toBeNull();
    expect(disposed.length).toBeGreaterThanOrEqual(3); // the geometry of each replaced ride was released
    expect(matSpy).not.toHaveBeenCalled();
    world.dispose();
  });
});
