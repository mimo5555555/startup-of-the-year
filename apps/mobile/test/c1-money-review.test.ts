// Wave C1 review regressions (money, state and story): the readings of the station desk's times, the twelve-hour clock people speak, a
// machine ticket to Hikarigaoka counted as the way there of the trip, a trip paid once across midnight, the short-of-money message with two
// pockets, and Chapter 6's adult-only reward card for kids and teens.
import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, LEXICON, tokenize } from '@lw/content';
import { BALANCE, createGameState, evaluateAll, type GameState, type GameView } from '@lw/game';
import { wipeSaved } from './_fakeStorage';
import { init, resetBridgeForTests, startConversation } from '../src/game/bridge';
import { getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { tripQuote } from '../src/game/tripLogic';
import { deskPhrase, timePhrase, timeSaid } from '../src/components/game/shift/stationLogic';
import { useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';

const readingOf = (markup: string): string =>
  tokenize(markup, LEXICON)
    .tokens.filter((t) => !t.punct)
    .map((t) => t.r || t.s)
    .join('');

describe('the station desk says times with their real readings', () => {
  it('九時 is くじ, 十四時 じゅうよじ, 五十八分 ごじゅうはっぷん (regression: きゅうじ, じゅうよんじ, ごじゅうはちふん)', () => {
    expect(readingOf(timePhrase(9 * 60 + 58))).toBe('くじごじゅうはっぷんです');
    expect(readingOf(timePhrase(14 * 60 + 25))).toBe('じゅうよじにじゅうごふんです');
    expect(readingOf(timePhrase(19 * 60 + 30))).toBe('じゅうくじさんじゅっぷんです');
    expect(readingOf(timePhrase(7 * 60 + 1))).toBe('しちじいっぷんです');
    expect(readingOf(timePhrase(10 * 60 + 14))).toBe('じゅうじじゅうよんぷんです');
    expect(readingOf(timePhrase(9 * 60 + 36))).toBe('くじさんじゅうろっぷんです');
    // every phrase the desk can say is lexicon Japanese, and the desk accepts its own phrase written plainly
    for (let m = 0; m < 1440; m += 7) {
      const p = timePhrase(m);
      expect(tokenize(p, LEXICON).missing ?? [], p).toEqual([]);
      expect(timeSaid(p.replace(/\|/g, ''), m), p).toBe(true);
    }
    const s = JP_PACK.jobs.find((j) => j.id === 'job_station')!.archetypes.find((a) => a.id === 's_time')!;
    expect(deskPhrase({ templateId: s.id, line: s.line, task: s.task, thanks: s.thanks })).toBe('九時|五|十|八分|です|。');
  });

  it('the twelve-hour clock is accepted (二時二十五分, 午後二時二十五分 for 14:25), a wrong 午前 / 午後 is not', () => {
    const t = 14 * 60 + 25;
    for (const ok of ['2時25分', '二時二十五分です', '午後2時25分', 'ごごにじにじゅうごふん', '14時25分']) expect(timeSaid(ok, t), ok).toBe(true);
    for (const no of ['午前2時25分', '3時25分', '2時35分']) expect(timeSaid(no, t), no).toBe(false);
    expect(timeSaid('午後9時58分', 9 * 60 + 58)).toBe(false);
    expect(timeSaid('午前9時58分', 9 * 60 + 58)).toBe(true);
    expect(timeSaid('21時58分', 9 * 60 + 58)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0]!.avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const SC = 'trip_hikarigaoka';
const PAPER = 170 + BALANCE.fares.paperExtra;
const fares = () => getGame().ledger.filter((e) => e.kind === 'fare');
const setGame = (patch: Partial<GameState>) => useGame.getState().setGame({ ...getGame(), ...patch });

describe('the trip fare: a machine ticket, midnight, two pockets', () => {
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

  it('a Hikarigaoka ticket in hand is the way there: only the way back is charged, once (regression: three fares)', () => {
    setGame({ wallet: { ...getGame().wallet, cash: 3000, ic: 0 }, tickets: { station: { place: 'hikarigaoka' } } });
    expect(tripQuote(PACK, getGame(), SC, 'hikarigaoka')).toMatchObject({ legs: 1, total: PAPER, method: 'paper' });
    startConversation({ scenarioId: SC, characterId: 'sato' });
    expect(fares()).toHaveLength(1);
    expect(fares()[0]!.delta).toBe(-PAPER);
    expect(getGame().wallet.cash).toBe(3000 - PAPER);
    expect(useStore.getState().toast?.text).toContain('Way back paid');
    // a double tap is no second charge
    useUi.getState().endConvo();
    startConversation({ scenarioId: SC, characterId: 'kato' });
    expect(fares()).toHaveLength(1);
  });

  it('a ticket to another station does not pay for the trip: both ways are charged', () => {
    setGame({ wallet: { ...getGame().wallet, cash: 3000, ic: 0 }, tickets: { station: { place: 'shibuya' } } });
    expect(tripQuote(PACK, getGame(), SC, 'hikarigaoka')).toMatchObject({ legs: 2, total: 2 * PAPER });
  });

  it('a reload after midnight in the middle of the trip (or a trip left unfinished) is not charged again (regression: the day was in the id)', () => {
    setGame({ wallet: { ...getGame().wallet, cash: 3000, ic: 0 } });
    startConversation({ scenarioId: SC, characterId: 'sato' });
    expect(fares()).toHaveLength(1);
    useUi.getState().endConvo();
    setGame({ clock: { ...getGame().clock, dayIndex: getGame().clock.dayIndex + 1 } });
    startConversation({ scenarioId: SC, characterId: 'sato' });
    expect(fares()).toHaveLength(1);
    expect(useUi.getState().convo).toMatchObject({ scenarioId: SC });
    expect(getGame().wallet.cash).toBe(3000 - 2 * PAPER);
  });

  it('short in each pocket: the message names the cash and the card apart, never their sum as "what you have" (regression: costs ¥360, "you have ¥400")', () => {
    setGame({ wallet: { ...getGame().wallet, cash: 300, ic: 100 } });
    startConversation({ scenarioId: SC, characterId: 'sato' });
    expect(fares()).toHaveLength(0);
    expect(useUi.getState().convo).toBeNull();
    const text = useStore.getState().toast?.text ?? '';
    for (const amount of ['¥360', '¥340', '¥300', '¥100']) expect(text).toContain(amount);
    expect(text).not.toContain('¥400');
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------
describe("Chapter 6's reward cards and the age profiles", () => {
  const NOW = new Date(2030, 0, 15, 12).getTime();
  const view = (age: string): GameView => ({
    vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
    discovered: [],
    lessonsDone: [],
    streakDays: 0,
    profile: { age, goal: 'travel', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' } as GameView['profile'],
  });
  const ready = (): GameState => {
    const base = createGameState(JP_PACK, NOW);
    const def = JP_PACK.chapters.find((c) => c.n === 6)!;
    const done = Object.fromEntries(def.objectives.filter((o) => !o.dream).map((o) => [o.id, 'd20']));
    return { ...base, clock: { ...base.clock, dayIndex: 40, activeDays: 40 }, chapter: { ...base.chapter, n: 6, done, completed: [1, 2, 3, 4, 5], began: { dayIndex: 30, activeDays: 30 } } };
  };

  it('kids and teens never get the rent card from the chapter reward (regression: its pop-up showed); adults do; the rest is the same', () => {
    for (const age of ['kids', 'teens']) {
      const r = evaluateAll(ready(), { pack: JP_PACK, now: NOW, view: view(age), rng: () => 0.5 });
      expect(r.state.chapter.completed, age).toContain(6);
      expect(r.state.culture.cc_rent, age).toBeUndefined();
      expect(r.effects, age).not.toContainEqual({ t: 'culture', id: 'cc_rent' });
      expect(r.state.culture.cc_shoesoff, age).toBeDefined();
      expect(r.state.titles, age).toContain('t_guest');
    }
    const adult = evaluateAll(ready(), { pack: JP_PACK, now: NOW, view: view('adults'), rng: () => 0.5 });
    expect(adult.state.culture.cc_rent).toBeDefined();
    expect(adult.effects).toContainEqual({ t: 'culture', id: 'cc_rent' });
  });
});
