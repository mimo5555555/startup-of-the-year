// The player's own room in progress (Release 2 wave B2): the one piece of state HomeOwn, the world screen, the conversation host and Prepare
// share, as `homeStore` is for a friend's home. Being inside is never saved: a reload puts the player on the street (the furniture is in the
// game save, `home.placed`).
import { create } from 'zustand';
import { OWN_ROOMS } from '@lw/content';
import { getGame } from './gameStore';
import { useHome } from './homeStore';

/**
 *  - `enter`   asked for; HomeOwn decides 3D or panel and goes in
 *  - `genkan`  the flat, the first time: shoes off, then slippers (your own door still has a genkan)
 *  - `inside`  in the room: walk around, furnish, talk to the guest, leave
 *  - `convo`   the housewarming conversation (and its debrief) is on
 */
export type OwnPhase = 'enter' | 'genkan' | 'inside' | 'convo';

export interface OwnRoom {
  tier: 'dorm' | 'ono';
  /** the stage id the world builds */
  stage: 'dorm' | 'ono_flat';
  /** '3d' = the stage is loaded; 'panel' = the fallback (a stage that cannot load, a low-end setting, `?panel=1`) */
  mode: '3d' | 'panel';
  phase: OwnPhase;
  shoesOff: boolean;
  slippersOn: boolean;
  /** the furnish sheet is open (the world shows the slot markers meanwhile) */
  furnish: boolean;
  /** the owned piece the player picked and is about to put somewhere */
  pick: string | null;
  /** the invited friend of a housewarming */
  guest?: string;
  /** the housewarming's conversation mode, when Prepare chose one */
  talk?: 'guided' | 'real';
  /** the housewarming's conversation was started (leaving before its debrief asks first) */
  talkStarted?: boolean;
  /** the housewarming reached its debrief (so Talk is not offered again) */
  done: boolean;
}

interface OwnState {
  room: OwnRoom | null;
  /** asks to go in (the room of the CURRENT tier); ignored while a room or a friend's home is on (a double tap) */
  begin(opts?: { guest?: string; talk?: 'guided' | 'real' }): boolean;
  patch(p: Partial<OwnRoom>): void;
  end(): void;
}

export const useOwn = create<OwnState>()((set, get) => ({
  room: null,
  begin(opts = {}) {
    if (get().room || useHome.getState().visit) return false;
    const def = OWN_ROOMS[getGame().home.tier];
    set({
      room: {
        tier: def.tier,
        stage: def.stage,
        mode: '3d',
        phase: 'enter',
        shoesOff: false,
        slippersOn: false,
        furnish: false,
        pick: null,
        done: false,
        ...(opts.guest ? { guest: opts.guest } : {}),
        ...(opts.talk ? { talk: opts.talk } : {}),
      },
    });
    return true;
  },
  patch: (p) => set((s) => (s.room ? { room: { ...s.room, ...p } } : s)),
  end: () => set({ room: null }),
}));

/** Goes into the player's own room from anywhere (the door, the Wallet, the housewarming invitation). Returns whether it started. */
export const beginOwn = (opts?: { guest?: string; talk?: 'guided' | 'real' }): boolean => useOwn.getState().begin(opts);
