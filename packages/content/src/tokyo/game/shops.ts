import type { ShopDef } from '@lw/game';
import { STATION_SHOPS } from './fares';
import { MENU } from './menu';

/** Pack data: shops and what each sells (3E). */

/** Everything on the menu of a shop (the consumables sold in its conversation). */
const menuOf = (shop: string): string[] => MENU.filter((m) => m.shop === shop).map((m) => m.id);

// The three shops of the refitted conversations (2D). 3E extends this table with the goods shops, the vending machines and the station.
export const SHOPS: ShopDef[] = [
  { id: 'cafe', placeId: 'cafe', name: { en: 'Café', ar: 'المقهى' }, openChapter: 1, surface: 'world', register: 'polite', pay: ['cash', 'card', 'ic'], sells: menuOf('cafe') },
  { id: 'konbini', placeId: 'konbini', name: { en: 'Convenience store', ar: 'المتجر الصغير' }, openChapter: 1, surface: 'world', register: 'polite', pay: ['cash', 'card', 'ic'], points: true, sells: menuOf('konbini') },
  { id: 'ramen', placeId: 'ramen', name: { en: 'Ramen shop', ar: 'مطعم الرامن' }, openChapter: 1, surface: 'world', register: 'polite', pay: ['cash', 'card'], sells: menuOf('ramen') },
  // the station counter (the IC card) and the vending machines: without them the pack cannot price or charge a card or a drink
  ...STATION_SHOPS,
];
