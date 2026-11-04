import './_fakeStorage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CHARACTERS } from '@lw/content';
import { BALANCE, fareFor, reconcileGoen, type ConversationFacts, type GameState } from '@lw/game';
import { wipeSaved } from './_fakeStorage';
import { dispatch, init, resetBridgeForTests, startConversation } from '../src/game/bridge';
import { getGame, useGame } from '../src/game/gameStore';
import { PACK } from '../src/game/pack';
import { STRINGS, translate } from '../src/i18n';
import { useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';
import {
  KYOTO,
  KYOTO_STOPS,
  RIDE_PAINT,
  RITUAL_ORDER,
  goenReason,
  inKyoto,
  kyotoQuote,
  nextStepOf,
  omikujiWords,
  ridePaintColours,
  ridePaintOn,
  rideSkinOf,
  ritualTap,
} from '../src/game/goenLogic';
import { useKyoto, useShrine } from '../src/game/goenStore';
import { interactionRows, planFor, routePick, type InteractionEnv } from '../src/game/worldSync';
import { gameView } from '../src/game/selectors';
import { registeredLessonIds, registeredScenarioIds } from '../src/content';
import { beginKyoto, returnFromKyoto } from '../src/components/game/KyotoPanel';
import { goenCards } from '../src/components/game/GoenCatalog';
import { GoenWalletCard } from '../src/components/game/GoenPill';
import { WishRitual } from '../src/components/game/WishRitual';
import { KyotoBackdrop } from '../src/components/game/KyotoBackdrop';
import { Shrine } from '../src/screens/Shrine';
import { Season, dayMonth } from '../src/screens/Season';

// Goen stage 1 in the app (docs/GOEN.md): the ritual, the catalog cards, the Kyoto Journey's fare and return, the toasts, the ride paint, and
// the screens rendered in both directions. Goen never moves the yen wallet: every test that touches Goen checks the wallet and its ledger too.
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0]!.avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const T = (k: string, v?: Record<string, string | number>) => translate('en', k as never, v);
const html = (el: ReactElement) => renderToStaticMarkup(el);
const setLang = (lang: 'en' | 'ar') => {
  useStore.setState({ uiLang: lang });
  Object.assign(useStore.getInitialState(), { uiLang: lang });
};
/** Gives the player Goen as an earn would (balance = ledger sum, so `reconcileGoen` stays green). */
function giveGoen(n: number): void {
  const g = getGame();
  const goen = { ...g.goen, balance: g.goen.balance + n, totals: { ...g.goen.totals, earned: g.goen.totals.earned + n }, ledger: [...g.goen.ledger, { id: `goen:test:${g.goen.ledger.length}`, at: Date.now(), delta: n, kind: 'chapter' as const, ref: 'test' }] };
  useGame.getState().setGame({ ...g, goen });
  Object.assign(useGame.getInitialState(), useGame.getState());
}
const setWallet = (cash: number, ic = 0) => useGame.getState().setGame({ ...getGame(), wallet: { ...getGame().wallet, cash, ic }, totals: { ...getGame().totals, checksum: { ...getGame().totals.checksum, cash, ic } } });
const yenSnapshot = (g: GameState) => ({ wallet: g.wallet, ledger: g.ledger.length, totals: g.totals, chapter: g.chapter.n });
const env = (): InteractionEnv => ({ pack: PACK, state: getGame(), view: gameView(useStore.getState()), scenarios: registeredScenarioIds(), lessons: registeredLessonIds() });
const buy = (itemId: string) => dispatch({ t: 'goen_spend', itemId, id: `t:${itemId}:${Math.random()}` });

beforeEach(async () => {
  wipeSaved();
  useStore.getState().reset();
  useUi.getState().clearRequests();
  resetBridgeForTests();
  useGame.getState().resetGame();
  useKyoto.getState().setAway(null);
  useShrine.getState().end();
  wipeSaved();
  await init();
  useStore.getState().completeOnboarding(profile);
  setLang('en');
});

describe('the wish ritual: 二礼二拍手一礼', () => {
  it('five taps in order: bow, bow, clap, clap, bow; a wrong tap changes nothing and names the next move (no penalty)', () => {
    expect(RITUAL_ORDER).toEqual(['bow', 'bow', 'clap', 'clap', 'bow']);
    let done = 0;
    expect(ritualTap(done, 'clap')).toEqual({ ok: false, done: 0, next: 'bow' });
    for (const tap of RITUAL_ORDER) {
      const wrong = ritualTap(done, tap === 'bow' ? 'clap' : 'bow');
      expect(wrong.ok).toBe(false);
      expect(wrong.done).toBe(done);
      const r = ritualTap(done, tap);
      expect(r.ok).toBe(true);
      done = r.done;
    }
    expect(done).toBe(5);
    expect(ritualTap(5, 'bow').ok).toBe(false);
  });

  it('the coin spends the Goen and the item is yours at once; the yen wallet, its ledger and the chapter are untouched', () => {
    giveGoen(200);
    const before = yenSnapshot(getGame());
    useShrine.getState().start('room_momiji', 'w1');
    const r = buy('room_momiji');
    expect(r.derived.some((d) => d.t === 'goen_owned')).toBe(true);
    expect(getGame().goen.balance).toBe(140);
    expect(getGame().goen.owned.room_momiji).toBeDefined();
    expect(yenSnapshot(getGame())).toEqual(before);
    expect(reconcileGoen(getGame()).ok).toBe(true);
  });

  it('the shrine_wish conversation ending moves the ritual to its celebration', () => {
    useShrine.getState().start('room_momiji', 'w2');
    useShrine.getState().patch({ step: 'wish' });
    const facts: ConversationFacts = {
      sessionId: 'sw1', scenarioId: 'shrine_wish', characterId: 'kannushi', mode: 'guided', abandoned: false, durationSec: 30, goalDone: 1, goalTotal: 1, turns: [], fallbacks: 0, hintUses: 0,
      accuracy: null, requestsPolite: true, prepared: false, remembered: {},
    };
    dispatch({ t: 'conversation_done', facts });
    expect(useShrine.getState().ritual?.step).toBe('done');
  });

  it('renders each step in English and Arabic (coin, taps with Hanako\'s hint, wish, celebration)', () => {
    giveGoen(100);
    for (const lang of ['en', 'ar'] as const) {
      setLang(lang);
      useShrine.getState().start('ride_sakura', 'w3');
      // React's server render reads a zustand store's initial state
      const sync = () => Object.assign(useShrine.getInitialState(), useShrine.getState());
      sync();
      expect(html(createElement(WishRitual))).toContain('data-ritual-coin');
      useShrine.getState().patch({ step: 'taps', done: 1, hint: 'bow' });
      sync();
      const taps = html(createElement(WishRitual));
      expect(taps).toContain('data-ritual-tap="bow"');
      expect(taps).toContain('data-ritual-hint="bow"');
      useShrine.getState().patch({ step: 'wish', hint: null });
      sync();
      expect(html(createElement(WishRitual))).toContain('ますように');
      useShrine.getState().patch({ step: 'done' });
      sync();
      expect(html(createElement(WishRitual))).toContain('data-ritual-done');
      if (lang === 'ar') expect(html(createElement(WishRitual))).toMatch(/[؀-ۿ]/);
    }
  });
});

describe('the catalog cards', () => {
  it('say yours / make a wish / how much more and how to earn it / the most charms held, never a dead button', async () => {
    const { goenCatalog } = await import('@lw/game');
    const view = gameView(useStore.getState());
    let cards = goenCards(goenCatalog(PACK, getGame(), view, Date.now()));
    expect(cards.map((c) => c.item.id)).toEqual(['journey_kyoto', 'season_autumn_premium', 'kimono_momiji', 'room_momiji', 'ride_sakura', 'omamori_streak', 'manner_ojigi', 'manner_eshaku', 'manner_wave', 'manner_ryote', 'manner_itadakimasu']);
    expect(cards.every((c) => c.state === 'short' || c.state === 'closed')).toBe(true);
    expect(cards.find((c) => c.item.id === 'room_momiji')).toMatchObject({ state: 'short', n: 60 });
    giveGoen(120);
    buy('omamori_streak');
    buy('omamori_streak');
    buy('ride_sakura');
    cards = goenCards(goenCatalog(PACK, getGame(), view, Date.now()));
    expect(cards.find((c) => c.item.id === 'omamori_streak')).toMatchObject({ state: 'full', n: 2 });
    expect(cards.find((c) => c.item.id === 'ride_sakura')?.state).toBe('owned');
    expect(cards.find((c) => c.item.id === 'room_momiji')?.state).toBe('short');
  });

  it('what to do with each thing once it is yours', () => {
    expect(nextStepOf(PACK, 'journey_kyoto').key).toBe('gn.next.journey');
    expect(nextStepOf(PACK, 'season_autumn_premium').open).toBe('season');
    expect(nextStepOf(PACK, 'kimono_momiji').open).toBe('wallet');
    expect(nextStepOf(PACK, 'room_momiji').open).toBe('room');
    expect(nextStepOf(PACK, 'omamori_streak').open).toBeUndefined();
  });
});

describe('Goen earned: one toast with its reason', () => {
  it('names the chapter, the daily goals, the Journey', () => {
    expect(goenReason(T as never, 'chapter', 'ch3')).toBe('Chapter 3 completed');
    expect(goenReason(T as never, 'daily')).toBe('all daily goals done');
    expect(goenReason(T as never, 'journey', 'journey_kyoto')).toBe('the Kyoto Journey');
    expect(T('gn.earned', { n: 25, reason: goenReason(T as never, 'chapter', 'ch3') })).toBe('+25 Goen: Chapter 3 completed');
  });

  it('a chapter finished by the dev tools pays +25 and the toast says so', () => {
    vi.useFakeTimers();
    dispatch({ t: 'profile_set', dev: true });
    dispatch({ t: 'dev', cmd: 'advance_chapter' });
    expect(getGame().goen.balance).toBe(BALANCE.goen.chapter);
    // the chapter's own toast first, then the Goen one (it waits instead of hiding it)
    vi.advanceTimersByTime(2500);
    expect(useStore.getState().toast?.text ?? '').toBe('+25 Goen: Chapter 1 completed');
    vi.useRealTimers();
  });
});

describe('the omikuji hands the reducer the words due for review', () => {
  it('soonest first, at most 20', () => {
    const now = Date.parse('2030-01-20T00:00:00Z');
    const v = (s: string, due: string) => ({ s, card: { due } });
    expect(omikujiWords([v('b', '2030-01-19T00:00:00Z'), v('a', '2030-01-10T00:00:00Z'), v('c', '2030-02-01T00:00:00Z')], now)).toEqual(['a', 'b']);
    expect(omikujiWords(Array.from({ length: 30 }, (_, i) => v(`w${i}`, '2030-01-01T00:00:00Z')), now)).toHaveLength(20);
  });
});

describe('the sakura paint (Wallet ride card)', () => {
  it('goes on when bought, switches off and on, and the world gets the skin only while on', () => {
    giveGoen(50);
    buy('ride_sakura');
    expect(getGame().owned[RIDE_PAINT]?.qty).toBe(1);
    expect(ridePaintOn(getGame())).toBe(true);
    expect(rideSkinOf(getGame())).toBe('sakura');
    dispatch({ t: 'outfit_changed', equipped: getGame().outfit.equipped, colours: ridePaintColours(getGame(), false) });
    expect(rideSkinOf(getGame())).toBeNull();
    dispatch({ t: 'outfit_changed', equipped: getGame().outfit.equipped, colours: ridePaintColours(getGame(), true) });
    expect(rideSkinOf(getGame())).toBe('sakura');
  });

  it('the Wallet card shows the Goen balance apart from the yen, the charms held and the paint switch', () => {
    giveGoen(130);
    buy('omamori_streak');
    buy('ride_sakura');
    for (const lang of ['en', 'ar'] as const) {
      setLang(lang);
      Object.assign(useGame.getInitialState(), useGame.getState());
      const out = html(createElement(GoenWalletCard));
      expect(out).toContain('data-goen="50"');
      expect(out).toContain('data-charms="1"');
      expect(out).toContain('data-ride-paint="on"');
      expect(out).toContain('data-open="shrine"');
    }
  });
});

describe('the Kyoto Journey', () => {
  const owned = () => {
    giveGoen(250);
    buy(KYOTO.item);
  };
  const fares = () => getGame().ledger.filter((e) => e.kind === 'fare' && e.ref === 'kyoto');

  it("Sato's Kyoto row is hidden until the Journey is owned, then its plan is the Shinkansen", () => {
    expect(interactionRows(env(), 'sato').some((r) => r.it.id.includes('kyoto'))).toBe(false);
    owned();
    const row = interactionRows(env(), 'sato').find((r) => planFor(env(), r.it, 'sato').t === 'kyoto');
    expect(row).toBeDefined();
    expect(row!.lock).toBeNull();
  });

  it('charges the Shinkansen round trip in yen exactly once; a second tap or a reload in Kyoto never charges again', () => {
    owned();
    setWallet(10_000);
    const want = fareFor(PACK, getGame(), 'kyoto', 'paper') * 2;
    expect(want).toBeGreaterThan(0);
    expect(beginKyoto()).toBe(true);
    expect(fares()).toHaveLength(1);
    expect(fares()[0]!.delta).toBe(-want);
    expect(getGame().wallet.cash).toBe(10_000 - want);
    expect(inKyoto(getGame(), useKyoto.getState().away)).toBe(true);
    // a double tap, and the page coming back (the marker is read from storage again)
    expect(beginKyoto()).toBe(true);
    useKyoto.setState({ away: JSON.parse(localStorage.getItem('lw.kyoto.v1')!).away });
    expect(beginKyoto()).toBe(true);
    expect(fares()).toHaveLength(1);
    expect(getGame().totals.checksum.cash).toBe(getGame().wallet.cash);
  });

  it('short of money: nothing is charged and a toast says the fare and what you have', () => {
    owned();
    setWallet(500);
    expect(beginKyoto()).toBe(false);
    expect(fares()).toHaveLength(0);
    expect(getGame().wallet.cash).toBe(500);
    expect(useStore.getState().toast?.text).toContain('¥500');
    expect(kyotoQuote(PACK, getGame()).method).toBeNull();
  });

  it('the three Kyoto conversations are no fares and file no ride back; Back to Sakura-chō files trip:kyoto', () => {
    owned();
    setWallet(10_000);
    beginKyoto();
    const cash = getGame().wallet.cash;
    for (const s of KYOTO_STOPS) {
      startConversation({ scenarioId: s.scenarioId, characterId: s.characterId });
      expect(useUi.getState().convo?.scenarioId).toBe(s.scenarioId);
      useUi.getState().endConvo();
    }
    expect(getGame().wallet.cash).toBe(cash);
    expect(getGame().stats.visits).not.toContain('trip:kyoto');
    returnFromKyoto();
    expect(getGame().stats.visits).toContain('trip:kyoto');
    expect(useKyoto.getState().away).toBeNull();
    expect(inKyoto(getGame(), useKyoto.getState().away)).toBe(false);
  });

  it('the backdrops show the ryokan, the temple and the café, and the ride after the Shinkansen', () => {
    for (const lang of ['en', 'ar'] as const) {
      setLang(lang);
      for (const s of KYOTO_STOPS) expect(html(createElement(KyotoBackdrop, { place: s.place }))).toContain(`data-kyoto="${s.place}"`);
      expect(html(createElement(KyotoBackdrop, { place: 'temple', ride: true }))).toContain('data-kyoto-ride');
    }
  });
});

describe('world picks at the shrine', () => {
  it('the offering box opens the Shrine panel, the water basin the manners card; signs keep their word card', () => {
    expect(routePick('shrine:box')).toEqual({ t: 'shrine', what: 'box' });
    expect(routePick('shrine:chozuya')).toEqual({ t: 'shrine', what: 'chozuya' });
    expect(routePick('some_sign')).toBeNull();
  });
});

describe('the Shrine and Season screens render in both directions', () => {
  it('the Shrine: Goen pill, omikuji, the season link and eleven catalog cards (six things and five manners)', () => {
    for (const lang of ['en', 'ar'] as const) {
      setLang(lang);
      const out = html(createElement(Shrine));
      expect(out).toContain('data-goen-pill');
      expect(out).toContain('data-omikuji');
      expect(out).toContain('data-open="season"');
      expect(out.match(/data-goen-item=/g)).toHaveLength(11);
      expect(out).not.toContain('data-goen-preview');
    }
  });

  it('the Season: tasks, eight tiers on two tracks, and the premium lock with its price', () => {
    for (const lang of ['en', 'ar'] as const) {
      setLang(lang);
      const out = html(createElement(Season));
      if (out.includes('data-active="1"')) {
        expect(out.match(/data-tier=/g)).toHaveLength(8);
        expect(out).toContain('data-premium="locked"');
        expect(out.match(/data-season-task=/g)?.length).toBeGreaterThanOrEqual(6);
      } else expect(out).toContain('data-season-soon');
    }
    expect(dayMonth('10-15', 'en')).toBe('15 October');
    expect(dayMonth('12-15', 'ar')).not.toMatch(/[٠-٩]/);
  });

  it('every gn. string has English and Arabic with the same placeholders', () => {
    const en = STRINGS.en as Record<string, string>;
    const ar = STRINGS.ar as Record<string, string>;
    for (const k of Object.keys(en).filter((x) => x.startsWith('gn.'))) {
      expect(ar[k], k).toMatch(/[؀-ۿ]/);
      expect((ar[k].match(/\{\w+\}/g) ?? []).sort(), k).toEqual((en[k].match(/\{\w+\}/g) ?? []).sort());
    }
  });
});
