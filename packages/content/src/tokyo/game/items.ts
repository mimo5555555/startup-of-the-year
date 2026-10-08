import type { ItemDef } from '@lw/game';

/**
 * Pack data: the catalog (docs/GAME_DESIGN.md §5.2). 2G seeds it with the station's one item; 3E extends it with everything else.
 * IC top-ups and the refund are transfers between pockets (§4.1), not catalog items, so they have no row here.
 */
export const ITEMS: ItemDef[] = [
  {
    id: 'ic_card',
    name: { ja: 'ICカード', reading: 'アイシーカード', en: 'IC card', ar: 'بطاقة IC للمواصلات' },
    // the ¥500 deposit: the card stays yours, only its balance is refundable (§4.1)
    price: 500,
    cat: 'transport',
    shop: 'station',
    gate: { ch: 1 },
    // tap to ride and pay at the konbini, the café, vending machines and the station (§4.1)
    fx: [{ t: 'feature', id: 'ic' }],
    tags: ['ic', 'transport'],
    once: true,
  },
];
