// The Mini-theatre (ミニシアター): timing for the karaoke subtitles and the song. Pure (no React, no audio) so it is testable; Theatre.tsx
// plays the lines and the music and lights the words with these times.
import type { Episode, Song, Token } from '@lw/content';

/** small kana that join the mora before them (きゃ is one mora; っ and ー are morae of their own) */
const SMALL = /[ゃゅょャュョぁぃぅぇぉァィゥェォ]/g;

/** The morae of a token, from its reading (or its surface when it is kana): punctuation is none. */
export function moraeOf(t: Pick<Token, 's' | 'r' | 'punct'>): number {
  if (t.punct) return 0;
  const kana = (t.r ?? t.s).replace(/[^ぁ-ゟ゠-ヿー]/g, '');
  return Math.max(kana ? 0 : 1, kana.replace(SMALL, '').length);
}

/** About how long a line takes to say (seconds) at speech `rate` 1 = 7.5 morae a second, plus a short breath. */
export const estimateSeconds = (tokens: readonly Token[], rate = 1): number => tokens.reduce((n, t) => n + moraeOf(t), 0) / (7.5 * rate) + 0.3;

/**
 * When each token starts (seconds from the line's start) over `seconds`: in proportion to its morae, punctuation taking none. The voice takes
 * a moment to start, so the first word lights at once and the times spread over 90 % of the line.
 */
export function tokenStarts(tokens: readonly Token[], seconds: number): number[] {
  const weights = tokens.map((t) => moraeOf(t));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const span = seconds * 0.9;
  let acc = 0;
  return weights.map((w) => {
    const at = (acc / total) * span;
    acc += w;
    return at;
  });
}

/** How many tokens are lit `elapsed` seconds into the line (all of them once the line is over). */
export function litCount(starts: readonly number[], elapsed: number): number {
  let n = 0;
  for (const s of starts) if (elapsed >= s) n++;
  return n;
}

/** One note of the song: which line and mora it sings, when (seconds from the start) and for how long, and its pitch. */
export interface SongNote {
  line: number;
  mora: number;
  at: number;
  dur: number;
  midi: number;
}

/** The song as a timeline: one note per mora, the lines one after another with a two-beat breath between them, and the chords. */
export function songTimeline(song: Song): { notes: SongNote[]; chords: Array<{ at: number; dur: number; root: number }>; seconds: number } {
  const beat = 60 / song.bpm;
  const notes: SongNote[] = [];
  const chords: Array<{ at: number; dur: number; root: number }> = [];
  let t = beat * 2; // a two-beat count-in
  song.lines.forEach((l, li) => {
    const lineStart = t;
    const half = Math.ceil(l.notes.length / 2);
    let halfAt = t;
    l.notes.forEach(([midi, beats], mi) => {
      if (mi === half) halfAt = t;
      notes.push({ line: li, mora: mi, at: t, dur: beats * beat, midi });
      t += beats * beat;
    });
    chords.push({ at: lineStart, dur: halfAt - lineStart, root: l.chords[0] }, { at: halfAt, dur: t - halfAt + beat * 2, root: l.chords[1] });
    t += beat * 2;
  });
  return { notes, chords, seconds: t + beat };
}

/** The episodes and songs open at `chapter` (in content order). */
export function openMedia<T extends Episode | Song>(list: readonly T[], chapter: number): T[] {
  return list.filter((m) => m.unlock <= chapter);
}

/** A MIDI note's frequency (Hz). */
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
