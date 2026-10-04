import { create } from 'zustand';
import {
  SafeLocalStore,
  emptyDay,
  levelFromXp,
  loadJson,
  localDate,
  newSrsCard,
  newStreak,
  reviewCard,
  saveJson,
  touchStreak,
  uid,
  xpForLoop,
  type DayStat,
  type Grade,
  type SrsCard,
  type StreakState,
} from '@lw/core';
import type { AvatarSpec, Gloss, L1, Lesson } from '@lw/content';
import { LEXICON, romajiText, tokenize, GREETINGS } from '@lw/content';
import type { FeedbackReport } from '@lw/engine';
import type { UiLang } from './i18n';

export type Screen = 'onboarding' | 'world' | 'feedback' | 'vocab' | 'stats' | 'settings' | 'lesson';

export interface Profile {
  name: string;
  l1: L1;
  level: 'A1' | 'A2';
  goal: 'travel' | 'work' | 'relocation' | 'casual';
  age: 'kids' | 'teens' | 'adults' | 'seniors';
  topics: string[];
  avatar: AvatarSpec;
  createdAt: string;
}

export interface VocabItem {
  id: string;
  kind: 'word' | 'phrase';
  s: string;
  r?: string;
  rom: string;
  meaning: Partial<Gloss>;
  source: 'sign' | 'conversation' | 'lesson' | 'phrase' | 'starter';
  example?: { ja: string; en: string; ar: string };
  savedAt: string;
  card: SrsCard;
}

export interface LoopRecord {
  id: string;
  scenarioId: string;
  at: string;
  seconds: number;
  goalDone: number;
  goalTotal: number;
  xp: number;
  independent: number;
  assisted: number;
}

export interface Settings {
  furigana: boolean;
  romaji: boolean;
  autoSpeak: boolean;
  autoTranslate: boolean;
  graphics: 'auto' | 'high' | 'low';
  seenTutorial: boolean;
}

export interface ReportData {
  report: FeedbackReport;
  scenarioId: string;
  xp: number;
  levelBefore: number;
  levelAfter: number;
  turns: Array<{ id: number; speaker: 'character' | 'learner'; written: string; en: string; ar: string; assisted: boolean; tokens: import('@lw/content').Token[] }>;
}

interface Persisted {
  profile: Profile | null;
  vocab: VocabItem[];
  xp: number;
  streak: StreakState;
  days: Record<string, DayStat>;
  loops: LoopRecord[];
  completed: Record<string, { count: number; best: number }>;
  lessonsDone: string[];
  discovered: string[];
  errors: Record<string, number>;
  settings: Settings;
  uiLang: UiLang;
}

interface State extends Persisted {
  ready: boolean;
  screen: Screen;
  report: ReportData | null;
  lessonId: string | null;
  /** character to start talking to as soon as the city is on screen ("practise again") */
  pendingTalk: string | null;
  toast: { id: number; text: string; tone?: 'good' | 'info' } | null;

  hydrate(): void;
  go(screen: Screen): void;
  setUiLang(l: UiLang): void;
  updateSettings(p: Partial<Settings>): void;
  completeOnboarding(p: Profile): void;
  setLevel(level: 'A1' | 'A2'): void;
  saveWord(item: Omit<VocabItem, 'id' | 'savedAt' | 'card'>): VocabItem;
  removeWord(id: string): void;
  reviewWord(id: string, grade: Grade): void;
  discover(id: string): boolean;
  addXp(n: number): void;
  recordLoop(input: {
    scenarioId: string;
    report: FeedbackReport;
    turns: ReportData['turns'];
  }): ReportData;
  completeLesson(id: string, xp: number): void;
  say(text: string, tone?: 'good' | 'info'): void;
  setPendingTalk(id: string | null): void;
  reset(): void;
}

const DEFAULT_SETTINGS: Settings = {
  furigana: true,
  romaji: false,
  autoSpeak: true,
  autoTranslate: false,
  graphics: 'auto',
  seenTutorial: false,
};

const store = new SafeLocalStore('lw.v1.');
const KEY = 'state';

function initialPersisted(): Persisted {
  const lang: UiLang = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  return {
    profile: null,
    vocab: [],
    xp: 0,
    streak: newStreak(),
    days: {},
    loops: [],
    completed: {},
    lessonsDone: [],
    discovered: [],
    errors: {},
    settings: { ...DEFAULT_SETTINGS },
    uiLang: lang,
  };
}

function starterWords(): Array<Omit<VocabItem, 'id' | 'savedAt' | 'card'>> {
  return GREETINGS.cards.slice(0, 5).map((c) => {
    const tok = tokenize(c.ja, LEXICON).tokens;
    return {
      kind: 'phrase' as const,
      s: c.ja,
      r: undefined,
      rom: romajiText(tok),
      meaning: { en: c.en, ar: c.ar },
      source: 'starter' as const,
    };
  });
}

let nextToast = 1;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<State>()((set, get) => ({
  ...initialPersisted(),
  ready: false,
  screen: 'onboarding',
  report: null,
  lessonId: null,
  pendingTalk: null,
  toast: null,

  hydrate() {
    const saved = loadJson<Partial<Persisted> | null>(store, KEY, null);
    const base = initialPersisted();
    const merged: Persisted = { ...base, ...(saved ?? {}), settings: { ...DEFAULT_SETTINGS, ...(saved?.settings ?? {}) } };
    set({ ...merged, ready: true, screen: merged.profile ? 'world' : 'onboarding' });
  },

  go(screen) {
    set({ screen });
  },

  setUiLang(uiLang) {
    const p = get().profile;
    set({ uiLang, profile: p ? { ...p, l1: uiLang } : p });
  },

  updateSettings(p) {
    set({ settings: { ...get().settings, ...p } });
  },

  completeOnboarding(profile) {
    const state = get();
    const vocab = state.vocab.length
      ? state.vocab
      : starterWords().map((w) => ({ ...w, id: uid('w_'), savedAt: new Date().toISOString(), card: newSrsCard() }));
    set({ profile, uiLang: profile.l1, vocab, screen: 'world' });
  },

  setLevel(level) {
    const p = get().profile;
    if (p) set({ profile: { ...p, level } });
  },

  saveWord(item) {
    const existing = get().vocab.find((v) => v.s === item.s);
    if (existing) return existing;
    const created: VocabItem = { ...item, id: uid('w_'), savedAt: new Date().toISOString(), card: newSrsCard() };
    const today = localDate();
    const day = { ...(get().days[today] ?? emptyDay()) };
    day.words += 1;
    set({ vocab: [created, ...get().vocab], days: { ...get().days, [today]: day } });
    return created;
  },

  removeWord(id) {
    set({ vocab: get().vocab.filter((v) => v.id !== id) });
  },

  reviewWord(id, grade) {
    set({ vocab: get().vocab.map((v) => (v.id === id ? { ...v, card: reviewCard(v.card, grade) } : v)) });
  },

  discover(id) {
    const s = get();
    if (s.discovered.includes(id)) return false;
    const today = localDate();
    const day = { ...(s.days[today] ?? emptyDay()) };
    day.xp += 2;
    const streak = touchStreak(s.streak).state;
    set({ discovered: [...s.discovered, id], xp: s.xp + 2, days: { ...s.days, [today]: day }, streak });
    return true;
  },

  addXp(n) {
    const s = get();
    const today = localDate();
    const day = { ...(s.days[today] ?? emptyDay()) };
    day.xp += n;
    set({ xp: s.xp + n, days: { ...s.days, [today]: day }, streak: touchStreak(s.streak).state });
  },

  recordLoop({ scenarioId, report, turns }) {
    const s = get();
    const st = report.stats;
    const xp = xpForLoop({ goalDone: st.goalDone, goalTotal: st.goalTotal, independentTurns: st.independent, assistedTurns: st.assisted, durationSec: st.durationSec });
    const today = localDate();
    const day = { ...(s.days[today] ?? emptyDay()) };
    day.seconds += st.durationSec;
    day.loops += 1;
    day.xp += xp;
    const prev = s.completed[scenarioId] ?? { count: 0, best: 0 };
    const errors = { ...s.errors };
    for (const c of report.corrections) errors[c.category] = (errors[c.category] ?? 0) + 1;
    const rec: LoopRecord = {
      id: uid('l_'),
      scenarioId,
      at: new Date().toISOString(),
      seconds: st.durationSec,
      goalDone: st.goalDone,
      goalTotal: st.goalTotal,
      xp,
      independent: st.independent,
      assisted: st.assisted,
    };
    const levelBefore = levelFromXp(s.xp);
    const levelAfter = levelFromXp(s.xp + xp);
    set({
      xp: s.xp + xp,
      days: { ...s.days, [today]: day },
      loops: [rec, ...s.loops].slice(0, 60),
      completed: { ...s.completed, [scenarioId]: { count: prev.count + 1, best: Math.max(prev.best, report.scores.goal) } },
      errors,
      streak: touchStreak(s.streak).state,
    });
    const data: ReportData = { report, scenarioId, xp, levelBefore, levelAfter, turns };
    set({ report: data });
    return data;
  },

  completeLesson(id, xp) {
    const s = get();
    if (s.lessonsDone.includes(id)) return;
    set({ lessonsDone: [...s.lessonsDone, id] });
    get().addXp(xp);
  },

  say(text, tone = 'info') {
    set({ toast: { id: nextToast++, text, tone } });
  },

  setPendingTalk(id) {
    set({ pendingTalk: id });
  },

  reset() {
    store.remove(KEY);
    set({ ...initialPersisted(), ready: true, screen: 'onboarding', report: null, lessonId: null, pendingTalk: null, toast: null });
  },
}));

// Save a moment after anything changes. Storage can be blocked (private windows, embeds); SafeLocalStore copes.
useStore.subscribe((s) => {
  if (!s.ready) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const p: Persisted = {
      profile: s.profile,
      vocab: s.vocab,
      xp: s.xp,
      streak: s.streak,
      days: s.days,
      loops: s.loops,
      completed: s.completed,
      lessonsDone: s.lessonsDone,
      discovered: s.discovered,
      errors: s.errors,
      settings: s.settings,
      uiLang: s.uiLang,
    };
    saveJson(store, KEY, p);
  }, 250);
});

export const dueCount = (vocab: VocabItem[], now = new Date()) => vocab.filter((v) => new Date(v.card.due) <= now).length;
export type { Lesson };
