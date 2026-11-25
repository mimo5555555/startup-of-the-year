// Spanish through the real engine (Spanish step 1): the Madrid street. Every conversation (the bar, the panadería, the fruit stall, the
// churrería, the Metro and the three friends) understands every chip at every node, with and without the game's hooks, cash-only or not,
// EN and AR; each shop has a typed route that charges the menu price; the friends take a name, a country and a hobby as they are said;
// Spanish is told from English; tú in a polite setting gets a soft note with usted (never in the bar), usted with a friend a soft one.
import { describe, expect, it } from 'vitest';
import { MADRID_PRICES, MADRID_SCENARIOS, MADRID_SHOP_TALK, MADRID_TALK_TOPICS, MADRID_TALK_TOPICS_TU, madridCharacterById, madridScenarioById, type L1, type Vars } from '@lw/content';
import { euroTextEs } from '@lw/core';
import { ConversationSession, ES, classifyInput, evaluateSession, isSpanish, targetLanguage, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

const QTY: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };
/** the item slots, in the order the first one is counted (by `qty`, or the fruit by `peso`: half kilos) */
const ITEM_SLOTS = ['bar', 'pan', 'fruta', 'churros', 'billete', 'barComida', 'dulce', 'churroBebida', 'aceite'];

function till(cents: number) {
  const log = { charges: [] as Array<{ cents: number; slots: Record<string, string> }> };
  const bill = (slots: Record<string, string>) => {
    let sum = 0;
    let first = true;
    for (const slot of ITEM_SLOTS) {
      const p = slots[slot] ? MADRID_PRICES[slots[slot]!] : undefined;
      if (p === undefined) continue;
      const n = first ? (QTY[slots.peso ?? slots.qty ?? 'one'] ?? 1) : 1;
      sum += p * n;
      first = false;
    }
    return sum;
  };
  const hooks: SessionGameHooks = {
    vars: (slots): Vars => (bill(slots ?? {}) > 0 ? { total: { ja: euroTextEs(bill(slots ?? {})).written, raw: true } } : {}),
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
  const scenario = madridScenarioById(id)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character: madridCharacterById(scenario.characterId)!, l1, profileName: 'Leila', topics: ['food'], now: () => (t += 4000), language: ES, ...extra });
  s.start();
  return s;
}

const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text, ES);
  if (input.kind !== 'ja') throw new Error(`Not Spanish: ${text}`);
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

const SHOPS = ['mad_bar', 'mad_panaderia', 'mad_mercado', 'mad_churreria', 'mad_metro'];
const MEETS = ['mad_lucia', 'mad_javi', 'mad_nadia'];

describe('the Madrid street: every chip is understood', () => {
  it('has the five shops and the three friends (their chats and the gift after, madrid-friends.test.ts), and Japanese stays the default language', () => {
    expect(MADRID_SCENARIOS.map((s) => s.id)).toEqual([...SHOPS, ...MEETS, 'smalltalk_lucia', 'smalltalk_javi', 'smalltalk_nadia', 'give_gift']);
    expect(targetLanguage().id).toBe('ja');
  });
  for (const sc of MADRID_SCENARIOS.filter((x) => SHOPS.includes(x.id) || MEETS.includes(x.id))) {
    const shop = SHOPS.includes(sc.id);
    const modes: Array<[string, () => Partial<SessionOptions>]> = shop
      ? [
          ['without hooks', () => ({})],
          ['with hooks, plenty of money', () => ({ game: till(100_000).hooks, flags: { priced: true } })],
          ['with hooks, cash only, almost no money', () => ({ game: till(100).hooks, flags: { priced: true, cashOnly: true } })],
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
  it('the bar: a café con leche and a tostada con tomate, by card: 4,30 €', () => {
    const c = till(10_000);
    const s = open('mad_bar', 'en', { game: c.hooks, flags: { priced: true } });
    expect(last(s)).toBe('¡Buenos días! ¿Qué te pongo?');
    say(s, 'Un café con leche, por favor.');
    expect(last(s)).toBe('¡Marchando! ¿Y para comer? Tenemos tostadas y tortilla.');
    say(s, 'Una tostada con tomate.');
    expect(last(s)).toBe('Son 4,30 €. ¿Con tarjeta o en efectivo?');
    say(s, 'Con tarjeta.');
    expect(s.ended).toBe(true);
    expect(c.log.charges.map((x) => x.cents)).toEqual([180 + 250]);
  });

  it('the bar: both in one breath, typed without accents; a plain 「café」 is a café con leche, a 「café solo」 is not', () => {
    const c = till(10_000);
    const s = open('mad_bar', 'ar', { game: c.hooks, flags: { priced: true } });
    say(s, 'dos cafes con leche y un pincho de tortilla por favor');
    expect(last(s)).toBe('¡Marchando! ¿Algo más?');
    say(s, 'No, nada mas.');
    say(s, 'Aquí tiene.');
    expect(c.log.charges.map((x) => x.cents)).toEqual([2 * 180 + 300]);
    const bought = (order: string) => {
      const t = till(10_000);
      const b = open('mad_bar', 'en', { game: t.hooks, flags: { priced: true } });
      for (const line of [order, 'No, gracias.', 'Con tarjeta.']) say(b, line);
      return t.log.charges[0]!;
    };
    expect(bought('Un café, por favor.')).toMatchObject({ cents: 180, slots: { bar: 'cafe' } });
    expect(bought('Un café solo, por favor.')).toMatchObject({ cents: 140, slots: { bar: 'solo' } });
  });

  it('the panadería: 「¿Qué es una napolitana?」 explained, two napolitanas and magdalenas, cash', () => {
    const c = till(10_000);
    const s = open('mad_panaderia', 'en', { game: c.hooks, flags: { priced: true } });
    expect(say(s, '¿Qué es una napolitana?').learner.intentId).toBe('ask_napolitana');
    expect(last(s)).toContain('hojaldre');
    say(s, 'Dos napolitanas, por favor.');
    say(s, 'Sí, una bolsa de magdalenas.');
    say(s, 'En efectivo.');
    expect(c.log.charges.map((x) => x.cents)).toEqual([2 * 150 + 250]);
  });

  it('the fruit stall: a kilo of oranges in one breath costs two half kilos; fruit first, then the weight', () => {
    const c = till(10_000);
    const s = open('mad_mercado', 'en', { game: c.hooks, flags: { priced: true } });
    expect(say(s, 'Un kilo de naranjas, por favor.').learner.intentId).toBe('pick_weighed');
    expect(last(s)).toBe('Aquí tiene. ¿Algo más? Tengo un aceite de oliva buenísimo.');
    say(s, 'No, nada más.');
    expect(last(s)).toBe('Son 1,90 €. ¿Con tarjeta o en efectivo?');
    say(s, 'Con tarjeta.');
    const p = till(10_000);
    const t = open('mad_mercado', 'en', { game: p.hooks, flags: { priced: true } });
    expect(say(t, '¿Están buenas las fresas?').learner.intentId).toBe('taste');
    say(t, 'Fresas, por favor.');
    expect(last(t)).toBe('Muy bien. ¿Cuánto le pongo?');
    say(t, 'Dos kilos.');
    say(t, 'Sí, una lata de aceite de oliva.');
    say(t, 'Efectivo.');
    expect(c.log.charges.map((x) => x.cents)).toEqual([190]);
    expect(p.log.charges).toEqual([{ cents: 4 * 175 + 850, slots: expect.objectContaining({ fruta: 'fresas', peso: 'four', aceite: 'aceite' }) }]);
  });

  it('the churrería: 「¿Qué son las porras?」 explained, porras and a chocolate; a cash-only stall refuses the card kindly', () => {
    const c = till(10_000);
    const s = open('mad_churreria', 'en', { game: c.hooks, flags: { priced: true, cashOnly: true } });
    expect(say(s, '¿Qué son las porras?').character.line.written).toContain('más gordos');
    say(s, 'Una ración de porras, por favor.');
    say(s, 'Sí, un chocolate.');
    expect(say(s, 'Con tarjeta, por favor.').character.line.written).toBe('Lo siento, solo aceptamos efectivo.');
    say(s, 'Vale, en efectivo.');
    expect(last(s)).toBe('¡Que aproveche!');
    expect(c.log.charges.map((x) => x.cents)).toEqual([280 + 220]);
  });

  it('the Metro: the prices asked, ten journeys by card, and the reminder to validate at the turnstiles', () => {
    const c = till(10_000);
    const s = open('mad_metro', 'en', { game: c.hooks, flags: { priced: true } });
    expect(say(s, '¿Cuánto cuesta un billete?').learner.intentId).toBe('ask_price');
    say(s, 'Quería un billete de diez viajes.');
    say(s, 'Con tarjeta.');
    expect(last(s)).toContain('validarla en los tornos');
    expect(c.log.charges.map((x) => x.cents)).toEqual([1220]);
  });
});

describe('the friends', () => {
  it('Lucía: a name, a country listed or not, a hobby, said back', () => {
    const s = open('mad_lucia', 'ar');
    say(s, '¡Hola Lucía! Me llamo Samira.');
    expect(last(s)).toBe('¡Mucho gusto, Samira! ¿De dónde eres?');
    say(s, 'Soy de Egipto.');
    expect(last(s)).toContain('Me encantaría conocer Egipto.');
    say(s, 'Me gusta cocinar.');
    expect(last(s)).toBe('¡Genial! Pues un día cocinamos juntos. ¡Estás en tu casa, Samira!');
    const t = open('mad_lucia');
    for (const line of ['Mi nombre es Tom.', 'Soy de Islandia.']) say(t, line);
    expect(last(t)).toContain('Me encantaría conocer Islandia.');
  });

  it('Javi: football or not; Nadia: the next meeting, or Friday', () => {
    const j = open('mad_javi');
    for (const line of ['Sí, acabo de llegar.', 'Soy Leila.', 'No mucho, la verdad.']) say(j, line);
    expect(j.nodeId).toBe('bye_no');
    const k = open('mad_javi');
    for (const line of ['Sí.', 'Me llamo Leila.', '¡Sí, me encanta!', 'Del Atleti, como tú.']) say(k, line);
    expect(last(k)).toBe('¡Vale! Esta noche a las nueve en el Bar El Rincón. ¡Hasta luego, Leila!');
    const n = open('mad_nadia');
    for (const line of ['¡Sí! Me llamo Leila.', 'Tres meses.', '¡Sí, buena idea!']) say(n, line);
    expect(last(n)).toBe('¡Genial! Hasta el jueves, Leila. ¡Chao!');
    const m = open('mad_nadia');
    for (const line of ['Soy Leila.', 'Llevo un año.', 'El jueves no puedo. ¿El viernes?']) say(m, line);
    expect(m.nodeId).toBe('bye_friday');
  });
});

describe('Spanish or not, tú and usted', () => {
  it('tells Spanish from English and Arabic', () => {
    for (const t of ['Un café, por favor', 'dos napolitanas', '¡Muchas gracias!', '2,50 €', 'Hola', 'me llamo sam']) expect(isSpanish(t), t).toBe(true);
    for (const t of ['a coffee please', 'I would like two pastries', 'hello', 'قهوة من فضلك', '']) expect(isSpanish(t), t).toBe(false);
  });

  it('tú in a polite setting gets a soft note with usted; never in the bar; usted with a friend a soft one; the global intents speak Spanish', () => {
    const s = open('mad_panaderia');
    say(s, '¿Tienes pan integral? Una barra, por favor.');
    expect(evaluateSession(s, { register: 'polite' }).corrections[0]).toMatchObject({ kind: 'register', soft: true, better: '¿Tiene pan integral? Una barra, por favor.' });
    const b = open('mad_bar');
    say(b, '¿Me pones un café con leche?');
    expect(evaluateSession(b, { register: 'casual' }).corrections.filter((c) => c.kind === 'register')).toEqual([]);
    const f = open('mad_nadia');
    say(f, '¿Puede usted hablar más despacio?');
    expect(evaluateSession(f, { register: 'casual', friend: true }).corrections[0]).toMatchObject({ soft: true, better: '¿Puedes hablar más despacio?' });
    const h = open('mad_lucia');
    say(h, 'Me llamo Leila. ¿Y usted?');
    expect(evaluateSession(h, { register: 'casual', friend: true }).corrections[0]).toMatchObject({ soft: true, better: 'Me llamo Leila. ¿Y tú?' });
    const g = open('mad_churreria');
    expect(say(g, '¡Muchas gracias!').character.line.written).toBe('De nada.');
    expect(say(g, 'Más despacio, por favor.').character.line.written).toBe('Claro. Hablo más despacio.');
  });
});

describe('regulars and small talk (Spanish step 3)', () => {
  const first = (s: ConversationSession) => s.turns[0]!.line.written;
  const TU = ['mad_bar', 'mad_churreria'];
  it('every shop has a regular’s greeting and small talk; the friends have none', () => {
    expect(Object.keys(MADRID_SHOP_TALK).sort()).toEqual([...SHOPS].sort());
  });
  for (const [id, shop] of Object.entries(MADRID_SHOP_TALK)) {
    const topics = TU.includes(id) ? MADRID_TALK_TOPICS_TU : MADRID_TALK_TOPICS;
    it(`${id}: a regular is greeted as one`, () => {
      expect(first(open(id, 'en', { flags: { regular: true } }))).toBe(shop.regular.ja);
      // a first visit: the plain opening
      const sc = madridScenarioById(id)!;
      expect(first(open(id))).toBe(sc.nodes[sc.start]!.say.at(-1)!.line.ja);
    });
    for (const [topic, tp] of Object.entries(topics)) {
      it(`${id}, ${topic}: the remark, yes and no in chips, back to the shop`, () => {
        const s = open(id, topic === 'winter' ? 'ar' : 'en', { flags: { regular: true, [`talk_${topic}`]: true } });
        expect(first(s)).toBe(`${shop.hello.ja} ${tp.remark.ja}`);
        expect(s.suggestions().slice(0, 2).map((c) => c.written)).toEqual([tp.yes.ja, tp.no.ja]);
        const yes = s.pickSuggestion(0);
        expect(yes.learner.intentId).toBe(`talk_yes_${topic}`);
        expect(yes.character.line.written).toBe(`${tp.yesReply.ja} ${shop.ask.ja}`);
        expect(s.nodeId).toBe(madridScenarioById(id)!.start);
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

  it('the bar and the churrería ask with tú, the others with usted', () => {
    expect(first(open('mad_bar', 'en', { flags: { talk_summer: true } }))).toBe('¡Buenos días! ¡Qué calor hace hoy! ¿Te gusta el verano?');
    expect(first(open('mad_churreria', 'en', { flags: { talk_weekend_before: true } }))).toBe('¡Buenas! ¡Ya casi es fin de semana! ¿Tienes planes?');
    expect(first(open('mad_panaderia', 'en', { flags: { talk_summer: true } }))).toBe('Buenos días. ¡Qué calor hace hoy! ¿Le gusta el verano?');
    expect(first(open('mad_metro', 'en', { flags: { talk_weekend_now: true } }))).toBe('Buenos días. ¡Por fin es fin de semana! ¿Hoy descansa?');
    const s = open('mad_mercado', 'en', { flags: { talk_weekend_before: true } });
    expect(s.pickSuggestion(0).character.line.written).toBe('¡Qué bien! ¡Que lo pase bien! Bueno, ¿qué le pongo?');
  });

  it('answers in your own words, and an order is still an order while the small talk is on', () => {
    const said = (topic: string, text: string, id = 'mad_bar') => say(open(id, 'en', { flags: { [`talk_${topic}`]: true } }), text).learner.intentId;
    expect(said('winter', 'No, tengo mucho frío.')).toBe('talk_no_winter');
    expect(said('winter', 'Sí, me gusta mucho el invierno.')).toBe('talk_yes_winter');
    expect(said('spring', 'No me gusta mucho, la verdad.')).toBe('talk_no_spring');
    expect(said('spring', '¡Sí, claro!')).toBe('talk_yes_spring');
    expect(said('summer', 'No, hace demasiado calor.')).toBe('talk_no_summer');
    expect(said('weekend_before', 'No, no tengo planes.')).toBe('talk_no_weekend_before');
    // 「noche」 and 「nos」 are not 「no」
    expect(said('weekend_before', 'Sí, esta noche salgo con unos amigos.')).toBe('talk_yes_weekend_before');
    expect(said('weekend_now', 'No, hoy tengo que trabajar.')).toBe('talk_no_weekend_now');
    expect(said('weekend_now', 'Sí, hoy descanso.')).toBe('talk_yes_weekend_now');
    expect(said('weekend_after', '¡Genial, muy bien!')).toBe('talk_yes_weekend_after');
    expect(said('weekend_after', 'Regular, la verdad.')).toBe('talk_no_weekend_after');
    expect(said('weekend_after', 'No muy bien.')).toBe('talk_no_weekend_after');
    // an order while the small talk is on: the shop's own intent
    expect(said('summer', 'Un café con leche, por favor.')).toBe('order');
    expect(said('autumn', 'Un kilo de naranjas, por favor.', 'mad_mercado')).toBe('pick_weighed');
  });

  it('the walk of every chip still holds for a regular with small talk on', () => {
    for (const id of SHOPS)
      for (const topic of ['winter', 'weekend_after']) {
        const { problems } = walk(id, 'en', () => ({ flags: { regular: true, [`talk_${topic}`]: true } }));
        expect(problems, `${id} ${topic}`).toEqual([]);
      }
  });
});
