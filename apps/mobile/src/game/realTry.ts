// "Try it without chips" (docs/GAME_DESIGN.md §7.2 "No cliff", Release 2 wave C1): in Chapter 6 Hanako offers ONE shop conversation in Real mode (the chips
// hidden, paid x1.25 as usual), so the capstone of Chapter 7 is not a cliff. The first time the player starts a shop conversation that offers Real mode in
// Chapter 6, that start is held back and her beat `b_real_try` plays (it files the story flag `real_try_seen`); when the beat is over the held conversation
// starts in Real mode and files `real_try_done`, and everything after it is the ordinary Guided mode again. A reload between the beat and the
// conversation keeps the offer: the next shop conversation that offers Real mode opens in Real mode. The player may still switch the mode in Prepare;
// the try is only used up by a Real-mode conversation that actually starts, so a Guided one does not waste it.
import { REAL_TRY } from '@lw/content';
import { guidedFallbackOpen, type GamePack, type GameState } from '@lw/game';
import type { ConvoRequest } from '../ui';

export const REAL_TRY_BEAT = REAL_TRY.beat;
/** filed by the beat's own effect (`beats-story.ts`) */
export const REAL_TRY_FLAG = 'real_try_seen';
export const REAL_TRY_DONE = 'real_try_done';

/** Hanako has offered the try and it has not been used. */
export const realTryPending = (state: GameState): boolean => state.chapter.flags.includes(REAL_TRY_FLAG) && !state.chapter.flags.includes(REAL_TRY_DONE);

/** A shop conversation that offers Real mode: what the try is for. */
export function isRealShop(pack: GamePack, scenarioId: string): boolean {
  const meta = pack.scenarioMeta.find((m) => m.id === scenarioId);
  return meta?.kind === 'shop' && meta.real === true;
}

/** Whether this scenario opens in Real mode now because the try is pending. */
export const realTryFor = (pack: GamePack, state: GameState, scenarioId: string): boolean => realTryPending(state) && isRealShop(pack, scenarioId);

/** Whether Hanako should offer the try before this shop conversation: Chapter 6 (the last played chapter before Free Walk), not offered before, a shop that offers Real mode. */
export function realTryDue(pack: GamePack, state: GameState, scenarioId: string): boolean {
  const n = state.chapter.n;
  const flags = state.chapter.flags;
  return n >= REAL_TRY.fromChapter && n <= 8 && !flags.includes(REAL_TRY_FLAG) && !flags.includes(REAL_TRY_DONE) && isRealShop(pack, scenarioId);
}

/** The conversation held back while the beat plays (module state: a reload drops it, and the pending flag then carries the offer). */
let held: ConvoRequest | null = null;
export const holdForTry = (req: ConvoRequest): void => {
  held = req;
};
export const takeHeld = (): ConvoRequest | null => {
  const r = held;
  held = null;
  return r;
};

// ---------------------------------------------------------------------------------------------------------------
// The capstone (matsuri_speech, Chapter 7, Release 2 wave C2): Real mode by construction, one Guided run for a player who never used Real mode
// ---------------------------------------------------------------------------------------------------------------

/** Whether a scenario is the capstone (`ScenarioMeta.capstone`). */
export const isCapstone = (pack: GamePack, scenarioId: string): boolean => !!pack.scenarioMeta.find((m) => m.id === scenarioId)?.capstone;

/**
 * The mode a capstone starts in: Guided only when asked for AND the one-time fallback is open (the player has never used Real mode and has not
 * had the fallback yet); otherwise Real. Not a capstone: the asked mode, unchanged.
 */
export function capstoneMode(pack: GamePack, state: GameState, scenarioId: string, asked: 'guided' | 'real' | undefined): 'guided' | 'real' | undefined {
  if (!isCapstone(pack, scenarioId)) return asked;
  return asked === 'guided' && guidedFallbackOpen(pack, state, scenarioId) ? 'guided' : 'real';
}
