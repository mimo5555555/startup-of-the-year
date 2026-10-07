// The city-side seams: BuildCtx, the building registry, FRONT_OVERRIDES and the §6.4 fixes that live in city.ts.
// Runs the real buildCity() against a stub DOM (see fakeDom.ts).
import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { installFakeDom } from './fakeDom';
import { createBuildCtx } from '../src/buildctx';
import { buildBuildings, buildRide, FRONT_OVERRIDES, FRONT_STYLES, SHOP_BUILDERS } from '../src/buildings';
import { buildCity, type City } from '../src/city';
import { TOKYO_DISTRICT, type District } from '../src/district';
import { BOUNDS, FRONT_Z, GROUND_X, LAMPS, POLES, SHOPS, SKYLINE, SOUTH_FRONTS, TRAFFIC, VENDING, boxRect, layoutColliders, shopRect, type Rect, type ShopDef } from '../src/layout';

beforeAll(installFakeDom);

const same = (a: Rect, b: Rect) => (['x0', 'x1', 'z0', 'z1'] as const).every((k) => Math.abs(a[k] - b[k]) < 1e-9);
const has = (list: Rect[], r: Rect) => list.some((c) => same(c, r));
const districtWith = (build: District['build']): District => ({ ...TOKYO_DISTRICT, build });

describe('BuildCtx', () => {
  it('registers colliders, occluders, picks and minimap rects for the city to read back', () => {
    const { ctx, out } = createBuildCtx();
    ctx.collide(10, 20, 4, 2);
    ctx.collideRect({ x0: 0, x1: 1, z0: 2, z1: 3 });
    ctx.occlude({ x0: 0, x1: 1, z0: 0, z1: 1, y1: 2 });
    ctx.pickAt('thing', 1, 2, 3);
    ctx.mapRect({ x0: 0, x1: 1, z0: 0, z1: 1 }, '#fff', 'label');
    ctx.mapRect({ x0: 0, x1: 1, z0: 0, z1: 1 }, '#000');
    expect(out.colliders).toEqual([{ x0: 8, x1: 12, z0: 19, z1: 21 }, { x0: 0, x1: 1, z0: 2, z1: 3 }]);
    expect(out.occluders).toHaveLength(1);
    expect(out.pickables[0]).toMatchObject({ id: 'thing', radius: 1.2 });
    expect(out.mapRects).toEqual([{ x0: 0, x1: 1, z0: 0, z1: 1, color: '#fff', label: 'label' }, { x0: 0, x1: 1, z0: 0, z1: 1, color: '#000' }]);
  });

  it('gives each key its own repeatable random stream, independent of the shared one', () => {
    const { ctx } = createBuildCtx();
    const take = (r: () => number) => [r(), r(), r()];
    expect(take(ctx.rng('fukufuku'))).toEqual(take(ctx.rng('fukufuku')));
    expect(take(ctx.rng('fukufuku'))).not.toEqual(take(ctx.rng('denki')));
    const before = ctx.R();
    ctx.rng('denki')();
    ctx.rng('denki')();
    const { ctx: fresh } = createBuildCtx();
    fresh.R();
    expect(ctx.R()).toBe(fresh.R()); // drawing from a key's stream leaves the shared stream's sequence alone
    expect(before).toBeGreaterThanOrEqual(0);
  });

  it('shopFrame makes the diorama: collider, occluder, opening, built site, one box batch', () => {
    const { ctx, out } = createBuildCtx();
    const s: ShopDef = SHOPS.find((x) => x.id === 'fukufuku')!;
    ctx.shopFrame(s, { wall: '#fff', inner: '#fff', trim: '#fff', roof: '#fff', floor: '#fff', ceil: '#fff', openH: 3.4 });
    expect(has(out.colliders, shopRect(s))).toBe(true);
    expect(out.occluders).toHaveLength(1);
    expect(out.openings.get('fukufuku')).toEqual({ cx: s.cx, w: s.w, openH: 3.4 });
    expect(out.built.has('fukufuku')).toBe(true);
    expect(ctx.solid.count).toBeGreaterThan(8);
  });

  it('signPlane adds a textured plane to the city group and a pick when asked', () => {
    const { ctx, out } = createBuildCtx();
    const m = ctx.signPlane('寮', { bg: '#222', fg: '#fff' }, { x: 1, y: 2, z: 3, w: 2, h: 1, pickId: 'door:dorm' });
    expect(ctx.group.children).toContain(m);
    expect(out.pickables[0].id).toBe('door:dorm');
    expect(out.disposables.length).toBeGreaterThanOrEqual(3);
  });

  it('a registered shutter joins the city group, hidden until the shop closes', () => {
    const { ctx, out } = createBuildCtx();
    const shutter = new THREE.Group();
    ctx.registerShutter('denki', shutter);
    expect(out.shutters.get('denki')).toBe(shutter);
    expect(shutter.parent).toBe(ctx.group);
    expect(shutter.visible).toBe(false);
  });
});

describe('building registry', () => {
  it('has a builder for every shop id in SHOPS', () => {
    for (const s of SHOPS) expect(typeof SHOP_BUILDERS[s.id], s.id).toBe('function');
  });

  it('builds the five original shops, and a stub builder leaves its site unbuilt', () => {
    const city = buildCity();
    for (const id of ['konbini', 'cafe', 'school', 'ramen', 'station'] as const) expect(city.built.has(id), id).toBe(true);
    // a builder that returns without calling shopFrame / markBuilt has not built its site (stubs until slice 3)
    const { ctx, out } = createBuildCtx();
    const quiet: District = { ...TOKYO_DISTRICT, shops: [SHOPS.find((s) => s.id === 'fukufuku')!], doors: [] };
    const saved = SHOP_BUILDERS.fukufuku;
    SHOP_BUILDERS.fukufuku = () => {};
    try {
      buildBuildings(ctx, quiet);
    } finally {
      SHOP_BUILDERS.fukufuku = saved;
    }
    expect(out.built.size).toBe(0);
  });

  it('fails loudly for a shop without a builder instead of building an empty world', () => {
    const { ctx } = createBuildCtx();
    const odd = { id: 'nope', cx: 0, w: 1, d: 1, h: 1 } as unknown as ShopDef;
    expect(() => buildBuildings(ctx, { shops: [odd], doors: [] })).toThrow(/no builder registered for shop 'nope'/);
  });

  it('runs a district builder with the real ctx: a new building marks its site and adds its collider', () => {
    const fuku = SHOPS.find((s) => s.id === 'fukufuku')!;
    const city = buildCity(
      districtWith((ctx) => {
        TOKYO_DISTRICT.build(ctx);
        ctx.shopFrame(fuku, { wall: '#fff', inner: '#fff', trim: '#fff', roof: '#fff', floor: '#fff', ceil: '#fff', openH: 3.4 });
        ctx.hangSign('fukufuku', fuku, 'ふくふく', 'clothes & second-hand', '#e8789e', '#fff', 3.4, 1.8);
      }),
    );
    expect(city.built.has('fukufuku')).toBe(true);
    expect(has(city.colliders, shopRect(fuku))).toBe(true);
    expect(city.pickables.some((p) => p.id === 'fukufuku')).toBe(true);
  });

  it('the ride stub mounts nothing', () => {
    expect(buildRide('bike', { toon: new THREE.MeshBasicMaterial(), glow: new THREE.MeshBasicMaterial() })).toBeNull();
  });
});

describe('FRONT_OVERRIDES', () => {
  const signCount = (city: City) => {
    let n = 0;
    city.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry.type === 'PlaneGeometry' && Math.abs(m.rotation.y - Math.PI) < 1e-9) n++; // the south fronts' signs face -z
    });
    return n;
  };
  const saved = FRONT_OVERRIDES.hanaya;
  afterEach(() => {
    FRONT_OVERRIDES.hanaya = saved;
  });

  it('styles every south front, in the order of layout.SOUTH_FRONTS', () => {
    expect(SOUTH_FRONTS.map((f) => f.id)).toEqual(['izakaya', 'yakkyoku', 'hanaya', 'honya', 'hotel', 'game']);
    for (const f of SOUTH_FRONTS) expect(FRONT_STYLES[f.id], f.id).toBeDefined();
  });

  it('the florist (hanaya) is the registered override slot, and the stub keeps the default dressing', () => {
    expect(typeof FRONT_OVERRIDES.hanaya).toBe('function');
    expect(signCount(buildCity())).toBe(SOUTH_FRONTS.length);
  });

  it('an override that returns true replaces the default sign and pots, and can mark its site built', () => {
    const seen: string[] = [];
    FRONT_OVERRIDES.hanaya = (ctx, f) => {
      seen.push(`${f.id}@${f.cx}`);
      ctx.markBuilt('aiko_stall');
      return true;
    };
    const city = buildCity();
    expect(seen).toEqual([`hanaya@${SOUTH_FRONTS[2].cx}`]);
    expect(city.built.has('aiko_stall')).toBe(true);
    expect(signCount(city)).toBe(SOUTH_FRONTS.length - 1);
    // the box itself is still the solid front (collider unchanged)
    expect(has(city.colliders, SOUTH_FRONTS[2].rect)).toBe(true);
  });

  it('an override that returns nothing falls back to the default dressing', () => {
    FRONT_OVERRIDES.hanaya = () => {};
    expect(signCount(buildCity())).toBe(SOUTH_FRONTS.length);
  });
});

describe('shutters on the city', () => {
  const shutters = (city: City) => {
    const found: THREE.Object3D[] = [];
    city.group.traverse((o) => {
      if (o.name === 'shutter') found.push(o.parent!);
    });
    return found;
  };

  it('builds the 準備中 shutter on first close and toggles it; nothing is built for open shops', () => {
    const city = buildCity();
    expect(shutters(city)).toHaveLength(0);
    city.setShopOpen('konbini', true);
    expect(shutters(city)).toHaveLength(0);
    city.setShopOpen('konbini', false);
    const [shutter] = shutters(city);
    expect(shutter.visible).toBe(true);
    city.setShopOpen('konbini', true);
    expect(shutter.visible).toBe(false);
    city.setShopOpen('konbini', false);
    expect(shutters(city)).toHaveLength(1); // reused, not rebuilt
    expect(shutters(city)[0].visible).toBe(true);
  });

  it('covers the opening: between the posts, from the floor to the header band, in front of the diorama', () => {
    const city = buildCity();
    city.setShopOpen('cafe', false);
    const cafe = SHOPS.find((s) => s.id === 'cafe')!;
    const box = new THREE.Box3().setFromObject(shutters(city)[0]);
    expect(box.min.x).toBeCloseTo(cafe.cx - (cafe.w - 0.6) / 2, 5);
    expect(box.max.x).toBeCloseTo(cafe.cx + (cafe.w - 0.6) / 2, 5);
    expect(box.min.y).toBeCloseTo(0.12, 5);
    expect(box.max.y).toBeCloseTo(3.4, 1); // café openH
    expect(box.min.z).toBeGreaterThan(FRONT_Z);
  });

  it('ignores a place that has no open front (a no-op, not an error)', () => {
    const city = buildCity();
    expect(() => city.setShopOpen('aiko', false)).not.toThrow();
    expect(() => city.setShopOpen('nowhere', false)).not.toThrow();
    expect(shutters(city)).toHaveLength(0);
  });
});

describe('§6.4 fixes in the built street', () => {
  let city: City;
  beforeAll(() => {
    installFakeDom();
    city = buildCity();
  });

  it('every lamp, pole, vending machine, south front and the alley in the layout data is a collider of the city', () => {
    for (const { id, rect } of layoutColliders()) {
      if (!/^(lamp|pole|vending|front|alley)/.test(id)) continue;
      expect(has(city.colliders, rect), id).toBe(true);
    }
  });

  it('moves the utility pole off Aiko stall (x 32 -> 30.5), adds the pole at 80, and keeps no pole inside the stall', () => {
    expect(has(city.colliders, boxRect(30.5, POLES.z, POLES.size, POLES.size))).toBe(true);
    expect(has(city.colliders, boxRect(32, POLES.z, POLES.size, POLES.size))).toBe(false);
    expect(has(city.colliders, boxRect(80, POLES.z, POLES.size, POLES.size))).toBe(true);
    const stall = SOUTH_FRONTS.find((f) => f.id === 'hanaya')!;
    for (const x of POLES.x) expect(x >= stall.rect.x0 && x <= stall.rect.x1, `pole ${x}`).toBe(false);
  });

  it('moves the Denki vending machine to (64.6, -8.2): collider and pick', () => {
    const v = VENDING[3];
    expect([v.x, v.z]).toEqual([64.6, -8.2]);
    expect(has(city.colliders, boxRect(51.4, -8.2, 1.1, 0.9))).toBe(false);
    expect(city.pickables.filter((p) => p.id === 'vending').map((p) => p.pos.x)).toContain(64.6);
    expect(city.pickables.filter((p) => p.id === 'vending').map((p) => p.pos.x)).not.toContain(51.4);
  });

  it('lights the east extension with lamps at x 70 and 84', () => {
    expect(has(city.colliders, boxRect(70, LAMPS.northZ, LAMPS.size, LAMPS.size))).toBe(true);
    expect(has(city.colliders, boxRect(84, LAMPS.southZ, LAMPS.size, LAMPS.size))).toBe(true);
  });

  it('keeps the road and sidewalks past the new east edge, so the extension has ground', () => {
    const road = city.mapRects.find((r) => r.color === '#8f95a8')!;
    expect([road.x0, road.x1]).toEqual([GROUND_X.x0, GROUND_X.x1]);
    expect(road.x1).toBeGreaterThan(BOUNDS.x1);
  });

  it('wraps traffic at +-130: cars drive past x 90 and the old wrap point, then reappear at the far side', () => {
    const cars: THREE.Object3D[] = [];
    city.group.children.forEach((o) => {
      if ((o as THREE.Mesh).isMesh && o.position.y === 0 && Math.abs(Math.abs(o.position.z) - 2.6) < 1e-9) cars.push(o);
    });
    expect(cars).toHaveLength(4);
    const far = new THREE.Vector3(0, 0, 60); // nobody in the lanes, so nothing brakes
    const east = cars.filter((c) => c.rotation.y === 0); // drive towards +x
    const west = cars.filter((c) => c.rotation.y !== 0);
    expect([east.length, west.length]).toEqual([2, 2]);
    let maxX = -Infinity;
    let minX = Infinity;
    for (let i = 0; i < 6000; i++) {
      city.update(0.05, i * 0.05, far);
      for (const c of east) maxX = Math.max(maxX, c.position.x);
      for (const c of west) minX = Math.min(minX, c.position.x);
    }
    expect(maxX).toBeGreaterThan(110);
    expect(maxX).toBeLessThanOrEqual(TRAFFIC.wrapX + 1);
    expect(minX).toBeLessThan(-110);
    expect(minX).toBeGreaterThanOrEqual(-TRAFFIC.wrapX - 1);
  });

  it('keeps the east skyline at x >= 110 (nearest tower face >= 110 - maxTowerW / 2), clear of the street end', () => {
    let sky: THREE.Mesh | undefined;
    city.group.traverse((o) => {
      if (o.name === 'city-skyline') sky = o as THREE.Mesh;
    });
    const p = sky!.geometry.getAttribute('position');
    // towers of the side bands (z between the far rows), east of the street
    let minX = Infinity;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      if (x > 60 && z > -53 && z < 61) minX = Math.min(minX, x);
    }
    expect(minX).toBeGreaterThanOrEqual(SKYLINE.eastX0 - SKYLINE.maxTowerW / 2 - 1e-6);
    expect(minX).toBeGreaterThan(BOUNDS.x1 + 10);
  });
});

describe('draw-call budget shape', () => {
  it('keeps one merged solid batch and one merged glow batch for every building, and the original five minimap labels in order', () => {
    const city = buildCity();
    const names: string[] = [];
    city.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && (m.name === 'city-solid' || m.name === 'city-glow')) names.push(m.name);
    });
    expect(names.sort()).toEqual(['city-glow', 'city-solid']);
    const labels = city.mapRects.filter((r) => r.label).map((r) => r.label);
    expect(labels.slice(0, 5)).toEqual(['konbini', 'cafe', 'school', 'ramen', 'station']);
    expect(labels).toContain('park');
  });
});
