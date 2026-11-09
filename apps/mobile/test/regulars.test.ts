// Shopkeepers who know you (game/regulars.ts): the last thing bought from a conversation's menu is found in the ledger (the newest, never
// the points lines), named by its slot option; a shop conversation played before starts with `regular`, and on every other return visit
// with a purchase also with `remembers`. A first visit, a conversation that is not a shop, and goes at the crane game (three options, one
// item) remember nothing.
import { describe, expect, it } from 'vitest';
import { JP_PACK } from '@lw/content';
import { createGameState, reduce, type GameState, type InputEvent, type RunRecord } from '@lw/game';
import { lastBought, lastVar, regularFlags } from '../src/game/regulars';
import { gameView } from '../src/game/selectors';

const NOW = Date.UTC(2030, 0, 15, 12);
const VIEW = gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: { name: 'Sam', level: 'A1', goal: 'travel', age: 'adults', createdAt: '' } as never });
const run = (s: GameState, ev: InputEvent) => reduce(s, ev, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.3 }).state;
const meta = (id: string) => JP_PACK.scenarioMeta.find((m) => m.id === id)!;
const fresh = (): GameState => {
  const s = createGameState(JP_PACK, NOW);
  return { ...s, chapter: { ...s.chapter, n: 3, completed: [1, 2] }, wallet: { ...s.wallet, cash: 20000 }, totals: { ...s.totals, checksum: { ...s.totals.checksum, cash: 20000 } } };
};
const buy = (s: GameState, session: string, shopId: string, itemId: string) => {
  const price = JP_PACK.menu.find((m) => m.id === itemId)?.price ?? JP_PACK.items.find((i) => i.id === itemId)!.price;
  return run(s, { t: 'purchase', sessionId: session, n: 1, shopId, itemId, qty: 1, total: price, method: 'cash', lines: [] });
};
const played = (s: GameState, id: string, count: number): GameState => ({ ...s, runs: { ...s.runs, [id]: { count, complete: true, stars: 1, bestIndependent: 1, bestShare: 1, bestR: 1, steps: [] } as RunRecord } });

describe('what the shopkeeper remembers', () => {
  it('the newest purchase from the menu of this conversation, as its slot option and its Japanese', () => {
    let s = buy(fresh(), 'a', 'konbini', 'konbini:onigiri');
    expect(lastBought(s, meta('konbini'))).toEqual({ itemId: 'konbini:onigiri', slot: 'item', option: 'onigiri' });
    s = buy(s, 'b', 'konbini', 'konbini:water');
    expect(lastBought(s, meta('konbini'))?.option).toBe('water');
    expect(lastVar(lastBought(s, meta('konbini')))?.ja).toBe('水');
    // a purchase elsewhere is not this shop's
    expect(lastBought(s, meta('cafe'))).toBeNull();
  });

  it('a figure is named as the figure (Daichi asks after the red cat ninja)', () => {
    const s = buy(fresh(), 'f', 'hobby', 'fig_neko_red');
    const last = lastBought(s, meta('hobby_figures'));
    expect(last?.option).toBe('nekoRed');
    expect(lastVar(last)?.gloss?.en).toMatch(/red/i);
  });

  it('goes at the crane game remember nothing: three options sell the one item', () => {
    const s = buy(fresh(), 'c', 'arcade', 'arcade:play');
    expect(lastBought(s, meta('arcade_crane'))).toBeNull();
  });
});

describe('the flags a shop conversation starts with', () => {
  it('none on the first visit; regular from the second; remembers on every other return visit with a purchase', () => {
    let s = buy(fresh(), 'a', 'konbini', 'konbini:onigiri');
    expect(regularFlags(JP_PACK, played(s, 'konbini', 0), meta('konbini'))).toEqual({});
    expect(regularFlags(JP_PACK, played(s, 'konbini', 1), meta('konbini'))).toEqual({ regular: true, remembers: true });
    expect(regularFlags(JP_PACK, played(s, 'konbini', 2), meta('konbini'))).toEqual({ regular: true });
    expect(regularFlags(JP_PACK, played(s, 'konbini', 3), meta('konbini'))).toEqual({ regular: true, remembers: true });
    // nothing bought there: a regular, but nothing to ask about
    s = fresh();
    expect(regularFlags(JP_PACK, played(s, 'cafe', 1), meta('cafe'))).toEqual({ regular: true });
  });

  it('a conversation that is not a shop gets neither', () => {
    const notShop = JP_PACK.scenarioMeta.find((m) => m.kind !== 'shop')!;
    expect(regularFlags(JP_PACK, played(fresh(), notShop.id, 5), notShop)).toEqual({});
  });
});
