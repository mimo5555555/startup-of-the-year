// The player's own room, the pure part (Release 2 wave B2, docs/GAME_DESIGN.md §8.8, D12, D23): which door is open, which pieces can be placed,
// which are on their way, the comfort line, who can be invited, and the flags the conversations of the room need. No React and no WebGL, so
// every rule is testable; `components/game/HomeOwn.tsx` and `FurniturePlacer.tsx` play them.
import { FURNITURE, OWN_GUEST, OWN_ROOMS, VIEWING_MINOR_TEXT, type OwnRoomDef } from '@lw/content';
import { BALANCE, HOME_SLOTS, comfort, ownedQty, pendingDeliveries, type GamePack, type GameState, type NameGloss } from '@lw/game';
import type { StringKey } from '../i18n';
import { cooldownDays } from './homeLogic';
import { isCasual } from './friendsLogic';
import { heartsOf } from './selectors';

type T = (key: StringKey, vars?: Record<string, string | number>) => string;

/** The room the player lives in now: the dorm, or the Ono-sō flat once `home_room_ono` is theirs. */
export const ownRoomOf = (state: GameState): OwnRoomDef => OWN_ROOMS[state.home.tier];

/**
 * The own doors of the street: the dorm is open while it is the player's room, the flat once it is. After moving the dorm is a closed door
 * (a tap says so); before renting, the flat's door is Aiko's building (a tap says so).
 */
export const ownDoors = (state: GameState): Array<['dorm' | 'flat', boolean]> => [
  ['dorm', state.home.tier === 'dorm'],
  ['flat', state.home.tier === 'ono'],
];

/** Whether the first entry into this room has not happened yet (the flat's genkan is played once; its `visit` files the culture card). */
export const firstEntry = (state: GameState): boolean => !state.stats.visits.includes(ownRoomOf(state).visit);

/** The placed map as the world draws it: only slots of this room, only pieces that are still owned (never a ghost of a sold piece). */
export function worldPlaced(state: GameState): Record<string, string> {
  const room = ownRoomOf(state);
  const out: Record<string, string> = {};
  for (const [slot, id] of Object.entries(state.home.placed)) if (room.slots.includes(slot) && ownedQty(state, id) > 0) out[slot] = id;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The pieces
// ---------------------------------------------------------------------------------------------------------------

/**
 *  - `ready`    owned, delivered, not placed: can be picked
 *  - `placed`   standing in its slot
 *  - `transit`  paid for, on its way (`due` = the wall-calendar date)
 *  - `flat`     owned but its slot is the flat's (the dorm has no place for it)
 */
export type PieceState = 'ready' | 'placed' | 'transit' | 'flat';

export interface PieceRow {
  id: string;
  name: NameGloss;
  slot: string;
  state: PieceState;
  /** transit only: YYYY-MM-DD */
  due?: string;
}

/** Every furniture piece the player owns or has on its way, in catalog order. A piece that stands in its slot is `placed`. */
export function pieceRows(pack: GamePack, state: GameState): PieceRow[] {
  const room = ownRoomOf(state);
  const rows: PieceRow[] = [];
  for (const item of pack.items) {
    const f = FURNITURE[item.id];
    if (!f) continue;
    const row = { id: item.id, name: item.name, slot: f.slot };
    if (ownedQty(state, item.id) > 0) {
      const placed = state.home.placed[f.slot] === item.id;
      rows.push({ ...row, state: placed ? 'placed' : room.slots.includes(f.slot) ? 'ready' : 'flat' });
    }
    const due = pendingDeliveries(state)
      .filter((d) => d.item === item.id)
      .map((d) => d.due)
      .sort()[0];
    if (due !== undefined) rows.push({ ...row, state: 'transit', due });
  }
  return rows;
}

export interface SlotRow {
  slot: string;
  /** the piece standing there, or null */
  piece: PieceRow | null;
}

/** The slots of the room in order, each with the piece standing in it. */
export function slotRows(pack: GamePack, state: GameState): SlotRow[] {
  const pieces = pieceRows(pack, state).filter((p) => p.state === 'placed');
  return ownRoomOf(state).slots.map((slot) => ({ slot, piece: pieces.find((p) => p.slot === slot) ?? null }));
}

/**
 * Whether Rin sells furniture yet: her second-hand row (`rin_home`) opens with its chapter, and before that nothing can be bought for the room.
 * The Furnish sheet then says the room fills up later instead of sending the player to a counter that has nothing, and nobody is invited to a
 * room that cannot be made comfortable (no dead end).
 */
export const furnitureOpen = (pack: GamePack, state: GameState): boolean => state.chapter.n >= (pack.interactions.rin?.find((i) => i.scenarioId === 'fuku_home')?.ch ?? 0);

/** The most comfort this room can ever reach: its base plus the best piece of every one of its places (dorm 7, flat 16; never above the game's cap). */
export function tierMax(pack: GamePack, tier: GameState['home']['tier']): number {
  let sum: number = BALANCE.comfort.base[tier];
  for (const slot of HOME_SLOTS[tier]) {
    let best = 0;
    for (const it of pack.items) for (const fx of it.fx) if (fx.t === 'home' && fx.slot === slot) best = Math.max(best, fx.comfort);
    sum += best;
  }
  return Math.min(BALANCE.comfort.max, sum);
}

/** The comfort of the room and what it opens (a friend can visit from `visitMin`). */
export function comfortInfo(pack: GamePack, state: GameState): { value: number; max: number; visitMin: number; open: boolean } {
  const value = comfort(pack, state);
  return { value, max: tierMax(pack, state.home.tier), visitMin: BALANCE.comfort.visitMin, open: value >= BALANCE.comfort.visitMin };
}

/** "Tue, 14 Oct": the arrival date of a piece on its way, in the app's language (the date is a wall-calendar date, so UTC noon keeps the day). */
export function arrivalText(due: string, lang: string): string {
  const d = new Date(`${due}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return due;
  try {
    return d.toLocaleDateString(lang === 'ar' ? 'ar' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return due;
  }
}

/** The line under a piece on its way: "On its way: arrives Tue, 14 Oct". */
export const transitLine = (t: T, due: string, lang: string): string => t('ho.delivery.onTheWay', { date: arrivalText(due, lang) });

// ---------------------------------------------------------------------------------------------------------------
// The housewarming
// ---------------------------------------------------------------------------------------------------------------

export type InviteStatus = { t: 'ok' } | { t: 'hearts'; need: number } | { t: 'comfort'; need: number; have: number } | { t: 'wait'; days: number };

/**
 * Whether a friend can be invited to the room now: from `OWN_GUEST.hearts` hearts, with the room at comfort `OWN_GUEST.comfort` or more, and the
 * friend not met in the last `everyDays` days (the reducer's one-hang-out-or-visit-per-3-days rule; the invitation would pay nothing).
 */
export function inviteStatus(pack: GamePack, state: GameState, friendId: string): InviteStatus {
  const have = heartsOf(state, friendId);
  if (have < OWN_GUEST.hearts) return { t: 'hearts', need: OWN_GUEST.hearts };
  const c = comfort(pack, state);
  if (c < OWN_GUEST.comfort) return { t: 'comfort', need: OWN_GUEST.comfort, have: c };
  const wait = cooldownDays(state, friendId);
  return wait > 0 ? { t: 'wait', days: wait } : { t: 'ok' };
}

// ---------------------------------------------------------------------------------------------------------------
// Conversation flags
// ---------------------------------------------------------------------------------------------------------------

/**
 * The session flags the scenarios of the room read (the content hand-off): `minor` for the viewing of a profile under 18 (the same scenario then
 * plays as a visit to Aiko's tea room and nobody mentions rent: D28), `casual` for the housewarming with a friend who speaks plain form
 * (`visitFlags` cannot see the guest: `home_own_guest` has no `friendId`).
 */
export function ownRoomFlags(pack: GamePack, state: GameState, age: keyof GamePack['ageProfiles'], scenarioId: string, characterId: string | undefined): Record<string, boolean> {
  if (scenarioId === 'aiko_viewing' && (pack.ageProfiles[age]?.ageFloor ?? 0) < 18) return { minor: true };
  if (scenarioId === OWN_GUEST.scenarioId && characterId && isCasual(pack, state, characterId)) return { casual: true };
  return {};
}

/** The guest of the housewarming is the conversation's friend, so the feedback judges plain speech as right when they speak it. */
export const isOwnGuestScenario = (scenarioId: string): boolean => scenarioId === OWN_GUEST.scenarioId;

/**
 * The scenario as the screen shows it (title and setup): for a profile under 18 the viewing is Aiko's tea room and says nothing about renting
 * (D28). The conversation itself already plays the tea-room variant through the `minor` flag; this covers the text around it (Prepare, the
 * intro of the conversation, the debrief). Every other scenario is returned as it is.
 */
export function shownScenario<S extends { id: string; title: { en: string; ar: string }; setup: { en: string; ar: string } }>(pack: GamePack, age: keyof GamePack['ageProfiles'], sc: S): S {
  return sc.id === 'aiko_viewing' && (pack.ageProfiles[age]?.ageFloor ?? 0) < 18 ? { ...sc, title: VIEWING_MINOR_TEXT.title, setup: VIEWING_MINOR_TEXT.setup } : sc;
}
