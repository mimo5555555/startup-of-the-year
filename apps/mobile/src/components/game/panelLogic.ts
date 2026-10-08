// The pure side of the machine panels (agent 2G, docs/GAME_DESIGN.md §6.5): what a vending machine, the ramen ticket machine and the
// station ticket machine offer, what a choice costs, and the events a purchase becomes. No React, no stores: the panels pass the game
// state in and `bridge.dispatch` (or a fake) in, so `apps/mobile/test/panels.test.ts` drives every rule without a screen.
import { kanaToRomaji, hasKanji } from '@lw/core';
import { LEXICON, segmentFree, tokenize, yenToJa, type Token } from '@lw/content';
import {
  LEDGER_IDS,
  fareFor,
  hasFeature,
  ledgerHas,
  quote,
  yenFormat,
  type GamePack,
  type GameState,
  type GameView,
  type InputEvent,
  type MenuItem,
  type NameGloss,
  type PayMethod,
  type PurchaseBlock,
  type ReduceResult,
} from '@lw/game';

import { PACK } from '../../game/pack';

/** An amount in the pack's currency with its grouping (¥1,050). The numerals stay Latin digits in both languages (§4.1). */
export const yen = (amount: number): string => yenFormat(amount, PACK.currency);

// ---------------------------------------------------------------------------------------------------------------
// Money in the coin tray
// ---------------------------------------------------------------------------------------------------------------

/** What the coin tray accepts, largest first: the 500, 100, 50 and 10 yen coins and the 1,000 yen note. Prices are multiples of 10. */
export const DENOMINATIONS: readonly number[] = [1000, 500, 100, 50, 10];

/** The fewest coins that make `amount` exactly (greedy is optimal for this set); the remainder below the smallest coin is rounded up by one coin. */
export function exactCoins(amount: number): number[] {
  const out: number[] = [];
  let left = Math.max(0, Math.trunc(amount));
  for (const d of DENOMINATIONS) {
    while (left >= d) {
      out.push(d);
      left -= d;
    }
  }
  if (left > 0) out.push(DENOMINATIONS[DENOMINATIONS.length - 1]);
  return out;
}

/** True when a coin of `value` can still be put in: the player cannot insert more than the wallet holds. */
export const canInsert = (cash: number, inserted: number, value: number): boolean => inserted + value <= cash;

/** The yen handed back when `inserted` covers `total` (0 when it does not). */
export const changeFor = (total: number, inserted: number): number => Math.max(0, inserted - total);

// ---------------------------------------------------------------------------------------------------------------
// Japanese labels and prices
// ---------------------------------------------------------------------------------------------------------------

/** A machine label as tokens: the lexicon splits it (しょうゆ|ラーメン); a name it cannot split stays one token with its reading. */
export function labelTokens(name: Pick<NameGloss, 'ja' | 'reading'>): Token[] {
  const tokens = segmentFree(name.ja, LEXICON);
  if (tokens.length > 0 && tokens.every((t) => !t.raw)) return tokens;
  const reading = name.reading && hasKanji(name.ja) ? name.reading : undefined;
  return [{ s: name.ja, r: reading, rom: kanaToRomaji(name.reading ?? name.ja) }];
}

/** A price as tokens (百五十円), for the same ruby and romaji treatment as any line; 0 has no Japanese form here and reads 「ゼロ円」. */
export function priceTokens(yen: number): Token[] {
  if (yen < 1) return tokenize('ゼロ|円', LEXICON).tokens;
  return tokenize(yenToJa(yen).markup, LEXICON).tokens;
}

// ---------------------------------------------------------------------------------------------------------------
// Session ids and committing events
// ---------------------------------------------------------------------------------------------------------------

let counter = 0;
/** A panel press is its own session for the ledger (`purchase:<id>:<n>`, `fare:<id>`): unique per press, so a double tap cannot charge twice. */
export const panelSession = (kind: string, now: number = Date.now()): string => `${kind}:${now.toString(36)}${(counter++).toString(36)}`;

/** Whether the ledger recorded the money event (purchase or fare); other events carry no money and count as committed. */
export function committed(state: GameState, ev: InputEvent): boolean {
  if (ev.t === 'purchase') return ledgerHas(state, LEDGER_IDS.purchase(ev.sessionId, ev.n));
  if (ev.t === 'fare') return ledgerHas(state, LEDGER_IDS.fare(ev.id));
  return true;
}

/**
 * Dispatches the events in order and stops at the first money event the ledger did not take. Returns whether all of them went through.
 * Each `dispatch` returns the new state, so the ledger tells whether the money moved; a fake reducer works the same way in tests.
 */
export function commitAll(events: InputEvent[], dispatch: (ev: InputEvent) => ReduceResult): boolean {
  for (const ev of events) {
    const r = dispatch(ev);
    if (!committed(r.state, ev)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// Paying: the pocket, the funds, the reason a button is off
// ---------------------------------------------------------------------------------------------------------------

/** How the player pays at a machine: coins from the wallet or the IC card (a card needs the item `ic_card`). */
export type PanelPay = 'coins' | 'ic';

export const payMethodOf = (pay: PanelPay): PayMethod => (pay === 'ic' ? 'ic' : 'cash');

/** Whether the card is in the player's wallet (the `ic` feature of the item), so the IC option may be offered. */
export const hasIc = (pack: GamePack, game: GameState): boolean => hasFeature(pack, game, 'ic');

/** Whether a shop of the pack takes this way of paying (an empty list takes everything). */
export function shopAccepts(pack: GamePack, shopId: string, method: PayMethod): boolean {
  const shop = pack.shops.find((x) => x.id === shopId);
  return !!shop && (shop.pay.length === 0 || shop.pay.includes(method));
}

/** The IC option is offered when the card is in the wallet AND the machine's shop takes it (the pack decides: §4.1 lists where the card works). */
export const icUsable = (pack: GamePack, game: GameState, shopId: string): boolean => hasIc(pack, game) && shopAccepts(pack, shopId, 'ic');

/** The yen the chosen pocket holds. */
export const balanceFor = (game: GameState, pay: PanelPay): number => (pay === 'ic' ? game.wallet.ic : game.wallet.cash);

/** Why nothing can be bought for `total` right now, or null when something can. `funds` reads gently in the UI ("Not enough yen"), `closed` means the machine's shop is not in the pack. */
export type PayBlock = 'funds' | 'closed' | 'ticket';
export function payBlock(game: GameState, total: number, pay: PanelPay, blocked: PurchaseBlock | undefined): PayBlock | null {
  if (blocked && blocked !== 'funds') return 'closed';
  return balanceFor(game, pay) >= total ? null : 'funds';
}

/** The pocket to suggest when the chosen one is short but the other covers `total`: coins -> IC and IC -> coins. */
export function otherPay(pack: GamePack, game: GameState, total: number, pay: PanelPay): PanelPay | null {
  const other: PanelPay = pay === 'coins' ? 'ic' : 'coins';
  if (other === 'ic' && !hasIc(pack, game)) return null;
  return balanceFor(game, other) >= total ? other : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Vending machine
// ---------------------------------------------------------------------------------------------------------------

/**
 * Which temperatures a drink comes in (§6.3: hot in red, あたたかい; cold in blue, つめたい, "where it applies"). The price is the same
 * either way: the choice is a word to learn, not a cost. Keyed by the menu `option` of shop `vending`; a drink the table does not know is cold.
 */
export const VENDING_TEMPS: Record<string, Array<'hot' | 'cold'>> = {
  v_tea: ['hot', 'cold'],
  v_coffee: ['hot', 'cold'],
  v_water: ['cold'],
  v_juice: ['cold'],
};

export interface DrinkRow {
  menu: MenuItem;
  temps: Array<'hot' | 'cold'>;
}

/** The buttons of a vending machine, in the pack's order. */
export const vendingDrinks = (pack: GamePack): DrinkRow[] =>
  pack.menu.filter((m) => m.shop === 'vending').map((menu) => ({ menu, temps: VENDING_TEMPS[menu.option] ?? ['cold'] }));

/** The re-quoted price of a drink for one pocket (the machine is a shop: a perk, a block or a funds check come from `quote`). */
export const vendingQuote = (pack: GamePack, game: GameState, view: GameView, itemId: string, pay: PanelPay) =>
  quote(pack, game, view, { shopId: 'vending', itemId, qty: 1, method: payMethodOf(pay) });

/** The event of one drink. */
export function vendingEvent(sessionId: string, itemId: string, total: number, pay: PanelPay, label: MenuItem['name']): InputEvent {
  return {
    t: 'purchase',
    sessionId,
    n: 1,
    shopId: 'vending',
    itemId,
    qty: 1,
    total,
    method: payMethodOf(pay),
    lines: [{ kind: 'item', ref: itemId, label: { en: label.en, ar: label.ar }, qty: 1, unit: total, amount: total }],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Ramen ticket machine
// ---------------------------------------------------------------------------------------------------------------

export interface RamenMenu {
  flavors: MenuItem[];
  extras: MenuItem[];
}

/** The machine's buttons: the three bowls (slot `flavor`) and the four extras (slot `ramenExtra`). */
export function ramenMenu(pack: GamePack): RamenMenu {
  const rows = pack.menu.filter((m) => m.shop === 'ramen');
  return { flavors: rows.filter((m) => m.slot === 'flavor'), extras: rows.filter((m) => m.slot === 'ramenExtra') };
}

export interface RamenOrder {
  /** `MenuItem.option` of the bowl, null before one is chosen */
  flavor: string | null;
  /** options of the extras, in the order the machine lists them */
  extras: string[];
}

export interface RamenPrice {
  /** the bowl and the extras, each re-quoted */
  items: MenuItem[];
  /** what each row costs, in `items` order */
  prices: number[];
  total: number;
  /** the first reason the pack gives for not selling, if any */
  blocked?: PurchaseBlock;
}

/** The ticket's price: the bowl plus every extra, each quoted by the shop (so a perk or a rule of the pack applies exactly as at the counter). */
export function ramenPrice(pack: GamePack, game: GameState, view: GameView, order: RamenOrder, pay: PanelPay): RamenPrice {
  const menu = ramenMenu(pack);
  const items = [...menu.flavors.filter((m) => m.option === order.flavor), ...menu.extras.filter((m) => order.extras.includes(m.option))];
  const prices: number[] = [];
  let blocked: PurchaseBlock | undefined;
  for (const m of items) {
    const q = quote(pack, game, view, { shopId: 'ramen', itemId: m.id, qty: 1, method: payMethodOf(pay) });
    // a row the pack will not sell has no total: show its list price so the screen still reads, and report why
    if (q.block && q.block !== 'funds') blocked ??= q.block;
    prices.push(q.block && q.block !== 'funds' ? m.price : q.total);
  }
  return { items, prices, total: prices.reduce((a, b) => a + b, 0), blocked };
}

/** The events of a ramen ticket: one purchase per row (the same session, numbered), then the ticket itself (§6.5: `tickets.ramen`). */
export function ramenEvents(sessionId: string, order: RamenOrder, price: RamenPrice, pay: PanelPay): InputEvent[] {
  const { items, prices } = price;
  const buys: InputEvent[] = items.map((m, i) => ({
    t: 'purchase',
    sessionId,
    n: i + 1,
    shopId: 'ramen',
    itemId: m.id,
    qty: 1,
    total: prices[i] ?? m.price,
    method: payMethodOf(pay),
    lines: [{ kind: 'item', ref: m.id, label: { en: m.name.en, ar: m.name.ar }, qty: 1, unit: prices[i] ?? m.price, amount: prices[i] ?? m.price }],
  }));
  return [...buys, { t: 'ticket_bought', kind: 'ramen', flavor: order.flavor ?? '' }];
}

// ---------------------------------------------------------------------------------------------------------------
// Station ticket machine
// ---------------------------------------------------------------------------------------------------------------

/** Where each stop sits on the FareMap: a percentage of its width, and the line (0 top, 1 bottom). A schematic, not a geography: the farther the stop, the dearer the fare. */
export const FARE_STOPS: Array<{ place: string; x: number; lane: 0 | 1 }> = [
  { place: 'shibuya', x: 22, lane: 0 },
  { place: 'hikarigaoka', x: 22, lane: 1 },
  { place: 'shinjuku', x: 39, lane: 0 },
  { place: 'tokyoStation', x: 56, lane: 0 },
  { place: 'akihabara', x: 56, lane: 1 },
  { place: 'ueno', x: 73, lane: 0 },
  { place: 'asakusa', x: 90, lane: 0 },
  { place: 'airport', x: 90, lane: 1 },
];

export interface FareStop {
  place: string;
  x: number;
  lane: 0 | 1;
  /** the IC fare and the paper-ticket fare, as `fareFor` computes them (a friend's perk included) */
  ic: number;
  paper: number;
}

/**
 * The stops of the map, in `FARE_STOPS` order, for the destinations the pack has a fare for. A fare the pack lists without a place
 * on the map (another pack, a new stop) goes on the line below the last row so it is never lost.
 */
export function fareStops(pack: GamePack, game: GameState): FareStop[] {
  const known = new Set(FARE_STOPS.map((s) => s.place));
  const placed = FARE_STOPS.filter((s) => pack.fares[s.place] !== undefined);
  const extra = Object.keys(pack.fares)
    .filter((p) => !known.has(p))
    .map((place, i): { place: string; x: number; lane: 0 | 1 } => ({ place, x: 22 + 34 * (i % 3), lane: 1 }));
  return [...placed, ...extra].map((s) => ({ ...s, ic: fareFor(pack, game, s.place, 'ic'), paper: fareFor(pack, game, s.place, 'paper') }));
}

/** The pocket a fare is taken from and the label of the ticket: a paper ticket is paid with coins, a tap-in with the card. */
export const fareMethod = (pay: PanelPay): 'paper' | 'ic' => (pay === 'ic' ? 'ic' : 'paper');

/** The events of a station ticket: the fare, the ticket (`tickets.station`), and for paper the flag the travel dream asks for (`ticket_bought`). */
export function stationEvents(sessionId: string, place: string, pay: PanelPay): InputEvent[] {
  const events: InputEvent[] = [
    { t: 'fare', id: sessionId, place, method: fareMethod(pay), legs: 1 },
    { t: 'ticket_bought', kind: 'station', place },
  ];
  // a tap-in is no paper ticket: only the paper one satisfies "Buy a paper ticket at a machine"
  if (pay === 'coins') events.push({ t: 'flag', id: 'ticket_bought' });
  return events;
}
