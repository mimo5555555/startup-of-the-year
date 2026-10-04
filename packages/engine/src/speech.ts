// Speech ports and their browser adapters. Native builds add on-device engines
// (whisper.cpp for recognition, OS/sherpa-onnx voices for speech) behind the same interfaces.

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voice?: 'f' | 'm';
  onStart?: () => void;
  onEnd?: () => void;
}

export interface TtsPort {
  /** can this device speak at all? */
  available(): boolean;
  /** is there a Japanese voice installed? */
  hasJapaneseVoice(): boolean;
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  cancel(): void;
  speaking(): boolean;
}

export type SttErrorCode = 'unsupported' | 'not-allowed' | 'no-speech' | 'audio-capture' | 'network' | 'aborted' | 'unknown';

export interface SttResult {
  text: string;
  confidence: number;
}

export interface SttSession {
  result: Promise<SttResult>;
  stop(): void;
}

export class SttError extends Error {
  constructor(readonly code: SttErrorCode, message?: string) {
    super(message ?? code);
  }
}

export interface SttPort {
  available(): boolean;
  listen(lang: 'ja-JP' | 'en-US' | 'ar-SA', onInterim?: (text: string) => void): SttSession;
}

const FEMALE = /kyoko|o-?ren|nanami|haruka|ayumi|sayaka|mizuki|female|女|google 日本語/i;
const MALE = /otoya|ichiro|keita|hattori|male|男|takumi/i;

const hasSynthesis = () => typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis && typeof (globalThis as any).SpeechSynthesisUtterance === 'function';

export class WebSpeechTts implements TtsPort {
  private voices: SpeechSynthesisVoice[] = [];
  private current: { resolve: () => void } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private keep: SpeechSynthesisUtterance[] = [];

  constructor() {
    if (hasSynthesis()) {
      const load = () => {
        this.voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ja'));
      };
      load();
      try {
        speechSynthesis.addEventListener('voiceschanged', load);
      } catch {
        /* older engines */
      }
    }
  }

  available() {
    return hasSynthesis();
  }

  hasJapaneseVoice() {
    return this.voices.length > 0;
  }

  speaking() {
    return this.current !== null;
  }

  private pick(kind: 'f' | 'm' | undefined) {
    if (!this.voices.length) return undefined;
    const want = kind === 'm' ? MALE : kind === 'f' ? FEMALE : null;
    return (want && this.voices.find((v) => want.test(v.name))) || this.voices.find((v) => v.localService) || this.voices[0];
  }

  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (hasSynthesis()) {
      try {
        speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    const c = this.current;
    this.current = null;
    c?.resolve();
  }

  speak(text: string, o: SpeakOptions = {}): Promise<void> {
    this.cancel();
    const clean = text.replace(/[「」『』]/g, ' ').trim();
    if (!clean) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        if (this.current && this.current.resolve === finish) this.current = null;
        o.onEnd?.();
        resolve();
      };
      this.current = { resolve: finish };
      // when nothing can be heard, still pace the talking animation like real speech
      const simulate = () => {
        o.onStart?.();
        const ms = Math.min(9000, 350 + (clean.length * 140) / Math.max(0.5, o.rate ?? 1));
        this.timer = setTimeout(finish, ms);
      };
      if (!hasSynthesis() || !this.voices.length) {
        simulate();
        return;
      }
      try {
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = 'ja-JP';
        u.rate = Math.max(0.5, Math.min(1.6, o.rate ?? 1));
        u.pitch = Math.max(0.5, Math.min(1.8, o.pitch ?? 1));
        const v = this.pick(o.voice);
        if (v) u.voice = v;
        u.onstart = () => o.onStart?.();
        u.onend = finish;
        u.onerror = finish;
        this.keep.push(u);
        if (this.keep.length > 4) this.keep.shift();
        speechSynthesis.speak(u);
        // some engines never fire onend; never leave the UI waiting
        this.timer = setTimeout(finish, 15000);
      } catch {
        simulate();
      }
    });
  }
}

type RecognitionCtor = new () => any;

function recognitionCtor(): RecognitionCtor | null {
  const g = globalThis as any;
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export class WebSpeechStt implements SttPort {
  available() {
    return recognitionCtor() !== null;
  }

  listen(lang: 'ja-JP' | 'en-US' | 'ar-SA', onInterim?: (text: string) => void): SttSession {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      return { result: Promise.reject(new SttError('unsupported')), stop() {} };
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;
    const result = new Promise<SttResult>((resolve, reject) => {
      let last: SttResult | null = null;
      rec.onresult = (e: any) => {
        const r = e.results[e.results.length - 1];
        const alt = r[0];
        last = { text: alt.transcript, confidence: alt.confidence ?? 0.5 };
        if (!r.isFinal) onInterim?.(alt.transcript);
      };
      rec.onerror = (e: any) => {
        const code = String(e.error ?? 'unknown');
        reject(new SttError((['not-allowed', 'service-not-allowed'].includes(code) ? 'not-allowed' : ['no-speech', 'audio-capture', 'network', 'aborted'].includes(code) ? code : 'unknown') as SttErrorCode));
      };
      rec.onend = () => (last ? resolve(last) : reject(new SttError('no-speech')));
    });
    try {
      rec.start();
    } catch {
      return { result: Promise.reject(new SttError('unknown')), stop() {} };
    }
    return { result, stop: () => { try { rec.stop(); } catch { /* ignore */ } } };
  }
}

/** Silent engine for tests and headless runs. */
export class NullTts implements TtsPort {
  spoken: string[] = [];
  available() {
    return false;
  }
  hasJapaneseVoice() {
    return false;
  }
  speaking() {
    return false;
  }
  cancel() {}
  async speak(text: string, o: SpeakOptions = {}) {
    this.spoken.push(text);
    o.onStart?.();
    o.onEnd?.();
  }
}
