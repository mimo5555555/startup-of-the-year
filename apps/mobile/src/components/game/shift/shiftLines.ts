// The boss's lines on the Shift screen (docs/GAME_DESIGN.md §9.1-§9.2): refusal, feedback bands, retry and rank-up, in the language being
// learned (`SHIFT_TALK` in @lw/content: Tanaka's Japanese, Murat's German, Femke's Dutch). Every line has English and Arabic; its words are
// in the dictionary of its language, so the screen shows them as tappable words like any other line.
import type { Line, ShiftBand } from '@lw/content';
import { TALK } from './shiftLogic';

export const REFUSE: Line = TALK.refuse;
export const RETRY: Line = TALK.retry;

export type Band = ShiftBand;
export const BAND_LINES: Record<Band, Line> = TALK.bands;

/** Rank names (rank 0 trainee ... 4 the boss's stand-in): in the language being learned, with the Japanese reading, as on the result card. */
export const RANK_JA: Array<{ ja: string; reading: string }> = TALK.ranks;

/** The rank-up line for reaching rank 1-4 (index = rank). */
export const RANK_UP: Array<Line | null> = TALK.rankUp;

/** What the welcome button says: いらっしゃいませ, Hallo!, Hallo, welkom! */
export const WELCOME_JA = TALK.welcome;
