// Wave C1 review: "Practise again" on the trip's debrief is a new ride. Regression: Feedback started the conversation straight through the UI
// store, past the bridge, so the replayed trip charged no fare (and a short wallet still rode).
import './_fakeStorage';
import { readFileSync } from 'node:fs';
import { CHARACTERS } from '@lw/content';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ConversationFacts } from '@lw/game';
import { wipeSaved } from './_fakeStorage';
import { dispatch, init, resetBridgeForTests, startConversation } from '../src/game/bridge';
import { getGame, useGame } from '../src/game/gameStore';
import { useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';

const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0]!.avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const SC = 'trip_hikarigaoka';
const fares = () => getGame().ledger.filter((e) => e.kind === 'fare');
const setWallet = (cash: number, ic = 0) => useGame.getState().setGame({ ...getGame(), wallet: { ...getGame().wallet, cash, ic } });
const done = (sessionId: string): ConversationFacts => ({
  sessionId, scenarioId: SC, characterId: 'kato', mode: 'guided', abandoned: false, durationSec: 60, goalDone: 2, goalTotal: 3, turns: [], fallbacks: 0, hintUses: 0,
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

describe('Practise again on the trip debrief', () => {
  it('goes through the bridge, not straight to the UI store', () => {
    const src = readFileSync(new URL('../src/screens/Feedback.tsx', import.meta.url), 'utf8');
    expect(src).not.toMatch(/useUi\.getState\(\)\.startConvo\(/);
    expect(src).toMatch(/startConversation\(\{ scenarioId, characterId: character\.id, mode: debrief\.facts\.mode \}\)/);
  });

  it('a finished trip replayed in the same mode is a second ride: charged once more, or not started when short', () => {
    setWallet(3000);
    startConversation({ scenarioId: SC, characterId: 'sato' });
    useUi.getState().endConvo();
    dispatch({ t: 'conversation_done', facts: done('a1') });
    expect(fares()).toHaveLength(1);
    // what the debrief's button now does
    startConversation({ scenarioId: SC, characterId: 'kato', mode: 'guided' });
    expect(fares()).toHaveLength(2);
    expect(useUi.getState().convo).toMatchObject({ scenarioId: SC, characterId: 'kato', mode: 'guided' });
    useUi.getState().endConvo();
    dispatch({ t: 'conversation_done', facts: done('a2') });
    // short of the fare: nothing charged, nothing started
    setWallet(100);
    startConversation({ scenarioId: SC, characterId: 'kato', mode: 'guided' });
    expect(fares()).toHaveLength(2);
    expect(useUi.getState().convo).toBeNull();
  });
});
