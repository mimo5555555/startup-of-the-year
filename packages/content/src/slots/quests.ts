import type { SlotOption } from '../types';
import { opt } from './helpers';

void opt;

/** Slot lists for quests and goals. Slot names must be unique across all modules. */
export const QUESTS_SLOTS: Record<string, SlotOption[]> = {};
