// The Madrid (Spanish) game pack, Chapters 1-3 (Spanish step 2) and 4-6 (Spanish step 4). Every table is Madrid's own; the age profiles
// are the game's.
import type { GamePack } from '@lw/game';
import { JP_AGE_PROFILES } from '../../tokyo/game/economy';
import { ES_ITEMS, ES_MENU, ES_SHOPS } from './catalog';
import { ES_ECONOMY, ES_LANGUAGE, ES_RULES, ES_TAX, EUR_ES } from './economy';
import { ES_FRIENDS, ES_INTERACTIONS, ES_SCENARIO_META } from './people';
import { ES_BEATS, ES_CHAPTERS, ES_CULTURE, ES_DAILY, ES_DREAMS, ES_EPILOGUE, ES_TITLES, ES_WORD_TAGS } from './story';

export { ES_LANGUAGE, EUR_ES } from './economy';

export const MADRID_PACK: GamePack = {
  schema: 1,
  id: 'es',
  language: 'es',
  district: 'madrid',
  name: { en: 'Lavapiés, Madrid', ar: 'لابابييس، مدريد' },
  currency: EUR_ES,
  economy: ES_ECONOMY,
  tax: ES_TAX,
  rules: ES_RULES,
  lang: ES_LANGUAGE,
  menu: ES_MENU,
  items: ES_ITEMS,
  shops: ES_SHOPS,
  fares: {},
  jobs: [],
  chapters: ES_CHAPTERS,
  dreams: ES_DREAMS,
  daily: ES_DAILY,
  beats: ES_BEATS,
  friends: ES_FRIENDS,
  interactions: ES_INTERACTIONS,
  scenarioMeta: ES_SCENARIO_META,
  pockets: {},
  wordTags: ES_WORD_TAGS,
  culture: ES_CULTURE,
  titles: ES_TITLES,
  ageProfiles: JP_AGE_PROFILES,
  // Chapters 1-6 are played, then Free Walk
  release: { lastChapter: 6, epilogue: ES_EPILOGUE },
};
