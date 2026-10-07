import { describe, expect, it } from 'vitest';
import { reduce } from '../src/reducer';
import { validatePack, validateState } from '../src/validate';
import type { ContentIndex, GamePack, GameState, ValidationIssue, ValidationLevel } from '../src/types';
import { createGameState } from '../src/reducer';
import { ctx1f, dayAt, facts1f, index1f, NOW, pack1f, view1f } from './fixtures-1f';

const base = pack1f();
const index = index1f(base);

const codes = (p: GamePack, level: ValidationLevel, idx?: ContentIndex): string[] => validatePack(p, { level, index: idx }).map((i) => i.code);
const has = (p: GamePack, level: ValidationLevel, code: string, idx?: ContentIndex): boolean => codes(p, level, idx).includes(code);
const find = (p: GamePack, level: ValidationLevel, code: string, idx?: ContentIndex): ValidationIssue | undefined => validatePack(p, { level, index: idx }).find((i) => i.code === code);

/** The pack with one thing broken; asserts the issue first appears at exactly `level`. */
function breaks(over: Partial<GamePack>, code: string, level: ValidationLevel, idx?: ContentIndex): void {
  const p = pack1f(over);
  for (let l = 1; l < level; l++) expect(has(p, l as ValidationLevel, code, idx), `${code} must not show at level ${l}`).toBe(false);
  expect(has(p, level, code, idx), `${code} shows at level ${level}`).toBe(true);
  expect(find(p, level, code, idx)!.level).toBe(level);
}

describe('a valid pack', () => {
  it('has no issue at any level, with and without the content index', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(validatePack(base, { level }), `level ${level}`).toEqual([]);
      expect(validatePack(base, { level, index }), `level ${level} + index`).toEqual([]);
    }
  });
  it('does not throw on the empty placeholder pack and says what is missing at the level that asks for it', () => {
    const empty = pack1f({ items: [], menu: [], shops: [], jobs: [], chapters: [], dreams: [], daily: [], beats: {}, friends: [], interactions: {}, scenarioMeta: [], pockets: {}, wordTags: {}, culture: [], titles: [], fares: {} });
    expect(codes(empty, 1)).toEqual([]);
    expect(codes(empty, 2)).toEqual(expect.arrayContaining(['chapters_empty', 'dreams_empty', 'daily_empty', 'interactions_empty']));
    expect(codes(empty, 3)).toEqual(expect.arrayContaining(['items_empty', 'shops_empty']));
    expect(() => validatePack(empty, { level: 5, index })).not.toThrow();
  });
});

describe('level 1: structure and ids', () => {
  it('schema, currency, economy, rules and age profiles', () => {
    breaks({ schema: 2 as never }, 'schema', 1);
    breaks({ currency: { ...base.currency, minorPerMajor: 10 as never } }, 'currency', 1);
    breaks({ currency: { ...base.currency, roundTo: 0 } }, 'currency', 1);
    breaks({ economy: { ...base.economy, refWage: 0 } }, 'economy', 1);
    breaks({ economy: { ...base.economy, walletCap: 100 } }, 'economy', 1);
    breaks({ economy: { ...base.economy, icCap: { early: 5000, late: 1000 } } }, 'economy', 1);
    breaks({ economy: { ...base.economy, incomeScale: 3 } }, 'economy_scale', 1);
    breaks({ tax: { ...base.tax, rates: { standard: 1.2 } } }, 'tax', 1);
    breaks({ rules: { ...base.rules, deliveryFee: -1 } }, 'rules', 1);
    breaks({ rules: { ...base.rules, negotiation: { motors: { maxPct: 3, maxAmount: 5, assistedShare: 0.4 } } } }, 'rules', 1);
    breaks({ ageProfiles: { ...base.ageProfiles, kids: undefined as never } }, 'age_profile', 1);
  });
  it('ids are unique and well formed in every table', () => {
    breaks({ items: [...base.items, base.items[0]!] }, 'id_duplicate', 1);
    breaks({ menu: [...base.menu, base.menu[0]!] }, 'id_duplicate', 1);
    breaks({ shops: [...base.shops, base.shops[0]!] }, 'id_duplicate', 1);
    breaks({ friends: [...base.friends, base.friends[0]!] }, 'id_duplicate', 1);
    breaks({ items: [{ ...base.items[0]!, id: 'has space' }, ...base.items.slice(1)] }, 'id_format', 1);
    breaks({ items: [...base.items, { ...base.items[0]!, id: 'konbini:onigiri' }] }, 'id_duplicate', 1);
    breaks({ menu: [{ ...base.menu[0]!, id: 'konbini:wrong' }, ...base.menu.slice(1)] }, 'id_mismatch', 1);
    breaks({ beats: { ...base.beats, b_x: { ...base.beats.b_ch1_open!, id: 'b_y' } } }, 'id_mismatch', 1);
  });
  it('prices, wages, fares, gates and rewards are whole numbers in range', () => {
    breaks({ items: base.items.map((i, k) => (k === 1 ? { ...i, price: 0 } : i)) }, 'price', 1);
    breaks({ items: base.items.map((i, k) => (k === 1 ? { ...i, price: 12.5 } : i)) }, 'price', 1);
    breaks({ items: base.items.map((i, k) => (k === 1 ? { ...i, gate: { ch: 10 } } : i)) }, 'gate_range', 1);
    breaks({ menu: base.menu.map((m, k) => (k === 0 ? { ...m, price: -5 } : m)) }, 'price', 1);
    breaks({ fares: { x: 0 } }, 'price', 1);
    breaks({ jobs: base.jobs.map((j) => ({ ...j, wage: 0 })) }, 'price', 1);
    breaks({ chapters: base.chapters.map((c, k) => (k === 0 ? { ...c, reward: -1 } : c)) }, 'price', 1);
    breaks({ friends: base.friends.map((f, k) => (k === 0 ? { ...f, unlockChapter: 0 } : f)) }, 'gate_range', 1);
    breaks({ friends: base.friends.map((f, k) => (k === 0 ? { ...f, facts: ['a', 'b'] as never } : f)) }, 'friend', 1);
  });
  it('idAliases may not loop', () => {
    breaks({ idAliases: { a: 'b', b: 'a' } }, 'alias_cycle', 1);
    expect(has(pack1f({ idAliases: { a: 'b', b: 'c' } }), 5, 'alias_cycle')).toBe(false);
  });
});

describe('level 2: slice-2 content', () => {
  it('chapters: contiguous numbers, beats, a story objective, unique objective ids, EN + AR text', () => {
    breaks({ chapters: base.chapters.filter((c) => c.n !== 3) }, 'chapter_numbers', 2);
    breaks({ chapters: base.chapters.map((c) => (c.n === 2 ? { ...c, beats: { open: '', close: '' } } : c)) }, 'chapter_beats', 2);
    breaks({ chapters: base.chapters.map((c) => (c.n === 2 ? { ...c, objectives: c.objectives.filter((o) => o.dream) } : c)) }, 'chapter_objectives', 2);
    breaks({ chapters: base.chapters.map((c) => (c.n === 2 ? { ...c, objectives: [...c.objectives, c.objectives[0]!] } : c)) }, 'id_duplicate', 2);
    breaks({ chapters: base.chapters.map((c) => (c.n === 1 ? { ...c, title: { ...c.title, ar: '' } } : c)) }, 'gloss_missing', 2);
    breaks({ chapters: base.chapters.map((c) => (c.n === 1 ? { ...c, objectives: c.objectives.map((o) => (o.id === 'c1_5' ? { ...o, easier: { ...o.easier!, afterTries: 0 } } : o)) } : c)) }, 'easier', 2);
    expect(has(pack1f({ chapters: base.chapters.map((c) => (c.n === 3 ? { ...c, minDays: 1 } : c)) }), 2, 'chapter_days')).toBe(true);
  });
  it('predicates are well formed', () => {
    const withPred = (pred: never) => ({ chapters: base.chapters.map((c) => (c.n === 1 ? { ...c, objectives: [...c.objectives, { id: 'c1_x', pred, text: { en: 'x', ar: 'x' } }] } : c)) });
    breaks(withPred({ k: 'words_saved', n: 0 } as never), 'pred_range', 2);
    breaks(withPred({ k: 'hearts', friend: 'mio', atLeast: 6 } as never), 'pred_range', 2);
    breaks(withPred({ k: 'stars', atLeast: 4, n: 1 } as never), 'pred_range', 2);
    breaks(withPred({ k: 'own' } as never), 'pred_field', 2);
    breaks(withPred({ k: 'warp' } as never), 'pred_unknown', 2);
    breaks(withPred({ k: 'all', of: [{ k: 'visit', place: '' }] } as never), 'pred_field', 2);
  });
  it('dreams, daily templates and interactions', () => {
    breaks({ dreams: base.dreams.map((d, k) => (k === 0 ? { ...d, steps: [] } : d)) }, 'dream_steps', 2);
    breaks({ dreams: base.dreams.map((d, k) => (k === 1 ? { ...d, steps: d.steps.map((s) => ({ ...s, id: 'pp_s1' })) } : d)) }, 'id_duplicate', 2);
    breaks({ dreams: base.dreams.map((d, k) => (k === 0 ? { ...d, sticker: '' } : d)) }, 'dream_rewards', 2);
    breaks({ daily: base.daily.map((t, k) => (k === 0 ? { ...t, counter: 'warp' as never } : t)) }, 'daily_counter', 2);
    breaks({ daily: base.daily.map((t, k) => (k === 0 ? { ...t, target: 0 } : t)) }, 'daily_target', 2);
    breaks({ daily: base.daily.filter((t) => t.slot !== 'review') }, 'daily_slot', 2);
    breaks({ interactions: { x: [{ id: 'int_x', label: { en: 'x', ar: 'x' }, kind: 'scenario' }] } }, 'interaction_field', 2);
    breaks({ interactions: { x: [{ id: 'int_x', label: { en: 'x', ar: 'x' }, kind: 'shift' }] } }, 'interaction_field', 2);
  });
  it('every name, line and card has EN + AR', () => {
    breaks({ shops: base.shops.map((s, k) => (k === 0 ? { ...s, name: { en: 'x', ar: '' } } : s)) }, 'gloss_missing', 2);
    breaks({ culture: base.culture.map((c, k) => (k === 0 ? { ...c, text: { en: '', ar: 'x' } } : c)) }, 'gloss_missing', 2);
    breaks({ beats: { ...base.beats, b_ch1_open: { id: 'b_ch1_open', lines: [{ who: 'hanako', line: { ja: 'あ', en: 'a', ar: '' } }] } } }, 'gloss_missing', 2);
    breaks({ beats: { ...base.beats, b_ch1_open: { id: 'b_ch1_open', lines: [] } } }, 'beat_lines', 2);
    breaks({ pockets: { ...base.pockets, p_konbini_1: { ...base.pockets.p_konbini_1!, line: { ja: 'あ', en: '', ar: 'x' } } } }, 'gloss_missing', 2);
    breaks({ wordTags: { ...base.wordTags, empty: [] } }, 'word_tag', 2);
  });
});

describe('level 3: catalog, sale routes, gates', () => {
  it('shops list what they sell, in a shop that exists and opens by the item gate', () => {
    breaks({ items: base.items.map((i) => (i.id === 'bike_helmet' ? { ...i, shop: 'void' } : i)) }, 'item_shop', 3);
    breaks({ shops: base.shops.map((s) => (s.id === 'motors' ? { ...s, sells: ['bike_mamachari'] } : s)) }, 'not_sold', 3);
    breaks({ shops: base.shops.map((s) => (s.id === 'cafe' ? { ...s, sells: [] } : s)) }, 'not_sold', 3);
    breaks({ shops: base.shops.map((s) => (s.id === 'konbini' ? { ...s, sells: [...s.sells, 'ghost'] } : s)) }, 'sells_unknown', 3);
    breaks({ shops: base.shops.map((s) => (s.id === 'motors' ? { ...s, openChapter: 6 } : s)) }, 'shop_after_item', 3);
    breaks({ menu: base.menu.map((m, k) => (k === 0 ? { ...m, taxClass: 'luxury' } : m)) }, 'tax_class', 3);
  });
  it('every item and menu id has a sale route; panel shops and granted items are exempt', () => {
    const noRoute = base.scenarioMeta.map((m) => (m.id === 'denki_phone' ? { ...m, shop: { ...m.shop!, itemMap: {} } } : m));
    breaks({ scenarioMeta: noRoute }, 'no_sale_route', 3);
    expect(find(pack1f({ scenarioMeta: noRoute }), 3, 'no_sale_route')!.message).toContain('phone_used');
    // vending drinks and the IC card are panel goods; g_wagashi is also granted by a perk, but it has its route anyway
    const granted = pack1f({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'aiko_tea' ? { ...m, shop: { ...m.shop!, itemMap: { flower: 'g_flower' } } } : m)) });
    expect(has(granted, 3, 'no_sale_route')).toBe(false);
    breaks({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'cafe' ? { ...m, shop: { ...m.shop!, itemMap: { cake: 'ghost' } } } : m)) }, 'itemmap_unknown', 3);
    breaks({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'cafe' ? { ...m, shop: { ...m.shop!, itemMap: { cake: 'konbini:coffee' } } } : m)) }, 'itemmap_wrong_shop', 3);
    breaks({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'cafe' ? { ...m, shop: { ...m.shop!, payStep: '' } } : m)) }, 'meta_shop', 3);
  });
  it('items: kids never see the flat or a car, needs exist and do not loop, effects make sense', () => {
    breaks({ items: base.items.map((i) => (i.id === 'home_room_ono' ? { ...i, gate: { ch: 5 } } : i)) }, 'age_rule', 3);
    breaks({ items: base.items.map((i) => (i.id === 'car_kei_used' ? { ...i, gate: { ch: 9 } } : i)) }, 'age_rule', 3);
    breaks({ items: base.items.map((i) => (i.id === 'bike_helmet' ? { ...i, gate: { ch: 5, needs: ['ghost'] } } : i)) }, 'needs_unknown', 3);
    breaks({ items: base.items.map((i) => (i.id === 'bike_helmet' ? { ...i, gate: { ch: 5, needs: ['bike_mamachari'] } } : i.id === 'bike_mamachari' ? { ...i, gate: { ch: 5, needs: ['bike_helmet'] } } : i)) }, 'needs_cycle', 3);
    breaks({ items: base.items.map((i) => (i.id === 'bike_mamachari' ? { ...i, fx: [{ t: 'ride' as const, mul: 0, mesh: 'bike' as const }] } : i)) }, 'item_fx', 3);
    breaks({ items: base.items.map((i) => (i.id === 'plant_pothos' ? { ...i, fx: [{ t: 'home' as const, slot: 'garage', comfort: 1 }] } : i)) }, 'item_fx', 3);
  });
  it('friends: tastes and perks', () => {
    breaks({ friends: base.friends.map((f) => (f.id === 'mio' ? { ...f, dislikes: ['cake'] } : f)) }, 'taste', 3);
    breaks({ friends: base.friends.map((f) => (f.id === 'tanaka' ? { ...f, perks: [{ ...f.perks[0]!, fx: { t: 'shop_pct' as const, shopId: 'konbini', pct: 0.2 } }] } : f)) }, 'perk', 3);
    breaks({ friends: base.friends.map((f) => (f.id === 'tanaka' ? { ...f, perks: [{ ...f.perks[0]!, fx: { t: 'shop_pct' as const, shopId: 'void', pct: 0.05 } }] } : f)) }, 'perk', 3);
    breaks({ friends: base.friends.map((f) => (f.id === 'hanako' ? { ...f, perks: [{ ...f.perks[0]!, fx: { t: 'once_cash' as const, amount: 0 } }] } : f)) }, 'perk', 3);
    breaks({ friends: base.friends.map((f) => (f.id === 'aiko' ? { ...f, perks: [f.perks[0]!, { ...f.perks[0]! }] } : f)) }, 'id_duplicate', 3);
  });
  it('scenarios, jobs, culture, titles, dreams', () => {
    breaks({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'park' ? { ...m, friendId: 'ghost' } : m)) }, 'meta_friend', 3);
    breaks({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'konbini' ? { ...m, pocket: ['p_konbini_1', 'ghost'] } : m)) }, 'meta_pocket', 3);
    breaks({ pockets: { ...base.pockets, p_konbini_3: { ...base.pockets.p_konbini_3!, key: true } } }, 'pocket_keys', 3);
    breaks({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'konbini' ? { ...m, effects: [{ t: 'item' as const, id: 'ghost' }] } : m)) }, 'meta_effect', 3);
    breaks({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'konbini' ? { ...m, requiredIntents: ['konbini'] } : m)) }, 'required_intent', 3);
    expect(has(pack1f({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'hang_mio' ? { ...m, pay: 'full' as const } : m)) }), 3, 'meta_pay')).toBe(true);
    breaks({ jobs: base.jobs.map((j) => ({ ...j, bonus: { itemId: 'ghost', needsPerfect: true as const } })) }, 'job', 3);
    breaks({ jobs: base.jobs.map((j) => ({ ...j, archetypes: [{ ...j.archetypes[0]!, task: { kind: 'order' as const, items: [{ menu: 'konbini:ghost', qty: 1 }] } }] })) }, 'job', 3);
    breaks({ culture: base.culture.map((c, k) => (k === 0 ? { ...c, trigger: { on: 'teleport' as never } } : c)) }, 'culture_trigger', 3);
    breaks({ titles: [...base.titles, { id: 't_x', name: { ja: 'x', en: 'x', ar: 'x' }, source: { kind: 'heart' as const, friend: 'ghost' } }] }, 'title', 3);
    breaks({ dreams: base.dreams.map((d, k) => (k === 0 ? { ...d, items: ['ghost'] } : d)) }, 'dream_item', 3);
    breaks({ chapters: base.chapters.map((c) => (c.n === 4 ? { ...c, catchUp: { afterActiveDays: 7, item: 'ghost', maxYen: 1 } } : c)) }, 'catch_up', 3);
    // chapter 2 says it opens a shop that opens in another chapter
    breaks({ chapters: base.chapters.map((c) => (c.n === 2 ? { ...c, opens: [...c.opens, { kind: 'shop' as const, id: 'denki' }] } : c)) }, 'shop_open_mismatch', 3);
    breaks({ interactions: { x: [{ id: 'int_x', label: { en: 'x', ar: 'x' }, kind: 'shift', jobId: 'ghost' }] } }, 'interaction_ref', 3);
  });
  it('predicates of job unlocks and scenario gates are checked for shape too, from level 2', () => {
    const bad = { k: 'words_saved', n: 0 } as never;
    expect(has(pack1f({ jobs: base.jobs.map((j) => ({ ...j, unlock: bad })) }), 3, 'pred_range')).toBe(true);
    expect(has(pack1f({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'park' ? { ...m, gate: bad } : m)) }), 3, 'pred_range')).toBe(true);
  });
});

describe('level 4: the chapter graph, prerequisites and the bot', () => {
  const ch = (n: number, f: (c: GamePack['chapters'][number]) => GamePack['chapters'][number]) => base.chapters.map((c) => (c.n === n ? f(c) : c));

  it('every objective is satisfiable with what is open at its chapter start: a reward that unlocks the thing the chapter needs is caught', () => {
    // chapter 2 asks for a shift, but the konbini job only opens in chapter 3 (the §7.1 deadlock)
    const late = ch(2, (c) => ({ ...c, opens: c.opens.filter((o) => o.id !== 'job_konbini') })).map((c) => (c.n === 3 ? { ...c, opens: [...c.opens, { kind: 'job' as const, id: 'job_konbini' }] } : c));
    breaks({ chapters: late }, 'prereq_locked', 4);
    expect(find(pack1f({ chapters: late }), 4, 'prereq_locked')!.message).toMatch(/job_konbini.*chapter 3.*chapter 2/);
    // an item open from a later chapter than the objective that wants it
    breaks({ items: base.items.map((i) => (i.id === 'phone_used' ? { ...i, gate: { ch: 5 } } : i)), shops: base.shops }, 'prereq_locked', 4);
    // an id nothing opens
    breaks({ chapters: ch(1, (c) => ({ ...c, objectives: [...c.objectives, { id: 'c1_ghost', pred: { k: 'scenario', id: 'ghost_scenario' }, text: { en: 'x', ar: 'x' } }] })) }, 'prereq_unknown', 4);
  });
  it('dream steps and start gates are judged at their own chapter', () => {
    breaks({ dreams: base.dreams.map((d) => (d.id === 'phone_pal' ? { ...d, steps: d.steps.map((s) => (s.id === 'pp_s3' ? { ...s, gate: 2 } : s)) } : d)) }, 'prereq_locked', 4);
    // chapter 5 waits for a ♥3 friend: someone must exist by the end of chapter 4
    breaks({ chapters: ch(5, (c) => ({ ...c, startGate: { k: 'hearts', friend: 'nakamura', atLeast: 3 } })) }, 'prereq_unknown', 4);
  });
  it('the bot cannot pass a chapter whose objective cannot be met, and says which chapters are cut off', () => {
    const stuck = ch(3, (c) => ({ ...c, objectives: [...c.objectives, { id: 'c3_many', pred: { k: 'hearts_count', atLeast: 2, n: 9 }, text: { en: 'x', ar: 'x' } }] }));
    expect(has(pack1f({ chapters: stuck }), 3, 'bot_blocked')).toBe(false);
    breaks({ chapters: stuck }, 'bot_unreachable', 4);
    expect(find(pack1f({ chapters: stuck }), 4, 'bot_blocked')!.message).toMatch(/chapter 3.*chapters 4-5/);
    breaks({ chapters: ch(2, (c) => ({ ...c, objectives: [...c.objectives, { id: 'c2_say', pred: { k: 'culture_said', n: 40 }, text: { en: 'x', ar: 'x' } }] })) }, 'bot_unreachable', 4);
    breaks({ chapters: ch(2, (c) => ({ ...c, objectives: [...c.objectives, { id: 'c2_tag', pred: { k: 'words_known', n: 40, tag: 'numbers' }, text: { en: 'x', ar: 'x' } }] })) }, 'bot_unreachable', 4);
    breaks({ chapters: ch(2, (c) => ({ ...c, objectives: [...c.objectives, { id: 'c2_stars', pred: { k: 'stars', atLeast: 3, n: 99 }, text: { en: 'x', ar: 'x' } }] })) }, 'bot_unreachable', 4);
    breaks({ chapters: ch(2, (c) => ({ ...c, objectives: [...c.objectives, { id: 'c2_place', pred: { k: 'item_placed', n: 20 }, text: { en: 'x', ar: 'x' } }] })) }, 'bot_unreachable', 4);
    breaks({ chapters: ch(2, (c) => ({ ...c, objectives: [...c.objectives, { id: 'c2_any', pred: { k: 'any', of: [{ k: 'stars', atLeast: 3, n: 99 }, { k: 'wallet', atLeast: 99_999_999 }] }, text: { en: 'x', ar: 'x' } }] })) }, 'bot_unreachable', 4);
    // an `any` with one reachable branch is fine
    expect(has(pack1f({ chapters: ch(2, (c) => ({ ...c, objectives: [...c.objectives, { id: 'c2_ok', pred: { k: 'any', of: [{ k: 'stars', atLeast: 3, n: 99 }, { k: 'earn_total', yen: 100 }] }, text: { en: 'x', ar: 'x' } }] })) }), 4, 'bot_unreachable')).toBe(false);
  });
  it('the flat path needs at most one heart for its landlady', () => {
    const hearts = (n: number) => pack1f({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'aiko_viewing' ? { ...m, gate: { k: 'hearts' as const, friend: 'aiko', atLeast: n } } : m)) });
    expect(has(hearts(1), 4, 'flat_path_heart')).toBe(false);
    expect(has(hearts(2), 3, 'flat_path_heart')).toBe(false);
    expect(has(hearts(2), 4, 'flat_path_heart')).toBe(true);
    expect(find(hearts(2), 4, 'flat_path_heart')!.message).toContain('2 hearts with aiko');
    // the contract scenario itself may ask for the landlady too
    const contract = pack1f({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'aiko_contract' ? { ...m, gate: { k: 'all' as const, of: [{ k: 'hearts' as const, friend: 'aiko', atLeast: 3 }] } } : m)) });
    expect(has(contract, 4, 'flat_path_heart')).toBe(true);
  });
  it('scenario gates cannot wait for themselves', () => {
    const loop = pack1f({
      scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'park' ? { ...m, gate: { k: 'scenario' as const, id: 'sato_directions' } } : m.id === 'sato_directions' ? { ...m, gate: { k: 'scenario' as const, id: 'park' } } : m)),
    });
    expect(has(loop, 3, 'gate_cycle')).toBe(false);
    expect(has(loop, 4, 'gate_cycle')).toBe(true);
  });
});

describe('level 5: everything, with the content index', () => {
  it('beats, titles and cards the story names exist; the standing beats are defined', () => {
    const { b_ch3_open: _gone, ...rest } = base.beats;
    void _gone;
    breaks({ beats: rest }, 'beat_missing', 5);
    const { b_welcome_back: _gone2, ...rest2 } = base.beats;
    void _gone2;
    breaks({ beats: rest2 }, 'beat_missing', 5);
    breaks({ chapters: base.chapters.map((c) => (c.n === 1 ? { ...c, rewardTitle: 't_ghost' } : c)) }, 'title_missing', 5);
    breaks({ chapters: base.chapters.map((c) => (c.n === 1 ? { ...c, rewardCulture: ['cc_ghost'] } : c)) }, 'culture_missing', 5);
    breaks({ items: base.items.map((i) => (i.id === 'phone_used' ? { ...i, beat: 'b_ghost' } : i)) }, 'beat_missing', 5);
  });
  it('without an index nothing cross-checks content, with one it does', () => {
    const p = pack1f({ interactions: { x: [{ id: 'int_x', label: { en: 'x', ar: 'x' }, kind: 'scenario', scenarioId: 'ghost' }] } });
    expect(has(p, 5, 'index_scenario')).toBe(false);
    expect(has(p, 4, 'index_scenario', index)).toBe(false);
    expect(has(p, 5, 'index_scenario', index)).toBe(true);
  });
  it('scenario ids, steps, intents, slots and options', () => {
    const cut = (f: (i: ContentIndex) => ContentIndex): ContentIndex => f({ ...index, scenarios: { ...index.scenarios }, slots: { ...index.slots } });
    expect(has(base, 5, 'index_scenario', cut((i) => ({ ...i, scenarios: { ...i.scenarios, konbini: undefined as never } })))).toBe(true);
    const noKonbini = cut((i) => {
      const { konbini: _x, ...rest } = i.scenarios;
      void _x;
      return { ...i, scenarios: rest };
    });
    expect(has(base, 5, 'index_scenario', noKonbini)).toBe(true);
    expect(has(base, 5, 'index_slot', cut((i) => ({ ...i, slots: { giftItem: i.slots.giftItem! } })))).toBe(true);
    expect(has(base, 5, 'index_option', cut((i) => ({ ...i, slots: { ...i.slots, item: ['onigiri'] } })))).toBe(true);
    const step = pack1f({ chapters: base.chapters.map((c) => (c.n === 1 ? { ...c, objectives: [...c.objectives, { id: 'c1_s', pred: { k: 'scenario' as const, id: 'konbini', steps: ['warp'] }, text: { en: 'x', ar: 'x' } }] } : c)) });
    expect(has(step, 5, 'index_step', index)).toBe(true);
    const said = pack1f({ chapters: base.chapters.map((c) => (c.n === 1 ? { ...c, objectives: [...c.objectives, { id: 'c1_s', pred: { k: 'said' as const, scenario: 'konbini', intent: 'warp' }, text: { en: 'x', ar: 'x' } }] } : c)) });
    expect(has(said, 5, 'index_intent', index)).toBe(true);
    const req = pack1f({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'konbini' ? { ...m, requiredIntents: ['konbini:warp', 'ghost:greet'] } : m)) });
    expect(codes(req, 5, index).filter((c) => c === 'index_intent' || c === 'index_scenario').sort()).toEqual(['index_intent', 'index_scenario']);
    const payStep = pack1f({ scenarioMeta: base.scenarioMeta.map((m) => (m.id === 'cafe' ? { ...m, shop: { ...m.shop!, payStep: 'warp' } } : m)) });
    expect(has(payStep, 5, 'index_step', index)).toBe(true);
  });
  it('lessons, characters and the lexicon', () => {
    const lesson = pack1f({ chapters: base.chapters.map((c) => (c.n === 1 ? { ...c, objectives: c.objectives.map((o) => (o.id === 'c1_1' ? { ...o, pred: { k: 'lesson' as const, id: 'ghost' } } : o)) } : c)) });
    expect(has(lesson, 5, 'index_lesson', index)).toBe(true);
    expect(has(base, 5, 'index_character', { ...index, characters: ['hanako'] })).toBe(true);
    expect(has(base, 5, 'index_lexicon', { ...index, lexiconSurfaces: new Set(['これ']) })).toBe(true);
    const culture = pack1f({ culture: base.culture.map((c, k) => (k === 0 ? { ...c, trigger: { on: 'scenario_done' as const, ids: ['ghost'] } } : c)) });
    expect(has(culture, 5, 'index_scenario', index)).toBe(true);
    const intent = pack1f({ culture: base.culture.map((c) => (c.id === 'cc_irasshaimase2' ? { ...c, trigger: { on: 'intent' as const, ids: ['konbini:warp'] } } : c)) });
    expect(has(intent, 5, 'index_intent', index)).toBe(true);
  });
});

describe('the level filter', () => {
  it('reports an issue only from its own level up, and levels only add', () => {
    const p = pack1f({ items: base.items.map((i) => (i.id === 'phone_used' ? { ...i, gate: { ch: 5 } } : i)) });
    const counts = ([1, 2, 3, 4, 5] as const).map((l) => validatePack(p, { level: l }).length);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts[0]).toBe(0);
    expect(counts[3]).toBeGreaterThan(0);
    for (const l of [1, 2, 3, 4, 5] as const) for (const i of validatePack(p, { level: l })) expect(i.level).toBeLessThanOrEqual(l);
  });
  it('every issue names a path, a code and a message', () => {
    const p = pack1f({ items: [...base.items, base.items[0]!], menu: [], chapters: [] });
    for (const i of validatePack(p, { level: 5 })) {
      expect(i.path.length).toBeGreaterThan(0);
      expect(i.code).toMatch(/^[a-z0-9_]+$/);
      expect(i.message.length).toBeGreaterThan(5);
      expect(['error', 'warn']).toContain(i.severity);
    }
  });
});

describe('validateState', () => {
  const pack = base;
  const clean = (): GameState => createGameState(pack, NOW);
  const bad = (s: GameState, code: string): void => {
    expect(validateState(s, pack).map((i) => i.code), code).toContain(code);
  };

  it('a new game and a played game validate', () => {
    expect(validateState(clean(), pack)).toEqual([]);
    let s = clean();
    for (let i = 0; i < 6; i++) s = reduce(s, { t: 'conversation_done', facts: facts1f({ sessionId: `s${i}`, ind: 4, done: 3, total: 3 }) }, ctx1f(pack, dayAt(i), view1f())).state;
    expect(validateState(s, pack)).toEqual([]);
  });
  it('wallet: negative, over the cap, not a whole number, not reconciling', () => {
    const s = clean();
    bad({ ...s, wallet: { ...s.wallet, cash: -1 } }, 'wallet');
    bad({ ...s, wallet: { ...s.wallet, cash: 1.5 } }, 'wallet');
    bad({ ...s, wallet: { ...s.wallet, cash: 10_000_000 } }, 'wallet_cap');
    bad({ ...s, wallet: { ...s.wallet, ic: 5000 }, totals: { ...s.totals, checksum: { ...s.totals.checksum, ic: 5000 } } }, 'wallet_cap');
    bad({ ...s, wallet: { ...s.wallet, cash: 3500 } }, 'reconcile');
    bad({ ...s, totals: { ...s.totals, earned: -4 } }, 'totals');
  });
  it('rings and ledger', () => {
    const s = clean();
    const e = { at: 0, kind: 'loop' as const, delta: 1, pocket: 'cash' as const };
    bad({ ...s, ledger: [{ id: 'a', ...e }, { id: 'a', ...e }] }, 'ledger_duplicate');
    bad({ ...s, ledger: Array.from({ length: 201 }, (_, i) => ({ id: `l${i}`, ...e })) }, 'ring');
    bad({ ...s, seen: Array.from({ length: 301 }, (_, i) => `s${i}`) }, 'ring');
  });
  it('clock', () => {
    const s = clean();
    bad({ ...s, clock: { ...s.clock, dayIndex: -1 } }, 'clock');
    bad({ ...s, clock: { ...s.clock, activeDays: 5 } }, 'clock');
    bad({ ...s, clock: { ...s.clock, lastActiveDay: 3 } }, 'clock');
    bad({ ...s, clock: { ...s.clock, lastLocalDate: 'tomorrow' } }, 'clock');
    expect(validateState({ ...s, clock: { ...s.clock, lastLocalDate: '' } }, pack)).toEqual([]);
  });
  it('ids the pack does not know belong under _extra, not in the state', () => {
    const s = clean();
    bad({ ...s, owned: { ghost: { qty: 1, day: 'd0' } } }, 'unknown_id');
    bad({ ...s, runs: { ghost: { count: 1, complete: false, stars: 0, bestIndependent: 0, bestShare: 0, bestR: 0, steps: [] } } }, 'unknown_id');
    bad({ ...s, culture: { cc_ghost: 'd0' } }, 'unknown_id');
    bad({ ...s, titles: ['t_ghost'] }, 'unknown_id');
    bad({ ...s, prep: { ghost: { s: 'seen', at: 0 } } }, 'unknown_id');
    bad({ ...s, dream: { id: 'ghost', steps: {}, done: false } }, 'unknown_id');
    bad({ ...s, dream: { id: null, steps: { ghost: 'd0' }, done: false } }, 'unknown_id');
    bad({ ...s, chapter: { ...s.chapter, done: { ghost: 'd0' } } }, 'unknown_id');
    bad({ ...s, jobs: { ghost: { shifts: 0, good: 0, perfect: 0, rank: 0, recent: [] } } }, 'unknown_id');
    const fr = reduce(s, { t: 'conversation_done', facts: facts1f({ scenarioId: 'smalltalk_mio', characterId: 'mio' }) }, ctx1f(pack, NOW, view1f())).state.friends.mio!;
    bad({ ...s, friends: { ghost: fr } }, 'unknown_id');
    expect(validateState({ ...s, _extra: { ids: { owned: { ghost: { qty: 1 } } } } }, pack)).toEqual([]);
  });
  it('inventory, home and outfit', () => {
    const s = clean();
    bad({ ...s, owned: { phone_used: { qty: 2, day: 'd0' } } }, 'owned_once');
    bad({ ...s, owned: { phone_used: { qty: 0, day: 'd0' } } }, 'owned_qty');
    bad({ ...s, home: { tier: 'dorm', placed: { plant: 'plant_pothos' } } }, 'home');
    bad({ ...s, home: { tier: 'ono', placed: {} } }, 'home');
    bad({ ...s, outfit: { equipped: ['yukata'], colours: {} } }, 'outfit');
    expect(validateState({ ...s, owned: { home_room_ono: { qty: 1, day: 'd0' } }, home: { tier: 'ono', placed: {} } }, pack)).toEqual([]);
  });
  it('chapter: range and the completed cache', () => {
    const s = clean();
    bad({ ...s, chapter: { ...s.chapter, n: 0 } }, 'chapter');
    bad({ ...s, chapter: { ...s.chapter, n: 7 } }, 'chapter');
    bad({ ...s, chapter: { ...s.chapter, n: 3, completed: [1] } }, 'completed_cache');
    bad({ ...s, chapter: { ...s.chapter, completed: [1] } }, 'completed_cache');
    expect(validateState({ ...s, chapter: { ...s.chapter, n: 9, completed: [1, 2, 3, 4, 5] } }, pack)).toEqual([]);
  });
  it('friends: unread follows the threads, AP is a count, stats are counts', () => {
    const s = clean();
    const fr = reduce(s, { t: 'conversation_done', facts: facts1f({ scenarioId: 'smalltalk_mio', characterId: 'mio' }) }, ctx1f(pack, NOW, view1f())).state.friends.mio!;
    bad({ ...s, friends: { mio: { ...fr, unread: 2 } } }, 'friend');
    bad({ ...s, friends: { mio: { ...fr, ap: -1 } } }, 'friend');
    bad({ ...s, stats: { ...s.stats, purchases: -1 } }, 'stats');
    bad({ ...s, runs: { konbini: { count: 1, complete: false, stars: 5 as never, bestIndependent: 0, bestShare: 0, bestR: 0, steps: [] } } }, 'stars');
    bad({ ...s, activeTitle: 't_newcomer' }, 'title');
    bad({ ...s, jobs: { job_konbini: { shifts: 0, good: 0, perfect: 0, rank: 9, recent: [] } } }, 'job');
    bad({ ...s, packId: 'other' }, 'pack');
    bad({ ...s, v: 2 as never }, 'version');
    bad({ ...s, income: Array.from({ length: 9 }, (_, i) => ({ day: i, net: 1 })) }, 'ring');
  });
});
