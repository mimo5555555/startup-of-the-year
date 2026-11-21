// The Berlin street through the real engine (German step 2): every conversation (the bakery, the Späti, the Döner stand, the U-Bahn
// counter, the flea market and the three friends) understands every chip at every node, with and without the game's hooks, cash only
// or not, EN and AR; each has a typed route that ends where it should and charges the menu price; the friends take a name, a country
// and a hobby as they are said; and Sie with a friend is a soft note.
import { describe, expect, it } from 'vitest';
import {
  BAKERY_PRICES,
  BERLIN_SCENARIOS,
  BERLIN_SHOP_TALK,
  BERLIN_TALK_TOPICS,
  DOENER_PRICES,
  FLOHMARKT_PRICES,
  SPAETI_PRICES,
  TICKET_PRICES,
  berlinCharacterById,
  berlinScenarioById,
  type L1,
  type Vars,
} from '@lw/content';
import { euroText } from '@lw/core';
import { ConversationSession, DE, classifyInput, evaluateSession, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

const QTY: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
/** the item slots of the street and their prices in cents; `qty` counts the first one a conversation has */
const PRICES: Record<string, Record<string, number>> = {
  bakery: BAKERY_PRICES,
  spaeti: SPAETI_PRICES,
  doener: DOENER_PRICES,
  ticket: TICKET_PRICES,
  floh: FLOHMARKT_PRICES,
  bakeryDrink: BAKERY_PRICES,
};

/** The till in cents, with a haggle: 「billiger」 takes 10 % off; an offer is taken down to 80 % of the price, refused below. */
function till(cents: number) {
  const log = { charges: [] as Array<{ cents: number; slots: Record<string, string> }>, off: 0 };
  const full = (slots: Record<string, string>) => {
    let sum = 0;
    let first = true;
    for (const [slot, table] of Object.entries(PRICES)) {
      const p = slots[slot] ? table[slots[slot]!] : undefined;
      if (p === undefined) continue;
      sum += p * (first ? (QTY[slots.qty ?? 'one'] ?? 1) : 1);
      first = false;
    }
    return sum;
  };
  const bill = (slots: Record<string, string>) => Math.max(0, full(slots) - log.off);
  const hooks: SessionGameHooks = {
    vars: (slots): Vars => (bill(slots ?? {}) > 0 ? { total: { ja: euroText(bill(slots ?? {})).written, raw: true } } : {}),
    charge(slots) {
      const c = bill(slots);
      if (!c || cents < c) return { ok: false };
      log.charges.push({ cents: c, slots: { ...slots } });
      cents -= c;
      return { ok: true };
    },
    intent(kind, { slotIds, number }) {
      if (kind !== 'haggle') return { ok: true };
      const price = full(slotIds);
      const want = number !== undefined ? Math.round(number * 100) : Math.round(price * 0.9);
      if (want < price * 0.8) return { ok: false };
      log.off = price - want;
      return { ok: true, vars: { total: { ja: euroText(want).written, raw: true } } };
    },
  };
  return { hooks, log };
}

function open(id: string, l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = berlinScenarioById(id)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character: berlinCharacterById(scenario.characterId)!, l1, profileName: 'Leila', topics: ['food'], now: () => (t += 4000), language: DE, ...extra });
  s.start();
  return s;
}

const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text, DE);
  if (input.kind !== 'ja') throw new Error(`Not German: ${text}`);
  return s.submit({ text: input.text, mode: 'typed_ja' });
};
const last = (s: ConversationSession) => s.turns.at(-1)!.line.written;

function walk(id: string, l1: L1, mk: () => Partial<SessionOptions>) {
  const problems: string[] = [];
  const visited = new Set<string>();
  const replay = (path: number[]) => {
    const s = open(id, l1, mk());
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
      if (/\S[.,!?]\p{L}/u.test(sg.written) || /\s[.,!?]/.test(sg.written) || /\s{2}/.test(sg.written)) problems.push(`${s.nodeId}/#${i}: spacing "${sg.written}"`);
      const r = replay(path).pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…')) problems.push(`${s.nodeId}/#${i}: the answer has an unresolved variable ("${r.character.line.written}")`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: the answer has a token without gloss`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, nodes: new Set([...visited].map((k) => k.split('|')[0])) };
}

const SHOPS = ['berlin_bakery', 'berlin_spaeti', 'berlin_doener', 'berlin_ubahn', 'berlin_flohmarkt'];

describe('the Berlin street: every chip is understood', () => {
  // the street of German step 2; the friends' chats, gifts and hang-outs and the places of Chapters 4-6 have their own tests
  // (berlin-friends.test.ts, berlin-places.test.ts)
  const STREET = [...SHOPS, 'berlin_lena', 'berlin_kofi', 'berlin_jonas'];
  it('has the five shops and the three friends', () => {
    expect(BERLIN_SCENARIOS.map((s) => s.id)).toEqual(expect.arrayContaining(STREET));
  });
  for (const sc of BERLIN_SCENARIOS.filter((x) => STREET.includes(x.id))) {
    const shop = SHOPS.includes(sc.id);
    const modes: Array<[string, () => Partial<SessionOptions>]> = shop
      ? [
          ['without hooks', () => ({})],
          ['with hooks, plenty of cash', () => ({ game: till(100_000).hooks, flags: { priced: true } })],
          ['with hooks, cash only, almost no money', () => ({ game: till(100).hooks, flags: { priced: true, cashOnly: true } })],
        ]
      : [['a friend', () => ({})]];
    for (const [label, mk] of modes) {
      for (const l1 of ['en', 'ar'] as const) {
        it(`${sc.id}: ${label}, ${l1}`, () => {
          const { problems, nodes } = walk(sc.id, l1, mk);
          expect(problems).toEqual([]);
          // every node that talks is reached by chips (the end nodes by the last chips; a refused haggle only by a low offer, typed below)
          for (const n of Object.values(sc.nodes)) if (!n.end && n.id !== 'no_deal') expect(nodes.has(n.id), `${sc.id}: ${n.id}`).toBe(true);
        });
      }
    }
  }
});

describe('the Späti', () => {
  it('two waters, Pfand explained, cash: the shelf price with the deposit', () => {
    const c = till(10_000);
    const s = open('berlin_spaeti', 'en', { game: c.hooks, flags: { priced: true } });
    say(s, 'Zwei Wasser, bitte.');
    expect(last(s)).toBe('Das macht 2,50 €, mit Pfand. Bar oder mit Karte?');
    const pfand = say(s, 'Was ist Pfand?');
    expect(pfand.character.line.written).toContain('Pfand ist Geld für die Flasche: 25 Cent.');
    expect(s.nodeId).toBe('pay');
    say(s, 'Bar, bitte.');
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['drink', 'pay', 'pfand']);
    expect(c.log.charges.map((x) => x.cents)).toEqual([250]);
  });
});

describe('the Döner stand', () => {
  it('a Dürüm with everything and spicy; without onions; not spicy; to go; card', () => {
    const c = till(10_000);
    const s = open('berlin_doener', 'ar', { game: c.hooks, flags: { priced: true } });
    say(s, 'Einen Dürüm, bitte.');
    expect(last(s)).toBe('Mit allem? Und scharf?');
    expect(say(s, 'Ja, mit allem und scharf!').learner.intentId).toBe('everything');
    say(s, 'Zum Mitnehmen.');
    say(s, 'Mit Karte, bitte.');
    expect(s.ended).toBe(true);
    expect(last(s)).toBe('Danke! Guten Appetit!');
    expect(c.log.charges.map((x) => x.cents)).toEqual([750]);
    for (const [line, id] of [
      ['Mit allem, aber ohne Zwiebeln.', 'no_onions'],
      ['Bitte nicht so scharf.', 'not_spicy'],
      ['Alles, bitte.', 'everything'],
    ] as const) {
      const d = open('berlin_doener');
      say(d, 'Einen Döner, bitte.');
      expect(say(d, line).learner.intentId, line).toBe(id);
    }
  });
});

describe('the U-Bahn counter', () => {
  it('asks what a short trip is, buys two, pays, and is reminded to validate the ticket', () => {
    const c = till(10_000);
    const s = open('berlin_ubahn', 'en', { game: c.hooks, flags: { priced: true } });
    expect(say(s, 'Was kostet eine Kurzstrecke?').learner.intentId).toBe('ask_short');
    expect(last(s)).toBe('Eine Kurzstrecke kostet 2,60 €. Damit fahren Sie drei Stationen mit der U-Bahn.');
    say(s, 'Dann zwei Kurzstrecken, bitte.');
    expect(last(s)).toBe('Das macht 5,20 €. Bar oder mit Karte?');
    say(s, 'Mit Karte.');
    expect(last(s)).toContain('Den Fahrschein vor der Fahrt entwerten!');
    expect(c.log.charges.map((x) => x.cents)).toEqual([520]);
    const day = open('berlin_ubahn');
    expect(say(day, 'Ich brauche ein Ticket für den ganzen Tag.').learner.intentId).toBe('buy');
    expect(day.nodeId).toBe('pay');
  });
});

describe('the flea market', () => {
  it('asks the price, haggles 10 % off, pays cash: one charge of the haggled price', () => {
    const c = till(10_000);
    const s = open('berlin_flohmarkt', 'en', { game: c.hooks, flags: { priced: true } });
    say(s, 'Was kostet die Lampe?');
    expect(last(s)).toBe('Ah, die Lampe! Das kostet 20,00 €.');
    expect(say(s, 'Geht es ein bisschen billiger?').learner.intentId).toBe('haggle');
    expect(last(s)).toBe('Na gut, für Sie: 18,00 €. Aber nur bar!');
    say(s, 'Super, danke! Hier, bitte.');
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['ask', 'haggle', 'pay']);
    expect(c.log.charges.map((x) => x.cents)).toEqual([1800]);
  });

  it('the bike: 「das Fahrrad」 said back with its article; an offer of 60 euros is taken', () => {
    const c = till(10_000);
    const s = open('berlin_flohmarkt', 'en', { game: c.hooks, flags: { priced: true } });
    say(s, 'Was kostet das Fahrrad?');
    expect(last(s)).toBe('Ah, das Fahrrad! Das kostet 65,00 €.');
    expect(say(s, 'Geht es auch für sechzig Euro?').learner.intentId).toBe('haggle_offer');
    expect(last(s)).toBe('Na gut, für Sie: 60,00 €. Aber nur bar!');
    say(s, 'Hier, bitte.');
    expect(c.log.charges.map((x) => x.cents)).toEqual([6000]);
  });

  it('an offer too low is refused kindly; then you take it or think it over', () => {
    const c = till(10_000);
    const s = open('berlin_flohmarkt', 'ar', { game: c.hooks, flags: { priced: true } });
    say(s, 'Was kostet die Jacke?');
    expect(say(s, 'Geht es auch für zwanzig Euro?').learner.intentId).toBe('haggle_offer');
    expect(s.nodeId).toBe('no_deal');
    say(s, 'Gut, das nehme ich.');
    expect(last(s)).toBe('Prima! Das macht 35,00 €. Nur bar, bitte.');
    const later = open('berlin_flohmarkt');
    say(later, 'Was kostet die Kamera?');
    say(later, 'Ich überlege noch.');
    expect(later.nodeId).toBe('leave');
    expect(later.ended).toBe(true);
  });
});

describe('the friends', () => {
  it('Lena: a name in any form, a country listed or not, a hobby; she says them back', () => {
    const s = open('berlin_lena', 'ar');
    say(s, 'Hallo Lena! Ich heiße Samira.');
    expect(last(s)).toBe('Freut mich, Samira! Woher kommst du?');
    say(s, 'Ich komme aus Ägypten.');
    expect(last(s)).toContain('Ägypten möchte ich auch mal sehen.');
    say(s, 'Ich koche gern.');
    expect(last(s)).toBe('Super! Dann kochen wir mal zusammen. Willkommen in der WG, Samira!');
    expect(s.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['country', 'hobby', 'name']);

    const t = open('berlin_lena');
    say(t, 'Mein Name ist Tom.');
    say(t, 'Ich komme aus Island.');
    expect(last(t)).toContain('Island möchte ich auch mal sehen.');
    say(t, 'Ich lese gern Bücher.');
    expect(last(t)).toBe('Schön! Das machen wir mal zusammen. Willkommen in der WG, Tom!');
  });

  it('Kofi: lives here too, a name, a bike or not', () => {
    const yes = open('berlin_kofi');
    for (const line of ['Ja, ich wohne im dritten Stock.', 'Ich bin Leila.', 'Ja, ich habe ein Fahrrad.']) say(yes, line);
    expect(last(yes)).toContain('Ich repariere Fahrräder!');
    const no = open('berlin_kofi');
    for (const line of ['Ja, ich bin neu hier.', 'Ich heiße Leila.', 'Nein, ich habe kein Fahrrad.']) say(no, line);
    expect(no.nodeId).toBe('bye_no_bike');
  });

  it('Jonas: a name, how long, the next meeting', () => {
    const s = open('berlin_jonas');
    for (const line of ['Ja! Ich bin Leila.', 'Seit drei Monaten.', 'Ja, gerne!']) say(s, line);
    expect(last(s)).toBe('Super! Dann bis nächste Woche, Leila. Tschüss!');
  });

  it('Sie with a friend is a soft note; du is not', () => {
    const s = open('berlin_jonas');
    say(s, 'Hallo! Können Sie langsamer sprechen?');
    const r = evaluateSession(s, { register: 'casual', friend: true });
    expect(r.corrections[0]).toMatchObject({ soft: true, kind: 'register' });
    const d = open('berlin_jonas');
    say(d, 'Kannst du langsamer sprechen?');
    expect(evaluateSession(d, { register: 'casual', friend: true }).corrections).toEqual([]);
  });
});

describe('regulars and small talk', () => {
  const first = (s: ConversationSession) => s.turns[0]!.line.written;
  const plain = (ja: string) => ja;
  for (const [id, shop] of Object.entries(BERLIN_SHOP_TALK)) {
    it(`${id}: a regular is greeted as one`, () => {
      expect(first(open(id, 'en', { flags: { regular: true } }))).toBe(plain(shop.regular.ja));
      // a first visit: the plain opening
      expect(first(open(id))).toBe(berlinScenarioById(id)!.nodes[berlinScenarioById(id)!.start]!.say.at(-1)!.line.ja);
    });
    for (const [topic, tp] of Object.entries(BERLIN_TALK_TOPICS)) {
      it(`${id}, ${topic}: the remark, yes and no in chips or own words, back to the shop`, () => {
        const s = open(id, topic === 'winter' ? 'ar' : 'en', { flags: { regular: true, [`talk_${topic}`]: true } });
        expect(first(s)).toBe(`${shop.hello.ja} ${tp.remark.ja}`);
        expect(s.suggestions().slice(0, 2).map((c) => c.written)).toEqual([tp.yes.ja, tp.no.ja]);
        const yes = s.pickSuggestion(0);
        expect(yes.learner.intentId).toBe(`talk_yes_${topic}`);
        expect(yes.character.line.written).toBe(`${tp.yesReply.ja} ${shop.ask.ja}`);
        expect(s.nodeId).toBe(berlinScenarioById(id)!.start);
        expect(s.suggestions().map((c) => c.written)).not.toContain(tp.yes.ja);
        const own = s.pickSuggestion(0);
        expect(own.learner.matched, `${id}: the shop's own first chip after the small talk`).toBe(true);
        expect(own.character.kind).not.toBe('fallback');

        const no = open(id, 'en', { flags: { [`talk_${topic}`]: true } }).pickSuggestion(1);
        expect(no.learner.intentId).toBe(`talk_no_${topic}`);
        expect(no.character.line.written).toBe(`${tp.noReply.ja} ${shop.ask.ja}`);
      });
    }
  }

  it('answers in your own words, and an order is still an order while the small talk is on', () => {
    const said = (topic: string, text: string) => say(open('berlin_bakery', 'en', { flags: { [`talk_${topic}`]: true } }), text).learner.intentId;
    expect(said('winter', 'Nein, mir ist kalt!')).toBe('talk_no_winter');
    expect(said('winter', 'Ja, ich mag Schnee.')).toBe('talk_yes_winter');
    expect(said('spring', 'Nicht so sehr, ehrlich gesagt.')).toBe('talk_no_spring');
    expect(said('weekend_now', 'Nein, ich muss heute arbeiten.')).toBe('talk_no_weekend_now');
    expect(said('weekend_after', 'Es war super!')).toBe('talk_yes_weekend_after');
    expect(said('summer', 'Zwei Brötchen, bitte.')).toBe('order');
  });
});

