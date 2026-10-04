import { WebSpeechStt, WebSpeechTts, type SpeakOptions } from '@lw/engine';

// One speech stack for the whole app. Native builds replace these with on-device engines.
export const tts = new WebSpeechTts();
export const stt = new WebSpeechStt();

export function speakJa(text: string, o: SpeakOptions = {}) {
  return tts.speak(text, o);
}

let audio: AudioContext | null = null;

/** Tiny UI sounds made with the Web Audio API, so no audio files ship. */
export function blip(kind: 'tap' | 'good' | 'bad' | 'level' = 'tap', enabled = true) {
  if (!enabled) return;
  try {
    const Ctx = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    const ctx = audio!;
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

/** Browsers only start speech and audio after a gesture; do the unlocking on the first touch. */
export function unlockOnFirstGesture() {
  const unlock = () => {
    tts.unlock();
    blip('tap', false);
    try {
      (globalThis as any).AudioContext && (audio ??= new (globalThis as any).AudioContext());
      void audio?.resume();
    } catch {
      /* optional */
    }
  };
  window.addEventListener('pointerdown', unlock, { once: true, passive: true });
}
