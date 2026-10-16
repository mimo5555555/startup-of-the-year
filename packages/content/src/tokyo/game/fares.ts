import type { ShopDef } from '@lw/game';

// Station fares and the shops of the counter and the vending machines (agent 2G, docs/GAME_DESIGN.md §5.4, §6.5).

/**
 * IC fares from Sakura-chō station, keyed by the existing `place` slot option ids (§5.4). A paper ticket costs BALANCE.fares.paperExtra
 * more and Sato's friend perk takes 10% off (floor BALANCE.fares.perkFloor): both are applied by `fareFor`, never written here.
 * `airport` is relabelled Haneda Airport in the slot; `hikarigaoka` is the fictional trip target (D29).
 */
export const FARES: Record<string, number> = {
  shibuya: 170,
  shinjuku: 190,
  tokyoStation: 210,
  akihabara: 210,
  ueno: 230,
  asakusa: 260,
  airport: 520,
  hikarigaoka: 170,
};

/**
 * The Hikarigaoka trip (docs/GAME_DESIGN.md §6.5, Release 2 wave C1), the names the TripPanel and the tests share. The panel charges the round trip up
 * front with ONE event, `{ t: 'fare', id, place: 'hikarigaoka', method, legs: 2 }` (ledger `fare:<id>`, 2 × `FARES.hikarigaoka`, +¥10 a leg for a paper
 * ticket, Sato's perk applied by `fareFor`), plays `trip_hikarigaoka` with Kato (his shop sells the omiyage) and files `{ t: 'trip_done', id }` when the
 * visit ends, which adds `trip:hikarigaoka` to the visits (objective c5_1, culture `cc_trainmanner`). The platform is what the station desk's
 * `s_platform` customer asks about, so the desk and the trip agree.
 */
export const TRIP_HIKARIGAOKA = {
  /** the `fare` event's `place` and the `trip_done` event's `id` */
  id: 'hikarigaoka',
  legs: 2,
  scenarioId: 'trip_hikarigaoka',
  /** the entry `trip_done` adds to `stats.visits` */
  visit: 'trip:hikarigaoka',
  /** Kato's panel shop and its one present (a gift item, ¥1,000) */
  shopId: 'kato',
  souvenir: 'g_souvenir',
  /** the platform of the Hikarigaoka train, as the departure board of the station desk shows it */
  platform: 3,
} as const;

/**
 * The two shops the machines and the counter sell for (§14.9 shop ids): `station` (the IC card, bought at the counter in a
 * conversation, cash only) and `vending` (panel only: cash or IC, no points). 3E's `shops.ts` spreads these into `SHOPS` next to its own
 * rows so the panels can price and commit their purchases.
 */
export const STATION_SHOPS: ShopDef[] = [
  {
    id: 'station',
    placeId: 'station',
    name: { en: 'Station', ar: 'المحطة' },
    openChapter: 1,
    surface: 'world',
    register: 'polite',
    pay: ['cash'],
    sells: ['ic_card'],
  },
  {
    id: 'vending',
    placeId: 'station',
    name: { en: 'Vending machine', ar: 'آلة البيع' },
    openChapter: 1,
    surface: 'panel',
    register: 'casual',
    pay: ['cash', 'ic'],
    sells: ['v_tea', 'v_coffee', 'v_water', 'v_juice'],
  },
];
