import type { SlotOption } from '../types';
import { opt } from './helpers';

void opt;

/** Slot lists for the jobs module. Slot names must be unique across all modules. */
export const JOBS_SLOTS: Record<string, SlotOption[]> = {};
