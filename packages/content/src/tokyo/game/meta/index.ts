import type { ScenarioMeta } from '@lw/game';
import { CORE_META } from './meta-core';
import { STATION_META } from './meta-station';
import { DENKI_FUKU_META } from './meta-denki-fuku';
import { AIKO_MOTORS_META } from './meta-aiko-motors';
import { SOCIAL_META } from './meta-social';
import { CHAT_META } from './meta-chat';
import { JOBS_META } from './meta-jobs';
import { FRIENDS_META } from './meta-friends';
import { HEARTS_META } from './meta-hearts';
import { STORY_META } from './meta-story';

/** Registry rule (docs/GAME_DESIGN.md §15.1): one part file per owner, spread here. */
export const SCENARIO_META: ScenarioMeta[] = [
  ...CORE_META,
  ...STATION_META,
  ...DENKI_FUKU_META,
  ...AIKO_MOTORS_META,
  ...SOCIAL_META,
  ...CHAT_META,
  ...JOBS_META,
  ...FRIENDS_META,
  ...HEARTS_META,
  ...STORY_META,
];
