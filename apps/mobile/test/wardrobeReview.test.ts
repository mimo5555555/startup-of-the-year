// Review of Release 2 wave A (clothes and gifts): regression tests for the defects the adversarial pass found.
import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, scenarioById } from '@lw/content';
import { BALANCE, createGameState, giftAp, reactionFor, type GameState } from '@lw/game';
import { ConversationSession } from '@lw/engine';
import { dispatch, resetBridgeForTests } from '../src/game/bridge';
import { createConvoGame } from '../src/game/convoHooks';
import { getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { gameView } from '../src/game/selectors';
import { useStore, type Profile } from '../src/store';
import { wipeSaved } from './_fakeStorage';

const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0].avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const NOW = Date.UTC(2030, 0, 15, 12);
const RICH = 100_000;
const setGame = (s: GameState) => {
  useGame.getState().setGame(s);
  Object.assign(useGame.getInitialState(), useGame.getState());
};
const inChapter = (n: number) => {
  const s = createGameState(JP_PACK, NOW);
  setGame({ ...s, chapter: { ...s.chapter, n }, wallet: { ...s.wallet, cash: RICH } });
};

let sessions = 0;
function shop(scenarioId = 'fuku_clothes') {
  const sessionId = `s_rev${++sessions}`;
  const game = createConvoGame({ pack: PACK, scenarioId, sessionId, state: getGame, view: () => gameView(useStore.getState()), commit: dispatch });
  const scenario = scenarioById(scenarioId)!;
  const session = new ConversationSession({
    scenario,
    character: CHARACTERS.find((c) => c.id === scenario.characterId)!,
    l1: 'en',
    profileName: 'Sam',
    topics: [],
    sessionId,
    game: game.hooks,
    flags: game.flags,
    recalled: game.recalled,
    policy: BALANCE,
  });
  session.start();
  return { game, session };
}
const typed = (s: ConversationSession, text: string) => s.submit({ text, mode: 'typed_ja' });
const characterText = (s: ConversationSession) => s.turns.filter((t) => t.speaker === 'character').map((t) => t.line.written).join('\n');

beforeEach(() => {
  wipeSaved();
  useStore.getState().reset();
  resetBridgeForTests();
  useGame.getState().resetGame();
  useStore.setState({ profile, ready: true });
  inChapter(2);
});

describe('Fuku-Fuku: a piece that opens in a later chapter is "not in stock" at once', () => {
  const LATER: Array<[string, string]> = [
    ['ジーンズ', 'jeans'],
    ['スニーカー', 'sneakers'],
    ['ダウンジャケット', 'jacket_winter'],
    ['メガネ', 'glasses_round'],
    ['リュック', 'backpack'],
    ['スーツ', 'suit_set'],
  ];

  it.each(LATER)('%s: Rin says it is not in stock; no empty price, no fitting room, nothing charged', (word, itemId) => {
    const { session } = shop();
    typed(session, `${word}をください`);
    expect(session.nodeId).toBe('not_yet');
    const said = characterText(session);
    expect(said).toContain('入荷');
    // the old flow quoted "…" for a price it could not read, then ended at the till with "sold out"
    expect(said).not.toContain('…');
    expect(session.stepsDone.has('look')).toBe(false);
    expect(getGame().wallet.cash).toBe(RICH);
    expect(getGame().owned[itemId]).toBeUndefined();
  });

  it('she then offers the others: a piece that is on sale is bought normally from there', () => {
    const { session } = shop();
    typed(session, 'スニーカーをください');
    expect(session.nodeId).toBe('not_yet');
    typed(session, 'パーカーをください');
    expect(session.nodeId).toBe('size');
    expect(characterText(session)).not.toContain('…');
    for (const t of ['エムサイズをおねがいします', '青をおねがいします', 'しちゃくしてもいいですか', 'ちょうどいいです', 'これをください', '現金でおねがいします']) typed(session, t);
    expect(session.nodeId).toBe('done');
    expect(getGame().wallet.cash).toBe(RICH - 4990);
    expect(getGame().owned.hoodie?.qty).toBe(1);
    expect(getGame().owned.sneakers).toBeUndefined();
  });

  it('every way out of the node works: just looking goes back to the shelves, a polite refusal leaves', () => {
    const a = shop();
    typed(a.session, 'スーツをください');
    typed(a.session, 'みているだけです');
    expect(a.session.nodeId).toBe('shelves');
    const b = shop();
    typed(b.session, 'スーツをください');
    typed(b.session, 'またきます');
    expect(b.session.nodeId).toBe('leave');
    expect(b.session.ended).toBe(true);
  });

  it('the same piece sells normally once its chapter has come (Chapter 3: sneakers)', () => {
    inChapter(3);
    const { session } = shop();
    typed(session, 'スニーカーをください');
    expect(session.nodeId).toBe('size');
    expect(characterText(session)).not.toContain('…');
  });
});

describe('gift tastes of the two Fuku-Fuku presents (design §8.5)', () => {
  it('Yuki loves the guitar pick, Kenji dislikes the plush toy (0 AP, still kind), and nobody both loves and dislikes a thing', () => {
    expect(reactionFor(JP_PACK, 'yuki', 'g_guitar_pick')).toBe('loved');
    expect(reactionFor(JP_PACK, 'kenji', 'g_plush')).toBe('disliked');
    const s = createGameState(JP_PACK, NOW);
    const kenji = { ...s, owned: { g_plush: { qty: 1, day: 'd0' } } } as GameState;
    expect(giftAp(JP_PACK, kenji, 'kenji', 'g_plush', false)).toBe(0);
    for (const f of JP_PACK.friends) for (const x of f.loves) expect(f.dislikes, `${f.id} ${x}`).not.toContain(x);
  });
});

describe('a wave-A save (clothes worn, presents in the bag) survives a save, a load and a migrate unchanged', () => {
  it('serialize -> parse -> migrate keeps the owned pieces, the outfit with its colours and the presents, and validates', async () => {
    const { migrate, parseSaved, reduce, serializeState, validateState } = await import('@lw/game');
    const view = gameView(useStore.getState());
    let state = createGameState(JP_PACK, NOW);
    state = { ...state, chapter: { ...state.chapter, n: 4 }, wallet: { ...state.wallet, cash: RICH } };
    const buy = (n: number, shopId: string, itemId: string, total: number) => {
      state = reduce(state, { t: 'purchase', sessionId: 's_save', n, shopId, itemId, qty: 1, total, method: 'cash', lines: [] }, { pack: JP_PACK, now: NOW, view, rng: () => 0.5 }).state;
    };
    buy(1, 'fukufuku', 'hoodie', 4990);
    buy(2, 'fukufuku', 'sneakers', 7990);
    buy(3, 'fukufuku', 'cap', 2490);
    buy(4, 'aiko', 'g_flower', 1500);
    buy(5, 'aiko', 'g_wagashi', 1280);
    buy(6, 'fukufuku', 'g_plush', 800);
    state = reduce(state, { t: 'outfit_changed', equipped: ['hoodie', 'sneakers', 'cap'], colours: { hoodie: '#D8433F', sneakers: '#2b2b36' } }, { pack: JP_PACK, now: NOW, view, rng: () => 0.5 }).state;
    expect(state.outfit.equipped).toEqual(['hoodie', 'sneakers', 'cap']);
    expect(state.wallet.cash).toBe(RICH - 4990 - 7990 - 2490 - 1500 - 1280 - 800);

    const back = migrate(parseSaved(serializeState(state)), 1, JP_PACK);
    expect(back.owned).toEqual(state.owned);
    expect(back.outfit).toEqual(state.outfit);
    expect(back.wallet).toEqual(state.wallet);
    expect(validateState(back, JP_PACK)).toEqual([]);
    // and again: migrating a migrated save changes nothing
    expect(migrate(parseSaved(serializeState(back)), 1, JP_PACK)).toEqual(back);
  });
});

describe("Aiko's stall sells only its own four presents", () => {
  it('a present of another shop (the manga, the chocolate, the plush toy) cannot be ordered: no empty price, no "a little short", nothing charged', () => {
    for (const word of ['マンガ', 'チョコレート', 'ぬいぐるみ', 'ギターピック', 'ゲームカード']) {
      const { session } = shop('aiko_tea');
      typed(session, `${word}をください`);
      expect(session.nodeId, word).toBe('start');
      expect(characterText(session), word).not.toContain('…');
    }
    // her own present still goes through, and costs exactly the catalog price
    const { session } = shop('aiko_tea');
    for (const t of ['お花をください', 'ミオさんにあげます', 'これで', '赤をおねがいします', '現金でおねがいします']) typed(session, t);
    expect(session.nodeId).toBe('done');
    expect(getGame().owned.g_flower?.qty).toBe(1);
    expect(getGame().wallet.cash).toBe(RICH - 1500);
  });
});

describe('every thing the two shops sell: the charge equals the quote, the receipt and the ledger, by cash and by card', () => {
  const ONE_SIZE = ['帽子', 'メガネ', 'リュック'];
  const COLOURFUL = ['Tシャツ', 'パーカー', 'スニーカー'];
  const CLOTHES: Array<[string, string, number]> = [
    ['Tシャツ', 'tee_basic', 1990],
    ['帽子', 'cap', 2490],
    ['パーカー', 'hoodie', 4990],
    ['ジーンズ', 'jeans', 5990],
    ['スニーカー', 'sneakers', 7990],
    ['ダウンジャケット', 'jacket_winter', 12900],
    ['メガネ', 'glasses_round', 9900],
    ['リュック', 'backpack', 6900],
    ['スーツ', 'suit_set', 19800],
  ];
  const method = (m: 'cash' | 'card') => (m === 'cash' ? '現金でおねがいします' : 'カードでおねがいします');

  it.each(CLOTHES.flatMap(([w, id, p]) => (['cash', 'card'] as const).map((m) => [w, id, p, m] as const)))('%s (%s, ¥%i) by %s', (word, itemId, price, m) => {
    inChapter(9);
    const before = getGame().totals.checksum;
    const { session, game } = shop();
    typed(session, `${word}をください`);
    typed(session, ONE_SIZE.includes(word) ? 'はい' : 'エムサイズをおねがいします');
    typed(session, COLOURFUL.includes(word) ? '黒をおねがいします' : 'はい');
    for (const t of ['しちゃくしてもいいですか', 'ちょうどいいです', 'これをください']) typed(session, t);
    // the price the clerk read is the price the till takes
    expect(session.nodeId).toBe('quote');
    expect(game.amounts().total).toBe(price);
    typed(session, method(m));
    expect(session.nodeId).toBe('done');
    const g = getGame();
    // the card draws on the same pocket as cash; Fuku-Fuku gives Sakura Points, 1% of the total
    expect(g.wallet.cash).toBe(RICH - price);
    expect(g.wallet.points).toBe(Math.floor(price / 100));
    expect(g.owned[itemId]?.qty).toBe(1);
    expect(game.purchases).toHaveLength(1);
    expect(game.purchases[0].receipt.total).toBe(price);
    expect(game.purchases[0].method).toBe(m);
    // the ledger's checksum moved by exactly the price (the test seeds the wallet directly, so only the change is compared)
    expect(g.totals.checksum.cash - before.cash).toBe(-price);
    expect(g.totals.checksum.points).toBe(g.wallet.points);
    expect(g.ledger.filter((e) => e.kind === 'purchase' && e.pocket === 'cash').reduce((a, e) => a + e.delta, 0)).toBe(-price);
  });
});

describe('the six presents: charge = quote = receipt = ledger, the item lands in the bag, a second visit buys another', () => {
  const FUKU: Array<[string, string, number]> = [['ぬいぐるみ', 'g_plush', 800], ['ギターピック', 'g_guitar_pick', 300]];
  const AIKO: Array<[string, string, number]> = [['お花', 'g_flower', 1500], ['和菓子', 'g_wagashi', 1280], ['お茶セット', 'g_tea_set', 1500], ['手ぬぐい', 'g_tenugui', 1100]];

  it.each(FUKU.flatMap(([w, id, p]) => (['現金', 'カード'] as const).map((m) => [w, id, p, m] as const)))('Fuku-Fuku: %s (%s, ¥%i) by %s, twice', (word, itemId, price, m) => {
    inChapter(2);
    const before = getGame().totals.checksum.cash;
    for (const visit of [1, 2]) {
      const { session, game } = shop();
      typed(session, 'プレゼントをさがしています');
      typed(session, `${word}をください`);
      expect(game.amounts().total).toBe(price);
      typed(session, `${m}でおねがいします`);
      expect(session.nodeId).toBe('done');
      expect(game.purchases[0].receipt.total).toBe(price);
      expect(getGame().owned[itemId]?.qty).toBe(visit);
      expect(getGame().wallet.cash).toBe(RICH - price * visit);
      expect(getGame().totals.checksum.cash - before).toBe(-price * visit);
      // a present is not worn
      expect(getGame().outfit.equipped).toEqual([]);
    }
  });

  it.each(AIKO)("Aiko: %s (%s, ¥%i), cash only", (word, itemId, price) => {
    const { session, game } = shop('aiko_tea');
    for (const t of [`${word}をください`, 'じぶんにかいます', 'しろをおねがいします']) typed(session, t);
    expect(game.amounts().total).toBe(price);
    // she takes cash only: the card is politely refused and nothing is charged
    typed(session, 'カードでおねがいします');
    expect(session.nodeId).toBe('quote');
    expect(getGame().wallet.cash).toBe(RICH);
    typed(session, '現金でおねがいします');
    expect(session.nodeId).toBe('done');
    expect(game.purchases[0].receipt.total).toBe(price);
    expect(getGame().owned[itemId]?.qty).toBe(1);
    expect(getGame().wallet.cash).toBe(RICH - price);
    // no Sakura Points at the stall
    expect(getGame().wallet.points).toBe(0);
  });

  it("short of cash at either shop never charges, and the clerk says it kindly", () => {
    const s = getGame();
    setGame({ ...s, wallet: { ...s.wallet, cash: 799 } });
    const a = shop();
    for (const t of ['プレゼントをさがしています', 'ぬいぐるみをください', '現金でおねがいします']) typed(a.session, t);
    expect(a.session.nodeId).toBe('short');
    const b = shop('aiko_tea');
    for (const t of ['手ぬぐいをください', 'じぶんにかいます', 'あかをおねがいします', '現金でおねがいします']) typed(b.session, t);
    expect(b.session.nodeId).toBe('short');
    expect(getGame().wallet.cash).toBe(799);
    expect(getGame().owned).toEqual({});
  });
});
