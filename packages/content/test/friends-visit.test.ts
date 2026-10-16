// Hang-outs and home visits (Release 2 wave B1, docs/GAME_DESIGN.md §8.8): the four hang-outs and the three home visits. Every chip is understood in
// both registers and both languages (tapped, and typed as English or Arabic), every scenario is completable by tapping alone and by typing, the
// rewards and flags land once, the interaction rows appear only for registered scenarios, and the homes table is whole.
import { describe, expect, it } from 'vitest';
import { BALANCE, emptyFriend, heartsForAp, reduce, validatePack, type ContentIndex, type GameState, type InputEvent } from '../../game/src';
import { ctxOf, makeFacts, makeState } from '../../game/test/fixtures-1e';
import type { IntentDef, L1, Line, Scenario } from '../src';
import { CHARACTERS, JP_PACK, LEXICON, PHRASEBOOK, SCENARIOS, SLOTS, scenarioById, tokenize } from '../src';
import { ConversationSession, classifyInput, type SessionOptions, type SubmitResult } from '../../engine/src';
import { DOOR_LOCKED, GENKAN, HANGOUTS, HOMES, PROP_WORDS, homeOfDoor, homeOfFriend, homeOfStage } from '../src/tokyo/game/homes';
import { FRIENDS_META } from '../src/tokyo/game/meta/meta-friends';
import { FRIENDS_POCKETS } from '../src/tokyo/game/pockets/pockets-friends';
import { INTERACTIONS } from '../src/tokyo/game/interactions';
import { KEEPSAKES } from '../src/tokyo/game/gifts';
import { FRIENDS_SCENARIOS, HANGOUT_SCENARIOS, HOME_SCENARIOS } from '../src/tokyo/scenarios-friends';
import { SOCIAL_FRIENDS_PHRASES } from '../src/phrasebook/social-friends';
import { SOCIAL_FRIENDS_SLOTS } from '../src/slots/social-friends';
import { en as stringsEn, ar as stringsAr } from '../../../apps/mobile/src/strings/friends-visit';

const HANGS = ['hang_mio_photo', 'hang_yuki_jam', 'hang_kenji_cook', 'hang_aiko_wagashi'];
const HOMES_IDS = ['home_mio', 'home_aiko', 'home_kenji'];
const ALL = [...HANGS, ...HOMES_IDS];
/** who speaks plain form in the scenarios: Aiko is polite and soft at every heart */
const PLAIN_HOSTS = ['mio', 'yuki', 'kenji'];

const linesOf = (sc: Scenario): Array<{ line: Line; where: string }> => {
  const out: Array<{ line: Line; where: string }> = [];
  for (const n of Object.values(sc.nodes)) {
    n.say.forEach((v, i) => out.push({ line: v.line, where: `${sc.id}/${n.id}/say[${i}]` }));
    [...(n.suggestions ?? []), ...Object.values(n.suggestionsByL1 ?? {}).flat()].forEach((s, i) => out.push({ line: s, where: `${sc.id}/${n.id}/chip[${i}]` }));
    for (const it of n.intents) {
      if (it.reply) out.push({ line: it.reply, where: `${sc.id}/${n.id}/${it.id}/reply` });
      if (it.ideal) out.push({ line: it.ideal, where: `${sc.id}/${n.id}/${it.id}/ideal` });
    }
  }
  return out;
};

function open(id: string, l1: L1, flags: Record<string, boolean>, extra: Partial<SessionOptions> = {}): ConversationSession {
  const scenario = scenarioById(id)!;
  const character = CHARACTERS.find((c) => c.id === scenario.characterId)!;
  let t = 0;
  const s = new ConversationSession({ scenario, character, l1, profileName: 'レイラ', topics: [], flags: { ...flags }, now: () => (t += 4000), ...extra });
  s.start();
  return s;
}

/** Mirrors what the app does with whatever the learner types or says. */
function say(s: ConversationSession, text: string): SubmitResult {
  const input = classifyInput(text);
  if (input.kind === 'ja') return s.submit({ text: input.text, mode: 'typed_ja' });
  if (input.kind === 'romaji') return s.submit({ text: input.text, kana: input.kana, mode: 'typed_romaji' });
  if (!input.translation) throw new Error(`Not covered: ${text}`);
  return s.submit({ text: input.text, mode: 'assist', l1Text: input.text, translation: input.translation });
}

const slotKey = (s: ConversationSession) => JSON.stringify((s as unknown as { slotIds: Record<string, string> }).slotIds);

/**
 * Picks every suggestion at every reachable node (tapped), and types its English or Arabic as well: the host must understand both the same way
 * (the same next node), answer with a displayable line, and every non-final node must offer at least two chips.
 */
function walk(id: string, l1: L1, flags: Record<string, boolean>) {
  const problems: string[] = [];
  const visited = new Set<string>();
  const ended = new Set<string>();
  const replay = (path: number[]) => {
    const s = open(id, l1, flags);
    for (const i of path) s.pickSuggestion(i);
    return s;
  };
  const visit = (path: number[]) => {
    const s = replay(path);
    const key = `${s.nodeId}|${[...s.stepsDone].sort().join(',')}|${slotKey(s)}`;
    if (visited.has(key) || s.ended) return;
    visited.add(key);
    const sugg = s.suggestions();
    if (sugg.length < 2) problems.push(`${s.nodeId}: fewer than 2 suggestions`);
    sugg.forEach((sg, i) => {
      if (sg.tokens.some((t) => t.s === '…' && !t.punct)) problems.push(`${s.nodeId}/#${i}: unresolved variable`);
      if (sg.tokens.some((t) => !t.punct && !t.raw && !t.gloss)) problems.push(`${s.nodeId}/#${i}: token without gloss`);
      const tapped = replay(path);
      const r = tapped.pickSuggestion(i);
      if (!r.learner.matched) problems.push(`${s.nodeId}/#${i} "${sg.written}" was not understood`);
      else if (r.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} "${sg.written}" got a fallback`);
      if (r.character.line.tokens.some((tk) => tk.s === '…' && !tk.punct)) problems.push(`${s.nodeId}/#${i} "${sg.written}": the host's answer has an unresolved variable`);
      if (r.character.line.tokens.some((tk) => !tk.punct && !tk.raw && !tk.gloss)) problems.push(`${s.nodeId}/#${i}: the host's answer has a token without gloss`);
      // the same chip typed in the learner's own language lands on the same node
      const typed = replay(path);
      try {
        const rt = say(typed, l1 === 'en' ? sg.en : sg.ar);
        if (!rt.learner.matched || rt.character.kind === 'fallback') problems.push(`${s.nodeId}/#${i} typed "${l1 === 'en' ? sg.en : sg.ar}" was not understood`);
        else if (typed.nodeId !== tapped.nodeId) problems.push(`${s.nodeId}/#${i} typed "${l1 === 'en' ? sg.en : sg.ar}" went to ${typed.nodeId}, tapped to ${tapped.nodeId}`);
      } catch (e) {
        problems.push(`${s.nodeId}/#${i} typed "${l1 === 'en' ? sg.en : sg.ar}": ${(e as Error).message}`);
      }
      if (r.ended) ended.add(`${s.nodeId}/#${i}`);
      else if (r.learner.matched) visit([...path, i]);
    });
  };
  visit([]);
  return { problems, visited, ended };
}

/** the flags a host raises: none (polite), or the friend speaking plain form */
const REGISTERS: Array<[string, Record<string, boolean>]> = [
  ['polite', {}],
  ['plain', { casual: true }],
];

describe('hang-outs and home visits: registration', () => {
  it('registers the four hang-outs and the three homes, each hosted by the right friend in the right place', () => {
    expect(HANGOUT_SCENARIOS.map((s) => s.id)).toEqual(HANGS);
    expect(HOME_SCENARIOS.map((s) => s.id)).toEqual(HOMES_IDS);
    expect(FRIENDS_SCENARIOS.map((s) => s.id)).toEqual(ALL);
    const expected: Record<string, [string, string]> = {
      hang_mio_photo: ['mio', 'park'],
      hang_yuki_jam: ['yuki', 'cafe'],
      hang_kenji_cook: ['kenji', 'ramen'],
      hang_aiko_wagashi: ['aiko', 'ono'],
      home_mio: ['mio', 'home_mio'],
      home_aiko: ['aiko', 'home_aiko'],
      home_kenji: ['kenji', 'home_kenji'],
    };
    for (const id of ALL) {
      const sc = scenarioById(id)!;
      expect(sc, id).toBeTruthy();
      expect([sc.characterId, sc.locationId], id).toEqual(expected[id]);
      expect(sc.title.en && sc.title.ar && sc.setup.en && sc.setup.ar, id).toBeTruthy();
      expect(['A1', 'A2'], id).toContain(sc.level);
      for (const st of sc.steps) expect(st.text.en && st.text.ar, `${id}/${st.id}`).toBeTruthy();
    }
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  it('keeps the steps of the design: four for a hang-out, the five of the home_visit template for a home', () => {
    expect(scenarioById('hang_mio_photo')!.steps.map((s) => s.id)).toEqual(['pose', 'see', 'pick', 'thank']);
    expect(scenarioById('hang_yuki_jam')!.steps.map((s) => s.id)).toEqual(['genre', 'like', 'praise', 'request']);
    expect(scenarioById('hang_kenji_cook')!.steps.map((s) => s.id)).toEqual(['ingredients', 'steps', 'taste', 'thanks']);
    expect(scenarioById('hang_aiko_wagashi')!.steps.map((s) => s.id)).toEqual(['count', 'choose', 'praise', 'thank']);
    for (const id of HOMES_IDS) expect(scenarioById(id)!.steps.map((s) => s.id), id).toEqual(['enter', 'offer', 'look', 'unique', 'leave']);
  });

  it('wires ScenarioMeta: pay none, the right kind and heart, the friend, A1-A2, pocket lines, culture cards and a reward', () => {
    expect(FRIENDS_META.map((m) => m.id)).toEqual(ALL);
    for (const m of FRIENDS_META) {
      const sc = scenarioById(m.id)!;
      expect(m.pay, m.id).toBe('none');
      expect(m.kind, m.id).toBe(m.id.startsWith('hang_') ? 'hangout' : 'home');
      expect(m.heart, m.id).toBe(m.kind === 'hangout' ? 3 : 4);
      expect(m.friendId, m.id).toBe(sc.characterId);
      expect(m.band, m.id).toBe(sc.level);
      expect(m.register, m.id).toBe('polite');
      expect(m.shop, m.id).toBeUndefined();
      expect(m.effects?.length, `${m.id} hands over nothing`).toBeGreaterThan(0);
      for (const c of m.culture ?? []) expect(JP_PACK.culture.some((x) => x.id === c), `${m.id}: ${c}`).toBe(true);
      for (const p of m.pocket ?? []) expect(JP_PACK.pockets[p], `${m.id}: ${p}`).toBeTruthy();
      expect((m.pocket ?? []).filter((p) => JP_PACK.pockets[p]?.key).length, m.id).toBeLessThanOrEqual(2);
      expect(JP_PACK.scenarioMeta.some((x) => x.id === m.id)).toBe(true);
      expect(CHARACTERS.some((c) => c.id === m.friendId)).toBe(true);
      expect(JP_PACK.friends.some((f) => f.id === m.friendId), `${m.id}: ${m.friendId} is a friend`).toBe(true);
    }
    for (const id of HOMES_IDS) expect(FRIENDS_META.find((m) => m.id === id)!.culture, id).toContain('cc_shoesoff');
  });

  it('validates green at level 4 (the bot walks them) and level 5 (against the content index)', () => {
    const allNodes = (s: Scenario) => Object.values(s.nodes);
    const index: ContentIndex = {
      scenarios: Object.fromEntries(SCENARIOS.map((s) => [s.id, { steps: s.steps.map((x) => x.id), intents: allNodes(s).flatMap((n) => n.intents.map((i) => i.id)), characterId: s.characterId }])),
      lexiconSurfaces: new Set(LEXICON.all().map((e) => e.s)),
      slots: Object.fromEntries(Object.entries(SLOTS).map(([k, v]) => [k, v.map((o) => o.id)])),
      characters: CHARACTERS.map((c) => c.id),
    };
    const errs4 = validatePack(JP_PACK, { level: 4, index }).filter((i) => i.severity === 'error');
    expect(errs4.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
    // level 5 still reports content that later waves build (titles, the trip, the flat); nothing it reports is about these seven
    const mine = /hang_|home_|_hang|photo_|stamp_card|kenji_recipe|tea_cup|hina_drawing|friends\[|aiko_room_shown|p_hang|p_home/;
    const errs5 = validatePack(JP_PACK, { level: 5, index }).filter((i) => i.severity === 'error' && mine.test(`${i.path} ${i.message}`) && !/aiko_viewing|rin_home|fuku_home|p_home_own/.test(`${i.path} ${i.message}`));
    expect(errs5.map((i) => `${i.code} ${i.path} ${i.message}`)).toEqual([]);
  });

  it('adds Aiko as the seventh friend: from Chapter 2, polite and soft at every heart, with a home and tastes of her own', () => {
    const aiko = JP_PACK.friends.find((f) => f.id === 'aiko')!;
    expect(aiko).toMatchObject({ unlockChapter: 2, casualAt: 99, register: 'polite', home: { stage: 'aiko_tatami', door: 'door:aiko' } });
    expect(JP_PACK.friends.find((f) => f.id === 'mio')!.home).toEqual({ stage: 'mio_1r', door: 'door:mio' });
    expect(JP_PACK.friends.find((f) => f.id === 'kenji')!.home).toEqual({ stage: 'kenji_flat', door: 'door:kenji' });
    expect(JP_PACK.friends.filter((f) => f.home).map((f) => f.id).sort()).toEqual(['aiko', 'kenji', 'mio']);
  });
});

describe('hang-outs and home visits: the interaction rows', () => {
  const FRIEND_ROW = /^(?:.+_hang|home_.+)$/;
  const packRows = Object.values(JP_PACK.interactions).flat();

  it('lists every hang-out row (♥3) and home row (♥4), each pointing at a registered scenario', () => {
    for (const [who, hang] of [['mio', 'hang_mio_photo'], ['yuki', 'hang_yuki_jam'], ['kenji', 'hang_kenji_cook'], ['aiko', 'hang_aiko_wagashi']] as const) {
      const row = JP_PACK.interactions[who]!.find((r) => r.id === `${who}_hang`)!;
      expect(row, who).toMatchObject({ kind: 'scenario', scenarioId: hang, gate: { k: 'hearts', friend: who, atLeast: 3 } });
    }
    for (const who of ['mio', 'kenji', 'aiko']) {
      const row = JP_PACK.interactions[who]!.find((r) => r.id === `home_${who}`)!;
      expect(row, who).toMatchObject({ kind: 'visit', scenarioId: `home_${who}`, gate: { k: 'hearts', friend: who, atLeast: 4 } });
      // listed from Chapter 3 like the hang-out: the door is active at ♥4 whatever the chapter
      expect(row.ch, who).toBe(3);
    }
    for (const r of packRows.filter((x) => FRIEND_ROW.test(x.id))) expect(scenarioById(r.scenarioId!), r.id).toBeTruthy();
  });

  it('shows a hang-out or home row only while its scenario is registered; the other unbuilt rows are unchanged', () => {
    const registered = new Set(JP_PACK.scenarioMeta.map((m) => m.id));
    for (const [who, rows] of Object.entries(INTERACTIONS)) {
      for (const r of rows.filter((x) => FRIEND_ROW.test(x.id))) {
        const shown = (JP_PACK.interactions[who] ?? []).some((x) => x.id === r.id);
        expect(shown, `${who}/${r.id}`).toBe(registered.has(r.scenarioId!));
      }
    }
    // rows of other kinds are untouched by this filter: the flat rows wait for their scenarios and stay in the table
    expect(JP_PACK.interactions.aiko!.some((r) => r.id === 'aiko_viewing')).toBe(true);
    expect(JP_PACK.interactions.rin!.some((r) => r.id === 'rin_home')).toBe(true);
  });

  it('keeps the Release 1 characters without a hang-out or home row (Yuki and Kenji have a hang-out only, Yuki no home)', () => {
    expect(JP_PACK.interactions.yuki!.some((r) => r.id.startsWith('home_'))).toBe(false);
    expect(JP_PACK.interactions.tanaka!.some((r) => FRIEND_ROW.test(r.id))).toBe(false);
  });
});

describe('hang-outs and home visits: content', () => {
  it('uses only dictionary words, with English and Arabic for every line and the same {variables} in all three', () => {
    const errors: string[] = [];
    for (const sc of FRIENDS_SCENARIOS) {
      for (const { line, where } of linesOf(sc)) {
        const { missing } = tokenize(line.ja, LEXICON, Object.fromEntries([...line.ja.matchAll(/\{(\w+)\}/g)].map((m) => [m[1], { ja: 'x', raw: true }])));
        if (missing.length) errors.push(`${where}: not in the lexicon: ${missing.join(' ')}`);
        if (!line.en.trim() || !line.ar.trim()) errors.push(`${where}: missing EN/AR`);
        if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(line.en.replace(/ごちそうさまでした|いただきます|おじゃまします|おじゃましました/g, ''))) errors.push(`${where}: Japanese in the English`);
        if (/\b\w+'(t|ll|re|ve|d|m)\b/.test(line.en)) errors.push(`${where}: contraction in "${line.en}"`);
        const ph = (t: string) => (t.match(/\{\w+\}/g) ?? []).sort().join();
        if (ph(line.ja) !== ph(line.en) || ph(line.ja) !== ph(line.ar)) errors.push(`${where}: placeholders differ`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('has a valid graph: every node reachable, every target and step defined, an end node, two chips wherever the learner answers', () => {
    for (const sc of FRIENDS_SCENARIOS) {
      expect(sc.nodes[sc.start], sc.id).toBeTruthy();
      const seen = new Set<string>([sc.start]);
      const queue = [sc.start];
      const stepsSet = new Set<string>();
      while (queue.length) {
        const n = sc.nodes[queue.shift()!]!;
        if (n.step) stepsSet.add(n.step);
        if (!n.end) expect((n.suggestions ?? n.suggestionsByL1?.en ?? []).length, `${sc.id}/${n.id}`).toBeGreaterThanOrEqual(2);
        for (const it of n.intents as IntentDef[]) {
          if (it.step) stepsSet.add(it.step);
          expect(it.next || it.stay, `${sc.id}/${n.id}/${it.id}`).toBeTruthy();
          if (it.slot) expect(SLOTS[it.slot], `${sc.id}/${n.id}/${it.id}: slot ${it.slot}`).toBeTruthy();
          for (const o of it.slotOptions ?? []) expect(SLOTS[it.slot!]!.some((x) => x.id === o), `${sc.id}: option ${o}`).toBe(true);
          if (it.next) {
            expect(sc.nodes[it.next], `${sc.id}/${n.id} -> ${it.next}`).toBeTruthy();
            if (!seen.has(it.next)) {
              seen.add(it.next);
              queue.push(it.next);
            }
          }
        }
      }
      expect([...seen].sort(), sc.id).toEqual(Object.keys(sc.nodes).sort());
      expect(Object.values(sc.nodes).some((n) => n.end), sc.id).toBe(true);
      for (const st of sc.steps) expect(stepsSet.has(st.id), `${sc.id}: step ${st.id} can never be done`).toBe(true);
    }
  });

  it('speaks plain form only when the host is casual, and never for Aiko (polite and soft at every heart)', () => {
    const errors: string[] = [];
    for (const sc of FRIENDS_SCENARIOS) {
      const plainHost = PLAIN_HOSTS.includes(sc.characterId);
      for (const n of Object.values(sc.nodes)) {
        const casual = n.say.filter((v) => v.when && 'flag' in v.when && v.when.flag === 'casual');
        if (!plainHost && casual.length) errors.push(`${sc.id}/${n.id}: ${sc.characterId} has a casual variant`);
        for (const v of casual) if (/です|ます|ください|ました|ましょう/.test(v.line.ja.replace(/\|/g, ''))) errors.push(`${sc.id}/${n.id}: a polite ending in a casual line: ${v.line.ja}`);
        // a polite line is the last variant, with no condition: the host that raises no flag is understood
        expect(n.say[n.say.length - 1]!.when, `${sc.id}/${n.id}`).toBeUndefined();
        if (plainHost && !n.end && n.say.length < 2) errors.push(`${sc.id}/${n.id}: a casual host with one register only`);
        if (plainHost && n.end && n.say.length < 2) errors.push(`${sc.id}/${n.id}: a casual host with one register only`);
      }
    }
    expect(errors).toEqual([]);
  });

  it('asks Hina\'s three questions in Kenji\'s flat (age, where from, favourite food) and shows the dinner words', () => {
    const sc = scenarioById('home_kenji')!;
    const text = (id: string) => sc.nodes[id]!.say.map((v) => v.line.ja.replace(/\|/g, '')).join(' ');
    expect(text('q_age')).toContain('何歳');
    expect(text('q_from')).toContain('どこ');
    expect(text('q_food')).toContain('食べ物');
    expect(sc.nodes.dinner!.intents[0]!.any).toContain('いただきます');
    expect(sc.nodes.q_food!.intents.some((i) => i.step === 'unique')).toBe(true);
  });

  it('Aiko\'s home shows the room next door and her tea hang-out hands over the wagashi (and nothing depends on the cosmetic flag)', () => {
    expect(scenarioById('home_aiko')!.nodes.room!.say[0]!.line.ja).toContain('隣');
    expect(JP_PACK.scenarioMeta.find((m) => m.id === 'home_aiko')!.effects).toContainEqual({ t: 'flag', id: 'aiko_room_shown' });
    expect(JP_PACK.scenarioMeta.find((m) => m.id === 'hang_aiko_wagashi')!.effects).toContainEqual({ t: 'item', id: 'g_wagashi', qty: 1 });
    // nothing waits for the flag: no predicate, gate or interaction names it
    const text = JSON.stringify([JP_PACK.interactions, JP_PACK.scenarioMeta.map((m) => m.gate), JP_PACK.chapters, JP_PACK.dreams]);
    expect(text).not.toContain('aiko_room_shown');
  });
});

describe('hang-outs and home visits: every chip is understood (tapped, and typed in English and Arabic)', () => {
  for (const id of ALL) {
    for (const [label, flags] of REGISTERS) {
      for (const l1 of ['en', 'ar'] as const) {
        it(`${id}, ${label}, ${l1}`, () => {
          const { problems, visited, ended } = walk(id, l1, flags);
          expect(problems).toEqual([]);
          expect(visited.size).toBeGreaterThan(3);
          expect(ended.size).toBeGreaterThan(0);
        }, 120_000);
      }
    }
  }
});

describe('hang-outs and home visits: completable by tapping suggestions alone', () => {
  for (const id of ALL) {
    for (const [label, flags] of REGISTERS) {
      it(`${id} (${label}): the first chip at every node finishes it with every goal step done, in 4-12 turns`, () => {
        const sc = scenarioById(id)!;
        const s = open(id, 'en', flags);
        let turns = 0;
        while (!s.ended && turns++ < 20) s.pickSuggestion(0);
        expect(s.ended, id).toBe(true);
        expect([...s.stepsDone].sort(), id).toEqual(sc.steps.map((x) => x.id).sort());
        expect(turns, id).toBeGreaterThanOrEqual(4);
        expect(turns, id).toBeLessThanOrEqual(12);
      });
    }
  }
});

describe('hang-outs and home visits: completable by typing', () => {
  /** [typed text, ...] per scenario; Japanese first, then English and Arabic ("say it your way"), then romaji */
  const SCRIPTS: Record<string, { ja: string[]; en: string[]; ar: string[]; romaji: string[] }> = {
    hang_mio_photo: {
      ja: ['ポーズします。', '桜が見えます。', '空が見えます。', '花が見えます。', 'こっちがいいです。', 'ありがとうございます。'],
      en: ['Peace sign', 'I see cherry blossoms', 'I see the sky', 'I see flowers', 'This one is better', 'Thank you'],
      ar: ['علامة النصر', 'أرى أشجار الكرز', 'أرى السماء', 'أرى الزهور', 'هذه أفضل', 'شكرا'],
      romaji: ['pozu shimasu', 'sakura ga miemasu', 'sora ga miemasu', 'hana ga miemasu', 'kocchi ga ii desu', 'arigatou gozaimasu'],
    },
    hang_yuki_jam: {
      ja: ['ジャズがいいです。', '日本の歌が好きです。', 'ギターが上手ですね。', 'もう一曲お願いします。'],
      en: ['Jazz please', 'I like Japanese songs', 'You are good at the guitar', 'One more song, please'],
      ar: ['الجاز من فضلك', 'أحب الأغاني اليابانية', 'أنتِ بارعة في الغيتار', 'أغنية أخرى من فضلك'],
      romaji: ['jazu ga ii desu', 'nihon no uta ga suki desu', 'jouzu desu ne', 'mou ikkyoku onegaishimasu'],
    },
    hang_kenji_cook: {
      ja: ['ねぎです。', '卵です。', '麺です。', 'ねぎを切って、スープに入れます。', 'もう少し塩がいいです。', 'ごちそうさまでした。'],
      en: ['Green onion', 'An egg', 'Noodles', 'I cut the green onion and put it in the soup', 'It needs a little more salt', 'Gochisosama deshita'],
      ar: ['البصل الأخضر', 'البيض', 'النودلز', 'أقطّع البصل الأخضر وأضعه في الحساء', 'يحتاج إلى قليل من الملح', 'شكرا جزيلا'],
      romaji: ['negi desu', 'tamago desu', 'men desu', 'negi o kitte supu ni iremasu', 'mou sukoshi shio ga ii desu', 'gochisosama deshita'],
    },
    hang_aiko_wagashi: {
      ja: ['みっつ作りましょう。', '丸がいいです。', 'ピンクがいいです。', 'きれいですね。', 'ありがとうございます。'],
      en: ['Let us make three', 'Round, please', 'Pink please', 'It is pretty', 'Thank you very much'],
      ar: ['لنصنع ثلاث قطع', 'دائري من فضلك', 'وردي من فضلك', 'إنها جميلة', 'شكرا جزيلا'],
      romaji: ['mittsu tsukurimashou', 'maru ga ii desu', 'pinku ga ii desu', 'kirei desu ne', 'arigatou gozaimasu'],
    },
    home_mio: {
      ja: ['おじゃまします。', 'いただきます。', 'いい部屋ですね。', 'そのポスターは何ですか？', 'すごい！いい写真ですね。', 'おじゃましました。ありがとうございました。'],
      en: ['Ojamashimasu', 'Itadakimasu', 'This is a nice room', 'What is that poster?', 'Amazing! It is a good photo', 'Thank you for having me'],
      ar: ['عن إذنك', 'إيتاداكيماس', 'إنها غرفة جميلة', 'ما هذا الملصق؟', 'مذهل! إنها صورة جيدة', 'شكرا على الاستضافة'],
      romaji: ['ojamashimasu', 'itadakimasu', 'ii heya desu ne', 'sono posuta wa nan desu ka', 'sugoi', 'ojamashimashita arigatou gozaimashita'],
    },
    home_aiko: {
      ja: ['おじゃまします。', 'いただきます。', 'いい部屋ですね。', 'はい、脱ぎます。', 'はい、見たいです。', 'おじゃましました。ありがとうございました。'],
      en: ['Ojamashimasu', 'Itadakimasu', 'This is a nice room', 'Yes, I will take them off', 'Yes, I would like to see it', 'Thank you for having me'],
      ar: ['عن إذنك', 'إيتاداكيماس', 'إنها غرفة جميلة', 'نعم، سأخلعهما', 'نعم، أريد أن أراها', 'شكرا على الاستضافة'],
      romaji: ['ojamashimasu', 'itadakimasu', 'ii heya desu ne', 'hai nugimasu', 'hai mitai desu', 'ojamashimashita arigatou gozaimashita'],
    },
    home_kenji: {
      ja: ['おじゃまします。', 'いただきます。', 'いい部屋ですね。', 'いただきます！', 'おいしいです！', '二十五歳です。', 'エジプトから来ました。', 'ラーメンが好きです。', 'おじゃましました。ありがとうございました。'],
      en: ['Ojamashimasu', 'Itadakimasu', 'This is a nice room', 'Itadakimasu', 'It is delicious', 'I am 25 years old', 'I am from Egypt', 'I like ramen', 'Thank you for having me'],
      ar: ['عن إذنك', 'إيتاداكيماس', 'إنها غرفة جميلة', 'إيتاداكيماس', 'إنه لذيذ', 'عمري 25 سنة', 'أنا من مصر', 'أحب الرامن', 'شكرا على الاستضافة'],
      romaji: ['ojamashimasu', 'itadakimasu', 'ii heya desu ne', 'itadakimasu', 'oishii desu', 'nijugo sai desu', 'ejiputo kara kimashita', 'ramen ga suki desu', 'ojamashimashita arigatou gozaimashita'],
    },
  };
  for (const id of ALL) {
    for (const [lang, key] of [['Japanese', 'ja'], ['English', 'en'], ['Arabic', 'ar'], ['romaji', 'romaji']] as const) {
      for (const [label, flags] of REGISTERS) {
        it(`${id} typed in ${lang} (${label})`, () => {
          const sc = scenarioById(id)!;
          const s = open(id, key === 'ar' ? 'ar' : 'en', flags);
          const said: string[] = [];
          for (const text of SCRIPTS[id]![key]) {
            if (s.ended) break;
            const r = say(s, text);
            said.push(`${text} -> ${s.nodeId}${r.learner.matched ? '' : ' (not understood)'}`);
            expect(r.learner.matched, `${id}: "${text}" at ${s.nodeId}`).toBe(true);
          }
          expect(s.ended, `${id}: ${said.join(' | ')}`).toBe(true);
          expect([...s.stepsDone].sort(), id).toEqual(sc.steps.map((x) => x.id).sort());
        });
      }
    }
  }
});

describe('hang-outs and home visits: the host contract', () => {
  it('the flag `casual` changes the host\'s register, and no other flag is needed', () => {
    for (const id of ALL.filter((x) => PLAIN_HOSTS.includes(scenarioById(x)!.characterId))) {
      const polite = open(id, 'en', {});
      const plain = open(id, 'en', { casual: true });
      expect(plain.turns[0]!.line.written, id).not.toBe(polite.turns[0]!.line.written);
    }
    for (const id of ['hang_aiko_wagashi', 'home_aiko']) {
      expect(open(id, 'en', { casual: true }).turns[0]!.line.written, id).toBe(open(id, 'en', {}).turns[0]!.line.written);
    }
  });

  it('every pocket line is language an intent of its scenario accepts', () => {
    const problems: string[] = [];
    for (const m of FRIENDS_META) {
      const sc = scenarioById(m.id)!;
      for (const pid of m.pocket ?? []) {
        const line = FRIENDS_POCKETS[pid]!.line;
        const text = tokenize(line.ja, LEXICON).tokens.map((t) => t.s).join('');
        const hit = Object.keys(sc.nodes).some((nodeId) => {
          if (sc.nodes[nodeId]!.end) return false;
          const s = open(m.id, 'en', {}, { startNode: nodeId });
          return s.submit({ text, mode: 'typed_ja' }).learner.matched;
        });
        if (!hit) problems.push(`${m.id}/${pid}: "${text}" is understood at no node`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('every phrasebook entry of the module has English or Arabic, a defined slot and displayable Japanese', () => {
    const errors: string[] = [];
    for (const p of SOCIAL_FRIENDS_PHRASES) {
      if (!p.en.length && !p.ar.length) errors.push(`${p.id}: empty`);
      if (p.slot && !SLOTS[p.slot]) errors.push(`${p.id}: unknown slot ${p.slot}`);
      const { missing } = tokenize(p.ja.replace(/\{\w+\}/g, ''), LEXICON);
      if (missing.length) errors.push(`${p.id}: ${missing.join(' ')}`);
    }
    expect(errors).toEqual([]);
    expect(new Set(PHRASEBOOK.map((p) => p.id)).size).toBe(PHRASEBOOK.length);
  });

  it('defines its slots in the module and nowhere else, with keys in all three scripts', () => {
    for (const [name, opts] of Object.entries(SOCIAL_FRIENDS_SLOTS)) {
      expect(SLOTS[name], name).toBe(opts);
      for (const o of opts) for (const l of ['ja', 'en', 'ar'] as const) expect(o.keys[l].length, `${name}/${o.id}`).toBeGreaterThan(0);
    }
  });
});

describe('hang-outs and home visits: what finishing them pays', () => {
  const at = (friend: string, hearts: number, dayIndex = 12): GameState => {
    const s = makeState(dayIndex);
    return { ...s, friends: { [friend]: { ...emptyFriend(dayIndex), ap: BALANCE.ap.thresholds[hearts - 1]!, met: true } } };
  };
  const finish = (state: GameState, id: string, extra: Partial<Parameters<typeof makeFacts>[0]> = {}) => {
    const sc = scenarioById(id)!;
    const facts = makeFacts({ scenarioId: id, characterId: sc.characterId, sessionId: `s-${id}-${state.clock.dayIndex}`, ind: 4, ass: 0, done: sc.steps.length, total: sc.steps.length, ...extra });
    return reduce(state, { t: 'conversation_done', facts } as InputEvent, ctxOf(JP_PACK));
  };

  it('a hang-out gives the AP of a hang-out and counts it; the keepsake or the wagashi comes once', () => {
    const give: Record<string, { keepsake?: string; item?: string }> = {
      hang_mio_photo: { keepsake: 'photo_mio' },
      hang_yuki_jam: { keepsake: 'stamp_card' },
      hang_kenji_cook: { keepsake: 'kenji_recipe' },
      hang_aiko_wagashi: { item: 'g_wagashi' },
    };
    for (const id of HANGS) {
      const friend = scenarioById(id)!.characterId;
      const s0 = at(friend, 3, 20);
      const r = finish(s0, id);
      expect(r.state.stats.hangouts[friend], id).toBe(1);
      expect(r.state.friends[friend]!.ap - s0.friends[friend]!.ap, id).toBeGreaterThanOrEqual(BALANCE.ap.hangout.low);
      if (give[id]!.keepsake) expect(r.state.keepsakes, id).toContain(give[id]!.keepsake);
      if (give[id]!.item) expect(r.state.owned[give[id]!.item!]?.qty, id).toBe(1);
      // once: the second completion (three days later) neither repeats the keepsake nor grants a second wagashi
      const later = { ...r.state, clock: { ...r.state.clock, dayIndex: r.state.clock.dayIndex + 3 } };
      const again = finish(later, id, { sessionId: 'again' });
      expect(again.state.stats.hangouts[friend], id).toBe(2);
      expect(again.state.keepsakes.filter((k) => k === give[id]!.keepsake).length, id).toBeLessThanOrEqual(1);
      if (give[id]!.item) expect(again.state.owned[give[id]!.item!]?.qty, id).toBe(1);
    }
  });

  it('a hang-out is one per three days and needs three hearts', () => {
    const s0 = at('mio', 3, 20);
    const r = finish(s0, 'hang_mio_photo');
    const sameDay = finish(r.state, 'hang_mio_photo', { sessionId: 'second' });
    expect(sameDay.state.friends.mio!.ap).toBe(r.state.friends.mio!.ap);
    const low = finish(at('mio', 2, 20), 'hang_mio_photo');
    expect(low.state.stats.hangouts.mio ?? 0).toBe(0);
    expect(heartsForAp(low.state.friends.mio!.ap)).toBeLessThanOrEqual(2);
  });

  it('a home visit gives +25 AP, files `home:<friend>`, hands over its keepsake once and raises the room flag for Aiko only', () => {
    const keep: Record<string, string> = { home_mio: 'photo_printed', home_aiko: 'tea_cup', home_kenji: 'hina_drawing' };
    for (const id of HOMES_IDS) {
      const friend = scenarioById(id)!.characterId;
      const s0 = at(friend, 4, 30);
      const r = finish(s0, id);
      expect(r.state.friends[friend]!.ap - s0.friends[friend]!.ap, id).toBeGreaterThanOrEqual(BALANCE.ap.hangout.good);
      expect(r.state.stats.visits, id).toContain(`home:${friend}`);
      expect(r.state.keepsakes, id).toContain(keep[id]);
      expect(r.state.chapter.flags.includes('aiko_room_shown'), id).toBe(id === 'home_aiko');
      expect(Object.keys(r.state.culture), id).toContain('cc_shoesoff');
      const again = finish({ ...r.state, clock: { ...r.state.clock, dayIndex: r.state.clock.dayIndex + 3 } }, id, { sessionId: 'again' });
      expect(again.state.keepsakes.filter((k) => k === keep[id]).length, id).toBe(1);
    }
  });

  it('an abandoned visit or hang-out pays nothing and files nothing', () => {
    for (const id of ['home_mio', 'hang_kenji_cook']) {
      const friend = scenarioById(id)!.characterId;
      const s0 = at(friend, 4, 30);
      const r = finish(s0, id, { abandoned: true, done: 0 });
      expect(r.state.keepsakes).toEqual([]);
      expect(r.state.stats.visits).toEqual([]);
    }
  });

  it('the objective engine counts a hang-out for the hearts: the pack now has a hang-out scenario for the `hangout` predicate', () => {
    expect(JP_PACK.scenarioMeta.filter((m) => m.kind === 'hangout').map((m) => m.friendId).sort()).toEqual(['aiko', 'kenji', 'mio', 'yuki']);
    // the housewarming (home_own_guest) is a home too, but its guest is whichever friend the player invites: no fixed friend
    expect(JP_PACK.scenarioMeta.filter((m) => m.kind === 'home' && m.id !== 'home_own_guest').map((m) => m.friendId).sort()).toEqual(['aiko', 'kenji', 'mio']);
  });
});

describe('homes and hang-outs: the tables the app and the world read', () => {
  it('HOMES has the stage, door, host, six props and keepsake of the design (§8.8, §6.4)', () => {
    expect(Object.keys(HOMES)).toEqual(HOMES_IDS);
    expect(HOMES.home_mio).toMatchObject({ stage: 'mio_1r', door: 'door:mio', host: 'mio', hearts: 4, props: ['kutsu', 'tsukue', 'kamera', 'poster', 'hondana', 'mado'], keepsake: 'photo_printed' });
    expect(HOMES.home_aiko).toMatchObject({ stage: 'aiko_tatami', door: 'door:aiko', host: 'aiko', hearts: 4, props: ['tatami', 'kotatsu', 'zabuton', 'shoji', 'kyusu', 'hana'], keepsake: 'tea_cup' });
    expect(HOMES.home_kenji).toMatchObject({ stage: 'kenji_flat', door: 'door:kenji', host: 'kenji', hearts: 4, props: ['chabudai', 'suihanki', 'shashin', 'yakyu', 'e', 'zabuton'], keepsake: 'hina_drawing' });
    for (const [id, h] of Object.entries(HOMES)) {
      expect(h.scenarioId, id).toBe(id);
      expect(h.visitKey, id).toBe(`home:${h.host}`);
      expect(scenarioById(id)!.characterId, id).toBe(h.host);
      expect(KEEPSAKES[h.keepsake], id).toBeTruthy();
      expect(FRIENDS_META.find((m) => m.id === id)!.effects, id).toContainEqual({ t: 'keepsake', id: h.keepsake });
      const def = JP_PACK.friends.find((f) => f.id === h.host)!;
      expect(def.home, id).toEqual({ stage: h.stage, door: h.door });
      expect(homeOfStage(h.stage), id).toBe(h);
      expect(homeOfDoor(h.door), id).toBe(h);
      expect(homeOfFriend(h.host), id).toBe(h);
      expect(CHARACTERS.find((c) => c.id === h.host)!.locationId, id).toBeTruthy();
    }
    expect(homeOfStage('dorm')).toBeUndefined();
    expect(homeOfDoor('door:dorm')).toBeUndefined();
  });

  it('every prop id has a word card: a lexicon surface with a reading (when it has kanji), English and Arabic', () => {
    const ids = Object.values(HOMES).flatMap((h) => h.props);
    expect(new Set(Object.keys(PROP_WORDS))).toEqual(new Set(ids));
    expect(Object.keys(PROP_WORDS).sort()).toEqual(['chabudai', 'e', 'hana', 'hondana', 'kamera', 'kotatsu', 'kutsu', 'kyusu', 'mado', 'poster', 'shashin', 'shoji', 'suihanki', 'tatami', 'tsukue', 'yakyu', 'zabuton']);
    const readings: Record<string, string> = { kutsu: 'くつ', tsukue: 'つくえ', hondana: 'ほんだな', mado: 'まど', tatami: 'たたみ', shoji: 'しょうじ', kyusu: 'きゅうす', hana: 'はな', chabudai: 'ちゃぶだい', suihanki: 'すいはんき', shashin: 'しゃしん', yakyu: 'やきゅう', e: 'え' };
    for (const [prop, surface] of Object.entries(PROP_WORDS)) {
      const e = LEXICON.get(surface);
      expect(e, `${prop} -> ${surface}`).toBeTruthy();
      expect(e!.en.trim() && e!.ar.trim(), prop).toBeTruthy();
      if (readings[prop]) expect(e!.r, prop).toBe(readings[prop]);
    }
    // the words of the `home` tag the quests count are among them
    for (const w of ['靴', '畳']) expect(Object.values(PROP_WORDS)).toContain(w);
    // the two prop ids the dorm and the flat would share (zabuton) are one word
    expect(HOMES.home_aiko!.props).toContain('zabuton');
    expect(HOMES.home_kenji!.props).toContain('zabuton');
  });

  it('GENKAN gives each host a gentle correction for the wrong order, the slippers and the invitation, all displayable with EN and AR', () => {
    expect(Object.keys(GENKAN).sort()).toEqual(['aiko', 'kenji', 'mio']);
    const errors: string[] = [];
    for (const [host, g] of Object.entries(GENKAN)) {
      for (const [k, v] of Object.entries(g)) {
        for (const [reg, line] of Object.entries(v)) {
          const { missing } = tokenize((line as Line).ja, LEXICON);
          if (missing.length) errors.push(`${host}/${k}/${reg}: ${missing.join(' ')}`);
          if (!(line as Line).en || !(line as Line).ar) errors.push(`${host}/${k}/${reg}: EN/AR`);
        }
      }
    }
    expect(errors).toEqual([]);
    expect(GENKAN.mio!.wrong.polite.ja.replace(/\|/g, '')).toBe('あっ、靴を脱いでください！');
    expect(GENKAN.kenji!.wrong.polite.ja.replace(/\|/g, '')).toBe('あっ、靴を脱いでください！');
    expect(GENKAN.aiko!.wrong.casual).toBe(GENKAN.aiko!.wrong.polite);
    expect(tokenize(DOOR_LOCKED.ja, LEXICON).missing).toEqual([]);
    expect(DOOR_LOCKED.ja.replace(/\|/g, '')).toBe('まだ入れません。');
  });

  it('HANGOUTS matches the scenarios, the interaction rows and the rewards of the metadata', () => {
    expect(Object.keys(HANGOUTS)).toEqual(HANGS);
    for (const [id, h] of Object.entries(HANGOUTS)) {
      const meta = FRIENDS_META.find((m) => m.id === id)!;
      expect(h.friend, id).toBe(meta.friendId);
      expect(h.place, id).toBe(meta.place);
      expect(h.hearts, id).toBe(meta.heart);
      expect(JP_PACK.interactions[h.friend]!.some((r) => r.id === h.interactionId && r.scenarioId === id), id).toBe(true);
      expect(meta.effects, id).toContainEqual(h.reward.kind === 'keepsake' ? { t: 'keepsake', id: h.reward.id } : { t: 'item', id: h.reward.id, qty: h.reward.qty });
      if (h.reward.kind === 'keepsake') expect(KEEPSAKES[h.reward.id], id).toBeTruthy();
      else expect(JP_PACK.items.some((i) => i.id === (h.reward as { id: string }).id), id).toBe(true);
    }
  });

  it('every keepsake has a Japanese, English and Arabic name', () => {
    for (const id of ['photo_mio', 'stamp_card', 'kenji_recipe', 'photo_printed', 'tea_cup', 'hina_drawing']) {
      expect(KEEPSAKES[id]?.ja && KEEPSAKES[id]?.en && KEEPSAKES[id]?.ar, id).toBeTruthy();
      expect(JP_PACK.keepsakes?.[id], id).toBeTruthy();
    }
  });

  it('the app strings of the module have the same keys and placeholders in English and Arabic', () => {
    expect(Object.keys(stringsAr).sort()).toEqual(Object.keys(stringsEn).sort());
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const k of Object.keys(stringsEn) as Array<keyof typeof stringsEn>) {
      expect(ph(stringsAr[k]), k).toBe(ph(stringsEn[k]));
      expect(/[؀-ۿ]/.test(stringsAr[k]), k).toBe(true);
      expect(k.startsWith('fv.'), k).toBe(true);
    }
    for (const h of Object.values(HOMES)) expect(`fv.room.${h.stage}` in stringsEn, h.stage).toBe(true);
  });
});
