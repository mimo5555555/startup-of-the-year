// The one key of a recorded line, shared by the generator (tools/voice/generate.mjs) and the player (RecordedVoiceTts),
// so a file recorded from markup ('お水|を|ください|。') is found when a screen speaks the plain text ('お水をください').

/** NFKC, no whitespace or markup bars, no trailing sentence punctuation. */
export function voiceTextKey(text: string): string {
  return text.normalize('NFKC').replace(/[\s|]+/g, '').replace(/[。．.!?！？]+$/u, '');
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
