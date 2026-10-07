// Turn classification T / S / I, the shown set, the copy rule, recalled lines, thin turns, substantive turns and ConversationFacts
// (agent 1C; docs/GAME_DESIGN.md §3.2, §15.9 "assist-vs-solo").
import { beforeAll, describe, expect, it } from 'vitest';
import { BALANCE, settleLoop, type ConversationFacts } from '@lw/game';
import { CHARACTERS, L, LEXICON, S, node, resolveLine, scenarioById, tokenize, type L1, type Scenario } from '@lw/content';
import {
  ConversationSession,
  DEFAULT_SCORING_POLICY,
  addShown,
  classifyInput,
  classifyTurn,
  copyScore,
  createShownSet,
  findCopy,
  idealSimilarity,
  matchesRecalled,
  normTurn,
  setNumberParser,
  type ClassifyInput,
  type SessionOptions,
  type ShownSet,
} from '../src';
import { parseNumbers } from '../../content/src/tokyo/game/jp-language';
import { mkPack, mkState } from '../../game/test/fixtures-money';

beforeAll(() => setNumberParser(parseNumbers));

/** mulberry32 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let n = 0;
function open(id: string, over: Partial<SessionOptions> = {}, l1: L1 = 'en'): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'Layla', topics: [], now: () => (t += 4000), sessionId: `s${++n}`, ...over });
  s.start();
  return s;
}
const typed = (s: ConversationSession, text: string) => s.submit({ text, mode: 'typed_ja' });
const last = (s: ConversationSession) => s.turns.filter((t) => t.speaker === 'learner').at(-1)!;
const cls = (s: ConversationSession) => last(s).score!;

describe('the numbers are the BALANCE numbers', () => {
  it('DEFAULT_SCORING_POLICY is BALANCE (the engine cannot import it at runtime)', () => {
    const { credit, copyScore: copy, thinTokens, thinIdeal, substantiveTokens, shownNpcTokens, unmatchedEnd } = BALANCE;
    expect(DEFAULT_SCORING_POLICY).toEqual({ credit, copyScore: copy, thinTokens, thinIdeal, substantiveTokens, shownNpcTokens, unmatchedEnd });
  });
});

describe('copyScore = max(1 - lev/maxlen, tokenDice) (§3.2)', () => {
  const chip = 'コーヒーをください。';
  it('identical text, kana/kanji/katakana and punctuation differences are a full copy', () => {
    expect(copyScore(chip, chip)).toBe(1);
    expect(copyScore('こーひーをください', chip)).toBe(1);
    expect(copyScore('現金でお願いします', 'げんきんでおねがいします')).toBe(1);
    expect(copyScore('', chip)).toBe(0);
  });
  it('one edit on a 9-character chip scores about 0.89, so a one-character change cannot escape the rule', () => {
    const oneEdit = copyScore('コーヒーをくださ', chip);
    expect(oneEdit).toBeGreaterThanOrEqual(BALANCE.copyScore);
    expect(copyScore('コーヒーをくだざい。', chip)).toBeGreaterThanOrEqual(BALANCE.copyScore);
    expect(copyScore('ココアをください。', chip)).toBeLessThan(BALANCE.copyScore);
  });
  it('the token dice catches a reordered copy that the edit distance misses', () => {
    const reordered = 'ください、コーヒーを';
    expect(copyScore(reordered, chip)).toBeGreaterThanOrEqual(BALANCE.copyScore);
  });
  it('unrelated text is far below the threshold', () => {
    expect(copyScore('トイレはどこですか', chip)).toBeLessThan(0.5);
  });
  it('a copy typed without the long vowels is still a copy', () => {
    expect(copyScore('こひをください', chip)).toBeGreaterThanOrEqual(BALANCE.copyScore);
  });
  it('findCopy reports the source: translations first, then hint, chips, NPC lines; null when nothing is copied', () => {
    const shown: ShownSet = { chips: [chip], hints: [chip], translations: [chip], npc: [] };
    expect(findCopy(chip, shown)?.source).toBe('translations');
    expect(findCopy(chip, { ...shown, translations: [] })?.source).toBe('hints');
    expect(findCopy(chip, { ...shown, translations: [], hints: [] })?.source).toBe('chips');
    expect(findCopy('ラテをください', shown)).toBeNull();
    expect(findCopy(chip, shown, ['npc'])).toBeNull();
  });
});

describe('the shown set', () => {
  it('keeps each string once', () => {
    const set = createShownSet();
    addShown(set, 'chips', 'こんにちは。');
    addShown(set, 'chips', 'こんにちは。');
    addShown(set, 'chips', '   ');
    expect(set.chips).toEqual(['こんにちは。']);
  });
  it('an NPC line enters only with >= 4 content tokens: a short repeat-back is ordinary conversation', () => {
    const set = createShownSet();
    addShown(set, 'npc', '右ですね。');
    addShown(set, 'npc', 'いらっしゃいませ。ご注文は？');
    expect(set.npc).toEqual([]);
    addShown(set, 'npc', '全部で四百五十円です。現金ですか、カードですか？');
    expect(set.npc).toHaveLength(1);
  });
});

describe('classifyTurn: first match wins (§3.2)', () => {
  const chip = 'コーヒーをください。';
  const shown = (over: Partial<ShownSet> = {}): ShownSet => ({ chips: [chip], hints: [], translations: [], npc: [], ...over });
  const base: ClassifyInput = { mode: 'typed_ja', text: 'ラテをください。', matched: true, contentTokens: 2, hintOpened: false, idealScore: 0, recalledLine: false, shown: shown(), said: [], stepCompleted: false };
  const run = (over: Partial<ClassifyInput>) => classifyTurn({ ...base, ...over });

  it('unmatched is not a turn at all', () => {
    expect(run({ matched: false })).toMatchObject({ cls: 'unmatched', credit: 0, substantive: false });
  });
  it('T: the learner asked in English or Arabic and the app translated', () => {
    expect(run({ mode: 'assist', text: chip })).toMatchObject({ cls: 'T', credit: 0.25 });
  });
  it('T: typing a copy of a translation, even one with an edit', () => {
    const tr = shown({ translations: ['トイレはどこですか？'] });
    expect(run({ text: 'トイレはどこですか？', shown: tr })).toMatchObject({ cls: 'T', credit: 0.25, copied: true });
    expect(run({ text: 'トイレはどこです', shown: tr }).cls).toBe('T');
    // a translation that is also a chip is still a translation copy
    expect(run({ text: chip, shown: shown({ translations: [chip] }) }).cls).toBe('T');
  });
  it('S: a tapped suggestion, Hint opened at the node, or a copy of any other shown string', () => {
    expect(run({ mode: 'suggestion', text: chip })).toMatchObject({ cls: 'S', credit: 0.35 });
    expect(run({ hintOpened: true })).toMatchObject({ cls: 'S', credit: 0.35 });
    expect(run({ text: chip })).toMatchObject({ cls: 'S', copied: true });
    expect(run({ text: 'コーヒーをくださ' }).cls).toBe('S');
    expect(run({ text: '全部で四百五十円です。現金ですか', shown: shown({ npc: ['全部で四百五十円です。現金ですか、カードですか？'] }) }).cls).toBe('S');
  });
  it('I: everything else, 1.00', () => {
    expect(run({})).toMatchObject({ cls: 'I', credit: 1, thin: false, copied: false, recalled: false });
    for (const mode of ['typed_ja', 'typed_romaji', 'speech_ja'] as const) expect(run({ mode }).cls).toBe('I');
  });
  it('I: a recalled line is class I even though a chip with the same words is on screen', () => {
    expect(run({ text: chip, recalledLine: true })).toMatchObject({ cls: 'I', credit: 1, copied: true, recalled: true });
  });
  it('a recalled line never survives a tap, a Hint or a translation', () => {
    expect(run({ text: chip, recalledLine: true, mode: 'suggestion' }).cls).toBe('S');
    expect(run({ text: chip, recalledLine: true, hintOpened: true }).cls).toBe('S');
    expect(run({ text: chip, recalledLine: true, shown: shown({ translations: [chip] }) }).cls).toBe('T');
  });
  it('a one-keyword turn earns 0.60 unless it is close to the ideal line', () => {
    expect(run({ contentTokens: 1, idealScore: 0.25 })).toMatchObject({ cls: 'I', credit: 0.6, thin: true });
    expect(run({ contentTokens: 1, idealScore: 0.5 })).toMatchObject({ credit: 1, thin: false });
    expect(run({ contentTokens: 2, idealScore: 0 })).toMatchObject({ credit: 1, thin: false });
    // thin is a class-I notion
    expect(run({ mode: 'suggestion', contentTokens: 1 }).thin).toBe(false);
  });
  it('substantive: matched, not said before, and (>= 2 content tokens or it completed a step)', () => {
    expect(run({})).toMatchObject({ substantive: true });
    expect(run({ contentTokens: 1 }).substantive).toBe(false);
    expect(run({ contentTokens: 1, stepCompleted: true }).substantive).toBe(true);
    expect(run({ said: [normTurn('ラテをください')], text: 'ラテをください。' }).substantive).toBe(false);
    expect(run({ said: [normTurn('ラテをください')], text: 'ラテをください。', stepCompleted: true }).substantive).toBe(false);
  });

  it('credits are ordered T < S < thin I < I', () => {
    const c = DEFAULT_SCORING_POLICY.credit;
    expect(c.T).toBeLessThan(c.S);
    expect(c.S).toBeLessThan(c.thinI);
    expect(c.thinI).toBeLessThan(c.I);
  });

  it('property: a turn that copies a shown string is never class I unless it is a recalled line', () => {
    const r = rng(42);
    const pool = ['コーヒーをください。', 'ホットをお願いします。', 'Wi-Fiのパスワードを教えてください。', '現金でお願いします。', 'おにぎりはありますか？', 'トイレはどこですか？', '渋谷へ行きたいです。'];
    const noise = ['あ', 'ん', 'を', 'ー', 'ね'];
    let copies = 0;
    for (let i = 0; i < 300; i++) {
      const src = pool[Math.floor(r() * pool.length)];
      let text = Array.from(src);
      for (let e = Math.floor(r() * 3); e > 0; e--) {
        const at = Math.floor(r() * text.length);
        const op = r();
        if (op < 0.4) text.splice(at, 1);
        else if (op < 0.7) text.splice(at, 0, noise[Math.floor(r() * noise.length)]);
        else text[at] = noise[Math.floor(r() * noise.length)];
      }
      const t = text.join('');
      const out = classifyTurn({ ...base, text: t, shown: shown({ chips: [src] }), contentTokens: 3 });
      if (copyScore(t, src) >= BALANCE.copyScore) {
        expect(out.cls, `${t} vs ${src}`).not.toBe('I');
        expect(out.copied).toBe(true);
        copies++;
      }
    }
    expect(copies).toBeGreaterThan(100); // the generator does produce near-copies
  });
});

describe('matchesRecalled (§3.2)', () => {
  const line = 'おにぎりをください。';
  it('matches a ready or known pocket line, with the usual copy tolerance', () => {
    expect(matchesRecalled('おにぎりをください', [line], [])).toBe(true);
    expect(matchesRecalled('おにぎりをくださ', [line], [])).toBe(true);
    expect(matchesRecalled('ラテをください', [line], [])).toBe(false);
    expect(matchesRecalled('おにぎりをください', [], [])).toBe(false);
  });
  it('is not recalled when the learner already produced it with help (chip-then-retype)', () => {
    expect(matchesRecalled('おにぎりをください', [line], ['おにぎりをください。'])).toBe(false);
  });
});

describe('a session classifies every learner turn', () => {
  it('tapping suggestions is class S, 0.35', () => {
    const s = open('cafe');
    s.pickSuggestion(0);
    expect(cls(s)).toMatchObject({ cls: 'S', credit: 0.35, copied: true, substantive: true });
  });

  it('typing your own words is class I, 1.00', () => {
    const s = open('cafe');
    s.suggestions(); // Guided: the chips are on screen
    typed(s, 'ラテをください');
    expect(cls(s)).toMatchObject({ cls: 'I', credit: 1, thin: false, copied: false, substantive: true });
  });

  it('a one-edit copy of a chip is class S', () => {
    const s = open('cafe');
    const chip = s.suggestions()[0].written; // コーヒーをください。
    typed(s, chip.replace('ください', 'くだざい'));
    expect(cls(s)).toMatchObject({ cls: 'S', credit: 0.35, copied: true });
  });

  it('Real mode hides the chips, so the same words are the learner’s own (class I)', () => {
    const s = open('cafe'); // suggestions() is never called
    typed(s, 'コーヒーをください。');
    expect(cls(s)).toMatchObject({ cls: 'I', credit: 1, copied: false });
  });

  it('hint-then-type: the turn after a Hint is capped at S, whatever was typed, and the cap ends with that turn', () => {
    const s = open('cafe');
    const hint = s.hint()!;
    typed(s, 'ラテをください'); // own words, but the Hint was open
    expect(cls(s)).toMatchObject({ cls: 'S', credit: 0.35 });
    expect(last(s).hintOpened).toBe(true);
    expect(hint.written).toBe('コーヒーをください。');
    typed(s, 'ホットをお願いします');
    expect(cls(s)).toMatchObject({ cls: 'I' });
    expect(last(s).hintOpened).toBe(false);
    expect(s.hintsUsed).toBe(1);
  });

  it('peekSuggestions shows nothing: the chips stay out of the shown set', () => {
    const s = open('cafe');
    expect(s.peekSuggestions()).toHaveLength(3);
    expect(s.shown.chips).toEqual([]);
    typed(s, 'コーヒーをください。');
    expect(cls(s).cls).toBe('I');
  });

  it('Real mode with a Hint shows one line only: the other chips are not a copy source', () => {
    const s = open('cafe');
    s.hint();
    expect(s.shown.hints).toEqual(['コーヒーをください。']);
    expect(s.shown.chips).toEqual([]);
  });

  it('translate-then-copy-type is class T, never I', () => {
    const s = open('konbini');
    const tr = classifyInput('Where is the toilet?');
    if (tr.kind !== 'l1' || !tr.translation) throw new Error('translator');
    const ja = resolveLine({ ja: tr.translation.ja, en: '', ar: '' }, LEXICON, tr.translation.vars).written;
    s.noteShown('translations', ja); // the preview was on screen
    typed(s, ja);
    expect(cls(s)).toMatchObject({ cls: 'T', credit: 0.25, copied: true });
    // the same after actually sending the translation (a stay intent keeps the node), then typing it again
    const s2 = open('konbini');
    s2.submit({ text: 'Where is the toilet?', mode: 'assist', l1Text: 'Where is the toilet?', translation: tr.translation });
    expect(cls(s2).cls).toBe('T');
    typed(s2, ja);
    expect(cls(s2)).toMatchObject({ cls: 'T', substantive: false }); // and it is a duplicate
  });

  it('a copy of a long NPC line is class S; a short repeat-back is not a copy', () => {
    const sc: Scenario = {
      id: 'npc_copy',
      locationId: 'konbini',
      characterId: 'tanaka',
      level: 'A1',
      title: { en: 't', ar: 't' },
      setup: { en: 't', ar: 't' },
      steps: [{ id: 'ack', text: { en: 'a', ar: 'a' } }],
      start: 'start',
      minutes: 1,
      nodes: {
        start: node({
          id: 'start',
          say: [{ line: L('全部で|四百五十円|です。|現金|です|か、|カード|です|か？', 'x', 'x') }],
          suggestions: [S('はい。', 'Yes.', 'نعم.'), S('いいえ。', 'No.', 'لا.')],
          intents: [{ id: 'ack', any: ['現金', 'カード'], stay: true, reply: L('右|です|ね。', 'x', 'x') }, { id: 'bye', any: ['さようなら'], next: 'end', step: 'ack' }],
        }),
        end: node({ id: 'end', end: true, say: [{ line: L('さようなら。', 'x', 'x') }], intents: [] }),
      },
    };
    const s = new ConversationSession({ scenario: sc, character: CHARACTERS.find((c) => c.id === 'tanaka')!, l1: 'en', profileName: 'L', topics: [], sessionId: 'npc' });
    s.start();
    expect(s.shown.npc).toHaveLength(1);
    typed(s, '全部で四百五十円です。現金ですか、カードですか？');
    expect(cls(s)).toMatchObject({ cls: 'S', copied: true });
    // the reply 「右ですね」 has one content token: not in the shown set
    expect(s.shown.npc).toHaveLength(1);
    typed(s, '右ですね');
    expect(cls(s).copied).toBe(false);
  });

  describe('recalled lines', () => {
    const recalled = ['コーヒーをください。'];
    it('a recalled pocket line typed without help is class I although a chip shows the same words', () => {
      const s = open('cafe', { recalled });
      s.suggestions();
      typed(s, 'コーヒーをください。');
      expect(cls(s)).toMatchObject({ cls: 'I', credit: 1, copied: true, recalled: true });
    });
    it('the same line is class S when it was not recalled', () => {
      const s = open('cafe');
      s.suggestions();
      typed(s, 'コーヒーをください。');
      expect(cls(s)).toMatchObject({ cls: 'S', recalled: false });
    });
    it('hint-then-type and tap are never recalled lines', () => {
      const a = open('cafe', { recalled });
      a.hint();
      typed(a, 'コーヒーをください。');
      expect(cls(a).cls).toBe('S');
      const b = open('cafe', { recalled });
      b.pickSuggestion(0);
      expect(cls(b)).toMatchObject({ cls: 'S', recalled: false });
    });
    it('chip-then-retype is not a recalled line', () => {
      const s = open('konbini', { recalled: ['トイレはどこですか？'] });
      s.suggestions();
      s.pickSuggestion(2); // トイレはどこですか？ (a stay intent)
      expect(s.nodeId).toBe('start');
      typed(s, 'トイレはどこですか？');
      expect(cls(s)).toMatchObject({ cls: 'S', recalled: false });
    });
    it('translate-then-type is T even for a line the learner knows', () => {
      const s = open('cafe', { recalled });
      s.noteShown('translations', 'コーヒーをください。');
      typed(s, 'コーヒーをください。');
      expect(cls(s).cls).toBe('T');
    });
  });

  it('a one-keyword turn earns 0.60, and completes its step', () => {
    const s = open('cafe');
    typed(s, 'コーヒー');
    expect(cls(s)).toMatchObject({ cls: 'I', credit: 0.6, thin: true, substantive: true });
    expect(last(s).stepsDone).toEqual(['order']);
    const t = open('cafe');
    typed(t, 'コーヒーをください');
    expect(cls(t)).toMatchObject({ credit: 1, thin: false });
  });

  it('idealSimilarity is the edit distance only', () => {
    expect(idealSimilarity('コーヒー', 'コーヒーをください。')).toBeLessThan(0.5);
    expect(idealSimilarity('コーヒーください', 'コーヒーをください。')).toBeGreaterThan(0.5);
  });

  it('duplicates and thin non-step turns are not substantive', () => {
    const s = open('konbini');
    typed(s, 'トイレはどこですか');
    expect(cls(s).substantive).toBe(true);
    typed(s, 'トイレはどこですか');
    expect(cls(s)).toMatchObject({ cls: 'I', substantive: false });
    typed(s, 'トイレはどこですか？');
    expect(cls(s).substantive).toBe(false); // punctuation does not make it new
    typed(s, 'といれはどこですか');
    expect(cls(s).substantive).toBe(false); // nor does the script
    const c = open('cafe');
    typed(c, 'ホット'); // matches nothing at the first node
    expect(cls(c).cls).toBe('unmatched');
  });

  it('conversation management (もう一度, ありがとう) is understood but is not a turn of the scenario', () => {
    const s = open('cafe');
    typed(s, 'ありがとうございます');
    expect(last(s)).toMatchObject({ matched: true, global: true });
    expect(cls(s)).toMatchObject({ substantive: false });
    const facts = s.facts({ mode: 'guided', prepared: false });
    expect(facts.turns[0].intentId).toBeUndefined();
  });

  describe('six unmatched turns in a row end the conversation gently', () => {
    it('ends with no payout and no penalty', () => {
      const s = open('cafe');
      for (let i = 0; i < 5; i++) {
        expect(typed(s, 'ふがふが').ended).toBe(false);
      }
      expect(s.fallbackStreak).toBe(5);
      const r = typed(s, 'ほげほげ');
      expect(r.ended).toBe(true);
      expect(s.endedBy).toBe('unmatched');
      expect(r.character.kind).toBe('reaction');
      expect(r.character.line.written).toBe('また話しましょう。');
      expect(() => typed(s, 'こんにちは')).toThrow();
      const facts = s.facts({ mode: 'guided', prepared: false });
      expect(facts).toMatchObject({ abandoned: true, fallbacks: 6, goalDone: 0 });
      expect(facts.turns).toEqual([]); // unmatched turns are fallbacks, not turns
    });
    it('a matched turn resets the count', () => {
      const s = open('cafe');
      for (let i = 0; i < 5; i++) typed(s, 'ふがふが');
      typed(s, 'コーヒーをください');
      expect(s.fallbackStreak).toBe(0);
      for (let i = 0; i < 5; i++) expect(typed(s, 'ふがふが').ended).toBe(false);
      expect(s.ended).toBe(false);
    });
  });
});

describe('ConversationFacts', () => {
  const polite = ['コーヒーをください。', 'ホットをお願いします。', 'Wi-Fiのパスワードを教えてください。', 'ありがとうございます。', 'カードでお願いします。'];
  function playTyped(over: Partial<SessionOptions> = {}) {
    const s = open('cafe', over);
    for (const t of polite) typed(s, t);
    return s;
  }

  it('describes a finished conversation', () => {
    const s = playTyped();
    expect(s.ended).toBe(true);
    const f = s.facts({ mode: 'real', prepared: true });
    expect(f).toMatchObject({
      sessionId: s.id,
      scenarioId: 'cafe',
      characterId: s.character.id,
      mode: 'real',
      abandoned: false,
      goalDone: 4,
      goalTotal: 4,
      fallbacks: 0,
      hintUses: 0,
      accuracy: 100,
      requestsPolite: true,
      prepared: true,
      remembered: {},
    });
    expect(f.durationSec).toBeGreaterThan(0);
    expect(f.startNode).toBeUndefined();
    expect(f.turns.every((t) => t.cls === 'I')).toBe(true);
    // 「ありがとうございます」 after the Wi-Fi answer is one content token: understood, thin, and not a turn that counts
    expect(f.turns.map((t) => [t.credit, t.substantive])).toEqual([[1, true], [1, true], [1, true], [0.6, false], [1, true]]);
    // each learner turn lists the goal steps its exchange completed, node steps included (the last one pays)
    const steps = f.turns.flatMap((t) => t.stepIds);
    expect([...steps].sort()).toEqual(['order', 'pay', 'temp', 'wifi']);
    expect(f.turns.at(-1)!.stepIds).toContain('pay');
    expect(f.turns[0]).toMatchObject({ intentId: 'order_drink', request: true, contentTokens: expect.any(Number) });
    expect(f.turns[0].norm).toBe('こおひいおください');
  });

  it('newWords are the class-I words of a turn that nothing earlier in the conversation said; S and T turns bring none', () => {
    const s = open('cafe');
    typed(s, 'コーヒーをください');
    typed(s, 'コーヒーをください、ホットで'); // コーヒー is not new any more
    s.pickSuggestion(0);
    const f = s.facts({ mode: 'guided', prepared: false });
    expect(f.turns[0].newWords).toContain('コーヒー');
    expect(f.turns[1].newWords).not.toContain('コーヒー');
    expect(f.turns[2]).toMatchObject({ cls: 'S', newWords: [] });
    expect(f.turns[0].words).toContain('コーヒー');
  });

  it('polite-request accuracy: a bare noun on a request turn is a naturalness correction', () => {
    const s = open('cafe');
    typed(s, 'コーヒー');
    const f = s.facts({ mode: 'guided', prepared: false });
    expect(f.requestsPolite).toBe(false);
    expect(f.accuracy).toBeLessThan(100);
    expect(playTyped().facts({ mode: 'guided', prepared: false }).requestsPolite).toBe(true);
  });

  it('records the speech confidence, the start node and the pass-through facts', () => {
    const s = open('cafe', { startNode: 'hot_or_iced' });
    s.submit({ text: 'ホットをください', mode: 'speech_ja', confidence: 0.82 });
    const f = s.facts({ mode: 'guided', prepared: false, topic: 'food', revealed: ['a'], callbacks: ['hobby'], flags: ['twist_seen'], abandoned: true, durationSec: 99 });
    expect(f.turns[0].confidence).toBe(0.82);
    expect(f).toMatchObject({ startNode: 'hot_or_iced', topic: 'food', revealed: ['a'], callbacks: ['hobby'], flags: ['twist_seen'], abandoned: true, durationSec: 99 });
  });

  it('a conversation left half way is abandoned', () => {
    const s = open('cafe');
    typed(s, 'コーヒーをください');
    expect(s.facts({ mode: 'guided', prepared: false })).toMatchObject({ abandoned: true, goalDone: 1 });
  });
});

describe('assist-vs-solo: the pay ordering holds through the real engine and settleLoop (§15.9)', () => {
  const pack = mkPack({ scenarioMeta: [{ id: 'cafe', kind: 'shop', band: 'A1', register: 'polite', pay: 'full' }] });
  const pay = (f: ConversationFacts) => settleLoop(f, { ...mkState(), words: { said: [] } } as never, pack).loopPay;
  const facts = (s: ConversationSession): ConversationFacts => s.facts({ mode: 'guided', prepared: false });

  /** The one conversation every player has: order, temperature, Wi-Fi, thanks, pay. All four goal steps are done each time. */
  const LINES = ['コーヒーをください。', 'ホットをお願いします。', 'Wi-Fiのパスワードを教えてください。', 'ありがとうございます。', 'カードでお願いします。'];
  const ENGLISH = ["I'd like a coffee", 'Hot please', "What's the wifi password?", 'Thank you', 'By card please'];

  /** All-S: at each node tap the chip closest to the line (the same path as the typed run). */
  const tapAll = () => {
    const s = open('cafe');
    for (const line of LINES) {
      const chips = s.suggestions();
      const best = chips.map((c, i) => [copyScore(c.written, line), i] as const).sort((a, b) => b[0] - a[0])[0][1];
      s.pickSuggestion(best);
    }
    return s;
  };
  const translation = (en: string) => {
    const i = classifyInput(en);
    if (i.kind !== 'l1' || !i.translation) throw new Error(en);
    return i.translation;
  };

  it('every player finishes the same four goal steps', () => {
    const tapped = tapAll();
    expect(tapped.ended).toBe(true);
    expect(facts(tapped)).toMatchObject({ goalDone: 4, goalTotal: 4 });
    expect(facts(tapped).turns.map((t) => t.cls)).toEqual(['S', 'S', 'S', 'S', 'S']);
  });

  it('all-T never beats all-S never beats all-I', () => {
    const translated = open('cafe');
    for (const en of ENGLISH) translated.submit({ text: en, mode: 'assist', l1Text: en, translation: translation(en) });
    const own = open('cafe');
    // Real mode: no chip is on screen, so these are the learner's own words
    for (const t of ['ラテください', 'アイスをお願いします。', 'Wi-Fiのパスワードを教えてください。', 'ありがとうございます。', '現金でお願いします。']) typed(own, t);

    expect(facts(translated).turns.map((t) => t.cls)).toEqual(['T', 'T', 'T', 'T', 'T']);
    expect(facts(own).turns.map((t) => t.cls)).toEqual(['I', 'I', 'I', 'I', 'I']);
    const [pT, pS, pI] = [pay(facts(translated)), pay(facts(tapAll())), pay(facts(own))];
    expect([pT, pS, pI]).toEqual([expect.any(Number), expect.any(Number), expect.any(Number)]);
    expect(pT).toBeLessThan(pS);
    expect(pS).toBeLessThan(pI);
  });

  it('translate-then-copy-type pays no more than all-S', () => {
    const copy = open('cafe');
    for (const en of ENGLISH) {
      const tr = translation(en);
      const ja = resolveLine({ ja: tr.ja, en: '', ar: '' }, LEXICON, tr.vars).written;
      copy.noteShown('translations', ja); // the preview was on screen
      typed(copy, ja);
    }
    expect(copy.ended).toBe(true);
    expect(facts(copy).turns.map((x) => x.cls)).toEqual(['T', 'T', 'T', 'T', 'T']);
    expect(pay(facts(copy))).toBeLessThanOrEqual(pay(facts(tapAll())));
  });

  it('hint-then-type pays no more than all-S', () => {
    const hinted = open('cafe');
    for (const t of ['ラテください', 'アイスをお願いします。', 'Wi-Fiのパスワードを教えてください。', 'ありがとうございます。', '現金でお願いします。']) {
      hinted.hint();
      typed(hinted, t); // own words, but the Hint was open
    }
    expect(hinted.ended).toBe(true);
    expect(facts(hinted).turns.map((x) => x.cls)).toEqual(['S', 'S', 'S', 'S', 'S']);
    expect(facts(hinted).hintUses).toBe(5);
    expect(pay(facts(hinted))).toBeLessThanOrEqual(pay(facts(tapAll())));
  });

  it('retyping every chip in Guided mode pays no more than all-S either', () => {
    const retyped = open('cafe');
    for (const line of LINES) {
      const chips = retyped.suggestions();
      const best = chips.map((c) => [copyScore(c.written, line), c.written] as const).sort((a, b) => b[0] - a[0])[0][1];
      typed(retyped, best);
    }
    expect(facts(retyped).turns.map((x) => x.cls)).toEqual(['S', 'S', 'S', 'S', 'S']);
    expect(pay(facts(retyped))).toBeLessThanOrEqual(pay(facts(tapAll())));
  });
});

describe('tokens of a translation resolve like a line', () => {
  it('the preview text equals what a sent translation shows', () => {
    const i = classifyInput('Thank you');
    if (i.kind !== 'l1' || !i.translation) throw new Error('translator');
    const preview = resolveLine({ ja: i.translation.ja, en: '', ar: '' }, LEXICON, i.translation.vars).written;
    const s = open('cafe');
    const r = s.submit({ text: 'Thank you', mode: 'assist', l1Text: 'Thank you', translation: i.translation });
    expect(r.learner.line.written).toBe(preview);
    expect(tokenize(i.translation.ja, LEXICON, i.translation.vars).tokens.length).toBeGreaterThan(0);
  });
});
