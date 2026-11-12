// Shopkeepers who know you (docs/ROADMAP.md, "better conversations"): a shop conversation played before opens with the regular's greeting
// (flag `regular`). The return visits take turns: the 2nd, 5th, 8th… the shopkeeper remembers what you bought last time and asks about it
// (flag `remembers`, var {last}: the slot option of that item, so it reads 「前回のメロンパン、どうでしたか？」); the 3rd, 6th… they make
// small talk (flag `talk_<topic>`, tokyo/smalltalk.ts; also the 2nd when there is nothing to remember): the news of the town (a place open
// to you that you have not tried), the park's festival, the weekend, or the season in Tokyo now, one after another over the visits;
// the 4th, 7th… the regular's greeting: a shopkeeper who does not know your name yet asks it once (flag `ask_name`), and greets you by it
// from then on (flag `named`; the game keeps who knows it in `GameState.named`). The last purchase is found in the ledger: the newest
// purchase of anything this conversation sells.
import { FESTIVAL, NEWS_TALK, SHOP_TALK, SLOTS, festivalOpen, scenarioById, seasonAt, topicsOf, weekendAt, type Vars } from '@lw/content';
import { evalPred, type GamePack, type GameState, type GameView, type ScenarioMeta } from '@lw/game';

export interface LastBought {
  itemId: string;
  slot: string;
  option: string;
}

/** The newest thing bought from this conversation's menu, as its slot option; null when none, or when several options sell the same item. */
export function lastBought(state: GameState, meta: ScenarioMeta | undefined): LastBought | null {
  const shop = meta?.shop;
  if (!shop) return null;
  const items = new Set(Object.values(shop.itemMap));
  for (let i = state.ledger.length - 1; i >= 0; i--) {
    const e = state.ledger[i]!;
    if (e.kind !== 'purchase' || !e.ref || !items.has(e.ref) || !e.id.startsWith('purchase:') || /:(pts|earn)$/.test(e.id)) continue;
    const options = Object.keys(shop.itemMap).filter((o) => shop.itemMap[o] === e.ref);
    if (options.length !== 1) return null;
    const option = options[0]!;
    const slot = [shop.itemSlot, ...(shop.extraSlots ?? [])].find((s) => s && SLOTS[s]?.some((o) => o.id === option));
    return slot ? { itemId: e.ref, slot, option } : null;
  }
  return null;
}

/** {last} for the shopkeeper's line: the option's Japanese and its gloss. */
export function lastVar(last: LastBought | null): Vars[string] | null {
  const opt = last ? SLOTS[last.slot]?.find((o) => o.id === last.option) : undefined;
  return opt ? { ja: opt.ja, gloss: opt.gloss } : null;
}

/** Whether a place of the town's news is open to the player: its shop is, and the conversation there is offered (chapter and gate). */
function placeOpen(pack: GamePack, state: GameState, place: { shop: string; scenario: string }, view: GameView | undefined): boolean {
  const shop = pack.shops.find((x) => x.id === place.shop);
  if (!shop || state.chapter.n < shop.openChapter) return false;
  const it = Object.values(pack.interactions)
    .flat()
    .find((x) => x.scenarioId === place.scenario);
  if (!it || state.chapter.n < (it.ch ?? 1)) return false;
  return !it.gate || (view !== undefined && evalPred(it.gate, state, { pack, view }));
}

/**
 * What a shopkeeper could make small talk about now, the most newsworthy first: a place open to the player that they have not tried yet
 * (never the shop's own), the park's festival (on today, or coming up from Chapter 7), the weekend (Friday to Monday in Tokyo), the season.
 */
export function talkTopics(pack: GamePack, state: GameState, meta: ScenarioMeta, nowMs: number, view?: GameView): string[] {
  const allowed = new Set(topicsOf(meta.id));
  const out: string[] = [];
  const news = Object.entries(NEWS_TALK).find(([id, n]) => allowed.has(id) && (state.runs[n.scenario]?.count ?? 0) === 0 && placeOpen(pack, state, n, view));
  if (news) out.push(news[0]);
  if (state.chapter.n >= FESTIVAL.chapter) out.push(festivalOpen(state) ? 'festival_today' : 'festival_soon');
  const weekend = weekendAt(nowMs);
  if (weekend) out.push(weekend);
  out.push(seasonAt(nowMs));
  return out;
}

/**
 * The flags a shop conversation starts with: `regular` from the second visit; then, in turn, `remembers` (when something was bought),
 * small talk (`talk_<topic>`: the topics of `talkTopics` one after another, a new one each round of visits), or the name (`ask_name`
 * until the shopkeeper knows it, `named` after).
 */
export function regularFlags(pack: GamePack, state: GameState, meta: ScenarioMeta | undefined, nowMs = Date.now(), view?: GameView): Record<string, boolean> {
  if (!meta || meta.kind !== 'shop') return {};
  const plays = state.runs[meta.id]?.count ?? 0;
  if (plays < 1) return {};
  const flags: Record<string, boolean> = { regular: true };
  const turn = plays % 3;
  const canRemember = !!lastVar(lastBought(state, meta));
  if (turn === 1 && canRemember) flags.remembers = true;
  else if (turn === 1 || turn === 2) {
    const topics = talkTopics(pack, state, meta, nowMs, view);
    flags[`talk_${topics[Math.floor(plays / 3) % topics.length]}`] = true;
  } else if (SHOP_TALK[meta.id]) {
    // nothing else to say this visit: the name, asked once and used ever after
    const who = scenarioById(meta.id)?.characterId;
    if (who) flags[(state.named ?? []).includes(who) ? 'named' : 'ask_name'] = true;
  }
  return flags;
}
