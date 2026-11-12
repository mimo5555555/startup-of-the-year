import { describe, expect, it } from 'vitest';
import { LEXICON, SCENARIOS, resolveLine } from '@lw/content';
import { NullTts, collectAudioReport } from '@lw/engine';
import { splitSentences, voiceEntryKey, voiceTextKey, type VoiceManifest } from '../src/voice/key';
import { RecordedVoiceTts, withRecordedVoices, type AudioLike } from '../src/voice/RecordedVoiceTts';
import { CUSTOMER, NARRATOR, VOICE_CREDITS, VOICE_SPEAKERS } from '../src/voice/voices';
import { voiceLines } from '../../../tools/voice/lines';

/** An audio element that plays (or fails) when the test says so. */
class FakeAudio implements AudioLike {
  src = '';
  playbackRate = 1;
  preservesPitch = false;
  played: string[] = [];
  paused = 0;
  private fns = new Map<string, Set<() => void>>();
  constructor(private mode: 'ok' | 'error' | 'reject' | 'manual' = 'ok') {}
  addEventListener(t: string, fn: () => void) {
    if (!this.fns.has(t)) this.fns.set(t, new Set());
    this.fns.get(t)!.add(fn);
  }
  removeEventListener(t: string, fn: () => void) {
    this.fns.get(t)?.delete(fn);
  }
  emit(t: string) {
    for (const fn of [...(this.fns.get(t) ?? [])]) fn();
  }
  play() {
    if (this.src.startsWith('data:')) return Promise.resolve();
    this.played.push(this.src);
    if (this.mode === 'reject') return Promise.reject(new Error('NotAllowedError'));
    if (this.mode === 'error') {
      // a missing or broken file: the element reports an error and play() rejects (NotSupportedError)
      setTimeout(() => this.emit('error'), 0);
      return new Promise<void>((_, reject) => setTimeout(() => reject(new Error('NotSupportedError')), 1));
    }
    if (this.mode === 'ok')
      setTimeout(() => {
        this.emit('playing');
        this.emit('ended');
      }, 0);
    // play() settles once playback starts
    return this.mode === 'manual' ? new Promise<void>((res) => this.addEventListener('playing', res)) : Promise.resolve();
  }
  pause() {
    this.paused++;
  }
}

const MANIFEST: VoiceManifest = {
  v: 1,
  voices: { kenji: 13, narrator: 29 },
  entries: { [voiceEntryKey('kenji', 'いらっしゃい！')]: 'aaa111', [voiceEntryKey(NARRATOR, 'お水|を|ください|。')]: 'bbb222' },
};
const make = (audio: FakeAudio, manifest: VoiceManifest | null = MANIFEST) => {
  const inner = new NullTts();
  const tts = new RecordedVoiceTts(inner, { base: 'voice/', fetchManifest: async () => manifest, createAudio: () => audio, startMs: 50 });
  return { inner, tts };
};

describe('recorded voice key', () => {
  it('ignores markup bars, spaces, width and the closing punctuation', () => {
    expect(voiceTextKey('お水|を|ください|。')).toBe('お水をください');
    expect(voiceTextKey(' お水 を ください！')).toBe('お水をください');
    expect(voiceTextKey('はい、どうぞ？')).toBe('はい、どうぞ');
    expect(voiceTextKey('ｺｰﾋｰ')).toBe('コーヒー'); // NFKC
    expect(voiceEntryKey('mio', 'ね！')).toBe('mio|ね');
  });
});

describe('RecordedVoiceTts', () => {
  it('plays the speaker’s file, else the narrator’s, at the asked rate', async () => {
    const a = new FakeAudio();
    const { inner, tts } = make(a);
    const ends: string[] = [];
    await tts.speak('いらっしゃい', { who: 'kenji', rate: 0.58, onStart: () => ends.push('start'), onEnd: () => ends.push('end') });
    expect(a.played).toEqual(['voice/aaa111.mp3']);
    expect(a.playbackRate).toBe(0.58);
    expect(ends).toEqual(['start', 'end']);
    await tts.speak('お水をください。', { who: 'mio' }); // no Mio recording: the narrator's
    expect(a.played[1]).toBe('voice/bbb222.mp3');
    await tts.speak('いらっしゃい'); // a replayed line, no speaker given: Kenji's recording
    expect(a.played[2]).toBe('voice/aaa111.mp3');
    expect(inner.spoken).toEqual([]);
    expect(tts.stats).toMatchObject({ recorded: 3, fallback: 0 });
    expect(tts.hasJapaneseVoice()).toBe(true);
    expect(tts.lastError()).toBeNull();
  });

  it('falls back to the device voice with no file, a failed file, a refused play or no manifest', async () => {
    const one = make(new FakeAudio());
    await one.tts.speak('こんばんは', { who: 'kenji' });
    expect(one.inner.spoken).toEqual(['こんばんは']);
    expect(one.tts.stats.missed).toEqual(['kenji|こんばんは']);
    for (const mode of ['error', 'reject', 'manual'] as const) {
      const m = make(new FakeAudio(mode)); // manual: never starts, the start guard gives up
      await m.tts.speak('いらっしゃい', { who: 'kenji' });
      expect(m.inner.spoken).toEqual(['いらっしゃい']);
      expect(m.tts.stats.fallback).toBe(1);
    }
    const none = make(new FakeAudio(), null);
    await none.tts.speak('いらっしゃい', { who: 'kenji' });
    expect(none.inner.spoken).toEqual(['いらっしゃい']);
    expect(none.tts.recorded()).toBe(false);
    expect(none.tts.hasJapaneseVoice()).toBe(false); // NullTts has none either
  });

  it('cancel() and the next speak() end the playing line without falling back', async () => {
    const a = new FakeAudio('manual');
    const { inner, tts } = make(a);
    await tts.load();
    let ended = 0;
    const p = tts.speak('いらっしゃい', { who: 'kenji', onEnd: () => ended++ });
    await new Promise((r) => setTimeout(r, 0));
    a.emit('playing');
    expect(tts.speaking()).toBe(true);
    tts.cancel();
    await p;
    expect(ended).toBe(1);
    expect(a.paused).toBeGreaterThan(0);
    expect(tts.speaking()).toBe(false);
    const q = tts.speak('いらっしゃい', { who: 'kenji' });
    await new Promise((r) => setTimeout(r, 0));
    a.emit('playing');
    const r2 = tts.speak('お水をください'); // replaces the first
    await q;
    await new Promise((r) => setTimeout(r, 0));
    a.emit('playing');
    a.emit('ended');
    await r2;
    expect(inner.spoken).toEqual([]);
  });

  it('never hangs on a file that starts but never ends', async () => {
    const a = new FakeAudio('manual');
    const tts = new RecordedVoiceTts(new NullTts(), { base: 'voice/', fetchManifest: async () => MANIFEST, createAudio: () => a, maxMs: 30 });
    const p = tts.speak('いらっしゃい', { who: 'kenji' });
    await new Promise((r) => setTimeout(r, 0));
    a.emit('playing');
    await p;
    expect(tts.stats.recorded).toBe(1);
  });

  it('makes the audio report ready when there are recordings', async () => {
    const r = await collectAudioReport({ navigator: { userAgent: 'x' }, isSecureContext: true });
    expect(r.issues.map((i) => i.id)).toContain('no-tts');
    const w = withRecordedVoices(r, true);
    expect(w.tts.available).toBe(true);
    expect(w.issues.map((i) => i.id)).not.toContain('no-tts');
    expect(w.issues.map((i) => i.id)).not.toContain('no-ja-voice');
    expect(withRecordedVoices(r, false)).toBe(r);
  });
});

describe('a line that greets the player by name', () => {
  /** a device that has a Japanese voice (NullTts has none) */
  class JaTts extends NullTts {
    override hasJapaneseVoice() {
      return true;
    }
  }
  const NAMED: VoiceManifest = {
    v: 1,
    voices: { kenji: 13, narrator: 29 },
    entries: {
      [voiceEntryKey('kenji', 'いらっしゃい！')]: 'aaa111',
      [voiceEntryKey('kenji', 'いつもありがとうございます。')]: 'ccc333',
      [voiceEntryKey(NARRATOR, 'お水をください。')]: 'bbb222',
    },
  };
  const LINE = 'サムさん！いらっしゃい！いつもありがとうございます。';
  const build = (inner: NullTts, audio = new FakeAudio(), name: string | null = 'サム') => {
    const tts = new RecordedVoiceTts(inner, { base: 'voice/', fetchManifest: async () => NAMED, createAudio: () => audio, startMs: 50 });
    tts.setPlayerName(name);
    return { tts, audio, inner };
  };

  it('splits a line into its sentences, each with its closing punctuation', () => {
    expect(splitSentences(LINE)).toEqual(['サムさん！', 'いらっしゃい！', 'いつもありがとうございます。']);
    expect(splitSentences('あっ、落ちました…。もう一回！')).toEqual(['あっ、落ちました…。', 'もう一回！']);
    expect(splitSentences('{name}|さん！|いつも|ありがとう|ございます。').map((x) => voiceTextKey(x))).toEqual(['{name}さん', 'いつもありがとうございます']);
    expect(splitSentences('こんにちは')).toEqual(['こんにちは']);
  });

  it('plays the recorded sentences in the speaker’s voice and hands only the name to the device voice, with one start and one end', async () => {
    const { tts, audio, inner } = build(new JaTts());
    let starts = 0;
    let ends = 0;
    await tts.speak(LINE, { who: 'kenji', onStart: () => starts++, onEnd: () => ends++ });
    expect(inner.spoken).toEqual(['サムさん！']);
    expect(audio.played).toEqual(['voice/aaa111.mp3', 'voice/ccc333.mp3']);
    expect([starts, ends]).toEqual([1, 1]);
    expect(tts.stats).toMatchObject({ recorded: 1, fallback: 0 });
  });

  it('leaves the name out on a device with no Japanese voice: the recorded sentences still play', async () => {
    const { tts, audio, inner } = build(new NullTts());
    let ends = 0;
    await tts.speak(LINE, { who: 'kenji', onEnd: () => ends++ });
    expect(inner.spoken).toEqual([]);
    expect(audio.played).toEqual(['voice/aaa111.mp3', 'voice/ccc333.mp3']);
    expect(ends).toBe(1);
  });

  it('splits nothing else: a price line, a line with no name set, and another voice’s recording stay whole in the device voice', async () => {
    const price = build(new JaTts());
    await price.tts.speak('いらっしゃい！三百円です。', { who: 'kenji' });
    expect(price.inner.spoken).toEqual(['いらっしゃい！三百円です。']);
    expect(price.audio.played).toEqual([]);
    const noName = build(new JaTts(), new FakeAudio(), null);
    await noName.tts.speak(LINE, { who: 'kenji' });
    expect(noName.inner.spoken).toEqual([LINE]);
    // the narrator has 「お水をください。」, Kenji has not: the line must not change to the narrator's voice half-way
    const other = build(new JaTts());
    await other.tts.speak('サムさん！お水をください。', { who: 'kenji' });
    expect(other.inner.spoken).toEqual(['サムさん！お水をください。']);
    expect(other.audio.played).toEqual([]);
  });

  it('cancel() ends the sequence: the next sentence is not played and the line ends once', async () => {
    const a = new FakeAudio('manual');
    const { tts, inner } = build(new JaTts(), a);
    await tts.load();
    let ends = 0;
    const p = tts.speak(LINE, { who: 'kenji', onEnd: () => ends++ });
    await new Promise((r) => setTimeout(r, 0));
    expect(inner.spoken).toEqual(['サムさん！']);
    await new Promise((r) => setTimeout(r, 0));
    a.emit('playing'); // 「いらっしゃい！」 is playing
    tts.cancel();
    await p;
    expect(a.played).toEqual(['voice/aaa111.mp3']);
    expect(ends).toBe(1);
    expect(tts.speaking()).toBe(false);
  });
});

describe('the recorded lines', () => {
  const lines = voiceLines();
  const keys = new Set(lines.flatMap((l) => [l.text, ...l.alias].map((t) => voiceEntryKey(l.voice, t))));

  it('cover each scenario’s opening line as the conversation says it, in the character’s voice', () => {
    for (const s of SCENARIOS) {
      const line = s.nodes[s.start].say.find((v) => !/[{}]/.test(v.line.ja))?.line;
      if (!line || !VOICE_SPEAKERS[s.characterId]) continue;
      expect(keys.has(voiceEntryKey(s.characterId, resolveLine(line, LEXICON).plain)), `${s.id}: ${line.ja}`).toBe(true);
    }
  });

  it('cover slot lines once per choice (Yuki’s “コーヒーですね”), not lines with the player’s name', () => {
    expect(keys.has(voiceEntryKey('yuki', 'コーヒーですね。ホットですか、アイスですか？'))).toBe(true);
    const named = SCENARIOS.flatMap((s) => Object.values(s.nodes).flatMap((n) => n.say.map((v) => ({ who: s.characterId, line: v.line })))).find((x) => x.line.ja.includes('{name}'))!;
    expect(keys.has(voiceEntryKey(named.who, resolveLine(named.line, LEXICON, { name: { ja: 'サム', raw: true } }).plain))).toBe(false);
  });

  it('cover the name-free sentences of a line that greets the player by name, in the speaker’s voice (the name itself is the device’s)', () => {
    // Tanaka: 「{name}さん！いらっしゃいませ！あ、いつもありがとうございます。」 and 「{name}さんですね。これからもよろしくお願いします！ごゆっくりどうぞ。」
    for (const text of ['いらっしゃいませ！', 'あ、いつもありがとうございます。', 'これからもよろしくお願いします！', 'ごゆっくりどうぞ。']) expect(keys.has(voiceEntryKey('tanaka', text)), text).toBe(true);
    // Kenji speaks plainly
    expect(keys.has(voiceEntryKey('kenji', 'これからもよろしく！'))).toBe(true);
    // the question itself has no name in it: recorded whole
    expect(keys.has(voiceEntryKey('tanaka', 'いらっしゃいませ。いつもありがとうございます。あのう、お名前は？'))).toBe(true);
    expect([...keys].some((k) => k.includes('{name}'))).toBe(false);
  });

  it('cover lexicon words by surface, shift customers, and every voice has a speaker and a credit', () => {
    expect(keys.has(voiceEntryKey(NARRATOR, '桜町'))).toBe(true);
    expect(lines.some((l) => l.voice === CUSTOMER)).toBe(true);
    for (const l of lines) expect(VOICE_SPEAKERS[l.voice], l.voice).toBeTruthy();
    for (const v of Object.values(VOICE_SPEAKERS)) expect(VOICE_CREDITS).toContain(`VOICEVOX:${v.name}`);
    expect(lines.every((l) => !/[{}]/.test(l.text))).toBe(true);
  });
});
