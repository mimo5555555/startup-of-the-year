import type { ScenarioMeta } from '@lw/game';

// Game wiring for station_ic and sato_directions (agent 2G, docs/GAME_DESIGN.md §6.3). Scenario ids, goal steps, slots and intents are
// asserted against the real scenarios in `engine/test/station.test.ts` and `content/test/station.test.ts`.
//
// `station_ic` sells the IC card (`fixedItem`, the ¥500 deposit) and loads the card with the slot `chargeAmount`; the top-up and the
// refund are transfers (§4.1), so they have no `itemMap` row. The conversation's `charge` hook is not the generic basket one: it
// reads `icService` (card | charge | refund) and is built by apps/mobile/src/game/icHooks.ts.
// Pocket line ids (`p_<scenario>_<n>`) are authored in `pockets/pockets-station.ts`.

export const STATION_META: ScenarioMeta[] = [
  {
    id: 'station_ic',
    kind: 'shop',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'station',
    pocket: ['p_station_ic_1', 'p_station_ic_2', 'p_station_ic_3'],
    culture: ['cc_ic'],
    shop: {
      shopId: 'station',
      itemSlot: 'chargeAmount',
      fixedItem: 'ic_card',
      payStep: 'pay',
      itemMap: {},
    },
  },
  {
    id: 'sato_directions',
    kind: 'talk',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'station',
    pocket: ['p_sato_directions_1', 'p_sato_directions_2', 'p_sato_directions_3'],
  },
];
