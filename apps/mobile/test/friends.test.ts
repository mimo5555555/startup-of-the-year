// Friends, small talk and gifts as the app wires them (agent 4A): the topic picker, the flags and variables of a small talk and a gift
// hand-over, the facts the host files, the Friends screen's rows and "Next at ♥n" lines, and the whole Chapter 3 path through the real
// reducer: small talk until Mio has 2 hearts, a gift handed over by tapping suggestions, a second friend at 2 hearts, Mio's heart beat.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, scenarioById, slotOption } from '@lw/content';
import { ConversationSession } from '@lw/engine';
import {
  BALANCE,
  chapterDef,
  createGameState,
  emptyFriend,
  evalPred,
  grantItem,
  heartsForAp,
  reduce,
  type ConversationFacts,
  type DerivedEvent,
  type GameState,
  type GameView,
  type InputEvent,
  type ReduceResult,
} from '@lw/game';
import { createConvoGame } from '../src/game/convoHooks';
import {
  CALLBACK_KEYS,
  TOPIC_NO_REPEAT_DAYS,
  canMessage,
  completeFriendFacts,
  dueFact,
  friendOfRequest,
  friendRows,
  giftChoices,
  giftEventOf,
  handOverOption,
  heartEventOfBeat,
  isCasual,
  pendingHeartBeats,
  pickCallback,
  pickTopic,
  planFriendConvo,
  smalltalkOf,
  talkStartsAtPrepare,
  topicsOf,
  unlockLines,
  type FriendPlan,
} from '../src/game/friendsLogic';
import { en, ar } from '../src/strings/social';

const NOW = new Date(2030, 0, 15, 12).getTime();
const VIEW: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
};
const def = (id: string) => JP_PACK.friends.find((f) => f.id === id)!;
const known = (id: string) => !!JP_PACK.beats[id];

/** a game in Chapter 3 (the Friends screen is open), with `patch` applied */
function game(patch: (s: GameState) => GameState = (s) => s): GameState {
  const s0 = createGameState(JP_PACK, NOW);
  return patch({ ...s0, chapter: { ...s0.chapter, n: 3, done: {} } });
}
const withAp = (id: string, ap: number, more: Partial<GameState['friends'][string]> = {}) => (s: GameState): GameState => ({
  ...s,
  friends: { ...s.friends, [id]: { ...(s.friends[id] ?? emptyFriend(s.clock.dayIndex)), ap, met: true, ...more } },
});
const onDay = (day: number) => (s: GameState): GameState => ({ ...s, clock: { ...s.clock, dayIndex: day, activeDays: Math.max(s.clock.activeDays, day + 1) } });
const compose = (...fs: Array<(s: GameState) => GameState>) => (s: GameState): GameState => fs.reduce((x, f) => f(x), s);
const nodeIds = (scenarioId: string) => Object.keys(scenarioById(scenarioId)!.nodes);
const interests = (id: string) => CHARACTERS.find((c) => c.id === id)!.interests;
const plan = (s: GameState, scenarioId: string, characterId: string, o: { startNode?: string; itemId?: string; rng?: () => number } = {}): FriendPlan | null =>
  planFriendConvo(JP_PACK, s, { scenarioId, characterId, startNode: o.startNode, itemId: o.itemId }, { nodeIds: nodeIds(scenarioId), interests: interests(characterId), rng: o.rng ?? (() => 0.3) });

describe('friendOfRequest', () => {
  it('names the friend of a small talk or a gift hand-over, and nobody for any other scenario', () => {
    expect(friendOfRequest(JP_PACK, { scenarioId: 'smalltalk_mio', characterId: 'mio' })).toBe('mio');
    expect(friendOfRequest(JP_PACK, { scenarioId: 'give_gift', characterId: 'yuki' })).toBe('yuki');
    expect(friendOfRequest(JP_PACK, { scenarioId: 'give_gift', characterId: 'aoi' })).toBeNull();
    expect(friendOfRequest(JP_PACK, { scenarioId: 'konbini', characterId: 'tanaka' })).toBeNull();
    expect(friendOfRequest(JP_PACK, { scenarioId: 'smalltalk_nobody', characterId: 'mio' })).toBeNull();
  });
});

describe('the topic picker (§8.3a)', () => {
  const topics = topicsOf(nodeIds('smalltalk_yuki'));
  const f0 = emptyFriend(0);

  it('finds the 13 topics of a friend (12 shared, 1 only theirs)', () => {
    expect(topics).toHaveLength(13);
    expect(topics).toContain('yuki_cat');
    expect(topics).not.toContain('mio_photo');
  });

  it('never offers a topic used in the last 5 days, and offers it again after', () => {
    const used = Object.fromEntries(topics.slice(0, 12).map((t) => [t, 10]));
    const f = { ...f0, topicDay: used };
    for (let i = 0; i < 20; i++) expect(pickTopic(topics, f, 12, interests('yuki'), 'yuki', () => i / 20)).toBe(topics[12]);
    const back = pickTopic(topics, f, 10 + TOPIC_NO_REPEAT_DAYS, interests('yuki'), 'yuki', () => 0);
    expect(back).toBeDefined();
  });

  it('when every topic was used lately, offers the one used longest ago', () => {
    const f = { ...f0, topicDay: Object.fromEntries(topics.map((t, i) => [t, 100 + i])) };
    expect(pickTopic(topics, f, 101, interests('yuki'), 'yuki', () => 0.99)).toBe(topics[0]);
  });

  it('prefers the friend\'s own topic and the topics of their interests', () => {
    let own = 0;
    let music = 0;
    let town = 0;
    for (let i = 0; i < 1000; i++) {
      const t = pickTopic(topics, f0, 50, interests('yuki'), 'yuki', () => (i + 0.5) / 1000);
      if (t === 'yuki_cat') own++;
      if (t === 'music') music++;
      if (t === 'town') town++;
    }
    expect(own).toBeGreaterThan(music);
    expect(music).toBeGreaterThan(town);
    expect(town).toBeGreaterThan(0);
  });

  it('is deterministic in the random number and returns nothing without topics', () => {
    expect(pickTopic(topics, f0, 5, [], 'yuki', () => 0.42)).toBe(pickTopic(topics, f0, 5, [], 'yuki', () => 0.42));
    expect(pickTopic([], f0, 5, [], 'yuki', () => 0.1)).toBeUndefined();
  });
});

describe('profile facts and callbacks', () => {
  it('reveals the first fact the friend has the heart for and the player has not learned', () => {
    const mio = def('mio');
    const f = emptyFriend(0);
    expect(dueFact(mio, f, 0)).toBeUndefined();
    expect(dueFact(mio, f, 1)).toBe('likes_anime');
    expect(dueFact(mio, { ...f, learned: ['likes_anime'] }, 1)).toBeUndefined();
    expect(dueFact(mio, { ...f, learned: ['likes_anime'] }, 2)).toBe('photo_sakura');
    expect(dueFact(mio, { ...f, learned: mio.facts }, 5)).toBeUndefined();
  });

  it('quotes a remembered fact from 2 hearts, with the slot word as the variable; never one already quoted today', () => {
    const f = emptyFriend(0);
    expect(pickCallback({ ...f, facts: { hobby: 'anime' } }, 5, 1)).toBeUndefined();
    const cb = pickCallback({ ...f, facts: { hobby: 'anime', favFood: 'ramen' } }, 5, 2)!;
    expect(cb.fact).toBe('favFood');
    expect(cb.vars.food?.ja).toBe(slotOption('chatfood', 'ramen')!.ja);
    expect(pickCallback({ ...f, facts: { hobby: 'anime' } }, 5, 2)!.vars.hobby?.ja).toBe(slotOption('hobby', 'anime')!.ja);
    expect(pickCallback({ ...f, facts: { hobby: 'anime' }, callbacks: { hobby: 5 } }, 5, 3)).toBeUndefined();
    // the one quoted longest ago goes first
    expect(pickCallback({ ...f, facts: { hobby: 'anime', favFood: 'ramen' }, callbacks: { hobby: 3, favFood: 4 } }, 5, 3)!.fact).toBe('hobby');
    // a fact the scenario has no line for (name, country) or a slot word that is not in the list is not quoted
    expect(pickCallback({ ...f, facts: { name: 'Sam', country: 'Egypt', hobby: 'not-a-hobby' } }, 5, 3)).toBeUndefined();
    expect(Object.keys(CALLBACK_KEYS).sort()).toEqual(['dream', 'favFood', 'hobby', 'purchase:phone']);
  });
});

describe('the flags of a small talk (the host contract of scenarios-social.ts)', () => {
  it('starts at a topic node of the scenario and records the topic', () => {
    const p = plan(game(), 'smalltalk_mio', 'mio')!;
    expect(p.kind).toBe('talk');
    expect(p.startNode).toBe(`g_${p.topic}`);
    expect(nodeIds('smalltalk_mio')).toContain(p.startNode);
  });

  it('keeps the node the request named and takes its topic from it', () => {
    const p = plan(game(), 'smalltalk_mio', 'mio', { startNode: 'g_food' })!;
    expect(p.topic).toBe('food');
    expect(p.startNode).toBeUndefined();
  });

  it('is polite and reveals nothing for a stranger; reveals the first fact at 1 heart', () => {
    const s0 = plan(game(), 'smalltalk_mio', 'mio')!;
    expect(s0.casual).toBe(false);
    expect(Object.keys(s0.flags)).toEqual([]);
    const s1 = plan(game(withAp('mio', 30)), 'smalltalk_mio', 'mio')!;
    expect(s1.flags).toEqual({ rev_likes_anime: true });
    expect(s1.reveal).toBe('likes_anime');
  });

  it('switches Mio to plain form at 2 hearts, Yuki at 3, never Tanaka; the casual flag does it for anyone', () => {
    const at = (id: string, ap: number) => isCasual(JP_PACK, game(withAp(id, ap)), id);
    expect([at('mio', 79), at('mio', 80)]).toEqual([false, true]);
    expect([at('yuki', 80), at('yuki', 150)]).toEqual([false, true]);
    expect([at('kenji', 149), at('kenji', 150)]).toEqual([false, true]);
    expect([at('tanaka', 350), at('sato', 350), at('hanako', 350)]).toEqual([false, false, false]);
    expect(isCasual(JP_PACK, game(withAp('tanaka', 0, { flags: ['casual'] })), 'tanaka')).toBe(true);
    const p = plan(game(withAp('mio', 80, { learned: ['likes_anime'] })), 'smalltalk_mio', 'mio')!;
    expect(p.flags).toMatchObject({ casual: true, rev_photo_sakura: true, revc_photo_sakura: true });
  });

  it('greets with a remembered fact from 2 hearts (cb_ and cbc_ flags, the variable) and not before', () => {
    const facts = { hobby: 'anime' };
    const p2 = plan(game(withAp('mio', 80, { facts, learned: ['likes_anime', 'photo_sakura'] })), 'smalltalk_mio', 'mio')!;
    expect(p2.flags).toMatchObject({ casual: true, cb_hobby: true, cbc_hobby: true });
    expect(p2.vars.hobby).toEqual({ ja: slotOption('hobby', 'anime')!.ja, gloss: slotOption('hobby', 'anime')!.gloss });
    expect(p2.callback).toBe('hobby');
    const p1 = plan(game(withAp('mio', 30, { facts })), 'smalltalk_mio', 'mio')!;
    expect(Object.keys(p1.flags).some((k) => k.startsWith('cb'))).toBe(false);
  });

  it('is null for a scenario that is not a friend conversation', () => {
    expect(plan(game(), 'konbini', 'tanaka')).toBeNull();
  });
});

describe('the gift hand-over', () => {
  it('names every present the shops sell in the hand-over words', () => {
    const sold = [...JP_PACK.items.filter((i) => i.cat === 'gift').map((i) => i.id), ...JP_PACK.menu.filter((m) => ['coffee', 'greenTea', 'cake', 'onigiri', 'bento'].includes(m.option) && m.shop !== 'vending').map((m) => m.id)];
    expect(sold.length).toBeGreaterThanOrEqual(10);
    for (const id of sold) expect(handOverOption(JP_PACK, id), id).toBeDefined();
    // goods nobody can name in the hand-over (no slot word) are not offered
    for (const id of ['konbini:water', 'konbini:milk', 'cafe:latte', 'vending:v_tea', 'phone_used']) expect(handOverOption(JP_PACK, id), id).toBeUndefined();
    expect(handOverOption(JP_PACK, 'cafe:cake')!.id).toBe('cake');
    expect(handOverOption(JP_PACK, 'g_game_card')!.id).toBe('gameCard');
  });

  it('lists what the player owns and can give, with the count, catalog presents first', () => {
    let s = game();
    expect(giftChoices(JP_PACK, s)).toEqual([]);
    for (const id of ['konbini:cake', 'g_manga', 'konbini:water', 'ic_card']) s = grantItem(s, JP_PACK, id, id === 'konbini:cake' ? 2 : 1, 'd0');
    const list = giftChoices(JP_PACK, s);
    expect(list.map((c) => [c.itemId, c.qty])).toEqual([['g_manga', 1], ['konbini:cake', 2]]);
    expect(list[0]!.shop).toBe('konbini');
  });

  it('sets the reaction flags (and the plain ones for a plain-speaking friend) and the gift variable', () => {
    const loved = plan(game(), 'give_gift', 'mio', { itemId: 'g_manga' })!;
    expect(loved.flags).toEqual({ gift_loved: true });
    expect(loved.gift).toEqual({ itemId: 'g_manga', reaction: 'loved' });
    expect(loved.vars.gift?.ja).toBe(slotOption('giftItem', 'manga')!.ja);
    const plain = plan(game(withAp('mio', 80)), 'give_gift', 'mio', { itemId: 'konbini:cake' })!;
    expect(plain.flags).toEqual({ casual: true, gift_loved: true, giftc_loved: true });
    expect(plan(game(), 'give_gift', 'mio', { itemId: 'g_choco' })!.flags).toEqual({ gift_liked: true });
    expect(plan(game(), 'give_gift', 'mio', { itemId: 'konbini:coffee' })!.flags).toEqual({ gift_disliked: true });
  });

  it('raises the humour line only where it fits: Tanaka\'s shelf food, Yuki\'s coffee', () => {
    expect(plan(game(), 'give_gift', 'tanaka', { itemId: 'konbini:onigiri' })!.flags).toEqual({ gift_disliked: true, dl_tanaka: true });
    expect(plan(game(), 'give_gift', 'yuki', { itemId: 'konbini:coffee' })!.flags).toEqual({ gift_disliked: true, dl_yuki: true });
    expect(plan(game(), 'give_gift', 'yuki', { itemId: 'g_game_card' })!.flags).toEqual({ gift_disliked: true });
    expect(plan(game(withAp('yuki', 150)), 'give_gift', 'yuki', { itemId: 'konbini:coffee' })!.flags).toMatchObject({ dlc_yuki: true, giftc_disliked: true });
  });

  it('plans nothing for an item the hand-over cannot name', () => {
    expect(plan(game(), 'give_gift', 'mio', { itemId: 'konbini:water' })).toBeNull();
    expect(plan(game(), 'give_gift', 'mio')).toBeNull();
  });

  it('makes the gift event from the hand-over turn: named and unaided, assisted, bare, or nothing handed over', () => {
    const p = plan(game(), 'give_gift', 'mio', { itemId: 'g_manga' })!;
    const base = { sessionId: 's1', turns: [] } as unknown as ConversationFacts;
    const turn = (intentId: string, cls: 'I' | 'S', hintOpened = false) => ({ intentId, cls, hintOpened, substantive: true, stepIds: [], contentTokens: 2, norm: '', newWords: [], credit: 1, id: 1 });
    expect(giftEventOf(p, base)).toBeNull();
    expect(giftEventOf(p, { ...base, turns: [turn('give_item', 'I')] as never })).toEqual({ t: 'gift_given', friendId: 'mio', itemId: 'g_manga', sessionId: 's1', assistedHandover: false });
    expect(giftEventOf(p, { ...base, turns: [turn('give_item', 'S')] as never })).toMatchObject({ assistedHandover: true });
    expect(giftEventOf(p, { ...base, turns: [turn('give_food', 'I', true)] as never })).toMatchObject({ assistedHandover: true });
    expect(giftEventOf(p, { ...base, turns: [turn('give_bare', 'I')] as never })).toMatchObject({ bare: true });
    const talk = plan(game(), 'smalltalk_mio', 'mio')!;
    expect(giftEventOf(talk, { ...base, turns: [turn('give_item', 'I')] as never })).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The conversation host over the real reducer
// ---------------------------------------------------------------------------------------------------------------

interface Played {
  state: GameState;
  derived: DerivedEvent[];
  facts: ConversationFacts;
  session: ConversationSession;
  events: InputEvent[];
}

/** What Conversation.tsx does for a friend conversation, without a screen: plan, hooks, taps, facts, the gift, then `conversation_done`. */
function play(start: GameState, scenarioId: string, characterId: string, o: { itemId?: string; startNode?: string; pick?: (s: ConversationSession) => void } = {}): Played {
  let state = start;
  const events: InputEvent[] = [];
  const commit = (ev: InputEvent): ReduceResult => {
    events.push(ev);
    const r = reduce(state, ev, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 });
    state = r.state;
    return r;
  };
  const sc = scenarioById(scenarioId)!;
  const character = CHARACTERS.find((c) => c.id === characterId)!;
  const friend = plan(start, scenarioId, characterId, { itemId: o.itemId, startNode: o.startNode });
  const g = createConvoGame({ pack: JP_PACK, scenarioId, sessionId: `s_${scenarioId}_${start.clock.dayIndex}`, state: () => state, view: () => VIEW, commit, friend });
  const session = new ConversationSession({
    scenario: sc,
    character,
    l1: 'en',
    profileName: 'Sam',
    topics: [],
    sessionId: `s_${scenarioId}_${start.clock.dayIndex}`,
    game: g.hooks,
    flags: g.flags,
    startNode: o.startNode ?? friend?.startNode,
    recalled: g.recalled,
    policy: BALANCE,
  });
  session.start();
  if (o.pick) o.pick(session);
  else {
    let guard = 0;
    while (!session.ended && guard++ < 30) session.pickSuggestion(0);
  }
  const facts0 = session.facts({ mode: 'guided', prepared: false });
  const facts = g.friend ? completeFriendFacts(g.friend, facts0, session.stepsDone) : facts0;
  const derived: DerivedEvent[] = [];
  const gift = g.friend ? giftEventOf(g.friend, facts) : null;
  if (gift) derived.push(...commit(gift).derived);
  derived.push(...commit({ t: 'conversation_done', facts }).derived);
  return { state, derived, facts, session, events };
}

describe('a small talk, tapping suggestions only', () => {
  it('completes, counts one talk for the day with the topic recorded, and meets the friend', () => {
    const r = play(game(), 'smalltalk_mio', 'mio');
    expect(r.session.ended).toBe(true);
    expect(r.facts.topic).toBeDefined();
    const f = r.state.friends.mio!;
    expect(f.met).toBe(true);
    expect(f.talkDay).toBe(0);
    expect(f.topicDay[r.facts.topic!]).toBe(0);
    expect(f.ap).toBeGreaterThanOrEqual(BALANCE.ap.met + BALANCE.ap.talk.base);
    expect(f.ap).toBeLessThanOrEqual(BALANCE.ap.met + BALANCE.ap.talk.cap);
  });

  it('every friend\'s small talk is completable the same way, at every start the picker can choose', () => {
    for (const id of ['mio', 'yuki', 'tanaka', 'kenji', 'sato', 'hanako']) {
      for (const topic of topicsOf(nodeIds(smalltalkOf(id)))) {
        const r = play(game(), smalltalkOf(id), id, { startNode: `g_${topic}` });
        expect(r.session.ended, `${id}/${topic}`).toBe(true);
        expect(r.facts.topic, `${id}/${topic}`).toBe(topic);
        expect(r.state.friends[id]!.ap, `${id}/${topic}`).toBeGreaterThan(0);
      }
    }
  });

  it('reveals the due profile fact in the follow node and files it on the friend card', () => {
    const r = play(game(withAp('mio', 30, { talkDay: -1 })), 'smalltalk_mio', 'mio');
    expect(r.facts.revealed).toEqual(['likes_anime']);
    expect(r.state.friends.mio!.learned).toEqual(['likes_anime']);
    // the sentence the friend said is the one on the card
    const said = r.session.turns.filter((t) => t.speaker === 'character').map((t) => t.line.written).join('');
    expect(said).toContain('アニメ');
  });

  it('reveals nothing for a friend who has not reached 1 heart, and one fact at a time', () => {
    const r0 = play(game(), 'smalltalk_yuki', 'yuki');
    expect(r0.facts.revealed).toBeUndefined();
    expect(r0.state.friends.yuki!.learned).toEqual([]);
    const r1 = play(game(withAp('yuki', 80)), 'smalltalk_yuki', 'yuki');
    expect(r1.state.friends.yuki!.learned).toEqual(['guitar']);
    const r2 = play(onDay(1)(r1.state), 'smalltalk_yuki', 'yuki');
    expect(r2.state.friends.yuki!.learned).toEqual(['guitar', 'cat']);
  });

  it('counts the callback when the player answers the greeting that quotes a remembered fact (+3 AP inside the talk)', () => {
    const s = game(withAp('mio', 80, { facts: { hobby: 'anime' }, learned: ['likes_anime', 'photo_sakura'] }));
    // the greeting's chips: "Hello!" (not an answer), "Yes, I am well." and "Yes, very good." (answers); the player taps the second
    const r = play(s, 'smalltalk_mio', 'mio', {
      pick: (sess) => {
        sess.pickSuggestion(1);
        let guard = 0;
        while (!sess.ended && guard++ < 30) sess.pickSuggestion(0);
      },
    });
    expect(r.facts.callbacks).toEqual(['hobby']);
    expect(r.state.friends.mio!.callbacks.hobby).toBe(0);
    const greeting = r.session.turns.find((t) => t.speaker === 'character')!.line.written;
    expect(greeting).toContain('アニメ');
  });

  it('does not count a callback the player never answered (abandoned right after the greeting)', () => {
    const s = game(withAp('mio', 80, { facts: { hobby: 'anime' }, learned: ['likes_anime', 'photo_sakura'] }));
    const r = play(s, 'smalltalk_mio', 'mio', { pick: () => undefined });
    expect(r.facts.callbacks).toBeUndefined();
    expect(r.state.friends.mio!.ap).toBe(80);
  });

  it('plays in plain form for Mio from 2 hearts', () => {
    const polite = play(game(), 'smalltalk_mio', 'mio', { startNode: 'g_weather' });
    const plain = play(game(withAp('mio', 80, { learned: ['likes_anime', 'photo_sakura'] })), 'smalltalk_mio', 'mio', { startNode: 'g_weather' });
    const first = (r: Played) => r.session.turns.find((t) => t.speaker === 'character')!.line.written;
    expect(first(polite)).toContain('さん');
    expect(first(plain)).not.toContain('さん');
  });
});

describe('a gift, tapping suggestions only', () => {
  const owned = (id: string, qty = 1) => (s: GameState) => grantItem(s, JP_PACK, id, qty, 'd0');

  it('hands over a loved present: the item goes, the friend reacts, the gift counts', () => {
    const s = game(compose(withAp('mio', 35, { talkDay: 0 }), owned('g_manga')));
    const r = play(s, 'give_gift', 'mio', { itemId: 'g_manga' });
    expect(r.session.ended).toBe(true);
    expect(r.state.owned.g_manga).toBeUndefined();
    expect(r.state.stats.gifts).toEqual({ n: 1, liked: 1, loved: 1 });
    const ev = r.derived.find((d) => d.t === 'gift_reacted');
    expect(ev).toMatchObject({ friendId: 'mio', itemId: 'g_manga', reaction: 'loved' });
    expect(r.state.friends.mio!.ap).toBeGreaterThan(35);
    // the friend named the reaction in words
    expect(r.session.turns.filter((t) => t.speaker === 'character').map((t) => t.line.written).join('')).toContain('うれしい');
    // a tapped hand-over is assisted: half the affinity (§8.5)
    expect((ev as { ap: number }).ap).toBe(Math.round(Math.min(BALANCE.ap.giftTiers[1]!.ap * BALANCE.ap.giftTaste.loved, 20) * BALANCE.ap.giftBare));
  });

  it('names the item in the chips, whatever it is', () => {
    for (const id of ['g_choco', 'g_manga', 'g_game_card', 'g_music_cd', 'g_carfresh', 'konbini:cake', 'konbini:coffee', 'konbini:greenTea', 'konbini:onigiri', 'konbini:bento', 'cafe:cake']) {
      const r = play(game(owned(id)), 'give_gift', 'tanaka', { itemId: id });
      expect(r.session.ended, id).toBe(true);
      expect(r.state.owned[id], id).toBeUndefined();
      expect(r.facts.turns.some((t) => t.intentId === 'give_item' || t.intentId === 'give_food'), id).toBe(true);
    }
  });

  it('gives a disliked present no affinity, with the friend still kind', () => {
    const s = game(compose(withAp('tanaka', 20, { talkDay: 0 }), owned('konbini:onigiri')));
    const r = play(s, 'give_gift', 'tanaka', { itemId: 'konbini:onigiri' });
    expect(r.derived.find((d) => d.t === 'gift_reacted')).toMatchObject({ reaction: 'disliked', ap: 0 });
    expect(r.session.turns.filter((t) => t.speaker === 'character').map((t) => t.line.written).join('')).toContain('毎日');
  });

  it('keeps the present when nothing was handed over (left before naming it)', () => {
    const s = game(owned('g_manga'));
    const r = play(s, 'give_gift', 'mio', { itemId: 'g_manga', pick: () => undefined });
    expect(r.state.owned.g_manga?.qty).toBe(1);
    expect(r.events.some((e) => e.t === 'gift_given')).toBe(false);
  });

  it('one gift a day: the second hand-over changes nothing and keeps the item', () => {
    const s = game(compose(owned('g_manga', 2), withAp('mio', 35, { talkDay: 0 })));
    const first = play(s, 'give_gift', 'mio', { itemId: 'g_manga' });
    const second = play({ ...first.state, runs: {} }, 'give_gift', 'mio', { itemId: 'g_manga' });
    expect(second.state.owned.g_manga?.qty).toBe(1);
    expect(second.state.stats.gifts.n).toBe(1);
  });
});

describe('Chapter 3 through the real reducer, by tapping', () => {
  const done = (s: GameState, id: string) => s.chapter.done[id] !== undefined;
  const preds = Object.fromEntries(chapterDef(JP_PACK, 3)!.objectives.map((o) => [o.id, o.pred]));

  it('gets Mio to 2 hearts with talks and a gift, hands over the gift, and plays her heart beat', () => {
    expect(preds.c3_2).toEqual({ k: 'hearts', friend: 'mio', atLeast: 2 });
    let s = game(onDay(0));
    // day 0: the first talk, then a loved present from the konbini
    s = play(s, 'smalltalk_mio', 'mio').state;
    expect(heartsForAp(s.friends.mio!.ap)).toBeLessThan(2);
    s = grantItem(s, JP_PACK, 'g_manga', 1, 'd0');
    const g = play(s, 'give_gift', 'mio', { itemId: 'g_manga' });
    s = g.state;
    expect(evalPred(preds.c3_3!, s, { pack: JP_PACK, view: VIEW })).toBe(true);
    // the next days: a talk a day until Mio has 2 hearts
    const ready: DerivedEvent[] = [];
    for (let day = 1; day < 12 && heartsForAp(s.friends.mio!.ap) < 2; day++) {
      const r = play(onDay(day)(s), 'smalltalk_mio', 'mio');
      s = r.state;
      ready.push(...r.derived);
    }
    expect(heartsForAp(s.friends.mio!.ap)).toBeGreaterThanOrEqual(2);
    expect(evalPred(preds.c3_2!, s, { pack: JP_PACK, view: VIEW })).toBe(true);
    // the heart-2 event is announced once, and names the beat the app queues
    expect(ready.filter((d) => d.t === 'heart_event_ready')).toEqual([{ t: 'heart_event_ready', friendId: 'mio', level: 2 }]);
    expect(pendingHeartBeats(JP_PACK, s, known)).toEqual([{ friendId: 'mio', level: 2, beat: 'b_mio_h2' }]);
    expect(heartEventOfBeat(JP_PACK, 'b_mio_h2')).toEqual({ friendId: 'mio', level: 2 });

    // the beat plays: the note, the plain speech, the culture card, then the event is filed (+10 AP once)
    const before = s.friends.mio!.ap;
    const rb = reduce(s, { t: 'beat_done', id: 'b_mio_h2' }, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 });
    expect(rb.state.friends.mio!.flags).toEqual(expect.arrayContaining(['number_note', 'casual']));
    expect(rb.state.keepsakes).toContain('note_mio');
    expect(rb.state.culture.cc_keigo).toBeDefined();
    const re = reduce(rb.state, { t: 'heart_event_done', friendId: 'mio', level: 2 }, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 });
    expect(re.state.friends.mio!.ap).toBe(before + BALANCE.ap.event);
    expect(re.state.friends.mio!.events).toEqual([2]);
    expect(pendingHeartBeats(JP_PACK, re.state, known)).toEqual([]);
    const again = reduce(re.state, { t: 'heart_event_done', friendId: 'mio', level: 2 }, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 });
    expect(again.state.friends.mio!.ap).toBe(re.state.friends.mio!.ap);
  });

  it('reaches c3_4 with a second friend at 2 hearts, again by talks and gifts', () => {
    expect(preds.c3_4).toEqual({ k: 'hearts_count', atLeast: 2, n: 2 });
    let s = game(onDay(0));
    for (const id of ['mio', 'tanaka']) {
      s = play(s, smalltalkOf(id), id).state;
      s = grantItem(s, JP_PACK, id === 'mio' ? 'g_manga' : 'g_game_card', 1, 'd0');
      s = play(s, 'give_gift', id, { itemId: id === 'mio' ? 'g_manga' : 'g_game_card' }).state;
    }
    for (let day = 1; day < 14 && !evalPred(preds.c3_4!, s, { pack: JP_PACK, view: VIEW }); day++) {
      s = onDay(day)(s);
      for (const id of ['mio', 'tanaka']) s = play(s, smalltalkOf(id), id).state;
    }
    expect(evalPred(preds.c3_4!, s, { pack: JP_PACK, view: VIEW })).toBe(true);
    expect(done(s, 'c3_2') || evalPred(preds.c3_2!, s, { pack: JP_PACK, view: VIEW })).toBe(true);
  });

  it('cannot get 5 hearts in fewer than 6 days however the player plays (the daily cap of 60 binds)', () => {
    let s = game(onDay(0));
    for (let day = 0; day < 5; day++) {
      s = onDay(day)(s);
      s = play(s, 'smalltalk_mio', 'mio').state;
      for (const item of ['g_manga', 'konbini:cake']) {
        s = grantItem(s, JP_PACK, item, 1, 'd0');
        s = play(s, 'give_gift', 'mio', { itemId: item }).state;
      }
    }
    expect(heartsForAp(s.friends.mio!.ap)).toBeLessThan(5);
  });
});

describe('the Friends screen rows', () => {
  it('lists the six friends once their chapter is current, with the meter between two thresholds', () => {
    const rows = friendRows(JP_PACK, game(withAp('mio', 45)), VIEW, known);
    expect(rows.map((r) => r.def.id)).toEqual(['mio', 'yuki', 'tanaka', 'sato', 'kenji', 'hanako']);
    const mio = rows[0]!;
    expect(mio).toMatchObject({ hearts: 1, ap: 45, floor: BALANCE.ap.thresholds[0], next: BALANCE.ap.thresholds[1], met: true });
    const yuki = rows[1]!;
    expect(yuki).toMatchObject({ hearts: 0, floor: 0, next: BALANCE.ap.thresholds[0], met: false });
    expect(friendRows(JP_PACK, game(withAp('mio', 400)), VIEW, known)[0]).toMatchObject({ hearts: 5, next: null });
  });

  it('offers talk and gift to everyone, the gift once a day, and Message only with the phone', () => {
    const rows = friendRows(JP_PACK, game(), VIEW, known);
    expect(rows.every((r) => r.actions.talk && r.actions.gift)).toBe(true);
    expect(canMessage(JP_PACK, game())).toBe(false);
    expect(canMessage(JP_PACK, game((s) => grantItem(s, JP_PACK, 'phone_used', 1, 'd0')))).toBe(true);
    const gifted = friendRows(JP_PACK, game(withAp('mio', 10, { giftDay: 0 })), VIEW, known)[0]!;
    expect(gifted.actions.gift).toBe(false);
    expect(gifted.actions.giftNotes).toContain('daily');
  });

  it('shows a heart beat that is waiting on the friend\'s row', () => {
    const rows = friendRows(JP_PACK, game(withAp('mio', 85)), VIEW, known);
    expect(rows[0]!.pending).toEqual([{ friendId: 'mio', level: 2, beat: 'b_mio_h2' }]);
    expect(rows[1]!.pending).toEqual([]);
    expect(friendRows(JP_PACK, game(withAp('mio', 85)), VIEW, () => false)[0]!.pending).toEqual([]);
  });

  it('knows when Talk goes through Prepare (a pocket not ready) and when straight in', () => {
    expect(talkStartsAtPrepare(JP_PACK, game(), VIEW, 'smalltalk_mio')).toBe(true);
    expect(talkStartsAtPrepare(JP_PACK, game(), VIEW, 'no_such_scenario')).toBe(false);
  });
});

describe('"Next at ♥n" (§8.6): only what Release 1 has built', () => {
  const kinds = (id: string, h: number) => unlockLines(JP_PACK, def(id), h).map((l) => (l.kind === 'text' ? l.key : l.kind === 'fact' ? `fact:${l.fact}` : `perk:${l.text.en}`));

  it('lists the number, phone chat, plain speech and the second fact at 2 hearts for Mio', () => {
    expect(kinds('mio', 2)).toEqual(['number', 'chat', 'fact:photo_sakura', 'casual']);
    expect(kinds('mio', 1)).toEqual(['name', 'card', 'smalltalk', 'fact:likes_anime']);
  });

  it('adds the friend\'s present at 3 hearts and the perks at 4 and 5, in the pack\'s words, and never a hang-out, home visit, scene or beat', () => {
    expect(kinds('yuki', 3)).toEqual(['fact:dream_live', 'casual', 'perk:Yuki gives you a black tea']);
    expect(kinds('tanaka', 4)).toEqual(['perk:Konbini -5%']);
    expect(kinds('hanako', 5)).toEqual(['perk:A one-time ¥3,000 scholarship']);
    for (const f of JP_PACK.friends) for (let h = 1; h <= 5; h++) for (const k of kinds(f.id, h)) expect(k).not.toMatch(/hangout|home|scene|beat|heart_to_heart|keepsake|title/);
  });

  it('hides phone chat when the pack has no chat thread (a promise nobody keeps is a dead end)', () => {
    const noChat = { ...JP_PACK, scenarioMeta: JP_PACK.scenarioMeta.filter((m) => m.kind !== 'chat') };
    expect(unlockLines(noChat, def('mio'), 2).map((l) => (l.kind === 'text' ? l.key : l.kind))).not.toContain('chat');
  });
});

describe('strings', () => {
  it('has the same placeholders in English and Arabic for every social string, and Arabic script in every Arabic one', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const k of Object.keys(en) as Array<keyof typeof en>) {
      expect(ph(ar[k]), k).toBe(ph(en[k]));
      expect(/[؀-ۿ]/.test(ar[k]), k).toBe(true);
    }
  });

  it('names every place a friend can be found', () => {
    for (const id of ['park', 'cafe', 'konbini', 'ramen', 'station', 'school']) expect(`social.place.${id}` in en).toBe(true);
    for (const c of CHARACTERS.filter((c) => JP_PACK.friends.some((f) => f.id === c.id))) expect(`social.place.${c.locationId}` in en, c.id).toBe(true);
  });
});
