import type { BeatEffect, ScenarioMeta } from '@lw/game';

/**
 * Game wiring for hang-outs and home visits (Release 2 wave B1): pay, pocket, gate, steps. All seven pay hearts and AP (`pay: 'none'`);
 * the reducer counts a `hangout` talk (one per `BALANCE.hangout.everyDays` days, ♥3 or more) and a `home` visit (`visit home:<friend>`,
 * +25 AP), so the friend is `friendId`. The first completion hands over the reward (`effects`), exactly once:
 *   hang_mio_photo -> keepsake photo_mio          hang_yuki_jam -> keepsake stamp_card
 *   hang_kenji_cook -> keepsake kenji_recipe      hang_aiko_wagashi -> one g_wagashi
 *   home_mio -> keepsake photo_printed            home_aiko -> keepsake tea_cup + the cosmetic flag aiko_room_shown
 *   home_kenji -> keepsake hina_drawing           (every home also files cc_shoesoff, the card of the genkan)
 * The free 替え玉 of Kenji's hang-out is a keepsake (his recipe note), not a voucher: the shop would need a purchase hook for it, and the
 * daily free refill of his ♥4 perk (`kenji_kaedama`) already covers it. Goal step ids are asserted in `content/test/friends-visit.test.ts`.
 */

const keep = (id: string): BeatEffect => ({ t: 'keepsake', id });

interface Spec {
  id: string;
  friend: string;
  place: string;
  band: ScenarioMeta['band'];
  effects: BeatEffect[];
  culture?: string[];
}

const hang = (s: Spec): ScenarioMeta => ({
  id: s.id,
  kind: 'hangout',
  band: s.band,
  register: 'polite',
  pay: 'none',
  real: true,
  heart: 3,
  place: s.place,
  friendId: s.friend,
  pocket: [1, 2].map((n) => `p_${s.id}_${n}`),
  effects: s.effects,
  ...(s.culture ? { culture: s.culture } : {}),
});

/** the shared `home_visit` template: A2, polite, the genkan card, three pocket lines */
const home = (s: Omit<Spec, 'band' | 'place'>): ScenarioMeta => ({
  id: s.id,
  kind: 'home',
  band: 'A2',
  register: 'polite',
  pay: 'none',
  real: true,
  heart: 4,
  place: s.id,
  friendId: s.friend,
  pocket: [1, 2, 3].map((n) => `p_${s.id}_${n}`),
  culture: ['cc_shoesoff'],
  effects: [...s.effects, { t: 'culture', id: 'cc_shoesoff' }],
});

export const FRIENDS_META: ScenarioMeta[] = [
  hang({ id: 'hang_mio_photo', friend: 'mio', place: 'park', band: 'A1', effects: [keep('photo_mio')] }),
  hang({ id: 'hang_yuki_jam', friend: 'yuki', place: 'cafe', band: 'A2', effects: [keep('stamp_card')] }),
  hang({ id: 'hang_kenji_cook', friend: 'kenji', place: 'ramen', band: 'A2', effects: [keep('kenji_recipe')], culture: ['cc_itadakimasu'] }),
  hang({ id: 'hang_aiko_wagashi', friend: 'aiko', place: 'ono', band: 'A1', effects: [{ t: 'item', id: 'g_wagashi', qty: 1 }] }),
  home({ id: 'home_mio', friend: 'mio', effects: [keep('photo_printed')] }),
  home({ id: 'home_aiko', friend: 'aiko', effects: [keep('tea_cup'), { t: 'flag', id: 'aiko_room_shown' }] }),
  home({ id: 'home_kenji', friend: 'kenji', effects: [keep('hina_drawing')] }),
];
