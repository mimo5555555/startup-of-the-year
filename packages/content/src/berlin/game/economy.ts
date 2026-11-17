// Berlin's money (German step 2): euro and cents. Every amount of the pack is in cents (the pack's minor unit); BALANCE amounts written
// against the yen reference are scaled by `incomeScale` (the German minimum wage against the reference wage).
import type { CurrencyDef, EconomyDef, LanguagePlugin, PackRules, TaxRegime } from '@lw/game';
import { deMatchForms, euroText, germanNumber, parseGermanNumbers } from '@lw/core';

export const EUR: CurrencyDef = {
  code: 'EUR',
  symbol: '€',
  minorPerMajor: 100,
  symbolPlacement: 'suffix',
  groupSep: '.',
  decimalSep: ',',
  roundTo: 1,
  spoken: 'Euro',
};

/** €13.90 an hour (the reference wage), €30 to start with (Lena hands it over with the keys), a big ticket from €50 */
export const DE_ECONOMY: EconomyDef = {
  refWage: 1390,
  incomeScale: 1390 / 1150,
  startCash: 3000,
  walletCap: 9_999_999,
  bigTicket: 5000,
};

/** Prices include VAT (MwSt.): 19 % standard, 7 % for food and for local public transport. */
export const DE_TAX: TaxRegime = {
  inclusive: true,
  rates: { standard: 0.19, food: 0.07, transport: 0.07 },
  takeOutRate: 0.07,
  eatInRate: 0.19,
};

/** Haggling is for the flea market only: at most 15 % or €15 off, half of that when the haggle was assisted. A small tip is usual. */
export const DE_RULES: PackRules = {
  negotiation: { flohmarkt: { maxPct: 0.15, maxAmount: 1500, assistedShare: 0.5 } },
  haggling: true,
  shoesOff: true,
  tipping: 'small',
  pointsCard: false,
  deliveryFee: 0,
};

/**
 * The game's German: numbers in words, prices as written and said (2,50 € / zwei Euro fünfzig), numbers said in an utterance in cents
 * (「fünfzehn Euro」 → 1500, 「2,50」 → 250), matching forms for speech, and Sie / du as the register markers.
 */
export const DE_LANGUAGE: LanguagePlugin = {
  readNumber: (n) => germanNumber(n),
  priceMarkup: (n) => {
    const t = euroText(n);
    return { markup: t.written, reading: t.words, gloss: { en: t.en, ar: t.ar } };
  },
  parseNumbers: (text) => {
    const r = parseGermanNumbers(text);
    return { text: r.text, numbers: r.numbers.map((x) => Math.round(x * 100)) };
  },
  speechNormalize: (text) => deMatchForms(text).folded,
  registerMarkers: {
    polite: { good: ['Sie', 'Ihnen', 'bitte', 'möchte'], bad: ['du', 'dir', 'dich', 'kannst', 'willst', 'hast du'] },
    keigo: { good: ['Sie', 'Ihnen', 'bitte', 'möchte', 'würden'], bad: ['du', 'dir', 'dich', 'kannst', 'willst', 'hast du'] },
    casual: { good: ['du', 'dir', 'dich'], bad: ['Sie', 'Ihnen'] },
  },
};
