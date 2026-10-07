import { describe, expect, it } from 'vitest';
import {
  applyGift,
  applyHeartEvent,
  applyTalk,
  BALANCE,
  emptyFriend,
  friendActions,
  grantItem,
  heartsForAp,
  heartUnlocks,
  nextCallbackFact,
  placeItem,
  queueThreads,
  reconcile,
} from '@lw/game';
import type { ConversationFacts, FriendState, GameState, TalkKind } from '@lw/game';
import { ctxOf, lcg, makeFacts, makePack, makeState } from './fixtures-1e';

const pack = makePack();
const ctx = ctxOf(pack);
const TH = [0, ...BALANCE.ap.thresholds];
/** AP at exactly n hearts */
const apAt = (hearts: number) => TH[hearts]!;

const withFriend = (s: GameState, id: string, patch: Partial<FriendState>): GameState => ({
  ...s,
  friends: { ...s.friends, [id]: { ...emptyFriend(s.clock.dayIndex), ...(s.friends[id] ?? {}), ...patch } },
});
const nextDay = (s: GameState, by = 1): GameState => ({ ...s, clock: { ...s.clock, dayIndex: s.clock.dayIndex + by } });
const talk = (s: GameState, f: Partial<ConversationFacts> & Parameters<typeof makeFacts>[0] = {}, kind: TalkKind = 'talk', id = 'mio') => applyTalk(s, id, makeFacts(f), kind, ctx);

describe('hearts and the unlock ladder (§8.3, §8.6)', () => {
  it('hearts are the number of thresholds reached', () => {
    expect([0, 29, 30, 79, 80, 149, 150, 239, 240, 349, 350, 5000].map(heartsForAp)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });

  it('heartUnlocks follows the ladder, with the fact and the casual switch', () => {
    const mio = pack.friends.find((f) => f.id === 'mio')!;
    const tanaka = pack.friends.find((f) => f.id === 'tanaka')!;
    expect(heartUnlocks(mio, 0)).toEqual([]);
    expect(heartUnlocks(mio, 1)).toEqual(['name', 'card', 'smalltalk', 'fact:likes_anime']);
    expect(heartUnlocks(mio, 2)).toEqual(['number', 'chat', 'fact:photo_sakura', 'casual']);
    expect(heartUnlocks(mio, 3)).toEqual(['hangout', 'gift_from_friend', 'fact:lives_alone']);
    expect(heartUnlocks(mio, 4)).toEqual(['home_visit', 'perk_small']);
    expect(heartUnlocks(mio, 5)).toEqual(['scene', 'keepsake', 'title', 'perk']);
    expect(heartUnlocks(tanaka, 4)).toEqual(['heart_to_heart', 'perk_small']);
    expect(heartUnlocks(tanaka, 5)[0]).toBe('beat');
    // casualAt 99 = never
    expect([1, 2, 3, 4, 5].flatMap((h) => heartUnlocks(tanaka, h))).not.toContain('casual');
  });
});

describe('applyTalk: the talk formula (§8.3)', () => {
  it('a first talk: met +20, 5 for >= 60% of the steps, round(4 x share)', () => {
    const r = talk(makeState(), { ind: 3, ass: 0, done: 3, total: 3 });
    expect(r.parts).toEqual([
      { source: 'met', ap: 20 },
      { source: 'talk', ap: 5 },
      { source: 'share', ap: 4 },
    ]);
    expect(r.ap).toBe(29);
    expect(r.hearts).toEqual({ from: 0, to: 0 });
    expect(r.state.friends.mio).toMatchObject({ ap: 29, met: true, talkDay: 10, apToday: 29, lastContactDay: 10 });
  });

  it('share = independent / (independent + assisted), rounded: 1 of 2 -> 2, 1 of 4 -> 1, 0 -> 0', () => {
    const base = withFriend(makeState(), 'mio', { met: true });
    const sh = (ind: number, ass: number) => talk(base, { ind, ass, done: 0, total: 3 }).parts.find((p) => p.source === 'share')?.ap ?? 0;
    expect(sh(1, 1)).toBe(2);
    expect(sh(1, 3)).toBe(1);
    expect(sh(0, 4)).toBe(0);
    expect(sh(4, 0)).toBe(4);
  });

  it('the step bonus needs 60%: 2 of 3 yes, 1 of 3 no, a goal-less talk no', () => {
    const base = withFriend(makeState(), 'mio', { met: true });
    const steps = (done: number, total: number) => talk(base, { ind: 2, done, total }).parts.find((p) => p.source === 'talk')?.ap ?? 0;
    expect(steps(2, 3)).toBe(5);
    expect(steps(1, 3)).toBe(0);
    expect(steps(3, 5)).toBe(5);
    expect(steps(2, 5)).toBe(0);
    expect(steps(1, 0)).toBe(0);
  });

  it('only substantive turns count: assisted turns lower the share, empty turns are ignored', () => {
    const base = withFriend(makeState(), 'mio', { met: true });
    const f = makeFacts({ ind: 2, ass: 2, done: 3, total: 3 });
    f.turns.push({ ...f.turns[0]!, id: 99, substantive: false });
    const r = applyTalk(base, 'mio', f, 'talk', ctx);
    expect(r.parts.find((p) => p.source === 'share')?.ap).toBe(2);
  });

  it('callbacks add 3 each, at most 6, inside the 15 of the talk', () => {
    const base = withFriend(makeState(), 'mio', { met: true, facts: { hobby: 'photos', favFood: 'ramen', dream: 'a shop' } });
    const one = talk(base, { ind: 4, done: 3, total: 3, callbacks: ['hobby'] });
    expect(one.parts.find((p) => p.source === 'callback')?.ap).toBe(3);
    const three = talk(base, { ind: 4, done: 3, total: 3, callbacks: ['hobby', 'favFood', 'dream'] });
    expect(three.parts.find((p) => p.source === 'callback')?.ap).toBe(BALANCE.ap.talk.callbackMax);
    expect(three.parts.reduce((s, p) => s + p.ap, 0)).toBe(BALANCE.ap.talk.cap);
    expect(three.ap).toBe(15);
  });

  it('a callback needs a remembered fact, counts once per fact per day, and repeats are ignored', () => {
    const base = withFriend(makeState(), 'mio', { met: true, facts: { hobby: 'photos' } });
    const r = talk(base, { ind: 4, done: 3, total: 3, callbacks: ['hobby', 'hobby', 'dream'] });
    expect(r.parts.find((p) => p.source === 'callback')?.ap).toBe(3);
    expect(r.state.friends.mio!.callbacks).toEqual({ hobby: 10 });
    // a chat that quotes the fact the same day does not pay it again
    const again = talk(r.state, { ind: 4, done: 3, total: 3, callbacks: ['hobby'], sessionId: 's2' }, 'talk');
    expect(again.ap).toBe(0);
  });

  it('one counted talk per day per friend; the next day counts again', () => {
    const a = talk(makeState(), { ind: 3 });
    const b = talk(a.state, { ind: 3, sessionId: 's2' });
    expect(b.ap).toBe(0);
    expect(b.state.friends.mio!.ap).toBe(a.state.friends.mio!.ap);
    const c = talk(nextDay(b.state), { ind: 3, sessionId: 's3' });
    expect(c.ap).toBe(9);
    expect(c.parts.map((p) => p.source)).not.toContain('met');
  });

  it('an abandoned or empty conversation changes nothing', () => {
    const s = makeState();
    expect(talk(s, { abandoned: true }).state).toBe(s);
    expect(talk(s, { ind: 0, ass: 0, done: 0, total: 3 }).state).toBe(s);
    expect(talk(s, { ind: 0, ass: 0, done: 0, total: 3 }).ap).toBe(0);
    // an unknown friend is not a friend
    expect(applyTalk(s, 'nobody', makeFacts(), 'talk', ctx).state).toBe(s);
  });

  it('stores what the player told the friend, short strings only', () => {
    const r = talk(makeState(), { remembered: { hobby: ' anime ', favFood: '', dream: 'x'.repeat(41), 'purchase:phone': 'black' } });
    expect(r.state.friends.mio!.facts).toEqual({ hobby: 'anime', 'purchase:phone': 'black' });
  });

  it('records the small-talk topic day', () => {
    const r = talk(makeState(), { topic: 'food' });
    expect(r.state.friends.mio!.topicDay).toEqual({ food: 10 });
  });

  it('reveals a profile fact only at the heart that unlocks it, once', () => {
    const base = withFriend(makeState(), 'mio', { ap: apAt(1) - 3, met: true });
    const r = talk(base, { ind: 3, revealed: ['likes_anime', 'photo_sakura', 'nope'] });
    expect(r.hearts).toEqual({ from: 0, to: 1 });
    expect(r.state.friends.mio!.learned).toEqual(['likes_anime']);
    expect(talk(nextDay(r.state), { ind: 3, revealed: ['likes_anime'] }).state.friends.mio!.learned).toEqual(['likes_anime']);
  });

  it('a correct "do you remember?" is +3 once per fact and gilds it; a wrong one costs nothing', () => {
    const base = withFriend(makeState(), 'mio', { ap: apAt(2), met: true, talkDay: 10, learned: ['likes_anime', 'photo_sakura'] });
    const ok = talk(base, { ind: 1, quiz: { fact: 'photo_sakura', correct: true } });
    expect(ok.parts).toEqual([{ source: 'quiz', ap: BALANCE.ap.quiz }]);
    expect(ok.state.friends.mio!.gold).toEqual(['photo_sakura']);
    expect(talk(nextDay(ok.state), { ind: 1, quiz: { fact: 'photo_sakura', correct: true } }).parts.map((p) => p.source)).not.toContain('quiz');
    expect(talk(base, { ind: 1, quiz: { fact: 'photo_sakura', correct: false } }).ap).toBe(0);
    // a fact the player has not learned cannot be quizzed
    expect(talk(base, { ind: 1, quiz: { fact: 'lives_alone', correct: true } }).ap).toBe(0);
  });
});

describe('applyTalk: the daily cap and hearts', () => {
  it('every source together stops at 60 a day; parts report the raw amounts', () => {
    const base = withFriend(makeState(), 'mio', { ap: 100, met: true, apDay: 10, apToday: 55 });
    const r = talk(base, { ind: 4, done: 3, total: 3 });
    expect(r.parts.reduce((s, p) => s + p.ap, 0)).toBe(9);
    expect(r.ap).toBe(BALANCE.ap.dailyCap - 55);
    expect(r.state.friends.mio!.apToday).toBe(BALANCE.ap.dailyCap);
    expect(talk(r.state, { sessionId: 'x' }, 'hangout').ap).toBe(0);
  });

  it('the counters reset on a new day', () => {
    const base = withFriend(makeState(), 'mio', { ap: 100, met: true, apDay: 9, apToday: 60, chatApToday: 8 });
    const r = talk(base, { ind: 4, done: 3, total: 3 });
    expect(r.ap).toBe(9);
    expect(r.state.friends.mio).toMatchObject({ apDay: 10, apToday: 9, chatApToday: 0 });
  });

  it('derives ap_gained, hearts_changed, a heart event and the fanfare when a heart is reached', () => {
    const base = withFriend(makeState(), 'mio', { ap: apAt(2) - 5, met: true });
    const r = talk(base, { ind: 4, done: 3, total: 3 });
    expect(r.hearts).toEqual({ from: 1, to: 2 });
    expect(r.derived).toEqual([
      { t: 'ap_gained', friendId: 'mio', ap: 9, parts: r.parts },
      { t: 'hearts_changed', friendId: 'mio', from: 1, to: 2 },
      { t: 'heart_event_ready', friendId: 'mio', level: 2 },
    ]);
    expect(r.effects).toEqual([{ t: 'fanfare', kind: 'heart' }]);
  });

  it('a heart event already played is not announced again; a friend without one is silent', () => {
    const played = withFriend(makeState(), 'mio', { ap: apAt(2) - 5, met: true, events: [2] });
    expect(talk(played, { ind: 4 }).derived.map((d) => d.t)).not.toContain('heart_event_ready');
    const rin = withFriend(makeState(), 'tanaka', { ap: apAt(3) - 5, met: true });
    expect(talk(rin, { ind: 4, characterId: 'tanaka' }, 'talk', 'tanaka').derived.map((d) => d.t)).toEqual(['ap_gained', 'hearts_changed']);
  });

  it('crossing two hearts at once announces both events', () => {
    const base = withFriend(makeState(), 'mio', { ap: apAt(1) - 1 });
    // met 20 + 9 + the quiz and a heart scene cannot all happen here; a big jump comes from the pack data instead
    const wide = { ...pack, friends: pack.friends.map((f) => (f.id === 'mio' ? { ...f, events: [{ heart: 1, beat: 'a' }, { heart: 2, beat: 'b' }] } : f)) };
    const r = applyTalk({ ...base, friends: { mio: { ...base.friends.mio!, ap: apAt(1) - 1 } } }, 'mio', makeFacts({ ind: 4, done: 3, total: 3 }), 'talk', ctxOf(wide));
    expect(r.hearts).toEqual({ from: 0, to: 1 });
    expect(r.derived.filter((d) => d.t === 'heart_event_ready')).toEqual([{ t: 'heart_event_ready', friendId: 'mio', level: 1 }]);
  });

  it('never mutates its input', () => {
    const s = withFriend(makeState(), 'mio', { ap: 10, facts: { hobby: 'x' } });
    const before = JSON.stringify(s);
    talk(s, { ind: 3, callbacks: ['hobby'], remembered: { favFood: 'ramen' } });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('phone chats (§8.3, §8.7)', () => {
  const chatState = () => withFriend(makeState(), 'mio', { ap: apAt(2), met: true, threads: [{ template: 'chat_greet', day: 10 }, { template: 'chat_food', day: 10 }], unread: 2 });
  const chat = (s: GameState, scenarioId = 'chat_greet', o: Partial<Parameters<typeof makeFacts>[0]> = {}) => talk(s, { scenarioId, ind: 2, done: 1, total: 1, sessionId: `c-${scenarioId}`, ...o }, 'chat');

  it('a finished thread is +4 AP, removes the thread and counts as a chat', () => {
    const r = chat(chatState());
    expect(r.ap).toBe(BALANCE.ap.chat.ap);
    expect(r.parts).toEqual([{ source: 'chat', ap: 4 }]);
    expect(r.state.friends.mio!.threads).toEqual([{ template: 'chat_food', day: 10 }]);
    expect(r.state.friends.mio!.unread).toBe(1);
    expect(r.state.stats.chats).toEqual({ n: 1, friends: { mio: 1 } });
  });

  it('needs 2 substantive lines or a goal step, and the friend at 2 hearts', () => {
    expect(chat(chatState(), 'chat_greet', { ind: 1, done: 0, total: 1 }).ap).toBe(0);
    expect(chat(chatState(), 'chat_greet', { ind: 1, done: 1, total: 1 }).ap).toBe(4);
    expect(chat(chatState(), 'chat_greet', { ind: 2, done: 0, total: 1 }).ap).toBe(4);
    const low = withFriend(makeState(), 'mio', { ap: apAt(2) - 1, met: true });
    expect(chat(low).state).toBe(low);
  });

  it('chat AP stops at 8 a day, but the chats still count', () => {
    let s = chatState();
    for (const [i, id] of ['chat_greet', 'chat_food', 'chat_plan'].entries()) s = chat(s, id, { sessionId: `x${i}` }).state;
    expect(s.friends.mio!.chatApToday).toBe(BALANCE.ap.chat.dailyCap);
    expect(s.friends.mio!.ap).toBe(apAt(2) + 8);
    expect(s.stats.chats.n).toBe(3);
  });

  it('chat_miss is an easy +6 inside the same 8', () => {
    const s = withFriend(chatState(), 'mio', { threads: [{ template: 'chat_miss', day: 10 }], unread: 1 });
    const r = chat(s, 'chat_miss');
    expect(r.ap).toBe(BALANCE.ap.chat.missAp);
    const more = chat(r.state, 'chat_greet', { sessionId: 'z' });
    expect(more.ap).toBe(BALANCE.ap.chat.dailyCap - BALANCE.ap.chat.missAp);
  });

  it('a chat with no queued thread still pays (the queue is a courtesy, the caps are the rule)', () => {
    const s = withFriend(makeState(), 'mio', { ap: apAt(2), met: true });
    expect(chat(s).ap).toBe(4);
  });
});

describe('hang-outs and home visits', () => {
  const at3 = () => withFriend(makeState(), 'mio', { ap: apAt(3), met: true });

  it('+25 when the share is at least 0.5, else +10; needs 3 hearts', () => {
    expect(talk(at3(), { ind: 3, ass: 1 }, 'hangout').ap).toBe(BALANCE.ap.hangout.good);
    expect(talk(at3(), { ind: 1, ass: 3 }, 'hangout').ap).toBe(BALANCE.ap.hangout.low);
    const low = withFriend(makeState(), 'mio', { ap: apAt(3) - 1, met: true });
    expect(talk(low, { ind: 3 }, 'hangout').state).toBe(low);
  });

  it('one per 3 days; stats.hangouts counts them', () => {
    const a = talk(at3(), { ind: 3 }, 'hangout');
    expect(a.state.stats.hangouts).toEqual({ mio: 1 });
    expect(talk(nextDay(a.state), { ind: 3, sessionId: 'b' }, 'hangout').ap).toBe(0);
    expect(talk(nextDay(a.state, 2), { ind: 3, sessionId: 'b' }, 'hangout').ap).toBe(0);
    const c = talk(nextDay(a.state, 3), { ind: 3, sessionId: 'b' }, 'hangout');
    expect(c.ap).toBe(BALANCE.ap.hangout.good);
    expect(c.state.stats.hangouts).toEqual({ mio: 2 });
  });

  it('a placed kotatsu makes a visit x1.5', () => {
    let s = at3();
    s = grantItem(s, pack, 'home_room_ono', 1, 'd1');
    s = grantItem(s, pack, 'kotatsu', 1, 'd1');
    expect(talk(s, { ind: 3 }, 'hangout').ap).toBe(25);
    s = placeItem(s, pack, 'table', 'kotatsu').state;
    expect(talk(s, { ind: 3 }, 'hangout').ap).toBe(Math.round(25 * 1.5));
  });

  it('a home visit is +25 and shares the hang-out window', () => {
    const s = withFriend(makeState(), 'mio', { ap: apAt(4), met: true });
    const a = talk(s, { ind: 1, ass: 2, scenarioId: 'home_mio' }, 'home');
    expect(a.ap).toBe(BALANCE.ap.hangout.good);
    expect(a.state.stats.hangouts).toEqual({});
    expect(talk(nextDay(a.state), { ind: 3 }, 'hangout').ap).toBe(0);
    expect(talk(nextDay(a.state, 3), { ind: 3, scenarioId: 'home_mio' }, 'home').ap).toBe(BALANCE.ap.hangout.good);
  });
});

describe('heart events and perks (§8.9)', () => {
  it('a heart scene is +10 once, never above the friend\'s hearts', () => {
    const s5 = withFriend(makeState(), 'mio', { ap: apAt(5), met: true });
    const r = talk(s5, { scenarioId: 'heart_mio', ind: 2, done: 4, total: 4 }, 'heart');
    expect(r.ap).toBe(BALANCE.ap.event);
    expect(r.parts).toEqual([{ source: 'event', ap: 10 }]);
    expect(r.state.friends.mio!.events).toEqual([5]);
    expect(talk(nextDay(r.state), { scenarioId: 'heart_mio', ind: 2, done: 4, total: 4 }, 'heart').ap).toBe(0);
    const s4 = withFriend(makeState(), 'mio', { ap: apAt(4), met: true });
    expect(talk(s4, { scenarioId: 'heart_mio', ind: 2 }, 'heart').state).toBe(s4);
  });

  it('a heart-to-heart beat stores the dream fact', () => {
    const s = withFriend(makeState(), 'yuki', { ap: apAt(4), met: true });
    const r = applyTalk(s, 'yuki', makeFacts({ scenarioId: 'h4_yuki', characterId: 'yuki', ind: 2, remembered: { dream: 'a cafe' } }), 'heart', ctx);
    expect(r.state.friends.yuki).toMatchObject({ events: [4], facts: { dream: 'a cafe' } });
    expect(r.ap).toBe(10);
  });

  it('applyHeartEvent files a beat once and pays +10', () => {
    const s = withFriend(makeState(), 'mio', { ap: apAt(2), met: true });
    const a = applyHeartEvent(s, 'mio', 2, ctx);
    expect(a.ap).toBe(10);
    expect(a.state.friends.mio!.events).toEqual([2]);
    expect(applyHeartEvent(a.state, 'mio', 2, ctx).ap).toBe(0);
    expect(applyHeartEvent(s, 'mio', 3, ctx).state).toBe(s);
    expect(applyHeartEvent(s, 'nobody', 1, ctx).state).toBe(s);
  });

  it('pays one-time perks once when their heart is reached: an item at 3, cash at 5', () => {
    let s = withFriend(makeState(), 'hanako', { ap: apAt(3) - 4, met: true });
    const a = applyTalk(s, 'hanako', makeFacts({ characterId: 'hanako', ind: 4 }), 'talk', ctx);
    expect(a.hearts).toEqual({ from: 2, to: 3 });
    expect(a.state.owned.g_wagashi?.qty).toBe(1);
    expect(a.state.stats.perksUsed).toEqual(['hanako_gift3']);
    expect(a.derived).toContainEqual({ t: 'unlocked', what: 'item', id: 'g_wagashi' });

    s = withFriend(nextDay(a.state), 'hanako', { ap: apAt(5) - 4 });
    const b = applyTalk(s, 'hanako', makeFacts({ characterId: 'hanako', ind: 4, sessionId: 's9' }), 'talk', ctx);
    expect(b.hearts).toEqual({ from: 4, to: 5 });
    expect(b.state.wallet.cash).toBe(s.wallet.cash + 3000);
    expect(b.state.stats.perksUsed).toEqual(['hanako_gift3', 'hanako_scholarship']);
    expect(b.derived).toContainEqual({ t: 'wallet_changed', delta: 3000, balance: s.wallet.cash + 3000, kind: 'perk' });
    expect(b.state.ledger.at(-1)).toMatchObject({ id: 'perk:hanako_scholarship', kind: 'perk', delta: 3000, pocket: 'cash' });
    expect(reconcile(b.state, BALANCE.startCash).ok).toBe(true);
  });

  it('a perk already used is not paid again even if the hearts are crossed again', () => {
    const s = withFriend(makeState(), 'hanako', { ap: apAt(3) - 4, met: true });
    const used = { ...s, stats: { ...s.stats, perksUsed: ['hanako_gift3'] } };
    const r = applyTalk(used, 'hanako', makeFacts({ characterId: 'hanako', ind: 4 }), 'talk', ctx);
    expect(r.state.owned.g_wagashi).toBeUndefined();
  });
});

describe('friendActions', () => {
  const view = ctx.view;

  it('a friend whose chapter has not come offers nothing', () => {
    const s = { ...makeState(), chapter: { ...makeState().chapter, n: 2 } };
    expect(friendActions(pack, s, view, 'yuki')).toMatchObject({ talk: false, gift: false, chat: false, hangout: false, home: false });
    expect(friendActions(pack, s, view, 'nobody').talk).toBe(false);
  });

  it('talk and gift from the start; the gift is once a day', () => {
    const s = makeState();
    expect(friendActions(pack, s, view, 'mio')).toMatchObject({ talk: true, gift: true, chat: false, hangout: false, home: false });
    const gifted = withFriend(s, 'mio', { giftDay: 10 });
    expect(friendActions(pack, gifted, view, 'mio').gift).toBe(false);
    expect(friendActions(pack, gifted, view, 'mio').giftNotes).toContain('daily');
    expect(friendActions(pack, nextDay(gifted), view, 'mio').gift).toBe(true);
  });

  it('gift notes: no talk today, and the friend is at the daily cap or the last heart', () => {
    expect(friendActions(pack, makeState(), view, 'mio').giftNotes).toEqual(['noTalk']);
    expect(friendActions(pack, withFriend(makeState(), 'mio', { talkDay: 10 }), view, 'mio').giftNotes).toEqual([]);
    expect(friendActions(pack, withFriend(makeState(), 'mio', { talkDay: 10, apDay: 10, apToday: 60 }), view, 'mio').giftNotes).toEqual(['capped']);
    expect(friendActions(pack, withFriend(makeState(), 'mio', { talkDay: 10, ap: apAt(5) }), view, 'mio').giftNotes).toEqual(['capped']);
  });

  it('chat needs the phone, 2 hearts and a waiting thread', () => {
    const t = { threads: [{ template: 'chat_greet', day: 10 }], unread: 1 };
    const noPhone = withFriend(makeState(), 'mio', { ap: apAt(2), ...t });
    expect(friendActions(pack, noPhone, view, 'mio').chat).toBe(false);
    const phone = grantItem(noPhone, pack, 'phone_used', 1, 'd1');
    expect(friendActions(pack, phone, view, 'mio').chat).toBe(true);
    expect(friendActions(pack, withFriend(phone, 'mio', { threads: [], unread: 0 }), view, 'mio').chat).toBe(false);
    expect(friendActions(pack, withFriend(phone, 'mio', { ap: apAt(2) - 1 }), view, 'mio').chat).toBe(false);
  });

  it('hang-out: 3 hearts, one per 3 days, a hang-out scenario exists; home: 4 hearts and a home', () => {
    const s3 = withFriend(makeState(), 'mio', { ap: apAt(3) });
    expect(friendActions(pack, s3, view, 'mio')).toMatchObject({ hangout: true, home: false });
    expect(friendActions(pack, withFriend(s3, 'mio', { hangoutDay: 8 }), view, 'mio').hangout).toBe(false);
    expect(friendActions(pack, withFriend(s3, 'mio', { hangoutDay: 7 }), view, 'mio').hangout).toBe(true);
    expect(friendActions(pack, withFriend(makeState(), 'mio', { ap: apAt(4) }), view, 'mio').home).toBe(true);
    // Tanaka has no home and no hang-out scenario in this pack
    expect(friendActions(pack, withFriend(makeState(), 'tanaka', { ap: apAt(5) }), view, 'tanaka')).toMatchObject({ hangout: false, home: false });
  });
});

describe('queueThreads (§8.7)', () => {
  const rng = lcg(7);
  const withPhone = (s: GameState) => grantItem(s, pack, 'phone_used', 1, 'd1');
  const base = () => withPhone(withFriend(makeState(), 'mio', { ap: apAt(2), met: true, lastContactDay: 10 }));
  const queue = (s: GameState, seed = 1) => queueThreads(pack, s, ctx.view, lcg(seed));
  const templates = (s: GameState, id = 'mio') => s.friends[id]!.threads.map((t) => t.template);

  it('does nothing without a phone', () => {
    const s = withFriend(makeState(), 'mio', { ap: apAt(2) });
    expect(queue(s)).toBe(s);
    expect(rng()).toBeGreaterThanOrEqual(0);
  });

  it('queues the pending story message first, once, and one thread a day', () => {
    const a = queue(base());
    expect(templates(a)).toEqual(['chat_first']);
    expect(a.friends.mio).toMatchObject({ unread: 1, chatDay: 10, flags: ['chat_first'], chatRecent: ['chat_first'] });
    expect(queue(a)).toBe(a);
  });

  it('then a callback to a remembered fact, then the plan, then a rotating generic thread', () => {
    let s = queue(base());
    s = withFriend(s, 'mio', { facts: { hobby: 'photos' } });
    s = queue(nextDay(s));
    expect(templates(s)).toEqual(['chat_first', 'chat_callback']);
    s = queue(nextDay(s));
    expect(templates(s).at(-1)).toBe('chat_plan');
    // the generic ones follow, never one of the last 3
    for (let i = 0; i < 4; i++) {
      const prev = s.friends.mio!.chatRecent;
      s = { ...s, friends: { ...s.friends, mio: { ...s.friends.mio!, threads: [], unread: 0 } } };
      s = queue(nextDay(s), i + 3);
      const t = templates(s)[0]!;
      expect(prev).not.toContain(t);
    }
  });

  it('never queues past the unread limit', () => {
    let s = withFriend(base(), 'mio', { threads: [1, 2, 3].map((n) => ({ template: `chat_x${n}`, day: 9 })), unread: BALANCE.ap.chat.unreadMax });
    s = nextDay(s);
    expect(queue(s)).toBe(s);
  });

  it('skips friends below 2 hearts or never met', () => {
    const s = withFriend(base(), 'yuki', { ap: apAt(2) - 1 });
    expect(queue(s).friends.yuki!.threads).toEqual([]);
    expect(queue(s).friends.tanaka).toBeUndefined();
  });

  it('away for 5 days or more queues the "are you well?" thread', () => {
    const s = nextDay(withFriend(base(), 'mio', { lastContactDay: 10 }), BALANCE.ap.chat.missDays);
    expect(templates(queue(s))).toEqual(['chat_miss']);
    const near = nextDay(withFriend(base(), 'mio', { lastContactDay: 10, flags: ['chat_first'] }), BALANCE.ap.chat.missDays - 1);
    expect(templates(queue(near))[0]).not.toBe('chat_miss');
  });

  it('an invite to your home is offered only once you have the flat; templates the pack lacks are skipped', () => {
    const generic = (s: GameState) => {
      // walk through enough days to see every generic template that is allowed
      const seen = new Set<string>();
      let cur = withFriend(s, 'mio', { flags: ['chat_first'], facts: {} });
      for (let i = 0; i < 40; i++) {
        cur = { ...cur, friends: { ...cur.friends, mio: { ...cur.friends.mio!, threads: [], unread: 0 } } };
        cur = queue(nextDay(cur), i + 11);
        for (const t of templates(cur)) seen.add(t);
      }
      return seen;
    };
    expect(generic(base()).has('chat_invite_home')).toBe(false);
    expect(generic(grantItem(base(), pack, 'home_room_ono', 1, 'd1')).has('chat_invite_home')).toBe(true);
    // ♥2: no chat_teach (♥3) yet
    expect(generic(base()).has('chat_teach')).toBe(false);
    const bare = { ...pack, scenarioMeta: pack.scenarioMeta.filter((m) => m.kind !== 'chat') };
    expect(queueThreads(bare, base(), ctx.view, rng)).toEqual(base());
  });

  it('is deterministic in the rng', () => {
    const s = withFriend(base(), 'mio', { flags: ['chat_first'], chatRecent: ['chat_plan', 'chat_callback', 'chat_greet'] });
    expect(queue(s, 5)).toEqual(queue(s, 5));
  });

  it('nextCallbackFact: the fact never quoted, else the one quoted longest ago', () => {
    const f = { ...emptyFriend(10), facts: { hobby: 'a', favFood: 'b', dream: 'c' }, callbacks: { hobby: 4, favFood: 9 } };
    expect(nextCallbackFact(f, 10)).toBe('dream');
    expect(nextCallbackFact({ ...f, callbacks: { hobby: 4, favFood: 9, dream: 10 } }, 10)).toBe('hobby');
    expect(nextCallbackFact({ ...f, callbacks: { hobby: 10, favFood: 10, dream: 10 } }, 10)).toBeNull();
    expect(nextCallbackFact(emptyFriend(1), 1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------------------------------------------

const GIFTS = ['g_manga', 'g_choco', 'g_game_card', 'g_wagashi', 'g_tea_set', 'g_tenugui', 'g_plush', 'g_music_cd', 'konbini:onigiri', 'cafe:coffee', 'cafe:cake'];

/** One random action against a friend, from every source: talk, gift, chat, hang-out, home visit, heart scene, heart event. */
function randomAction(s: GameState, id: string, rnd: () => number, n: number): GameState {
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)]!;
  const f = makeFacts({
    characterId: id,
    sessionId: `s${n}`,
    ind: Math.floor(rnd() * 6),
    ass: Math.floor(rnd() * 4),
    done: Math.floor(rnd() * 5),
    total: 1 + Math.floor(rnd() * 4),
    callbacks: ['hobby', 'favFood', 'dream'].filter(() => rnd() < 0.7),
    remembered: rnd() < 0.5 ? { hobby: 'photos', favFood: 'ramen', dream: 'cafe' } : {},
    revealed: ['likes_anime', 'photo_sakura', 'lives_alone', 'guitar', 'cat', 'dream_live'].filter(() => rnd() < 0.5),
    quiz: rnd() < 0.4 ? { fact: pick(['likes_anime', 'photo_sakura', 'guitar']), correct: rnd() < 0.8 } : undefined,
    scenarioId: pick(['smalltalk_mio', 'chat_greet', 'chat_miss', 'chat_plan', 'home_mio', 'heart_mio', 'h4_yuki']),
  });
  const kind = pick<TalkKind>(['talk', 'talk', 'chat', 'chat', 'hangout', 'home', 'heart']);
  const roll = rnd();
  if (roll < 0.3) {
    const item = pick(GIFTS);
    const stocked = grantItem(s, pack, item, 1, `d${s.clock.dayIndex}`);
    return applyGift(stocked, { t: 'gift_given', friendId: id, itemId: item, sessionId: `g${n}`, assistedHandover: rnd() < 0.3, bare: rnd() < 0.2 }, ctx).state;
  }
  if (roll < 0.35) return applyHeartEvent(s, id, 1 + Math.floor(rnd() * 5), ctx).state;
  return applyTalk(s, id, f, kind, ctx).state;
}

describe('property: caps hold under spam', () => {
  it('50 spam actions in one day add at most 60 AP; chat <= 8; one counted talk; one AP gift', () => {
    for (const hearts of [0, 1, 2, 3, 4, 5]) {
      for (const id of ['mio', 'yuki', 'tanaka', 'hanako']) {
        for (let seed = 1; seed <= 6; seed++) {
          const rnd = lcg(seed * 31 + hearts);
          let s = withFriend(makeState(), id, { ap: apAt(hearts), met: true });
          const start = s.friends[id]!.ap;
          let talks = 0;
          for (let n = 0; n < 50; n++) {
            const before = s.friends[id]!;
            s = randomAction(s, id, rnd, n);
            const after = s.friends[id]!;
            expect(after.ap).toBeGreaterThanOrEqual(before.ap);
            if (after.talkDay === 10 && before.talkDay !== 10) talks++;
            expect(after.chatApToday).toBeLessThanOrEqual(BALANCE.ap.chat.dailyCap);
            expect(after.apToday).toBeLessThanOrEqual(BALANCE.ap.dailyCap);
          }
          const f = s.friends[id]!;
          expect(f.ap - start).toBeLessThanOrEqual(BALANCE.ap.dailyCap);
          expect(f.apToday).toBe(f.ap - start);
          expect(talks).toBeLessThanOrEqual(1);
          expect(f.giftHistory.filter((g) => g.day === 10).length).toBeLessThanOrEqual(BALANCE.ap.giftsPerDay);
          expect(f.gifts).toBeLessThanOrEqual(BALANCE.ap.giftsPerDay);
          expect(heartsForAp(f.ap)).toBeGreaterThanOrEqual(hearts);
        }
      }
    }
  });

  it('a chat-only spammer gains at most the chat cap, a gift-only spammer at most one gift', () => {
    let s = withFriend(makeState(), 'mio', { ap: apAt(2), met: true });
    for (let n = 0; n < 50; n++) s = talk(s, { scenarioId: 'chat_greet', ind: 3, done: 1, total: 1, sessionId: `c${n}` }, 'chat').state;
    expect(s.friends.mio!.ap - apAt(2)).toBe(BALANCE.ap.chat.dailyCap);
    expect(s.stats.chats.n).toBe(50);
    let g = withFriend(makeState(), 'mio', { ap: 0 });
    for (let n = 0; n < 50; n++) g = applyGift(grantItem(g, pack, 'g_manga', 1, 'd1'), { t: 'gift_given', friendId: 'mio', itemId: 'g_manga', sessionId: `g${n}`, assistedHandover: false }, ctx).state;
    expect(g.friends.mio!.gifts).toBe(1);
    expect(g.friends.mio!.ap).toBeLessThanOrEqual(BALANCE.ap.giftCapMax);
  });

  it('no friend reaches heart 5 in fewer than 6 days by any action mix', () => {
    for (const id of ['mio', 'yuki', 'hanako']) {
      for (let seed = 1; seed <= 25; seed++) {
        const rnd = lcg(seed * 977);
        let s = makeState(10);
        s = { ...s, chapter: { ...s.chapter, n: 9 } };
        for (let day = 1; day <= 5; day++) {
          for (let n = 0; n < 40; n++) s = randomAction(s, id, rnd, day * 100 + n);
          const ap = s.friends[id]?.ap ?? 0;
          expect(ap, `${id} seed ${seed} day ${day}`).toBeLessThanOrEqual(BALANCE.ap.dailyCap * day);
          expect(heartsForAp(ap)).toBeLessThan(5);
          s = nextDay(s);
        }
      }
    }
    // the cap alone makes 5 days too few: 5 x 60 < 350
    expect(BALANCE.ap.dailyCap * 5).toBeLessThan(BALANCE.ap.thresholds[4]!);
  });

  it('hearts and AP are monotone over a long random life', () => {
    const rnd = lcg(4242);
    let s = makeState(10);
    s = { ...s, chapter: { ...s.chapter, n: 9 } };
    let ap = 0;
    let hearts = 0;
    for (let n = 0; n < 600; n++) {
      s = randomAction(s, 'mio', rnd, n);
      if (n % 25 === 24) s = nextDay(s);
      const f = s.friends.mio;
      if (!f) continue;
      expect(f.ap).toBeGreaterThanOrEqual(ap);
      expect(heartsForAp(f.ap)).toBeGreaterThanOrEqual(hearts);
      ap = f.ap;
      hearts = heartsForAp(f.ap);
    }
    expect(hearts).toBe(5);
  });
});
