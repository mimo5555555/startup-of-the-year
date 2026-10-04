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

interface UiState {
  word: WordTarget | null;
  openWord(w: WordTarget): void;
  closeWord(): void;
}

export const useUi = create<UiState>()((set) => ({
  word: null,
  openWord: (word) => set({ word }),
  closeWord: () => set({ word: null }),
}));
