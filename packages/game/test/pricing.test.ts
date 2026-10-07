import { describe, expect, it } from 'vitest';

import { BALANCE } from '../src/balance';
import { reconcile } from '../src/ledger';
import { fareFor, haggleLimit, itemAvailability, menuPrice, pointsEarn, priceDisplay, quote, commitPurchase } from '../src/pricing';
import type { GameState, PurchaseEvent, Quote, QuoteRequest, ReduceCtx } from '../src/types';
import { ECON, JPY, MENU, TAX, mkPack, mkState, mkView, rng } from './fixtures-money';

const pack = mkPack();
const view = mkView();
const ctx = (p = pack): ReduceCtx => ({ pack: p, now: 1000, view, rng: () => 0.5 });
const sum = (q: Quote) => q.lines.reduce((a, l) => a + l.amount, 0);
const ev = (o: Partial<PurchaseEvent> & Pick<PurchaseEvent, 'shopId' | 'itemId'>): PurchaseEvent => ({ t: 'purchase', sessionId: 's1', n: 1, qty: 1, total: 0, method: 'cash', lines: [], ...o });
const menu = (id: string) => MENU.find((m) => m.id === id)!;

describe('menuPrice: take-out and eat-in (§4.1)', () => {
  it('take-out is the listed price; eat-in is round(price / 1.08 * 1.10)', () => {
    expect(menuPrice(menu('konbini:coffee'), TAX, false)).toBe(450);
    expect(menuPrice(menu('konbini:coffee'), TAX, true)).toBe(458);
    for (const p of [110, 160, 200, 250, 300, 450, 600, 980, 1050]) {
      const m = { ...menu('konbini:coffee'), price: p };
      expect(menuPrice(m, TAX, true)).toBe(Math.round((p / 1.08) * 1.1));
    }
  });
  it('items that cannot be eaten in, or are not food, keep their price', () => {
    expect(menuPrice({ ...menu('konbini:coffee'), eatInCapable: false }, TAX, true)).toBe(450);
    expect(menuPrice(menu('konbini:bag'), TAX, true)).toBe(300);
    expect(menuPrice(menu('konbini:coffee'), { ...TAX, eatInRate: undefined }, true)).toBe(450);
  });
  it('eat-in never costs less than take-out', () => {
    for (let p = 1; p <= 3000; p++) expect(menuPrice({ ...menu('konbini:coffee'), price: p }, TAX, true)).toBeGreaterThanOrEqual(p);
  });
});

describe('haggleLimit (§4.4 rule 3)', () => {
  it('min(6% of body, 8,880): both cars give 8,880; assisted 40%', () => {
    expect(haggleLimit(pack, 'motors', 148_000, false)).toBe(8880);
    expect(haggleLimit(pack, 'motors', 458_000, false)).toBe(8880);
    expect(haggleLimit(pack, 'motors', 148_000, true)).toBe(3552);
  });
  it('a cheap body price is limited by the percentage', () => {
    expect(haggleLimit(pack, 'motors', 19_800, false)).toBe(1188);
  });
  it('is 0 where the shop does not negotiate, or for a non-positive price', () => {
    expect(haggleLimit(pack, 'konbini', 450, false)).toBe(0);
    expect(haggleLimit(pack, 'motors', 0, false)).toBe(0);
    expect(haggleLimit(pack, 'motors', -5, false)).toBe(0);
  });
  it('property: never above the BALANCE ceiling, never above the percentage, assisted <= independent', () => {
    const r = rng(5);
    for (let i = 0; i < 1000; i++) {
      const body = 1 + Math.floor(r() * 1_000_000);
      const full = haggleLimit(pack, 'motors', body, false);
      expect(full).toBeLessThanOrEqual(BALANCE.haggle.max);
      expect(full).toBeLessThanOrEqual(Math.floor(BALANCE.haggle.pct * body + 1e-6));
      expect(haggleLimit(pack, 'motors', body, true)).toBeLessThanOrEqual(full);
    }
  });
});

describe('fareFor (§5.4)', () => {
  it('IC fare, paper +10, unknown place 0', () => {
    const s = mkState();
    expect(fareFor(pack, s, 'shinjuku', 'ic')).toBe(190);
    expect(fareFor(pack, s, 'shinjuku', 'cash')).toBe(190);
    expect(fareFor(pack, s, 'shinjuku', 'paper')).toBe(200);
    expect(fareFor(pack, s, 'nowhere', 'ic')).toBe(0);
  });
  it('Sato at 4 hearts gives 10% off and the fare never drops below 10', () => {
    const s = mkState({ friendAp: { sato: 240 } });
    expect(fareFor(pack, s, 'shinjuku', 'ic')).toBe(171);
    expect(fareFor(pack, s, 'shinjuku', 'paper')).toBe(180);
    expect(fareFor(pack, mkState({ friendAp: { sato: 239 } }), 'shinjuku', 'ic')).toBe(190);
    const cheap = mkPack({ fares: { next: 10 } });
    expect(fareFor(cheap, s, 'next', 'ic')).toBe(BALANCE.fares.perkFloor); // 10% of 10 is 9: the floor holds
  });
});

describe('pointsEarn (§4.1)', () => {
  const s = mkState();
  it('floor(total * 1%) with exact arithmetic', () => {
    expect(pointsEarn(pack, s, 150)).toBe(1);
    expect(pointsEarn(pack, s, 99)).toBe(0);
    expect(pointsEarn(pack, s, 450)).toBe(4);
    expect(pointsEarn(pack, s, 24_800)).toBe(248);
  });
  it('is limited by what is left of the 300-a-day cap and resets with the day', () => {
    expect(pointsEarn(pack, s, 198_000)).toBe(BALANCE.points.dailyCap);
    const used = { ...s, pay: { ...s.pay, pointsToday: 290 } };
    expect(pointsEarn(pack, used, 198_000)).toBe(10);
    const stale = { ...used, clock: { ...used.clock, dayIndex: 1 } };
    expect(pointsEarn(pack, stale, 198_000)).toBe(BALANCE.points.dailyCap);
  });
  it('the flagship phone raises the rate; a pack without a points card earns nothing', () => {
    const flagship = mkPack({ items: [...pack.items, { ...pack.items[0], id: 'phone_flag', fx: [{ t: 'trait', id: 'points_rate', value: 0.02 }] }] });
    const owner = { ...s, owned: { phone_flag: { qty: 1, day: 'd0' } } };
    expect(pointsEarn(flagship, owner, 1000)).toBe(20);
    expect(pointsEarn(mkPack({ rules: { ...pack.rules, pointsCard: false } }), s, 1000)).toBe(0);
    expect(pointsEarn(pack, s, 0)).toBe(0);
  });
});

describe('quote', () => {
  it('prices are tax-included: the phone at Chapter 4 is exactly ¥24,800 with the work-hours chip', () => {
    const s = mkState({ cash: 30_000, chapter: 4 });
    const q = quote(pack, s, view, { shopId: 'denki', itemId: 'phone_used' });
    expect(q).toMatchObject({ total: 24_800, subtotal: 24_800 - q.tax, bulky: false, confirm: true, canPay: true });
    expect(q.tax).toBe(24_800 - Math.round(24_800 / 1.1));
    expect(q.hours).toBeCloseTo(24_800 / 1150, 6);
    expect(q.lines).toHaveLength(1);
    expect(q.block).toBeUndefined();
  });
  it('the chip shows only above ¥2,000 and the confirm node only from ¥5,000', () => {
    const s = mkState({ cash: 30_000 });
    expect(quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee' })).toMatchObject({ hours: null, confirm: false });
    expect(quote(pack, s, view, { shopId: 'fuku', itemId: 'futon_set' }).hours).not.toBeNull();
  });
  it('bulky goods add the 2,200 delivery, a bicycle adds the 600 registration', () => {
    const s = mkState({ cash: 50_000, chapter: 5 });
    const f = quote(pack, s, view, { shopId: 'fuku', itemId: 'futon_set' });
    expect(f.total).toBe(12_800 + 2200);
    expect(f.bulky).toBe(true);
    expect(f.lines.map((l) => l.kind)).toEqual(['item', 'delivery']);
    const b = quote(pack, s, view, { shopId: 'motors', itemId: 'bike_mamachari' });
    expect(b.total).toBe(19_800 + 600);
    expect(b.lines.map((l) => l.kind)).toEqual(['item', 'fee']);
    // delivery is not optional: a `delivery: false` request cannot dodge it
    expect(quote(pack, s, view, { shopId: 'fuku', itemId: 'futon_set', delivery: false }).total).toBe(15_000);
  });
  it('eat-in and quantity: 3 coffees eating in cost 3 x 458; a fourth is refused', () => {
    const s = mkState({ cash: 5000 });
    const q = quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee', qty: 3, eatIn: true });
    expect(q.total).toBe(1374);
    expect(q.lines[0]).toMatchObject({ kind: 'item', qty: 3, unit: 458, amount: 1374 });
    expect(quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee', qty: 4 })).toMatchObject({ block: 'qty', canPay: false });
    expect(quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee', qty: 0 }).block).toBe('qty');
    expect(quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee', qty: 1.5 }).block).toBe('qty');
  });
  it('a bare option id resolves inside the shop', () => {
    const q = quote(pack, mkState(), view, { shopId: 'konbini', itemId: 'coffee' });
    expect(q.total).toBe(450);
  });
  it('blocks: unknown, not sold here, closed, chapter gate, age, once-owned, funds', () => {
    const rich = mkState({ cash: 500_000, chapter: 9 });
    const b = (s: GameState, req: QuoteRequest, v = view) => quote(pack, s, v, req).block;
    expect(b(rich, { shopId: 'konbini', itemId: 'nope' })).toBe('unknown_item');
    expect(b(rich, { shopId: 'konbini', itemId: 'phone_used' })).toBe('not_sold');
    expect(b(mkState({ chapter: 3 }), { shopId: 'denki', itemId: 'phone_used' })).toBe('closed');
    expect(b(mkState({ chapter: 5, cash: 500_000 }), { shopId: 'denki', itemId: 'phone_pro' })).toBe('gate');
    expect(b(rich, { shopId: 'motors', itemId: 'car_kei_used' }, mkView('teens'))).toBe('age');
    expect(b(rich, { shopId: 'motors', itemId: 'car_kei_used' }, mkView('kids'))).toBe('age');
    expect(b(rich, { shopId: 'motors', itemId: 'car_kei_used' })).toBeUndefined();
    expect(b({ ...rich, owned: { phone_used: { qty: 1, day: 'd0' } } }, { shopId: 'denki', itemId: 'phone_used' })).toBe('owned');
    expect(b(mkState({ cash: 100, chapter: 4 }), { shopId: 'denki', itemId: 'phone_used' })).toBe('funds');
  });
  it('a shop that does not take IC refuses the method; card draws on cash', () => {
    const s = mkState({ cash: 30_000, ic: 30_000, chapter: 4 });
    expect(quote(pack, s, view, { shopId: 'denki', itemId: 'phone_used', method: 'ic' })).toMatchObject({ canPay: false });
    expect(quote(pack, s, view, { shopId: 'denki', itemId: 'phone_used', method: 'card' }).canPay).toBe(true);
    expect(quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee', method: 'ic' }).canPay).toBe(true);
    expect(quote(pack, mkState({ cash: 5000, ic: 100 }), view, { shopId: 'konbini', itemId: 'konbini:coffee', method: 'ic' }).canPay).toBe(false);
  });

  describe('discounts', () => {
    it('friend perk: Tanaka at 4 hearts takes 5% off konbini goods', () => {
      const s = mkState({ cash: 5000, friendAp: { tanaka: 240 } });
      const q = quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee' });
      expect(q.total).toBe(450 - 22);
      expect(q.lines.find((l) => l.kind === 'discount')?.amount).toBe(-22);
      // not at 3 hearts, not at another shop
      expect(quote(pack, mkState({ cash: 5000, friendAp: { tanaka: 239 } }), view, { shopId: 'konbini', itemId: 'konbini:coffee' }).total).toBe(450);
      expect(quote(pack, s, view, { shopId: 'cafe', itemId: 'cafe:cake' }).total).toBe(600);
    });
    it('friend shop perks stop at the daily 300 yen', () => {
      const s = { ...mkState({ cash: 300_000, chapter: 4, friendAp: { tanaka: 240 } }) };
      const big = mkPack({ items: [...pack.items, { ...pack.items[0], id: 'pricey', shop: 'konbini', price: 20_000, gate: { ch: 1 } }], shops: pack.shops.map((x) => (x.id === 'konbini' ? { ...x, sells: [...x.sells, 'pricey'] } : x)) });
      // 5% of 20,000 = 1,000 but 8% routine cap is 1,600 and the friend cap is 300
      expect(quote(big, s, view, { shopId: 'konbini', itemId: 'pricey' }).total).toBe(20_000 - BALANCE.friendPerkDailyMax);
      const used = { ...s, pay: { ...s.pay, perkToday: 280 } };
      expect(quote(big, used, view, { shopId: 'konbini', itemId: 'pricey' }).total).toBe(20_000 - 20);
      const spent = { ...s, pay: { ...s.pay, perkToday: 300 } };
      expect(quote(big, spent, view, { shopId: 'konbini', itemId: 'pricey' }).total).toBe(20_000);
    });
    it('the car: haggle 8,880 off the 198,000, Nakamura 8,000 on top: floor 181,120 (§4.4)', () => {
      const s0 = mkState({ cash: 500_000, chapter: 9 });
      const q0 = quote(pack, s0, view, { shopId: 'motors', itemId: 'car_kei_used' });
      expect(q0.total).toBe(198_000);
      const q1 = quote(pack, s0, view, { shopId: 'motors', itemId: 'car_kei_used', haggle: 99_999 });
      expect(q1.total).toBe(198_000 - 8880);
      expect(q1.lines.find((l) => l.kind === 'haggle')?.amount).toBe(-8880);
      const s2 = mkState({ cash: 500_000, chapter: 9, friendAp: { nakamura: 350 } });
      const q2 = quote(pack, s2, view, { shopId: 'motors', itemId: 'car_kei_used', haggle: 99_999 });
      expect(q2.total).toBe(181_120);
      expect(q2.lines.map((l) => l.kind)).toEqual(['item', 'perk', 'haggle']);
      // nothing can push the car under that floor, however it is asked
      const q3 = quote(pack, s2, view, { shopId: 'motors', itemId: 'car_kei_used', haggle: Number.MAX_SAFE_INTEGER, usePoints: false });
      expect(q3.total).toBeGreaterThanOrEqual(181_120);
    });
    it('a haggle counts once per item per day, and only where the shop negotiates', () => {
      const s = mkState({ cash: 500_000, chapter: 9 });
      const used = { ...s, pay: { ...s.pay, haggleToday: ['motors:car_kei_used'] } };
      expect(quote(pack, used, view, { shopId: 'motors', itemId: 'car_kei_used', haggle: 5000 }).total).toBe(198_000);
      expect(quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee', haggle: 100 }).total).toBe(450);
    });
    it('negotiation can be narrowed to listed items: another item of the same shop keeps its price', () => {
      const s = mkState({ cash: 500_000, chapter: 9 });
      const narrow = mkPack({ rules: { ...pack.rules, negotiation: { motors: { ...pack.rules.negotiation.motors, items: ['car_kei_used'] } } } });
      expect(quote(narrow, s, view, { shopId: 'motors', itemId: 'car_kei_used', haggle: 99_999 }).total).toBe(198_000 - 8880);
      expect(quote(narrow, s, view, { shopId: 'motors', itemId: 'bike_mamachari', haggle: 99_999 }).total).toBe(quote(narrow, s, view, { shopId: 'motors', itemId: 'bike_mamachari' }).total);
      expect(quote(narrow, s, view, { shopId: 'motors', itemId: 'bike_mamachari', haggle: 99_999 }).lines.some((l) => l.kind === 'haggle')).toBe(false);
      // no `items` = any item of a listed shop (the default the fixture pack keeps)
      expect(quote(pack, s, view, { shopId: 'motors', itemId: 'bike_mamachari', haggle: 99_999 }).lines.some((l) => l.kind === 'haggle')).toBe(true);
    });
    it('the one-time perk is spent after use', () => {
      const s = { ...mkState({ cash: 500_000, chapter: 9, friendAp: { nakamura: 350 } }) };
      s.stats = { ...s.stats, perksUsed: ['perk_car'] };
      expect(quote(pack, s, view, { shopId: 'motors', itemId: 'car_kei_used' }).total).toBe(198_000);
    });
    it('points redeem up to the total, after friend perks and outside the 8% cap', () => {
      const s = { ...mkState({ cash: 5000, friendAp: { tanaka: 240 } }) };
      s.wallet = { ...s.wallet, points: 100 };
      const q = quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee', usePoints: true });
      expect(q.total).toBe(450 - 22 - 100);
      expect(q.lines.map((l) => l.kind)).toEqual(['item', 'discount', 'points']);
      s.wallet = { ...s.wallet, points: 9999 };
      expect(quote(pack, s, view, { shopId: 'konbini', itemId: 'konbini:coffee', usePoints: true }).total).toBe(0);
      // a shop without a points card does not redeem them
      expect(quote(pack, s, view, { shopId: 'cafe', itemId: 'cafe:cake', usePoints: true }).total).toBe(600);
    });
  });

  describe('properties', () => {
    const req = (r: () => number): QuoteRequest => {
      const t = Math.floor(r() * 5);
      const base = [
        { shopId: 'konbini', itemId: 'konbini:coffee' },
        { shopId: 'cafe', itemId: 'cafe:cake' },
        { shopId: 'fuku', itemId: 'futon_set' },
        { shopId: 'motors', itemId: 'car_kei_used' },
        { shopId: 'motors', itemId: 'bike_mamachari' },
      ][t];
      return { ...base, qty: 1 + Math.floor(r() * 3), eatIn: r() < 0.5, usePoints: r() < 0.5, method: r() < 0.5 ? 'cash' : 'ic', haggle: r() < 0.5 ? Math.floor(r() * 20_000) : undefined };
    };
    const randomState = (r: () => number): GameState => {
      const s = mkState({ cash: Math.floor(r() * 600_000), ic: Math.floor(r() * 3000), chapter: 9, friendAp: { tanaka: Math.floor(r() * 400), nakamura: Math.floor(r() * 400), sato: Math.floor(r() * 400) } });
      s.wallet = { ...s.wallet, points: Math.floor(r() * 400) };
      return s;
    };

    it('total = base + deltas: the receipt rows add up to the total, never negative', () => {
      const r = rng(77);
      for (let i = 0; i < 1500; i++) {
        const s = randomState(r);
        const rq = req(r);
        const q = quote(pack, s, view, rq);
        if (q.block && q.block !== 'funds') continue;
        expect(sum(q)).toBe(q.total);
        expect(q.total).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(q.total)).toBe(true);
        expect(q.subtotal + q.tax).toBe(q.total);
      }
    });

    it('is pure: the same inputs give the same quote and the inputs are not changed', () => {
      const r = rng(78);
      for (let i = 0; i < 300; i++) {
        const s = randomState(r);
        const rq = req(r);
        const before = JSON.stringify(s);
        const q1 = quote(pack, s, view, rq);
        const q2 = quote(pack, s, view, rq);
        expect(q2).toEqual(q1);
        expect(JSON.stringify(s)).toBe(before);
      }
    });

    it('routine discounts (friend shop perk + haggle) never exceed 8% of body price; points are outside the cap', () => {
      const r = rng(79);
      for (let i = 0; i < 1500; i++) {
        const s = randomState(r);
        const rq = req(r);
        const q = quote(pack, s, view, rq);
        if (q.block && q.block !== 'funds') continue;
        const item = pack.items.find((x) => x.id === rq.itemId);
        // cars: the cap is on the body price; menu goods: on the unit actually quoted (eat-in raises it)
        const bodyForCap = (item ? (item.body ?? item.price) : (q.lines[0].unit ?? 0)) * (rq.qty ?? 1);
        const routine = q.lines.filter((l) => l.kind === 'discount' || l.kind === 'haggle').reduce((a, l) => a - l.amount, 0);
        expect(routine).toBeLessThanOrEqual(Math.floor(BALANCE.routineDiscountMax * bodyForCap + 1e-6));
        const friend = q.lines.filter((l) => l.kind === 'discount').reduce((a, l) => a - l.amount, 0);
        expect(friend).toBeLessThanOrEqual(BALANCE.friendPerkDailyMax);
      }
    });

    it('the haggle floor: the car never goes below 198,000 - 8,880 - 8,000, whatever is asked', () => {
      const r = rng(80);
      for (let i = 0; i < 500; i++) {
        const s = randomState(r);
        s.wallet = { ...s.wallet, points: 0 };
        const q = quote(pack, s, view, { shopId: 'motors', itemId: 'car_kei_used', haggle: Math.floor(r() * 1_000_000) });
        expect(q.total).toBeGreaterThanOrEqual(198_000 - BALANCE.haggle.max - 8000);
      }
    });
  });
});

describe('itemAvailability', () => {
  it('reports why an item cannot be bought yet', () => {
    expect(itemAvailability(pack, mkState({ chapter: 3 }), view, 'phone_used')).toBe('closed');
    expect(itemAvailability(pack, mkState({ chapter: 4 }), view, 'phone_used')).toBe('ok');
    expect(itemAvailability(pack, mkState({ chapter: 5 }), view, 'phone_pro')).toBe('gate');
    expect(itemAvailability(pack, mkState({ chapter: 9 }), mkView('teens'), 'car_kei_used')).toBe('age');
    expect(itemAvailability(pack, mkState({ chapter: 9 }), view, 'car_kei_used')).toBe('ok');
    expect(itemAvailability(pack, mkState(), view, 'ghost')).toBe('closed');
  });
});

describe('commitPurchase', () => {
  it('charges the re-quoted total, writes the ledger id purchase:<session>:<n>, grants the item and earns points', () => {
    const s = mkState({ cash: 3000 });
    const r = commitPurchase(s, ev({ shopId: 'konbini', itemId: 'konbini:coffee' }), ctx());
    expect(r.ok).toBe(true);
    expect(r.state.wallet.cash).toBe(3000 - 450);
    expect(r.state.wallet.points).toBe(4);
    expect(r.state.totals).toMatchObject({ spent: 450, earned: 0 });
    expect(r.state.ledger.map((l) => l.id)).toEqual(['purchase:s1:1', 'purchase:s1:1:earn']);
    expect(r.state.owned['konbini:coffee']?.qty).toBe(1);
    expect(r.state.pay.pointsToday).toBe(4);
    expect(r.derived).toEqual([{ t: 'wallet_changed', delta: -450, balance: 2550, kind: 'purchase' }]);
    expect(reconcile(r.state, 3000).ok).toBe(true);
  });
  it('trusts the quote, not the event: a tampered total is ignored', () => {
    const r = commitPurchase(mkState(), ev({ shopId: 'konbini', itemId: 'konbini:coffee', total: 1 }), ctx());
    expect(r.state.wallet.cash).toBe(3000 - 450);
  });
  it('the same (session, n) twice is a no-op', () => {
    const s = mkState();
    const a = commitPurchase(s, ev({ shopId: 'konbini', itemId: 'konbini:coffee' }), ctx());
    const b = commitPurchase(a.state, ev({ shopId: 'konbini', itemId: 'konbini:coffee' }), ctx());
    expect(b).toMatchObject({ ok: false, reason: 'duplicate' });
    expect(b.state).toBe(a.state);
    const c = commitPurchase(a.state, ev({ shopId: 'konbini', itemId: 'konbini:coffee', n: 2 }), ctx());
    expect(c.ok).toBe(true);
    expect(c.state.wallet.cash).toBe(3000 - 900);
  });
  it('short of money is a clean refusal, not an error, and nothing changes', () => {
    const s = mkState({ cash: 100, chapter: 4 });
    const r = commitPurchase(s, ev({ shopId: 'denki', itemId: 'phone_used' }), ctx());
    expect(r).toMatchObject({ ok: false, reason: 'funds', derived: [], effects: [] });
    expect(r.state).toBe(s);
  });
  it('gate, closed shop, once-owned and quantity blocks come through as the reason', () => {
    expect(commitPurchase(mkState({ cash: 1e6, chapter: 3 }), ev({ shopId: 'denki', itemId: 'phone_used' }), ctx()).reason).toBe('closed');
    expect(commitPurchase(mkState({ cash: 1e6 }), ev({ shopId: 'konbini', itemId: 'konbini:coffee', qty: 4 }), ctx()).reason).toBe('qty');
    expect(commitPurchase(mkState({ cash: 1e6 }), ev({ shopId: 'konbini', itemId: 'ghost' }), ctx()).reason).toBe('unknown_item');
  });
  it('buying the phone: item granted, big-ticket total, stats updated, fanfare effect', () => {
    const s = mkState({ cash: 30_000, chapter: 4 });
    const r = commitPurchase(s, ev({ shopId: 'denki', itemId: 'phone_used', method: 'card' }), ctx());
    expect(r.ok).toBe(true);
    expect(r.state.wallet.cash).toBe(30_000 - 24_800);
    expect(r.state.owned.phone_used.qty).toBe(1);
    expect(r.state.stats).toMatchObject({ purchases: 1, spentOnPurchases: 24_800 });
    expect(r.effects).toContainEqual({ t: 'fanfare', kind: 'purchase' });
    // Denki issues points: 1% of 24,800 = 248
    expect(r.state.wallet.points).toBe(248);
  });
  it('an IC payment draws on the IC pocket', () => {
    const s = mkState({ cash: 100, ic: 1000 });
    const r = commitPurchase(s, ev({ shopId: 'konbini', itemId: 'konbini:coffee', method: 'ic' }), ctx());
    expect(r.state.wallet).toMatchObject({ cash: 100, ic: 550 });
    expect(r.state.totals.spent).toBe(450);
    expect(reconcile(r.state, 1100).ok).toBe(true); // the IC balance was part of the seeded 1,100
  });
  it('points redeemed are spent and the purchase earns on what was actually paid in yen', () => {
    const s = mkState({ cash: 3000 });
    s.wallet = { ...s.wallet, points: 100 };
    s.totals = { ...s.totals, checksum: { ...s.totals.checksum, points: 100 } };
    const r = commitPurchase(s, ev({ shopId: 'konbini', itemId: 'konbini:coffee', usePoints: true }), ctx());
    expect(r.state.wallet.cash).toBe(3000 - 350);
    expect(r.state.wallet.points).toBe(3); // 100 spent, floor(350 * 1%) earned
    expect(reconcile(r.state, 3000).ok).toBe(true);
  });
  it('a haggle is used up for the day and the one-time perk is recorded', () => {
    const s = mkState({ cash: 500_000, chapter: 9, friendAp: { nakamura: 350 } });
    const r = commitPurchase(s, ev({ shopId: 'motors', itemId: 'car_kei_used', haggle: 99_999 }), ctx());
    expect(r.ok).toBe(true);
    expect(r.state.wallet.cash).toBe(500_000 - 181_120);
    expect(r.state.pay.haggleToday).toEqual(['motors:car_kei_used']);
    expect(r.state.stats.perksUsed).toEqual(['perk_car']);
    expect(r.state.owned.car_kei_used.qty).toBe(1);
    // the car is once-only: a second purchase is refused, the next session's haggle has no perk left to stack
    expect(commitPurchase(r.state, ev({ shopId: 'motors', itemId: 'car_kei_used', sessionId: 's2' }), ctx()).reason).toBe('owned');
  });
  it('a haggle that was not granted is not stored: the next visit starts at the list price (never stored)', () => {
    const s = mkState({ cash: 500_000, chapter: 9 });
    const r = commitPurchase(s, ev({ shopId: 'motors', itemId: 'car_kei_used', haggle: 0 }), ctx());
    expect(r.state.wallet.cash).toBe(500_000 - 198_000);
  });
  it('a perk free item is not charged and the daily flag is set', () => {
    const p = mkPack({
      friends: [
        ...pack.friends,
        { ...pack.friends[0], id: 'yuki', perks: [{ id: 'perk_yuki', heart: 4, text: { en: 'free', ar: 'free' }, fx: { t: 'daily_free', shopId: 'cafe', itemId: 'cafe:cake' } }] },
      ],
    });
    const s = mkState({ cash: 1000, friendAp: { yuki: 240 } });
    const r = commitPurchase(s, ev({ shopId: 'cafe', itemId: 'cafe:cake' }), ctx(p));
    expect(r.state.wallet.cash).toBe(1000);
    expect(r.state.pay.perkFreeToday).toEqual(['perk_yuki']);
    // the second cake the same day is full price
    const again = commitPurchase(r.state, ev({ shopId: 'cafe', itemId: 'cafe:cake', n: 2 }), ctx(p));
    expect(again.state.wallet.cash).toBe(1000 - 600);
  });
  it('property: after random purchases and top-ups the wallet always reconciles and never goes negative', () => {
    const r = rng(404);
    let s = mkState({ cash: 3000, chapter: 9 });
    for (let i = 0; i < 400; i++) {
      const rq = [
        { shopId: 'konbini', itemId: 'konbini:coffee' },
        { shopId: 'konbini', itemId: 'konbini:onigiri' },
        { shopId: 'cafe', itemId: 'cafe:cake' },
        { shopId: 'aiko', itemId: 'g_flower' },
      ][Math.floor(r() * 4)];
      const out = commitPurchase(s, ev({ ...rq, sessionId: `s${i}`, n: 1, qty: 1 + Math.floor(r() * 3), usePoints: r() < 0.4, eatIn: r() < 0.5, method: r() < 0.3 ? 'ic' : 'cash' }), ctx());
      s = out.state;
      // income so the run does not stall
      if (r() < 0.5) s = { ...s, wallet: { ...s.wallet, cash: s.wallet.cash + 600 }, totals: { ...s.totals, earned: s.totals.earned + 600, checksum: { ...s.totals.checksum, cash: s.totals.checksum.cash + 600 } } };
      expect(s.wallet.cash).toBeGreaterThanOrEqual(0);
      expect(s.wallet.ic).toBeGreaterThanOrEqual(0);
      expect(s.wallet.points).toBeGreaterThanOrEqual(0);
      expect(reconcile(s, 3000).ok).toBe(true);
    }
  });
});

describe('priceDisplay and the catalog arithmetic', () => {
  it('formats the price and adds the chip above ¥2,000', () => {
    expect(priceDisplay(450, JPY, ECON)).toEqual({ text: '¥450', hours: null, hoursText: null });
    const p = priceDisplay(24_800, JPY, ECON);
    expect(p.text).toBe('¥24,800');
    expect(p.hoursText).toBe('≈ 21.6 h');
    expect(priceDisplay(2000, JPY, ECON).hours).toBeNull();
    expect(priceDisplay(2001, JPY, ECON).hours).not.toBeNull();
    expect(priceDisplay(198_000, JPY, ECON).hoursText).toBe('≈ 172 h');
  });
  it('the §4.3 catalog totals are consistent with the formatter (the full catalog total is checked against the pack by 3E)', () => {
    const premium = 128_000 + 89_000 + 548_000;
    expect(premium).toBe(765_000);
    expect(1_211_910 - premium).toBe(446_910);
    expect(446_910 - 198_000).toBe(248_910);
    expect(priceDisplay(1_211_910, JPY, ECON).text).toBe('¥1,211,910');
    expect(ECON.walletCap).toBeGreaterThan(1_211_910);
  });
});
