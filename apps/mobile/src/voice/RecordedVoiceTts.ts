// Japanese speech from pre-recorded files (public/voice, made by tools/voice/generate.mjs), so every device has a voice.
// A line with no file, or a file that fails, is spoken by the wrapped engine (WebSpeechTts): nothing gets worse.
import { TTS_SAMPLE_JA, deriveAudioIssues, type AudioReport, type SpeakOptions, type TtsError, type TtsPort, type TtsSampleResult, type TtsVoiceInfo } from '@lw/engine';
import { voiceEntryKey, voiceTextKey, type VoiceManifest } from './key';
import { NARRATOR } from './voices';

/** The bits of HTMLAudioElement the player uses (tests pass a fake). */
export interface AudioLike {
  src: string;
  playbackRate: number;
  preservesPitch?: boolean;
  /** seconds, once the file's metadata is known (NaN before) */
  duration?: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: string, fn: () => void): void;
  removeEventListener(type: string, fn: () => void): void;
}

export interface RecordedVoiceOptions {
  /** folder of manifest.json and the mp3 files, ending in '/' */
  base?: string;
  fetchManifest?: (url: string) => Promise<VoiceManifest | null>;
  createAudio?: () => AudioLike | null;
  /** no 'playing' within this: the file is treated as failed (ms) */
  startMs?: number;
  /** a line that never reports its end is ended after this (ms): speak() never hangs */
  maxMs?: number;
}

/** What the player found for each line (the e2e coverage report reads it). */
export interface VoiceStats {
  /** lines played from a file (to the end, or until cancelled) */
  recorded: number;
  /** lines handed to the wrapped engine: no file, or the file failed */
  fallback: number;
  /** '<voice>|<text>' of the lines with no file (the first 200) */
  missed: string[];
}

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const RECORDED_VOICE: TtsVoiceInfo = { name: 'VOICEVOX (recorded)', lang: 'ja-JP', local: true };

const defaultFetch = async (url: string): Promise<VoiceManifest | null> => {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as VoiceManifest) : null;
  } catch {
    return null;
  }
};
const defaultAudio = (): AudioLike | null => (typeof Audio === 'function' ? new Audio() : null);

export class RecordedVoiceTts implements TtsPort {
  readonly stats: VoiceStats = { recorded: 0, fallback: 0, missed: [] };
  private manifest: VoiceManifest | null = null;
  /** text key -> a file in any voice (a replayed character line with no speaker given) */
  private anyVoice = new Map<string, string>();
  private loading: Promise<void> | null = null;
  private audio: AudioLike | null = null;
  private current: { stop: () => void } | null = null;
  private viaFile = false;
  private readonly base: string;
  private readonly fetchManifest: (url: string) => Promise<VoiceManifest | null>;
  private readonly createAudio: () => AudioLike | null;
  private readonly startMs: number;
  private readonly maxMs: number;

  constructor(private readonly inner: TtsPort, opts: RecordedVoiceOptions = {}) {
    this.base = opts.base ?? '/voice/';
    this.fetchManifest = opts.fetchManifest ?? defaultFetch;
    this.createAudio = opts.createAudio ?? defaultAudio;
    this.startMs = opts.startMs ?? 5000;
    this.maxMs = opts.maxMs ?? 30000;
  }

  /** Fetch the manifest once; a missing or broken one just means every line uses the wrapped engine. */
  load(): Promise<void> {
    this.loading ??= this.fetchManifest(`${this.base}manifest.json`)
      .then((m) => {
        this.manifest = m && m.entries && typeof m.entries === 'object' ? m : null;
        for (const [k, hash] of Object.entries(this.manifest?.entries ?? {})) {
          const text = k.slice(k.indexOf('|') + 1);
          if (!this.anyVoice.has(text) || k.startsWith(`${NARRATOR}|`)) this.anyVoice.set(text, hash);
        }
      })
      .catch(() => undefined);
    return this.loading;
  }

  /** true once the manifest lists recorded lines */
  recorded(): boolean {
    return !!this.manifest && Object.keys(this.manifest.entries).length > 0;
  }

  /** URL of the recorded line: the speaker's own, else the narrator's, else any voice's; null when there is none */
  fileFor(text: string, who?: string): string | null {
    const e = this.manifest?.entries;
    if (!e) return null;
    const hash = (who && e[voiceEntryKey(who, text)]) || e[voiceEntryKey(NARRATOR, text)] || this.anyVoice.get(voiceTextKey(text));
    return hash ? `${this.base}${hash}.mp3` : null;
  }

  available() {
    void this.load();
    return this.recorded() || this.inner.available();
  }
  hasJapaneseVoice() {
    void this.load();
    return this.recorded() || this.inner.hasJapaneseVoice();
  }
  voicesReady() {
    return this.recorded() || this.inner.voicesReady();
  }
  speaking() {
    return this.current !== null || this.inner.speaking();
  }
  voiceName() {
    return this.inner.voiceName() ?? (this.recorded() ? RECORDED_VOICE.name : null);
  }
  japaneseVoices(): TtsVoiceInfo[] {
    return this.recorded() ? [RECORDED_VOICE, ...this.inner.japaneseVoices()] : this.inner.japaneseVoices();
  }
  voiceCount() {
    return this.inner.voiceCount() + (this.recorded() ? 1 : 0);
  }
  lastError(): TtsError | null {
    return this.viaFile ? null : this.inner.lastError();
  }
  simulated() {
    return this.viaFile ? false : this.inner.simulated();
  }

  /** From a user gesture: iOS only lets an audio element play later if it played once inside a gesture. */
  unlock() {
    this.inner.unlock();
    void this.load();
    const a = this.element();
    if (!a) return;
    try {
      a.src = SILENT_WAV;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => undefined);
    } catch {
      /* optional */
    }
  }

  cancel() {
    const c = this.current;
    this.current = null;
    c?.stop();
    this.inner.cancel();
  }

  async speakSample(): Promise<TtsSampleResult> {
    await this.load();
    if (!this.fileFor(TTS_SAMPLE_JA)) return this.inner.speakSample();
    await this.speak(TTS_SAMPLE_JA, { rate: 0.9 });
    return this.viaFile ? { audible: true, voice: RECORDED_VOICE.name, error: null } : { audible: !this.inner.simulated() && !this.inner.lastError(), voice: this.inner.voiceName(), error: this.inner.lastError() };
  }

  async speak(text: string, o: SpeakOptions = {}): Promise<void> {
    this.cancel();
    const pending = { stop: () => undefined };
    this.current = pending;
    await this.load();
    if (this.current !== pending) return; // cancelled (or replaced) while the manifest loaded
    this.current = null;
    const url = this.fileFor(text, o.who);
    const a = url ? this.element() : null;
    if (!url || !a) {
      this.stats.fallback++;
      if (this.stats.missed.length < 200) this.stats.missed.push(`${o.who ?? NARRATOR}|${text}`);
      this.viaFile = false;
      return this.inner.speak(text, o);
    }
    const ok = await this.play(a, url, o);
    this.viaFile = ok !== 'failed';
    if (ok !== 'failed') {
      this.stats.recorded++;
      return;
    }
    this.stats.fallback++;
    return this.inner.speak(text, o);
  }

  private element(): AudioLike | null {
    if (!this.audio) {
      try {
        this.audio = this.createAudio();
      } catch {
        this.audio = null;
      }
    }
    return this.audio;
  }

  /** Play one file: 'played' when it ended, 'failed' when it could not start (fall back), 'cancelled' by cancel() / the next speak(). */
  private play(a: AudioLike, url: string, o: SpeakOptions): Promise<'played' | 'failed' | 'cancelled'> {
    return new Promise((resolve) => {
      let started = false;
      let settled = false;
      const timer = setTimeout(() => !started && finish('failed'), this.startMs);
      const guard = setTimeout(() => finish('played'), this.maxMs);
      const onPlaying = () => {
        if (started) return;
        started = true;
        o.onStart?.();
        const d = a.duration;
        if (o.onDuration && typeof d === 'number' && Number.isFinite(d) && d > 0) o.onDuration(d / Math.max(0.5, a.playbackRate || 1));
      };
      const onEnded = () => finish('played');
      const onError = () => finish(started ? 'played' : 'failed');
      const finish = (how: 'played' | 'failed' | 'cancelled') => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(guard);
        a.removeEventListener('playing', onPlaying);
        a.removeEventListener('ended', onEnded);
        a.removeEventListener('error', onError);
        if (this.current === handle) this.current = null;
        if (how !== 'played') {
          try {
            a.pause();
          } catch {
            /* ignore */
          }
        }
        // a cancelled or finished line ends here; a failed one is handed to the fallback, which calls the callbacks itself
        if (how !== 'failed') {
          if (!started) o.onStart?.();
          o.onEnd?.();
        }
        resolve(how);
      };
      const handle = { stop: () => finish('cancelled') };
      this.current = handle;
      a.addEventListener('playing', onPlaying);
      a.addEventListener('ended', onEnded);
      a.addEventListener('error', onError);
      try {
        a.src = url;
        a.playbackRate = Math.min(2, Math.max(0.5, o.rate ?? 1));
        a.preservesPitch = true;
        const p = a.play();
        if (p && typeof p.then === 'function') p.then(onPlaying, () => finish('failed'));
      } catch {
        finish('failed');
      }
    });
  }
}

/** The audio report as the player sees it: recorded voices make the speaker ready even with no device voice. */
export function withRecordedVoices(r: AudioReport, recorded: boolean): AudioReport {
  if (!recorded) return r;
  const { issues: _old, ...base } = r;
  const tts = { ...base.tts, available: true, voicesReady: true, jaVoices: [RECORDED_VOICE, ...base.tts.jaVoices] };
  const next = { ...base, tts };
  return { ...next, issues: deriveAudioIssues(next) };
}
