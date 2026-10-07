import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS } from '@lw/content';
import { validateState } from '@lw/game';
import { savedJson, wipeSaved } from './_fakeStorage';
import { dispatch, init, resetBridgeForTests } from '../src/game/bridge';
import { GAME_KEY, getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { flushNow, useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';

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

/** A player with some history in both stores. */
async function played() {
  wipeSaved();
  resetBridgeForTests();
  await init();
  useStore.getState().reset();
  useStore.getState().completeOnboarding(profile);
  useStore.getState().addXp(120);
  useStore.getState().saveWord({ kind: 'word', s: '猫', rom: 'neko', meaning: { en: 'cat', ar: 'قطة' }, source: 'sign' });
  useStore.getState().updateSettings({ romaji: true });
  dispatch({ t: 'profile_set', dev: true });
  dispatch({ t: 'dev', cmd: 'cash', amount: 5000 });
  dispatch({ t: 'flag', id: 'letter_written' });
  useUi.getState().queueBeat('b_x');
  flushNow();
}

beforeEach(played);

describe('reset', () => {
  it('Reset game progress clears only the game store: vocabulary, XP, profile and settings stay', () => {
    expect(getGame().wallet.cash).toBe(PACK.economy.startCash + 5000);
    useStore.getState().resetGameProgress();
    const g = getGame();
    expect(g.wallet).toEqual({ cash: PACK.economy.startCash, ic: 0, points: 0 });
    expect(g.chapter.n).toBe(1);
    expect(g.chapter.flags).toEqual([]);
    expect(g.flags.dev).toBeUndefined();
    expect(g.ledger).toEqual([]);
    expect(g.seeded).toBe(true);
    expect(validateState(g, PACK)).toEqual([]);

    const s = useStore.getState();
    expect(s.profile?.name).toBe('Sam');
    expect(s.xp).toBe(120);
    expect(s.vocab.some((v) => v.s === '猫')).toBe(true);
    expect(s.settings.romaji).toBe(true);
    expect(s.screen).toBe('world');
    // what was waiting for the old game (a queued beat) is gone with it
    expect(useUi.getState().beats).toEqual([]);
  });

  it('Reset game progress is written at once, so a reload cannot bring the old game back', () => {
    useStore.getState().resetGameProgress();
    expect(savedJson(GAME_KEY).state.wallet.cash).toBe(PACK.economy.startCash);
    expect(savedJson('lw.v1.state').xp).toBe(120);
  });

  it('the full reset resets BOTH stores, so the two never disagree', () => {
    useStore.getState().reset();
    const s = useStore.getState();
    expect(s.profile).toBeNull();
    expect(s.vocab).toHaveLength(0);
    expect(s.xp).toBe(0);
    expect(s.screen).toBe('onboarding');
    expect(getGame().wallet.cash).toBe(PACK.economy.startCash);
    expect(getGame().flags).toEqual({});
    expect(getGame().seeded).toBe(true);
    expect(useUi.getState().beats).toEqual([]);
    expect(savedJson(GAME_KEY).state.wallet.cash).toBe(PACK.economy.startCash);
  });

  it('after a full reset the next profile starts a clean game, not the old one', async () => {
    useStore.getState().reset();
    resetBridgeForTests();
    await init();
    expect(getGame().wallet.cash).toBe(PACK.economy.startCash);
    expect(getGame().totals).toMatchObject({ earned: 0, spent: 0 });
    expect(getGame().flags.dev).toBeUndefined();
  });

  it('the game store keeps its actions through a reset', () => {
    useStore.getState().resetGameProgress();
    expect(typeof useGame.getState().setGame).toBe('function');
    expect(typeof useGame.getState().resetGame).toBe('function');
  });

  it('dev tools do nothing unless the dev flag is on', () => {
    useStore.getState().resetGameProgress();
    const before = getGame().wallet.cash;
    dispatch({ t: 'dev', cmd: 'cash', amount: 10_000 });
    expect(getGame().wallet.cash).toBe(before);
    dispatch({ t: 'profile_set', dev: true });
    dispatch({ t: 'dev', cmd: 'cash', amount: 10_000 });
    expect(getGame().wallet.cash).toBe(before + 10_000);
    dispatch({ t: 'dev', cmd: 'advance_day' });
    expect(getGame().clock.dayIndex).toBeGreaterThan(0);
  });
});
