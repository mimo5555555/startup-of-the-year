// Madrid's money (Spanish step 2): euro and cents, written the Spanish way (2,50 €). Every amount of the pack is in cents; BALANCE amounts
// written against the yen reference are scaled by `incomeScale` (the Spanish minimum wage against the reference wage).
import type { CurrencyDef, EconomyDef, LanguagePlugin, PackRules, TaxRegime } from '@lw/game';
import { esMatchForms, euroTextEs, parseSpanishNumbers, spanishNumber } from '@lw/core';

export const EUR_ES: CurrencyDef = { code: 'EUR', symbol: '€', minorPerMajor: 100, symbolPlacement: 'suffix', groupSep: '.', decimalSep: ',', roundTo: 1, spoken: 'euros' };

/** €9.25 an hour (about the Spanish minimum wage: the reference wage), €30 to start with (Lucía hands it over with the keys), a big ticket from €50 */
export const ES_ECONOMY: EconomyDef = { refWage: 925, incomeScale: 925 / 1150, startCash: 3000, walletCap: 9_999_999, bigTicket: 5000 };

/** Prices include IVA: 21 % standard (a beer too), 10 % for food, drinks without alcohol, bars and public transport, 4 % for medicines. */
export const ES_TAX: TaxRegime = { inclusive: true, rates: { standard: 0.21, food: 0.1, transport: 0.1, medicine: 0.04 }, takeOutRate: 0.1, eatInRate: 0.1 };

/** No haggling in Madrid's shops (the Rastro, later, is another story); a small tip, the coins of the change; shoes stay on at home. */
export const ES_RULES: PackRules = { negotiation: {}, haggling: false, shoesOff: false, tipping: 'small', pointsCard: false, deliveryFee: 0 };

/** The game's Spanish: numbers in words, prices as written and said (2,50 € / dos euros con cincuenta), numbers said in cents, tú / usted. */
export const ES_LANGUAGE: LanguagePlugin = {
  readNumber: (n) => spanishNumber(n),
  priceMarkup: (n) => {
    const t = euroTextEs(n);
    return { markup: t.written, reading: t.words, gloss: { en: t.en, ar: t.ar } };
  },
  parseNumbers: (text) => {
    const r = parseSpanishNumbers(text);
    return { text: r.text, numbers: r.numbers.map((x) => Math.round(x * 100)) };
  },
  speechNormalize: (text) => esMatchForms(text).folded,
  registerMarkers: {
    polite: { good: ['usted', 'por favor', 'quería'], bad: ['tú', 'tienes', 'puedes', 'quieres', 'me pones'] },
    keigo: { good: ['usted', 'por favor', 'quería'], bad: ['tú', 'tienes', 'puedes', 'quieres', 'me pones'] },
    casual: { good: ['tú'], bad: ['usted'] },
  },
};
