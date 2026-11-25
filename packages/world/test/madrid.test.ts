// The Madrid street and plaza (Spanish step 2): built by its own district, with every character's site, every spawn on open ground inside
// the bounds and in reach of the player, the five open fronts named as the Madrid pack's shops, the fountain and the terraza solid,
// something to tap for every sign, and nothing of Tokyo's, Berlin's or Amsterdam's street.
import { beforeAll, describe, expect, it } from 'vitest';
import { installFakeDom } from './fakeDom';
import { FOUNTAIN, MADRID_DISTRICT, MADRID_SHOPS, MADRID_SPAWNS, buildMadridCity } from '../src/madrid';
import { resolveCircle } from '../src/collision';
import type { City } from '../src/city';
import { ES_LEXICON, MADRID_CHARACTERS, MADRID_PACK, MADRID_SIGNS } from '@lw/content';

beforeAll(installFakeDom);

const inside = (p: { x: number; z: number }, r: { x0: number; x1: number; z0: number; z1: number }) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;

describe('the Madrid street', () => {
  let city: City;
  beforeAll(() => {
    city = buildMadridCity();
  });

  /** where a walker of radius 0.42 ends up when it tries to stand at p */
  const settle = (p: { x: number; z: number }) => {
    const q = { ...p };
    resolveCircle(q, 0.42, city.colliders, MADRID_DISTRICT.bounds);
    return q;
  };
  const free = (p: { x: number; z: number }) => {
    const q = settle(p);
    return Math.hypot(q.x - p.x, q.z - p.z) < 1e-6;
  };

  it('builds every site a Madrid character stands at, one spawn for each of the cast', () => {
    for (const s of MADRID_SPAWNS) expect(city.built.has(s.site!), `${s.id} at ${s.site}`).toBe(true);
    expect(MADRID_SPAWNS.map((s) => s.id).sort()).toEqual(MADRID_CHARACTERS.map((c) => c.id).sort());
  });

  it('names its open fronts as the Madrid pack names its shops, every one of them (the citizens’ office sells nothing)', () => {
    expect(MADRID_SHOPS.map((s) => s.id)).toEqual(['bar', 'panaderia', 'churreria', 'metro', 'mercado', 'farmacia', 'taberna', 'padron']);
    expect(MADRID_PACK.shops.map((s) => s.id).sort()).toEqual(MADRID_SHOPS.map((s) => s.id).filter((id) => id !== 'padron').sort());
    // the shops do not overlap
    const spans = MADRID_SHOPS.map((s) => [s.cx - s.w / 2, s.cx + s.w / 2] as const).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i]![0], `${i}`).toBeGreaterThanOrEqual(spans[i - 1]![1]);
  });

  it('puts the player on open ground, and every character where the player can walk up and talk', () => {
    const start = MADRID_DISTRICT.playerStart!;
    expect(city.colliders.some((c) => inside(start, c))).toBe(false);
    expect(inside(start, MADRID_DISTRICT.bounds)).toBe(true);
    for (const s of MADRID_SPAWNS) {
      expect(inside(s, { x0: MADRID_DISTRICT.bounds.x0, x1: MADRID_DISTRICT.bounds.x1, z0: -20, z1: MADRID_DISTRICT.bounds.z1 }), s.id).toBe(true);
      const spots = [-1, 1].flatMap((side) => [1.6, 2.4, 3.2, 4.2, 4.6].map((d) => ({ x: s.x + Math.sin(s.face) * d + side * 0.3, z: s.z + Math.cos(s.face) * d })));
      const open = spots.filter(free);
      expect(open.length, `${s.id}: somewhere to stand in front`).toBeGreaterThan(0);
      expect(Math.hypot(open[0]!.x - s.x, open[0]!.z - s.z), `${s.id}: in reach`).toBeLessThan(s.radius);
    }
  });

  it('the fountain and the terraza are solid; the plaza around them is open', () => {
    expect(free({ x: FOUNTAIN.x, z: FOUNTAIN.z })).toBe(false);
    expect(free({ x: 19.2, z: 15.6 })).toBe(false);
    for (const [x, z] of [[0, 8], [-30, 8], [24, 8], [-20, 14]] as const) expect(free({ x, z }), `${x},${z}`).toBe(true);
  });

  it('is Madrid’s own street: no shrine, no Tokyo, Berlin or Amsterdam shop, a map of its own', () => {
    expect(city.shrine.busy()).toBe(false);
    expect(city.shrine.info()).toEqual({ meshes: 0, triangles: 0 });
    for (const id of ['konbini', 'school', 'ramen', 'station', 'bakery', 'spaeti', 'doener', 'ubahn', 'cafe', 'kaas', 'gvb']) expect(city.built.has(id), id).toBe(false);
    for (const label of ['Bar', 'Panadería', 'Churrería', 'Metro', 'Mercado', 'Plaza']) expect(city.mapRects.some((r) => r.label === label), label).toBe(true);
    expect(MADRID_DISTRICT.buildCity).toBeDefined();
  });

  it('has something to tap for every Madrid sign, and every sign is a Spanish word', () => {
    const picks = new Set(city.pickables.map((p) => p.id));
    for (const sg of MADRID_SIGNS) {
      expect(picks.has(sg.id), sg.id).toBe(true);
      expect(ES_LEXICON.get(sg.lex), sg.lex).toBeDefined();
    }
    expect(MADRID_SIGNS.length).toBeGreaterThanOrEqual(12);
  });

  it('closes a shop not open yet with a shutter, and opens it again', () => {
    const before = city.group.children.length;
    city.setShopOpen('mercado', false);
    expect(city.group.children.length).toBe(before + 1);
    const shutter = city.group.children[before]!;
    expect(shutter.visible).toBe(true);
    city.setShopOpen('mercado', true);
    expect(shutter.visible).toBe(false);
    city.setShopOpen('piso', false); // a site without an open front: nothing to close
  });

  it('updates and disposes without trouble', () => {
    city.update(0.016, 1, { x: 0, y: 0, z: 0 } as never);
    expect(() => city.dispose()).not.toThrow();
  });
});
