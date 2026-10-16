import type { ScenarioMeta } from '@lw/game';

/**
 * Game wiring for the story scenes (5C): pay, pocket, gate, shop, steps. Release 2 wave C1 wires the Hikarigaoka trip and the café and station job intros; the festival scenes
 * (matsuri_stalls, matsuri_speech) are wave C2.
 *
 * `trip_hikarigaoka` (Kato): the TripPanel charges the round trip up front (a `fare` event with `legs: 2`, ledger `fare:<id>`) and files
 * `trip_done` when the visit ends, so the conversation itself only sells the omiyage (`g_souvenir`, ¥1,000, cash or IC) through the
 * ordinary `charge` hook of a shop scenario: the shop is `kato` (a panel shop in the trip, `shops.ts`).
 */
export const STORY_META: ScenarioMeta[] = [
  {
    id: 'trip_hikarigaoka',
    kind: 'trip',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'hikarigaoka',
    pocket: ['p_trip_hikarigaoka_1', 'p_trip_hikarigaoka_2', 'p_trip_hikarigaoka_3'],
    culture: ['cc_refuse'],
    shop: {
      shopId: 'kato',
      itemSlot: 'giftItem',
      payStep: 'pay',
      itemMap: { souvenir: 'g_souvenir' },
    },
  },
  // the job intros of the café (Yuki) and the station help desk (Sato): "a normal conversation with the boss, pays once", like job_konbini_intro (meta-jobs.ts)
  {
    id: 'jobintro_cafe',
    kind: 'jobintro',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'cafe',
    pocket: ['p_jobintro_cafe_1', 'p_jobintro_cafe_2', 'p_jobintro_cafe_3'],
    culture: ['cc_irasshaimase'],
  },
  {
    id: 'jobintro_station',
    kind: 'jobintro',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'station',
    pocket: ['p_jobintro_station_1', 'p_jobintro_station_2', 'p_jobintro_station_3'],
  },
];
