// The game hooks of the `station_ic` conversation (agent 2G, docs/GAME_DESIGN.md §6.3). The generic shop hooks price a basket of menu
// items; this counter does something else: it sells the IC card (¥500 deposit) AND moves cash onto the card, tops the card up, or pays
// the balance back, so it has its own `SessionGameHooks`. The conversation host passes them as `SessionOptions.game` together with
// `flags: { priced: true }` and the session id the conversation settles under (the ledger ids derive from it).
//
// Deliberately free of the app stores: everything arrives through `IcDeps`, so a test drives it with the real reducer and no UI.
import { type Vars, yenToJa } from '@lw/content';
import type { SessionGameHooks } from '@lw/engine';
import { BALANCE, creditRoom, hasFeature, quote, refundPlan, scaleAmount, walletLimits, type GamePack, type GameState, type GameView, type InputEvent, type ReduceResult } from '@lw/game';

/** Scenario ids these hooks serve (the conversation host picks them by id). */
export const IC_SCENARIO = 'station_ic';
const SHOP = 'station';
const CARD = 'ic_card';

export interface IcDeps {
  pack: GamePack;
  /** the live game state, read again at every call */
  state(): GameState;
  /** the legacy-store slice the pricing reads (`selectors.gameView`) */
  view(): GameView;
  /** runs an event through the reducer (`bridge.dispatch`) */
  dispatch(event: InputEvent): ReduceResult;
  /** `ConversationFacts.sessionId`: the ledger key of everything this conversation moves */
  sessionId: string;
}

/** A yen amount as a Var; a zero amount reads 「ゼロ円」 (`yenToJa` starts at 1). */
function money(n: number): Vars[string] {
  if (n < 1) return { ja: 'ゼロ|円', gloss: { en: '0 yen', ar: '0 ين' } };
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
}

/**
 * What a request costs right now: the card first when the player has none (a top-up needs a card to load). The deposit is the
 * re-quoted price, so a friend's station perk (Sato, hearts 4) shows here exactly as `commitPurchase` will charge it;
 * `ok` is false when the shop does not sell the card (the pack lists no `station` shop yet).
 */
export function icQuote(pack: GamePack, state: GameState, view: GameView, amount: number): { needsCard: boolean; deposit: number; total: number; ok: boolean } {
  const needsCard = !hasFeature(pack, state, 'ic');
  if (!needsCard) return { needsCard, deposit: 0, total: amount, ok: true };
  const q = quote(pack, state, view, { shopId: SHOP, itemId: CARD, qty: 1, method: 'cash' });
  // a blocked quote has total 0: show the catalog price so the line is still honest, but refuse to charge
  const d = q.block && q.block !== 'funds' ? (pack.items.find((i) => i.id === CARD)?.price ?? 0) : q.total;
  return { needsCard, deposit: d, total: d + amount, ok: !q.block || q.block === 'funds' };
}

/** The amount the learner chose from the `chargeAmount` slot (its option id is the amount itself, §5.4), 0 when none or not a whole yen. */
const amountOf = (slots: Record<string, string>): number => {
  const n = Number(slots.chargeAmount);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

/** True when the card could hold `amount` more (the IC cap of §4.1: ¥3,000 until Chapter 5, ¥20,000 after). */
export const icHasRoom = (pack: GamePack, state: GameState, amount: number): boolean => amount <= creditRoom(state.wallet.ic, walletLimits(state, pack).ic);

export function icHooks(deps: IcDeps): SessionGameHooks {
  const { pack, sessionId } = deps;
  const fee = scaleAmount(BALANCE.icRefundFee, pack.economy, pack.currency);
  const catalogPrice = pack.items.find((i) => i.id === CARD)?.price ?? 0;

  return {
    vars(slots) {
      const s = deps.state();
      const v: Vars = {
        // what the card costs a player who has none; a player who has one still hears the figure in the explanation
        price: money(icQuote(pack, s, deps.view(), 0).deposit || catalogPrice),
        limit: money(walletLimits(s, pack).ic),
        balance: money(s.wallet.ic),
        fee: money(fee),
      };
      const amount = amountOf(slots);
      if (amount > 0) {
        v.amount = money(amount);
        v.total = money(icQuote(pack, s, deps.view(), amount).total);
      }
      return v;
    },

    // the learner named an amount: does the card have room for it? (the intent is `ask_total`; no other intent of this scenario uses it)
    intent(kind, ctx) {
      if (kind !== 'ask_total') return { ok: true };
      const s = deps.state();
      return { ok: icHasRoom(pack, s, amountOf(ctx.slotIds)), vars: { limit: money(walletLimits(s, pack).ic) } };
    },

    charge(slots) {
      const s = deps.state();
      if (slots.icService === 'refund') {
        if (!refundPlan(s, pack).ok) return { ok: false };
        deps.dispatch({ t: 'refund', id: sessionId });
        return { ok: true, vars: { balance: money(deps.state().wallet.ic) } };
      }
      const amount = amountOf(slots);
      const q = icQuote(pack, s, deps.view(), amount);
      // everything is checked before anything moves, so a refusal never leaves the player with a card and an empty wallet
      if (amount === 0 || !q.ok || s.wallet.cash < q.total || !icHasRoom(pack, s, amount)) return { ok: false };
      if (q.needsCard) {
        deps.dispatch({
          t: 'purchase',
          sessionId,
          n: 1,
          shopId: SHOP,
          itemId: CARD,
          qty: 1,
          total: q.deposit,
          method: 'cash',
          lines: [{ kind: 'item', ref: CARD, label: { en: 'IC card (deposit)', ar: 'بطاقة IC (وديعة)' }, qty: 1, unit: q.deposit, amount: q.deposit }],
        });
        // the card is the first thing the deposit buys; without it (a shop the pack does not list) nothing was charged
        if (!hasFeature(pack, deps.state(), 'ic')) return { ok: false };
      }
      deps.dispatch({ t: 'topup', id: sessionId, amount });
      return { ok: true, vars: { balance: money(deps.state().wallet.ic) } };
    },
  };
}
