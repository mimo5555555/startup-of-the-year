// "Opens in Chapter N" for a chapter that is played, "Opens when the story is finished" for Free Walk (chapter 9 is not a chapter of the
// story: Release 1 ends after Chapter 4, so no padlock may name it).
import { BALANCE } from '@lw/game';
import type { StringKey } from '../i18n';

type T = (key: StringKey, vars?: Record<string, string | number>) => string;

/** The padlock text for something that opens in chapter `n` (`key` is the chapter wording: 'dream.locked', 'quests.locked' or 'shop.opensIn'). */
export const opensIn = (t: T, key: 'dream.locked' | 'quests.locked' | 'shop.opensIn', n: number): string => (n >= BALANCE.freeWalkChapter ? t('dream.freeWalk') : t(key, { n }));
