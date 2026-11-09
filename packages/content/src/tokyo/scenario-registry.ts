import type { Scenario } from '../types';
import { CORE_SCENARIOS } from './scenarios';
import { SHOPS_SCENARIOS } from './scenarios-shops';
import { DENKI_SCENARIOS } from './scenarios-denki';
import { FUKU_SCENARIOS } from './scenarios-fuku';
import { HOBBY_SCENARIOS } from './scenarios-hobby';
import { ARCADE_SCENARIOS } from './scenarios-arcade';
import { KARAOKE_SCENARIOS } from './scenarios-karaoke';
import { SENTO_SCENARIOS } from './scenarios-sento';
import { FUKU_HOME_SCENARIOS } from './scenarios-fuku-home';
import { HOME_SCENARIOS } from './scenarios-home';
import { AIKO_SCENARIOS } from './scenarios-aiko';
import { MOTORS_SCENARIOS } from './scenarios-motors';
import { SOCIAL_SCENARIOS } from './scenarios-social';
import { CHAT_SCENARIOS } from './scenarios-chat';
import { JOBS_SCENARIOS } from './scenarios-jobs';
import { FRIENDS_SCENARIOS } from './scenarios-friends';
import { HEARTS_SCENARIOS } from './scenarios-hearts';
import { STORY_SCENARIOS } from './scenarios-story';
import { GOEN_SCENARIOS } from './scenarios-goen';
import { KYOTO_SCENARIOS } from './scenarios-kyoto';
import { withRegulars } from './regulars';
import { withSmallTalk } from './smalltalk';

export const SCENARIOS: Scenario[] = [
  ...CORE_SCENARIOS,
  ...SHOPS_SCENARIOS,
  ...DENKI_SCENARIOS,
  ...FUKU_SCENARIOS,
  ...HOBBY_SCENARIOS,
  ...ARCADE_SCENARIOS,
  ...KARAOKE_SCENARIOS,
  ...SENTO_SCENARIOS,
  ...FUKU_HOME_SCENARIOS,
  ...HOME_SCENARIOS,
  ...AIKO_SCENARIOS,
  ...MOTORS_SCENARIOS,
  ...SOCIAL_SCENARIOS,
  ...CHAT_SCENARIOS,
  ...JOBS_SCENARIOS,
  ...FRIENDS_SCENARIOS,
  ...HEARTS_SCENARIOS,
  ...STORY_SCENARIOS,
  ...GOEN_SCENARIOS,
  ...KYOTO_SCENARIOS,
  // a shop's opening node also greets a regular, asks about the last purchase (tokyo/regulars.ts) and makes small talk (tokyo/smalltalk.ts)
]
  .map(withRegulars)
  .map(withSmallTalk);
export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id);
/** Every scenario a character hosts (a character may own several; `Character.scenarioId` is only the default). */
export const scenariosOf = (characterId: string) => SCENARIOS.filter((s) => s.characterId === characterId);
