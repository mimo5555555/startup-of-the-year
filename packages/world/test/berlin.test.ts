// The Berlin street (German step 3): built by its own district, with every character's site, every spawn on open ground inside the
// bounds and in reach of the player, the four open fronts named as the Berlin pack's shops, and nothing of Tokyo's street.
import { beforeAll, describe, expect, it } from 'vitest';
import { installFakeDom } from './fakeDom';
import { BERLIN_DISTRICT, BERLIN_SHOPS, BERLIN_SPAWNS, buildBerlinCity } from '../src/berlin';
import { TOKYO_DISTRICT } from '../src/district';
import { resolveCircle } from '../src/collision';
import type { City } from '../src/city';
import { BERLIN_CHARACTERS, BERLIN_PACK, BERLIN_SIGNS, DE_LEXICON } from '@lw/content';

beforeAll(installFakeDom);

const inside = (p: { x: number; z: number }, r: { x0: number; x1: number; z0: number; z1: number }) => p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1;

describe('the Berlin street', () => {
  let city: City;
  beforeAll(() => {
    city = buildBerlinCity();
  });

  it('builds every site a Berlin character stands at', () => {
    for (const s of BERLIN_SPAWNS) expect(city.built.has(s.site!), `${s.id} at ${s.site}`).toBe(true);
    expect(BERLIN_SPAWNS.map((s) => s.id).sort()).toEqual(BERLIN_CHARACTERS.map((c) => c.id).sort());
  });

  it('names its open fronts as the Berlin pack names its shops; the flea market is a site of its own', () => {
    expect(BERLIN_SHOPS.map((s) => s.id)).toEqual(['bakery', 'spaeti', 'doener', 'ubahn', 'apotheke', 'buergeramt']);
    // every shop of the pack has its place on the street: an open front, or a site of its own (the flea market, the Kneipe)
    for (const s of BERLIN_PACK.shops) expect(BERLIN_SHOPS.some((b) => b.id === s.id) || BERLIN_SPAWNS.some((x) => x.site === s.id), s.id).toBe(true);
    expect(BERLIN_SPAWNS.find((s) => s.id === 'uwe')?.site).toBe('kneipe');
    expect(BERLIN_SPAWNS.find((s) => s.id === 'greta')?.site).toBe('flohmarkt');
  });

  it('puts the player on open ground, and every character where the player can walk up and talk', () => {
    const start = BERLIN_DISTRICT.playerStart!;
    expect(city.colliders.some((c) => inside(start, c))).toBe(false);
    expect(inside(start, BERLIN_DISTRICT.bounds)).toBe(true);
    for (const s of BERLIN_SPAWNS) {
      // a standing spot within talking range of the character that the player can reach
      const spots = [-1, 1].flatMap((side) => [1.6, 2.4, 3.2, 4.2, 4.6].map((d) => ({ x: s.x + Math.sin(s.face) * d + side * 0.3, z: s.z + Math.cos(s.face) * d })));
      const free = spots.filter((p) => {
        const q = { ...p };
        resolveCircle(q, 0.42, city.colliders, BERLIN_DISTRICT.bounds);
        return Math.hypot(q.x - p.x, q.z - p.z) < 1e-6;
      });
      expect(free.length, `${s.id}: somewhere to stand in front`).toBeGreaterThan(0);
      expect(Math.hypot(free[0]!.x - s.x, free[0]!.z - s.z), `${s.id}: in reach`).toBeLessThan(s.radius);
    }
  });

  it('is Berlin’s own street: no shrine, no Tokyo shop, a map of its own', () => {
    expect(city.shrine.busy()).toBe(false);
    expect(city.shrine.info()).toEqual({ meshes: 0, triangles: 0 });
    for (const id of ['konbini', 'cafe', 'school', 'ramen', 'station']) expect(city.built.has(id), id).toBe(false);
    expect(city.mapRects.some((r) => r.label === 'Bäckerei')).toBe(true);
    expect(city.mapRects.some((r) => r.label === 'Mauerpark')).toBe(true);
    expect(BERLIN_DISTRICT.buildCity).toBeDefined();
    expect(TOKYO_DISTRICT.buildCity).toBeUndefined();
  });

  it('has something to tap for every Berlin sign, and every sign is a German word', () => {
    const picks = new Set(city.pickables.map((p) => p.id));
    for (const sg of BERLIN_SIGNS) {
      expect(picks.has(sg.id), sg.id).toBe(true);
      expect(DE_LEXICON.get(sg.lex), sg.lex).toBeDefined();
    }
    expect(BERLIN_SIGNS.length).toBeGreaterThanOrEqual(12);
  });

  it('closes a shop not open yet with a shutter, and opens it again', () => {
    city.setShopOpen('doener', false);
    const shutter = city.group.children.filter((o) => o.visible === false || o.type === 'Group').length;
    expect(shutter).toBeGreaterThan(0);
    city.setShopOpen('doener', true);
    city.setShopOpen('wg', false); // a site without an open front: nothing to close
  });
});
