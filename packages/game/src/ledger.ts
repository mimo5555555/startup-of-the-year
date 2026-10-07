// The idempotent ledger (agent 1B). Every payout or charge is one LedgerEntry applied by `applyLedger`, keyed by id.
import { BALANCE } from './balance';
import { clampCredit, pocketCap, refundPlan, topUpPlan, walletLimits, withPocket } from './money';
import type { GamePack, GameState, LedgerEntry, LedgerResult, Pocket, ReconcileReport, WalletLimits } from './types';

/** A day key is `d<dayIndex>` (D3). */
export const dayKey = (dayIndex: number): string => `d${dayIndex}`;

/** Ledger id formats (§14.9). Implemented here so no agent invents a second spelling. */
export const LEDGER_IDS = {
  loop: (sessionId: string) => `loop:${sessionId}`,
  purchase: (sessionId: string, n: number) => `purchase:${sessionId}:${n}`,
  goal: (dayIndex: number, goalId: string) => `goal:${dayKey(dayIndex)}:${goalId}`,
  streak: (dayIndex: number) => `streak:${dayKey(dayIndex)}`,
  chapter: (n: number) => `chapter:${n}`,
  star: (scenarioId: string, n: 1 | 2 | 3) => `star:${scenarioId}:${n}`,
  phrase: (day: string, k: number) => `phrase:${day}:${k}`,
  echo: (sessionId: string, lineId: string) => `echo:${sessionId}:${lineId}`,
  shift: (day: string, jobId: string, n: number) => `shift:${day}:${jobId}:${n}`,
  gift: (sessionId: string) => `gift:${sessionId}`,
  perk: (id: string) => `perk:${id}`,
  /** transfers and fares (not in §14.9; same style): `<id>` is a panel/session id */
  topup: (id: string) => `topup:${id}`,
  refund: (id: string) => `refund:${id}`,
  fare: (id: string) => `fare:${id}`,
} as const;

/** Whether an id was already processed: the `seen` ring (300) or, as a second witness, the entry ring (200). */
export function ledgerHas(state: GameState, id: string): boolean {
  return state.seen.includes(id) || state.ledger.some((e) => e.id === id);
}

/** Records an id as processed without moving money (a zero-delta or fully clamped entry must still not apply twice). */
function markSeen(state: GameState, id: string): GameState {
  return { ...state, seen: [...state.seen, id].slice(-BALANCE.ledger.seen) };
}

/** Topups and refunds move yen between pockets: they never count as earned or spent (§4.1). */
const isTransfer = (kind: LedgerEntry['kind']): boolean => kind === 'topup' || kind === 'refund';

/**
 * Applies one entry once: a repeated id is a no-op (`duplicate`, applied false); a delta that would take a pocket below 0 is
 * refused (`insufficient`, applied false); a credit is clamped to `limits` (applied true, reason `capped`; fully clamped to 0 is
 * applied false). Updates the pocket, `totals` (cash and ic only, points excluded; topup and refund are transfers and never touch
 * earned/spent), `checksum` (the applied, post-clamp delta) and the `ledger` / `seen` rings.
 * A refused entry is not recorded (the player may retry after earning); a zero or fully clamped one is recorded as seen so a
 * replay after the wallet has room again cannot pay it late.
 */
export function applyLedger(state: GameState, entry: LedgerEntry, limits: WalletLimits): LedgerResult {
  if (ledgerHas(state, entry.id)) return { state, applied: false, reason: 'duplicate' };
  const want = Math.trunc(entry.delta);
  if (!Number.isFinite(want) || want === 0) return { state: markSeen(state, entry.id), applied: false };

  const pocket: Pocket = entry.pocket;
  const balance = state.wallet[pocket];
  let applied = want;
  let reason: LedgerResult['reason'];
  if (want < 0) {
    if (balance + want < 0) return { state, applied: false, reason: 'insufficient' };
  } else {
    applied = clampCredit(want, balance, pocketCap(pocket, limits));
    if (applied <= 0) return { state: markSeen(state, entry.id), applied: false, reason: 'capped' };
    if (applied < want) reason = 'capped';
  }

  const totals = { ...state.totals, checksum: withPocket(state.totals.checksum, pocket, state.totals.checksum[pocket] + applied) };
  if (pocket !== 'points' && !isTransfer(entry.kind)) {
    if (applied > 0) totals.earned += applied;
    else totals.spent -= applied;
  }
  const next: GameState = {
    ...state,
    wallet: withPocket(state.wallet, pocket, balance + applied),
    totals,
    ledger: [...state.ledger, { ...entry, delta: applied }].slice(-BALANCE.ledger.entries),
    seen: [...state.seen, entry.id].slice(-BALANCE.ledger.seen),
  };
  return reason ? { state: next, applied: true, reason } : { state: next, applied: true };
}

/**
 * Applies several entries as one unit: all or nothing. The first duplicate id (a replayed event) or a debit a pocket cannot meet
 * refuses the whole batch with the original state; a credit that is clamped or fully clamped does not. `applied` is true when
 * anything moved. Used by purchases (money + points) and the transfers (cash <-> ic).
 */
export function applyLedgerAll(state: GameState, entries: LedgerEntry[], limits: WalletLimits): LedgerResult {
  let cur = state;
  let any = false;
  let capped = false;
  for (const e of entries) {
    const r = applyLedger(cur, e, limits);
    if (r.reason === 'duplicate' || r.reason === 'insufficient') return { state, applied: false, reason: r.reason };
    cur = r.state;
    any ||= r.applied;
    capped ||= r.reason === 'capped';
  }
  return capped ? { state: cur, applied: any, reason: 'capped' } : { state: cur, applied: any };
}

/** cash -> ic in one idempotent pair of entries, honouring the IC cap (§4.1); ledger kind 'topup'. A top-up beyond the cap or the cash held is refused whole. */
export function topUp(state: GameState, pack: GamePack, id: string, amount: number, at: number): LedgerResult {
  const main = LEDGER_IDS.topup(id);
  if (ledgerHas(state, main)) return { state, applied: false, reason: 'duplicate' };
  const plan = topUpPlan(state, pack, amount);
  if (!plan.ok) return { state, applied: false, reason: plan.reason };
  return applyLedgerAll(
    state,
    [
      { id: `${main}:cash`, at, kind: 'topup', delta: -plan.amount, pocket: 'cash', ref: id },
      { id: main, at, kind: 'topup', delta: plan.amount, pocket: 'ic', ref: id },
    ],
    walletLimits(state, pack),
  );
}

/**
 * ic -> cash less BALANCE.icRefundFee (needs a balance above the fee); ledger kind 'refund'. The balance leaves the card as the
 * fee (kind 'fare', the one part that is spent) plus the transfer back to cash, so `reconcile` still balances.
 */
export function refundIc(state: GameState, pack: GamePack, id: string, at: number): LedgerResult {
  const main = LEDGER_IDS.refund(id);
  if (ledgerHas(state, main)) return { state, applied: false, reason: 'duplicate' };
  const plan = refundPlan(state, pack);
  if (!plan.ok) return { state, applied: false, reason: plan.reason };
  return applyLedgerAll(
    state,
    [
      { id: `${main}:fee`, at, kind: 'fare', delta: -plan.fee, pocket: 'ic', ref: id, note: 'refund fee' },
      { id: main, at, kind: 'refund', delta: -plan.net, pocket: 'ic', ref: id },
      { id: `${main}:cash`, at, kind: 'refund', delta: plan.net, pocket: 'cash', ref: id },
    ],
    walletLimits(state, pack),
  );
}

/** cash + ic = startCash + earned - spent, and each pocket (points included) against its checksum; never against the 200-entry ring. */
export function reconcile(state: GameState, startCash: number): ReconcileReport {
  const expected = startCash + state.totals.earned - state.totals.spent;
  const actual = state.wallet.cash + state.wallet.ic;
  const mismatches = (['cash', 'ic', 'points'] as const).filter((p) => state.wallet[p] !== state.totals.checksum[p]);
  return { ok: expected === actual && mismatches.length === 0, expected, actual, mismatches: [...mismatches] };
}
