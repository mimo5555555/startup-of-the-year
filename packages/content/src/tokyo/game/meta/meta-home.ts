import type { ScenarioMeta } from '@lw/game';

/**
 * Game wiring for the player's own room (Release 2 wave B2): pay, pocket, gate, shop, effects.
 *
 *  - `fuku_home`   Rin's second-hand furniture (shop `fukufuku`, slot `furniture`). A big piece is booked for the day of the slot `deliveryDay`
 *                  (the app passes `deliveryDay` on the purchase event) and arrives through the clock; a small one is handed over at once.
 *  - `aiko_viewing` the viewing at Ono-sō (adults) / the visit to the tea room next door (minors, session flag `minor`). It is a talk with Aiko (AP,
 *                  loop pay), sets the cosmetic flag `aiko_room_shown` itself on the first completion and files `cc_rent` (adults only: the card is `adultOnly`).
 *  - `aiko_contract` the contract (18+, after the viewing): slot `room` has the one option `ono`, sold by the shop `aiko` (cash only) as `home_room_ono`
 *                  at ¥60,000 = 敷金 30,000 + 前家賃 30,000. The purchase grants the item, whose effect sets `home.tier = 'ono'`.
 *  - `home_own_guest` the housewarming: a friend of ♥2 or more visits the player's own room; the learner is the host. The friend is the conversation's
 *                  character (so `friendId` is left to the host: `facts.characterId`). The first completion raises the story flag `housewarming`.
 */
const SHARED = { band: 'A2', register: 'polite', pay: 'full', real: true } as const;

export const HOME_META: ScenarioMeta[] = [
  {
    id: 'fuku_home',
    kind: 'shop',
    ...SHARED,
    place: 'fukufuku',
    pocket: ['p_fuku_home_1', 'p_fuku_home_2', 'p_fuku_home_3'],
    shop: {
      shopId: 'fukufuku',
      itemSlot: 'furniture',
      payStep: 'pay',
      // the item ids of §5.2 (defined in the item catalog)
      itemMap: { futon: 'futon_set', desk: 'desk_study', bookshelf: 'bookshelf', plant: 'plant_pothos', kotatsu: 'kotatsu', riceCooker: 'rice_cooker', lamp: 'paper_lamp' },
    },
  },
  {
    id: 'aiko_viewing',
    kind: 'talk',
    ...SHARED,
    place: 'ono',
    pocket: ['p_aiko_viewing_1', 'p_aiko_viewing_2', 'p_aiko_viewing_3'],
    culture: ['cc_rent'],
    effects: [{ t: 'flag', id: 'aiko_room_shown' }],
  },
  {
    id: 'aiko_contract',
    kind: 'shop',
    ...SHARED,
    place: 'ono',
    pocket: ['p_aiko_contract_1', 'p_aiko_contract_2', 'p_aiko_contract_3'],
    ageMin: 18,
    gate: { k: 'scenario', id: 'aiko_viewing', complete: true },
    // the lesson of the contract: saying the total of deposit and first month (checked by the game against the real quote)
    requiredIntents: ['aiko_contract:say_total'],
    shop: {
      shopId: 'aiko',
      itemSlot: 'room',
      payStep: 'pay',
      itemMap: { ono: 'home_room_ono' },
    },
  },
  {
    id: 'home_own_guest',
    kind: 'home',
    band: 'A2',
    register: 'polite',
    pay: 'none',
    real: true,
    heart: 2,
    place: 'flat',
    pocket: ['p_home_own_guest_1', 'p_home_own_guest_2', 'p_home_own_guest_3'],
    effects: [{ t: 'flag', id: 'housewarming' }],
  },
];
