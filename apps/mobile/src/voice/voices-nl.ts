// The recorded Dutch voices of Amsterdam's cast and the narrator (chips, words, model lines): three open voices for Piper, all CC0 — Pim
// and Ronnie (Netherlands Dutch, men), Nathalie (Flemish-trained, a woman) — each character set apart by a little pitch and pace
// (tools/voice/generate-piper.mjs nl). The narrator, whose lines are the learner's models, speaks Netherlands Dutch.
import { NARRATOR } from './voices';

export interface NlVoice {
  /** Piper model file: <model>.onnx */
  model: 'nl_NL-pim-medium' | 'nl_NL-ronnie-medium' | 'nl_BE-nathalie-medium';
  /** pitch factor (1 = the voice as recorded; 0.94 is about a semitone lower) */
  pitch: number;
  /** pace factor (1.1 = 10 % faster) */
  speed: number;
}

export const NL_VOICES: Record<string, NlVoice> = {
  femke: { model: 'nl_BE-nathalie-medium', pitch: 1.02, speed: 1.03 }, // 31, cheerful barista
  ingrid: { model: 'nl_BE-nathalie-medium', pitch: 0.94, speed: 0.95 }, // 50, calm service desk
  sanne: { model: 'nl_BE-nathalie-medium', pitch: 1.06, speed: 1.05 }, // 27, the neighbour on the houseboat
  noor: { model: 'nl_BE-nathalie-medium', pitch: 0.99, speed: 0.96 }, // 26, a teacher: clear and unhurried
  kees: { model: 'nl_NL-pim-medium', pitch: 0.9, speed: 0.92 }, // 61, the cheese seller
  daan: { model: 'nl_NL-pim-medium', pitch: 1.04, speed: 1.06 }, // 30, the bike courier
  jesse: { model: 'nl_NL-ronnie-medium', pitch: 1.06, speed: 1.06 }, // 24, the stroopwafel baker
  mo: { model: 'nl_NL-ronnie-medium', pitch: 0.94, speed: 1.0 }, // 42, the snack bar owner
  [NARRATOR]: { model: 'nl_NL-ronnie-medium', pitch: 1.0, speed: 0.95 },
};

/** shown in Settings when Dutch is learned and its lines are recorded */
export const NL_VOICE_CREDITS = 'Piper; Pim, Ronnie, Nathalie (OHF voice datasets, CC0)';
