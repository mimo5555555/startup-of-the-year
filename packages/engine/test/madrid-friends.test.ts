// Madrid's friends after the first meeting (Spanish step 3), through the real engine: the chat of the day (`smalltalk_<friend>`) at every
// topic the app can enter, every chip understood to the end; a revealed fact after the reaction; the greeting's callbacks answered; the
// favourite food and the sport remembered from your own words; and the hand-over of a present (`give_gift`) naming what it is.
import { describe, expect, it } from 'vitest';
import { ES_GIVE_GIFT, ES_SLOTS, ES_SMALLTALK, ES_SMALLTALK_FRIENDS, MADRID_PACK, madridCharacterById, madridScenarioById, type L1, type Vars } from '@lw/content';
import { ConversationSession, ES, classifyInput, evaluateSession, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

function open(id: string, characterId: string, o: { l1?: L1; flags?: Record<string, boolean>; startNode?: string; vars?: Vars; seen?: Array<Record<string, string>> } = {}): ConversationSession {
  const scenario = madridScenarioById(id)!;
  let t = 0;
  const game: SessionGameHooks = {
    vars: (slots) => {
      o.seen?.push({ ...(slots ?? {}) });
      return o.vars ?? {};
    },
    charge: () => ({ ok: true }),
  };
  const opts: SessionOptions = {
    scenario,
    character: madridCharacterById(characterId)!,
    l1: o.l1 ?? 'en',
    profileName: 'Sam',
    topics: ['food'],
    now: () => (t += 4000),
    language: ES,
    game,
    flags: { casual: true, ...(o.flags ?? {}) },
    ...(o.startNode ? { startNode: o.startNode } : {}),
  };
  const s = new ConversationSession(opts);
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
    if (seen.has(s.nodeId) || s.ended) return;
    seen.add(s.nodeId);
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
  return { problems, nodes: seen };
}

describe('a chat with a friend (smalltalk_<friend>)', () => {
  it('exists for each of the three friends, with their own topics on top of the shared ones', () => {
    expect(ES_SMALLTALK.map((s) => s.id)).toEqual(ES_SMALLTALK_FRIENDS.map((f) => `smalltalk_${f}`));
    const topics = (f: string) => Object.keys(madridScenarioById(`smalltalk_${f}`)!.nodes).filter((n) => n.startsWith('g_')).map((n) => n.slice(2));
    expect(topics('lucia')).toContain('lucia_sevilla');
    expect(topics('javi')).toContain('javi_guitar');
    expect(topics('nadia')).toContain('nadia_arabic');
    expect(topics('lucia')).not.toContain('javi_guitar');
    for (const f of ES_SMALLTALK_FRIENDS) expect(topics(f).length, f).toBe(9);
  });

  for (const f of ES_SMALLTALK_FRIENDS) {
    const topics = Object.keys(madridScenarioById(`smalltalk_${f}`)!.nodes).filter((n) => n.startsWith('g_'));
    for (const start of topics) {
      it(`${f}, ${start}: every chip is understood to the end, EN and AR`, () => {
        for (const l1 of ['en', 'ar'] as const) {
          const { problems, nodes } = walk(() => open(`smalltalk_${f}`, f, { l1, startNode: start }));
          expect(problems, `${f} ${start} ${l1}`).toEqual([]);
          expect([...nodes].sort()).toEqual([start, `t_${start.slice(2)}`, `f_${start.slice(2)}`, 'close'].sort());
        }
      });
    }
  }

  it('greets, asks, reacts with a revealed fact, says goodbye; every step is done', () => {
    const s = open('smalltalk_lucia', 'lucia', { startNode: 'g_weekend', flags: { rev_sunday_cook: true } });
    expect(last(s)).toBe('¡Hola, Sam! ¿Qué tal?');
    say(s, '¡Hola! Muy bien, gracias.');
    expect(last(s)).toBe('¿Qué vas a hacer este fin de semana?');
    say(s, 'Voy a ver a unos amigos en el parque.');
    expect(last(s)).toBe('¡Qué bien! Yo el sábado voy al Retiro. Los domingos cocino para todo el piso.');
    say(s, '¿En serio? ¡Qué guay!');
    expect(last(s)).toBe('¡Me ha encantado charlar contigo! ¡Hasta mañana!');
    expect(say(s, '¡Hasta mañana!').ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['answer', 'greet', 'react']);
  });

  it('quotes a remembered hobby, food or the dream in the greeting, and an answer to it counts', () => {
    const cocinar = ES_SLOTS.hobby!.find((o) => o.id === 'cooking')!;
    const hobby = open('smalltalk_javi', 'javi', { startNode: 'g_music', flags: { cb_hobby: true }, vars: { hobby: { ja: cocinar.ja, gloss: cocinar.gloss } } });
    expect(last(hobby)).toBe('¡Hola, Sam! ¿Todavía te gusta cocinar?');
    expect(say(hobby, '¡Sí, claro!').learner.intentId).toBe('cb');
    // a hobby that is a noun reads with its article
    const cine = ES_SLOTS.hobby!.find((o) => o.id === 'movies')!;
    expect(last(open('smalltalk_javi', 'javi', { startNode: 'g_music', flags: { cb_hobby: true }, vars: { hobby: { ja: cine.ja, gloss: cine.gloss } } }))).toBe('¡Hola, Sam! ¿Todavía te gusta el cine?');
    const food = open('smalltalk_nadia', 'nadia', { startNode: 'g_travel', flags: { cb_food: true }, vars: { food: { ja: 'paella', gloss: { en: 'paella', ar: 'باييا' } } } });
    expect(last(food)).toBe('¡Hola, Sam! ¿Has comido paella esta semana?');
    expect(say(food, 'Sí, ayer.').learner.intentId).toBe('cb');
    const dream = open('smalltalk_lucia', 'lucia', { startNode: 'g_study', flags: { cb_dream: true } });
    expect(last(dream)).toBe('¡Hola, Sam! ¿Qué tal va tu sueño?');
  });

  it('remembers the favourite food and the sport from your own words', () => {
    const s = open('smalltalk_lucia', 'lucia', { startNode: 'g_food' });
    say(s, '¡Hola!');
    expect(say(s, 'Me encantan las croquetas.').learner.intentId).toBe('food_named');
    expect(s.remembered.favFood).toBe('croquetas');
    expect(last(s)).toBe('¡Qué rico! A mí me encanta el gazpacho.');
    const sp = open('smalltalk_javi', 'javi', { startNode: 'g_sports' });
    say(sp, '¡Hola!');
    expect(say(sp, 'Sí, juego al fútbol los sábados.').learner.intentId).toBe('hobby_named');
    expect(sp.remembered.hobby).toBe('sports');
  });

  it('a friend says tú, and the learner’s tú with a friend gets no note', () => {
    const s = open('smalltalk_nadia', 'nadia', { startNode: 'g_nadia_arabic' });
    say(s, '¡Hola! Bien, ¿y tú?');
    expect(last(s)).toBe('¿Me enseñas una palabra en árabe?');
    say(s, 'Shukran significa gracias.');
    expect(last(s)).toBe('¡Genial! Lo apunto ahora mismo.');
    expect(evaluateSession(s, { register: 'casual', friend: true }).corrections).toEqual([]);
  });
});

describe('a present for a friend (give_gift)', () => {
  const napolitana = { gift: { ja: 'una napolitana', gloss: { en: 'a napolitana', ar: '«نابوليتانا»' } } };
  it('names the present, gets the reaction by taste, and every chip is understood', () => {
    for (const r of ['loved', 'liked', 'neutral', 'disliked'] as const)
      for (const l1 of ['en', 'ar'] as const) expect(walk(() => open('give_gift', 'lucia', { l1, flags: { [`gift_${r}`]: true }, vars: napolitana })).problems, `${r} ${l1}`).toEqual([]);
    const s = open('give_gift', 'lucia', { flags: { gift_loved: true }, vars: napolitana });
    expect(last(s)).toBe('¡Hola, Sam! ¿Qué pasa?');
    expect(say(s, '¡Tengo una napolitana para ti!').learner.intentId).toBe('give_food');
    expect(last(s)).toBe('¿En serio? ¡Qué ilusión! ¡Muchísimas gracias!');
    say(s, '¡De nada!');
    expect(last(s)).toBe('¡Gracias, Sam! Eres un sol.');
    expect(say(s, '¡Chao!').ended).toBe(true);
  });

  it('the olive oil is a giftItem; a hand-over that names nothing still works; a juice is not oranges', () => {
    const oil = { gift: { ja: 'una lata de aceite', gloss: { en: 'a tin of olive oil', ar: 'علبة زيت زيتون' } } };
    const s = open('give_gift', 'nadia', { flags: { gift_liked: true }, vars: oil });
    expect(say(s, 'Toma, una lata de aceite de oliva para ti.').learner.intentId).toBe('give_item');
    expect(last(s)).toBe('¡Ay, gracias! ¡Qué detalle!');
    const b = open('give_gift', 'javi', { flags: { gift_neutral: true }, vars: napolitana });
    expect(say(b, '¡Toma, un regalito!').learner.intentId).toBe('give_bare');
    const seen: Array<Record<string, string>> = [];
    const z = open('give_gift', 'javi', { flags: { gift_disliked: true }, vars: napolitana, seen });
    expect(say(z, 'Tengo un zumo de naranja para ti.').learner.intentId).toBe('give_food');
    expect(seen.at(-1)!.giftFood).toBe('zumo');
  });

  it('can name everything the street sells that a friend can be given', () => {
    const named = new Set([...ES_SLOTS.giftItem!, ...ES_SLOTS.giftFood!].map((o) => o.id));
    for (const m of MADRID_PACK.menu) if (m.giftable !== false && m.shop !== 'metro') expect(named.has(m.option), m.id).toBe(true);
    // a catalog present (the olive oil) is named by the option its shop sells it as
    for (const it of MADRID_PACK.items.filter((x) => x.cat === 'gift')) {
      const options = MADRID_PACK.scenarioMeta.flatMap((m) => Object.entries(m.shop?.itemMap ?? {}).filter(([, id]) => id === it.id).map(([o]) => o));
      expect(options.some((o) => named.has(o)), it.id).toBe(true);
    }
    expect(madridScenarioById('give_gift')).toBe(ES_GIVE_GIFT);
  });

  it('is offered from Chapter 3 to every friend, after the chat of the day and the first meeting', () => {
    for (const f of ES_SMALLTALK_FRIENDS) {
      const its = MADRID_PACK.interactions[f]!;
      expect(its.map((x) => x.id)).toEqual([`${f}_talk`, `${f}_meet`, `${f}_gift`]);
      expect(its[0]).toMatchObject({ scenarioId: `smalltalk_${f}`, gate: { k: 'scenario', complete: true } });
      expect(its[2]).toMatchObject({ kind: 'gift', ch: 3 });
    }
  });
});
