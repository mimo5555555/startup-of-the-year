// Hang-outs and home visits, the pure part (Release 2 wave B1, docs/GAME_DESIGN.md §6.4, §8.8): the cooldown message, the doors that are
// open, the genkan in its two steps, the word cards of the props and the keepsakes a conversation just handed over. No React and no
// WebGL, so every rule is testable; `components/game/HomeStage.tsx` is the one place that plays them.
import { GENKAN, HANGOUTS, HOMES, PROP_WORDS, homeOfFriend, homeOfStage, type GenkanLines, type HomeDef } from '@lw/content';
import type { Line } from '@lw/content';
import { BALANCE, type GameState } from '@lw/game';
import type { StringKey } from '../i18n';
import { heartsOf } from './selectors';

type T = (key: StringKey, vars?: Record<string, string | number>) => string;

// ---------------------------------------------------------------------------------------------------------------
// The limit: one hang-out or visit per 3 days per friend (the reducer's rule, `applyTalk`)
// ---------------------------------------------------------------------------------------------------------------

/** Days until the friend can be met again (0 = now): the reducer pays nothing for a second hang-out or visit inside `everyDays`. */
export function cooldownDays(state: GameState, friendId: string): number {
  const last = state.friends[friendId]?.hangoutDay;
  if (last === undefined) return 0;
  return Math.max(0, BALANCE.ap.hangout.everyDays - (state.clock.dayIndex - last));
}

/** "Come back in N days", with its own words for tomorrow and the day after. */
export function cooldownText(t: T, days: number): string {
  if (days <= 1) return t('home.cooldown1');
  if (days === 2) return t('home.cooldown2');
  return t('fv.hang.cooldown', { days });
}

/**
 * What a friend's new heart opens, for the line under "likes you more now" in the debrief: the hang-out from 3 hearts, the invitation home
 * from 4 (the home wins when both were crossed at once). Null when neither a built hang-out nor a built home of that friend was reached.
 */
export function unlockHint(friendId: string, from: number, to: number): 'hang' | 'home' | null {
  const home = homeOfFriend(friendId);
  if (home && from < home.hearts && to >= home.hearts) return 'home';
  const hang = Object.values(HANGOUTS).find((h) => h.friend === friendId);
  if (hang && from < hang.hearts && to >= hang.hearts) return 'hang';
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Doors
// ---------------------------------------------------------------------------------------------------------------

/**
 * Which friend doors are open in the street: the friend invites the player from `HomeDef.hearts` hearts and the home's scenario is
 * registered (an unbuilt visit keeps its door shut; the tooltip says so). The cooldown does not close a door: the invitation stands,
 * the tap answers "come back in N days".
 */
export function doorsOpen(state: GameState, scenarios: ReadonlySet<string>): Array<[string, boolean]> {
  return Object.values(HOMES).map((h) => [h.host, heartsOf(state, h.host) >= h.hearts && scenarios.has(h.scenarioId)]);
}

// ---------------------------------------------------------------------------------------------------------------
// The genkan: shoes off, then slippers
// ---------------------------------------------------------------------------------------------------------------

export interface GenkanState {
  shoesOff: boolean;
  slippersOn: boolean;
}

export type GenkanOutcome = 'shoes' | 'slippers' | 'wrong' | 'noop';

/**
 * One press at the genkan. Shoes first; the slippers before the shoes are off are answered by the host's gentle correction (`wrong`)
 * and change nothing: no penalty. A button that is already done does nothing.
 */
export function genkanPress(s: GenkanState, which: 'shoes' | 'slippers'): { outcome: GenkanOutcome; next: GenkanState } {
  if (which === 'shoes') return s.shoesOff ? { outcome: 'noop', next: s } : { outcome: 'shoes', next: { ...s, shoesOff: true } };
  if (s.slippersOn) return { outcome: 'noop', next: s };
  if (!s.shoesOff) return { outcome: 'wrong', next: s };
  return { outcome: 'slippers', next: { ...s, slippersOn: true } };
}

/** The host's line for a step, in the register the friendship allows (casual from the friend's `casualAt` heart or after the switch). */
export function genkanLine(host: string, step: keyof GenkanLines, casual: boolean): Line | null {
  const l = GENKAN[host]?.[step];
  return l ? (casual ? l.casual : l.polite) : null;
}

// ---------------------------------------------------------------------------------------------------------------
// The props of a room: word cards
// ---------------------------------------------------------------------------------------------------------------

/** The pick id the world gives a prop of a stage (`prop:mio_1r:kamera`), also the id the app files as discovered. */
export const propPick = (stage: string, prop: string): string => `prop:${stage}:${prop}`;

/** A prop pick -> its home and the lexicon surface of its word card; null for any other id. */
export function propOfPick(id: string): { home: HomeDef; prop: string; surface: string } | null {
  const m = /^prop:([a-z0-9_]+):([a-z0-9_]+)$/.exec(id);
  if (!m) return null;
  const home = homeOfStage(m[1]);
  const surface = PROP_WORDS[m[2]];
  return home && surface && home.props.includes(m[2]) ? { home, prop: m[2], surface } : null;
}

/** How many of a home's props the player has found (their pick ids are in the v1 store's `discovered`). */
export const propsFound = (home: HomeDef, discovered: readonly string[]): number => home.props.filter((p) => discovered.includes(propPick(home.stage, p))).length;

// ---------------------------------------------------------------------------------------------------------------
// The panel fallback switch
// ---------------------------------------------------------------------------------------------------------------

/** `?panel=1` forces the panel fallback (the e2e uses it; a QA build can too). */
export const panelForced = (search: string): boolean => new URLSearchParams(search).get('panel') === '1';

// ---------------------------------------------------------------------------------------------------------------
// Rewards of a conversation: the keepsakes it handed over, for the debrief
// ---------------------------------------------------------------------------------------------------------------

const KEPT = new Map<string, string[]>();
const KEPT_MAX = 12;

/** Remembers the keepsakes that `before` -> `after` added during the conversation `sessionId` (the bridge calls it for `conversation_done`). */
export function noteRewards(sessionId: string, before: GameState, after: GameState): void {
  const added = after.keepsakes.filter((k) => !before.keepsakes.includes(k));
  if (added.length === 0) return;
  KEPT.set(sessionId, added);
  while (KEPT.size > KEPT_MAX) KEPT.delete(KEPT.keys().next().value as string);
}

/** The keepsake ids the conversation `sessionId` handed over. */
export const rewardsOf = (sessionId: string): string[] => KEPT.get(sessionId) ?? [];
