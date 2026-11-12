// The one key of a recorded line, shared by the generator (tools/voice/generate.mjs) and the player (RecordedVoiceTts),
// so a file recorded from markup ('お水|を|ください|。') is found when a screen speaks the plain text ('お水をください').

/** NFKC, no whitespace or markup bars, no trailing sentence punctuation. */
export function voiceTextKey(text: string): string {
  return text.normalize('NFKC').replace(/[\s|]+/g, '').replace(/[。．.!?！？]+$/u, '');
}

/**
 * The sentences of a line, each with its closing punctuation (markup bars may stay: the key ignores them). A line that names the player
 * has no recording of its own; the player then plays it sentence by sentence, and the generator records its name-free sentences.
 */
export function splitSentences(text: string): string[] {
  return (text.match(/[^。．！？!?]+[。．！？!?…]*/gu) ?? []).map((s) => s.trim()).filter((s) => voiceTextKey(s).length > 0);
}

/** '<voice>|<text key>': the manifest's entry key */
export const voiceEntryKey = (voice: string, text: string): string => `${voice}|${voiceTextKey(text)}`;

export interface VoiceManifest {
  v: number;
  /** voice id -> VOICEVOX style id */
  voices: Record<string, number>;
  /** '<voice>|<text key>' -> file hash (public/voice/<hash>.mp3) */
  entries: Record<string, string>;
}
