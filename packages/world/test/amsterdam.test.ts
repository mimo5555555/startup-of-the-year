// The Amsterdam canal (Dutch step 2): built by its own district, with every character's site, every spawn on open ground inside the
// bounds and in reach of the player, the four open fronts named as the Amsterdam pack's shops, the canal crossed only on the bridge,
// something to tap for every sign, and nothing of Tokyo's or Berlin's street.
import { beforeAll, describe, expect, it } from 'vitest';
import { installFakeDom } from './fakeDom';
import { AMSTERDAM_DISTRICT, AMSTERDAM_SHOPS, AMSTERDAM_SPAWNS, BRIDGE, CANAL, buildAmsterdamCity } from '../src/amsterdam';
import { resolveCircle } from '../src/collision';
import type { City } from '../src/city';
import { AMSTERDAM_CHARACTERS, AMSTERDAM_PACK, AMSTERDAM_SIGNS, NL_LEXICON } from '@lw/content';

beforeAll(installFakeDom);

const inside = (p: { x: number; z: number }, r: { x0: number; x1: number; z0: number; z1: number }) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;

describe('the Amsterdam canal', () => {
  let city: City;
  beforeAll(() => {
    city = buildAmsterdamCity();
  });

  /** where a walker of radius 0.42 ends up when it tries to stand at p */
  const settle = (p: { x: number; z: number }) => {
    const q = { ...p };
    resolveCircle(q, 0.42, city.colliders, AMSTERDAM_DISTRICT.bounds);
    return q;
  };
  const free = (p: { x: number; z: number }) => {
    const q = settle(p);
    return Math.hypot(q.x - p.x, q.z - p.z) < 1e-6;
  };

  it('builds every site an Amsterdam character stands at, one spawn for each of the cast', () => {
    for (const s of AMSTERDAM_SPAWNS) expect(city.built.has(s.site!), `${s.id} at ${s.site}`).toBe(true);
    expect(AMSTERDAM_SPAWNS.map((s) => s.id).sort()).toEqual(AMSTERDAM_CHARACTERS.map((c) => c.id).sort());
  });

  it('names its open fronts as the Amsterdam pack names its shops; the market stall is a site of its own', () => {
    expect(AMSTERDAM_SHOPS.map((s) => s.id)).toEqual(['cafe', 'kaas', 'snackbar', 'gvb', 'drogist', 'bruincafe', 'gemeente']);
    const packShops = AMSTERDAM_PACK.shops.map((s) => s.id);
    // the city desk is no shop: it never closes
    for (const s of AMSTERDAM_SHOPS) if (s.id !== 'gemeente') expect(packShops, s.id).toContain(s.id);
    // every shop of the pack has its place on the street: an open front, or a site of its own (the market stall)
    for (const s of packShops) expect(AMSTERDAM_SHOPS.some((b) => b.id === s) || AMSTERDAM_SPAWNS.some((x) => x.site === s), s).toBe(true);
    expect(AMSTERDAM_SPAWNS.find((s) => s.id === 'jesse')?.site).toBe('markt');
    expect(packShops).toContain('markt');
  });

  it('puts the player on open ground, and every character where the player can walk up and talk', () => {
    const start = AMSTERDAM_DISTRICT.playerStart!;
    expect(city.colliders.some((c) => inside(start, c))).toBe(false);
    expect(inside(start, AMSTERDAM_DISTRICT.bounds)).toBe(true);
    for (const s of AMSTERDAM_SPAWNS) {
      const spots = [-1, 1].flatMap((side) => [1.6, 2.4, 3.2, 4.2, 4.6].map((d) => ({ x: s.x + Math.sin(s.face) * d + side * 0.3, z: s.z + Math.cos(s.face) * d })));
      const open = spots.filter(free);
      expect(open.length, `${s.id}: somewhere to stand in front`).toBeGreaterThan(0);
      expect(Math.hypot(open[0]!.x - s.x, open[0]!.z - s.z), `${s.id}: in reach`).toBeLessThan(s.radius);
    }
  });

  it('keeps the player out of the water: the canal is crossed on the bridge, and the south quay is reached that way', () => {
    // the water beside the bridge is closed, the bridge's middle is open
    for (const x of [-30, -5, 4, 16, 40]) expect(free({ x, z: 9 }), `water at x=${x}`).toBe(false);
    const bx = (BRIDGE.x0 + BRIDGE.x1) / 2;
    for (let z = CANAL.z0 - 1; z <= CANAL.z1 + 1; z += 0.5) expect(free({ x: bx, z }), `bridge at z=${z}`).toBe(true);
    // Noor's spot on the south quay is open ground
    const noor = AMSTERDAM_SPAWNS.find((s) => s.id === 'noor')!;
    expect(noor.z).toBeGreaterThan(CANAL.z1);
    expect(free({ x: noor.x, z: noor.z - 1.6 })).toBe(true);
  });

  it('is Amsterdam’s own canal: no shrine, no Tokyo or Berlin shop, a map of its own', () => {
    expect(city.shrine.busy()).toBe(false);
    expect(city.shrine.info()).toEqual({ meshes: 0, triangles: 0 });
    for (const id of ['konbini', 'school', 'ramen', 'station', 'bakery', 'spaeti', 'doener', 'ubahn', 'flohmarkt']) expect(city.built.has(id), id).toBe(false);
    for (const label of ['Café', 'Kaas', 'Snackbar', 'GVB', 'Albert Cuyp', 'Gracht', 'Drogist', '’t Hoekje', 'Gemeente']) expect(city.mapRects.some((r) => r.label === label), label).toBe(true);
    expect(AMSTERDAM_DISTRICT.buildCity).toBeDefined();
  });

  it('has something to tap for every Amsterdam sign, and every sign is a Dutch word', () => {
    const picks = new Set(city.pickables.map((p) => p.id));
    for (const sg of AMSTERDAM_SIGNS) {
      expect(picks.has(sg.id), sg.id).toBe(true);
      expect(NL_LEXICON.get(sg.lex), sg.lex).toBeDefined();
    }
    expect(AMSTERDAM_SIGNS.length).toBeGreaterThanOrEqual(12);
  });

  it('closes a shop not open yet with a shutter, and opens it again', () => {
    const before = city.group.children.length;
    city.setShopOpen('kaas', false);
    expect(city.group.children.length).toBe(before + 1);
    const shutter = city.group.children[before]!;
    expect(shutter.visible).toBe(true);
    city.setShopOpen('kaas', true);
    expect(shutter.visible).toBe(false);
    city.setShopOpen('woonboot', false); // a site without an open front: nothing to close
  });

  it('runs its animations without trouble (the water, the little boat)', () => {
    for (const t of [0, 10, 45, 95, 130]) city.update(0.016, t, { x: 0, y: 0, z: 0, copy() {}, addScaledVector() {} } as never);
  });
});
