// React hooks over the game store (docs/GAME_DESIGN.md §14.5). They only read; changes go through `bridge.dispatch`.
import { useEffect, useMemo } from 'react';
import type { ChapterDef, ChapterStatus, DerivedFlags, Disclosure, DreamProgress, GameView, NextGoal, WalletState } from '@lw/game';
import { useStore } from '../store';
import { useUi } from '../ui';
import { useGame, type GameStore } from './gameStore';
import { chapterOf, chapterProgress, disclosureOf, dreamOf, flagsOf, gameView, heartsOf, trackerGoal } from './selectors';

/** The whole game state (re-renders on every change; prefer the narrower hooks below). A GameStore is a GameState plus two actions. */
export const useGameState = (): GameStore => useGame();

/** True once `bridge.init` has hydrated and seeded the game store; nothing that needs `GameView` may render before. */
export const useGameReady = (): boolean => useGame((s) => s.hydrated);

/** Read-only data from the v1 store for the pure helpers (`nextBestGoal`, `disclosure`...). */
export function useGameView(): GameView {
  const vocab = useStore((s) => s.vocab);
  const discovered = useStore((s) => s.discovered);
  const lessonsDone = useStore((s) => s.lessonsDone);
  const streak = useStore((s) => s.streak);
  const profile = useStore((s) => s.profile);
  return useMemo(() => gameView({ vocab, discovered, lessonsDone, streak, profile }), [vocab, discovered, lessonsDone, streak, profile]);
}

export const useWallet = (): WalletState => useGame((s) => s.wallet);

/** Hearts of one friend (0..5), derived from its AP. */
export const useHearts = (friendId: string): number => useGame((s) => heartsOf(s, friendId));

export const useDevMode = (): boolean => useGame((s) => s.flags.dev === true);

/** The tracker card's target: the next best goal, kept on the same goal until it is done or the day changes (§11.7). */
export function useTracker(): NextGoal | null {
  const game = useGameState();
  const view = useGameView();
  const lock = useUi((s) => s.trackerLock);
  const day = game.clock.dayIndex;
  const lockId = lock && lock.day === day ? lock.id : null;
  const goal = useMemo(() => trackerGoal(game, view, lockId), [game, view, lockId]);
  const goalId = goal?.id ?? null;
  useEffect(() => {
    if (goalId && goalId !== lockId) useUi.getState().lockTracker({ id: goalId, day });
  }, [goalId, lockId, day]);
  return goal;
}

/** The current chapter (null at Free Walk) and how far along it is. */
export function useChapter(): { def: ChapterDef | null; status: ChapterStatus } {
  const game = useGameState();
  const view = useGameView();
  return useMemo(() => ({ def: chapterOf(game), status: chapterProgress(game, view) }), [game, view]);
}

/** What the HUD and the debrief may show now (§2.5). */
export function useDisclosure(): Disclosure {
  const game = useGameState();
  const view = useGameView();
  return useMemo(() => disclosureOf(game, view), [game, view]);
}

export function useDerivedFlags(): DerivedFlags {
  const game = useGameState();
  return useMemo(() => flagsOf(game), [game]);
}

/** The tracked dream's progress, or null when none is tracked yet. */
export function useDream(): DreamProgress | null {
  const game = useGameState();
  const view = useGameView();
  return useMemo(() => dreamOf(game, view), [game, view]);
}
