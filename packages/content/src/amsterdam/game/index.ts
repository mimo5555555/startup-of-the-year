// The Amsterdam (Dutch) game pack, Chapters 1-3 (Dutch step 2). Every table is Amsterdam's own; the age profiles are the game's.
import type { GamePack } from '@lw/game';
import { JP_AGE_PROFILES } from '../../tokyo/game/economy';
import { NL_ITEMS, NL_MENU, NL_SHOPS } from './catalog';
import { EUR_NL, NL_ECONOMY, NL_LANGUAGE, NL_RULES, NL_TAX } from './economy';
import { NL_FRIENDS, NL_INTERACTIONS, NL_SCENARIO_META } from './people';
import { NL_JOBS } from './jobs';
import { NL_BEATS, NL_CHAPTERS, NL_CULTURE, NL_DAILY, NL_DREAMS, NL_EPILOGUE, NL_TITLES, NL_WORD_TAGS } from './story';

export { EUR_NL, NL_LANGUAGE } from './economy';

export const AMSTERDAM_PACK: GamePack = {
  schema: 1,
  id: 'nl',
  language: 'nl',
  district: 'amsterdam',
  name: { en: 'De Pijp, Amsterdam', ar: 'دي بايب، أمستردام' },
  currency: EUR_NL,
  economy: NL_ECONOMY,
  tax: NL_TAX,
  rules: NL_RULES,
  lang: NL_LANGUAGE,
  menu: NL_MENU,
  items: NL_ITEMS,
  shops: NL_SHOPS,
  fares: {},
  jobs: NL_JOBS,
  chapters: NL_CHAPTERS,
  dreams: NL_DREAMS,
  daily: NL_DAILY,
  beats: NL_BEATS,
  friends: NL_FRIENDS,
  interactions: NL_INTERACTIONS,
  scenarioMeta: NL_SCENARIO_META,
  pockets: {},
  wordTags: NL_WORD_TAGS,
  culture: NL_CULTURE,
  titles: NL_TITLES,
  ageProfiles: JP_AGE_PROFILES,
  release: { lastChapter: 6, epilogue: NL_EPILOGUE },
};
