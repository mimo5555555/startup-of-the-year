import { describe, expect, it } from 'vitest';
import { reconcile } from '../src/ledger';
import { chapterStatus, deriveCompleted, evalPred, evaluateAll, isOpen, openChapter, prerequisiteIssues, requires } from '../src/objectives';
import { apFor, BALANCE, CHAPTERS, ctxOf, DREAMS, ECON, friendAt, mkQuestPack, mkRun, mkState, mkView, rng, withDone } from './fixtures-quest';
import type { ChapterDef, GamePack, GameState, GameView, Pred, Requirement } from '../src/types';

const pack = mkQuestPack();

/** A view and state in which every Chapter 1 objective holds (chapter 1, day 0, one active day). */
function ch1Complete(): { state: GameState; view: GameView } {
  const view = mkView({ lessons: ['greetings'], discovered: ['a', 'b', 'c', 'd'], saved: 5 });
  const s = mkState({ activeDays: 1 });
  return { view, state: { ...s, runs: { konbini: mkRun({ complete: true, stars: 1, bestIndependent: 2 }) }, stats: { ...s.stats, sayNew: 3 } } };
}

const run = (state: GameState, view: GameView, now = 1_700_000_000_000) => evaluateAll(state, ctxOf(pack, view, now));

describe('ticking objectives', () => {
  it('a fresh state ticks nothing and reports nothing', () => {
    const r = run(mkState(), mkView());
    expect(r.state).toEqual(mkState());
    expect(r.derived).toEqual([]);
    expect(r.effects).toEqual([]);
  });

  it('records the day an objective first held, with a derived event and a toast, and never reverts it', () => {
    const view = mkView({ lessons: ['greetings'] });
    const s = mkState({ dayIndex: 4 });
    const r = run(s, view);
    expect(r.state.chapter.done).toEqual({ c1_1: 'd4' });
    expect(r.derived).toEqual([{ t: 'objective_done', id: 'c1_1' }]);
    expect(r.effects).toContainEqual({ t: 'toast', key: 'quests.objectiveDone', vars: { id: 'c1_1' } });
    // the lesson list shrinking (a reset view) does not un-tick it
    const later = run({ ...r.state, clock: { ...r.state.clock, dayIndex: 6 } }, mkView());
    expect(later.state.chapter.done.c1_1).toBe('d4');
  });

  it('is retroactive: an objective that already holds completes at once when its chapter becomes current', () => {
    // chapter 2 starts with the cafe already played and a shift already worked
    const s = mkState({ chapter: 2, dayIndex: 3, activeDays: 3, began: { dayIndex: 3, activeDays: 3 } });
    const rich = { ...s, runs: { cafe: mkRun({ complete: true, stars: 1, bestIndependent: 5 }) }, jobs: { job_konbini: { shifts: 1, good: 1, perfect: 0, rank: 0, recent: [] } } };
    const r = run(rich, mkView());
    expect(Object.keys(r.state.chapter.done).sort()).toEqual(['c2_1', 'c2_3']);
  });

  it('a dream-slot objective never blocks and is never ticked', () => {
    const { state, view } = ch1Complete();
    const r = run(state, view);
    expect(r.state.chapter.done.c1_star).toBeUndefined();
    expect(r.state.chapter.completed).toContain(1);
  });
});

describe('chapter completion', () => {
  it('pays the reward once through the ledger, grants title, culture and beats, and starts the next chapter', () => {
    const { state, view } = ch1Complete();
    const r = run(state, view, 1_700_000_001_000);
    expect(r.state.chapter.n).toBe(2);
    expect(r.state.chapter.completed).toEqual([1]);
    expect(r.state.wallet.cash).toBe(state.wallet.cash + 2_500);
    expect(r.state.ledger).toEqual([{ id: 'chapter:1', at: 1_700_000_001_000, kind: 'chapter', delta: 2_500, pocket: 'cash', ref: 'ch1' }]);
    expect(reconcile(r.state, ECON.startCash).ok).toBe(true);
    expect(r.state.titles).toEqual(['t_newcomer']);
    expect(Object.keys(r.state.culture).sort()).toEqual(['cc_bow', 'cc_irasshaimase']);
    expect(r.state.chapter.began).toEqual({ dayIndex: 0, activeDays: 1 });
    expect(r.derived).toContainEqual({ t: 'chapter_done', n: 1 });
    expect(r.derived).toContainEqual({ t: 'chapter_started', n: 2 });
    expect(r.derived).toContainEqual({ t: 'title_earned', id: 't_newcomer' });
    expect(r.derived).toContainEqual({ t: 'wallet_changed', delta: 2_500, balance: state.wallet.cash + 2_500, kind: 'chapter' });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch1_close' });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch2_open' });
    expect(r.effects).toContainEqual({ t: 'fanfare', kind: 'chapter' });
    expect(r.effects).toContainEqual({ t: 'toast', key: 'quests.chapterDone', vars: { n: 1 } });
    expect(r.effects.filter((e) => e.t === 'culture')).toHaveLength(2);
  });

  it('what chapter 2 opens is announced when it becomes current, with the items and dreams gated on it (D36)', () => {
    const { state, view } = ch1Complete();
    const r = run(state, view);
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'job', id: 'job_konbini' });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'shop', id: 'ramen' });
    // no item of the fixture opens at chapter 2
    expect(r.derived.filter((d) => d.t === 'unlocked' && d.what === 'item')).toEqual([]);
  });

  it('a chapter does not complete before its objectives and minDays are met', () => {
    const { state, view } = ch1Complete();
    // minDays 1: with zero active days the chapter waits, the status says how long
    const early = { ...state, clock: { ...state.clock, activeDays: 0 } };
    const r = run(early, view);
    expect(r.state.chapter.n).toBe(1);
    expect(r.state.chapter.completed).toEqual([]);
    expect(r.state.wallet.cash).toBe(early.wallet.cash);
    expect(chapterStatus(pack, r.state, view)).toEqual({ n: 1, done: 5, total: 5, waitDays: 1, gated: false });
    // the day passes: it completes on the first evaluation after
    const later = run({ ...r.state, clock: { ...r.state.clock, activeDays: 1 } }, view);
    expect(later.state.chapter.n).toBe(2);
    // one objective short never completes however many days pass
    const short = run({ ...state, stats: { ...state.stats, sayNew: 2 }, clock: { ...state.clock, activeDays: 99 } }, view);
    expect(short.state.chapter.n).toBe(1);
    expect(chapterStatus(pack, short.state, view)).toEqual({ n: 1, done: 4, total: 5, waitDays: 0, gated: false });
  });

  it('the easier alternative can finish the chapter', () => {
    const { state, view } = ch1Complete();
    const s = { ...state, stats: { ...state.stats, sayNew: 2 }, chapter: { ...state.chapter, easier: ['c1_5'] } };
    expect(run(s, view).state.chapter.n).toBe(2);
  });

  it('completes at most one chapter per day, even when the next one already holds', () => {
    const view = mkView({ lessons: ['greetings'], discovered: ['a', 'b', 'c', 'd'], saved: 5, surfaces: [] });
    const base = ch1Complete().state;
    const s: GameState = {
      ...base,
      clock: { ...base.clock, activeDays: 5 },
      runs: {
        konbini: base.runs.konbini,
        cafe: mkRun({ complete: true, stars: 1, bestIndependent: 5 }),
        ramen: mkRun({ complete: true, stars: 1, bestIndependent: 5 }),
      },
      jobs: { job_konbini: { shifts: 1, good: 1, perfect: 0, rank: 0, recent: [] } },
      stats: { ...base.stats, cultureSaid: ['cc_notip', 'cc_bow'] },
    };
    const day0 = run(s, view);
    // chapter 1 completed today; chapter 2 became current and ticked off retroactively, but it waits for tomorrow
    expect(day0.state.chapter.n).toBe(2);
    expect(day0.state.chapter.completed).toEqual([1]);
    expect(Object.keys(day0.state.chapter.done)).toEqual(expect.arrayContaining(['c2_1', 'c2_2', 'c2_3', 'c2_4']));
    expect(chapterStatus(pack, day0.state, view).waitDays).toBe(1);
    // another evaluation the same day changes nothing
    expect(run(day0.state, view).state).toEqual(day0.state);
    // tomorrow's first evaluation completes it
    const day1 = run({ ...day0.state, clock: { ...day0.state.clock, dayIndex: 1 } }, view);
    expect(day1.state.chapter.n).toBe(3);
    expect(day1.state.chapter.completed).toEqual([1, 2]);
    expect(day1.state.wallet.cash).toBe(s.wallet.cash + 2_500 + 2_500);
  });

  it('replaying the same completion never pays twice (ledger id chapter:n)', () => {
    const { state, view } = ch1Complete();
    const done = run(state, view).state;
    // a rolled-back chapter pointer (a restored cache) re-derives completion but the ledger already has the id
    const replay = run({ ...done, chapter: { ...done.chapter, n: 1, completed: [] } }, view);
    expect(replay.state.wallet.cash).toBe(done.wallet.cash);
    expect(replay.state.ledger).toHaveLength(1);
  });

  it('Free Walk (chapter 9) follows the last chapter and opens what is gated on 9', () => {
    const base = mkState({ chapter: 5, activeDays: 20, dayIndex: 30, began: { dayIndex: 25, activeDays: 12 } });
    const s = withDone(base, 5);
    const r = run(s, mkView());
    expect(r.state.chapter.n).toBe(BALANCE.freeWalkChapter);
    expect(r.state.chapter.completed).toContain(5);
    expect(r.derived).toContainEqual({ t: 'chapter_started', n: 9 });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'item', id: 'car_kei_used' });
    expect(r.derived).toContainEqual({ t: 'unlocked', what: 'dream', id: 'car' });
    // at Free Walk there is no chapter to complete and nothing more to do
    expect(run(r.state, mkView()).derived).toEqual([]);
    expect(chapterStatus(pack, r.state, mkView())).toEqual({ n: 9, done: 0, total: 0, waitDays: 0, gated: false });
  });
});

describe('a start gate (Chapter 6 in the real pack)', () => {
  // fixture chapter 5 needs a friend at three hearts to start
  const finished4 = (): GameState => withDone(mkState({ chapter: 4, activeDays: 12, dayIndex: 12, began: { dayIndex: 4, activeDays: 4 } }), 4);

  it('the finished chapter is paid, then waits: it keeps chapter.n and reports the gate', () => {
    const view = mkView();
    const r = run(finished4(), view);
    expect(r.state.chapter.n).toBe(4);
    expect(r.state.chapter.completed).toEqual([4]);
    expect(r.state.wallet.cash).toBe(ECON.startCash + 4_000);
    expect(r.derived).toContainEqual({ t: 'chapter_done', n: 4 });
    expect(r.derived.some((d) => d.t === 'chapter_started')).toBe(false);
    expect(chapterStatus(pack, r.state, view)).toMatchObject({ n: 4, done: 4, total: 4, waitDays: 0, gated: true });
    // nothing more happens until the gate opens, and nothing is paid again
    const again = run(r.state, view);
    expect(again.state).toEqual(r.state);
    expect(again.derived).toEqual([]);
  });

  it('opens when a friend reaches the hearts, and then starts the chapter', () => {
    const view = mkView();
    const waiting = run(finished4(), view).state;
    const twoHearts = { ...waiting, friends: { mio: friendAt(apFor(2)) } };
    expect(run(twoHearts, view).state.chapter.n).toBe(4);
    const threeHearts = { ...waiting, friends: { mio: friendAt(apFor(3)) } };
    const r = run(threeHearts, view);
    expect(r.state.chapter.n).toBe(5);
    expect(r.derived).toContainEqual({ t: 'chapter_started', n: 5 });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_ch5_open' });
    expect(r.state.wallet.cash).toBe(waiting.wallet.cash);
  });
});

describe('the catch-up stipend (§4.5)', () => {
  /** chapter 4, 7 active days in, every objective that needs no phone done. */
  const stuck = (cash: number, extra: Partial<GameState> = {}): GameState => {
    const s = withDone(mkState({ chapter: 4, cash, activeDays: 11, dayIndex: 11, began: { dayIndex: 4, activeDays: 4 } }), 4, ['c4_1', 'c4_2', 'c4_3']);
    return { ...s, ...extra };
  };

  it('closes the shortfall once, as a perk through the ledger', () => {
    const view = mkView();
    const r = run(stuck(20_000), view);
    expect(r.state.wallet.cash).toBe(24_800);
    expect(r.state.ledger).toEqual([expect.objectContaining({ id: 'perk:phone_fund', kind: 'perk', delta: 4_800, pocket: 'cash' })]);
    expect(r.state.chapter.flags).toContain('phone_fund');
    expect(r.derived).toContainEqual({ t: 'wallet_changed', delta: 4_800, balance: 24_800, kind: 'perk' });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_phone_fund' });
    expect(run(r.state, view).state).toEqual(r.state);
  });

  it('is capped at maxYen', () => {
    expect(run(stuck(0), mkView()).state.wallet.cash).toBe(BALANCE.catchUp.max);
  });

  it('waits for the days, for the rest of the chapter, and does nothing when there is no gap', () => {
    const view = mkView();
    // 6 active days in the chapter is not enough
    expect(run({ ...stuck(0), clock: { ...stuck(0).clock, activeDays: 10 } }, view).state.wallet.cash).toBe(0);
    // an objective that needs no phone is still open (words_known)
    expect(run(withDone(mkState({ chapter: 4, cash: 0, activeDays: 11, dayIndex: 11, began: { dayIndex: 4, activeDays: 4 } }), 4, ['c4_1', 'c4_2', 'c4_3', 'c4_4']), view).state.wallet.cash).toBe(0);
    // enough cash already: nothing to hand over, and no flag burned
    const rich = run(stuck(30_000), view).state;
    expect(rich.wallet.cash).toBe(30_000);
    expect(rich.chapter.flags).not.toContain('phone_fund');
    // already owns a phone
    const owns = stuck(0, { owned: { phone_used: { qty: 1, day: 'd5' } } });
    expect(run(owns, view).state.wallet.cash).toBe(0);
  });
});

describe('open chapters (D36)', () => {
  it('items open by gate, shops by openChapter, friends by unlockChapter, interactions by the chapter that lists them', () => {
    expect(openChapter(pack, 'item', 'phone_used')).toBe(4);
    expect(openChapter(pack, 'item', 'car_kei_used')).toBe(9);
    expect(openChapter(pack, 'item', 'denki:coffee')).toBe(0);
    expect(openChapter(pack, 'shop', 'ramen')).toBe(2);
    expect(openChapter(pack, 'friend', 'nakamura')).toBe(5);
    expect(openChapter(pack, 'interaction', 'int_trip_hikarigaoka')).toBe(5);
    expect(openChapter(pack, 'interaction', 'int_konbini')).toBe(1);
    expect(openChapter(pack, 'job', 'job_konbini')).toBe(2);
    expect(openChapter(pack, 'feature', 'gift')).toBe(3);
    expect(openChapter(pack, 'place', 'place_konbini')).toBe(1);
  });

  it('a scenario opens with its shop and the requirements of its gate', () => {
    expect(openChapter(pack, 'scenario', 'konbini')).toBe(1);
    expect(openChapter(pack, 'scenario', 'ramen')).toBe(2);
    expect(openChapter(pack, 'scenario', 'motors_visit')).toBe(5);
    // aiko_viewing: shop aiko (2) and the heart with aiko, who is unlocked at 2
    expect(openChapter(pack, 'scenario', 'aiko_viewing')).toBe(2);
    const later = mkQuestPack({ friends: pack.friends.map((f) => (f.id === 'aiko' ? { ...f, unlockChapter: 6 } : f)) });
    expect(openChapter(later, 'scenario', 'aiko_viewing')).toBe(6);
    // no shop, no gate: open from the start; unknown id: 0
    expect(openChapter(pack, 'scenario', 'park')).toBe(1);
    expect(openChapter(pack, 'scenario', 'no_such')).toBe(0);
  });

  it('a menu id opens with its shop', () => {
    const p = mkQuestPack({ menu: [{ id: 'denki:cable', shop: 'denki', slot: 'item', option: 'cable', name: { ja: 'a', en: 'a', ar: 'a' }, price: 500, taxClass: 'standard', tags: [] }] });
    expect(openChapter(p, 'item', 'denki:cable')).toBe(4);
  });

  it('a gate that names its own scenario does not loop', () => {
    const p = mkQuestPack({ scenarioMeta: [{ id: 'loop', kind: 'talk', band: 'A1', register: 'polite', pay: 'full', gate: { k: 'scenario', id: 'loop', complete: true } }] });
    expect(openChapter(p, 'scenario', 'loop')).toBe(1);
  });

  it('isOpen compares the current chapter with it', () => {
    expect(isOpen(pack, mkState({ chapter: 3 }), 'item', 'phone_used')).toBe(false);
    expect(isOpen(pack, mkState({ chapter: 4 }), 'item', 'phone_used')).toBe(true);
    expect(isOpen(pack, mkState({ chapter: 4 }), 'shop', 'motors')).toBe(false);
    expect(isOpen(pack, mkState({ chapter: 9 }), 'item', 'car_kei_used')).toBe(true);
    expect(isOpen(pack, mkState({ chapter: 8 }), 'item', 'car_kei_used')).toBe(false);
  });
});

describe('requires (prerequisite derivation)', () => {
  const req = (pred: Pred, p: GamePack = pack): Array<[string, string, number]> =>
    requires(pred, p)
      .map((r): [string, string, number] => [r.kind, r.id, r.ch])
      .sort();

  it('shift: the job; gift: the hand-over; hearts: the friend', () => {
    expect(req({ k: 'shift', job: 'job_konbini', n: 1 })).toEqual([['job', 'job_konbini', 2]]);
    expect(req({ k: 'shift', n: 5 })).toEqual([['job', 'job_konbini', 2]]);
    expect(req({ k: 'gift', n: 1 })).toEqual([['feature', 'gift', 3]]);
    expect(req({ k: 'gift', n: 1, friend: 'nakamura' })).toEqual([['feature', 'gift', 3], ['friend', 'nakamura', 5]].sort());
    expect(req({ k: 'hearts', friend: 'aiko', atLeast: 1 })).toEqual([['friend', 'aiko', 2]]);
  });

  it('own item / category: the item, its shop and what it needs', () => {
    expect(req({ k: 'own', item: 'phone_used' })).toEqual([['item', 'phone_used', 4], ['shop', 'denki', 4]].sort());
    expect(req({ k: 'own', category: 'bicycle' })).toEqual([['item', 'bike_mamachari', 5], ['shop', 'motors', 5]].sort());
    const needy = mkQuestPack({ items: pack.items.map((i) => (i.id === 'yukata' ? { ...i, gate: { ch: 4, needs: ['bike_helmet'] } } : i)) });
    expect(req({ k: 'own', item: 'yukata' }, needy)).toEqual(
      [['item', 'yukata', 4], ['shop', 'fuku', 2], ['item', 'bike_helmet', 5], ['shop', 'motors', 5]].sort(),
    );
    // the category is satisfiable by the item that opens earliest
    expect(req({ k: 'own', category: 'phone' })[0]).toEqual(['item', 'phone_used', 4]);
  });

  it('scenario: the scenario with its opening chapter and its shop', () => {
    expect(req({ k: 'scenario', id: 'ramen', complete: true })).toEqual([['scenario', 'ramen', 2], ['shop', 'ramen', 2]].sort());
    expect(req({ k: 'said', scenario: 'park', intent: 'hello' })).toEqual([['scenario', 'park', 1]]);
    expect(req({ k: 'scenario', id: 'ghost' })).toEqual([['scenario', 'ghost', 0]]);
  });

  it('phone_chat: the phone and a friend; hearts_count: the n-th friend; visit: trip, home, place, spot', () => {
    expect(req({ k: 'phone_chat', n: 1 })).toEqual([['friend', 'tanaka', 1], ['item', 'phone_used', 4], ['shop', 'denki', 4]].sort());
    // chatting with two friends needs the second one to exist
    expect(req({ k: 'phone_chat', n: 4, friends: 3 })).toContainEqual(['friend', 'aiko', 2]);
    expect(req({ k: 'hearts_count', atLeast: 2, n: 3 })).toEqual([['friend', 'aiko', 2]]);
    expect(req({ k: 'hearts_count', atLeast: 2, n: 9 })).toEqual([['friend', '*', 0]]);
    expect(req({ k: 'visit', place: 'trip:hikarigaoka' })).toEqual([['interaction', 'int_trip_hikarigaoka', 5]]);
    expect(req({ k: 'visit', place: 'home:*' })).toEqual([['friend', 'mio', 1], ['interaction', 'int_visit_home', 5]].sort());
    expect(req({ k: 'visit', place: 'home:aiko' })).toEqual([['friend', 'aiko', 2], ['interaction', 'int_visit_home', 5]].sort());
    expect(req({ k: 'visit', place: 'place_konbini' })).toEqual([['place', 'place_konbini', 1]]);
    expect(req({ k: 'visit', place: 'spot:pond' })).toEqual([]);
  });

  it('all: every branch; any: the branch that opens earliest; language counts: nothing', () => {
    expect(req({ k: 'all', of: [{ k: 'shift', n: 1 }, { k: 'gift', n: 1 }] })).toEqual([['feature', 'gift', 3], ['job', 'job_konbini', 2]].sort());
    expect(req({ k: 'any', of: [{ k: 'gift', n: 1 }, { k: 'shift', n: 1 }] })).toEqual([['job', 'job_konbini', 2]]);
    expect(req({ k: 'any', of: [] })).toEqual([]);
    for (const p of [{ k: 'lesson', id: 'x' }, { k: 'words_known', n: 3 }, { k: 'say_new', n: 3 }, { k: 'stars', atLeast: 2, n: 2 }, { k: 'wallet', atLeast: 5 }, { k: 'flag', id: 'f' }] as Pred[]) expect(req(p)).toEqual([]);
  });

  it('every objective of the pack needs only what is open at its own chapter start', () => {
    for (const c of CHAPTERS) {
      for (const o of c.objectives) {
        for (const r of requires(o.pred, pack)) expect(r.ch, `${o.id} needs ${r.kind} ${r.id}`).toBeGreaterThan(0);
        for (const r of requires(o.pred, pack)) expect(r.ch, `${o.id} needs ${r.kind} ${r.id} (opens ${r.ch}, chapter ${c.n})`).toBeLessThanOrEqual(c.n);
        if (o.easier) for (const r of requires(o.easier.pred, pack)) expect(r.ch).toBeLessThanOrEqual(c.n);
      }
    }
  });

  it('dream steps need only what is open at their gate', () => {
    for (const d of DREAMS) for (const s of d.steps) for (const r of requires(s.pred, pack)) expect(r.ch, `${s.id}: ${r.kind} ${r.id}`).toBeLessThanOrEqual(s.gate);
  });
});

// --- the property: nothing is satisfiable only by something locked at its chapter's start -------------------------------

/**
 * The most a player could have when chapter `n` has just become current, reading the pack's gates directly (not `openChapter` /
 * `requires`): every open item owned, every open scenario played to the top, every open friend at five hearts, every open job
 * worked, every open trip taken, and all the language counters full.
 */
function maxStateAt(p: GamePack, n: number): { state: GameState; view: GameView } {
  const listed = (kind: string, id: string): boolean => p.chapters.some((c) => c.n <= n && c.opens.some((o) => o.kind === kind && o.id === id));
  const shopOpen = (id: string): boolean => (p.shops.find((s) => s.id === id)?.openChapter ?? 99) <= n;
  const friendOpen = (id: string): boolean => (p.friends.find((f) => f.id === id)?.unlockChapter ?? 99) <= n;

  const s = mkState({ chapter: n, cash: 9_999_999 });
  s.stats = { ...s.stats, purchases: 99, sayNew: 99, srsReviews: 99, cultureSaid: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], gifts: { n: 9, liked: 9, loved: 9 } };
  s.totals = { ...s.totals, earned: 9_999_999 };
  s.words = { said: Array.from({ length: 99 }, (_, i) => `w${i}`) };
  for (const it of p.items) if (it.gate.ch <= n && shopOpen(it.shop) && (it.gate.needs ?? []).every((x) => (p.items.find((i) => i.id === x)?.gate.ch ?? 99) <= n)) s.owned[it.id] = { qty: 1, day: 'd0' };
  for (const f of p.friends) if (friendOpen(f.id)) s.friends[f.id] = { ...friendAt(apFor(5)), gifts: 9, giftsLiked: 9, giftsLoved: 9 };
  const giftOpen = listed('feature', 'gift');
  if (!giftOpen) s.stats.gifts = { n: 0, liked: 0, loved: 0 };
  for (const j of p.jobs) if (listed('job', j.id)) s.jobs[j.id] = { shifts: 9, good: 9, perfect: 9, rank: 0, recent: [] };
  for (const i of Object.values(p.interactions).flat()) {
    if (i.kind === 'trip' && listed('interaction', i.id)) s.stats.visits.push('trip:hikarigaoka');
    if (i.kind === 'visit' && listed('interaction', i.id)) for (const f of p.friends) if (f.home && friendOpen(f.id)) s.stats.visits.push(`home:${f.id}`);
  }
  s.stats.chats = { n: 99, friends: Object.fromEntries(p.friends.filter((f) => friendOpen(f.id)).map((f) => [f.id, 9])) };
  if (!Object.keys(s.owned).some((id) => p.items.find((i) => i.id === id)?.fx.some((e) => e.t === 'feature' && e.id === 'phone'))) s.stats.chats = { n: 0, friends: {} };
  const view = mkView({ lessons: ['greetings', 'ic'], discovered: Array.from({ length: 20 }, (_, i) => `s${i}`), saved: 99, reviewed: Array.from({ length: 200 }, (_, i) => `k${i}`), surfaces: Object.values(p.wordTags).flat() });
  // scenarios: playable when the shop is open and the gate holds (a gate may need a heart or an item, so settle to a fixpoint)
  for (let pass = 0; pass < 3; pass++) {
    for (const m of p.scenarioMeta) {
      const shopOk = !m.shop || shopOpen(m.shop.shopId);
      const gateOk = !m.gate || ok(m.gate, s, view, p);
      if (shopOk && gateOk) s.runs[m.id] = mkRun({ complete: true, stars: 3, bestIndependent: 99, bestShare: 1, bestR: 1, steps: ['a', 'b'] });
    }
  }
  return { state: s, view };
}

const ok = (pred: Pred, state: GameState, view: GameView, p: GamePack): boolean => evalPred(pred, state, { pack: p, view });

/** Every chapter objective, as (chapter, objective) pairs. */
const objectivesOf = (p: GamePack) => p.chapters.flatMap((c) => c.objectives.filter((o) => !o.dream).map((o) => ({ n: c.n, o })));

/**
 * Random re-gating: moves the opening of shops, friends and items to other chapters (6 = beyond the pack), and re-homes every listed
 * job, interaction and feature to a random chapter or removes it, half of them left as they were.
 */
function regate(p: GamePack, r: () => number): GamePack {
  const late = (): number => 1 + Math.floor(r() * 6);
  const keep = (): boolean => r() < 0.5;
  const shops = p.shops.map((s) => (keep() ? s : { ...s, openChapter: late() }));
  const friends = p.friends.map((f) => (keep() ? f : { ...f, unlockChapter: late() }));
  const items = p.items.map((i) => (i.gate.ch >= 9 || keep() ? i : { ...i, gate: { ...i.gate, ch: late() } }));
  const rehomed = new Map<string, number>();
  for (const c of p.chapters) {
    for (const o of c.opens) {
      if (o.kind === 'job' || o.kind === 'interaction' || o.kind === 'feature') rehomed.set(`${o.kind}:${o.id}`, keep() ? c.n : r() < 0.2 ? 0 : 1 + Math.floor(r() * p.chapters.length));
    }
  }
  const chapters = p.chapters.map<ChapterDef>((c) => ({
    ...c,
    opens: [
      ...c.opens.filter((o) => !rehomed.has(`${o.kind}:${o.id}`)),
      ...[...rehomed].filter(([, n]) => n === c.n).map(([key]) => ({ kind: key.split(':')[0] as 'job' | 'interaction' | 'feature', id: key.slice(key.indexOf(':') + 1) })),
    ],
  }));
  return { ...p, shops, friends, items, chapters };
}

describe('property: no objective is satisfiable only by something locked at its chapter start', () => {
  /** What `requires` claims: every requirement is known (ch > 0) and open by the chapter the objective belongs to. */
  const claimed = (p: GamePack, n: number, pred: Pred): boolean => requires(pred, p).every((r: Requirement) => r.ch > 0 && r.ch <= n);

  it('the synthetic pack: every objective holds in the most the player could have at its chapter start', () => {
    for (const { n, o } of objectivesOf(pack)) {
      const { state, view } = maxStateAt(pack, n);
      expect(ok(o.pred, state, view, pack), `${o.id} in chapter ${n}`).toBe(true);
    }
  });

  it('is detected: re-gating the pack at random, `requires` agrees with the semantic check on every objective', () => {
    let violations = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const p = regate(pack, rng(seed));
      for (const { n, o } of objectivesOf(p)) {
        const { state, view } = maxStateAt(p, n);
        const satisfiable = ok(o.pred, state, view, p);
        // a locked prerequisite makes the objective unsatisfiable, and `requires` must say so; the converse holds too
        expect(claimed(p, n, o.pred), `seed ${seed}: ${o.id} (chapter ${n}) satisfiable=${satisfiable}`).toBe(satisfiable);
        if (!satisfiable) violations++;
      }
    }
    // the random re-gating really does break things, so the check is not vacuous
    expect(violations).toBeGreaterThan(20);
  });
});

describe('prerequisiteIssues (the validatePack level-4 check)', () => {
  it('the synthetic pack is clean', () => {
    expect(prerequisiteIssues(pack)).toEqual([]);
  });

  it('catches "the reward unlocks the thing the chapter needs": a job that opens a chapter after the shift asked for it', () => {
    // move the konbini job from chapter 2 (where c2_3 asks for a shift) to chapter 3
    const late = mkQuestPack({
      chapters: CHAPTERS.map((c) => ({ ...c, opens: c.opens.filter((o) => o.id !== 'job_konbini').concat(c.n === 3 ? [{ kind: 'job' as const, id: 'job_konbini' }] : []) })),
    });
    const issues = prerequisiteIssues(late);
    expect(issues).toContainEqual(expect.objectContaining({ level: 4, severity: 'error', code: 'prereq_locked', path: 'chapters[1].objectives[2].pred' }));
    expect(issues.find((i) => i.path === 'chapters[1].objectives[2].pred')?.message).toContain('job_konbini');
  });

  it('reports a thing nothing opens, an easier alternative, a dream step and a start gate', () => {
    const broken = mkQuestPack({
      chapters: CHAPTERS.map((c) => (c.n === 2 ? { ...c, objectives: c.objectives.map((o) => (o.id === 'c2_3' ? { ...o, pred: { k: 'shift' as const, job: 'job_ghost', n: 1 } } : o)) } : c)),
    });
    expect(prerequisiteIssues(broken)).toContainEqual(expect.objectContaining({ code: 'prereq_unknown', path: 'chapters[1].objectives[2].pred' }));
    const easierLocked = mkQuestPack({ chapters: CHAPTERS.map((c) => (c.n === 1 ? { ...c, objectives: c.objectives.map((o) => (o.easier ? { ...o, easier: { ...o.easier, pred: { k: 'own' as const, category: 'phone' } } } : o)) } : c)) });
    expect(prerequisiteIssues(easierLocked)).toContainEqual(expect.objectContaining({ code: 'prereq_locked', path: 'chapters[0].objectives[4].easier.pred' }));
    const stepLocked = mkQuestPack({ dreams: DREAMS.map((d) => (d.id === 'phone_pal' ? { ...d, steps: d.steps.map((st) => (st.id === 'pp_s3' ? { ...st, gate: 2 } : st)) } : d)) });
    expect(prerequisiteIssues(stepLocked)).toContainEqual(expect.objectContaining({ code: 'prereq_locked', path: 'dreams[0].steps[2].pred' }));
    const gateLocked = mkQuestPack({ friends: FRIENDS_LATE });
    expect(prerequisiteIssues(gateLocked)).toContainEqual(expect.objectContaining({ code: 'prereq_locked', path: 'chapters[4].startGate' }));
  });

  it('agrees with the semantic check on every objective of randomly re-gated packs', () => {
    for (let seed = 100; seed < 140; seed++) {
      const p = regate(pack, rng(seed));
      const flagged = new Set(prerequisiteIssues(p).map((i) => i.path.match(/^chapters\[(\d+)\]\.objectives\[(\d+)\]/)?.slice(1, 3).join('.')));
      p.chapters.forEach((c, ci) =>
        c.objectives.forEach((o, oi) => {
          if (o.dream) return;
          const { state, view } = maxStateAt(p, c.n);
          expect(flagged.has(`${ci}.${oi}`), `seed ${seed}: ${o.id}`).toBe(!ok(o.pred, state, view, p));
        }),
      );
    }
  });
});

const FRIENDS_LATE = pack.friends.map((f) => ({ ...f, unlockChapter: 6 }));

describe('the completed cache is re-derivable', () => {
  /** Everything satisfied from the start, so the day gates alone decide when each chapter completes. */
  function everythingHolds(): { state: GameState; view: GameView } {
    const { state, view } = maxStateAt(pack, 5);
    const fresh = mkState({ cash: 1_000 });
    return {
      view,
      state: { ...state, wallet: fresh.wallet, totals: fresh.totals, chapter: fresh.chapter, culture: {}, titles: [], beats: [], ledger: [], seen: [] },
    };
  }

  it('a fresh state, a finished chapter, a waiting gate and Free Walk', () => {
    const view = mkView();
    expect(deriveCompleted(pack, mkState(), view)).toEqual([]);
    expect(deriveCompleted(pack, mkState({ chapter: 3 }), view)).toEqual([1, 2]);
    expect(deriveCompleted(pack, mkState({ chapter: 9 }), view)).toEqual([1, 2, 3, 4, 5]);
    // chapter 4 finished but chapter 5's gate shut: 4 is complete although it is still current
    const waiting = withDone(mkState({ chapter: 4, activeDays: 12, dayIndex: 12 }), 4);
    expect(deriveCompleted(pack, waiting, view)).toEqual([1, 2, 3, 4]);
    // finished but the day gate is not met: not complete
    expect(deriveCompleted(pack, { ...waiting, clock: { ...waiting.clock, activeDays: 3 } }, view)).toEqual([1, 2, 3]);
  });

  it('plays the whole story day by day: one chapter per day, never before its minDays, the cache always right, each reward once', () => {
    let { state, view } = everythingHolds();
    const completedOn: Record<number, number> = {};
    let paid = 0;
    let last = 0;
    for (let day = 0; day < 16; day++) {
      state = { ...state, clock: { ...state.clock, dayIndex: day, activeDays: day + 1 } };
      const r = evaluateAll(state, ctxOf(pack, view, 1_700_000_000_000 + day * 86_400_000));
      state = r.state;
      const done = r.derived.filter((d) => d.t === 'chapter_done') as Array<{ t: 'chapter_done'; n: number }>;
      // one completion per day, however much already holds
      expect(done.length).toBeLessThanOrEqual(1);
      for (const d of done) completedOn[d.n] = day;
      paid += r.derived.filter((d) => d.t === 'wallet_changed' && d.kind === 'chapter').reduce((a, d) => a + (d as { delta: number }).delta, 0);
      expect(state.chapter.n).toBeGreaterThanOrEqual(last);
      last = state.chapter.n;
      expect(deriveCompleted(pack, state, view)).toEqual(state.chapter.completed);
      expect(reconcile(state, 1_000).ok).toBe(true);
    }
    // minDays 1, 2, 4, 7, 10 with one active day per day: chapter k completes on day minDays-1, one chapter at a time
    expect(completedOn).toEqual({ 1: 0, 2: 1, 3: 3, 4: 6, 5: 9 });
    expect(state.chapter.n).toBe(BALANCE.freeWalkChapter);
    expect(paid).toBe(CHAPTERS.reduce((a, c) => a + c.reward, 0));
    expect(state.wallet.cash).toBe(1_000 + paid);
    expect(state.titles).toEqual(['t_newcomer', 't_friend']);
  });
});
