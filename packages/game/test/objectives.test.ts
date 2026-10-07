import { describe, expect, it } from 'vitest';
import { acceptEasier, easierOffered, evalPred, evaluateAll, objectivePred, objectiveRows, predProgress } from '../src/objectives';
import { apFor, ctxOf, friendAt, mkQuestPack, mkRun, mkState, mkView, rng } from './fixtures-quest';
import type { GameState, GameView, Pred } from '../src/types';

const pack = mkQuestPack();

/** Evaluates a predicate against a state and view. */
const ok = (pred: Pred, state: GameState, view: GameView = mkView()): boolean => evalPred(pred, state, { pack, view });
const prog = (pred: Pred, state: GameState, view: GameView = mkView()) => predProgress(pred, state, { pack, view });

const run = mkRun;

describe('evalPred: scenario', () => {
  it('needs a played run; constraints are checked on the best run', () => {
    const s = mkState();
    expect(ok({ k: 'scenario', id: 'cafe' }, s)).toBe(false);
    const played = { ...s, runs: { cafe: run() } };
    expect(ok({ k: 'scenario', id: 'cafe' }, played)).toBe(true);
    expect(ok({ k: 'scenario', id: 'cafe', complete: true }, played)).toBe(false);
    expect(ok({ k: 'scenario', id: 'cafe', complete: true }, { ...s, runs: { cafe: run({ complete: true }) } })).toBe(true);
  });
  it('minIndependent, minShare, minStars and steps all have to hold', () => {
    const p: Pred = { k: 'scenario', id: 'park', minIndependent: 4, minStars: 2, steps: ['name', 'hobby'], minShare: 0.5 };
    const base = mkState();
    const r = run({ bestIndependent: 4, stars: 2, steps: ['name', 'hobby'], bestShare: 0.5 });
    expect(ok(p, { ...base, runs: { park: r } })).toBe(true);
    const worseRuns: Array<Partial<ReturnType<typeof mkRun>>> = [{ bestIndependent: 3 }, { stars: 1 }, { steps: ['name'] }, { bestShare: 0.4 }];
    for (const worse of worseRuns) {
      expect(ok(p, { ...base, runs: { park: { ...r, ...worse } } })).toBe(false);
    }
  });
  it('shows "2/4 lines" progress, capped at the target', () => {
    const s = { ...mkState(), runs: { park: run({ bestIndependent: 2 }) } };
    expect(prog({ k: 'scenario', id: 'park', minIndependent: 4 }, s)).toEqual({ done: 2, total: 4 });
    const over = { ...mkState(), runs: { park: run({ bestIndependent: 9 }) } };
    expect(prog({ k: 'scenario', id: 'park', minIndependent: 4 }, over)).toEqual({ done: 4, total: 4 });
  });
});

describe('evalPred: counts and collections', () => {
  it('stars counts distinct scenarios at the level', () => {
    const s = { ...mkState(), runs: { a: run({ stars: 2 }), b: run({ stars: 3 }), c: run({ stars: 1 }) } };
    expect(ok({ k: 'stars', atLeast: 2, n: 2 }, s)).toBe(true);
    expect(ok({ k: 'stars', atLeast: 2, n: 3 }, s)).toBe(false);
    expect(ok({ k: 'stars', atLeast: 1, n: 3 }, s)).toBe(true);
    expect(prog({ k: 'stars', atLeast: 3, n: 2 }, s)).toEqual({ done: 1, total: 2 });
  });
  it('own: an item by id, a category by tag, or both', () => {
    const s = mkState();
    const owned = { ...s, owned: { phone_used: { qty: 1, day: 'd0' } } };
    expect(ok({ k: 'own', item: 'phone_used' }, s)).toBe(false);
    expect(ok({ k: 'own', item: 'phone_used' }, owned)).toBe(true);
    expect(ok({ k: 'own', category: 'phone' }, owned)).toBe(true);
    expect(ok({ k: 'own', category: 'bicycle' }, owned)).toBe(false);
    expect(ok({ k: 'own', item: 'phone_used', category: 'bicycle' }, owned)).toBe(false);
    // an accessory is not a phone, and a spent-down stack does not count
    expect(ok({ k: 'own', category: 'phone' }, { ...s, owned: { phone_case: { qty: 1, day: 'd0' } } })).toBe(false);
    expect(ok({ k: 'own', item: 'phone_used' }, { ...s, owned: { phone_used: { qty: 0, day: 'd0' } } })).toBe(false);
    expect(ok({ k: 'own' }, owned)).toBe(false);
  });
  it('purchases reads the conversation-purchase counter', () => {
    const s = mkState();
    expect(ok({ k: 'purchases', n: 2 }, { ...s, stats: { ...s.stats, purchases: 2 } })).toBe(true);
    expect(ok({ k: 'purchases', n: 2 }, { ...s, stats: { ...s.stats, purchases: 1 } })).toBe(false);
  });
  it('hearts and hearts_count come from the friend AP', () => {
    const s = { ...mkState(), friends: { mio: friendAt(apFor(2)), tanaka: friendAt(apFor(3)), aiko: friendAt(apFor(1)), ghost: friendAt(apFor(5)) } };
    expect(ok({ k: 'hearts', friend: 'mio', atLeast: 2 }, s)).toBe(true);
    expect(ok({ k: 'hearts', friend: 'mio', atLeast: 3 }, s)).toBe(false);
    expect(ok({ k: 'hearts', friend: 'nobody', atLeast: 1 }, s)).toBe(false);
    expect(ok({ k: 'hearts_count', atLeast: 2, n: 2 }, s)).toBe(true);
    // a friend entry the pack does not know (kept for forward compatibility) is not a friend
    expect(ok({ k: 'hearts_count', atLeast: 5, n: 1 }, s)).toBe(false);
    expect(ok({ k: 'hearts_count', atLeast: 3, n: 1 }, s)).toBe(true);
    expect(prog({ k: 'hearts_count', atLeast: 2, n: 3 }, s)).toEqual({ done: 2, total: 3 });
  });
  it('gift: totals, per friend and the liked / loved reactions', () => {
    const s = mkState();
    const withGifts = { ...s, stats: { ...s.stats, gifts: { n: 3, liked: 2, loved: 1 } }, friends: { mio: { ...friendAt(10), gifts: 2, giftsLiked: 1, giftsLoved: 0 } } };
    expect(ok({ k: 'gift', n: 3 }, withGifts)).toBe(true);
    expect(ok({ k: 'gift', n: 2, reaction: 'liked' }, withGifts)).toBe(true);
    expect(ok({ k: 'gift', n: 2, reaction: 'loved' }, withGifts)).toBe(false);
    expect(ok({ k: 'gift', n: 2, friend: 'mio' }, withGifts)).toBe(true);
    expect(ok({ k: 'gift', n: 1, friend: 'mio', reaction: 'loved' }, withGifts)).toBe(false);
    expect(ok({ k: 'gift', n: 1, friend: 'aiko' }, withGifts)).toBe(false);
  });
  it('phone_chat: n chats, and optionally with k different friends', () => {
    const s = mkState();
    const chats = { ...s, stats: { ...s.stats, chats: { n: 4, friends: { mio: 3, tanaka: 1, aiko: 0 } } } };
    expect(ok({ k: 'phone_chat', n: 4 }, chats)).toBe(true);
    expect(ok({ k: 'phone_chat', n: 4, friends: 2 }, chats)).toBe(true);
    expect(ok({ k: 'phone_chat', n: 4, friends: 3 }, chats)).toBe(false);
    expect(ok({ k: 'phone_chat', n: 5 }, chats)).toBe(false);
  });
  it('hangout: one friend or in total, default once', () => {
    const s = mkState();
    const h = { ...s, stats: { ...s.stats, hangouts: { mio: 2, aiko: 1 } } };
    expect(ok({ k: 'hangout' }, h)).toBe(true);
    expect(ok({ k: 'hangout', friend: 'mio', n: 2 }, h)).toBe(true);
    expect(ok({ k: 'hangout', friend: 'aiko', n: 2 }, h)).toBe(false);
    expect(ok({ k: 'hangout', n: 3 }, h)).toBe(true);
    expect(ok({ k: 'hangout', friend: 'tanaka' }, h)).toBe(false);
  });
  it('visit: homes, trips, spots and the wildcards', () => {
    const s = mkState();
    const v = { ...s, stats: { ...s.stats, visits: ['home:mio', 'trip:hikarigaoka', 'park'], spots: ['pond'] } };
    expect(ok({ k: 'visit', place: 'home:mio' }, v)).toBe(true);
    expect(ok({ k: 'visit', place: 'home:aiko' }, v)).toBe(false);
    expect(ok({ k: 'visit', place: 'home:*' }, v)).toBe(true);
    expect(ok({ k: 'visit', place: 'trip:*' }, v)).toBe(true);
    expect(ok({ k: 'visit', place: 'trip:hikarigaoka' }, v)).toBe(true);
    expect(ok({ k: 'visit', place: 'park' }, v)).toBe(true);
    expect(ok({ k: 'visit', place: 'spot:pond' }, v)).toBe(true);
    expect(ok({ k: 'visit', place: 'spot:torii' }, v)).toBe(false);
    expect(ok({ k: 'visit', place: 'spot:*' }, v)).toBe(true);
    // a spot is not a visit and a visit is not a spot
    expect(ok({ k: 'visit', place: 'spot:park' }, v)).toBe(false);
    expect(ok({ k: 'visit', place: 'home:*' }, mkState())).toBe(false);
  });
  it('shift counts good shifts per job or in total; a trial-wage shift never reached `good`', () => {
    const s = mkState();
    const j = { ...s, jobs: { job_konbini: { shifts: 5, good: 2, perfect: 0, rank: 0, recent: [] }, job_station: { shifts: 3, good: 3, perfect: 1, rank: 0, recent: [] } } };
    expect(ok({ k: 'shift', job: 'job_konbini', n: 2, minAcc: 0.6 }, j)).toBe(true);
    expect(ok({ k: 'shift', job: 'job_konbini', n: 3 }, j)).toBe(false);
    expect(ok({ k: 'shift', n: 5 }, j)).toBe(true);
    expect(ok({ k: 'shift', n: 6 }, j)).toBe(false);
    expect(ok({ k: 'shift', job: 'job_cafe', n: 1 }, j)).toBe(false);
  });
  it('earn_total reads earned, wallet reads cash only', () => {
    const s = mkState({ cash: 1000 });
    const rich = { ...s, wallet: { cash: 1000, ic: 5000, points: 900 }, totals: { ...s.totals, earned: 7000 } };
    expect(ok({ k: 'earn_total', yen: 7000 }, rich)).toBe(true);
    expect(ok({ k: 'earn_total', yen: 7001 }, rich)).toBe(false);
    expect(ok({ k: 'wallet', atLeast: 1000 }, rich)).toBe(true);
    expect(ok({ k: 'wallet', atLeast: 1001 }, rich)).toBe(false);
  });
});

describe('evalPred: language and the vocabulary view', () => {
  it('words_saved and discover read the view', () => {
    expect(ok({ k: 'words_saved', n: 5 }, mkState(), mkView({ saved: 5 }))).toBe(true);
    expect(ok({ k: 'words_saved', n: 5 }, mkState(), mkView({ saved: 4 }))).toBe(false);
    expect(ok({ k: 'discover', n: 2 }, mkState(), mkView({ discovered: ['a', 'b'] }))).toBe(true);
    expect(ok({ k: 'discover', n: 3 }, mkState(), mkView({ discovered: ['a', 'b'] }))).toBe(false);
  });
  it('words_known counts reviewed cards, or those of a tag', () => {
    const view = mkView({ reviewed: ['k1', 'k2', 'k3'], surfaces: ['一', '二', '右', 'unrelated'] });
    expect(ok({ k: 'words_known', n: 3 }, mkState(), view)).toBe(true);
    expect(ok({ k: 'words_known', n: 4 }, mkState(), view)).toBe(false);
    expect(ok({ k: 'words_known', n: 2, tag: 'numbers' }, mkState(), view)).toBe(true);
    expect(ok({ k: 'words_known', n: 3, tag: 'numbers' }, mkState(), view)).toBe(false);
    expect(ok({ k: 'words_known', n: 1, tag: 'direction' }, mkState(), view)).toBe(true);
    expect(ok({ k: 'words_known', n: 1, tag: 'unknown_tag' }, mkState(), view)).toBe(false);
  });
  it('say_new reads the new-word counter or the lifetime set', () => {
    const s = mkState();
    expect(ok({ k: 'say_new', n: 3 }, { ...s, stats: { ...s.stats, sayNew: 3 } })).toBe(true);
    expect(ok({ k: 'say_new', n: 3 }, { ...s, words: { said: ['a', 'b', 'c'] } })).toBe(true);
    expect(ok({ k: 'say_new', n: 3 }, { ...s, words: { said: ['a', 'b'] } })).toBe(false);
  });
  it('said: an independent turn matched the intent (seenIntents key scenario:intent)', () => {
    const s = { ...mkState(), pay: { ...mkState().pay, seenIntents: ['ramen:itadakimasu'] } };
    expect(ok({ k: 'said', scenario: 'ramen', intent: 'itadakimasu' }, s)).toBe(true);
    expect(ok({ k: 'said', scenario: 'ramen', intent: 'bill' }, s)).toBe(false);
    expect(ok({ k: 'said', scenario: 'cafe', intent: 'itadakimasu' }, s)).toBe(false);
  });
  it('culture_said counts distinct cards, culture counts the collection or one card', () => {
    const s = mkState();
    const said = { ...s, stats: { ...s.stats, cultureSaid: ['cc_notip', 'cc_bow', 'cc_notip'] } };
    expect(ok({ k: 'culture_said', n: 2 }, said)).toBe(true);
    expect(ok({ k: 'culture_said', n: 3 }, said)).toBe(false);
    const cards = { ...s, culture: { cc_bow: 'd0', cc_notip: 'd1' } };
    expect(ok({ k: 'culture', n: 2 }, cards)).toBe(true);
    expect(ok({ k: 'culture', n: 3 }, cards)).toBe(false);
    expect(ok({ k: 'culture', n: 1, id: 'cc_bow' }, cards)).toBe(true);
    expect(ok({ k: 'culture', n: 1, id: 'cc_other' }, cards)).toBe(false);
  });
  it('lesson, srs_reviews, item_placed and flag', () => {
    const s = mkState();
    expect(ok({ k: 'lesson', id: 'greetings' }, s, mkView({ lessons: ['greetings'] }))).toBe(true);
    expect(ok({ k: 'lesson', id: 'greetings' }, s, mkView({ lessons: ['ic'] }))).toBe(false);
    expect(ok({ k: 'srs_reviews', n: 3 }, { ...s, stats: { ...s.stats, srsReviews: 3 } })).toBe(true);
    expect(ok({ k: 'item_placed', n: 2 }, { ...s, home: { tier: 'dorm', placed: { a: 'x', b: 'y', c: '' } } })).toBe(true);
    expect(ok({ k: 'item_placed', n: 3 }, { ...s, home: { tier: 'dorm', placed: { a: 'x', b: 'y', c: '' } } })).toBe(false);
    expect(ok({ k: 'flag', id: 'letter_written' }, { ...s, chapter: { ...s.chapter, flags: ['letter_written'] } })).toBe(true);
    expect(ok({ k: 'flag', id: 'letter_written' }, s)).toBe(false);
  });
  it('all / any combine, and show the closest alternative', () => {
    const s = { ...mkState(), stats: { ...mkState().stats, purchases: 1 } };
    const yes: Pred = { k: 'purchases', n: 1 };
    const no: Pred = { k: 'purchases', n: 3 };
    expect(ok({ k: 'all', of: [yes, no] }, s)).toBe(false);
    expect(ok({ k: 'all', of: [yes, yes] }, s)).toBe(true);
    expect(ok({ k: 'any', of: [no, yes] }, s)).toBe(true);
    expect(ok({ k: 'any', of: [no, no] }, s)).toBe(false);
    expect(ok({ k: 'all', of: [] }, s)).toBe(true);
    expect(ok({ k: 'any', of: [] }, s)).toBe(false);
    // the scale is the widest alternative (3), the closest alternative (1 of 2) is floored onto it
    expect(prog({ k: 'any', of: [no, { k: 'purchases', n: 2 }] }, s)).toEqual({ done: 1, total: 3 });
  });
});

describe('easier alternatives (D40)', () => {
  const c15 = pack.chapters[0].objectives.find((o) => o.id === 'c1_5')!;

  it('the accepted alternative replaces the predicate, and only then', () => {
    const s = mkState();
    expect(objectivePred(c15, s)).toEqual({ k: 'say_new', n: 3 });
    const eased = { ...s, chapter: { ...s.chapter, easier: ['c1_5'] } };
    expect(objectivePred(c15, eased)).toEqual({ k: 'say_new', n: 2 });
    const two = { ...eased, stats: { ...eased.stats, sayNew: 2 } };
    expect(ok(objectivePred(c15, two), two)).toBe(true);
    expect(ok(objectivePred(c15, { ...s, stats: { ...s.stats, sayNew: 2 } }), s)).toBe(false);
  });

  it('is offered after afterTries attempts, once, and never for a finished or dream objective', () => {
    const s = mkState();
    expect(easierOffered(pack, s, 'c1_5')).toBe(false);
    const tried = { ...s, chapter: { ...s.chapter, tries: { c1_5: 3 } } };
    expect(easierOffered(pack, tried, 'c1_5')).toBe(true);
    expect(easierOffered(pack, { ...tried, chapter: { ...tried.chapter, easier: ['c1_5'] } }, 'c1_5')).toBe(false);
    expect(easierOffered(pack, { ...tried, chapter: { ...tried.chapter, done: { c1_5: 'd0' } } }, 'c1_5')).toBe(false);
    // an objective with no alternative never offers one, however many tries
    expect(easierOffered(pack, { ...s, chapter: { ...s.chapter, tries: { c1_2: 9 } } }, 'c1_2')).toBe(false);
    expect(easierOffered(pack, tried, 'c1_star')).toBe(false);
    expect(easierOffered(pack, tried, 'nope')).toBe(false);
  });

  it('acceptEasier is free, permanent and refused when not offered', () => {
    const s = mkState();
    expect(acceptEasier(s, pack, 'c1_5')).toBe(s);
    const tried = { ...s, chapter: { ...s.chapter, tries: { c1_5: 3 } } };
    const eased = acceptEasier(tried, pack, 'c1_5');
    expect(eased.chapter.easier).toEqual(['c1_5']);
    expect(eased.wallet).toEqual(tried.wallet);
    // accepting twice changes nothing more
    expect(acceptEasier(eased, pack, 'c1_5')).toBe(eased);
  });

  it('counts a settled conversation as an attempt for the scenario objective and for say_new / stars', () => {
    const view = mkView();
    const settled = (scenarioId: string) => ({ t: 'loop_settled' as const, sessionId: `s-${scenarioId}`, scenarioId, settlement: {} as never });
    let s = mkState();
    // chapter 1: c1_5 (say_new) counts every conversation
    for (let i = 0; i < 3; i++) s = evaluateAll(s, ctxOf(pack, view), [settled('konbini')]).state;
    expect(s.chapter.tries.c1_5).toBe(3);
    expect(easierOffered(pack, s, 'c1_5')).toBe(true);
    // chapter 2: only conversations of the objective's own scenario count toward c2_1
    let t = { ...mkState({ chapter: 2 }), chapter: { ...mkState({ chapter: 2 }).chapter } };
    t = evaluateAll(t, ctxOf(pack, view), [settled('ramen')]).state;
    expect(t.chapter.tries.c2_1).toBeUndefined();
    t = evaluateAll(t, ctxOf(pack, view), [settled('cafe')]).state;
    t = evaluateAll(t, ctxOf(pack, view), [settled('cafe')]).state;
    t = evaluateAll(t, ctxOf(pack, view), [settled('cafe')]).state;
    expect(t.chapter.tries.c2_1).toBe(3);
    expect(easierOffered(pack, t, 'c2_1')).toBe(true);
    // the easier alternative then completes it: 1 own line instead of 2
    const eased = acceptEasier(t, pack, 'c2_1');
    const played = { ...eased, runs: { cafe: run({ bestIndependent: 1 }) } };
    expect(evaluateAll(played, ctxOf(pack, view)).derived).toContainEqual({ t: 'objective_done', id: 'c2_1' });
  });

  it('objectiveRows shows progress and the easier state', () => {
    const s = { ...mkState(), chapter: { ...mkState().chapter, tries: { c1_5: 3 } }, stats: { ...mkState().stats, sayNew: 1 } };
    const rows = objectiveRows(pack, s, mkView({ saved: 2 }));
    expect(rows.map((r) => r.id)).toEqual(['c1_1', 'c1_2', 'c1_3', 'c1_4', 'c1_5']);
    expect(rows.find((r) => r.id === 'c1_4')?.progress).toEqual({ done: 2, total: 5 });
    expect(rows.find((r) => r.id === 'c1_5')?.easier).toBe('offered');
    expect(rows.find((r) => r.id === 'c1_1')?.pin).toEqual({ place: 'school' });
  });
});

// --- properties --------------------------------------------------------------------------------------------------------

/** Every predicate kind, so the properties cover the whole union. */
const PREDS: Pred[] = [
  { k: 'lesson', id: 'greetings' },
  { k: 'scenario', id: 'park', minIndependent: 4, minStars: 2, steps: ['a', 'b'], complete: true, minShare: 0.6 },
  { k: 'scenario', id: 'cafe' },
  { k: 'stars', atLeast: 2, n: 3 },
  { k: 'own', category: 'phone' },
  { k: 'own', item: 'bike_helmet' },
  { k: 'purchases', n: 3 },
  { k: 'hearts', friend: 'mio', atLeast: 3 },
  { k: 'hearts_count', atLeast: 2, n: 2 },
  { k: 'gift', n: 2, reaction: 'liked' },
  { k: 'phone_chat', n: 4, friends: 2 },
  { k: 'hangout', friend: 'mio', n: 2 },
  { k: 'visit', place: 'home:*' },
  { k: 'visit', place: 'spot:pond' },
  { k: 'shift', n: 4 },
  { k: 'earn_total', yen: 5000 },
  { k: 'wallet', atLeast: 8000 },
  { k: 'words_saved', n: 6 },
  { k: 'words_known', n: 5, tag: 'numbers' },
  { k: 'words_known', n: 5 },
  { k: 'say_new', n: 4 },
  { k: 'discover', n: 3 },
  { k: 'culture', n: 3 },
  { k: 'culture_said', n: 2 },
  { k: 'said', scenario: 'ramen', intent: 'itadakimasu' },
  { k: 'srs_reviews', n: 5 },
  { k: 'item_placed', n: 3 },
  { k: 'flag', id: 'letter_written' },
  { k: 'all', of: [{ k: 'purchases', n: 2 }, { k: 'say_new', n: 2 }] },
  { k: 'any', of: [{ k: 'purchases', n: 5 }, { k: 'say_new', n: 3 }] },
];

/** One random growth step: only ever adds (a counter goes up, an item is gained, a flag is set). */
function grow(state: GameState, view: GameView, r: () => number): [GameState, GameView] {
  const pick = <T>(xs: T[]): T => xs[Math.floor(r() * xs.length)];
  const s: GameState = JSON.parse(JSON.stringify(state));
  const v: GameView = { ...view, vocab: { ...view.vocab, reviewedKeys: new Set(view.vocab.reviewedKeys), reviewedSurfaces: new Set(view.vocab.reviewedSurfaces) }, discovered: [...view.discovered], lessonsDone: [...view.lessonsDone] };
  const scenario = pick(['park', 'cafe', 'ramen']);
  switch (Math.floor(r() * 18)) {
    case 0:
      s.runs[scenario] = { ...(s.runs[scenario] ?? run({ count: 0 })), count: (s.runs[scenario]?.count ?? 0) + 1, bestIndependent: (s.runs[scenario]?.bestIndependent ?? 0) + 1 };
      break;
    case 1:
      s.runs[scenario] = { ...(s.runs[scenario] ?? run()), stars: Math.min(3, (s.runs[scenario]?.stars ?? 0) + 1) as 1 | 2 | 3, complete: true, bestShare: Math.min(1, (s.runs[scenario]?.bestShare ?? 0) + 0.2), steps: [...new Set([...(s.runs[scenario]?.steps ?? []), pick(['a', 'b'])])] };
      break;
    case 2:
      s.owned[pick(['phone_used', 'bike_helmet', 'yukata'])] = { qty: 1, day: 'd0' };
      break;
    case 3:
      s.stats.purchases += 1;
      break;
    case 4: {
      const f = pick(['mio', 'tanaka', 'aiko']);
      s.friends[f] = { ...(s.friends[f] ?? friendAt(0)), ap: (s.friends[f]?.ap ?? 0) + 40, gifts: (s.friends[f]?.gifts ?? 0) + 1, giftsLiked: (s.friends[f]?.giftsLiked ?? 0) + 1 };
      s.stats.gifts.n += 1;
      s.stats.gifts.liked += 1;
      break;
    }
    case 5:
      s.stats.chats.n += 1;
      s.stats.chats.friends[pick(['mio', 'tanaka'])] = (s.stats.chats.friends.mio ?? 0) + 1;
      break;
    case 6:
      s.stats.visits.push(pick(['home:mio', 'trip:hikarigaoka']));
      s.stats.spots.push('pond');
      break;
    case 7:
      s.jobs.job_konbini = { shifts: (s.jobs.job_konbini?.shifts ?? 0) + 1, good: (s.jobs.job_konbini?.good ?? 0) + 1, perfect: 0, rank: 0, recent: [] };
      break;
    case 8:
      s.wallet.cash += 3000;
      s.totals.earned += 3000;
      break;
    case 9:
      v.vocab = { ...v.vocab, total: v.vocab.total + 1 };
      v.vocab.reviewedKeys.add(`k${v.vocab.reviewedKeys.size}`);
      v.vocab.reviewedSurfaces.add(pick(['一', '二', '三', '四', '五']));
      break;
    case 10:
      s.stats.sayNew += 1;
      s.words.said.push(`w${s.words.said.length}`);
      break;
    case 11:
      v.discovered.push(`sign${v.discovered.length}`);
      break;
    case 12:
      s.culture[`cc${Object.keys(s.culture).length}`] = 'd0';
      s.stats.cultureSaid.push(`cc${s.stats.cultureSaid.length}`);
      break;
    case 13:
      s.pay.seenIntents.push('ramen:itadakimasu');
      break;
    case 14:
      s.stats.srsReviews += 2;
      break;
    case 15:
      s.home.placed[`slot${Object.keys(s.home.placed).length}`] = 'plant_pothos';
      break;
    case 16:
      s.chapter.flags.push('letter_written');
      break;
    default:
      v.lessonsDone.push('greetings');
      s.stats.hangouts.mio = (s.stats.hangouts.mio ?? 0) + 1;
  }
  return [s, v];
}

describe('properties of predicates', () => {
  it('progress is monotone and bounded under growth, and evalPred never turns back to false', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const r = rng(seed);
      let state = mkState();
      let view = mkView();
      let last = PREDS.map((p) => prog(p, state, view));
      for (let step = 0; step < 50; step++) {
        [state, view] = grow(state, view, r);
        const now = PREDS.map((p) => prog(p, state, view));
        now.forEach((p, i) => {
          expect(p.total, `total of ${JSON.stringify(PREDS[i])}`).toBe(last[i].total);
          expect(p.done).toBeGreaterThanOrEqual(last[i].done);
          expect(p.done).toBeLessThanOrEqual(p.total);
          expect(p.done).toBeGreaterThanOrEqual(0);
          // `done === total` is exactly `evalPred`
          expect(ok(PREDS[i], state, view)).toBe(p.done === p.total);
        });
        last = now;
      }
    }
  });

  it('the growth reaches every predicate (the property is not vacuous)', () => {
    const r = rng(7);
    let state = mkState();
    let view = mkView();
    for (let i = 0; i < 600; i++) [state, view] = grow(state, view, r);
    const satisfied = PREDS.filter((p) => ok(p, state, view));
    expect(satisfied.length).toBeGreaterThanOrEqual(PREDS.length - 2);
  });

  it('quest idempotency: evaluating twice changes nothing and the second pass reports nothing', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = rng(seed);
      let state = mkState({ dayIndex: 3, activeDays: 3 });
      let view = mkView();
      for (let step = 0; step < 120; step++) {
        [state, view] = grow(state, view, r);
        if (step % 4 === 0) {
          const first = evaluateAll(state, ctxOf(pack, view));
          const second = evaluateAll(first.state, ctxOf(pack, view));
          expect(second.state).toEqual(first.state);
          expect(second.derived).toEqual([]);
          expect(second.effects).toEqual([]);
          state = first.state;
        }
      }
    }
  });
});
