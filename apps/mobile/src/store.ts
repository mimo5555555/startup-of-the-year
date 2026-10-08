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
import type { ConversationFacts } from '@lw/game';
import type { UiLang } from './i18n';
import { useGame } from './game/gameStore';
import { useUi } from './ui';

/** The closed set of routes; the game's screens (docs/GAME_DESIGN.md §15.4 row 2A) are stubs until their owners fill them. */
export type Screen =
  | 'onboarding'
  | 'world'
  | 'feedback'
  | 'vocab'
  | 'stats'
  | 'settings'
  | 'lesson'
  | 'quests'
  | 'friends'
  | 'phone'
  | 'shift'
  | 'prepare'
  | 'wallet'
  | 'letter'
  | 'culture'
  | 'beat';

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
  source: 'sign' | 'conversation' | 'lesson' | 'phrase' | 'starter' | 'goal' | 'correction' | 'prepare' | 'echo';
  /** the pack's id for a card made from game data (a pocket line id, a culture card id), so `GameView` can match it; absent = `s` */
  key?: string;
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
  /** `dueInMin`: the card first comes due that many minutes from now instead of at once (cards made by game goals) */
  saveWord(item: Omit<VocabItem, 'id' | 'savedAt' | 'card'>, opts?: { dueInMin?: number }): VocabItem;
  removeWord(id: string): void;
  reviewWord(id: string, grade: Grade): void;
  discover(id: string): boolean;
  addXp(n: number): void;
  recordLoop(input: {
    scenarioId: string;
    report: FeedbackReport;
    turns: ReportData['turns'];
    /** the settled conversation (agent 2C builds it with the engine's `facts()`); present = also sent to the game as `conversation_done` */
    facts?: ConversationFacts;
  }): ReportData;
  completeLesson(id: string, xp: number): void;
  say(text: string, tone?: 'good' | 'info'): void;
  setPendingTalk(id: string | null): void;
  /** clears only the game save (wallet, chapter, friends...), keeping vocabulary, XP and settings (§14.7) */
  resetGameProgress(): void;
  /** clears both stores */
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

// ---------------------------------------------------------------------------------------------------------------
// A damaged or hand-edited save is repaired, never trusted: every screen and the game's `GameView` read these fields without checks, so
// one wrong type (a null list, a card without a due date) would be a blank screen with no way out but clearing the site data.
// ---------------------------------------------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strList = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))] : []);
const fin = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);

const validCard = (c: unknown): c is SrsCard =>
  isObj(c) && typeof c.due === 'string' && Number.isFinite(Date.parse(c.due)) && ['stability', 'difficulty', 'reps', 'lapses', 'state'].every((k) => typeof c[k] === 'number' && Number.isFinite(c[k]));

function repairVocab(v: unknown): VocabItem[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: VocabItem[] = [];
  for (const raw of v) {
    if (!isObj(raw) || typeof raw.s !== 'string' || raw.s === '') continue;
    const id = typeof raw.id === 'string' && raw.id !== '' && !seen.has(raw.id) ? raw.id : uid('w_');
    seen.add(id);
    out.push({
      ...(raw as unknown as VocabItem),
      id,
      kind: raw.kind === 'phrase' ? 'phrase' : 'word',
      rom: typeof raw.rom === 'string' ? raw.rom : '',
      meaning: isObj(raw.meaning) ? (raw.meaning as VocabItem['meaning']) : {},
      source: typeof raw.source === 'string' ? (raw.source as VocabItem['source']) : 'goal',
      savedAt: typeof raw.savedAt === 'string' && Number.isFinite(Date.parse(raw.savedAt)) ? raw.savedAt : new Date().toISOString(),
      card: validCard(raw.card) ? raw.card : newSrsCard(),
    });
  }
  return out;
}

/** The saved value as a `Persisted`, with every field the right shape (what cannot be read falls back to a fresh value). */
export function repairPersisted(saved: unknown, base: Persisted): Persisted {
  const src = isObj(saved) ? saved : {};
  const streak = isObj(src.streak) && typeof src.streak.days === 'number' && Number.isFinite(src.streak.days) ? ({ ...base.streak, ...src.streak } as StreakState) : base.streak;
  const objMap = <T,>(v: unknown, ok: (x: unknown) => boolean): Record<string, T> =>
    isObj(v) ? (Object.fromEntries(Object.entries(v).filter(([, x]) => ok(x))) as Record<string, T>) : {};
  return {
    profile: isObj(src.profile) && typeof src.profile.name === 'string' && isObj(src.profile.avatar) ? (src.profile as unknown as Profile) : null,
    vocab: repairVocab(src.vocab),
    xp: fin(src.xp, 0),
    streak,
    days: objMap<DayStat>(src.days, isObj),
    loops: Array.isArray(src.loops) ? (src.loops.filter(isObj) as unknown as LoopRecord[]) : [],
    completed: objMap<{ count: number; best: number }>(src.completed, (x) => isObj(x) && typeof x.count === 'number' && typeof x.best === 'number'),
    lessonsDone: strList(src.lessonsDone),
    discovered: strList(src.discovered),
    errors: objMap<number>(src.errors, (x) => typeof x === 'number' && Number.isFinite(x)),
    settings: { ...DEFAULT_SETTINGS, ...(isObj(src.settings) ? src.settings : {}) } as Settings,
    uiLang: src.uiLang === 'ar' || src.uiLang === 'en' ? src.uiLang : base.uiLang,
  };
}

let nextToast = 1;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Where a settled conversation's facts go. `bridge.init` installs `bridge.dispatch` here (the bridge imports this store, so the
 * store cannot import the bridge); until then, or without facts, `recordLoop` only does the v1 bookkeeping.
 */
let onLoopFacts: ((facts: ConversationFacts) => void) | null = null;
export const setLoopFactsHook = (fn: ((facts: ConversationFacts) => void) | null) => {
  onLoopFacts = fn;
};

export const useStore = create<State>()((set, get) => ({
  ...initialPersisted(),
  ready: false,
  screen: 'onboarding',
  report: null,
  lessonId: null,
  pendingTalk: null,
  toast: null,

  hydrate() {
    const saved = loadJson<unknown>(store, KEY, null);
    const base = initialPersisted();
    const merged: Persisted = repairPersisted(saved, base);
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

  saveWord(item, opts) {
    const existing = get().vocab.find((v) => v.s === item.s);
    if (existing) return existing;
    const card = newSrsCard();
    if (opts?.dueInMin) card.due = new Date(Date.now() + opts.dueInMin * 60_000).toISOString();
    const created: VocabItem = { ...item, id: uid('w_'), savedAt: new Date().toISOString(), card };
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

  recordLoop({ scenarioId, report, turns, facts }) {
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
    // E10: the report is about to show, so what it is based on is on disk first
    flushNow();
    if (facts) onLoopFacts?.(facts);
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

  resetGameProgress() {
    useGame.getState().resetGame();
    useUi.getState().clearRequests();
  },

  reset() {
    // both stores, so the two never disagree (§14.7)
    useGame.getState().resetGame();
    useUi.getState().clearRequests();
    store.remove(KEY);
    set({ ...initialPersisted(), ready: true, screen: 'onboarding', report: null, lessonId: null, pendingTalk: null, toast: null });
  },
}));

function snapshot(s: State): Persisted {
  return {
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
}

/** Writes the legacy save now (a settled conversation, `pagehide`, `visibilitychange: hidden`). */
export function flushNow() {
  const s = useStore.getState();
  if (!s.ready) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  saveJson(store, KEY, snapshot(s));
}

// Save a moment after anything changes. Storage can be blocked (private windows, embeds); SafeLocalStore copes.
useStore.subscribe((s) => {
  if (!s.ready) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveJson(store, KEY, snapshot(useStore.getState()));
  }, 250);
});

export const dueCount = (vocab: VocabItem[], now = new Date()) => vocab.filter((v) => new Date(v.card.due) <= now).length;
export type { Lesson };
