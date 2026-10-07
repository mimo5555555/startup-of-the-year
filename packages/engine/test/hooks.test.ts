// SessionOptions.game (vars, charge, intent), flags, startNode, alsoSlots, remember, n-best (agent 1C; docs/GAME_DESIGN.md §6.2, §15.9).
import { beforeAll, describe, expect, it } from 'vitest';
import { CHARACTERS, L, S, SLOTS, node, type IntentDef, type Scenario, type SlotOption, type Vars } from '@lw/content';
import { ConversationSession, classifyInput, setNumberParser, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';
import { parseNumbers, yenToJa } from '../../content/src/tokyo/game/jp-language';

const QTY: SlotOption[] = [
  { id: 'one', ja: '一つ', gloss: { en: 'one', ar: 'واحد' }, keys: { ja: ['ひとつ', '一つ'], en: ['one'], ar: ['واحد'] } },
  { id: 'two', ja: '二つ', gloss: { en: 'two', ar: 'اثنان' }, keys: { ja: ['ふたつ', '二つ'], en: ['two'], ar: ['اثنان'] } },
];
beforeAll(() => {
  setNumberParser(parseNumbers);
  SLOTS.hkQty = QTY;
});

const PRICE: Record<string, number> = { coffee: 450, onigiri: 160 };
const money = (n: number): Vars[string] => {
  const p = yenToJa(n);
  return { ja: p.markup, gloss: p.gloss };
};

const say = (ja: string, en = 'x') => ({ line: L(ja, en, en) });
const chips = (...ja: string[]) => ja.map((j) => S(j, 'x', 'x'));

const sayTotal: IntentDef = { id: 'say_total', any: ['円', 'えん'], econ: 'say_total', next: 'done', nextIfNo: 'wrong_total', step: 'price' };

/** A shop conversation in the shape of §6.7: order (item + qty) -> quote ({total}) -> done (charge) | short | leave. */
const SHOP: Scenario = {
  id: 'hk_shop',
  locationId: 'konbini',
  characterId: 'tanaka',
  level: 'A1',
  title: { en: 'Shop', ar: 'Shop' },
  setup: { en: 'Shop', ar: 'Shop' },
  steps: [
    { id: 'find', text: { en: 'find', ar: 'find' } },
    { id: 'price', text: { en: 'price', ar: 'price' } },
    { id: 'pts', text: { en: 'points', ar: 'points' } },
    { id: 'pay', text: { en: 'pay', ar: 'pay' } },
  ],
  start: 'start',
  minutes: 3,
  nodes: {
    start: node({
      id: 'start',
      say: [{ line: L('いらっしゃいませ。', 'Welcome.', 'أهلًا.'), when: { flag: 'twist' } }, say('いらっしゃいませ。ご注文は？')],
      suggestions: chips('コーヒーをください。', '見ているだけです。'),
      intents: [
        { id: 'order', slot: 'item', slotOptions: ['coffee', 'onigiri'], slotRequired: true, alsoSlots: ['hkQty'], next: 'quote', step: 'find', request: true, ideal: L('{item}|を|ください。', 'x', 'x'), remember: { fact: 'drink', from: 'slot' } },
        { id: 'look', any: ['見ているだけ'], next: 'leave' },
        { id: 'who', capture: 'name', any: ['です'], stay: true, reply: L('{name}|さん、|はい。', 'x', 'x'), remember: { fact: 'name', from: 'capture' } },
        { id: 'greet', any: ['こんにちは'], stay: true, reply: L('はい。', 'x', 'x'), remember: { fact: 'met', from: 'literal', value: 'yes' } },
      ],
    }),
    quote: node({
      id: 'quote',
      say: [say('{item}|は|{total}|です。')],
      suggestions: chips('いくらですか？', 'また来ます。'),
      intents: [
        { id: 'ask_total', any: ['いくら'], econ: 'ask_total', stay: true, reply: L('{total}|です。', 'x', 'x') },
        sayTotal,
        { id: 'haggle', any: ['安く', 'やすく', 'まけて'], econ: 'haggle', next: 'done', nextIfNo: 'no_discount' },
        { id: 'points', any: ['ポイント'], econ: 'use_points', next: 'quote', step: 'pts' },
        { id: 'later', any: ['また来ます', '考えます'], next: 'leave' },
      ],
    }),
    wrong_total: node({ id: 'wrong_total', say: [say('いいえ、|{total}|です。')], suggestions: chips('四百五十円です。', 'また来ます。'), intents: [sayTotal, { id: 'later2', any: ['また来ます'], next: 'leave' }] }),
    no_discount: node({ id: 'no_discount', say: [say('すみません、定価です。')], suggestions: chips('はい。', 'また来ます。'), intents: [{ id: 'ok', any: ['はい', 'わかりました'], next: 'done' }, { id: 'later3', any: ['また来ます'], next: 'leave' }] }),
    done: node({ id: 'done', end: true, econ: 'charge', onShort: 'short', step: 'pay', say: [say('ありがとうございました。{change}')], intents: [] }),
    short: node({ id: 'short', say: [say('すみません、少し足りません。')], suggestions: chips('また来ます。', '考えます。'), intents: [{ id: 'later4', any: ['また来ます', '考えます'], next: 'leave' }] }),
    leave: node({ id: 'leave', end: true, say: [say('またお待ちしております。')], intents: [] }),
  },
};

/** A tiny shop economy: cash in a closure, prices from PRICE, qty from the slot. */
function economy(cash: number, opts: { discount?: number; refuseHaggle?: boolean; pointsOk?: boolean } = {}) {
  const log = { vars: [] as Array<{ slots: Record<string, string>; flags: Record<string, boolean> }>, charges: 0, intents: [] as Array<{ kind: string; assisted: boolean; number?: number; slots: Record<string, string> }> };
  let discount = 0;
  const total = (slots: Record<string, string>) => (PRICE[slots.item] ?? 0) * (slots.hkQty === 'two' ? 2 : 1) - discount;
  const hooks: SessionGameHooks = {
    vars(slots, flags) {
      log.vars.push({ slots, flags });
      const v: Vars = {};
      if (slots.item) v.total = money(total(slots));
      return v;
    },
    charge(slots) {
      log.charges++;
      const t = total(slots);
      if (cash < t) return { ok: false };
      cash -= t;
      return { ok: true, vars: { change: { ja: '', raw: true } } };
    },
    intent(kind, ctx) {
      log.intents.push({ kind, assisted: ctx.assisted, number: ctx.number, slots: ctx.slotIds });
      if (kind === 'say_total') return { ok: ctx.number === total(ctx.slotIds) };
      if (kind === 'haggle') {
        if (opts.refuseHaggle) return { ok: false };
        discount = opts.discount ?? 40;
        return { ok: true, vars: { total: money(total(ctx.slotIds)) } };
      }
      if (kind === 'use_points') return { ok: !!opts.pointsOk };
      return { ok: true };
    },
  };
  return { hooks, log, cash: () => cash };
}

let n = 0;
function open(over: Partial<SessionOptions> = {}, scenario: Scenario = SHOP): ConversationSession {
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1: 'en', profileName: 'Layla', topics: [], now: () => (t += 4000), sessionId: `h${++n}`, ...over });
  s.start();
  return s;
}
const typed = (s: ConversationSession, text: string): SubmitResult => {
  const i = classifyInput(text);
  if (i.kind === 'ja') return s.submit({ text: i.text, mode: 'typed_ja' });
  if (i.kind === 'romaji') return s.submit({ text: i.text, kana: i.kana, mode: 'typed_romaji' });
  throw new Error(`not Japanese: ${text}`);
};
const said = (s: ConversationSession) => s.turns.at(-1)!.line.written;

describe('without game hooks a scenario runs exactly as before', () => {
  it('ignores econ, onShort and the hook-only vars', () => {
    const s = open();
    typed(s, 'コーヒーをください');
    expect(s.nodeId).toBe('quote');
    // no hook: {total} stays unresolved rather than crashing
    typed(s, '450円です');
    expect(s.nodeId).toBe('done');
    expect(s.ended).toBe(true);
    expect(s.turns.at(-1)!.charged).toBeUndefined();
  });
});

describe('vars: refreshed on start and after every learner turn', () => {
  it('is called once at start and once per turn, with the slots and flags as they stand', () => {
    const e = economy(5000);
    const s = open({ game: e.hooks, flags: { twist: false } });
    expect(e.log.vars).toHaveLength(1);
    expect(e.log.vars[0]).toEqual({ slots: {}, flags: { twist: false } });
    typed(s, 'コーヒーをください');
    expect(e.log.vars).toHaveLength(2);
    expect(e.log.vars[1].slots).toEqual({ item: 'coffee' });
    typed(s, 'いくらですか');
    expect(e.log.vars).toHaveLength(3);
    typed(s, 'ふがふが'); // a fallback is a turn too
    expect(e.log.vars).toHaveLength(4);
  });

  it('the reply of the turn already uses the refreshed vars', () => {
    const e = economy(5000);
    const s = open({ game: e.hooks });
    typed(s, 'コーヒーをください');
    expect(said(s)).toBe('コーヒーは四百五十円です。');
    expect(s.vars.total.ja).toBe('四|百|五|十|円');
  });

  it('a changed slot changes the price on the next turn', () => {
    const e = economy(5000);
    const s = open({ game: e.hooks });
    typed(s, 'おにぎりをください');
    expect(said(s)).toBe('おにぎりは百六十円です。');
  });

  it('the hook gets copies: mutating them does not touch the session', () => {
    const hooks: SessionGameHooks = {
      vars: (slots, flags) => {
        slots.item = 'hacked';
        flags.twist = true;
        return {};
      },
      charge: () => ({ ok: true }),
    };
    const s = open({ game: hooks, flags: { twist: false } });
    typed(s, 'コーヒーをください');
    expect(s.flags.twist).toBe(false);
    expect(s.vars.item.ja).toBe('コーヒー');
  });
});

describe('alsoSlots', () => {
  it('「コーヒーをふたつ」 fills item and qty, and the price follows', () => {
    const e = economy(5000);
    const s = open({ game: e.hooks });
    typed(s, 'コーヒーをふたつください');
    expect(e.log.vars.at(-1)!.slots).toEqual({ item: 'coffee', hkQty: 'two' });
    expect(said(s)).toBe('コーヒーは九百円です。');
  });
  it('without a count the turn still goes through', () => {
    const e = economy(5000);
    const s = open({ game: e.hooks });
    typed(s, 'コーヒーをください');
    expect(s.nodeId).toBe('quote');
    expect(e.log.vars.at(-1)!.slots.hkQty).toBeUndefined();
  });
});

describe('charge: routes to onShort when the money is not there', () => {
  const order = (e: ReturnType<typeof economy>, text = 'コーヒーをふたつください') => {
    const s = open({ game: e.hooks });
    typed(s, text);
    typed(s, '900円');
    return s;
  };
  it('enough cash: the node is entered, the step is done, the character turn says it was charged', () => {
    const e = economy(1000);
    const s = order(e);
    expect(s.nodeId).toBe('done');
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['find', 'pay', 'price']);
    expect(s.turns.at(-1)).toMatchObject({ kind: 'say', charged: true });
    expect(e.log.charges).toBe(1);
    expect(e.cash()).toBe(100);
  });
  it('too little cash: short, no purchase, the pay step is not done and the conversation goes on', () => {
    const e = economy(500);
    const s = order(e);
    expect(s.nodeId).toBe('short');
    expect(s.ended).toBe(false);
    expect(s.stepsDone.has('pay')).toBe(false);
    expect(said(s)).toBe('すみません、少し足りません。');
    expect(s.turns.at(-1)!.charged).toBeUndefined();
    expect(e.cash()).toBe(500);
    // short -> leave never completes a shop scenario
    typed(s, 'また来ます');
    expect(s.nodeId).toBe('leave');
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['find', 'price']);
  });
  it('the one-more-yen boundary: exactly enough pays, one yen short does not', () => {
    expect(order(economy(900)).nodeId).toBe('done');
    expect(order(economy(899)).nodeId).toBe('short');
  });
  it('every suggestion still works on the short branch (tap-only is completable)', () => {
    const e = economy(0);
    const s = open({ game: e.hooks });
    s.pickSuggestion(0);
    expect(s.nodeId).toBe('quote');
    s.pickSuggestion(0); // いくらですか？ (stay)
    expect(s.nodeId).toBe('quote');
    typed(s, '450円');
    expect(s.nodeId).toBe('short');
    s.pickSuggestion(0);
    expect(s.ended).toBe(true);
  });
  it('a charge node without a usable onShort is an authoring error, not a free purchase', () => {
    const bad: Scenario = { ...SHOP, nodes: { ...SHOP.nodes, done: { ...SHOP.nodes.done, onShort: undefined } } };
    const e = economy(0);
    const s = open({ game: e.hooks }, bad);
    typed(s, 'コーヒーをください');
    expect(() => typed(s, '450円')).toThrow(/onShort/);
  });
});

describe('intent: say_total with digit input', () => {
  const quoted = () => {
    const e = economy(5000);
    const s = open({ game: e.hooks });
    typed(s, 'コーヒーをふたつください');
    return { e, s };
  };
  for (const text of ['900円', '900えん', '九百円', 'きゅうひゃくえん', '９００円', '全部で900円です']) {
    it(`"${text}" is the total`, () => {
      const { e, s } = quoted();
      typed(s, text);
      expect(s.nodeId).toBe('done');
      expect(e.log.intents.at(-1)).toMatchObject({ kind: 'say_total', number: 900, assisted: false });
    });
  }
  it('a wrong number is refused: nextIfNo, and the step is not credited', () => {
    const { e, s } = quoted();
    typed(s, '450円');
    expect(s.nodeId).toBe('wrong_total');
    expect(said(s)).toBe('いいえ、九百円です。');
    expect(s.stepsDone.has('price')).toBe(false);
    expect(e.log.intents.at(-1)).toMatchObject({ number: 450 });
    typed(s, '900円');
    expect(s.nodeId).toBe('done');
    expect(s.stepsDone.has('price')).toBe(true);
  });
  it('assisted: a tapped chip, a copy of a chip and a typed turn after a Hint are; your own typing is not', () => {
    const assistedOf = (play: (s: ConversationSession) => void) => {
      const e = economy(5000);
      const s = open({ game: e.hooks });
      typed(s, 'コーヒーをください');
      play(s);
      return e.log.intents.at(-1)!.assisted;
    };
    expect(assistedOf((s) => typed(s, '450円'))).toBe(false); // Real mode: nothing was shown
    expect(assistedOf((s) => s.pickSuggestion(0))).toBe(true); // いくらですか？ tapped
    expect(
      assistedOf((s) => {
        s.suggestions();
        typed(s, 'いくらですか？'); // a copy of the chip
      }),
    ).toBe(true);
    expect(
      assistedOf((s) => {
        s.hint();
        typed(s, '450円');
      }),
    ).toBe(true);
  });
  it('ask_total stays on the node and answers with the total', () => {
    const { e, s } = quoted();
    typed(s, 'いくらですか');
    expect(s.nodeId).toBe('quote');
    expect(said(s)).toBe('九百円です。');
    expect(e.log.intents.at(-1)!.kind).toBe('ask_total');
  });
});

describe('intent: haggle, use_points and routing', () => {
  it('haggle ok: the new total shows in the reply that follows, and the node is entered', () => {
    const e = economy(5000, { discount: 40 });
    const s = open({ game: e.hooks });
    typed(s, 'コーヒーをください');
    typed(s, 'もっと安くしてください');
    expect(s.nodeId).toBe('done');
    expect(s.vars.total.ja).toBe(money(410).ja);
    expect(e.cash()).toBe(5000 - 410);
  });
  it('haggle refused: nextIfNo', () => {
    const e = economy(5000, { refuseHaggle: true });
    const s = open({ game: e.hooks });
    typed(s, 'コーヒーをください');
    typed(s, 'もっと安くしてください');
    expect(s.nodeId).toBe('no_discount');
    expect(said(s)).toBe('すみません、定価です。');
    typed(s, 'わかりました');
    expect(s.nodeId).toBe('done');
    expect(e.cash()).toBe(5000 - 450);
  });
  it('an intent without nextIfNo whose hook says no still moves on, but earns no step', () => {
    const e = economy(5000, { pointsOk: false });
    const s = open({ game: e.hooks });
    typed(s, 'コーヒーをください');
    typed(s, 'ポイントをつかいます');
    expect(s.nodeId).toBe('quote');
    expect(s.stepsDone.has('pts')).toBe(false);
    const ok = economy(5000, { pointsOk: true });
    const t = open({ game: ok.hooks });
    typed(t, 'コーヒーをください');
    typed(t, 'ポイントをつかいます');
    expect(t.stepsDone.has('pts')).toBe(true);
  });
  it('an intent with econ but no hook (or a hook without `intent`) behaves as if the hook said yes', () => {
    const noIntent: SessionGameHooks = { vars: () => ({}), charge: () => ({ ok: true }) };
    const s = open({ game: noIntent });
    typed(s, 'コーヒーをください');
    typed(s, '12円');
    expect(s.nodeId).toBe('done');
  });
  it('ctx.number is absent for an intent heard without one', () => {
    const e = economy(5000);
    const s = open({ game: e.hooks });
    typed(s, 'コーヒーをください');
    typed(s, 'いくらですか');
    expect(e.log.intents.at(-1)!.number).toBeUndefined();
  });
});

describe('startNode', () => {
  it('begins at the named node and says its line', () => {
    const e = economy(5000);
    const s = open({ startNode: 'quote', game: e.hooks });
    expect(s.nodeId).toBe('quote');
    expect(s.turns).toHaveLength(1);
    expect(s.suggestions().map((x) => x.written)).toEqual(['いくらですか？', 'また来ます。']);
    expect(s.facts({ mode: 'guided', prepared: false }).startNode).toBe('quote');
  });
  it('the default is the scenario start, and an unknown node is an error', () => {
    expect(open().nodeId).toBe('start');
    expect(() => open({ startNode: 'nowhere' })).toThrow(/nowhere/);
  });
  it('a node with a step marks it on entry, like any other', () => {
    const s = open({ startNode: 'done' });
    expect(s.stepsDone.has('pay')).toBe(true);
    expect(s.ended).toBe(true);
  });
});

describe('flags-gated SayVariant', () => {
  it('the first variant whose flag is set wins; the last is the default', () => {
    expect(open().turns[0].line.written).toBe('いらっしゃいませ。ご注文は？');
    expect(open({ flags: { twist: true } }).turns[0].line.written).toBe('いらっしゃいませ。');
    expect(open({ flags: { twist: false } }).turns[0].line.written).toBe('いらっしゃいませ。ご注文は？');
  });
  it('a flag set later by the app applies to nodes entered afterwards', () => {
    const s = open();
    s.flags.twist = true;
    typed(s, '見ているだけです');
    expect(s.nodeId).toBe('leave');
    const flagged: Scenario = { ...SHOP, nodes: { ...SHOP.nodes, leave: node({ id: 'leave', end: true, say: [{ line: L('品切れです。', 'x', 'x'), when: { flag: 'twist' } }, say('またお待ちしております。')], intents: [] }) } };
    const t = open({}, flagged);
    t.flags.twist = true;
    typed(t, '見ているだけです');
    expect(said(t)).toBe('品切れです。');
  });
  it('the slot form of `when` still works next to the flag form', () => {
    const sc: Scenario = {
      ...SHOP,
      nodes: {
        ...SHOP.nodes,
        quote: node({
          id: 'quote',
          say: [{ line: L('コーヒーですね。', 'x', 'x'), when: { slot: 'item', in: ['coffee'] } }, { line: L('品切れです。', 'x', 'x'), when: { flag: 'twist' } }, say('はい。')],
          suggestions: chips('いくらですか？', 'また来ます。'),
          intents: [],
        }),
      },
    };
    const a = open({}, sc);
    typed(a, 'コーヒーをください');
    expect(said(a)).toBe('コーヒーですね。');
    const b = open({ flags: { twist: true } }, sc);
    typed(b, 'おにぎりをください');
    expect(said(b)).toBe('品切れです。');
    const c = open({}, sc);
    typed(c, 'おにぎりをください');
    expect(said(c)).toBe('はい。');
  });
});

describe('IntentDef.remember', () => {
  it('keeps the slot option id, the captured text or a literal', () => {
    const s = open();
    typed(s, 'こんにちは');
    typed(s, 'わたしはレイラです');
    typed(s, 'おにぎりをください');
    expect(s.remembered).toEqual({ met: 'yes', name: 'レイラ', drink: 'onigiri' });
    expect(s.facts({ mode: 'guided', prepared: false }).remembered).toEqual({ met: 'yes', name: 'レイラ', drink: 'onigiri' });
  });
  it('stores nothing for a rule that found nothing', () => {
    const s = open();
    typed(s, 'こんにちは');
    expect(s.remembered).toEqual({ met: 'yes' });
  });
});

describe('speech: n-best alternatives (§12.4)', () => {
  it('a hypothesis later in the list can win; the learner sees the first', () => {
    const s = open();
    const r = s.submit({ text: 'こうひをください', mode: 'speech_ja', confidence: 0.6, alternatives: [{ text: 'こうひをください', confidence: 0.6 }, { text: 'コーヒーをください', confidence: 0.4 }] });
    expect(r.learner.matched).toBe(true);
    expect(r.learner.line.written).toBe('こうひをください');
    expect(s.nodeId).toBe('quote');
    expect(s.vars.item.ja).toBe('コーヒー');
  });
  it('without alternatives, or for typed input, nothing changes', () => {
    const s = open();
    expect(s.submit({ text: 'ふがふが', mode: 'speech_ja', confidence: 0.9 }).learner.matched).toBe(false);
    const t = open();
    expect(t.submit({ text: 'ふがふが', mode: 'typed_ja', alternatives: [{ text: 'ふがふが', confidence: 1 }, { text: 'コーヒーをください', confidence: 1 }] }).learner.matched).toBe(false);
  });
  it('when no alternative matches the node it is still a fallback', () => {
    const s = open();
    const r = s.submit({ text: 'ほげ', mode: 'speech_ja', alternatives: [{ text: 'ほげ', confidence: 0.5 }, { text: 'ふが', confidence: 0.4 }] });
    expect(r.character.kind).toBe('fallback');
    expect(s.fallbacks).toBe(1);
  });
});

describe('the five existing scenarios with hooks that change nothing', () => {
  const idle: SessionGameHooks = { vars: () => ({}), charge: () => ({ ok: true }) };
  for (const id of ['cafe', 'konbini', 'station', 'ramen', 'park']) {
    it(`${id}: picking the first suggestion everywhere finishes it, with and without hooks`, async () => {
      const { scenarioById } = await import('@lw/content');
      const sc = scenarioById(id)!;
      const run = (game?: SessionGameHooks) => {
        const s = open({ game }, sc);
        let guard = 0;
        while (!s.ended && guard++ < 20) s.pickSuggestion(0);
        return { ended: s.ended, steps: [...s.stepsDone].sort(), node: s.nodeId, lines: s.turns.map((t) => t.line.written) };
      };
      expect(run(idle)).toEqual(run());
      expect(run().ended).toBe(true);
    });
  }
});
