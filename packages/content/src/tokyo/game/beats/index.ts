import type { Beat } from '@lw/game';
import { CORE_BEATS } from './beats-core';
import { FRIENDS_BEATS } from './beats-friends';
import { HEARTS_BEATS } from './beats-hearts';
import { STORY_BEATS } from './beats-story';

/** Registry rule (docs/GAME_DESIGN.md §15.1): one part file per owner, spread here. */
export const BEATS: Record<string, Beat> = {
  ...CORE_BEATS,
  ...FRIENDS_BEATS,
  ...HEARTS_BEATS,
  ...STORY_BEATS,
};
