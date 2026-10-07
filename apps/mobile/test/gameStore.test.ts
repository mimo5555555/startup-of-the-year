import './_fakeStorage';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_STORE_VERSION, gameStorageKey, validateState, type GameState } from '@lw/game';
import { breakWrites, putSaved, saved, savedJson, wipeSaved } from './_fakeStorage';
import { dispatch, init, resetBridgeForTests } from '../src/game/bridge';
import { GAME_KEY, flushGameNow, getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { useStore, type Profile } from '../src/store';
import { CHARACTERS } from '@lw/content';

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`../../../packages/game/test/saves/${name}.json`, import.meta.url), 'utf8'));

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

/** A reload: the in-memory stores are forgotten and `init` boots from whatever is in storage. */
async function reload() {
  resetBridgeForTests();
  useStore.setState({ ready: false });
  await init();
}

beforeEach(() => {
  wipeSaved();
  useStore.getState().reset();
  resetBridgeForTests();
  useGame.getState().resetGame();
  wipeSaved();
});

describe('useGame persistence', () => {
  it('uses the key lw.game.jp.v1 at version 1', () => {
    expect(GAME_KEY).toBe('lw.game.jp.v1');
    expect(gameStorageKey('jp')).toBe(GAME_KEY);
    expect(useGame.persist.getOptions()).toMatchObject({ name: GAME_KEY, version: GAME_STORE_VERSION, skipHydration: true });
  });

  it('does not read storage by itself (skipHydration): nothing is hydrated until init', async () => {
    putSaved(GAME_KEY, { state: { ...(fixture('v1-typical') as object) }, version: 1 });
    expect(useGame.getState().hydrated).toBe(false);
    expect(useGame.getState().wallet.cash).toBe(3000);
    await init();
    expect(useGame.getState().hydrated).toBe(true);
    expect(useGame.getState().wallet.cash).not.toBe(3000);
  });

  it('a first run starts the game at the wallet of the pack, seeded, and writes it', async () => {
    await init();
    const g = getGame();
    expect(g.wallet).toEqual({ cash: PACK.economy.startCash, ic: 0, points: 0 });
    expect(g.chapter.n).toBe(1);
    expect(g.seeded).toBe(true);
    expect(validateState(g, PACK)).toEqual([]);
    expect(savedJson(GAME_KEY)).toMatchObject({ version: GAME_STORE_VERSION, state: { v: 1, packId: 'jp', seeded: true } });
  });

  it('round trip: a money event is on disk at once, and a reload gives the same state', async () => {
    await init();
    useStore.getState().completeOnboarding(profile);
    dispatch({ t: 'profile_set', dev: true });
    dispatch({ t: 'dev', cmd: 'cash', amount: 10_000 });
    // `dev` flushes now: no waiting for the debounce
    expect(savedJson(GAME_KEY).state.wallet.cash).toBe(PACK.economy.startCash + 10_000);
    const before = getGame();
    await reload();
    expect(getGame()).toEqual(before);
    expect(getGame().flags.dev).toBe(true);
  });

  it('writes are debounced by 250 ms, except the events that move money or story', async () => {
    vi.useFakeTimers();
    try {
      await init();
      useStore.getState().completeOnboarding(profile);
      flushGameNow();
      dispatch({ t: 'profile_set', nameKana: 'サム' });
      expect(savedJson(GAME_KEY).state.me.nameKana).toBe('');
      vi.advanceTimersByTime(249);
      expect(savedJson(GAME_KEY).state.me.nameKana).toBe('');
      vi.advanceTimersByTime(2);
      expect(savedJson(GAME_KEY).state.me.nameKana).toBe('サム');
      // a story event does not wait
      dispatch({ t: 'flag', id: 'letter_written' });
      expect(savedJson(GAME_KEY).state.chapter.flags).toContain('letter_written');
    } finally {
      vi.useRealTimers();
    }
  });

  it('flushes on pagehide and when the page becomes hidden', async () => {
    const listeners = new Map<string, () => void>();
    const doc = { visibilityState: 'visible', addEventListener: (n: string, f: () => void) => listeners.set(`doc:${n}`, f), removeEventListener: () => {} };
    const win = { addEventListener: (n: string, f: () => void) => listeners.set(`win:${n}`, f), removeEventListener: () => {} };
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', doc);
    try {
      await init();
      useStore.getState().completeOnboarding(profile);
      flushGameNow();
      dispatch({ t: 'profile_set', nameKana: 'ア' });
      expect(savedJson(GAME_KEY).state.me.nameKana).toBe('');
      listeners.get('win:pagehide')!();
      expect(savedJson(GAME_KEY).state.me.nameKana).toBe('ア');
      dispatch({ t: 'profile_set', nameKana: 'イ' });
      doc.visibilityState = 'hidden';
      listeners.get('doc:visibilitychange')!();
      expect(savedJson(GAME_KEY).state.me.nameKana).toBe('イ');
      // the v1 store is flushed by the same events
      useStore.getState().updateSettings({ romaji: true });
      listeners.get('win:pagehide')!();
      expect(savedJson('lw.v1.state').settings.romaji).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('useGame migration through the store', () => {
  const boot = async (blob: unknown) => {
    putSaved(GAME_KEY, blob);
    await reload();
    return getGame();
  };

  it('empty, typical, heavy: each frozen v1 fixture loads, validates and keeps its wallet and clock', async () => {
    for (const name of ['v1-empty', 'v1-typical', 'v1-heavy']) {
      const raw = fixture(name) as GameState;
      const g = await boot({ state: raw, version: 1 });
      expect(validateState(g, PACK), name).toEqual([]);
      expect(g.wallet.cash, name).toBe(raw.wallet.cash);
      expect(g.clock.dayIndex, name).toBeGreaterThanOrEqual(raw.clock.dayIndex);
      expect(g.seeded, name).toBe(true);
    }
  });

  it('corrupt: a damaged save is repaired, its unknown ids are kept under _extra, never dropped', async () => {
    const g = await boot({ state: fixture('v1-corrupt'), version: 1 });
    expect(validateState(g, PACK)).toEqual([]);
    expect(g.wallet.cash).toBeGreaterThanOrEqual(0);
    // unknown fields are parked; an id of a table the pack has not filled yet stays where it is, one it knows nothing of is parked
    expect(g._extra).toMatchObject({ fields: { carried: 1, futureField: { keep: 'me' } } });
    expect(JSON.stringify({ owned: g.owned, extra: g._extra })).toContain('old_lamp');
  });

  it('a bare state (no envelope) and an older version both go through migrate', async () => {
    const raw = fixture('v1-typical') as GameState;
    expect((await boot(raw)).wallet.cash).toBe(raw.wallet.cash);
    expect((await boot({ state: raw, version: 0 })).wallet.cash).toBe(raw.wallet.cash);
  });

  it('unreadable text is not overwritten silently: it is kept next to the save, and the game starts fresh', async () => {
    const g = await boot('{"state": {"wallet": ');
    expect(g.wallet.cash).toBe(PACK.economy.startCash);
    expect(saved(`${GAME_KEY}.corrupt`)).toBe('{"state": {"wallet": ');
    expect(validateState(g, PACK)).toEqual([]);
  });

  it('a save that parses but is not a state loads as a fresh game with the junk parked, never a crash', async () => {
    for (const junk of [42, 'text', [1, 2], { state: 5, version: 1 }, { state: null, version: 1 }]) {
      const g = await boot(junk);
      expect(validateState(g, PACK), JSON.stringify(junk)).toEqual([]);
      expect(g.wallet.cash).toBe(PACK.economy.startCash);
    }
  });
});

describe('blocked storage', () => {
  it('a store that cannot write keeps working in memory and does not throw', async () => {
    await init();
    useStore.getState().completeOnboarding(profile);
    breakWrites(true);
    try {
      expect(() => {
        dispatch({ t: 'profile_set', dev: true });
        dispatch({ t: 'dev', cmd: 'cash', amount: 500 });
        flushGameNow();
      }).not.toThrow();
      expect(getGame().wallet.cash).toBe(PACK.economy.startCash + 500);
    } finally {
      breakWrites(false);
    }
  });
});
