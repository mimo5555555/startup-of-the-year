import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { dayKey, reconcile } from '../src/ledger';
import { needsFlush, reduce, createGameState } from '../src/reducer';
import { activeDreamProgress, audioMode, awayDays, coachOffer, currentChapter, defaultsToReal, derivedFlags, disclosure, dueCount, hearts, lineReady, pocketReady, ttsRate } from '../src/selectors';
import { validateState } from '../src/validate';
import type { ConversationFacts, GamePack, GameState, GameView, InputEvent, ReduceResult } from '../src/types';
import { ctx1f, dayAt, facts1f, fresh1f, NOW, pack1f, rng, turn, view1f } from './fixtures-1f';

const pack = pack1f();

/** One reduce call at `at` (default: day 0). The input state is frozen first, so any mutation throws. */
function step(s: GameState, ev: InputEvent, at = NOW, view: GameView = view1f(), p: GamePack = pack): ReduceResult {
  return reduce(deepFreeze(s), ev, ctx1f(p, at, view));
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

const buy = (sessionId: string, itemId: string, shopId: string, total: number, extra: Partial<Extract<InputEvent, { t: 'purchase' }>> = {}): InputEvent => ({
  t: 'purchase',
  sessionId,
  n: 1,
  shopId,
  itemId,
  qty: 1,
  total,
  method: 'cash',
  lines: [],
  ...extra,
});

const rich = (s: GameState, cash: number): GameState => ({ ...s, wallet: { ...s.wallet, cash }, totals: { ...s.totals, earned: s.totals.earned + (cash - s.wallet.cash), checksum: { ...s.totals.checksum, cash } } });

describe('createGameState', () => {
  const s = fresh1f();
  it('starts with the pack start cash, chapter 1, empty rings and no seed', () => {
    expect(s.wallet).toEqual({ cash: 3000, ic: 0, points: 0 });
    expect(s.chapter.n).toBe(1);
    expect(s.ledger).toEqual([]);
    expect(s.seen).toEqual([]);
    expect(s.seeded).toBe(false);
    expect(s.clock).toMatchObject({ dayIndex: 0, activeDays: 0, lastActiveDay: -1, lastSeenAt: NOW });
    expect(s.clock.lastLocalDate).toBe('2030-01-15');
    expect(s.packId).toBe('jp');
  });
  it('seeds the reconcile checksum from the start cash and the say-new counters empty', () => {
    expect(s.totals).toEqual({ earned: 0, spent: 0, checksum: { cash: 3000, ic: 0, points: 0 } });
    expect(s.words.said).toEqual([]);
    expect(s.stats.sayNew).toBe(0);
  });
  it('is JSON-safe, reconciles, validates and is deterministic', () => {
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    expect(reconcile(s, 3000).ok).toBe(true);
    expect(validateState(s, pack)).toEqual([]);
    expect(createGameState(pack, NOW)).toEqual(s);
  });
  it('uses the pack start cash, not the JP reference', () => {
    const poor = pack1f({ economy: { ...pack.economy, startCash: 1200 } });
    const st = createGameState(poor, NOW);
    expect(st.wallet.cash).toBe(1200);
    expect(st.totals.checksum.cash).toBe(1200);
    expect(reconcile(st, 1200).ok).toBe(true);
  });
});

describe('the clock (integrity stage)', () => {
  it('a later date adds exactly one day, however large the jump, and a return reopens nothing', () => {
    const a = step(fresh1f(), { t: 'day_observed', nowMs: dayAt(400) });
    expect(a.state.clock.dayIndex).toBe(1);
    const b = step(a.state, { t: 'day_observed', nowMs: dayAt(0) });
    expect(b.state.clock.dayIndex).toBe(1);
    expect(b.state.clock.lastLocalDate).toBe('2030-01-15');
    // real time catches up one day later: one more rollover, not 400
    const c = step(b.state, { t: 'day_observed', nowMs: dayAt(1) });
    expect(c.state.clock.dayIndex).toBe(2);
  });
  it('a time-zone hop (-1 day, +1 day) grants at most one extra rollover', () => {
    let s = fresh1f();
    s = step(s, { t: 'day_observed', nowMs: dayAt(1) }).state; // day 1
    s = step(s, { t: 'day_observed', nowMs: dayAt(0) }).state; // back
    s = step(s, { t: 'day_observed', nowMs: dayAt(1) }).state; // forward again
    expect(s.clock.dayIndex).toBe(2);
  });
  it('midnight with the app open: the next event after midnight rolls over once', () => {
    const late = new Date(2030, 0, 15, 23, 59, 30).getTime();
    const early = new Date(2030, 0, 16, 0, 0, 30).getTime();
    let s = step(fresh1f(), { t: 'day_observed', nowMs: late }).state;
    expect(s.clock.dayIndex).toBe(0);
    s = step(s, { t: 'day_observed', nowMs: early }).state;
    expect(s.clock.dayIndex).toBe(1);
    s = step(s, { t: 'audio_mode', mode: 'x' }, early + 1000).state;
    expect(s.clock.dayIndex).toBe(1);
  });
  it('a day rollover resets the daily pay counters and the shell event uses its own time', () => {
    const paid = step(fresh1f(), { t: 'conversation_done', facts: facts1f({ ind: 4, done: 3, total: 3 }) }).state;
    expect(paid.pay.langToday).toBeGreaterThan(0);
    const next = step(paid, { t: 'day_observed', nowMs: dayAt(1) }, NOW).state;
    expect(next.clock.dayIndex).toBe(1);
    expect(next.pay.langToday).toBe(0);
    expect(next.pay.day).toBe('d1');
    expect(next.pay.seenIntents.length).toBe(paid.pay.seenIntents.length);
  });
});

describe('purchases', () => {
  it('a purchase charges exactly the re-quoted total, writes the ledger and the inventory', () => {
    const r = step(fresh1f(), buy('p1', 'konbini:onigiri', 'konbini', 160));
    expect(r.state.wallet.cash).toBe(3000 - 160);
    expect(r.state.ledger.find((e) => e.id === 'purchase:p1:1')).toMatchObject({ kind: 'purchase', delta: -160, pocket: 'cash' });
    // the konbini issues Sakura Points: 1% of 160, floored
    expect(r.state.wallet.points).toBe(1);
    expect(r.state.stats.purchases).toBe(1);
    expect(r.state.owned['konbini:onigiri']?.qty).toBe(1); // a conversation-bought snack is gift stock
    expect(r.derived).toContainEqual({ t: 'wallet_changed', delta: -160, balance: 2840, kind: 'purchase' });
    expect(reconcile(r.state, 3000).ok).toBe(true);
  });
  it('the event total is only compared: a stale total does not change what is charged', () => {
    const r = step(fresh1f(), buy('p1', 'konbini:onigiri', 'konbini', 999));
    expect(r.state.wallet.cash).toBe(2840);
  });
  it('replaying the same purchase is a no-op, and a refused one changes nothing', () => {
    const once = step(fresh1f(), buy('p1', 'konbini:onigiri', 'konbini', 160));
    const twice = step(once.state, buy('p1', 'konbini:onigiri', 'konbini', 160));
    expect(twice.state).toEqual(once.state);
    expect(twice.derived).toEqual([]);
    const poor = step(rich(fresh1f(), 100), buy('p2', 'konbini:onigiri', 'konbini', 160));
    expect(poor.state.wallet.cash).toBe(100);
    expect(poor.state.stats.purchases).toBe(0);
    expect(poor.state.ledger).toEqual([]);
  });
  it('a closed shop and an unknown item are refused without side effects', () => {
    const s = rich(fresh1f(), 100_000);
    expect(step(s, buy('p1', 'phone_used', 'denki', 24_800)).state.wallet.cash).toBe(100_000);
    expect(step(s, buy('p2', 'nothing', 'konbini', 1)).state).toEqual(step(s, { t: 'day_observed', nowMs: NOW }).state);
  });
  it('the phone unlocks its feature, plays its beat and queues a first thread for a friend at 2 hearts', () => {
    let s = rich({ ...fresh1f(), chapter: { ...fresh1f().chapter, n: 4 } }, 50_000);
    s = { ...s, friends: { mio: { ...fresh1f().friends.mio, ap: 90, met: true, apDay: 0, apToday: 0, chatApToday: 0, unread: 0, threads: [], chatRecent: [], facts: {}, learned: [], gold: [], callbacks: {}, topicDay: {}, events: [], flags: [], giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0 } } };
    const r = step(s, buy('p1', 'phone_used', 'denki', 24_800, { method: 'cash' }));
    expect(r.state.owned.phone_used?.qty).toBe(1);
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'feature', id: 'phone' });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_phone_bought' });
    expect(derivedFlags(pack, r.state).hasPhone).toBe(true);
    expect(r.state.friends.mio?.threads[0]?.template).toBe('chat_first');
  });
  it('the first vending drink gives a little XP, later ones nothing', () => {
    const a = step(fresh1f(), buy('v1', 'vending:greenTea', 'vending', 130));
    expect(a.effects).toContainEqual({ t: 'xp', amount: BALANCE.vendingXp, why: 'vending' });
    expect(a.state.stats.purchases).toBe(0); // a panel purchase is not a conversation purchase
    const b = step(a.state, buy('v2', 'vending:greenTea', 'vending', 130));
    expect(b.effects.some((e) => e.t === 'xp')).toBe(false);
  });
  it('a catalog purchase stays out of the pace estimate, a practice purchase does not', () => {
    const base = rich({ ...fresh1f(), chapter: { ...fresh1f().chapter, n: 4 } }, 50_000);
    const phone = step(base, buy('p1', 'phone_used', 'denki', 24_800));
    expect(phone.state.income).toEqual([]);
    const food = step(base, buy('p2', 'konbini:onigiri', 'konbini', 160));
    expect(food.state.income).toEqual([{ day: 0, net: -160 }]);
  });
});

describe('top-ups, refunds and fares', () => {
  it('a top-up moves cash to the card within the cap and never touches earned/spent', () => {
    const r = step(fresh1f(), { t: 'topup', id: 't1', amount: 1000 });
    expect(r.state.wallet).toMatchObject({ cash: 2000, ic: 1000 });
    expect(r.state.totals.earned).toBe(0);
    expect(r.state.totals.spent).toBe(0);
    expect(reconcile(r.state, 3000).ok).toBe(true);
    expect(step(r.state, { t: 'topup', id: 't1', amount: 1000 }).state).toEqual(r.state);
    // over the early cap (3,000): refused
    const full = step(r.state, { t: 'topup', id: 't2', amount: 2500 });
    expect(full.state.wallet.ic).toBe(1000);
  });
  it('a refund returns the balance less the fee as cash; the fee is spending', () => {
    const loaded = step(fresh1f(), { t: 'topup', id: 't1', amount: 2000 }).state;
    const r = step(loaded, { t: 'refund', id: 'r1' });
    expect(r.state.wallet.ic).toBe(0);
    expect(r.state.wallet.cash).toBe(1000 + 2000 - BALANCE.icRefundFee);
    expect(r.state.totals.spent).toBe(BALANCE.icRefundFee);
    expect(reconcile(r.state, 3000).ok).toBe(true);
    expect(step(r.state, { t: 'refund', id: 'r1' }).state).toEqual(r.state);
  });
  it('a fare is charged once from the right pocket, the round trip up front', () => {
    const s = step(step(fresh1f(), { t: 'topup', id: 't1', amount: 1000 }).state, { t: 'fare', id: 'f1', place: 'hikarigaoka', method: 'ic', legs: 2 });
    expect(s.state.wallet.ic).toBe(1000 - 340);
    expect(s.derived).toContainEqual({ t: 'wallet_changed', delta: -340, balance: 660, kind: 'fare' });
    expect(step(s.state, { t: 'fare', id: 'f1', place: 'hikarigaoka', method: 'ic', legs: 2 }).state).toEqual(s.state);
    const paper = step(fresh1f(), { t: 'fare', id: 'f2', place: 'shinjuku', method: 'paper' });
    expect(paper.state.wallet.cash).toBe(3000 - 200);
    expect(paper.effects).toEqual(expect.any(Array));
  });
  it('a fare the card cannot cover or to an unknown place is refused', () => {
    expect(step(fresh1f(), { t: 'fare', id: 'f1', place: 'hikarigaoka', method: 'ic' }).state.wallet).toEqual({ cash: 3000, ic: 0, points: 0 });
    expect(step(fresh1f(), { t: 'fare', id: 'f2', place: 'nowhere', method: 'cash' }).state.wallet.cash).toBe(3000);
  });
});

describe('conversations', () => {
  it('pays the loop through the ledger, records the run and counts the day as active', () => {
    const f = facts1f({ ind: 4, done: 3, total: 3, accuracy: 90 });
    const r = step(fresh1f(), { t: 'conversation_done', facts: f });
    expect(r.state.wallet.cash).toBeGreaterThan(3000);
    expect(r.state.runs.konbini).toMatchObject({ count: 1, complete: true, stars: 3 });
    expect(r.state.clock).toMatchObject({ activeDays: 1, lastActiveDay: 0 });
    expect(r.derived.some((d) => d.t === 'loop_settled')).toBe(true);
    expect(reconcile(r.state, 3000).ok).toBe(true);
    expect(r.state.coach.recent).toHaveLength(1);
  });
  it('replaying a finished conversation changes nothing: no second pay, no second counter bump', () => {
    const ev: InputEvent = { t: 'conversation_done', facts: facts1f({ ind: 4, done: 3, total: 3 }) };
    const once = step(fresh1f(), ev);
    const twice = step(once.state, ev);
    expect(twice.state).toEqual(once.state);
    expect(twice.derived).toEqual([]);
    // the counters count it once (the trio itself appears when chapter 1 closes)
    expect(once.state.daily.counters[0]?.indep_lines).toBe(4);
  });
  it('an abandoned conversation pays nothing, counts no active day and is still remembered once', () => {
    const f = facts1f({ ind: 2, done: 1, total: 3, abandoned: true });
    const r = step(fresh1f(), { t: 'conversation_done', facts: f });
    expect(r.state.wallet.cash).toBe(3000);
    expect(r.state.clock.activeDays).toBe(0);
    expect(step(r.state, { t: 'conversation_done', facts: f }).state).toEqual(r.state);
  });
  it('the first completion of a scenario applies its effects once', () => {
    const talk = (id: string) => facts1f({ scenarioId: 'heart_mio', characterId: 'mio', sessionId: id, ind: 3, done: 2, total: 2 });
    const a = step(fresh1f(), { t: 'conversation_done', facts: talk('a') });
    expect(a.state.chapter.flags).toContain('heart5_seen');
    const b = step({ ...a.state, chapter: { ...a.state.chapter, flags: [] } }, { t: 'conversation_done', facts: talk('b') });
    expect(b.state.chapter.flags).not.toContain('heart5_seen');
  });
  it('facts flags go to the story, or to the friend for friend flags', () => {
    const r = step(fresh1f(), { t: 'conversation_done', facts: facts1f({ scenarioId: 'smalltalk_mio', characterId: 'mio', flags: ['plan_mio', 'casual', 'number_note'], goalTotal: 2, done: 2 }) });
    expect(r.state.chapter.flags).toEqual(['plan_mio']);
    expect(r.state.friends.mio?.flags).toEqual(expect.arrayContaining(['casual', 'number_note']));
    expect(r.state.culture.cc_keigo).toBeDefined();
  });
  it('the ramen ticket is used up by a conversation that starts at the ticket node', () => {
    const s = step(fresh1f(), { t: 'ticket_bought', kind: 'ramen', flavor: 'miso' }).state;
    expect(s.tickets.ramen).toEqual({ flavor: 'miso' });
    const r = step(s, { t: 'conversation_done', facts: facts1f({ scenarioId: 'ramen', startNode: 'start_ticket', characterId: 'tanaka' }) });
    expect(r.state.tickets.ramen).toBeUndefined();
  });
  it('a home visit files the home place for `visit` objectives', () => {
    const r = step(fresh1f(), { t: 'conversation_done', facts: facts1f({ scenarioId: 'home_mio', characterId: 'mio', ind: 3, done: 2, total: 2 }) });
    expect(r.state.stats.visits).toContain('home:mio');
  });
  it('the coach keeps the last conversations and offers a card from them', () => {
    let s = fresh1f();
    for (let i = 0; i < 4; i++) s = step(s, { t: 'conversation_done', facts: facts1f({ sessionId: `c${i}`, scenarioId: i % 2 ? 'cafe' : 'konbini', ind: 6, done: 3, total: 3 }) }, dayAt(i)).state;
    expect(s.coach.recent).toHaveLength(4);
    expect(s.coach.sinceChange).toBe(4);
    s = step(s, { t: 'coach_choice', card: 'real', scenarioId: 'konbini' }).state;
    expect(s.coach.realFor).toEqual(['konbini']);
    expect(s.coach.sinceChange).toBe(0);
    expect(step(s, { t: 'coach_choice', card: 'help' }).state.audio.ttsRateScale).toBe(BALANCE.adaptive.helpTtsRate);
  });
});

describe('friends', () => {
  const talk = (id: string, extra: Partial<ConversationFacts> = {}) => ({ t: 'conversation_done' as const, facts: facts1f({ sessionId: id, scenarioId: 'smalltalk_mio', characterId: 'mio', ind: 3, ass: 1, done: 3, total: 3, ...extra }) });
  it('a first talk gives the +20 met bonus and the talk AP once per day', () => {
    const a = step(fresh1f(), talk('t1'));
    expect(a.state.friends.mio).toMatchObject({ met: true });
    expect(a.state.friends.mio!.ap).toBe(20 + 5 + 3);
    expect(hearts(a.state, 'mio')).toBe(0);
    const b = step(a.state, talk('t2'));
    expect(b.state.friends.mio!.ap).toBe(a.state.friends.mio!.ap);
    const next = step(b.state, talk('t3'), dayAt(1));
    expect(next.state.friends.mio!.ap).toBe(a.state.friends.mio!.ap + 8);
    expect(next.derived.some((d) => d.t === 'hearts_changed')).toBe(true);
    expect(hearts(next.state, 'mio')).toBe(1);
  });
  it('a shop conversation with a friend character counts as a talk too', () => {
    const r = step(fresh1f(), { t: 'conversation_done', facts: facts1f({ ind: 3, done: 3, total: 3 }) });
    expect(r.state.friends.tanaka?.met).toBe(true);
  });
  it('hang-outs need hearts, a friend heart event pays once', () => {
    const base = fresh1f();
    const none = step(base, talk('h1', { scenarioId: 'hang_mio' }));
    expect(none.state.friends.mio?.hangoutDay).toBeUndefined();
    const liked = { ...base, friends: { mio: { ...step(base, talk('x')).state.friends.mio!, ap: 160 } } };
    const hang = step(liked, talk('h2', { scenarioId: 'hang_mio' }), dayAt(3));
    expect(hang.state.friends.mio!.ap).toBeGreaterThan(160);
    expect(hang.state.stats.hangouts.mio).toBe(1);
    const ev = step(liked, { t: 'heart_event_done', friendId: 'mio', level: 2 });
    expect(ev.state.friends.mio!.ap).toBe(160 + BALANCE.ap.event);
    expect(step(ev.state, { t: 'heart_event_done', friendId: 'mio', level: 2 }).state).toEqual(ev.state);
  });
  it('a phone chat pays from 2 hearts, once per session id, and clears its thread', () => {
    const f = facts1f({ sessionId: 'ch1', scenarioId: 'chat_greet', characterId: 'mio', ind: 2, done: 1, total: 1 });
    const base = fresh1f();
    const mio = { ...step(base, talk('x')).state.friends.mio!, ap: 90, threads: [{ template: 'chat_greet', day: 0 }], unread: 1 };
    const s = { ...base, friends: { mio } };
    const r = step(s, { t: 'phone_chat_done', friendId: 'mio', sessionId: 'ch1', facts: f });
    expect(r.state.friends.mio!.ap).toBe(94);
    expect(r.state.friends.mio!.threads).toEqual([]);
    expect(r.state.stats.chats).toEqual({ n: 1, friends: { mio: 1 } });
    expect(step(r.state, { t: 'phone_chat_done', friendId: 'mio', sessionId: 'ch1', facts: f }).state).toEqual(r.state);
    // under 2 hearts: nothing
    expect(step(base, { t: 'phone_chat_done', friendId: 'mio', sessionId: 'ch2', facts: f }).state.stats.chats.n).toBe(0);
  });
  it('a gift: buy it in a conversation, hand it over, the friend reacts and the stock goes down; replays do nothing', () => {
    const bought = step(fresh1f(), buy('g1', 'g_flower', 'aiko', 480), NOW, view1f(), { ...pack }).state;
    // the aiko shop opens in chapter 2
    expect(bought.owned.g_flower).toBeUndefined();
    const ch2 = { ...fresh1f(), chapter: { ...fresh1f().chapter, n: 2 } };
    const have = step(ch2, buy('g1', 'g_flower', 'aiko', 480)).state;
    expect(have.owned.g_flower?.qty).toBe(1);
    const given = step(have, { t: 'gift_given', friendId: 'aiko', itemId: 'g_flower', sessionId: 'gs1', assistedHandover: false });
    expect(given.state.owned.g_flower).toBeUndefined();
    expect(given.derived).toContainEqual(expect.objectContaining({ t: 'gift_reacted', friendId: 'aiko', itemId: 'g_flower', reaction: 'liked' }));
    expect(given.state.stats.gifts.n).toBe(1);
    expect(given.state.culture.cc_gift).toBeDefined();
    expect(step(given.state, { t: 'gift_given', friendId: 'aiko', itemId: 'g_flower', sessionId: 'gs1', assistedHandover: false }).state).toEqual(given.state);
    // an item that is not owned: refused, nothing changes
    expect(step(fresh1f(), { t: 'gift_given', friendId: 'mio', itemId: 'g_manga', sessionId: 'gs2', assistedHandover: false }).derived).toEqual([]);
  });
});

describe('shifts, lessons, srs, prepare and the small events', () => {
  const shiftResult = (id: string, jobId = 'job_konbini') => ({
    id,
    jobId,
    quit: false,
    durationSec: 200,
    assistWaived: true,
    customers: Array.from({ length: 5 }, (_, i) => ({
      templateId: `k_${'abcd'[i % 4]}`,
      served: true,
      assist: 'none' as const,
      tasks: [
        { kind: 'order' as const, ok: true },
        { kind: 'total' as const, ok: true, input: 'typed' as const },
        { kind: 'thanks' as const, ok: true, input: 'typed' as const },
      ],
    })),
  });
  it('a shift pays through the ledger once and updates the job; the third is refused', () => {
    const base = { ...fresh1f(), chapter: { ...fresh1f().chapter, n: 2 } };
    const a = step(base, { t: 'shift_done', jobId: 'job_konbini', result: shiftResult('sh1') });
    expect(a.state.wallet.cash).toBeGreaterThan(3000);
    expect(a.state.jobs.job_konbini).toMatchObject({ shifts: 1, good: 1, perfect: 1 });
    expect(a.derived.some((d) => d.t === 'shift_settled')).toBe(true);
    expect(a.state.clock.activeDays).toBe(1);
    expect(step(a.state, { t: 'shift_done', jobId: 'job_konbini', result: shiftResult('sh1') }).state).toEqual(a.state);
    const b = step(a.state, { t: 'shift_done', jobId: 'job_konbini', result: shiftResult('sh2') });
    const c = step(b.state, { t: 'shift_done', jobId: 'job_konbini', result: shiftResult('sh3') });
    expect(c.state.jobs.job_konbini!.shifts).toBe(2);
  });
  it('a lesson counts once a day; srs reviews count their keys', () => {
    const a = step(fresh1f(), { t: 'lesson_done', id: 'greetings' });
    expect(a.state.clock.activeDays).toBe(1);
    expect(step(a.state, { t: 'lesson_done', id: 'greetings' }).state).toEqual(a.state);
    expect(step(a.state, { t: 'lesson_done', id: 'greetings' }, dayAt(1)).state.seen.length).toBe(a.state.seen.length + 1);
    const r = step(fresh1f(), { t: 'srs_review', keys: ['a', 'b', 'c'], due: 2 });
    expect(r.state.stats.srsReviews).toBe(3);
  });
  it('prepare files seen and ready lines, makes phrase cards once, and a ready stamp is not downgraded', () => {
    const a = step(fresh1f(), { t: 'prepare_done', scenarioId: 'konbini', ready: ['p_konbini_1'], seen: ['p_konbini_1', 'p_konbini_2', 'nope'] });
    expect(a.state.prep).toEqual({ p_konbini_1: { s: 'ready', at: 0 }, p_konbini_2: { s: 'seen', at: 0 } });
    const ops = (a.effects.find((e) => e.t === 'srsOps') as { ops: Array<{ key: string; source: string; dueInMin: number }> }).ops;
    expect(ops.map((o) => o.key)).toEqual(['p_konbini_1', 'p_konbini_2']);
    expect(ops[0]).toMatchObject({ source: 'goal', dueInMin: BALANCE.srs.goalDueMin });
    const b = step(a.state, { t: 'prepare_done', scenarioId: 'konbini', ready: [], seen: ['p_konbini_1'] });
    expect(b.state.prep.p_konbini_1).toEqual({ s: 'ready', at: 0 });
    expect(b.effects.find((e) => e.t === 'srsOps')).toBeUndefined();
  });
  it('a sign makes a word card; discovery lives in the view', () => {
    const r = step(fresh1f(), { t: 'sign_found', id: 'sign_exit' });
    expect(r.effects).toEqual([{ t: 'srsOps', ops: [{ op: 'add', key: 'sign_exit', kind: 'word', source: 'sign', dueInMin: BALANCE.srs.signDueMin }] }]);
  });
  it('visits, spots and trips are distinct sets; a trip uses the paper ticket and rides', () => {
    let s = step(fresh1f(), { t: 'visit', place: 'park' }).state;
    s = step(s, { t: 'visit', place: 'park' }).state;
    s = step(s, { t: 'spot', id: 'pond' }).state;
    s = step(s, { t: 'spot', id: 'pond' }).state;
    expect(s.stats.visits).toEqual(['park']);
    expect(s.stats.spots).toEqual(['pond']);
    s = step(s, { t: 'ticket_bought', kind: 'station', place: 'hikarigaoka' }).state;
    expect(step(s, { t: 'ticket_bought', kind: 'station', place: 'hikarigaoka' }).state.stats.tickets).toBe(1);
    const t = step(s, { t: 'trip_done', id: 'hikarigaoka' });
    expect(t.state.stats.visits).toContain('trip:hikarigaoka');
    expect(t.state.tickets.station).toBeUndefined();
    expect(t.state.culture.cc_trainmanner).toBeDefined();
  });
  it('items are placed in the flat, the outfit keeps owned pieces, and both are idempotent', () => {
    const base = { ...fresh1f(), owned: { plant_pothos: { qty: 1, day: 'd0' }, yukata: { qty: 1, day: 'd0' } } };
    expect(step(base, { t: 'item_placed', slot: 'plant', itemId: 'plant_pothos' }).state.home.placed).toEqual({ plant: 'plant_pothos' });
    expect(step(base, { t: 'item_placed', slot: 'plant', itemId: 'nope' }).state.home.placed).toEqual({});
    const w = step(base, { t: 'outfit_changed', equipped: ['yukata', 'tee'], colours: {} });
    expect(w.state.outfit.equipped).toEqual(['yukata']);
    expect(step(w.state, { t: 'outfit_changed', equipped: ['yukata', 'tee'], colours: {} }).state).toEqual(w.state);
  });
  it('profile, audio mode, diary and letter writes validate their input', () => {
    let s = step(fresh1f(), { t: 'profile_set', nameKana: 'アリ', audio: { sttConsent: 'allowed', listenPref: 'off', micPref: 'bogus' as never }, dev: true, welcomeSeenDay: 3 }).state;
    expect(s.me.nameKana).toBe('アリ');
    expect(s.audio).toMatchObject({ sttConsent: 'allowed', listenPref: 'off', micPref: 'auto' });
    expect(s.flags).toEqual({ dev: true, welcomeSeenDay: 3 });
    expect(step(s, { t: 'profile_set', activeTitle: 't_ghost' }).state.activeTitle).toBeNull();
    s = step(s, { t: 'audio_mode', mode: 'type-only' }).state;
    expect(s.audio.lastMode).toBe('type-only');
    s = step(s, { t: 'diary_added', entry: { chapter: 3, ja: 'きょうは雨です。', assisted: false } }).state;
    expect(step(s, { t: 'diary_added', entry: { chapter: 3, ja: 'きょうは雨です。', assisted: false } }).state.diary).toHaveLength(1);
    expect(step(s, { t: 'diary_added', entry: { chapter: 99, ja: 'x', assisted: false } }).state.diary).toHaveLength(1);
    s = step(s, { t: 'letter_saved', sentences: [{ ja: '日本はたのしいです。', assisted: true }, { ja: ' ', assisted: false }] }).state;
    expect(s.letter).toEqual([{ ja: '日本はたのしいです。', assisted: true }]);
    expect(s.chapter.flags).toContain('letter_written');
  });
  it('flags are filed once, on the story or on a known friend', () => {
    let s = step(fresh1f(), { t: 'flag', id: 'ticket_bought' }).state;
    s = step(s, { t: 'flag', id: 'ticket_bought' }).state;
    expect(s.chapter.flags).toEqual(['ticket_bought']);
    s = step(s, { t: 'flag', id: 'casual', friendId: 'mio' }).state;
    expect(s.friends.mio!.flags).toEqual(['casual']);
    expect(step(s, { t: 'flag', id: 'x', friendId: 'ghost' }).state).toEqual(step(s, { t: 'day_observed', nowMs: NOW }).state);
  });
});

describe('beats, culture and the story', () => {
  it('a beat is filed once and applies its effects once', () => {
    const base = fresh1f();
    const a = step(base, { t: 'beat_done', id: 'b_ch2_close' });
    expect(a.state.beats).toEqual(['b_ch2_close']);
    expect(a.state.titles).toContain('t_friend');
    expect(a.state.culture.cc_gift).toBeDefined();
    expect(a.state.friends.mio!.flags).toContain('number_note');
    expect(a.state.owned.g_flower?.qty).toBe(2);
    expect(a.derived).toEqual(expect.arrayContaining([{ t: 'title_earned', id: 't_friend' }, { t: 'culture_unlocked', id: 'cc_gift' }, { t: 'unlocked', what: 'item', id: 'g_flower' }]));
    expect(step(a.state, { t: 'beat_done', id: 'b_ch2_close' }).state).toEqual(a.state);
    const c1 = step(base, { t: 'beat_done', id: 'b_ch1_close' });
    expect(c1.state.chapter.flags).toContain('ch1_closed');
    expect(c1.state.keepsakes).toEqual(['k_first_hello']);
    expect(c1.state.stickers).toEqual(['st_first']);
    expect(c1.state.activeTitle).toBeNull();
  });
  it('culture cards unlock on their first trigger, with xp and a pop-up, and only once', () => {
    const a = step(fresh1f(), { t: 'conversation_done', facts: facts1f({ ind: 3, done: 3, total: 3 }) });
    expect(Object.keys(a.state.culture).sort()).toEqual(['cc_irasshaimase', 'cc_konbini']);
    expect(a.effects).toEqual(expect.arrayContaining([{ t: 'culture', id: 'cc_konbini' }, { t: 'xp', amount: BALANCE.cultureXp, why: 'culture' }]));
    const b = step(a.state, { t: 'conversation_done', facts: facts1f({ sessionId: 's2', ind: 3, done: 3, total: 3 }) });
    expect(b.derived.filter((d) => d.t === 'culture_unlocked')).toEqual([]);
  });
  it('a card tied to a character, a shop payment, a purchase count and an intent', () => {
    let s = step(fresh1f(), { t: 'conversation_done', facts: facts1f({ sessionId: 'h', scenarioId: 'park', characterId: 'hanako', ind: 2, done: 2, total: 2 }) }).state;
    expect(s.culture.cc_bow).toBeDefined();
    s = step(s, buy('p1', 'cafe:cake', 'cafe', 480)).state;
    expect(s.culture.cc_notip).toBeDefined();
    for (let i = 2; i <= 4; i++) s = step(s, buy(`p${i}`, 'konbini:onigiri', 'konbini', 160)).state;
    expect(s.culture.cc_points).toBeDefined();
    const intent = step(fresh1f(), { t: 'conversation_done', facts: facts1f({ ind: 1, done: 3, total: 3, turns: [turn(0, 'I', { intentId: 'greet' })] }) });
    expect(intent.state.culture.cc_irasshaimase2).toBeDefined();
  });
  it('adult-only cards stay hidden from a kids profile', () => {
    const kids = view1f({ age: 'kids' });
    const adult = view1f();
    const f = facts1f({ scenarioId: 'home_mio', characterId: 'mio', ind: 2, done: 2, total: 2 });
    const visit = { t: 'visit', place: 'home:aiko' } as const;
    expect(step(step(fresh1f(), { t: 'conversation_done', facts: f }, NOW, kids).state, visit, NOW, kids).state.culture.cc_adult).toBeUndefined();
    expect(step(fresh1f(), visit, NOW, adult).state.culture.cc_adult).toBeDefined();
  });
  it('culture_seen unlocks a card the reducer could not detect; culture_say needs an unlocked say-card and a pass', () => {
    expect(step(fresh1f(), { t: 'culture_seen', id: 'cc_trainmanner' }).state.culture.cc_trainmanner).toBeDefined();
    expect(step(fresh1f(), { t: 'culture_seen', id: 'nope' }).state.culture).toEqual({});
    const locked = step(fresh1f(), { t: 'culture_say', id: 'cc_gift', similarity: 0.9 });
    expect(locked.state.stats.cultureSaid).toEqual([]);
    const seen = step(fresh1f(), { t: 'culture_seen', id: 'cc_gift' }).state;
    expect(step(seen, { t: 'culture_say', id: 'cc_gift', similarity: 0.2 }).state.stats.cultureSaid).toEqual([]);
    const said = step(seen, { t: 'culture_say', id: 'cc_gift', similarity: 0.9 });
    expect(said.state.stats.cultureSaid).toEqual(['cc_gift']);
    expect(said.effects).toContainEqual({ t: 'srsOps', ops: [expect.objectContaining({ op: 'add', key: 'cc_gift', source: 'goal' })] });
    expect(step(said.state, { t: 'culture_say', id: 'cc_gift', similarity: 0.9 }).state).toEqual(said.state);
  });
  it('a class-I turn that says a key phrase counts for culture_said; a copied or assisted one does not', () => {
    const say = (norm: string, cls: 'I' | 'S') => step(fresh1f(), { t: 'conversation_done', facts: facts1f({ scenarioId: 'park', characterId: 'hanako', turns: [turn(0, cls, { norm })], done: 1, total: 1 }) }).state.stats.cultureSaid;
    expect(say('よろしくおねがいします', 'I')).toEqual([]);
    expect(say('よろしくお願いします', 'I')).toEqual(['cc_bow']);
    expect(say('よろしくお願いします', 'S')).toEqual([]);
  });
  it('chapter 1 completes on its closing objective: reward once, next chapter, closing beat, daily goals appear', () => {
    const view = view1f({ lessons: ['greetings'], discovered: ['a', 'b', 'c', 'd'], saved: 5 });
    const f = facts1f({ ind: 4, done: 3, total: 3 });
    const r = step(fresh1f(), { t: 'conversation_done', facts: f }, NOW, view);
    expect(r.state.chapter.n).toBe(2);
    expect(r.state.chapter.completed).toEqual([1]);
    expect(r.state.ledger.some((e) => e.id === 'chapter:1')).toBe(true);
    expect(r.derived).toEqual(expect.arrayContaining([{ t: 'chapter_done', n: 1 }, { t: 'chapter_started', n: 2 }]));
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch1_close' });
    expect(r.state.daily.goals).toHaveLength(3);
    expect(reconcile(r.state, 3000).ok).toBe(true);
    expect(validateState(r.state, pack)).toEqual([]);
  });
  it('a duplicate event after a chapter completes does not complete it again', () => {
    const view = view1f({ lessons: ['greetings'], discovered: ['a', 'b', 'c', 'd'], saved: 5 });
    const ev: InputEvent = { t: 'conversation_done', facts: facts1f({ ind: 4, done: 3, total: 3 }) };
    const a = step(fresh1f(), ev, NOW, view);
    const b = step(a.state, ev, NOW, view);
    expect(b.state).toEqual(a.state);
  });
  it('day_observed asks for the beats that have not played yet, until they have', () => {
    const a = step(fresh1f(), { t: 'day_observed', nowMs: NOW });
    expect(a.effects).toEqual([{ t: 'beat', id: 'b_ch1_open' }]);
    const b = step(a.state, { t: 'beat_done', id: 'b_ch1_open' });
    expect(step(b.state, { t: 'day_observed', nowMs: NOW }).effects).toEqual([]);
  });
  it('easier_accept is free and permanent only when offered', () => {
    const s = fresh1f();
    expect(step(s, { t: 'easier_accept', objective: 'c1_5' }).state).toEqual(step(s, { t: 'day_observed', nowMs: NOW }).state);
    const tried = { ...s, chapter: { ...s.chapter, tries: { c1_5: 3 } } };
    const r = step(tried, { t: 'easier_accept', objective: 'c1_5' });
    expect(r.state.chapter.easier).toEqual(['c1_5']);
  });
  it('dream_chosen takes only a dream the player may have; switching keeps recorded steps', () => {
    const s = fresh1f();
    expect(step(s, { t: 'dream_chosen', id: 'phone_pal' }).state.dream.id).toBe('phone_pal');
    expect(step(s, { t: 'dream_chosen', id: 'car' }).state.dream.id).toBeNull(); // opens at Free Walk
    expect(step(s, { t: 'dream_chosen', id: 'flat' }, NOW, view1f({ age: 'kids' })).state.dream.id).toBeNull(); // 18+
    const withSteps = { ...s, dream: { id: 'phone_pal', steps: { pp_s1: 'd1' }, done: false } };
    const sw = step(withSteps, { t: 'dream_chosen', id: 'bike' }).state;
    expect(sw.dream).toEqual({ id: 'bike', steps: { pp_s1: 'd1' }, done: false });
    expect(step(sw, { t: 'dream_chosen', id: null }).state.dream.id).toBeNull();
  });
  it('daily_swap swaps once a day', () => {
    const view = view1f({ lessons: ['greetings'], discovered: ['a', 'b', 'c', 'd'], saved: 5 });
    const a = step(fresh1f(), { t: 'conversation_done', facts: facts1f({ ind: 4, done: 3, total: 3 }) }, NOW, view).state;
    const goal = a.daily.goals[0]!.id;
    const b = step(a, { t: 'daily_swap', goalId: goal }, NOW, view).state;
    expect(b.daily.swapUsed).toBe(true);
    expect(step(b, { t: 'daily_swap', goalId: b.daily.goals[0]!.id }, NOW, view).state).toEqual(b);
  });
});

describe('the story through the reducer', () => {
  const ch4 = (over: Partial<GameState> = {}): GameState => {
    const s = fresh1f();
    return { ...s, chapter: { ...s.chapter, n: 4, completed: [1, 2, 3], began: { dayIndex: 0, activeDays: 0 } }, clock: { ...s.clock, dayIndex: 8, activeDays: 7, lastActiveDay: 8 }, pay: { ...s.pay, day: 'd8' }, daily: { ...s.daily, day: 8 }, ...over };
  };
  const words25 = view1f({ reviewed: Array.from({ length: 25 }, (_, i) => `w${i}`) });

  it('the catch-up stipend closes the phone gap after 7 active days in chapter 4, once, as a perk', () => {
    const r = step(ch4(), { t: 'day_observed', nowMs: NOW }, NOW, words25);
    expect(r.state.wallet.cash).toBe(3000 + BALANCE.catchUp.max);
    expect(r.state.ledger.find((e) => e.id === 'perk:phone_fund')).toMatchObject({ kind: 'perk', delta: BALANCE.catchUp.max });
    expect(r.state.chapter.flags).toContain('phone_fund');
    expect(r.effects).toEqual(expect.arrayContaining([{ t: 'beat', id: 'b_phone_fund' }]));
    expect(step(r.state, { t: 'day_observed', nowMs: NOW }, NOW, words25).state.wallet.cash).toBe(r.state.wallet.cash);
    // before the 7th active day nothing is handed over
    expect(step(ch4({ clock: { ...ch4().clock, activeDays: 6 } }), { t: 'day_observed', nowMs: NOW }, NOW, words25).state.wallet.cash).toBe(3000);
  });

  it('a chapter completes once a day: chapter 2 waits for the next day even when its objectives already hold', () => {
    const view = view1f({ lessons: ['greetings'], discovered: ['a', 'b', 'c', 'd'], saved: 5 });
    let s = step(fresh1f(), { t: 'conversation_done', facts: facts1f({ scenarioId: 'konbini', ind: 4, done: 3, total: 3 }) }, NOW, view).state;
    expect(s.chapter.n).toBe(2);
    // chapter 2's cafe, ramen, shift and culture objectives
    s = step(s, { t: 'conversation_done', facts: facts1f({ sessionId: 's2', scenarioId: 'cafe', ind: 4, done: 3, total: 3 }) }, NOW, view).state;
    s = step(s, { t: 'conversation_done', facts: facts1f({ sessionId: 's3', scenarioId: 'ramen', ind: 3, done: 3, total: 3 }) }, NOW, view).state;
    s = { ...s, jobs: { job_konbini: { shifts: 1, good: 1, perfect: 0, rank: 0, recent: [] } }, stats: { ...s.stats, cultureSaid: ['cc_bow', 'cc_gift'] } };
    expect(step(s, { t: 'day_observed', nowMs: NOW }, NOW, view).state.chapter.n).toBe(2);
    // the next day, with a meaningful action (the second active day), it completes
    const next = step(s, { t: 'lesson_done', id: 'greetings' }, dayAt(1), view);
    expect(next.derived).toContainEqual({ t: 'chapter_done', n: 2 });
    expect(next.state.chapter.n).toBe(3);
    expect(next.state.ledger.some((e) => e.id === 'chapter:2')).toBe(true);
  });

  it('a dream steps forward with the events that satisfy its steps', () => {
    const base = ch4({ dream: { id: 'phone_pal', steps: {}, done: false } });
    const rich1 = rich(base, 30_000);
    const r = step(rich1, buy('p1', 'phone_used', 'denki', 24_800));
    expect(r.derived).toContainEqual({ t: 'dream_step_done', dream: 'phone_pal', step: 'pp_s3' });
    expect(r.state.dream.steps.pp_s3).toBe('d8');
  });

  it('a chapter reward lands once even when the wallet is full, and the books still balance', () => {
    const view = view1f({ lessons: ['greetings'], discovered: ['a', 'b', 'c', 'd'], saved: 5 });
    const full = rich(fresh1f(), pack.economy.walletCap);
    const r = step(full, { t: 'conversation_done', facts: facts1f({ ind: 4, done: 3, total: 3 }) }, NOW, view);
    expect(r.state.wallet.cash).toBe(pack.economy.walletCap);
    expect(r.state.chapter.n).toBe(2);
    expect(reconcile(r.state, 3000).ok).toBe(true);
  });
});

describe('dev tools', () => {
  it('are ignored unless the dev flag is on, then add cash, tick objectives, advance chapter and day', () => {
    const s = fresh1f();
    expect(step(s, { t: 'dev', cmd: 'cash', amount: 10_000 }).state.wallet.cash).toBe(3000);
    const dev = step(s, { t: 'profile_set', dev: true }).state;
    const cash = step(dev, { t: 'dev', cmd: 'cash', amount: 10_000 }).state;
    expect(cash.wallet.cash).toBe(13_000);
    expect(reconcile(cash, 3000).ok).toBe(true);
    // pressing it twice on the same tick adds twice (the cash is part of the id)
    expect(step(cash, { t: 'dev', cmd: 'cash', amount: 10_000 }).state.wallet.cash).toBe(23_000);
    const one = step(dev, { t: 'dev', cmd: 'complete_objective' }).state;
    expect(Object.keys(one.chapter.done)).toEqual(['c1_1']);
    const adv = step(dev, { t: 'dev', cmd: 'advance_chapter' }).state;
    expect(adv.chapter.n).toBe(2);
    expect(adv.chapter.completed).toEqual([1]);
    const day = step(dev, { t: 'dev', cmd: 'advance_day' }).state;
    expect(day.clock.dayIndex).toBe(1);
    expect(day.pay.day).toBe('d1');
    expect(validateState(adv, pack)).toEqual([]);
  });
});

describe('properties (§15.9)', () => {
  /** A seeded random event stream over the whole surface. */
  function randomEvents(seed: number, n: number): Array<[InputEvent, number]> {
    const r = rng(seed);
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
    const out: Array<[InputEvent, number]> = [];
    let day = 0;
    for (let i = 0; i < n; i++) {
      if (r() < 0.15) day += r() < 0.1 ? -1 : 1;
      const sid = `s${seed}_${i}`;
      const t = Math.floor(r() * 12);
      let ev: InputEvent;
      if (t === 0) ev = buy(sid, pick(['konbini:onigiri', 'konbini:coffee', 'cafe:cake', 'phone_used', 'bike_mamachari', 'g_flower']), pick(['konbini', 'cafe', 'denki', 'motors', 'aiko']), 100, { qty: 1 + Math.floor(r() * 4), n: 1 + Math.floor(r() * 2), method: pick(['cash', 'ic', 'card'] as const), usePoints: r() < 0.3, eatIn: r() < 0.3 });
      else if (t === 1) ev = { t: 'topup', id: sid, amount: pick([1000, 2000, 5000, 20_000]) };
      else if (t === 2) ev = { t: 'refund', id: sid };
      else if (t === 3) ev = { t: 'fare', id: sid, place: pick(['hikarigaoka', 'shinjuku', 'void']), method: pick(['ic', 'cash', 'paper'] as const), legs: pick([1, 2] as const) };
      else if (t <= 6) ev = { t: 'conversation_done', facts: facts1f({ sessionId: sid, scenarioId: pick(['konbini', 'cafe', 'park', 'smalltalk_mio', 'hang_mio']), characterId: pick(['tanaka', 'mio', 'hanako']), ind: Math.floor(r() * 6), ass: Math.floor(r() * 4), done: Math.floor(r() * 4), total: 3, abandoned: r() < 0.1, fallbacks: Math.floor(r() * 4) }) };
      else if (t === 7) ev = { t: 'gift_given', friendId: pick(['mio', 'aiko', 'tanaka']), itemId: pick(['g_flower', 'g_wagashi', 'g_manga']), sessionId: sid, assistedHandover: r() < 0.5 };
      else if (t === 8) ev = { t: 'echo', sessionId: pick(['e1', 'e2']), lineId: sid, similarity: r(), peeked: r() < 0.2 };
      else if (t === 9) ev = { t: 'visit', place: pick(['park', 'home:aiko', 'trip:hikarigaoka']) };
      else if (t === 10) ev = { t: 'lesson_done', id: pick(['greetings', 'ic']) };
      else ev = { t: 'day_observed', nowMs: dayAt(day) };
      out.push([ev, day]);
    }
    return out;
  }

  it('the wallet never goes negative or over its cap, and the ledger reconciles with totals and checksum after every event', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let s = rich(fresh1f(), 3000 + (seed % 5) * 20_000);
      for (const [ev, day] of randomEvents(seed, 60)) {
        s = step(s, ev, dayAt(day)).state;
        expect(s.wallet.cash).toBeGreaterThanOrEqual(0);
        expect(s.wallet.ic).toBeGreaterThanOrEqual(0);
        expect(s.wallet.points).toBeGreaterThanOrEqual(0);
        expect(s.wallet.cash).toBeLessThanOrEqual(pack.economy.walletCap);
        expect(reconcile(s, 3000), `seed ${seed}`).toMatchObject({ ok: true, mismatches: [] });
      }
      expect(validateState(s, pack).filter((i) => i.code !== 'reconcile')).toEqual([]);
    }
  });

  it('progress only moves forward: the clock, the chapter, stars, friendship, culture and the counters never go back', () => {
    for (let seed = 1; seed <= 15; seed++) {
      let s = fresh1f();
      for (const [ev, day] of randomEvents(seed, 80)) {
        const next = step(s, ev, dayAt(day)).state;
        expect(next.clock.dayIndex, `seed ${seed} ${ev.t}`).toBeGreaterThanOrEqual(s.clock.dayIndex);
        expect(next.clock.activeDays).toBeGreaterThanOrEqual(s.clock.activeDays);
        expect(next.chapter.n).toBeGreaterThanOrEqual(s.chapter.n);
        expect(next.chapter.completed.length).toBeGreaterThanOrEqual(s.chapter.completed.length);
        expect(Object.keys(next.chapter.done).length).toBeGreaterThanOrEqual(Object.keys(s.chapter.done).length);
        expect(Object.keys(next.culture).length).toBeGreaterThanOrEqual(Object.keys(s.culture).length);
        expect(next.stats.purchases).toBeGreaterThanOrEqual(s.stats.purchases);
        expect(next.totals.earned).toBeGreaterThanOrEqual(s.totals.earned);
        expect(next.totals.spent).toBeGreaterThanOrEqual(s.totals.spent);
        for (const [id, r] of Object.entries(s.runs)) expect(next.runs[id]!.stars).toBeGreaterThanOrEqual(r.stars);
        for (const id of Object.keys(s.friends)) expect(hearts(next, id)).toBeGreaterThanOrEqual(hearts(s, id));
        for (const [id, f] of Object.entries(s.friends)) expect(next.friends[id]!.ap).toBeGreaterThanOrEqual(f.ap);
        s = next;
      }
    }
  });

  it('a state is valid after EVERY event of a random game, not just at the end', () => {
    for (let seed = 30; seed <= 38; seed++) {
      let s = fresh1f();
      for (const [ev, day] of randomEvents(seed, 60)) {
        s = step(s, ev, dayAt(day)).state;
        expect(validateState(s, pack), `seed ${seed} after ${ev.t}`).toEqual([]);
      }
    }
  });

  it('replaying any id-bearing event twice equals playing it once', () => {
    for (let seed = 1; seed <= 25; seed++) {
      let s = fresh1f();
      for (const [ev, day] of randomEvents(seed, 40)) {
        const once = step(s, ev, dayAt(day));
        const twice = step(once.state, ev, dayAt(day));
        if (ev.t === 'srs_review') {
          s = once.state;
          continue;
        }
        expect(twice.state, `seed ${seed} ${ev.t}`).toEqual(once.state);
        s = once.state;
      }
    }
  });

  it('is deterministic given (state, event, ctx) and never mutates its input', () => {
    for (let seed = 1; seed <= 10; seed++) {
      let s = fresh1f();
      for (const [ev, day] of randomEvents(seed, 40)) {
        const a = step(s, ev, dayAt(day));
        const b = step(s, ev, dayAt(day));
        expect(a).toEqual(b);
        s = a.state;
      }
    }
  });

  it('transfers never touch earned or spent: only top-ups', () => {
    let s = fresh1f();
    for (let i = 0; i < 8; i++) s = step(s, { t: 'topup', id: `t${i}`, amount: i % 2 ? 1000 : 2000 }).state;
    expect(s.totals.earned + s.totals.spent).toBe(0);
    expect(s.wallet.cash + s.wallet.ic).toBe(3000);
  });

  it('every state it produces validates, in a long mixed game', () => {
    let s = fresh1f();
    for (const [ev, day] of randomEvents(99, 120)) {
      s = step(s, ev, dayAt(day)).state;
    }
    expect(validateState(s, pack)).toEqual([]);
    expect(dayKey(s.clock.dayIndex)).toBe(s.pay.day);
  });
});

describe('needsFlush', () => {
  it('flushes money, purchase and story events at once and debounces the rest', () => {
    const flush: InputEvent[] = [
      { t: 'conversation_done', facts: facts1f() },
      buy('p', 'konbini:onigiri', 'konbini', 160),
      { t: 'topup', id: 'a', amount: 1000 },
      { t: 'refund', id: 'b' },
      { t: 'fare', id: 'c', place: 'x', method: 'cash' },
      { t: 'beat_done', id: 'b_ch1_open' },
      { t: 'dream_chosen', id: null },
      { t: 'letter_saved', sentences: [] },
      { t: 'dev', cmd: 'cash' },
    ];
    const debounce: InputEvent[] = [{ t: 'visit', place: 'park' }, { t: 'spot', id: 'x' }, { t: 'srs_review', keys: [], due: 0 }, { t: 'day_observed', nowMs: 0 }, { t: 'audio_mode', mode: 'x' }, { t: 'profile_set' }];
    for (const e of flush) expect(needsFlush(e), e.t).toBe(true);
    for (const e of debounce) expect(needsFlush(e), e.t).toBe(false);
  });
});

describe('selectors', () => {
  const view = view1f();
  const stateAt = (over: Partial<GameState> = {}): GameState => ({ ...fresh1f(), ...over });

  it('hearts are derived from AP and the current chapter from the pack, null at Free Walk', () => {
    const s = stateAt({ friends: { mio: { ...step(fresh1f(), { t: 'conversation_done', facts: facts1f({ scenarioId: 'smalltalk_mio', characterId: 'mio' }) }).state.friends.mio!, ap: 155 } } });
    expect(hearts(s, 'mio')).toBe(3);
    expect(hearts(s, 'ghost')).toBe(0);
    expect(currentChapter(pack, fresh1f())?.n).toBe(1);
    expect(currentChapter(pack, stateAt({ chapter: { ...fresh1f().chapter, n: 9 } }))).toBeNull();
  });

  it('derived flags: phone, IC card, ride, speed, home tier, comfort, dream picker, Real mode', () => {
    const base = fresh1f();
    expect(derivedFlags(pack, base)).toMatchObject({ hasPhone: false, hasIc: false, speedMult: 1, homeTier: 'dorm', dreamUnlocked: false, realMode: false });
    expect(derivedFlags(pack, base).ride.mesh).toBe('none');
    const rich1 = stateAt({
      owned: { phone_used: { qty: 1, day: 'd0' }, ic_card: { qty: 1, day: 'd0' }, bike_mamachari: { qty: 1, day: 'd0' }, home_room_ono: { qty: 1, day: 'd0' } },
      home: { tier: 'ono', placed: {} },
      beats: ['b_ch1_close'],
      chapter: { ...base.chapter, n: 2 },
    });
    const f = derivedFlags(pack, rich1);
    expect(f).toMatchObject({ hasPhone: true, hasIc: true, speedMult: 1.5, homeTier: 'ono', dreamUnlocked: true, realMode: true });
    expect(f.ride.mesh).toBe('bike');
    expect(f.comfort).toBe(BALANCE.comfort.base.ono);
  });

  it('a pocket line is ready for 7 days after a recall pass, a known card never expires, a seen line is not ready', () => {
    const s = stateAt({ prep: { p_konbini_1: { s: 'ready', at: 3 }, p_konbini_2: { s: 'seen', at: 3 } }, clock: { ...fresh1f().clock, dayIndex: 9 } });
    expect(lineReady(s, view, 'p_konbini_1')).toBe(true);
    expect(lineReady({ ...s, clock: { ...s.clock, dayIndex: 10 } }, view, 'p_konbini_1')).toBe(false);
    expect(lineReady(s, view, 'p_konbini_2')).toBe(false);
    expect(lineReady({ ...s, clock: { ...s.clock, dayIndex: 400 } }, view1f({ known: ['p_konbini_1'] }), 'p_konbini_1')).toBe(true);
    expect(lineReady(s, view, 'unknown')).toBe(false);
  });

  it('a pocket is ready when every key line is ready and 60% of the rest', () => {
    const at = (prep: GameState['prep']) => pocketReady(pack, stateAt({ prep }), view, 'konbini');
    expect(at({})).toBe(false);
    // two key lines ready, the one other line not: 0 of 1 < 60%
    expect(at({ p_konbini_1: { s: 'ready', at: 0 }, p_konbini_2: { s: 'ready', at: 0 } })).toBe(false);
    expect(at({ p_konbini_1: { s: 'ready', at: 0 }, p_konbini_2: { s: 'ready', at: 0 }, p_konbini_3: { s: 'ready', at: 0 } })).toBe(true);
    expect(at({ p_konbini_1: { s: 'ready', at: 0 }, p_konbini_3: { s: 'ready', at: 0 } })).toBe(false);
    expect(pocketReady(pack, fresh1f(), view, 'cafe')).toBe(false); // no pocket
    expect(pocketReady(pack, fresh1f(), view, 'ghost')).toBe(false);
    // 60% of 3 other lines is 1.8 -> two are needed
    const p3 = pack1f({ pockets: { ...pack.pockets, p_konbini_3: { ...pack.pockets.p_konbini_3! }, p_x: { id: 'p_x', line: { ja: 'あ', en: 'a', ar: 'a' } } }, scenarioMeta: pack.scenarioMeta.map((m) => (m.id === 'konbini' ? { ...m, pocket: ['p_konbini_1', 'p_konbini_2', 'p_konbini_3', 'p_x'] } : m)) });
    const some = (ids: string[]) => pocketReady(p3, stateAt({ prep: Object.fromEntries(['p_konbini_1', 'p_konbini_2', ...ids].map((i) => [i, { s: 'ready' as const, at: 0 }])) }), view, 'konbini');
    expect(some([])).toBe(false);
    expect(some(['p_konbini_3'])).toBe(false);
    expect(some(['p_konbini_3', 'p_x'])).toBe(true);
  });

  it('the coach offers Real mode after three easy conversations and help after three struggles, never within three conversations of the last change', () => {
    const conv = (r: number, fallbacks = 0) => ({ day: 0, scenarioId: 'konbini', r, fallbacks });
    const state = (recent: GameState['coach']['recent'], sinceChange = 3): GameState => stateAt({ coach: { recent, realFor: [], sinceChange } });
    expect(coachOffer(state([conv(0.9), conv(0.8), conv(0.76)]))).toBe('real');
    expect(coachOffer(state([conv(0.9), conv(0.8), conv(0.7)]))).toBeNull();
    expect(coachOffer(state([conv(0.2, 1), conv(0.3, 1), conv(0.1, 0)]))).toBe('help');
    expect(coachOffer(state([conv(0.2, 0), conv(0.3, 1), conv(0.1, 0)]))).toBeNull();
    expect(coachOffer(state([conv(0.2, 1), conv(0.5, 1), conv(0.1, 1)]))).toBeNull();
    expect(coachOffer(state([conv(0.9), conv(0.9)]))).toBeNull();
    expect(coachOffer(state([conv(0.9), conv(0.9), conv(0.9)], 2))).toBeNull();
    // only the last three count
    expect(coachOffer(state([conv(0.1, 3), conv(0.9), conv(0.9), conv(0.9)]))).toBe('real');
  });

  it('the HUD discloses one thing at a time (§2.5)', () => {
    const d0 = disclosure(pack, fresh1f(), view);
    expect(d0).toEqual({ dreamChip: false, dailyGoals: false, friends: false, phoneIcon: false, mapPins: false, fullLedgerRows: false, friendsStrip: false, realMode: false, compactDebrief: true });
    const closed = stateAt({ beats: ['b_ch1_close'] });
    expect(disclosure(pack, closed, view)).toMatchObject({ dreamChip: true, dailyGoals: true, friends: false });
    const ch3 = stateAt({ chapter: { ...fresh1f().chapter, n: 3 } });
    expect(disclosure(pack, ch3, view)).toMatchObject({ friends: true, friendsStrip: true, fullLedgerRows: true, compactDebrief: false, realMode: true, phoneIcon: false });
    const phone = stateAt({ chapter: { ...fresh1f().chapter, n: 4 }, owned: { phone_used: { qty: 1, day: 'd0' } } });
    expect(disclosure(pack, phone, view)).toMatchObject({ phoneIcon: true, mapPins: true });
    // the 4th conversation turns the full ledger on, even in chapter 1
    const runs = Object.fromEntries(['konbini', 'cafe', 'park', 'ramen'].map((id) => [id, { count: 1, complete: true, stars: 1 as const, bestIndependent: 1, bestShare: 1, bestR: 1, steps: [] }]));
    expect(disclosure(pack, stateAt({ runs: { konbini: runs.konbini!, cafe: runs.cafe!, park: runs.park! } }), view).compactDebrief).toBe(true);
    expect(disclosure(pack, stateAt({ runs }), view)).toMatchObject({ fullLedgerRows: true, compactDebrief: false });
  });

  it('audio mode, speech rate, due cards, away days and the Real-mode default', () => {
    const s = fresh1f();
    const consent = (a: Partial<GameState['audio']>): GameState => ({ ...s, audio: { ...s.audio, ...a } });
    expect(audioMode(consent({ sttConsent: 'allowed' }), { jaVoice: true, stt: true })).toBe('full-voice');
    expect(audioMode(consent({ sttConsent: 'declined' }), { jaVoice: true, stt: true })).toBe('listen-and-type');
    expect(audioMode(consent({ sttConsent: 'allowed', micPref: 'off' }), { jaVoice: true, stt: true })).toBe('listen-and-type');
    expect(audioMode(consent({ sttConsent: 'allowed', listenPref: 'off' }), { jaVoice: true, stt: true })).toBe('read-and-type');
    expect(audioMode(consent({ sttConsent: 'allowed' }), { jaVoice: false, stt: false })).toBe('type-only');
    expect(ttsRate(pack, s, view)).toBe(1);
    expect(ttsRate(pack, consent({ ttsRateScale: BALANCE.adaptive.helpTtsRate }), view)).toBeCloseTo(0.85);
    expect(dueCount(view1f({ due: 12 }))).toBe(12);
    expect(awayDays(s, NOW + 5 * 86_400_000 + 1000)).toBe(5);
    expect(awayDays({ ...s, clock: { ...s.clock, lastSeenAt: 0 } }, NOW)).toBe(0);
    expect(defaultsToReal({ ...s, coach: { ...s.coach, realFor: ['konbini'] } }, 'konbini')).toBe(true);
    expect(defaultsToReal(s, 'konbini')).toBe(false);
  });

  it('the tracked dream shows its progress: the silent default until the picker, then the choice', () => {
    const s = fresh1f();
    expect(activeDreamProgress(pack, s, view1f({ goal: 'work' }))?.dream).toBe('phone_pal');
    expect(activeDreamProgress(pack, stateAt({ beats: ['b_ch1_close'] }), view)).toBeNull();
    expect(activeDreamProgress(pack, stateAt({ beats: ['b_ch1_close'], dream: { id: 'bike', steps: {}, done: false } }), view)?.dream).toBe('bike');
  });
});
