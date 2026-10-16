// What the conversation screen hands the engine for the game (docs/GAME_DESIGN.md §6.2, §11.2): the economy hooks of one shop
// conversation, the flags, the recalled pocket lines. Pure on its inputs (state, view and the commit function are passed in), so a
// test can drive it without a screen; the Conversation screen passes the bridge's `dispatch`.
import { CLOTHES_COLOURS, LEXICON, parseJaNumber, plainText, tokenize, yenToJa, type AvatarSpec, type Vars } from '@lw/content';
import type { RecalledLines, SessionGameHooks } from '@lw/engine';
import {
  fareFor,
  haggleLimit,
  itemAvailability,
  ledgerHas,
  lineReady,
  ownedQty,
  pendingQty,
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
import { visitFlags, type FriendPlan } from './friendsLogic';
import { pieceColours, tryOnSpec } from './avatarFx';
import { IC_SCENARIO, icHooks } from './icHooks';
import { ownRoomFlags } from './ownLogic';

/** Slot option ids of `qty` (slots/shop.ts) and of `payMethod`. */
const QTY: Record<string, number> = { one: 1, two: 2, three: 3 };
const METHODS: PayMethod[] = ['cash', 'card', 'ic'];

/** Extra slots that REPLACE the main item when changed later (a present picked at the `goods` node), not an add-on like the ramen egg. */
const EXCLUSIVE_EXTRAS = ['giftItem'];

/**
 * The fitting room (§6.3): the nodes of a clothes scenario in which the piece in the `itemSlot` is on the avatar (the fitting, the resize
 * and Rin's compliment), and the slot that holds the colour the learner named. A piece that is not bought stays a preview: the screen
 * puts the real outfit back as soon as the conversation is on another node.
 */
const TRY_ON: Record<string, { nodes: readonly string[]; colourSlot: string }> = {
  fuku_clothes: { nodes: ['fitting', 'resize', 'suits'], colourSlot: 'clothesColour' },
};

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
  amounts(): { price?: number; total?: number; fare?: number; body?: number };
  /** committed purchases, in order */
  purchases: ConvoPurchase[];
  /** derived events of those purchases (culture cards, unlocks...) for the debrief */
  derived: DerivedEvent[];
  /**
   * The avatar to show while the conversation is on `nodeId`: the piece the learner is trying on (in the colour they named) over what they
   * wear, or null when this node shows nothing special (the screen then shows the real outfit).
   */
  tryOn(nodeId: string, state: GameState, base: AvatarSpec): AvatarSpec | null;
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
  /** who the player talks to (the guest of the housewarming speaks plain form to a friend of the player: `casual`) */
  characterId?: string;
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
  /** the session's flags: the engine reads this very object on every line, so the hooks below may set `sold_out` / `owned_already` live */
  const flags: Record<string, boolean> = { priced: true };
  const derived: DerivedEvent[] = [];
  let last: { price?: number; total?: number; fare?: number; body?: number } = {};
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

  /** yen the one haggle of this conversation took off the negotiable line (0 until it is granted); `triedHaggle` = the one attempt is used (§4.4 rule 3) */
  let haggled = 0;
  let triedHaggle = false;
  const negotiable = (itemId: string): boolean => {
    const n = shopMeta ? pack.rules.negotiation[shopMeta.shopId] : undefined;
    return !!n && (n.items?.includes(itemId) ?? true);
  };
  const quoteAll = (basket: BasketLine[], method: PayMethod, haggle = haggled): Quote[] =>
    basket.map((l) => quote(pack, deps.state(), deps.view(), { shopId: shopMeta!.shopId, itemId: l.itemId, qty: l.qty, method, ...(haggle > 0 && negotiable(l.itemId) ? { haggle } : {}) }));

  /** a quote that could not be priced at all (unknown item, closed shop...); running short of money still has a total */
  const priced = (qs: Quote[]) => qs.every((q) => !q.block || q.block === 'funds');

  const totalNow = (slots: Record<string, string>): number | null => {
    const b = basketOf(slots);
    if (!b) return null;
    const qs = quoteAll(b, methodOf(slots));
    return priced(qs) ? qs.reduce((a, q) => a + q.total, 0) : null;
  };

  /** the slots as the session last reported them (every hook receives them): the fitting-room preview reads the piece and colour from here */
  let lastSlots: Record<string, string> = {};

  /**
   * A colour the learner named for a piece that comes in several (the hoodie in red): the outfit remembers it, so the avatar wears it now and
   * after a reload; the Wardrobe can change it later. Only a colour that is in the piece's own palette is kept.
   */
  const rememberColour = (itemId: string, slots: Record<string, string>) => {
    const spec = TRY_ON[scenarioId];
    const item = pack.items.find((i) => i.id === itemId);
    const hex = spec ? CLOTHES_COLOURS[slots[spec.colourSlot] ?? ''] : undefined;
    if (!item || !hex || !pieceColours(item).includes(hex)) return;
    const st = deps.state();
    if (st.owned[itemId]) commit({ t: 'outfit_changed', equipped: st.outfit.equipped, colours: { ...st.outfit.colours, [itemId]: hex } });
  };

  const shopHooks: SessionGameHooks = {
    vars(slots) {
      lastSlots = { ...slots };
      const v: Vars = {};
      const b = basketOf(slots);
      if (b) {
        let qs = quoteAll(b, methodOf(slots));
        // a one-time item the player already owns is still quoted (the line would read "… in total"); the charge refuses it later with its own line
        if (qs.some((q) => q.block === 'owned')) {
          const owned = { ...deps.state().owned };
          for (const l of b) delete owned[l.itemId];
          // a piece that is paid for and on its way counts as held too (`pendingQty`): it is quoted the same way
          const deliveries = (deps.state().deliveries ?? []).filter((d) => !b.some((l) => l.itemId === d.item));
          const st = { ...deps.state(), owned, deliveries };
          qs = b.map((l) => quote(pack, st, deps.view(), { shopId: shopMeta!.shopId, itemId: l.itemId, qty: l.qty, method: methodOf(slots) }));
        }
        if (priced(qs)) {
          v.price = yenVar(qs[0].lines[0]?.unit ?? qs[0].total);
          v.total = yenVar(qs.reduce((a, q) => a + q.total, 0));
          // a car is first quoted at its body price (本体価格, no fees): the drive-away price is what the learner has to ask for (§4.4 rule 3)
          const body = pack.items.find((i) => i.id === b[0].itemId)?.body;
          if (body !== undefined) v.body = yenVar(body * b[0].qty);
        }
      }
      if (slots.place && pack.fares[slots.place] !== undefined) v.fare = yenVar(fareFor(pack, deps.state(), slots.place, 'ic'));
      return v;
    },

    charge(slots) {
      lastSlots = { ...slots };
      const b = basketOf(slots);
      if (!b || !shopMeta) return { ok: false };
      const method = methodOf(slots);
      const qs = quoteAll(b, method);
      // the whole basket is checked once, then committed line by line (a bowl and its extra are two purchases)
      const total = qs.reduce((a, q) => a + q.total, 0);
      const before = deps.state();
      // why the shop cannot sell it, for the `short` node: not enough money is the default; an item that is not in stock yet, or that the
      // player already owns, gets its own line instead of "a little short" (only running short of money is ever "short")
      const refused = qs.find((q) => q.block && q.block !== 'funds')?.block;
      // a piece that is paid for and still on its way is "ordered", not "owned": Rin says so (fuku_home)
      const ordered = refused === 'owned' && b.some((l) => pendingQty(before, l.itemId) > 0 && ownedQty(before, l.itemId) === 0);
      flags.on_its_way = ordered;
      flags.owned_already = refused === 'owned' && !ordered;
      flags.sold_out = refused !== undefined && refused !== 'owned';
      if (!priced(qs) || (method === 'ic' ? before.wallet.ic : before.wallet.cash) < total) return { ok: false };
      const done: Quote[] = [];
      for (let i = 0; i < b.length; i++) {
        const q = qs[i];
        const id = LEDGER_IDS.purchase(sessionId, n + 1);
        commit({ t: 'purchase', sessionId, n: n + 1, shopId: shopMeta.shopId, itemId: b[i].itemId, qty: b[i].qty, total: q.total, method, lines: q.lines, ...(haggled > 0 && negotiable(b[i].itemId) ? { haggle: haggled } : {}), ...(slots.deliveryDay ? { deliveryDay: slots.deliveryDay } : {}) });
        if (!ledgerHas(deps.state(), id)) return done.length ? { ok: true } : { ok: false };
        n++;
        done.push(q);
        rememberColour(b[i].itemId, slots);
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
      // the picked item is on sale now (a late item, the e-bike without its helmet...): otherwise the clerk says it is not in stock and the learner is
      // not walked to a till that could never charge. Owning it already is not "out of stock": that ends at the till with its own line.
      if (kind === 'in_stock') {
        const b = basketOf(ctx.slotIds);
        return { ok: !b || quoteAll(b, methodOf(ctx.slotIds), 0).every((q) => !q.block || q.block === 'funds' || q.block === 'owned') };
      }
      // reading the total back (「合計は千円ですね」) is right when the number is the real total; asking for it always works
      if (kind === 'ask_total') return { ok: true };
      if (kind === 'say_total') {
        const t = totalNow(ctx.slotIds);
        // 「三万円と三万円で六万円です」: the parts first, then the sum. Any number the learner said counts, so the right sum is never lost behind the first one
        // (a wrong sum is still wrong: it matches nothing). A host without `numbers` reads the first number as before.
        return { ok: t !== null && (ctx.numbers ?? (ctx.number !== undefined ? [ctx.number] : [])).includes(t) };
      }
      // the one haggle of the game (§4.4 rule 3): a polite request (or a price the learner names) at a shop that negotiates, once per conversation and
      // once per item per day (the quote refuses a second one). Granted: min(the learner's ask, min(6%, ¥8,880) of the body price), 40% of that when assisted.
      if (kind === 'haggle') {
        const b = basketOf(ctx.slotIds);
        const line = b?.find((l) => negotiable(l.itemId));
        if (!b || !shopMeta || !line || triedHaggle) return { ok: false };
        triedHaggle = true;
        const item = pack.items.find((i) => i.id === line.itemId);
        const limit = haggleLimit(pack, shopMeta.shopId, (item?.body ?? item?.price ?? 0) * line.qty, ctx.assisted);
        const plain = quoteAll(b, methodOf(ctx.slotIds), 0);
        if (!priced(plain)) return { ok: false };
        const asked = ctx.number !== undefined ? Math.min(limit, Math.max(0, plain.reduce((a, q) => a + q.total, 0) - ctx.number)) : limit;
        const offered = quoteAll(b, methodOf(ctx.slotIds), asked);
        const got = plain.reduce((a, q) => a + q.total, 0) - offered.reduce((a, q) => a + q.total, 0);
        if (got <= 0) return { ok: false };
        haggled = got;
        // the clerk's next line quotes the new total: the engine merges these over the variables it computed before the intent ran
        return { ok: true, vars: shopHooks.vars(ctx.slotIds, {}) };
      }
      // tax-free is a learning-only branch (D30); points and delivery arrive with their shops
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
      last = { price: numberOf(v.price), total: numberOf(v.total), fare: numberOf(v.fare), body: numberOf(v.body) };
      return deps.friend ? { ...deps.friend.vars, ...v } : v;
    },
    ...(inner.intent
      ? {
          intent(kind, ctx) {
            const r = inner.intent!(kind, ctx);
            // a granted haggle changes what the next line quotes, and so the chip under it
            if (r.vars) last = { price: numberOf(r.vars.price) ?? last.price, total: numberOf(r.vars.total) ?? last.total, fare: last.fare, body: numberOf(r.vars.body) ?? last.body };
            return r;
          },
        }
      : {}),
  };

  const state = deps.state();
  const plays = state.runs[scenarioId]?.count ?? 0;
  // an item the player cannot buy yet (late chapter, Free Walk, age, stars, the helmet the e-bike needs) is "not in stock": the scenarios
  // say so through `<option>_locked` (pro_locked, tv_locked, ebike_locked, good_locked) instead of quoting a price that is not there.
  // An item the player already owns is not locked: it is simply not sold twice.
  if (shopMeta) {
    for (const [option, itemId] of Object.entries(shopMeta.itemMap)) {
      const av = itemAvailability(pack, state, deps.view(), itemId);
      if (av !== 'ok' && av !== 'owned') flags[`${option}_locked`] = true;
    }
  }
  if (meta?.twist && twistFor(state.clock.dayIndex, scenarioId, plays)) flags.twist = true;
  if (deps.friend) Object.assign(flags, deps.friend.flags);
  // a hang-out or a home visit: the friend's plain speech (the scenarios read no other flag)
  Object.assign(flags, visitFlags(pack, state, meta));
  // the player's own room: the viewing as a tea-room visit for a minor, the housewarming guest's plain speech
  Object.assign(flags, ownRoomFlags(pack, state, deps.view().profile.age, scenarioId, deps.characterId));

  return {
    hooks,
    flags,
    recalled: recalledLines(pack, state, deps.view(), meta),
    prepared: pocketReady(pack, state, deps.view(), scenarioId),
    meta,
    amounts: () => ({ ...last }),
    tryOn(nodeId, st, base) {
      const spec = TRY_ON[scenarioId];
      const mainSlot = shopMeta?.itemSlot;
      if (!spec || !shopMeta || !mainSlot || !spec.nodes.includes(nodeId)) return null;
      const itemId = shopMeta.itemMap[lastSlots[mainSlot] ?? ''];
      return itemId ? tryOnSpec(pack, st, base, itemId, CLOTHES_COLOURS[lastSlots[spec.colourSlot] ?? '']) : null;
    },
    purchases: log,
    derived,
    friend: deps.friend ?? null,
  };
}
