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
import { LEXICON, entryToToken, festivalReturned, plainText, romajiText, scenarioById, tokenize } from '@lw/content';
import { translate, type StringKey } from '../i18n';
import { blip, haptic } from '../services';
import { setLoopFactsHook, setStreakCharmHook, flushNow, useStore, type VocabItem } from '../store';
import { useUi, type ConvoRequest, type ScreenArgs } from '../ui';
import { PACK, beatById, friendById } from './pack';
import { heartEventOfBeat, pendingHeartBeats } from './friendsLogic';
import { flushGameNow, getGame, useGame } from './gameStore';
import { applyImplicitReview } from './srsHooks';
import { noteRewards } from './homeLogic';
import { REAL_TRY_BEAT, REAL_TRY_DONE, capstoneMode, holdForTry, isCapstone, realTryDue, realTryFor, takeHeld } from './realTry';
import { FESTIVAL, isFestivalScenario } from './festivalSync';
import { tripOf, tripPaid, tripQuote } from './tripLogic';
import { autoWearOutfit } from './avatarFx';
import { gameView } from './selectors';
import { KYOTO, RIDE_PAINT, goenReason, goenToastVars, ridePaintColours } from './goenLogic';
import { useShrine } from './goenStore';

/** The beat Hanako plays when the player comes back after BALANCE.nextGoal.awayDays or more (§11.7; no streak scolding). */
export const WELCOME_BACK_BEAT = 'b_welcome_back';

// ---------------------------------------------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------------------------------------------

/** Runs one event through the reducer, stores the result and routes the effects. Returns the result so a screen can show its `derived` events (the debrief rows). */
export function dispatch(event: InputEvent): ReduceResult {
  const before = getGame();
  const result = reduce(before, event, { pack: PACK, now: Date.now(), view: gameView(useStore.getState()), rng: Math.random });
  useGame.getState().setGame(result.state);
  // the keepsakes a hang-out or a visit just handed over: the debrief names them (the reducer files them silently)
  if (event.t === 'conversation_done') {
    noteRewards(event.facts.sessionId, before, result.state);
    // the trip is filed when the talk at the other end runs to its close (`visit trip:hikarigaoka`; the paper ticket of the trip is used up)
    const trip = tripOf(PACK, event.facts.scenarioId);
    // (the Kyoto Journey files its ride back from the Kyoto map, not after each of its three conversations)
    if (trip && trip !== KYOTO.place && !event.facts.abandoned) dispatch({ t: 'trip_done', id: trip });
    // the wish of the ritual was made: the shrine sheet shows its celebration when the debrief closes
    if (event.facts.scenarioId === 'shrine_wish' && useShrine.getState().ritual?.step === 'wish') useShrine.getState().patch({ step: 'done' });
  }
  // the sakura paint goes on the bicycle the moment it is bought (the Wallet's ride card switches it off and on)
  if (result.derived.some((d) => d.t === 'goen_owned' && (PACK.goen?.catalog.find((c) => c.id === d.itemId)?.itemId ?? d.itemId) === RIDE_PAINT)) {
    const g = getGame();
    dispatch({ t: 'outfit_changed', equipped: g.outfit.equipped, colours: ridePaintColours(g, true) });
  }
  // a wearable that just came home (the bicycle helmet) goes on the avatar at once; Wear / Take off stays in the Wallet
  if (event.t !== 'outfit_changed') {
    const worn = autoWearOutfit(PACK, before, result.state);
    if (worn) dispatch({ t: 'outfit_changed', equipped: worn, colours: result.state.outfit.colours });
  }
  // money, purchase and story events reach the disk before anything else can happen (E10); the rest waits for the debounce
  if (needsFlush(event)) flushGameNow();
  // Chapter 8 and Free Walk: a Saturday brings the festival back to the park; the toast says why the park turned to dusk (first: the one
  // toast slot then goes to an effect or a delivery of the same day, which say more)
  if (festivalReturned(before, result.state)) useStore.getState().say(translate(useStore.getState().uiLang, 'story.festivalSaturday'));
  const toastBefore = useStore.getState().toast?.id;
  routeEffects(result.effects);
  queueHeartBeats(result.derived);
  announceDeliveries(result.derived);
  announceGoen(result.derived, toastBefore);
  return result;
}

/**
 * Goen earned (docs/GOEN.md): one toast with the amount and the reason ("+25 Goen: Chapter 3 completed"). When this event already showed a
 * toast of its own (a chapter's, a purchase's), the Goen one follows it instead of hiding it.
 */
function announceGoen(derived: DerivedEvent[], toastBefore: number | undefined): void {
  const earned = derived.filter((d): d is Extract<DerivedEvent, { t: 'goen_changed' }> => d.t === 'goen_changed' && d.delta > 0);
  if (earned.length === 0) return;
  const st = useStore.getState();
  const t = (k: StringKey, v?: Record<string, string | number>) => translate(st.uiLang, k, v);
  const n = earned.reduce((sum, d) => sum + d.delta, 0);
  const reason = [...new Set(earned.map((d) => goenReason(t, d.reason, d.ref)))].join(', ');
  const text = t('gn.earned', { n, reason });
  if (st.toast && st.toast.id !== toastBefore) setTimeout(() => useStore.getState().say(text, 'good'), 2400);
  else st.say(text, 'good');
}

/** A piece of furniture that was on its way came (the clock reached its day: a new day, a reload, a week away): one toast per piece. */
function announceDeliveries(derived: DerivedEvent[]): void {
  const st = useStore.getState();
  for (const d of derived) {
    if (d.t !== 'delivered') continue;
    const name = PACK.items.find((i) => i.id === d.itemId)?.name;
    if (name) st.say(translate(st.uiLang, 'ho.delivery.arrived', { item: name[st.uiLang] ?? name.en }), 'good');
  }
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
        // Goen earned is said once, with its reason, by `announceGoen`; the other Goen toasts name their task / tier in the player's language
        if (e.key === 'goen.toast.earned') break;
        st.say(translate(st.uiLang, e.key as StringKey, goenToastVars(PACK, e.key, e.vars, st.uiLang)), 'good');
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
    // the streak omamori (Goen): a held charm bridges one missed day; the game counts it down once that day
    setStreakCharmHook({ charms: () => getGame().goen?.charms ?? 0, used: (day) => void dispatch({ t: 'goen_charm_used', day }) });
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
  setStreakCharmHook(null);
  useGame.setState({ hydrated: false });
}

// ---------------------------------------------------------------------------------------------------------------
// Entry points for the screens (mount points 2B, 2C, 2E, 2G, 4C, 4D call)
// ---------------------------------------------------------------------------------------------------------------

/** Charges the round trip (`legs: 2`; only the way back when a machine ticket there is in hand) unless it is already in the ledger; false when the player cannot pay it (nothing is charged). */
function payTrip(scenarioId: string, place: string): boolean {
  const q = tripQuote(PACK, getGame(), scenarioId, place);
  if (tripPaid(getGame(), q)) return true;
  // the amount stays left-to-right inside an Arabic sentence
  const fmt = (n: number) => `\u2066¥${n.toLocaleString('en-US')}\u2069`;
  if (!q.method) {
    // cash pays the paper fare and the card the IC fare: neither pocket alone covers it, so the sum of both is never quoted as "what you have"
    const g = getGame();
    const lang = useStore.getState().uiLang;
    const vars = { fare: fmt(q.total), icFare: fmt(q.icTotal), have: fmt(g.wallet.cash), ic: fmt(g.wallet.ic) };
    useStore.getState().say(translate(lang, g.wallet.ic > 0 ? 'trip.shortIc' : q.legs === 1 ? 'trip.shortBack' : 'trip.short', vars), 'info');
    return false;
  }
  dispatch({ t: 'fare', id: q.id, place, method: q.method, legs: q.legs });
  if (!tripPaid(getGame(), q)) return false;
  useStore.getState().say(translate(useStore.getState().uiLang, q.legs === 1 ? 'trip.paidBack' : 'trip.paid', { fare: fmt(q.total) }), 'good');
  return true;
}

/**
 * Starts a conversation from anywhere: the conversation host in App mounts it (§11.2). While Hanako's "try it without chips" is pending
 * (`realTry.ts`) a shop conversation that offers Real mode starts in Real mode unless the request says Guided, and that use files `real_try_done`.
 */
export function startConversation(req: ConvoRequest): void {
  const g = getGame();
  // a trip: the round-trip fare is charged up front, once; short of money nothing is charged and the conversation does not start (a toast says what it costs)
  const place = req.channel === 'chat' ? null : tripOf(PACK, req.scenarioId);
  // (the Kyoto Journey's round trip was charged once, at the station: its three conversations are not fares)
  if (place && place !== KYOTO.place && !payTrip(req.scenarioId, place)) return;
  // the talk of a trip is with the person at the other end (Kato), whoever's row (Sato's) started it
  if (place) req = { ...req, characterId: scenarioById(req.scenarioId)?.characterId ?? req.characterId };
  // Chapter 6: Hanako's "try it without chips" is offered before the first shop conversation that has a Real mode; this one starts when her beat is over
  if (!place && req.channel !== 'chat' && !req.mode && realTryDue(PACK, g, req.scenarioId)) {
    holdForTry(req);
    useUi.getState().queueBeat(REAL_TRY_BEAT);
    return;
  }
  // the festival: a stall or the stage files the visit (it unlocks cc_matsuri); the capstone is Real mode, Guided only as its one-time fallback
  if (req.channel !== 'chat' && isFestivalScenario(req.scenarioId)) dispatch({ t: 'visit', place: FESTIVAL.visit });
  if (isCapstone(PACK, req.scenarioId)) req = { ...req, mode: capstoneMode(PACK, g, req.scenarioId, req.mode) };
  const mode = req.mode ?? (realTryFor(PACK, g, req.scenarioId) ? 'real' : undefined);
  if (mode === 'real' && realTryFor(PACK, g, req.scenarioId)) dispatch({ t: 'flag', id: REAL_TRY_DONE });
  useUi.getState().startConvo(mode ? { ...req, mode } : req);
}

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
  // the conversation held back for Hanako's "try it without chips" starts now, in Real mode
  if (id === REAL_TRY_BEAT) {
    const req = takeHeld();
    if (req) startConversation(req);
  }
  return result;
}
