// The visit in progress (Release 2 wave B1): the one piece of state HomeStage, the world screen, the conversation host and Prepare share.
// Being inside is never saved: a reload puts the player on the street (the stats and keepsakes of a finished visit are in the game save).
import { create } from 'zustand';
import { HOMES, type HomeDef } from '@lw/content';

/**
 *  - `enter`   asked for; HomeStage decides 3D or panel and goes in
 *  - `genkan`  at the entrance: shoes off, then slippers
 *  - `convo`   the conversation (and its debrief) is on
 *  - `inside`  back in the room: look around, tap the props, leave
 */
export type HomePhase = 'enter' | 'genkan' | 'convo' | 'inside';

export interface HomeVisit {
  def: HomeDef;
  /** '3d' = the stage is loaded; 'panel' = the fallback (a stage that cannot load, a low-end setting, `?panel=1`) */
  mode: '3d' | 'panel';
  phase: HomePhase;
  shoesOff: boolean;
  slippersOn: boolean;
  /** the conversation's mode, when Prepare chose one (absent = Guided) */
  talk?: 'guided' | 'real';
}

interface HomeState {
  visit: HomeVisit | null;
  /** asks to visit; ignored while a visit is on (a double tap) or for an id that is not a home */
  begin(scenarioId: string, talk?: 'guided' | 'real'): boolean;
  patch(p: Partial<Omit<HomeVisit, 'def'>>): void;
  end(): void;
}

export const useHome = create<HomeState>()((set, get) => ({
  visit: null,
  begin(scenarioId, talk) {
    const def = HOMES[scenarioId];
    if (!def || get().visit) return false;
    set({ visit: { def, mode: '3d', phase: 'enter', shoesOff: false, slippersOn: false, ...(talk ? { talk } : {}) } });
    return true;
  },
  patch: (p) => set((s) => (s.visit ? { visit: { ...s.visit, ...p } } : s)),
  end: () => set({ visit: null }),
}));

/** Starts a home visit from anywhere (the door, the Talk list, Prepare). Returns whether it started. */
export const beginVisit = (scenarioId: string, talk?: 'guided' | 'real'): boolean => useHome.getState().begin(scenarioId, talk);

/** Whether a scenario is a home visit (so Prepare and the plans route it through the genkan). */
export const isHomeScenario = (scenarioId: string): boolean => scenarioId in HOMES;
