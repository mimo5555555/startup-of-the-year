// 耳トレ (mimi-tore), the daily ear training: five recorded lines from the conversations the player has had, heard first, then "what did
// they say?" with three meanings to choose from. Pure helpers (no React, no audio) so the pick is testable; Ears.tsx plays and shows them.
// A line qualifies when it is fixed text (no {slot} or {name}), short enough to hear in one go, and has a recording in the speaker's voice.
import type { Line, Scenario } from '@lw/content';

export interface EarLine {
  /** the text as recorded (markup stripped): what tts.speak is given */
  ja: string;
  /** the line's markup (word boundaries and readings, for the reveal with furigana) */
  markup: string;
  en: string;
  ar: string;
  /** the character who says it (the recording's voice) */
  who: string;
  scenarioId: string;
}

export interface EarRound {
  line: EarLine;
  /** three meanings, the right one among them, in a shuffled order */
  options: EarLine[];
}

export const EARS_ROUNDS = 5;
const JA = /[぀-ヿ㐀-鿿]/;

const bare = (l: Line): string => l.ja.replace(/\|/g, '');

/** The lines of the scenarios the player has met (in the order given), each once, with a recording. */
export function earPool(scenarios: readonly Scenario[], met: ReadonlySet<string>, hasAudio: (text: string, who: string) => boolean, min = EARS_ROUNDS * 2): EarLine[] {
  const out: EarLine[] = [];
  const seenJa = new Set<string>();
  const seenEn = new Set<string>();
  const take = (s: Scenario, l: Line | undefined) => {
    if (!l || /[{}]/.test(l.ja) || !l.en?.trim()) return;
    const ja = bare(l);
    const len = Array.from(ja).length;
    const en = l.en.trim().toLowerCase();
    if (!JA.test(ja) || len < 3 || len > 30 || seenJa.has(ja) || seenEn.has(en)) return;
    if (!hasAudio(ja, s.characterId)) return;
    seenJa.add(ja);
    seenEn.add(en);
    out.push({ ja, markup: l.ja, en: l.en, ar: l.ar, who: s.characterId, scenarioId: s.id });
  };
  const walk = (s: Scenario) => {
    for (const node of Object.values(s.nodes)) {
      for (const v of node.say) take(s, v.line);
      for (const it of node.intents) take(s, it.reply);
    }
  };
  for (const s of scenarios) if (met.has(s.id)) walk(s);
  // a new player: the first scenarios of the story fill the pool up to `min` (nothing in them is a spoiler)
  for (const s of scenarios) {
    if (out.length >= min) break;
    if (!met.has(s.id)) walk(s);
  }
  return out;
}

/** A small seeded random (mulberry32 over a string hash): the same day gives the same five lines and options. */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
  let a = (h << 13) | (h >>> 19);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: readonly T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Today's rounds: `n` lines, each with two other lines' meanings as the wrong choices. Fewer than 3 lines: no session. */
export function earRounds(pool: readonly EarLine[], seed: string, n = EARS_ROUNDS): EarRound[] {
  if (pool.length < 3) return [];
  const rng = seeded(seed);
  const picked = shuffle(pool, rng).slice(0, n);
  return picked.map((line) => {
    const others = shuffle(
      pool.filter((l) => l !== line),
      rng,
    ).slice(0, 2);
    return { line, options: shuffle([line, ...others], rng) };
  });
}
