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
