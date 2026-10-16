// The Hikarigaoka trip (Release 2 wave C1, docs/GAME_DESIGN.md §5.4, §6.5, D29): a panel destination reached through the normal Prepare -> Conversation path.
// The round-trip fare is charged UP FRONT, once, when the conversation with Kato starts (a `fare` event with `legs: 2`; the return is prepaid so nobody is
// stranded or goes negative), and `trip_done` files `trip:hikarigaoka` when the talk ends (`bridge.ts`). The charge is idempotent: its ledger id is derived
// from the place, the day and how many times the trip was finished, so a double tap, a reload or a second tap after leaving never charges twice.
import { BALANCE, LEDGER_IDS, fareFor, ledgerHas, type GamePack, type GameState } from '@lw/game';

/** The destination of a trip scenario (`ScenarioMeta.kind === 'trip'`, its `place`), or null for any other scenario. */
export function tripOf(pack: GamePack, scenarioId: string): string | null {
  const meta = pack.scenarioMeta.find((m) => m.id === scenarioId);
  if (meta?.kind === 'trip') return meta.place ?? null;
  return scenarioId === 'trip_hikarigaoka' ? 'hikarigaoka' : null;
}

export interface TripQuote {
  place: string;
  /** one way, as the player pays it (IC fare, or the paper ticket when only cash will do), after Sato's friend perk */
  each: number;
  /** both ways */
  total: number;
  /** how it is paid: the IC card when it holds the whole round trip, else a paper ticket in cash; null when neither covers it */
  method: 'ic' | 'paper' | null;
  /** the id the ledger entry carries (`fare:<id>`): one per trip */
  id: string;
}

/** What the round trip costs and with what it would be paid. */
export function tripQuote(pack: GamePack, state: GameState, scenarioId: string, place: string): TripQuote {
  const legs = BALANCE.fares.tripLegs;
  const id = `trip:${place}:${state.clock.dayIndex}:${state.runs[scenarioId]?.count ?? 0}`;
  const ic = fareFor(pack, state, place, 'ic') * legs;
  const paper = fareFor(pack, state, place, 'paper') * legs;
  if (state.wallet.ic >= ic) return { place, each: ic / legs, total: ic, method: 'ic', id };
  if (state.wallet.cash >= paper) return { place, each: paper / legs, total: paper, method: 'paper', id };
  return { place, each: paper / legs, total: paper, method: null, id };
}

/** Whether this trip's fare is already in the ledger (a repeat tap, or a reload in the middle of the trip). */
export const tripPaid = (state: GameState, quote: TripQuote): boolean => ledgerHas(state, LEDGER_IDS.fare(quote.id));
