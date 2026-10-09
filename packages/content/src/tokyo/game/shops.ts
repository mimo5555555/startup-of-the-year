import type { ShopDef } from '@lw/game';
import { releasedGate } from './chapters';
import { STATION_SHOPS } from './fares';
import { ITEMS } from './items';
import { MENU } from './menu';

/** Pack data: shops and what each sells (3E). Opening chapters are D36 gates: `chapter.n >= openChapter` (§4.5). */

/** Everything on the menu of a shop (the consumables sold in its conversation). */
const menuOf = (shop: string): string[] => MENU.filter((m) => m.shop === shop).map((m) => m.id);
/** The catalog items a shop sells (`items.ts` names the shop of each item, so the two tables cannot drift apart). */
const itemsOf = (shop: string): string[] => ITEMS.filter((i) => i.shop === shop).map((i) => i.id);

export const SHOPS: ShopDef[] = [
  { id: 'cafe', placeId: 'cafe', name: { en: 'Café', ar: 'المقهى' }, openChapter: 1, surface: 'world', register: 'polite', pay: ['cash', 'card', 'ic'], sells: menuOf('cafe') },
  // the konbini also sells the presents of its `goods` node (chocolate, manga, game card, §5.3, §5.6)
  {
    id: 'konbini',
    placeId: 'konbini',
    name: { en: 'Convenience store', ar: 'المتجر الصغير' },
    openChapter: 1,
    surface: 'world',
    register: 'polite',
    pay: ['cash', 'card', 'ic'],
    points: true,
    sells: [...menuOf('konbini'), ...itemsOf('konbini')],
  },
  { id: 'ramen', placeId: 'ramen', name: { en: 'Ramen shop', ar: 'مطعم الرامن' }, openChapter: 1, surface: 'world', register: 'polite', pay: ['cash', 'card'], sells: menuOf('ramen') },
  // the station counter (the IC card) and the vending machines: without them the pack cannot price or charge a card or a drink
  ...STATION_SHOPS,
  // Hikari Denki opens when Chapter 4 begins (the phone is the story's one saving goal, §4.5): cash and card, no IC; Sakura Points
  {
    id: 'denki',
    placeId: 'denki',
    name: { en: 'Hikari Denki', ar: 'هيكاري دنكي' },
    openChapter: 4,
    surface: 'world',
    register: 'polite',
    pay: ['cash', 'card'],
    points: true,
    sells: itemsOf('denki'),
  },
  // Nakamura Motors: the design opens it with Chapter 5 and the cars with Free Walk; this release has no Chapter 5, so the whole garage
  // opens at Free Walk (docs/RELEASE_1.md). Before that the world shows the shutter and the sheet explains when it opens.
  {
    id: 'motors',
    placeId: 'motors',
    name: { en: 'Nakamura Motors', ar: 'ورشة ناكامورا' },
    openChapter: releasedGate(5),
    surface: 'world',
    register: 'polite',
    pay: ['cash', 'card'],
    sells: itemsOf('motors'),
  },
];
