// The phone as the app sees it (agent 4C-lite; docs/GAME_DESIGN.md §8.7). Pure on its inputs, so a test can drive it without a screen:
// the Phone screen reads `threadRows` / `mapPins` / `openerLine`; the conversation host asks `planChat` for the flags a chat thread needs
// (the contract at the top of `content/src/tokyo/scenarios-chat.ts`: `casual`, `f_<id>`, `fc_<id>`) and files an accepted plan with
// `planFlagEvent`.
import { LEXICON, characterById, resolveLine, scenarioById, type Line, type Token } from '@lw/content';
import { BALANCE, emptyFriend, heartsForAp, type FriendState, type GamePack, type GameState, type InputEvent } from '@lw/game';
import { NPC_SPAWNS } from '@lw/world';
import { isCasual, type FriendPlan } from './friendsLogic';

/** the goal step of `chat_plan` that an accepted plan completes (a polite refusal completes `reply` only) */
export const PLAN_SCENARIO = 'chat_plan';
export const PLAN_STEP = 'time';
/** a plan accepted in a thread is a friend flag `plan_<dayIndex>`: today's pin on the friend's place */
const PLAN_FLAG = 'plan_';

const friendOf = (state: GameState, id: string): FriendState => state.friends[id] ?? emptyFriend(state.clock.dayIndex);

// ---------------------------------------------------------------------------------------------------------------
// The host's flags for a thread
// ---------------------------------------------------------------------------------------------------------------

/**
 * The flags of a thread with a friend: `f_<id>` (the friend's own place and words), `casual` when the friend speaks plain form to the
 * player now, and `fc_<id>` for a friend who ever switches to plain form (Mio, Yuki, Kenji: `casualAt` within the hearts that exist),
 * only while they are casual. Without a pack friend there are no flags and every line is the polite, place-less one.
 */
export function chatFlags(pack: GamePack, state: GameState, friendId: string): Record<string, boolean> {
  const def = pack.friends.find((f) => f.id === friendId);
  if (!def) return {};
  const casual = isCasual(pack, state, friendId);
  const flags: Record<string, boolean> = { [`f_${friendId}`]: true };
  if (casual) {
    flags.casual = true;
    if (def.casualAt <= BALANCE.ap.thresholds.length) flags[`fc_${friendId}`] = true;
  }
  return flags;
}

/** The host plan of a phone thread, in the shape the conversation hooks take (no topic, nothing to reveal, no variables). */
export function planChat(pack: GamePack, state: GameState, friendId: string): FriendPlan {
  const flags = chatFlags(pack, state, friendId);
  return { friendId, kind: 'talk', casual: flags.casual === true, flags, vars: {} };
}

// ---------------------------------------------------------------------------------------------------------------
// Plans: the pin on the friend's place
// ---------------------------------------------------------------------------------------------------------------

/** Whether a finished thread agreed to meet (the goal step `time` of `chat_plan`; declining politely only answers). */
export const planAccepted = (scenarioId: string, stepsDone: Iterable<string>): boolean => scenarioId === PLAN_SCENARIO && new Set(stepsDone).has(PLAN_STEP);

/** The event that files today's accepted plan with the friend. */
export const planFlagEvent = (friendId: string, dayIndex: number): InputEvent => ({ t: 'flag', id: `${PLAN_FLAG}${dayIndex}`, friendId });

/** Whether the player agreed to meet this friend today. */
export const planToday = (state: GameState, friendId: string): boolean => friendOf(state, friendId).flags.includes(`${PLAN_FLAG}${state.clock.dayIndex}`);

// ---------------------------------------------------------------------------------------------------------------
// The thread list
// ---------------------------------------------------------------------------------------------------------------

export interface ThreadRow {
  friendId: string;
  hearts: number;
  /** threads waiting for a reply, oldest first (`FriendState.threads`) */
  threads: Array<{ template: string; day: number }>;
  unread: number;
  /** the friend has reached the heart where messages start (BALANCE.ap.chat.minHeart) */
  open: boolean;
  /** the player agreed to meet today */
  plan: boolean;
}

/** The friends the player can message: those whose chapter has come, waiting threads first, then by hearts. */
export function threadRows(pack: GamePack, state: GameState): ThreadRow[] {
  const rows = pack.friends
    .filter((def) => state.chapter.n >= def.unlockChapter)
    .map((def, order) => {
      const f = friendOf(state, def.id);
      const hearts = heartsForAp(f.ap);
      return { order, row: { friendId: def.id, hearts, threads: f.threads, unread: f.threads.length, open: hearts >= BALANCE.ap.chat.minHeart, plan: planToday(state, def.id) } satisfies ThreadRow };
    });
  rows.sort((a, b) => Number(b.row.unread > 0) - Number(a.row.unread > 0) || b.row.hearts - a.row.hearts || a.order - b.order);
  return rows.map((r) => r.row);
}

/** All unread threads of all friends (what the HUD badge counts). */
export const totalUnread = (rows: ThreadRow[]): number => rows.reduce((n, r) => n + r.unread, 0);

/** Threads of this friend that the pack can actually run (a template the pack has no scenario for is not offered: no dead button). */
export const runnableThreads = (row: ThreadRow, known: (scenarioId: string) => boolean = (id) => !!scenarioById(id)): ThreadRow['threads'] => row.threads.filter((t) => known(t.template));

// ---------------------------------------------------------------------------------------------------------------
// What the friend says first
// ---------------------------------------------------------------------------------------------------------------

/**
 * The friend's opening message of a thread, as the conversation will say it: the first variant of the start node whose `when` flag is
 * set, else the node's last variant (the same rule as the engine's `pickSay`). Undefined for a scenario that does not exist.
 */
export function openerLine(scenarioId: string, flags: Record<string, boolean>): { line: Line; tokens: Token[] } | undefined {
  const sc = scenarioById(scenarioId);
  const node = sc?.nodes[sc.start];
  if (!sc || !node || node.say.length === 0) return undefined;
  const hit = node.say.find((v) => !v.when || ('flag' in v.when && flags[v.when.flag] === true));
  const line = (hit ?? node.say[node.say.length - 1]!).line;
  return { line, tokens: resolveLine(line, LEXICON).tokens };
}

// ---------------------------------------------------------------------------------------------------------------
// Map pins
// ---------------------------------------------------------------------------------------------------------------

/** The place ids the phone strings know (`phone.place.<id>`); a character at any other place is not pinned by name. */
export const PLACE_IDS = ['park', 'cafe', 'konbini', 'ramen', 'station', 'school'] as const;

export interface MapPinRow {
  friendId: string;
  placeId: string;
  hearts: number;
  /** the player agreed to meet here today */
  plan: boolean;
}

/**
 * The places of the friends the world has built (a friend with no spawn, or at a place the strings do not name, has no pin): plans
 * of today first, then the order of the pack.
 */
export function mapPins(pack: GamePack, state: GameState): MapPinRow[] {
  const rows: MapPinRow[] = [];
  for (const def of pack.friends) {
    if (state.chapter.n < def.unlockChapter) continue;
    const who = characterById(def.id);
    if (!who || !(PLACE_IDS as readonly string[]).includes(who.locationId) || !NPC_SPAWNS.some((n) => n.id === def.id)) continue;
    rows.push({ friendId: def.id, placeId: who.locationId, hearts: heartsForAp(friendOf(state, def.id).ap), plan: planToday(state, def.id) });
  }
  return rows.sort((a, b) => Number(b.plan) - Number(a.plan));
}
