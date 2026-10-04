import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SttError,
  WebSpeechStt,
  WebSpeechTts,
  collectAudioReport,
  describeSttError,
  explainSttError,
  detectBrowser,
  isJapaneseVoice,
  pickJapaneseVoice,
  requestMicrophone,
  splitForSpeech,
  type AudioEnv,
  type AudioIssueId,
} from '../src';

// ---------- fakes ----------

type V = { name: string; lang: string; localService: boolean };
const voice = (name: string, lang: string, localService = true): V => ({ name, lang, localService });
const KYOKO = voice('Kyoko', 'ja-JP');
const EN = voice('Samantha', 'en-US');

class FakeUtterance {
  voice: V | null = null;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

type Mode = 'auto' | 'hang' | 'error';

class FakeSynth {
  voices: V[];
  spoken: FakeUtterance[] = [];
  resumed = 0;
  cancelled = 0;
  speaking = false;
  pending = false;
  mode: Mode = 'auto';
  errorCode = 'synthesis-failed';
  private listeners: Array<() => void> = [];
  private playing: FakeUtterance | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(voices: V[] = []) {
    this.voices = voices;
  }
  getVoices() {
    return this.voices;
  }
  addEventListener(_t: string, fn: () => void) {
    this.listeners.push(fn);
  }
  removeEventListener(_t: string, fn: () => void) {
    this.listeners = this.listeners.filter((l) => l !== fn);
  }
  fireVoicesChanged() {
    [...this.listeners].forEach((l) => l());
  }
  resume() {
    this.resumed++;
  }
  speak(u: FakeUtterance) {
    this.spoken.push(u);
    if (this.mode === 'hang') return;
    this.playing = u;
    this.speaking = true;
    this.timer = setTimeout(() => {
      this.playing = null;
      this.speaking = false;
      if (this.mode === 'error') u.onerror?.({ error: this.errorCode });
      else {
        u.onstart?.();
        u.onend?.();
      }
    }, 1);
  }
  cancel() {
    this.cancelled++;
    if (this.timer) clearTimeout(this.timer);
    const p = this.playing;
    this.playing = null;
    this.speaking = false;
    p?.onerror?.({ error: 'canceled' });
  }
}

const g = globalThis as any;
let synth: FakeSynth;

function install(voices: V[], mode: Mode = 'auto') {
  synth = new FakeSynth(voices);
  synth.mode = mode;
  g.speechSynthesis = synth;
  g.SpeechSynthesisUtterance = FakeUtterance;
}

beforeEach(() => {
  delete g.speechSynthesis;
  delete g.SpeechSynthesisUtterance;
  delete g.webkitSpeechRecognition;
  delete g.SpeechRecognition;
});

afterEach(() => {
  vi.useRealTimers();
  delete g.speechSynthesis;
  delete g.SpeechSynthesisUtterance;
  delete g.webkitSpeechRecognition;
  delete g.SpeechRecognition;
});

const quick = () => new WebSpeechTts({ voiceWaitMs: 40, deferMs: 5 });

/** run a promise that depends on simulated-pacing timers without really waiting */
async function fast<T>(p: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(12000);
  return p;
}

// ---------- chunking ----------

describe('splitForSpeech', () => {
  it('keeps short text as one utterance', () => {
    expect(splitForSpeech('こんにちは。')).toEqual(['こんにちは。']);
    expect(splitForSpeech('   ')).toEqual([]);
  });

  it('splits long text at sentence punctuation into chunks of at most 120 chars', () => {
    const sentence = 'これはとても長い文章のれんしゅうですから、ゆっくりよんでください。'; // 31 chars
    const text = Array.from({ length: 12 }, () => sentence).join('');
    const parts = splitForSpeech(text);
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(120);
    expect(parts.join('')).toBe(text);
    // every chunk but the last ends on a sentence boundary, never mid-sentence
    for (const p of parts.slice(0, -1)) expect(p.endsWith('。')).toBe(true);
  });

  it('splits on ！ and ？ too', () => {
    const text = ('すごい！' + 'あ'.repeat(50) + 'ですか？').repeat(4);
    const parts = splitForSpeech(text, 60);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(60);
    expect(parts.join('')).toBe(text);
  });

  it('breaks an overlong sentence at commas, then hard-cuts text with no punctuation at all', () => {
    const withCommas = Array.from({ length: 20 }, () => 'ひとつめのぶぶん、').join('') + '。';
    for (const p of splitForSpeech(withCommas, 50)) expect(p.length).toBeLessThanOrEqual(50);
    const blob = 'あ'.repeat(500);
    const parts = splitForSpeech(blob, 120);
    expect(parts.every((p) => p.length <= 120)).toBe(true);
    expect(parts.join('')).toBe(blob);
  });
});

// ---------- voice matching ----------

describe('Japanese voice matching', () => {
  it.each([
    ['ja-JP', true],
    ['ja_JP', true], // Android
    ['ja', true],
    ['JA-jp', true],
    ['jpn-JPN', true],
    ['en-US', false],
    ['jv-ID', false], // Javanese must not match
    ['', false],
  ])('lang %s -> %s', (lang, expected) => {
    expect(isJapaneseVoice({ name: 'Generic Voice', lang })).toBe(expected);
  });

  it('accepts well-known Japanese names when lang is wrong or missing', () => {
    expect(isJapaneseVoice({ name: 'Google 日本語', lang: '' })).toBe(true);
    expect(isJapaneseVoice({ name: 'Kyoko', lang: 'en-US' })).toBe(true);
    expect(isJapaneseVoice({ name: 'Samantha', lang: 'en-US' })).toBe(false);
  });

  it('prefers local voices, then the gender hint', () => {
    const voices = [voice('Google 日本語', 'ja-JP', false), voice('Otoya', 'ja-JP'), voice('Kyoko', 'ja-JP')];
    expect(pickJapaneseVoice(voices, 'f')?.name).toBe('Kyoko');
    expect(pickJapaneseVoice(voices, 'm')?.name).toBe('Otoya');
    // a remote voice only wins when nothing local exists
    expect(pickJapaneseVoice([voice('Google 日本語', 'ja-JP', false), voice('Otoya', 'ja-JP', false)], 'f')?.name).toBe('Google 日本語');
    expect(pickJapaneseVoice([EN], 'f')).toBeUndefined();
  });

  it('does not treat "female" as a male hint', () => {
    const voices = [voice('Some Female Voice', 'ja_JP'), voice('Plain', 'ja_JP')];
    expect(pickJapaneseVoice(voices, 'm')?.name).toBe('Plain');
    expect(pickJapaneseVoice(voices, 'f')?.name).toBe('Some Female Voice');
  });
});

// ---------- tts ----------

describe('WebSpeechTts', () => {
  it('speaks with a Japanese voice, resumes the queue first, and reports the voice name', async () => {
    install([EN, KYOKO]);
    const tts = quick();
    const started = vi.fn();
    const ended = vi.fn();
    await tts.speak('こんにちは。', { voice: 'f', onStart: started, onEnd: ended });
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]!.voice).toBe(KYOKO);
    expect(synth.spoken[0]!.lang).toBe('ja-JP');
    expect(synth.resumed).toBeGreaterThan(0);
    expect(started).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(tts.voiceName()).toBe('Kyoko');
    expect(tts.lastError()).toBeNull();
    expect(tts.simulated()).toBe(false);
    expect(tts.speaking()).toBe(false);
  });

  it('chains long text into several utterances and fires start/end once', async () => {
    install([KYOKO]);
    const tts = quick();
    const text = Array.from({ length: 10 }, () => 'これはながいぶんしょうのれんしゅうです。').join('');
    const started = vi.fn();
    const ended = vi.fn();
    await tts.speak(text, { onStart: started, onEnd: ended });
    expect(synth.spoken.length).toBeGreaterThan(1);
    expect(synth.spoken.map((u) => u.text).join('')).toBe(text);
    expect(started).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('matches ja_JP voices (Android underscores)', async () => {
    install([voice('Japanese', 'ja_JP')]);
    const tts = quick();
    expect(tts.hasJapaneseVoice()).toBe(true);
    await tts.speak('はい');
    expect(synth.spoken[0]!.voice?.name).toBe('Japanese');
  });

  it('with no Japanese voice, paces like speech, resolves, and says so', async () => {
    vi.useFakeTimers();
    install([EN]);
    const tts = quick();
    const started = vi.fn();
    const ended = vi.fn();
    await fast(tts.speak('はい', { onStart: started, onEnd: ended }));
    expect(synth.spoken).toHaveLength(0);
    expect(tts.simulated()).toBe(true);
    expect(tts.lastError()?.code).toBe('no-voice');
    expect(tts.hasJapaneseVoice()).toBe(false);
    expect(tts.voicesReady()).toBe(true);
    expect(started).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('without speech synthesis at all it still resolves and reports unavailable', async () => {
    vi.useFakeTimers();
    const tts = quick();
    expect(tts.available()).toBe(false);
    await fast(tts.speak('はい'));
    expect(tts.simulated()).toBe(true);
    expect(tts.lastError()?.code).toBe('unavailable');
  });

  it('retries once when voices arrive late via voiceschanged', async () => {
    install([]);
    const tts = quick();
    const p = tts.speak('こんにちは');
    setTimeout(() => {
      synth.voices = [KYOKO];
      synth.fireVoicesChanged();
    }, 10);
    await p;
    expect(synth.spoken).toHaveLength(1);
    expect(tts.simulated()).toBe(false);
  });

  it('retries when voices appear after a short delay without an event (Safari)', async () => {
    install([]);
    const tts = quick();
    const p = tts.speak('こんにちは');
    setTimeout(() => (synth.voices = [KYOKO]), 10);
    await p;
    expect(synth.spoken).toHaveLength(1);
  });

  it('cancels and defers the next speak when something is already speaking', async () => {
    install([KYOKO], 'hang');
    const tts = quick();
    const first = tts.speak('ながい');
    expect(synth.spoken).toHaveLength(1);
    synth.speaking = true;
    const second = tts.speak('つぎ');
    await first; // cancelled, so resolved rather than hanging
    expect(synth.cancelled).toBeGreaterThan(0);
    expect(synth.spoken).toHaveLength(1); // deferred, not raced with cancel()
    synth.mode = 'auto';
    await second;
    expect(synth.spoken.map((u) => u.text)).toEqual(['ながい', 'つぎ']);
  });

  it('does not defer when idle (keeps the user gesture on iOS)', () => {
    install([KYOKO], 'hang');
    const tts = quick();
    void tts.speak('はい');
    expect(synth.spoken).toHaveLength(1); // spoke synchronously
    tts.cancel();
  });

  it('cancel() resolves a pending speak', async () => {
    install([KYOKO], 'hang');
    const tts = quick();
    const p = tts.speak('はい');
    tts.cancel();
    await p;
    expect(tts.speaking()).toBe(false);
  });

  it('records not-allowed when the browser refuses speech, and still resolves', async () => {
    install([KYOKO], 'error');
    synth.errorCode = 'not-allowed';
    const tts = quick();
    await tts.speak('はい');
    expect(tts.lastError()).toEqual({ code: 'not-allowed', detail: 'not-allowed' });
  });

  it('a cancelled/interrupted utterance is not an error', async () => {
    install([KYOKO], 'error');
    synth.errorCode = 'interrupted';
    const tts = quick();
    await tts.speak('はい');
    expect(tts.lastError()).toBeNull();
  });

  it('safety timeout scales with length and a dead engine never hangs the promise', async () => {
    vi.useFakeTimers();
    install([KYOKO], 'hang');
    const tts = quick();
    let done = false;
    const p = tts.speak('こ'.repeat(100)).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(16000); // Chrome's old flat 15 s is not enough for 100 chars
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(40000);
    await p;
    expect(done).toBe(true);
    expect(tts.lastError()?.code).toBe('timeout');
  });

  it('speakSample reports whether it was audible', async () => {
    install([KYOKO]);
    const ok = await quick().speakSample();
    expect(ok).toEqual({ audible: true, voice: 'Kyoko', error: null });
    vi.useFakeTimers();
    install([EN]);
    const bad = await fast(quick().speakSample());
    expect(bad.audible).toBe(false);
    expect(bad.error?.code).toBe('no-voice');
  });

  it('unlock resumes the queue', () => {
    install([KYOKO], 'hang');
    quick().unlock();
    expect(synth.resumed).toBe(1);
  });
});

// ---------- stt ----------

describe('describeSttError', () => {
  it.each([
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'blocked'],
    ['no-speech', 'silent'],
    ['audio-capture', 'no-mic'],
    ['network', 'network'],
    ['aborted', 'cancelled'],
    ['language-not-supported', 'language'],
    ['bad-grammar', 'unknown'],
    ['unsupported', 'unsupported'],
    ['timeout', 'timeout'],
    ['something-new', 'unknown'],
    [undefined, 'unknown'],
  ])('%s -> %s', (code, id) => {
    expect(describeSttError(code)).toBe(id);
  });

  it('SttError exposes the id', () => {
    expect(new SttError('service-not-allowed').id).toBe('blocked');
  });
});

class FakeRec {
  static last: FakeRec;
  lang = '';
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  started = false;
  stopped = false;
  aborted = false;
  onstart: (() => void) | null = null;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  /** what the engine does after stop(): deliver the pending final text then end, or go quiet */
  onStop: () => void = () => this.onend?.();
  constructor() {
    FakeRec.last = this;
  }
  start() {
    this.started = true;
    this.onstart?.();
  }
  stop() {
    this.stopped = true;
    setTimeout(() => this.onStop(), 0);
  }
  abort() {
    this.aborted = true;
  }
  say(parts: Array<[string, boolean, number?]>) {
    const results = parts.map(([t, f, c]) => Object.assign([{ transcript: t, confidence: c ?? 0 }], { isFinal: f }));
    this.onresult?.({ results });
  }
}

describe('WebSpeechStt', () => {
  beforeEach(() => {
    g.webkitSpeechRecognition = FakeRec;
  });

  it('is unavailable and rejects as unsupported without an engine', async () => {
    delete g.webkitSpeechRecognition;
    const stt = new WebSpeechStt();
    expect(stt.available()).toBe(false);
    await expect(stt.listen('ja-JP').result).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('streams interim text and resolves with the final result', async () => {
    const stt = new WebSpeechStt();
    const interim: string[] = [];
    const s = stt.listen('ja-JP', (t) => interim.push(t));
    const rec = FakeRec.last;
    expect(rec.lang).toBe('ja-JP');
    expect(rec.continuous).toBe(false);
    rec.say([['こん', false]]);
    rec.say([['こんにちは', true, 0.9]]);
    rec.onend?.();
    await expect(s.result).resolves.toEqual({ text: 'こんにちは', confidence: 0.9 });
    expect(interim).toEqual(['こん']);
  });

  it('stop() resolves with the best interim result instead of losing it', async () => {
    const stt = new WebSpeechStt();
    const s = stt.listen('en-US');
    FakeRec.last.say([['I would like a coffee', false]]);
    s.stop();
    await expect(s.result).resolves.toMatchObject({ text: 'I would like a coffee' });
  });

  it('stop() rejects no-speech when nothing was heard', async () => {
    const stt = new WebSpeechStt();
    const s = stt.listen('en-US');
    s.stop();
    await expect(s.result).rejects.toMatchObject({ code: 'no-speech' });
  });

  it('settles after stop() even if the engine never fires end', async () => {
    vi.useFakeTimers();
    const stt = new WebSpeechStt({ stopGraceMs: 100 });
    const s = stt.listen('ja-JP');
    FakeRec.last.onStop = () => {}; // iOS: silence after stop
    FakeRec.last.say([['はい', false]]);
    s.stop();
    await vi.advanceTimersByTimeAsync(150);
    await expect(s.result).resolves.toMatchObject({ text: 'はい' });
    expect(FakeRec.last.aborted).toBe(true);
  });

  it('settles on a final result even when end never arrives', async () => {
    vi.useFakeTimers();
    const stt = new WebSpeechStt({ finalGraceMs: 50 });
    const s = stt.listen('ja-JP');
    FakeRec.last.say([['はい', true, 0.8]]);
    await vi.advanceTimersByTimeAsync(80);
    await expect(s.result).resolves.toMatchObject({ text: 'はい' });
  });

  it.each([
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'blocked'],
    ['no-speech', 'silent'],
    ['audio-capture', 'no-mic'],
    ['network', 'network'],
    ['language-not-supported', 'language'],
    ['bad-grammar', 'unknown'],
  ])('maps engine error %s to code and id %s', async (error, id) => {
    const s = new WebSpeechStt().listen('ja-JP');
    FakeRec.last.onerror?.({ error });
    FakeRec.last.onend?.(); // engines fire end after error; must not change the outcome
    const e = await s.result.catch((x) => x);
    expect(e).toBeInstanceOf(SttError);
    expect(e.code).toBe(error);
    expect(e.id).toBe(id);
  });

  it('an unknown engine error becomes "unknown"', async () => {
    const s = new WebSpeechStt().listen('ja-JP');
    FakeRec.last.onerror?.({ error: 'brand-new' });
    await expect(s.result).rejects.toMatchObject({ code: 'unknown' });
  });

  it('gives up with timeout when listening runs too long without speech', async () => {
    vi.useFakeTimers();
    const s = new WebSpeechStt({ maxListenMs: 200, stopGraceMs: 50 }).listen('ja-JP');
    const out = s.result.catch((e) => e);
    FakeRec.last.onStop = () => {};
    await vi.advanceTimersByTimeAsync(400);
    expect((await out).code).toBe('timeout');
  });

  it('gives up with timeout when the engine never starts', async () => {
    vi.useFakeTimers();
    FakeRec.prototype.start = function (this: FakeRec) {
      this.started = true; // no onstart: permission prompt ignored / dead service
    };
    const s = new WebSpeechStt({ startGuardMs: 300 }).listen('ja-JP');
    const out = s.result.catch((e) => e);
    await vi.advanceTimersByTimeAsync(400);
    expect((await out).code).toBe('timeout');
    FakeRec.prototype.start = function (this: FakeRec) {
      this.started = true;
      this.onstart?.();
    };
  });

  it('a new listen aborts the previous one', async () => {
    const stt = new WebSpeechStt();
    const a = stt.listen('ja-JP');
    stt.listen('ja-JP');
    await expect(a.result).rejects.toMatchObject({ code: 'aborted' });
  });
});

// ---------- diagnostics ----------

const CHROME_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
const IOS_SAFARI_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

function env(over: Partial<{ ua: string; secure: boolean; voices: V[]; stt: boolean; permission: string | Error; devices: number | Error; top: 'self' | 'other' | 'throws'; tts: boolean; platform: string; touch: number }> = {}): AudioEnv {
  const o = { ua: CHROME_UA, secure: true, voices: [KYOKO, EN], stt: true, permission: 'granted', devices: 1, top: 'self', tts: true, ...over };
  const win: any = {};
  win.top = o.top === 'self' ? win : o.top === 'other' ? {} : undefined;
  if (o.top === 'throws') Object.defineProperty(win, 'top', { get: () => { throw new DOMException('cross-origin', 'SecurityError'); } });
  const e: AudioEnv = {
    window: win,
    isSecureContext: o.secure,
    navigator: {
      userAgent: o.ua,
      platform: o.platform ?? 'Linux armv81',
      maxTouchPoints: o.touch ?? 5,
      permissions: {
        query: async () => {
          if (o.permission instanceof Error) throw o.permission;
          return { state: o.permission };
        },
      },
      mediaDevices: {
        enumerateDevices: async () => {
          if (o.devices instanceof Error) throw o.devices;
          return Array.from({ length: o.devices as number }, () => ({ kind: 'audioinput', label: '' }));
        },
      },
    },
  };
  if (o.tts) {
    e.speechSynthesis = { getVoices: () => o.voices, addEventListener() {}, removeEventListener() {} };
    e.SpeechSynthesisUtterance = FakeUtterance;
  }
  if (o.stt) e.webkitSpeechRecognition = FakeRec;
  return e;
}

const ids = (r: { issues: Array<{ id: AudioIssueId }> }) => r.issues.map((i) => i.id);
const report = (e: AudioEnv) => collectAudioReport(e, { voiceWaitMs: 0 });

describe('collectAudioReport', () => {
  it('https + Chrome with everything: no issues', async () => {
    const r = await report(env());
    expect(r).toMatchObject({
      secureContext: true,
      embedded: false,
      browser: 'chrome',
      ios: false,
      tts: { available: true, voicesReady: true, totalVoices: 2, jaVoices: [{ name: 'Kyoko', lang: 'ja-JP', local: true }] },
      stt: { available: true },
      mic: { permission: 'granted', devices: 1 },
    });
    expect(r.issues).toEqual([]);
  });

  it('embedded iframe is flagged (and a cross-origin top that throws counts as embedded)', async () => {
    const r = await report(env({ top: 'other', permission: 'denied' }));
    expect(r.embedded).toBe(true);
    expect(ids(r)).toEqual(expect.arrayContaining(['embedded', 'mic-denied']));
    expect(r.issues.find((i) => i.id === 'embedded')?.severity).toBe('warn');
    expect((await report(env({ top: 'throws' }))).embedded).toBe(true);
  });

  it('Firefox has no speech recognition: warn, not blocker; mic permission query may throw', async () => {
    const r = await report(env({ ua: FIREFOX_UA, stt: false, permission: new TypeError('microphone is not a valid permission name') }));
    expect(r.browser).toBe('firefox');
    expect(r.stt.available).toBe(false);
    expect(r.mic.permission).toBe('unknown');
    expect(ids(r)).toEqual(['no-stt']);
    expect(r.issues[0]!.severity).toBe('warn');
  });

  it('no Japanese voice is a blocker for speaking', async () => {
    const r = await report(env({ voices: [EN] }));
    expect(r.tts.jaVoices).toEqual([]);
    expect(r.tts.totalVoices).toBe(1);
    expect(r.issues).toContainEqual({ id: 'no-ja-voice', severity: 'blocker' });
  });

  it('no speech synthesis at all', async () => {
    const r = await report(env({ tts: false }));
    expect(r.tts.available).toBe(false);
    expect(ids(r)).toContain('no-tts');
    expect(ids(r)).not.toContain('no-ja-voice');
  });

  it('mic denied is a blocker', async () => {
    const r = await report(env({ permission: 'denied' }));
    expect(r.issues).toEqual([{ id: 'mic-denied', severity: 'blocker' }]);
  });

  it('mic prompt is only info', async () => {
    const r = await report(env({ permission: 'prompt' }));
    expect(r.issues).toEqual([{ id: 'mic-prompt', severity: 'info' }]);
  });

  it('insecure context is a blocker', async () => {
    const r = await report(env({ secure: false, permission: 'unknown', devices: new Error('no mediaDevices') }));
    expect(r.secureContext).toBe(false);
    expect(r.mic.devices).toBeNull();
    expect(r.issues[0]).toEqual({ id: 'insecure', severity: 'blocker' });
  });

  it('detects a missing microphone on Chrome, but not a hidden device list on Safari', async () => {
    expect(ids(await report(env({ devices: 0, permission: 'prompt' })))).toContain('no-mic');
    const safari = await report(env({ ua: IOS_SAFARI_UA, devices: 0, permission: 'unknown' }));
    expect(ids(safari)).not.toContain('no-mic');
  });

  it('iOS Safari: detected, with the gesture hint', async () => {
    const r = await report(env({ ua: IOS_SAFARI_UA, permission: 'unknown' }));
    expect(r.browser).toBe('safari');
    expect(r.ios).toBe(true);
    expect(r.issues).toContainEqual({ id: 'ios-gesture', severity: 'info' });
  });

  it('iPadOS pretending to be a Mac is still iOS', async () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
    expect((await report(env({ ua: mac, platform: 'MacIntel', touch: 5 }))).ios).toBe(true);
    expect((await report(env({ ua: mac, platform: 'MacIntel', touch: 0 }))).ios).toBe(false);
  });

  it('waits for late voices before concluding there are none', async () => {
    const e = env({ voices: [] });
    setTimeout(() => (e.speechSynthesis.getVoices = () => [KYOKO]), 20);
    const r = await collectAudioReport(e, { voiceWaitMs: 300 });
    expect(r.tts.jaVoices).toHaveLength(1);
  });

  it('detectBrowser tells the Chromium family apart', () => {
    expect(detectBrowser('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0')).toBe('edge');
    expect(detectBrowser('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0 SamsungBrowser/25.0 Mobile Safari/537.36')).toBe('samsung');
    expect(detectBrowser(CHROME_UA)).toBe('chrome');
    expect(detectBrowser('Mozilla/5.0 (iPhone) AppleWebKit/605 Version/17 Mobile Safari/604')).toBe('safari');
    expect(detectBrowser('curl/8')).toBe('other');
  });
});

describe('requestMicrophone', () => {
  const withGum = (gum: () => Promise<unknown>, over: Parameters<typeof env>[0] = {}) => {
    const e = env(over);
    e.navigator.mediaDevices.getUserMedia = gum;
    return e;
  };
  const domErr = (name: string) => Object.assign(new Error(name), { name });

  it('succeeds and releases the microphone immediately', async () => {
    const stop = vi.fn();
    const e = withGum(async () => ({ getTracks: () => [{ stop }, { stop }] }));
    expect(await requestMicrophone(e)).toEqual({ ok: true });
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['PermissionDeniedError', 'denied'],
    ['NotFoundError', 'no-device'],
    ['SecurityError', 'blocked'],
    ['NotReadableError', 'unknown'],
  ])('%s -> %s', async (name, reason) => {
    const e = withGum(async () => Promise.reject(domErr(name)));
    expect(await requestMicrophone(e)).toEqual({ ok: false, reason });
  });

  it('a refusal inside an iframe is reported as blocked, not denied', async () => {
    const e = withGum(async () => Promise.reject(domErr('NotAllowedError')), { top: 'other' });
    expect(await requestMicrophone(e)).toEqual({ ok: false, reason: 'blocked' });
  });

  it('refuses insecure contexts without asking', async () => {
    const gum = vi.fn();
    const e = withGum(gum, { secure: false });
    expect(await requestMicrophone(e)).toEqual({ ok: false, reason: 'insecure' });
    expect(gum).not.toHaveBeenCalled();
  });

  it('reports unknown when mediaDevices is missing', async () => {
    const e = env();
    delete e.navigator.mediaDevices;
    expect(await requestMicrophone(e)).toEqual({ ok: false, reason: 'unknown' });
  });
});

describe('explainSttError', () => {
  it('reports a blocked page instead of a refusal when embedded', () => {
    const err = new SttError('not-allowed');
    expect(explainSttError(err, env())).toBe('denied');
    expect(explainSttError(err, env({ top: 'other' }))).toBe('blocked');
    expect(explainSttError(err, env({ top: 'throws' }))).toBe('blocked');
    expect(explainSttError({ code: 'no-speech' }, env({ top: 'other' }))).toBe('silent');
  });
});
