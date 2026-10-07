// Money helpers: currency formatting, the work-hours yardstick, wallet limits (agent 1B). Everything here is pure and ledger-agnostic:
// the ledger (ledger.ts) and pricing (pricing.ts) build on these, and nothing here reads a ledger entry.
import { BALANCE } from './balance';
import type { CurrencyDef, EconomyDef, GamePack, GameState, PayMethod, Pocket, WalletLimits, WalletState } from './types';

/** Groups the integer digits of a non-negative integer string in threes. */
function group(digits: string, sep: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Formats an amount in minor units with the pack's symbol, grouping and placement (JP: 24800 -> '¥24,800'). */
export function yenFormat(amount: number, cur: CurrencyDef): string {
  const a = Math.trunc(Number.isFinite(amount) ? amount : 0);
  const neg = a < 0;
  const abs = Math.abs(a);
  const major = Math.floor(abs / cur.minorPerMajor);
  let num = group(String(major), cur.groupSep);
  if (cur.minorPerMajor > 1) {
    const decimals = String(cur.minorPerMajor - 1).length;
    num += cur.decimalSep + String(abs % cur.minorPerMajor).padStart(decimals, '0');
  }
  const body = cur.symbolPlacement === 'prefix' ? `${cur.symbol}${num}` : `${num} ${cur.symbol}`;
  return neg ? `-${body}` : body;
}

/** price / refWage, the "≈ 21.6 h of work" chip (§4.1); callers show it only above BALANCE.workHoursChipMin. Unrounded; `formatHours` makes the label. */
export function workHours(price: number, econ: EconomyDef): number {
  return econ.refWage > 0 ? price / econ.refWage : 0;
}

/** The chip's number: one decimal ('21.6'), whole numbers from 100 h up ('172'). */
export function formatHours(hours: number): string {
  return hours >= 100 ? String(Math.round(hours)) : (Math.round(hours * 10) / 10).toFixed(1);
}

/** A BALANCE amount (every ¥-marked key in balance.ts) scaled by `incomeScale` and rounded to `cur.roundTo` (§14.6). Pack data is never passed through it. */
export function scaleAmount(base: number, econ: EconomyDef, cur: CurrencyDef): number {
  const step = Math.max(1, Math.round(cur.roundTo));
  const scaled = Math.round((base * econ.incomeScale) / step) * step;
  // a positive reference amount never scales to nothing (a 1-yen fee in a cheap pack still costs one step)
  return base !== 0 && scaled === 0 ? Math.sign(base) * step : scaled;
}

/** Pocket caps right now: `economy.walletCap` for cash, and `economy.icCap.early` until chapter BALANCE.icCap.lateFrom is current, `.late` after (0 when the pack has no IC card). */
export function walletLimits(state: GameState, pack: GamePack): WalletLimits {
  const ic = pack.economy.icCap;
  return {
    cash: pack.economy.walletCap,
    ic: ic ? (state.chapter.n >= BALANCE.icCap.lateFrom ? ic.late : ic.early) : 0,
  };
}

/** Whether the pocket behind `method` (cash and card -> cash, ic -> ic) holds at least `amount`. Default method: cash. */
export function canAfford(state: GameState, amount: number, method: PayMethod = 'cash'): boolean {
  return state.wallet[method === 'ic' ? 'ic' : 'cash'] >= amount;
}

// ---------------------------------------------------------------------------------------------------------------
// Wallet arithmetic shared with the ledger. All integers; a pocket is never negative and never above its cap.
// ---------------------------------------------------------------------------------------------------------------

/** The cap of one pocket. Points have no pocket of their own in `WalletLimits`; they share the wallet cap so they stay bounded. */
export function pocketCap(pocket: Pocket, limits: WalletLimits): number {
  return pocket === 'ic' ? limits.ic : limits.cash;
}

/** How much more a pocket can take before its cap (0 when full or over). */
export function creditRoom(balance: number, cap: number): number {
  return Math.max(0, cap - balance);
}

/** The part of a credit a pocket can take: `delta` clamped to the room left. */
export function clampCredit(delta: number, balance: number, cap: number): number {
  return Math.min(delta, creditRoom(balance, cap));
}

/** A copy of the wallet with one pocket replaced. */
export function withPocket(wallet: WalletState, pocket: Pocket, value: number): WalletState {
  return { ...wallet, [pocket]: value };
}

/** The pocket a payment method draws on (card is a cash-pocket debit). */
export function pocketFor(method: PayMethod): 'cash' | 'ic' {
  return method === 'ic' ? 'ic' : 'cash';
}

/** What a top-up of `amount` would do right now: refused (with the reason) or the cash -> ic amount. Never moves more than the IC cap or the cash held. */
export function topUpPlan(state: GameState, pack: GamePack, amount: number): { ok: true; amount: number } | { ok: false; reason: 'insufficient' | 'capped' } {
  const a = Math.trunc(amount);
  if (!Number.isFinite(a) || a <= 0) return { ok: false, reason: 'insufficient' };
  const lim = walletLimits(state, pack);
  if (a > creditRoom(state.wallet.ic, lim.ic)) return { ok: false, reason: 'capped' };
  if (a > state.wallet.cash) return { ok: false, reason: 'insufficient' };
  return { ok: true, amount: a };
}

/** What a refund would do right now: the fee, the cash that comes back and the balance that leaves the card. A balance at or below the fee is refused. */
export function refundPlan(state: GameState, pack: GamePack):
  | { ok: true; balance: number; fee: number; net: number }
  | { ok: false; reason: 'insufficient' | 'capped' } {
  const fee = scaleAmount(BALANCE.icRefundFee, pack.economy, pack.currency);
  const balance = state.wallet.ic;
  if (balance <= fee) return { ok: false, reason: 'insufficient' };
  const net = balance - fee;
  // a refund that would overflow the wallet is refused rather than silently losing yen
  if (net > creditRoom(state.wallet.cash, walletLimits(state, pack).cash)) return { ok: false, reason: 'capped' };
  return { ok: true, balance, fee, net };
}
