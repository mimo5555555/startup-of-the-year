// The app's one door to the game pack (docs/GAME_DESIGN.md §14.5): screens and hooks read tables through here.
import { JP_PACK } from '@lw/content';
import type { Beat, FriendDef, ItemDef, MenuItem, ShopDef } from '@lw/game';

export const PACK = JP_PACK;
/** the pack id is the persistence key's middle part (`lw.game.<packId>.v1`) */
export const PACK_ID = PACK.id;

// Built on first use: the registries are filled by several owners, but all of them are loaded by the time a screen asks.
let index: { items: Map<string, ItemDef>; menu: Map<string, MenuItem>; shops: Map<string, ShopDef>; friends: Map<string, FriendDef> } | null = null;
const idx = () =>
  (index ??= {
    items: new Map(PACK.items.map((i) => [i.id, i])),
    menu: new Map(PACK.menu.map((m) => [m.id, m])),
    shops: new Map(PACK.shops.map((s) => [s.id, s])),
    friends: new Map(PACK.friends.map((f) => [f.id, f])),
  });

export const itemById = (id: string): ItemDef | undefined => idx().items.get(id);
export const menuItemById = (id: string): MenuItem | undefined => idx().menu.get(id);
export const shopById = (id: string): ShopDef | undefined => idx().shops.get(id);
export const friendById = (id: string): FriendDef | undefined => idx().friends.get(id);
export const beatById = (id: string): Beat | undefined => PACK.beats[id];
