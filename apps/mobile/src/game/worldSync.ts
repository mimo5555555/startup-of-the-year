// The world HUD's game logic (docs/GAME_DESIGN.md §2.5, §6.1, §6.4, §7.5, §11.7). Pure functions over the pack and the game state, so they
// are testable without React or WebGL; `syncWorld` is the one function that touches the 3D world. Slice 3F extends `syncWorld` with the
// avatar patches; the ride and speed calls are already here because they are the same kind of call as the shutters.
import type { Badge, TokyoWorld } from '@lw/world';
import { DOORS, NPC_SPAWNS, SHOPS, shopIdOf } from '@lw/world';
import type { Character } from '@lw/content';
import { CHARACTERS, lessonById } from '@lw/content';
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
export type Lock = { ch: number } | { hearts: number } | { other: true };

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
  return null;
}

/**
 * Every option of a character that is listable, open ones and the locked ones worth showing (a heart or gate away, or one chapter
 * ahead), in table order. A character with no table (a registry that has not caught up) has no rows: callers fall back to Talk.
 */
export function interactionRows(env: InteractionEnv, characterId: string): OptionRow[] {
  const rows: OptionRow[] = [];
  for (const it of env.pack.interactions[characterId] ?? []) {
    if (!listable(env, it, characterId)) continue;
    const lock = lockOf(env, it);
    // teasers: a lock further than the next chapter is noise
    if (lock && 'ch' in lock && lock.ch > env.state.chapter.n + 1) continue;
    rows.push({ it, lock });
  }
  return rows;
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
}

const fromItem = (i: ItemDef): Good => ({ id: i.id, name: i.name, price: i.price, ch: i.gate.ch, ageMin: i.gate.ageMin, once: !!i.once, kind: 'item' });
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
  | { t: 'prepare'; scenarioId: string; characterId: string }
  | { t: 'lesson'; lessonId: string }
  | { t: 'shift'; jobId: string }
  | { t: 'gift'; characterId: string }
  | { t: 'window'; shopId: string };

/** A scenario has a pocket the player has not made ready yet (soft Prepare, §11.1; skipping it is Prepare's own button). */
export function wantsPrepare(env: InteractionEnv, scenarioId: string): boolean {
  const { pack, state, view } = env;
  const lines = (pack.scenarioMeta.find((m) => m.id === scenarioId)?.pocket ?? []).filter((id) => pack.pockets[id]);
  return lines.length > 0 && !pocketReady(pack, state, view, scenarioId);
}

export function planFor(env: InteractionEnv, it: Interaction, characterId: string): Plan {
  const { pack, state } = env;
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
  return pack.shops.map((s) => [s.id, state.chapter.n >= s.openChapter]);
}

/** Puts the 3D world in line with the game: shutters, NPC badges, ride and speed. Safe to call after every state change. */
export function syncWorld(world: TokyoWorld, env: InteractionEnv, legacy: { completed: Record<string, unknown>; lessonsDone: readonly string[] }): void {
  for (const [id, open] of shopStates(env.pack, env.state)) world.setShopOpen(id, open);
  for (const c of CHARACTERS) {
    if (!NPC_SPAWNS.some((n) => n.id === c.id)) continue;
    world.setNpcBadge(c.id, npcBadge(env, c, legacy.completed, legacy.lessonsDone));
  }
  const flags = derivedFlags(env.pack, env.state);
  world.setMoveMultiplier(flags.speedMult);
  world.setRide(flags.ride.mesh);
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
  | { t: 'shop'; shopId: string }
  | null;

/** World pick ids are routed game first (§7.6): panels, doors and shop fronts here; every other id keeps the sign word card. */
export function routePick(id: string): PickRoute {
  if (id === 'vending') return { t: 'vending' };
  if (id === 'ramen_machine') return { t: 'ticket', kind: 'ramen' };
  if (id === 'ticket') return { t: 'ticket', kind: 'station' };
  if (id.startsWith('door:')) return { t: 'door', friend: id === 'door:dorm' ? null : id.slice(5) };
  if (id.startsWith('shop:')) return { t: 'shop', shopId: id.slice(5) };
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
