// The one function every game event goes through (docs/GAME_DESIGN.md §14.5 "Who dispatches"): the conversation screen, the world,
// Prepare, Shift, Phone, the panels and the app shell all call `dispatch(event)`. It builds the reducer's context, stores the new
// state and routes the UI effects. The reducer is pure; everything with a side effect on the app (toasts, sound, the vocabulary
// of the v1 store, the beat and culture requests) happens here.
import {
  BALANCE,
  awayDays,
  needsFlush,
  reduce,
  seedFromLegacy,
  type DerivedEvent,
  type InputEvent,
  type ReduceResult,
  type SrsOp,
  type UiEffect,
} from '@lw/game';
import { LEXICON, entryToToken, plainText, romajiText, tokenize } from '@lw/content';
import { translate, type StringKey } from '../i18n';
import { blip, haptic } from '../services';
import { setLoopFactsHook, flushNow, useStore, type VocabItem } from '../store';
import { useUi, type ConvoRequest, type ScreenArgs } from '../ui';
import { PACK, beatById, friendById } from './pack';
import { heartEventOfBeat, pendingHeartBeats } from './friendsLogic';
import { flushGameNow, getGame, useGame } from './gameStore';
import { applyImplicitReview } from './srsHooks';
import { gameView } from './selectors';

/** The beat Hanako plays when the player comes back after BALANCE.nextGoal.awayDays or more (§11.7; no streak scolding). */
export const WELCOME_BACK_BEAT = 'b_welcome_back';

// ---------------------------------------------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------------------------------------------

/** Runs one event through the reducer, stores the result and routes the effects. Returns the result so a screen can show its `derived` events (the debrief rows). */
export function dispatch(event: InputEvent): ReduceResult {
  const result = reduce(getGame(), event, { pack: PACK, now: Date.now(), view: gameView(useStore.getState()), rng: Math.random });
  useGame.getState().setGame(result.state);
  // money, purchase and story events reach the disk before anything else can happen (E10); the rest waits for the debounce
  if (needsFlush(event)) flushGameNow();
  routeEffects(result.effects);
  queueHeartBeats(result.derived);
  return result;
}

/** A friend reached a heart that has a beat (Mio's ♥2 note): it is queued and plays in the world once the conversation and its debrief are closed (4A). */
function queueHeartBeats(derived: DerivedEvent[]): void {
  for (const d of derived) {
    if (d.t !== 'heart_event_ready') continue;
    const beat = friendById(d.friendId)?.events?.find((e) => e.heart === d.level)?.beat;
    if (beat && beatById(beat)) useUi.getState().queueBeat(beat);
  }
}

/** Applies what the reducer asked the app to do (exported for tests; screens call `dispatch`). */
export function routeEffects(effects: UiEffect[]): void {
  const st = useStore.getState();
  for (const e of effects) {
    switch (e.t) {
      case 'toast':
        st.say(translate(st.uiLang, e.key as StringKey, e.vars), 'good');
        break;
      case 'fanfare':
        blip(e.kind === 'purchase' ? 'good' : 'level', st.settings.autoSpeak);
        haptic(14);
        break;
      case 'culture':
        useUi.getState().showCulture(e.id);
        break;
      case 'beat':
        // a beat the pack does not define yet is not queued: an empty screen would be a dead end (it comes back on the next focus)
        if (beatById(e.id)) useUi.getState().queueBeat(e.id);
        break;
      case 'srsOps':
        applySrsOps(e.ops);
        break;
      case 'xp':
        st.addXp(e.amount);
        break;
      case 'celebrate':
        // the payload is for screens that show a celebration; they read the `derived` events of the dispatch result instead
        break;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// SRS bridge: the reducer asks for cards, the v1 store owns the vocabulary
// ---------------------------------------------------------------------------------------------------------------

type NewWord = Omit<VocabItem, 'id' | 'savedAt' | 'card'>;

/** The card a key stands for: a phrase (the op's line, else the pack's pocket line) or a word (a sign id or a surface in the lexicon). */
function wordFor(op: SrsOp): NewWord | null {
  const source = op.source ?? 'goal';
  const line = op.line ?? PACK.pockets[op.key]?.line;
  if (op.kind === 'phrase' || line) {
    if (!line) return null;
    const tokens = tokenize(line.ja, LEXICON).tokens;
    return { kind: 'phrase', s: plainText(tokens), rom: romajiText(tokens), meaning: { en: line.en, ar: line.ar }, source, key: op.key };
  }
  const entry = LEXICON.get(op.key);
  if (!entry) return null;
  const token = entryToToken(entry);
  return { kind: 'word', s: token.s, r: token.r, rom: token.rom, meaning: token.gloss ?? { en: entry.en, ar: entry.ar }, source, key: op.key };
}

/**
 * Applies the reducer's card requests through the v1 store's own actions (`saveWord`, `reviewWord`). A `review` op is the implicit
 * "use = review" of §11.5 (the only kind the reducer asks for): it goes through the gate, so only a due, unparked card that was not
 * reviewed today moves, once a day (class S/T turns never ask).
 */
export function applySrsOps(ops: SrsOp[]): void {
  const st = useStore.getState();
  for (const op of ops) {
    if (op.op === 'review') {
      applyImplicitReview(op.key);
      continue;
    }
    const have = st.vocab.find((v) => v.key === op.key || v.s === op.key);
    if (have) continue;
    const word = wordFor(op);
    if (word) st.saveWord(word, { dueInMin: op.dueInMin });
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The clock: day_observed, and the welcome-back beat that rides on it
// ---------------------------------------------------------------------------------------------------------------

/** Tells the game what day it is (app mount, focus, `visibilitychange`). A returning player (away >= BALANCE.nextGoal.awayDays) gets Hanako's welcome-back beat once per return. */
export function observeDay(now: number = Date.now()): void {
  // nothing is played before onboarding finishes, and the reducer's view needs the profile
  if (!useStore.getState().profile) return;
  const before = getGame();
  // read before the event: `day_observed` moves `lastSeenAt`
  const away = awayDays(before, now);
  dispatch({ t: 'day_observed', nowMs: now });
  // a heart beat that was reached but never played (the app was closed before it ran) comes back (4A)
  for (const p of pendingHeartBeats(PACK, getGame(), (id) => !!beatById(id))) useUi.getState().queueBeat(p.beat);
  const after = getGame();
  const day = after.clock.dayIndex;
  if (away < BALANCE.nextGoal.awayDays || before.clock.activeDays < 1 || after.flags.welcomeSeenDay === day || !beatById(WELCOME_BACK_BEAT)) return;
  dispatch({ t: 'profile_set', welcomeSeenDay: day });
  useUi.getState().queueBeat(WELCOME_BACK_BEAT);
}

// ---------------------------------------------------------------------------------------------------------------
// Start-up
// ---------------------------------------------------------------------------------------------------------------

let booting: Promise<void> | null = null;
let removeListeners: (() => void) | null = null;

/** Both stores flush when the page goes away (E10). */
const flushAll = () => {
  flushNow();
  flushGameNow();
};

/**
 * Lessons, saved words and read signs live in the v1 store (§14.5 "Who dispatches"): the game is told the moment one is added, so the
 * objective ticks, the toast shows and a finished chapter pays now, not at the next unrelated event. Only additions after this call.
 */
function watchLegacyProgress(): () => void {
  let prev = useStore.getState();
  return useStore.subscribe((s) => {
    const was = prev;
    prev = s;
    if (!s.profile) return;
    for (const id of s.lessonsDone) if (!was.lessonsDone.includes(id)) dispatch({ t: 'lesson_done', id });
    if (s.vocab !== was.vocab) {
      const known = new Set(was.vocab.map((v) => v.id));
      for (const v of s.vocab) if (!known.has(v.id)) dispatch({ t: 'word_saved', key: v.key ?? v.s });
    }
    for (const id of s.discovered) if (!was.discovered.includes(id)) dispatch({ t: 'sign_found', id });
  });
}

/**
 * A lesson was played to its end (Lesson screen). The v1 store files a lesson once, so a replay adds nothing the watcher above can
 * see; the game still counts the lesson once per day (`g_lesson`, §7.4). A first finish was already told by the watcher, and the
 * reducer's per-day dedupe makes this second telling a no-op.
 */
export function lessonFinished(id: string): void {
  if (useStore.getState().profile) dispatch({ t: 'lesson_done', id });
}

function listenToThePage(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  const win = window;
  const doc = document;
  const onVisibility = () => {
    if (doc.visibilityState === 'hidden') flushAll();
    else observeDay();
  };
  const onFocus = () => observeDay();
  win.addEventListener('pagehide', flushAll);
  win.addEventListener('focus', onFocus);
  doc.addEventListener('visibilitychange', onVisibility);
  return () => {
    win.removeEventListener('pagehide', flushAll);
    win.removeEventListener('focus', onFocus);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}

/**
 * Called once by App after mount (§14.7): hydrates the v1 store, then rehydrates the game store (so the legacy `completed` map is
 * loaded for the seed), seeds the game from the legacy progress when the save is new or not yet `seeded`, starts observing the
 * clock and hands conversation facts from `recordLoop` to `dispatch`. Safe to call twice.
 */
export function init(): Promise<void> {
  booting ??= (async () => {
    useStore.getState().hydrate();
    await useGame.persist.rehydrate();
    const g = getGame();
    // the seed and `seeded = true` are one write, so a reload cannot seed twice (and a seeded save is never touched)
    if (!g.seeded) useGame.getState().setGame(seedFromLegacy(g, PACK, { completed: useStore.getState().completed }));
    useGame.setState({ hydrated: true });
    flushGameNow();
    setLoopFactsHook((facts) => void dispatch({ t: 'conversation_done', facts }));
    const unlisten = listenToThePage();
    const unwatch = watchLegacyProgress();
    removeListeners = () => {
      unlisten();
      unwatch();
    };
    // a handle for the e2e scripts and for QA in the console, as `window.__world` is for the 3D world
    if (typeof window !== 'undefined') Object.assign(window, { __lw: { dispatch, getGame, useGame, useStore, useUi } });
    observeDay();
  })();
  return booting;
}

/** Tests only: forgets that `init` ran so a test can boot again over a different saved state. */
export function resetBridgeForTests(): void {
  removeListeners?.();
  removeListeners = null;
  booting = null;
  setLoopFactsHook(null);
  useGame.setState({ hydrated: false });
}

// ---------------------------------------------------------------------------------------------------------------
// Entry points for the screens (mount points 2B, 2C, 2E, 2G, 4C, 4D call)
// ---------------------------------------------------------------------------------------------------------------

/** Starts a conversation from anywhere: the conversation host in App mounts it (§11.2). */
export const startConversation = (req: ConvoRequest): void => useUi.getState().startConvo(req);

/** Opens a route that needs an argument (Prepare, Shift, Phone, Quests tab). */
export function openScreen<K extends keyof ScreenArgs>(screen: K, args: ScreenArgs[K]): void {
  useUi.getState().setArgs(screen, args);
  useStore.getState().go(screen);
}

/** A beat finished playing: files it (applying its effects) and takes it off the queue. A beat the pack no longer knows is dropped the same way. */
export function completeBeat(id: string): ReduceResult {
  const result = dispatch({ t: 'beat_done', id });
  // the beat of a heart event files the event once it has played: +10 AP, never twice (4A)
  const heart = heartEventOfBeat(PACK, id);
  if (heart) dispatch({ t: 'heart_event_done', friendId: heart.friendId, level: heart.level });
  useUi.getState().finishBeat(id);
  return result;
}
