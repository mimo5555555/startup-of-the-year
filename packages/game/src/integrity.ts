// Clock and de-duplication (agent 1E).
import { BALANCE } from './balance';
import { emptyPay } from './defaults';
import { dayKey } from './ledger';
import type { ClockResult, DayKey, DedupeResult, GameState, PayState } from './types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The local YYYY-MM-DD of an epoch-ms timestamp (local fields, so DST days and time-zone hops follow the wall calendar). */
export function localDateString(nowMs: number): string {
  const d = new Date(nowMs);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getFullYear(), 4)}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * The pay counters of `day`: `pay` itself when it already belongs to the day, else the per-day counters reset. The lifetime and
 * cross-day parts survive a rollover (`seenIntents`, `lastPaid`, and `echoSession`, so a conversation that straddles midnight cannot
 * pay a fresh echo quota). Every reader that finds `pay.day` stale goes through this.
 */
export function payForDay(pay: PayState, day: DayKey): PayState {
  if (pay.day === day) return pay;
  return { ...emptyPay(day), seenIntents: pay.seenIntents, lastPaid: pay.lastPaid, echoSession: pay.echoSession };
}

/**
 * D3 / D27: a later local date adds exactly one day (whatever the jump) and runs the rollover (pay counters and caps reset);
 * an earlier date only re-anchors `lastLocalDate`; the same date changes nothing. Always updates `lastSeenAt`.
 * A non-finite time changes nothing; an unreadable `lastLocalDate` (corrupt save) is re-anchored without a rollover.
 */
export function observeClock(state: GameState, nowMs: number): ClockResult {
  if (!Number.isFinite(nowMs)) return { state, rolled: false };
  const d = localDateString(nowMs);
  const last = state.clock.lastLocalDate;
  // ISO dates of the same width order lexicographically, so no Date arithmetic (and no DST) is involved
  const later = DATE_RE.test(last) && d > last;
  const clock = { ...state.clock, lastSeenAt: nowMs, lastLocalDate: d };
  if (!later) return { state: { ...state, clock }, rolled: false };
  clock.dayIndex = state.clock.dayIndex + 1;
  return { state: { ...state, clock, pay: payForDay(state.pay, dayKey(clock.dayIndex)) }, rolled: true };
}

/**
 * Processes an event or session id once: records it in the `seen` ring (the ledger's ring, BALANCE.ledger.seen long); a known id is
 * not fresh. The caller picks ids that are not also ledger ids (`loop:<sessionId>` and friends), because `applyLedger` treats a
 * known id as already paid.
 */
export function dedupe(state: GameState, id: string): DedupeResult {
  if (state.seen.includes(id)) return { state, fresh: false };
  return { state: { ...state, seen: [...state.seen, id].slice(-BALANCE.ledger.seen) }, fresh: true };
}

/** Counts the first meaningful action of a dayIndex into `clock.activeDays` / `lastActiveDay`. */
export function markActive(state: GameState): GameState {
  const { clock } = state;
  if (clock.lastActiveDay === clock.dayIndex) return state;
  return { ...state, clock: { ...clock, activeDays: clock.activeDays + 1, lastActiveDay: clock.dayIndex } };
}
