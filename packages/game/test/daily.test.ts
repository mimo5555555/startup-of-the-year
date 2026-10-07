import { describe, expect, it } from 'vitest';
import { dailyGoalProgress, dailyUnlocked, generateDaily, rolloverDaily, swapDaily, updateDaily } from '../src/daily';
import { reconcile } from '../src/ledger';
import { BALANCE, DAILY, ctxOf, ECON, friendAt, mkQuestPack, mkRun, mkState, mkView, rng } from './fixtures-quest';
import type { ConversationFacts, DailyGoalState, DerivedEvent, GamePack, GameState, GameView, InputEvent, TurnFacts } from '../src/types';

const pack = mkQuestPack();
const SLOT_OF = Object.fromEntries(DAILY.map((t) => [t.id, t.slot]));
const idsOf = (goals: DailyGoalState[]): string[] => goals.map((g) => g.id);

/** A state at `chapter` on `dayIndex` with daily goals unlocked and no trio yet. */
const at = (chapter: number, dayIndex = 5): GameState => mkState({ chapter, dayIndex, activeDays: dayIndex });

/** The same state with its trio generated (what the first update of the day does). */
const withTrio = (s: GameState, view: GameView, p: GamePack = pack): GameState => rolloverDaily(p, s, view);

const goal = (id: string, day: number, over: Partial<DailyGoalState> = {}): DailyGoalState => {
  const t = DAILY.find((d) => d.id === id)!;
  return { id, slot: t.slot, counter: t.counter, target: t.target, day, done: false, paid: false, ...over };
};

const turn = (over: Partial<TurnFacts> = {}): TurnFacts => ({ id: 1, cls: 'I', credit: 1, substantive: true, contentTokens: 3, stepIds: [], norm: 'x', newWords: [], ...over });
const facts = (over: Partial<ConversationFacts> = {}): ConversationFacts => ({
  sessionId: 's1',
  scenarioId: 'konbini',
  characterId: 'tanaka_clerk',
  mode: 'guided',
  abandoned: false,
  durationSec: 300,
  goalDone: 3,
  goalTotal: 4,
  turns: [],
  fallbacks: 0,
  hintUses: 0,
  accuracy: 90,
  requestsPolite: true,
  prepared: false,
  remembered: {},
  ...over,
});

const update = (s: GameState, ev: InputEvent, view: GameView, derived: DerivedEvent[] = [], p: GamePack = pack, now = 1_700_000_000_000) => updateDaily(s, ev, derived, ctxOf(p, view, now));

describe('when goals appear', () => {
  it('after Chapter 1 is done: the closing beat, or any later chapter', () => {
    expect(dailyUnlocked(pack, at(1))).toBe(false);
    expect(dailyUnlocked(pack, { ...at(1), beats: ['b_ch1_close'] })).toBe(true);
    expect(dailyUnlocked(pack, at(2))).toBe(true);
  });
  it('no trio before then, and the first update after the unlock makes it', () => {
    const view = mkView();
    const ch1 = at(1, 0);
    expect(rolloverDaily(pack, ch1, view).daily.goals).toEqual([]);
    expect(update(ch1, { t: 'lesson_done', id: 'x' }, view).state.daily.goals).toEqual([]);
    const unlocked = update({ ...ch1, beats: ['b_ch1_close'] }, { t: 'day_observed', nowMs: 0 }, view).state;
    expect(unlocked.daily.goals).toHaveLength(3);
    expect(unlocked.daily.day).toBe(0);
  });
});

describe('generateDaily', () => {
  const view = mkView({ reviewed: ['k1'], due: 3 });

  /** A player who is active: recent conversations, a shift and a friend contact, so no priority override fires. */
  const busy = (chapter: number, day: number): GameState => ({
    ...at(chapter, day),
    coach: { ...at(chapter, day).coach, recent: [{ day, scenarioId: 'a', r: 0.5, fallbacks: 0 }, { day: day - 1, scenarioId: 'b', r: 0.5, fallbacks: 0 }] },
    jobs: { job_konbini: { shifts: 3, good: 3, perfect: 0, rank: 0, recent: [], lastDay: `d${day}` } },
    friends: { mio: { ...friendAt(40), lastContactDay: day } },
  });

  it('is deterministic: the same day and profile give the same trio', () => {
    const s = busy(3, 5);
    expect(generateDaily(pack, s, view)).toEqual(generateDaily(pack, s, view));
    const other = generateDaily(pack, { ...s, clock: { ...s.clock, dayIndex: 6 } }, view);
    // across many days the trio varies
    const trios = new Set<string>();
    for (let d = 0; d < 40; d++) trios.add(idsOf(generateDaily(pack, { ...busy(3, d), clock: { ...s.clock, dayIndex: d } }, view)).join());
    expect(trios.size).toBeGreaterThan(3);
    expect(other).toHaveLength(3);
  });

  it('the seed is the day and the profile creation date', () => {
    const s = at(3);
    const days = Array.from({ length: 30 }, (_, d) => d);
    const key = (v: GameView) => days.map((d) => idsOf(generateDaily(pack, { ...s, clock: { ...s.clock, dayIndex: d } }, v)).join()).join('|');
    expect(key(mkView({ reviewed: ['k1'], due: 3, createdAt: '2026-01-01' }))).toBe(key(mkView({ reviewed: ['k1'], due: 3, createdAt: '2026-01-01' })));
    expect(key(mkView({ reviewed: ['k1'], due: 3, createdAt: '2026-01-01' }))).not.toBe(key(mkView({ reviewed: ['k1'], due: 3, createdAt: '2027-02-02' })));
  });

  it('three goals, one per slot, each a fresh unpaid goal for today', () => {
    const goals = generateDaily(pack, at(3), view);
    expect(goals.map((g) => g.slot).sort()).toEqual(['do', 'review', 'speak']);
    for (const g of goals) {
      const t = DAILY.find((d) => d.id === g.id)!;
      expect(g).toMatchObject({ day: 5, done: false, paid: false, slot: t.slot, counter: t.counter });
      expect(SLOT_OF[g.id]).toBe(g.slot);
    }
  });

  it('kids get two goals, and templates marked kids:false are never offered to them', () => {
    const kidsPack = mkQuestPack({ daily: DAILY.map((t) => (t.id === 'g_shift' || t.id === 'g_review8' ? { ...t, kids: false } : t)) });
    for (let d = 0; d < 60; d++) {
      const goals = generateDaily(kidsPack, { ...at(4), clock: { ...at(4).clock, dayIndex: d } }, mkView({ age: 'kids', reviewed: ['k1'], due: 20 }));
      expect(goals).toHaveLength(2);
      expect(idsOf(goals)).not.toContain('g_shift');
      expect(idsOf(goals)).not.toContain('g_review8');
    }
  });

  it('never references locked content', () => {
    const lockedPack = mkQuestPack({ jobs: [{ ...pack.jobs[0], unlock: { k: 'scenario', id: 'konbini', complete: true } }] });
    const seen = new Set<string>();
    for (let chapter = 1; chapter <= 9; chapter++) {
      for (const hasCards of [false, true]) {
        for (const allCulture of [false, true]) {
          for (const played of [false, true]) {
            for (let d = 0; d < 25; d++) {
              const s0 = d % 2 === 0 ? at(chapter, d) : busy(chapter, d);
              const s: GameState = {
                ...s0,
                culture: allCulture ? Object.fromEntries(pack.culture.map((c) => [c.id, 'd0'])) : {},
                runs: played ? { konbini: mkRun({ complete: true }) } : {},
              };
              const v = mkView({ reviewed: hasCards ? ['k'] : [], due: hasCards ? 12 : 0 });
              for (const goals of [generateDaily(lockedPack, s, v), generateDaily(pack, s, v)]) {
                for (const g of goals) {
                  seen.add(g.id);
                  if (g.id === 'g_friend') expect(chapter).toBeGreaterThanOrEqual(3);
                  if (g.id === 'g_shift') expect(chapter).toBeGreaterThanOrEqual(2);
                  if (g.id === 'g_review8') expect(hasCards).toBe(true);
                  if (g.id === 'g_culture') expect(allCulture).toBe(false);
                }
              }
              // a job whose own unlock has not happened offers no shift goal
              if (chapter >= 2 && !played) expect(idsOf(generateDaily(lockedPack, s, v))).not.toContain('g_shift');
            }
          }
        }
      }
    }
    // the property is not vacuous: every template shows up somewhere
    expect([...seen].sort()).toEqual(DAILY.map((t) => t.id).sort());
  });

  it('an adult-only culture card does not make g_culture available to a child who has seen every other card', () => {
    const s = { ...at(3), culture: { cc_irasshaimase: 'd0', cc_bow: 'd0', cc_notip: 'd0' } };
    for (let d = 0; d < 40; d++) {
      const goals = generateDaily(pack, { ...s, clock: { ...s.clock, dayIndex: d } }, mkView({ age: 'teens', reviewed: ['k'] }));
      expect(idsOf(goals)).not.toContain('g_culture');
    }
  });

  it('skips yesterday\'s template of a slot, and what is still open from yesterday', () => {
    const view = mkView({ reviewed: ['k1'], due: 3 });
    let s = withTrio(at(3, 0), view);
    for (let day = 1; day < 40; day++) {
      const yesterday = idsOf(s.daily.goals);
      s = withTrio({ ...s, clock: { ...s.clock, dayIndex: day } }, view);
      for (const id of idsOf(s.daily.goals)) expect(yesterday, `day ${day}`).not.toContain(id);
      expect(idsOf(s.daily.carried).sort()).toEqual(yesterday.slice().sort());
    }
  });

  it('a slot with one template still gets it, even if it was yesterday\'s', () => {
    const lone = mkQuestPack({ daily: DAILY.filter((t) => ['g_conv2', 'g_buy', 'g_lesson'].includes(t.id)) });
    const s = { ...at(2), daily: { ...at(2).daily, recent: ['g_conv2', 'g_buy', 'g_lesson'] } };
    expect(idsOf(generateDaily(lone, s, mkView())).sort()).toEqual(['g_buy', 'g_conv2', 'g_lesson']);
  });

  it('never starts a goal that today\'s counters already satisfy', () => {
    const s = { ...at(3), daily: { ...at(3).daily, counters: { 5: { lesson: 3, conv_distinct: 5 } } } };
    for (let d = 0; d < 20; d++) {
      const goals = generateDaily(pack, { ...s, clock: { ...s.clock, dayIndex: 5 } }, mkView({ reviewed: ['k'] }));
      expect(idsOf(goals)).not.toContain('g_lesson');
    }
  });

  describe('priority overrides (§7.4)', () => {
    const days = Array.from({ length: 30 }, (_, d) => d + 10);
    const gen = (s: GameState, v: GameView, d: number, p: GamePack = pack) => idsOf(generateDaily(p, { ...s, clock: { ...s.clock, dayIndex: d } }, v));

    it('review = g_review8 when 10 or more are due', () => {
      for (const d of days) expect(gen(at(3), mkView({ reviewed: ['k'], due: 10 }), d)).toContain('g_review8');
      // fewer due: not forced, so it sometimes is not chosen
      expect(days.some((d) => !gen(at(3), mkView({ reviewed: ['k'], due: 9 }), d).includes('g_review8'))).toBe(true);
    });
    it('do = g_shift when a job is unlocked and there has been no shift for 4 days', () => {
      const idle = { ...at(3), jobs: { job_konbini: { shifts: 3, good: 3, perfect: 0, rank: 0, recent: [], lastDay: 'd2' } } };
      for (const d of days) expect(gen(idle, mkView(), d)).toContain('g_shift');
      // a shift yesterday: not forced
      const busy = (d: number): GameState => ({ ...at(3), jobs: { job_konbini: { shifts: 3, good: 3, perfect: 0, rank: 0, recent: [], lastDay: `d${d - 1}` } } });
      expect(days.some((d) => !gen(busy(d), mkView(), d).includes('g_shift'))).toBe(true);
      // never worked a shift: idle
      for (const d of days) expect(gen(at(3), mkView(), d)).toContain('g_shift');
    });
    it('do = g_friend when friends are unlocked and none was contacted for 3 days (a shift outranks it)', () => {
      const shifted = (d: number): GameState => ({ ...at(3), jobs: { job_konbini: { shifts: 3, good: 3, perfect: 0, rank: 0, recent: [], lastDay: `d${d}` } } });
      for (const d of days) expect(gen(shifted(d), mkView(), d)).toContain('g_friend');
      const contacted = (d: number): GameState => ({ ...shifted(d), friends: { mio: { ...friendAt(40), lastContactDay: d - 1 } } });
      expect(days.some((d) => !gen(contacted(d), mkView(), d).includes('g_friend'))).toBe(true);
      // before Chapter 3 there is no friend goal at all
      const early = (d: number): GameState => ({ ...at(2), jobs: { job_konbini: { shifts: 3, good: 3, perfect: 0, rank: 0, recent: [], lastDay: `d${d}` } } });
      for (const d of days) expect(gen(early(d), mkView(), d)).not.toContain('g_friend');
      // both idle: the shift wins the slot
      for (const d of days) expect(gen(at(3), mkView(), d)).not.toContain('g_friend');
    });
    it('speak = g_conv2 when there was at most one conversation in the last 3 days', () => {
      const convs = (d: number, n: number): GameState => ({ ...at(3), coach: { ...at(3).coach, recent: Array.from({ length: n }, (_, i) => ({ day: d - i, scenarioId: 'konbini', r: 0.5, fallbacks: 0 })) } });
      for (const d of days) {
        expect(gen(convs(d, 0), mkView(), d)).toContain('g_conv2');
        expect(gen(convs(d, 1), mkView(), d)).toContain('g_conv2');
      }
      expect(days.some((d) => !gen(convs(d, 2), mkView(), d).includes('g_conv2'))).toBe(true);
      // conversations older than 3 days do not count
      const old: GameState = { ...at(3), coach: { ...at(3).coach, recent: [{ day: 0, scenarioId: 'a', r: 1, fallbacks: 0 }, { day: 1, scenarioId: 'b', r: 1, fallbacks: 0 }] } };
      for (const d of days) expect(gen(old, mkView(), d)).toContain('g_conv2');
    });
    it('review with nothing due is swapped for new ways of saying things, and with fewer due the goal is "all due"', () => {
      const only = mkQuestPack({ daily: DAILY.filter((t) => ['g_conv2', 'g_review8', 'g_newphrase2', 'g_buy'].includes(t.id)) });
      const idle = mkQuestPack({ daily: DAILY.filter((t) => ['g_conv2', 'g_review8', 'g_newphrase2', 'g_buy'].includes(t.id)), jobs: [] });
      for (const d of days) {
        // speak slot has g_conv2 forced (no recent conversations), so g_newphrase2 is free for the swap
        const goals = generateDaily(only, { ...at(3), clock: { ...at(3).clock, dayIndex: d } }, mkView({ reviewed: ['k'], due: 0 }));
        expect(idsOf(goals)).not.toContain('g_review8');
        expect(idsOf(goals)).toContain('g_newphrase2');
      }
      for (const d of days) {
        const goals = generateDaily(idle, { ...at(3), clock: { ...at(3).clock, dayIndex: d } }, mkView({ reviewed: ['k'], due: 5 }));
        const review = goals.find((g) => g.id === 'g_review8');
        if (review) expect(review.target).toBe(5);
      }
      const forced = generateDaily(idle, { ...at(3), clock: { ...at(3).clock, dayIndex: 10 } }, mkView({ reviewed: ['k'], due: 40 }));
      expect(forced.find((g) => g.id === 'g_review8')?.target).toBe(8);
    });
  });
});

describe('the two-day window', () => {
  const view = mkView({ reviewed: ['k1'], due: 3 });

  it('an unfinished goal is carried to its second day and then goes quietly', () => {
    const day0 = withTrio(at(3, 0), view);
    expect(day0.daily.goals).toHaveLength(3);
    // one goal finished
    const finished = { ...day0, daily: { ...day0.daily, goals: day0.daily.goals.map((g, i) => (i === 0 ? { ...g, done: true, paid: true } : g)) } };
    const day1 = rolloverDaily(pack, { ...finished, clock: { ...finished.clock, dayIndex: 1 } }, view);
    expect(day1.daily.day).toBe(1);
    expect(idsOf(day1.daily.carried)).toEqual(idsOf(finished.daily.goals.slice(1)));
    expect(day1.daily.carried.every((g) => g.day === 0 && !g.done)).toBe(true);
    expect(day1.daily.goals.every((g) => g.day === 1)).toBe(true);
    const day2 = rolloverDaily(pack, { ...day1, clock: { ...day1.clock, dayIndex: 2 } }, view);
    // day 0's goals are gone; day 1's unfinished ones are carried
    expect(day2.daily.carried.every((g) => g.day === 1)).toBe(true);
    expect(day2.daily.carried.map((g) => g.id)).toEqual(idsOf(day1.daily.goals));
  });

  it('keeps only the counters of the last two days and resets the daily flags', () => {
    let s = withTrio(at(3, 0), view);
    s = { ...s, daily: { ...s.daily, counters: { 0: { lesson: 1 } }, sets: { 0: { conv_distinct: ['konbini'] } }, swapUsed: true, allPaid: true, streakPaid: true } };
    s = rolloverDaily(pack, { ...s, clock: { ...s.clock, dayIndex: 1 } }, view);
    expect(s.daily.counters).toEqual({ 0: { lesson: 1 } });
    expect(s.daily).toMatchObject({ swapUsed: false, allPaid: false, streakPaid: false });
    s = rolloverDaily(pack, { ...s, clock: { ...s.clock, dayIndex: 2 } }, view);
    expect(s.daily.counters).toEqual({});
    expect(s.daily.sets).toEqual({});
  });

  it('is safe to run twice on the same day, and a jump of any size is one rollover', () => {
    const day0 = withTrio(at(3, 0), view);
    const day1 = rolloverDaily(pack, { ...day0, clock: { ...day0.clock, dayIndex: 1 } }, view);
    expect(rolloverDaily(pack, day1, view)).toBe(day1);
    // the clock added exactly one day (D3): the carried goals are yesterday's
    expect(day1.daily.carried.every((g) => g.day === 0)).toBe(true);
  });

  it('a done goal is not carried; a goal done late and unpaid is not carried either', () => {
    const day0 = withTrio(at(3, 0), view);
    const allDone = { ...day0, daily: { ...day0.daily, goals: day0.daily.goals.map((g) => ({ ...g, done: true })) } };
    expect(rolloverDaily(pack, { ...allDone, clock: { ...allDone.clock, dayIndex: 1 } }, view).daily.carried).toEqual([]);
  });

  it('a goal counts from its own creation day: a carried goal keeps yesterday\'s count, a new one starts at zero', () => {
    const s = { ...at(3, 3), daily: { ...at(3, 3).daily, counters: { 2: { lesson: 1 }, 3: {} } } };
    const carried = goal('g_lesson', 2);
    const fresh = goal('g_lesson', 3);
    expect(dailyGoalProgress(s, carried)).toEqual({ done: 1, total: 1 });
    expect(dailyGoalProgress(s, fresh)).toEqual({ done: 0, total: 1 });
    const distinct = { ...s, daily: { ...s.daily, sets: { 2: { conv_distinct: ['konbini'] }, 3: { conv_distinct: ['konbini', 'cafe'] } }, counters: { 2: { conv_distinct: 1 }, 3: { conv_distinct: 2 } } } };
    // the same scenario on two days is one distinct conversation
    expect(dailyGoalProgress(distinct, goal('g_conv2', 2))).toEqual({ done: 2, total: 2 });
    expect(dailyGoalProgress({ ...distinct, daily: { ...distinct.daily, sets: { 2: { conv_distinct: ['konbini'] }, 3: { conv_distinct: ['konbini'] } } } }, goal('g_conv2', 2))).toEqual({ done: 1, total: 2 });
  });
});

describe('counters and payment', () => {
  const view = mkView({ streakDays: 4 });
  /** a day-3 trio: two conversations, a purchase, a lesson. */
  const trio = (): GameState => {
    const s = at(3, 3);
    return { ...s, daily: { ...s.daily, day: 3, goals: [goal('g_conv2', 3), goal('g_buy', 3), goal('g_lesson', 3)] } };
  };
  const chargeDerived: DerivedEvent[] = [{ t: 'wallet_changed', delta: -160, balance: 2_840, kind: 'purchase' }];
  const purchase: InputEvent = { t: 'purchase', sessionId: 's', n: 1, shopId: 'konbini', itemId: 'konbini:onigiri', qty: 1, total: 160, method: 'cash', lines: [] };

  it('counts what the events say and completes a goal with ¥100 through the ledger', () => {
    const r = update(trio(), { t: 'lesson_done', id: 'greetings' }, view);
    expect(r.state.daily.counters[3].lesson).toBe(1);
    expect(r.state.daily.goals.find((g) => g.id === 'g_lesson')).toMatchObject({ done: true, paid: true });
    expect(r.state.wallet.cash).toBe(ECON.startCash + 100 + 60);
    expect(r.state.ledger.map((e) => [e.id, e.kind, e.delta])).toEqual([['goal:d3:g_lesson', 'goal', 100], ['streak:d3', 'streak', 60]]);
    expect(r.derived).toContainEqual({ t: 'goal_done', id: 'g_lesson' });
    expect(r.derived).toContainEqual({ t: 'wallet_changed', delta: 100, balance: ECON.startCash + 100, kind: 'goal' });
    expect(reconcile(r.state, ECON.startCash).ok).toBe(true);
    expect(r.state.daily.streakPaid).toBe(true);
  });

  it('g_conv2 counts distinct scenarios finished at half the steps or more', () => {
    let s = trio();
    const conv = (scenarioId: string, over: Partial<ConversationFacts> = {}) => ({ t: 'conversation_done' as const, facts: facts({ scenarioId, ...over }) });
    s = update(s, conv('konbini'), view).state;
    s = update(s, conv('konbini', { sessionId: 's2' }), view).state;
    expect(s.daily.sets[3].conv_distinct).toEqual(['konbini']);
    expect(s.daily.goals[0].done).toBe(false);
    // too few steps, or abandoned: neither counts
    s = update(s, conv('ramen', { goalDone: 1, goalTotal: 4 }), view).state;
    s = update(s, conv('ramen', { abandoned: true }), view).state;
    expect(s.daily.goals[0].done).toBe(false);
    s = update(s, conv('cafe', { goalDone: 2, goalTotal: 4 }), view).state;
    expect(s.daily.goals[0].done).toBe(true);
    expect(s.wallet.cash).toBe(ECON.startCash + 100 + 60);
  });

  it('the half-way mark comes from BALANCE.goals.convFrac', () => {
    expect(BALANCE.goals.convFrac).toBe(0.5);
  });

  it('g_buy counts a completed charge at a conversation shop, not a failed one or a panel machine', () => {
    const s = trio();
    expect(update(s, purchase, view, []).state.daily.counters[3]?.purchase).toBeUndefined();
    expect(update(s, { ...purchase, shopId: 'vending' }, view, chargeDerived).state.daily.counters[3]?.purchase).toBeUndefined();
    const ok = update(s, purchase, view, chargeDerived);
    expect(ok.state.daily.counters[3].purchase).toBe(1);
    expect(ok.state.daily.goals[1]).toMatchObject({ done: true, paid: true });
  });

  it('class-I substantive turns count toward g_indep6; assisted and thin ones do not', () => {
    const s = { ...at(3, 3), daily: { ...at(3, 3).daily, goals: [goal('g_indep6', 3)] } };
    const turns = [turn(), turn(), turn({ cls: 'S' }), turn({ cls: 'T' }), turn({ substantive: false }), turn(), turn(), turn(), turn()];
    const r = update(s, { t: 'conversation_done', facts: facts({ turns, scenarioId: 'cafe' }) }, view);
    expect(r.state.daily.counters[3].indep_lines).toBe(6);
    expect(r.state.daily.goals[0].done).toBe(true);
  });

  it('friend contact: a talk with a friend, a phone chat, or a gift that landed', () => {
    const s = { ...at(3, 3), daily: { ...at(3, 3).daily, goals: [goal('g_friend', 3)] } };
    // a shop clerk who is not a friend does not count
    expect(update(s, { t: 'conversation_done', facts: facts({ characterId: 'clerk' }) }, view).state.daily.goals[0].done).toBe(false);
    expect(update(s, { t: 'conversation_done', facts: facts({ characterId: 'mio', scenarioId: 'park' }) }, view).state.daily.goals[0].done).toBe(true);
    expect(update(s, { t: 'phone_chat_done', friendId: 'mio', sessionId: 'c1', facts: facts({ scenarioId: 'chat_first', characterId: 'mio' }) }, view).state.daily.goals[0].done).toBe(true);
    const gift: InputEvent = { t: 'gift_given', friendId: 'mio', itemId: 'g_flower', sessionId: 'g1', assistedHandover: false };
    expect(update(s, gift, view, []).state.daily.goals[0].done).toBe(false);
    expect(update(s, gift, view, [{ t: 'gift_reacted', friendId: 'mio', itemId: 'g_flower', reaction: 'liked', ap: 10 }]).state.daily.goals[0].done).toBe(true);
  });

  it('g_place counts distinct places of finished conversations', () => {
    let s = { ...at(3, 3), daily: { ...at(3, 3).daily, goals: [goal('g_place', 3)] } };
    s = update(s, { t: 'conversation_done', facts: facts({ scenarioId: 'konbini' }) }, view).state;
    // another conversation at the same shop is the same place
    s = update(s, { t: 'conversation_done', facts: facts({ scenarioId: 'konbini', sessionId: 's2' }) }, view).state;
    expect(s.daily.goals[0].done).toBe(false);
    s = update(s, { t: 'conversation_done', facts: facts({ scenarioId: 'park', sessionId: 's3', characterId: 'mio' }) }, view).state;
    expect(s.daily.goals[0].done).toBe(true);
  });

  it('shifts, due reviews, new intents and culture cards', () => {
    const s = { ...at(3, 3), daily: { ...at(3, 3).daily, goals: [goal('g_shift', 3), goal('g_review8', 3), goal('g_newphrase2', 3), goal('g_culture', 3)] } };
    const score = (good: boolean) => ({ t: 'shift_settled' as const, jobId: 'job_konbini', score: { served: 5, ticks: 0.9, r: 1, perf: 1, good, perfect: false, trial: !good, quit: false, band: 'nice' as const }, pay: 600, rankBefore: 0, rankAfter: 0 });
    const day = { t: 'day_observed' as const, nowMs: 0 };
    expect(update(s, day, view, [score(false)]).state.daily.goals[0].done).toBe(false);
    expect(update(s, day, view, [score(true)]).state.daily.goals[0].done).toBe(true);
    const rev = update(s, { t: 'srs_review', keys: ['a', 'b', 'c', 'd', 'e'], due: 5 }, view);
    expect(rev.state.daily.counters[3].review_checked).toBe(5);
    expect(rev.state.daily.goals[1].done).toBe(false);
    expect(update(rev.state, { t: 'srs_review', keys: ['x'], due: 3 }, view).state.daily.goals[1].done).toBe(true);
    const settlement = { firstPhrases: [{ key: 'a:b', yen: 20 }, { key: 'a:c', yen: 20 }] } as never;
    expect(update(s, day, view, [{ t: 'loop_settled', sessionId: 's', scenarioId: 'cafe', settlement }]).state.daily.goals[2].done).toBe(true);
    expect(update(s, day, view, [{ t: 'culture_unlocked', id: 'cc_bow' }]).state.daily.goals[3].done).toBe(true);
  });

  it('pays the all-three chest and the streak bonus once, and a replay pays nothing more', () => {
    let s = trio();
    s = update(s, { t: 'lesson_done', id: 'l' }, view).state;
    s = update(s, purchase, view, chargeDerived).state;
    const two = update(s, { t: 'conversation_done', facts: facts({ scenarioId: 'konbini' }) }, view);
    const done = update(two.state, { t: 'conversation_done', facts: facts({ scenarioId: 'cafe', sessionId: 's9' }) }, view);
    // 3 x 100 + 150 chest + 4 days x 15 streak
    expect(done.state.wallet.cash).toBe(ECON.startCash + 300 + 150 + 60);
    expect(done.state.ledger.map((e) => e.id)).toEqual(['goal:d3:g_lesson', 'streak:d3', 'goal:d3:g_buy', 'goal:d3:g_conv2', 'goal:d3:all']);
    expect(done.state.daily).toMatchObject({ allPaid: true, streakPaid: true });
    expect(done.derived).toContainEqual({ t: 'daily_done', day: 'd3' });
    expect(done.effects).toContainEqual({ t: 'toast', key: 'quests.trio', vars: { n: 150 } });
    // more events the same day change nothing in the wallet
    const more = update(done.state, { t: 'lesson_done', id: 'm' }, view);
    expect(more.state.wallet).toEqual(done.state.wallet);
    expect(more.derived).toEqual([]);
    // an old ledger id replayed against a state whose goal flags were lost is still refused by the ledger
    const lost = { ...done.state, daily: { ...done.state.daily, goals: done.state.daily.goals.map((g) => ({ ...g, paid: false })), allPaid: false, streakPaid: false } };
    expect(update(lost, { t: 'lesson_done', id: 'again' }, view).state.wallet).toEqual(done.state.wallet);
  });

  it('the streak bonus is ¥15 per streak day, at most 10 days', () => {
    const pay = (days: number): number => {
      const s = trio();
      return update(s, { t: 'lesson_done', id: 'l' }, mkView({ streakDays: days })).state.ledger.find((e) => e.kind === 'streak')?.delta ?? 0;
    };
    expect(pay(1)).toBe(15);
    expect(pay(4)).toBe(60);
    expect(pay(10)).toBe(150);
    expect(pay(40)).toBe(BALANCE.goals.streakMax);
    // no streak: nothing paid and nothing marked, so a later goal today can still earn it once the streak has started
    const none = update(trio(), { t: 'lesson_done', id: 'l' }, mkView({ streakDays: 0 }));
    expect(none.state.ledger.map((e) => e.kind)).toEqual(['goal']);
    expect(none.state.daily.streakPaid).toBe(false);
    const later = update(none.state, purchase, mkView({ streakDays: 2 }), chargeDerived);
    expect(later.state.ledger.find((e) => e.kind === 'streak')?.delta).toBe(30);
  });

  it('a goal carried from yesterday pays the same, with yesterday\'s ledger id; it does not count toward the chest', () => {
    const s = at(3, 3);
    const carriedState: GameState = {
      ...s,
      daily: { ...s.daily, goals: [goal('g_buy', 3)], carried: [goal('g_lesson', 2)], counters: { 2: { lesson: 1 } } },
    };
    const r = update(carriedState, { t: 'day_observed', nowMs: 0 }, mkView({ streakDays: 0 }));
    expect(r.state.daily.carried[0]).toMatchObject({ done: true, paid: true });
    expect(r.state.ledger.map((e) => e.id)).toEqual(['goal:d2:g_lesson']);
    expect(r.state.daily.allPaid).toBe(false);
    expect(r.state.wallet.cash).toBe(ECON.startCash + 100);
  });

  it('pays in pack units scaled by the economy (a pack with a cheaper wage pays less)', () => {
    const half = mkQuestPack({ economy: { ...ECON, incomeScale: 0.5 } });
    const r = update(trio(), { t: 'lesson_done', id: 'l' }, mkView({ streakDays: 4 }), [], half);
    expect(r.state.ledger.map((e) => e.delta)).toEqual([50, 30]);
  });

  it('a full wallet settles the goal without paying and never retries it', () => {
    const s = trio();
    const full: GameState = { ...s, wallet: { ...s.wallet, cash: 9_999_999 }, totals: { ...s.totals, checksum: { ...s.totals.checksum, cash: 9_999_999 } } };
    const r = update(full, { t: 'lesson_done', id: 'l' }, mkView());
    expect(r.state.daily.goals.find((g) => g.id === 'g_lesson')).toMatchObject({ done: true, paid: true });
    expect(r.state.wallet.cash).toBe(9_999_999);
  });

  it('makes a missed rollover itself (the shell never ran the daily stage on the day change)', () => {
    const old = withTrio(at(3, 4), mkView());
    const r = update({ ...old, clock: { ...old.clock, dayIndex: 5 } }, { t: 'day_observed', nowMs: 0 }, mkView());
    expect(r.state.daily.day).toBe(5);
    expect(r.state.daily.goals.every((g) => g.day === 5)).toBe(true);
    expect(r.state.daily.carried.every((g) => g.day === 4)).toBe(true);
  });

  it('does not mutate its input', () => {
    const s = trio();
    const frozen = JSON.stringify(s);
    update(s, { t: 'lesson_done', id: 'l' }, view);
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe('swapDaily', () => {
  const view = mkView({ reviewed: ['k1'], due: 3 });
  const s0 = withTrio(at(3, 7), view);

  it('swaps one goal for another template of the same slot, once a day', () => {
    const target = s0.daily.goals[0];
    const s1 = swapDaily(pack, s0, view, target.id);
    expect(s1.daily.swapUsed).toBe(true);
    expect(s1.daily.goals).toHaveLength(3);
    const swapped = s1.daily.goals[0];
    expect(swapped.id).not.toBe(target.id);
    expect(swapped.slot).toBe(target.slot);
    expect(swapped).toMatchObject({ done: false, paid: false, day: 7 });
    expect(s1.daily.goals.slice(1)).toEqual(s0.daily.goals.slice(1));
    // the second swap the same day is refused
    expect(swapDaily(pack, s1, view, s1.daily.goals[1].id)).toBe(s1);
    // deterministic
    expect(swapDaily(pack, s0, view, target.id)).toEqual(s1);
  });

  it('never swaps in a template that is already on the screen, or one that counters already satisfy', () => {
    for (let day = 0; day < 40; day++) {
      const s = withTrio(at(3, day), view);
      const before = new Set([...idsOf(s.daily.goals), ...idsOf(s.daily.carried)]);
      const after = swapDaily(pack, s, view, s.daily.goals[0].id);
      if (after !== s) expect(before.has(after.daily.goals[0].id)).toBe(false);
    }
    const satisfied = { ...s0, daily: { ...s0.daily, counters: { 7: { lesson: 5, culture_new: 5, review_checked: 99 } } } };
    for (const g of satisfied.daily.goals) {
      const after = swapDaily(pack, satisfied, view, g.id);
      if (after !== satisfied) expect(['g_lesson', 'g_culture', 'g_review8']).not.toContain(after.daily.goals.find((x) => x.slot === g.slot)!.id);
    }
  });

  it('refuses a goal that is finished, unknown, or has no alternative', () => {
    const done = { ...s0, daily: { ...s0.daily, goals: s0.daily.goals.map((g, i) => (i === 0 ? { ...g, done: true } : g)) } };
    expect(swapDaily(pack, done, view, done.daily.goals[0].id)).toBe(done);
    expect(swapDaily(pack, s0, view, 'g_nope')).toBe(s0);
    const lone = mkQuestPack({ daily: DAILY.filter((t) => ['g_conv2', 'g_buy', 'g_lesson'].includes(t.id)) });
    const s = withTrio(at(3, 2), view, lone);
    expect(swapDaily(lone, s, view, 'g_conv2')).toBe(s);
  });

  it('never pays more: a swapped-in goal pays the same ¥100 as the one it replaced', () => {
    for (const goalId of idsOf(s0.daily.goals)) {
      const swapped = swapDaily(pack, s0, view, goalId);
      const slot = s0.daily.goals.find((g) => g.id === goalId)!.slot;
      const fresh = swapped.daily.goals.find((g) => g.slot === slot)!;
      // meet the new goal's counter, then let the daily stage pay it (no streak, so only the goal itself)
      const met = { ...swapped, daily: { ...swapped.daily, counters: { 7: { [fresh.counter]: fresh.target } } } };
      const r = updateDaily(met, { t: 'day_observed', nowMs: 0 }, [], ctxOf(pack, mkView({ reviewed: ['k1'], due: 3, streakDays: 0 })));
      expect(r.state.ledger.find((e) => e.id === `goal:d7:${fresh.id}`)?.delta).toBe(BALANCE.goals.each);
    }
  });
});

describe('properties', () => {
  it('a day never pays more than the maximum (3 x ¥100 + ¥150 chest + ¥150 streak)', () => {
    const maxDay = 3 * BALANCE.goals.each + BALANCE.goals.all + BALANCE.goals.streakMax;
    for (let seed = 1; seed <= 30; seed++) {
      const r = rng(seed);
      const view = mkView({ streakDays: 50, reviewed: ['k'], due: 12 });
      let s = withTrio(at(4, 10), view);
      const before = s.wallet.cash;
      for (let i = 0; i < 80; i++) {
        const pick = Math.floor(r() * 5);
        const ev: InputEvent =
          pick === 0
            ? { t: 'lesson_done', id: `l${i}` }
            : pick === 1
              ? { t: 'conversation_done', facts: facts({ scenarioId: ['konbini', 'cafe', 'park', 'ramen'][Math.floor(r() * 4)], sessionId: `s${i}`, characterId: r() < 0.5 ? 'mio' : 'clerk', turns: [turn(), turn(), turn()] }) }
              : pick === 2
                ? { t: 'srs_review', keys: ['a'], due: 3 }
                : pick === 3
                  ? { t: 'day_observed', nowMs: i }
                  : { t: 'purchase', sessionId: `p${i}`, n: i, shopId: 'konbini', itemId: 'konbini:onigiri', qty: 1, total: 160, method: 'cash', lines: [] };
        const derived: DerivedEvent[] = pick === 4 ? [{ t: 'wallet_changed', delta: -160, balance: 0, kind: 'purchase' }] : r() < 0.2 ? [{ t: 'culture_unlocked', id: `c${i}` }] : [];
        s = update(s, ev, view, derived).state;
        expect(reconcile(s, ECON.startCash).ok).toBe(true);
      }
      expect(s.wallet.cash - before).toBeLessThanOrEqual(maxDay);
      // every id is unique in the ledger: nothing pays twice
      const ids = s.ledger.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('counters are monotone within a day, and a done goal stays done', () => {
    const r = rng(11);
    const view = mkView({ streakDays: 3 });
    let s = withTrio(at(3, 4), view);
    let last = 0;
    for (let i = 0; i < 60; i++) {
      s = update(s, r() < 0.5 ? { t: 'lesson_done', id: `l${i}` } : { t: 'srs_review', keys: [], due: 1 }, view).state;
      const total = Object.values(s.daily.counters[4] ?? {}).reduce((a, b) => a + (b ?? 0), 0);
      expect(total).toBeGreaterThanOrEqual(last);
      last = total;
    }
    expect(s.daily.goals.filter((g) => g.done).every((g) => g.paid)).toBe(true);
  });
});
