// Goen (ご縁, docs/GOEN.md): the second currency, earned free in play (stage 1) and spent at the shrine on Journeys, the season's premium
// track, looks and the streak charm. One idempotent ledger with a checksum (balance = earned - spent), the earn rules of BALANCE.goen, the
// spend, the streak omamori, the omikuji, the season (points from speaking tasks counted from its start, tiers on two tracks) and the
// Journeys' objective sets. Principles: Goen never becomes yen (and yen never Goen), never buys learning progress, and nothing it gives is
// random. No function here writes the wallet, the yen ledger, the chapter, the objectives or the hearts.
import { BALANCE } from './balance';
import { localDateString } from './integrity';
import { grantItem } from './inventory';
import { dayKey } from './ledger';
import { evalPred, predProgress } from './objectives';
import type {
  DerivedEvent,
  GamePack,
  GameState,
  GameView,
  GoenEntry,
  GoenItemDef,
  GoenJourneyState,
  GoenReason,
  GoenSeasonState,
  GoenState,
  InputEvent,
  JourneyDef,
  Objective,
  OmikujiFortune,
  PredProgress,
  ReduceCtx,
  ReduceResult,
  SeasonDef,
  SeasonReward,
  SeasonTask,
  UiEffect,
} from './types';

// ---------------------------------------------------------------------------------------------------------------
// Ids and the empty state
// ---------------------------------------------------------------------------------------------------------------

/** Earn reason ids (`GoenState.earned`); the ledger entry of a reason is `goen:<reason id>`. One spelling, here. */
export const GOEN_IDS = {
  chapter: (n: number) => `chapter:${n}`,
  daily: (dayIndex: number) => `daily:${dayKey(dayIndex)}`,
  streak: (dayIndex: number, days: number) => `streak:${dayKey(dayIndex)}:${days}`,
  capstone: 'capstone',
  letter: 'letter',
  season: (key: string, tier: number) => `season:${key}:${tier}`,
  journey: (id: string) => `journey:${id}`,
  /** a once-item is `spend:<itemId>`; the repeatable charm adds the event id */
  spend: (itemId: string, id?: string) => (id === undefined ? `spend:${itemId}` : `spend:${itemId}:${id}`),
} as const;

export const goenEntryId = (reasonId: string): string => `goen:${reasonId}`;

/** The catalog id of the streak omamori (the one repeatable item: held, not owned). */
export const CHARM_KIND = 'charm';

export const emptySeason = (key: string | null = null): GoenSeasonState => ({ key, sp: 0, counts: {}, words: [], done: {}, tiers: {} });

/** A new game's Goen: nothing earned, nothing owned. */
export function emptyGoen(): GoenState {
  return {
    v: 1,
    balance: 0,
    earned: {},
    ledger: [],
    totals: { earned: 0, spent: 0 },
    owned: {},
    charms: 0,
    charmDays: [],
    streak: { last: 0, paid: 0 },
    omikuji: null,
    season: emptySeason(),
    journeys: {},
  };
}

/** The Goen of a state written before Goen existed (tests, hand-built states): an empty one. */
const goenOf = (state: GameState): GoenState => state.goen ?? emptyGoen();

// ---------------------------------------------------------------------------------------------------------------
// The ledger
// ---------------------------------------------------------------------------------------------------------------

const pushEntry = (g: GoenState, e: GoenEntry): GoenEntry[] => [...g.ledger, e].slice(-BALANCE.goen.ledger);

/** Whether a ledger id is in the ring (a spend replayed by the same event id). */
const entryHas = (g: GoenState, id: string): boolean => g.ledger.some((e) => e.id === id);

/**
 * Pays one earn reason once: a reason already in `earned` changes nothing. `amount` <= 0 files the reason without an entry. The only writer of
 * `balance` upwards; `totals.earned` moves with it, so `reconcileGoen` holds after every call.
 */
export function earnGoen(state: GameState, reasonId: string, kind: GoenReason, amount: number, at: number, ref?: string): { state: GameState; paid: number } {
  const g = goenOf(state);
  if (g.earned[reasonId]) return { state, paid: 0 };
  const n = Math.max(0, Math.trunc(amount));
  const earned = { ...g.earned, [reasonId]: true as const };
  if (n === 0) return { state: { ...state, goen: { ...g, earned } }, paid: 0 };
  const entry: GoenEntry = { id: goenEntryId(reasonId), at, delta: n, kind, ...(ref ? { ref } : {}) };
  const goen: GoenState = { ...g, earned, balance: g.balance + n, totals: { ...g.totals, earned: g.totals.earned + n }, ledger: pushEntry(g, entry) };
  return { state: { ...state, goen }, paid: n };
}

/** balance = earned - spent, never negative (the yen wallet's checksum idea, for Goen). */
export function reconcileGoen(state: GameState): { ok: boolean; expected: number; actual: number } {
  const g = goenOf(state);
  const expected = g.totals.earned - g.totals.spent;
  return { ok: expected === g.balance && g.balance >= 0 && g.charms >= 0 && g.charms <= BALANCE.goen.charmsMax, expected, actual: g.balance };
}

export const goenBalance = (state: GameState): number => goenOf(state).balance;
export const charmsHeld = (state: GameState): number => goenOf(state).charms;
export const goenOwns = (state: GameState, itemId: string): boolean => goenOf(state).owned[itemId] !== undefined;

// ---------------------------------------------------------------------------------------------------------------
// The catalog and the spend
// ---------------------------------------------------------------------------------------------------------------

export const goenItem = (pack: GamePack, itemId: string): GoenItemDef | undefined => pack.goen?.catalog.find((c) => c.id === itemId);

/** Every ItemDef id Goen grants (catalog cosmetics and season rewards): never sold for yen, so they need no yen sale route. */
export function goenGrantedItems(pack: GamePack): Set<string> {
  const ids = new Set<string>();
  for (const c of pack.goen?.catalog ?? []) if (c.kind === 'cosmetic') ids.add(c.itemId ?? c.id);
  for (const s of pack.goen?.seasons ?? []) for (const t of s.tiers) for (const r of [...t.free, ...t.premium]) if (r.t === 'item') ids.add(r.id);
  return ids;
}

export type SpendBlock = 'unknown' | 'owned' | 'max' | 'funds' | 'closed';

/**
 * Whether `itemId` can be bought now: known, not owned (the charm: fewer than the most held), its season open, enough Goen. `view` is the
 * age profile's door for stage 2 (kids buy like adults in stage 1); without `nowMs` the season window is not judged (the reducer always passes it).
 */
export function canSpend(pack: GamePack, state: GameState, view: GameView | null, itemId: string, nowMs?: number): { ok: boolean; reason?: SpendBlock } {
  void view;
  const item = goenItem(pack, itemId);
  if (!item) return { ok: false, reason: 'unknown' };
  const g = goenOf(state);
  if (item.kind === CHARM_KIND) {
    if (g.charms >= BALANCE.goen.charmsMax) return { ok: false, reason: 'max' };
  } else if (g.owned[item.id] !== undefined) return { ok: false, reason: 'owned' };
  if (item.kind === 'season') {
    const def = pack.goen?.seasons.find((s) => s.id === item.ref || s.premiumItem === item.id);
    if (!def || (nowMs !== undefined && seasonKeyAt(def, nowMs) === null)) return { ok: false, reason: 'closed' };
  }
  if (g.balance < item.price) return { ok: false, reason: 'funds' };
  return { ok: true };
}

export interface GoenCatalogRow {
  item: GoenItemDef;
  /** a once-item bought */
  owned: boolean;
  /** charms held (the charm row), else 0 / 1 */
  held: number;
  /** Goen */
  price: number;
  canBuy: boolean;
  reason?: SpendBlock;
  /** Goen still needed (0 when affordable) */
  short: number;
}

/** The Shrine panel's catalog, in pack order (pass `nowMs` so a season's premium track outside its window reads 'closed'). */
export function goenCatalog(pack: GamePack, state: GameState, view: GameView | null, nowMs?: number): GoenCatalogRow[] {
  const g = goenOf(state);
  return (pack.goen?.catalog ?? []).map((item) => {
    const c = canSpend(pack, state, view, item.id, nowMs);
    const owned = item.kind !== CHARM_KIND && g.owned[item.id] !== undefined;
    return {
      item,
      owned,
      held: item.kind === CHARM_KIND ? g.charms : owned ? 1 : 0,
      price: item.price,
      canBuy: c.ok,
      ...(c.reason ? { reason: c.reason } : {}),
      short: Math.max(0, item.price - g.balance),
    };
  });
}

/** The coin toss: spends the price once and grants the item at once (cosmetics into `owned`, a Journey's progress, a charm). */
export function spendGoen(state: GameState, pack: GamePack, ev: Extract<InputEvent, { t: 'goen_spend' }>, now: number): ReduceResult & { ok: boolean } {
  const none = { state, derived: [], effects: [], ok: false };
  if (typeof ev.id !== 'string' || !ev.id || ev.id.length > 64) return none;
  const item = goenItem(pack, ev.itemId);
  if (!item || !canSpend(pack, state, null, item.id, now).ok) return none;
  const g = goenOf(state);
  const id = goenEntryId(GOEN_IDS.spend(item.id, item.kind === CHARM_KIND ? ev.id : undefined));
  if (entryHas(g, id)) return none;
  const day = dayKey(state.clock.dayIndex);
  let goen: GoenState = {
    ...g,
    balance: g.balance - item.price,
    totals: { ...g.totals, spent: g.totals.spent + item.price },
    ledger: pushEntry(g, { id, at: now, delta: -item.price, kind: 'spend', ref: item.id }),
  };
  if (item.kind === CHARM_KIND) goen = { ...goen, charms: goen.charms + 1 };
  else goen = { ...goen, owned: { ...goen.owned, [item.id]: day } };
  if (item.kind === 'journey' && item.ref && !goen.journeys[item.ref]) goen = { ...goen, journeys: { ...goen.journeys, [item.ref]: { done: {}, complete: null } } };
  let s: GameState = { ...state, goen };
  // a look is an ordinary owned item from now on: the Wardrobe, the furniture placer and the ride card read `owned`
  const grant = item.itemId ?? item.id;
  if (item.kind === 'cosmetic' && pack.items.some((i) => i.id === grant)) s = grantItem(s, pack, grant, 1, day);
  return {
    state: s,
    ok: true,
    derived: [
      { t: 'goen_changed', delta: -item.price, balance: goen.balance, reason: 'spend', ref: item.id },
      { t: 'goen_owned', itemId: item.id },
    ],
    effects: [],
  };
}

/** The streak hook used a charm on local date `day`: one charm, once a day. */
export function useCharm(state: GameState, day: string): ReduceResult & { ok: boolean } {
  const g = goenOf(state);
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || g.charms < 1 || g.charmDays.includes(day)) return { state, derived: [], effects: [], ok: false };
  const goen: GoenState = { ...g, charms: g.charms - 1, charmDays: [...g.charmDays, day].slice(-10) };
  return {
    state: { ...state, goen },
    ok: true,
    derived: [{ t: 'charm_used', left: goen.charms }],
    effects: [{ t: 'toast', key: 'goen.toast.charm', vars: { left: goen.charms } }],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The omikuji (free, once a day; the fortune decides only the wording)
// ---------------------------------------------------------------------------------------------------------------

export const omikujiOpen = (state: GameState): boolean => goenOf(state).omikuji?.day !== state.clock.dayIndex;

/** The fortune line of today's draw, `{word}` filled by the app. */
export const omikujiFortune = (pack: GamePack, id: string): OmikujiFortune | undefined => pack.goen?.omikuji.find((f) => f.id === id);

export function drawOmikuji(state: GameState, pack: GamePack, words: string[], rng: () => number): ReduceResult & { ok: boolean } {
  const fortunes = pack.goen?.omikuji ?? [];
  if (fortunes.length === 0 || !omikujiOpen(state)) return { state, derived: [], effects: [], ok: false };
  const total = fortunes.reduce((n, f) => n + Math.max(0, f.weight), 0);
  let roll = rng() * total;
  let fortune = fortunes[fortunes.length - 1]!;
  for (const f of fortunes) {
    roll -= Math.max(0, f.weight);
    if (roll < 0) {
      fortune = f;
      break;
    }
  }
  const due = (Array.isArray(words) ? words : []).filter((w): w is string => typeof w === 'string' && w.length > 0 && w.length <= 64).slice(0, 50);
  const word = due.length ? due[Math.min(due.length - 1, Math.floor(rng() * due.length))]! : null;
  const g = goenOf(state);
  return {
    state: { ...state, goen: { ...g, omikuji: { day: state.clock.dayIndex, fortune: fortune.id, word } } },
    ok: true,
    derived: [{ t: 'omikuji', fortune: fortune.id, word }],
    effects: [],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Seasons: a real-calendar window every year
// ---------------------------------------------------------------------------------------------------------------

/** The season's key at `nowMs` ('<id>:<year the window started>'), or null outside its window; a window may wrap the new year. */
export function seasonKeyAt(def: SeasonDef, nowMs: number): string | null {
  if (!Number.isFinite(nowMs)) return null;
  const d = localDateString(nowMs);
  const md = d.slice(5);
  const y = Number(d.slice(0, 4));
  const { from, to } = def.window;
  if (from <= to) return md >= from && md <= to ? `${def.id}:${y}` : null;
  if (md >= from) return `${def.id}:${y}`;
  if (md <= to) return `${def.id}:${y - 1}`;
  return null;
}

/** The season open at `nowMs`, if any. */
export function activeSeason(pack: GamePack, nowMs: number): { def: SeasonDef; key: string } | null {
  for (const def of pack.goen?.seasons ?? []) {
    const key = seasonKeyAt(def, nowMs);
    if (key) return { def, key };
  }
  return null;
}

/** The next window to open after `nowMs` (the "next season soon" line): its season and local start date. */
export function nextSeason(pack: GamePack, nowMs: number): { def: SeasonDef; from: string } | null {
  const d = localDateString(nowMs);
  const y = Number(d.slice(0, 4));
  let best: { def: SeasonDef; from: string } | null = null;
  for (const def of pack.goen?.seasons ?? []) {
    const { from: start } = def.window;
    const thisYear = `${y}-${start}`;
    const from = thisYear > d ? thisYear : `${y + 1}-${start}`;
    if (!best || from < best.from) best = { def, from };
  }
  return best;
}

const seasonDefOf = (pack: GamePack, key: string | null): SeasonDef | undefined => (key ? pack.goen?.seasons.find((s) => key.startsWith(`${s.id}:`)) : undefined);

export interface SeasonView {
  def: SeasonDef;
  /** open now; outside the window the screen shows "next season soon" (`nextFrom`) and nothing is lost */
  active: boolean;
  key: string | null;
  sp: number;
  premium: boolean;
  tasks: Array<{ task: SeasonTask; count: number; done: boolean }>;
  tiers: Array<{ n: number; sp: number; reached: boolean; free: { rewards: SeasonReward[]; granted: boolean }; premium: { rewards: SeasonReward[]; granted: boolean } }>;
  /** the next window's start (YYYY-MM-DD) while closed */
  nextFrom?: string;
}

/** The Season screen: the open season (or the next one, closed) with tasks, tiers on both tracks and what was granted. */
export function seasonView(pack: GamePack, state: GameState, nowMs: number): SeasonView | null {
  const open = activeSeason(pack, nowMs);
  const next = open ? null : nextSeason(pack, nowMs);
  const def = open?.def ?? next?.def;
  if (!def) return null;
  const g = goenOf(state);
  const key = open?.key ?? null;
  const season = key && g.season.key === key ? g.season : emptySeason(key);
  return {
    def,
    active: !!open,
    key,
    sp: season.sp,
    premium: g.owned[def.premiumItem] !== undefined,
    tasks: def.tasks.map((task) => ({ task, count: Math.min(task.target, season.counts[task.id] ?? 0), done: season.done[task.id] !== undefined })),
    tiers: [...def.tiers]
      .sort((a, b) => a.n - b.n)
      .map((t) => ({
        n: t.n,
        sp: t.sp,
        reached: season.sp >= t.sp,
        free: { rewards: t.free, granted: season.tiers[`free:${t.n}`] !== undefined },
        premium: { rewards: t.premium, granted: season.tiers[`premium:${t.n}`] !== undefined },
      })),
    ...(next ? { nextFrom: next.from } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Journeys
// ---------------------------------------------------------------------------------------------------------------

export const journeyDef = (pack: GamePack, id: string): JourneyDef | undefined => pack.goen?.journeys.find((j) => j.id === id);

export interface JourneyView {
  def: JourneyDef;
  owned: boolean;
  rows: Array<{ objective: Objective; done: boolean; progress: PredProgress }>;
  complete: boolean;
}

/** The Quests screen's Journey block (shown while the Journey is owned). */
export function journeyView(pack: GamePack, state: GameState, view: GameView, id: string): JourneyView | null {
  const def = journeyDef(pack, id);
  if (!def) return null;
  const g = goenOf(state);
  const js = g.journeys[def.id];
  const ctx = { pack, view };
  return {
    def,
    owned: g.owned[def.itemId] !== undefined,
    rows: def.objectives.map((o) => {
      const done = js?.done[o.id] !== undefined;
      const p = predProgress(o.pred, state, ctx);
      return { objective: o, done, progress: done ? { done: p.total, total: p.total } : p };
    }),
    complete: !!js?.complete,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The Goen stage of the reducer
// ---------------------------------------------------------------------------------------------------------------

interface Out {
  s: GameState;
  derived: DerivedEvent[];
  effects: UiEffect[];
}

function earn(o: Out, reasonId: string, kind: GoenReason, amount: number, now: number, ref?: string): void {
  const r = earnGoen(o.s, reasonId, kind, amount, now, ref);
  o.s = r.state;
  if (r.paid > 0) {
    o.derived.push({ t: 'goen_changed', delta: r.paid, balance: o.s.goen.balance, reason: kind, ...(ref ? { ref } : {}) });
    o.effects.push({ t: 'toast', key: 'goen.toast.earned', vars: { n: r.paid, reason: kind } });
  }
}

const addUnique = (list: readonly string[], v: string): string[] => (list.includes(v) ? [...list] : [...list, v]);

function grantReward(o: Out, r: SeasonReward, reasonId: string, ctx: ReduceCtx): void {
  const day = dayKey(o.s.clock.dayIndex);
  switch (r.t) {
    case 'goen':
      earn(o, reasonId, 'season', r.n, ctx.now);
      break;
    case 'item':
      if (ctx.pack.items.some((i) => i.id === r.id)) {
        o.s = grantItem(o.s, ctx.pack, r.id, 1, day);
        o.derived.push({ t: 'unlocked', what: 'item', id: r.id });
      }
      break;
    case 'keepsake':
      o.s = { ...o.s, keepsakes: addUnique(o.s.keepsakes, r.id) };
      break;
    case 'sticker':
      if (!o.s.stickers.includes(r.id)) {
        o.s = { ...o.s, stickers: [...o.s.stickers, r.id] };
        o.derived.push({ t: 'sticker_earned', id: r.id });
      }
      break;
    case 'title':
      if (!o.s.titles.includes(r.id)) {
        o.s = { ...o.s, titles: [...o.s.titles, r.id] };
        o.derived.push({ t: 'title_earned', id: r.id });
      }
      break;
  }
}

/** What one effective event adds to each task's count (the season's own counters; nothing is read from lifetime totals). */
function seasonBumps(def: SeasonDef, ev: InputEvent, derived: DerivedEvent[], season: GoenSeasonState): { counts: Record<string, number>; words: string[] } {
  const counts = { ...season.counts };
  let words = season.words;
  const bump = (task: SeasonTask, n: number): void => {
    if (n > 0) counts[task.id] = Math.min(task.target, (counts[task.id] ?? 0) + n);
  };
  for (const task of def.tasks) {
    switch (ev.t) {
      case 'conversation_done': {
        const f = ev.facts;
        if (f.abandoned) break;
        const complete = f.goalTotal > 0 && f.goalDone >= f.goalTotal;
        const own = f.turns.filter((t) => t.substantive && t.cls === 'I');
        if (task.counter === 'own_lines') bump(task, own.length);
        if (task.counter === 'real' && f.mode === 'real' && complete) bump(task, 1);
        if (task.counter === 'scenario' && complete && task.ids?.includes(f.scenarioId)) bump(task, 1);
        if (task.counter === 'conv_stars') {
          const settled = derived.find((d): d is Extract<DerivedEvent, { t: 'loop_settled' }> => d.t === 'loop_settled' && d.sessionId === f.sessionId);
          if (settled && settled.settlement.stars >= (task.min ?? 2)) bump(task, 1);
        }
        if (task.counter === 'season_words') {
          for (const t of own) if (!t.copied) for (const w of t.words ?? []) if (def.words.includes(w)) words = addUnique(words, w);
          counts[task.id] = Math.min(task.target, words.length);
        }
        break;
      }
      case 'purchase':
        if (task.counter === 'buy' && task.ids?.includes(ev.itemId)) bump(task, 1);
        break;
      case 'omikuji_drawn':
        if (task.counter === 'omikuji') bump(task, 1);
        break;
      case 'gift_given':
        if (task.counter === 'gift' && !ev.assistedHandover && !ev.bare) bump(task, 1);
        break;
      case 'shift_done':
        if (task.counter === 'shift' && derived.some((d) => d.t === 'shift_settled' && d.score.good)) bump(task, 1);
        break;
      default:
        break;
    }
  }
  return { counts, words };
}

function seasonStage(o: Out, ev: InputEvent | null, derived: DerivedEvent[], ctx: ReduceCtx): void {
  const open = activeSeason(ctx.pack, ctx.now);
  let g = o.s.goen;
  // a new window starts the count from zero; a closed one keeps what it reached (nothing is lost)
  if (open && g.season.key !== open.key) {
    g = { ...g, season: emptySeason(open.key) };
    o.s = { ...o.s, goen: g };
  }
  const def = seasonDefOf(ctx.pack, g.season.key);
  if (!def) return;
  const day = dayKey(o.s.clock.dayIndex);
  if (open && ev) {
    const b = seasonBumps(def, ev, derived, g.season);
    let season: GoenSeasonState = { ...g.season, counts: b.counts, words: b.words };
    for (const task of def.tasks) {
      if (season.done[task.id] !== undefined || (season.counts[task.id] ?? 0) < task.target) continue;
      season = { ...season, done: { ...season.done, [task.id]: day }, sp: season.sp + Math.max(0, task.sp) };
      o.derived.push({ t: 'season_task_done', season: def.id, task: task.id });
      o.effects.push({ t: 'toast', key: 'goen.toast.task', vars: { task: task.id } });
    }
    o.s = { ...o.s, goen: { ...o.s.goen, season } };
  }
  // tiers: each reward once; the premium track from the moment the premium item is owned (tiers reached before are granted then)
  const premium = o.s.goen.owned[def.premiumItem] !== undefined;
  for (const tier of [...def.tiers].sort((a, b) => a.n - b.n)) {
    if (o.s.goen.season.sp < tier.sp) break;
    for (const track of ['free', 'premium'] as const) {
      const slot = `${track}:${tier.n}`;
      if (o.s.goen.season.tiers[slot] !== undefined || (track === 'premium' && !premium)) continue;
      const key = o.s.goen.season.key!;
      o.s = { ...o.s, goen: { ...o.s.goen, season: { ...o.s.goen.season, tiers: { ...o.s.goen.season.tiers, [slot]: day } } } };
      tier[track].forEach((r, i) => grantReward(o, r, `${GOEN_IDS.season(key, tier.n)}${track === 'premium' ? ':p' : ''}${i > 0 ? `:${i}` : ''}`, ctx));
      o.derived.push({ t: 'season_tier', season: def.id, tier: tier.n, track });
      o.effects.push({ t: 'toast', key: 'goen.toast.tier', vars: { tier: tier.n } });
    }
  }
}

function journeyStage(o: Out, ctx: ReduceCtx): void {
  const day = dayKey(o.s.clock.dayIndex);
  for (const def of ctx.pack.goen?.journeys ?? []) {
    if (o.s.goen.owned[def.itemId] === undefined) continue;
    const prev: GoenJourneyState = o.s.goen.journeys[def.id] ?? { done: {}, complete: null };
    if (prev.complete) continue;
    let done = prev.done;
    for (const obj of def.objectives) {
      if (done[obj.id] !== undefined || !evalPred(obj.pred, o.s, ctx)) continue;
      done = { ...done, [obj.id]: day };
      o.derived.push({ t: 'journey_objective_done', journey: def.id, id: obj.id });
    }
    const complete = def.objectives.length > 0 && def.objectives.every((x) => done[x.id] !== undefined) ? day : null;
    if (done === prev.done && !complete) continue;
    o.s = { ...o.s, goen: { ...o.s.goen, journeys: { ...o.s.goen.journeys, [def.id]: { done, complete } } } };
    if (!complete) continue;
    earn(o, GOEN_IDS.journey(def.id), 'journey', def.reward.goen, ctx.now, def.id);
    if (def.reward.keepsake) o.s = { ...o.s, keepsakes: addUnique(o.s.keepsakes, def.reward.keepsake) };
    if (def.reward.title && !o.s.titles.includes(def.reward.title)) {
      o.s = { ...o.s, titles: [...o.s.titles, def.reward.title] };
      o.derived.push({ t: 'title_earned', id: def.reward.title });
    }
    o.derived.push({ t: 'journey_done', journey: def.id });
    o.effects.push({ t: 'toast', key: 'goen.toast.journeyDone', vars: { n: def.reward.goen } }, { t: 'fanfare', kind: 'dream' });
  }
}

/** The speaking streak (the v1 store's, `view.streakDays`): +BALANCE.goen.streak each time it reaches a multiple of 7, once per multiple per run. */
function streakStage(o: Out, view: GameView, now: number): void {
  const d = Math.max(0, Math.trunc(view.streakDays));
  const every = BALANCE.goen.streakEvery;
  const g = o.s.goen;
  // after a migration the first observation only records where the streak is (no retroactive grant)
  if (g.streak.last < 0) {
    o.s = { ...o.s, goen: { ...g, streak: { last: d, paid: d - (d % every) } } };
    return;
  }
  // the streak broke and started again: its multiples pay again
  const paid = d < g.streak.last ? 0 : g.streak.paid;
  let streak = { last: d, paid };
  if (d > 0 && d % every === 0 && d > paid) {
    o.s = { ...o.s, goen: { ...o.s.goen, streak } };
    earn(o, GOEN_IDS.streak(o.s.clock.dayIndex, d), 'streak', BALANCE.goen.streak, now);
    streak = { last: d, paid: d };
  }
  if (streak.last !== g.streak.last || streak.paid !== g.streak.paid) o.s = { ...o.s, goen: { ...o.s.goen, streak } };
}

/**
 * The Goen stage (after objectives and daily): pays the earn rules from what this event and the earlier stages did (a chapter completed, the
 * day's goals all done, the streak, the capstone speech, the Letter), counts the open season's tasks and grants its tiers, and ticks the owned
 * Journeys. `ev` is null for a duplicate or refused event (it counts nothing). A pack without Goen changes nothing. Idempotent: a second call
 * with the same inputs adds nothing.
 */
export function updateGoen(state: GameState, ev: InputEvent | null, derived: DerivedEvent[], ctx: ReduceCtx): ReduceResult {
  if (!ctx.pack.goen) return { state, derived: [], effects: [] };
  const o: Out = { s: state.goen ? state : { ...state, goen: emptyGoen() }, derived: [], effects: [] };
  const { now, pack, view } = ctx;
  const G = BALANCE.goen;
  // a chapter completed (once each)
  for (const d of derived) if (d.t === 'chapter_done' && d.n >= 1 && d.n <= BALANCE.chapters) earn(o, GOEN_IDS.chapter(d.n), 'chapter', G.chapter, now, `ch${d.n}`);
  // every daily goal of today's trio done (once a play day)
  const daily = o.s.daily;
  if (daily.day === o.s.clock.dayIndex && daily.goals.length > 0 && daily.goals.every((x) => x.done)) earn(o, GOEN_IDS.daily(daily.day), 'daily', G.daily, now);
  streakStage(o, view, now);
  // the capstone speech in Real mode with BALANCE.goen.capstoneOwn own lines (once)
  if (ev?.t === 'conversation_done' && !ev.facts.abandoned && ev.facts.mode === 'real' && pack.scenarioMeta.some((m) => m.id === ev.facts.scenarioId && m.capstone)) {
    const own = ev.facts.turns.filter((t) => t.substantive && t.cls === 'I').length;
    if (own >= G.capstoneOwn) earn(o, GOEN_IDS.capstone, 'capstone', G.capstone, now, ev.facts.scenarioId);
  }
  // the Letter Home written (the game's own `letter_written` flag, once)
  if (o.s.chapter.flags.includes('letter_written')) earn(o, GOEN_IDS.letter, 'letter', G.letter, now);
  seasonStage(o, ev, derived, ctx);
  journeyStage(o, ctx);
  return { state: o.s, derived: o.derived, effects: o.effects };
}

// ---------------------------------------------------------------------------------------------------------------
// Persistence (`migrate`)
// ---------------------------------------------------------------------------------------------------------------

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const rec = (v: unknown): Rec => (isRec(v) ? v : {});
const int = (v: unknown, def: number, min: number, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : def;
const strMap = (v: unknown): Record<string, string> => Object.fromEntries(Object.entries(rec(v)).filter((e): e is [string, string] => typeof e[1] === 'string'));
const strs = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []).slice(-max);
const REASONS: readonly GoenReason[] = ['chapter', 'daily', 'streak', 'capstone', 'letter', 'season', 'journey', 'spend'];
const FORTUNES: readonly string[] = ['daikichi', 'kichi', 'shokichi'];

/**
 * A saved Goen value, repaired: shapes fixed, ids kept, the balance re-derived from the totals when they disagree (the checksum), charms in
 * 0..2. `undefined` (a save from before Goen) gives the empty state; the one-time grant for chapters already completed is `grantOldChapters`.
 */
export function cleanGoen(v: unknown): GoenState {
  if (!isRec(v)) return { ...emptyGoen(), streak: { last: -1, paid: 0 } };
  const t = rec(v.totals);
  const totals = { earned: int(t.earned, 0, 0), spent: int(t.spent, 0, 0) };
  const ledger: GoenEntry[] = (Array.isArray(v.ledger) ? v.ledger : [])
    .map(rec)
    .filter((e) => typeof e.id === 'string' && typeof e.delta === 'number' && Number.isFinite(e.delta))
    .map((e) => ({
      id: e.id as string,
      at: int(e.at, 0, 0),
      delta: Math.trunc(e.delta as number),
      kind: REASONS.includes(e.kind as GoenReason) ? (e.kind as GoenReason) : 'spend',
      ...(typeof e.ref === 'string' ? { ref: e.ref } : {}),
    }))
    .slice(-BALANCE.goen.ledger);
  const earned: Record<string, true> = {};
  for (const [k, x] of Object.entries(rec(v.earned))) if (x === true) earned[k] = true;
  const st = rec(v.streak);
  const s = rec(v.season);
  const om = rec(v.omikuji);
  const journeys: Record<string, GoenJourneyState> = {};
  for (const [k, x] of Object.entries(rec(v.journeys))) {
    const j = rec(x);
    journeys[k] = { done: strMap(j.done), complete: typeof j.complete === 'string' ? j.complete : null };
  }
  const counts: Record<string, number> = {};
  for (const [k, x] of Object.entries(rec(s.counts))) if (typeof x === 'number' && Number.isFinite(x)) counts[k] = Math.max(0, Math.trunc(x));
  return {
    v: 1,
    // the checksum: a balance that does not equal earned - spent is the hand edit, the totals are the ledger's running sums
    balance: Math.max(0, totals.earned - totals.spent),
    earned,
    ledger,
    totals: totals.earned >= totals.spent ? totals : { earned: totals.earned, spent: totals.earned },
    owned: strMap(v.owned),
    charms: int(v.charms, 0, 0, BALANCE.goen.charmsMax),
    charmDays: strs(v.charmDays, 10).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    streak: { last: int(st.last, -1, -1), paid: int(st.paid, 0, 0) },
    omikuji: typeof om.day === 'number' && FORTUNES.includes(om.fortune as string) ? { day: int(om.day, 0, 0), fortune: om.fortune as OmikujiFortune['id'], word: typeof om.word === 'string' ? om.word : null } : null,
    season: {
      key: typeof s.key === 'string' ? s.key : null,
      sp: int(s.sp, 0, 0),
      counts,
      words: strs(s.words, 200),
      done: strMap(s.done),
      tiers: strMap(s.tiers),
    },
    journeys,
  };
}

/**
 * A save from before Goen: chapters it already completed grant their +25 once, now (so existing players are not penalised), and what it
 * already did today or before is filed as earned without pay (no other retroactive grants: the Letter, today's goals). Ids are the ordinary
 * ones, so the reducer never pays a chapter twice.
 */
export function grantOldChapters(state: GameState, now: number): GameState {
  let s = state;
  for (const n of s.chapter.completed) if (n >= 1 && n <= BALANCE.chapters) s = earnGoen(s, GOEN_IDS.chapter(n), 'chapter', BALANCE.goen.chapter, now, `ch${n}`).state;
  if (s.chapter.flags.includes('letter_written')) s = earnGoen(s, GOEN_IDS.letter, 'letter', 0, now).state;
  const daily = s.daily;
  if (daily.goals.length > 0 && daily.goals.every((x) => x.done)) s = earnGoen(s, GOEN_IDS.daily(daily.day), 'daily', 0, now).state;
  return s;
}
