// The persistent game store `useGame` (docs/GAME_DESIGN.md D2, §14.7). It holds the @lw/game `GameState` flat, plus two actions.
// Nothing writes it except `bridge.dispatch` (through `setGame`) and the reset; everything else only reads.
import { create } from 'zustand';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { persist } from 'zustand/middleware';
import { SafeLocalStore } from '@lw/core';
import { GAME_STORE_VERSION, createGameState, gameStorageKey, migrate, parseSaved, seedFromLegacy, type GameState } from '@lw/game';
import { PACK, PACK_ID } from './pack';

/** Writes wait this long for more changes (D2: debounced) unless an event that moves money or story flushes at once. */
const WRITE_DELAY_MS = 250;

export const GAME_KEY = gameStorageKey(PACK_ID);

interface GameActions {
  /** false until `bridge.init` has hydrated and seeded the store: nothing may read `GameView`-dependent state before that */
  hydrated: boolean;
  /** replaces the game state with the reducer's result */
  setGame(next: GameState): void;
  /** a brand-new game (wallet at startCash, chapter 1), already seeded so the legacy seed never runs over it */
  resetGame(now?: number): void;
}

export type GameStore = GameState & GameActions;

// Blocked storage degrades to memory inside SafeLocalStore; the key already carries the pack and version, so no prefix.
const kv = new SafeLocalStore('');
let pending: { name: string; value: StorageValue<GameState> } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** Writes the pending save now (money, purchase and story events; `pagehide`; `visibilitychange: hidden`). */
export function flushGameNow(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending) return;
  const { name, value } = pending;
  pending = null;
  try {
    kv.set(name, JSON.stringify(value));
  } catch {
    /* a state that cannot be written stays in memory; SafeLocalStore already keeps its copy */
  }
}

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const storage: PersistStorage<GameState> = {
  getItem(name) {
    const raw = kv.get(name);
    if (raw === null) return null;
    const parsed = parseSaved(raw);
    if (parsed === undefined) {
      // unreadable text: keep it next to the save so the next write cannot be the silent loss of the player's data (§14.7)
      kv.set(`${name}.corrupt`, raw);
      return null;
    }
    // a zustand envelope, or a bare state (version 0 sends it through `migrate`)
    if (isRec(parsed) && 'state' in parsed && typeof parsed.version === 'number') return parsed as unknown as StorageValue<GameState>;
    return { state: parsed as GameState, version: 0 };
  },
  setItem(name, value) {
    pending = { name, value };
    timer ??= setTimeout(flushGameNow, WRITE_DELAY_MS);
  },
  removeItem(name) {
    if (timer) clearTimeout(timer);
    timer = null;
    pending = null;
    kv.remove(name);
  },
};

/** The persisted part of the store: the GameState without the actions. */
function partialize(s: GameStore): GameState {
  const { hydrated: _h, setGame: _s, resetGame: _r, ...state } = s;
  void _h, _s, _r;
  return state;
}

export const useGame = create<GameStore>()(
  persist(
    (set) => ({
      ...createGameState(PACK, Date.now()),
      hydrated: false,
      setGame: (next) => set({ ...next, _extra: next._extra }),
      resetGame: (now = Date.now()) => {
        const fresh = seedFromLegacy(createGameState(PACK, now), PACK, { completed: {} });
        set({ ...fresh, _extra: undefined });
        flushGameNow();
      },
    }),
    {
      name: GAME_KEY,
      version: GAME_STORE_VERSION,
      skipHydration: true,
      storage,
      partialize,
      // `migrate` is the one door every saved value goes through: zustand only calls the `migrate` option on a version mismatch,
      // so the merge runs it for the current version too (a hand-edited or half-written save is repaired, never trusted)
      migrate: (persisted, from) => migrate(persisted, from, PACK),
      merge: (persisted, current) => (persisted === undefined ? current : { ...current, ...migrate(persisted, GAME_STORE_VERSION, PACK) }),
    },
  ),
);

/** The current game state without the store's actions. */
export const getGame = (): GameState => partialize(useGame.getState());
