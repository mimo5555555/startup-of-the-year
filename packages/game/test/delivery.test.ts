// Furniture delivery (Release 2 wave B2): a bulky purchase with a chosen delivery day is paid at the counter, booked, and handed over on that day through the
// clock; it is placeable only once it has arrived. The charge is exactly the quote (the piece + the delivery fee), a repeated event books nothing twice.
import { describe, expect, it } from 'vitest';
import {
  arriveDeliveries,
  comfort,
  deliveryLead,
  itemAvailability,
  ownedQty,
  pendingDeliveries,
  pendingQty,
  placeItem,
  quote,
  reduce,
  scheduleDelivery,
  migrate,
  type GameState,
  type InputEvent,
} from '@lw/game';
import { ctxOf, makePack, makeState } from './fixtures-1e';

const base = makePack();
// the fixture shops sell nothing: let every shop sell its catalog rows
const pack = { ...base, shops: base.shops.map((s) => ({ ...s, sells: base.items.filter((i) => i.shop === s.id).map((i) => i.id) })) };
const ctx = (iso: string) => ctxOf(pack, { now: new Date(`${iso}T09:00:00`).getTime() });
const view = ctxOf(pack).view;

/** A state on a given local date with cash in hand (the clock's dayIndex follows the dates the reducer observes). */
function on(date: string, cash = 50000): GameState {
  const s = makeState(10);
  return { ...s, clock: { ...s.clock, lastLocalDate: date }, wallet: { ...s.wallet, cash }, totals: { ...s.totals, checksum: { ...s.totals.checksum, cash } } };
}

const buy = (itemId: string, deliveryDay: string | undefined, n = 1, sessionId = 's1'): InputEvent => ({
  t: 'purchase',
  sessionId,
  n,
  shopId: 'fukufuku',
  itemId,
  qty: 1,
  total: 0,
  method: 'cash',
  lines: [],
  ...(deliveryDay ? { deliveryDay } : {}),
});

describe('deliveryLead', () => {
  it('tomorrow is 1, the day after tomorrow 2, and the next Saturday is 1..7 days away (never today)', () => {
    const s = on('2026-10-09'); // a Friday
    expect(deliveryLead(s, 'tomorrow')).toBe(1);
    expect(deliveryLead(s, 'dayAfter')).toBe(2);
    expect(deliveryLead(s, 'saturday')).toBe(1);
    expect(deliveryLead(on('2026-10-10'), 'saturday')).toBe(7); // a Saturday: the next one
    expect(deliveryLead(on('2026-10-11'), 'saturday')).toBe(6); // a Sunday
    expect(deliveryLead(on('2026-10-05'), 'saturday')).toBe(5); // a Monday
    expect(deliveryLead(s, 'next week')).toBeNull();
    expect(deliveryLead({ ...s, clock: { ...s.clock, lastLocalDate: 'garbage' } }, 'saturday')).toBe(7);
  });
});

describe('a bulky purchase with a delivery day', () => {
  it('charges exactly the quote (piece + 2,200), books the delivery and hands over nothing yet', () => {
    const s0 = on('2026-10-09');
    const q = quote(pack, s0, view, { shopId: 'fukufuku', itemId: 'futon_set', method: 'cash' });
    expect(q.total).toBe(10200);
    const r = reduce(s0, buy('futon_set', 'saturday'), ctx('2026-10-09'));
    expect(r.state.wallet.cash).toBe(50000 - q.total);
    expect(r.state.ledger.filter((e) => e.kind === 'purchase').map((e) => e.delta)).toEqual([-q.total]);
    expect(ownedQty(r.state, 'futon_set')).toBe(0);
    expect(pendingQty(r.state, 'futon_set')).toBe(1);
    expect(pendingDeliveries(r.state)).toEqual([{ id: 'purchase:s1:1', item: 'futon_set', qty: 1, due: '2026-10-10' }]);
    // not placeable, and not buyable twice while it is on its way
    expect(placeItem(r.state, pack, 'bed', 'futon_set')).toMatchObject({ ok: false, reason: 'not_owned' });
    expect(itemAvailability(pack, r.state, view, 'futon_set')).toBe('owned');
  });

  it('a double tap or a reload of the same purchase event charges once and books once', () => {
    const s0 = on('2026-10-09');
    const a = reduce(s0, buy('futon_set', 'tomorrow'), ctx('2026-10-09'));
    const b = reduce(a.state, buy('futon_set', 'tomorrow'), ctx('2026-10-09'));
    expect(b.state.wallet.cash).toBe(a.state.wallet.cash);
    expect(pendingDeliveries(b.state)).toHaveLength(1);
    // the same piece again from another conversation is refused while the first is on its way
    const c = reduce(a.state, buy('futon_set', 'tomorrow', 1, 's2'), ctx('2026-10-09'));
    expect(c.state.wallet.cash).toBe(a.state.wallet.cash);
    expect(pendingDeliveries(c.state)).toHaveLength(1);
  });

  it('short of cash charges nothing and books nothing', () => {
    const r = reduce(on('2026-10-09', 5000), buy('futon_set', 'tomorrow'), ctx('2026-10-09'));
    expect(r.state.wallet.cash).toBe(5000);
    expect(pendingDeliveries(r.state)).toEqual([]);
    expect(ownedQty(r.state, 'futon_set')).toBe(0);
  });

  it('arrives on the chosen day through the clock: not the day before, handed over (and placeable, and comfortable) on it', () => {
    let s = reduce(on('2026-10-09'), buy('futon_set', 'saturday'), ctx('2026-10-09')).state;
    // an event on the same day, and the day after tomorrow's eve: still on its way
    s = reduce(s, { t: 'day_observed', nowMs: new Date('2026-10-09T20:00:00').getTime() }, ctx('2026-10-09')).state;
    expect(ownedQty(s, 'futon_set')).toBe(0);
    const day = reduce(s, { t: 'day_observed', nowMs: new Date('2026-10-10T08:00:00').getTime() }, ctx('2026-10-10'));
    expect(ownedQty(day.state, 'futon_set')).toBe(1);
    expect(pendingDeliveries(day.state)).toEqual([]);
    expect(day.derived).toContainEqual({ t: 'delivered', itemId: 'futon_set', qty: 1 });
    const placed = placeItem(day.state, pack, 'bed', 'futon_set');
    expect(placed.ok).toBe(true);
    // placed-only comfort: dorm base 1 + the futon's 2
    expect(comfort(pack, day.state)).toBe(1);
    expect(comfort(pack, placed.state)).toBe(3);
  });

  it('a delivery that came due while the app was closed still arrives on the first event after it (a week away costs nothing)', () => {
    const s = reduce(on('2026-10-09'), buy('desk_study', 'tomorrow'), ctx('2026-10-09')).state;
    const later = reduce(s, { t: 'day_observed', nowMs: new Date('2026-10-20T08:00:00').getTime() }, ctx('2026-10-20'));
    expect(ownedQty(later.state, 'desk_study')).toBe(1);
  });

  it('an earlier date (a clock set back) delivers nothing early and takes nothing back', () => {
    const s = reduce(on('2026-10-09'), buy('futon_set', 'saturday'), ctx('2026-10-09')).state;
    const back = reduce(s, { t: 'day_observed', nowMs: new Date('2026-10-01T08:00:00').getTime() }, ctx('2026-10-01'));
    expect(ownedQty(back.state, 'futon_set')).toBe(0);
    expect(pendingDeliveries(back.state)).toHaveLength(1);
    const there = reduce(back.state, { t: 'day_observed', nowMs: new Date('2026-10-10T08:00:00').getTime() }, ctx('2026-10-10'));
    expect(ownedQty(there.state, 'futon_set')).toBe(1);
  });

  it('a small piece, or a bulky one with no delivery day (the Denki TV today), is handed over at once', () => {
    const plant = reduce(on('2026-10-09'), buy('plant_pothos', 'tomorrow'), ctx('2026-10-09')).state;
    expect(ownedQty(plant, 'plant_pothos')).toBe(1);
    expect(pendingDeliveries(plant)).toEqual([]);
    const now = reduce(on('2026-10-09'), buy('futon_set', undefined), ctx('2026-10-09')).state;
    expect(ownedQty(now, 'futon_set')).toBe(1);
    // an unknown day name is the same as none
    const odd = reduce(on('2026-10-09'), buy('futon_set', 'whenever'), ctx('2026-10-09')).state;
    expect(ownedQty(odd, 'futon_set')).toBe(1);
  });

  it('two pieces on their way arrive together or apart, each once', () => {
    let s = reduce(on('2026-10-09'), buy('futon_set', 'tomorrow', 1, 'a'), ctx('2026-10-09')).state;
    s = reduce(s, buy('desk_study', 'saturday', 1, 'b'), ctx('2026-10-09')).state;
    expect(pendingDeliveries(s).map((d) => d.due)).toEqual(['2026-10-10', '2026-10-10']);
    const s2 = reduce(on('2026-10-08'), buy('futon_set', 'tomorrow', 1, 'a'), ctx('2026-10-08')).state;
    const s3 = reduce(s2, buy('desk_study', 'saturday', 1, 'b'), ctx('2026-10-08')).state;
    expect(pendingDeliveries(s3).map((d) => d.due)).toEqual(['2026-10-09', '2026-10-10']);
    const fri = reduce(s3, { t: 'day_observed', nowMs: new Date('2026-10-09T08:00:00').getTime() }, ctx('2026-10-09')).state;
    expect([ownedQty(fri, 'futon_set'), ownedQty(fri, 'desk_study')]).toEqual([1, 0]);
    const sat = reduce(fri, { t: 'day_observed', nowMs: new Date('2026-10-10T08:00:00').getTime() }, ctx('2026-10-10')).state;
    expect([ownedQty(sat, 'futon_set'), ownedQty(sat, 'desk_study')]).toEqual([1, 1]);
  });
});

describe('scheduleDelivery / arriveDeliveries / persistence', () => {
  it('booking the same purchase twice changes nothing; arriving is pure and removes only what came', () => {
    const s0 = on('2026-10-09');
    const a = scheduleDelivery(s0, 'futon_set', 1, 3, 'p1');
    expect(scheduleDelivery(a, 'futon_set', 1, 3, 'p1')).toBe(a);
    expect(s0.deliveries).toBeUndefined();
    expect(arriveDeliveries(a, pack).arrived).toEqual([]);
    const due = { ...a, clock: { ...a.clock, lastLocalDate: '2026-10-12' } };
    const r = arriveDeliveries(due, pack);
    expect(r.arrived).toHaveLength(1);
    expect(ownedQty(r.state, 'futon_set')).toBe(1);
    expect(pendingDeliveries(r.state)).toEqual([]);
  });

  it('survives a save and a reload (and an old save without the field is fine)', () => {
    const r = reduce(on('2026-10-09'), buy('futon_set', 'saturday'), ctx('2026-10-09')).state;
    const back = migrate(JSON.parse(JSON.stringify(r)), 1, pack);
    expect(pendingDeliveries(back)).toEqual(pendingDeliveries(r));
    const old = migrate(JSON.parse(JSON.stringify(on('2026-10-09'))), 1, pack);
    expect(old.deliveries).toBeUndefined();
    // a damaged entry is dropped, an unreadable date counts as come (nothing is stuck for ever)
    const hurt = migrate({ ...JSON.parse(JSON.stringify(r)), deliveries: [{ id: 'x' }, { id: 'y', item: 'desk_study', qty: 1, due: 'soon' }] }, 1, pack);
    expect(pendingDeliveries(hurt)).toEqual([{ id: 'y', item: 'desk_study', qty: 1, due: '' }]);
    expect(ownedQty(arriveDeliveries(hurt, pack).state, 'desk_study')).toBe(1);
  });
});
