// Speech ports and their browser adapters. Native builds add on-device engines
// (whisper.cpp for recognition, OS/sherpa-onnx voices for speech) behind the same interfaces.

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voice?: 'f' | 'm';
  onStart?: () => void;
  onEnd?: () => void;
}

/** Why the last speak() was not (fully) audible. The UI maps codes to strings; the engine never carries prose. */
export type TtsErrorCode = 'unavailable' | 'no-voice' | 'not-allowed' | 'synthesis-failed' | 'timeout';

export interface TtsError {
  code: TtsErrorCode;
  /** raw engine detail (e.g. SpeechSynthesisErrorEvent.error), for logs only */
  detail?: string;
}

export interface TtsVoiceInfo {
  name: string;
  lang: string;
  local: boolean;
}

export interface TtsSampleResult {
  /** true when a real voice was asked to speak and no error was reported */
  audible: boolean;
  voice: string | null;
  error: TtsError | null;
}

export interface TtsPort {
  /** can this device speak at all? */
  available(): boolean;
  /** is there a Japanese voice installed? */
  hasJapaneseVoice(): boolean;
  /** true once the device has reported its voices, so a missing Japanese voice is a fact, not a race */
  voicesReady(): boolean;
  /** Resolves when speech ends, is cancelled or fails; never hangs. */
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  /** call from a user gesture: some browsers only allow speech after one */
  unlock(): void;
  cancel(): void;
  speaking(): boolean;
  /** name of the Japanese voice in use (or that would be used), null when none */
  voiceName(): string | null;
  /** Japanese voices the device offers */
  japaneseVoices(): TtsVoiceInfo[];
  /** number of voices of any language */
  voiceCount(): number;
  /** why the last speak() was not audible, null when it was fine */
  lastError(): TtsError | null;
  /** true when the last speak() only paced the talking animation because nothing could be heard */
  simulated(): boolean;
  /** say a short Japanese sample (call from a user gesture) and report whether it could be heard */
  speakSample(): Promise<TtsSampleResult>;
}

export type SttErrorCode =
  | 'unsupported'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'language-not-supported'
  | 'bad-grammar'
  | 'timeout'
  | 'unknown';

/** Stable ids the UI maps to localized strings. */
export type SttErrorId = 'unsupported' | 'denied' | 'blocked' | 'silent' | 'no-mic' | 'network' | 'cancelled' | 'language' | 'timeout' | 'unknown';

export interface SttResult {
  text: string;
  confidence: number;
}

export interface SttSession {
  result: Promise<SttResult>;
  /** stop listening; the result resolves with the best text heard so far (or rejects 'no-speech') */
  stop(): void;
  /** drop everything; the result rejects 'aborted' unless it already settled */
  abort(): void;
}

export class SttError extends Error {
  constructor(readonly code: SttErrorCode, message?: string) {
    super(message ?? code);
  }
  get id(): SttErrorId {
    return describeSttError(this.code);
  }
}

export interface SttPort {
  available(): boolean;
  listen(lang: 'ja-JP' | 'en-US' | 'ar-SA', onInterim?: (text: string) => void): SttSession;
}

const STT_CODES: SttErrorCode[] = ['unsupported', 'not-allowed', 'service-not-allowed', 'no-speech', 'audio-capture', 'network', 'aborted', 'language-not-supported', 'bad-grammar', 'timeout'];

/** Map a raw SpeechRecognitionErrorEvent.error (or SttError.code) to a known code. */
export function normalizeSttCode(code: unknown): SttErrorCode {
  const c = String(code ?? '');
  return (STT_CODES as string[]).includes(c) ? (c as SttErrorCode) : 'unknown';
}

/** Map any recognition error code to a stable id the UI turns into a message. */
export function describeSttError(code: unknown): SttErrorId {
  switch (normalizeSttCode(code)) {
    case 'unsupported':
      return 'unsupported';
    case 'not-allowed':
      return 'denied';
    case 'service-not-allowed':
      return 'blocked';
    case 'no-speech':
      return 'silent';
    case 'audio-capture':
      return 'no-mic';
    case 'network':
      return 'network';
    case 'aborted':
      return 'cancelled';
    case 'language-not-supported':
      return 'language';
    case 'timeout':
      return 'timeout';
    default:
      return 'unknown'; // bad-grammar and anything new
  }
}

// ---------- voices ----------

const FEMALE = /kyoko|o-?ren|nanami|haruka|ayumi|sayaka|mizuki|(^|[^a-z])female|女|google 日本語/i;
const MALE = /otoya|ichiro|keita|hattori|(^|[^a-z])male|男|takumi/i;
const JA_NAME = /japanese|日本語|nihongo|kyoko|o-?ren|otoya|ichiro|haruka|ayumi|sayaka|nanami|keita|mizuki|hattori|takumi/i;

export interface VoiceLike {
  name: string;
  lang: string;
  localService?: boolean;
}

const normLang = (l: string | undefined) => (l ?? '').toLowerCase().replace(/_/g, '-');

/** ja, ja-JP, ja_JP (Android), jpn-JPN, or a well-known Japanese voice name. */
export function isJapaneseVoice(v: { name?: string; lang?: string }): boolean {
  if (/^(ja|jpn)(-|$)/.test(normLang(v.lang))) return true;
  return JA_NAME.test(v.name ?? '');
}

/** Local voices first (they work offline and start fast), then the requested gender hint, then exact ja-JP. */
export function pickJapaneseVoice<T extends VoiceLike>(voices: readonly T[], kind?: 'f' | 'm'): T | undefined {
  const ja = voices.filter(isJapaneseVoice);
  if (!ja.length) return undefined;
  const want = kind === 'm' ? MALE : kind === 'f' ? FEMALE : null;
  const other = kind === 'm' ? FEMALE : kind === 'f' ? MALE : null;
  const score = (v: T) => (v.localService ? 8 : 0) + (want?.test(v.name) ? 4 : 0) + (normLang(v.lang) === 'ja-jp' ? 2 : 0) - (other?.test(v.name) ? 1 : 0);
  let best = ja[0]!;
  for (const v of ja) if (score(v) > score(best)) best = v;
  return best;
}

/**
 * Wait (up to ms) for the device to report voices: resolves early once any appear, or once `ready` accepts the list
 * (Chrome can report local voices first and the rest in a later 'voiceschanged'). Never rejects.
 */
export function waitForVoices(synth: any, ms: number, ready: (voices: any[]) => boolean = (v) => v.length > 0): Promise<void> {
  return new Promise<void>((resolve) => {
    const ok = () => {
      try {
        return ready(Array.from(synth?.getVoices?.() ?? []));
      } catch {
        return false;
      }
    };
    if (ms <= 0 || ok()) return resolve();
    let poll: ReturnType<typeof setInterval> | undefined;
    let t: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (poll) clearInterval(poll);
      if (t) clearTimeout(t);
      try {
        synth.removeEventListener?.('voiceschanged', check);
      } catch {
        /* ignore */
      }
      resolve();
    };
    const check = () => {
      if (ok()) done();
    };
    try {
      synth.addEventListener?.('voiceschanged', check);
    } catch {
      /* older engines */
    }
    poll = setInterval(check, 50);
    t = setTimeout(done, ms);
  });
}

// ---------- utterance chunking ----------

/** Chrome cuts utterances after ~15 s, so long text is spoken as a chain of short ones. */
export const TTS_CHUNK_MAX = 70;

/** Split at sentence punctuation (。！？!?), pack sentences up to max chars; split overlong sentences at commas, spaces, then hard. */
export function splitForSpeech(text: string, max = TTS_CHUNK_MAX): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= max) return [t];
  const sentences = (t.match(/[^。！？!?\n]*[。！？!?]+|[^。！？!?\n]+/g) ?? [t]).map((s) => s.trim()).filter(Boolean);
  const pieces: string[] = [];
  for (const s of sentences) {
    if (s.length <= max) {
      pieces.push(s);
      continue;
    }
    // too long for one utterance: break at commas / spaces, then hard-cut
    let cur = '';
    for (const part of s.match(/[^、，,\s]*[、，,\s]*/g) ?? [s]) {
      if (!part) continue;
      if ((cur + part).length <= max) {
        cur += part;
        continue;
      }
      if (cur) pieces.push(cur.trim());
      cur = '';
      let rest = part;
      while (rest.length > max) {
        pieces.push(rest.slice(0, max));
        rest = rest.slice(max);
      }
      cur = rest;
    }
    if (cur.trim()) pieces.push(cur.trim());
  }
  const out: string[] = [];
  let cur = '';
  for (const p of pieces) {
    if (cur && (cur + p).length > max) {
      out.push(cur);
      cur = '';
    }
    cur += p;
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- text to speech ----------

const synthesis = (): any => (globalThis as any).speechSynthesis;
const hasSynthesis = () => typeof globalThis !== 'undefined' && !!synthesis() && typeof (globalThis as any).SpeechSynthesisUtterance === 'function';

export const TTS_SAMPLE_JA = 'こんにちは。よろしくお願いします。';

export interface WebSpeechTtsOptions {
  /** how long to wait for the device to report voices when none are known yet (ms) */
  voiceWaitMs?: number;
  /** pause between cancel() and speak() when something was speaking (ms) */
  deferMs?: number;
  chunkMax?: number;
}

export class WebSpeechTts implements TtsPort {
  private all: SpeechSynthesisVoice[] = [];
  private ja: SpeechSynthesisVoice[] = [];
  private current: { resolve: () => void } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deferTimer: ReturnType<typeof setTimeout> | null = null;
  private keep: SpeechSynthesisUtterance[] = [];
  private waited = false;
  private chosen: string | null = null;
  private err: TtsError | null = null;
  private sim = false;
  private readonly voiceWaitMs: number;
  private readonly deferMs: number;
  private readonly chunkMax: number;

  constructor(opts: WebSpeechTtsOptions = {}) {
    this.voiceWaitMs = opts.voiceWaitMs ?? 700;
    this.deferMs = opts.deferMs ?? 60;
    this.chunkMax = opts.chunkMax ?? TTS_CHUNK_MAX;
    if (hasSynthesis()) {
      this.refresh();
      try {
        synthesis().addEventListener('voiceschanged', () => this.refresh());
      } catch {
        /* older engines */
      }
    }
  }

  /** re-read the device's voice list; it is empty until 'voiceschanged' on Chrome */
  private refresh() {
    if (!hasSynthesis()) return;
    try {
      this.all = Array.from(synthesis().getVoices() ?? []);
    } catch {
      this.all = [];
    }
    this.ja = this.all.filter(isJapaneseVoice);
  }

  available() {
    return hasSynthesis();
  }

  hasJapaneseVoice() {
    this.refresh();
    return this.ja.length > 0;
  }

  voicesReady() {
    this.refresh();
    return this.all.length > 0;
  }

  voiceCount() {
    this.refresh();
    return this.all.length;
  }

  japaneseVoices(): TtsVoiceInfo[] {
    this.refresh();
    return this.ja.map((v) => ({ name: v.name, lang: v.lang, local: !!v.localService }));
  }

  voiceName() {
    this.refresh();
    return this.chosen ?? pickJapaneseVoice(this.ja, 'f')?.name ?? null;
  }

  lastError() {
    return this.err;
  }

  simulated() {
    return this.sim;
  }

  /** also resume(): iOS and Chrome can leave the queue paused */
  unlock() {
    if (!hasSynthesis()) return;
    this.resume();
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      u.lang = 'ja-JP';
      synthesis().speak(u);
    } catch {
      /* optional */
    }
  }

  private resume() {
    try {
      synthesis().resume();
    } catch {
      /* ignore */
    }
  }

  speaking() {
    return this.current !== null;
  }

  cancel() {
    if (this.timer) clearTimeout(this.timer);
    if (this.deferTimer) clearTimeout(this.deferTimer);
    this.timer = null;
    this.deferTimer = null;
    if (hasSynthesis()) {
      try {
        synthesis().cancel();
      } catch {
        /* ignore */
      }
    }
    const c = this.current;
    this.current = null;
    c?.resolve();
  }

  async speakSample(): Promise<TtsSampleResult> {
    await this.speak(TTS_SAMPLE_JA, { rate: 0.9 });
    const error = this.err;
    return { audible: hasSynthesis() && !this.sim && !error, voice: this.chosen, error };
  }

  speak(text: string, o: SpeakOptions = {}): Promise<void> {
    const clean = text.replace(/[「」『』]/g, ' ').replace(/\s+/g, ' ').trim();
    // cancel() then speak() straight away is flaky on some engines: defer only when something was playing
    const busy = this.current !== null || (hasSynthesis() && (synthesis().speaking || synthesis().pending));
    this.cancel();
    this.err = null;
    this.sim = false;
    if (!clean) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let done = false;
      let started = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        if (this.current && this.current.resolve === finish) this.current = null;
        if (!started) o.onStart?.();
        o.onEnd?.();
        resolve();
      };
      const alive = () => !done && this.current?.resolve === finish;
      const fail = (code: TtsErrorCode, detail?: string) => {
        this.err = { code, detail };
      };
      this.current = { resolve: finish };
      const rate = Math.max(0.5, Math.min(1.6, o.rate ?? 1));

      // when nothing can be heard, still pace the talking animation like real speech
      const simulate = () => {
        this.sim = true;
        started = true;
        o.onStart?.();
        const ms = Math.min(9000, 350 + (clean.length * 140) / Math.max(0.5, o.rate ?? 1));
        this.timer = setTimeout(finish, ms);
      };

      const speakChain = () => {
        const chunks = splitForSpeech(clean, this.chunkMax);
        const voice = pickJapaneseVoice(this.ja, o.voice);
        this.chosen = voice?.name ?? null;
        let i = 0;
        const next = () => {
          if (!alive()) return;
          if (i >= chunks.length) return finish();
          const piece = chunks[i++]!;
          let ended = false;
          let chunkStarted = false;
          let chunkTimer: ReturnType<typeof setTimeout> | undefined;
          const advance = () => {
            if (ended) return;
            ended = true;
            // a late event from a cancelled speak must not clear the timer of the one that replaced it
            if (chunkTimer) clearTimeout(chunkTimer);
            if (this.timer === chunkTimer) this.timer = null;
            next();
          };
          try {
            const u = new SpeechSynthesisUtterance(piece);
            u.lang = 'ja-JP';
            u.rate = rate;
            u.pitch = Math.max(0.5, Math.min(1.8, o.pitch ?? 1));
            if (voice) u.voice = voice;
            u.onstart = () => {
              chunkStarted = true;
              if (!started && alive()) {
                started = true;
                o.onStart?.();
              }
            };
            u.onend = advance;
            u.onerror = (e: any) => {
              if (ended || !alive()) return;
              ended = true;
              if (chunkTimer) clearTimeout(chunkTimer);
              const code = String(e?.error ?? '');
              if (code && code !== 'interrupted' && code !== 'canceled') fail(code === 'not-allowed' ? 'not-allowed' : 'synthesis-failed', code);
              finish();
            };
            this.keep.push(u);
            if (this.keep.length > 6) this.keep.shift();
            this.resume();
            synthesis().speak(u);
            // some engines never fire onend; never leave the UI waiting. Scaled to the text, not a flat 15 s.
            this.timer = chunkTimer = setTimeout(() => {
              if (ended || !alive()) return;
              ended = true;
              try {
                synthesis().cancel();
              } catch {
                /* ignore */
              }
              if (chunkStarted) next(); // it was talking, only the end event went missing
              else {
                fail('timeout');
                finish();
              }
            }, Math.round(3000 + (piece.length * 350) / rate));
          } catch (e) {
            fail('synthesis-failed', String((e as Error)?.message ?? e));
            if (!started) simulate();
            else finish();
          }
        };
        next();
      };

      const run = async () => {
        if (!alive()) return;
        if (!hasSynthesis()) {
          fail('unavailable');
          return simulate();
        }
        this.refresh();
        if (!this.ja.length && !this.waited) {
          this.waited = true;
          await waitForVoices(synthesis(), this.voiceWaitMs, (v) => v.some(isJapaneseVoice));
          if (!alive()) return;
          this.refresh();
        }
        if (!this.ja.length) {
          fail('no-voice');
          return simulate();
        }
        speakChain();
      };

      if (busy) {
        this.deferTimer = setTimeout(() => void run(), this.deferMs);
      } else void run();
    });
  }
}

// ---------- speech to text ----------

type RecognitionCtor = new () => any;

export function recognitionCtor(): RecognitionCtor | null {
  const g = globalThis as any;
  return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

export interface WebSpeechSttOptions {
  /** longest a single listen may run after the engine starts (ms) */
  maxListenMs?: number;
  /** how long to wait for the final result after stop() before settling with the best interim (ms) */
  stopGraceMs?: number;
  /** if the engine never reports 'start' (stuck permission, dead service) give up after this (ms) */
  startGuardMs?: number;
  /** after a final result, settle even if 'end' never fires (iOS) (ms) */
  finalGraceMs?: number;
}

export class WebSpeechStt implements SttPort {
  private active: SttSession | null = null;
  private readonly maxListenMs: number;
  private readonly stopGraceMs: number;
  private readonly startGuardMs: number;
  private readonly finalGraceMs: number;

  constructor(opts: WebSpeechSttOptions = {}) {
    this.maxListenMs = opts.maxListenMs ?? 30000;
    this.stopGraceMs = opts.stopGraceMs ?? 1500;
    this.startGuardMs = opts.startGuardMs ?? 60000;
    this.finalGraceMs = opts.finalGraceMs ?? 800;
  }

  available() {
    return recognitionCtor() !== null;
  }

  listen(lang: 'ja-JP' | 'en-US' | 'ar-SA', onInterim?: (text: string) => void): SttSession {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      return { result: Promise.reject(new SttError('unsupported')), stop() {}, abort() {} };
    }
    this.active?.abort();
    let rec: any;
    try {
      rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = false;
    } catch {
      return { result: Promise.reject(new SttError('unknown')), stop() {}, abort() {} };
    }

    let last: SttResult | null = null;
    let settled = false;
    let stopping = false;
    let timedOut = false;
    let resolveFn!: (r: SttResult) => void;
    let rejectFn!: (e: SttError) => void;
    const result = new Promise<SttResult>((res, rej) => {
      resolveFn = res;
      rejectFn = rej;
    });
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (fn: () => void, ms: number) => {
      const t = setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
      return t;
    };
    const quiet = (fn: () => void) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    };
    const settle = (err?: SttError) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      timers.clear();
      if (this.active === session) this.active = null;
      rec.onresult = rec.onerror = rec.onend = rec.onstart = null;
      quiet(() => rec.abort()); // no-op once ended; frees the mic when 'end' never came (iOS) or we settled early
      if (!err && last && last.text) resolveFn(last);
      else rejectFn(err ?? new SttError(timedOut ? 'timeout' : 'no-speech'));
    };
    /** resolve with the best text heard, else fail with `code` */
    const settleBest = (code: SttErrorCode) => {
      if (last && last.text) settle();
      else settle(new SttError(code));
    };
    const stop = () => {
      if (settled || stopping) return;
      stopping = true;
      quiet(() => rec.stop());
      // some engines never deliver 'end' after stop(): settle with whatever was heard
      later(() => {
        quiet(() => rec.abort());
        settleBest(timedOut ? 'timeout' : 'no-speech');
      }, this.stopGraceMs);
    };
    let guard: ReturnType<typeof setTimeout> | undefined;
    const abort = () => {
      if (settled) return;
      quiet(() => rec.abort());
      settle(new SttError('aborted'));
    };

    let started = false;
    rec.onstart = () => {
      started = true;
      if (guard) clearTimeout(guard);
      later(() => {
        timedOut = true;
        stop();
      }, this.maxListenMs);
    };
    rec.onresult = (e: any) => {
      let text = '';
      let final = true;
      let conf = 0;
      let n = 0;
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const a = r?.[0];
        if (!a) continue;
        text += a.transcript;
        if (!r.isFinal) final = false;
        if (typeof a.confidence === 'number' && a.confidence > 0) {
          conf += a.confidence;
          n++;
        }
      }
      text = text.trim();
      if (!text) return;
      last = { text, confidence: n ? conf / n : 0.5 };
      if (!final) onInterim?.(text);
      else later(() => settleBest('no-speech'), this.finalGraceMs); // 'end' normally follows at once
    };
    rec.onerror = (e: any) => {
      const code = normalizeSttCode(e?.error);
      // an interrupted listen that already heard something is still a usable answer
      if (code === 'aborted') settleBest('aborted');
      else settle(new SttError(code));
    };
    rec.onend = () => settleBest(timedOut ? 'timeout' : 'no-speech');

    const session: SttSession = { result, stop, abort };
    this.active = session;
    try {
      rec.start();
    } catch {
      settle(new SttError('unknown'));
      return session;
    }
    if (!started) {
      guard = later(() => {
        settle(new SttError('timeout'));
      }, this.startGuardMs);
    }
    return session;
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
  voicesReady() {
    return false;
  }
  speaking() {
    return false;
  }
  cancel() {}
  unlock() {}
  voiceName() {
    return null;
  }
  japaneseVoices(): TtsVoiceInfo[] {
    return [];
  }
  voiceCount() {
    return 0;
  }
  lastError(): TtsError | null {
    return { code: 'unavailable' };
  }
  simulated() {
    return true;
  }
  async speakSample(): Promise<TtsSampleResult> {
    await this.speak(TTS_SAMPLE_JA);
    return { audible: false, voice: null, error: { code: 'unavailable' } };
  }
  async speak(text: string, o: SpeakOptions = {}) {
    this.spoken.push(text);
    o.onStart?.();
    o.onEnd?.();
  }
}
