// The Berlin (German) game pack, Chapters 1-3 (German step 2). Every table is Berlin's own; the age profiles are the game's.
import type { GamePack } from '@lw/game';
import { JP_AGE_PROFILES } from '../../tokyo/game/economy';
import { DE_ITEMS, DE_MENU, DE_SHOPS } from './catalog';
import { DE_ECONOMY, DE_LANGUAGE, DE_RULES, DE_TAX, EUR } from './economy';
import { DE_FRIENDS, DE_INTERACTIONS, DE_SCENARIO_META } from './people';
import { DE_JOBS } from './jobs';
import { DE_BEATS, DE_CHAPTERS, DE_CULTURE, DE_DAILY, DE_DREAMS, DE_EPILOGUE, DE_TITLES, DE_WORD_TAGS } from './story';

export { DE_LANGUAGE, EUR } from './economy';

export const BERLIN_PACK: GamePack = {
  schema: 1,
  id: 'de',
  language: 'de',
  district: 'berlin',
  name: { en: 'Kreuzberg, Berlin', ar: 'كرويتسبرغ، برلين' },
  currency: EUR,
  economy: DE_ECONOMY,
  tax: DE_TAX,
  rules: DE_RULES,
  lang: DE_LANGUAGE,
  menu: DE_MENU,
  items: DE_ITEMS,
  shops: DE_SHOPS,
  fares: {},
  jobs: DE_JOBS,
  chapters: DE_CHAPTERS,
  dreams: DE_DREAMS,
  daily: DE_DAILY,
  beats: DE_BEATS,
  friends: DE_FRIENDS,
  interactions: DE_INTERACTIONS,
  scenarioMeta: DE_SCENARIO_META,
  pockets: {},
  wordTags: DE_WORD_TAGS,
  culture: DE_CULTURE,
  titles: DE_TITLES,
  ageProfiles: JP_AGE_PROFILES,
  // Chapters 1-3 are played, then Free Walk
  release: { lastChapter: 6, epilogue: DE_EPILOGUE },
};
