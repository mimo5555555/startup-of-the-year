// Amsterdam's money (Dutch step 2): euro and cents, written the Dutch way (€ 2,50). Every amount of the pack is in cents.
import type { CurrencyDef, EconomyDef, LanguagePlugin, PackRules, TaxRegime } from '@lw/game';
import { dutchNumber, euroTextNl, nlMatchForms, parseDutchNumbers } from '@lw/core';

export const EUR_NL: CurrencyDef = { code: 'EUR', symbol: '€', minorPerMajor: 100, symbolPlacement: 'prefix', symbolSpace: true, groupSep: '.', decimalSep: ',', roundTo: 1, spoken: 'euro' };

/** €14.40 an hour (the reference wage), €30 to start with (Sanne hands it over with the key), a big ticket from €50 */
export const NL_ECONOMY: EconomyDef = { refWage: 1440, incomeScale: 1440 / 1150, startCash: 3000, walletCap: 9_999_999, bigTicket: 5000 };

/** Prices include BTW: 21 % standard, 9 % for food, drinks without alcohol and public transport. */
export const NL_TAX: TaxRegime = { inclusive: true, rates: { standard: 0.21, food: 0.09, transport: 0.09 }, takeOutRate: 0.09, eatInRate: 0.09 };

/** No haggling in Amsterdam's shops; a small tip is usual (round up). */
export const NL_RULES: PackRules = { negotiation: {}, haggling: false, shoesOff: true, tipping: 'small', pointsCard: false, deliveryFee: 0 };

/** The game's Dutch: numbers in words, prices as written and said (€ 2,50 / twee euro vijftig), numbers said in cents, u / je. */
export const NL_LANGUAGE: LanguagePlugin = {
  readNumber: (n) => dutchNumber(n),
  priceMarkup: (n) => {
    const t = euroTextNl(n);
    return { markup: t.written, reading: t.words, gloss: { en: t.en, ar: t.ar } };
  },
  parseNumbers: (text) => {
    const r = parseDutchNumbers(text);
    return { text: r.text, numbers: r.numbers.map((x) => Math.round(x * 100)) };
  },
  speechNormalize: (text) => nlMatchForms(text).folded,
  registerMarkers: {
    polite: { good: ['u', 'uw', 'alstublieft'], bad: ['je', 'jij', 'jou', 'jouw', 'kun je'] },
    keigo: { good: ['u', 'uw', 'alstublieft'], bad: ['je', 'jij', 'jou', 'jouw', 'kun je'] },
    casual: { good: ['je', 'jij'], bad: ['u', 'uw'] },
  },
};
