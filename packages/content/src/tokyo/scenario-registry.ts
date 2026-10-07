import type { Scenario } from '../types';
import { CORE_SCENARIOS } from './scenarios';
import { SHOPS_SCENARIOS } from './scenarios-shops';
import { DENKI_SCENARIOS } from './scenarios-denki';
import { FUKU_SCENARIOS } from './scenarios-fuku';
import { AIKO_SCENARIOS } from './scenarios-aiko';
import { MOTORS_SCENARIOS } from './scenarios-motors';
import { SOCIAL_SCENARIOS } from './scenarios-social';
import { CHAT_SCENARIOS } from './scenarios-chat';
import { JOBS_SCENARIOS } from './scenarios-jobs';
import { FRIENDS_SCENARIOS } from './scenarios-friends';
import { HEARTS_SCENARIOS } from './scenarios-hearts';
import { STORY_SCENARIOS } from './scenarios-story';

export const SCENARIOS: Scenario[] = [
  ...CORE_SCENARIOS,
  ...SHOPS_SCENARIOS,
  ...DENKI_SCENARIOS,
  ...FUKU_SCENARIOS,
  ...AIKO_SCENARIOS,
  ...MOTORS_SCENARIOS,
  ...SOCIAL_SCENARIOS,
  ...CHAT_SCENARIOS,
  ...JOBS_SCENARIOS,
  ...FRIENDS_SCENARIOS,
  ...HEARTS_SCENARIOS,
  ...STORY_SCENARIOS,
];
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);
/** Every scenario a character hosts (a character may own several; `Character.scenarioId` is only the default). */
export const scenariosOf = (characterId: string) => SCENARIOS.filter((s) => s.characterId === characterId);
