import type { GamePack } from '@lw/game';
// Type-only import: @lw/game never imports @lw/content, and this file adds no runtime dependency on it.
import { JP_AGE_PROFILES, JP_CURRENCY, JP_ECONOMY, JP_RULES, JP_TAX } from './economy';
import { JP_LANGUAGE } from './jp-language';
import { MENU } from './menu';
import { FARES } from './fares';
import { INTERACTIONS } from './interactions';
import { RELEASED_CHAPTERS, RELEASE_CLOSING, RELEASE_LAST_CHAPTER } from './chapters';
import { RELEASED_DREAMS } from './dreams';
import { DAILY } from './daily';
import { WORD_TAGS } from './wordTags';
import { ITEMS } from './items';
import { SHOPS } from './shops';
import { FRIENDS } from './friends';
import { KEEPSAKES } from './gifts';
import { JOBS } from './jobs';
import { CULTURE } from './culture';
import { TITLES } from './titles';
import { POCKETS } from './pockets';
import { SCENARIO_META } from './meta';
import { BEATS } from './beats';

/**
 * A shift row whose job is not in the pack is left out of the released table (Release 1 built the konbini shift only; the café and the station
 * desk joined in Release 2 wave C1, so `yuki_shift` and `sato_shift` show now), so the pack validates at level 4 and no dead row can ever show.
 */
const REGISTERED_SCENARIOS = new Set(SCENARIO_META.map((m) => m.id));
/** Hang-out rows (`<friend>_hang`) and home-visit rows (`home_<friend>`) appear only while their scenario is registered (Release 2 wave B1). */
const FRIEND_VISIT_ROW = /^(?:.+_hang|home_.+)$/;
const RELEASED_INTERACTIONS: GamePack['interactions'] = Object.fromEntries(
  Object.entries(INTERACTIONS).map(([who, rows]) => [
    who,
    rows.filter((r) => (!r.jobId || JOBS.some((j) => j.id === r.jobId)) && (!FRIEND_VISIT_ROW.test(r.id) || (!!r.scenarioId && REGISTERED_SCENARIOS.has(r.scenarioId)))),
  ]),
);

/** The Sakura-chō (Japan) game pack. Every table is a registry owned part by part (docs/GAME_DESIGN.md §15.2). */
export const JP_PACK: GamePack = {
  schema: 1,
  id: 'jp',
  language: 'ja',
  district: 'tokyo',
  name: { en: 'Sakura-chō', ar: 'ساكورا-تشو' },
  currency: JP_CURRENCY,
  economy: JP_ECONOMY,
  tax: JP_TAX,
  rules: JP_RULES,
  lang: JP_LANGUAGE,
  menu: MENU,
  items: ITEMS,
  shops: SHOPS,
  fares: FARES,
  jobs: JOBS,
  // Release 2 wave C2 plays the whole story, chapters 1-8, then Free Walk (docs/RELEASE_1.md, RELEASE_2.md); the Dream picker offers the dreams that can be finished with it
  chapters: RELEASED_CHAPTERS,
  dreams: RELEASED_DREAMS,
  daily: DAILY,
  beats: BEATS,
  friends: FRIENDS,
  interactions: RELEASED_INTERACTIONS,
  scenarioMeta: SCENARIO_META,
  pockets: POCKETS,
  wordTags: WORD_TAGS,
  culture: CULTURE,
  titles: TITLES,
  ageProfiles: JP_AGE_PROFILES,
  keepsakes: KEEPSAKES,
  // the closing of the last played chapter: Chapter 8's own ending (Hanako reads the Letter back) now that the whole story is released
  release: { lastChapter: RELEASE_LAST_CHAPTER, epilogue: RELEASE_CLOSING },
};
