// Madrid's places of Chapters 4-6 (Spanish step 4) through the real engine: the farmacia (say what hurts, the remedy, its price, usted),
// Taberna El Farolillo (a drink, a caña only for an adult, the free tapa, a ración, ¡Salud!, ¿Me cobras?, tú) and the citizens' office
// (the padrón: cita previa, papers, address with floor and door). Every chip at every node, EN and AR, with and without the game's hooks;
// typed routes with their exact charges.
import { describe, expect, it } from 'vitest';
import { PLACES_PRICES, madridCharacterById, madridScenarioById, type L1, type Vars } from '@lw/content';
import { euroTextEs } from '@lw/core';
import { ConversationSession, ES, classifyInput, evaluateSession, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

const SLOTS = ['sintoma', 'taberna', 'racion'];
const QTY: Record<string, number> = { one: 1, two: 2, three: 3, four: 4 };

function till(cents: number) {
  const log = { charges: [] as number[] };
  const bill = (slots: Record<string, string>) => {
    let sum = 0;
    let first = true;
    for (const slot of SLOTS) {
      const p = slots[slot] ? PLACES_PRICES[slots[slot]!] : undefined;
      if (p === undefined) continue;
      sum += p * (first ? (QTY[slots.qty ?? 'one'] ?? 1) : 1);
      first = false;
    }
    return sum;
  };
  const hooks: SessionGameHooks = {
    vars: (slots): Vars => (bill(slots ?? {}) > 0 ? { total: { ja: euroTextEs(bill(slots ?? {})).written, raw: true } } : {}),
    charge(slots) {
      const c = bill(slots);
      if (!c || cents < c) return { ok: false };
      log.charges.push(c);
      cents -= c;
      return { ok: true };
    },
  };
  return { hooks, log };
}

function open(id: string, l1: L1 = 'en', extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = madridScenarioById(id)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character: madridCharacterById(scenario.characterId)!, l1, profileName: 'Sam', topics: ['food'], now: () => (t += 4000), language: ES, ...extra });
  s.start();
  return s;
}
const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text, ES);
  if (input.kind !== 'ja') throw new Error(`Not Spanish: ${text}`);
  return s.submit({ text: input.text, mode: 'typed_ja' });
};
const last = (s: ConversationSession) => s.turns.at(-1)!.line.written;

function walk(mk: () => ConversationSession) {
  const problems: string[] = [];
  const seen = new Set<string>();
  const replay = (path: number[]) => {
    const s = mk();
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const visit = (path: number[]) => {
    const s = replay(path);
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
    if (seen.has(key) || s.ended) return;
    seen.add(key);
    s.suggestions().forEach((sg, i) => {
      if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: a chip word without gloss in "${sg.written}"`);
      const r = replay(path).pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…')) problems.push(`${s.nodeId}/#${i}: unresolved variable in "${r.character.line.written}"`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: a word without gloss in "${r.character.line.written}"`);
      if (r.learner.matched && !r.ended) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, nodes: new Set([...seen].map((k) => k.split('|')[0])) };
}

describe('every chip at every node', () => {
  const cases: Array<[string, () => Partial<SessionOptions>]> = [
    ['no hooks, an adult', () => ({ flags: { adult: true } })],
    ['no hooks, a younger player', () => ({ flags: { minor: true } })],
    ['hooks, plenty of money, an adult', () => ({ game: till(5000).hooks, flags: { priced: true, adult: true } })],
    ['hooks, almost no money', () => ({ game: till(100).hooks, flags: { priced: true, minor: true } })],
    ['a regular, small talk on', () => ({ flags: { regular: true, talk_winter: true, adult: true } })],
  ];
  for (const id of ['mad_farmacia', 'mad_taberna', 'mad_padron']) {
    for (const [name, mk] of cases) {
      it(`${id}, ${name}: understood, EN and AR`, () => {
        for (const l1 of ['en', 'ar'] as const) expect(walk(() => open(id, l1, mk())).problems, `${id} ${name} ${l1}`).toEqual([]);
      });
    }
    it(`${id}: every node is reached by its chips`, () => {
      const { nodes } = walk(() => open(id, 'en', { game: till(5000).hooks, flags: { priced: true, adult: true } }));
      const short = walk(() => open(id, 'en', { game: till(10).hooks, flags: { priced: true, adult: true } })).nodes;
      const sc = madridScenarioById(id)!;
      for (const n of Object.values(sc.nodes)) if (!n.end) expect(nodes.has(n.id) || short.has(n.id), `${id}: ${n.id}`).toBe(true);
    });
  }
});

describe('the farmacia (usted)', () => {
  it('a sore throat: the lozenges, how often, by card, 6,50 €; 「¡Que se mejore!」', () => {
    const c = till(5000);
    const s = open('mad_farmacia', 'en', { game: c.hooks, flags: { priced: true } });
    expect(last(s)).toBe('Buenos días. ¿Qué le pasa?');
    expect(say(s, 'Me duele mucho la garganta.').learner.intentId).toBe('symptom');
    expect(last(s)).toBe('Vaya. Le recomiendo estas pastillas para la garganta. ¿Se las lleva?');
    say(s, '¿Cada cuánto las tomo?');
    expect(last(s)).toBe('Cada ocho horas, con un poco de agua. También lo pone en la caja.');
    say(s, 'Sí, por favor.');
    expect(last(s)).toBe('Son 6,50 €. ¿Con tarjeta o en efectivo?');
    say(s, 'Con tarjeta.');
    expect(last(s)).toBe('Aquí tiene. ¡Que se mejore!');
    expect(c.log.charges).toEqual([650]);
    expect([...s.stepsDone].sort()).toEqual(['pay', 'remedy', 'symptom']);
  });

  it('a headache is paracetamol, a cold the nasal spray, a cough the syrup; 「No, gracias」 leaves without buying', () => {
    const h = open('mad_farmacia');
    say(h, 'Me duele la cabeza.');
    expect(last(h)).toContain('paracetamol');
    const r = open('mad_farmacia');
    say(r, 'Estoy resfriada.');
    expect(last(r)).toContain('espray nasal');
    const t = open('mad_farmacia', 'ar');
    say(t, 'Tengo mucha tos.');
    expect(last(t)).toContain('jarabe para la tos');
    expect(say(t, 'No, gracias.').ended).toBe(true);
    expect(last(t)).toBe('Muy bien. Beba mucha agua y descanse. ¡Que se mejore!');
  });

  it('tú to the pharmacist gets a soft note with the usted form', () => {
    const s = open('mad_farmacia');
    say(s, '¿Tienes algo para la garganta?');
    const notes = evaluateSession(s, { register: 'polite' }).corrections;
    expect(notes.some((n) => n.soft && /¿Tiene algo/.test(n.better ?? '')), JSON.stringify(notes)).toBe(true);
  });
});

describe('the taberna (tú)', () => {
  it('an adult: a caña with its free tapa, patatas bravas, ¡Salud!, ¿Me cobras?, cash: 7,70 €', () => {
    const c = till(5000);
    const s = open('mad_taberna', 'en', { game: c.hooks, flags: { priced: true, adult: true } });
    expect(last(s)).toBe('¡Buenas! ¿Qué va a ser?');
    expect(s.suggestions()[0]!.written).toBe('Una caña, por favor.');
    expect(say(s, 'Una caña, por favor.').learner.intentId).toBe('order_beer');
    expect(last(s)).toBe('Aquí tienes, con su tapa: unas aceitunas. ¿Quieres una ración?');
    say(s, '¿Qué son las bravas?');
    expect(last(s)).toBe('Patatas fritas con salsa brava, un poco picante. ¡Las mejores de Lavapiés!');
    say(s, 'Sí, unas patatas bravas, por favor.');
    expect(last(s)).toBe('¡Que aproveche! ¡Salud!');
    say(s, '¡Salud!');
    expect(last(s)).toBe('¿Algo más?');
    say(s, 'No, gracias. ¿Me cobras?');
    expect(last(s)).toBe('Son 7,70 €. ¿Con tarjeta o en efectivo?');
    say(s, 'En efectivo.');
    expect(last(s)).toBe('¡Gracias! ¡Buenas noches!');
    expect(c.log.charges).toEqual([770]);
    expect([...s.stepsDone].sort()).toEqual(['bill', 'order', 'pay', 'salud']);
  });

  it('a younger player: no caña chip, a typed caña gets a kind no; a mosto it is', () => {
    const s = open('mad_taberna', 'en', { flags: { minor: true } });
    expect(s.suggestions().map((x) => x.written)).not.toContain('Una caña, por favor.');
    expect(say(s, 'Una cerveza, por favor.').learner.intentId).toBe('beer_minor');
    expect(last(s)).toBe('Lo siento, la cerveza es solo para mayores de edad. ¿Te pongo un mosto?');
    expect(say(s, 'Vale, un mosto, por favor.').learner.intentId).toBe('order');
  });

  it('asking what a mosto is does not order it; two mostos and nothing else are 4,00 €', () => {
    const q = open('mad_taberna', 'en', { flags: { adult: true } });
    expect(say(q, '¿Qué es un mosto?').learner.intentId).toBe('what_mosto');
    expect(q.nodeId).toBe('start');
    const c = till(5000);
    const s = open('mad_taberna', 'en', { game: c.hooks, flags: { priced: true, adult: true } });
    say(s, 'Dos mostos, por favor.');
    say(s, 'No, gracias.');
    say(s, '¡Salud!');
    say(s, 'La cuenta, por favor.');
    expect(last(s)).toBe('Son 4,00 €. ¿Con tarjeta o en efectivo?');
    say(s, 'Con tarjeta.');
    expect(c.log.charges).toEqual([400]);
  });
});

describe('the padrón (usted)', () => {
  it('cita previa, the purpose, the papers (why the contract?), the address, floor and door, the certificate', () => {
    const s = open('mad_padron');
    expect(last(s)).toBe('Buenos días. ¿Tiene cita previa?');
    say(s, 'Sí, tengo cita a las diez.');
    say(s, 'Vengo a empadronarme.');
    expect(last(s)).toBe('¿Me da su pasaporte y su contrato de alquiler?');
    say(s, '¿Para qué es el contrato?');
    expect(last(s)).toBe('Para comprobar que usted vive en esa casa.');
    say(s, 'Aquí tiene.');
    say(s, 'Vivo en la Calle del Ave María, número doce.');
    expect(last(s)).toBe('¿Y qué piso y qué puerta?');
    say(s, 'Segundo B.');
    expect(last(s)).toBe('Perfecto. Ya está todo. Aquí tiene su certificado de empadronamiento. ¡Le damos la bienvenida a Madrid, Sam!');
    expect(say(s, '¡Muchas gracias!').ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['cita', 'direccion', 'motivo', 'papeles']);
  });

  it('without an appointment: lucky, there is a slot', () => {
    const s = open('mad_padron', 'ar');
    say(s, 'No, no tengo cita.');
    expect(last(s)).toContain('hoy tiene suerte');
    expect(say(s, 'Acabo de mudarme y quiero empadronarme.').learner.intentId).toBe('padron');
  });
});
