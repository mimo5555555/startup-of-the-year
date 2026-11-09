// Shopkeepers who know you (game/regulars.ts): the last thing bought from a conversation's menu is found in the ledger (the newest, never
// the points lines), named by its slot option; a shop conversation played before starts with `regular`, and on every other return visit
// with a purchase also with `remembers`, the next with the season's small talk. A first visit, a conversation that is not a shop, and goes at the crane game (three options, one
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
  it('none on the first visit; then in turn: the remembered purchase, the season small talk, the regular greeting alone', () => {
    let s = buy(fresh(), 'a', 'konbini', 'konbini:onigiri');
    const at = (n: number) => regularFlags(JP_PACK, played(s, 'konbini', n), meta('konbini'), NOW);
    expect(at(0)).toEqual({});
    expect(at(1)).toEqual({ regular: true, remembers: true });
    expect(at(2)).toEqual({ regular: true, talk_winter: true });
    expect(at(3)).toEqual({ regular: true });
    expect(at(4)).toEqual({ regular: true, remembers: true });
    expect(at(5)).toEqual({ regular: true, talk_winter: true });
    // nothing bought there: small talk instead of the question
    s = fresh();
    expect(regularFlags(JP_PACK, played(s, 'cafe', 1), meta('cafe'), NOW)).toEqual({ regular: true, talk_winter: true });
  });

  it('the small talk follows the season in Tokyo on the real date', () => {
    const s = played(fresh(), 'cafe', 2);
    const on = (iso: string) => Object.keys(regularFlags(JP_PACK, s, meta('cafe'), Date.parse(iso))).find((k) => k.startsWith('talk_'));
    expect(on('2030-04-05T12:00:00Z')).toBe('talk_spring');
    expect(on('2030-06-20T12:00:00Z')).toBe('talk_rainy');
    expect(on('2030-08-01T12:00:00Z')).toBe('talk_summer');
    expect(on('2030-11-09T12:00:00Z')).toBe('talk_autumn');
    expect(on('2030-12-24T12:00:00Z')).toBe('talk_winter');
    // the last evening of February in Tokyo is already March: spring
    expect(on('2030-02-28T16:00:00Z')).toBe('talk_spring');
  });

  it('a conversation that is not a shop gets neither', () => {
    const notShop = JP_PACK.scenarioMeta.find((m) => m.kind !== 'shop')!;
    expect(regularFlags(JP_PACK, played(fresh(), notShop.id, 5), notShop)).toEqual({});
  });
});
