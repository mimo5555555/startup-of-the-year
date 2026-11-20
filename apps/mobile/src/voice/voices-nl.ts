// The recorded Dutch voices of Amsterdam's cast and the narrator (chips, words, model lines): open voices for Piper, each character
// set apart by a little pitch and pace (tools/voice/generate-nl.mjs). Filled in with the recordings (Dutch step 2).
import { NARRATOR } from './voices';

export interface NlVoice {
  /** Piper model: nl_NL-<model>.onnx (or nl_BE-) */
  model: string;
  /** pitch factor (1 = the voice as recorded; 0.94 is about a semitone lower) */
  pitch: number;
  /** pace factor (1.1 = 10 % faster) */
  speed: number;
}

export const NL_VOICES: Record<string, NlVoice> = {
  [NARRATOR]: { model: 'pim-medium', pitch: 1.0, speed: 0.95 },
};

/** shown in Settings when Dutch is learned and its lines are recorded */
export const NL_VOICE_CREDITS = 'Piper';
