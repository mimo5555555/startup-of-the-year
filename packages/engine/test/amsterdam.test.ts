// Dutch through the real engine (Dutch step 1): the Amsterdam street. Every conversation (the café, the cheese shop, the stroopwafel
// stall, the snack bar, the GVB desk and the three friends) understands every chip at every node, with and without the game's hooks,
// card-only or not, EN and AR; each shop has a typed route that charges the menu price; the friends take a name, a country and a hobby
// as they are said; Dutch is told from English; je with staff gets a note with u, u with a friend a soft one. Dutch step 3: every shop
// greets a regular and makes small talk about the season or the weekend, answered with a chip or in your own words.
import { describe, expect, it } from 'vitest';
import { AMSTERDAM_PRICES, AMSTERDAM_SCENARIOS, AMSTERDAM_SHOP_TALK, AMSTERDAM_TALK_TOPICS, amsterdamCharacterById, amsterdamScenarioById, type L1, type Vars } from '@lw/content';
import { euroTextNl } from '@lw/core';
import { ConversationSession, NL, classifyInput, evaluateSession, isDutch, targetLanguage, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

const QTY: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
/** the item slots and the slot whose option counts the first item (the cheese: half ponds) */
const ITEM_SLOTS = ['cafe', 'kaas', 'wafel', 'snack', 'kaartje', 'taart'];

function till(cents: number) {
  const log = { charges: [] as Array<{ cents: number; slots: Record<string, string> }> };
  const bill = (slots: Record<string, string>) => {
    let sum = 0;
    let first = true;
    for (const slot of ITEM_SLOTS) {
      const p = slots[slot] ? AMSTERDAM_PRICES[slots[slot]!] : undefined;
      if (p === undefined) continue;
      const n = first ? (QTY[slots.gewicht ?? slots.qty ?? 'one'] ?? 1) : 1;
      sum += p * n;
      first = false;
    }
    return sum;
  };
  const hooks: SessionGameHooks = {
    vars: (slots): Vars => (bill(slots ?? {}) > 0 ? { total: { ja: euroTextNl(bill(slots ?? {})).written, raw: true } } : {}),
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

function open(id: string, l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = amsterdamScenarioById(id)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character: amsterdamCharacterById(scenario.characterId)!, l1, profileName: 'Leila', topics: ['food'], now: () => (t += 4000), language: NL, ...extra });
  s.start();
  return s;
}

const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text, NL);
  if (input.kind !== 'ja') throw new Error(`Not Dutch: ${text}`);
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

const SHOPS = ['ams_cafe', 'ams_kaas', 'ams_markt', 'ams_snackbar', 'ams_gvb'];

describe('the Amsterdam street: every chip is understood', () => {
  it('has the five shops and the three friends, and Japanese stays the default language', () => {
    expect(AMSTERDAM_SCENARIOS.map((s) => s.id)).toEqual([...SHOPS, 'ams_sanne', 'ams_daan', 'ams_noor']);
    expect(targetLanguage().id).toBe('ja');
  });
  for (const sc of AMSTERDAM_SCENARIOS) {
    const shop = SHOPS.includes(sc.id);
    const modes: Array<[string, () => Partial<SessionOptions>]> = shop
      ? [
          ['without hooks', () => ({})],
          ['with hooks, plenty of money', () => ({ game: till(100_000).hooks, flags: { priced: true } })],
          ['with hooks, card only, almost no money', () => ({ game: till(100).hooks, flags: { priced: true, pinOnly: true } })],
        ]
      : [['a friend', () => ({})]];
    for (const [label, mk] of modes) {
      for (const l1 of ['en', 'ar'] as const) {
        it(`${sc.id}: ${label}, ${l1}`, () => {
          const { problems, nodes } = walk(sc.id, l1, mk);
          expect(problems).toEqual([]);
          for (const n of Object.values(sc.nodes)) if (!n.end) expect(nodes.has(n.id), `${sc.id}: ${n.id}`).toBe(true);
        });
      }
    }
  }
});

describe('the shops, typed', () => {
  it('the café: a koffie verkeerd, apple pie with cream, by card: € 8,30', () => {
    const c = till(10_000);
    const s = open('ams_cafe', 'en', { game: c.hooks, flags: { priced: true } });
    expect(last(s)).toBe('Goedemorgen! Wat mag het zijn?');
    say(s, 'Een koffie verkeerd, graag.');
    say(s, 'Ja, een stuk appeltaart graag.');
    expect(last(s)).toBe('Met slagroom?');
    say(s, 'Ja, graag!');
    expect(last(s)).toBe('Dat is dan € 8,30. Pinnen of contant?');
    say(s, 'Pinnen, graag.');
    expect(s.ended).toBe(true);
    expect(c.log.charges.map((x) => x.cents)).toEqual([380 + 450]);
  });

  it('the café with pinOnly: cash is refused kindly, the card pays', () => {
    const c = till(10_000);
    const s = open('ams_cafe', 'ar', { game: c.hooks, flags: { priced: true, pinOnly: true } });
    for (const line of ['Een thee, graag.', 'Nee, dank u.']) say(s, line);
    expect(say(s, 'Contant, graag.').character.line.written).toBe('Sorry, we accepteren alleen pin.');
    say(s, 'Dan pinnen.');
    expect(c.log.charges.map((x) => x.cents)).toEqual([280]);
  });

  it('the cheese shop: a taste, old cheese, a half pond, then a pound costs two', () => {
    const c = till(10_000);
    const s = open('ams_kaas', 'en', { game: c.hooks, flags: { priced: true } });
    say(s, 'Mag ik even proeven?');
    expect(last(s)).toContain('Proef maar.');
    say(s, 'Lekker! De oude kaas, graag.');
    expect(say(s, 'Een half pond, graag.').learner.intentId).toBe('weigh');
    say(s, 'Contant.');
    expect(c.log.charges).toEqual([{ cents: 650, slots: expect.objectContaining({ kaas: 'oud', gewicht: 'one' }) }]);
    const p = till(10_000);
    const t = open('ams_kaas', 'en', { game: p.hooks, flags: { priced: true } });
    for (const line of ['Een stuk jonge kaas, graag.', 'Een pond, graag.', 'Pinnen.']) say(t, line);
    expect(p.log.charges.map((x) => x.cents)).toEqual([900]);
  });

  it('the market: two stroopwafels, no bag, € 5,00; with chocolate is the chocolate one', () => {
    const c = till(10_000);
    const s = open('ams_markt', 'en', { game: c.hooks, flags: { priced: true } });
    say(s, 'Twee stroopwafels, graag.');
    say(s, 'Nee, dank u, ik eet hem meteen op.');
    expect(last(s)).toBe('Dat is dan € 5,00. Pinnen of contant?');
    say(s, 'Contant.');
    expect(c.log.charges.map((x) => x.cents)).toEqual([500]);
    expect(say(open('ams_markt'), 'Een stroopwafel met chocolade, graag.').learner.intentId).toBe('buy');
  });

  it('the snack bar: 「Wat is een frikandel?」 explained, then a patatje met', () => {
    const c = till(10_000);
    const s = open('ams_snackbar', 'en', { game: c.hooks, flags: { priced: true } });
    expect(last(s)).toBe('Zeg het maar!');
    expect(say(s, 'Wat is een frikandel?').character.line.written).toContain('gefrituurd');
    say(s, 'Een patatje met, graag.');
    say(s, 'Nee, dat was het.');
    say(s, 'Pinnen.');
    expect(c.log.charges.map((x) => x.cents)).toEqual([350]);
  });

  it('the GVB: cash is never taken, a day ticket by card, and the reminder to check in and out', () => {
    const c = till(10_000);
    const s = open('ams_gvb', 'en', { game: c.hooks, flags: { priced: true } });
    expect(say(s, 'Kan ik contant betalen?').learner.intentId).toBe('ask_cash');
    say(s, 'Een dagkaart, graag.');
    expect(say(s, 'Contant, graag.').learner.intentId).toBe('cash_refused');
    say(s, 'Prima, ik pin.');
    expect(last(s)).toContain('in en uit te checken');
    expect(c.log.charges.map((x) => x.cents)).toEqual([950]);
  });
});

describe('the friends', () => {
  it('Sanne: a name, a country listed or not, a hobby, said back', () => {
    const s = open('ams_sanne', 'ar');
    say(s, 'Hoi Sanne! Ik heet Samira.');
    expect(last(s)).toBe('Leuk je te ontmoeten, Samira! Waar kom je vandaan?');
    say(s, 'Ik kom uit Egypte.');
    expect(last(s)).toContain('Egypte wil ik ook eens zien.');
    say(s, 'Ik kook graag.');
    expect(last(s)).toBe('Leuk! Dan koken we een keer samen. Welkom in de buurt, Samira!');
    const t = open('ams_sanne');
    for (const line of ['Mijn naam is Tom.', 'Ik kom uit IJsland.']) say(t, line);
    expect(last(t)).toContain('IJsland wil ik ook eens zien.');
  });

  it('Daan: a bike or not; Noor: the next meeting', () => {
    const d = open('ams_daan');
    for (const line of ['Ja, ik woon hier net.', 'Ik ben Leila.', 'Nee, ik heb geen fiets.']) say(d, line);
    expect(d.nodeId).toBe('bye_no_bike');
    const n = open('ams_noor');
    for (const line of ['Ja! Ik ben Leila.', 'Sinds drie maanden.', 'Ja, goed idee!']) say(n, line);
    expect(last(n)).toBe('Top! Tot volgende week, Leila. Doei!');
  });
});

describe('Dutch or not, u and je', () => {
  it('tells Dutch from English and Arabic', () => {
    for (const t of ['Een koffie, graag', 'twee stroopwafels', 'Dank u wel!', '€ 2,50', 'Hoi']) expect(isDutch(t), t).toBe(true);
    for (const t of ['a coffee please', 'I would like two waffles', 'hello', 'قهوة من فضلك', '']) expect(isDutch(t), t).toBe(false);
  });

  it('je with the staff gets a note with u; u with a friend a soft one; the global intents speak Dutch', () => {
    const s = open('ams_cafe');
    say(s, 'Kun je mij helpen? Een koffie, graag.');
    const r = evaluateSession(s);
    expect(r.corrections[0]).toMatchObject({ kind: 'register', better: 'Kunt u mij helpen? Een koffie, graag.' });
    const f = open('ams_noor');
    say(f, 'Kunt u langzamer praten?');
    expect(evaluateSession(f, { register: 'casual', friend: true }).corrections[0]).toMatchObject({ soft: true, better: 'Kun je langzamer praten?' });
    const g = open('ams_snackbar');
    expect(say(g, 'Dank u wel!').character.line.written).toBe('Graag gedaan.');
    expect(say(g, 'Wat zegt u?').character.line.written).toBe('Zeg het maar!');
  });
});

describe('regulars and small talk (Dutch step 3)', () => {
  const first = (s: ConversationSession) => s.turns[0]!.line.written;
  it('every shop has a regular’s greeting and small talk; the friends have none', () => {
    expect(Object.keys(AMSTERDAM_SHOP_TALK).sort()).toEqual([...SHOPS].sort());
  });
  for (const [id, shop] of Object.entries(AMSTERDAM_SHOP_TALK)) {
    it(`${id}: a regular is greeted as one`, () => {
      expect(first(open(id, 'en', { flags: { regular: true } }))).toBe(shop.regular.ja);
      // a first visit: the plain opening
      const sc = amsterdamScenarioById(id)!;
      expect(first(open(id))).toBe(sc.nodes[sc.start]!.say.at(-1)!.line.ja);
    });
    for (const [topic, tp] of Object.entries(AMSTERDAM_TALK_TOPICS)) {
      it(`${id}, ${topic}: the remark, yes and no in chips, back to the shop`, () => {
        const s = open(id, topic === 'winter' ? 'ar' : 'en', { flags: { regular: true, [`talk_${topic}`]: true } });
        expect(first(s)).toBe(`${shop.hello.ja} ${tp.remark.ja}`);
        expect(s.suggestions().slice(0, 2).map((c) => c.written)).toEqual([tp.yes.ja, tp.no.ja]);
        const yes = s.pickSuggestion(0);
        expect(yes.learner.intentId).toBe(`talk_yes_${topic}`);
        expect(yes.character.line.written).toBe(`${tp.yesReply.ja} ${shop.ask.ja}`);
        expect(s.nodeId).toBe(amsterdamScenarioById(id)!.start);
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
    const said = (topic: string, text: string, id = 'ams_cafe') => say(open(id, 'en', { flags: { [`talk_${topic}`]: true } }), text).learner.intentId;
    expect(said('winter', 'Nee, ik heb het echt koud!')).toBe('talk_no_winter');
    expect(said('winter', 'Ja, ik hou van de winter.')).toBe('talk_yes_winter');
    expect(said('spring', 'Niet zo erg, eerlijk gezegd.')).toBe('talk_no_spring');
    expect(said('spring', 'Ja, natuurlijk!')).toBe('talk_yes_spring');
    expect(said('summer', 'Nee, het is te warm.')).toBe('talk_no_summer');
    expect(said('weekend_before', 'Nee, ik heb geen plannen.')).toBe('talk_no_weekend_before');
    expect(said('weekend_now', 'Nee, ik moet vandaag werken.')).toBe('talk_no_weekend_now');
    expect(said('weekend_now', 'Ja, ik ben vrij!')).toBe('talk_yes_weekend_now');
    expect(said('weekend_after', 'Het was super!')).toBe('talk_yes_weekend_after');
    expect(said('weekend_after', 'Gaat wel.')).toBe('talk_no_weekend_after');
    // an order while the small talk is on: the shop's own intent
    expect(said('summer', 'Een koffie verkeerd, graag.')).toBe('order');
    expect(said('autumn', 'Een stuk oude kaas, graag.', 'ams_kaas')).toBe('pick');
  });

  it('the walk of every chip still holds for a regular with small talk on', () => {
    for (const id of SHOPS)
      for (const topic of ['winter', 'weekend_after']) {
        const { problems } = walk(id, 'en', () => ({ flags: { regular: true, [`talk_${topic}`]: true } }));
        expect(problems, `${id} ${topic}`).toEqual([]);
      }
  });
});
