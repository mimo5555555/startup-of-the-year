// Goen stage 1 in the app (docs/GOEN.md): pure helpers for the Shrine panel, the wish ritual, the omikuji, the Season screen and the Kyoto
// Journey. The rules live in @lw/game (goen.ts: the ledger, `goen_spend`, the season and the journey); this file only turns them into what the
// screens show and the events they dispatch, so it is testable without React or WebGL. Goen never touches the yen wallet: the one yen amount
// here is the Shinkansen fare of the Kyoto Journey, charged through the ordinary `fare` event.
import { BALANCE, fareFor, ledgerHas, LEDGER_IDS, type GamePack, type GameState } from '@lw/game';
import type { StringKey } from '../i18n';

// ---------------------------------------------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------------------------------------------

/** The Kyoto Journey's catalog item, journey and fare place. */
export const KYOTO = { item: 'journey_kyoto', journey: 'journey_kyoto', place: 'kyoto', visit: 'trip:kyoto' } as const;
export const SEASON_PREMIUM = 'season_autumn_premium';
export const CHARM = 'omamori_streak';

/** What to do with a thing once it is yours: the line the ritual's celebration shows, and where its button goes. */
export interface NextStep {
  key: StringKey;
  /** the screen the button opens (none: nothing to open, the line is enough) */
  open?: 'wallet' | 'season' | 'room' | 'station';
}

export function nextStepOf(pack: GamePack, itemId: string): NextStep {
  if (itemId === KYOTO.item) return { key: 'gn.next.journey', open: 'station' };
  if (itemId === SEASON_PREMIUM) return { key: 'gn.next.season', open: 'season' };
  if (itemId === CHARM) return { key: 'gn.next.charm' };
  const item = pack.items.find((i) => i.id === itemId);
  if (item?.fx.some((f) => f.t === 'avatar')) return { key: 'gn.next.wear', open: 'wallet' };
  if (item?.fx.some((f) => f.t === 'home')) return { key: 'gn.next.room', open: 'room' };
  return { key: 'gn.next.ride', open: 'wallet' };
}

/** The icon of a catalog entry by its kind (the cards draw a small picture over it). */
export function goenIcon(kind: string, itemId: string): string {
  if (kind === 'journey') return 'train';
  if (kind === 'season') return 'star';
  if (kind === 'charm') return 'heart';
  if (itemId.startsWith('kimono')) return 'shirt';
  if (itemId.startsWith('ride')) return 'bike';
  return 'home';
}

// ---------------------------------------------------------------------------------------------------------------
// The wish ritual: 二礼二拍手一礼
// ---------------------------------------------------------------------------------------------------------------

export type RitualTap = 'bow' | 'clap';
/** bow, bow, clap, clap, bow */
export const RITUAL_ORDER: readonly RitualTap[] = ['bow', 'bow', 'clap', 'clap', 'bow'];

/**
 * One tap of the five: the right one moves the ritual on, a wrong one changes nothing (Hanako's gentle hint names the next move; never a
 * penalty). `done` = how many of the five are done.
 */
export function ritualTap(done: number, tap: RitualTap): { ok: boolean; done: number; next: RitualTap | null } {
  const want = RITUAL_ORDER[done];
  if (!want) return { ok: false, done, next: null };
  if (tap !== want) return { ok: false, done, next: want };
  const after = done + 1;
  return { ok: true, done: after, next: RITUAL_ORDER[after] ?? null };
}

// ---------------------------------------------------------------------------------------------------------------
// The omikuji: one due word a day
// ---------------------------------------------------------------------------------------------------------------

/** The vocabulary keys due for review now, soonest first (the reducer picks one; at most 20). */
export function omikujiWords(vocab: ReadonlyArray<{ key?: string; s: string; card: { due: string } }>, now: number): string[] {
  const at = (v: { card: { due: string } }) => new Date(v.card.due).getTime();
  return [...vocab]
    .filter((v) => at(v) <= now)
    .sort((a, b) => at(a) - at(b))
    .slice(0, 20)
    .map((v) => v.key ?? v.s);
}

// ---------------------------------------------------------------------------------------------------------------
// Goen earned: the toast line
// ---------------------------------------------------------------------------------------------------------------

/** The reason of a Goen ledger entry as the toast says it: a chapter names its number, a streak its length, a tier its number. */
export function goenReason(t: (k: StringKey, v?: Record<string, string | number>) => string, reason: string, ref?: string): string {
  const n = ref?.match(/(\d+)$/)?.[1];
  switch (reason) {
    case 'chapter':
      return ref?.startsWith('migrate') ? t('gn.reason.chapters') : n ? t('gn.reason.chapter', { n }) : t('gn.reason.chapters');
    case 'daily':
      return t('gn.reason.daily');
    case 'streak':
      return t('gn.reason.streak', { n: n && !ref?.startsWith('d') ? n : 7 });
    case 'capstone':
      return t('gn.reason.speech');
    case 'letter':
      return t('gn.reason.letter');
    case 'season':
      return t('gn.reason.season', { n: n ?? '' });
    case 'journey':
      return t('gn.reason.journey');
    default:
      return t('gn.reason.other');
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The Kyoto Journey: the ride there, three stops, the ride back
// ---------------------------------------------------------------------------------------------------------------

export type KyotoPlace = 'ryokan' | 'temple' | 'matcha';

/** The three stops on the Kyoto map (x / y in % of the map, left-to-right in both languages: a map is not mirrored). */
export const KYOTO_STOPS: ReadonlyArray<{ place: KyotoPlace; scenarioId: string; characterId: string; x: number; y: number }> = [
  { place: 'ryokan', scenarioId: 'kyoto_ryokan', characterId: 'fujiwara', x: 30, y: 46 },
  { place: 'temple', scenarioId: 'kyoto_temple', characterId: 'ishida', x: 76, y: 22 },
  { place: 'matcha', scenarioId: 'kyoto_matcha', characterId: 'mori', x: 60, y: 58 },
];

export const kyotoStopOf = (scenarioId: string) => KYOTO_STOPS.find((s) => s.scenarioId === scenarioId) ?? null;
export const isKyotoScenario = (scenarioId: string): boolean => kyotoStopOf(scenarioId) !== null;

export interface KyotoQuote {
  /** both ways, as charged */
  total: number;
  /** the same by IC card / in cash (a short-of-money line quotes the one that would be used) */
  icTotal: number;
  paperTotal: number;
  method: 'ic' | 'paper' | null;
}

/** What the Shinkansen round trip costs and how it would be paid: the IC card when it holds the whole fare, else a paper ticket in cash. */
export function kyotoQuote(pack: GamePack, state: GameState): KyotoQuote {
  const legs = BALANCE.fares.tripLegs as 2;
  const icTotal = fareFor(pack, state, KYOTO.place, 'ic') * legs;
  const paperTotal = fareFor(pack, state, KYOTO.place, 'paper') * legs;
  const ownsIc = state.wallet.ic > 0 || (state.owned.ic_card?.qty ?? 0) > 0;
  if (ownsIc && state.wallet.ic >= icTotal) return { total: icTotal, icTotal, paperTotal, method: 'ic' };
  if (state.wallet.cash >= paperTotal) return { total: paperTotal, icTotal, paperTotal, method: 'paper' };
  return { total: paperTotal, icTotal, paperTotal, method: null };
}

/**
 * Whether the player is in Kyoto: a Shinkansen fare was charged (its ledger id is kept with the trip) and the ride back is not filed yet.
 * `away` is the fare id of the trip under way (persisted next to the game save, `goenStore.ts`); a reset game has no such ledger entry, so
 * the trip is over then too.
 */
export const inKyoto = (state: GameState, away: string | null): boolean => !!away && ledgerHas(state, LEDGER_IDS.fare(away));

// ---------------------------------------------------------------------------------------------------------------
// The sakura paint on the bicycle (Wallet ride card)
// ---------------------------------------------------------------------------------------------------------------

export const RIDE_PAINT = 'ride_sakura';
/** The paint's colour; it is kept in the outfit's colours (a cosmetic's pick) while the paint is on, so the switch is in the save. */
export const RIDE_PAINT_HEX = '#f4a6c0';

/** Whether the paint is on: owned and switched on (it goes on by itself when bought). */
export const ridePaintOn = (state: GameState): boolean => (state.owned[RIDE_PAINT]?.qty ?? 0) > 0 && !!state.outfit.colours[RIDE_PAINT];

/** The world's ride skin (`world.setRideSkin`): 'sakura' while the paint is on, else null. */
export const rideSkinOf = (state: GameState): 'sakura' | null => (ridePaintOn(state) ? 'sakura' : null);

/** The outfit colours with the paint switched on or off (dispatched as `outfit_changed`; the worn pieces stay as they are). */
export function ridePaintColours(state: GameState, on: boolean): Record<string, string> {
  const { [RIDE_PAINT]: _old, ...rest } = state.outfit.colours;
  void _old;
  return on ? { ...rest, [RIDE_PAINT]: RIDE_PAINT_HEX } : rest;
}

/** The variables of a Goen toast in the player's language: a season task is named by its text, not its id. */
export function goenToastVars(pack: GamePack, key: string, vars: Record<string, string | number> | undefined, lang: 'en' | 'ar'): Record<string, string | number> | undefined {
  if (!vars || key !== 'goen.toast.task' || typeof vars.task !== 'string') return vars;
  const task = pack.goen?.seasons.flatMap((s) => s.tasks).find((x) => x.id === vars.task);
  return task ? { ...vars, task: task.text[lang] } : vars;
}
