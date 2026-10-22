import type { ScenarioMeta } from '@lw/game';

/**
 * Game wiring for the story scenes (5C): pay, pocket, gate, shop, steps. Release 2 wave C1 wires the Hikarigaoka trip and the café and station job intros; wave C2 the
 * festival scenes (matsuri_stalls, matsuri_speech).
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
  // Release 2 wave C2, Chapter 7: Kenji's festival stall row (c7_2) sells the `matsuri` menu through the ordinary `charge` hook, cash only
  {
    id: 'matsuri_stalls',
    kind: 'shop',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'park',
    pocket: ['p_matsuri_stalls_1', 'p_matsuri_stalls_2', 'p_matsuri_stalls_3'],
    culture: ['cc_matsuri'],
    shop: {
      shopId: 'matsuri',
      itemSlot: 'yatai',
      payStep: 'pay',
      itemMap: { yakisoba: 'matsuri:yakisoba', takoyaki: 'matsuri:takoyaki', kakigori: 'matsuri:kakigori', ringoame: 'matsuri:ringoame' },
    },
  },
  // the capstone (c7_3): Real mode by construction, the one-time Guided fallback is the game's (`guidedFallbackOpen`); the Prepare screen's
  // five-line rehearsal is `speechRehearsal` (game/festival.ts); the pocket holds the three lines that need no fact of the player's
  {
    id: 'matsuri_speech',
    kind: 'story',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    capstone: true,
    place: 'park',
    pocket: ['p_matsuri_speech_1', 'p_matsuri_speech_2', 'p_matsuri_speech_3'],
    culture: ['cc_matsuri'],
  },
];
