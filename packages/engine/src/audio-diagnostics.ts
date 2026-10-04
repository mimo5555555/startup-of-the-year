// Audio self-check: what can this browser/device do for speech and the microphone, and what is in the way.
// Pure functions over an injectable environment so they run against fakes in tests. No prose here:
// the UI maps AudioIssue ids to localized strings.

import { SttError, describeSttError, isJapaneseVoice, waitForVoices, type SttErrorId } from './speech';

const hasJa = (voices: any[]) => voices.some(isJapaneseVoice);

export type BrowserId ='chrome' | 'edge' | 'safari' | 'firefox' | 'samsung' | 'other';
export type MicPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

export type AudioIssueId = 'insecure' | 'embedded' | 'no-tts' | 'no-ja-voice' | 'no-stt' | 'mic-denied' | 'mic-prompt' | 'no-mic' | 'ios-gesture';

export interface AudioIssue {
  id: AudioIssueId;
  /** blocker: that feature cannot work until fixed; warn: degraded; info: a hint */
  severity: 'blocker' | 'warn' | 'info';
}

export interface AudioReport {
  secureContext: boolean;
  /** running inside an iframe (window !== window.top); cross-origin access errors count as embedded */
  embedded: boolean;
  browser: BrowserId;
  ios: boolean;
  tts: {
    available: boolean;
    voicesReady: boolean;
    totalVoices: number;
    jaVoices: Array<{ name: string; lang: string; local: boolean }>;
  };
  stt: { available: boolean };
  mic: { permission: MicPermission; devices: number | null };
  issues: AudioIssue[];
}

/** A window-like global (defaults to globalThis). Tests pass plain objects. */
export type AudioEnv = Record<string, any>;

export interface CollectOptions {
  /** how long to wait for a Japanese voice to be reported before concluding there is none (ms) */
  voiceWaitMs?: number;
}

export interface MicRequestOptions {
  /** Firefox leaves getUserMedia pending when its prompt is dismissed; give up after this (ms) */
  timeoutMs?: number;
}

export type MicFailure = 'denied' | 'no-device' | 'insecure' | 'blocked' | 'unknown';
export type MicResult = { ok: true } | { ok: false; reason: MicFailure };

const genv = (env?: AudioEnv): AudioEnv => env ?? (globalThis as AudioEnv);

export function detectBrowser(ua: string): BrowserId {
  if (/SamsungBrowser/i.test(ua)) return 'samsung';
  if (/Edg(e|A|iOS)?\//i.test(ua)) return 'edge';
  if (/Firefox|FxiOS/i.test(ua)) return 'firefox';
  if (/OPR\/|Opera|OPiOS|Vivaldi|DuckDuckGo/i.test(ua)) return 'other';
  if (/Chrome|CriOS|Chromium/i.test(ua)) return 'chrome';
  if (/Safari/i.test(ua)) return 'safari';
  return 'other';
}

export function detectIos(nav: AudioEnv | undefined): boolean {
  const ua = String(nav?.userAgent ?? '');
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS reports a Mac
  return nav?.platform === 'MacIntel' && Number(nav?.maxTouchPoints ?? 0) > 1;
}

export function detectEmbedded(env: AudioEnv): boolean {
  try {
    const w = env.window ?? env.self;
    if (!w) return false;
    const top = w.top;
    // a null/undefined top on a window means we are detached; treat as not embedded
    return !!top && top !== w;
  } catch {
    return true; // touching a cross-origin top throws
  }
}

function detectSecure(env: AudioEnv): boolean {
  if (typeof env.isSecureContext === 'boolean') return env.isSecureContext;
  const p = env.location?.protocol;
  const h = env.location?.hostname;
  return p === 'https:' || h === 'localhost' || h === '127.0.0.1';
}

function readVoices(synth: any): any[] {
  try {
    return Array.from(synth?.getVoices?.() ?? []);
  } catch {
    return [];
  }
}

export function recognitionAvailable(env: AudioEnv): boolean {
  return typeof (env.SpeechRecognition ?? env.webkitSpeechRecognition) === 'function';
}

const CHROMIUM: BrowserId[] = ['chrome', 'edge', 'samsung'];

/** Turn a report (without issues) into the list of things the user should know about, most important first. */
export function deriveAudioIssues(r: Omit<AudioReport, 'issues'>): AudioIssue[] {
  const out: AudioIssue[] = [];
  const add = (id: AudioIssueId, severity: AudioIssue['severity']) => out.push({ id, severity });
  if (!r.secureContext) add('insecure', 'blocker');
  if (r.embedded) add('embedded', 'warn');
  if (!r.tts.available) add('no-tts', 'blocker');
  else if (r.tts.jaVoices.length === 0) add('no-ja-voice', 'blocker');
  if (!r.stt.available) add('no-stt', 'warn');
  if (r.mic.permission === 'denied') add('mic-denied', 'blocker');
  else if (r.mic.permission === 'prompt' && r.secureContext) add('mic-prompt', 'info');
  // device lists are hidden before permission on Safari/Firefox, so zero only means "none" where the list is trustworthy
  if (r.mic.devices === 0 && r.secureContext && (r.mic.permission === 'granted' || CHROMIUM.includes(r.browser))) add('no-mic', 'blocker');
  if (r.ios && r.tts.available) add('ios-gesture', 'info');
  return out;
}

async function micPermission(nav: AudioEnv | undefined): Promise<MicPermission> {
  try {
    const s = (await nav?.permissions?.query({ name: 'microphone' }))?.state;
    return s === 'granted' || s === 'denied' || s === 'prompt' ? s : 'unknown';
  } catch {
    return 'unknown'; // Safari / Firefox may throw for 'microphone'
  }
}

async function micDevices(nav: AudioEnv | undefined): Promise<number | null> {
  try {
    if (!nav?.mediaDevices?.enumerateDevices) return null;
    const list: Array<{ kind: string }> = await nav.mediaDevices.enumerateDevices();
    return list.filter((d) => d.kind === 'audioinput').length;
  } catch {
    return null;
  }
}

export async function collectAudioReport(env?: AudioEnv, opts: CollectOptions = {}): Promise<AudioReport> {
  const e = genv(env);
  const nav = e.navigator;
  const synth = e.speechSynthesis;
  const ttsAvailable = !!synth && typeof e.SpeechSynthesisUtterance === 'function';
  // local voices can arrive before the rest (Chrome): wait for a Japanese one, not just any
  if (ttsAvailable && !hasJa(readVoices(synth))) await waitForVoices(synth, opts.voiceWaitMs ?? 600, hasJa);
  const voices = ttsAvailable ? readVoices(synth) : [];
  const [permission, devices] = await Promise.all([micPermission(nav), micDevices(nav)]);
  const base: Omit<AudioReport, 'issues'> = {
    secureContext: detectSecure(e),
    embedded: detectEmbedded(e),
    browser: detectBrowser(String(nav?.userAgent ?? '')),
    ios: detectIos(nav),
    tts: {
      available: ttsAvailable,
      voicesReady: voices.length > 0,
      totalVoices: voices.length,
      jaVoices: voices.filter(isJapaneseVoice).map((v) => ({ name: String(v.name), lang: String(v.lang), local: !!v.localService })),
    },
    stt: { available: recognitionAvailable(e) },
    mic: { permission, devices },
  };
  return { ...base, issues: deriveAudioIssues(base) };
}

/**
 * Ask for the microphone (shows the browser prompt) and release it at once.
 * Call from a user gesture. Resolves, never throws; a stream that arrives after the timeout is released too.
 */
export async function requestMicrophone(env?: AudioEnv, opts: MicRequestOptions = {}): Promise<MicResult> {
  const e = genv(env);
  if (!detectSecure(e)) return { ok: false, reason: 'insecure' };
  const md = e.navigator?.mediaDevices;
  if (!md?.getUserMedia) return { ok: false, reason: 'unknown' };
  const release = (stream: any) => {
    try {
      stream?.getTracks?.().forEach((t: { stop(): void }) => t.stop());
    } catch {
      /* ignore */
    }
  };
  try {
    const asked: Promise<any> = Promise.resolve(md.getUserMedia({ audio: true }));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const waited = new Promise<'timeout'>((res) => {
      timer = setTimeout(() => res('timeout'), opts.timeoutMs ?? 45000);
    });
    const got = await Promise.race([asked, waited]).finally(() => timer && clearTimeout(timer));
    if (got === 'timeout') {
      asked.then(release, () => {}); // the user may still answer the prompt later
      return { ok: false, reason: 'unknown' };
    }
    release(got);
    return { ok: true };
  } catch (err) {
    const name = String((err as { name?: string } | null)?.name ?? '');
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return { ok: false, reason: 'no-device' };
    if (name === 'SecurityError') return { ok: false, reason: 'blocked' };
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return { ok: false, reason: detectEmbedded(e) ? 'blocked' : 'denied' };
    return { ok: false, reason: 'unknown' };
  }
}

/**
 * Stable UI id for a recognition error. A refusal inside an iframe is reported as 'blocked': the page cannot be
 * granted the microphone there, so telling the user to "allow" it would send them in circles.
 */
export function explainSttError(e: unknown, env?: AudioEnv): SttErrorId {
  const id = describeSttError(e instanceof SttError ? e.code : (e as { code?: unknown } | null)?.code);
  return id === 'denied' && detectEmbedded(genv(env)) ? 'blocked' : id;
}
