// Turn classification and the facts handed to @lw/game (docs/GAME_DESIGN.md §3.2). `ConversationFacts` (from @lw/game) is the
// cross-package contract; everything else here is engine-internal and pure.
import type { Balance, ConversationFacts, TurnClass, TurnFacts } from '@lw/game';
import { LEXICON, segmentFree, type Token } from '@lw/content';
import type { ConversationSession, InputMode } from './dialogue';
import { evaluateSession, type FeedbackOptions } from './feedback';
import { matchForms, normMatch } from './matching';
import { levenshtein, tokenDice } from './speechScore';

/** The §3.2 numbers: the slice of `BALANCE` the classifier reads. */
export type ScoringPolicy = Pick<Balance, 'credit' | 'copyScore' | 'thinTokens' | 'thinIdeal' | 'substantiveTokens' | 'shownNpcTokens' | 'unmatchedEnd'>;

/**
 * `BALANCE`, restated: the engine may only `import type` from @lw/game (contract.test.ts keeps the package graph acyclic), so the
 * numbers cannot be read at runtime here. Callers with a pack pass `BALANCE` through `SessionOptions.policy`, and scoring.test.ts
 * pins this default to BALANCE so the two cannot drift apart.
 */
export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  credit: { I: 1, thinI: 0.6, S: 0.35, T: 0.25 },
  copyScore: 0.8,
  thinTokens: 2,
  thinIdeal: 0.5,
  substantiveTokens: 2,
  shownNpcTokens: 4,
  unmatchedEnd: 6,
};

/** Every Japanese string the app has shown in this conversation (the "shown set", D37). */
export interface ShownSet {
  /** suggestion chips offered at every node */
  chips: string[];
  /** Hint text, once opened */
  hints: string[];
  /** Japanese returned by any "say it your way" translation */
  translations: string[];
  /** NPC lines with >= 4 content tokens (whole lines only) */
  npc: string[];
}

/** The Japanese text of the pocket lines the learner can recall: ready (production-checked within 7 days) or a known FSRS card (§3.2). */
export type RecalledLines = readonly string[];

export interface TurnClassification {
  /** 'unmatched' = the character did not understand; counts as a fallback, not as a turn */
  cls: TurnClass | 'unmatched';
  credit: number;
  substantive: boolean;
  thin: boolean;
  copied: boolean;
  recalled: boolean;
}

export interface ClassifyInput {
  /** how the text arrived; `assist` = English/Arabic typed or spoken, then translated */
  mode: InputMode;
  text: string;
  matched: boolean;
  /** non-grammar token count of the turn */
  contentTokens: number;
  /** Hint was opened at this node before submitting */
  hintOpened: boolean;
  /** similarity of the turn to the matched intent's `ideal` line, 0..1 */
  idealScore: number;
  /** the turn matches a pocket line that is ready, or whose card is known, and was not produced with help earlier (see `matchesRecalled`) */
  recalledLine: boolean;
  shown: ShownSet;
  /** normalised texts (`normTurn`) already said in this conversation */
  said: string[];
  stepCompleted: boolean;
}

/** The comparison form of a turn: numbers unified, kanji read, fillers, kana script and long vowels folded (§12.4). Also `TurnFacts.norm`. */
export const normTurn = normMatch;

const isContent = (t: Token) => !t.raw && !t.punct && !t.grammar;

/** Non-grammar tokens of a resolved line (NPC lines, learner lines). */
export const lineContentTokens = (tokens: Token[]): number => tokens.filter(isContent).length;

/** The surfaces of a text's content tokens, in order. */
export function turnWords(text: string): string[] {
  return segmentFree(text.normalize('NFKC'), LEXICON)
    .filter(isContent)
    .map((t) => t.s);
}

/** Content tokens of what the learner typed or said; a run of digits is one number token. */
export function contentTokenCount(text: string): number {
  const t = text.normalize('NFKC');
  return segmentFree(t, LEXICON).filter(isContent).length + (t.match(/[0-9]+/g) ?? []).length;
}

export function createShownSet(): ShownSet {
  return { chips: [], hints: [], translations: [], npc: [] };
}

/** Adds a displayed string once; an NPC line enters only with >= `shownNpcTokens` content tokens (a short repeat-back is ordinary conversation). */
export function addShown(set: ShownSet, source: keyof ShownSet, text: string, tokens?: Token[], policy: ScoringPolicy = DEFAULT_SCORING_POLICY): void {
  if (!text.trim() || set[source].includes(text)) return;
  if (source === 'npc' && lineContentTokens(tokens ?? segmentFree(text, LEXICON)) < policy.shownNpcTokens) return;
  set[source].push(text);
}

const similarity = (a: string, b: string): number => (a && b ? 1 - levenshtein(a, b) / Math.max(Array.from(a).length, Array.from(b).length) : 0);

/** 1 - lev(norm(a), norm(b)) / max(len), compared in both of matching's forms (long-vowel marks dropped or lengthened), so a copy typed without the ー of コーヒー is still a copy. */
export function editSimilarity(a: string, b: string): number {
  const x = matchForms(a);
  const y = matchForms(b);
  return Math.max(similarity(x.loose, y.loose), similarity(x.folded, y.folded));
}

/** max(1 - lev(norm(a), norm(b)) / max(len), tokenDice(a, b)); a turn copies `s` at >= `BALANCE.copyScore`. */
export function copyScore(turn: string, shown: string): number {
  return Math.max(editSimilarity(turn, shown), tokenDice(turn, shown));
}

/**
 * How close a turn is to the matched intent's `ideal` line, for the thin-turn test (§3.2). Edit distance only: a single keyword
 * always shares half or more of its tokens with a short ideal ("コーヒー" and "コーヒーをください"), so the token dice would make a
 * thin turn impossible, which is the opposite of what the 0.50 escape is for (a short but complete sentence).
 */
export const idealSimilarity = editSimilarity;

/** Ties the 0.80 threshold to float noise: 1 - 1/5 is the same 0.8 however it is computed. */
const EPS = 1e-9;
const COPY_ORDER: Array<keyof ShownSet> = ['translations', 'hints', 'chips', 'npc'];

/** The first shown string the turn copies (score >= 0.80), with its source: translations, then the hint, chips, NPC lines. null when none. */
export function findCopy(
  turn: string,
  shown: ShownSet,
  sources: Array<keyof ShownSet> = COPY_ORDER,
  policy: ScoringPolicy = DEFAULT_SCORING_POLICY,
): { source: keyof ShownSet; score: number } | null {
  for (const source of sources) {
    let best = 0;
    for (const s of shown[source]) best = Math.max(best, copyScore(turn, s));
    if (best + EPS >= policy.copyScore) return { source, score: best };
  }
  return null;
}

/**
 * A recalled line (§3.2): the turn matches a ready or known pocket line, and the learner has not already produced it with help in
 * this conversation (chip-then-retype is never a recalled line). The rest of the rule (no chip, no Hint, not a translation) is the
 * order of `classifyTurn`.
 */
export function matchesRecalled(text: string, recalled: RecalledLines, assistedSaid: readonly string[], policy: ScoringPolicy = DEFAULT_SCORING_POLICY): boolean {
  const hits = (s: string) => copyScore(text, s) + EPS >= policy.copyScore;
  return recalled.some(hits) && !assistedSaid.some(hits);
}

/** First match wins: T (assist or a copy of a translation), S (suggestion, hint opened, or a copy that is not a recalled line), I (everything else; 0.60 when thin). */
export function classifyTurn(input: ClassifyInput, policy: ScoringPolicy = DEFAULT_SCORING_POLICY): TurnClassification {
  if (!input.matched) return { cls: 'unmatched', credit: 0, substantive: false, thin: false, copied: false, recalled: false };
  const copy = findCopy(input.text, input.shown, COPY_ORDER, policy);
  const copiesTranslation = findCopy(input.text, input.shown, ['translations'], policy) !== null;

  let cls: TurnClass;
  if (input.mode === 'assist' || copiesTranslation) cls = 'T';
  else if (input.mode === 'suggestion' || input.hintOpened || (copy && !input.recalledLine)) cls = 'S';
  else cls = 'I';

  const thin = cls === 'I' && input.contentTokens < policy.thinTokens && input.idealScore < policy.thinIdeal;
  const credit = cls === 'I' ? (thin ? policy.credit.thinI : policy.credit.I) : policy.credit[cls];
  const duplicate = input.said.includes(normTurn(input.text));
  const substantive = !duplicate && (input.contentTokens >= policy.substantiveTokens || input.stepCompleted);
  return { cls, credit, substantive, thin, copied: copy !== null, recalled: cls === 'I' && input.recalledLine };
}

export interface FactsExtra {
  mode: 'guided' | 'real';
  /** the scenario's pocket was ready at start (the x1.10) */
  prepared: boolean;
  /** defaults to the session's own clock */
  durationSec?: number;
  /** defaults to "the conversation did not reach an end node, or was ended by six unmatched turns" */
  abandoned?: boolean;
  /** the register rules behind `accuracy` and `requestsPolite` (the pack's markers, the friend's register) */
  feedback?: FeedbackOptions;
  topic?: string;
  revealed?: string[];
  callbacks?: string[];
  quiz?: ConversationFacts['quiz'];
  flags?: string[];
}

/** Builds the facts of a finished (or abandoned) conversation from the session. */
export function buildConversationFacts(session: ConversationSession, extra: FactsExtra): ConversationFacts {
  const report = evaluateSession(session, extra.feedback);
  const byId = new Map(session.turns.map((t) => [t.id, t]));
  // a polite-request correction is a naturalness note on a request turn; a soft register note ("distant, not wrong") costs nothing
  const requestsPolite = !report.corrections.some((c) => c.category === 'naturalness' && !c.soft && byId.get(c.turnId)?.request);

  const heard = new Set<string>();
  const turns: TurnFacts[] = [];
  for (const t of session.turns) {
    const sc = t.score;
    if (t.speaker !== 'learner' || !sc || sc.cls === 'unmatched') continue;
    const words = turnWords(t.line.written);
    // only what the learner produced herself is "new words said" (the reducer feeds say_new and words.said from class-I turns)
    const newWords = sc.cls === 'I' && sc.substantive ? words.filter((w, i) => !heard.has(w) && words.indexOf(w) === i) : [];
    if (sc.cls === 'I' && sc.substantive) for (const w of words) heard.add(w);
    const f: TurnFacts = {
      id: t.id,
      cls: sc.cls,
      credit: sc.credit,
      substantive: sc.substantive,
      contentTokens: t.contentTokens ?? 0,
      stepIds: [...t.stepsDone],
      norm: normTurn(t.line.written),
      newWords,
    };
    if (sc.thin) f.thin = true;
    if (sc.copied) f.copied = true;
    if (sc.recalled) f.recalled = true;
    if (t.hintOpened) f.hintOpened = true;
    // conversation management (もう一度, ありがとう) is not an intent of the scenario
    if (t.intentId && !t.global) f.intentId = t.intentId;
    if (t.request) f.request = true;
    if (words.length) f.words = words;
    if (t.confidence !== undefined) f.confidence = t.confidence;
    turns.push(f);
  }

  const summary = session.summary();
  const facts: ConversationFacts = {
    sessionId: session.id,
    scenarioId: session.scenario.id,
    characterId: session.character.id,
    mode: extra.mode,
    abandoned: extra.abandoned ?? (!session.ended || session.endedBy === 'unmatched'),
    durationSec: extra.durationSec ?? summary.durationSec,
    goalDone: summary.goalDone,
    goalTotal: summary.goalTotal,
    turns,
    fallbacks: session.fallbacks,
    hintUses: session.hintsUsed,
    accuracy: report.scores.accuracy,
    requestsPolite,
    prepared: extra.prepared,
    remembered: { ...session.remembered },
  };
  if (session.opts.startNode) facts.startNode = session.opts.startNode;
  if (extra.topic !== undefined) facts.topic = extra.topic;
  if (extra.revealed) facts.revealed = extra.revealed;
  if (extra.callbacks) facts.callbacks = extra.callbacks;
  if (extra.quiz) facts.quiz = extra.quiz;
  if (extra.flags) facts.flags = extra.flags;
  return facts;
}
