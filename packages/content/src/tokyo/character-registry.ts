import type { Character } from '../types';
import { CORE_CHARACTERS } from './characters';
import { EXTRA_CHARACTERS } from './characters-extra';

export const CHARACTERS: Character[] = [...CORE_CHARACTERS, ...EXTRA_CHARACTERS];
export const characterById = (id: string) => CHARACTERS.find((c) => c.id === id);
