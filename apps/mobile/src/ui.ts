import { create } from 'zustand';
import type { Token } from '@lw/content';
import type { Example } from './content';

export interface WordTarget {
  token: Token;
  source: 'sign' | 'conversation' | 'lesson' | 'phrase';
  example?: Example;
  /** for whole phrases (assisted lines) */
  phrase?: { written: string; tokens: Token[]; en?: string; ar?: string };
}

/**
 * A request to talk, from anywhere (the world, Prepare, Phone, Shift, a trip, a home): the conversation host in App mounts
 * Conversation for it (docs/GAME_DESIGN.md §11.2). `channel` 'chat' and characters without a world spawn skip the world camera.
 */
export interface ConvoRequest {
  scenarioId: string;
  characterId: string;
  channel?: 'world' | 'chat';
  /** 'real' hides the suggestion chips and pays +25% yen; absent = Guided */
  mode?: 'guided' | 'real';
  startNode?: string;
}

/** What the screens that need an argument read when they open (set by `bridge.openScreen`, which also navigates). */
export interface ScreenArgs {
  prepare: { scenarioId: string; characterId: string; mode?: 'guided' | 'real' };
  shift: { jobId: string };
  phone: { friendId?: string };
  quests: { tab?: 'dream' | 'story' | 'today' | 'friends' | 'culture' };
}

interface UiState {
  word: WordTarget | null;
  convo: ConvoRequest | null;
  /** beat ids waiting to be shown; the first one is on screen while the 'beat' route is open */
  beats: string[];
  /** a culture card to show (the stamp book opens on it); the debrief clears it when it shows the card itself */
  culture: string | null;
  args: Partial<ScreenArgs>;
  /** the tracker target the player is working towards (§11.7: locked until done or the day changes) */
  trackerLock: { id: string; day: number } | null;
  openWord(w: WordTarget): void;
  closeWord(): void;
  startConvo(r: ConvoRequest): void;
  endConvo(): void;
  queueBeat(id: string): void;
  /** drops the beat on screen (or a given one) from the queue */
  finishBeat(id?: string): void;
  showCulture(id: string): void;
  closeCulture(): void;
  setArgs<K extends keyof ScreenArgs>(screen: K, a: ScreenArgs[K]): void;
  lockTracker(lock: { id: string; day: number } | null): void;
  clearRequests(): void;
}

export const useUi = create<UiState>()((set) => ({
  word: null,
  convo: null,
  beats: [],
  culture: null,
  args: {},
  trackerLock: null,
  openWord: (word) => set({ word }),
  closeWord: () => set({ word: null }),
  startConvo: (convo) => set({ convo }),
  endConvo: () => set({ convo: null }),
  queueBeat: (id) => set((s) => (s.beats.includes(id) ? s : { beats: [...s.beats, id] })),
  finishBeat: (id) => set((s) => ({ beats: id ? s.beats.filter((b) => b !== id) : s.beats.slice(1) })),
  showCulture: (culture) => set({ culture }),
  closeCulture: () => set({ culture: null }),
  setArgs: (screen, a) => set((s) => ({ args: { ...s.args, [screen]: a } })),
  lockTracker: (trackerLock) => set({ trackerLock }),
  clearRequests: () => set({ convo: null, beats: [], culture: null, args: {}, trackerLock: null }),
}));
