// The Fuku-Fuku catalog (agent A3, docs/GAME_DESIGN.md §5.2, §5.3, §5.5, RELEASE_2.md wave A): prices and gates, the shop, the sale routes of
// `fuku_clothes`, the six colours, and the avatar patches the worn pieces make.
import { describe, expect, it } from 'vitest';
import { applyOutfit, avatarPatch, createGameState, grantItem, validatePack, type GameState, type ItemDef } from '@lw/game';
import { CLOTHES_COLOURS, DENIM_COLOURS, JP_PACK, scenarioById } from '../src';
import { SHOP_FUKU_SLOTS } from '../src/slots/shop-fuku';
import { releasedGate } from '../src/tokyo/game/chapters';

const item = (id: string): ItemDef => JP_PACK.items.find((i) => i.id === id)!;
const hasKanji = (s: string) => /[一-龯]/.test(s);
const hasAr = (s: string) => /[؀-ۿ]/.test(s);

/** id -> yen, the design's rows (§5.2 clothes, §5.3 presents) */
const CLOTHES: Record<string, number> = {
  tee_basic: 1_990,
  cap: 2_490,
  hoodie: 4_990,
  jeans: 5_990,
  sneakers: 7_990,
  jacket_winter: 12_900,
  glasses_round: 9_900,
  backpack: 6_900,
  suit_set: 19_800,
};
const PRESENTS: Record<string, number> = { g_plush: 800, g_guitar_pick: 300 };
/** the chapter of the design's Gate column */
const GATES: Record<string, number> = { tee_basic: 2, cap: 2, hoodie: 2, jeans: 3, sneakers: 3, jacket_winter: 4, glasses_round: 5, backpack: 5, suit_set: 6, g_plush: 2, g_guitar_pick: 2 };
const FUKU = [...Object.keys(CLOTHES), ...Object.keys(PRESENTS)];

const meta = JP_PACK.scenarioMeta.find((m) => m.id === 'fuku_clothes')!;
const shop = JP_PACK.shops.find((s) => s.id === 'fukufuku')!;
const own = (s: GameState, ...ids: string[]): GameState => ids.reduce((acc, id) => grantItem(acc, JP_PACK, id, 1, 'd0'), s);
const fresh = (): GameState => createGameState(JP_PACK, Date.UTC(2030, 0, 15));
const wearing = (ids: string[], colours: Record<string, string> = {}): GameState => applyOutfit(own(fresh(), ...ids), JP_PACK, ids, colours);

describe('the clothes catalog (§5.2)', () => {
  it('prices are the design rows, whole yen, and the nine pieces add up to ¥72,950 (the presents to ¥1,100)', () => {
    for (const [id, yen] of Object.entries({ ...CLOTHES, ...PRESENTS })) expect(item(id).price, id).toBe(yen);
    expect(Object.values(CLOTHES).reduce((a, b) => a + b, 0)).toBe(72_950);
    expect(Object.values(PRESENTS).reduce((a, b) => a + b, 0)).toBe(1_100);
    for (const id of FUKU) expect(Number.isInteger(item(id).price), id).toBe(true);
  });

  it('the yukata and the furniture are not sold in wave A', () => {
    for (const id of ['yukata', 'futon_set', 'desk_study', 'bookshelf', 'plant_pothos', 'kotatsu', 'rice_cooker', 'paper_lamp']) expect(item(id), id).toBeUndefined();
  });

  it('every piece is clothing sold by Fuku-Fuku, owned once, with an avatar patch and an English, Japanese and Arabic name (reading for kanji)', () => {
    for (const id of Object.keys(CLOTHES)) {
      const i = item(id);
      expect(i.cat, id).toBe('clothing');
      expect(i.shop, id).toBe('fukufuku');
      expect(i.once, id).toBe(true);
      expect(i.fx.some((f) => f.t === 'avatar'), id).toBe(true);
      expect(i.tags, id).toContain('clothing');
      expect(i.name.en.trim(), id).not.toBe('');
      expect(i.name.ja.trim(), id).not.toBe('');
      expect(hasAr(i.name.ar), id).toBe(true);
      if (hasKanji(i.name.ja)) expect(i.name.reading, `${id} needs a kana reading`).toBeTruthy();
    }
    expect(item('cap').name).toMatchObject({ ja: '帽子', reading: 'ぼうし' });
  });

  it('gates are the design chapters (a chapter this release never plays opens at Free Walk), and none is earlier than the shop', () => {
    for (const [id, ch] of Object.entries(GATES)) {
      expect(item(id).gate.ch, id).toBe(releasedGate(ch));
      expect(item(id).gate.ch, `${id} vs the shop`).toBeGreaterThanOrEqual(shop.openChapter);
    }
  });

  it('the presents are giftable with the design tastes', () => {
    expect(item('g_plush')).toMatchObject({ cat: 'gift', tags: ['cute'], fx: [{ t: 'gift', tags: ['cute'] }] });
    expect(item('g_guitar_pick')).toMatchObject({ cat: 'gift', tags: ['music'], fx: [{ t: 'gift', tags: ['music'] }] });
  });
});

describe('the Fuku-Fuku shop (§4.5)', () => {
  it('opens with Chapter 2 in the world, speaks polite, takes cash and card (not IC), gives points', () => {
    expect(shop).toMatchObject({ placeId: 'fukufuku', openChapter: 2, surface: 'world', register: 'polite', points: true });
    expect(shop.pay).toEqual(['cash', 'card']);
    expect(JP_PACK.chapters.find((c) => c.n === 2)!.opens).toContainEqual({ kind: 'shop', id: 'fukufuku' });
  });

  it('sells exactly the eleven things the catalog names it for', () => {
    expect([...shop.sells].sort()).toEqual([...FUKU].sort());
    expect(JP_PACK.items.filter((i) => i.shop === 'fukufuku').map((i) => i.id).sort()).toEqual([...FUKU].sort());
  });

  it('Rin lists "Shop for clothes" from the start; the shutter, not the row, waits for Chapter 2', () => {
    const row = JP_PACK.interactions.rin!.find((r) => r.scenarioId === 'fuku_clothes')!;
    expect(row).toMatchObject({ kind: 'scenario', id: 'rin_shop' });
    expect(row.ch ?? 0).toBeLessThanOrEqual(shop.openChapter);
    expect(scenarioById('fuku_clothes')).toBeTruthy();
  });
});

describe('sale routes: every clothes item is bought through fuku_clothes', () => {
  const sold = meta.shop!;

  it('the scenario sells from the Fuku-Fuku shop and every item of the shop is in its itemMap exactly once', () => {
    expect(sold.shopId).toBe('fukufuku');
    const mapped = Object.values(sold.itemMap);
    expect(new Set(mapped).size).toBe(mapped.length);
    expect([...mapped].sort()).toEqual([...FUKU].sort());
    for (const id of mapped) expect(item(id), id).toBeTruthy();
  });

  it('every option of the clothes slot is an itemMap key (nothing the learner can name is unsold), and the gift options are the presents', () => {
    expect(SHOP_FUKU_SLOTS.clothes!.map((o) => o.id).sort()).toEqual(Object.keys(sold.itemMap).filter((k) => !['plush', 'guitarPick'].includes(k)).sort());
    expect(sold.itemMap.plush).toBe('g_plush');
    expect(sold.itemMap.guitarPick).toBe('g_guitar_pick');
  });

  it('validatePack finds no problem at level 4 (the release gate)', () => {
    const issues = validatePack(JP_PACK, { level: 4 }).filter((i) => i.severity === 'error' || i.severity === undefined);
    expect(issues).toEqual([]);
  });
});

describe('the six colours', () => {
  it('are the option ids of the clothesColour slot, in its order, as hex colours', () => {
    expect(Object.keys(CLOTHES_COLOURS)).toEqual(SHOP_FUKU_SLOTS.clothesColour!.map((o) => o.id));
    for (const hex of [...Object.values(CLOTHES_COLOURS), ...Object.values(DENIM_COLOURS)]) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(new Set(Object.values(CLOTHES_COLOURS)).size).toBe(6);
  });

  it('the T-shirt, the hoodie and the sneakers offer all six; the jeans their denim washes; their own colour is one of them', () => {
    for (const [id, pick] of [['tee_basic', 'top'], ['hoodie', 'top'], ['sneakers', 'shoes']] as const) {
      const fx = item(id).fx.find((f) => f.t === 'avatar');
      const patch = fx && fx.t === 'avatar' ? fx.patch : undefined;
      expect(patch?.pick, id).toBe(pick);
      expect(patch?.colours, id).toEqual(Object.values(CLOTHES_COLOURS));
      expect(patch?.colours, id).toContain(patch?.[pick]);
    }
    const jeans = item('jeans').fx.find((f) => f.t === 'avatar');
    expect(jeans && jeans.t === 'avatar' ? jeans.patch.colours : []).toEqual(Object.values(DENIM_COLOURS));
  });

  it('every colour of a piece is kept by the outfit (the reducer accepts it), and one outside the palette is dropped', () => {
    for (const hex of Object.values(CLOTHES_COLOURS)) expect(wearing(['hoodie'], { hoodie: hex }).outfit.colours.hoodie).toBe(hex);
    expect(wearing(['hoodie'], { hoodie: '#123456' }).outfit.colours.hoodie).toBeUndefined();
    expect(wearing(['jeans'], { jeans: CLOTHES_COLOURS.red! }).outfit.colours.jeans).toBeUndefined();
  });
});

describe('avatar patches (§5.5)', () => {
  const patchOf = (ids: string[], colours: Record<string, string> = {}) => avatarPatch(JP_PACK, wearing(ids, colours));

  it('the T-shirt and the hoodie colour the top; the hoodie lightens the accent', () => {
    expect(patchOf(['tee_basic'], { tee_basic: CLOTHES_COLOURS.red! })).toEqual({ top: CLOTHES_COLOURS.red, accessories: [] });
    const hoodie = patchOf(['hoodie'], { hoodie: CLOTHES_COLOURS.green! });
    expect(hoodie.top).toBe(CLOTHES_COLOURS.green);
    expect(hoodie.accent).toBeTruthy();
    expect(hoodie.accent).not.toBe(CLOTHES_COLOURS.green);
  });

  it('a piece worn before a colour was picked shows its own colour', () => {
    expect(patchOf(['tee_basic']).top).toBe(CLOTHES_COLOURS.white);
    expect(patchOf(['sneakers']).shoes).toBe(CLOTHES_COLOURS.white);
    expect(patchOf(['jeans']).bottom).toBe(DENIM_COLOURS.denim);
  });

  it('jeans colour the bottom, the sneakers the shoes, the cap, glasses and backpack add their accessory', () => {
    expect(patchOf(['jeans'], { jeans: DENIM_COLOURS.khaki! }).bottom).toBe(DENIM_COLOURS.khaki);
    expect(patchOf(['sneakers'], { sneakers: CLOTHES_COLOURS.blue! }).shoes).toBe(CLOTHES_COLOURS.blue);
    expect(patchOf(['cap']).accessories).toEqual(['cap']);
    expect(patchOf(['glasses_round']).accessories).toEqual(['glasses']);
    expect(patchOf(['backpack']).accessories).toEqual(['backpack']);
  });

  it('the winter jacket is blue with a scarf; the suit is charcoal top and bottom with a tie', () => {
    expect(patchOf(['jacket_winter'])).toEqual({ top: '#2f5ea8', accessories: ['scarf'] });
    expect(patchOf(['suit_set'])).toEqual({ top: '#2b2f3a', bottom: '#2b2f3a', accessories: ['tie'] });
  });

  it('a later top replaces an earlier one, and a suit takes the T-shirt and the jeans off', () => {
    const s = wearing(['tee_basic', 'hoodie']);
    expect(s.outfit.equipped).toEqual(['hoodie']);
    const suited = wearing(['tee_basic', 'jeans', 'suit_set']);
    expect(suited.outfit.equipped).toEqual(['suit_set']);
  });

  it('pieces of different parts stack: top, bottom, shoes and every accessory together', () => {
    const p = patchOf(['hoodie', 'jeans', 'sneakers', 'cap', 'glasses_round', 'backpack']);
    expect(p.top).toBeTruthy();
    expect(p.bottom).toBe(DENIM_COLOURS.denim);
    expect(p.shoes).toBeTruthy();
    expect(p.accessories.sort()).toEqual(['backpack', 'cap', 'glasses']);
  });

  it('a piece that is not owned is never worn (the outfit drops it)', () => {
    const s = applyOutfit(fresh(), JP_PACK, ['hoodie'], { hoodie: CLOTHES_COLOURS.red! });
    expect(s.outfit.equipped).toEqual([]);
    expect(avatarPatch(JP_PACK, s)).toEqual({ accessories: [] });
  });
});
