// Shared fixtures of the money tests (agent 1B): a hand-built GameState and a small Japan-like pack. @lw/game never imports content,
// so the pack here copies the JP money rules as literals instead of importing tokyo/game/economy.ts.
import { BALANCE } from '../src/balance';
import type { GamePack, GameState, GameView, ItemDef, MenuItem, ShopDef, FriendDef, CurrencyDef, EconomyDef, TaxRegime, PackRules } from '../src/types';

export const JPY: CurrencyDef = { code: 'JPY', symbol: '¥', minorPerMajor: 1, symbolPlacement: 'prefix', groupSep: ',', decimalSep: '.', roundTo: 1, spoken: '円' };
export const ECON: EconomyDef = { refWage: 1150, incomeScale: 1, startCash: 3000, icCap: { early: 3000, late: 20000 }, walletCap: 9_999_999, bigTicket: 5000 };
export const TAX: TaxRegime = { inclusive: true, rates: { standard: 0.1, food: 0.08 }, takeOutRate: 0.08, eatInRate: 0.1 };
export const RULES: PackRules = {
  negotiation: { motors: { maxPct: 0.06, maxAmount: 8880, assistedShare: 0.4 } },
  haggling: false,
  shoesOff: true,
  tipping: 'none',
  pointsCard: true,
  deliveryFee: 2200,
  registrationFee: 600,
};

/** mulberry32: a small seeded PRNG so the property tests are reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const item = (id: string, price: number, shop: string, extra: Partial<ItemDef> = {}): ItemDef => ({
  id,
  name: { ja: id, en: id, ar: id },
  price,
  cat: 'electronics',
  shop,
  gate: { ch: 1 },
  fx: [],
  tags: [],
  ...extra,
});

const menu = (shop: string, option: string, price: number, extra: Partial<MenuItem> = {}): MenuItem => ({
  id: `${shop}:${option}`,
  shop,
  slot: 'item',
  option,
  name: { ja: option, en: option, ar: option },
  price,
  taxClass: 'food',
  tags: [],
  ...extra,
});

const shop = (id: string, sells: string[], extra: Partial<ShopDef> = {}): ShopDef => ({
  id,
  placeId: id,
  name: { en: id, ar: id },
  openChapter: 1,
  surface: 'world',
  register: 'polite',
  pay: ['cash', 'ic', 'card'],
  sells,
  ...extra,
});

export const ITEMS: ItemDef[] = [
  item('phone_used', 24_800, 'denki', { once: true, gate: { ch: 4 }, tags: ['phone'] }),
  item('phone_pro', 128_000, 'denki', { once: true, gate: { ch: 7 } }),
  item('bike_mamachari', 19_800, 'motors', { once: true, cat: 'transport', gate: { ch: 5 }, fx: [{ t: 'ride', mul: 1.5, mesh: 'bike' }] }),
  item('futon_set', 12_800, 'fuku', { cat: 'home', bulky: true, once: true }),
  item('car_kei_used', 198_000, 'motors', { cat: 'transport', gate: { ch: 9, ageMin: 18 }, body: 148_000, once: true, fx: [{ t: 'ride', mul: 2.5, mesh: 'car' }] }),
  item('g_flower', 480, 'aiko'),
];

export const MENU: MenuItem[] = [
  menu('konbini', 'coffee', 450, { eatInCapable: true }),
  menu('konbini', 'onigiri', 160, { eatInCapable: true }),
  menu('cafe', 'cake', 600, { eatInCapable: true }),
  menu('konbini', 'bag', 300, { taxClass: 'standard' }),
];

export const SHOPS: ShopDef[] = [
  shop('konbini', ['konbini:coffee', 'konbini:onigiri', 'konbini:bag'], { points: true }),
  shop('cafe', ['cafe:cake']),
  shop('denki', ['phone_used', 'phone_pro'], { openChapter: 4, pay: ['cash', 'card'], points: true }),
  shop('motors', ['bike_mamachari', 'car_kei_used'], { openChapter: 5 }),
  shop('fuku', ['futon_set'], { points: true, openChapter: 1 }),
  shop('aiko', ['g_flower']),
  shop('station', []),
];

export const FRIENDS: FriendDef[] = [
  {
    id: 'tanaka',
    tier: 'A',
    register: 'polite',
    casualAt: 99,
    unlockChapter: 1,
    loves: [],
    likes: [],
    dislikes: [],
    facts: ['a', 'b', 'c'],
    perks: [{ id: 'perk_tanaka_pct', heart: 4, text: { en: '5% off', ar: '5% off' }, fx: { t: 'shop_pct', shopId: 'konbini', pct: 0.05 } }],
  },
  {
    id: 'nakamura',
    tier: 'A',
    register: 'polite',
    casualAt: 99,
    unlockChapter: 5,
    loves: [],
    likes: [],
    dislikes: [],
    facts: ['a', 'b', 'c'],
    perks: [{ id: 'perk_car', heart: 5, text: { en: 'car -8000', ar: 'car -8000' }, fx: { t: 'once_discount', itemIds: ['car_kei_used'], amount: 8000 } }],
  },
  {
    id: 'sato',
    tier: 'A',
    register: 'polite',
    casualAt: 99,
    unlockChapter: 1,
    loves: [],
    likes: [],
    dislikes: [],
    facts: ['a', 'b', 'c'],
    perks: [{ id: 'perk_sato', heart: 4, text: { en: 'fares -10%', ar: 'fares -10%' }, fx: { t: 'shop_pct', shopId: 'station', pct: 0.1 } }],
  },
];

export const FARES: Record<string, number> = { shibuya: 170, shinjuku: 190, airport: 520, hikarigaoka: 170 };

/** The few GamePack fields money code reads; the rest is cast. */
export function mkPack(over: Partial<GamePack> = {}): GamePack {
  const ageProfile = (ageFloor: number) => ({ ageFloor }) as GamePack['ageProfiles']['adults'];
  return {
    schema: 1,
    id: 'jp',
    language: 'ja',
    district: 'tokyo',
    name: { en: 'Sakura', ar: 'Sakura' },
    currency: JPY,
    economy: ECON,
    tax: TAX,
    rules: RULES,
    menu: MENU,
    items: ITEMS,
    shops: SHOPS,
    fares: FARES,
    friends: FRIENDS,
    ageProfiles: { kids: ageProfile(6), teens: ageProfile(13), adults: ageProfile(18), seniors: ageProfile(50) },
    ...over,
  } as unknown as GamePack;
}

export function mkView(age: GameView['profile']['age'] = 'adults'): GameView {
  return { profile: { age, goal: 'fresh_start', level: 'A1', createdAt: '2026-10-04' }, vocab: {}, discovered: [], lessonsDone: [], streakDays: 0 } as unknown as GameView;
}

/** A GameState with only the money-relevant slices filled in. `cash` seeds the checksum like createGameState does. */
export function mkState(over: { cash?: number; ic?: number; points?: number; chapter?: number; dayIndex?: number; friendAp?: Record<string, number> } = {}): GameState {
  const cash = over.cash ?? ECON.startCash;
  const ic = over.ic ?? 0;
  const points = over.points ?? 0;
  const dayIndex = over.dayIndex ?? 0;
  const friends = Object.fromEntries(Object.entries(over.friendAp ?? {}).map(([id, ap]) => [id, { ap }]));
  return {
    v: 1,
    packId: 'jp',
    clock: { dayIndex, lastLocalDate: '2026-10-04', lastSeenAt: 0, activeDays: 0, lastActiveDay: -1 },
    wallet: { cash, ic, points },
    totals: { earned: 0, spent: 0, checksum: { cash, ic, points } },
    ledger: [],
    seen: [],
    pay: { day: `d${dayIndex}`, langToday: 0, firstPhraseToday: 0, echoToday: 0, echoSession: null, scenarioToday: {}, lastPaid: {}, shiftsToday: {}, seenIntents: [], pointsToday: 0, perkToday: 0, haggleToday: [], perkFreeToday: [] },
    runs: {},
    stats: { purchases: 0, spentOnPurchases: 0, perksUsed: [], perkBuys: {} },
    owned: {},
    chapter: { n: over.chapter ?? 1 },
    friends,
  } as unknown as GameState;
}

export { BALANCE };
