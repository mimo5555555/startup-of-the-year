// The crane game (ゲームセンター「ピコピコ」): the claw catches only what is under it; Shota's help widens the target and firms the grip; a go is
// counted by the game (bought from Shota in a conversation), used once per try, and a win grants the prize into the bag (a present, a figure
// for the display case). Goes are never charged twice for one try, and nothing is won without a go.
import { describe, expect, it } from 'vitest';
import { JP_PACK } from '@lw/content';
import { createGameState, reduce, validateState, type GameState, type InputEvent } from '@lw/game';
import { CRANE_ODDS, CRANE_PRIZES, clampClaw, craneDrop } from '../src/game/craneLogic';
import { gameView } from '../src/game/selectors';

const NOW = Date.UTC(2030, 0, 15, 12);
const VIEW = gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: { name: 'Sam', level: 'A1', goal: 'travel', age: 'adults', createdAt: '' } as never });
const run = (s: GameState, ev: InputEvent) => reduce(s, ev, { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.3 });
const fresh = (cash = 3000): GameState => {
  const s = createGameState(JP_PACK, NOW);
  return { ...s, chapter: { ...s.chapter, n: 2, completed: [1] }, wallet: { ...s.wallet, cash }, totals: { ...s.totals, checksum: { ...s.totals.checksum, cash } } };
};

describe('the claw', () => {
  it('catches only a prize under it; the help widens the reach and firms the grip', () => {
    const red = CRANE_PRIZES.find((p) => p.id === 'fig_neko_red')!;
    expect(craneDrop(red.x, false, () => 0).prize?.id).toBe('fig_neko_red');
    expect(craneDrop(red.x, false, () => 0.99).won).toBe(false);
    expect(craneDrop(red.x + CRANE_ODDS.plain.reach + 0.01, false, () => 0).prize).toBeNull();
    expect(craneDrop(red.x + CRANE_ODDS.plain.reach + 0.01, true, () => 0).prize?.id).toBe('fig_neko_red');
    expect(craneDrop(red.x, false, () => 0.7).won).toBe(false);
    expect(craneDrop(red.x, true, () => 0.7).won).toBe(true);
    expect(clampClaw(-1)).toBe(0.05);
    expect(clampClaw(2)).toBe(0.95);
    // every prize of the machine is a prize the game grants
    for (const p of CRANE_PRIZES) expect(JP_PACK.arcade!.prizes).toContain(p.id);
  });
});

describe('goes and prizes', () => {
  it('goes bought from Shota are counted; each try uses one; a win grants the prize; a replay or no go changes nothing', () => {
    let s = fresh();
    const play = JP_PACK.menu.find((m) => m.id === 'arcade:play')!;
    s = run(s, { t: 'purchase', sessionId: 'a1', n: 1, shopId: 'arcade', itemId: play.id, qty: 3, total: play.price * 3, method: 'cash', lines: [] }).state;
    expect(s.arcade).toEqual({ plays: 3, tries: 0, won: 0 });
    expect(s.wallet.cash).toBe(3000 - 300);
    s = run(s, { t: 'crane_play', id: 'p1', won: false }).state;
    s = run(s, { t: 'crane_play', id: 'p2', won: true, prizeId: 'fig_neko_white' }).state;
    expect(s.arcade).toEqual({ plays: 1, tries: 2, won: 1 });
    expect(s.owned.fig_neko_white?.qty).toBe(1);
    // the same try again: nothing
    expect(run(s, { t: 'crane_play', id: 'p2', won: true, prizeId: 'fig_neko_white' }).state.arcade).toEqual(s.arcade);
    // a prize the machine does not hold is a miss
    const odd = run(s, { t: 'crane_play', id: 'p3', won: true, prizeId: 'phone_pro' }).state;
    expect(odd.arcade).toEqual({ plays: 0, tries: 3, won: 1 });
    expect(odd.owned.phone_pro).toBeUndefined();
    // no go left: nothing
    expect(run(odd, { t: 'crane_play', id: 'p4', won: true, prizeId: 'g_plush' }).state.owned.g_plush).toBeUndefined();
    expect(validateState(odd, JP_PACK)).toEqual([]);
  });
});
