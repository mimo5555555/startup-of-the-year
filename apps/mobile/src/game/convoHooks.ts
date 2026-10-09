// What the conversation screen hands the engine for the game (docs/GAME_DESIGN.md §6.2, §11.2): the economy hooks of one shop
// conversation, the flags, the recalled pocket lines. Pure on its inputs (state, view and the commit function are passed in), so a
// test can drive it without a screen; the Conversation screen passes the bridge's `dispatch`.
import { LEXICON, parseJaNumber, plainText, tokenize, yenToJa, type Vars } from '@lw/content';
import type { RecalledLines, SessionGameHooks } from '@lw/engine';
import {
  fareFor,
  ledgerHas,
  lineReady,
  LEDGER_IDS,
  pocketReady,
  quote,
  type DerivedEvent,
  type GamePack,
  type GameState,
  type GameView,
  type InputEvent,
  type PayMethod,
  type Quote,
  type ReduceResult,
  type ScenarioMeta,
} from '@lw/game';
import type { FriendPlan } from './friendsLogic';
import { IC_SCENARIO, icHooks } from './icHooks';

/** Slot option ids of `qty` (slots/shop.ts) and of `payMethod`. */
const QTY: Record<string, number> = { one: 1, two: 2, three: 3 };
const METHODS: PayMethod[] = ['cash', 'card', 'ic'];

/** Extra slots that REPLACE the main item when changed later (a present picked at the `goods` node), not an add-on like the ramen egg. */
const EXCLUSIVE_EXTRAS = ['giftItem'];

/** The twist flag fires on a third of the plays from the second one on (§6.2: hash(dayIndex, scenarioId, playCount) % 3 === 0). */
const TWIST_EVERY = 3;

/**
 * What the X of the conversation screen does. A conversation that reached its end node is settled (feedback and pay) instead of
 * thrown away: its purchase was charged at the end node, so leaving without settling would take the money and pay nothing. One that is
 * still open asks first (leaving mid-way pays nothing, E10).
 */
export const leaveAction = (ended: boolean): 'settle' | 'confirm' => (ended ? 'settle' : 'confirm');

export function twistFor(dayIndex: number, scenarioId: string, plays: number): boolean {
  if (plays < 1) return false;
  let h = 2166136261;
  for (const ch of `${dayIndex}:${scenarioId}:${plays}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % TWIST_EVERY === 0;
}

/** A price as a Vars value: yenToJa markup with its EN/AR gloss; a free basket (a perk covered it) reads 「ゼロ円」. */
export function yenVar(n: number): Vars[string] {
  if (n < 1) return { ja: 'ゼロ|円', gloss: { en: '0 yen', ar: '0 ين' } };
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
}

interface BasketLine {
  itemId: string;
  qty: number;
}

/** What one purchase in the conversation left behind: the receipt (merged when a bowl and an extra were paid together). */
export interface ConvoPurchase {
  n: number;
  method: PayMethod;
  receipt: Quote & { paid?: number; change?: number };
}

export interface ConvoGame {
  hooks: SessionGameHooks;
  flags: Record<string, boolean>;
  /** Japanese text of the pocket lines the learner has ready or knows (§3.2 recalled lines) */
  recalled: RecalledLines;
  /** the scenario's pocket was ready at start (the x1.10) */
  prepared: boolean;
  meta: ScenarioMeta | undefined;
  /** the numbers the lines last quoted, for the price chip */
  amounts(): { price?: number; total?: number; fare?: number };
  /** committed purchases, in order */
  purchases: ConvoPurchase[];
  /** derived events of those purchases (culture cards, unlocks...) for the debrief */
  derived: DerivedEvent[];
  /** a small talk or gift hand-over with a friend: its flags and variables are already in `flags` and the hooks (4A, `friendsLogic`) */
  friend: FriendPlan | null;
}

export interface ConvoGameDeps {
  pack: GamePack;
  scenarioId: string;
  sessionId: string;
  state(): GameState;
  view(): GameView;
  /** the bridge's `dispatch`: one purchase event per basket line (the IC counter also tops up and refunds) */
  commit(ev: InputEvent): ReduceResult;
  /** the host's plan for a friend conversation (small talk, gift): its flags and variables are added to the session's */
  friend?: FriendPlan | null;
}

/** Pocket lines of a scenario that count as recalled (§3.2): ready (a recall pass within 7 days) or a known card. */
export function recalledLines(pack: GamePack, state: GameState, view: GameView, meta: ScenarioMeta | undefined): string[] {
  const out: string[] = [];
  for (const id of meta?.pocket ?? []) {
    const line = pack.pockets[id]?.line;
    if (!line || line.ja.includes('{') || !lineReady(state, view, id)) continue;
    out.push(plainText(tokenize(line.ja, LEXICON).tokens));
  }
  return out;
}

/** Cash handed over for a cash payment: the next 1,000 up (a note), never more than the wallet held (display only; the ledger moves `total`). */
function handedOver(total: number, cashBefore: number): number {
  const note = 1000;
  return Math.min(Math.ceil(total / note) * note, cashBefore);
}

export function mergeQuotes(qs: Quote[]): Quote {
  const first = qs[0];
  return {
    ...first,
    lines: qs.flatMap((q) => q.lines),
    subtotal: qs.reduce((a, q) => a + q.subtotal, 0),
    tax: qs.reduce((a, q) => a + q.tax, 0),
    total: qs.reduce((a, q) => a + q.total, 0),
    bulky: qs.some((q) => q.bulky),
    confirm: qs.some((q) => q.confirm),
    hours: null,
    canPay: qs.every((q) => q.canPay),
  };
}

export function createConvoGame(deps: ConvoGameDeps): ConvoGame {
  const { pack, scenarioId, sessionId } = deps;
  const meta = pack.scenarioMeta.find((m) => m.id === scenarioId);
  const shopMeta = meta?.shop;
  const shop = shopMeta ? pack.shops.find((s) => s.id === shopMeta.shopId) : undefined;
  const log: ConvoGame['purchases'] = [];
  const derived: DerivedEvent[] = [];
  let last: { price?: number; total?: number; fare?: number } = {};
  let n = 0;
  /** every event the hooks commit keeps its derived events for the debrief (culture cards, unlocks) */
  const commit = (ev: InputEvent): ReduceResult => {
    const r = deps.commit(ev);
    derived.push(...r.derived);
    return r;
  };

  // slots are only ever set, never cleared: the order they changed in decides which of two exclusive ones counts
  let prev: Record<string, string> = {};
  let recent: string[] = [];
  const seeChanges = (slots: Record<string, string>) => {
    for (const k of Object.keys(slots)) if (slots[k] !== prev[k]) recent = [k, ...recent.filter((x) => x !== k)];
    prev = { ...slots };
  };

  const basketOf = (slots: Record<string, string>): BasketLine[] | null => {
    if (!shopMeta) return null;
    seeChanges(slots);
    const itemOf = (slot: string) => (slots[slot] ? shopMeta.itemMap[slots[slot]] : undefined);
    const age = (slot: string) => recent.indexOf(slot); // 0 = changed last
    const mainSlot = shopMeta.itemSlot;
    let main = mainSlot ? itemOf(mainSlot) : undefined;
    const extras = (shopMeta.extraSlots ?? []).filter((x) => itemOf(x));
    // an exclusive extra picked after the main item replaces it; one picked before it is dropped
    const newer = extras.filter((x) => EXCLUSIVE_EXTRAS.includes(x) && (!mainSlot || main === undefined || age(x) < age(mainSlot)));
    if (newer.length) main = undefined;
    const lines: BasketLine[] = [];
    if (main) lines.push({ itemId: main, qty: QTY[slots[shopMeta.qtySlot ?? ''] ?? 'one'] ?? 1 });
    for (const x of extras) {
      if (EXCLUSIVE_EXTRAS.includes(x) && !newer.includes(x)) continue;
      lines.push({ itemId: itemOf(x)!, qty: 1 });
    }
    return lines.length ? lines : null;
  };

  const methodOf = (slots: Record<string, string>): PayMethod => {
    const asked = METHODS.find((m) => m === slots.payMethod) ?? 'cash';
    // a shop that does not take the card the learner named takes cash
    return !shop || shop.pay.length === 0 || shop.pay.includes(asked) ? asked : 'cash';
  };

  const quoteAll = (basket: BasketLine[], method: PayMethod): Quote[] =>
    basket.map((l) => quote(pack, deps.state(), deps.view(), { shopId: shopMeta!.shopId, itemId: l.itemId, qty: l.qty, method }));

  /** a quote that could not be priced at all (unknown item, closed shop...); running short of money still has a total */
  const priced = (qs: Quote[]) => qs.every((q) => !q.block || q.block === 'funds');

  const totalNow = (slots: Record<string, string>): number | null => {
    const b = basketOf(slots);
    if (!b) return null;
    const qs = quoteAll(b, methodOf(slots));
    return priced(qs) ? qs.reduce((a, q) => a + q.total, 0) : null;
  };

  const shopHooks: SessionGameHooks = {
    vars(slots) {
      const v: Vars = {};
      const b = basketOf(slots);
      if (b) {
        const qs = quoteAll(b, methodOf(slots));
        if (priced(qs)) {
          v.price = yenVar(qs[0].lines[0]?.unit ?? qs[0].total);
          v.total = yenVar(qs.reduce((a, q) => a + q.total, 0));
        }
      }
      if (slots.place && pack.fares[slots.place] !== undefined) v.fare = yenVar(fareFor(pack, deps.state(), slots.place, 'ic'));
      return v;
    },

    charge(slots) {
      const b = basketOf(slots);
      if (!b || !shopMeta) return { ok: false };
      const method = methodOf(slots);
      const qs = quoteAll(b, method);
      // the whole basket is checked once, then committed line by line (a bowl and its extra are two purchases)
      const total = qs.reduce((a, q) => a + q.total, 0);
      const before = deps.state();
      if (!priced(qs) || (method === 'ic' ? before.wallet.ic : before.wallet.cash) < total) return { ok: false };
      const done: Quote[] = [];
      for (let i = 0; i < b.length; i++) {
        const q = qs[i];
        const id = LEDGER_IDS.purchase(sessionId, n + 1);
        commit({ t: 'purchase', sessionId, n: n + 1, shopId: shopMeta.shopId, itemId: b[i].itemId, qty: b[i].qty, total: q.total, method, lines: q.lines });
        if (!ledgerHas(deps.state(), id)) return done.length ? { ok: true } : { ok: false };
        n++;
        done.push(q);
      }
      const receipt: ConvoPurchase['receipt'] = mergeQuotes(done);
      if (method === 'cash') {
        receipt.paid = handedOver(receipt.total, before.wallet.cash);
        receipt.change = receipt.paid - receipt.total;
      }
      log.push({ n, method, receipt });
      return { ok: true };
    },

    intent(kind, ctx) {
      // reading the total back (「合計は千円ですね」) is right when the number is the real total; asking for it always works
      if (kind === 'ask_total') return { ok: true };
      if (kind === 'say_total') {
        const t = totalNow(ctx.slotIds);
        return { ok: t !== null && ctx.number === t };
      }
      // tax-free is a learning-only branch (D30); haggling, points and delivery arrive with their shops
      return { ok: false };
    },
  };

  // the IC counter sells a card and moves money between pockets: its own hooks (2G), the same wrapper
  const inner = scenarioId === IC_SCENARIO ? icHooks({ pack, state: deps.state, view: deps.view, dispatch: commit, sessionId }) : shopHooks;
  /** the numbers the lines quote, read back from the Vars the hooks return (the price chip shows them in digits) */
  const numberOf = (v: Vars[string] | undefined): number | undefined => {
    const n = v ? parseJaNumber(v.ja.replace(/\|/g, '')) : null;
    return n !== null && n >= 1 ? n : undefined;
  };
  const hooks: SessionGameHooks = {
    ...inner,
    vars(slots, flags) {
      const v = inner.vars(slots, flags);
      last = { price: numberOf(v.price), total: numberOf(v.total), fare: numberOf(v.fare) };
      return deps.friend ? { ...deps.friend.vars, ...v } : v;
    },
  };

  const state = deps.state();
  const plays = state.runs[scenarioId]?.count ?? 0;
  const flags: Record<string, boolean> = { priced: true };
  if (meta?.twist && twistFor(state.clock.dayIndex, scenarioId, plays)) flags.twist = true;
  if (deps.friend) Object.assign(flags, deps.friend.flags);

  return {
    hooks,
    flags,
    recalled: recalledLines(pack, state, deps.view(), meta),
    prepared: pocketReady(pack, state, deps.view(), scenarioId),
    meta,
    amounts: () => ({ ...last }),
    purchases: log,
    derived,
    friend: deps.friend ?? null,
  };
}
