import { describe, expect, it } from 'vitest';
import type { AudioIssueId, MicFailure, SttErrorId, TtsErrorCode } from '@lw/engine';
import { STRINGS } from '../src/i18n';

// Exhaustive on purpose: adding an id to the engine type breaks the build here until a string key is named.
const ISSUE_FIX: Record<AudioIssueId, string[]> = {
  insecure: ['audio.fix.insecure'],
  embedded: ['audio.fix.embedded'],
  'no-tts': ['audio.fix.noTts'],
  'no-ja-voice': ['audio.fix.noJa', 'audio.fix.noJa.android', 'audio.fix.noJa.ios', 'audio.fix.noJa.windows', 'audio.fix.noJa.mac', 'audio.fix.noJa.other'],
  'no-stt': ['audio.fix.noStt', 'audio.fix.noStt.firefox'],
  'mic-denied': ['audio.fix.micDenied'],
  'mic-prompt': ['audio.fix.micPrompt'],
  'no-mic': ['audio.fix.noMic'],
  'ios-gesture': ['audio.fix.iosGesture'],
};
const MIC: Record<MicFailure, true> = { denied: true, 'no-device': true, insecure: true, blocked: true, unknown: true };
const SPK: Record<TtsErrorCode, true> = { unavailable: true, 'no-voice': true, 'not-allowed': true, 'synthesis-failed': true, timeout: true };
const STT: Record<SttErrorId, true> = { unsupported: true, denied: true, blocked: true, silent: true, 'no-mic': true, network: true, cancelled: true, language: true, timeout: true, unknown: true };

const keys = [
  ...Object.values(ISSUE_FIX).flat(),
  ...Object.keys(MIC).map((k) => `audio.mic.fail.${k}`),
  ...Object.keys(SPK).map((k) => `audio.spk.err.${k}`),
  ...Object.keys(STT).map((k) => `audio.mic.err.${k}`),
];

describe('audio strings', () => {
  it('every issue and error id has a message in English and Arabic', () => {
    for (const k of keys) {
      for (const lang of ['en', 'ar'] as const) {
        const s = (STRINGS[lang] as Record<string, string>)[k];
        expect(s, `${lang} ${k}`).toBeTruthy();
      }
    }
  });

  it('Arabic strings are Arabic and keep the same placeholders', () => {
    const en = STRINGS.en as Record<string, string>;
    const ar = STRINGS.ar as Record<string, string>;
    for (const k of Object.keys(en).filter((k) => k.startsWith('audio.'))) {
      expect(ar[k], k).toMatch(/[؀-ۿ]/);
      expect(ar[k].match(/\{\w+\}/g)?.sort() ?? [], k).toEqual(en[k].match(/\{\w+\}/g)?.sort() ?? []);
    }
  });
});
