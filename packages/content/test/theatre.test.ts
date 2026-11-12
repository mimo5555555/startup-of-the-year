// The Mini-theatre's content: every episode line and song lyric is made of lexicon words (so every word can be tapped) with English and
// Arabic; the quiz answers are real options; the song's morae and notes line up, and its morae spell the lyric's reading.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, EPISODES, LEXICON, SONGS, tokenize } from '../src';

const missing = (ja: string): string[] => tokenize(ja, LEXICON).tokens.filter((t) => !t.punct && !t.gloss).map((t) => t.s);
const hasAr = (s: string) => /[؀-ۿ]/.test(s);

describe('the Mini-theatre', () => {
  it('episodes: known characters, lexicon words, both languages, three answerable questions', () => {
    expect(EPISODES.map((e) => e.id)).toEqual(['ep_konbini', 'ep_ramen', 'ep_crane', 'ep_hanami', 'ep_sento', 'ep_figure', 'ep_station', 'ep_denki', 'ep_matsuri']);
    // listed in the order they open
    expect(EPISODES.map((e) => e.unlock)).toEqual([...EPISODES.map((e) => e.unlock)].sort((a, b) => a - b));
    for (const e of EPISODES) {
      for (const id of e.cast) expect(CHARACTERS.some((c) => c.id === id), `${e.id} cast ${id}`).toBe(true);
      for (const l of e.lines) {
        expect(e.cast.includes(l.who) || l.who === 'narrator', `${e.id}: ${l.who} speaks but is not in the cast`).toBe(true);
        expect(missing(l.line.ja), `${e.id}: ${l.line.ja}`).toEqual([]);
        expect(l.line.en.trim() && hasAr(l.line.ar), l.line.ja).toBeTruthy();
      }
      expect(e.quiz).toHaveLength(3);
      for (const q of e.quiz) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        expect(q.q.en && hasAr(q.q.ar)).toBeTruthy();
      }
    }
  });

  it('the songs: lexicon words, one note per mora, and the morae spell each line', () => {
    expect(SONGS.map((x) => x.id)).toEqual(['song_sakura', 'song_seasons', 'song_week']);
    for (const s of SONGS) {
      for (const pc of s.minor ?? []) expect(pc >= 0 && pc <= 11, `${s.id}: minor pitch class ${pc}`).toBe(true);
      for (const l of s.lines) {
        expect(missing(l.line.ja), l.line.ja).toEqual([]);
        expect(l.notes, l.line.ja).toHaveLength(l.morae.length);
        for (const [note, beats] of l.notes) {
          expect(note).toBeGreaterThanOrEqual(48);
          expect(note).toBeLessThanOrEqual(84);
          expect(beats).toBeGreaterThan(0);
        }
        const reading = tokenize(l.line.ja, LEXICON).tokens.map((t) => t.r ?? t.s).join('');
        expect(l.morae.join(''), l.line.ja).toBe(reading.replace(/[、。！？]/g, ''));
      }
    }
  });
});
