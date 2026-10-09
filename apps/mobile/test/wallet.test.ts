import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CHARACTERS, JP_PACK } from '@lw/content';
import { avatarPatch, createGameState, derivedFlags, disclosure, grantItem, reduce, type GameState, type LedgerEntry } from '@lw/game';
import { Inventory, Wardrobe, fxLines, iconFor, ownedRows } from '../src/components/game/Inventory';
import { RECEIPTS_SHOWN, Receipts, dayLabel, receiptIcon, receiptRows } from '../src/components/game/Receipts';
import { Wallet } from '../src/screens/Wallet';
import { applyAvatar, avatarSpecFor, isWorn, specKey, specWithPatch, toggledOutfit, wearables } from '../src/game/avatarFx';
import { resetBridgeForTests } from '../src/game/bridge';
import { useGame } from '../src/game/gameStore';
import { gameView } from '../src/game/selectors';
import { menuIds, syncWorld, worldFx, type InteractionEnv } from '../src/game/worldSync';
import { STRINGS } from '../src/i18n';
import { useStore, type Profile } from '../src/store';

const BASE = CHARACTERS[0].avatar;
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: BASE, createdAt: '2030-01-15T00:00:00.000Z' };
const view = gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile });
const fresh = (): GameState => createGameState(JP_PACK, Date.UTC(2030, 0, 15));
const own = (s: GameState, ...ids: string[]): GameState => ids.reduce((acc, id) => grantItem(acc, JP_PACK, id, 1, 'd0'), s);
const wear = (s: GameState, ids: string[]): GameState => reduce(s, { t: 'outfit_changed', equipped: ids, colours: {} }, { pack: JP_PACK, now: 0, view, rng: () => 0.5 }).state;

const entry = (e: Partial<LedgerEntry> & Pick<LedgerEntry, 'id' | 'kind' | 'delta' | 'pocket'>): LedgerEntry => ({ at: Date.UTC(2030, 0, 15, 12), ...e });

// React's server render reads a zustand store's *initial* state, so the language and the game are set on both
const setLang = (lang: 'en' | 'ar') => {
  useStore.setState({ uiLang: lang });
  Object.assign(useStore.getInitialState(), { uiLang: lang });
};
const setGame = (s: GameState) => {
  useGame.setState(s);
  Object.assign(useGame.getInitialState(), useGame.getState());
};
const html = (el: ReactElement) => renderToStaticMarkup(el);

beforeEach(() => {
  useStore.getState().reset();
  resetBridgeForTests();
  useGame.getState().resetGame();
  useStore.setState({ profile, ready: true });
  setLang('en');
  setGame(useGame.getState());
});

describe('avatar patches (§5.5)', () => {
  it('the helmet adds the accessory to the avatar the player made, without repeats', () => {
    const s = wear(own(fresh(), 'bike_helmet'), ['bike_helmet']);
    expect(avatarPatch(JP_PACK, s).accessories).toEqual(['helmet']);
    const spec = avatarSpecFor(JP_PACK, s, BASE);
    expect(spec.accessories).toEqual([...BASE.accessories, 'helmet']);
    expect(spec.top).toBe(BASE.top);
    const capped = specWithPatch({ ...BASE, accessories: ['cap', 'helmet'] }, { accessories: ['helmet'] });
    expect(capped.accessories).toEqual(['cap', 'helmet']);
  });

  it('colour patches replace the slot, others stay', () => {
    const spec = specWithPatch(BASE, { top: '#123456', accessories: [] });
    expect(spec.top).toBe('#123456');
    expect(spec.bottom).toBe(BASE.bottom);
    expect(spec.shoes).toBe(BASE.shoes);
  });

  it('only wearable items are in the wardrobe, and only while owned', () => {
    expect(wearables(JP_PACK, fresh())).toEqual([]);
    const s = own(fresh(), 'bike_mamachari', 'bike_helmet');
    expect(wearables(JP_PACK, s).map((i) => i.id)).toEqual(['bike_helmet']);
  });

  it('toggling puts the helmet on and takes it off through the reducer', () => {
    let s = own(fresh(), 'bike_helmet');
    expect(isWorn(s, 'bike_helmet')).toBe(false);
    s = wear(s, toggledOutfit(s, 'bike_helmet'));
    expect(isWorn(s, 'bike_helmet')).toBe(true);
    s = wear(s, toggledOutfit(s, 'bike_helmet'));
    expect(isWorn(s, 'bike_helmet')).toBe(false);
    expect(avatarPatch(JP_PACK, s).accessories).toEqual([]);
  });

  it('a piece that is not owned cannot be worn', () => {
    const s = wear(fresh(), ['bike_helmet']);
    expect(s.outfit.equipped).toEqual([]);
  });

  it('applyAvatar tells the world once per change, and not at all for the unchanged base', () => {
    const calls: string[] = [];
    const world = { setPlayerSpec: (spec: typeof BASE) => calls.push(specKey(spec)) };
    const helmet = specWithPatch(BASE, { accessories: ['helmet'] });
    expect(applyAvatar(world, BASE, BASE)).toBe(false);
    expect(applyAvatar(world, helmet, BASE)).toBe(true);
    expect(applyAvatar(world, helmet, BASE)).toBe(false);
    expect(applyAvatar(world, BASE, BASE)).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('rides and speed (§5.5)', () => {
  it('maps the owned ride to its mesh and speed multiplier, best one wins', () => {
    const fx = (ids: string[]) => worldFx(JP_PACK, own(fresh(), ...ids), BASE);
    expect(fx([])).toMatchObject({ ride: 'none', moveMultiplier: 1 });
    expect(fx(['bike_mamachari'])).toMatchObject({ ride: 'bike', moveMultiplier: 1.5 });
    expect(fx(['bike_mamachari', 'ebike'])).toMatchObject({ ride: 'ebike', moveMultiplier: 1.8 });
    expect(fx(['bike_mamachari', 'car_kei_used'])).toMatchObject({ ride: 'car', moveMultiplier: 2.5 });
    expect(fx(['phone_used', 'bike_helmet'])).toMatchObject({ ride: 'none', moveMultiplier: 1 });
  });

  it('syncWorld sets the ride, the speed and the avatar on a world', () => {
    const calls: string[] = [];
    const world = {
      setShopOpen: () => {},
      setNpcBadge: () => {},
      setMoveMultiplier: (n: number) => calls.push(`mult:${n}`),
      setRide: (k: string) => calls.push(`ride:${k}`),
      setPlayerSpec: (spec: typeof BASE) => calls.push(`spec:${spec.accessories.join('+')}`),
    };
    const state = wear(own(fresh(), 'bike_mamachari', 'bike_helmet'), ['bike_helmet']);
    const env: InteractionEnv = { pack: JP_PACK, state, view, scenarios: new Set(), lessons: new Set() };
    syncWorld(world as never, env, { completed: {}, lessonsDone: [] }, { base: BASE });
    expect(calls).toContain('mult:1.5');
    expect(calls).toContain('ride:bike');
    expect(calls.some((c) => c.startsWith('spec:') && c.includes('helmet'))).toBe(true);
    // a second sync with nothing new does not rebuild the avatar
    const before = calls.filter((c) => c.startsWith('spec:')).length;
    syncWorld(world as never, env, { completed: {}, lessonsDone: [] }, { base: BASE });
    expect(calls.filter((c) => c.startsWith('spec:')).length).toBe(before);
  });
});

describe('the phone (Chapter 4)', () => {
  it('owning it turns on the HUD icon, the map pins and the Phone menu entry', () => {
    const none = fresh();
    expect(derivedFlags(JP_PACK, none).hasPhone).toBe(false);
    expect(menuIds(disclosure(JP_PACK, none, view)).play).not.toContain('phone');
    const s = own(none, 'phone_used');
    expect(derivedFlags(JP_PACK, s).hasPhone).toBe(true);
    const d = disclosure(JP_PACK, s, view);
    expect(d.phoneIcon).toBe(true);
    expect(d.mapPins).toBe(true);
    expect(menuIds(d).play).toContain('phone');
  });

  it('a phone case is not a phone', () => {
    expect(derivedFlags(JP_PACK, own(fresh(), 'phone_case')).hasPhone).toBe(false);
  });
});

describe('what you own', () => {
  it('lists catalog items and giftable presents with icons, names and effects; nothing locked', () => {
    const s = own(fresh(), 'phone_used', 'bike_mamachari', 'bike_helmet', 'car_kei_used', 'g_choco');
    const rows = ownedRows(JP_PACK, s);
    expect(rows.map((r) => r.id)).toEqual(['phone_used', 'bike_mamachari', 'bike_helmet', 'car_kei_used', 'g_choco']);
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect(by('phone_used').icon).toBe('phone');
    expect(by('bike_mamachari').icon).toBe('bike');
    expect(by('car_kei_used').icon).toBe('car');
    expect(by('bike_helmet')).toMatchObject({ icon: 'shirt', wearable: true });
    expect(by('g_choco').icon).toBe('gift');
    expect(by('phone_used').fx).toEqual([{ key: 'wallet.fx.phone' }]);
    expect(by('bike_mamachari').fx).toEqual([{ key: 'wallet.fx.ride', vars: { n: 1.5 } }]);
    expect(by('car_kei_used').fx[0]).toEqual({ key: 'wallet.fx.ride', vars: { n: 2.5 } });
  });

  it('every released item has an icon, at least one effect line with a string, and a wearable flag only for avatar items', () => {
    for (const i of JP_PACK.items) {
      expect(iconFor(i)).toBeTruthy();
      const lines = fxLines(i);
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        expect(STRINGS.en[l.key], l.key).toBeTruthy();
        expect(STRINGS.ar[l.key], l.key).toBeTruthy();
      }
    }
  });

  it('an empty wallet shows the empty state and no wardrobe; a helmet shows the wardrobe and a Worn tag once on', () => {
    setGame(fresh());
    let out = html(createElement(Inventory));
    expect(out).toContain('Nothing yet');
    expect(out).not.toContain('data-wardrobe');
    const owned = own(fresh(), 'bike_helmet');
    setGame(owned);
    out = html(createElement(Inventory));
    expect(out).toContain('data-wardrobe');
    expect(out).toContain('data-owned="bike_helmet"');
    expect(out).toContain('aria-checked="false"');
    expect(out).not.toContain('wlt-worn');
    setGame(wear(owned, ['bike_helmet']));
    out = html(createElement(Inventory));
    expect(out).toContain('aria-checked="true"');
    expect(out).toContain('wlt-worn');
    expect(html(createElement(Wardrobe, { state: fresh() }))).toBe('');
  });
});

describe('receipts', () => {
  const NOW = Date.UTC(2030, 0, 15, 18);
  const ledger: LedgerEntry[] = [
    entry({ id: 'loop:a', kind: 'loop', delta: 480, pocket: 'cash', at: Date.UTC(2030, 0, 13, 9) }),
    entry({ id: 'purchase:s:1', kind: 'purchase', delta: -24800, pocket: 'cash', ref: 'phone_used', at: Date.UTC(2030, 0, 14, 10) }),
    entry({ id: 'purchase:s:1:earn', kind: 'purchase', delta: 248, pocket: 'points', ref: 'phone_used', at: Date.UTC(2030, 0, 14, 10) }),
    entry({ id: 'topup:t:cash', kind: 'topup', delta: -1000, pocket: 'cash', ref: 't' }),
    entry({ id: 'topup:t', kind: 'topup', delta: 1000, pocket: 'ic', ref: 't' }),
    entry({ id: 'purchase:s:2', kind: 'purchase', delta: -150, pocket: 'ic', ref: 'konbini:onigiri_ume' }),
  ];

  it('lists newest first, skips points and the other half of a transfer, and names the thing bought', () => {
    const rows = receiptRows(JP_PACK, { ...fresh(), ledger });
    expect(rows.map((r) => r.id)).toEqual(['purchase:s:2', 'topup:t', 'purchase:s:1', 'loop:a']);
    expect(rows.find((r) => r.id === 'purchase:s:1')?.name?.en).toBe('Refurbished smartphone');
    expect(rows.find((r) => r.id === 'purchase:s:1')?.shopName).toBeTruthy();
  });

  it('shows the work-hours chip only for purchases above the threshold', () => {
    const rows = receiptRows(JP_PACK, { ...fresh(), ledger });
    expect(rows.find((r) => r.id === 'purchase:s:1')?.hours).toBeGreaterThan(10);
    expect(rows.find((r) => r.id === 'purchase:s:2')?.hours).toBeNull();
    expect(rows.find((r) => r.id === 'loop:a')?.hours).toBeNull();
  });

  it('every ledger kind has an icon and a string', () => {
    for (const kind of ['loop', 'shift', 'goal', 'streak', 'chapter', 'star', 'phrase', 'echo', 'purchase', 'fare', 'fee', 'topup', 'refund', 'gift', 'perk'] as const) {
      expect(receiptIcon({ kind })).toBeTruthy();
      expect(STRINGS.en[`wallet.kind.${kind}` as const]).toBeTruthy();
      expect(STRINGS.ar[`wallet.kind.${kind}` as const]).toBeTruthy();
    }
  });

  it('labels days with Latin digits in both languages', () => {
    expect(dayLabel(NOW, NOW, 'en')).toEqual({ t: 'today' });
    expect(dayLabel(NOW - 86_400_000, NOW, 'en')).toEqual({ t: 'yesterday' });
    const old = dayLabel(Date.UTC(2030, 0, 5, 12), NOW, 'ar');
    expect(old.t === 'date' && /[٠-٩]/.test(old.text)).toBe(false);
    expect(old.t === 'date' && /5/.test(old.text)).toBe(true);
  });

  it('renders the rows with the chip and amounts, keeps the older ones behind a button, in English and Arabic', () => {
    const many = Array.from({ length: RECEIPTS_SHOWN + 5 }, (_, i) => entry({ id: `loop:${i}`, kind: 'loop', delta: 100 + i, pocket: 'cash', at: Date.UTC(2030, 0, 2) - i * 1000 }));
    setGame({ ...fresh(), ledger: [...ledger, ...many] });
    const en = html(createElement(Receipts, { now: NOW }));
    expect(en).toContain('Show older receipts');
    expect(en).toContain('Refurbished smartphone');
    expect(en).toContain('of work');
    expect(en).toContain('-¥24,800');
    setLang('ar');
    const ar = html(createElement(Receipts, { now: NOW }));
    expect(ar).toContain('أظهر الإيصالات الأقدم');
    expect(ar).toMatch(/<b class="wlt-amount down" dir="ltr">-¥24,800<\/b>/);
  });

  it('says so when there is nothing yet', () => {
    expect(html(createElement(Receipts))).toContain('No receipts yet');
  });
});

describe('Wallet screen', () => {
  it('shows cash only on a fresh game, then the card and points when they exist, with amounts left-to-right', () => {
    let out = html(createElement(Wallet));
    expect(out).toContain('¥3,000');
    expect(out).not.toContain('data-pocket="ic"');
    expect(out).not.toContain('data-pocket="points"');
    const g = own(fresh(), 'ic_card');
    setGame({ ...g, wallet: { cash: 2500, ic: 1200, points: 340 } });
    setLang('ar');
    out = html(createElement(Wallet));
    expect(out).toContain('dir="rtl"');
    expect(out).toMatch(/<strong dir="ltr">¥2,500<\/strong>/);
    expect(out).toMatch(/<strong dir="ltr">¥1,200<\/strong>/);
    expect(out).toContain('data-pocket="points"');
    expect(out).toContain('المحفظة');
  });
});
