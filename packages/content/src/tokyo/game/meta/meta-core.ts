import type { ScenarioMeta } from '@lw/game';

// Game wiring for the five existing scenarios (agent 2D, docs/GAME_DESIGN.md §6.2, §6.6, §14.2). Scenario ids, goal steps, slots and
// intents are asserted against the real scenarios in `content/test/shop-core.test.ts`.
//
// `shop.itemMap` is flat: its keys are the option ids of the item slot AND of every `extraSlots` slot. How the game reads a basket:
// the item slot's option (x `qtySlot`), plus the option of each extra slot that holds a value. The konbini's `giftItem` (a present
// from the `goods` node) and the ramen's `ramenExtra` (an extra on the bowl) both follow that rule. `payMethod` (cash | card | ic) is
// read from its slot, defaulting to cash for a bare 「はい」.
// Pocket line ids (`p_<scenario>_<n>`) are authored by 2E in `pockets/pockets-core.ts`.

const key = (shop: string, options: string[]): Record<string, string> => Object.fromEntries(options.map((o) => [o, `${shop}:${o}`]));

export const CORE_META: ScenarioMeta[] = [
  {
    id: 'cafe',
    kind: 'shop',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    twist: true,
    place: 'cafe',
    pocket: ['p_cafe_1', 'p_cafe_2', 'p_cafe_3', 'p_cafe_4'],
    culture: ['cc_notip'],
    shop: {
      shopId: 'cafe',
      itemSlot: 'item',
      payStep: 'pay',
      itemMap: key('cafe', ['coffee', 'blackTea', 'greenTea', 'latte', 'juice', 'cake']),
    },
  },
  {
    id: 'konbini',
    kind: 'shop',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    twist: true,
    place: 'konbini',
    pocket: ['p_konbini_1', 'p_konbini_2', 'p_konbini_3', 'p_konbini_4'],
    culture: ['cc_irasshaimase', 'cc_konbini', 'cc_notip'],
    shop: {
      shopId: 'konbini',
      itemSlot: 'item',
      // the `goods` node (§5.6): presents, picked from the shared slot `giftItem`
      extraSlots: ['giftItem'],
      qtySlot: 'qty',
      payStep: 'pay',
      itemMap: {
        ...key('konbini', ['onigiri', 'water', 'sandwich', 'bento', 'juice', 'milk', 'greenTea', 'cake', 'coffee']),
        choco: 'g_choco',
        manga: 'g_manga',
        gameCard: 'g_game_card',
      },
    },
  },
  {
    id: 'ramen',
    kind: 'shop',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    twist: true,
    place: 'ramen',
    pocket: ['p_ramen_1', 'p_ramen_2', 'p_ramen_3', 'p_ramen_4'],
    culture: ['cc_itadakimasu', 'cc_notip'],
    // c2_4 needs the learner to say these themselves (§6.6.5)
    requiredIntents: ['ramen:itadakimasu', 'ramen:gochisosama'],
    // the ticket-machine panel already took the money: the conversation starts at the firmness question (§6.3)
    startNode: 'start_ticket',
    shop: {
      shopId: 'ramen',
      itemSlot: 'flavor',
      // an extra is added to the bowl on the bill, not an alternative to it
      extraSlots: ['ramenExtra'],
      payStep: 'bill',
      itemMap: key('ramen', ['shoyu', 'miso', 'tonkotsu', 'ajitama', 'oomori', 'kaedama', 'gyoza']),
    },
  },
  // info only: asking the way and the fare. Buying tickets and the IC card is `station_ic` (2G); nothing is charged here
  {
    id: 'station',
    kind: 'talk',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'station',
    pocket: ['p_station_1', 'p_station_2', 'p_station_3'],
  },
  {
    id: 'park',
    kind: 'talk',
    band: 'A1',
    register: 'casual',
    pay: 'full',
    real: true,
    place: 'park',
    friendId: 'mio',
    pocket: ['p_park_1', 'p_park_2', 'p_park_3'],
  },
];
