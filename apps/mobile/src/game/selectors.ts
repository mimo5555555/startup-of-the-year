// Pure reads that join the two stores: the v1 store (vocabulary, streak, profile) and the game state (docs/GAME_DESIGN.md §14.5).
// The hooks in hooks.ts call these; the bridge calls them before every `reduce`.
import {
  BALANCE,
  activeDreamProgress,
  chapterStatus,
  currentChapter,
  derivedFlags,
  disclosure,
  hearts,
  nextBestGoal,
  type ChapterDef,
  type ChapterStatus,
  type DerivedFlags,
  type Disclosure,
  type DreamProgress,
  type GameState,
  type GameView,
  type NextGoal,
} from '@lw/game';
import { PACK } from './pack';
import type { Profile, VocabItem } from '../store';

/** ts-fsrs `State.Review`: the card has graduated from learning (the library's enum is not re-exported by @lw/core). */
const FSRS_REVIEW = 2;

/** The slice of the v1 store `GameView` is built from. */
export interface LegacySlice {
  vocab: VocabItem[];
  discovered: string[];
  lessonsDone: string[];
  streak: { days: number };
  profile: Profile | null;
}

/** Profile the view falls back to before onboarding finishes (nothing reads it then; the bridge does not dispatch without a profile). */
const NO_PROFILE: GameView['profile'] = { age: 'adults', goal: 'casual', level: 'A1', createdAt: '' };

/** Read-only data from the v1 store for the reducer (§14.5 `GameView`). Never persisted. */
export function gameView(s: LegacySlice, now: number = Date.now()): GameView {
  const known = new Set<string>();
  const reviewedKeys = new Set<string>();
  const reviewedSurfaces = new Set<string>();
  let total = 0;
  let due = 0;
  for (const v of s.vocab) {
    if (v.source !== 'starter') total++;
    if (new Date(v.card.due).getTime() <= now) due++;
    if (v.card.reps >= 1) {
      reviewedKeys.add(v.id);
      reviewedSurfaces.add(v.s);
    }
    if (v.card.state === FSRS_REVIEW && v.card.stability >= BALANCE.knownStability) known.add(v.key ?? v.s);
  }
  const p = s.profile;
  return {
    vocab: { total, known, dueCount: due, reviewedKeys, reviewedSurfaces },
    discovered: s.discovered,
    lessonsDone: s.lessonsDone,
    streakDays: s.streak.days,
    profile: p ? { age: p.age, goal: p.goal, level: p.level, createdAt: p.createdAt } : NO_PROFILE,
  };
}

export const walletOf = (g: GameState) => g.wallet;

/** The HUD tracker target, kept on `lockId` while that goal is still open (§11.7). */
export const trackerGoal = (g: GameState, view: GameView, lockId?: string | null): NextGoal | null => nextBestGoal(PACK, g, view, lockId);

export const chapterOf = (g: GameState): ChapterDef | null => currentChapter(PACK, g);
export const chapterProgress = (g: GameState, view: GameView): ChapterStatus => chapterStatus(PACK, g, view);
export const flagsOf = (g: GameState): DerivedFlags => derivedFlags(PACK, g);
export const disclosureOf = (g: GameState, view: GameView): Disclosure => disclosure(PACK, g, view);
export const dreamOf = (g: GameState, view: GameView): DreamProgress | null => activeDreamProgress(PACK, g, view);
export const heartsOf = (g: GameState, friendId: string): number => hearts(g, friendId);
