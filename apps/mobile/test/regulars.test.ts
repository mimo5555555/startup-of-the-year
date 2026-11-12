// Shopkeepers who know you (game/regulars.ts): the last thing bought from a conversation's menu is found in the ledger (the newest, never
// the points lines), named by its slot option; a shop conversation played before starts with `regular`, and on every other return visit
// with a purchase also with `remembers`, the next with the season's small talk. A first visit, a conversation that is not a shop, and goes at the crane game (three options, one
// item) remember nothing.
import { describe, expect, it } from 'vitest';
import { JP_PACK, seasonAt } from '@lw/content';
import { createGameState, reduce, type GameState, type InputEvent, type RunRecord } from '@lw/game';
import { lastBought, lastVar, regularFlags, talkTopics } from '../src/game/regulars';
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

/** every place of the town's news already tried: nothing new to tell */
const triedAll = (s: GameState): GameState => ['sento_desk', 'karaoke_desk', 'arcade_crane', 'hobby_figures'].reduce((acc, id) => played(acc, id, 1), s);
const talkOf = (flags: Record<string, boolean>) => Object.keys(flags).find((k) => k.startsWith('talk_'));

describe('the flags a shop conversation starts with', () => {
  it('none on the first visit; then in turn: the remembered purchase, small talk, the name', () => {
    let s = buy(triedAll(fresh()), 'a', 'konbini', 'konbini:onigiri');
    const at = (n: number) => regularFlags(JP_PACK, played(s, 'konbini', n), meta('konbini'), NOW);
    expect(at(0)).toEqual({});
    expect(at(1)).toEqual({ regular: true, remembers: true });
    expect(at(2)).toEqual({ regular: true, talk_winter: true });
    expect(at(3)).toEqual({ regular: true, ask_name: true }); // nothing else to say: Tanaka asks your name (see "your name" below)
    expect(at(4)).toEqual({ regular: true, remembers: true });
    expect(at(5)).toEqual({ regular: true, talk_winter: true });
    // nothing bought there: small talk instead of the question
    s = triedAll(fresh());
    expect(regularFlags(JP_PACK, played(s, 'cafe', 1), meta('cafe'), NOW)).toEqual({ regular: true, talk_winter: true });
  });

  it('the season is the one in Tokyo on the real date', () => {
    const s = played(triedAll(fresh()), 'cafe', 2);
    const on = (iso: string) => talkOf(regularFlags(JP_PACK, s, meta('cafe'), Date.parse(iso)));
    // Wednesdays: no weekend to talk about
    expect(on('2030-04-03T03:00:00Z')).toBe('talk_spring');
    expect(on('2030-06-19T03:00:00Z')).toBe('talk_rainy');
    expect(on('2030-07-31T03:00:00Z')).toBe('talk_summer');
    expect(on('2030-11-06T03:00:00Z')).toBe('talk_autumn');
    expect(on('2030-12-25T03:00:00Z')).toBe('talk_winter');
    // the last evening of February in Tokyo is already March: spring
    expect(seasonAt(Date.parse('2030-02-28T16:00:00Z'))).toBe('spring');
  });

  it('the weekend is talked about from Friday to Monday (Tokyo time), before the season', () => {
    const s = played(triedAll(fresh()), 'cafe', 2);
    const on = (iso: string) => talkOf(regularFlags(JP_PACK, s, meta('cafe'), Date.parse(iso)));
    expect(on('2030-04-05T03:00:00Z')).toBe('talk_weekend_before'); // Friday
    expect(on('2030-04-06T03:00:00Z')).toBe('talk_weekend_now'); // Saturday
    expect(on('2030-04-07T03:00:00Z')).toBe('talk_weekend_now'); // Sunday
    expect(on('2030-04-08T03:00:00Z')).toBe('talk_weekend_after'); // Monday
    expect(on('2030-04-09T03:00:00Z')).toBe('talk_spring'); // Tuesday
    // Thursday 16:00 UTC is Friday 01:00 in Tokyo
    expect(on('2030-04-04T16:00:00Z')).toBe('talk_weekend_before');
    // the topics take turns over the rounds of visits: the weekend, then the season
    const later = played(s, 'cafe', 5);
    expect(talkOf(regularFlags(JP_PACK, later, meta('cafe'), Date.parse('2030-04-05T03:00:00Z')))).toBe('talk_spring');
  });

  it('the news of the town comes first: a place open to you that you have not tried, never the shop you are in', () => {
    const s = fresh(); // Chapter 3: the bath, the game centre and the figure shop are open; the karaoke box needs a friend with a heart
    expect(talkTopics(JP_PACK, s, meta('konbini'), NOW, VIEW)).toEqual(['news_sento', 'winter']);
    expect(talkOf(regularFlags(JP_PACK, played(s, 'konbini', 2), meta('konbini'), NOW, VIEW))).toBe('talk_news_sento');
    // at the bath itself the news is the next place
    expect(talkTopics(JP_PACK, s, meta('sento_desk'), NOW, VIEW)[0]).toBe('news_arcade');
    // tried: the next one; all tried: no news
    expect(talkTopics(JP_PACK, played(s, 'sento_desk', 1), meta('konbini'), NOW, VIEW)[0]).toBe('news_arcade');
    expect(talkTopics(JP_PACK, triedAll(s), meta('konbini'), NOW, VIEW)).toEqual(['winter']);
    // Chapter 1: none of them is open yet
    const early = { ...s, chapter: { ...s.chapter, n: 1, completed: [] } };
    expect(talkTopics(JP_PACK, early, meta('konbini'), NOW, VIEW)).toEqual(['winter']);
    // the karaoke box once a friend has a heart
    const blank = { ap: 0, met: false, apDay: s.clock.dayIndex, apToday: 0, chatApToday: 0, unread: 0, threads: [], chatRecent: [], facts: {}, learned: [], gold: [], callbacks: {}, topicDay: {}, events: [], flags: [], giftHistory: [], gifts: 0, giftsLiked: 0, giftsLoved: 0 };
    const withFriend = { ...played(played(played(s, 'sento_desk', 1), 'arcade_crane', 1), 'hobby_figures', 1), friends: { ...s.friends, mio: { ...blank, ...(s.friends.mio ?? {}), met: true, ap: 35 } } } as GameState;
    expect(talkTopics(JP_PACK, withFriend, meta('konbini'), NOW, VIEW)[0]).toBe('news_karaoke');
  });

  it('the festival is talked about from Chapter 7: coming up, or on today', () => {
    const s = triedAll(fresh());
    const ch7 = { ...s, chapter: { ...s.chapter, n: 7, completed: [1, 2, 3, 4, 5, 6], began: { ...s.chapter.began, dayIndex: s.clock.dayIndex } }, clock: { ...s.clock, lastLocalDate: '2030-01-15' } } as GameState; // a Tuesday, the chapter's first day
    expect(talkTopics(JP_PACK, ch7, meta('cafe'), NOW, VIEW)).toEqual(['festival_soon', 'winter']);
    const saturday = { ...ch7, chapter: { ...ch7.chapter, n: 8, completed: [1, 2, 3, 4, 5, 6, 7] }, clock: { ...ch7.clock, lastLocalDate: '2030-01-19' } } as GameState;
    expect(talkTopics(JP_PACK, saturday, meta('cafe'), NOW, VIEW)[0]).toBe('festival_today');
  });

  it('a conversation that is not a shop gets neither', () => {
    const notShop = JP_PACK.scenarioMeta.find((m) => m.kind !== 'shop')!;
    expect(regularFlags(JP_PACK, played(fresh(), notShop.id, 5), notShop)).toEqual({});
  });
});

describe('your name', () => {
  it('a shopkeeper who does not know it asks on the visit with nothing else to say, and greets you by it once told', () => {
    const s = triedAll(fresh());
    const at = (st: GameState, n: number) => regularFlags(JP_PACK, played(st, 'konbini', n), meta('konbini'), NOW);
    expect(at(s, 3)).toEqual({ regular: true, ask_name: true });
    expect(at(s, 6)).toEqual({ regular: true, ask_name: true });
    const told = run(s, { t: 'name_told', characterId: 'tanaka' });
    expect(told.named).toEqual(['tanaka']);
    expect(at(told, 3)).toEqual({ regular: true, named: true });
    // Yuki at the café was never told
    expect(regularFlags(JP_PACK, played(told, 'cafe', 3), meta('cafe'), NOW)).toEqual({ regular: true, ask_name: true });
    // the festival stall has no such talk: the regular's greeting alone
    expect(regularFlags(JP_PACK, played(told, 'matsuri_stalls', 3), meta('matsuri_stalls'), NOW)).toEqual({ regular: true });
  });

  it('is told once: a second telling and a bad id change nothing', () => {
    let s = run(fresh(), { t: 'name_told', characterId: 'tanaka' });
    expect(run(s, { t: 'name_told', characterId: 'tanaka' }).named).toEqual(['tanaka']);
    s = run(s, { t: 'name_told', characterId: 'yuki' });
    expect(s.named).toEqual(['tanaka', 'yuki']);
    for (const bad of ['', 'Tanaka', 'a b', 'x'.repeat(40), 42 as unknown as string]) expect(run(s, { t: 'name_told', characterId: bad }).named).toEqual(['tanaka', 'yuki']);
  });
});
