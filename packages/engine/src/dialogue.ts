import { toKatakana } from '@lw/core';
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
  type L1,
  type Line,
  type ResolvedLine,
  type Scenario,
  type SceneNode,
  type SlotOption,
  type Suggestion,
  type Vars,
} from '@lw/content';
import { matchGlobal, matchNodeIntent, type GlobalIntent } from './matching';
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
  stepsDone: string[];
  intentId?: string;
  request?: boolean;
  ideal?: ResolvedLine;
  /** learner turns: did the character understand it? */
  matched: boolean;
  needsHelp?: boolean;
  t: number;
}

export interface ResolvedSuggestion extends ResolvedLine {
  source: Suggestion;
}

export interface SessionOptions {
  scenario: Scenario;
  character: Character;
  l1: L1;
  profileName: string;
  topics: string[];
  now?: () => number;
}

export interface SubmitInput {
  text: string;
  mode: InputMode;
  l1Text?: string;
  translation?: TranslationResult;
  /** for typed romaji: the kana that was understood */
  kana?: string;
}

export interface SubmitResult {
  learner: Turn;
  character: Turn;
  ended: boolean;
  stepsDone: string[];
}

export class ConversationSession {
  readonly turns: Turn[] = [];
  readonly stepsDone = new Set<string>();
  nodeId: string;
  vars: Vars;
  ended = false;
  hintsUsed = 0;
  fallbacks = 0;
  fallbackStreak = 0;
  private slotIds: Record<string, string> = {};
  private nextId = 1;
  private startedAt: number;
  private now: () => number;

  constructor(readonly opts: SessionOptions) {
    this.now = opts.now ?? (() => Date.now());
    this.startedAt = this.now();
    this.nodeId = opts.scenario.start;
    this.vars = { name: { ja: opts.profileName || 'あなた', raw: true } };
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

  private resolve(line: Line): ResolvedLine {
    return resolveLine(line, LEXICON, this.vars);
  }

  private pickSay(node: SceneNode): Line {
    for (const v of node.say) {
      if (!v.when) return v.line;
      if (v.when.in.includes(this.slotIds[v.when.slot] ?? '')) return v.line;
    }
    return node.say[node.say.length - 1].line;
  }

  /** Move to a node, mark its goal step, and build the character's line. */
  private enter(nodeId: string, newSteps: string[]): Turn {
    this.nodeId = nodeId;
    const node = this.node;
    if (node.step && !this.stepsDone.has(node.step)) {
      this.stepsDone.add(node.step);
      newSteps.push(node.step);
    }
    if (node.end) this.ended = true;
    return this.characterTurn({
      line: this.resolve(this.pickSay(node)),
      kind: 'say',
      emotion: node.emotion,
      stepsDone: newSteps,
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
    return turn;
  }

  start(): Turn {
    return this.enter(this.scenario.start, []);
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
      this.vars[slot] = { ja: opt.ja, gloss: opt.gloss };
      this.slotIds[slot] = opt.id;
    } else if (raw) {
      this.vars[slot] = { ja: raw, raw: true };
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
    this.turns.push(turn);
    return turn;
  }

  /** Learner says something in Japanese (typed, spoken, picked from a suggestion, or translated for them). */
  submit(input: SubmitInput): SubmitResult {
    if (this.ended) throw new Error('The conversation has ended');
    // translation variables (a name, an item) become part of the conversation state first
    if (input.translation) {
      for (const [k, v] of Object.entries(input.translation.vars)) {
        this.vars[k] = v;
        const opt = SLOTS[k]?.find((o) => o.ja === v.ja);
        if (opt) this.slotIds[k] = opt.id;
      }
    }
    const text = input.translation ? plainText(tokenize(input.translation.ja, LEXICON, { ...this.vars, ...input.translation.vars }).tokens) : (input.kana ?? input.text);
    const learner = this.learnerTurn(input);
    const newSteps: string[] = [];

    const hit = matchNodeIntent(this.node, text);
    if (hit) {
      const it = hit.intent;
      this.fallbackStreak = 0;
      learner.intentId = it.id;
      learner.request = it.request;
      if (it.slot) {
        const fromKana = input.mode === 'typed_romaji' || !!input.kana;
        this.setSlot(it.slot, hit.option, hit.rawCountry ? (fromKana ? toKatakana(hit.rawCountry) : hit.rawCountry) : undefined);
      }
      if (hit.rawName) this.vars.name = { ja: input.kana ? toKatakana(hit.rawName) : hit.rawName, raw: true };
      if (it.ideal) learner.ideal = this.resolve(it.ideal);
      if (it.step && !this.stepsDone.has(it.step)) {
        this.stepsDone.add(it.step);
        newSteps.push(it.step);
      }
      learner.stepsDone = [...newSteps];
      if (it.stay && it.reply) {
        const reply = this.characterTurn({ line: this.resolve(it.reply), kind: 'reaction', emotion: 'happy', stepsDone: newSteps });
        return { learner, character: reply, ended: this.ended, stepsDone: newSteps };
      }
      const character = this.enter(it.next!, newSteps);
      return { learner, character, ended: this.ended, stepsDone: newSteps };
    }

    const global = matchGlobal(text);
    if (global) {
      this.fallbackStreak = 0;
      learner.intentId = global.id;
      return { learner, character: this.globalReaction(global), ended: false, stepsDone: [] };
    }

    this.fallbacks++;
    this.fallbackStreak++;
    learner.matched = false;
    const character = this.characterTurn({
      line: this.resolve(REACTIONS.fallback),
      kind: 'fallback',
      emotion: 'confused',
      needsHelp: this.fallbackStreak >= 2,
    });
    return { learner, character, ended: false, stepsDone: [] };
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

  suggestions(): ResolvedSuggestion[] {
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

  /** The most direct suggestion; counts toward the "hints used" tally. */
  hint(): ResolvedSuggestion | null {
    const s = this.suggestions();
    if (!s.length) return null;
    this.hintsUsed++;
    return s[0];
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
}
