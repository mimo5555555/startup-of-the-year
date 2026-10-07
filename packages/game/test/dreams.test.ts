import { describe, expect, it } from 'vitest';
import { availableDreams, defaultDream, dreamProgress, evaluateDream, remainingCost } from '../src/dreams';
import { evaluateAll } from '../src/objectives';
import { apFor, BALANCE, ctxOf, DREAMS, friendAt, mkQuestPack, mkState, mkView } from './fixtures-quest';
import type { DerivedEvent, GameState, UiEffect } from '../src/types';

const pack = mkQuestPack();
const dreamOf = (id: string) => DREAMS.find((d) => d.id === id)!;
const ids = (list: Array<{ id: string }>): string[] => list.map((d) => d.id).sort();

/** Runs the dream stage alone. */
function stage(state: GameState, view = mkView()): { state: GameState; derived: DerivedEvent[]; effects: UiEffect[] } {
  const out = { derived: [] as DerivedEvent[], effects: [] as UiEffect[] };
  const next = evaluateDream(state, ctxOf(pack, view), out);
  return { state: next, ...out };
}

describe('availableDreams (D28)', () => {
  it('adults see everything open now; the car waits for Free Walk', () => {
    expect(ids(availableDreams(pack, mkState({ chapter: 3 }), mkView()))).toEqual(['bike', 'festival', 'flat', 'fresh_start', 'phone_pal', 'travel']);
    expect(ids(availableDreams(pack, mkState({ chapter: 8 }), mkView()))).not.toContain('car');
    expect(ids(availableDreams(pack, mkState({ chapter: 9 }), mkView()))).toContain('car');
  });
  it('kids and teens never see the flat, fresh start or the car', () => {
    for (const age of ['kids', 'teens'] as const) {
      const offered = ids(availableDreams(pack, mkState({ chapter: 9 }), mkView({ age })));
      expect(offered).toEqual(['bike', 'festival', 'phone_pal', 'travel']);
    }
  });
  it('seniors are adults for the rule', () => {
    expect(ids(availableDreams(pack, mkState({ chapter: 9 }), mkView({ age: 'seniors' })))).toContain('flat');
  });
});

describe('defaultDream', () => {
  it('maps the onboarding goal (travel, work, relocation, casual)', () => {
    expect(defaultDream(pack, mkView({ goal: 'travel' }))).toBe('travel');
    expect(defaultDream(pack, mkView({ goal: 'work' }))).toBe('phone_pal');
    expect(defaultDream(pack, mkView({ goal: 'relocation' }))).toBe('flat');
    expect(defaultDream(pack, mkView({ goal: 'casual' }))).toBe('festival');
  });
  it('falls back to the §7.3 table when the pack does not fill defaultFor', () => {
    const bare = mkQuestPack({ dreams: DREAMS.map((d) => ({ ...d, defaultFor: undefined })) });
    expect(defaultDream(bare, mkView({ goal: 'work' }))).toBe('phone_pal');
    expect(defaultDream(bare, mkView({ goal: 'relocation' }))).toBe('flat');
  });
  it('is age-filtered: a teenager who wants to relocate gets the festival, never the flat', () => {
    expect(defaultDream(pack, mkView({ goal: 'relocation', age: 'teens' }))).toBe('festival');
    expect(defaultDream(pack, mkView({ goal: 'relocation', age: 'kids' }))).toBe('festival');
  });
  it('an unknown goal gets the festival, and a pack with no dreams gets null', () => {
    expect(defaultDream(pack, mkView({ goal: 'something else' }))).toBe('festival');
    expect(defaultDream(mkQuestPack({ dreams: [] }), mkView())).toBeNull();
  });
  it('never defaults to a dream that is not open from the start', () => {
    const carOnly = mkQuestPack({ dreams: [dreamOf('car')] });
    expect(defaultDream(carOnly, mkView())).toBeNull();
  });
});

describe('remainingCost (§7.3)', () => {
  it('fresh_start counts ¥111,900: phone, bike with registration, flat and ¥6,700 of goods', () => {
    expect(remainingCost(pack, mkState(), dreamOf('fresh_start'))).toBe(24_800 + 19_800 + 600 + 60_000 + 6_700);
    expect(remainingCost(pack, mkState(), dreamOf('fresh_start'))).toBe(111_900);
  });
  it('sums only the unowned items', () => {
    const s = { ...mkState(), owned: { phone_used: { qty: 1, day: 'd1' } } };
    expect(remainingCost(pack, s, dreamOf('fresh_start'))).toBe(111_900 - 24_800);
    expect(remainingCost(pack, s, dreamOf('phone_pal'))).toBe(0);
  });
  it('a bicycle carries the registration fee, other items do not', () => {
    expect(remainingCost(pack, mkState(), dreamOf('bike'))).toBe(19_800 + 600 + 2_600);
    expect(remainingCost(pack, mkState(), dreamOf('festival'))).toBe(8_000);
  });
  it('a bulky item adds the delivery fee', () => {
    const sofa = { ...dreamOf('travel'), items: ['futon_set'] };
    expect(remainingCost(pack, mkState(), sofa)).toBe(12_800 + 2_200);
  });
  it('the furnish step prices the cheapest small goods, less those already owned; bulky pieces are not small goods', () => {
    const flat = dreamOf('flat');
    expect(remainingCost(pack, mkState(), flat)).toBe(60_000 + 1_500 + 2_200 + 3_000);
    // one of the three is already owned: only the other two are priced, from the cheapest unowned
    const own = { ...mkState(), owned: { plant_pothos: { qty: 1, day: 'd1' } } };
    expect(remainingCost(pack, own, flat)).toBe(60_000 + 2_200 + 3_000);
    // three owned: nothing more to buy for the goods
    const three = { ...mkState(), owned: { plant_pothos: { qty: 1, day: 'd1' }, paper_lamp: { qty: 1, day: 'd1' }, mug_set: { qty: 1, day: 'd1' } } };
    expect(remainingCost(pack, three, flat)).toBe(60_000);
  });
  it('is pack data in pack units: nothing is scaled', () => {
    const cheap = mkQuestPack({ items: pack.items.map((i) => ({ ...i, price: Math.round(i.price / 2) })) });
    expect(remainingCost(cheap, mkState(), dreamOf('phone_pal'))).toBe(12_400);
  });
});

describe('dreamProgress', () => {
  it('shows a step only from its gate chapter and picks the next visible one', () => {
    const early = dreamProgress(mkState({ chapter: 2 }), { pack, view: mkView() }, 'phone_pal');
    expect(early.steps).toEqual([
      { id: 'pp_s1', done: false, visible: true },
      { id: 'pp_s2', done: false, visible: false },
      { id: 'pp_s3', done: false, visible: false },
      { id: 'pp_s4', done: false, visible: false },
    ]);
    expect(early.nextStep).toBe('pp_s1');
    expect(early.total).toBe(4);
    expect(early.doneCount).toBe(0);
  });
  it('a step that holds but is not visible yet does not count; once visible and recorded it stays done', () => {
    // owns a phone at chapter 2: pp_s3 holds but only shows from chapter 4
    const s = { ...mkState({ chapter: 2 }), owned: { phone_used: { qty: 1, day: 'd0' } } };
    expect(dreamProgress(s, { pack, view: mkView() }, 'phone_pal').steps.find((x) => x.id === 'pp_s3')).toEqual({ id: 'pp_s3', done: false, visible: false });
    const recorded = { ...mkState({ chapter: 4 }), dream: { id: 'phone_pal', steps: { pp_s1: 'd2' }, done: false } };
    const p = dreamProgress(recorded, { pack, view: mkView() }, 'phone_pal');
    expect(p.steps[0]).toEqual({ id: 'pp_s1', done: true, visible: true });
    expect(p.doneCount).toBe(1);
    expect(p.nextStep).toBe('pp_s2');
  });
  it('the yen bar counts cash only, never the IC card or points', () => {
    const base = mkState({ chapter: 4, cash: 10_000 });
    const rich = { ...base, wallet: { cash: 10_000, ic: 3_000, points: 5_000 } };
    const a = dreamProgress(base, { pack, view: mkView() }, 'phone_pal');
    const b = dreamProgress(rich, { pack, view: mkView() }, 'phone_pal');
    expect(a.remainingCost).toBe(24_800);
    expect(a.cash).toBe(10_000);
    expect(a.yenBar).toBeCloseTo(10_000 / 24_800, 6);
    expect(b.yenBar).toBe(a.yenBar);
    expect(dreamProgress({ ...base, wallet: { cash: 99_999, ic: 0, points: 0 } }, { pack, view: mkView() }, 'phone_pal').yenBar).toBe(1);
  });
  it('the bar is full when nothing is left to buy', () => {
    const s = { ...mkState({ chapter: 4, cash: 0 }), owned: { phone_used: { qty: 1, day: 'd1' } } };
    const p = dreamProgress(s, { pack, view: mkView() }, 'phone_pal');
    expect(p.remainingCost).toBe(0);
    expect(p.yenBar).toBe(1);
  });
  it('the language gate: the chapter the next purchase opens in, and the objectives left until then', () => {
    // at chapter 2 (4 objectives open), chapter 3 (4 more): the phone opens when chapter 4 becomes current
    const s = mkState({ chapter: 2 });
    const p = dreamProgress(s, { pack, view: mkView() }, 'phone_pal');
    expect(p.languageGate).toEqual({ chapter: 4, objectivesLeft: 8 });
    // a finished objective is not left
    const some = { ...s, chapter: { ...s.chapter, done: { c2_1: 'd0', c3_3: 'd0' } } };
    expect(dreamProgress(some, { pack, view: mkView() }, 'phone_pal').languageGate.objectivesLeft).toBe(6);
    // once the chapter is current there is nothing left to wait for
    expect(dreamProgress(mkState({ chapter: 4 }), { pack, view: mkView() }, 'phone_pal').languageGate).toEqual({ chapter: 4, objectivesLeft: 0 });
    // the flat's room opens at chapter 5 (item gate and shop)
    expect(dreamProgress(mkState({ chapter: 4 }), { pack, view: mkView() }, 'flat').languageGate.chapter).toBe(5);
  });
  it('the car dream opens at Free Walk', () => {
    expect(dreamProgress(mkState({ chapter: 5 }), { pack, view: mkView() }, 'car').languageGate.chapter).toBe(9);
  });
  it('pace estimate: hidden until three days of data, days at the average net, many beyond 60', () => {
    const base = mkState({ chapter: 4, cash: 4_800 });
    const view = mkView();
    const at = (income: Array<{ day: number; net: number }>, cash = 4_800) => dreamProgress({ ...base, wallet: { cash, ic: 0, points: 0 }, income }, { pack, view }, 'phone_pal').etaDays;
    expect(at([])).toBeNull();
    expect(at([{ day: 1, net: 5_000 }, { day: 2, net: 5_000 }])).toBeNull();
    // 20,000 to go at 5,000 a day
    expect(at([{ day: 1, net: 5_000 }, { day: 2, net: 4_000 }, { day: 3, net: 6_000 }])).toBe(4);
    // a partial day rounds up
    expect(at([{ day: 1, net: 3_000 }, { day: 2, net: 3_000 }, { day: 3, net: 3_000 }])).toBe(7);
    // no net income: the pace is floored at 1/day, and far away is "many"
    expect(at([{ day: 1, net: 0 }, { day: 2, net: -500 }, { day: 3, net: 0 }])).toBe('many');
    expect(at([{ day: 1, net: 1 }, { day: 2, net: 1 }, { day: 3, net: 1 }])).toBe('many');
    // nothing left to save
    expect(at([{ day: 1, net: 100 }, { day: 2, net: 100 }, { day: 3, net: 100 }], 30_000)).toBe(0);
    // only the last etaWindowDays days are averaged
    const old = Array.from({ length: BALANCE.dream.etaWindowDays }, (_, i) => ({ day: i, net: 0 }));
    const recent = Array.from({ length: BALANCE.dream.etaWindowDays }, (_, i) => ({ day: 10 + i, net: 5_000 }));
    expect(at([...old, ...recent])).toBe(4);
  });
  it('an unknown dream is an empty, harmless view', () => {
    const p = dreamProgress(mkState(), { pack, view: mkView() }, 'nope');
    expect(p).toMatchObject({ dream: 'nope', steps: [], total: 0, nextStep: null, yenBar: 1, etaDays: null });
  });
});

describe('the dream stage', () => {
  /** Chapter 4, all four phone_pal steps hold. */
  const holding = (): GameState => ({
    ...mkState({ chapter: 4, dayIndex: 7 }),
    owned: { phone_used: { qty: 1, day: 'd6' } },
    friends: { tanaka: friendAt(apFor(1)), mio: friendAt(apFor(1)) },
    stats: { ...mkState().stats, chats: { n: 3, friends: { mio: 2, tanaka: 1 } } },
  });
  const view = mkView({ surfaces: ['一', '二'] });

  it('records the steps that hold, from their gate chapter on, with a derived event each', () => {
    const early = { ...holding(), chapter: { ...holding().chapter, n: 2 }, dream: { id: 'phone_pal', steps: {}, done: false } };
    const r1 = stage(early, view);
    expect(Object.keys(r1.state.dream.steps)).toEqual(['pp_s1']);
    const r2 = stage({ ...r1.state, chapter: { ...r1.state.chapter, n: 4 } }, view);
    expect(Object.keys(r2.state.dream.steps).sort()).toEqual(['pp_s1', 'pp_s2', 'pp_s3', 'pp_s4']);
    expect(r2.derived.filter((d) => d.t === 'dream_step_done').map((d) => (d as { step: string }).step)).toEqual(['pp_s2', 'pp_s3', 'pp_s4']);
    expect(r2.state.dream.steps.pp_s1).toBe('d7');
  });

  it('step 2 grants the cosmetic sticker and the milestone beat, once, and never yen', () => {
    const s = { ...holding(), chapter: { ...holding().chapter, n: 3 }, dream: { id: 'phone_pal', steps: {}, done: false } };
    const r = stage(s, view);
    expect(r.state.stickers).toEqual(['st_phone_pal']);
    expect(r.derived).toContainEqual({ t: 'sticker_earned', id: 'st_phone_pal' });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_dream_step' });
    expect(r.state.wallet).toEqual(s.wallet);
    expect(r.state.ledger).toEqual([]);
    const again = stage(r.state, view);
    expect(again.state).toBe(r.state);
    expect(again.derived).toEqual([]);
  });

  it('the milestone follows the step number, not the gate', () => {
    // only step 1 and 3 hold: the second step is still open, so no sticker
    const s = { ...holding(), friends: {}, dream: { id: 'phone_pal', steps: {}, done: false } };
    const r = stage(s, view);
    expect(Object.keys(r.state.dream.steps).sort()).toEqual(['pp_s1', 'pp_s3', 'pp_s4']);
    expect(r.state.stickers).toEqual([]);
    expect(r.effects.some((e) => e.t === 'beat')).toBe(false);
  });

  it('the finale: title, keepsake, beat and fanfare, and no yen (D20)', () => {
    const s = { ...holding(), dream: { id: 'phone_pal', steps: {}, done: false } };
    const r = stage(s, view);
    expect(r.state.dream.done).toBe(true);
    expect(r.state.titles).toEqual(['t_dream_phone_pal']);
    expect(r.state.keepsakes).toEqual(['k_phone']);
    expect(r.derived).toContainEqual({ t: 'dream_done', dream: 'phone_pal' });
    expect(r.derived).toContainEqual({ t: 'title_earned', id: 't_dream_phone_pal' });
    expect(r.effects).toContainEqual({ t: 'beat', id: 'b_dream_phone_pal' });
    expect(r.effects).toContainEqual({ t: 'fanfare', kind: 'dream' });
    expect(r.state.wallet).toEqual(s.wallet);
    expect(r.state.totals).toEqual(s.totals);
    // it ends: nothing more happens
    expect(stage(r.state, view).derived).toEqual([]);
  });

  it('a step that only held for a moment stays done (a later wallet drop does not undo it)', () => {
    const s = { ...mkState({ chapter: 9, cash: 198_000 }), dream: { id: 'car', steps: {}, done: false } };
    const r = stage(s, mkView());
    expect(r.state.dream.steps.car_s1).toBeDefined();
    const spent = stage({ ...r.state, wallet: { cash: 0, ic: 0, points: 0 } }, mkView());
    expect(spent.state.dream.steps.car_s1).toBeDefined();
    expect(dreamProgress({ ...r.state, wallet: { cash: 0, ic: 0, points: 0 } }, { pack, view: mkView() }, 'car').steps[0].done).toBe(true);
  });

  it('switching dreams loses nothing: progress is derived, and the new dream is evaluated at once', () => {
    const phone = stage({ ...holding(), dream: { id: 'phone_pal', steps: {}, done: false } }, view).state;
    // the player switches to the festival: its steps (Mio hearts, the yukata) are judged from state
    const festival = stage({ ...phone, dream: { ...phone.dream, id: 'festival', done: false }, friends: { ...phone.friends, mio: friendAt(apFor(2)) } }, view);
    expect(festival.state.dream.steps.fe_s1).toBeDefined();
    expect(festival.state.dream.steps.fe_s2).toBeDefined();
    expect(festival.state.dream.steps.fe_s3).toBeUndefined();
    // the phone dream's steps are still remembered
    expect(festival.state.dream.steps.pp_s3).toBeDefined();
    expect(festival.state.dream.done).toBe(false);
    // switching back: the finished dream finishes again without a second title
    const back = stage({ ...festival.state, dream: { ...festival.state.dream, id: 'phone_pal' } }, view);
    expect(back.state.titles.filter((t) => t === 't_dream_phone_pal')).toHaveLength(1);
    expect(back.state.dream.done).toBe(true);
  });

  it('until the picker is shown the onboarding goal is a silent default: steps are tracked, no finale', () => {
    const s = { ...holding(), dream: { id: null, steps: {}, done: false } };
    const work = stage(s, mkView({ surfaces: ['一', '二'], goal: 'work' }));
    expect(Object.keys(work.state.dream.steps).sort()).toEqual(['pp_s1', 'pp_s2', 'pp_s3', 'pp_s4']);
    expect(work.state.dream.done).toBe(false);
    expect(work.state.titles).toEqual([]);
    // after the picker (chapter 1's closing beat) a player with no dream chosen tracks nothing
    const shown = stage({ ...s, beats: ['b_ch1_close'] }, mkView({ surfaces: ['一', '二'], goal: 'work' }));
    expect(shown.state.dream.steps).toEqual({});
  });

  it('a dream is not tracked before its chapter opens (the car before Free Walk)', () => {
    const s = { ...mkState({ chapter: 8, cash: 500_000 }), dream: { id: 'car', steps: {}, done: false } };
    expect(stage(s).state.dream.steps).toEqual({});
  });

  it('runs inside evaluateAll, and a second evaluation changes nothing', () => {
    const s = { ...holding(), dream: { id: 'phone_pal', steps: {}, done: false } };
    const first = evaluateAll(s, ctxOf(pack, view));
    expect(first.state.dream.done).toBe(true);
    expect(first.derived).toContainEqual({ t: 'dream_done', dream: 'phone_pal' });
    const second = evaluateAll(first.state, ctxOf(pack, view));
    expect(second.state).toEqual(first.state);
    expect(second.derived).toEqual([]);
  });
});
