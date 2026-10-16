import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { CHARACTERS, characterById as pickChar } from '@lw/content';
import { BALANCE, type ConversationFacts } from '@lw/game';
import { wipeSaved } from './_fakeStorage';
import { completeBeat, dispatch, init, resetBridgeForTests, startConversation } from '../src/game/bridge';
import { getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { isTripScenario } from '../src/game/host';
import { talk } from '../src/screens/Prepare';
import { tripOf, tripQuote } from '../src/game/tripLogic';
import { TripBackdrop } from '../src/components/game/TripBackdrop';
import { STRINGS } from '../src/i18n';
import { useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';

const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0]!.avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const SC = 'trip_hikarigaoka';
const fares = () => getGame().ledger.filter((e) => e.kind === 'fare');
const setWallet = (cash: number, ic = 0) => useGame.getState().setGame({ ...getGame(), wallet: { ...getGame().wallet, cash, ic }, totals: { ...getGame().totals } });

const facts = (abandoned: boolean, sessionId = 's1'): ConversationFacts => ({
  sessionId, scenarioId: SC, characterId: 'kato', mode: 'guided', abandoned, durationSec: 60, goalDone: abandoned ? 0 : 2, goalTotal: 3, turns: [], fallbacks: 0, hintUses: 0,
  accuracy: null, requestsPolite: true, prepared: false, remembered: {},
});

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

describe('the Hikarigaoka trip: fare up front, once, and never when short', () => {
  it('the trip is a trip scenario with Kato at a panel place, and the host knows it', () => {
    expect(tripOf(PACK, SC)).toBe('hikarigaoka');
    expect(tripOf(PACK, 'konbini')).toBeNull();
    expect(isTripScenario(SC)).toBe(true);
    expect(isTripScenario('cafe')).toBe(false);
    expect(PACK.fares.hikarigaoka).toBe(170);
  });

  it('charges exactly the round trip (two fares) once, however many times the start is tapped or the app reloads in between', () => {
    setWallet(3000);
    const before = getGame().wallet.cash;
    // started from Sato's row: the talk is with Kato, at the other end of the line (regression: the host was Sato)
    startConversation({ scenarioId: SC, characterId: 'sato' });
    expect(useUi.getState().convo).toMatchObject({ scenarioId: SC, characterId: 'kato' });
    // paper tickets in cash: the IC card is empty (170 + 10 each way)
    expect(fares()).toHaveLength(1);
    expect(fares()[0]!.delta).toBe(-2 * (170 + BALANCE.fares.paperExtra));
    expect(getGame().wallet.cash).toBe(before - 360);
    // a double tap, then a second tap after leaving the conversation: still one charge
    startConversation({ scenarioId: SC, characterId: 'kato' });
    useUi.getState().endConvo();
    startConversation({ scenarioId: SC, characterId: 'kato' });
    expect(fares()).toHaveLength(1);
    expect(getGame().wallet.cash).toBe(before - 360);
    expect(getGame().totals.checksum.cash).toBe(getGame().wallet.cash);
  });

  it('pays with the IC card when it holds the round trip', () => {
    setWallet(3000, 400);
    startConversation({ scenarioId: SC, characterId: 'kato' });
    expect(fares()).toHaveLength(1);
    expect(fares()[0]).toMatchObject({ pocket: 'ic', delta: -340 });
    expect(getGame().wallet.ic).toBe(60);
    expect(getGame().wallet.cash).toBe(3000);
  });

  it('short of cash: nothing is charged, the conversation does not start, and a toast says what it costs', () => {
    setWallet(300, 100);
    startConversation({ scenarioId: SC, characterId: 'kato' });
    expect(fares()).toHaveLength(0);
    expect(useUi.getState().convo).toBeNull();
    expect(useStore.getState().toast?.text).toContain('¥360');
    expect(getGame().wallet.cash).toBe(300);
    expect(tripQuote(PACK, getGame(), SC, 'hikarigaoka').method).toBeNull();
  });

  it('files trip:hikarigaoka when the talk ends, not when it is abandoned, and Chapter 5 objective c5_1 is the visit', () => {
    setWallet(3000);
    startConversation({ scenarioId: SC, characterId: 'kato' });
    useStore.getState().recordLoop({ scenarioId: SC, report: { stats: { goalDone: 0, goalTotal: 3, independent: 0, assisted: 0, durationSec: 5 }, corrections: [], scores: {} } as never, turns: [], facts: facts(true, 'a1') });
    expect(getGame().stats.visits).not.toContain('trip:hikarigaoka');
    useStore.getState().recordLoop({ scenarioId: SC, report: { stats: { goalDone: 2, goalTotal: 3, independent: 0, assisted: 0, durationSec: 60 }, corrections: [], scores: {} } as never, turns: [], facts: facts(false, 'a2') });
    expect(getGame().stats.visits).toContain('trip:hikarigaoka');
    // the same session again changes nothing
    dispatch({ t: 'trip_done', id: 'hikarigaoka' });
    expect(getGame().stats.visits.filter((v) => v === 'trip:hikarigaoka')).toHaveLength(1);
  });
});

describe('the trip is filed by the very event Conversation.tsx dispatches (regression: only recordLoop facts used to be hooked)', () => {
  it('conversation_done for the trip files trip:hikarigaoka unless it was abandoned', () => {
    dispatch({ t: 'conversation_done', facts: facts(true, 'd1') });
    expect(getGame().stats.visits).not.toContain('trip:hikarigaoka');
    dispatch({ t: 'conversation_done', facts: facts(false, 'd2') });
    expect(getGame().stats.visits).toContain('trip:hikarigaoka');
    expect(getGame().chapter.done.c5_1).toBeUndefined(); // Chapter 5 is not current in this fixture; the stat is what the objective reads
  });
});

describe('the trip backdrop', () => {
  it('shows the station square with its sign, Kato at the stall and the ride, in both languages', () => {
    for (const lang of ['en', 'ar'] as const) {
      useStore.setState({ uiLang: lang });
      Object.assign(useStore.getInitialState(), { uiLang: lang });
      const html = renderToStaticMarkup(createElement(TripBackdrop, { host: pickChar('kato')! }));
      expect(html).toContain('data-trip="hikarigaoka"');
      expect(html).toContain('data-trip-sign');
      expect(html).toContain('data-trip-ride');
      expect(html).toContain(lang === 'ar' ? 'هيكاريغا' : 'Hikarigaoka');
      expect(renderToStaticMarkup(createElement(TripBackdrop, { host: pickChar('kato')!, noRide: true }))).not.toContain('data-trip-ride');
    }
    for (const k of Object.keys(STRINGS.en).filter((x) => x.startsWith('trip.'))) expect((STRINGS.ar as Record<string, string>)[k]?.trim(), k).toBeTruthy();
  });
});

describe("Hanako's try without chips: held before the first shop conversation of Chapter 6, Real mode once", () => {
  const chapter = (n: number) => useGame.getState().setGame({ ...getGame(), chapter: { ...getGame().chapter, n } });

  it('Chapter 5 and a trip are never held; Chapter 6 holds the first shop start, plays the beat, then starts it in Real mode and returns to Guided', () => {
    chapter(5);
    startConversation({ scenarioId: 'konbini', characterId: 'tanaka' });
    expect(useUi.getState().convo?.scenarioId).toBe('konbini');
    expect(useUi.getState().beats).toEqual([]);
    useUi.getState().endConvo();

    chapter(6);
    // a conversation that is not a shop, or has no Real mode, is not the try
    startConversation({ scenarioId: 'sato_directions', characterId: 'sato' });
    expect(useUi.getState().convo?.scenarioId).toBe('sato_directions');
    useUi.getState().endConvo();

    startConversation({ scenarioId: 'konbini', characterId: 'tanaka' });
    expect(useUi.getState().convo).toBeNull();
    expect(useUi.getState().beats).toEqual(['b_real_try']);
    completeBeat('b_real_try');
    expect(getGame().chapter.flags).toContain('real_try_seen');
    expect(getGame().chapter.flags).toContain('real_try_done');
    expect(useUi.getState().convo).toMatchObject({ scenarioId: 'konbini', mode: 'real' });
    useUi.getState().endConvo();

    // the try is used up: the next shop conversation is the ordinary Guided one and nothing is queued
    startConversation({ scenarioId: 'cafe', characterId: 'yuki' });
    expect(useUi.getState().convo?.mode).toBeUndefined();
    expect(useUi.getState().beats).toEqual([]);
  });

  it('Prepare leaves the mode open when the player did not touch the toggle, so the try applies to the talk it starts (regression: it always said Guided)', () => {
    chapter(6);
    talk('konbini', 'tanaka', undefined, () => {});
    expect(useUi.getState().convo).toBeNull();
    expect(useUi.getState().beats).toEqual(['b_real_try']);
    completeBeat('b_real_try');
    expect(useUi.getState().convo).toMatchObject({ scenarioId: 'konbini', mode: 'real' });
    useUi.getState().endConvo();
    // a mode the player chose is the player's: Guided stays Guided once the try is used up, and Real is Real
    talk('konbini', 'tanaka', 'guided', () => {});
    expect(useUi.getState().convo?.mode).toBe('guided');
  });

  it('a request that names its mode is never turned into the try, and a reload between the beat and the conversation keeps the offer', () => {
    chapter(6);
    startConversation({ scenarioId: 'konbini', characterId: 'tanaka', mode: 'guided' });
    expect(useUi.getState().convo?.mode).toBe('guided');
    useUi.getState().endConvo();
    // the beat was played, the held conversation was lost (reload): the next shop conversation opens in Real mode
    dispatch({ t: 'flag', id: 'real_try_seen' });
    startConversation({ scenarioId: 'cafe', characterId: 'yuki' });
    expect(useUi.getState().convo).toMatchObject({ scenarioId: 'cafe', mode: 'real' });
    expect(getGame().chapter.flags).toContain('real_try_done');
  });
});
