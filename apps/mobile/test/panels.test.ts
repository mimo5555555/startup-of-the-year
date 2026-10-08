// The machine panels' rules (agent 2G, docs/GAME_DESIGN.md §6.5) and the `station_ic` hooks, driven through the real reducer: no React,
// no stores. `panelLogic` is what VendingPanel and TicketPanel call; `icHooks` is what the conversation host hands the engine.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, LEXICON, scenarioById, tokenize, yenToJa, plainText } from '@lw/content';
import { ConversationSession } from '@lw/engine';
import { BALANCE, createGameState, reconcile, reduce, type FriendDef, type GamePack, type GameState, type GameView, type InputEvent, type ReduceResult, type UiEffect } from '@lw/game';
import { STATION_SHOPS } from '../../../packages/content/src/tokyo/game/fares';
import {
  DENOMINATIONS,
  FARE_STOPS,
  VENDING_TEMPS,
  balanceFor,
  canInsert,
  changeFor,
  commitAll,
  exactCoins,
  fareStops,
  hasIc,
  icUsable,
  labelTokens,
  otherPay,
  panelSession,
  payBlock,
  priceTokens,
  ramenEvents,
  ramenMenu,
  ramenPrice,
  stationEvents,
  vendingDrinks,
  vendingEvent,
  vendingQuote,
  yen,
} from '../src/components/game/panelLogic';
import { icHasRoom, icHooks, icQuote } from '../src/game/icHooks';

/** The pack with the machines' shops (3E spreads them into SHOPS; until then this adds them) and the ramen shop the ticket machine sells for. */
const ramenShop = { id: 'ramen', placeId: 'ramen', name: { en: 'Ramen', ar: 'رامن' }, openChapter: 1, surface: 'world' as const, register: 'polite' as const, pay: ['cash', 'card'] as Array<'cash' | 'card'>, sells: JP_PACK.menu.filter((m) => m.shop === 'ramen').map((m) => m.id) };
const have = (id: string) => JP_PACK.shops.some((s) => s.id === id);
const pack: GamePack = { ...JP_PACK, shops: [...JP_PACK.shops, ...[...STATION_SHOPS, ramenShop].filter((s) => !have(s.id))] };
const view: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'travel', level: 'A1', createdAt: '' },
};

/** A tiny store: the state, the effects the reducer asked for, and a `dispatch` like the bridge's. */
function world(over: Partial<{ cash: number; ic: number; card: boolean; chapter: number; pack: GamePack }> = {}) {
  const p = over.pack ?? pack;
  let state: GameState = createGameState(p, 0);
  const cash = over.cash ?? 3000;
  const ic = over.ic ?? 0;
  state = {
    ...state,
    wallet: { ...state.wallet, cash, ic },
    totals: { ...state.totals, earned: Math.max(0, cash + ic - 3000), spent: Math.max(0, 3000 - cash - ic), checksum: { ...state.totals.checksum, cash, ic } },
    chapter: { ...state.chapter, n: over.chapter ?? 1 },
    owned: over.card ? { ic_card: { qty: 1, day: 'd0' } } : {},
  };
  const effects: UiEffect[] = [];
  const events: InputEvent[] = [];
  const dispatch = (ev: InputEvent): ReduceResult => {
    events.push(ev);
    const r = reduce(state, ev, { pack: p, now: 1000, view, rng: () => 0.5 });
    state = r.state;
    effects.push(...r.effects);
    return r;
  };
  return { get state() { return state; }, dispatch, effects, events, pack: p };
}

describe('the coin tray', () => {
  it('exactCoins makes the amount with the fewest coins, for every multiple of ten', () => {
    expect(exactCoins(150)).toEqual([100, 50]);
    expect(exactCoins(1100)).toEqual([1000, 100]);
    expect(exactCoins(130)).toEqual([100, 10, 10, 10]);
    expect(exactCoins(0)).toEqual([]);
    for (let n = 10; n <= 3000; n += 10) {
      const c = exactCoins(n);
      expect(c.reduce((a, b) => a + b, 0), String(n)).toBe(n);
      expect(c.every((v) => DENOMINATIONS.includes(v))).toBe(true);
    }
  });

  it('an amount below the smallest coin is rounded up by one coin (the change comes back)', () => {
    expect(exactCoins(7)).toEqual([10]);
    expect(exactCoins(1003)).toEqual([1000, 10]);
  });

  it('never accepts more than the wallet holds, and change is what is left of what went in', () => {
    expect(canInsert(130, 100, 50)).toBe(false);
    expect(canInsert(130, 100, 10)).toBe(true);
    expect(canInsert(0, 0, 10)).toBe(false);
    expect(changeFor(150, 200)).toBe(50);
    expect(changeFor(150, 100)).toBe(0);
  });

  it('the denominations are the 500, 100, 50 and 10 yen coins and the 1,000 yen note', () => {
    expect([...DENOMINATIONS]).toEqual([1000, 500, 100, 50, 10]);
  });
});

describe('labels and prices in Japanese', () => {
  it('every name on the machines splits into lexicon words (no raw token), so ruby and romaji work', () => {
    for (const m of pack.menu.filter((x) => x.shop === 'vending' || x.shop === 'ramen')) {
      const tokens = labelTokens(m.name);
      expect(tokens.length, m.id).toBeGreaterThan(0);
      expect(
        tokens.every((t) => !t.raw),
        m.id,
      ).toBe(true);
      expect(plainText(tokens), m.id).toBe(m.name.ja);
    }
  });

  it('a name the lexicon cannot split stays one token with its reading', () => {
    const t = labelTokens({ ja: '幻の麺', reading: 'まぼろしのめん' });
    expect(t).toHaveLength(1);
    expect(t[0].r).toBe('まぼろしのめん');
  });

  it('prices read as numbers: 百五十円 for 150, 千五十円 for 1,050; zero reads ゼロ円', () => {
    expect(plainText(priceTokens(150))).toBe('百五十円');
    expect(plainText(priceTokens(1050))).toBe('千五十円');
    expect(plainText(priceTokens(0))).toBe('ゼロ円');
    expect(yen(1050)).toBe('¥1,050');
  });
});

describe('paying: the pocket, the reason a button is off, the suggestion', () => {
  it('cash and the card are separate pockets', () => {
    const w = world({ cash: 800, ic: 200, card: true });
    expect(balanceFor(w.state, 'coins')).toBe(800);
    expect(balanceFor(w.state, 'ic')).toBe(200);
    expect(hasIc(pack, w.state)).toBe(true);
    expect(hasIc(pack, world().state)).toBe(false);
  });

  it('short is gentle (funds), a machine the pack does not sell is closed, enough is null', () => {
    const w = world({ cash: 100 });
    expect(payBlock(w.state, 150, 'coins', undefined)).toBe('funds');
    expect(payBlock(w.state, 100, 'coins', undefined)).toBe(null);
    expect(payBlock(w.state, 50, 'coins', 'not_sold')).toBe('closed');
    expect(payBlock(w.state, 150, 'coins', 'funds')).toBe('funds');
  });

  it('the other pocket is offered only when it covers the total and exists', () => {
    expect(otherPay(pack, world({ cash: 100, ic: 500, card: true }).state, 150, 'coins')).toBe('ic');
    expect(otherPay(pack, world({ cash: 500, ic: 100, card: true }).state, 150, 'ic')).toBe('coins');
    expect(otherPay(pack, world({ cash: 100, ic: 100, card: true }).state, 150, 'coins')).toBe(null);
    expect(otherPay(pack, world({ cash: 100, ic: 0 }).state, 150, 'coins')).toBe(null);
  });

  it('panel sessions are unique per press', () => {
    const ids = new Set(Array.from({ length: 50 }, () => panelSession('vend', 5)));
    expect(ids.size).toBe(50);
  });
});

describe('vending machine', () => {
  const buy = (w: ReturnType<typeof world>, option: string, pay: 'coins' | 'ic' = 'coins') => {
    const d = vendingDrinks(w.pack).find((x) => x.menu.option === option)!;
    const q = vendingQuote(w.pack, w.state, view, d.menu.id, pay);
    return commitAll([vendingEvent(panelSession('vend'), d.menu.id, q.total, pay, d.menu.name)], w.dispatch);
  };

  it('lists the four drinks of the menu, the hot ones in two temperatures', () => {
    const rows = vendingDrinks(pack);
    expect(rows.map((r) => r.menu.option)).toEqual(['v_tea', 'v_coffee', 'v_water', 'v_juice']);
    expect(rows.find((r) => r.menu.option === 'v_tea')!.temps).toEqual(['hot', 'cold']);
    expect(rows.find((r) => r.menu.option === 'v_water')!.temps).toEqual(['cold']);
    expect(Object.keys(VENDING_TEMPS).sort()).toEqual(rows.map((r) => r.menu.option).sort());
  });

  it('quotes the list price, and blocks with `funds` when the pocket is short', () => {
    const w = world({ cash: 100 });
    const tea = vendingDrinks(pack)[0].menu;
    expect(vendingQuote(pack, w.state, view, tea.id, 'coins')).toMatchObject({ total: 150, canPay: false, block: 'funds' });
    expect(vendingQuote(pack, world({ cash: 150 }).state, view, tea.id, 'coins')).toMatchObject({ total: 150, canPay: true });
  });

  it('a drink with coins takes exactly its price from cash; the machine gives XP once per drink, no yen, no purchase count', () => {
    const w = world({ cash: 1000 });
    expect(buy(w, 'v_tea')).toBe(true);
    expect(w.state.wallet.cash).toBe(850);
    expect(w.state.totals.spent).toBe(3000 - 850);
    expect(w.state.stats.purchases).toBe(0);
    expect(w.effects.filter((e) => e.t === 'xp')).toEqual([{ t: 'xp', amount: BALANCE.vendingXp, why: 'vending' }]);
    // the same drink again pays, but the first-time XP is not given twice
    expect(buy(w, 'v_tea')).toBe(true);
    expect(w.state.wallet.cash).toBe(700);
    expect(w.effects.filter((e) => e.t === 'xp')).toHaveLength(1);
    expect(buy(w, 'v_water')).toBe(true);
    expect(w.effects.filter((e) => e.t === 'xp')).toHaveLength(2);
    expect(reconcile(w.state, 3000).ok).toBe(true);
  });

  it('with the IC card the drink comes off the card and cash is untouched; without a card the machine takes none', () => {
    const w = world({ cash: 500, ic: 1000, card: true });
    expect(buy(w, 'v_juice', 'ic')).toBe(true);
    expect(w.state.wallet).toMatchObject({ cash: 500, ic: 850 });
    const poor = world({ cash: 500, ic: 100, card: true });
    expect(buy(poor, 'v_juice', 'ic')).toBe(false);
    expect(poor.state.wallet).toMatchObject({ cash: 500, ic: 100 });
  });

  it('too little cash buys nothing and moves nothing', () => {
    const w = world({ cash: 100 });
    expect(buy(w, 'v_tea')).toBe(false);
    expect(w.state.wallet.cash).toBe(100);
    expect(w.state.ledger.some((e) => e.kind === 'purchase')).toBe(false);
  });

  it('a double press of the same event charges once (the ledger id is the press)', () => {
    const w = world({ cash: 1000 });
    const d = vendingDrinks(pack)[0].menu;
    const ev = vendingEvent('vend:once', d.id, 150, 'coins', d.name);
    expect(commitAll([ev], w.dispatch)).toBe(true);
    // the second press finds the first in the ledger: it is recorded, and nothing more is taken
    expect(commitAll([ev], w.dispatch)).toBe(true);
    expect(w.state.wallet.cash).toBe(850);
    expect(w.state.ledger.filter((e) => e.kind === 'purchase')).toHaveLength(1);
  });

  it('is closed (not sold) when the pack has no vending shop: the panel can say so instead of failing', () => {
    const bare: GamePack = { ...JP_PACK, shops: JP_PACK.shops.filter((s) => s.id !== 'vending') };
    const w = world({ cash: 1000, pack: bare });
    const tea = vendingDrinks(bare)[0].menu;
    const q = vendingQuote(bare, w.state, view, tea.id, 'coins');
    expect(q.block).toBe('not_sold');
    expect(payBlock(w.state, tea.price, 'coins', q.block)).toBe('closed');
    expect(buy(w, 'v_tea')).toBe(false);
    expect(w.state.wallet.cash).toBe(1000);
  });
});

describe('ramen ticket machine', () => {
  const order = (flavor: string | null, extras: string[] = []) => ({ flavor, extras });

  it('offers the three bowls and the four extras of the menu', () => {
    const m = ramenMenu(pack);
    expect(m.flavors.map((x) => x.option)).toEqual(['shoyu', 'miso', 'tonkotsu']);
    expect(m.extras.map((x) => x.option)).toEqual(['ajitama', 'oomori', 'kaedama', 'gyoza']);
  });

  it('prices the bowl plus every extra', () => {
    const w = world();
    expect(ramenPrice(pack, w.state, view, order('shoyu'), 'coins').total).toBe(900);
    expect(ramenPrice(pack, w.state, view, order('miso', ['ajitama']), 'coins').total).toBe(1100);
    expect(ramenPrice(pack, w.state, view, order('tonkotsu', ['ajitama', 'oomori', 'kaedama', 'gyoza']), 'coins').total).toBe(1050 + 150 + 100 + 120 + 380);
    expect(ramenPrice(pack, w.state, view, order(null), 'coins')).toMatchObject({ total: 0, items: [] });
  });

  it('paying prints the ticket: one purchase per row, then `tickets.ramen`, once', () => {
    const w = world({ cash: 3000 });
    const o = order('miso', ['ajitama']);
    const price = ramenPrice(pack, w.state, view, o, 'coins');
    const events = ramenEvents(panelSession('ramen'), o, price, 'coins');
    expect(events.map((e) => e.t)).toEqual(['purchase', 'purchase', 'ticket_bought']);
    expect(commitAll(events, w.dispatch)).toBe(true);
    expect(w.state.wallet.cash).toBe(3000 - 1100);
    expect(w.state.tickets.ramen).toEqual({ flavor: 'miso' });
    expect(w.state.stats.tickets).toBe(1);
    expect(reconcile(w.state, 3000).ok).toBe(true);
  });

  it('too little cash for the sum takes nothing and prints nothing', () => {
    const w = world({ cash: 1000 });
    const o = order('miso', ['ajitama']);
    const price = ramenPrice(pack, w.state, view, o, 'coins');
    expect(payBlock(w.state, price.total, 'coins', price.blocked)).toBe('funds');
    // so the panel keeps the button off: nothing was dispatched, nothing was taken
    expect(w.state.wallet.cash).toBe(1000);
    expect(w.state.tickets.ramen).toBeUndefined();
  });

  it('the card pays the ticket where the pack lets the ramen shop take it, and the IC option shows only then', () => {
    // §4.1 lists where the card works and the ramen shop is not on it: the pack's own table says no
    const w0 = world({ cash: 100, ic: 1500, card: true });
    expect(icUsable(pack, w0.state, 'ramen')).toBe(pack.shops.find((s) => s.id === 'ramen')!.pay.includes('ic'));
    expect(icUsable(pack, w0.state, 'vending')).toBe(true);
    expect(icUsable(pack, world({ cash: 100 }).state, 'vending')).toBe(false);
    // a pack whose ramen shop accepts the card (§6.5 says "coin/IC" for the machine)
    const packIc: GamePack = { ...pack, shops: pack.shops.map((s) => (s.id === 'ramen' ? { ...s, pay: ['cash', 'card', 'ic'] as typeof s.pay } : s)) };
    const w = world({ cash: 100, ic: 1500, card: true, pack: packIc });
    expect(icUsable(packIc, w.state, 'ramen')).toBe(true);
    const o = order('shoyu');
    const price = ramenPrice(packIc, w.state, view, o, 'ic');
    expect(commitAll(ramenEvents('ramen:ic', o, price, 'ic'), w.dispatch)).toBe(true);
    expect(w.state.wallet).toMatchObject({ cash: 100, ic: 600 });
    expect(w.state.tickets.ramen).toEqual({ flavor: 'shoyu' });
  });
});

describe('station ticket machine', () => {
  it('puts every destination with a fare on the map; a fare without a place on the map is placed, not lost', () => {
    const w = world();
    const stops = fareStops(pack, w.state);
    expect(stops.map((s) => s.place).sort()).toEqual(Object.keys(pack.fares).sort());
    expect(stops.map((s) => s.place)).toEqual(FARE_STOPS.map((s) => s.place));
    for (const s of stops) {
      expect(s.ic, s.place).toBe(pack.fares[s.place]);
      expect(s.paper, s.place).toBe(pack.fares[s.place] + BALANCE.fares.paperExtra);
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThanOrEqual(100);
    }
    const more = fareStops({ ...pack, fares: { ...pack.fares, nara: 800 } }, w.state);
    expect(more.find((s) => s.place === 'nara')).toMatchObject({ ic: 800, paper: 810, lane: 1 });
  });

  it('two stops of one line never sit on top of each other', () => {
    const cells = new Set(FARE_STOPS.map((s) => `${s.lane}:${s.x}`));
    expect(cells.size).toBe(FARE_STOPS.length);
  });

  it('a paper ticket: the paper fare from cash, the ticket, and the flag the travel dream asks for', () => {
    const w = world({ cash: 1000 });
    const events = stationEvents(panelSession('fare'), 'shinjuku', 'coins');
    expect(events.map((e) => e.t)).toEqual(['fare', 'ticket_bought', 'flag']);
    expect(commitAll(events, w.dispatch)).toBe(true);
    expect(w.state.wallet.cash).toBe(1000 - 200);
    expect(w.state.tickets.station).toEqual({ place: 'shinjuku' });
    expect(w.state.chapter.flags).toContain('ticket_bought');
    expect(reconcile(w.state, 3000).ok).toBe(true);
  });

  it('a tap-in with the card: the IC fare from the card, the ticket, and no flag (it is not a paper ticket)', () => {
    const w = world({ cash: 1000, ic: 1000, card: true });
    const events = stationEvents(panelSession('fare'), 'shibuya', 'ic');
    expect(events.map((e) => e.t)).toEqual(['fare', 'ticket_bought']);
    expect(commitAll(events, w.dispatch)).toBe(true);
    expect(w.state.wallet).toMatchObject({ cash: 1000, ic: 830 });
    expect(w.state.tickets.station).toEqual({ place: 'shibuya' });
    expect(w.state.chapter.flags).not.toContain('ticket_bought');
  });

  it('short of cash for the fare: nothing is taken and no ticket is printed', () => {
    const w = world({ cash: 100 });
    expect(commitAll(stationEvents('fare:short', 'airport', 'coins'), w.dispatch)).toBe(false);
    expect(w.state.wallet.cash).toBe(100);
    expect(w.state.tickets.station).toBeUndefined();
  });

  it("Sato's fare perk shows on the map and is what the machine charges", () => {
    const sato: FriendDef = {
      id: 'sato',
      tier: 'A',
      register: 'polite',
      casualAt: 99,
      unlockChapter: 1,
      loves: [],
      likes: [],
      dislikes: [],
      facts: ['a', 'b', 'c'],
      perks: [{ id: 'perk_sato_fare', heart: 4, text: { en: 'fares -10%', ar: 'الأجرة -10%' }, fx: { t: 'shop_pct', shopId: 'station', pct: 0.1 } }],
    };
    const p: GamePack = { ...pack, friends: [sato] };
    const w = world({ pack: p, cash: 1000 });
    const base = w.state;
    const friend = { ...(base.friends.sato as never as object), ap: BALANCE.ap.thresholds[3] } as never;
    const state = { ...base, friends: { sato: friend } } as GameState;
    expect(fareStops(p, state).find((s) => s.place === 'shibuya')).toMatchObject({ ic: 153, paper: 162 });
  });
});

describe('icHooks: the station_ic counter against the real reducer', () => {
  const hooksFor = (w: ReturnType<typeof world>, sessionId = 's1') => icHooks({ pack: w.pack, state: () => w.state, view: () => view, dispatch: w.dispatch, sessionId });
  const text = (v: { ja: string } | undefined) => (v ? plainText(tokenize(v.ja, LEXICON).tokens) : '');

  it('vars: the deposit, the cap, the balance, the fee; the total adds the deposit for a player without a card', () => {
    const w = world({ cash: 3000 });
    const h = hooksFor(w);
    const v = h.vars({}, {});
    expect(text(v.price)).toBe(text({ ja: yenToJa(500).markup }));
    expect(text(v.limit)).toBe('三千円');
    expect(text(v.fee)).toBe('二百二十円');
    expect(text(v.balance)).toBe('ゼロ円');
    expect(v.total).toBeUndefined();
    expect(text(h.vars({ chargeAmount: '1000' }, {}).total)).toBe(text({ ja: yenToJa(1500).markup }));
    const w2 = world({ cash: 3000, card: true });
    expect(text(hooksFor(w2).vars({ chargeAmount: '1000' }, {}).total)).toBe('千円');
  });

  it('charge buys the card and loads it in one go; it is a purchase of ¥500 and a transfer, not ¥1,500 spent', () => {
    const w = world({ cash: 3000 });
    const r = hooksFor(w).charge({ icService: 'card', chargeAmount: '1000' });
    expect(r.ok).toBe(true);
    expect(w.state.wallet).toMatchObject({ cash: 1500, ic: 1000 });
    expect(w.state.owned.ic_card?.qty).toBe(1);
    expect(w.state.totals.spent).toBe(500);
    expect(w.state.ledger.filter((e) => e.kind === 'purchase').map((e) => e.delta)).toEqual([-500]);
    expect(w.state.ledger.filter((e) => e.kind === 'topup').map((e) => e.delta).sort()).toEqual([-1000, 1000]);
    expect(reconcile(w.state, 3000).ok).toBe(true);
    expect(hasIc(pack, w.state)).toBe(true);
  });

  it('charge tops up a card that is already owned: no second deposit', () => {
    const w = world({ cash: 3000, ic: 500, card: true });
    expect(hooksFor(w).charge({ icService: 'charge', chargeAmount: '2000' }).ok).toBe(true);
    expect(w.state.wallet).toMatchObject({ cash: 1000, ic: 2500 });
    expect(w.state.ledger.filter((e) => e.kind === 'purchase')).toEqual([]);
  });

  it('charge refuses, whole, when the cash does not cover card plus amount, or the card cannot hold the amount', () => {
    const poor = world({ cash: 1400 });
    expect(hooksFor(poor).charge({ icService: 'card', chargeAmount: '1000' }).ok).toBe(false);
    expect(poor.state.wallet).toMatchObject({ cash: 1400, ic: 0 });
    expect(hasIc(pack, poor.state)).toBe(false);
    expect(poor.events).toEqual([]);

    const full = world({ cash: 5000, ic: 2500, card: true });
    expect(hooksFor(full).charge({ icService: 'charge', chargeAmount: '1000' }).ok).toBe(false);
    expect(full.state.wallet).toMatchObject({ cash: 5000, ic: 2500 });

    expect(hooksFor(world()).charge({ icService: 'charge' }).ok).toBe(false);
  });

  it('the cap is ¥3,000 until Chapter 5 and ¥20,000 after', () => {
    expect(icHasRoom(pack, world({ chapter: 1 }).state, 3000)).toBe(true);
    expect(icHasRoom(pack, world({ chapter: 1 }).state, 5000)).toBe(false);
    expect(icHasRoom(pack, world({ chapter: 5 }).state, 5000)).toBe(true);
    const h = hooksFor(world({ cash: 9000, chapter: 5, card: true }));
    expect(h.intent!('ask_total', { slotIds: { chargeAmount: '5000' }, assisted: false }).ok).toBe(true);
    const early = hooksFor(world({ cash: 9000, card: true }));
    expect(early.intent!('ask_total', { slotIds: { chargeAmount: '5000' }, assisted: false }).ok).toBe(false);
    expect(early.intent!('ask_total', { slotIds: { chargeAmount: '3000' }, assisted: false }).ok).toBe(true);
    expect(early.intent!('haggle', { slotIds: {}, assisted: false }).ok).toBe(true);
  });

  it('refund returns the balance less ¥220 as cash, once', () => {
    const w = world({ cash: 1000, ic: 1500, card: true });
    const h = hooksFor(w, 'r1');
    expect(h.charge({ icService: 'refund' }).ok).toBe(true);
    expect(w.state.wallet).toMatchObject({ cash: 2280, ic: 0 });
    expect(w.state.owned.ic_card?.qty).toBe(1);
    // an empty card has nothing to refund
    expect(hooksFor(w, 'r2').charge({ icService: 'refund' }).ok).toBe(false);
    expect(w.state.wallet.cash).toBe(2280);
    expect(reconcile(w.state, 3000).ok).toBe(true);
  });

  it("a friend's station perk lowers the deposit: the quote is what the reducer charges", () => {
    const sato: FriendDef = {
      id: 'sato',
      tier: 'A',
      register: 'polite',
      casualAt: 99,
      unlockChapter: 1,
      loves: [],
      likes: [],
      dislikes: [],
      facts: ['a', 'b', 'c'],
      perks: [{ id: 'perk_sato_fare', heart: 4, text: { en: 'fares -10%', ar: 'الأجرة -10%' }, fx: { t: 'shop_pct', shopId: 'station', pct: 0.1 } }],
    };
    const p: GamePack = { ...pack, friends: [sato] };
    const w = world({ pack: p, cash: 3000 });
    const state = { ...w.state, friends: { sato: { ...(w.state.friends.sato as never as object), ap: BALANCE.ap.thresholds[3] } as never } } as GameState;
    const q = icQuote(p, state, view, 1000);
    expect(q.deposit).toBeLessThan(500);
    expect(q.total).toBe(q.deposit + 1000);
    // what the reducer takes is what the quote said
    let s = state;
    const h = icHooks({
      pack: p,
      state: () => s,
      view: () => view,
      dispatch: (ev) => {
        const r = reduce(s, ev, { pack: p, now: 1000, view, rng: () => 0.5 });
        s = r.state;
        return r;
      },
      sessionId: 'perk',
    });
    expect(h.charge({ icService: 'card', chargeAmount: '1000' }).ok).toBe(true);
    expect(state.wallet.cash - s.wallet.cash).toBe(q.total);
  });

  it('a pack with no station shop cannot sell the card: the charge refuses and takes nothing', () => {
    const bare: GamePack = { ...JP_PACK, shops: JP_PACK.shops.filter((s) => s.id !== 'station') };
    const w = world({ cash: 3000, pack: bare });
    expect(hooksFor(w).charge({ icService: 'card', chargeAmount: '1000' }).ok).toBe(false);
    expect(w.state.wallet).toMatchObject({ cash: 3000, ic: 0 });
  });

  it('a whole conversation by tapping chips alone: card, 1,000 yen, cash; the session settles through the real hooks', () => {
    const w = world({ cash: 3000 });
    const sc = scenarioById('station_ic')!;
    const s = new ConversationSession({
      scenario: sc,
      character: CHARACTERS.find((c) => c.id === 'sato')!,
      l1: 'en',
      profileName: 'Layla',
      topics: [],
      sessionId: 'convo1',
      game: icHooks({ pack: w.pack, state: () => w.state, view: () => view, dispatch: w.dispatch, sessionId: 'convo1' }),
      flags: { priced: true },
    });
    s.start();
    let guard = 0;
    while (!s.ended && guard++ < 20) s.pickSuggestion(0);
    expect(s.nodeId).toBe('done');
    expect([...s.stepsDone].sort()).toEqual(['amount', 'pay', 'want']);
    expect(w.state.wallet).toMatchObject({ cash: 1500, ic: 1000 });
    expect(hasIc(pack, w.state)).toBe(true);
    // the player now has the card: asking again quotes the top-up alone
    const s2 = new ConversationSession({
      scenario: sc,
      character: CHARACTERS.find((c) => c.id === 'sato')!,
      l1: 'en',
      profileName: 'Layla',
      topics: [],
      sessionId: 'convo2',
      game: icHooks({ pack: w.pack, state: () => w.state, view: () => view, dispatch: w.dispatch, sessionId: 'convo2' }),
      flags: { priced: true },
    });
    s2.start();
    s2.pickSuggestion(1);
    s2.pickSuggestion(0);
    expect(s2.nodeId).toBe('quote');
    expect(s2.turns.at(-1)!.line.written).toBe('全部で千円です。現金ですか？');
  });

  it('the same conversation with too little cash ends at `short` and `leave`: no card, no money moved', () => {
    const w = world({ cash: 200 });
    const s = new ConversationSession({
      scenario: scenarioById('station_ic')!,
      character: CHARACTERS.find((c) => c.id === 'sato')!,
      l1: 'ar',
      profileName: 'Layla',
      topics: [],
      sessionId: 'convo3',
      game: icHooks({ pack: w.pack, state: () => w.state, view: () => view, dispatch: w.dispatch, sessionId: 'convo3' }),
      flags: { priced: true },
    });
    s.start();
    for (let i = 0; i < 4; i++) s.pickSuggestion(0);
    expect(s.nodeId).toBe('short');
    s.pickSuggestion(0);
    expect(s.ended).toBe(true);
    expect(s.nodeId).toBe('leave');
    expect(w.state.wallet).toMatchObject({ cash: 200, ic: 0 });
    expect(hasIc(pack, w.state)).toBe(false);
    expect(w.events).toEqual([]);
  });
});
