// Pure rules of the Prepare screen and the hidden-line Say it (docs/GAME_DESIGN.md §11.1, §11.3): the recall pass mark, how a typed or
// spoken attempt is scored against a line, the build-it-from-pieces tiles, and the readiness view of a pocket. No React, no stores:
// the screens read the game state and pass it in, so every rule here is a plain test.
import { LEXICON, plainText, tokenize } from '@lw/content';
import { romajiAsKana } from '@lw/core';
import { alternativesOf, bestAlternativeScore, normMatch, speechSimilarity, type SpeechAlternative } from '@lw/engine';
import { BALANCE, lineReady, pocketReady, type AgeGroup, type GamePack, type GameState, type GameView, type PocketLine } from '@lw/game';

// ---------------------------------------------------------------------------------------------------------------
// Pass marks and scoring
// ---------------------------------------------------------------------------------------------------------------

/** The recall pass mark on speechSimilarity: 0.70, 0.60 for the A1 profile, 0.55 for kids (§11.1); the lowest that applies. */
export function recallMark(profile: { age: AgeGroup; level: 'A1' | 'A2' }): number {
  const R = BALANCE.recallPass;
  const marks = [R.default];
  if (profile.level === 'A1') marks.push(R.beginner);
  if (profile.age === 'kids') marks.push(R.kids);
  return Math.min(...marks);
}

/** The written form of a markup line (what a learner is told, what TTS reads when the line has no `tts`). */
export const plainOf = (ja: string): string => plainText(tokenize(ja, LEXICON).tokens);

/**
 * How close an attempt is to a target, 0..1. Kana, kanji and romaji are all fine: both sides go through `normMatch` (dictionary
 * kanji become their reading, script and punctuation fold), and romaji is read as kana first.
 */
export function recallScore(attempt: string, targetPlain: string): number {
  const text = attempt.trim();
  if (!text) return 0;
  const target = normMatch(targetPlain);
  if (!target) return 0;
  return Math.max(speechSimilarity(normMatch(text), target), speechSimilarity(normMatch(romajiAsKana(text) ?? text), target));
}

/** Best score over the recogniser's n-best list (the first alternative is the one shown). */
export function recallScoreSpoken(result: { text: string; confidence: number; alternatives?: SpeechAlternative[] }, targetPlain: string): number {
  const target = normMatch(targetPlain);
  if (!target) return 0;
  const alts = alternativesOf(result).map((a) => ({ ...a, text: normMatch(a.text) }));
  return bestAlternativeScore(alts, target);
}

// ---------------------------------------------------------------------------------------------------------------
// Build it from the pieces
// ---------------------------------------------------------------------------------------------------------------

/** characters that never start a tile of their own: small kana, the long mark and sentence punctuation */
const STICKY = /[ゃゅょぁぃぅぇぉゎっャュョァィゥェォヮッー。、！？!?.,]/;
const KANJI = /[㐀-鿿]/;

/**
 * The tiles of a line in order: the markup's own word breaks; a line of fewer than 3 words (いただきます！) is cut into 2-character
 * kana chunks so there is always something to put in order. Small kana, the long mark and punctuation stay with the character before.
 */
export function tilePieces(ja: string): string[] {
  // sentence punctuation is its own piece in the markup (validatePack wants that); on a tile it belongs to the word before
  const words: string[] = [];
  for (const w of ja.split('|').filter(Boolean)) {
    if (words.length && /^[。、！？!?.,]+$/.test(w)) words[words.length - 1] += w;
    else words.push(w);
  }
  if (words.length >= 3) return words;
  const out: string[] = [];
  for (const w of words) {
    const chars = Array.from(w);
    if (chars.length <= 2 || chars.some((c) => KANJI.test(c))) {
      out.push(w);
      continue;
    }
    let chunk = '';
    for (const c of chars) {
      if (chunk && Array.from(chunk).length >= 2 && !STICKY.test(c)) {
        out.push(chunk);
        chunk = '';
      }
      chunk += c;
    }
    if (chunk) out.push(chunk);
  }
  return out;
}

const hash = (s: string): number => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};
/** mulberry32: a stable shuffle per line, so a re-render never moves the tiles under a finger */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Tile {
  /** index in the deck (stable key) */
  id: number;
  s: string;
}

/** The shuffled deck: the line's pieces plus 2 distractors taken from the pocket's other lines (never a piece the line itself uses). */
export function tileDeck(line: PocketLine, others: PocketLine[], distractors = 2): Tile[] {
  const own = tilePieces(line.line.ja);
  const ownSet = new Set(own);
  const pool = [...new Set(others.filter((o) => o.id !== line.id).flatMap((o) => tilePieces(o.line.ja)))].filter((s) => !ownSet.has(s) && Array.from(s).length <= 6);
  const rand = rng(hash(line.id));
  const pick: string[] = [];
  while (pick.length < distractors && pool.length > 0) pick.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  const all = [...own, ...pick].map((s, id) => ({ id, s }));
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

/** True when the built tiles read the line in order. */
export const tilesCorrect = (built: string[], ja: string): boolean => built.join('') === tilePieces(ja).join('');

// ---------------------------------------------------------------------------------------------------------------
// Readiness (the view of GameState.prep the cards show)
// ---------------------------------------------------------------------------------------------------------------

export type LineStatus = 'new' | 'seen' | 'ready';

export function lineStatus(state: GameState, view: GameView, lineId: string): LineStatus {
  if (lineReady(state, view, lineId)) return 'ready';
  return state.prep[lineId] ? 'seen' : 'new';
}

/**
 * Days a recall stamp stays good, counting today (1 = the last day). null when the line is not ready, Infinity for a known FSRS
 * card, which never expires (§11.1).
 */
export function readyDaysLeft(state: GameState, view: GameView, lineId: string): number | null {
  if (view.vocab.known.has(lineId)) return Infinity;
  const p = state.prep[lineId];
  if (!p || p.s !== 'ready') return null;
  const left = BALANCE.readyDays - (state.clock.dayIndex - p.at);
  return left > 0 ? left : null;
}

export interface PocketView {
  scenarioId: string;
  lines: Array<{ id: string; line: PocketLine; status: LineStatus }>;
  /** the x1.10 is on: all key lines ready and enough of the rest */
  ready: boolean;
  /** fewest days left over the lines that are ready by a stamp (Infinity when none expires) */
  daysLeft: number;
}

/** A scenario's pocket with each line's status; null when the scenario has no pocket in the pack. */
export function pocketView(pack: GamePack, state: GameState, view: GameView, scenarioId: string): PocketView | null {
  const ids = pack.scenarioMeta.find((m) => m.id === scenarioId)?.pocket ?? [];
  const lines = ids.flatMap((id) => (pack.pockets[id] ? [{ id, line: pack.pockets[id], status: lineStatus(state, view, id) }] : []));
  if (lines.length === 0) return null;
  const left = lines.map((l) => readyDaysLeft(state, view, l.id)).filter((n): n is number => n !== null);
  return { scenarioId, lines, ready: pocketReady(pack, state, view, scenarioId), daysLeft: left.length ? Math.min(...left) : Infinity };
}

/** The lines still to recall: everything that is not ready right now (a fresh stamp or a known card is not asked again). */
export const linesToRecall = (p: PocketView): string[] => p.lines.filter((l) => l.status !== 'ready').map((l) => l.id);

/**
 * The words of a pocket's lines that deserve a word card of their own (§11.5): lexicon words with a meaning, not particles, once each.
 * The SRS bridge skips any that the vocabulary already has.
 */
export function wordKeysOf(lines: PocketLine[]): string[] {
  const keys = new Set<string>();
  for (const l of lines) {
    for (const t of tokenize(l.line.ja, LEXICON).tokens) if (!t.punct && !t.raw && !t.grammar && t.gloss && LEXICON.get(t.s)) keys.add(t.s);
  }
  return [...keys];
}
