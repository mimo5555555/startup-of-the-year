// Friends: hearts and affinity points, talks, gifts and their reactions (agent 1E).
import { BALANCE } from './balance';
import { emptyFriend } from './defaults';
import { consumeItem, giftInfo, grantItem, hasFeature, traitValue } from './inventory';
import { applyLedger, dayKey, LEDGER_IDS } from './ledger';
import { scaleAmount, walletLimits } from './money';
import type {
  ApResult,
  ConversationFacts,
  DerivedEvent,
  FriendActions,
  FriendDef,
  FriendState,
  GamePack,
  GameState,
  GameView,
  GiftReaction,
  GiftResult,
  InputEvent,
  ReduceCtx,
  StatsState,
  TalkKind,
  UiEffect,
} from './types';

/** hearts = number of BALANCE.ap.thresholds <= ap (0-5). AP never decreases. Implemented by the contract: the single derivation everyone calls. */
export function heartsForAp(ap: number): number {
  return BALANCE.ap.thresholds.filter((t) => ap >= t).length;
}

type Part = ApResult['parts'][number];

/** Phone-chat templates the queue knows by role (§8.7); every other `chat_*` scenario is a rotating generic thread. */
const CHAT = { first: 'chat_first', callback: 'chat_callback', plan: 'chat_plan', miss: 'chat_miss' } as const;
/** generic daily threads in rotation order, with what each needs: hearts, or an owned flat */
const GENERIC_CHATS: Array<{ id: string; minHeart?: number; flat?: true }> = [
  { id: 'chat_greet' },
  { id: 'chat_food' },
  { id: 'chat_voice', minHeart: 2 },
  { id: 'chat_teach', minHeart: 3 },
  { id: 'chat_invite_home', flat: true },
];
/** a rotating generic thread avoids the last this-many templates (§8.7); the queue remembers as many */
const CHAT_RECENT = 3;
/** the heart at which a friend's home opens (§8.6 ♥4; BALANCE has no key for it, only the hang-out's) */
const HOME_MIN_HEART = 4;
/** a remembered fact is a short word or phrase (a hobby, a food); anything longer is not stored */
const FACT_MAX_LEN = 40;

const defOf = (pack: GamePack, friendId: string): FriendDef | undefined => pack.friends.find((f) => f.id === friendId);
const today = (state: GameState): number => state.clock.dayIndex;

/** The friend's state with the per-day counters rolled to today (a stale `apDay` reads as zero AP earned). */
function friendNow(state: GameState, friendId: string): FriendState {
  const day = today(state);
  const f = state.friends[friendId] ?? emptyFriend(day);
  return f.apDay === day ? f : { ...f, apDay: day, apToday: 0, chatApToday: 0 };
}

/** Whether the player has talked or hung out with the friend today (a phone chat or a gift is not "a talk", §8.3). */
const talkedToday = (f: FriendState, day: number): boolean => f.talkDay === day || f.hangoutDay === day;

// ---------------------------------------------------------------------------------------------------------------
// Gift reactions and AP
// ---------------------------------------------------------------------------------------------------------------

/** loved / liked / neutral / disliked from the friend's `loves`, `likes` (tags) and `dislikes`; `itemId` is an ItemDef or MenuItem id, matched against list entries by id or by the menu item's bare `option` (types.ts conventions). */
export function reactionFor(pack: GamePack, friendId: string, itemId: string): GiftReaction {
  const def = defOf(pack, friendId);
  if (!def) return 'neutral';
  const menu = pack.menu.find((m) => m.id === itemId);
  const named = (list: string[]): boolean => list.includes(itemId) || (menu !== undefined && list.includes(menu.option));
  if (named(def.loves)) return 'loved';
  // an explicit dislike beats a liked tag: it is the more specific statement
  if (named(def.dislikes)) return 'disliked';
  const tags = giftInfo(pack, itemId)?.tags ?? [];
  return tags.some((t) => def.likes.includes(t)) ? 'liked' : 'neutral';
}

/** The gift AP cap at a heart level: min(30, round(0.4 x gap to the next heart)) = 12 / 20 / 28 / 30 / 30 at hearts 0..4 (§8.5); 0 at the last heart (no next heart to earn). */
export function giftCap(heart: number): number {
  const th = BALANCE.ap.thresholds;
  const h = Math.max(0, Math.trunc(heart));
  if (h >= th.length) return 0;
  const gap = th[h]! - (th[h - 1] ?? 0);
  return Math.min(BALANCE.ap.giftCapMax, Math.round(BALANCE.ap.giftCapFrac * gap));
}

/** tierAP of a price: the first BALANCE.ap.giftTiers row it is under (thresholds scale with the pack's income), else the top tier. */
function tierAp(pack: GamePack, price: number): number {
  for (const t of BALANCE.ap.giftTiers) if (price < scaleAmount(t.lt, pack.economy, pack.currency)) return t.ap;
  return BALANCE.ap.giftTierTop;
}

/** Gift AP before the 60/day cap: min(tier x taste, cap(heart)), then x0.5 bare / assisted, x0.5 with no talk today, x0.25 for a repeat within a week. */
function giftApOf(pack: GamePack, f: FriendState, day: number, itemId: string, reaction: GiftReaction, price: number, softened: boolean): number {
  const A = BALANCE.ap;
  let ap = Math.min(tierAp(pack, price) * A.giftTaste[reaction], giftCap(heartsForAp(f.ap)));
  if (softened) ap *= A.giftBare;
  if (!talkedToday(f, day)) ap *= A.giftNoTalk;
  if (f.giftHistory.some((h) => h.item === itemId && day - h.day < A.giftRepeat.days)) ap *= A.giftRepeat.mult;
  return Math.round(ap);
}

/** The AP a gift would give right now, before the 60/day cap: for the hand-over preview and the tests. 0 when it would be refused (not giftable, or one already given today). */
export function giftAp(pack: GamePack, state: GameState, friendId: string, itemId: string, assisted: boolean): number {
  const info = giftInfo(pack, itemId);
  if (!defOf(pack, friendId) || !info?.giftable) return 0;
  const f = friendNow(state, friendId);
  const day = today(state);
  if (f.giftDay === day) return 0;
  return giftApOf(pack, f, day, itemId, reactionFor(pack, friendId, itemId), info.price, assisted);
}

// ---------------------------------------------------------------------------------------------------------------
// Awarding AP (the one place AP is added: daily caps, hearts, heart events, perks)
// ---------------------------------------------------------------------------------------------------------------

/** Pays the one-time perks (`once_cash`, `once_item`) of the hearts just reached; a `once_discount` is spent at the till (pricing), the rest are standing perks. */
function grantHeartPerks(state: GameState, ctx: ReduceCtx, def: FriendDef, from: number, to: number, derived: DerivedEvent[]): GameState {
  let next = state;
  for (const perk of def.perks) {
    if (perk.heart <= from || perk.heart > to || next.stats.perksUsed.includes(perk.id)) continue;
    if (perk.fx.t === 'once_cash') {
      const r = applyLedger(next, { id: LEDGER_IDS.perk(perk.id), at: ctx.now, kind: 'perk', delta: perk.fx.amount, pocket: 'cash', ref: perk.id }, walletLimits(next, ctx.pack));
      next = r.state;
      if (r.applied) derived.push({ t: 'wallet_changed', delta: perk.fx.amount, balance: next.wallet.cash, kind: 'perk' });
    } else if (perk.fx.t === 'once_item') {
      next = grantItem(next, ctx.pack, perk.fx.itemId, perk.fx.qty ?? 1, dayKey(today(next)));
      derived.push({ t: 'unlocked', what: 'item', id: perk.fx.itemId });
    } else continue;
    next = { ...next, stats: { ...next.stats, perksUsed: [...next.stats.perksUsed, perk.id] } };
  }
  return next;
}

/**
 * Files an interaction: adds the parts through the caps (chat 8/day, then every source together 60/day), reveals facts, writes the
 * friend, and derives hearts. `parts` are reported as asked (before the caps); `ap` is what was added.
 */
function finish(
  state: GameState,
  ctx: ReduceCtx,
  def: FriendDef,
  f: FriendState,
  parts: Part[],
  o: { stats?: StatsState; revealed?: string[] } = {},
): ApResult {
  const A = BALANCE.ap;
  const day = today(state);
  const from = heartsForAp(f.ap);
  let room = Math.max(0, A.dailyCap - f.apToday);
  let chatRoom = Math.max(0, A.chat.dailyCap - f.chatApToday);
  let added = 0;
  let chatAdded = 0;
  for (const p of parts) {
    let a = Math.min(Math.max(0, Math.round(p.ap)), room);
    if (p.source === 'chat') {
      a = Math.min(a, chatRoom);
      chatRoom -= a;
      chatAdded += a;
    }
    room -= a;
    added += a;
  }
  const to = heartsForAp(f.ap + added);
  // a fact is revealed only for a heart the friend has reached, and only once
  const revealed = (o.revealed ?? []).filter((id) => {
    const i = def.facts.indexOf(id);
    return i >= 0 && i + 1 <= to && !f.learned.includes(id);
  });
  const nf: FriendState = {
    ...f,
    ap: f.ap + added,
    apToday: f.apToday + added,
    chatApToday: f.chatApToday + chatAdded,
    apDay: day,
    lastContactDay: day,
    learned: revealed.length ? [...f.learned, ...new Set(revealed)] : f.learned,
  };
  const derived: DerivedEvent[] = [];
  const effects: UiEffect[] = [];
  if (added > 0) derived.push({ t: 'ap_gained', friendId: def.id, ap: added, parts });
  let next: GameState = { ...state, friends: { ...state.friends, [def.id]: nf }, ...(o.stats ? { stats: o.stats } : {}) };
  if (to > from) {
    derived.push({ t: 'hearts_changed', friendId: def.id, from, to });
    for (let level = from + 1; level <= to; level++) {
      if (def.events?.some((e) => e.heart === level) && !nf.events.includes(level)) derived.push({ t: 'heart_event_ready', friendId: def.id, level });
    }
    effects.push({ t: 'fanfare', kind: 'heart' });
    next = grantHeartPerks(next, ctx, def, from, to, derived);
  }
  return { state: next, derived, effects, ap: added, parts, hearts: { from, to } };
}

// ---------------------------------------------------------------------------------------------------------------
// Talks, chats, hang-outs, heart events
// ---------------------------------------------------------------------------------------------------------------

/** independent / (independent + assisted) over the substantive turns; 0 when there were none (the same share `turnStats` reports). */
function shareOf(facts: ConversationFacts): number {
  let ind = 0;
  let ass = 0;
  for (const t of facts.turns) if (t.substantive) (t.cls === 'I' ? ind++ : ass++);
  return ind + ass > 0 ? ind / (ind + ass) : 0;
}

/** What the friend is told about the player: non-empty short strings only. */
function remember(f: FriendState, remembered: Record<string, string> | undefined): FriendState {
  const add: Record<string, string> = {};
  for (const [k, v] of Object.entries(remembered ?? {})) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s && s.length <= FACT_MAX_LEN) add[k] = s;
  }
  return Object.keys(add).length ? { ...f, facts: { ...f.facts, ...add } } : f;
}

/** The scenario's heart level (ScenarioMeta.heart), else the friend's current hearts. */
const heartLevelOf = (pack: GamePack, scenarioId: string, current: number): number => pack.scenarioMeta.find((m) => m.id === scenarioId)?.heart ?? current;

/**
 * Adds the AP of a finished talk, chat, hang-out, heart scene or home visit (§8.3): `met` +20 once, the talk formula with callbacks
 * inside its cap of 15, one counted talk per day, chat 4 (8/day), hang-out 25 or 10, the 60/day cap, remembered facts stored.
 * A talk with nothing substantive in it, an abandoned one, a chat before the friend's heart, or a hang-out inside its 3-day window
 * changes nothing. A home visit shares the hang-out's 3-day limit.
 */
export function applyTalk(state: GameState, friendId: string, facts: ConversationFacts, kind: TalkKind, ctx: ReduceCtx): ApResult {
  const { pack } = ctx;
  const A = BALANCE.ap;
  const day = today(state);
  const def = defOf(pack, friendId);
  const f0 = friendNow(state, friendId);
  const h0 = heartsForAp(f0.ap);
  const none: ApResult = { state, derived: [], effects: [], ap: 0, parts: [], hearts: { from: h0, to: h0 } };
  const substantive = facts.turns.filter((t) => t.substantive).length;
  if (!def || facts.abandoned || (facts.goalDone <= 0 && substantive === 0)) return none;

  const parts: Part[] = [];
  let f: FriendState = f0;
  let stats = state.stats;

  // callbacks: a remembered fact the friend quoted and the player answered, once per fact per day
  const callbacks = [...new Set(facts.callbacks ?? [])].filter((k) => k in f0.facts && f0.callbacks[k] !== day);
  if (callbacks.length) f = { ...f, callbacks: { ...f.callbacks, ...Object.fromEntries(callbacks.map((k) => [k, day])) } };

  if (kind === 'talk') {
    if (!f.met) {
      parts.push({ source: 'met', ap: A.met });
      f = { ...f, met: true };
    }
    if (f.talkDay !== day) {
      const T = A.talk;
      const steps = facts.goalTotal > 0 && facts.goalDone / facts.goalTotal >= T.stepFrac ? T.base : 0;
      const talk: Part[] = [
        { source: 'talk', ap: steps },
        { source: 'share', ap: Math.round(T.shareMax * shareOf(facts)) },
        { source: 'callback', ap: Math.min(T.callbackEach * callbacks.length, T.callbackMax) },
      ];
      // the talk's own cap (15) binds the last parts first
      let over = talk.reduce((s, p) => s + p.ap, 0) - T.cap;
      for (let i = talk.length - 1; i >= 0 && over > 0; i--) {
        const cut = Math.min(talk[i]!.ap, over);
        talk[i]!.ap -= cut;
        over -= cut;
      }
      parts.push(...talk.filter((p) => p.ap > 0));
      f = { ...f, talkDay: day };
    }
    if (facts.topic) f = { ...f, topicDay: { ...f.topicDay, [facts.topic]: day } };
  } else if (kind === 'chat') {
    if (h0 < A.chat.minHeart || (substantive < A.chat.minSubstantive && facts.goalDone < 1)) return none;
    const i = f.threads.findIndex((t) => t.template === facts.scenarioId);
    const threads = i >= 0 ? f.threads.filter((_, j) => j !== i) : f.threads;
    f = { ...f, threads, unread: threads.length };
    parts.push({ source: 'chat', ap: facts.scenarioId.startsWith(CHAT.miss) ? A.chat.missAp : A.chat.ap });
    stats = { ...stats, chats: { n: stats.chats.n + 1, friends: { ...stats.chats.friends, [friendId]: (stats.chats.friends[friendId] ?? 0) + 1 } } };
  } else if (kind === 'hangout' || kind === 'home') {
    if (kind === 'hangout' && h0 < A.hangout.minHeart) return none;
    if (f.hangoutDay !== undefined && day - f.hangoutDay < A.hangout.everyDays) return none;
    if (!f.met) {
      parts.push({ source: 'met', ap: A.met });
      f = { ...f, met: true };
    }
    // a placed kotatsu (hangout_mult) warms the friend's visit
    const base = kind === 'home' || shareOf(facts) >= A.hangout.shareMin ? A.hangout.good : A.hangout.low;
    parts.push({ source: 'hangout', ap: Math.round(base * (traitValue(pack, state, 'hangout_mult') ?? 1)) });
    f = { ...f, hangoutDay: day };
    if (kind === 'hangout') stats = { ...stats, hangouts: { ...stats.hangouts, [friendId]: (stats.hangouts[friendId] ?? 0) + 1 } };
  } else {
    // 'heart': a heart scene or beat, fixed +10 once per level, never above the friend's hearts
    const level = heartLevelOf(pack, facts.scenarioId, h0);
    if (level < 1 || level > h0 || f.events.includes(level)) return none;
    f = { ...f, events: [...f.events, level].sort((a, b) => a - b) };
    parts.push({ source: 'event', ap: A.event });
  }

  // "do you remember?": +3 once per profile fact, and the fact gets its gold frame
  const q = facts.quiz;
  if (q?.correct && f.learned.includes(q.fact) && !f.gold.includes(q.fact)) {
    parts.push({ source: 'quiz', ap: A.quiz });
    f = { ...f, gold: [...f.gold, q.fact] };
  }

  f = remember(f, facts.remembered);
  return finish(state, ctx, def, f, parts, { stats, revealed: facts.revealed });
}

/**
 * A heart event played outside a conversation (the `heart_event_done` event: a ♥2 note, a ♥4 beat): files the level once and
 * awards BALANCE.ap.event. A level above the friend's hearts, or already played, changes nothing.
 */
export function applyHeartEvent(state: GameState, friendId: string, level: number, ctx: ReduceCtx): ApResult {
  const def = defOf(ctx.pack, friendId);
  const f = friendNow(state, friendId);
  const h = heartsForAp(f.ap);
  if (!def || level < 1 || level > h || f.events.includes(level)) return { state, derived: [], effects: [], ap: 0, parts: [], hearts: { from: h, to: h } };
  return finish(state, ctx, def, { ...f, events: [...f.events, level].sort((a, b) => a - b) }, [{ source: 'event', ap: BALANCE.ap.event }]);
}

// ---------------------------------------------------------------------------------------------------------------
// Gifts
// ---------------------------------------------------------------------------------------------------------------

/**
 * A gift hand-over (§8.5): reaction, AP = min(tierAP x taste, giftCap) with the bare/no-talk/repeat factors, one AP gift per friend per day.
 * The item leaves the inventory. A gift that is not giftable, not owned, or a second one the same day changes nothing (the UI offers
 * neither: `friendActions`); the friend never refuses in person, the refusal is the player's own bookkeeping.
 */
export function applyGift(state: GameState, ev: Extract<InputEvent, { t: 'gift_given' }>, ctx: ReduceCtx): GiftResult {
  const { pack } = ctx;
  const day = today(state);
  const def = defOf(pack, ev.friendId);
  const f = friendNow(state, ev.friendId);
  const h = heartsForAp(f.ap);
  const reaction = reactionFor(pack, ev.friendId, ev.itemId);
  const info = giftInfo(pack, ev.itemId);
  const refused: GiftResult = { state, derived: [], effects: [], reaction, ap: 0, hearts: { from: h, to: h } };
  if (!def || !info?.giftable || f.giftDay === day) return refused;
  const taken = consumeItem(state, ev.itemId);
  if (!taken.ok) return refused;

  const ap = giftApOf(pack, f, day, ev.itemId, reaction, info.price, ev.assistedHandover || ev.bare === true);
  const liked = reaction === 'liked' || reaction === 'loved';
  const nf: FriendState = {
    ...f,
    giftDay: day,
    giftHistory: [...f.giftHistory, { item: ev.itemId, day }].filter((g) => day - g.day < BALANCE.ap.giftRepeat.days),
    gifts: f.gifts + 1,
    giftsLiked: f.giftsLiked + (liked ? 1 : 0),
    giftsLoved: f.giftsLoved + (reaction === 'loved' ? 1 : 0),
  };
  const stats: StatsState = {
    ...taken.state.stats,
    gifts: { n: taken.state.stats.gifts.n + 1, liked: taken.state.stats.gifts.liked + (liked ? 1 : 0), loved: taken.state.stats.gifts.loved + (reaction === 'loved' ? 1 : 0) },
  };
  // the gift's AP is reported by `gift_reacted` (it is not one of the talk sources of `ap_gained`), so its part only runs the caps
  const r = finish(taken.state, ctx, def, nf, ap > 0 ? [{ source: 'talk', ap }] : [], { stats });
  const derived: DerivedEvent[] = r.derived.filter((d) => d.t !== 'ap_gained');
  derived.push({ t: 'gift_reacted', friendId: ev.friendId, itemId: ev.itemId, reaction, ap: r.ap });
  return { state: r.state, derived, effects: r.effects, reaction, ap: r.ap, hearts: r.hearts };
}

// ---------------------------------------------------------------------------------------------------------------
// What the player can do, what the friend unlocks
// ---------------------------------------------------------------------------------------------------------------

/** The friend has appeared in the world: their unlock chapter is current. */
export function friendUnlocked(pack: GamePack, state: GameState, friendId: string): boolean {
  const def = defOf(pack, friendId);
  return !!def && state.chapter.n >= def.unlockChapter;
}

/** What the player can do with a friend now: talk, gift (daily limit), phone chat (phone, hearts >= 2, a waiting thread), hang-out (hearts >= 3, 1 per 3 days, a hang-out scenario exists), home (hearts >= 4, the friend has a home). */
export function friendActions(pack: GamePack, state: GameState, _view: GameView, friendId: string): FriendActions {
  const def = defOf(pack, friendId);
  const f = friendNow(state, friendId);
  const day = today(state);
  const h = heartsForAp(f.ap);
  const A = BALANCE.ap;
  const unlocked = !!def && friendUnlocked(pack, state, friendId);
  const giftedToday = f.giftDay === day;
  const giftNotes: FriendActions['giftNotes'] = [];
  if (giftedToday) giftNotes.push('daily');
  if (!talkedToday(f, day)) giftNotes.push('noTalk');
  if (f.apToday >= A.dailyCap || h >= A.thresholds.length) giftNotes.push('capped');
  return {
    talk: unlocked,
    gift: unlocked && !giftedToday,
    chat: unlocked && hasFeature(pack, state, 'phone') && h >= A.chat.minHeart && f.threads.length > 0,
    hangout: unlocked && h >= A.hangout.minHeart && (f.hangoutDay === undefined || day - f.hangoutDay >= A.hangout.everyDays) && pack.scenarioMeta.some((m) => m.kind === 'hangout' && m.friendId === friendId),
    home: unlocked && h >= HOME_MIN_HEART && !!def?.home,
    giftNotes,
  };
}

/** Ids of what a heart level unlocks for a friend (§8.6), for the Friends tab's "Next at ♥n: ..."; the app maps each id to its text. */
export function heartUnlocks(def: FriendDef, heart: number): string[] {
  const out: string[] = [];
  if (heart === 1) out.push('name', 'card', 'smalltalk');
  if (heart === 2) out.push('number', 'chat');
  if (heart === 3) out.push('hangout', 'gift_from_friend');
  if (heart === 4) out.push(def.home ? 'home_visit' : 'heart_to_heart', 'perk_small');
  if (heart === 5) out.push(def.home ? 'scene' : 'beat', 'keepsake', 'title', 'perk');
  if (heart >= 1 && heart <= 3) out.push(`fact:${def.facts[heart - 1]}`);
  if (def.casualAt === heart) out.push('casual');
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Phone threads
// ---------------------------------------------------------------------------------------------------------------

/** The remembered fact a callback quotes next: the one never quoted, else the longest ago; null without facts or when all were quoted today. */
export function nextCallbackFact(f: FriendState, day: number): string | null {
  const keys = Object.keys(f.facts).filter((k) => f.callbacks[k] !== day);
  keys.sort((a, b) => (f.callbacks[a] ?? -1) - (f.callbacks[b] ?? -1) || (a < b ? -1 : 1));
  return keys[0] ?? null;
}

/**
 * Run once after a rollover (and when the phone is first owned): queues at most one new phone thread per friend (BALANCE.ap.chat
 * threadsPerDay) who has >= BALANCE.ap.chat.minHeart hearts, while the player owns a phone and fewer than `unreadMax` are waiting.
 * Template priority (§8.7): the pending story message `chat_first`, a callback to a remembered fact, the friend's plan, then a
 * rotating generic thread that avoids `chatRecent`; away >= BALANCE.ap.chat.missDays days queues `chat_miss`. Deterministic in `rng`.
 * Only templates the pack has as `chat` scenarios are queued. `chat_miss` goes first (it is the thread for someone who was away),
 * `chat_first` waits one day behind it.
 */
export function queueThreads(pack: GamePack, state: GameState, _view: GameView, rng: () => number): GameState {
  if (!hasFeature(pack, state, 'phone')) return state;
  const A = BALANCE.ap.chat;
  const day = today(state);
  const have = new Set(pack.scenarioMeta.filter((m) => m.kind === 'chat').map((m) => m.id));
  const flat = state.home.tier === 'ono';
  let friends = state.friends;
  for (const def of pack.friends) {
    const f = friendNow(state, def.id);
    const h = heartsForAp(f.ap);
    if (!(def.id in state.friends) || h < A.minHeart || f.unread >= A.unreadMax) continue;
    const queuedToday = f.chatDay === day ? Math.max(1, f.threads.filter((t) => t.day === day).length) : 0;
    if (queuedToday >= A.threadsPerDay) continue;

    const recent = f.chatRecent;
    const fresh = (id: string) => have.has(id) && !recent.includes(id) && !f.threads.some((t) => t.template === id);
    const away = f.lastContactDay !== undefined && day - f.lastContactDay >= A.missDays;
    let pick: string | undefined;
    if (away && fresh(CHAT.miss)) pick = CHAT.miss;
    else if (have.has(CHAT.first) && !f.flags.includes(CHAT.first)) pick = CHAT.first;
    else if (fresh(CHAT.callback) && nextCallbackFact(f, day) !== null) pick = CHAT.callback;
    else if (fresh(CHAT.plan)) pick = CHAT.plan;
    else {
      const open = GENERIC_CHATS.filter((g) => have.has(g.id) && h >= (g.minHeart ?? 0) && (!g.flat || flat) && !f.threads.some((t) => t.template === g.id));
      const pool = open.filter((g) => !recent.includes(g.id));
      // every one was used lately: the one used longest ago
      const choice = pool.length ? pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] : [...open].sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id))[0];
      pick = choice?.id;
    }
    if (!pick) continue;
    const threads = [...f.threads, { template: pick, day }];
    friends = {
      ...friends,
      [def.id]: {
        ...f,
        threads,
        unread: threads.length,
        chatDay: day,
        chatRecent: [...recent, pick].slice(-CHAT_RECENT),
        flags: pick === CHAT.first ? [...f.flags, CHAT.first] : f.flags,
      },
    };
  }
  return friends === state.friends ? state : { ...state, friends };
}
