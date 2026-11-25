// The recorded Spanish voices of Madrid's cast and the narrator (chips, words, model lines): two open voices from Spain for Piper —
// davefx (a man, CC0) and the Sharvard corpus's two speakers (a man and a woman, CC BY 3.0: credited in Settings) — each character set
// apart by a little pitch and pace (tools/voice/generate-piper.mjs es). The narrator, whose lines are the learner's models, is davefx.
import { NARRATOR } from './voices';

export interface EsVoice {
  /** Piper model file: <model>.onnx */
  model: 'es_ES-davefx-medium' | 'es_ES-sharvard-medium';
  /** the speaker of a model with several (Sharvard: 0 the man, 1 the woman) */
  speaker?: number;
  /** pitch factor (1 = the voice as recorded; 0.94 is about a semitone lower) */
  pitch: number;
  /** pace factor (1.1 = 10 % faster) */
  speed: number;
}

const F = 1;
const M = 0;

export const ES_VOICES: Record<string, EsVoice> = {
  lola: { model: 'es_ES-sharvard-medium', speaker: F, pitch: 0.97, speed: 1.05 }, // 48, quick and loud at the bar
  carmen: { model: 'es_ES-sharvard-medium', speaker: F, pitch: 0.92, speed: 0.92 }, // 66, the baker: kind and unhurried
  marisa: { model: 'es_ES-sharvard-medium', speaker: F, pitch: 0.99, speed: 0.95 }, // 50, the Metro office: calm and clear
  lucia: { model: 'es_ES-sharvard-medium', speaker: F, pitch: 1.05, speed: 1.04 }, // 25, the flatmate
  nadia: { model: 'es_ES-sharvard-medium', speaker: F, pitch: 1.01, speed: 0.98 }, // 27, the language exchange
  andres: { model: 'es_ES-davefx-medium', pitch: 0.92, speed: 0.98 }, // 55, the fruit seller
  rafa: { model: 'es_ES-davefx-medium', pitch: 1.03, speed: 1.05 }, // 35, the churrero, always joking
  javi: { model: 'es_ES-sharvard-medium', speaker: M, pitch: 1.03, speed: 1.04 }, // 29, the neighbour on the third floor
  // Spanish step 4: the farmacia, the taberna, the citizens' office
  pilar: { model: 'es_ES-sharvard-medium', speaker: F, pitch: 0.94, speed: 0.96 }, // 58, the pharmacist: calm and careful
  manolo: { model: 'es_ES-sharvard-medium', speaker: M, pitch: 0.9, speed: 1.06 }, // 61, the taberna's waiter: quick and cheeky
  concha: { model: 'es_ES-sharvard-medium', speaker: F, pitch: 0.97, speed: 1.0 }, // 52, the clerk: friendly and precise
  // customers of a shift behind a counter (customerVoice in @lw/content picks one per customer)
  customer: { model: 'es_ES-sharvard-medium', speaker: F, pitch: 1.07, speed: 1.0 },
  customer_m: { model: 'es_ES-sharvard-medium', speaker: M, pitch: 0.96, speed: 1.02 },
  [NARRATOR]: { model: 'es_ES-davefx-medium', pitch: 1.0, speed: 0.95 },
};

/** shown in Settings when Spanish is learned and its lines are recorded */
export const ES_VOICE_CREDITS = 'Piper; davefx (OHF voice datasets, CC0); Sharvard corpus (Aubanel, García Lecumberri & Cooke, CC BY 3.0)';
