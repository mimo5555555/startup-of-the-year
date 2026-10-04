import { WebSpeechStt, WebSpeechTts, collectAudioReport, requestMicrophone, type SpeakOptions } from '@lw/engine';

// One speech stack for the whole app. Native builds replace these with on-device engines.
export const tts = new WebSpeechTts();
export const stt = new WebSpeechStt();

/** Single facade for the audio self-check and test buttons; the UI maps issue ids and error codes to strings. */
export const audio = {
  report: () => collectAudioReport(),
  requestMic: () => requestMicrophone(),
  speakSample: () => tts.speakSample(),
  tts,
  stt,
};

export function speakJa(text: string, o: SpeakOptions = {}) {
  return tts.speak(text, o);
}

let uiCtx: AudioContext | null = null;

/** Tiny UI sounds made with the Web Audio API, so no audio files ship. */
export function blip(kind: 'tap' | 'good' | 'bad' | 'level' = 'tap', enabled = true) {
  if (!enabled) return;
  try {
    const Ctx = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!Ctx) return;
    uiCtx ??= new Ctx();
    const ctx = uiCtx!;
    if (ctx.state === 'suspended') void ctx.resume();
    const notes: Record<string, number[]> = { tap: [660], good: [660, 880], bad: [220], level: [523, 659, 784, 1046] };
    const now = ctx.currentTime;
    notes[kind].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === 'bad' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.12, now + i * 0.09 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.09 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.09);
      o.stop(now + i * 0.09 + 0.2);
    });
  } catch {
    /* audio is optional */
  }
}

export function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

/** Browsers only start speech and audio after a gesture; do the unlocking on the first one (tts.unlock also resumes speechSynthesis). */
export function unlockOnFirstGesture() {
  // only events that count as user activation: a touch pointerdown does not, so unlocking there would be wasted (iOS)
  const events = ['pointerup', 'touchend', 'click', 'keydown'] as const;
  let done = false;
  const unlock = () => {
    if (done) return;
    done = true;
    events.forEach((ev) => window.removeEventListener(ev, unlock));
    tts.unlock();
    try {
      const Ctx = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
      if (Ctx) uiCtx ??= new Ctx();
      void uiCtx?.resume();
    } catch {
      /* optional */
    }
  };
  events.forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
}
