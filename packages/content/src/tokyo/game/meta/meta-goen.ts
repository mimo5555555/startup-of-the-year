import type { ScenarioMeta } from '@lw/game';

/**
 * Game wiring for Goen stage 1 (docs/GOEN.md): the shrine's wish and the three conversations of the Kyoto Journey.
 *
 * `shrine_wish` (the priest): the speaking moment of the wish ritual, a ritual that pays nothing (`pay: 'none'`); the coin toss has already spent
 * the Goen. `kyoto_*` (kind `trip`, place `kyoto`): ordinary conversations that pay yen for speaking like any other, open while the Journey is
 * owned (`gate`); the temple and the café sell through the `charge` hook (a main slot and one extra on the same bill, cash at the temple).
 */
const JOURNEY = { k: 'goen', item: 'journey_kyoto' } as const;

export const GOEN_META: ScenarioMeta[] = [
  {
    id: 'shrine_wish',
    kind: 'talk',
    band: 'A1',
    register: 'polite',
    pay: 'none',
    real: true,
    place: 'park',
    pocket: ['p_shrine_wish_1', 'p_shrine_wish_2'],
    culture: ['cc_goen', 'cc_sanpai'],
  },
  {
    id: 'kyoto_ryokan',
    kind: 'trip',
    band: 'A2',
    register: 'keigo',
    pay: 'full',
    real: true,
    place: 'kyoto',
    gate: JOURNEY,
    pocket: ['p_kyoto_ryokan_1', 'p_kyoto_ryokan_2', 'p_kyoto_ryokan_3'],
  },
  {
    id: 'kyoto_temple',
    kind: 'trip',
    band: 'A2',
    register: 'keigo',
    pay: 'full',
    real: true,
    place: 'kyoto',
    gate: JOURNEY,
    pocket: ['p_kyoto_temple_1', 'p_kyoto_temple_2', 'p_kyoto_temple_3'],
    culture: ['cc_refuse'],
    shop: {
      shopId: 'kyoto_temple',
      itemSlot: 'omamori',
      extraSlots: ['goshuin'],
      payStep: 'pay',
      itemMap: { kenko: 'kyoto_temple:kenko', gakugyo: 'kyoto_temple:gakugyo', kotsu: 'kyoto_temple:kotsu', goshuin: 'kyoto_temple:goshuin' },
    },
  },
  {
    id: 'kyoto_matcha',
    kind: 'trip',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'kyoto',
    gate: JOURNEY,
    pocket: ['p_kyoto_matcha_1', 'p_kyoto_matcha_2', 'p_kyoto_matcha_3'],
    shop: {
      shopId: 'kyoto_cafe',
      itemSlot: 'matcha',
      extraSlots: ['kyotogift'],
      payStep: 'pay',
      itemMap: { set: 'kyoto_cafe:set', usucha: 'kyoto_cafe:usucha', yatsuhashi: 'g_yatsuhashi' },
    },
  },
];
