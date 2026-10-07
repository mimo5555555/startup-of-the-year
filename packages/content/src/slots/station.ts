import type { SlotOption } from '../types';
import { opt } from './helpers';

void opt;

/** Slot lists for the station, IC card and directions. Slot names must be unique across all modules. */
export const STATION_SLOTS: Record<string, SlotOption[]> = {};
