// The Mini-theatre's timing: morae per token (small kana join, っ counts, punctuation is none), token start times in proportion to their
// morae and in order, the lit count over time, and the song's timeline (one note per mora, lines in order, chords under each half).
import { describe, expect, it } from 'vitest';
import { EPISODES, LEXICON, SONGS, tokenize } from '@lw/content';
import { estimateSeconds, litCount, moraeOf, openMedia, songTimeline, tokenStarts } from '../src/game/theatreLogic';

const toks = (ja: string) => tokenize(ja, LEXICON).tokens;

describe('subtitle timing', () => {
  it('counts morae from the reading', () => {
    expect(moraeOf({ s: 'しょうゆラーメン' })).toBe(7); // しょ う ゆ ラ ー メ ン
    expect(moraeOf({ s: '一緒に', r: 'いっしょに' })).toBe(4); // い っ しょ に
    expect(moraeOf({ s: '。', punct: true })).toBe(0);
  });

  it('spreads the tokens over the line in order, in proportion to their morae; all are lit at the end', () => {
    const line = toks('すみません、|おにぎり|は|どこ|です|か？');
    const starts = tokenStarts(line, 3);
    expect(starts[0]).toBe(0);
    for (let i = 1; i < starts.length; i++) expect(starts[i]!).toBeGreaterThanOrEqual(starts[i - 1]!);
    expect(starts.at(-1)!).toBeLessThan(3);
    expect(litCount(starts, 0)).toBeGreaterThanOrEqual(1);
    expect(litCount(starts, 99)).toBe(line.length);
    expect(estimateSeconds(line, 0.75)).toBeGreaterThan(estimateSeconds(line, 1));
  });

  it('opens episodes by chapter', () => {
    expect(openMedia(EPISODES, 1).map((e) => e.id)).toEqual(['ep_konbini']);
    expect(openMedia(EPISODES, 9)).toHaveLength(EPISODES.length);
  });
});

describe('the song', () => {
  it('one note per mora, in order, lines one after another, two chords per line', () => {
    const song = SONGS[0]!;
    const tl = songTimeline(song);
    expect(tl.notes).toHaveLength(song.lines.reduce((n, l) => n + l.morae.length, 0));
    for (let i = 1; i < tl.notes.length; i++) expect(tl.notes[i]!.at).toBeGreaterThan(tl.notes[i - 1]!.at);
    expect(tl.chords).toHaveLength(song.lines.length * 2);
    expect(tl.seconds).toBeGreaterThan(tl.notes.at(-1)!.at);
    expect(tl.notes[0]!.at).toBeCloseTo((60 / song.bpm) * 2, 5); // after the count-in
  });
});
