// German through the real engine (German step 1): Jana's bakery in Berlin. Every chip is understood at every node (with and without
// the game's hooks, with the cash-only twist, EN and AR); typed German works with or without umlauts and in any letter case; the
// total is the menu's; the global intents speak German; English typed into a German conversation is English; du with the baker gets a
// Sie note; and a Japanese session next to it is unchanged.
import { describe, expect, it } from 'vitest';
import { BAKERY, BAKERY_PRICES, CHARACTERS, JANA, scenarioById, type L1, type Vars } from '@lw/content';
import { euroText } from '@lw/core';
import { ConversationSession, DE, classifyInput, evaluateSession, isGerman, targetLanguage, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

const QTY: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };

/** The till in cents: the food × qty, plus the drink. */
function till(cents: number) {
  const log = { charges: [] as Array<{ cents: number; slots: Record<string, string> }> };
  const bill = (slots: Record<string, string>) =>
    (slots.bakery ? BAKERY_PRICES[slots.bakery]! * (QTY[slots.qty ?? 'one'] ?? 1) : 0) + (slots.bakeryDrink ? BAKERY_PRICES[slots.bakeryDrink]! : 0);
  const hooks: SessionGameHooks = {
    vars: (slots): Vars => (bill(slots ?? {}) > 0 ? { total: { ja: euroText(bill(slots ?? {})).written, raw: true } } : {}),
    charge(slots) {
      const c = bill(slots);
      if (!c || cents < c) return { ok: false };
      log.charges.push({ cents: c, slots: { ...slots } });
      cents -= c;
      return { ok: true };
    },
  };
  return { hooks, log };
}

function open(l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  let t = 0;
  const s = new ConversationSession({ scenario: BAKERY, character: JANA, l1, profileName: 'Leila', topics: ['food'], now: () => (t += 4000), language: DE, ...extra });
  s.start();
  return s;
}

const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text, DE);
  if (input.kind !== 'ja') throw new Error(`Not German: ${text}`);
  return s.submit({ text: input.text, mode: 'typed_ja' });
};

function walk(l1: L1, mk: () => Partial<SessionOptions>) {
  const problems: string[] = [];
  const visited = new Set<string>();
  const replay = (path: number[]) => {
    const s = open(l1, mk());
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const visit = (path: number[]) => {
    const s = replay(path);
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
    if (visited.has(key) || s.ended) return;
    visited.add(key);
    s.suggestions().forEach((sg, i) => {
      if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
      if (sg.written !== sg.written.trim() || /\S[.,!?]\S/.test(sg.written.replace(/\d,\d/g, ''))) problems.push(`${s.nodeId}/#${i}: spacing "${sg.written}"`);
      const r = replay(path).pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…')) problems.push(`${s.nodeId}/#${i}: the answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: the answer has a token without gloss`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, nodes: new Set([...visited].map((k) => k.split('|')[0])) };
}

describe('berlin_bakery: every chip is understood', () => {
  const modes: Array<[string, () => Partial<SessionOptions>]> = [
    ['without hooks', () => ({})],
    ['with hooks, plenty of cash', () => ({ game: till(5000).hooks, flags: { priced: true } })],
    ['with hooks, cash only, almost no money', () => ({ game: till(100).hooks, flags: { priced: true, cashOnly: true } })],
  ];
  for (const [label, mk] of modes) {
    for (const l1 of ['en', 'ar'] as const) {
      it(`${label}, ${l1}`, () => {
        const { problems, nodes } = walk(l1, mk);
        expect(problems).toEqual([]);
        for (const n of ['start', 'recommend', 'more', 'to_go', 'pay']) expect(nodes.has(n), n).toBe(true);
      });
    }
  }
});

describe('breakfast in German', () => {
  it('typed: two rolls, a coffee to go, by card: one charge of the menu prices; Jana speaks German with spaces', () => {
    const c = till(5000);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    expect(s.turns[0]!.line.written).toBe('Guten Morgen! Was darf es sein?');
    for (const [line, node] of [
      ['Zwei Brötchen, bitte.', 'more'],
      ['Und einen Kaffee, bitte.', 'to_go'],
      ['Zum Mitnehmen, bitte.', 'pay'],
    ] as const) {
      const r = say(s, line);
      expect(r.learner.matched, line).toBe(true);
      expect(s.nodeId, line).toBe(node);
    }
    expect(s.turns.at(-1)!.line.written).toBe('Das macht 3,40 €. Bar oder mit Karte?');
    say(s, 'Mit Karte, bitte.');
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['drink', 'order', 'pay']);
    expect(c.log.charges).toEqual([{ cents: 2 * 45 + 250, slots: expect.objectContaining({ bakery: 'broetchen', qty: 'two', bakeryDrink: 'kaffee', payMethod: 'card' }) }]);
  });

  it('understands German typed without umlauts, in lower or upper case, and Berlin’s Schrippe', () => {
    for (const line of ['zwei broetchen bitte', 'ZWEI BROTCHEN BITTE', 'Zwei Schrippen, bitte!', 'Ich hätte gern zwei Brötchen.', '2 Brötchen bitte']) {
      const s = open();
      const r = say(s, line);
      expect(r.learner.intentId, line).toBe('order');
      expect(s.nodeId, line).toBe('more');
    }
    const one = open('en', { game: till(5000).hooks, flags: { priced: true } });
    for (const line of ['Eine Brezel, bitte.', 'Nein, danke. Das ist alles.']) say(one, line);
    expect(one.turns.at(-1)!.line.written).toBe('Das macht 1,20 €. Bar oder mit Karte?');
  });

  it('the recommendation is Berlin’s Pfannkuchen; 「einen Berliner」 is the same doughnut', () => {
    const s = open();
    say(s, 'Was können Sie empfehlen?');
    expect(s.nodeId).toBe('recommend');
    expect(s.turns.at(-1)!.line.written).toContain('In Berlin sagen wir Pfannkuchen, nicht Berliner!');
    const r = say(s, 'Dann einen Berliner, bitte.');
    expect(r.learner.intentId).toBe('order');
  });

  it('cash only: the card is refused kindly, cash pays', () => {
    const c = till(5000);
    const s = open('ar', { game: c.hooks, flags: { priced: true, cashOnly: true } });
    for (const line of ['Ein Croissant, bitte.', 'Das ist alles.']) say(s, line);
    const card = say(s, 'Mit Karte, bitte.');
    expect(card.learner.intentId).toBe('card_refused');
    expect(card.character.line.written).toBe('Tut mir leid, wir nehmen nur Bargeld.');
    expect(s.nodeId).toBe('pay');
    say(s, 'Dann bar, bitte.');
    expect(s.ended).toBe(true);
    expect(c.log.charges.map((x) => x.cents)).toEqual([150]);
  });

  it('short of money: Jana is kind about it and nothing is charged', () => {
    const c = till(100);
    const s = open('en', { game: c.hooks, flags: { priced: true } });
    for (const line of ['Zwei Pfannkuchen, bitte.', 'Nein, das ist alles.', 'Bar, bitte.']) say(s, line);
    expect(s.nodeId).toBe('short');
    expect(s.ended).toBe(true);
    expect(c.log.charges).toEqual([]);
  });

  it('the global intents speak German', () => {
    const s = open();
    expect(say(s, 'Langsam, bitte.').character.line.written).toBe('Gerne. Ich spreche langsamer.');
    expect(say(s, 'Wie bitte?').character.line.written).toBe('Guten Morgen! Was darf es sein?');
    expect(say(s, 'Danke!').character.line.written).toBe('Gern geschehen.');
    expect(s.nodeId).toBe('start');
    const lost = say(s, 'Wo ist der Bahnhof?');
    expect(lost.character.kind).toBe('fallback');
    expect(lost.character.line.written).toBe('Wie bitte? Noch einmal, bitte.');
  });
});

describe('German or not', () => {
  it('tells German from English and Arabic', () => {
    for (const t of ['Kaffee, bitte', 'Zwei Brötchen', 'ich möchte eine Brezel', 'Danke!', 'zwei broetchen bitte', '2,50 €', 'Hallo']) expect(isGerman(t), t).toBe(true);
    for (const t of ['a coffee please', 'I would like two rolls', 'hello', 'قهوة من فضلك', 'コーヒーをください', '']) expect(isGerman(t), t).toBe(false);
    expect(classifyInput('a coffee please', DE)).toMatchObject({ kind: 'l1', lang: 'en', translation: null });
    expect(classifyInput('قهوة من فضلك', DE)).toMatchObject({ kind: 'l1', lang: 'ar' });
  });
});

describe('Sie and du', () => {
  it('du with the baker gets a note with the Sie form; Sie gets none', () => {
    const s = open();
    say(s, 'Kannst du mir eine Brezel geben?');
    const du = evaluateSession(s);
    expect(du.corrections).toHaveLength(1);
    expect(du.corrections[0]).toMatchObject({ kind: 'register', original: 'Kannst du mir eine Brezel geben?', better: 'Können Sie mir eine Brezel geben?' });
    const sie = open();
    say(sie, 'Können Sie mir eine Brezel geben?');
    expect(evaluateSession(sie).corrections).toEqual([]);
  });

  it('Sie with a friend is a soft note: distant, not wrong', () => {
    const s = open('en', {});
    say(s, 'Können Sie mir eine Brezel geben?');
    const r = evaluateSession(s, { register: 'casual', friend: true });
    expect(r.corrections[0]).toMatchObject({ soft: true, better: 'Kannst du mir eine Brezel geben?' });
  });
});

describe('Japanese is unchanged next to German', () => {
  it('the default language is still Japanese, and a Japanese session still speaks Japanese', () => {
    expect(targetLanguage().id).toBe('ja');
    const sc = scenarioById('cafe')!;
    const s = new ConversationSession({ scenario: sc, character: CHARACTERS.find((c) => c.id === sc.characterId)!, l1: 'en', profileName: 'レイラ', topics: [] });
    s.start();
    expect(s.lang.id).toBe('ja');
    const r = s.submit({ text: 'コーヒーをください。', mode: 'typed_ja' });
    expect(r.learner.matched).toBe(true);
    expect(r.character.line.written.includes(' ')).toBe(false);
  });
});
