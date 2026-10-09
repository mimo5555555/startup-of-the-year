import type { ScenarioMeta } from '@lw/game';

/** Game wiring for denki_phone, fuku_clothes, fuku_home (3C): pay, pocket, gate, shop, steps. Only the Denki entry is here (3C-lite). */
export const DENKI_FUKU_META: ScenarioMeta[] = [
  {
    id: 'denki_phone',
    kind: 'shop',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    twist: true,
    place: 'denki',
    pocket: ['p_denki_1', 'p_denki_2', 'p_denki_3', 'p_denki_4'],
    culture: ['cc_tax', 'cc_taxfree'],
    shop: {
      shopId: 'denki',
      itemSlot: 'denkiItem',
      // the `goods` node (§5.6): the music CD, from the shared slot `giftItem`
      extraSlots: ['giftItem'],
      payStep: 'pay',
      // the item ids of §5.2 / §5.3 (defined in the item catalog by 3E)
      itemMap: { used: 'phone_used', pro: 'phone_pro', case: 'phone_case', tv: 'tv_small', musicCd: 'g_music_cd' },
    },
  },
];
