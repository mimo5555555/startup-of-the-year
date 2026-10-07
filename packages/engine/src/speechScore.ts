// Speech similarity (docs/GAME_DESIGN.md §12.4), moved out of Conversation.tsx so Prepare, the debrief, shifts and the copy rule
// share it. `levenshtein` and `tokenDice` are the building blocks of the copy rule (§3.2: max(1 - lev/maxlen, tokenDice)).
import type { Balance } from '@lw/game';
import { LEXICON, segmentFree } from '@lw/content';
import { speechNormalize, type SpeechNormalizeOptions } from './speechNormalize';

/** The §12.4 numbers: `BALANCE.speech`. */
export type SpeechPolicy = Balance['speech'];

/**
 * `BALANCE.speech`, restated: the engine may only `import type` from @lw/game (contract.test.ts keeps the package graph acyclic), so the
 * numbers cannot be read at runtime here. Every function below takes the policy as an optional argument (callers with a pack pass
 * `BALANCE.speech`), and speechScore.test.ts pins this default to BALANCE so the two cannot drift apart.
 */
export const DEFAULT_SPEECH_POLICY: SpeechPolicy = {
  maxAlternatives: 3,
  directConfidence: 0.75,
  confirmConfidence: 0.45,
  correctionConfidence: 0.8,
  great: 0.85,
};

/** A similarity at or above this is "great" (§12.4). */
export const SIMILARITY_GREAT = DEFAULT_SPEECH_POLICY.great;

export interface SpeechAlternative {
  text: string;
  confidence: number;
}

/** Character-level (code point) Levenshtein distance. */
export function levenshtein(a: string, b: string): number {
  const x = Array.from(a);
  const y = Array.from(b);
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[y.length];
}

/** Short alias used by the copy rule (§3.2). */
export const lev = levenshtein;

/** 1 - levenshtein(norm(a), norm(b)) / max(len), 0..1; 0 when either side normalises to nothing. */
export function speechSimilarity(a: string, b: string, opts?: SpeechNormalizeOptions): number {
  const x = speechNormalize(a, opts);
  const y = speechNormalize(b, opts);
  const len = Math.max(Array.from(x).length, Array.from(y).length);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / len;
}

/** The set of normalised lexicon tokens of a text: known words by their reading (辛い = からい), unknown runs as written; punctuation dropped. */
export function lexiconTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of segmentFree(text.normalize('NFKC'), LEXICON)) {
    if (t.punct) continue;
    const k = speechNormalize(t.r ?? t.s);
    if (k) out.add(k);
  }
  return out;
}

/** 2·|A∩B| / (|A|+|B|) over token sets; 0 when either is empty. `tokens` replaces the lexicon tokenizer (e.g. a pack's own). */
export function tokenDice(a: string, b: string, tokens: (text: string) => Iterable<string> = lexiconTokens): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (2 * inter) / (A.size + B.size);
}

// ---------- n-best ----------

/** The recogniser's hypotheses, best first: `alternatives` when it gave some, else the one `text`. Blank and duplicate texts are dropped. */
export function alternativesOf(result: { text: string; confidence: number; alternatives?: SpeechAlternative[] }): SpeechAlternative[] {
  const out: SpeechAlternative[] = [];
  for (const a of [{ text: result.text, confidence: result.confidence }, ...(result.alternatives ?? [])]) {
    const text = a.text.trim();
    if (text && !out.some((o) => o.text === text)) out.push({ text, confidence: a.confidence });
  }
  return out;
}

/** The best similarity of any alternative against the target (n-best STT); 0 for no alternatives. */
export function bestAlternativeScore(alternatives: SpeechAlternative[], target: string, opts?: SpeechNormalizeOptions): number {
  let best = 0;
  for (const a of alternatives) best = Math.max(best, speechSimilarity(a.text, target, opts));
  return best;
}

export interface NBestMatch {
  alt: SpeechAlternative;
  /** index in `alternatives` */
  altIndex: number;
  expected: string;
  /** index in `expected` */
  expectedIndex: number;
  score: number;
}

/**
 * The (alternative, expected line) pair with the highest similarity. Ties go to the earlier alternative, then the earlier
 * expected line, so the recogniser's own ranking decides when the lines are equally close. null when either list is empty.
 */
export function selectBestAlternative(alternatives: SpeechAlternative[], expected: string[], opts?: SpeechNormalizeOptions): NBestMatch | null {
  let best: NBestMatch | null = null;
  for (let altIndex = 0; altIndex < alternatives.length; altIndex++) {
    for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex++) {
      const score = speechSimilarity(alternatives[altIndex].text, expected[expectedIndex], opts);
      if (!best || score > best.score) best = { alt: alternatives[altIndex], altIndex, expected: expected[expectedIndex], expectedIndex, score };
    }
  }
  return best;
}

/**
 * Generic n-best: evaluates every alternative (`evaluate` returns null for "no match") and keeps the one with the highest `rank`.
 * Ties go to the earlier alternative. This is how a session picks its intent hit while still displaying the first alternative.
 */
export function pickBestAlternative<T>(
  alternatives: SpeechAlternative[],
  evaluate: (text: string) => T | null,
  rank: (hit: T) => number,
): { alt: SpeechAlternative; altIndex: number; hit: T } | null {
  let best: { alt: SpeechAlternative; altIndex: number; hit: T } | null = null;
  let bestRank = -Infinity;
  for (let altIndex = 0; altIndex < alternatives.length; altIndex++) {
    const hit = evaluate(alternatives[altIndex].text);
    if (hit === null) continue;
    const r = rank(hit);
    if (!best || r > bestRank) {
      best = { alt: alternatives[altIndex], altIndex, hit };
      bestRank = r;
    }
  }
  return best;
}

// ---------- confidence policy ----------

/** `direct`: submit; `confirm`: ask "I heard: ... Yes / Edit / Try again" and consume no turn; `unmatched`: treat as unmatched without counting a fallback. */
export type ConfidenceBucket = 'direct' | 'confirm' | 'unmatched';

export function confidenceBucket(confidence: number, policy: SpeechPolicy = DEFAULT_SPEECH_POLICY): ConfidenceBucket {
  if (!(confidence >= policy.confirmConfidence)) return 'unmatched'; // also NaN
  return confidence >= policy.directConfidence ? 'direct' : 'confirm';
}

/** Corrections ignore speech turns below this confidence; they become "maybe" notes (§11.4). */
export const isReliableSpeech = (confidence: number, policy: SpeechPolicy = DEFAULT_SPEECH_POLICY): boolean => confidence >= policy.correctionConfidence;

/** `great` at SIMILARITY_GREAT and above, `pass` at the pass mark (Prepare/echo thresholds from BALANCE), else `again`. */
export function similarityVerdict(score: number, pass: number, policy: SpeechPolicy = DEFAULT_SPEECH_POLICY): 'great' | 'pass' | 'again' {
  return score >= policy.great ? 'great' : score >= pass ? 'pass' : 'again';
}
