// Japan's money rules as pack data (agent 1B, docs/GAME_DESIGN.md §4.1, §4.4, §5.4, §11.9, §14.6).
// Type-only import: content never imports @lw/game at runtime, so the JP reference values from BALANCE (startCash, walletCap, refWage,
// icCap) are copied here as literals; `numbers.test.ts` asserts the copies still equal BALANCE.
import type { AgeGroup, AgeProfile, CurrencyDef, EconomyDef, PackRules, TaxRegime } from '@lw/game';

export const JP_CURRENCY: CurrencyDef = {
  code: 'JPY',
  symbol: '¥',
  minorPerMajor: 1,
  symbolPlacement: 'prefix',
  groupSep: ',',
  decimalSep: '.',
  roundTo: 1,
  spoken: '円',
};

/** `incomeScale = refWage / 1150` is 1 for the pack every BALANCE yen amount was written against. */
export const JP_ECONOMY: EconomyDef = {
  refWage: 1150,
  incomeScale: 1,
  startCash: 3000,
  icCap: { early: 3000, late: 20000 },
  walletCap: 9_999_999,
  // a total at or above this asks for the confirm node (§6.2: 「こちらでよろしいですか？」)
  bigTicket: 5000,
};

/**
 * Prices are tax-included (税込). Take-out food and groceries are the reduced 8% class (`food`), eat-in at the konbini corner and the
 * café is 10%, everything else 10% (`standard`). The tourist refund (免税) is a learning-only branch for the resident player, so the
 * scheme is described here for other packs and never applied (§4.1).
 */
export const JP_TAX: TaxRegime = {
  inclusive: true,
  rates: { standard: 0.1, food: 0.08 },
  takeOutRate: 0.08,
  eatInRate: 0.1,
  touristRefund: { min: 5000, needsPassport: true },
};

/**
 * Negotiation exists only at the car dealer, and only for the cars (§4.4 rule 3, `motors_car`). The key is the shop id of Nakamura Motors (`motors`, §5.2 shop column), `items` are the car ids (§7 `carModel` slot):
 * min(6% of body price, ¥8,880), 40% of that when assisted. Numbers equal BALANCE.haggle (asserted in numbers.test.ts).
 */
export const JP_RULES: PackRules = {
  negotiation: { motors: { maxPct: 0.06, maxAmount: 8880, assistedShare: 0.4, items: ['car_kei_used', 'car_kei_good'] } },
  haggling: false,
  shoesOff: true,
  tipping: 'none',
  pointsCard: true,
  // bulky goods (§4.4 rule 5) and the bicycle registration (防犯登録, §5.4)
  deliveryFee: 2200,
  registrationFee: 600,
};

/** One row of the §11.9 table per age group; the engine, the world and the app read these and never branch on age. */
export const JP_AGE_PROFILES: Record<AgeGroup, AgeProfile> = {
  kids: {
    dailyGoals: 2,
    pocketLines: 3,
    textScale: 1.15,
    minTapPx: 48,
    ttsRate: 0.8,
    echoThreshold: 0.55,
    ageFloor: 6,
    // voice is off for a child and turning it on needs an adult gate; no consent card is ever shown to the child
    voiceDefault: 'off',
    adultGate: true,
    walletStyle: 'coins',
    newCardsPerDay: 5,
    adultTopics: false,
  },
  teens: {
    dailyGoals: 3,
    pocketLines: 4,
    textScale: 1,
    minTapPx: 44,
    ttsRate: 0.92,
    echoThreshold: 0.6,
    ageFloor: 13,
    voiceDefault: 'consent',
    adultGate: false,
    walletStyle: 'full',
    newCardsPerDay: 8,
    adultTopics: false,
  },
  adults: {
    dailyGoals: 3,
    pocketLines: 4,
    textScale: 1,
    minTapPx: 44,
    ttsRate: 1,
    echoThreshold: 0.7,
    ageFloor: 18,
    voiceDefault: 'consent',
    adultGate: false,
    walletStyle: 'full',
    newCardsPerDay: 8,
    adultTopics: true,
  },
  seniors: {
    dailyGoals: 3,
    pocketLines: 4,
    textScale: 1.3,
    minTapPx: 52,
    ttsRate: 0.85,
    echoThreshold: 0.6,
    ageFloor: 50,
    voiceDefault: 'consent',
    adultGate: false,
    walletStyle: 'full',
    newCardsPerDay: 6,
    adultTopics: true,
  },
};
