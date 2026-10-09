// What the owned things do to the player's avatar and how they get on and off (docs/GAME_DESIGN.md §5.5). Pure functions over the pack
// and the game state, so they are testable without React or WebGL; `applyAvatar` is the one call that touches the 3D world, and
// `syncWorld` (worldSync.ts) makes it after every state change. In this release the only wearable is the bicycle helmet, but nothing
// here names it: any owned item with an `avatar` effect is a wearable (jackets and caps arrive with the clothes shop).
import type { Accessory, AvatarSpec } from '@lw/content';
import { avatarPatch, ownedQty, type AvatarPatch, type GamePack, type GameState, type ItemDef } from '@lw/game';

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

const hasAvatarFx = (i: ItemDef): boolean => i.fx.some((f) => f.t === 'avatar');

/** Owned catalog items that can be worn, in pack order. */
export const wearables = (pack: GamePack, state: GameState): ItemDef[] => pack.items.filter((i) => hasAvatarFx(i) && ownedQty(state, i.id) > 0);

/** Whether the piece is on the avatar right now. */
export const isWorn = (state: GameState, itemId: string): boolean => state.outfit.equipped.includes(itemId);

/** The `equipped` list after putting a piece on or taking it off (the reducer's `outfit_changed` settles slot clashes and drops what is not owned). */
export function toggledOutfit(state: GameState, itemId: string): string[] {
  return isWorn(state, itemId) ? state.outfit.equipped.filter((id) => id !== itemId) : [...state.outfit.equipped, itemId];
}
