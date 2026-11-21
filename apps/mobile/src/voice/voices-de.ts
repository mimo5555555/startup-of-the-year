// The recorded German voices of Berlin's cast and the narrator (chips, words, model lines): two open voices for Piper, both CC0
// (Thorsten-Voice, male; Kerstin, female), each character set apart by a little pitch and pace (tools/voice/generate-piper.mjs de).
import { NARRATOR } from './voices';

export interface DeVoice {
  /** Piper model: de_DE-<model>.onnx */
  model: 'thorsten-high' | 'kerstin-low';
  /** pitch factor (1 = the voice as recorded; 0.94 is about a semitone lower) */
  pitch: number;
  /** pace factor (1.1 = 10 % faster) */
  speed: number;
}

export const DE_VOICES: Record<string, DeVoice> = {
  jana: { model: 'kerstin-low', pitch: 1.0, speed: 1.02 }, // 34, brisk baker
  sabine: { model: 'kerstin-low', pitch: 0.96, speed: 0.94 }, // 45, precise ticket clerk
  greta: { model: 'kerstin-low', pitch: 0.92, speed: 0.92 }, // 67, chatty flea-market seller
  lena: { model: 'kerstin-low', pitch: 1.06, speed: 1.06 }, // 24, the flatmate
  murat: { model: 'thorsten-high', pitch: 0.93, speed: 0.95 }, // 52, calm Späti owner
  emre: { model: 'thorsten-high', pitch: 1.02, speed: 1.08 }, // 29, fast Döner cook
  kofi: { model: 'thorsten-high', pitch: 0.89, speed: 1.0 }, // 33, easy-going neighbour
  jonas: { model: 'thorsten-high', pitch: 1.06, speed: 1.02 }, // 27, the language-exchange partner
  // German step 5
  anke: { model: 'kerstin-low', pitch: 0.99, speed: 0.97 }, // 48, calm pharmacist
  uwe: { model: 'thorsten-high', pitch: 0.86, speed: 0.97 }, // 58, gruff Kneipe landlord
  krause: { model: 'thorsten-high', pitch: 0.97, speed: 0.92 }, // 55, formal clerk at the Bürgeramt
  [NARRATOR]: { model: 'thorsten-high', pitch: 1.0, speed: 0.95 },
};

/** shown in Settings when German is learned */
export const DE_VOICE_CREDITS = 'Piper; Thorsten-Voice (Thorsten Müller, CC0); Kerstin (CC0)';
