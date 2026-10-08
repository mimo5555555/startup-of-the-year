import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CHARACTERS, JP_PACK } from '@lw/content';
import { DreamChip } from '../src/components/game/DreamChip';
import { GameMenu } from '../src/components/game/GameMenu';
import { GoodsSheet } from '../src/components/game/GoodsSheet';
import { InteractionSheet } from '../src/components/game/InteractionSheet';
import { TrackerCard } from '../src/components/game/TrackerCard';
import { Ltr, WalletPill } from '../src/components/game/WalletPill';
import { useGame } from '../src/game/gameStore';
import { resetBridgeForTests } from '../src/game/bridge';
import { useStore, type Profile } from '../src/store';
import { interactionRows, type InteractionEnv } from '../src/game/worldSync';
import { gameView } from '../src/game/selectors';

// The HUD pieces rendered to static markup in both directions: no DOM needed, the stores are read as they are.
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0].avatar, createdAt: '2030-01-15T00:00:00.000Z' };

// React's server render reads a zustand store's *initial* state (getServerSnapshot), so the language is set on both
const setLang = (lang: 'en' | 'ar') => {
  useStore.setState({ uiLang: lang });
  Object.assign(useStore.getInitialState(), { uiLang: lang });
};
const html = (el: ReactElement) => renderToStaticMarkup(el);

beforeEach(() => {
  useStore.getState().reset();
  resetBridgeForTests();
  useGame.getState().resetGame();
  useStore.setState({ profile, ready: true });
});

describe('wallet pill', () => {
  it('shows ¥3,000 of a fresh game, in English and in Arabic with the amount kept left-to-right', () => {
    setLang('en');
    expect(html(createElement(WalletPill))).toContain('¥3,000');
    setLang('ar');
    const ar = html(createElement(WalletPill));
    expect(ar).toContain('المحفظة');
    expect(ar).toMatch(/<bdi dir="ltr"[^>]*>¥3,000<\/bdi>/);
    // no IC card yet: no second amount
    expect(ar).not.toContain('hud-ic');
  });

  it('shows the IC balance once the card is owned', () => {
    setLang('en');
    const g = useGame.getState();
    useGame.setState({ owned: { ...g.owned, ic_card: { qty: 1 } as never }, wallet: { ...g.wallet, ic: 1000 } });
    Object.assign(useGame.getInitialState(), useGame.getState());
    const out = html(createElement(WalletPill));
    expect(out).toContain('hud-ic');
    expect(out).toContain('¥1,000');
  });

  it('wraps numbers of a sentence in ltr spans', () => {
    expect(html(createElement(Ltr, { text: 'بقي ¥1,200 يومًا 3' }))).toBe('بقي <bdi dir="ltr">¥1,200</bdi> يومًا <bdi dir="ltr">3</bdi>');
    // the full stop after a number is not part of it
    expect(html(createElement(Ltr, { text: 'Opens in Chapter 4.' }))).toBe('Opens in Chapter <bdi dir="ltr">4</bdi>.');
  });
});

describe('tracker card and dream chip', () => {
  const goal = { kind: 'objective' as const, id: 'c1_1', text: { en: 'Finish the Greetings lesson', ar: 'أنهِ درس التحيات' }, pin: { friend: 'hanako' } };

  it('renders the goal in both languages with the label, the portrait and the walk button', () => {
    setLang('en');
    const en = html(createElement(TrackerCard, { goal, onGo: () => {} }));
    expect(en).toContain('Next goal');
    expect(en).toContain('Finish the Greetings lesson');
    expect(en).toContain('hud-track');
    setLang('ar');
    const ar = html(createElement(TrackerCard, { goal, onGo: () => {} }));
    expect(ar).toContain('أنهِ درس التحيات');
    expect(ar).toContain('الهدف التالي');
  });

  it('the dream chip renders without a tracked dream (the picker may have been put off)', () => {
    setLang('en');
    expect(html(createElement(DreamChip))).toContain('Your dream');
    setLang('ar');
    expect(html(createElement(DreamChip))).toContain('حلمك');
  });
});

describe('menu', () => {
  it('lists the game group and keeps the three original entries in `.menu`, in order, in both languages', () => {
    for (const lang of ['en', 'ar'] as const) {
      setLang(lang);
      const out = html(createElement(GameMenu, { showLevel: false, onClose: () => {}, onLessons: () => {} }));
      const order = [...out.matchAll(/data-menu="(\w+)"/g)].map((m) => m[1]);
      expect(order).toEqual(['quests', 'wallet', 'lessons', 'vocab', 'stats', 'settings']);
      const legacy = out.slice(out.indexOf('class="menu glass-card"'));
      expect([...legacy.matchAll(/data-menu="(\w+)"/g)].map((m) => m[1])).toEqual(['vocab', 'stats', 'settings']);
    }
  });
});

describe('sheets', () => {
  const env = (): InteractionEnv => {
    const state = { ...useGame.getState(), chapter: { ...useGame.getState().chapter, n: 2 } };
    return { pack: JP_PACK, state, view: gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile }), scenarios: new Set(['konbini', 'smalltalk_tanaka']), lessons: new Set(['greetings']) };
  };
  const tanaka = CHARACTERS.find((c) => c.id === 'tanaka')!;

  it('the interaction sheet shows the options of the character with the locked ones dimmed, in both directions', () => {
    const rows = interactionRows(env(), 'tanaka');
    for (const lang of ['en', 'ar'] as const) {
      setLang(lang);
      const out = html(createElement(InteractionSheet, { character: tanaka, rows, hasGoods: true, onPick: () => {}, onGoods: () => {}, onClose: () => {} }));
      expect(out).toContain('data-opt="tanaka_shop"');
      expect(out).toContain('data-opt="goods"');
      expect(out).toContain(lang === 'ar' ? 'اشترِ شيئًا' : 'Buy something');
    }
  });

  it('a shop front that is not open yet says 準備中 and when it opens', () => {
    setLang('en');
    const out = html(createElement(InteractionSheet, { shopName: { en: 'Hikari Denki', ar: 'هيكاري دنكي' }, rows: [], closedUntil: 4, onPick: () => {}, onGoods: () => {}, onClose: () => {} }));
    expect(out).toContain('準備中');
    expect(out).toContain('Opens in Chapter 4');
    expect(out).toContain('Hikari Denki');
  });

  it('the goods sheet has an empty state (the shops are filled by slice 3) and never a dead end', () => {
    setLang('en');
    const out = html(createElement(GoodsSheet, { shopId: 'denki', window: true, onClose: () => {} }));
    expect(out).toContain('Look through the window');
    expect(out).toContain('Nothing to look at yet.');
    expect(out).toContain('Close');
  });
});
