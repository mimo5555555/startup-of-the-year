// Friends, small talk and gifts as the app sees them (agent 4A; docs/GAME_DESIGN.md §8). Pure on its inputs, so a test can drive it
// without a screen: the Friends screen reads `friendRows` / `giftChoices` / `unlockLines`; the conversation host asks `planFriendConvo`
// for the flags, variables and entry node a small-talk or gift conversation needs and files the result with `completeFriendFacts` /
// `giftEventOf`; the bridge asks `pendingHeartBeats` which heart beats are waiting to be played.
//
// The host contract is the one written at the top of `content/src/tokyo/scenarios-social.ts`:
//   small talk  startNode `g_<topic>`, facts.topic, flags `casual`, `cb_<key>` (+ `cbc_<key>`), `rev_<factId>` (+ `revc_<factId>`)
//   gift        flags `gift_<reaction>` (+ `giftc_`), `dl_<id>` (+ `dlc_`), var `gift`, intents give_item / give_food / give_bare
import { slotOption, type Vars } from '@lw/content';
import {
  BALANCE,
  emptyFriend,
  friendActions,
  giftInfo,
  hasFeature,
  heartUnlocks,
  heartsForAp,
  ownedQty,
  pocketReady,
  reactionFor,
  type ConversationFacts,
  type FriendActions,
  type FriendDef,
  type FriendState,
  type GamePack,
  type GameState,
  type GameView,
  type GiftReaction,
  type InputEvent,
  type NameGloss,
} from '@lw/game';

// ---------------------------------------------------------------------------------------------------------------
// Constants of the small-talk picker (BALANCE has no key for them; they are design numbers of §8.3a)
// ---------------------------------------------------------------------------------------------------------------

/** a topic is not offered again within this many days (§8.3a) */
export const TOPIC_NO_REPEAT_DAYS = 5;
/** the callbacks the greeting can quote: the remembered fact (FriendState.facts key) -> the flag suffix of the scenario (§8.4) */
export const CALLBACK_KEYS: Record<string, string> = { hobby: 'hobby', favFood: 'food', 'purchase:phone': 'phone', dream: 'dream' };
/** a callback is quoted from this heart on (§8.3a: "at ♥2+ a callback may appear") */
export const CALLBACK_MIN_HEART = 2;
/** picker weights: a friend-specific topic, a shared topic that matches one of the friend's interests, any other shared topic */
const WEIGHT = { specific: 3, interest: 2, other: 1 } as const;
/** which character interests make a shared topic more likely (content/characters.ts `interests`) */
const TOPIC_INTERESTS: Record<string, string[]> = {
  food: ['food'],
  music: ['music'],
  anime: ['anime'],
  games: ['gaming', 'tech'],
  travel: ['travel'],
  study: ['books', 'culture'],
  sports: ['sports'],
  fashion: ['fashion'],
};
/** the friends whose gift humour line (give_gift `dl_<id>`) exists, and what makes it fit: Yuki's line is about coffee, Tanaka's about his shelf food */
const HUMOUR: Record<string, (itemId: string, pack: GamePack) => boolean> = {
  tanaka: () => true,
  yuki: (itemId, pack) => tagsOf(pack, itemId).includes('coffee'),
};
const SMALLTALK = 'smalltalk_';
const GIVE_GIFT = 'give_gift';
const GIVE_INTENTS = ['give_item', 'give_food', 'give_bare'];

const defOf = (pack: GamePack, id: string): FriendDef | undefined => pack.friends.find((f) => f.id === id);
const tagsOf = (pack: GamePack, itemId: string): string[] => giftInfo(pack, itemId)?.tags ?? [];

const friendOf = (state: GameState, id: string): FriendState => state.friends[id] ?? emptyFriend(state.clock.dayIndex);

export const heartsOfFriend = (state: GameState, id: string): number => heartsForAp(state.friends[id]?.ap ?? 0);

/** Whether the friend speaks plain form to the player now: the heart where they switch, or the `casual` flag Mio's beat sets (§8.1). */
export function isCasual(pack: GamePack, state: GameState, friendId: string): boolean {
  const def = defOf(pack, friendId);
  if (!def) return false;
  return heartsOfFriend(state, friendId) >= def.casualAt || friendOf(state, friendId).flags.includes('casual');
}

// ---------------------------------------------------------------------------------------------------------------
// Small talk: topic, profile fact, callback
// ---------------------------------------------------------------------------------------------------------------

/** The topic ids a small-talk scenario can start at (its `g_<topic>` nodes). */
export const topicsOf = (nodeIds: string[]): string[] => nodeIds.filter((n) => n.startsWith('g_')).map((n) => n.slice(2));

/**
 * The topic of today's small talk (§8.3a): not one used in the last TOPIC_NO_REPEAT_DAYS days (all of them used: the one used longest
 * ago), friend-specific topics and topics of the friend's interests likelier. Deterministic in `rng`. `specific` are the ids that only
 * this friend raises (their `<friend>_<what>` ids).
 */
export function pickTopic(topics: string[], f: FriendState, day: number, interests: string[], friendId: string, rng: () => number): string | undefined {
  if (!topics.length) return undefined;
  const age = (t: string): number => day - (f.topicDay[t] ?? Number.NEGATIVE_INFINITY);
  let pool = topics.filter((t) => age(t) >= TOPIC_NO_REPEAT_DAYS);
  if (!pool.length) {
    const oldest = Math.max(...topics.map(age));
    pool = topics.filter((t) => age(t) === oldest);
  }
  const weight = (t: string): number =>
    t.startsWith(`${friendId}_`) ? WEIGHT.specific : (TOPIC_INTERESTS[t] ?? []).some((i) => interests.includes(i)) ? WEIGHT.interest : WEIGHT.other;
  const total = pool.reduce((s, t) => s + weight(t), 0);
  let r = rng() * total;
  for (const t of pool) {
    r -= weight(t);
    if (r < 0) return t;
  }
  return pool[pool.length - 1];
}

/** The profile fact the follow node reveals: the first one the friend has reached the heart for and the player has not learned. */
export function dueFact(def: FriendDef, f: FriendState, hearts: number): string | undefined {
  return def.facts.find((id, i) => i + 1 <= hearts && !f.learned.includes(id));
}

/** The remembered fact the greeting quotes (the one never quoted, else the quoted longest ago; none quoted today), with its variable. */
export function pickCallback(f: FriendState, day: number, hearts: number): { fact: string; key: string; vars: Vars } | undefined {
  if (hearts < CALLBACK_MIN_HEART) return undefined;
  const options = Object.keys(CALLBACK_KEYS)
    .filter((k) => f.facts[k] !== undefined && f.callbacks[k] !== day)
    .sort((a, b) => (f.callbacks[a] ?? -1) - (f.callbacks[b] ?? -1) || (a < b ? -1 : 1));
  for (const fact of options) {
    const key = CALLBACK_KEYS[fact]!;
    const value = f.facts[fact]!;
    // {hobby} and {food} come from the slot the learner chose; the other two lines need no variable
    if (key === 'hobby' || key === 'food') {
      const opt = slotOption(key === 'hobby' ? 'hobby' : 'chatfood', value);
      if (!opt) continue;
      return { fact, key, vars: { [key]: { ja: opt.ja, gloss: opt.gloss } } };
    }
    return { fact, key, vars: {} };
  }
  return undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Gifts: what can be handed over, how it is named
// ---------------------------------------------------------------------------------------------------------------

/** The slot option that names an item in the hand-over (`giftItem` for catalog presents, `giftFood` for food and drink), or undefined when the hand-over cannot name it. */
export function handOverOption(pack: GamePack, itemId: string): { id: string; ja: string; gloss: { en: string; ar: string } } | undefined {
  for (const m of pack.scenarioMeta) {
    for (const [option, id] of Object.entries(m.shop?.itemMap ?? {})) {
      if (id !== itemId) continue;
      const o = slotOption('giftItem', option) ?? slotOption('giftFood', option);
      if (o) return { id: o.id, ja: o.ja, gloss: o.gloss };
    }
  }
  return undefined;
}

export interface GiftChoice {
  itemId: string;
  name: NameGloss;
  qty: number;
  /** the shop that sells it, for the line under the name */
  shop?: string;
}

/** The things the player owns that a friend can be given and that the hand-over can name, in catalog order then menu order. */
export function giftChoices(pack: GamePack, state: GameState): GiftChoice[] {
  const out: GiftChoice[] = [];
  const add = (id: string, name: NameGloss, shop: string | undefined) => {
    const qty = ownedQty(state, id);
    if (qty > 0 && giftInfo(pack, id)?.giftable && handOverOption(pack, id)) out.push({ itemId: id, name, qty, shop });
  };
  for (const i of pack.items) add(i.id, i.name, i.shop);
  for (const m of pack.menu) add(m.id, m.name, m.shop);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// The conversation host
// ---------------------------------------------------------------------------------------------------------------

/** What the conversation host decided for a friend conversation, before it starts (see the contract at the top). */
export interface FriendPlan {
  friendId: string;
  kind: 'talk' | 'gift';
  casual: boolean;
  /** the entry node of a small talk (`g_<topic>`), absent for a gift and when the request named one */
  startNode?: string;
  topic?: string;
  flags: Record<string, boolean>;
  vars: Vars;
  /** the profile fact id the follow node reveals */
  reveal?: string;
  /** the remembered fact (FriendState.facts key) the greeting quotes */
  callback?: string;
  gift?: { itemId: string; reaction: GiftReaction };
}

export interface FriendRequest {
  scenarioId: string;
  characterId: string;
  startNode?: string;
  /** a gift hand-over: the item (ItemDef or menu id) handed over */
  itemId?: string;
}

/** The friend the scenario is a friend conversation with: `smalltalk_<id>` is with `<id>`, `give_gift` with the character of the request. Null for every other scenario. */
export function friendOfRequest(pack: GamePack, req: Pick<FriendRequest, 'scenarioId' | 'characterId'>): string | null {
  if (req.scenarioId === GIVE_GIFT) return defOf(pack, req.characterId) ? req.characterId : null;
  if (req.scenarioId.startsWith(SMALLTALK)) {
    const id = req.scenarioId.slice(SMALLTALK.length);
    return defOf(pack, id) ? id : null;
  }
  return null;
}

/**
 * The flags, variables and entry node of a small-talk or gift conversation. `nodeIds` are the nodes of the scenario (the topics are its
 * `g_<topic>` nodes); `interests` are the character's. Returns null for any other scenario, or a gift with no item the hand-over can name.
 */
export function planFriendConvo(
  pack: GamePack,
  state: GameState,
  req: FriendRequest,
  o: { nodeIds: string[]; interests: string[]; rng?: () => number },
): FriendPlan | null {
  const friendId = friendOfRequest(pack, req);
  const def = friendId ? defOf(pack, friendId) : undefined;
  if (!friendId || !def) return null;
  const f = friendOf(state, friendId);
  const hearts = heartsForAp(f.ap);
  const casual = isCasual(pack, state, friendId);
  const flags: Record<string, boolean> = casual ? { casual: true } : {};
  const vars: Vars = {};

  if (req.scenarioId === GIVE_GIFT) {
    const itemId = req.itemId;
    const option = itemId ? handOverOption(pack, itemId) : undefined;
    if (!itemId || !option) return null;
    const reaction = reactionFor(pack, friendId, itemId);
    flags[`gift_${reaction}`] = true;
    if (casual) flags[`giftc_${reaction}`] = true;
    if (reaction === 'disliked' && HUMOUR[friendId]?.(itemId, pack)) {
      flags[`dl_${friendId}`] = true;
      if (casual) flags[`dlc_${friendId}`] = true;
    }
    vars.gift = { ja: option.ja, gloss: option.gloss };
    return { friendId, kind: 'gift', casual, flags, vars, gift: { itemId, reaction } };
  }

  const rng = o.rng ?? Math.random;
  const day = state.clock.dayIndex;
  const topic = req.startNode?.startsWith('g_') ? req.startNode.slice(2) : pickTopic(topicsOf(o.nodeIds), f, day, o.interests, friendId, rng);
  const reveal = dueFact(def, f, hearts);
  const cb = pickCallback(f, day, hearts);
  if (reveal) {
    flags[`rev_${reveal}`] = true;
    if (casual) flags[`revc_${reveal}`] = true;
  }
  if (cb) {
    flags[`cb_${cb.key}`] = true;
    if (casual) flags[`cbc_${cb.key}`] = true;
    Object.assign(vars, cb.vars);
  }
  return {
    friendId,
    kind: 'talk',
    casual,
    ...(req.startNode || !topic ? {} : { startNode: `g_${topic}` }),
    ...(topic ? { topic } : {}),
    flags,
    vars,
    ...(reveal ? { reveal } : {}),
    ...(cb ? { callback: cb.fact } : {}),
  };
}

/**
 * Adds what the plan knows to the facts the engine built: the topic, the profile fact the follow node said (when the learner got to the
 * follow node: the `answer` step is done) and the callback the greeting quoted (when the learner's matched intent there was `cb`).
 */
export function completeFriendFacts(plan: FriendPlan, facts: ConversationFacts, stepsDone: Iterable<string>): ConversationFacts {
  if (plan.kind !== 'talk') return facts;
  const steps = new Set(stepsDone);
  const answeredCb = facts.turns.some((t) => t.intentId === 'cb' && t.substantive);
  return {
    ...facts,
    ...(plan.topic ? { topic: plan.topic } : {}),
    ...(plan.reveal && steps.has('answer') ? { revealed: [plan.reveal] } : {}),
    ...(plan.callback && answeredCb ? { callbacks: [plan.callback] } : {}),
  };
}

/**
 * The `gift_given` event of a finished hand-over, or null when nothing was handed over (the learner left before naming the gift): the
 * item stays in the bag. A hand-over that did not name the item is `bare`; one made with help (a tapped chip, the hint, a translation)
 * is assisted; both give half the affinity (§8.5).
 */
export function giftEventOf(plan: FriendPlan, facts: ConversationFacts): Extract<InputEvent, { t: 'gift_given' }> | null {
  if (plan.kind !== 'gift' || !plan.gift) return null;
  const give = facts.turns.find((t) => t.intentId && GIVE_INTENTS.includes(t.intentId));
  if (!give) return null;
  return {
    t: 'gift_given',
    friendId: plan.friendId,
    itemId: plan.gift.itemId,
    sessionId: facts.sessionId,
    assistedHandover: give.cls !== 'I' || give.hintOpened === true,
    ...(give.intentId === 'give_bare' ? { bare: true } : {}),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The Friends screen
// ---------------------------------------------------------------------------------------------------------------

export interface FriendRow {
  def: FriendDef;
  state: FriendState;
  hearts: number;
  ap: number;
  /** AP where the current heart began, and where the next one is (null at the last heart) */
  floor: number;
  next: number | null;
  actions: FriendActions;
  /** the friend has been talked to at least once */
  met: boolean;
  /** a heart beat waiting to be played */
  pending: Array<{ level: number; beat: string }>;
  talkedToday: boolean;
}

export function friendRows(pack: GamePack, state: GameState, view: GameView, beatKnown: (id: string) => boolean): FriendRow[] {
  const th = BALANCE.ap.thresholds;
  const day = state.clock.dayIndex;
  return pack.friends
    .filter((def) => state.chapter.n >= def.unlockChapter)
    .map((def) => {
      const s = friendOf(state, def.id);
      const hearts = heartsForAp(s.ap);
      return {
        def,
        state: s,
        hearts,
        ap: s.ap,
        floor: hearts > 0 ? th[hearts - 1]! : 0,
        next: th[hearts] ?? null,
        actions: friendActions(pack, state, view, def.id),
        met: s.met,
        pending: pendingHeartBeats(pack, state, beatKnown).filter((p) => p.friendId === def.id),
        talkedToday: s.talkDay === day || s.hangoutDay === day,
      };
    });
}

/** The heart beats that are due but not yet played: the friend has the heart, the event is not filed, and the pack has the beat. */
export function pendingHeartBeats(pack: GamePack, state: GameState, beatKnown: (id: string) => boolean): Array<{ friendId: string; level: number; beat: string }> {
  const out: Array<{ friendId: string; level: number; beat: string }> = [];
  for (const def of pack.friends) {
    const f = friendOf(state, def.id);
    const h = heartsForAp(f.ap);
    for (const e of def.events ?? []) if (e.beat && h >= e.heart && !f.events.includes(e.heart) && beatKnown(e.beat)) out.push({ friendId: def.id, level: e.heart, beat: e.beat });
  }
  return out;
}

/** The friend and heart a beat belongs to (the beat that plays on a `heart_event_ready`), if it is one. */
export function heartEventOfBeat(pack: GamePack, beatId: string): { friendId: string; level: number } | undefined {
  for (const def of pack.friends) {
    const e = def.events?.find((x) => x.beat === beatId);
    if (e) return { friendId: def.id, level: e.heart };
  }
  return undefined;
}

/** What one thing a heart unlocks reads like on the Friends tab (§8.6): a string key with its values, or the pack's own text for a perk. */
export type UnlockLine =
  | { kind: 'text'; key: 'name' | 'card' | 'smalltalk' | 'number' | 'chat' | 'casual' }
  | { kind: 'fact'; fact: string }
  | { kind: 'perk'; text: { en: string; ar: string } };

/**
 * "Next at ♥n: ..." (§8.6): what reaching `heart` gives, restricted to what Release 1 has built, so that nothing promised is missing
 * (docs/RELEASE_1.md: hang-outs, home visits, heart scenes and beats are deferred and never mentioned). Phone chat is mentioned only
 * when the pack has chat threads. Perks are listed with the pack's own text.
 */
export function unlockLines(pack: GamePack, def: FriendDef, heart: number): UnlockLine[] {
  const chatBuilt = pack.scenarioMeta.some((m) => m.kind === 'chat');
  const out: UnlockLine[] = [];
  for (const id of heartUnlocks(def, heart)) {
    if (id === 'name' || id === 'card' || id === 'smalltalk' || id === 'casual') out.push({ kind: 'text', key: id });
    else if (id === 'number') out.push({ kind: 'text', key: 'number' });
    else if (id === 'chat') chatBuilt && out.push({ kind: 'text', key: 'chat' });
    else if (id.startsWith('fact:')) out.push({ kind: 'fact', fact: id.slice(5) });
  }
  // the perks of the heart (the ♥3 present from the friend, the ♥4 and ♥5 perks), in the pack's words
  for (const p of def.perks) if (p.heart === heart) out.push({ kind: 'perk', text: p.text });
  return out;
}

/** Whether the Message button shows: only once the phone is owned (Messages switch on with it, D17). */
export const canMessage = (pack: GamePack, state: GameState): boolean => hasFeature(pack, state, 'phone');

/** Whether Talk starts at Prepare (a pocket the player has not made ready) or straight in (same rule as the world's Talk, §11.1). */
export function talkStartsAtPrepare(pack: GamePack, state: GameState, view: GameView, scenarioId: string): boolean {
  const lines = (pack.scenarioMeta.find((m) => m.id === scenarioId)?.pocket ?? []).filter((id) => pack.pockets[id]);
  return lines.length > 0 && !pocketReady(pack, state, view, scenarioId);
}

export const smalltalkOf = (friendId: string): string => `${SMALLTALK}${friendId}`;
