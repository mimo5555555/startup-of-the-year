// Derived reads over state (agent 1F). Nothing here is stored (§14.7): the app and the HUD call these after every `reduce`.
import { BALANCE } from './balance';
import { dailyUnlocked } from './daily';
import { dreamPickerShown, effectiveDream, dreamProgress } from './dreams';
import { heartsForAp } from './friends';
import { comfort, hasFeature, rideOf } from './inventory';
import { chapterDef, openChapter } from './objectives';
import type { ChapterDef, CoachOffer, DerivedFlags, Disclosure, DreamProgress, GamePack, GameState, GameView } from './types';

/** Hearts of a friend from its AP (0 for an unknown friend). Implemented by the contract; delegates to `heartsForAp`. */
export function hearts(state: GameState, friendId: string): number {
  return heartsForAp(state.friends[friendId]?.ap ?? 0);
}

/** The current chapter's definition, or null at Free Walk (chapter.n = 9). */
export function currentChapter(pack: GamePack, state: GameState): ChapterDef | null {
  return chapterDef(pack, state.chapter.n);
}

/** hasPhone, hasIc, ride and speedMult, homeTier, comfort, dreamUnlocked, realMode. */
export function derivedFlags(pack: GamePack, state: GameState): DerivedFlags {
  const ride = rideOf(pack, state);
  return {
    hasPhone: hasFeature(pack, state, 'phone'),
    hasIc: hasFeature(pack, state, 'ic'),
    ride,
    speedMult: ride.mul,
    homeTier: state.home.tier,
    comfort: comfort(pack, state),
    dreamUnlocked: dreamPickerShown(pack, state),
    // Real mode (chips hidden) is offered from BALANCE.realFromChapter on (D22); the Prepare screen then shows the toggle
    realMode: state.chapter.n >= BALANCE.realFromChapter,
  };
}

/**
 * A pocket line is ready (§11.1): it passed a recall check within BALANCE.readyDays of today (`state.prep`), or its card is known
 * (`view.vocab.known`: FSRS Review, stability >= BALANCE.knownStability; a known card never expires). Feeds the recalled-line rule.
 * "Within 7 days" is `dayIndex - at < 7`: a pass on day 3 is good through day 9 and gone on day 10 (the gift repeat rule counts the same way).
 */
export function lineReady(state: GameState, view: GameView, lineId: string): boolean {
  if (view.vocab.known.has(lineId)) return true;
  const p = state.prep[lineId];
  return p?.s === 'ready' && state.clock.dayIndex - p.at < BALANCE.readyDays;
}

/** A scenario's pocket is ready: every `key` line ready and >= BALANCE.pocketReadyRest of the others; false without a pocket. Feeds `ConversationFacts.prepared` (the x1.10). */
export function pocketReady(pack: GamePack, state: GameState, view: GameView, scenarioId: string): boolean {
  const lineIds = pack.scenarioMeta.find((m) => m.id === scenarioId)?.pocket ?? [];
  if (lineIds.length === 0) return false;
  const keys = lineIds.filter((id) => pack.pockets[id]?.key);
  const rest = lineIds.filter((id) => !pack.pockets[id]?.key);
  if (!keys.every((id) => lineReady(state, view, id))) return false;
  if (rest.length === 0) return true;
  return rest.filter((id) => lineReady(state, view, id)).length >= BALANCE.pocketReadyRest * rest.length - 1e-9;
}

/**
 * The debrief coach card after a conversation (§11.8), from `state.coach`: 'real' when the last BALANCE.adaptive.realOfferConvs had
 * r >= realOfferR, 'help' when each of them had r < helpOfferR and together >= helpOfferFallbacks fallbacks; never within `everyConvs`
 * of the last change (a card answered or dismissed) and never on fewer conversations than the three it judges.
 */
export function coachOffer(state: GameState): CoachOffer {
  const A = BALANCE.adaptive;
  if (state.coach.sinceChange < A.everyConvs) return null;
  const last = state.coach.recent.slice(-A.realOfferConvs);
  if (last.length < A.realOfferConvs) return null;
  if (last.every((r) => r.r >= A.realOfferR)) return 'real';
  if (last.every((r) => r.r < A.helpOfferR) && last.reduce((n, r) => n + r.fallbacks, 0) >= A.helpOfferFallbacks) return 'help';
  return null;
}

/** What the HUD and the debrief may show now (§2.5). */
export function disclosure(pack: GamePack, state: GameState, view: GameView): Disclosure {
  void view;
  const n = state.chapter.n;
  const phone = hasFeature(pack, state, 'phone');
  // the Friends entry opens with Chapter 3, or earlier if the pack's chapter table opens it sooner
  const friendsAt = openChapter(pack, 'feature', 'friends');
  const friends = n >= (friendsAt > 0 ? friendsAt : 3);
  // conversations settled so far: the debrief shows the compact form for the first three, the full ledger rows from the 4th (or Chapter 2)
  const convs = Object.values(state.runs).reduce((sum, r) => sum + r.count, 0);
  const fullLedger = convs >= 4 || n >= 2;
  return {
    dreamChip: dreamPickerShown(pack, state),
    dailyGoals: dailyUnlocked(pack, state),
    friends,
    phoneIcon: phone,
    mapPins: phone,
    fullLedgerRows: fullLedger,
    friendsStrip: friends,
    realMode: n >= BALANCE.realFromChapter,
    compactDebrief: !fullLedger,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// More derived reads the app asks for
// ---------------------------------------------------------------------------------------------------------------

/** Cards waiting for review, read from the v1 store's view. */
export const dueCount = (view: GameView): number => view.vocab.dueCount;

/** The tracked dream's tracker data (steps, yen bar, language gate, pace), or null when no dream is tracked yet. */
export function activeDreamProgress(pack: GamePack, state: GameState, view: GameView): DreamProgress | null {
  const id = effectiveDream(pack, state, view);
  return id ? dreamProgress(state, { pack, view }, id) : null;
}

/** The four audio modes (§12.2). */
export type AudioModeId = 'full-voice' | 'listen-and-type' | 'read-and-type' | 'type-only';

/**
 * The audio mode from the saved preferences and what this device can do (`caps` come from the audio check, they are not stored):
 * a Japanese voice the player has not turned off is "listening", recognition the player consented to and has not turned off is "the mic".
 */
export function audioMode(state: GameState, caps: { jaVoice: boolean; stt: boolean }): AudioModeId {
  const listen = caps.jaVoice && state.audio.listenPref === 'on';
  const mic = caps.stt && state.audio.sttConsent === 'allowed' && state.audio.micPref === 'auto';
  if (listen) return mic ? 'full-voice' : 'listen-and-type';
  return mic ? 'read-and-type' : 'type-only';
}

/** The speech rate: the age profile's rate scaled by the "slower voice" coach card. */
export function ttsRate(pack: GamePack, state: GameState, view: GameView): number {
  return (pack.ageProfiles[view.profile.age]?.ttsRate ?? 1) * (state.audio.ttsRateScale ?? 1);
}

/** Whole days since the game was last seen, for the welcome-back beat (§11.7: from BALANCE.nextGoal.awayDays). Read it BEFORE dispatching `day_observed`, which moves `lastSeenAt`. */
export function awayDays(state: GameState, nowMs: number): number {
  return state.clock.lastSeenAt > 0 ? Math.max(0, Math.floor((nowMs - state.clock.lastSeenAt) / 86_400_000)) : 0;
}

/** Whether a scenario defaults to Real mode (the accepted "fewer chips" card). */
export const defaultsToReal = (state: GameState, scenarioId: string): boolean => state.coach.realFor.includes(scenarioId);
