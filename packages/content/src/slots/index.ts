import type { SlotOption } from '../types';
import { BASE_SLOTS } from './base';
import { SHOP_SLOTS } from './shop';
import { STATION_SLOTS } from './station';
import { QUESTS_SLOTS } from './quests';
import { SHOP_DENKI_SLOTS } from './shop-denki';
import { SHOP_FUKU_SLOTS } from './shop-fuku';
import { SHOP_AIKO_SLOTS } from './shop-aiko';
import { SHOP_MOTORS_SLOTS } from './shop-motors';
import { SOCIAL_SLOTS } from './social';
import { SOCIAL_CHAT_SLOTS } from './social-chat';
import { SOCIAL_FRIENDS_SLOTS } from './social-friends';
import { SOCIAL_HEARTS_SLOTS } from './social-hearts';
import { JOBS_SLOTS } from './jobs';
import { CULTURE_SLOTS } from './culture';

export { opt } from './helpers';

const MODULES: Array<[string, Record<string, SlotOption[]>]> = [
  ['base', BASE_SLOTS],
  ['shop', SHOP_SLOTS],
  ['station', STATION_SLOTS],
  ['quests', QUESTS_SLOTS],
  ['shop-denki', SHOP_DENKI_SLOTS],
  ['shop-fuku', SHOP_FUKU_SLOTS],
  ['shop-aiko', SHOP_AIKO_SLOTS],
  ['shop-motors', SHOP_MOTORS_SLOTS],
  ['social', SOCIAL_SLOTS],
  ['social-chat', SOCIAL_CHAT_SLOTS],
  ['social-friends', SOCIAL_FRIENDS_SLOTS],
  ['social-hearts', SOCIAL_HEARTS_SLOTS],
  ['jobs', JOBS_SLOTS],
  ['culture', CULTURE_SLOTS],
];

export const SLOTS: Record<string, SlotOption[]> = {};
/** Which module defined each slot (the content tests assert there are no clashes). */
export const SLOT_OWNERS: Record<string, string[]> = {};
for (const [mod, slots] of MODULES) {
  for (const [name, options] of Object.entries(slots)) {
    (SLOT_OWNERS[name] ??= []).push(mod);
    if (!SLOTS[name]) SLOTS[name] = options;
  }
}

export function slotOption(slot: string, id: string): SlotOption | undefined {
  return SLOTS[slot]?.find((o) => o.id === id);
}
