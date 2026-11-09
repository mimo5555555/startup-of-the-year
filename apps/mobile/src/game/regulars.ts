// Shopkeepers who know you (docs/ROADMAP.md, "better conversations"): a shop conversation played before opens with the regular's greeting
// (flag `regular`). The return visits take turns: the 2nd, 5th, 8th… the shopkeeper remembers what you bought last time and asks about it
// (flag `remembers`, var {last}: the slot option of that item, so it reads 「前回のメロンパン、どうでしたか？」); the 3rd, 6th… they make
// small talk about the season in Tokyo now (flag `talk_<season>`, tokyo/smalltalk.ts; also the 2nd when there is nothing to remember);
// the 4th, 7th… just the regular's greeting. The last purchase is found in the ledger: the newest purchase of anything this conversation sells.
import { SLOTS, seasonAt, type Vars } from '@lw/content';
import type { GamePack, GameState, ScenarioMeta } from '@lw/game';

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

/**
 * The flags a shop conversation starts with: `regular` from the second visit; then, in turn, `remembers` (when something was bought),
 * the season's small talk (`talk_<season>`, the real date in Tokyo), or nothing more.
 */
export function regularFlags(_pack: GamePack, state: GameState, meta: ScenarioMeta | undefined, nowMs = Date.now()): Record<string, boolean> {
  if (!meta || meta.kind !== 'shop') return {};
  const plays = state.runs[meta.id]?.count ?? 0;
  if (plays < 1) return {};
  const flags: Record<string, boolean> = { regular: true };
  const turn = plays % 3;
  const canRemember = !!lastVar(lastBought(state, meta));
  if (turn === 1 && canRemember) flags.remembers = true;
  else if (turn === 1 || turn === 2) flags[`talk_${seasonAt(nowMs)}`] = true;
  return flags;
}
