// Gifts and small talk (agent 4B-a, docs/GAME_DESIGN.md §8.3a, §8.5): the give_gift hand-over and the six smalltalk_<friend> scenarios.
// Every chip is understood in every register and both languages, every scenario is completable by tapping suggestions only, the hand-over
// must name the item (a bare どうぞ is its own intent), fact reveals and callbacks appear on their flags, tokens are in the lexicon, EN+AR.
import { describe, expect, it } from 'vitest';
import type { L1, Line, Scenario } from '../src';
import { CHARACTERS, JP_PACK, LEXICON, PHRASEBOOK, SCENARIOS, SLOTS, scenarioById, tokenize } from '../src';
import { ConversationSession, classifyInput, type SessionGameHooks, type SessionOptions, type SubmitResult } from '../../engine/src';
import { GIVE_GIFT, SHARED_TOPICS, SMALLTALK_CALLBACKS, SMALLTALK_FRIENDS, SMALLTALK_SCENARIOS, SOCIAL_SCENARIOS, SPECIFIC_TOPICS } from '../src/tokyo/scenarios-social';
import { SOCIAL_META } from '../src/tokyo/game/meta/meta-social';
import { SOCIAL_POCKETS } from '../src/tokyo/game/pockets/pockets-social';
import { SOCIAL_LEXICON } from '../src/lexicon/social';
import { SOCIAL_PHRASES } from '../src/phrasebook/social';
import { SOCIAL_SLOTS } from '../src/slots/social';

const PLAIN = ['mio', 'yuki', 'kenji'];
/** the profile facts of §8.4, per friend, in heart order */
const FACTS: Record<string, string[]> = {
  mio: ['likes_anime', 'photo_sakura', 'lives_alone'],
  yuki: ['guitar', 'cat', 'dream_live'],
  tanaka: ['games_night', 'sleepy', 'dream_game'],
  sato: ['thirty_years', 'old_trains', 'grandson'],
  kenji: ['broth', 'baseball', 'daughter_hina'],
  hanako: ['teach_songs', 'calligraphy', 'letters'],
};
const PLAIN_FLAGS: Record<string, boolean>[] = [{}, { casual: true }];
const REMEMBER_KEYS = ['name', 'country', 'hobby', 'favFood', 'dream', 'purchase:phone'];

const linesOf = (sc: Scenario): Array<{ line: Line; where: string }> => {
  const out: Array<{ line: Line; where: string }> = [];
  for (const n of Object.values(sc.nodes)) {
    n.say.forEach((v, i) => out.push({ line: v.line, where: `${sc.id}/${n.id}/say[${i}]` }));
    (n.suggestions ?? []).forEach((s, i) => out.push({ line: s, where: `${sc.id}/${n.id}/chip[${i}]` }));
    for (const it of n.intents) {
      if (it.reply) out.push({ line: it.reply, where: `${sc.id}/${n.id}/${it.id}/reply` });
      if (it.ideal) out.push({ line: it.ideal, where: `${sc.id}/${n.id}/${it.id}/ideal` });
    }
  }
  return out;
};

/** what the host supplies as vars: the item being given and the remembered hobby / food */
const HOST_VARS = {
  gift: { ja: 'チョコレート', gloss: { en: 'chocolate', ar: 'شوكولاتة' } },
  hobby: { ja: 'アニメ', gloss: { en: 'anime', ar: 'الأنمي' } },
  food: { ja: 'ラーメン', gloss: { en: 'ramen', ar: 'الرامن' } },
};
const hooks: SessionGameHooks = { vars: () => HOST_VARS, charge: () => ({ ok: true }) };

function open(id: string, l1: L1, flags: Record<string, boolean> = {}, extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], flags: { ...flags }, now: () => (t += 4000), game: hooks, ...extra });
  s.start();
  return s;
}

function say(s: ConversationSession, text: string): SubmitResult {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
}

/** Picks every suggestion at every reachable node; the friend must always understand it and answer with a displayable line. */
function walk(id: string, l1: L1, flags: Record<string, boolean>, startNode?: string) {
  const problems: string[] = [];
  const visited = new Set<string>();
  let endings = 0;
  const replay = (path: number[]) => {
    const s = open(id, l1, flags, startNode ? { startNode } : {});
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const bad = (tokens: Array<{ s: string; punct?: boolean; raw?: boolean; gloss?: unknown }>) => ({
    unresolved: tokens.some((t) => t.s === '…' && !t.punct),
    noGloss: tokens.some((t) => !t.punct && !t.raw && !t.gloss),
  });
  const visit = (path: number[]) => {
    const s = replay(path);
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}`;
    if (visited.has(key) || s.ended) return;
    visited.add(key);
    s.suggestions().forEach((sg, i) => {
      const b = bad(sg.tokens);
      if (b.unresolved) problems.push(`${s.nodeId}/#${i}: unresolved variable`);
      if (b.noGloss) problems.push(`${s.nodeId}/#${i}: token without gloss`);
      const r = replay(path).pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      const c = bad(r.character.line.tokens);
      if (c.unresolved) problems.push(`${s.nodeId}/#${i}: the friend's answer has an unresolved variable`);
      if (c.noGloss) problems.push(`${s.nodeId}/#${i}: the friend's answer has a token without gloss`);
      if (r.ended) endings++;
      else if (r.learner.matched) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, visited, endings };
}

/** Taps the first chip at every node until the conversation ends. */
function tapFirst(id: string, flags: Record<string, boolean>, startNode?: string, pick = 0) {
  const s = open(id, 'en', flags, startNode ? { startNode } : {});
  for (let guard = 0; guard < 12 && !s.ended; guard++) s.pickSuggestion(Math.min(pick, s.suggestions().length - 1));
  return s;
}

const IDS = SOCIAL_SCENARIOS.map((s) => s.id);
const topicsOf = (f: string) => [...SHARED_TOPICS, ...SPECIFIC_TOPICS.filter((t) => t.only === f)];

describe('social: registration and wiring', () => {
  it('registers give_gift and the six smalltalk scenarios with unique ids', () => {
    expect(IDS).toEqual(['give_gift', ...SMALLTALK_FRIENDS.map((f) => `smalltalk_${f}`)]);
    expect(SMALLTALK_FRIENDS).toEqual(['mio', 'yuki', 'tanaka', 'kenji', 'sato', 'hanako']);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    for (const id of IDS) expect(scenarioById(id), id).toBeTruthy();
    for (const sc of SMALLTALK_SCENARIOS) expect(sc.characterId, sc.id).toBe(sc.id.replace('smalltalk_', ''));
  });

  it('has 12 shared topics and one friend-specific topic for each of the six friends', () => {
    expect(SHARED_TOPICS.map((t) => t.id)).toEqual(['food', 'music', 'anime', 'games', 'travel', 'weather', 'weekend', 'family', 'town', 'study', 'fashion', 'sports']);
    expect(SPECIFIC_TOPICS.map((t) => t.only)).toEqual([...SMALLTALK_FRIENDS]);
    for (const f of SMALLTALK_FRIENDS) expect(topicsOf(f)).toHaveLength(13);
  });

  it('wires ScenarioMeta: pay none, hearts not yen, the friend, goal steps, pockets and culture that exist', () => {
    expect(SOCIAL_META.map((m) => m.id)).toEqual(IDS);
    for (const m of JP_PACK.scenarioMeta.filter((x) => IDS.includes(x.id))) expect(SOCIAL_META.some((x) => x.id === m.id)).toBe(true);
    for (const m of SOCIAL_META) {
      const sc = scenarioById(m.id)!;
      expect(m.pay, m.id).toBe('none');
      expect(m.shop, m.id).toBeUndefined();
      expect(m.band, m.id).toBe(sc.level);
      expect(m.kind, m.id).toBe(m.id === 'give_gift' ? 'friend' : 'talk');
      if (m.id !== 'give_gift') {
        expect(m.friendId, m.id).toBe(sc.characterId);
        expect(m.place, m.id).toBe(sc.locationId);
      }
      for (const c of m.culture ?? []) expect(JP_PACK.culture.some((x) => x.id === c), `${m.id}: culture ${c}`).toBe(true);
      for (const p of m.pocket ?? []) {
        expect(SOCIAL_POCKETS[p], `${m.id}: pocket ${p}`).toBeTruthy();
        expect(JP_PACK.pockets[p], `${m.id}: pocket ${p} in the pack`).toBeTruthy();
      }
    }
    for (const [id, p] of Object.entries(SOCIAL_POCKETS)) expect(p.id).toBe(id);
  });

  it('keeps the goal steps the design names (§8.3a): greet, answer, react', () => {
    for (const sc of SMALLTALK_SCENARIOS) expect(sc.steps.map((s) => s.id), sc.id).toEqual(['greet', 'answer', 'react']);
    expect(GIVE_GIFT.steps.map((s) => s.id)).toEqual(['give', 'reply']);
  });

  it('pocket lines are language the scenarios accept', () => {
    const accepts = (id: string, startNode: string | undefined, line: Line) => {
      const s = open(id, 'en', {}, startNode ? { startNode } : {});
      return say(s, line.ja.replace(/\|/g, '')).learner.matched;
    };
    expect(accepts('give_gift', 'react', SOCIAL_POCKETS.p_give_gift_1.line)).toBe(true);
    expect(accepts('give_gift', 'react', SOCIAL_POCKETS.p_give_gift_2.line)).toBe(true);
    for (const f of SMALLTALK_FRIENDS) {
      expect(accepts(`smalltalk_${f}`, 'g_food', SOCIAL_POCKETS[`p_smalltalk_${f}_1`].line), f).toBe(true);
      expect(accepts(`smalltalk_${f}`, 'f_food', SOCIAL_POCKETS[`p_smalltalk_${f}_2`].line), f).toBe(true);
      expect(accepts(`smalltalk_${f}`, 'close', SOCIAL_POCKETS[`p_smalltalk_${f}_3`].line), f).toBe(true);
    }
  });
});

describe('social: content', () => {
  it('uses only dictionary words and has EN and AR for every line, with matching {variables}', () => {
    const errors: string[] = [];
    for (const sc of SOCIAL_SCENARIOS) {
      expect(sc.title.en && sc.title.ar && sc.setup.en && sc.setup.ar, sc.id).toBeTruthy();
      for (const st of sc.steps) if (!st.text.en || !st.text.ar) errors.push(`${sc.id}/${st.id}: step text`);
      for (const { line, where } of linesOf(sc)) {
        const vars = Object.fromEntries([...line.ja.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], { ja: 'x', raw: true }]));
        const { missing } = tokenize(line.ja, LEXICON, vars);
        if (missing.length) errors.push(`${where}: not in the lexicon: ${missing.join(' ')}`);
        if (!line.en.trim() || !line.ar.trim()) errors.push(`${where}: missing EN/AR`);
        if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(line.en)) errors.push(`${where}: Japanese in English`);
        const ja = [...line.ja.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        const en = [...line.en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        const ar = [...line.ar.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
        if (JSON.stringify(ja) !== JSON.stringify(en) || JSON.stringify(ja) !== JSON.stringify(ar)) errors.push(`${where}: {variables} differ between JA, EN and AR`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('has a valid graph: every node reachable, every target exists, steps are achievable, ends exist, every waiting node has 2+ chips', () => {
    for (const sc of SOCIAL_SCENARIOS) {
      expect(sc.nodes[sc.start], sc.id).toBeTruthy();
      expect(sc.level).toBe('A1');
      const steps = new Set(sc.steps.map((s) => s.id));
      const seen = new Set([sc.start]);
      const queue = [sc.start];
      while (queue.length) {
        const n = sc.nodes[queue.shift()!];
        if (n.step) expect(steps.has(n.step), `${sc.id}/${n.id} step`).toBe(true);
        if (n.end) expect(n.intents, `${sc.id}/${n.id}`).toEqual([]);
        else {
          expect(n.intents.length, `${sc.id}/${n.id} intents`).toBeGreaterThan(0);
          expect(n.suggestions?.length ?? 0, `${sc.id}/${n.id} chips`).toBeGreaterThanOrEqual(2);
        }
        for (const it of n.intents) {
          if (it.step) expect(steps.has(it.step), `${sc.id}/${n.id}/${it.id} step`).toBe(true);
          if (!it.next) throw new Error(`${sc.id}/${n.id}/${it.id}: no next`);
          expect(sc.nodes[it.next], `${sc.id}/${n.id}/${it.id} -> ${it.next}`).toBeTruthy();
          if (it.slot) {
            expect(SLOTS[it.slot], `${sc.id}: slot ${it.slot}`).toBeTruthy();
            for (const o of it.slotOptions ?? []) expect(SLOTS[it.slot].some((x) => x.id === o), `${sc.id}: option ${o}`).toBe(true);
          }
          if (it.remember) expect(REMEMBER_KEYS, `${sc.id}/${n.id}/${it.id} remember key`).toContain(it.remember.fact);
          if (!seen.has(it.next)) {
            seen.add(it.next);
            queue.push(it.next);
          }
        }
      }
      expect([...seen].sort(), sc.id).toEqual(Object.keys(sc.nodes).sort());
      expect(Object.values(sc.nodes).some((n) => n.end), sc.id).toBe(true);
      for (const st of sc.steps) {
        expect(Object.values(sc.nodes).some((n) => n.step === st.id || n.intents.some((i) => i.step === st.id)), `${sc.id}: step ${st.id}`).toBe(true);
      }
    }
  });

  it('keeps its lexicon, phrases and slots well-formed (readings for kanji, glosses, unique ids, displayable Japanese)', () => {
    for (const e of SOCIAL_LEXICON) {
      expect(!!e.r, `${e.s} reading`).toBe(/\p{Script=Han}/u.test(e.s) && !e.g);
      expect(e.en && e.ar, e.s).toBeTruthy();
    }
    const surfaces = SOCIAL_LEXICON.map((e) => e.s);
    expect(new Set(surfaces).size).toBe(surfaces.length);
    const ids = SOCIAL_PHRASES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of SOCIAL_PHRASES) {
      expect(PHRASEBOOK.some((x) => x.id === p.id), p.id).toBe(true);
      expect(tokenize(p.ja, LEXICON).missing, p.id).toEqual([]);
      expect(p.en.length && p.ar.length, p.id).toBeTruthy();
    }
    for (const [name, opts] of Object.entries(SOCIAL_SLOTS)) {
      expect(SLOTS[name], name).toBe(opts);
      for (const o of opts) expect(o.keys.ja.length && o.keys.en.length && o.keys.ar.length, `${name}/${o.id}`).toBeTruthy();
    }
  });

  it('every friend-specific and shared topic has two chips, a keyword list and a reaction', () => {
    for (const t of [...SHARED_TOPICS, ...SPECIFIC_TOPICS]) {
      expect(t.chips).toHaveLength(2);
      expect(t.keys.length, t.id).toBeGreaterThan(0);
      for (const f of SMALLTALK_FRIENDS) if (!t.only || t.only === f) expect(typeof t.react === 'function' ? t.react(f) : t.react, `${t.id}/${f}`).toBeTruthy();
    }
  });
});

describe('social: every chip is understood, in every register, topic and both languages', () => {
  it('give_gift', () => {
    for (const l1 of ['en', 'ar'] as const) {
      for (const flags of <Record<string, boolean>[]>[{}, { casual: true }, { gift_loved: true }, { giftc_liked: true, casual: true }, { gift_disliked: true, dl_tanaka: true }, { gift_disliked: true, dlc_yuki: true, giftc_disliked: true, casual: true }]) {
        const r = walk('give_gift', l1, flags);
        expect(r.problems).toEqual([]);
        expect(r.endings).toBeGreaterThan(0);
      }
    }
  });

  for (const f of SMALLTALK_FRIENDS) {
    it(`smalltalk_${f}: all 13 topics, polite${PLAIN.includes(f) ? ' and plain' : ''}, EN and AR`, () => {
      const id = `smalltalk_${f}`;
      for (const t of topicsOf(f)) {
        for (const l1 of ['en', 'ar'] as const) {
          for (const flags of PLAIN.includes(f) ? PLAIN_FLAGS : [{}]) {
            const r = walk(id, l1, flags, `g_${t.id}`);
            expect(r.problems, `${t.id} ${l1}`).toEqual([]);
            expect(r.endings, `${t.id} ${l1}`).toBeGreaterThan(0);
          }
        }
      }
    });

    it(`smalltalk_${f}: the reveal and callback flags keep every chip understood`, () => {
      const id = `smalltalk_${f}`;
      const sets: Record<string, boolean>[] = [];
      for (const fact of FACTS[f]) {
        sets.push({ [`rev_${fact}`]: true });
        if (PLAIN.includes(f)) sets.push({ [`rev_${fact}`]: true, [`revc_${fact}`]: true, casual: true });
      }
      for (const k of SMALLTALK_CALLBACKS) {
        sets.push({ [`cb_${k}`]: true });
        if (PLAIN.includes(f)) sets.push({ [`cb_${k}`]: true, [`cbc_${k}`]: true, casual: true });
      }
      for (const flags of sets) {
        for (const topic of ['weather', topicsOf(f)[12].id]) {
          const r = walk(id, 'en', flags, `g_${topic}`);
          expect(r.problems, JSON.stringify(flags)).toEqual([]);
        }
      }
    });
  }
});

describe('social: completable by tapping suggestions only', () => {
  for (const f of SMALLTALK_FRIENDS) {
    it(`smalltalk_${f}: every topic, first or second chip, ends with greet, answer and react done`, () => {
      for (const t of topicsOf(f)) {
        for (const pick of [0, 1]) {
          for (const flags of PLAIN.includes(f) ? PLAIN_FLAGS : [{}]) {
            const s = tapFirst(`smalltalk_${f}`, flags, `g_${t.id}`, pick);
            expect(s.ended, `${t.id}/${pick}`).toBe(true);
            expect([...s.stepsDone].sort(), `${t.id}/${pick}`).toEqual(['answer', 'greet', 'react']);
          }
        }
      }
    });
  }

  it('the default start (no startNode) is a complete small talk too', () => {
    for (const f of SMALLTALK_FRIENDS) {
      const s = tapFirst(`smalltalk_${f}`, {});
      expect(s.ended).toBe(true);
      expect(s.stepsDone.size).toBe(3);
    }
  });

  it('an unsure answer still moves on (and does not count as the answer step)', () => {
    const s = open('smalltalk_mio', 'en', {}, { startNode: 't_food' });
    expect(say(s, 'わかりません').learner.matched).toBe(true);
    expect(s.nodeId).toBe('f_food');
    expect(s.stepsDone.has('answer')).toBe(false);
  });

  it('typed Japanese works at every node: greeting, an answer, a reaction and a goodbye', () => {
    const s = open('smalltalk_sato', 'en', {}, { startNode: 'g_food' });
    for (const text of ['こんにちは', '寿司が好きです', 'そうですね', 'また明日']) {
      const r = say(s, text);
      expect(r.learner.matched, text).toBe(true);
    }
    expect(s.nodeId).toBe('end');
    expect([...s.stepsDone].sort()).toEqual(['answer', 'greet', 'react']);
  });
});

describe('social: fact reveals, callbacks and what the friend remembers', () => {
  it('reveals each profile fact in the follow node on its flag (polite, and plain for the plain-speaking)', () => {
    for (const f of SMALLTALK_FRIENDS) {
      FACTS[f].forEach((fact) => {
        for (const topic of ['food', topicsOf(f)[12].id]) {
          const s = open(`smalltalk_${f}`, 'en', { [`rev_${fact}`]: true }, { startNode: `t_${topic}` });
          s.pickSuggestion(0);
          expect(s.nodeId).toBe(`f_${topic}`);
          const plain = s.turns.at(-1)!.line.written;
          const none = open(`smalltalk_${f}`, 'en', {}, { startNode: `t_${topic}` });
          none.pickSuggestion(0);
          const bare = none.turns.at(-1)!.line.written;
          expect(plain.length, `${f}/${fact}`).toBeGreaterThan(bare.length);
          expect(plain.startsWith(bare.replace(/[。！？]$/, '')) || plain.includes(bare.slice(0, 3)), `${f}/${fact}`).toBe(true);
          if (PLAIN.includes(f)) {
            const c = open(`smalltalk_${f}`, 'en', { [`rev_${fact}`]: true, [`revc_${fact}`]: true, casual: true }, { startNode: `t_${topic}` });
            c.pickSuggestion(0);
            expect(c.turns.at(-1)!.line.written, `${f}/${fact} plain`).not.toBe(plain);
          }
        }
      });
    }
  });

  it('every fact line matches the design text (§8.4) after the markup is resolved', () => {
    const WRITTEN: Record<string, string> = {
      likes_anime: 'わたしはアニメが好きです。',
      photo_sakura: '春に桜の写真をとります。',
      lives_alone: 'ひとりで住んでいます。',
      guitar: '週末にギターを弾きます。',
      cat: 'ねこがいます。名前はモカです。',
      dream_live: 'いつか、ライブをしたいです。',
      games_night: '毎晩ゲームをします。',
      sleepy: '夜はちょっと眠いです。',
      dream_game: 'ゲームの会社で働きたいです。',
      thirty_years: '三十年、この駅で働いています。',
      old_trains: '古い電車が好きです。',
      grandson: '孫は五歳です。',
      broth: 'スープは十二時間煮ます。',
      baseball: '野球が大好きです。',
      daughter_hina: '娘のひなは七歳です。',
      teach_songs: '歌で日本語を教えます。',
      calligraphy: '書道が趣味です。',
      letters: '毎年、生徒の手紙を読みます。',
    };
    for (const f of SMALLTALK_FRIENDS) {
      for (const fact of FACTS[f]) {
        const s = open(`smalltalk_${f}`, 'en', { [`rev_${fact}`]: true }, { startNode: 't_weather' });
        s.pickSuggestion(0);
        expect(s.turns.at(-1)!.line.written, `${f}/${fact}`).toContain(WRITTEN[fact]);
      }
    }
  });

  it('quotes a remembered fact in the greeting on its flag and counts the answer as the callback intent', () => {
    const QUOTE: Record<string, string> = { hobby: 'アニメ、', food: 'ラーメン、', phone: 'スマホ、', dream: '夢、' };
    for (const f of SMALLTALK_FRIENDS) {
      for (const k of SMALLTALK_CALLBACKS) {
        const s = open(`smalltalk_${f}`, 'en', { [`cb_${k}`]: true }, { startNode: 'g_food' });
        expect(s.turns[0].line.written, `${f}/${k}`).toContain(QUOTE[k]);
        const r = say(s, 'はい、とても楽しいです。');
        expect(r.learner.intentId, `${f}/${k}`).toBe('cb');
        expect(s.stepsDone.has('greet')).toBe(true);
      }
    }
    // without a flag the greeting is plain
    const plain = open('smalltalk_mio', 'en', {}, { startNode: 'g_food' });
    for (const q of Object.values(QUOTE)) expect(plain.turns[0].line.written).not.toContain(q);
  });

  it('every friend has a callback: the plain-speaking quote in plain form, the others politely', () => {
    for (const f of SMALLTALK_FRIENDS) {
      const polite = open(`smalltalk_${f}`, 'en', { cb_phone: true }, { startNode: 'g_food' }).turns[0].line.written;
      expect(polite, f).toContain('使いやすいですか');
      if (PLAIN.includes(f)) {
        const plain = open(`smalltalk_${f}`, 'en', { cb_phone: true, cbc_phone: true, casual: true }, { startNode: 'g_food' }).turns[0].line.written;
        expect(plain, f).toContain('使いやすい？');
      }
    }
  });

  it('remembers what the learner says: favFood from the food topic, hobby from anime and games', () => {
    const food = open('smalltalk_yuki', 'en', {}, { startNode: 't_food' });
    food.pickSuggestion(0);
    expect(food.remembered.favFood).toBe('ramen');
    const curry = open('smalltalk_yuki', 'en', {}, { startNode: 't_food' });
    curry.pickSuggestion(1);
    expect(curry.remembered.favFood).toBe('curry');
    const anime = open('smalltalk_mio', 'en', {}, { startNode: 't_anime' });
    anime.pickSuggestion(0);
    expect(anime.remembered.hobby).toBe('anime');
    const games = open('smalltalk_tanaka', 'en', {}, { startNode: 't_games' });
    games.pickSuggestion(0);
    expect(games.remembered.hobby).toBe('games');
    // a "no" answer remembers nothing
    const no = open('smalltalk_mio', 'en', {}, { startNode: 't_anime' });
    no.pickSuggestion(1);
    expect(no.remembered.hobby).toBeUndefined();
  });

  it('shared topics use the friend’s own noun in the follow-up', () => {
    const own = (f: string, topic: string) => {
      const s = open(`smalltalk_${f}`, 'en', {}, { startNode: `t_${topic}` });
      s.pickSuggestion(0);
      return s.turns.at(-1)!.line.written;
    };
    expect(own('mio', 'food')).toContain('ケーキ');
    expect(own('kenji', 'food')).toContain('ラーメン');
    expect(own('sato', 'food')).toContain('寿司');
    expect(own('yuki', 'weekend')).toContain('ギター');
    expect(own('tanaka', 'weekend')).toContain('ゲーム');
  });
});

describe('social: the gift hand-over', () => {
  const GIFT_ITEMS = [...SLOTS.giftItem, ...SLOTS.giftFood];

  it('three chips name the item (and are assisted taps), the friend then reacts and any reply ends with a thanks line', () => {
    for (const i of [0, 1, 2]) {
      const s = open('give_gift', 'en');
      const chip = s.suggestions()[i].written;
      expect(chip, `chip ${i}`).toContain('チョコレート');
      const r = s.pickSuggestion(i);
      expect(r.learner.intentId, `chip ${i}`).toBe('give_item');
      expect(s.nodeId).toBe('react');
      expect(s.stepsDone.has('give')).toBe(true);
      s.pickSuggestion(0);
      expect(s.nodeId).toBe('thanks');
      expect(s.stepsDone.has('reply')).toBe(true);
      expect(s.ended).toBe(false);
      s.pickSuggestion(0);
      expect(s.ended).toBe(true);
    }
  });

  it('typing a sentence that names any giftable item is the named hand-over (give_item or give_food)', () => {
    for (const o of GIFT_ITEMS) {
      for (const sentence of [`${o.ja}、どうぞ。`, `${o.ja}をあげます。`, `プレゼントです。${o.ja}です。`]) {
        const s = open('give_gift', 'en');
        const r = say(s, sentence.replace(/\|/g, ''));
        expect(['give_item', 'give_food'], `${o.id}: ${sentence}`).toContain(r.learner.intentId);
        expect(s.nodeId).toBe('react');
      }
    }
  });

  it('a bare どうぞ (no item named) is its own intent, for the half-AP hand-over', () => {
    for (const text of ['どうぞ', 'プレゼントです', 'これ、どうぞ']) {
      const s = open('give_gift', 'en');
      const r = say(s, text);
      expect(r.learner.intentId, text).toBe('give_bare');
      expect(s.nodeId).toBe('react');
    }
  });

  it('English and Arabic hand-overs are understood as a bare hand-over', () => {
    const en = open('give_gift', 'en');
    expect(say(en, 'here you are').learner.matched).toBe(true);
    expect(en.nodeId).toBe('react');
    const ar = open('give_gift', 'ar');
    expect(say(ar, 'تفضل').learner.matched).toBe(true);
    expect(ar.nodeId).toBe('react');
  });

  it('reacts by taste and register, never rudely, and the dislike humour lines come from the flags', () => {
    const react = (flags: Record<string, boolean>) => {
      const s = open('give_gift', 'en', flags);
      s.pickSuggestion(0);
      return s.turns.at(-1)!.line.written;
    };
    expect(react({ gift_loved: true })).toContain('本当ですか');
    expect(react({ giftc_loved: true, gift_loved: true, casual: true })).toContain('ほんと');
    expect(react({ gift_liked: true })).toContain('うれしいです');
    expect(react({ gift_neutral: true })).toBe('ありがとうございます。');
    expect(react({ gift_disliked: true })).toBe('あ…ありがとうございます。');
    expect(react({ giftc_disliked: true, gift_disliked: true, casual: true })).toBe('あ…ありがとう。');
    expect(react({ gift_disliked: true, dl_tanaka: true })).toContain('毎日');
    expect(react({ gift_disliked: true, dl_yuki: true })).toContain('お店のがいいです');
    expect(react({ gift_disliked: true, dl_yuki: true, dlc_yuki: true, casual: true })).toContain('お店のがいいかな');
    expect(react({})).toBe('ありがとうございます。');
  });

  it('is polite or plain by flag', () => {
    expect(open('give_gift', 'en').turns[0].line.written).toContain('どうしましたか');
    expect(open('give_gift', 'en', { casual: true }).turns[0].line.written).toContain('どうしたの');
  });

  it('is completable by tapping the first chip, in either language', () => {
    for (const l1 of ['en', 'ar'] as const) {
      const s = open('give_gift', l1);
      for (let g = 0; g < 6 && !s.ended; g++) s.pickSuggestion(0);
      expect(s.ended).toBe(true);
      expect([...s.stepsDone].sort()).toEqual(['give', 'reply']);
    }
  });

  it('every giftItem / giftFood option used by the konbini, cafe and tastes has a hand-over name (food slot ids match the menu options)', () => {
    expect(SLOTS.giftFood.map((o) => o.id)).toEqual(['coffee', 'greenTea', 'cake', 'onigiri', 'bento']);
    const taken = new Set(SLOTS.giftItem.map((o) => o.id));
    for (const o of SLOTS.giftFood) expect(taken.has(o.id), o.id).toBe(false);
  });
});
