// Shopkeepers who know you (docs/ROADMAP.md, "better conversations"): a shop conversation played before opens with the regular's greeting
// (flag `regular`), and on every other return visit (the 2nd, 4th, ...) the shopkeeper remembers what you bought last time and asks about
// it (flag `remembers`, var {last}: the slot option of that item, so it reads 「前回のメロンパン、どうでしたか？」). The last purchase is
// found in the ledger: the newest purchase of anything this conversation sells.
import { SLOTS, type Vars } from '@lw/content';
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

/** The flags a shop conversation starts with: `regular` from the second visit, `remembers` on every other return visit with a purchase. */
export function regularFlags(_pack: GamePack, state: GameState, meta: ScenarioMeta | undefined): Record<string, boolean> {
  if (!meta || meta.kind !== 'shop') return {};
  const plays = state.runs[meta.id]?.count ?? 0;
  if (plays < 1) return {};
  const flags: Record<string, boolean> = { regular: true };
  if (plays % 2 === 1 && lastVar(lastBought(state, meta))) flags.remembers = true;
  return flags;
}
