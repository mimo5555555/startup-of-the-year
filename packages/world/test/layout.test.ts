import { describe, expect, it } from 'vitest';
import { resolveCircle } from '../src/collision';
import {
  AIKO_STALL,
  ALLEY,
  BOUNDS,
  DOORS,
  GROUND_X,
  KEI,
  LAMPS,
  MOTORS_BIKES,
  MOTORS_CARS,
  NPC_RADIUS,
  NPC_SPAWNS,
  PLAYER_RADIUS,
  POLES,
  SHOPS,
  SHOP_COUNTERS,
  SKYLINE,
  SOUTH_FRONTS,
  SPOTS,
  TRAFFIC,
  VENDING,
  VENDING_SIZE,
  WALKERS,
  WALKER_RADIUS,
  boxRect,
  keiRect,
  layoutColliders,
  shopRect,
  spotsAt,
  type Rect,
} from '../src/layout';
import { TOKYO_DISTRICT } from '../src/district';

const EPS = 1e-6;
const colliders = layoutColliders();
const shopOf = (id: string) => SHOPS.find((s) => s.id === id)!;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 - EPS && a.x1 > b.x0 + EPS && a.z0 < b.z1 - EPS && a.z1 > b.z0 + EPS;
/** strictly inside (a point on a face does not count) */
const inside = (r: Rect, x: number, z: number) => x > r.x0 + EPS && x < r.x1 - EPS && z > r.z0 + EPS && z < r.z1 - EPS;
const contains = (outer: Rect, inner: Rect) => inner.x0 >= outer.x0 - EPS && inner.x1 <= outer.x1 + EPS && inner.z0 >= outer.z0 - EPS && inner.z1 <= outer.z1 + EPS;
/** does a circle at (x, z) touch the rect? */
const hits = (r: Rect, x: number, z: number, radius: number) => {
  const dx = x - Math.min(Math.max(x, r.x0), r.x1);
  const dz = z - Math.min(Math.max(z, r.z0), r.z1);
  return dx * dx + dz * dz < radius * radius - EPS;
};
const inBounds = (x: number, z: number) => x >= BOUNDS.x0 && x <= BOUNDS.x1 && z >= BOUNDS.z0 && z <= BOUNDS.z1;
const rectInBounds = (r: Rect) => contains(BOUNDS, r);

describe('layout: spawns and counters', () => {
  it('has the four new spawns, each tied to a building', () => {
    for (const [id, site] of [['rin', 'fukufuku'], ['aoi', 'denki'], ['nakamura', 'motors'], ['aiko', 'aiko_stall']] as const) {
      expect(NPC_SPAWNS.find((n) => n.id === id)?.site, id).toBe(site);
    }
    expect(new Set(NPC_SPAWNS.map((n) => n.id)).size).toBe(NPC_SPAWNS.length);
  });

  it('puts no spawn inside a collider: staff stand inside their own shop, everyone else in the open', () => {
    for (const n of NPC_SPAWNS) {
      const home = SHOPS.find((s) => inside(shopRect(s), n.x, n.z));
      for (const c of colliders) {
        if (home && c.id === `shop:${home.id}`) continue; // behind the counter, inside the open-front diorama
        expect(hits(c.rect, n.x, n.z, NPC_RADIUS), `${n.id} vs ${c.id}`).toBe(false);
      }
      if (home) {
        const r = shopRect(home);
        // wall thickness 0.3 + the inner lining; the character must be inside the room, not in a wall
        expect(contains({ x0: r.x0 + 0.35, x1: r.x1 - 0.35, z0: r.z0 + 0.35, z1: r.z1 }, boxRect(n.x, n.z, 2 * NPC_RADIUS, 2 * NPC_RADIUS)), `${n.id} in ${home.id}`).toBe(true);
      }
      if (n.site && n.site !== 'aiko_stall') expect(home?.id, `${n.id} stands in its own shop`).toBe(n.site);
      expect(inBounds(n.x, n.z) || home !== undefined, `${n.id} placed in the district`).toBe(true);
    }
  });

  it('lets the player reach every talk position (new spawns included)', () => {
    for (const n of NPC_SPAWNS) {
      const p = { x: n.x + Math.sin(n.face) * n.radius * 0.72, z: n.z + Math.cos(n.face) * n.radius * 0.72 };
      resolveCircle(p, PLAYER_RADIUS, colliders.map((c) => c.rect).filter((r) => !inside(r, n.x, n.z)), BOUNDS);
      expect(Math.hypot(n.x - p.x, n.z - p.z), n.id).toBeLessThanOrEqual(n.radius);
    }
  });

  it('keeps every counter inside its shop, clear of the clerk, and Aiko behind her counter on the sidewalk', () => {
    for (const [id, c] of Object.entries(SHOP_COUNTERS)) {
      const shop = shopRect(shopOf(id));
      expect(contains(shop, c!), `${id} counter in shop`).toBe(true);
      const clerk = NPC_SPAWNS.find((n) => n.site === id)!;
      expect(hits(c!, clerk.x, clerk.z, NPC_RADIUS), `${id} clerk vs counter`).toBe(false);
      expect(clerk.z, `${id} clerk behind the counter`).toBeLessThan(c!.z0);
    }
    const aiko = NPC_SPAWNS.find((n) => n.id === 'aiko')!;
    const stall = SOUTH_FRONTS.find((f) => f.id === AIKO_STALL.front)!;
    expect(AIKO_STALL.counter.z1).toBeLessThan(stall.rect.z0); // on the sidewalk, not inside the wall
    expect(hits(AIKO_STALL.counter, aiko.x, aiko.z, NPC_RADIUS)).toBe(false);
    expect(hits(stall.rect, aiko.x, aiko.z, NPC_RADIUS)).toBe(false);
    expect(aiko.z).toBeGreaterThan(AIKO_STALL.counter.z1); // between counter and wall
    expect(aiko.face).toBeCloseTo(Math.PI, 6);
    // the stall is the florist front: counter and pots stay within its width
    expect(AIKO_STALL.counter.x0).toBeGreaterThanOrEqual(stall.rect.x0);
    expect(AIKO_STALL.counter.x1).toBeLessThanOrEqual(stall.rect.x1);
    for (const p of AIKO_STALL.pots) {
      expect(p.x).toBeGreaterThan(stall.rect.x0);
      expect(p.x).toBeLessThan(stall.rect.x1);
      expect(hits(AIKO_STALL.counter, p.x, p.z, 0.22)).toBe(false);
    }
  });

  it('parks two 3.4 x 1.5 m kei cars 0.2 m apart inside Nakamura Motors, clear of the clerk and the counter', () => {
    const [a, b] = MOTORS_CARS.map(keiRect);
    const shop = shopRect(shopOf('motors'));
    expect(KEI).toEqual({ len: 3.4, wid: 1.5 });
    expect(b.x0 - a.x1).toBeCloseTo(0.2, 6);
    const walls = { x0: shop.x0 + 0.33, x1: shop.x1 - 0.33, z0: shop.z0 + 0.33, z1: shop.z1 };
    for (const r of [a, b]) {
      expect(contains(walls, r)).toBe(true);
      expect(overlap(r, SHOP_COUNTERS.motors!)).toBe(false);
    }
    const clerk = NPC_SPAWNS.find((n) => n.id === 'nakamura')!;
    for (const r of [a, b]) expect(hits(r, clerk.x, clerk.z, NPC_RADIUS)).toBe(false);
  });
});

describe('layout: bounds and the east extension', () => {
  it('extends the bounds to x 90 and the ground covers them', () => {
    expect(BOUNDS).toEqual({ x0: -46, x1: 90, z0: -8.3, z1: 37.5 });
    expect(GROUND_X.x0).toBeLessThanOrEqual(BOUNDS.x0);
    expect(GROUND_X.x1).toBeGreaterThanOrEqual(BOUNDS.x1);
  });

  it('fits Nakamura Motors, its bikes, the east end spot and every shop in x', () => {
    const motors = shopRect(shopOf('motors'));
    expect(motors.x0).toBeCloseTo(68.5, 6);
    expect(motors.x1).toBeCloseTo(82.5, 6);
    expect(motors.x1).toBeLessThan(BOUNDS.x1);
    for (const s of SHOPS) {
      const r = shopRect(s);
      expect(r.x0, s.id).toBeGreaterThanOrEqual(BOUNDS.x0);
      expect(r.x1, s.id).toBeLessThanOrEqual(BOUNDS.x1);
    }
    for (const b of MOTORS_BIKES) expect(rectInBounds(boxRect(b.x, b.z, 0.5, 1.4))).toBe(true);
  });

  it('puts every door and spot inside the bounds', () => {
    for (const d of DOORS) {
      // like the shop sign picks, a facade pick can sit just north of the walkable strip (z -8.3); reachability is tested below
      expect(d.pick.x, `${d.id} pick x`).toBeGreaterThanOrEqual(BOUNDS.x0);
      expect(d.pick.x, `${d.id} pick x`).toBeLessThanOrEqual(BOUNDS.x1);
      expect(d.pick.z, `${d.id} pick z`).toBeGreaterThanOrEqual(BOUNDS.z0 - d.radius);
      expect(d.pick.z, `${d.id} pick z`).toBeLessThanOrEqual(BOUNDS.z1);
      if (d.body) {
        expect(d.body.rect.x0).toBeGreaterThanOrEqual(BOUNDS.x0);
        expect(d.body.rect.x1).toBeLessThanOrEqual(BOUNDS.x1);
      }
    }
    for (const s of SPOTS) expect(inBounds(s.x, s.z), s.id).toBe(true);
    expect(SPOTS.map((s) => s.id).sort()).toEqual(['spot:east_end', 'spot:pond', 'spot:station_plaza', 'spot:torii', 'spot:west_end']);
    expect(DOORS.map((d) => d.id).sort()).toEqual(['door:aiko', 'door:dorm', 'door:kenji', 'door:mio']);
  });

  it('keeps door picks out of colliders and reachable from a standable spot', () => {
    for (const d of DOORS) {
      for (const c of colliders) expect(inside(c.rect, d.pick.x, d.pick.z), `${d.id} pick in ${c.id}`).toBe(false);
      let ok = false;
      for (let dx = -d.radius; dx <= d.radius && !ok; dx += 0.1) {
        for (let dz = -d.radius; dz <= d.radius && !ok; dz += 0.1) {
          const x = d.pick.x + dx;
          const z = d.pick.z + dz;
          if (Math.hypot(dx, dz) > d.radius || !inBounds(x, z)) continue;
          ok = colliders.every((c) => !hits(c.rect, x, z, PLAYER_RADIUS));
        }
      }
      expect(ok, `${d.id} reachable`).toBe(true);
    }
  });

  it('can walk into every spot', () => {
    for (const s of SPOTS) {
      // the pond collider (centre (-23, 31), 12.5 x 7.5) is not layout data; the spot centre sits inside it by design
      const pond = s.id === 'spot:pond' ? [boxRect(-23, 31, 12.5, 7.5)] : [];
      let ok = false;
      for (let dx = -s.r; dx <= s.r && !ok; dx += 0.25) {
        for (let dz = -s.r; dz <= s.r && !ok; dz += 0.25) {
          const x = s.x + dx;
          const z = s.z + dz;
          if (Math.hypot(dx, dz) > s.r || !inBounds(x, z)) continue;
          ok = [...colliders.map((c) => c.rect), ...pond].every((r) => !hits(r, x, z, PLAYER_RADIUS));
        }
      }
      expect(ok, `${s.id} enterable`).toBe(true);
    }
  });

  it('finds the spot a point is in', () => {
    expect(spotsAt(88, 0).map((s) => s.id)).toEqual(['spot:east_end']);
    expect(spotsAt(-44, 1).map((s) => s.id)).toEqual(['spot:west_end']);
    expect(spotsAt(40, -6).map((s) => s.id)).toEqual(['spot:station_plaza']);
    expect(spotsAt(0, 0)).toEqual([]);
  });
});

describe('layout: footprints', () => {
  it('keeps every shop footprint disjoint from the other shops, the south fronts, the alley and the door facades', () => {
    const shops = SHOPS.map((s) => ({ id: s.id, rect: shopRect(s) }));
    for (let i = 0; i < shops.length; i++) {
      for (let j = i + 1; j < shops.length; j++) expect(overlap(shops[i].rect, shops[j].rect), `${shops[i].id} vs ${shops[j].id}`).toBe(false);
    }
    const others = [
      ...SOUTH_FRONTS.map((f) => ({ id: `front:${f.id}`, rect: f.rect })),
      { id: 'alley', rect: ALLEY },
      ...DOORS.filter((d) => d.body).map((d) => ({ id: d.id, rect: d.body!.rect })),
    ];
    for (const s of shops) for (const o of others) expect(overlap(s.rect, o.rect), `${s.id} vs ${o.id}`).toBe(false);
  });

  it('keeps the new shops and doors inside the street gaps the design names', () => {
    const gap = (a: string, b: string) => [shopRect(shopOf(a)).x1, shopRect(shopOf(b)).x0] as const;
    const [dormA, dormB] = gap('cafe', 'school'); // -6..-2
    const [kenA, kenB] = gap('ramen', 'station'); // 25.5..30
    const dorm = DOORS.find((d) => d.id === 'door:dorm')!.body!.rect;
    const kenji = DOORS.find((d) => d.id === 'door:kenji')!.body!.rect;
    expect(dorm.x0).toBeGreaterThanOrEqual(dormA);
    expect(dorm.x1).toBeLessThanOrEqual(dormB);
    expect(kenji.x0).toBeGreaterThanOrEqual(kenA);
    expect(kenji.x1).toBeLessThanOrEqual(kenB);
    const mio = DOORS.find((d) => d.id === 'door:mio')!;
    expect(mio.body!.rect.z1).toBeCloseTo(ALLEY.z0, 6); // flush against the alley block's north face
    expect(mio.pick).toEqual({ x: 12, y: 1.2, z: 8.2 });
    expect(DOORS.find((d) => d.id === 'door:aiko')!.pick).toEqual({ x: 38.2, y: 1.2, z: 9.55 });
    // 0.9 m from the konbini, 1.5 m from the station
    expect(shopRect(shopOf('konbini')).x0 - shopRect(shopOf('fukufuku')).x1).toBeCloseTo(0.9, 6);
    expect(shopRect(shopOf('denki')).x0 - shopRect(shopOf('station')).x1).toBeCloseTo(1.5, 6);
  });

  it('keeps free-standing street colliders (facades, counters, vending, bikes, lamps, poles) off each other and off the shops', () => {
    for (let i = 0; i < colliders.length; i++) {
      for (let j = i + 1; j < colliders.length; j++) {
        const a = colliders[i];
        const b = colliders[j];
        const counterInShop = (a.id.startsWith('shop:') && b.id === `counter:${a.id.slice(5)}`) || (b.id.startsWith('shop:') && a.id === `counter:${b.id.slice(5)}`);
        if (counterInShop) continue;
        expect(overlap(a.rect, b.rect), `${a.id} vs ${b.id}`).toBe(false);
      }
    }
  });
});

describe('layout: moves and fixes', () => {
  it('moves the vending machine out from in front of Hikari Denki', () => {
    expect(VENDING).toHaveLength(4);
    expect(VENDING.some((v) => v.x === 51.4)).toBe(false);
    const moved = VENDING[3];
    expect({ x: moved.x, z: moved.z }).toEqual({ x: 64.6, z: -8.2 });
    const denki = shopRect(shopOf('denki'));
    const m = boxRect(moved.x, moved.z, VENDING_SIZE.w, VENDING_SIZE.d);
    expect(m.x0).toBeGreaterThan(denki.x1);
    // the old footprint (51.4, -8.2) straddled the shop's west edge, in front of its counter
    const old = boxRect(51.4, -8.2, VENDING_SIZE.w, VENDING_SIZE.d);
    expect(old.x1).toBeGreaterThan(denki.x0);
  });

  it('moves the utility pole out of Aiko\'s stall and adds one for the east extension', () => {
    const stall = SOUTH_FRONTS.find((f) => f.id === AIKO_STALL.front)!;
    expect(POLES.x).not.toContain(32);
    expect(POLES.x).toContain(30.5);
    expect(POLES.x).toContain(80);
    for (const x of POLES.x) {
      expect(overlap(boxRect(x, POLES.z, POLES.size, POLES.size), { x0: stall.rect.x0, x1: stall.rect.x1, z0: AIKO_STALL.counter.z0, z1: stall.rect.z1 }), `pole ${x} in stall`).toBe(false);
    }
    // sorted and evenly enough spaced for the sagging wires
    expect([...POLES.x].sort((a, b) => a - b)).toEqual(POLES.x);
  });

  it('adds street lamps for the east extension on both sidewalks', () => {
    expect(LAMPS.northX).toContain(70);
    expect(LAMPS.southX).toContain(84);
    expect(LAMPS.northX.every((x) => x >= BOUNDS.x0 && x <= BOUNDS.x1)).toBe(true);
    expect(LAMPS.southX.every((x) => x >= BOUNDS.x0 && x <= BOUNDS.x1)).toBe(true);
    expect(LAMPS.northZ).toBe(-6);
    expect(LAMPS.southZ).toBe(6);
  });

  it('wraps traffic outside the walkable area and keeps the east skyline past the new edge', () => {
    expect(TRAFFIC.wrapX).toBe(130);
    expect(TRAFFIC.wrapX).toBeGreaterThan(BOUNDS.x1 + 30); // cars are never seen popping at the edge of the district
    expect(-TRAFFIC.wrapX).toBeLessThan(BOUNDS.x0 - 30);
    expect(TRAFFIC.wrapX).toBeLessThan(GROUND_X.x1); // still on the road surface
    expect(-TRAFFIC.wrapX).toBeGreaterThanOrEqual(GROUND_X.x0);
    expect(SKYLINE.eastX0).toBeGreaterThanOrEqual(110);
    expect(SKYLINE.eastX0 - SKYLINE.maxTowerW / 2).toBeGreaterThan(BOUNDS.x1); // no tower reaches the street end
  });
});

describe('layout: walkers', () => {
  it('keeps walkers inside the bounds', () => {
    for (const [i, w] of WALKERS.entries()) {
      for (const [x, z] of w.route.points) expect(inBounds(x, z), `walker ${i} point ${x},${z}`).toBe(true);
    }
  });

  it('does not walk any route through a layout collider', () => {
    for (const [i, w] of WALKERS.entries()) {
      const pts = w.route.points;
      for (let k = 0; k + 1 < pts.length; k++) {
        const [x0, z0] = pts[k];
        const [x1, z1] = pts[k + 1];
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.05));
        for (let s = 0; s <= n; s++) {
          const x = x0 + ((x1 - x0) * s) / n;
          const z = z0 + ((z1 - z0) * s) / n;
          for (const c of colliders) {
            if (hits(c.rect, x, z, WALKER_RADIUS)) throw new Error(`walker ${i} hits ${c.id} at ${x.toFixed(2)},${z.toFixed(2)}`);
          }
        }
      }
    }
  });

  it('sends one walker to the east end', () => {
    expect(Math.max(...WALKERS.flatMap((w) => w.route.points.map(([x]) => x)))).toBe(86);
  });
});

describe('district', () => {
  it('describes Tokyo as data plus a builder (exercised in seams.test.ts)', () => {
    expect(TOKYO_DISTRICT.id).toBe('tokyo');
    expect(TOKYO_DISTRICT.bounds).toBe(BOUNDS);
    expect(TOKYO_DISTRICT.shops).toBe(SHOPS);
    expect(TOKYO_DISTRICT.npcSpawns).toBe(NPC_SPAWNS);
    expect(TOKYO_DISTRICT.doors).toBe(DOORS);
    expect(TOKYO_DISTRICT.spots).toBe(SPOTS);
    expect(TOKYO_DISTRICT.walkers).toBe(WALKERS);
    expect(typeof TOKYO_DISTRICT.build).toBe('function');
  });
});
