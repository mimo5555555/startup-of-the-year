// Goen stage 1's UI state (docs/GOEN.md): the wish ritual in progress at the shrine, and the Kyoto Journey under way.
//
// The ritual (coin, 二礼二拍手一礼, the wish, the celebration) runs over the 3D shrine so the avatar's bows and claps are seen; it is not saved
// (the Goen is spent and the item owned at the coin toss, so a reload only skips the rest of the ceremony).
//
// The Kyoto Journey: the id of the Shinkansen fare that took the player to Kyoto, kept until the ride
// back is filed (`trip_done kyoto`). It lives next to the game save (its own key) so a reload in the middle of the journey stays in Kyoto with
// the fare paid once; the fare's ledger entry is the witness (`inKyoto`), so a game reset or a cleared save also ends the journey.
// The screen that shows (the Kyoto map, the ride animation) is not saved: a reload lands on the map.
import { create } from 'zustand';

const KEY = 'lw.kyoto.v1';

interface KyotoState {
  /** the fare id of the trip under way, or null on the street */
  away: string | null;
  /** the Shinkansen window plays once, right after the departure */
  ride: boolean;
  setAway(id: string | null): void;
  setRide(on: boolean): void;
}

function read(): string | null {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as { away?: unknown }) : null;
    return typeof v?.away === 'string' && v.away.length < 80 ? v.away : null;
  } catch {
    return null;
  }
}

function write(away: string | null): void {
  try {
    if (away) globalThis.localStorage?.setItem(KEY, JSON.stringify({ away }));
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* private mode: the journey still works until the page closes */
  }
}

export const useKyoto = create<KyotoState>()((set) => ({
  away: read(),
  ride: false,
  setAway: (away) => {
    write(away);
    set({ away, ...(away ? {} : { ride: false }) });
  },
  setRide: (ride) => set({ ride }),
}));

/** Tests and a reset: read the saved marker again. */
export const reloadKyoto = (): void => useKyoto.setState({ away: read(), ride: false });

/**
 *  - `coin`  toss the coin (dispatches `goen_spend`)
 *  - `taps`  二礼二拍手一礼: `done` of the five taps
 *  - `wish`  the shrine_wish conversation is on (or about to start)
 *  - `done`  the item is yours: the short celebration
 */
export type RitualStep = 'coin' | 'taps' | 'wish' | 'done';

export interface Ritual {
  itemId: string;
  step: RitualStep;
  done: number;
  /** the next move after a wrong tap (Hanako's hint), else null */
  hint: 'bow' | 'clap' | null;
  /** the spend's event id (a double tap on the coin is the same toss) */
  spendId: string;
}

interface ShrineState {
  ritual: Ritual | null;
  start(itemId: string, spendId: string): void;
  patch(p: Partial<Ritual>): void;
  end(): void;
}

export const useShrine = create<ShrineState>()((set) => ({
  ritual: null,
  start: (itemId, spendId) => set({ ritual: { itemId, step: 'coin', done: 0, hint: null, spendId } }),
  patch: (p) => set((s) => (s.ritual ? { ritual: { ...s.ritual, ...p } } : s)),
  end: () => set({ ritual: null }),
}));
