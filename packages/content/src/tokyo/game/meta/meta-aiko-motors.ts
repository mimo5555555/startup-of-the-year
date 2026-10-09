import type { ScenarioMeta } from '@lw/game';
import { JP_RULES } from '../economy';

/** Game wiring for aiko_* (3D, not released yet) and motors_* (3D-lite): pay, pocket, gate, shop, steps. Only the Motors entries are here. */
const REGISTRATION_FEE = JP_RULES.registrationFee as number;

export const AIKO_MOTORS_META: ScenarioMeta[] = [
  // browse the garage and decline politely: no purchase, so no `shop` block (and no yen: `pay` is still 'full' for the loop pay of the talk)
  {
    id: 'motors_visit',
    kind: 'talk',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'motors',
    culture: ['cc_refuse'],
  },
  {
    id: 'motors_bike',
    kind: 'shop',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    twist: true,
    place: 'motors',
    pocket: ['p_motors_1'],
    culture: ['cc_bikereg', 'cc_refuse'],
    shop: {
      shopId: 'motors',
      itemSlot: 'bikeModel',
      // the `goods` node (§5.6): the car air freshener, from the shared slot `giftItem`
      extraSlots: ['giftItem'],
      payStep: 'pay',
      // the item ids of §5.2 (defined in the item catalog by 3E)
      itemMap: { mamachari: 'bike_mamachari', helmet: 'bike_helmet', ebike: 'ebike', carFresh: 'g_carfresh' },
      // 防犯登録 (§5.4): a fee line of the quote for a bicycle that rides, never for the helmet (the amount is `rules.registrationFee`)
      fees: [{ id: 'registration', amount: REGISTRATION_FEE, when: 'bikeModel:mamachari,ebike' }],
    },
  },
  {
    id: 'motors_car',
    kind: 'shop',
    band: 'B1',
    register: 'keigo',
    pay: 'full',
    real: true,
    twist: false,
    place: 'motors',
    pocket: ['p_motors_2', 'p_motors_3'],
    culture: ['cc_shaken', 'cc_refuse'],
    ageMin: 18,
    // the trap and the one haggle (§4.4 rule 3): the lesson steps the objectives and the debrief look for
    requiredIntents: ['motors_car:ask_total', 'motors_car:haggle'],
    shop: {
      shopId: 'motors',
      itemSlot: 'carModel',
      payStep: 'pay',
      // the drive-away price is the item's price (body 148,000 + fees 50,000, 458,000 + 90,000): the fees are in the item, not added here
      itemMap: { used: 'car_kei_used', good: 'car_kei_good' },
    },
  },
];
