// Amsterdam's friends after the first meeting (Dutch step 4), through the real engine: the chat of the day (`smalltalk_<friend>`) at
// every topic the app can enter, every chip understood to the end; a revealed fact after the reaction; the greeting's callbacks
// answered; the favourite food and the sport remembered from your own words; the hand-over of a present (`give_gift`) naming what it
// is; and the three hang-outs at three hearts (pancakes with Sanne, the Vondelpark with Daan, Noor's family birthday).
import { describe, expect, it } from 'vitest';
import { AMSTERDAM_PACK, NL_GIVE_GIFT, NL_SLOTS, NL_SMALLTALK, NL_SMALLTALK_FRIENDS, amsterdamCharacterById, amsterdamScenarioById, type L1, type Vars } from '@lw/content';
import { ConversationSession, NL, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

function open(id: string, characterId: string, o: { l1?: L1; flags?: Record<string, boolean>; startNode?: string; vars?: Vars } = {}): ConversationSession {
  const scenario = amsterdamScenarioById(id)!;
  let t = 0;
  const game: SessionGameHooks = { vars: () => o.vars ?? {}, charge: () => ({ ok: true }) };
  const opts: SessionOptions = {
    scenario,
    character: amsterdamCharacterById(characterId)!,
    l1: o.l1 ?? 'en',
    profileName: 'Sam',
    topics: ['food'],
    now: () => (t += 4000),
    language: NL,
    game,
    flags: { casual: true, ...(o.flags ?? {}) },
    ...(o.startNode ? { startNode: o.startNode } : {}),
  };
  const s = new ConversationSession(opts);
  s.start();
  return s;
}
const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text, NL);
  if (input.kind !== 'ja') throw new Error(`Not Dutch: ${text}`);
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
    expect(NL_SMALLTALK.map((s) => s.id)).toEqual(NL_SMALLTALK_FRIENDS.map((f) => `smalltalk_${f}`));
    const topics = (f: string) => Object.keys(amsterdamScenarioById(`smalltalk_${f}`)!.nodes).filter((n) => n.startsWith('g_')).map((n) => n.slice(2));
    expect(topics('sanne')).toContain('sanne_drawing');
    expect(topics('daan')).toContain('daan_place');
    expect(topics('noor')).toContain('noor_arabic');
    expect(topics('sanne')).not.toContain('daan_place');
    for (const f of NL_SMALLTALK_FRIENDS) expect(topics(f).length, f).toBe(9);
  });

  for (const f of NL_SMALLTALK_FRIENDS) {
    const topics = Object.keys(amsterdamScenarioById(`smalltalk_${f}`)!.nodes).filter((n) => n.startsWith('g_'));
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
    const s = open('smalltalk_sanne', 'sanne', { startNode: 'g_weekend', flags: { rev_cat_stroop: true } });
    expect(last(s)).toBe('Hé Sam! Hoe gaat het?');
    say(s, 'Hoi! Goed, dank je!');
    expect(last(s)).toBe('Wat ga je dit weekend doen?');
    say(s, 'Ik zie vrienden in het park.');
    expect(last(s)).toBe('Leuk! Ik ga zaterdag naar het museum. Mijn kat heet Stroop.');
    say(s, 'Echt? Leuk!');
    expect(last(s)).toBe('Leuk om even te kletsen! Tot morgen!');
    expect(say(s, 'Doei, tot morgen!').ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['answer', 'greet', 'react']);
  });

  it('quotes a remembered hobby, food or the dream in the greeting, and an answer to it counts', () => {
    const hobby = open('smalltalk_daan', 'daan', { startNode: 'g_music', flags: { cb_hobby: true }, vars: { hobby: { ja: 'koken', gloss: { en: 'cooking', ar: 'الطبخ' } } } });
    expect(last(hobby)).toBe('Hé Sam! Hoe gaat het met je hobby? Nog steeds koken?');
    expect(say(hobby, 'Ja, nog steeds!').learner.intentId).toBe('cb');
    const food = open('smalltalk_noor', 'noor', { startNode: 'g_travel', flags: { cb_food: true }, vars: { food: { ja: 'stamppot', gloss: { en: 'stamppot', ar: 'ستامبوت' } } } });
    expect(last(food)).toBe('Hé Sam! Heb je deze week stamppot gegeten?');
    expect(say(food, 'Ja, gisteren!').learner.intentId).toBe('cb');
    const dream = open('smalltalk_sanne', 'sanne', { startNode: 'g_study', flags: { cb_dream: true } });
    expect(last(dream)).toBe('Hé Sam! En, hoe gaat het met je droom?');
  });

  it('remembers the favourite food and the sport from your own words', () => {
    const s = open('smalltalk_sanne', 'sanne', { startNode: 'g_food' });
    say(s, 'Hoi!');
    expect(say(s, 'Ik eet het liefst haring.').learner.intentId).toBe('food_named');
    expect(s.remembered.favFood).toBe('haring');
    expect(last(s)).toBe('Lekker! Ik hou van appeltaart.');
    const sp = open('smalltalk_daan', 'daan', { startNode: 'g_sports' });
    say(sp, 'Hé!');
    expect(say(sp, 'Ja, ik voetbal graag.').learner.intentId).toBe('hobby_named');
    expect(sp.remembered.hobby).toBe('sports');
  });
});

describe('a present for a friend (give_gift)', () => {
  const wafel = { gift: { ja: 'een stroopwafel', gloss: { en: 'a stroopwafel', ar: 'ستروبفافل' } } };
  it('names the present, gets the reaction by taste, and every chip is understood', () => {
    for (const r of ['loved', 'liked', 'neutral', 'disliked'] as const) expect(walk(() => open('give_gift', 'sanne', { flags: { [`gift_${r}`]: true }, vars: wafel })).problems, r).toEqual([]);
    const s = open('give_gift', 'sanne', { flags: { gift_loved: true }, vars: wafel });
    expect(last(s)).toBe('Hé Sam! Wat is er?');
    expect(say(s, 'Ik heb een stroopwafel voor je!').learner.intentId).toBe('give_food');
    expect(last(s)).toBe('Echt? Wat leuk! Heel erg bedankt!');
    say(s, 'Graag gedaan!');
    expect(last(s)).toBe('Dank je, Sam! Dat is echt lief van je.');
  });

  it('the tin is a giftItem; a hand-over that names nothing still works', () => {
    const s = open('give_gift', 'noor', { flags: { gift_liked: true }, vars: { gift: { ja: 'een blik stroopwafels', gloss: { en: 'a tin of stroopwafels', ar: 'علبة' } } } });
    expect(say(s, 'Hier, een blik stroopwafels voor jou.').learner.intentId).toBe('give_item');
    const b = open('give_gift', 'daan', { flags: { gift_neutral: true }, vars: wafel });
    expect(say(b, 'Hier, een klein cadeautje!').learner.intentId).toBe('give_bare');
  });

  it('can name everything the canal sells that a friend can be given', () => {
    const named = new Set([...NL_SLOTS.giftItem!, ...NL_SLOTS.giftFood!].map((o) => o.id));
    for (const m of AMSTERDAM_PACK.menu) if (m.giftable !== false && m.shop !== 'gvb') expect(named.has(m.option), m.id).toBe(true);
    expect(amsterdamScenarioById('give_gift')).toBe(NL_GIVE_GIFT);
  });
});

describe('hang-outs at three hearts', () => {
  const HANG: Array<[string, string, string[]]> = [
    ['hang_sanne_pannenkoek', 'sanne', ['Ja, graag! Kan ik helpen?', 'Hier zijn de melk en de eieren.', 'Ja, ik draai hem om!', 'Stroop, graag!', 'Mmm, heel lekker!']],
    ['hang_daan_vondelpark', 'daan', ['Ja, leuk!', 'Oké, ik steek mijn hand uit.', 'Ik rem!', 'Goed idee!', 'Het is druk, maar leuk!']],
    ['hang_noor_verjaardag', 'noor', ['Ja, gezellig!', 'Gefeliciteerd met je vrouw!', 'Gefeliciteerd met je zus!', 'Een kopje thee, graag.', 'Dank je! Heel gezellig hier.']],
  ];
  for (const [id, who, typed] of HANG) {
    it(`${id}: every chip is understood to the end, EN and AR`, () => {
      for (const l1 of ['en', 'ar'] as const) expect(walk(() => open(id, who, { l1 })).problems, `${id} ${l1}`).toEqual([]);
    });
    it(`${id}: typed in your own words, it ends with every step done`, () => {
      const s = open(id, who);
      let r: SubmitResult | undefined;
      for (const line of typed) {
        r = say(s, line);
        expect(r.learner.matched, `${id}: "${line}"`).toBe(true);
      }
      expect(r!.ended).toBe(true);
      expect([...s.stepsDone].sort()).toEqual(amsterdamScenarioById(id)!.steps.map((x) => x.id).sort());
    });
  }
  it('is a hang-out of the pack at three hearts, listed from Chapter 4', () => {
    for (const [id, who] of HANG) {
      expect(AMSTERDAM_PACK.scenarioMeta.find((m) => m.id === id)).toMatchObject({ kind: 'hangout', heart: 3, friendId: who, pay: 'none' });
      expect(AMSTERDAM_PACK.interactions[who]!.find((x) => x.scenarioId === id)).toMatchObject({ ch: 4, gate: { k: 'hearts', friend: who, atLeast: 3 } });
    }
  });
});
