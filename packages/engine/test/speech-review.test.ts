import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSpeechStt, WebSpeechTts, collectAudioReport, requestMicrophone, waitForVoices } from '../src';

// Regression tests for races and leaks found while reviewing the speech stack against real browser behaviour.

type V = { name: string; lang: string; localService: boolean };
const voice = (name: string, lang: string): V => ({ name, lang, localService: true });
const KYOKO = voice('Kyoko', 'ja-JP');
const EN = voice('Samantha', 'en-US');

class Utt {
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

/** speak() never reports anything on its own; tests deliver events by hand, like a slow engine would. */
class Synth {
  spoken: Utt[] = [];
  speaking = false;
  pending = false;
  private listeners: Array<() => void> = [];
  constructor(public voices: V[]) {}
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
  resume() {}
  speak(u: Utt) {
    this.spoken.push(u);
  }
  cancel() {
    this.speaking = false;
  }
}

const g = globalThis as any;
let synth: Synth;
const install = (voices: V[]) => {
  synth = new Synth(voices);
  g.speechSynthesis = synth;
  g.SpeechSynthesisUtterance = Utt;
};

beforeEach(() => {
  delete g.speechSynthesis;
  delete g.SpeechSynthesisUtterance;
  delete g.webkitSpeechRecognition;
});
afterEach(() => {
  vi.useRealTimers();
  delete g.speechSynthesis;
  delete g.SpeechSynthesisUtterance;
  delete g.webkitSpeechRecognition;
});

describe('WebSpeechTts stale events from a cancelled speak', () => {
  /** speak A, then B on top of it (A is cancelled, B is deferred then spoken), A's utterance is now stale */
  async function replaced() {
    vi.useFakeTimers();
    install([KYOKO]);
    const tts = new WebSpeechTts({ voiceWaitMs: 40, deferMs: 5 });
    void tts.speak('ながい');
    synth.speaking = true;
    let doneB = false;
    const b = tts.speak('つぎ').then(() => (doneB = true));
    await vi.advanceTimersByTimeAsync(10);
    expect(synth.spoken.map((u) => u.text)).toEqual(['ながい', 'つぎ']);
    return { tts, b, isDone: () => doneB };
  }

  it('a late end event from the old utterance does not disarm the new one safety timeout', async () => {
    const { tts, b, isDone } = await replaced();
    synth.spoken[0]!.onend?.(); // Chrome delivers the old end asynchronously, after the new speak has begun
    expect(isDone()).toBe(false);
    await vi.advanceTimersByTimeAsync(60000); // engine never reports for B: must still give up, not hang
    await b;
    expect(isDone()).toBe(true);
    expect(tts.lastError()?.code).toBe('timeout');
  });

  it('a late error from the old utterance does not become the new speak error or end it', async () => {
    const { tts, isDone } = await replaced();
    synth.spoken[0]!.onerror?.({ error: 'synthesis-failed' });
    expect(tts.lastError()).toBeNull();
    expect(tts.speaking()).toBe(true);
    expect(isDone()).toBe(false);
    tts.cancel();
  });
});

describe('late voices', () => {
  it('waits for a Japanese voice when only other voices are reported first (Chrome reports in stages)', async () => {
    install([EN]);
    const tts = new WebSpeechTts({ voiceWaitMs: 200, deferMs: 5 });
    const p = tts.speak('こんにちは');
    setTimeout(() => {
      synth.voices = [EN, KYOKO];
      synth.fireVoicesChanged();
    }, 20);
    await vi.waitFor(() => expect(synth.spoken).toHaveLength(1), { timeout: 1000 });
    expect(synth.spoken[0]!.voice).toEqual(KYOKO);
    expect(tts.simulated()).toBe(false);
    tts.cancel();
    await p;
  });

  it('collectAudioReport does not report a missing Japanese voice while it is still arriving', async () => {
    const e: any = { speechSynthesis: new Synth([EN]), SpeechSynthesisUtterance: Utt, navigator: { userAgent: '' } };
    setTimeout(() => (e.speechSynthesis.voices = [EN, KYOKO]), 20);
    const r = await collectAudioReport(e, { voiceWaitMs: 300 });
    expect(r.tts.jaVoices).toHaveLength(1);
    expect(r.issues.map((i) => i.id)).not.toContain('no-ja-voice');
  });

  it('waitForVoices honours the predicate and still gives up at the deadline', async () => {
    vi.useFakeTimers();
    const s = new Synth([EN]);
    let done = false;
    const p = waitForVoices(s, 100, (v) => v.some((x) => x.lang === 'ja-JP')).then(() => (done = true));
    s.fireVoicesChanged(); // an event without a match must not end the wait
    await vi.advanceTimersByTimeAsync(60);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(60);
    await p;
    expect(done).toBe(true);
  });
});

class Rec {
  static last: Rec;
  static syncStart = false;
  lang = '';
  aborted = 0;
  onstart: (() => void) | null = null;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  constructor() {
    Rec.last = this;
  }
  start() {
    if (Rec.syncStart) this.onstart?.();
  }
  stop() {}
  abort() {
    this.aborted++;
  }
  say(text: string, final: boolean) {
    this.onresult?.({ results: [Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: final })] });
  }
}

describe('WebSpeechStt releases the engine', () => {
  beforeEach(() => {
    g.webkitSpeechRecognition = Rec;
    Rec.syncStart = false;
  });

  it('aborts the recogniser when it settles on a final result without an end event (iOS leaves the mic on otherwise)', async () => {
    vi.useFakeTimers();
    const s = new WebSpeechStt({ finalGraceMs: 50 }).listen('ja-JP');
    Rec.last.onstart?.();
    Rec.last.say('はい', true);
    await vi.advanceTimersByTimeAsync(80);
    await expect(s.result).resolves.toMatchObject({ text: 'はい' });
    expect(Rec.last.aborted).toBeGreaterThan(0);
  });

  it('does not let the start guard kill a session whose start event fired synchronously', async () => {
    vi.useFakeTimers();
    Rec.syncStart = true;
    const s = new WebSpeechStt({ startGuardMs: 100, maxListenMs: 5000 }).listen('ja-JP');
    let settled = false;
    s.result.then(() => (settled = true), () => (settled = true));
    await vi.advanceTimersByTimeAsync(300);
    expect(settled).toBe(false); // still listening, as the engine reported start
    s.abort();
    await expect(s.result).rejects.toMatchObject({ code: 'aborted' });
  });
});

describe('requestMicrophone when the prompt is never answered (Firefox)', () => {
  const env = (gum: () => Promise<unknown>): any => ({ isSecureContext: true, navigator: { mediaDevices: { getUserMedia: gum } } });

  it('gives up after the timeout instead of hanging, and releases a stream that arrives late', async () => {
    vi.useFakeTimers();
    let grant!: (s: unknown) => void;
    const stop = vi.fn();
    const r = requestMicrophone(env(() => new Promise((res) => (grant = res))), { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1500);
    expect(await r).toEqual({ ok: false, reason: 'unknown' });
    grant({ getTracks: () => [{ stop }] });
    await vi.advanceTimersByTimeAsync(0);
    expect(stop).toHaveBeenCalledTimes(1); // no leaked capture
  });

  it('still reports a quick refusal normally and does not leave a timer behind', async () => {
    vi.useFakeTimers();
    const r = await requestMicrophone(env(() => Promise.reject(Object.assign(new Error('x'), { name: 'NotAllowedError' }))), { timeoutMs: 1000 });
    expect(r).toEqual({ ok: false, reason: 'denied' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
