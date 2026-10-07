// Inventory, outfit, home slots and the derived item effects (agent 1E).
import { BALANCE } from './balance';
import type { AgeGroup, AvatarPatch, GamePack, GameState, ItemDef, ItemEffect, ItemTrait, MenuItem, PlaceResult, RideState } from './types';

/** Placeable furniture slots per home tier (§8.8): the dorm shows 4, the Ono-sō room 8. Ids match `ItemEffect { t: 'home' }.slot`. */
export const HOME_SLOTS = {
  dorm: ['bed', 'desk', 'shelf', 'plant'],
  ono: ['bed', 'desk', 'shelf', 'table', 'plant', 'kitchen', 'light', 'tv'],
} as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
/** the avatar slots whose piece is replaced, not stacked, when another piece covers the same one (a yukata over a T-shirt) */
const BODY_SLOTS = ['top', 'bottom', 'shoes'] as const;

const findItem = (pack: GamePack, id: string): ItemDef | undefined => pack.items.find((i) => i.id === id);
const findMenu = (pack: GamePack, id: string): MenuItem | undefined => pack.menu.find((m) => m.id === id);

export function ownedQty(state: GameState, itemId: string): number {
  return state.owned[itemId]?.qty ?? 0;
}

/** Owned catalog items (`ItemDef`s; menu stock is not a catalog item), in pack order. */
function ownedItems(pack: GamePack, state: GameState): ItemDef[] {
  return pack.items.filter((i) => ownedQty(state, i.id) > 0);
}

/** A menu item is giftable when the pack says so (default: it was bought in a conversation, i.e. its shop is a world shop); vending / panel goods never are (§5.3). */
function menuGiftable(pack: GamePack, m: MenuItem): boolean {
  const shop = pack.shops.find((s) => s.id === m.shop);
  if (shop?.surface === 'panel') return false;
  return m.giftable ?? shop?.surface === 'world';
}

/** Tags, price and giftability of an item or menu option id, or null when it is neither (gifts must be bought in a conversation). */
export function giftInfo(pack: GamePack, itemId: string): { tags: string[]; price: number; giftable: boolean } | null {
  const item = findItem(pack, itemId);
  if (item) {
    const fxTags = item.fx.flatMap((f) => (f.t === 'gift' ? f.tags : []));
    return { tags: [...new Set([...item.tags, ...fxTags])], price: item.price, giftable: item.cat === 'gift' || item.fx.some((f) => f.t === 'gift') };
  }
  const menu = findMenu(pack, itemId);
  if (menu) return { tags: [...menu.tags], price: menu.price, giftable: menuGiftable(pack, menu) };
  return null;
}

/**
 * Adds `qty` of an item (non-giftable consumables are not stocked) and applies once-only effects such as the home tier. `day` is the dayKey.
 * A `once` item never goes above one; an unknown id changes nothing.
 */
export function grantItem(state: GameState, pack: GamePack, itemId: string, qty: number, day: string): GameState {
  const n = Math.trunc(qty);
  if (!Number.isFinite(n) || n <= 0) return state;
  const have = ownedQty(state, itemId);
  const item = findItem(pack, itemId);
  const stocked = item !== undefined || (findMenu(pack, itemId) !== undefined && giftInfo(pack, itemId)?.giftable === true);
  if (!stocked) return state;
  const add = item?.once ? Math.max(0, 1 - have) : n;
  if (add <= 0) return state;
  let next: GameState = { ...state, owned: { ...state.owned, [itemId]: { qty: have + add, day: state.owned[itemId]?.day ?? day } } };
  if (item && have === 0) {
    for (const fx of item.fx) if (fx.t === 'homeTier') next = { ...next, home: { ...next.home, tier: fx.tier } };
  }
  return next;
}

/** Takes `qty` out of stock (a gift handed over); false when not enough is owned. The entry is removed at zero. */
export function consumeItem(state: GameState, itemId: string, qty = 1): { state: GameState; ok: boolean } {
  const have = ownedQty(state, itemId);
  if (qty <= 0 || have < qty) return { state, ok: false };
  const owned = { ...state.owned };
  if (have === qty) delete owned[itemId];
  else owned[itemId] = { ...owned[itemId]!, qty: have - qty };
  return { state: { ...state, owned }, ok: true };
}

/** Whether any owned item carries the category tag (phone, bicycle, car, flat, yukata), for `own category:`. */
export function ownsCategory(pack: GamePack, state: GameState, category: string): boolean {
  return ownedItems(pack, state).some((i) => i.tags.includes(category));
}

/** Whether an owned item switches a feature on (`phone`: Messages and Map pins; `ic`: tap to ride and pay). */
export function hasFeature(pack: GamePack, state: GameState, id: 'phone' | 'ic'): boolean {
  return ownedItems(pack, state).some((i) => i.fx.some((f) => f.t === 'feature' && f.id === id));
}

/**
 * The value of a named perk of an owned item (hang-out multiplier, points rate...), the largest when several carry it; null when none
 * does. Furniture only counts while it is placed in its slot (a kotatsu in a box warms nobody). A trait without a value reads as 1.
 */
export function traitValue(pack: GamePack, state: GameState, trait: ItemTrait): number | null {
  let best: number | null = null;
  for (const item of ownedItems(pack, state)) {
    const slot = item.fx.find((f): f is Extract<ItemEffect, { t: 'home' }> => f.t === 'home');
    if (slot && state.home.placed[slot.slot] !== item.id) continue;
    for (const fx of item.fx) if (fx.t === 'trait' && fx.id === trait) best = Math.max(best ?? 0, fx.value ?? 1);
  }
  return best;
}

/** Whether the profile's age group may have the item (D28: `ItemDef.gate.ageMin` against the group's lowest age). Unknown ids are allowed. */
export function ageAllowed(pack: GamePack, age: AgeGroup, itemId: string): boolean {
  const min = findItem(pack, itemId)?.gate.ageMin;
  return min === undefined || (pack.ageProfiles[age]?.ageFloor ?? 0) >= min;
}

// ---------------------------------------------------------------------------------------------------------------
// Outfit
// ---------------------------------------------------------------------------------------------------------------

type AvatarFx = Extract<ItemEffect, { t: 'avatar' }>;
const avatarFx = (item: ItemDef): AvatarFx | undefined => item.fx.find((f): f is AvatarFx => f.t === 'avatar');

/** The body slots a piece covers: a fixed colour or a colour pick on top / bottom / shoes. */
function coveredSlots(fx: AvatarFx): Array<(typeof BODY_SLOTS)[number]> {
  return BODY_SLOTS.filter((s) => fx.patch[s] !== undefined || fx.patch.pick === s);
}

/** Whether `colour` is acceptable for the item: a hex colour, inside the item's palette when it has one. */
function colourOk(item: ItemDef, colour: string): boolean {
  if (!HEX.test(colour)) return false;
  const palette = avatarFx(item)?.patch.colours;
  return !palette || palette.some((c) => c.toLowerCase() === colour.toLowerCase());
}

/** The outfit-changed event: keeps only owned, equippable pieces and valid colours; a piece covering a body slot another later piece covers is dropped. */
export function applyOutfit(state: GameState, pack: GamePack, equipped: string[], colours: Record<string, string>): GameState {
  const seen = new Set<string>();
  const wanted: ItemDef[] = [];
  for (const id of equipped) {
    const item = findItem(pack, id);
    if (!item || seen.has(id) || ownedQty(state, id) < 1 || !avatarFx(item)) continue;
    seen.add(id);
    wanted.push(item);
  }
  const taken = new Set<string>();
  const kept: ItemDef[] = [];
  for (let i = wanted.length - 1; i >= 0; i--) {
    const slots = coveredSlots(avatarFx(wanted[i]!)!);
    if (slots.some((s) => taken.has(s))) continue;
    slots.forEach((s) => taken.add(s));
    kept.push(wanted[i]!);
  }
  const ok: Record<string, string> = {};
  for (const [id, colour] of Object.entries(colours ?? {})) {
    const item = findItem(pack, id);
    if (!item || ownedQty(state, id) < 1 || typeof colour !== 'string') continue;
    const colourable = item.fx.some((f) => (f.t === 'avatar' && (f.patch.pick !== undefined || f.patch.colours !== undefined)) || f.t === 'cosmetic');
    if (colourable && colourOk(item, colour)) ok[id] = colour.toLowerCase();
  }
  return { ...state, outfit: { equipped: kept.reverse().map((i) => i.id), colours: ok } };
}

/** The picked colour mixed toward white, for the hoodie's accent (§5.5 "colour lightened"). */
function lighten(hex: string, amount: number): string {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const ch = (i: number) => parseInt(full.slice(1 + i * 2, 3 + i * 2), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[0, 1, 2].map((i) => mix(ch(i)).toString(16).padStart(2, '0')).join('')}`;
}

/** How far the hoodie's accent is lightened toward white. */
const ACCENT_LIGHTEN = 0.4;

/** The avatar changes the equipped pieces make (§5.5), for the world's `setPlayerSpec`. Later pieces win a slot; accessories stack without repeats. */
export function avatarPatch(pack: GamePack, state: GameState): AvatarPatch {
  const out: AvatarPatch = { accessories: [] };
  for (const id of state.outfit.equipped) {
    const item = findItem(pack, id);
    const fx = item && ownedQty(state, id) > 0 ? avatarFx(item) : undefined;
    if (!item || !fx) continue;
    const p = fx.patch;
    if (p.top !== undefined) out.top = p.top;
    if (p.bottom !== undefined) out.bottom = p.bottom;
    if (p.shoes !== undefined) out.shoes = p.shoes;
    if (p.accent !== undefined) out.accent = p.accent;
    if (p.pick) {
      const picked = state.outfit.colours[id];
      // no valid pick: the piece's own colour, else the first of its palette
      const colour = picked && colourOk(item, picked) ? picked : (p[p.pick] ?? p.colours?.[0]);
      if (colour) {
        out[p.pick] = colour;
        if (p.lightenAccent) out.accent = lighten(colour, ACCENT_LIGHTEN);
      }
    }
    for (const a of [...(p.accessory ? [p.accessory] : []), ...(p.accessories ?? [])]) if (!out.accessories.includes(a)) out.accessories.push(a);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------------------------------------------

/** Places (or with null clears) an owned home item in a slot of the player's room. */
export function placeItem(state: GameState, pack: GamePack, slot: string, itemId: string | null): PlaceResult {
  const tier = state.home.tier;
  const here: readonly string[] = HOME_SLOTS[tier];
  if (!here.includes(slot)) return { state, ok: false, reason: HOME_SLOTS.ono.includes(slot as never) ? 'no_flat' : 'bad_slot' };
  if (itemId === null) {
    if (!(slot in state.home.placed)) return { state, ok: true };
    const placed = { ...state.home.placed };
    delete placed[slot];
    return { state: { ...state, home: { ...state.home, placed } }, ok: true };
  }
  const item = findItem(pack, itemId);
  if (!item || ownedQty(state, itemId) < 1) return { state, ok: false, reason: 'not_owned' };
  const fx = item.fx.find((f): f is Extract<ItemEffect, { t: 'home' }> => f.t === 'home');
  if (!fx || fx.slot !== slot) return { state, ok: false, reason: 'bad_slot' };
  return { state: { ...state, home: { ...state.home, placed: { ...state.home.placed, [slot]: itemId } } }, ok: true };
}

/** Comfort = base (dorm 1, flat 3) + the placed furniture's comfort, max 16 (§8.8). */
export function comfort(pack: GamePack, state: GameState): number {
  let sum: number = BALANCE.comfort.base[state.home.tier];
  for (const [slot, id] of Object.entries(state.home.placed)) {
    const fx = findItem(pack, id)?.fx.find((f): f is Extract<ItemEffect, { t: 'home' }> => f.t === 'home');
    if (fx && fx.slot === slot && ownedQty(state, id) > 0) sum += fx.comfort;
  }
  return Math.min(BALANCE.comfort.max, sum);
}

// ---------------------------------------------------------------------------------------------------------------
// Ride
// ---------------------------------------------------------------------------------------------------------------

/** The best owned ride (car > e-bike > bike) and its speed multiplier. */
export function rideOf(pack: GamePack, state: GameState): RideState {
  let best: RideState = { mesh: 'none', mul: 1 };
  for (const item of ownedItems(pack, state)) {
    for (const fx of item.fx) if (fx.t === 'ride' && fx.mul > best.mul) best = { mesh: fx.mesh, mul: fx.mul };
  }
  return best;
}
