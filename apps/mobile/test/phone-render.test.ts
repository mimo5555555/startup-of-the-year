import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { CHARACTERS, JP_PACK } from '@lw/content';
import { BALANCE, createGameState, emptyFriend, grantItem, queueThreads, type GameState } from '@lw/game';
import { MapList } from '../src/components/game/MapList';
import { PhoneFrame } from '../src/components/game/PhoneFrame';
import { Thread } from '../src/components/game/Thread';
import { resetBridgeForTests } from '../src/game/bridge';
import { useGame } from '../src/game/gameStore';
import { chatFlags, mapPins, threadRows } from '../src/game/phoneLogic';
import { Phone } from '../src/screens/Phone';
import { useStore, type Profile } from '../src/store';
import { useUi } from '../src/ui';

// The phone's pieces rendered to static markup in both directions (no DOM; the stores are read as they are).
const profile: Profile = { name: 'Sam', l1: 'en', level: 'A1', goal: 'travel', age: 'adults', topics: [], avatar: CHARACTERS[0].avatar, createdAt: '2030-01-15T00:00:00.000Z' };
const AP = BALANCE.ap.thresholds;
const setLang = (lang: 'en' | 'ar') => {
  useStore.setState({ uiLang: lang });
  Object.assign(useStore.getInitialState(), { uiLang: lang });
};
const html = (el: ReactElement) => renderToStaticMarkup(el);
const view = { vocab: { total: 0, known: new Set<string>(), dueCount: 0, reviewedKeys: new Set<string>(), reviewedSurfaces: new Set<string>() }, discovered: [], lessonsDone: [], streakDays: 0, profile: { age: 'adults' as const, goal: 'casual' as const, level: 'A1' as const, createdAt: profile.createdAt } };

/** a Chapter 4 game with `owned` phone and two friends at 2 hearts, their first threads queued */
function game(owned: boolean): GameState {
  const s0 = createGameState(JP_PACK, Date.now());
  let s: GameState = { ...s0, chapter: { ...s0.chapter, n: 4, done: {} } };
  for (const id of ['mio', 'tanaka']) s = { ...s, friends: { ...s.friends, [id]: { ...emptyFriend(s.clock.dayIndex), ap: AP[1]!, met: true } } };
  if (owned) s = queueThreads(JP_PACK, grantItem(s, JP_PACK, 'phone_used', 1, 'd0'), view, () => 0.5);
  return s;
}
const put = (s: GameState) => {
  useGame.setState(s);
  Object.assign(useGame.getInitialState(), useGame.getState());
};

beforeEach(() => {
  useStore.getState().reset();
  resetBridgeForTests();
  useGame.getState().resetGame();
  useStore.setState({ profile, ready: true });
  useUi.getState().clearRequests();
  Object.assign(useUi.getInitialState(), { args: {} });
  setLang('en');
});

describe('the Phone screen', () => {
  it('says where to buy a phone while there is none, with a back button and no tabs', () => {
    put(game(false));
    const out = html(createElement(Phone));
    expect(out).toContain('data-phone-locked');
    expect(out).toContain('Hikari Denki');
    expect(out).toContain('data-act="phone-back"');
    expect(out).not.toContain('data-tab-btn');
  });

  it('lists the friends with the waiting threads first, each row a real button with the unread badge', () => {
    put(game(true));
    const out = html(createElement(Phone));
    expect(out).toContain('data-thread-list');
    expect(out.match(/data-friend-row="[a-z]+"/g)).toHaveLength(JP_PACK.friends.length);
    expect(out.match(/data-unread="1"/g)).toHaveLength(2);
    // the first two rows are the friends with a message; the Japanese opener is the row's preview
    const first = out.indexOf('data-friend-row');
    expect(out.slice(first, first + 60)).toMatch(/data-friend-row="(mio|tanaka)" data-unread="1"/);
    expect(out).toContain('スマホ');
    expect(out).toContain('Messages start at ♥2');
  });

  it('opens on the friend a screen named (Friends > Message), with Reply on the thread', () => {
    put(game(true));
    // a server render reads the store's initial state
    Object.assign(useUi.getInitialState(), { args: { phone: { friendId: 'mio' } } });
    const out = html(createElement(Phone));
    expect(out).toContain('data-thread-friend="mio"');
    expect(out).toContain('data-thread="chat_first"');
    expect(out).toContain('data-act="reply"');
    // the plain-speaking friend's opener (Mio at 2 hearts)
    expect(out).toContain('買った');
  });
});

describe('Thread', () => {
  const rowOf = (s: GameState, id: string) => threadRows(JP_PACK, s).find((r) => r.friendId === id)!;
  const who = (id: string) => CHARACTERS.find((c) => c.id === id)!;

  it('shows the opener in Japanese with its translation in the reader\'s language and a Reply button', () => {
    const s = game(true);
    setLang('en');
    const en = html(createElement(Thread, { who: who('tanaka'), row: rowOf(s, 'tanaka'), flags: chatFlags(JP_PACK, s, 'tanaka'), onReply: () => {} }));
    expect(en).toContain('買いました');
    expect(en).toContain('data-act="reply"');
    useStore.setState({ settings: { ...useStore.getState().settings, autoTranslate: true } });
    Object.assign(useStore.getInitialState(), { settings: useStore.getState().settings });
    expect(html(createElement(Thread, { who: who('tanaka'), row: rowOf(s, 'tanaka'), flags: chatFlags(JP_PACK, s, 'tanaka'), onReply: () => {} }))).toContain('Did you buy a phone?');
    setLang('ar');
    const ar = html(createElement(Thread, { who: who('tanaka'), row: rowOf(s, 'tanaka'), flags: chatFlags(JP_PACK, s, 'tanaka'), onReply: () => {} }));
    expect(ar).toContain('اشتريت هاتفًا');
    expect(ar).toContain('ردّ');
  });

  it('says there is nothing new (no dead button) and, below 2 hearts, which heart starts the messages', () => {
    const s = game(true);
    const mio = { ...rowOf(s, 'mio'), threads: [], unread: 0 };
    const out = html(createElement(Thread, { who: who('mio'), row: mio, flags: {}, onReply: () => {} }));
    expect(out).toContain('data-thread-empty');
    expect(out).not.toContain('data-act="reply"');
    const yuki = rowOf(s, 'yuki');
    const locked = html(createElement(Thread, { who: who('yuki'), row: yuki, flags: {}, onReply: () => {} }));
    expect(locked).toContain('data-thread-locked');
    expect(locked).toContain('♥2');
    expect(locked).not.toContain('data-act="reply"');
  });
});

describe('MapList', () => {
  it('lists the friends\' places with a Walk button each, and the plan of today first', () => {
    setLang('en');
    const pins = mapPins(JP_PACK, game(true)).map((p) => (p.friendId === 'sato' ? { ...p, plan: true } : p)).sort((a, b) => Number(b.plan) - Number(a.plan));
    const out = html(createElement(MapList, { pins, goal: null, onWalk: () => {} }));
    expect(out).toContain('data-map-list');
    expect(out.match(/data-act="walk"/g)).toHaveLength(JP_PACK.friends.length);
    expect(out).toContain('The park');
    expect(out.indexOf('data-pin="sato"')).toBeLessThan(out.indexOf('data-pin="mio"'));
    expect(out).toContain('Plan today');
  });

  it('shows the goal\'s person first when the tracker points at one, and says why when there is no pin', () => {
    const out = html(createElement(MapList, { pins: [], goal: { friendId: 'hanako', title: 'Finish the lesson' }, onWalk: () => {} }));
    expect(out).toContain('Finish the lesson');
    expect(out).toContain('data-goal-pin="hanako"');
    expect(out).toContain('data-map-none');
  });

  it('is right-to-left in Arabic', () => {
    setLang('ar');
    const out = html(createElement(PhoneFrame, { title: 'x', onBack: () => {}, backLabel: 'b', tab: 'map', onTab: () => {}, unread: 3, children: 'body' }));
    expect(out).toContain('dir="rtl"');
    expect(out).toContain('data-unread-total="3"');
    expect(out).toContain('الخريطة');
  });
});
