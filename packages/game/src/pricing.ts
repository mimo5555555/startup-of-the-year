// Quotes, purchases, tax, fares, discounts (agent 1B). Pure: every function reads `pack`, `state` and `view` and returns new data.
import { BALANCE } from './balance';
import { emptyPay } from './defaults';
import { heartsForAp } from './friends';
import { grantItem } from './inventory';
import { applyLedgerAll, dayKey, LEDGER_IDS, ledgerHas } from './ledger';
import { canAfford, formatHours, pocketFor, scaleAmount, walletLimits, workHours, yenFormat } from './money';
import type {
  CurrencyDef,
  DerivedEvent,
  EconomyDef,
  GamePack,
  GameState,
  GameView,
  ItemAvailability,
  ItemDef,
  LedgerEntry,
  MenuItem,
  PayMethod,
  PayState,
  PerkDef,
  PurchaseBlock,
  PurchaseEvent,
  PurchaseResult,
  Quote,
  QuoteLine,
  QuoteRequest,
  ReduceCtx,
  TaxRegime,
  UiEffect,
} from './types';

/** `price / (1 + from) * (1 + to)` in integer arithmetic on basis points, so a .5 result rounds the same on every platform. */
function retax(price: number, from: number, to: number): number {
  const a = Math.round(from * 10000);
  const b = Math.round(to * 10000);
  return Math.round((price * (10000 + b)) / (10000 + a));
}

/** A menu price for take-out or eat-in: eatIn = round(price / 1.08 * 1.10) (¥450 -> ¥458), §4.1. */
export function menuPrice(item: MenuItem, tax: TaxRegime, eatIn: boolean): number {
  if (!eatIn || !item.eatInCapable || tax.eatInRate === undefined) return item.price;
  const from = tax.rates[item.taxClass] ?? tax.takeOutRate ?? 0;
  return retax(item.price, from, tax.eatInRate);
}

/** The most a haggle can take off a body price: min(pct, max), `assistedShare` of that when assisted (§4.4 rule 3). 0 where the shop does not negotiate. */
export function haggleLimit(pack: GamePack, shopId: string, bodyPrice: number, assisted: boolean): number {
  const n = pack.rules.negotiation[shopId];
  if (!n || bodyPrice <= 0) return 0;
  // the epsilon keeps 0.06 * 148000 at 8880 instead of 8879.999...
  const max = Math.min(Math.floor(n.maxPct * bodyPrice + 1e-6), n.maxAmount);
  return assisted ? Math.floor(max * n.assistedShare + 1e-6) : max;
}

// ---------------------------------------------------------------------------------------------------------------
// What can be sold, and whether it may be bought now
// ---------------------------------------------------------------------------------------------------------------

interface Sellable {
  id: string;
  shop: string;
  name: { en: string; ar: string };
  /** take-out / list price per unit */
  price: number;
  menu?: MenuItem;
  item?: ItemDef;
}

function findSellable(pack: GamePack, shopId: string | undefined, itemId: string): Sellable | null {
  const item = pack.items.find((i) => i.id === itemId);
  if (item) return { id: item.id, shop: item.shop, name: item.name, price: item.price, item };
  const menu = pack.menu.find((m) => m.id === itemId) ?? (shopId ? pack.menu.find((m) => m.id === `${shopId}:${itemId}`) : undefined);
  return menu ? { id: menu.id, shop: menu.shop, name: menu.name, price: menu.price, menu } : null;
}

/** The day the `*Today` counters belong to is stale after a rollover the reducer has not seen yet: readers treat them as empty. */
function todayPay(state: GameState): PayState {
  const day = dayKey(state.clock.dayIndex);
  if (state.pay.day === day) return state.pay;
  return { ...emptyPay(day), seenIntents: state.pay.seenIntents, lastPaid: state.pay.lastPaid };
}

const ownedOf = (state: GameState, id: string): number => state.owned[id]?.qty ?? 0;

function availability(pack: GamePack, state: GameState, view: GameView, s: Sellable): ItemAvailability {
  const shop = pack.shops.find((x) => x.id === s.shop);
  if (!shop || shop.openChapter > state.chapter.n) return 'closed';
  const it = s.item;
  if (!it) return 'ok';
  if (it.gate.ch > state.chapter.n) return 'gate';
  if (it.gate.ageMin !== undefined && pack.ageProfiles[view.profile.age].ageFloor < it.gate.ageMin) return 'age';
  const st = it.gate.stars;
  if (st && Object.values(state.runs).filter((r) => r.stars >= st.atLeast).length < st.n) return 'stars';
  if (it.gate.needs?.some((n) => ownedOf(state, n) < 1)) return 'needs';
  if (it.once && ownedOf(state, it.id) >= 1) return 'owned';
  return 'ok';
}

/** Whether the player may buy `itemId` now (shop open, chapter gate, age, stars, ownership); drives "Someday (18+)" and "Opens in Chapter N". */
export function itemAvailability(pack: GamePack, state: GameState, view: GameView, itemId: string): ItemAvailability {
  const s = findSellable(pack, undefined, itemId);
  return s ? availability(pack, state, view, s) : 'closed';
}

// ---------------------------------------------------------------------------------------------------------------
// Fares and points
// ---------------------------------------------------------------------------------------------------------------

/** Hearts of every friend whose perk list is read below. */
function friendHearts(state: GameState, friendId: string): number {
  return heartsForAp(state.friends[friendId]?.ap ?? 0);
}

/** Perks the player has earned (the friend's hearts reach the perk's `heart`), in pack order. */
function activePerks(pack: GamePack, state: GameState): PerkDef[] {
  const out: PerkDef[] = [];
  for (const f of pack.friends) {
    const h = friendHearts(state, f.id);
    for (const p of f.perks) if (p.heart <= h) out.push(p);
  }
  return out;
}

/** The fare to a destination: IC fare, paper ticket +¥10, friend perk (Sato -10%, floor ¥10). A destination missing from `pack.fares` returns 0; callers check `pack.fares` first. */
export function fareFor(pack: GamePack, state: GameState, place: string, method: PayMethod | 'paper'): number {
  const base = pack.fares[place];
  if (base === undefined) return 0;
  const sc = (x: number) => scaleAmount(x, pack.economy, pack.currency);
  let fare = base + (method === 'paper' ? sc(BALANCE.fares.paperExtra) : 0);
  const pct = activePerks(pack, state).reduce((sum, p) => (p.fx.t === 'shop_pct' && p.fx.shopId === 'station' ? sum + p.fx.pct : sum), 0);
  if (pct > 0) fare = Math.max(Math.min(fare, sc(BALANCE.fares.perkFloor)), Math.round((fare * (100 - Math.round(pct * 100))) / 100));
  return fare;
}

/**
 * Sakura Points a purchase earns: floor(total * rate), limited by what is left of today's BALANCE.points.dailyCap (§4.1). The rate
 * is BALANCE.points.rate unless an owned item has a `points_rate` trait (the flagship phone: 2%). 0 where the shop has no points.
 * The signature carries no shop, so "no points" is the pack-level `rules.pointsCard`; `commitPurchase` also checks `ShopDef.points`.
 */
export function pointsEarn(pack: GamePack, state: GameState, total: number): number {
  if (!pack.rules.pointsCard || total <= 0) return 0;
  let rate: number = BALANCE.points.rate;
  for (const it of pack.items) {
    if (ownedOf(state, it.id) < 1) continue;
    for (const fx of it.fx) if (fx.t === 'trait' && fx.id === 'points_rate' && fx.value !== undefined) rate = Math.max(rate, fx.value);
  }
  const left = Math.max(0, scaleAmount(BALANCE.points.dailyCap, pack.economy, pack.currency) - todayPay(state).pointsToday);
  // basis points keep floor(total * 0.01) exact (150 * 0.01 is not 1.5 in floating point)
  return Math.min(left, Math.floor((total * Math.round(rate * 10000)) / 10000));
}

// ---------------------------------------------------------------------------------------------------------------
// The quote
// ---------------------------------------------------------------------------------------------------------------

interface QuotePlan {
  quote: Quote;
  sellable: Sellable | null;
  /** points redeemed */
  pointsUsed: number;
  /** friend shop-perk yen (counts toward the ¥300/day) */
  friendYen: number;
  /** one-time perk ids used by this purchase */
  oncePerks: string[];
  /** daily_free perk ids that fired */
  freePerks: string[];
  /** daily_free perks (with `every`) that this purchase counts toward, id -> units */
  perkBuys: Record<string, number>;
  /** 'shopId:itemId' when the haggle slot was used */
  haggleKey: string | null;
  haggleYen: number;
}

const L = {
  delivery: { en: 'Delivery', ar: 'التوصيل' },
  registration: { en: 'Bicycle registration', ar: 'تسجيل الدراجة' },
  points: { en: 'Sakura Points', ar: 'نقاط ساكورا' },
  haggle: { en: 'Haggling', ar: 'مساومة' },
};

function blocked(req: QuoteRequest, qty: number, block: PurchaseBlock, partial?: Partial<Quote>): QuotePlan {
  const quote: Quote = {
    shopId: req.shopId,
    itemId: req.itemId,
    qty,
    lines: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    bulky: false,
    confirm: false,
    hours: null,
    canPay: false,
    block,
    ...partial,
  };
  return { quote, sellable: null, pointsUsed: 0, friendYen: 0, oncePerks: [], freePerks: [], perkBuys: {}, haggleKey: null, haggleYen: 0 };
}

function buildQuote(pack: GamePack, state: GameState, view: GameView, req: QuoteRequest): QuotePlan {
  const qty = req.qty ?? 1;
  const method: PayMethod = req.method ?? 'cash';
  const s = findSellable(pack, req.shopId, req.itemId);
  if (!s) return blocked(req, qty, 'unknown_item');
  const shop = pack.shops.find((x) => x.id === s.shop);
  const sells = shop?.sells ?? [];
  if (s.shop !== req.shopId || !shop || !(sells.includes(s.id) || (s.menu !== undefined && sells.includes(s.menu.option)))) {
    return blocked(req, qty, 'not_sold');
  }
  const av = availability(pack, state, view, s);
  if (av !== 'ok') return blocked(req, qty, av);
  const maxQty = s.item?.once ? 1 : BALANCE.maxQty;
  if (!Number.isInteger(qty) || qty < 1 || qty > maxQty) return blocked(req, qty, 'qty');

  const sc = (x: number) => scaleAmount(x, pack.economy, pack.currency);
  const pay = todayPay(state);
  const eatIn = req.eatIn === true && s.menu?.eatInCapable === true;
  const unit = s.menu ? menuPrice(s.menu, pack.tax, eatIn) : s.price;
  const itemAmount = unit * qty;
  const body = (s.item?.body ?? unit) * qty;
  const lines: QuoteLine[] = [{ kind: 'item', ref: s.id, label: { en: s.name.en, ar: s.name.ar }, qty, unit, amount: itemAmount }];

  const bulky = s.item?.bulky === true;
  const stdRate = pack.tax.rates.standard ?? 0;
  let gross = itemAmount;
  // tax embedded in the tax-included prices, per row (informational)
  const itemRate = s.menu ? (eatIn ? (pack.tax.eatInRate ?? 0) : (pack.tax.rates[s.menu.taxClass] ?? 0)) : stdRate;
  let rawTax = itemAmount - Math.round(itemAmount / (1 + itemRate));
  const addFee = (kind: 'delivery' | 'fee', ref: string, label: QuoteLine['label'], amount: number) => {
    lines.push({ kind, ref, label, amount });
    gross += amount;
    rawTax += amount - Math.round(amount / (1 + stdRate));
  };
  // bulky goods are always delivered (§4.4 rule 5): the fee does not depend on a request flag
  if (bulky && pack.rules.deliveryFee > 0) addFee('delivery', 'delivery', L.delivery, pack.rules.deliveryFee);
  const rides = s.item?.fx.some((f) => f.t === 'ride' && (f.mesh === 'bike' || f.mesh === 'ebike')) === true;
  if (rides && (pack.rules.registrationFee ?? 0) > 0) addFee('fee', 'registration', L.registration, pack.rules.registrationFee as number);

  let left = gross;
  const take = (amount: number) => {
    const a = Math.max(0, Math.min(Math.floor(amount), left));
    left -= a;
    return a;
  };

  // 1. friend perks: shop percentages (routine) and the daily free item
  const routineCap = Math.floor(BALANCE.routineDiscountMax * body + 1e-6);
  let routineLeft = routineCap;
  let friendLeft = Math.max(0, sc(BALANCE.friendPerkDailyMax) - pay.perkToday);
  let friendYen = 0;
  const freePerks: string[] = [];
  const perkBuys: Record<string, number> = {};
  for (const p of activePerks(pack, state)) {
    if (p.fx.t === 'shop_pct' && p.fx.shopId === s.shop) {
      const a = take(Math.min(Math.floor(p.fx.pct * body + 1e-6), routineLeft, friendLeft));
      if (a > 0) {
        routineLeft -= a;
        friendLeft -= a;
        friendYen += a;
        lines.push({ kind: 'discount', ref: p.id, label: p.text, amount: -a });
      }
    } else if (p.fx.t === 'daily_free' && p.fx.shopId === s.shop && (p.fx.itemId === s.id || p.fx.itemId === s.menu?.option)) {
      const every = p.fx.every;
      const before = stateBuys(state, p.id);
      if (every) perkBuys[p.id] = qty;
      const due = every ? Math.floor((before + qty) / every) > Math.floor(before / every) : true;
      if (due && !pay.perkFreeToday.includes(p.id)) {
        const a = take(unit);
        if (a > 0) {
          freePerks.push(p.id);
          lines.push({ kind: 'perk', ref: p.id, label: p.text, amount: -a });
        }
      }
    }
  }

  // 2. one-time heart perks: exempt from the 8% rule, once ever
  const oncePerks: string[] = [];
  for (const p of activePerks(pack, state)) {
    if (p.fx.t !== 'once_discount' || state.stats.perksUsed.includes(p.id) || !p.fx.itemIds.includes(s.id)) continue;
    const a = take(p.fx.amount);
    if (a > 0) {
      oncePerks.push(p.id);
      lines.push({ kind: 'perk', ref: p.id, label: p.text, amount: -a });
    }
  }

  // 3. negotiation: only where the pack lists the shop, one attempt per item per day, never above the routine cap
  const haggleKey = `${s.shop}:${s.id}`;
  let haggleYen = 0;
  const asked = req.haggle ?? 0;
  const negotiable = pack.rules.negotiation[s.shop]?.items?.includes(s.id) ?? true;
  if (asked > 0 && negotiable && !pay.haggleToday.includes(haggleKey)) {
    haggleYen = take(Math.min(asked, haggleLimit(pack, s.shop, body, false), routineLeft));
    if (haggleYen > 0) lines.push({ kind: 'haggle', label: L.haggle, amount: -haggleYen });
  }

  // 4. points: the player's own money, outside every cap, up to what is still owed (the fixed display order lists it before the haggle)
  const pointsUsed = req.usePoints && shop.points ? take(state.wallet.points) : 0;
  if (pointsUsed > 0) {
    const at = lines.findIndex((l) => l.kind === 'haggle');
    lines.splice(at < 0 ? lines.length : at, 0, { kind: 'points', label: L.points, amount: -pointsUsed });
  }

  const total = left;
  const tax = gross > 0 ? Math.round((rawTax * total) / gross) : 0;
  const hours = itemAmount > sc(BALANCE.workHoursChipMin) ? workHours(itemAmount, pack.economy) : null;
  const acceptsMethod = shop.pay.length === 0 || shop.pay.includes(method);
  const canPay = acceptsMethod && canAfford(state, total, method);
  const quote: Quote = {
    shopId: req.shopId,
    itemId: req.itemId,
    qty,
    lines,
    subtotal: total - tax,
    tax,
    total,
    bulky,
    confirm: total >= pack.economy.bigTicket,
    hours,
    canPay,
    ...(canPay ? {} : { block: 'funds' as const }),
  };
  return { quote, sellable: s, pointsUsed, friendYen, oncePerks, freePerks, perkBuys, haggleKey: haggleYen > 0 || req.haggle !== undefined ? haggleKey : null, haggleYen };
}

const stateBuys = (state: GameState, perkId: string): number => state.stats.perkBuys[perkId] ?? 0;

/**
 * The receipt for a purchase: item rows, delivery, registration, then discounts in the fixed order friend perk -> points ->
 * haggle (§4.4), routine discounts capped at 8% of body price, quantity <= 3 for consumables, once-only items. Pure: reads
 * `state` and `view`, never changes them.
 */
export function quote(pack: GamePack, state: GameState, view: GameView, req: QuoteRequest): Quote {
  return buildQuote(pack, state, view, req).quote;
}

/**
 * The economy stage of a `purchase` event: re-quotes, checks funds inside the reducer, writes the ledger entry
 * `purchase:<sessionId>:<n>` and the inventory, spends points, records perk and haggle usage. A repeated (sessionId, n) is a no-op.
 */
export function commitPurchase(state: GameState, ev: PurchaseEvent, ctx: ReduceCtx): PurchaseResult {
  const { pack, view, now } = ctx;
  const none = (reason: PurchaseBlock): PurchaseResult => ({ ok: false, reason, state, derived: [], effects: [] });
  const id = LEDGER_IDS.purchase(ev.sessionId, ev.n);
  if (ledgerHas(state, id)) return none('duplicate');

  const plan = buildQuote(pack, state, view, {
    shopId: ev.shopId,
    itemId: ev.itemId,
    qty: ev.qty,
    eatIn: ev.eatIn,
    method: ev.method,
    delivery: ev.delivery,
    usePoints: ev.usePoints,
    haggle: ev.haggle,
  });
  const q = plan.quote;
  const s = plan.sellable;
  if (q.block || !s) return none(q.block ?? 'unknown_item');

  const shop = pack.shops.find((x) => x.id === s.shop);
  const pocket = pocketFor(ev.method);
  const entries: LedgerEntry[] = [{ id, at: now, kind: 'purchase', delta: -q.total, pocket, ref: s.id }];
  if (plan.pointsUsed > 0) entries.push({ id: `${id}:pts`, at: now, kind: 'purchase', delta: -plan.pointsUsed, pocket: 'points', ref: s.id });
  const earn = shop?.points ? pointsEarn(pack, state, q.total) : 0;
  if (earn > 0) entries.push({ id: `${id}:earn`, at: now, kind: 'purchase', delta: earn, pocket: 'points', ref: s.id });

  const r = applyLedgerAll(state, entries, walletLimits(state, pack));
  if (r.reason === 'duplicate') return none('duplicate');
  if (r.reason === 'insufficient') return none('funds');

  const day = dayKey(state.clock.dayIndex);
  const pay = todayPay(r.state);
  let next: GameState = grantItem(r.state, pack, s.id, q.qty, day);
  next = {
    ...next,
    stats: {
      ...next.stats,
      ...(shop?.surface === 'world' ? { purchases: next.stats.purchases + 1, spentOnPurchases: next.stats.spentOnPurchases + q.total } : {}),
      perksUsed: [...next.stats.perksUsed, ...plan.oncePerks],
      perkBuys: Object.entries(plan.perkBuys).reduce((m, [k, n]) => ({ ...m, [k]: (m[k] ?? 0) + n }), { ...next.stats.perkBuys }),
    },
    pay: {
      ...pay,
      perkToday: pay.perkToday + plan.friendYen,
      pointsToday: pay.pointsToday + earn,
      perkFreeToday: [...pay.perkFreeToday, ...plan.freePerks],
      haggleToday: plan.haggleKey && !pay.haggleToday.includes(plan.haggleKey) ? [...pay.haggleToday, plan.haggleKey] : pay.haggleToday,
    },
  };

  const derived: DerivedEvent[] = q.total > 0 ? [{ t: 'wallet_changed', delta: -q.total, balance: next.wallet[pocket], kind: 'purchase' }] : [];
  const effects: UiEffect[] = [];
  if (s.item) effects.push({ t: 'fanfare', kind: 'purchase' });
  if (s.item?.beat) effects.push({ t: 'beat', id: s.item.beat });
  return { ok: true, state: next, derived, effects };
}

// ---------------------------------------------------------------------------------------------------------------
// Price display data
// ---------------------------------------------------------------------------------------------------------------

/** What a price row shows: the formatted yen and, above BALANCE.workHoursChipMin, the work-hours chip (price / refWage, §4.1). */
export function priceDisplay(price: number, cur: CurrencyDef, econ: EconomyDef): { text: string; hours: number | null; hoursText: string | null } {
  const chip = price > scaleAmount(BALANCE.workHoursChipMin, econ, cur);
  const hours = chip ? workHours(price, econ) : null;
  return { text: yenFormat(price, cur), hours, hoursText: hours === null ? null : `≈ ${formatHours(hours)} h` };
}
