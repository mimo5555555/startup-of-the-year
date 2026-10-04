import type { SlotOption } from '../types';
import { BASE_SLOTS } from './base';
import { SHOP_SLOTS } from './shop';
import { SOCIAL_SLOTS } from './social';
import { JOBS_SLOTS } from './jobs';

export { opt } from './helpers';

const MODULES: Array<[string, Record<string, SlotOption[]>]> = [
  ['base', BASE_SLOTS],
  ['shop', SHOP_SLOTS],
  ['social', SOCIAL_SLOTS],
  ['jobs', JOBS_SLOTS],
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
