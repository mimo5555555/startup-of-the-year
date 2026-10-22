import type { ScenarioMeta } from '@lw/game';

/** Game wiring for denki_phone, fuku_clothes, fuku_home (3C): pay, pocket, gate, shop, steps. The Denki entry (3C-lite) and the Fuku-Fuku clothes entry (A2); `fuku_home` (furniture) is not in this release. */
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
  {
    id: 'fuku_clothes',
    kind: 'shop',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    twist: true,
    place: 'fukufuku',
    pocket: ['p_fuku_1', 'p_fuku_2', 'p_fuku_3', 'p_fuku_4'],
    culture: ['cc_refuse'],
    shop: {
      shopId: 'fukufuku',
      itemSlot: 'clothes',
      // the `goods` node (§5.6): the plush toy and the guitar pick, from the shared slot `giftItem`
      extraSlots: ['giftItem'],
      payStep: 'pay',
      // the item ids of §5.2 / §5.3 (defined in the item catalog by A3); the yukata is sold from wave C2 (the festival)
      itemMap: {
        tee: 'tee_basic',
        cap: 'cap',
        hoodie: 'hoodie',
        jeans: 'jeans',
        sneakers: 'sneakers',
        jacket: 'jacket_winter',
        glasses: 'glasses_round',
        backpack: 'backpack',
        suit: 'suit_set',
        yukata: 'yukata',
        plush: 'g_plush',
        guitarPick: 'g_guitar_pick',
      },
    },
  },
];
