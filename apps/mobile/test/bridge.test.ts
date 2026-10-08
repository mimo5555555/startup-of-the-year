import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { BALANCE, type Beat, type ConversationFacts } from '@lw/game';
import { putSaved, wipeSaved } from './_fakeStorage';
import { WELCOME_BACK_BEAT, applySrsOps, completeBeat, dispatch, init, lessonFinished, observeDay, openScreen, resetBridgeForTests, routeEffects } from '../src/game/bridge';
import { GAME_KEY, flushGameNow, getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { flushNow, useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';

const DAY = 86_400_000;

const profile: Profile = {
  name: 'Sam',
  l1: 'en',
  level: 'A1',
  goal: 'travel',
  age: 'adults',
  topics: [],
  avatar: CHARACTERS[0].avatar,
  createdAt: '2030-01-15T00:00:00.000Z',
};

const BEAT: Beat = { id: 'b_test', lines: [{ who: 'hanako', line: { ja: 'こんにちは。', en: 'Hello.', ar: 'مرحبا.' } }] };

async function reload() {
  flushNow();
  flushGameNow();
  resetBridgeForTests();
  useStore.setState({ ready: false });
  await init();
}

beforeEach(async () => {
  wipeSaved();
  useStore.getState().reset();
  useUi.getState().clearRequests();
  resetBridgeForTests();
  useGame.getState().resetGame();
  wipeSaved();
  await init();
  useStore.getState().completeOnboarding(profile);
});

describe('progress made in the v1 store reaches the game at once (§14.5 "Who dispatches")', () => {
  it('finishing a lesson, saving words and reading signs tick their objectives without any other event', () => {
    expect(getGame().chapter.done.c1_1).toBeUndefined();
    useStore.getState().completeLesson('greetings', 25);
    expect(getGame().chapter.done.c1_1).toBeDefined();

    for (const id of ['sakura', 'cat', 'bench']) useStore.getState().discover(id);
    expect(getGame().chapter.done.c1_3).toBeUndefined();
    useStore.getState().discover('pond');
    expect(getGame().chapter.done.c1_3).toBeDefined();

    expect(getGame().chapter.done.c1_4).toBeUndefined();
    for (const s of ['猫', '犬', '鳥', '魚', '花']) useStore.getState().saveWord({ kind: 'word', s, rom: s, meaning: { en: s, ar: s }, source: 'sign' });
    expect(getGame().chapter.done.c1_4).toBeDefined();
  });
});

describe('a replayed lesson still counts for the day (g_lesson)', () => {
  it('the v1 store files a lesson once, but finishing it again on a later day ticks that day\'s lesson counter, once', () => {
    const day = (g = getGame()) => g.clock.dayIndex;
    useStore.getState().completeLesson('greetings', 25);
    const d0 = day();
    expect(getGame().daily.counters[d0]?.lesson).toBe(1);
    // the same day again changes nothing (no farming)
    useStore.getState().completeLesson('greetings', 25);
    lessonFinished('greetings');
    expect(getGame().daily.counters[d0]?.lesson).toBe(1);
    // tomorrow the v1 store adds nothing, and the game still counts it, once
    observeDay(Date.now() + DAY);
    const d1 = day();
    expect(d1).toBe(d0 + 1);
    useStore.getState().completeLesson('greetings', 25);
    lessonFinished('greetings');
    lessonFinished('greetings');
    expect(getGame().daily.counters[d1]?.lesson).toBe(1);
  });
});

describe('day_observed', () => {
  it('is dispatched on mount: a returning profile has its clock observed by init', async () => {
    // an old save: the clock is years behind
    const old = { ...getGame(), clock: { ...getGame().clock, lastLocalDate: '2020-01-01', lastSeenAt: 1_000 } };
    useGame.getState().setGame(old);
    await reload();
    expect(getGame().clock.lastLocalDate).not.toBe('2020-01-01');
    expect(getGame().clock.lastSeenAt).toBeGreaterThan(1_000);
    expect(getGame().clock.dayIndex).toBe(old.clock.dayIndex + 1);
  });

  it('nothing is observed before onboarding finishes', async () => {
    useStore.getState().reset();
    await reload();
    const before = getGame().clock;
    observeDay(Date.now() + 10 * DAY);
    expect(getGame().clock).toEqual(before);
  });

  it('a +400 day jump is exactly one rollover, the return to today reopens nothing, and the next real day counts one', () => {
    const t0 = Date.now();
    observeDay(t0);
    const d0 = getGame().clock.dayIndex;
    observeDay(t0 + 400 * DAY);
    expect(getGame().clock.dayIndex).toBe(d0 + 1);
    const future = getGame().clock.lastLocalDate;
    observeDay(t0);
    expect(getGame().clock.dayIndex).toBe(d0 + 1);
    expect(getGame().clock.lastLocalDate).not.toBe(future);
    observeDay(t0 + DAY);
    expect(getGame().clock.dayIndex).toBe(d0 + 2);
  });

  it('the same date twice is not a second day', () => {
    const t0 = Date.now();
    observeDay(t0);
    const d = getGame().clock.dayIndex;
    observeDay(t0 + 1000);
    observeDay(t0 + 2000);
    expect(getGame().clock.dayIndex).toBe(d);
  });
});

describe('welcome back', () => {
  const away = (days: number) => {
    const g = getGame();
    useGame.getState().setGame({ ...g, clock: { ...g.clock, lastSeenAt: Date.now() - days * DAY, activeDays: 3 } });
  };
  beforeEach(() => {
    PACK.beats[WELCOME_BACK_BEAT] = BEAT;
    // the pack now has Chapter 1's opening beat (2F) and a fresh game queues it on mount: these tests are about the welcome-back beat only
    useGame.getState().setGame({ ...getGame(), beats: PACK.chapters.map((c) => c.beats.open) });
    useUi.setState({ beats: [] });
  });

  it('queues the beat once after BALANCE.nextGoal.awayDays or more, and not on a short gap', () => {
    away(BALANCE.nextGoal.awayDays - 1);
    observeDay();
    expect(useUi.getState().beats).toEqual([]);
    away(BALANCE.nextGoal.awayDays);
    observeDay();
    expect(useUi.getState().beats).toEqual([WELCOME_BACK_BEAT]);
    expect(getGame().flags.welcomeSeenDay).toBe(getGame().clock.dayIndex);
    // the same return shows it once: a later focus the same day neither re-queues it nor re-measures the gap
    useUi.getState().finishBeat();
    observeDay();
    expect(useUi.getState().beats).toEqual([]);
  });

  it('a player who never played (no active day) is not welcomed back', () => {
    const g = getGame();
    useGame.getState().setGame({ ...g, clock: { ...g.clock, lastSeenAt: Date.now() - 30 * DAY, activeDays: 0 } });
    observeDay();
    expect(useUi.getState().beats).toEqual([]);
  });

  it('is skipped while the pack has no such beat (an empty screen would be a dead end)', () => {
    delete PACK.beats[WELCOME_BACK_BEAT];
    away(30);
    observeDay();
    expect(useUi.getState().beats).toEqual([]);
  });
});

describe('seed once (§14.7)', () => {
  it('seeds from the legacy completed map when the save is new, and never again', async () => {
    wipeSaved();
    useStore.getState().reset();
    useStore.setState({ completed: { cafe: { count: 2, best: 100 } } });
    resetBridgeForTests();
    useGame.getState().resetGame();
    // a game save that has not been seeded (as after a v1-only profile): `seeded` false
    putSaved(GAME_KEY, { state: { ...getGame(), seeded: false }, version: 1 });
    flushNow();
    await reload();
    const g = getGame();
    expect(g.seeded).toBe(true);
    // ★2 for best >= 100, no retroactive yen; the id is kept where the pack knows it (`runs`) or parked (`_extra`) when it does not know it yet
    const run = g.runs.cafe;
    const parked = (g._extra as { fields?: { legacyCompleted?: Record<string, unknown> } } | undefined)?.fields?.legacyCompleted?.cafe;
    expect(run ? run.stars : parked).toBeTruthy();
    expect(g.wallet.cash).toBe(PACK.economy.startCash);
    expect(g.totals.earned).toBe(0);

    // later progress in the legacy store does not seed again
    const snapshot = JSON.stringify(g.runs) + JSON.stringify(g._extra ?? null);
    useStore.setState({ completed: { cafe: { count: 2, best: 100 }, konbini: { count: 1, best: 100 } } });
    await reload();
    expect(getGame().seeded).toBe(true);
    expect(JSON.stringify(getGame().runs) + JSON.stringify(getGame()._extra ?? null)).toBe(snapshot);
  });

  it('a seeded save is loaded as it is; reset gives a seeded fresh game too', async () => {
    dispatch({ t: 'profile_set', dev: true });
    dispatch({ t: 'dev', cmd: 'cash', amount: 777 });
    await reload();
    expect(getGame().wallet.cash).toBe(PACK.economy.startCash + 777);
    useGame.getState().resetGame();
    expect(getGame().seeded).toBe(true);
    expect(getGame().wallet.cash).toBe(PACK.economy.startCash);
  });
});

describe('dispatch routes effects', () => {
  it('toast goes to the v1 store, in the interface language', () => {
    routeEffects([{ t: 'toast', key: 'quests.trio', vars: { n: 150 } }]);
    expect(useStore.getState().toast?.text).toBe('All three done: +¥150');
    useStore.getState().setUiLang('ar');
    routeEffects([{ t: 'toast', key: 'quests.trio', vars: { n: 150 } }]);
    expect(useStore.getState().toast?.text).toMatch(/[؀-ۿ]/);
  });

  it('beat becomes a ui request (once, and only for a beat the pack has); culture becomes a ui request', () => {
    routeEffects([{ t: 'beat', id: 'b_nope' }]);
    expect(useUi.getState().beats).toEqual([]);
    PACK.beats.b_test = BEAT;
    try {
      routeEffects([{ t: 'beat', id: 'b_test' }, { t: 'beat', id: 'b_test' }, { t: 'culture', id: 'cc_irasshaimase' }]);
      expect(useUi.getState().beats).toEqual(['b_test']);
      expect(useUi.getState().culture).toBe('cc_irasshaimase');
      // finishing a beat files it and takes it off the queue
      completeBeat('b_test');
      expect(getGame().beats).toContain('b_test');
      expect(useUi.getState().beats).toEqual([]);
    } finally {
      delete PACK.beats.b_test;
    }
  });

  it('xp goes to the v1 store', () => {
    const xp = useStore.getState().xp;
    routeEffects([{ t: 'xp', amount: 5, why: 'test' }]);
    expect(useStore.getState().xp).toBe(xp + 5);
  });

  it('srsOps: adds a phrase card once (due later when asked), a word card from the lexicon, and reviews on request', () => {
    const before = useStore.getState().vocab.length;
    const line = { ja: 'これ|を|ください|。', en: 'This one, please.', ar: 'هذا من فضلك.' };
    applySrsOps([{ op: 'add', key: 'p_test', kind: 'phrase', line, source: 'goal', dueInMin: 1440 }]);
    applySrsOps([{ op: 'add', key: 'p_test', kind: 'phrase', line, source: 'goal', dueInMin: 1440 }]);
    const v = useStore.getState().vocab;
    expect(v.length).toBe(before + 1);
    const card = v.find((x) => x.key === 'p_test')!;
    expect(card).toMatchObject({ kind: 'phrase', source: 'goal', s: 'これをください。' });
    expect(new Date(card.card.due).getTime()).toBeGreaterThan(Date.now() + 1400 * 60_000);
    // a card that is not due yet is not reviewed by use (§11.5: a DUE card, once a day)
    applySrsOps([{ op: 'review', key: 'p_test', grade: 'good' }]);
    expect(useStore.getState().vocab.find((x) => x.key === 'p_test')!.card.reps).toBe(0);
    // an unknown word key is ignored, not a crash
    expect(() => applySrsOps([{ op: 'add', key: 'zzz-not-a-word', kind: 'word', source: 'sign' }])).not.toThrow();
    expect(useStore.getState().vocab.length).toBe(before + 1);
  });
});

describe('use = review (§11.5)', () => {
  const word = { kind: 'word' as const, s: 'テスト', rom: 'tesuto', meaning: { en: 'test', ar: 'اختبار' }, source: 'goal' as const, key: 'w_use_review' };
  const reps = () => useStore.getState().vocab.find((x) => x.key === 'w_use_review')!.card.reps;

  it('reviews a due card once a day, however many times the word is used, and never a card that is not due or is parked', () => {
    useStore.getState().saveWord(word);
    applySrsOps([{ op: 'review', key: 'w_use_review', kind: 'word', grade: 'good' }]);
    expect(reps()).toBe(1);
    // the same word again in the next conversation of the day: the card is no longer due and was reviewed today
    applySrsOps([{ op: 'review', key: 'w_use_review', kind: 'word', grade: 'good' }]);
    applySrsOps([{ op: 'review', key: 'w_use_review', kind: 'word', grade: 'good' }]);
    expect(reps()).toBe(1);
    // a parked card (no due date) stays parked
    const id = useStore.getState().vocab.find((x) => x.key === 'w_use_review')!.id;
    useStore.setState((st) => ({ vocab: st.vocab.map((v) => (v.id === id ? { ...v, card: { ...v.card, due: '9999-12-31T00:00:00.000Z', last_review: undefined } } : v)) }));
    applySrsOps([{ op: 'review', key: 'w_use_review', kind: 'word', grade: 'good' }]);
    expect(reps()).toBe(1);
    expect(useStore.getState().vocab.find((x) => x.key === 'w_use_review')!.card.due).toBe('9999-12-31T00:00:00.000Z');
  });

  it('a class-I turn in a settled conversation reviews its due word cards through the real dispatch, once', () => {
    useStore.getState().saveWord({ ...word, s: 'コーヒー', key: 'w_use_review' });
    const f = (sessionId: string, norm: string): ConversationFacts => ({
      sessionId, scenarioId: 'cafe', characterId: 'yuki', mode: 'guided', abandoned: false, durationSec: 60, goalDone: 4, goalTotal: 4,
      turns: [{ id: 1, cls: 'I', credit: 1, substantive: true, contentTokens: 2, stepIds: ['order'], norm, newWords: [], words: ['コーヒー'] }],
      fallbacks: 0, hintUses: 0, accuracy: 100, requestsPolite: true, prepared: false, remembered: {},
    });
    dispatch({ t: 'conversation_done', facts: f('s_ur1', 'a') });
    expect(reps()).toBe(1);
    dispatch({ t: 'conversation_done', facts: f('s_ur2', 'b') });
    expect(reps()).toBe(1);
  });
});

describe('recordLoop hook', () => {
  const facts = (sessionId: string): ConversationFacts => ({
    sessionId,
    scenarioId: 'cafe',
    characterId: 'yuki',
    mode: 'guided',
    abandoned: false,
    durationSec: 90,
    goalDone: 1,
    goalTotal: 1,
    turns: [],
    fallbacks: 0,
    hintUses: 0,
    accuracy: null,
    requestsPolite: true,
    prepared: false,
    remembered: {},
  });
  const report = { stats: { goalDone: 1, goalTotal: 1, independent: 0, assisted: 0, durationSec: 90 }, corrections: [], scores: { goal: 100 } } as never;

  it('without facts it only does the v1 bookkeeping; with facts the game settles the conversation', () => {
    useStore.getState().recordLoop({ scenarioId: 'cafe', report, turns: [] });
    expect(useStore.getState().completed.cafe.count).toBe(1);
    expect(getGame().runs.cafe).toBeUndefined();
    useStore.getState().recordLoop({ scenarioId: 'cafe', report, turns: [], facts: facts('s1') });
    expect(getGame().runs.cafe).toMatchObject({ count: 1, complete: true, stars: 1 });
    expect(getGame().seen).toContain('loop:s1');
    // the same session twice is paid once (the reducer dedupes by session id)
    useStore.getState().recordLoop({ scenarioId: 'cafe', report, turns: [], facts: facts('s1') });
    expect(getGame().runs.cafe?.count).toBe(1);
  });

  it('the settled conversation is on disk before recordLoop returns (E10)', () => {
    useStore.getState().recordLoop({ scenarioId: 'cafe', report, turns: [], facts: facts('s2') });
    const written = JSON.parse(globalThis.localStorage.getItem(GAME_KEY)!);
    expect(written.state.runs.cafe.count).toBe(1);
    expect(JSON.parse(globalThis.localStorage.getItem('lw.v1.state')!).completed.cafe.count).toBe(1);
  });
});

describe('navigation entry points', () => {
  it('openScreen sets the screen argument and navigates', () => {
    openScreen('prepare', { scenarioId: 'konbini', characterId: 'tanaka' });
    expect(useStore.getState().screen).toBe('prepare');
    expect(useUi.getState().args.prepare).toEqual({ scenarioId: 'konbini', characterId: 'tanaka' });
  });
});
