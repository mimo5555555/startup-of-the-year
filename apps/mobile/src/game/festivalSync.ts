// The festival of Chapter 7 in the 3D world (docs/GAME_DESIGN.md §7.2, §6.4 festival dressing; Release 2 wave C2). The content's festival-day rule
// (`festivalOpen`) decides when the park is the festival; this module turns the world's dressing on and off with it, places the friends at two
// hearts or more (`festivalGuests`), routes the stall and stage picks to the festival scenarios, and holds the festival on through Chapter 7's
// closing beat for the fireworks (the chapter is over by then, so the day rule alone would already have turned it off). Pure functions plus
// `syncFestival`, the one that touches the world; `syncWorld` calls it on every state change.
import { FESTIVAL_SPOTS, type TokyoWorld } from '@lw/world';
import { FESTIVAL, FESTIVAL_ROWS, festivalGuests, festivalOpen } from '@lw/content';
import type { GamePack, GameState } from '@lw/game';
import { heartsOf } from './selectors';

export { FESTIVAL, FESTIVAL_ROWS, festivalOpen };

/** Whether a Talk row is one of the festival's (listed only while the park is the festival). */
export const isFestivalRow = (rowId: string): boolean => FESTIVAL_ROWS.includes(rowId);

/** The festival's two scenarios (a stall, the stage speech): starting one files the visit `festival` (cc_matsuri). */
export const isFestivalScenario = (scenarioId: string): boolean => scenarioId === FESTIVAL.stallsScenario || scenarioId === FESTIVAL.speechScenario;

/** Who stands at the festival now: Hanako, Kenji's stall and every friend at FESTIVAL.guestHearts or more (the world ignores ids it cannot place). */
export const guestsFor = (pack: Pick<GamePack, 'friends'>, state: GameState): string[] => festivalGuests(pack, (id) => heartsOf(state, id));

/** What the world should show: the festival (and who is there), or the ordinary park. `hold` keeps it on for the fireworks beat. */
export function festivalWanted(pack: Pick<GamePack, 'friends'>, state: GameState, hold = false): { on: boolean; guests: string[] } {
  const on = hold || festivalOpen(state);
  return { on, guests: on ? guestsFor(pack, state) : [] };
}

// ---------------------------------------------------------------------------------------------------------------
// The world calls (memoised: syncWorld runs after every state change)
// ---------------------------------------------------------------------------------------------------------------

let applied: { world: TokyoWorld; key: string } | null = null;
let hold = false;
let fireworksTimer: ReturnType<typeof setTimeout> | null = null;
/** how long the learner takes to step from Hanako to the speaker's spot before the first shells go up (ms) */
const TO_STAGE_MS = 1400;
let lastArgs: { world: TokyoWorld; pack: Pick<GamePack, 'friends'>; state: GameState } | null = null;

/** Puts the festival dressing and its guests in line with the state. Safe to call often: the world is touched only on a change. */
export function syncFestival(world: TokyoWorld, pack: Pick<GamePack, 'friends'>, state: GameState): void {
  lastArgs = { world, pack, state };
  const want = festivalWanted(pack, state, hold);
  const key = `${want.on ? 1 : 0}:${want.guests.join(',')}`;
  if (applied?.world === world && applied.key === key) return;
  const wasOn = applied?.world === world && applied.key.startsWith('1');
  applied = { world, key };
  if (want.on) {
    // the guests first: the world remembers them while the festival is off and places them as it turns on
    world.setFestivalGuests(want.guests);
    // a reload on the festival day (or a world rebuilt) shows the dressing at once; the first evening of play fades in
    if (!wasOn) world.setFestival(true);
  } else if (wasOn) {
    // a world that never had the festival is the plain park already (a new world starts without it)
    world.setFestival(false);
  }
}

/** The world WorldScreen published (a beat or the Letter screen reaches it from outside the world's React tree). */
export const currentWorld = (): TokyoWorld | null => (window as unknown as { __world?: TokyoWorld }).__world ?? null;

/**
 * Chapter 7's closing beat plays under the fireworks: the festival stays on while it plays, the learner stands by the stage (Hanako, the MC, is
 * there) and the world keeps drawing behind the beat card. Off: the fireworks stop and the festival follows the day rule again.
 */
export function fireworksBeat(on: boolean): void {
  const world = currentWorld();
  hold = on;
  if (!world) return;
  if (lastArgs?.world === world) syncFestival(world, lastArgs.pack, lastArgs.state);
  else if (on) world.setFestival(true);
  if (fireworksTimer) clearTimeout(fireworksTimer);
  fireworksTimer = null;
  if (on) {
    // the beat is a screen of its own: the world would freeze its last frame behind the card (WorldScreen sets it inactive off the street)
    world.setActive(true);
    // the shot is designed from the speaker's spot in front of the stage (the camera then stands in the open aisle, not in the crowd)
    world.teleportNear('hanako');
    world.walkTo(FESTIVAL_SPOTS.stage.x, FESTIVAL_SPOTS.stage.z);
    fireworksTimer = setTimeout(() => {
      fireworksTimer = null;
      if (hold) world.fireworks(true);
    }, TO_STAGE_MS);
  } else {
    world.fireworks(false);
  }
}

/** Test seam: forget what was applied (a new world, a reset). */
export function resetFestivalSync(): void {
  if (fireworksTimer) clearTimeout(fireworksTimer);
  fireworksTimer = null;
  applied = null;
  hold = false;
  lastArgs = null;
}

// ---------------------------------------------------------------------------------------------------------------
// The festival picks (world pick ids `stall:<id>` and `festival:stage`)
// ---------------------------------------------------------------------------------------------------------------

export type FestivalPick = { t: 'stall'; stall: string } | { t: 'stage' };

export function festivalPickOf(id: string): FestivalPick | null {
  if (id === 'festival:stage') return { t: 'stage' };
  const m = /^stall:(.+)$/.exec(id);
  return m ? { t: 'stall', stall: m[1]! } : null;
}

/** The Talk row a festival pick stands for: the stalls are Kenji's row (matsuri_stalls), the stage is Hanako's (the speech). */
export const festivalRowOf = (pick: FestivalPick): { characterId: string; scenarioId: string } =>
  pick.t === 'stage' ? { characterId: 'hanako', scenarioId: FESTIVAL.speechScenario } : { characterId: 'kenji', scenarioId: FESTIVAL.stallsScenario };
