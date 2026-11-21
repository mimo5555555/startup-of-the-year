// Berlin's friends after the first meeting (German step 5), through the real engine: the chat of the day (`smalltalk_<friend>`) at every
// topic the app can enter, every chip understood to the end; a revealed fact after the reaction; the greeting's callbacks (a hobby, a
// favourite food, the dream) answered; the favourite food and the sport remembered from your own words; and the hand-over of a present
// (`give_gift`) naming what it is, with the friend's reaction by taste.
import { describe, expect, it } from 'vitest';
import { BERLIN_PACK, DE_GIVE_GIFT, DE_SMALLTALK, DE_SMALLTALK_FRIENDS, DE_SLOTS, berlinCharacterById, berlinScenarioById, type L1, type Vars } from '@lw/content';
import { ConversationSession, DE, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../src';

function open(id: string, characterId: string, o: { l1?: L1; flags?: Record<string, boolean>; startNode?: string; vars?: Vars } = {}): ConversationSession {
  const scenario = berlinScenarioById(id)!;
  let t = 0;
  const game: SessionGameHooks = { vars: () => o.vars ?? {}, charge: () => ({ ok: true }) };
  const opts: SessionOptions = {
    scenario,
    character: berlinCharacterById(characterId)!,
    l1: o.l1 ?? 'en',
    profileName: 'Sam',
    topics: ['food'],
    now: () => (t += 4000),
    language: DE,
    game,
    flags: { casual: true, ...(o.flags ?? {}) },
    ...(o.startNode ? { startNode: o.startNode } : {}),
  };
  const s = new ConversationSession(opts);
  s.start();
  return s;
}
const say = (s: ConversationSession, text: string): SubmitResult => {
  const input = classifyInput(text, DE);
  if (input.kind !== 'ja') throw new Error(`Not German: ${text}`);
  return s.submit({ text: input.text, mode: 'typed_ja' });
};
const last = (s: ConversationSession) => s.turns.at(-1)!.line.written;

/** every chip at every node reachable from the start, each picked in a fresh session: understood, no fallback, no unresolved variable */
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
    expect(DE_SMALLTALK.map((s) => s.id)).toEqual(DE_SMALLTALK_FRIENDS.map((f) => `smalltalk_${f}`));
    const topics = (f: string) => Object.keys(berlinScenarioById(`smalltalk_${f}`)!.nodes).filter((n) => n.startsWith('g_')).map((n) => n.slice(2));
    expect(topics('lena')).toContain('lena_buildings');
    expect(topics('lena')).not.toContain('kofi_ride');
    expect(topics('kofi')).toContain('kofi_ride');
    expect(topics('jonas')).toContain('jonas_arabic');
    for (const f of DE_SMALLTALK_FRIENDS) expect(topics(f).length, f).toBe(9);
  });

  for (const f of DE_SMALLTALK_FRIENDS) {
    const topics = Object.keys(berlinScenarioById(`smalltalk_${f}`)!.nodes).filter((n) => n.startsWith('g_'));
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
    const s = open('smalltalk_lena', 'lena', { startNode: 'g_weekend', flags: { rev_bakes_sundays: true } });
    expect(last(s)).toBe('Hey Sam! Wie geht es dir?');
    say(s, 'Hallo! Gut, danke!');
    expect(last(s)).toBe('Was machst du am Wochenende?');
    say(s, 'Ich treffe Freunde im Park.');
    expect(last(s)).toBe('Schön! Ich gehe am Samstag ins Museum. Am Sonntag backe ich gern.');
    say(s, 'Echt? Cool!');
    expect(last(s)).toBe('Danke fürs Quatschen! Bis morgen!');
    const end = say(s, 'Tschüss, bis morgen!');
    expect(end.ended).toBe(true);
    expect([...s.stepsDone].sort()).toEqual(['answer', 'greet', 'react']);
  });

  it('quotes a remembered hobby, food or the dream in the greeting, and an answer to it counts', () => {
    const hobby = open('smalltalk_kofi', 'kofi', { startNode: 'g_music', flags: { cb_hobby: true }, vars: { hobby: { ja: 'Kochen', gloss: { en: 'cooking', ar: 'الطبخ' } } } });
    expect(last(hobby)).toBe('Hey Sam! Was macht das Hobby? Immer noch Kochen?');
    expect(say(hobby, 'Ja, immer noch!').learner.intentId).toBe('cb');
    const food = open('smalltalk_jonas', 'jonas', { startNode: 'g_travel', flags: { cb_food: true }, vars: { food: { ja: 'Pizza', gloss: { en: 'pizza', ar: 'بيتزا' } } } });
    expect(last(food)).toBe('Hey Sam! Hast du diese Woche Pizza gegessen?');
    expect(say(food, 'Ja, gestern!').learner.intentId).toBe('cb');
    const dream = open('smalltalk_lena', 'lena', { startNode: 'g_study', flags: { cb_dream: true } });
    expect(last(dream)).toBe('Hey Sam! Und, wie läuft es mit deinem Traum?');
  });

  it('remembers the favourite food and the sport from your own words', () => {
    const s = open('smalltalk_lena', 'lena', { startNode: 'g_food' });
    say(s, 'Hallo!');
    const r = say(s, 'Ich esse am liebsten Currywurst.');
    expect(r.learner.intentId).toBe('food_named');
    expect(s.remembered.favFood).toBe('currywurst');
    expect(last(s)).toBe('Lecker! Ich liebe Pfannkuchen.');
    const sp = open('smalltalk_kofi', 'kofi', { startNode: 'g_sports' });
    say(sp, 'Hey!');
    expect(say(sp, 'Ja, ich spiele gern Fußball.').learner.intentId).toBe('hobby_named');
    expect(sp.remembered.hobby).toBe('sports');
    // a plain answer is still an answer
    const n = open('smalltalk_kofi', 'kofi', { startNode: 'g_sports' });
    say(n, 'Hallo!');
    expect(say(n, 'Nein, nicht so viel.').learner.intentId).toBe('answer');
  });
});

describe('a present for a friend (give_gift)', () => {
  const brezel = { gift: { ja: 'eine Brezel', gloss: { en: 'a pretzel', ar: 'بريتزل' } } };
  it('names the present, gets the reaction by taste, and every chip is understood', () => {
    for (const r of ['loved', 'liked', 'neutral', 'disliked'] as const) {
      const { problems } = walk(() => open('give_gift', 'lena', { flags: { [`gift_${r}`]: true }, vars: brezel }));
      expect(problems.join(" / "), r).toBe("");
    }
    const s = open('give_gift', 'lena', { flags: { gift_loved: true }, vars: brezel });
    expect(last(s)).toBe('Hey Sam! Was gibt es?');
    const give = say(s, 'Ich habe eine Brezel für dich!');
    expect(give.learner.intentId).toBe('give_food');
    expect(last(s)).toBe('Echt? Wie toll! Vielen Dank!');
    say(s, 'Gern geschehen!');
    expect(last(s)).toBe('Danke, Sam! Das ist echt lieb von dir.');
  });

  it('a record or a jacket is a giftItem; a hand-over that names nothing still works', () => {
    const s = open('give_gift', 'kofi', { flags: { gift_liked: true }, vars: { gift: { ja: 'eine Schallplatte', gloss: { en: 'a record', ar: 'أسطوانة' } } } });
    expect(say(s, 'Hier, eine Schallplatte für dich.').learner.intentId).toBe('give_item');
    const b = open('give_gift', 'jonas', { flags: { gift_neutral: true }, vars: brezel });
    expect(say(b, 'Hier, ein kleines Geschenk!').learner.intentId).toBe('give_bare');
  });

  it('can name everything the street sells that a friend can be given', () => {
    const named = new Set([...DE_SLOTS.giftItem!, ...DE_SLOTS.giftFood!].map((o) => o.id));
    for (const m of BERLIN_PACK.menu) if (m.giftable !== false && m.shop !== 'ubahn') expect(named.has(m.option), m.id).toBe(true);
  });

  it('is in the registry once, as the app starts it', () => {
    expect(berlinScenarioById('give_gift')).toBe(DE_GIVE_GIFT);
  });
});

describe('hang-outs at three hearts', () => {
  const HANG: Array<[string, string, string[]]> = [
    ['hang_lena_backen', 'lena', ['Ja, gern! Was soll ich machen?', 'Hier sind drei Eier.', 'Okay, ich rühre langsam.', 'Nein, danke.', 'Mmh, sehr lecker!']],
    ['hang_kofi_rad', 'kofi', ['Klar, ich helfe dir!', 'Hier ist die Pumpe.', 'Ja, ich halte es fest.', 'Lieber nicht, danke.', 'Gern geschehen!']],
    ['hang_jonas_spiel', 'jonas', ['Nein, wie geht das?', 'Ich nehme Blau.', 'Oh, nur eine Drei.', 'Viel Glück!', 'Das war lustig!']],
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
      expect([...s.stepsDone].sort()).toEqual(berlinScenarioById(id)!.steps.map((x) => x.id).sort());
    });
  }

  it('is a hang-out of the pack at three hearts, listed from Chapter 4', () => {
    for (const [id, who] of HANG) {
      const meta = BERLIN_PACK.scenarioMeta.find((m) => m.id === id)!;
      expect(meta).toMatchObject({ kind: 'hangout', heart: 3, friendId: who, pay: 'none' });
      const it = BERLIN_PACK.interactions[who]!.find((x) => x.scenarioId === id)!;
      expect(it).toMatchObject({ ch: 4, gate: { k: 'hearts', friend: who, atLeast: 3 } });
    }
  });
});
