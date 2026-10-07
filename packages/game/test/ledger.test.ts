import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { applyLedger, applyLedgerAll, dayKey, LEDGER_IDS, ledgerHas, reconcile, refundIc, topUp } from '../src/ledger';
import { walletLimits } from '../src/money';
import type { GameState, LedgerEntry, LedgerKind, Pocket } from '../src/types';
import { ECON, mkPack, mkState, rng } from './fixtures-money';

const pack = mkPack();
const limits = (s: GameState) => walletLimits(s, pack);
const e = (id: string, delta: number, pocket: Pocket = 'cash', kind: LedgerKind = 'loop'): LedgerEntry => ({ id, at: 1, kind, delta, pocket });

describe('id formats (§14.9)', () => {
  it('are the documented spellings', () => {
    expect(LEDGER_IDS.loop('s1')).toBe('loop:s1');
    expect(LEDGER_IDS.purchase('s1', 2)).toBe('purchase:s1:2');
    expect(LEDGER_IDS.goal(4, 'g_talk')).toBe('goal:d4:g_talk');
    expect(LEDGER_IDS.streak(4)).toBe('streak:d4');
    expect(LEDGER_IDS.chapter(3)).toBe('chapter:3');
    expect(LEDGER_IDS.star('konbini', 2)).toBe('star:konbini:2');
    expect(LEDGER_IDS.phrase('d1', 3)).toBe('phrase:d1:3');
    expect(LEDGER_IDS.echo('s1', 'l9')).toBe('echo:s1:l9');
    expect(LEDGER_IDS.shift('d2', 'job_konbini', 1)).toBe('shift:d2:job_konbini:1');
    expect(LEDGER_IDS.gift('s1')).toBe('gift:s1');
    expect(LEDGER_IDS.perk('scholarship')).toBe('perk:scholarship');
    expect(dayKey(12)).toBe('d12');
  });
});

describe('applyLedger', () => {
  it('applies a credit once: totals, checksum and rings move together', () => {
    const s0 = mkState();
    const r = applyLedger(s0, e('loop:a', 515), limits(s0));
    expect(r.applied).toBe(true);
    expect(r.state.wallet.cash).toBe(3515);
    expect(r.state.totals.earned).toBe(515);
    expect(r.state.totals.checksum.cash).toBe(3515);
    expect(r.state.ledger).toHaveLength(1);
    expect(r.state.seen).toEqual(['loop:a']);
    expect(s0.wallet.cash).toBe(3000); // input untouched
  });
  it('apply twice = once', () => {
    const s0 = mkState();
    const once = applyLedger(s0, e('loop:a', 515), limits(s0));
    const twice = applyLedger(once.state, e('loop:a', 515), limits(s0));
    expect(twice.applied).toBe(false);
    expect(twice.reason).toBe('duplicate');
    expect(twice.state).toBe(once.state);
  });
  it('a debit beyond the pocket is refused and not recorded, so the player can retry later', () => {
    const s0 = mkState({ cash: 100 });
    const r = applyLedger(s0, e('purchase:s:1', -101, 'cash', 'purchase'), limits(s0));
    expect(r).toMatchObject({ applied: false, reason: 'insufficient' });
    expect(r.state).toBe(s0);
    const s1 = applyLedger(s0, e('loop:b', 50), limits(s0)).state;
    expect(applyLedger(s1, e('purchase:s:1', -101, 'cash', 'purchase'), limits(s1)).applied).toBe(true);
  });
  it('a credit is clamped to the cap and the clamped amount is what counts', () => {
    const s0 = mkState({ cash: 9_999_900 });
    const r = applyLedger(s0, e('loop:big', 500), limits(s0));
    expect(r).toMatchObject({ applied: true, reason: 'capped' });
    expect(r.state.wallet.cash).toBe(9_999_999);
    expect(r.state.totals.earned).toBe(99);
    expect(r.state.ledger[0].delta).toBe(99);
    expect(reconcile(r.state, 9_999_900).ok).toBe(true);
  });
  it('a full wallet takes nothing, but the id is remembered so a late replay cannot pay', () => {
    const s0 = mkState({ cash: 9_999_999 });
    const r = applyLedger(s0, e('loop:x', 100), limits(s0));
    expect(r).toMatchObject({ applied: false, reason: 'capped' });
    const spent = applyLedger(r.state, e('purchase:s:1', -5000, 'cash', 'purchase'), limits(r.state)).state;
    expect(applyLedger(spent, e('loop:x', 100), limits(spent)).reason).toBe('duplicate');
    expect(spent.wallet.cash).toBe(9_994_999);
  });
  it('a zero delta moves nothing but is not replayable', () => {
    const s0 = mkState();
    const r = applyLedger(s0, e('loop:z', 0), limits(s0));
    expect(r.applied).toBe(false);
    expect(r.state.wallet).toEqual(s0.wallet);
    expect(ledgerHas(r.state, 'loop:z')).toBe(true);
  });
  it('points move their own pocket and never touch earned / spent', () => {
    const s0 = mkState();
    const r = applyLedger(s0, e('purchase:s:1:earn', 4, 'points', 'purchase'), limits(s0));
    expect(r.state.wallet.points).toBe(4);
    expect(r.state.totals).toMatchObject({ earned: 0, spent: 0, checksum: { cash: 3000, ic: 0, points: 4 } });
  });
  it('an IC fare is spent yen; an IC pocket never goes negative', () => {
    const s0 = mkState({ cash: 0, ic: 500 });
    const r = applyLedger(s0, e('fare:t1', -190, 'ic', 'fare'), limits(s0));
    expect(r.state.wallet.ic).toBe(310);
    expect(r.state.totals.spent).toBe(190);
    expect(applyLedger(r.state, e('fare:t2', -311, 'ic', 'fare'), limits(r.state)).reason).toBe('insufficient');
  });
  it('the id witness survives the entry ring: an id older than 200 entries is still a duplicate through `seen`', () => {
    let s = mkState();
    for (let i = 0; i < 350; i++) s = applyLedger(s, e(`loop:${i}`, 1), limits(s)).state;
    expect(s.ledger).toHaveLength(BALANCE.ledger.entries);
    expect(s.seen).toHaveLength(BALANCE.ledger.seen);
    // loop:100 left the 200-entry ring and is still in the 300 seen ring; loop:10 left both (a 300-id window is the documented limit)
    expect(s.ledger.some((x) => x.id === 'loop:100')).toBe(false);
    expect(applyLedger(s, e('loop:100', 1), limits(s)).reason).toBe('duplicate');
  });
});

describe('applyLedgerAll', () => {
  it('is all or nothing', () => {
    const s0 = mkState({ cash: 100 });
    const r = applyLedgerAll(s0, [e('a', 50), e('b', -500, 'cash', 'purchase')], limits(s0));
    expect(r).toMatchObject({ applied: false, reason: 'insufficient' });
    expect(r.state).toBe(s0);
  });
  it('a replayed first entry refuses the whole batch', () => {
    const s0 = mkState();
    const s1 = applyLedger(s0, e('a', 10), limits(s0)).state;
    const r = applyLedgerAll(s1, [e('a', 10), e('b', 10)], limits(s1));
    expect(r.reason).toBe('duplicate');
    expect(r.state).toBe(s1);
  });
});

describe('transfers (§4.1, E22)', () => {
  it('topUp moves cash to the IC card and never touches earned / spent', () => {
    const s0 = mkState({ cash: 3000 });
    const r = topUp(s0, pack, 'st1', 1000, 5);
    expect(r.applied).toBe(true);
    expect(r.state.wallet).toMatchObject({ cash: 2000, ic: 1000 });
    expect(r.state.totals.earned).toBe(0);
    expect(r.state.totals.spent).toBe(0);
    expect(reconcile(r.state, 3000).ok).toBe(true);
    expect(topUp(r.state, pack, 'st1', 1000, 5).reason).toBe('duplicate');
  });
  it('topUp beyond the cap or the cash held is refused whole', () => {
    expect(topUp(mkState({ cash: 9000 }), pack, 'x', 5000, 0).reason).toBe('capped');
    const s = mkState({ cash: 700, chapter: 5 });
    expect(topUp(s, pack, 'y', 1000, 0)).toMatchObject({ applied: false, reason: 'insufficient' });
    const ok = topUp(mkState({ cash: 30000, chapter: 5 }), pack, 'z', 20000, 0);
    expect(ok.state.wallet.ic).toBe(20000);
  });
  it('refundIc returns the balance as cash less the fee; the fee is the only spent part', () => {
    const s0 = topUp(mkState({ cash: 3000 }), pack, 't', 3000, 0).state;
    const r = refundIc(s0, pack, 'r1', 9);
    expect(r.applied).toBe(true);
    expect(r.state.wallet).toMatchObject({ cash: 2780, ic: 0 });
    expect(r.state.totals.spent).toBe(BALANCE.icRefundFee);
    expect(r.state.totals.earned).toBe(0);
    expect(reconcile(r.state, 3000)).toMatchObject({ ok: true, expected: 2780, actual: 2780 });
    expect(refundIc(r.state, pack, 'r1', 9).reason).toBe('duplicate');
  });
  it('a refund with a balance at or below the fee is refused', () => {
    const s0 = mkState({ cash: 0, ic: 220 });
    expect(refundIc(s0, pack, 'r', 0)).toMatchObject({ applied: false, reason: 'insufficient' });
  });
});

describe('reconcile', () => {
  it('detects a wallet edited behind the ledger', () => {
    const s0 = applyLedger(mkState(), e('loop:a', 100), limits(mkState())).state;
    expect(reconcile(s0, 3000).ok).toBe(true);
    const bad = { ...s0, wallet: { ...s0.wallet, cash: s0.wallet.cash + 1 } };
    expect(reconcile(bad, 3000)).toMatchObject({ ok: false, mismatches: ['cash'] });
    expect(reconcile(s0, 2000).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Properties (§15.9): a seeded random walk over every kind of entry, including replays, overdrafts and overflow.
// ---------------------------------------------------------------------------------------------------------------

describe('ledger properties', () => {
  const KINDS: LedgerKind[] = ['loop', 'shift', 'goal', 'streak', 'chapter', 'star', 'phrase', 'echo', 'purchase', 'fare', 'gift', 'perk'];

  function walk(seed: number, steps: number, opts: { startCash?: number; bigCredits?: boolean } = {}) {
    const r = rng(seed);
    const startCash = opts.startCash ?? ECON.startCash;
    let s = mkState({ cash: startCash });
    const ids: string[] = [];
    const states: GameState[] = [s];
    for (let i = 0; i < steps; i++) {
      const roll = r();
      const replay = roll < 0.12 && ids.length > 0;
      const id = replay ? ids[Math.floor(r() * ids.length)] : `${KINDS[Math.floor(r() * KINDS.length)]}:${seed}:${i}`;
      const pocket: Pocket = r() < 0.7 ? 'cash' : r() < 0.6 ? 'ic' : 'points';
      const mag = opts.bigCredits && r() < 0.05 ? 9_000_000 : Math.floor(r() * 3000);
      const delta = r() < 0.5 ? mag : -mag;
      // chapter changes mid-run move the IC cap up; the ledger must stay consistent across it
      if (i === Math.floor(steps / 2)) s = { ...s, chapter: { ...s.chapter, n: 5 } };
      const res = applyLedger(s, { id, at: i, kind: KINDS[Math.floor(r() * KINDS.length)], delta, pocket }, walletLimits(s, pack));
      if (!replay) ids.push(id);
      s = res.state;
      states.push(s);
    }
    return { s, states, startCash };
  }

  it('wallet pockets are never negative and never above their cap', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { states } = walk(seed, 600, { bigCredits: true });
      for (const st of states) {
        const lim = walletLimits(st, pack);
        expect(st.wallet.cash).toBeGreaterThanOrEqual(0);
        expect(st.wallet.ic).toBeGreaterThanOrEqual(0);
        expect(st.wallet.points).toBeGreaterThanOrEqual(0);
        expect(st.wallet.cash).toBeLessThanOrEqual(lim.cash);
        expect(st.wallet.ic).toBeLessThanOrEqual(Math.max(lim.ic, 0));
        expect(Number.isInteger(st.wallet.cash + st.wallet.ic + st.wallet.points)).toBe(true);
      }
    }
  });

  it('after 1,000+ entries the wallet still reconciles with totals and checksum, though the ring holds only 200', () => {
    for (const seed of [10, 11, 12]) {
      const { s, startCash } = walk(seed, 1500, { bigCredits: seed === 12 });
      expect(s.ledger.length).toBeLessThanOrEqual(BALANCE.ledger.entries);
      expect(s.seen.length).toBeLessThanOrEqual(BALANCE.ledger.seen);
      expect(s.ledger.length).toBe(BALANCE.ledger.entries); // the ring is full, so a ring-based audit could not work
      const rep = reconcile(s, startCash);
      expect(rep).toMatchObject({ ok: true, mismatches: [] });
      expect(rep.expected).toBe(rep.actual);
      // the ring alone cannot explain the wallet: summing it is NOT the audit
      const ringSum = s.ledger.reduce((a, x) => a + (x.pocket === 'points' ? 0 : x.delta), 0);
      expect(startCash + ringSum).not.toBe(s.wallet.cash + s.wallet.ic);
    }
  });

  it('idempotent: replaying every id of the run changes nothing', () => {
    const { s } = walk(21, 400);
    let t = s;
    for (const id of s.seen) t = applyLedger(t, { id, at: 0, kind: 'loop', delta: 777, pocket: 'cash' }, walletLimits(t, pack)).state;
    expect(t).toEqual(s);
  });

  it('transfers never touch totals, whatever the sequence', () => {
    const r = rng(33);
    let s = mkState({ cash: 500_000, chapter: 5 });
    const startTotals = { earned: s.totals.earned, spent: s.totals.spent };
    for (let i = 0; i < 400; i++) {
      const amount = (1 + Math.floor(r() * 5)) * 1000;
      const out = r() < 0.5 ? topUp(s, pack, `t${i}`, amount, i) : refundIc(s, pack, `r${i}`, i);
      s = out.state;
      expect(s.totals.earned).toBe(startTotals.earned);
      // only the refund fee is ever spent
      expect(reconcile(s, 500_000).ok).toBe(true);
    }
    expect(s.totals.spent % BALANCE.icRefundFee).toBe(0);
    expect(s.totals.earned).toBe(0);
  });

  it('a pure top-up / partial refund cycle: spent equals fees x refunds, cash + ic falls by exactly that', () => {
    let s = mkState({ cash: 10_000 });
    let refunds = 0;
    for (let i = 0; i < 6; i++) {
      s = topUp(s, pack, `a${i}`, 1000, i).state;
      const out = refundIc(s, pack, `b${i}`, i);
      if (out.applied) refunds++;
      s = out.state;
    }
    expect(refunds).toBe(6);
    expect(s.totals.spent).toBe(6 * BALANCE.icRefundFee);
    expect(s.wallet.cash + s.wallet.ic).toBe(10_000 - 6 * BALANCE.icRefundFee);
  });
});
