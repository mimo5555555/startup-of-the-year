import { toKatakana, uid } from '@lw/core';
import {
  LEXICON,
  REACTIONS,
  SLOTS,
  TOPICS,
  plainText,
  resolveLine,
  segmentFree,
  speakableText,
  tokenize,
  type Character,
  type Emotion,
  type IntentDef,
  type IntentEcon,
  type L1,
  type Line,
  type ResolvedLine,
  type Scenario,
  type SceneNode,
  type SlotOption,
  type Suggestion,
  type Vars,
} from '@lw/content';
import type { ConversationFacts } from '@lw/game';
import { matchGlobal, matchNodeIntent, type GlobalIntent, type IntentHit } from './matching';
import {
  DEFAULT_SCORING_POLICY,
  addShown,
  buildConversationFacts,
  classifyTurn,
  contentTokenCount,
  createShownSet,
  idealSimilarity,
  matchesRecalled,
  normTurn,
  type FactsExtra,
  type RecalledLines,
  type ScoringPolicy,
  type ShownSet,
  type TurnClassification,
} from './scoring';
import { alternativesOf, pickBestAlternative, type SpeechAlternative } from './speechScore';
import type { TranslationResult } from './translator';

export type InputMode = 'typed_ja' | 'typed_romaji' | 'speech_ja' | 'suggestion' | 'assist';

export interface Turn {
  id: number;
  speaker: 'character' | 'learner';
  line: ResolvedLine;
  kind: 'say' | 'reaction' | 'fallback' | 'repeat';
  mode?: InputMode;
  /** the app wrote this line for the learner (a suggestion or a translation) */
  assisted: boolean;
  l1Text?: string;
  emotion?: Emotion;
  slow?: boolean;
  /** a second line spoken after a reaction, e.g. the repeated sentence after "I'll say it slowly" */
  followUp?: ResolvedLine;
  /** learner turns: the goal steps this exchange completed (the intent's own and those of the node it led to) */
  stepsDone: string[];
  intentId?: string;
  request?: boolean;
  ideal?: ResolvedLine;
  /** learner turns: did the character understand it? */
  matched: boolean;
  needsHelp?: boolean;
  t: number;
  /** learner turns: credit class, substantive and copy flags (docs/GAME_DESIGN.md §3.2) */
  score?: TurnClassification;
  /** learner turns: non-grammar tokens in what was said */
  contentTokens?: number;
  /** learner turns: Hint was open at this node when the turn was submitted */
  hintOpened?: boolean;
  /** learner turns: speech recognition confidence */
  confidence?: number;
  /** learner turns: matched a conversation-management phrase (もう一度, ありがとう), not an intent of the scenario */
  global?: boolean;
  /** character turns: this node charged the learner and the money was there (`SessionGameHooks.charge`) */
  charged?: boolean;
}

export interface ResolvedSuggestion extends ResolvedLine {
  source: Suggestion;
}

/**
 * The game's economy seam (docs/GAME_DESIGN.md §6.2). All optional: without it a scenario runs exactly as before.
 * The functions receive copies; nothing they do changes the session except the returned `Vars`.
 */
export interface SessionGameHooks {
  /** called on start and after every learner turn; returns Vars such as price, total, change, deposit, fare */
  vars(slotIds: Record<string, string>, flags: Record<string, boolean>): Vars;
  /** called when entering a node with econ:'charge'. If ok === false the engine enters node.onShort instead */
  charge(slotIds: Record<string, string>): { ok: boolean; vars?: Vars };
  /** called after an intent with `econ` matched. ok:false routes to intent.nextIfNo (and earns no goal step) */
  intent?(kind: IntentEcon, ctx: { slotIds: Record<string, string>; assisted: boolean; number?: number }): { ok: boolean; vars?: Vars };
}

export interface SessionOptions {
  scenario: Scenario;
  character: Character;
  l1: L1;
  profileName: string;
  topics: string[];
  now?: () => number;
  /** ConversationFacts.sessionId (the ledger key of the loop pay); a random one when absent */
  sessionId?: string;
  game?: SessionGameHooks;
  /** story and twist flags: `SayVariant.when {flag}` and the `vars` hook read them; the session keeps the object, so the app may set more mid-conversation */
  flags?: Record<string, boolean>;
  /** enter here instead of `scenario.start` (`ScenarioMeta.startNode`) */
  startNode?: string;
  /** pocket lines the learner has ready or knows (§3.2): typing one without help is class I even when a chip shows it */
  recalled?: RecalledLines;
  /** `BALANCE` numbers of §3.2; the pinned defaults when absent */
  policy?: ScoringPolicy;
}

export interface SubmitInput {
  text: string;
  mode: InputMode;
  l1Text?: string;
  translation?: TranslationResult;
  /** for typed romaji: the kana that was understood */
  kana?: string;
  /** speech: the recogniser's other hypotheses, best first; every one is tried against the node's intents and the best hit wins (§12.4) */
  alternatives?: SpeechAlternative[];
  /** speech: the recogniser's confidence in `text` */
  confidence?: number;
}

export interface SubmitResult {
  learner: Turn;
  character: Turn;
  ended: boolean;
  stepsDone: string[];
}

/** The gentle end after `unmatchedEnd` misunderstandings in a row: no payout, no penalty (§3.2). */
const GIVE_UP: Line = { ja: 'また|話しましょう。', en: "Let's talk again another time.", ar: 'لنتحدث مرة أخرى في وقت آخر.' };

export class ConversationSession {
  readonly id: string;
  readonly turns: Turn[] = [];
  readonly stepsDone = new Set<string>();
  nodeId: string;
  ended = false;
  /** 'end' = an end node was reached; 'unmatched' = the character gave up after six misunderstandings in a row */
  endedBy: 'end' | 'unmatched' | null = null;
  hintsUsed = 0;
  fallbacks = 0;
  fallbackStreak = 0;
  flags: Record<string, boolean>;
  /** what the app has shown the learner so far (the copy rule's input, D37) */
  readonly shown: ShownSet = createShownSet();
  /** `IntentDef.remember` output: fact key -> value (slot option id, captured text, or literal) */
  readonly remembered: Record<string, string> = {};
  private baseVars: Vars;
  /** what `game.vars` / `charge` / `intent` returned last; wins over `baseVars` */
  private gameVars: Vars = {};
  private slotIds: Record<string, string> = {};
  /** normalised texts of matched learner turns (duplicates are not substantive) */
  private said: string[] = [];
  /** texts the learner produced with help (a chip, a translation) earlier: retyping one is not a recalled line */
  private assistedSaid: string[] = [];
  /** Hint was opened since the last submit */
  private hintArmed = false;
  private nextId = 1;
  private startedAt: number;
  private now: () => number;
  private policy: ScoringPolicy;

  constructor(readonly opts: SessionOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.startedAt = this.now();
    this.id = opts.sessionId ?? uid('s_');
    this.policy = opts.policy ?? DEFAULT_SCORING_POLICY;
    this.nodeId = opts.startNode ?? opts.scenario.start;
    if (!opts.scenario.nodes[this.nodeId]) throw new Error(`Scenario ${opts.scenario.id} has no node ${this.nodeId}`);
    this.flags = opts.flags ?? {};
    this.baseVars = { name: { ja: opts.profileName || 'あなた', raw: true } };
  }

  get scenario() {
    return this.opts.scenario;
  }
  get character() {
    return this.opts.character;
  }
  get node(): SceneNode {
    return this.scenario.nodes[this.nodeId];
  }
  /** Variables for line templates: the learner's name and slots, with the game's (price, total...) on top. */
  get vars(): Vars {
    return { ...this.baseVars, ...this.gameVars };
  }

  private resolve(line: Line): ResolvedLine {
    return resolveLine(line, LEXICON, this.vars);
  }

  private pickSay(node: SceneNode): Line {
    for (const v of node.say) {
      if (!v.when) return v.line;
      const hit = 'flag' in v.when ? !!this.flags[v.when.flag] : v.when.in.includes(this.slotIds[v.when.slot] ?? '');
      if (hit) return v.line;
    }
    return node.say[node.say.length - 1].line;
  }

  /** Asks the game for its variables from the slots and flags as they stand now. */
  private refreshVars() {
    const game = this.opts.game;
    if (game) this.gameVars = game.vars({ ...this.slotIds }, { ...this.flags });
  }

  /** Move to a node, mark its goal step, and build the character's line. A `charge` node whose money is not there leads to its `onShort` node instead. */
  private enter(nodeId: string, newSteps: string[], depth = 0): Turn {
    const target = this.scenario.nodes[nodeId];
    let charged = false;
    if (target.econ === 'charge' && this.opts.game) {
      const r = this.opts.game.charge({ ...this.slotIds });
      if (r.ok) {
        charged = true;
        if (r.vars) this.gameVars = { ...this.gameVars, ...r.vars };
      } else {
        if (!target.onShort || depth > 4) throw new Error(`Node ${this.scenario.id}/${nodeId} charges without a usable onShort`);
        return this.enter(target.onShort, newSteps, depth + 1);
      }
    }
    this.nodeId = nodeId;
    const node = this.node;
    if (node.step && !this.stepsDone.has(node.step)) {
      this.stepsDone.add(node.step);
      newSteps.push(node.step);
    }
    if (node.end) {
      this.ended = true;
      this.endedBy = 'end';
    }
    return this.characterTurn({
      line: this.resolve(this.pickSay(node)),
      kind: 'say',
      emotion: node.emotion,
      stepsDone: newSteps,
      ...(charged ? { charged } : {}),
    });
  }

  private characterTurn(p: Pick<Turn, 'line' | 'kind'> & Partial<Turn>): Turn {
    const turn: Turn = {
      id: this.nextId++,
      speaker: 'character',
      assisted: false,
      stepsDone: [],
      matched: true,
      t: this.now() - this.startedAt,
      ...p,
    };
    this.turns.push(turn);
    if (turn.kind !== 'fallback') addShown(this.shown, 'npc', turn.line.written, turn.line.tokens, this.policy);
    return turn;
  }

  start(): Turn {
    this.refreshVars();
    return this.enter(this.nodeId, []);
  }

  private lastSay(): Turn | undefined {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      const t = this.turns[i];
      if (t.speaker === 'character' && (t.kind === 'say' || t.kind === 'repeat')) return t;
    }
    return undefined;
  }

  private setSlot(slot: string, opt?: SlotOption, raw?: string) {
    if (opt) {
      this.baseVars[slot] = { ja: opt.ja, gloss: opt.gloss };
      this.slotIds[slot] = opt.id;
    } else if (raw) {
      this.baseVars[slot] = { ja: raw, raw: true };
      delete this.slotIds[slot];
    }
  }

  private learnerTurn(input: SubmitInput, intentId?: string): Turn {
    let line: ResolvedLine;
    const assisted = input.mode === 'assist' || input.mode === 'suggestion';
    if (input.translation) {
      line = resolveLine({ ja: input.translation.ja, en: input.l1Text ?? '', ar: input.l1Text ?? '' }, LEXICON, { ...this.vars, ...input.translation.vars });
    } else {
      const text = input.kana ?? input.text;
      const tokens = segmentFree(text, LEXICON);
      line = { tokens, plain: speakableText(tokens), written: plainText(tokens), en: '', ar: '' };
    }
    const turn: Turn = {
      id: this.nextId++,
      speaker: 'learner',
      line,
      kind: 'say',
      mode: input.mode,
      assisted,
      l1Text: input.l1Text,
      stepsDone: [],
      intentId,
      matched: true,
      t: this.now() - this.startedAt,
    };
    if (input.confidence !== undefined) turn.confidence = input.confidence;
    this.turns.push(turn);
    return turn;
  }

  private hasAlternatives(input: SubmitInput): boolean {
    return input.mode === 'speech_ja' && (input.alternatives?.length ?? 0) > 1;
  }

  /** The node's best intent for the utterance; a speech turn with alternatives tries every one and keeps the best hit (§12.4). */
  private matchNode(input: SubmitInput, text: string): IntentHit | null {
    if (!this.hasAlternatives(input)) return matchNodeIntent(this.node, text);
    const alts = alternativesOf({ text: input.text, confidence: input.confidence ?? 1, alternatives: input.alternatives });
    return pickBestAlternative(alts, (t) => matchNodeIntent(this.node, t), (h) => h.score)?.hit ?? null;
  }

  private matchManagement(input: SubmitInput, text: string): GlobalIntent | null {
    if (!this.hasAlternatives(input)) return matchGlobal(text);
    for (const a of alternativesOf({ text: input.text, confidence: input.confidence ?? 1, alternatives: input.alternatives })) {
      const g = matchGlobal(a.text);
      if (g) return g;
    }
    return null;
  }

  /** Classifies a learner turn against what the app has shown so far; the turn itself is not in the shown set yet. */
  private classify(learner: Turn, text: string, matched: boolean, stepCompleted: boolean): TurnClassification {
    const recalledLine = !!this.opts.recalled?.length && matchesRecalled(text, this.opts.recalled, this.assistedSaid, this.policy);
    return classifyTurn(
      {
        mode: learner.mode ?? 'typed_ja',
        text,
        matched,
        contentTokens: learner.contentTokens ?? contentTokenCount(text),
        hintOpened: !!learner.hintOpened,
        idealScore: learner.ideal ? idealSimilarity(text, learner.ideal.written) : 0,
        recalledLine,
        shown: this.shown,
        said: this.said,
        stepCompleted,
      },
      this.policy,
    );
  }

  /** Learner says something in Japanese (typed, spoken, picked from a suggestion, or translated for them). */
  submit(input: SubmitInput): SubmitResult {
    if (this.ended) throw new Error('The conversation has ended');
    // translation variables (a name, an item) become part of the conversation state first
    if (input.translation) {
      for (const [k, v] of Object.entries(input.translation.vars)) {
        this.baseVars[k] = v;
        const opt = SLOTS[k]?.find((o) => o.ja === v.ja);
        if (opt) this.slotIds[k] = opt.id;
      }
    }
    const text = input.translation ? plainText(tokenize(input.translation.ja, LEXICON, { ...this.vars, ...input.translation.vars }).tokens) : (input.kana ?? input.text);
    const learner = this.learnerTurn(input);
    learner.contentTokens = contentTokenCount(text);
    learner.hintOpened = this.hintArmed;
    this.hintArmed = false; // a Hint belongs to the submit that follows it
    const newSteps: string[] = [];

    const hit = this.matchNode(input, text);
    if (hit) {
      const it = hit.intent;
      this.fallbackStreak = 0;
      learner.intentId = it.id;
      learner.request = it.request;
      if (it.slot) {
        const fromKana = input.mode === 'typed_romaji' || !!input.kana;
        this.setSlot(it.slot, hit.option, hit.rawCountry ? (fromKana ? toKatakana(hit.rawCountry) : hit.rawCountry) : undefined);
      }
      for (const a of hit.also ?? []) this.setSlot(a.slot, a.option);
      if (hit.rawName) this.baseVars.name = { ja: input.kana ? toKatakana(hit.rawName) : hit.rawName, raw: true };
      if (it.remember) this.remember(it.remember, hit);
      if (it.ideal) learner.ideal = this.resolve(it.ideal);
      this.refreshVars();

      let ok = true;
      if (it.econ && this.opts.game?.intent) {
        // a chip, a hint or a translation made this turn assisted whatever the mode says (the haggle share depends on it)
        const assisted = this.classify(learner, text, true, false).cls !== 'I';
        const r = this.opts.game.intent(it.econ, { slotIds: { ...this.slotIds }, assisted, number: hit.number });
        ok = r.ok;
        if (r.vars) this.gameVars = { ...this.gameVars, ...r.vars };
      }
      if (ok && it.step && !this.stepsDone.has(it.step)) {
        this.stepsDone.add(it.step);
        newSteps.push(it.step);
      }
      const refused = !ok && it.nextIfNo;
      let character: Turn;
      if (!refused && it.stay && it.reply) {
        character = this.characterTurn({ line: this.resolve(it.reply), kind: 'reaction', emotion: 'happy', stepsDone: newSteps });
      } else {
        character = this.enter((refused ? it.nextIfNo : it.next)!, newSteps);
      }
      learner.stepsDone = [...newSteps];
      this.finishLearnerTurn(learner, text, true, newSteps.length > 0, false);
      return { learner, character, ended: this.ended, stepsDone: newSteps };
    }

    const global = this.matchManagement(input, text);
    if (global) {
      this.fallbackStreak = 0;
      learner.intentId = global.id;
      learner.global = true;
      this.refreshVars();
      const character = this.globalReaction(global);
      this.finishLearnerTurn(learner, text, true, false, true);
      return { learner, character, ended: false, stepsDone: [] };
    }

    this.fallbacks++;
    this.fallbackStreak++;
    learner.matched = false;
    this.refreshVars();
    this.finishLearnerTurn(learner, text, false, false, false);
    if (this.fallbackStreak >= this.policy.unmatchedEnd) {
      this.ended = true;
      this.endedBy = 'unmatched';
      const character = this.characterTurn({ line: this.resolve(GIVE_UP), kind: 'reaction', emotion: 'neutral' });
      return { learner, character, ended: true, stepsDone: [] };
    }
    const character = this.characterTurn({
      line: this.resolve(REACTIONS.fallback),
      kind: 'fallback',
      emotion: 'confused',
      needsHelp: this.fallbackStreak >= 2,
    });
    return { learner, character, ended: false, stepsDone: [] };
  }

  /** Stores the credit class on the turn and updates what later turns are compared against. */
  private finishLearnerTurn(learner: Turn, text: string, matched: boolean, stepCompleted: boolean, management: boolean) {
    const c = this.classify(learner, text, matched, stepCompleted);
    // conversation management (もう一度, ありがとう) never counts as a turn of the scenario
    learner.score = management ? { ...c, substantive: false } : c;
    if (matched) {
      // only a turn that counted can make a later repeat a duplicate: management (ありがとう) and a thin keyword that completed nothing
      // are not turns of the scenario, so saying the same words again where they complete a goal step must still count
      if (c.substantive && !management) this.said.push(normTurn(text));
      if (c.cls !== 'I') this.assistedSaid.push(text);
    }
    // a translation the learner asked for was on screen: copying it later is class T (this turn was judged first)
    if (learner.mode === 'assist') addShown(this.shown, 'translations', learner.line.written);
  }

  private remember(rule: NonNullable<IntentDef['remember']>, hit: IntentHit) {
    let value: string | undefined;
    if (rule.from === 'literal') value = rule.value;
    else if (rule.from === 'slot') value = hit.option?.id;
    else value = hit.rawName ?? hit.rawCountry ?? hit.option?.ja.replace(/\|/g, '');
    if (value) this.remembered[rule.fact] = value;
  }

  private globalReaction(g: GlobalIntent): Turn {
    const last = this.lastSay();
    switch (g.id) {
      case 'repeat':
        return this.characterTurn({ line: last ? last.line : this.resolve(REACTIONS.fallback), kind: 'repeat', emotion: last?.emotion });
      case 'slow':
      case 'dont_understand':
        return this.characterTurn({ line: this.resolve(REACTIONS.slow), kind: 'reaction', followUp: last?.line, slow: true, emotion: 'happy' });
      case 'thanks':
        return this.characterTurn({ line: this.resolve(REACTIONS.thanks), kind: 'reaction', emotion: 'happy' });
      case 'excuse':
        return this.characterTurn({ line: this.resolve(REACTIONS.excuse), kind: 'reaction' });
      case 'how_are_you':
        return this.characterTurn({ line: this.resolve(REACTIONS.how_are_you), kind: 'reaction', emotion: 'happy' });
      case 'goodbye':
        return this.characterTurn({ line: this.resolve(REACTIONS.goodbye), kind: 'reaction' });
      case 'greet':
      default:
        return this.characterTurn({ line: this.resolve(REACTIONS.greet), kind: 'reaction', emotion: 'happy' });
    }
  }

  /** Learner repeats the character's last line slowly (from the UI button, not by speaking). */
  lastCharacterLine(): ResolvedLine | undefined {
    return this.lastSay()?.line;
  }

  /** The chips for this node without showing them: nothing enters the shown set (Real mode, tests, logging). */
  peekSuggestions(): ResolvedSuggestion[] {
    const node = this.node;
    if (node.end) return [];
    const base = node.suggestionsByL1?.[this.opts.l1] ?? node.suggestions ?? [];
    let list = base;
    if (node.topicSuggestions) {
      const topical: Suggestion[] = [];
      for (const id of this.opts.topics) {
        const hobby = TOPICS.find((t) => t.id === id)?.hobby;
        const opt = SLOTS.hobby.find((o) => o.id === hobby);
        if (opt) {
          topical.push({
            ja: `${opt.ja}|が|好き|です。`,
            en: `I like ${opt.gloss.en}.`,
            ar: `أحب ${opt.gloss.ar}.`,
          });
        }
        if (topical.length === 3) break;
      }
      const used = new Set(topical.map((s) => s.ja));
      list = [...topical, ...base.filter((s) => !used.has(s.ja))].slice(0, 3);
    }
    return list.map((s) => ({ ...this.resolve(s), source: s }));
  }

  /**
   * The chips for this node. Asking for them is showing them: the lines enter the shown set, so typing one back is a copy (§3.2).
   * A UI that hides chips (Real mode) simply does not call this, and the Hint button reveals one chip only.
   */
  suggestions(): ResolvedSuggestion[] {
    const list = this.peekSuggestions();
    for (const s of list) addShown(this.shown, 'chips', s.written);
    return list;
  }

  /** The most direct suggestion; counts toward the "hints used" tally and caps the next turn at class S. */
  hint(): ResolvedSuggestion | null {
    const s = this.peekSuggestions();
    if (!s.length) return null;
    // a Hint that is already open is the same hint: tapping the button again must not cost a second use
    if (!this.hintArmed) this.hintsUsed++;
    this.hintArmed = true;
    addShown(this.shown, 'hints', s[0].written);
    return s[0];
  }

  /** The UI displayed a Japanese string that is not a chip or an NPC line (the preview of a "say it your way" translation). */
  noteShown(source: 'translations' | 'hints' | 'chips', text: string) {
    addShown(this.shown, source, text);
  }

  /** Submit one of the offered suggestions by index. */
  pickSuggestion(index: number): SubmitResult {
    const s = this.suggestions()[index];
    if (!s) throw new Error('No such suggestion');
    return this.submit({ text: s.written, mode: 'suggestion', l1Text: this.opts.l1 === 'ar' ? s.ar : s.en });
  }

  progress() {
    return { done: this.stepsDone.size, total: this.scenario.steps.length };
  }

  summary() {
    const learner = this.turns.filter((t) => t.speaker === 'learner');
    return {
      independentTurns: learner.filter((t) => !t.assisted).length,
      assistedTurns: learner.filter((t) => t.assisted).length,
      fallbacks: this.fallbacks,
      hintsUsed: this.hintsUsed,
      durationSec: Math.max(1, Math.round((this.now() - this.startedAt) / 1000)),
      goalDone: this.stepsDone.size,
      goalTotal: this.scenario.steps.length,
    };
  }

  /** What @lw/game settles: the credit class of every turn, the shown-set rules applied, the goal and the remembered facts (§3.2, §14.5). */
  facts(extra: FactsExtra): ConversationFacts {
    return buildConversationFacts(this, extra);
  }
}
