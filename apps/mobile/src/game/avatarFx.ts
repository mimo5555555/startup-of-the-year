// What the owned things do to the player's avatar and how they get on and off (docs/GAME_DESIGN.md §5.5). Pure functions over the pack
// and the game state, so they are testable without React or WebGL; `applyAvatar` is the one call that touches the 3D world, and
// `syncWorld` (worldSync.ts) makes it after every state change. Nothing here names an item: any owned item with an `avatar` effect is a
// wearable (the bicycle helmet, Fuku-Fuku's clothes), the Wardrobe groups them by the body part they cover, and the fitting-room try-on
// is the same outfit rules applied to a piece that is not owned yet.
import type { Accessory, AvatarSpec } from '@lw/content';
import { applyOutfit, avatarPatch, ownedQty, type AvatarPatch, type GamePack, type GameState, type ItemDef } from '@lw/game';

/** Applies the equipped pieces' patch (§5.5) to the player's own avatar: colours replace, accessories join the ones already chosen. */
export function specWithPatch(base: AvatarSpec, patch: AvatarPatch): AvatarSpec {
  const accessories = [...base.accessories];
  for (const a of patch.accessories) if (!accessories.includes(a as Accessory)) accessories.push(a as Accessory);
  return {
    ...base,
    top: patch.top ?? base.top,
    bottom: patch.bottom ?? base.bottom,
    shoes: patch.shoes ?? base.shoes,
    accent: patch.accent ?? base.accent,
    accessories,
  };
}

/** The spec the world should show for this game state. */
export const avatarSpecFor = (pack: GamePack, state: GameState, base: AvatarSpec): AvatarSpec => specWithPatch(base, avatarPatch(pack, state));

/** A stable text for a spec: the world rebuilds the avatar only when this changes (building one is not free). */
export const specKey = (spec: AvatarSpec): string => JSON.stringify(spec);

/** The part of the world `applyAvatar` needs (a fake in tests). */
export interface AvatarTarget {
  setPlayerSpec(spec: AvatarSpec): void;
}

// What the world was last told, per world: it was built with the base spec, so a first call with the base spec does nothing.
const shown = new WeakMap<object, string>();

/** Puts the spec on the player once per change; returns whether the world was touched. */
export function applyAvatar(world: AvatarTarget, spec: AvatarSpec, base: AvatarSpec): boolean {
  const key = specKey(spec);
  if (key === (shown.get(world) ?? specKey(base))) return false;
  shown.set(world, key);
  world.setPlayerSpec(spec);
  return true;
}

// ---------------------------------------------------------------------------------------------------------------
// The wardrobe: owned pieces that can be worn
// ---------------------------------------------------------------------------------------------------------------

type AvatarFx = Extract<ItemDef['fx'][number], { t: 'avatar' }>;
const avatarFxOf = (i: ItemDef): AvatarFx | undefined => i.fx.find((f): f is AvatarFx => f.t === 'avatar');
const hasAvatarFx = (i: ItemDef): boolean => avatarFxOf(i) !== undefined;

/** The groups of the Wardrobe, top to toe: what a piece mostly covers. */
export type WardrobeSlot = 'top' | 'bottom' | 'shoes' | 'head' | 'accessory';
export const WARDROBE_SLOTS: readonly WardrobeSlot[] = ['top', 'bottom', 'shoes', 'head', 'accessory'];
/** Accessories that sit on the head: two of them cannot be worn together (a cap under a helmet). */
const HEAD_ACCESSORIES: readonly string[] = ['cap', 'helmet', 'beanie'];

/** The Wardrobe group of a wearable: the first body part it colours (a suit counts as a top), else head or accessory by its accessories. */
export function wardrobeSlot(item: ItemDef): WardrobeSlot {
  const p = avatarFxOf(item)?.patch;
  if (!p) return 'accessory';
  if (p.top !== undefined || p.pick === 'top') return 'top';
  if (p.bottom !== undefined || p.pick === 'bottom') return 'bottom';
  if (p.shoes !== undefined || p.pick === 'shoes') return 'shoes';
  const acc = [...(p.accessory ? [p.accessory] : []), ...(p.accessories ?? [])];
  return acc.some((a) => HEAD_ACCESSORIES.includes(a)) ? 'head' : 'accessory';
}

/** Owned catalog items that can be worn, in pack order. */
export const wearables = (pack: GamePack, state: GameState): ItemDef[] => pack.items.filter((i) => hasAvatarFx(i) && ownedQty(state, i.id) > 0);

/** Whether the piece is on the avatar right now. */
export const isWorn = (state: GameState, itemId: string): boolean => state.outfit.equipped.includes(itemId);

/** The equipped list with a piece added: another head piece goes first (body slots are settled by the reducer: the later piece wins). */
function withPiece(pack: GamePack | undefined, equipped: string[], item: ItemDef | undefined, itemId: string): string[] {
  const head = pack && item && wardrobeSlot(item) === 'head';
  const kept = head ? equipped.filter((id) => { const o = pack.items.find((i) => i.id === id); return !o || wardrobeSlot(o) !== 'head'; }) : equipped;
  return [...kept.filter((id) => id !== itemId), itemId];
}

/** The `equipped` list after putting a piece on or taking it off (the reducer's `outfit_changed` settles slot clashes and drops what is not owned; `pack` lets a second head piece replace the first). */
export function toggledOutfit(state: GameState, itemId: string, pack?: GamePack): string[] {
  if (isWorn(state, itemId)) return state.outfit.equipped.filter((id) => id !== itemId);
  return withPiece(pack, state.outfit.equipped, pack?.items.find((i) => i.id === itemId), itemId);
}

/**
 * The `equipped` list to ask for when a purchase just brought a wearable home (the helmet goes on at once, the Wallet keeps Wear / Take off),
 * or null when nothing new arrived. A piece the player already owned before is never put on again, so taking it off sticks.
 */
export function autoWearOutfit(pack: GamePack, before: GameState, after: GameState): string[] | null {
  const fresh = wearables(pack, after).filter((i) => ownedQty(before, i.id) === 0 && !isWorn(after, i.id));
  if (fresh.length === 0) return null;
  return fresh.reduce((eq, i) => withPiece(pack, eq, i, i.id), after.outfit.equipped);
}

// ---------------------------------------------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------------------------------------------

/** The colours a piece comes in (its pick palette), or an empty list for a piece with one look. */
export const pieceColours = (item: ItemDef): readonly string[] => avatarFxOf(item)?.patch.colours ?? [];

/** The colour a piece shows now: the one picked (kept in the outfit), else its own, else the first of its palette. */
export function pieceColour(state: GameState, item: ItemDef): string | null {
  const p = avatarFxOf(item)?.patch;
  const pals = p?.colours;
  if (!p || !pals?.length) return null;
  const picked = state.outfit.colours[item.id];
  return pals.find((c) => c.toLowerCase() === picked?.toLowerCase()) ?? (p.pick ? p[p.pick] : undefined) ?? pals[0]!;
}

/** The `colours` map to ask for when the player picks a colour for a piece (the reducer drops anything outside the palette). */
export const pickedColours = (state: GameState, itemId: string, colour: string): Record<string, string> => ({ ...state.outfit.colours, [itemId]: colour });

// ---------------------------------------------------------------------------------------------------------------
// The fitting room
// ---------------------------------------------------------------------------------------------------------------

/**
 * The avatar as it would look wearing a piece the player may not own yet: the same outfit rules (`applyOutfit`, `avatarPatch`) run on a copy
 * of the state in which the piece is owned, worn and in the chosen colour. The real state is never touched. Null for a piece that is not a wearable.
 */
export function tryOnSpec(pack: GamePack, state: GameState, base: AvatarSpec, itemId: string, colour?: string): AvatarSpec | null {
  const item = pack.items.find((i) => i.id === itemId);
  if (!item || !hasAvatarFx(item)) return null;
  const owned = { ...state, owned: { ...state.owned, [itemId]: state.owned[itemId] ?? { qty: 1, day: '' } } };
  const equipped = withPiece(pack, owned.outfit.equipped, item, itemId);
  const colours = colour ? pickedColours(owned, itemId, colour) : owned.outfit.colours;
  return avatarSpecFor(pack, applyOutfit(owned, pack, equipped, colours), base);
}

/** Shows the fitting-room preview on the player, or (null) the real outfit again; the world is told only when the look changes. */
export const showOutfit = (world: AvatarTarget, pack: GamePack, state: GameState, base: AvatarSpec, preview: AvatarSpec | null): boolean =>
  applyAvatar(world, preview ?? avatarSpecFor(pack, state, base), base);
