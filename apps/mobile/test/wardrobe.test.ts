// The Wardrobe, the fitting-room try-on and the clothes bought at Fuku-Fuku (agent A3, docs/GAME_DESIGN.md §5.5, §6.3): a bought piece is worn at
// once in the colour the learner named, the avatar follows, a reload restores the outfit, the fitting room shows a piece that is not bought and
// puts the real outfit back, and the Wardrobe groups, switches and recolours.
import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CHARACTERS, CLOTHES_COLOURS, DENIM_COLOURS, JP_PACK, scenarioById } from '@lw/content';
import { BALANCE, createGameState, grantItem, type GameState } from '@lw/game';
import { ConversationSession } from '@lw/engine';
import { Swatches, Wardrobe, colourName, colourPick, wearToggle } from '../src/components/game/Inventory';
import { FittingMirror, Figure } from '../src/components/game/FittingMirror';
import { Wallet } from '../src/screens/Wallet';
import {
  WARDROBE_SLOTS,
  applyAvatar,
  autoWearOutfit,
  avatarSpecFor,
  isWorn,
  pieceColour,
  pieceColours,
  showOutfit,
  toggledOutfit,
  tryOnSpec,
  wardrobeSlot,
  wearables,
} from '../src/game/avatarFx';
import { registeredScenarioIds } from '../src/content';
import { dispatch, init, resetBridgeForTests } from '../src/game/bridge';
import { createConvoGame } from '../src/game/convoHooks';
import { GAME_KEY, flushGameNow, getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { gameView } from '../src/game/selectors';
import { interactionRows, openRows, shopStates, syncWorld, type InteractionEnv } from '../src/game/worldSync';
import { STRINGS } from '../src/i18n';
import { useStore, type Profile } from '../src/store';
import { wipeSaved } from './_fakeStorage';

const BASE = CHARACTERS[0].avatar;
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: BASE, createdAt: '2030-01-15T00:00:00.000Z' };
const NOW = Date.UTC(2030, 0, 15, 12);
const RICH = 100_000;
const CHAPTER_FUKU = 2;

const setLang = (lang: 'en' | 'ar') => {
  useStore.setState({ uiLang: lang });
  Object.assign(useStore.getInitialState(), { uiLang: lang });
};
const setGame = (s: GameState) => {
  useGame.getState().setGame(s);
  Object.assign(useGame.getInitialState(), useGame.getState());
};
const html = (el: ReactElement) => renderToStaticMarkup(el);
/** a player in Chapter 2 with money, who owns `ids` (not worn) */
const player = (ids: string[] = [], cash = RICH): GameState => {
  const s = ids.reduce((acc, id) => grantItem(acc, JP_PACK, id, 1, 'd0'), createGameState(JP_PACK, NOW));
  return { ...s, chapter: { ...s.chapter, n: CHAPTER_FUKU }, wallet: { ...s.wallet, cash } };
};
const view = () => gameView(useStore.getState());

/** The conversation screen's hooks over the real bridge: purchases go through `dispatch` like in the app, auto-wear included. */
function shop(scenarioId = 'fuku_clothes') {
  const game = createConvoGame({ pack: PACK, scenarioId, sessionId: 's_fit', state: getGame, view, commit: dispatch });
  const scenario = scenarioById(scenarioId)!;
  const session = new ConversationSession({
    scenario,
    character: CHARACTERS.find((c) => c.id === scenario.characterId)!,
    l1: 'en',
    profileName: 'Sam',
    topics: [],
    sessionId: 's_fit',
    game: game.hooks,
    flags: game.flags,
    recalled: game.recalled,
    policy: BALANCE,
  });
  session.start();
  return { game, session };
}
const typed = (s: ConversationSession, text: string) => s.submit({ text, mode: 'typed_ja' });
const tap = (s: ConversationSession, part: string) => {
  const i = s.suggestions().findIndex((x) => x.written.includes(part));
  if (i < 0) throw new Error(`${s.nodeId}: no chip with ${part}: ${s.suggestions().map((x) => x.written).join(' / ')}`);
  s.pickSuggestion(i);
};
/** Asks for a piece, picks the size (the one-size pieces confirm it) and the colour (a piece with one colour confirms that) and lands on the offer */
function toOffer(s: ConversationSession, word: string, colour?: string) {
  typed(s, `${word}をください`);
  tap(s, ONE_SIZE.includes(word) ? 'はい' : 'サイズ');
  if (colour) typed(s, colour);
  else tap(s, 'はい');
}
const ONE_SIZE = ['帽子', 'メガネ', 'リュック'];
/** The rest of a purchase from the offer: try it on, say it fits, take it, pay cash */
function tryAndPay(s: ConversationSession) {
  tap(s, '試着');
  tap(s, 'ちょうどいい');
  tap(s, 'これ');
  tap(s, '現金');
}

beforeEach(() => {
  wipeSaved();
  useStore.getState().reset();
  resetBridgeForTests();
  useGame.getState().resetGame();
  useStore.setState({ profile, ready: true });
  setLang('en');
  setGame(player());
});

describe('buying clothes puts them on', () => {
  it('a hoodie bought in red is worn at once, red, and the avatar shows it', () => {
    const { session } = shop();
    toOffer(session, 'パーカー', '赤');
    tryAndPay(session);
    expect(session.nodeId).toBe('done');
    const g = getGame();
    expect(g.owned.hoodie?.qty).toBe(1);
    expect(g.wallet.cash).toBe(RICH - 4990);
    expect(g.outfit.equipped).toEqual(['hoodie']);
    expect(g.outfit.colours.hoodie).toBe(CLOTHES_COLOURS.red);
    expect(avatarSpecFor(PACK, g, BASE).top).toBe(CLOTHES_COLOURS.red);
  });

  it('every one of the nine pieces ends up worn, with the patch of the design', async () => {
    const expected: Record<string, (s: ReturnType<typeof avatarSpecFor>) => unknown> = {
      tee_basic: (s) => s.top,
      hoodie: (s) => s.top,
      jeans: (s) => s.bottom,
      sneakers: (s) => s.shoes,
      cap: (s) => s.accessories.includes('cap'),
      jacket_winter: (s) => [s.top, s.accessories.includes('scarf')],
      glasses_round: (s) => s.accessories.includes('glasses'),
      backpack: (s) => s.accessories.includes('backpack'),
      suit_set: (s) => [s.top, s.bottom, s.accessories.includes('tie')],
    };
    const words: Record<string, string> = { tee_basic: 'Tシャツ', hoodie: 'パーカー', jeans: 'ジーンズ', sneakers: 'スニーカー', cap: '帽子', jacket_winter: 'ダウンジャケット', glasses_round: 'メガネ', backpack: 'リュック', suit_set: 'スーツ' };
    const want: Record<string, unknown> = {
      tee_basic: CLOTHES_COLOURS.white,
      hoodie: CLOTHES_COLOURS.blue,
      jeans: DENIM_COLOURS.denim,
      sneakers: CLOTHES_COLOURS.white,
      cap: true,
      jacket_winter: ['#2f5ea8', true],
      glasses_round: true,
      backpack: true,
      suit_set: ['#2b2f3a', '#2b2f3a', true],
    };
    for (const id of Object.keys(words)) {
      setGame({ ...player(), chapter: { ...player().chapter, n: 9 } });
      const { session } = shop();
      typed(session, `${words[id]}をください`);
      tap(session, ONE_SIZE.includes(words[id]!) ? 'はい' : 'サイズ');
      // the colour step: 「はい」 takes the offered colour (a piece with several looks wears its default, the others their one colour)
      tap(session, 'はい');
      tryAndPay(session);
      expect(session.nodeId, id).toBe('done');
      const g = getGame();
      expect(isWorn(g, id), id).toBe(true);
      expect(expected[id]!(avatarSpecFor(PACK, g, BASE)), id).toEqual(want[id]);
    }
  });

  it('a piece the player could not pay for is not bought and not worn', () => {
    setGame(player([], 1000));
    const { session } = shop();
    toOffer(session, 'パーカー', '赤');
    tryAndPay(session);
    expect(session.nodeId).toBe('short');
    expect(getGame().owned.hoodie).toBeUndefined();
    expect(getGame().outfit.equipped).toEqual([]);
  });

  it('a present is not a wearable: the plush toy comes home and the outfit is untouched', () => {
    const before = getGame();
    expect(autoWearOutfit(PACK, before, grantItem(before, PACK, 'g_plush', 1, 'd0'))).toBeNull();
  });

  it('a second top replaces the first on the avatar; the first stays owned and can be put back', () => {
    const owned = player(['tee_basic', 'hoodie']);
    setGame(owned);
    wearToggle(owned, 'tee_basic');
    expect(getGame().outfit.equipped).toEqual(['tee_basic']);
    wearToggle(getGame(), 'hoodie');
    expect(getGame().outfit.equipped).toEqual(['hoodie']);
    expect(getGame().owned.tee_basic?.qty).toBe(1);
  });

  it('a reload restores the outfit and its colours', async () => {
    await init();
    useStore.getState().completeOnboarding(profile);
    setGame(player());
    const { session } = shop();
    toOffer(session, 'パーカー', '青');
    tryAndPay(session);
    flushGameNow();
    const before = getGame();
    expect(before.outfit).toEqual({ equipped: ['hoodie'], colours: { hoodie: CLOTHES_COLOURS.blue } });
    resetBridgeForTests();
    useStore.setState({ ready: false });
    await init();
    expect(getGame().outfit).toEqual(before.outfit);
    expect(avatarSpecFor(PACK, getGame(), BASE).top).toBe(CLOTHES_COLOURS.blue);
    expect(GAME_KEY).toBe('lw.game.jp.v1');
  });
});

describe('the fitting room (try-on)', () => {
  /** drives the learner to the fitting room for a hoodie in red */
  function atFitting() {
    const r = shop();
    toOffer(r.session, 'パーカー', '赤');
    tap(r.session, '試着');
    return r;
  }

  it('shows the piece, in the colour named, while the conversation is on the fitting node', () => {
    const { game, session } = atFitting();
    expect(session.nodeId).toBe('fitting');
    const spec = game.tryOn(session.nodeId, getGame(), BASE);
    expect(spec?.top).toBe(CLOTHES_COLOURS.red);
    // nothing was bought and nothing changed in the game
    expect(getGame().owned.hoodie).toBeUndefined();
    expect(getGame().outfit.equipped).toEqual([]);
  });

  it('stays on through the resize and Rin\'s compliment, and shows nothing at the offer, the quote or the end', () => {
    const { game, session } = shop();
    toOffer(session, 'パーカー', '赤');
    expect(session.nodeId).toBe('offer');
    expect(game.tryOn(session.nodeId, getGame(), BASE)).toBeNull();
    tap(session, '試着');
    expect(game.tryOn('fitting', getGame(), BASE)).not.toBeNull();
    tap(session, '大きい');
    expect(session.nodeId).toBe('resize');
    expect(game.tryOn(session.nodeId, getGame(), BASE)?.top).toBe(CLOTHES_COLOURS.red);
    tap(session, 'エルサイズ');
    expect(session.nodeId).toBe('fitting');
    tap(session, 'ちょうどいい');
    expect(session.nodeId).toBe('suits');
    expect(game.tryOn(session.nodeId, getGame(), BASE)?.top).toBe(CLOTHES_COLOURS.red);
    tap(session, 'これ');
    expect(session.nodeId).toBe('quote');
    expect(game.tryOn(session.nodeId, getGame(), BASE)).toBeNull();
  });

  it('a different colour or piece changes the preview; a present or a scenario without a fitting room has none', () => {
    const { game, session } = shop();
    toOffer(session, 'ジーンズ');
    tap(session, '試着');
    const jeans = game.tryOn('fitting', getGame(), BASE);
    expect(jeans?.bottom).toBe(DENIM_COLOURS.denim);
    expect(jeans?.top).toBe(BASE.top);
    expect(game.tryOn('start', getGame(), BASE)).toBeNull();
    expect(shop('konbini').game.tryOn('fitting', getGame(), BASE)).toBeNull();
  });

  it('the preview goes over what is worn now, with the same rules (a hoodie over a T-shirt replaces its colour, a cap next to a helmet replaces it)', () => {
    const owned = player(['tee_basic', 'bike_helmet']);
    setGame({ ...owned, outfit: { equipped: ['tee_basic', 'bike_helmet'], colours: { tee_basic: CLOTHES_COLOURS.green! } } });
    expect(avatarSpecFor(PACK, getGame(), BASE).top).toBe(CLOTHES_COLOURS.green);
    const cap = tryOnSpec(PACK, getGame(), BASE, 'cap');
    expect(cap?.accessories).toContain('cap');
    expect(cap?.accessories).not.toContain('helmet');
    expect(tryOnSpec(PACK, getGame(), BASE, 'hoodie', CLOTHES_COLOURS.red)?.top).toBe(CLOTHES_COLOURS.red);
    expect(tryOnSpec(PACK, getGame(), BASE, 'g_plush')).toBeNull();
    expect(tryOnSpec(PACK, getGame(), BASE, 'nothing')).toBeNull();
  });

  it('showOutfit puts the preview on the world and the real outfit back when the preview ends (nothing bought stays on)', () => {
    const told: string[] = [];
    const world = { setPlayerSpec: (s: { top: string }) => told.push(s.top) };
    const { game, session } = atFitting();
    showOutfit(world, PACK, getGame(), BASE, game.tryOn(session.nodeId, getGame(), BASE));
    expect(told).toEqual([CLOTHES_COLOURS.red]);
    // the same look again: the world is not rebuilt
    expect(showOutfit(world, PACK, getGame(), BASE, game.tryOn(session.nodeId, getGame(), BASE))).toBe(false);
    // the learner says "I'll think about it": back to the real avatar
    tap(session, 'ちょうどいい');
    tap(session, '考えます');
    expect(session.nodeId).toBe('leave');
    showOutfit(world, PACK, getGame(), BASE, game.tryOn(session.nodeId, getGame(), BASE));
    expect(told).toEqual([CLOTHES_COLOURS.red, BASE.top]);
    expect(getGame().owned.hoodie).toBeUndefined();
  });

  it('a piece that is bought keeps the look: the preview and the worn piece are the same avatar', () => {
    const { game, session } = atFitting();
    const preview = game.tryOn('fitting', getGame(), BASE);
    tap(session, 'ちょうどいい');
    tap(session, 'これ');
    tap(session, '現金');
    expect(session.nodeId).toBe('done');
    expect(avatarSpecFor(PACK, getGame(), BASE)).toEqual(preview);
  });
});

describe('the Wardrobe', () => {
  const OWNED = ['hoodie', 'jeans', 'sneakers', 'cap', 'glasses_round', 'bike_helmet', 'jacket_winter'];

  it('groups the pieces by what they cover, top to toe', () => {
    expect(WARDROBE_SLOTS).toEqual(['top', 'bottom', 'shoes', 'head', 'accessory']);
    const slot = (id: string) => wardrobeSlot(PACK.items.find((i) => i.id === id)!);
    expect(slot('tee_basic')).toBe('top');
    expect(slot('hoodie')).toBe('top');
    expect(slot('jacket_winter')).toBe('top');
    expect(slot('suit_set')).toBe('top');
    expect(slot('jeans')).toBe('bottom');
    expect(slot('sneakers')).toBe('shoes');
    expect(slot('cap')).toBe('head');
    expect(slot('bike_helmet')).toBe('head');
    expect(slot('glasses_round')).toBe('accessory');
    expect(slot('backpack')).toBe('accessory');
  });

  it('lists only owned wearables, in group order, each with a switch; colours only where a piece has them', () => {
    setGame(player(OWNED));
    const out = html(createElement(Wardrobe, { state: getGame() }));
    const order = ['top', 'bottom', 'shoes', 'head', 'accessory'].map((s) => out.indexOf(`data-slot="${s}"`));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    for (const id of OWNED) expect(out, id).toContain(`data-wear="${id}"`);
    expect(out).not.toContain('data-wear="tee_basic"');
    expect(out).toContain('data-colours="hoodie"');
    expect(out).toContain('data-colours="sneakers"');
    expect(out).toContain('data-colours="jeans"');
    expect(out).not.toContain('data-colours="cap"');
    expect(out).not.toContain('data-colours="glasses_round"');
    expect(out).not.toContain('data-colours="jacket_winter"');
    expect((out.match(/role="radio"/g) ?? []).length).toBe(6 + 5 + 6);
  });

  it('is absent while nothing wearable is owned, and shows in the Wallet', () => {
    setGame(player(['g_plush']));
    expect(html(createElement(Wardrobe, { state: getGame() }))).toBe('');
    setGame(player(['hoodie']));
    expect(html(createElement(Wallet))).toContain('data-wardrobe');
  });

  it('Wear and Take off switch a piece, and the avatar follows', () => {
    setGame(player(['hoodie', 'cap']));
    wearToggle(getGame(), 'cap');
    expect(isWorn(getGame(), 'cap')).toBe(true);
    expect(avatarSpecFor(PACK, getGame(), BASE).accessories).toContain('cap');
    wearToggle(getGame(), 'cap');
    expect(isWorn(getGame(), 'cap')).toBe(false);
    expect(avatarSpecFor(PACK, getGame(), BASE).accessories).toEqual(BASE.accessories);
    expect(getGame().owned.cap?.qty).toBe(1);
  });

  it('a second hat replaces the first (a cap never sits under the helmet), and taking the second off leaves none', () => {
    setGame(player(['cap', 'bike_helmet']));
    wearToggle(getGame(), 'bike_helmet');
    wearToggle(getGame(), 'cap');
    expect(getGame().outfit.equipped).toEqual(['cap']);
    const acc = avatarSpecFor(PACK, getGame(), BASE).accessories;
    expect(acc).toContain('cap');
    expect(acc).not.toContain('helmet');
    expect(toggledOutfit(getGame(), 'bike_helmet', PACK)).toEqual(['bike_helmet']);
  });

  it('a colour pick is kept for the piece, worn or not, and the avatar shows it when the piece is on', () => {
    setGame(player(['hoodie']));
    const hoodie = PACK.items.find((i) => i.id === 'hoodie')!;
    expect(pieceColour(getGame(), hoodie)).toBe(CLOTHES_COLOURS.blue);
    colourPick(getGame(), 'hoodie', CLOTHES_COLOURS.yellow!);
    expect(pieceColour(getGame(), hoodie)).toBe(CLOTHES_COLOURS.yellow);
    expect(getGame().outfit.equipped).toEqual([]);
    expect(avatarSpecFor(PACK, getGame(), BASE).top).toBe(BASE.top);
    wearToggle(getGame(), 'hoodie');
    expect(avatarSpecFor(PACK, getGame(), BASE).top).toBe(CLOTHES_COLOURS.yellow);
    colourPick(getGame(), 'hoodie', CLOTHES_COLOURS.black!);
    expect(avatarSpecFor(PACK, getGame(), BASE).top).toBe(CLOTHES_COLOURS.black);
  });

  it('a colour outside the palette is refused by the game', () => {
    setGame(player(['hoodie']));
    colourPick(getGame(), 'hoodie', '#123456');
    expect(getGame().outfit.colours.hoodie).toBeUndefined();
  });

  it('the swatches are radios with a name and the picked one is checked', () => {
    setGame(player(['hoodie']));
    colourPick(getGame(), 'hoodie', CLOTHES_COLOURS.green!);
    const hoodie = PACK.items.find((i) => i.id === 'hoodie')!;
    const out = html(createElement(Swatches, { state: getGame(), item: hoodie }));
    expect(out).toContain('role="radiogroup"');
    expect((out.match(/aria-checked="true"/g) ?? []).length).toBe(1);
    expect(out).toMatch(new RegExp(`aria-checked="true"[^>]*aria-label="Green"|aria-label="Green"[^>]*aria-checked="true"`));
    setLang('ar');
    expect(html(createElement(Swatches, { state: getGame(), item: hoodie }))).toContain('aria-label="أخضر"');
  });

  it('every colour of every piece has a name in English and Arabic, and the names are placeholder-free', () => {
    for (const i of wearables(PACK, player(PACK.items.map((x) => x.id)))) {
      for (const hex of pieceColours(i)) {
        const name = colourName(hex);
        expect(name, `${i.id} ${hex}`).not.toBeNull();
        expect(STRINGS.en[`wallet.colour.${name}` as keyof typeof STRINGS.en], name!).toBeTruthy();
        expect(STRINGS.ar[`wallet.colour.${name}` as keyof typeof STRINGS.ar], name!).toBeTruthy();
      }
    }
  });

  it('renders in Arabic with the Arabic group titles and a right-to-left page', () => {
    setLang('ar');
    setGame(player(['hoodie', 'jeans']));
    const out = html(createElement(Wallet));
    expect(out).toContain('dir="rtl"');
    expect(out).toContain(STRINGS.ar['wallet.slot.top']);
    expect(out).toContain(STRINGS.ar['wallet.slot.bottom']);
    expect(out).not.toContain(STRINGS.ar['wallet.slot.head']);
  });

  it('the wardrobe strings exist in both languages with the same placeholders', () => {
    const keys = Object.keys(STRINGS.en).filter((k) => k.startsWith('wallet.slot.') || k.startsWith('wallet.colour') || k === 'wallet.wardrobeHint');
    expect(keys.length).toBeGreaterThan(15);
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of keys) {
      const en = STRINGS.en[k as keyof typeof STRINGS.en];
      const ar = STRINGS.ar[k as keyof typeof STRINGS.ar];
      expect(ar, k).toBeTruthy();
      expect(holes(ar), k).toBe(holes(en));
    }
  });
});

describe('the fitting-room mirror', () => {
  it('draws the whole outfit: top, bottom, shoes and the accessories of the previewed look', () => {
    const spec = tryOnSpec(PACK, player(), BASE, 'suit_set')!;
    const out = html(createElement(Figure, { spec }));
    expect(out).toContain(spec.top);
    expect(out).toContain(spec.shoes);
    expect(out).toContain(spec.skin);
    // the tie is drawn in the accent, a hat only when worn
    expect(out).toContain(`fill="${spec.accent}"`);
    const bare = html(createElement(Figure, { spec: { ...BASE, accessories: [] } }));
    expect(bare).not.toContain('<circle cx="25.5" cy="26" r="4.2"');
    const glasses = html(createElement(Figure, { spec: { ...BASE, accessories: ['glasses'] } }));
    expect(glasses).toContain('r="4.2"');
  });

  it('is labelled in both languages and hidden from the reading order of the figure itself', () => {
    const spec = tryOnSpec(PACK, player(), BASE, 'cap')!;
    expect(html(createElement(FittingMirror, { spec }))).toContain('Fitting room');
    setLang('ar');
    const ar = html(createElement(FittingMirror, { spec }));
    expect(ar).toContain(STRINGS.ar['shop.fittingRoom']);
    expect(ar).toContain('aria-hidden="true"');
  });
});

describe('the avatar in the world', () => {
  it('syncWorld puts the outfit on the player and the world is told once per change', () => {
    const calls: string[] = [];
    const world = {
      setShopOpen: () => {},
      setNpcBadge: () => {},
      setMoveMultiplier: () => {},
      setRide: () => {},
      setPlayerSpec: (s: { top: string }) => calls.push(s.top),
    };
    const s = player(['hoodie']);
    const env = (state: GameState): InteractionEnv => ({ pack: PACK, state, view: view(), scenarios: new Set(['fuku_clothes']), lessons: new Set() });
    const worn = { ...s, outfit: { equipped: ['hoodie'], colours: { hoodie: CLOTHES_COLOURS.red! } } };
    syncWorld(world as never, env(worn), { completed: {}, lessonsDone: [] }, { base: BASE });
    syncWorld(world as never, env(worn), { completed: {}, lessonsDone: [] }, { base: BASE });
    expect(calls).toEqual([CLOTHES_COLOURS.red]);
    expect(applyAvatar(world, avatarSpecFor(PACK, worn, BASE), BASE)).toBe(false);
  });
});

describe('Fuku-Fuku opens at Chapter 2 and Rin offers the clothes', () => {
  const env = (n: number, scenarios: string[] = ['fuku_clothes']): InteractionEnv => {
    const s = player();
    return { pack: PACK, state: { ...s, chapter: { ...s.chapter, n } }, view: view(), scenarios: new Set(scenarios), lessons: new Set() };
  };

  it('the shutter follows the chapter', () => {
    const open = (n: number) => shopStates(PACK, env(n).state).find(([id]) => id === 'fukufuku')?.[1];
    expect(open(1)).toBe(false);
    expect(open(2)).toBe(true);
    expect(open(4)).toBe(true);
  });

  it('Rin\'s "Shop for clothes" row is listed and open once the conversation is registered, and hidden while it is not', () => {
    const rows = openRows(interactionRows(env(2), 'rin'));
    expect(rows.map((r) => r.it.scenarioId)).toEqual(['fuku_clothes']);
    expect(interactionRows(env(2, []), 'rin')).toEqual([]);
  });
});

describe("Aiko's tea house opens at Chapter 2 with one row: the tea house", () => {
  const env = (n: number): InteractionEnv => {
    const s = player();
    return { pack: PACK, state: { ...s, chapter: { ...s.chapter, n } }, view: view(), scenarios: registeredScenarioIds(), lessons: new Set() };
  };

  it('the stall shutter follows the chapter', () => {
    const open = (n: number) => shopStates(PACK, env(n).state).find(([id]) => id === 'aiko')?.[1];
    expect([open(1), open(2), open(4)]).toEqual([false, true, true]);
  });

  it('from Chapter 2 on, with the scenarios the app registers, her only row is aiko_tea (no viewing, contract, talk or home row), so Talk starts it directly', () => {
    for (const n of [2, 3, 4]) {
      const rows = interactionRows(env(n), 'aiko');
      expect(rows.map((r) => r.it.id), `chapter ${n}`).toEqual(['aiko_shop']);
      expect(openRows(rows).map((r) => r.it.scenarioId)).toEqual(['aiko_tea']);
    }
    expect(openRows(interactionRows(env(1), 'aiko'))).toEqual([]);
  });
});
