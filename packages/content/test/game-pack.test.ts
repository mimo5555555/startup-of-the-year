// The catalog of Release 1 (docs/GAME_DESIGN.md §5, docs/RELEASE_1.md): the items, the shops and the sale routes of the Japanese pack.
// The release cap itself (chapters 1-4, the epilogue, Free Walk, the dreams) is in release.test.ts.
import { describe, expect, it } from 'vitest';
import { createGameState, itemAvailability, validatePack, type ContentIndex, type GameView, type ItemDef, type ValidationIssue } from '@lw/game';
import { CHARACTERS, JP_PACK, LEXICON, SCENARIOS, SLOTS } from '../src';
import { JP_RULES } from '../src/tokyo/game/economy';

const NOW = new Date(2030, 0, 15, 12).getTime();
const VIEW = (age: 'kids' | 'adults' = 'adults'): GameView => ({
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age, goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
});
const allNodes = (s: { nodes: Record<string, unknown> }) => Object.values(s.nodes) as Array<{ intents: Array<{ id: string }> }>;
const index = (): ContentIndex => ({
  scenarios: Object.fromEntries(SCENARIOS.map((s) => [s.id, { steps: s.steps.map((x) => x.id), intents: allNodes(s).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId }])),
  lexiconSurfaces: new Set(LEXICON.all().map((e) => e.s)),
  slots: Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
  characters: CHARACTERS.map((c) => c.id),
});

const item = (id: string): ItemDef => {
  const it = JP_PACK.items.find((x) => x.id === id);
  if (!it) throw new Error(`no item ${id}`);
  return it;
};
const hasKanji = (s: string) => /[一-龯]/.test(s);
const hasAr = (s: string) => /[؀-ۿ]/.test(s);

/** The catalog this release sells: the design's §5.2 rows for the phone shop and the garage, the IC card, and the presents of §5.3. */
const RELEASED_ITEMS = [
  'ic_card',
  'phone_used', 'phone_case', 'phone_pro', 'tv_small', 'g_music_cd',
  'bike_mamachari', 'bike_helmet', 'ebike', 'car_kei_used', 'car_kei_good', 'g_carfresh',
  'g_choco', 'g_manga', 'g_game_card',
];
/** Fuku-Fuku clothes, furniture, Aiko's tea house and the flat are deferred: no scenario sells them, so the catalog must not price them. */
const DEFERRED_ITEMS = ['tee_basic', 'cap', 'hoodie', 'jeans', 'sneakers', 'jacket_winter', 'yukata', 'glasses_round', 'backpack', 'suit_set', 'futon_set', 'desk_study', 'bookshelf', 'plant_pothos', 'kotatsu', 'rice_cooker', 'paper_lamp', 'home_room_ono', 'g_flower', 'g_wagashi', 'g_tea_set', 'g_tenugui', 'g_plush', 'g_guitar_pick', 'g_souvenir'];

describe('the released catalog (§5.2, §5.3)', () => {
  it('holds exactly the items this release sells, each once', () => {
    const ids = JP_PACK.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...RELEASED_ITEMS].sort());
    for (const id of DEFERRED_ITEMS) expect(ids, id).not.toContain(id);
  });

  it('prices are the design\'s whole yen, tax included', () => {
    expect(Object.fromEntries(JP_PACK.items.map((i) => [i.id, i.price]))).toEqual({
      ic_card: 500,
      phone_used: 24_800,
      phone_case: 1_980,
      phone_pro: 128_000,
      tv_small: 24_800,
      g_music_cd: 3_300,
      bike_mamachari: 19_800,
      bike_helmet: 2_980,
      ebike: 89_000,
      car_kei_used: 198_000,
      car_kei_good: 548_000,
      g_carfresh: 500,
      g_choco: 220,
      g_manga: 680,
      g_game_card: 1_000,
    });
    for (const i of JP_PACK.items) expect(Number.isInteger(i.price) && i.price >= 1, i.id).toBe(true);
    // the total of the released rows is a constant the design can be checked against
    expect(JP_PACK.items.reduce((sum, i) => sum + i.price, 0)).toBe(1_043_560);
  });

  it('every item has an English, Japanese and Arabic name, with a reading for kanji', () => {
    for (const i of JP_PACK.items) {
      expect(i.name.en.trim(), i.id).not.toBe('');
      expect(i.name.ja.trim(), i.id).not.toBe('');
      expect(hasAr(i.name.ar), i.id).toBe(true);
      if (hasKanji(i.name.ja)) expect(i.name.reading, `${i.id} needs a kana reading`).toBeTruthy();
    }
  });

  it('the cars carry body price and drive-away price: 148,000 + 50,000 and 458,000 + 90,000 (§5.2, §4.4 rule 3)', () => {
    expect([item('car_kei_used').body, item('car_kei_used').price - (item('car_kei_used').body ?? 0)]).toEqual([148_000, 50_000]);
    expect([item('car_kei_good').body, item('car_kei_good').price - (item('car_kei_good').body ?? 0)]).toEqual([458_000, 90_000]);
    // the haggle looks at the body price, never the drive-away price: ¥8,880 on both (min of 6% and ¥8,880)
    expect(JP_PACK.rules.negotiation.motors).toMatchObject({ maxPct: 0.06, maxAmount: 8_880 });
    expect(JP_PACK.rules.negotiation.motors!.items).toEqual(['car_kei_used', 'car_kei_good']);
  });

  it('the bicycle registration is a fee line of the quote (¥600), not part of the price', () => {
    expect(JP_RULES.registrationFee).toBe(600);
    const fees = JP_PACK.scenarioMeta.find((m) => m.id === 'motors_bike')!.shop!.fees!;
    expect(fees).toEqual([expect.objectContaining({ id: 'registration', amount: JP_RULES.registrationFee })]);
    expect(item('bike_mamachari').price).toBe(19_800);
  });

  it('effects: the phone feature, the ride multipliers and meshes, the helmet patch, the e-bike needs the helmet', () => {
    expect(item('phone_used').fx).toContainEqual({ t: 'feature', id: 'phone' });
    expect(item('phone_pro').fx).toContainEqual({ t: 'feature', id: 'phone' });
    expect(item('bike_mamachari').fx).toEqual([{ t: 'ride', mul: 1.5, mesh: 'bike' }]);
    expect(item('ebike').fx).toEqual([{ t: 'ride', mul: 1.8, mesh: 'ebike' }]);
    expect(item('car_kei_used').fx).toContainEqual({ t: 'ride', mul: 2.5, mesh: 'car' });
    expect(item('bike_helmet').fx).toEqual([{ t: 'avatar', patch: { accessory: 'helmet' } }]);
    expect(item('ebike').gate.needs).toEqual(['bike_helmet']);
    expect(item('ic_card').fx).toEqual([{ t: 'feature', id: 'ic' }]);
  });

  it('the story words `own category:` ask for are tags of the right items only (a phone case is not a phone)', () => {
    const tagged = (tag: string) => JP_PACK.items.filter((i) => i.tags.includes(tag)).map((i) => i.id).sort();
    expect(tagged('phone')).toEqual(['phone_pro', 'phone_used']);
    expect(tagged('bicycle')).toEqual(['bike_mamachari', 'ebike']);
    expect(tagged('car')).toEqual(['car_kei_good', 'car_kei_used']);
  });

  it('presents are giftable: category gift, a gift effect carrying the tags, the same tags on the item', () => {
    const gifts = JP_PACK.items.filter((i) => i.cat === 'gift');
    expect(gifts.map((i) => i.id).sort()).toEqual(['g_carfresh', 'g_choco', 'g_game_card', 'g_manga', 'g_music_cd']);
    for (const g of gifts) {
      const fx = g.fx.find((f) => f.t === 'gift');
      expect(fx, g.id).toBeTruthy();
      expect(g.tags.length, g.id).toBeGreaterThan(0);
      expect(fx && fx.t === 'gift' ? fx.tags : [], g.id).toEqual(g.tags);
    }
    expect(item('g_choco').tags).toEqual(['sweet', 'snack']);
    expect(item('g_manga').tags).toEqual(['media', 'anime']);
    expect(item('g_game_card').tags).toEqual(['game', 'tech']);
    expect(item('g_music_cd').tags).toEqual(['music']);
    expect(item('g_carfresh').tags).toEqual(['cars']);
  });

  it('cars are for adults (D28) and the low-mileage car also wants six scenarios at two stars', () => {
    expect(item('car_kei_used').gate.ageMin).toBe(18);
    expect(item('car_kei_good').gate).toMatchObject({ ageMin: 18, stars: { n: 6, atLeast: 2 } });
  });
});

describe('shops (D36 openChapter)', () => {
  const shop = (id: string) => JP_PACK.shops.find((s) => s.id === id)!;

  it('Hikari Denki opens with Chapter 4, takes cash and card, and gives points; Nakamura Motors opens at Free Walk (9)', () => {
    expect(shop('denki')).toMatchObject({ placeId: 'denki', openChapter: 4, surface: 'world', register: 'polite', pay: ['cash', 'card'], points: true });
    expect(shop('motors')).toMatchObject({ placeId: 'motors', openChapter: 9, surface: 'world', register: 'polite', pay: ['cash', 'card'] });
    expect(shop('motors').points).toBeUndefined();
  });

  it('each shop lists exactly the items that name it, and every shop id of the pack has a place', () => {
    for (const s of JP_PACK.shops) {
      const own = JP_PACK.items.filter((i) => i.shop === s.id).map((i) => i.id);
      expect(s.sells.filter((id) => JP_PACK.items.some((i) => i.id === id)).sort(), s.id).toEqual(own.sort());
      expect(s.placeId, s.id).toBeTruthy();
    }
    expect(shop('denki').sells.sort()).toEqual(['g_music_cd', 'phone_case', 'phone_pro', 'phone_used', 'tv_small']);
    expect(shop('motors').sells.sort()).toEqual(['bike_helmet', 'bike_mamachari', 'car_kei_good', 'car_kei_used', 'ebike', 'g_carfresh']);
    expect(shop('konbini').sells).toEqual(expect.arrayContaining(['g_choco', 'g_manga', 'g_game_card']));
  });

  it('no item opens before its shop does, and no gate lies between the last played chapter and Free Walk', () => {
    for (const i of JP_PACK.items) {
      const s = shop(i.shop);
      expect(s, i.id).toBeTruthy();
      expect(s.openChapter, i.id).toBeLessThanOrEqual(i.gate.ch);
      expect(i.gate.ch <= 4 || i.gate.ch === 9, `${i.id} gate ${i.gate.ch}`).toBe(true);
      expect(i.gate.ch).toBeLessThanOrEqual(9);
    }
  });

  it('what each chapter opens (a probe through the pricing rules): the phone from Chapter 4, the garage and the cars at Free Walk', () => {
    const at = (n: number, id: string, age: 'kids' | 'adults' = 'adults', patch: (s: ReturnType<typeof createGameState>) => ReturnType<typeof createGameState> = (s) => s) => {
      const s = patch(createGameState(JP_PACK, NOW));
      return itemAvailability(JP_PACK, { ...s, chapter: { ...s.chapter, n } }, VIEW(age), id);
    };
    expect(at(1, 'phone_used')).toBe('closed');
    expect(at(3, 'phone_used')).toBe('closed');
    expect(at(4, 'phone_used')).toBe('ok');
    // the shop is open at 4, the flagship waits for Free Walk (its design chapter 7 is never played)
    expect(at(4, 'phone_pro')).toBe('gate');
    expect(at(9, 'phone_pro')).toBe('ok');
    expect(at(4, 'bike_mamachari')).toBe('closed');
    expect(at(9, 'bike_mamachari')).toBe('ok');
    expect(at(9, 'car_kei_used')).toBe('ok');
    expect(at(9, 'car_kei_used', 'kids')).toBe('age');
    expect(at(9, 'car_kei_good')).toBe('stars');
    expect(at(9, 'ebike')).toBe('needs');
    expect(at(9, 'ebike', 'adults', (s) => ({ ...s, owned: { ...s.owned, bike_helmet: { qty: 1 } as never } }))).toBe('ok');
    expect(at(1, 'g_choco')).toBe('ok');
    expect(at(1, 'ic_card')).toBe('ok');
  });
});

describe('sale routes (§5.6)', () => {
  const metas = JP_PACK.scenarioMeta.filter((m) => m.shop);

  it('the itemMaps of the denki and motors scenarios name items that exist, at their own shop', () => {
    for (const id of ['denki_phone', 'motors_bike', 'motors_car']) {
      const m = JP_PACK.scenarioMeta.find((x) => x.id === id)!;
      for (const [option, itemId] of Object.entries(m.shop!.itemMap)) {
        const it = JP_PACK.items.find((x) => x.id === itemId);
        expect(it, `${id}:${option} -> ${itemId}`).toBeTruthy();
        expect(it!.shop, `${id}:${option}`).toBe(m.shop!.shopId);
      }
    }
    expect(JP_PACK.scenarioMeta.find((m) => m.id === 'denki_phone')!.shop!.itemMap).toEqual({ used: 'phone_used', pro: 'phone_pro', case: 'phone_case', tv: 'tv_small', musicCd: 'g_music_cd' });
    expect(JP_PACK.scenarioMeta.find((m) => m.id === 'motors_bike')!.shop!.itemMap).toEqual({ mamachari: 'bike_mamachari', helmet: 'bike_helmet', ebike: 'ebike', carFresh: 'g_carfresh' });
    expect(JP_PACK.scenarioMeta.find((m) => m.id === 'motors_car')!.shop!.itemMap).toEqual({ used: 'car_kei_used', good: 'car_kei_good' });
  });

  it('every item and every menu id is reachable: a scenario item map, or a panel (vending, station tickets) the app owns', () => {
    const routed = new Set(metas.flatMap((m) => [...Object.values(m.shop!.itemMap), ...(m.shop!.fixedItem ? [m.shop!.fixedItem] : [])]));
    const panels = new Set(JP_PACK.shops.filter((s) => s.surface === 'panel').map((s) => s.id));
    const orphans = [...JP_PACK.items.map((i) => ({ id: i.id, shop: i.shop })), ...JP_PACK.menu.map((m) => ({ id: m.id, shop: m.shop }))].filter((x) => !routed.has(x.id) && !panels.has(x.shop));
    expect(orphans).toEqual([]);
    // every id a scenario sells is in the catalog or on the menu
    const known = new Set([...JP_PACK.items.map((i) => i.id), ...JP_PACK.menu.map((m) => m.id)]);
    expect([...routed].filter((id) => !known.has(id))).toEqual([]);
  });

  it('every scenario that sells names its slot options so that the option really exists in the slot', () => {
    for (const m of metas) {
      const slots = [m.shop!.itemSlot, ...(m.shop!.extraSlots ?? [])].filter((x): x is string => !!x);
      if (slots.length === 0 || Object.keys(m.shop!.itemMap).length === 0) continue;
      const options = slots.flatMap((slot) => (SLOTS[slot] ?? []).map((o) => o.id));
      for (const option of Object.keys(m.shop!.itemMap)) {
        // the menu scenarios key the map by menu id ("konbini:onigiri"), the shop scenarios by slot option
        if (!option.includes(':')) expect(options, `${m.id}.${slots.join('+')}`).toContain(option);
      }
    }
  });

  it('validatePack finds no catalog problem at level 3 (shops, items, menu, sale routes, itemMaps, ages, needs)', () => {
    const catalog = ['item_shop', 'not_sold', 'sells_unknown', 'shop_after_item', 'age_rule', 'needs_unknown', 'needs_cycle', 'no_sale_route', 'itemmap_unknown', 'itemmap_wrong_shop', 'meta_shop', 'item_fx', 'price', 'gate_range', 'tax_class', 'release_gate', 'id_mismatch', 'items_empty', 'shops_empty'];
    const bad: ValidationIssue[] = validatePack(JP_PACK, { level: 3, index: index() }).filter((i) => catalog.includes(i.code));
    expect(bad.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
  });
});
