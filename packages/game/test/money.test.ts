import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { canAfford, clampCredit, creditRoom, formatHours, pocketCap, pocketFor, refundPlan, scaleAmount, topUpPlan, walletLimits, workHours, yenFormat } from '../src/money';
import { ECON, JPY, mkPack, mkState, rng } from './fixtures-money';
import type { CurrencyDef, EconomyDef } from '../src/types';

const pack = mkPack();

describe('yenFormat', () => {
  it('groups in threes with the symbol in front', () => {
    expect(yenFormat(0, JPY)).toBe('¥0');
    expect(yenFormat(160, JPY)).toBe('¥160');
    expect(yenFormat(1050, JPY)).toBe('¥1,050');
    expect(yenFormat(24800, JPY)).toBe('¥24,800');
    expect(yenFormat(1_211_910, JPY)).toBe('¥1,211,910');
    expect(yenFormat(9_999_999, JPY)).toBe('¥9,999,999');
  });
  it('is total: negatives, fractions and junk never throw', () => {
    expect(yenFormat(-1500, JPY)).toBe('-¥1,500');
    expect(yenFormat(12.9, JPY)).toBe('¥12');
    expect(yenFormat(Number.NaN, JPY)).toBe('¥0');
  });
  it('handles a 100-minor currency with a suffix symbol (other packs)', () => {
    const eur: CurrencyDef = { code: 'EUR', symbol: '€', minorPerMajor: 100, symbolPlacement: 'suffix', groupSep: '.', decimalSep: ',', roundTo: 5 };
    expect(yenFormat(350, eur)).toBe('3,50 €');
    expect(yenFormat(123456, eur)).toBe('1.234,56 €');
    expect(yenFormat(5, eur)).toBe('0,05 €');
  });
});

describe('work-hours chip', () => {
  it('price / refWage, one decimal, whole hours from 100', () => {
    expect(workHours(24800, ECON)).toBeCloseTo(21.565, 3);
    expect(formatHours(workHours(24800, ECON))).toBe('21.6');
    expect(formatHours(workHours(198000, ECON))).toBe('172');
    expect(formatHours(workHours(1_211_910, ECON))).toBe('1054');
    expect(formatHours(0.04)).toBe('0.0');
  });
  it('a pack with no reference wage shows nothing instead of Infinity', () => {
    expect(workHours(5000, { ...ECON, refWage: 0 })).toBe(0);
  });
  it('the chip threshold comes from BALANCE', () => {
    expect(BALANCE.workHoursChipMin).toBe(2000);
  });
});

describe('scaleAmount', () => {
  const half: EconomyDef = { ...ECON, refWage: 575, incomeScale: 0.5 };
  it('is the identity for the reference pack', () => {
    for (const x of [20, 100, 220, 300, 14000, 8880]) expect(scaleAmount(x, ECON, JPY)).toBe(x);
  });
  it('rounds to the currency step and never scales a non-zero amount to nothing', () => {
    const step5: CurrencyDef = { ...JPY, roundTo: 5 };
    expect(scaleAmount(100, half, step5)).toBe(50);
    expect(scaleAmount(220, half, step5)).toBe(110);
    expect(scaleAmount(1, { ...ECON, incomeScale: 0.01 }, JPY)).toBe(1);
    expect(scaleAmount(0, half, JPY)).toBe(0);
  });
});

describe('wallet limits (§4.1)', () => {
  it('the IC cap is 3,000 until chapter 5 is current and 20,000 after', () => {
    expect(walletLimits(mkState({ chapter: 1 }), pack)).toEqual({ cash: 9_999_999, ic: 3000 });
    expect(walletLimits(mkState({ chapter: 4 }), pack).ic).toBe(3000);
    expect(walletLimits(mkState({ chapter: 5 }), pack).ic).toBe(20000);
    expect(walletLimits(mkState({ chapter: 9 }), pack).ic).toBe(20000);
  });
  it('a pack without an IC card has a zero IC cap', () => {
    const p = mkPack({ economy: { ...ECON, icCap: undefined } });
    expect(walletLimits(mkState(), p).ic).toBe(0);
  });
  it('canAfford reads the pocket behind the method; card draws on cash', () => {
    const s = mkState({ cash: 500, ic: 200 });
    expect(canAfford(s, 500)).toBe(true);
    expect(canAfford(s, 501)).toBe(false);
    expect(canAfford(s, 200, 'ic')).toBe(true);
    expect(canAfford(s, 201, 'ic')).toBe(false);
    expect(canAfford(s, 500, 'card')).toBe(true);
    expect(pocketFor('card')).toBe('cash');
    expect(pocketFor('ic')).toBe('ic');
  });
});

describe('credit clamping', () => {
  it('property: a clamped credit is never negative-room and never pushes a pocket over its cap', () => {
    const r = rng(11);
    for (let i = 0; i < 2000; i++) {
      const cap = Math.floor(r() * 50_000);
      const balance = Math.floor(r() * 60_000);
      const delta = Math.floor(r() * 30_000) + 1;
      const got = clampCredit(delta, balance, cap);
      expect(got).toBeLessThanOrEqual(delta);
      expect(creditRoom(balance, cap)).toBeGreaterThanOrEqual(0);
      // over the cap already (a cap that dropped, never happens here) the credit is 0, not negative
      expect(got).toBeGreaterThanOrEqual(0);
      if (balance <= cap) expect(balance + got).toBeLessThanOrEqual(cap);
    }
  });
  it('points share the wallet cap', () => {
    expect(pocketCap('points', { cash: 100, ic: 5 })).toBe(100);
    expect(pocketCap('ic', { cash: 100, ic: 5 })).toBe(5);
  });
});

describe('topUpPlan and refundPlan', () => {
  it('a top-up needs cash and room under the IC cap', () => {
    expect(topUpPlan(mkState({ cash: 3000, ic: 0 }), pack, 1000)).toEqual({ ok: true, amount: 1000 });
    expect(topUpPlan(mkState({ cash: 3000, ic: 2500 }), pack, 1000)).toEqual({ ok: false, reason: 'capped' });
    expect(topUpPlan(mkState({ cash: 500, ic: 0 }), pack, 1000)).toEqual({ ok: false, reason: 'insufficient' });
    expect(topUpPlan(mkState({ cash: 30000, ic: 0, chapter: 5 }), pack, 20000)).toEqual({ ok: true, amount: 20000 });
    expect(topUpPlan(mkState({ cash: 30000, ic: 0, chapter: 4 }), pack, 5000)).toEqual({ ok: false, reason: 'capped' });
  });
  it('rejects zero, negative and fractional-only amounts', () => {
    for (const a of [0, -100, 0.4, Number.NaN]) expect(topUpPlan(mkState(), pack, a).ok).toBe(false);
  });
  it('a refund needs a balance above the 220 yen fee and returns the rest', () => {
    expect(refundPlan(mkState({ ic: 220 }), pack)).toEqual({ ok: false, reason: 'insufficient' });
    expect(refundPlan(mkState({ ic: 0 }), pack)).toEqual({ ok: false, reason: 'insufficient' });
    expect(refundPlan(mkState({ ic: 221 }), pack)).toEqual({ ok: true, balance: 221, fee: 220, net: 1 });
    expect(refundPlan(mkState({ ic: 3000 }), pack)).toEqual({ ok: true, balance: 3000, fee: BALANCE.icRefundFee, net: 2780 });
  });
  it('a refund that would overflow the wallet is refused, not truncated', () => {
    expect(refundPlan(mkState({ cash: 9_999_000, ic: 3000 }), pack)).toEqual({ ok: false, reason: 'capped' });
  });
});
