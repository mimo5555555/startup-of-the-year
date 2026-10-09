// The catalog rules of validatePack (docs/GAME_DESIGN.md §5, §5.6, §15.9) over the valid fixture pack: every rule is shown to hold on the
// good pack and to fire, at its level, on one broken copy. The Japanese catalog itself is proven in packages/content/test/game-pack.test.ts.
import { describe, expect, it } from 'vitest';
import { validatePack } from '../src/validate';
import { pack1f } from './fixtures-1f';
import type { GamePack, ItemDef, ScenarioMeta, ValidationLevel } from '../src/types';

const base = pack1f();
const issues = (p: GamePack, level: ValidationLevel = 3) => validatePack(p, { level });
const codes = (p: GamePack, level: ValidationLevel = 3): string[] => issues(p, level).map((i) => i.code);
const withItem = (id: string, over: Partial<ItemDef>): GamePack => ({ ...base, items: base.items.map((i) => (i.id === id ? { ...i, ...over } : i)) });
const byId = (id: string): ItemDef => base.items.find((i) => i.id === id) as ItemDef;

describe('the fixture catalog', () => {
  it('is clean at level 3, and every item and menu id has a sale route (a scenario item map, a panel or a grant)', () => {
    expect(issues(base, 3)).toEqual([]);
    expect(codes(base)).not.toContain('no_sale_route');
  });

  it('prices are whole yen of at least one; gates are chapters 1 to 9 (Free Walk is 9)', () => {
    for (const i of base.items) {
      expect(Number.isInteger(i.price) && i.price >= 1, i.id).toBe(true);
      expect(i.gate.ch >= 1 && i.gate.ch <= 9, i.id).toBe(true);
    }
    expect(base.items.some((i) => i.gate.ch === 9)).toBe(true);
  });
});

describe('prices and gates (level 1)', () => {
  it('a fractional, zero or negative price is refused', () => {
    for (const price of [0, -5, 12.5]) expect(codes(withItem('g_manga', { price }), 1), String(price)).toContain('price');
  });

  it('a body price above the drive-away price is refused', () => {
    expect(codes(withItem('car_kei_used', { body: 200_000 }), 1)).toContain('price');
    expect(codes(withItem('car_kei_used', { body: 148_000.5 }), 1)).toContain('price');
  });

  it('a gate below 1 or above Free Walk is refused', () => {
    for (const ch of [0, 10]) expect(codes(withItem('g_manga', { gate: { ch } }), 1), String(ch)).toContain('gate_range');
    expect(codes(withItem('g_manga', { gate: { ch: 9 } }), 1)).not.toContain('gate_range');
  });
});

describe('shops and what they sell (level 3)', () => {
  it('an item of an unknown shop, or one its shop does not list, is refused', () => {
    expect(codes(withItem('g_manga', { shop: 'nowhere' }))).toContain('item_shop');
    expect(codes({ ...base, shops: base.shops.map((s) => (s.id === 'konbini' ? { ...s, sells: s.sells.filter((x) => x !== 'g_manga') } : s)) })).toContain('not_sold');
  });

  it('a shop that opens after its item is refused: a gate must not promise a closed shop', () => {
    expect(codes(withItem('phone_used', { gate: { ch: 3 } }))).toContain('shop_after_item');
    expect(codes({ ...base, shops: base.shops.map((s) => (s.id === 'denki' ? { ...s, openChapter: 5 } : s)) })).toContain('shop_after_item');
    // a shop that opens at Free Walk sells things that open at Free Walk
    const fw = { ...base, shops: base.shops.map((s) => (s.id === 'motors' ? { ...s, openChapter: 9 } : s)) };
    expect(codes(fw)).toContain('shop_after_item');
    const ok = { ...fw, items: fw.items.map((i) => (i.shop === 'motors' ? { ...i, gate: { ...i.gate, ch: 9 } } : i)) };
    expect(codes(ok)).not.toContain('shop_after_item');
  });

  it('a car or a flat needs ageMin 18 (D28)', () => {
    expect(codes(withItem('car_kei_used', { gate: { ch: 9 } }))).toContain('age_rule');
    expect(codes(withItem('home_room_ono', { gate: { ch: 5 } }))).toContain('age_rule');
  });

  it('`needs` names a real item and never loops (the e-bike needs the helmet)', () => {
    expect(codes(withItem('bike_mamachari', { gate: { ch: 5, needs: ['bike_helmet'] } }))).not.toContain('needs_unknown');
    expect(codes(withItem('bike_mamachari', { gate: { ch: 5, needs: ['ghost'] } }))).toContain('needs_unknown');
    const loop = { ...base, items: base.items.map((i) => (i.id === 'bike_helmet' ? { ...i, gate: { ch: 5, needs: ['bike_mamachari'] } } : i.id === 'bike_mamachari' ? { ...i, gate: { ch: 5, needs: ['bike_helmet'] } } : i)) };
    expect(codes(loop)).toContain('needs_cycle');
  });
});

describe('sale routes (§5.6)', () => {
  const withMeta = (id: string, over: Partial<ScenarioMeta>): GamePack => ({ ...base, scenarioMeta: base.scenarioMeta.map((m) => (m.id === id ? { ...m, ...over } : m)) });
  const shopMeta = base.scenarioMeta.find((m) => m.shop && Object.keys(m.shop.itemMap).length > 0) as ScenarioMeta;

  it('an item no scenario sells (and nothing grants) has no sale route', () => {
    const orphan = { ...base, items: [...base.items, { ...byId('g_manga'), id: 'g_orphan' }], shops: base.shops.map((s) => (s.id === 'konbini' ? { ...s, sells: [...s.sells, 'g_orphan'] } : s)) };
    expect(issues(orphan).find((i) => i.code === 'no_sale_route')?.message).toMatch(/g_orphan/);
  });

  it('removing a scenario\'s item map removes the route of every item it sold', () => {
    const before = codes(base).filter((c) => c === 'no_sale_route').length;
    const p = withMeta(shopMeta.id, { shop: { ...shopMeta.shop!, itemMap: {} } });
    expect(codes(p).filter((c) => c === 'no_sale_route').length).toBeGreaterThan(before);
  });

  it('an item map names a known item of the same shop', () => {
    const shop = shopMeta.shop!;
    expect(codes(withMeta(shopMeta.id, { shop: { ...shop, itemMap: { ...shop.itemMap, ghost: 'g_ghost' } } }))).toContain('itemmap_unknown');
    const other = base.items.find((i) => i.shop !== shop.shopId)!;
    expect(codes(withMeta(shopMeta.id, { shop: { ...shop, itemMap: { ...shop.itemMap, wrong: other.id } } }))).toContain('itemmap_wrong_shop');
  });

  it('a scenario sells at a known shop, with a pay step and an item slot or a fixed item', () => {
    const shop = shopMeta.shop!;
    expect(codes(withMeta(shopMeta.id, { shop: { ...shop, shopId: 'nowhere' } }))).toContain('meta_shop');
    expect(codes(withMeta(shopMeta.id, { shop: { ...shop, payStep: '' } }))).toContain('meta_shop');
  });
});

describe('a capped catalog (docs/RELEASE_1.md)', () => {
  it('only the released items are priced: a catalog without clothes, furniture and flat items is still clean', () => {
    const released = new Set(['ic_card', 'phone_used', 'bike_mamachari', 'bike_helmet', 'car_kei_used', 'g_manga']);
    const keep = base.items.filter((i) => released.has(i.id));
    const p: GamePack = {
      ...base,
      items: keep,
      shops: base.shops.map((s) => ({ ...s, sells: s.sells.filter((x) => !base.items.some((i) => i.id === x) || released.has(x)) })),
    };
    expect(issues(p, 3).filter((i) => i.code === 'no_sale_route' || i.code === 'not_sold' || i.code === 'sells_unknown')).toEqual([]);
  });
});
