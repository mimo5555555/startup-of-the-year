// The world HUD's game logic (docs/GAME_DESIGN.md §2.5, §6.1, §6.4, §7.5, §11.7). Pure functions over the pack and the game state, so they
// are testable without React or WebGL; `syncWorld` is the one function that touches the 3D world. Slice 3F extends `syncWorld` with the
// avatar patches (avatarFx.ts); the ride and speed calls are the same kind of call as the shutters.
import type { Badge, TokyoWorld } from '@lw/world';
import { DOORS, NPC_SPAWNS, SHOPS, shopIdOf } from '@lw/world';
import type { Character } from '@lw/content';
import type { AvatarSpec } from '@lw/content';
import { CHARACTERS, HOMES, OWN_GUEST, homeOfFriend, lessonById, type HomeDef } from '@lw/content';
import {
  derivedFlags,
  evalPred,
  openChapter,
  pocketReady,
  type Disclosure,
  type GamePack,
  type GameState,
  type GameView,
  type Interaction,
  type ItemDef,
  type MenuItem,
  type NameGloss,
  type NextGoal,
  type Pred,
} from '@lw/game';
import { NPC_ORDER, characterById, scenarioById, scenarioForCharacter } from '../content';
import { useStore } from '../store';
import { applyAvatar, avatarSpecFor } from './avatarFx';
import { cooldownDays, doorsOpen } from './homeLogic';
import { furnitureOpen, inviteStatus, ownDoors } from './ownLogic';
import { heartsOf } from './selectors';
import { festivalOpen, festivalPickOf, festivalRowOf, isFestivalRow, syncFestival, FESTIVAL, type FestivalPick } from './festivalSync';

// ---------------------------------------------------------------------------------------------------------------
// HUD disclosure: which elements are on screen (§2.5)
// ---------------------------------------------------------------------------------------------------------------

export type HudElement = 'wallet' | 'tracker' | 'dream' | 'level' | 'phone' | 'found';

/** "at most 4 elements on a 360 px screen" (§2.5, §7.5): wallet, tracker, Dream chip and one of {level/streak chip, phone icon}. */
export const HUD_BUDGET = 4;

/**
 * The HUD elements in reading order. Chapter 1 before the closing beat shows wallet + tracker + the level/streak chip (+ the sign
 * counter, which that chapter's "read 4 signs" asks for); after the beat the Dream chip replaces the counter; once the phone is owned
 * its icon takes the level chip's place, and the level and streak move into the menu.
 */
export function hudElements(d: Pick<Disclosure, 'dreamChip' | 'phoneIcon'>): HudElement[] {
  const out: HudElement[] = ['wallet', 'tracker'];
  if (d.dreamChip) out.push('dream');
  out.push(d.phoneIcon ? 'phone' : 'level');
  if (!d.dreamChip && out.length < HUD_BUDGET) out.push('found');
  return out;
}

export type MenuId = 'quests' | 'friends' | 'phone' | 'wallet' | 'lessons' | 'vocab' | 'stats' | 'settings';

/**
 * The menu entries (§7.5): the game group first (Quests; Friends from Chapter 3; Phone once owned; Wallet; Lessons), then the study
 * group the app always had (Words, Progress, Settings). They are two lists so the original three keep their positions.
 */
export function menuIds(d: Pick<Disclosure, 'friends' | 'phoneIcon'>): { play: MenuId[]; study: MenuId[] } {
  const play: MenuId[] = ['quests'];
  if (d.friends) play.push('friends');
  if (d.phoneIcon) play.push('phone');
  play.push('wallet', 'lessons');
  return { play, study: ['vocab', 'stats', 'settings'] };
}

// ---------------------------------------------------------------------------------------------------------------
// The interaction table: what one NPC offers right now (§6.1)
// ---------------------------------------------------------------------------------------------------------------

export interface InteractionEnv {
  pack: GamePack;
  state: GameState;
  view: GameView;
  /** scenario and lesson ids that are registered right now: an option whose target a later slice has not built is not listed */
  scenarios: ReadonlySet<string>;
  lessons: ReadonlySet<string>;
}

/** Why a listed option cannot be used yet. */
export type Lock = { ch: number } | { hearts: number } | { wait: number } | { comfort: number; have: number } | { other: true };

export interface OptionRow {
  it: Interaction;
  /** null = open now */
  lock: Lock | null;
}

const needsHearts = (g: Pred | undefined): number | null => (g && g.k === 'hearts' ? g.atLeast : null);

/** The chapter at which an option opens: its own `ch`, the opening chapter of its scenario / job / shop, whichever is later. */
function openingChapter(env: InteractionEnv, it: Interaction): number {
  const { pack } = env;
  let ch = it.ch ?? 1;
  if (it.kind === 'shift' && it.jobId) ch = Math.max(ch, openChapter(pack, 'job', it.jobId));
  else if (it.scenarioId && pack.scenarioMeta.some((m) => m.id === it.scenarioId)) ch = Math.max(ch, openChapter(pack, 'scenario', it.scenarioId));
  return ch;
}

/** Whether the target of an option exists at all (hidden otherwise: no dead ends) and the player's age allows it. */
function listable(env: InteractionEnv, it: Interaction, characterId: string): boolean {
  const { pack, state, view } = env;
  switch (it.kind) {
    case 'lesson':
      return !!it.lessonId && env.lessons.has(it.lessonId);
    case 'shift': {
      const job = pack.jobs.find((j) => j.id === it.jobId);
      return !!job && !!it.jobId;
    }
    case 'gift':
      // a gift goes to a friend of the pack (§8.5), and there has to be something in the shops to give
      return pack.friends.some((f) => f.id === characterId) && pack.items.length > 0;
    case 'window': {
      // only a shop that is not open yet is looked at through the window; an open shop has its Goods sheet
      const shop = pack.shops.find((s) => s.id === it.shopId);
      return !!shop && state.chapter.n < shop.openChapter;
    }
    default: {
      if (!it.scenarioId || !env.scenarios.has(it.scenarioId)) return false;
      const min = pack.scenarioMeta.find((m) => m.id === it.scenarioId)?.ageMin;
      return min === undefined || (pack.ageProfiles[view.profile.age]?.ageFloor ?? 0) >= min;
    }
  }
}

function lockOf(env: InteractionEnv, it: Interaction): Lock | null {
  const { pack, state, view } = env;
  const ch = openingChapter(env, it);
  if (state.chapter.n < ch) return { ch };
  if (it.kind === 'shift') {
    const job = pack.jobs.find((j) => j.id === it.jobId);
    if (job && !evalPred(job.unlock, state, { pack, view })) return { other: true };
  }
  if (it.gate && !evalPred(it.gate, state, { pack, view })) {
    const h = needsHearts(it.gate);
    return h === null ? { other: true } : { hearts: h };
  }
  // a hang-out or a visit counts once per `everyDays` days per friend: the row says how long to wait instead of a tap that pays nothing
  const meta = it.scenarioId ? pack.scenarioMeta.find((m) => m.id === it.scenarioId) : undefined;
  if ((meta?.kind === 'hangout' || meta?.kind === 'home') && meta.friendId) {
    const wait = cooldownDays(state, meta.friendId);
    if (wait > 0) return { wait };
  }
  return null;
}

/**
 * Every option of a character that is listable, open ones and the locked ones worth showing (a heart or gate away, or one chapter
 * ahead), in table order. A character with no table (a registry that has not caught up) has no rows: callers fall back to Talk.
 */
export function interactionRows(env: InteractionEnv, characterId: string): OptionRow[] {
  const rows: OptionRow[] = [];
  for (const raw of env.pack.interactions[characterId] ?? []) {
    if (!listable(env, raw, characterId)) continue;
    // the flat is rented once: the viewing and the contract are done with when the room is the player's (no row to a conversation that only says so)
    if (env.state.home.tier === 'ono' && (raw.scenarioId === 'aiko_viewing' || raw.scenarioId === 'aiko_contract')) continue;
    // the festival's rows (Kenji's stall, Hanako's speech) are listed only while the park is the festival (`festivalOpen`, Chapter 7)
    if (isFestivalRow(raw.id) && !festivalOpen(env.state)) continue;
    const it = raw.scenarioId === 'aiko_viewing' && isMinorProfile(env) ? { ...raw, label: TEA_ROOM_LABEL } : raw;
    const lock = lockOf(env, it);
    // teasers: a lock further than the next chapter is noise
    if (lock && 'ch' in lock && lock.ch > env.state.chapter.n + 1) continue;
    rows.push({ it, lock });
  }
  const invite = inviteRow(env, characterId);
  if (invite) rows.push(invite);
  if (characterId === 'hanako' && letterOpen(env.state)) rows.push({ it: LETTER_ROW, lock: null });
  return rows;
}

/** Hanako opens the Letter Home (c8_1, `screen:'letter'`) from Chapter 8 on; at Free Walk the row reopens the written Letter. */
export const LETTER_ROW_ID = 'hanako_letter';
const LETTER_ROW: Interaction = { id: LETTER_ROW_ID, kind: 'scenario', label: { en: 'Write your Letter Home', ar: 'اكتب رسالتك إلى الأهل' } };
export const letterOpen = (state: GameState): boolean => state.chapter.n >= 8;

/** D28: under 18 the viewing plays as a visit to Aiko's tea room next door, and the row says so (nothing about rent). */
const TEA_ROOM_LABEL = { en: "Visit Aiko's tea room", ar: 'زُر بيت شاي أيكو' } as const;
const isMinorProfile = (env: InteractionEnv): boolean => (env.pack.ageProfiles[env.view.profile.age]?.ageFloor ?? 0) < 18;

/**
 * "Invite to your room" (the housewarming): a row of every friend's list from 2 hearts, open when the room is comfortable enough (4) and the friend
 * was not met in the last 3 days, otherwise locked with the reason (the comfort the room needs, or how long to wait).
 */
function inviteRow(env: InteractionEnv, characterId: string): OptionRow | null {
  const { pack, state } = env;
  if (!pack.friends.some((f) => f.id === characterId) || !env.scenarios.has(OWN_GUEST.scenarioId)) return null;
  const st = inviteStatus(pack, state, characterId);
  if (st.t === 'hearts') return null;
  // before Rin sells furniture the room cannot get comfortable: no row to a lock nobody can open
  if (st.t === 'comfort' && !furnitureOpen(pack, state)) return null;
  const it: Interaction = { id: `${characterId}_invite`, kind: 'scenario', scenarioId: OWN_GUEST.scenarioId, label: { en: 'Invite to your room', ar: 'دعوة إلى غرفتك' } };
  const lock: Lock | null = st.t === 'ok' ? null : st.t === 'comfort' ? { comfort: st.need, have: st.have } : { wait: st.days };
  return { it, lock };
}

export const openRows = (rows: OptionRow[]): OptionRow[] => rows.filter((r) => !r.lock);

/** The sheet opens only when more than one thing can be done (§6.1); with exactly one, Talk does it directly. */
export const needsSheet = (rows: OptionRow[]): boolean => openRows(rows).length > 1;

// ---------------------------------------------------------------------------------------------------------------
// Goods
// ---------------------------------------------------------------------------------------------------------------

export interface Good {
  id: string;
  name: NameGloss;
  price: number;
  /** chapter that opens it */
  ch: number;
  ageMin?: number;
  /** single ownership */
  once: boolean;
  kind: 'item' | 'menu';
  /** a contract, not a thing on a shelf (the room at Ono-sō): an under-18 profile never sees it listed (D28) */
  service?: true;
}

const fromItem = (i: ItemDef): Good => ({ id: i.id, name: i.name, price: i.price, ch: i.gate.ch, ageMin: i.gate.ageMin, once: !!i.once, kind: 'item', ...(i.cat === 'service' ? { service: true as const } : {}) });

/** The goods a profile sees on a shop's shelf: a contract (the flat) is hidden from a profile too young for it, where a young shopper still sees a car as "someday" (D28). */
export const shelfFor = (goods: Good[], floor: number): Good[] => goods.filter((g) => !(g.service && g.ageMin !== undefined && floor < g.ageMin));
const fromMenu = (m: MenuItem): Good => ({ id: m.id, name: m.name, price: m.price, ch: 1, once: false, kind: 'menu' });

/** The goods of a shop: what `ShopDef.sells` names plus anything whose `shop` points here, earliest chapter first, then cheapest. */
export function goodsOf(pack: GamePack, shopId: string): Good[] {
  const seen = new Set<string>();
  const out: Good[] = [];
  const add = (g: Good | null) => {
    if (g && !seen.has(g.id)) {
      seen.add(g.id);
      out.push(g);
    }
  };
  for (const id of pack.shops.find((s) => s.id === shopId)?.sells ?? []) {
    const item = pack.items.find((i) => i.id === id);
    const menu = pack.menu.find((m) => m.id === id);
    add(item ? fromItem(item) : menu ? fromMenu(menu) : null);
  }
  for (const i of pack.items) if (i.shop === shopId) add(fromItem(i));
  for (const m of pack.menu) if (m.shop === shopId) add(fromMenu(m));
  return out.sort((a, b) => a.ch - b.ch || a.price - b.price);
}

/** The shop an NPC stands in (the world's shutter id), when the pack describes it and has something on its shelves. */
export function goodsShopOf(pack: GamePack, characterId: string): string | null {
  const spawn = NPC_SPAWNS.find((n) => n.id === characterId);
  const id = spawn ? shopIdOf(spawn, SHOPS) : null;
  return id && goodsOf(pack, id).length > 0 ? id : null;
}

/** The character who keeps a shop (for the sheet of a closed shop front). */
export function keeperOf(shopId: string): string | null {
  return NPC_SPAWNS.find((n) => shopIdOf(n, SHOPS) === shopId)?.id ?? null;
}

// ---------------------------------------------------------------------------------------------------------------
// What an option does
// ---------------------------------------------------------------------------------------------------------------

export type Plan =
  | { t: 'convo'; scenarioId: string; characterId: string; startNode?: string }
  /** a friend's home: the genkan first (HomeStage), then the conversation */
  | { t: 'home'; scenarioId: string; characterId: string }
  /** the housewarming: the friend comes to the player's own room (HomeOwn) */
  | { t: 'invite'; scenarioId: string; characterId: string }
  | { t: 'prepare'; scenarioId: string; characterId: string }
  | { t: 'lesson'; lessonId: string }
  | { t: 'shift'; jobId: string }
  | { t: 'gift'; characterId: string }
  | { t: 'window'; shopId: string }
  /** the Letter Home screen (Chapter 8) */
  | { t: 'letter' };

/** A scenario has a pocket the player has not made ready yet (soft Prepare, §11.1; skipping it is Prepare's own button). */
export function wantsPrepare(env: InteractionEnv, scenarioId: string): boolean {
  const { pack, state, view } = env;
  const lines = (pack.scenarioMeta.find((m) => m.id === scenarioId)?.pocket ?? []).filter((id) => pack.pockets[id]);
  return lines.length > 0 && !pocketReady(pack, state, view, scenarioId);
}

export function planFor(env: InteractionEnv, it: Interaction, characterId: string): Plan {
  const { pack, state } = env;
  if (it.id === LETTER_ROW_ID) return { t: 'letter' };
  // the capstone always opens on its five-line rehearsal (Prepare), whatever the pocket says
  if (it.scenarioId === FESTIVAL.speechScenario) return { t: 'prepare', scenarioId: it.scenarioId, characterId };
  switch (it.kind) {
    case 'lesson':
      return { t: 'lesson', lessonId: it.lessonId! };
    case 'shift':
      return { t: 'shift', jobId: it.jobId! };
    case 'gift':
      return { t: 'gift', characterId };
    case 'window':
      return { t: 'window', shopId: it.shopId! };
    default: {
      const scenarioId = it.scenarioId!;
      if (wantsPrepare(env, scenarioId)) return { t: 'prepare', scenarioId, characterId };
      if (scenarioId in HOMES) return { t: 'home', scenarioId, characterId };
      if (scenarioId === OWN_GUEST.scenarioId) return { t: 'invite', scenarioId, characterId };
      // the ramen shop's ticket from the machine is waiting: Kenji's talk starts at the firmness question
      const startNode = pack.scenarioMeta.find((m) => m.id === scenarioId)?.startNode;
      const ticket = (state.tickets as Record<string, unknown>)[scenarioId];
      return { t: 'convo', scenarioId, characterId, ...(startNode && ticket ? { startNode } : {}) };
    }
  }
}

/** What Talk does for a character whose table is missing or has nothing open: the character's own lesson or primary scenario, as before the game. */
export function legacyPlan(c: Character): Plan | null {
  if (c.lessonId) return { t: 'lesson', lessonId: c.lessonId };
  const sc = scenarioForCharacter(c.id);
  return sc ? { t: 'convo', scenarioId: sc.id, characterId: c.id } : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Badges and shutters
// ---------------------------------------------------------------------------------------------------------------

/** The bubble over an NPC: a padlock when nothing is open with them, else the lesson / new / done bubble of the primary thing to do. */
export function npcBadge(env: InteractionEnv, c: Character, completed: Record<string, unknown>, lessonsDone: readonly string[]): Badge {
  const open = openRows(interactionRows(env, c.id));
  if (open.length === 0 && (env.pack.interactions[c.id] ?? []).length > 0) return 'locked';
  const first = open[0]?.it;
  if (first?.kind === 'lesson' || (!first && c.lessonId)) return lessonsDone.includes(first?.lessonId ?? c.lessonId!) ? 'done' : 'lesson';
  const sid = first?.scenarioId ?? c.scenarioId;
  if (!sid) return 'none';
  return completed[sid] || env.state.runs[sid]?.count ? 'done' : 'new';
}

/** Which shops are open at the current chapter (`ShopDef.openChapter`, D36). A shop the pack does not describe is left as the world has it (open). */
export function shopStates(pack: GamePack, state: GameState): Array<[string, boolean]> {
  const out: Array<[string, boolean]> = pack.shops.map((s) => [s.id, state.chapter.n >= s.openChapter]);
  // a shop that no ShopDef describes yet (Fuku-Fuku, Aiko's stall... until their goods arrive) still has its shutter: it opens with the
  // first chapter whose `opens` lists it, so Chapter 2 opens Fuku-Fuku even before the shop has a catalogue
  const first = new Map<string, number>();
  for (const c of pack.chapters) for (const o of c.opens) if (o.kind === 'shop' && !pack.shops.some((s) => s.id === o.id)) first.set(o.id, Math.min(first.get(o.id) ?? c.n, c.n));
  for (const [id, n] of first) out.push([id, state.chapter.n >= n]);
  return out;
}

/** What the owned things do to the world (§5.5): the ride under the player, the speed multiplier and the avatar with the worn pieces on. */
export interface WorldFx {
  ride: 'none' | 'bike' | 'ebike' | 'car';
  moveMultiplier: number;
  spec: AvatarSpec;
}

/** Pure: the ride, speed and avatar for a game state. `base` is the avatar the player made in onboarding. */
export function worldFx(pack: GamePack, state: GameState, base: AvatarSpec): WorldFx {
  const flags = derivedFlags(pack, state);
  return { ride: flags.ride.mesh, moveMultiplier: flags.speedMult, spec: avatarSpecFor(pack, state, base) };
}

/**
 * Puts the 3D world in line with the game: shutters, NPC badges, ride, speed and the avatar's worn pieces. Safe to call after every
 * state change (the world rebuilds the avatar only when the spec really changed). `opts.base` is the player's own avatar; it defaults to
 * the profile's.
 */
export function syncWorld(
  world: TokyoWorld,
  env: InteractionEnv,
  legacy: { completed: Record<string, unknown>; lessonsDone: readonly string[] },
  opts: { base?: AvatarSpec | null } = {},
): void {
  for (const [id, open] of shopStates(env.pack, env.state)) world.setShopOpen(id, open);
  for (const c of CHARACTERS) {
    if (!NPC_SPAWNS.some((n) => n.id === c.id)) continue;
    world.setNpcBadge(c.id, npcBadge(env, c, legacy.completed, legacy.lessonsDone));
  }
  for (const [who, open] of doorsOpen(env.state, env.scenarios)) world.setDoorOpen(who, open);
  // the player's own doors: the dorm while it is their room, the flat from the day it is rented (also after a reload)
  for (const [door, open] of ownDoors(env.state)) world.setDoorOpen(door, open);
  const base = opts.base ?? useStore.getState().profile?.avatar ?? null;
  const fx = worldFx(env.pack, env.state, base ?? CHARACTERS[0].avatar);
  world.setMoveMultiplier(fx.moveMultiplier);
  world.setRide(fx.ride);
  if (base) applyAvatar(world, fx.spec, base);
  // Chapter 7: the park is the festival on the festival day, with the friends at two hearts or more
  syncFestival(world, env.pack, env.state);
}

// ---------------------------------------------------------------------------------------------------------------
// The tracker: where a goal points, and the legacy "next up" it falls back to
// ---------------------------------------------------------------------------------------------------------------

export type GoalTarget =
  | { t: 'npc'; id: string }
  | { t: 'point'; x: number; z: number }
  | { t: 'screen'; screen: 'quests' | 'vocab'; tab?: 'dream' | 'story' | 'today' | 'friends' | 'culture' }
  | null;

/** The NPC who stands at a place (`Character.locationId`), with the places that have no NPC of their own. */
export function npcAtPlace(place: string): string | null {
  if (place === 'hikarigaoka') return 'sato';
  if (place === 'ono' || place.startsWith('home_')) return null;
  return CHARACTERS.find((c) => c.locationId === place && NPC_SPAWNS.some((n) => n.id === c.id))?.id ?? null;
}

/** Where the player walks for a goal; screens for the goals that live in one. */
export function goalTarget(goal: NextGoal | null): GoalTarget {
  if (!goal) return null;
  if (goal.pin?.friend) return { t: 'npc', id: goal.pin.friend };
  if (goal.pin?.place) {
    const npc = npcAtPlace(goal.pin.place);
    if (npc) return { t: 'npc', id: npc };
    if (goal.pin.place === 'ono') {
      const d = DOORS.find((x) => x.id === 'door:aiko');
      if (d) return { t: 'point', x: d.pick.x, z: d.pick.z - 1 };
    }
  }
  switch (goal.kind) {
    case 'lesson':
      return { t: 'npc', id: 'hanako' };
    case 'practice': {
      const who = scenarioById(goal.id)?.characterId;
      return who ? { t: 'npc', id: who } : null;
    }
    case 'review':
      return { t: 'screen', screen: 'vocab' };
    case 'dream':
      return { t: 'screen', screen: 'quests', tab: 'dream' };
    case 'daily':
      return { t: 'screen', screen: 'quests', tab: 'today' };
    default:
      return { t: 'screen', screen: 'quests', tab: 'story' };
  }
}

/** Where to stand to talk to an NPC (the same spot "next up" always used). */
export function approachPoint(npcId: string): { x: number; z: number } | null {
  const spawn = NPC_SPAWNS.find((n) => n.id === npcId);
  if (!spawn) return null;
  const d = spawn.radius * 0.62;
  return { x: spawn.x + Math.sin(spawn.face) * d, z: spawn.z + Math.cos(spawn.face) * d };
}

/** The map pin of a goal: an NPC dot or a point. */
export type MapPin = { npc: string } | { x: number; z: number };

export function pinOf(goal: NextGoal | null): MapPin | null {
  const t = goalTarget(goal);
  if (t?.t === 'npc') return NPC_SPAWNS.some((n) => n.id === t.id) ? { npc: t.id } : null;
  if (t?.t === 'point') return { x: t.x, z: t.z };
  return null;
}

/**
 * The first unfinished thing of the original tour (lesson, then each scenario), as a goal. The tracker shows it while the pack's own
 * goal list is empty, so a profile always has a next step and "Practise again" appears only when the tour is done.
 */
export function legacyGoal(completed: Record<string, unknown>, lessonsDone: readonly string[]): NextGoal | null {
  for (const id of NPC_ORDER) {
    const c = characterById(id);
    if (!c) continue;
    if (c.lessonId) {
      if (lessonsDone.includes(c.lessonId)) continue;
      const lesson = lessonById(c.lessonId);
      return { kind: 'lesson', id: c.lessonId, text: lesson?.title ?? { en: 'Lesson', ar: 'درس' }, pin: { friend: id } };
    }
    const sc = scenarioForCharacter(id);
    if (sc && !completed[sc.id]) return { kind: 'practice', id: sc.id, text: sc.title, pin: { friend: id } };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// World picks
// ---------------------------------------------------------------------------------------------------------------

export type PickRoute =
  | { t: 'vending' }
  | { t: 'ticket'; kind: 'ramen' | 'station' }
  | { t: 'door'; friend: string | null }
  /** the player's own room: the dorm door or the flat's */
  | { t: 'own'; door: 'dorm' | 'flat' }
  | { t: 'shop'; shopId: string }
  /** a festival stall or the stage (only pickable while the festival is on) */
  | { t: 'festival'; pick: FestivalPick }
  | null;

/** World pick ids are routed game first (§7.6): panels, doors and shop fronts here; every other id keeps the sign word card. */
export function routePick(id: string): PickRoute {
  if (id === 'vending') return { t: 'vending' };
  if (id === 'ramen_machine') return { t: 'ticket', kind: 'ramen' };
  if (id === 'ticket') return { t: 'ticket', kind: 'station' };
  if (id === 'door:dorm') return { t: 'own', door: 'dorm' };
  if (id === 'door:flat') return { t: 'own', door: 'flat' };
  if (id.startsWith('door:')) return { t: 'door', friend: id.slice(5) };
  if (id.startsWith('shop:')) return { t: 'shop', shopId: id.slice(5) };
  const fest = festivalPickOf(id);
  if (fest) return { t: 'festival', pick: fest };
  return null;
}

/**
 * Whether a friend's door opens: the friend's home-visit option is open (the heart and chapter gates of §8.8). The visit scenario itself
 * comes from slice 4 / 5, so a door whose scenario is not registered stays shut (the tooltip says 「まだ入れません」).
 */
export function doorOpens(env: InteractionEnv, friend: string | null): boolean {
  if (!friend) return false;
  const row = interactionRows(env, friend).find((r) => r.it.kind === 'visit');
  return !!row && !row.lock;
}

/** What a tap on a friend's door does (docs/GAME_DESIGN.md §6.4, §8.8): go in, say "not yet" with the reason, or say how long to wait. */
export type DoorStatus =
  | { t: 'open'; home: HomeDef }
  | { t: 'hearts'; home: HomeDef; need: number; have: number }
  | { t: 'wait'; home: HomeDef; days: number }
  | { t: 'none' };

export function doorStatus(env: InteractionEnv, friend: string | null): DoorStatus {
  const home = friend ? homeOfFriend(friend) : undefined;
  if (!friend || !home) return { t: 'none' };
  const have = heartsOf(env.state, friend);
  const row = interactionRows(env, friend).find((r) => r.it.kind === 'visit');
  if (have < home.hearts || !row) return { t: 'hearts', home, need: home.hearts, have };
  if (row.lock && 'wait' in row.lock) return { t: 'wait', home, days: row.lock.wait };
  return row.lock ? { t: 'hearts', home, need: home.hearts, have } : { t: 'open', home };
}

/**
 * What a festival pick does: the festival row it stands for (a stall is Kenji's matsuri_stalls row, the stage Hanako's speech, which opens on
 * its rehearsal), or nothing while the row is not open (the picks exist only while the festival is on).
 */
export function festivalPlan(env: InteractionEnv, pick: FestivalPick): Plan | null {
  const to = festivalRowOf(pick);
  if (!to) return null;
  const { characterId, scenarioId } = to;
  const row = openRows(interactionRows(env, characterId)).find((r) => r.it.scenarioId === scenarioId);
  return row ? planFor(env, row.it, characterId) : null;
}

/** What a tap on one of the player's own doors does: go in, or say why not (the flat is Aiko's building until it is rented; the dorm is left behind after moving). */
export type OwnDoorStatus = { t: 'open' } | { t: 'flat_closed' } | { t: 'dorm_moved' };

export function ownDoorStatus(state: GameState, door: 'dorm' | 'flat'): OwnDoorStatus {
  const tier = state.home.tier;
  if (door === 'dorm') return tier === 'dorm' ? { t: 'open' } : { t: 'dorm_moved' };
  return tier === 'ono' ? { t: 'open' } : { t: 'flat_closed' };
}
