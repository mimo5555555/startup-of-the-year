// The phone (agent 4C-lite; docs/GAME_DESIGN.md §8.7): the flags a thread gets from its friend, the thread list and the map pins, the text
// the thread shows, every chat scenario played by tapping suggestions only with every friend, and Chapter 4's chat objectives through the
// real reducer (the first message; four chats with two friends, one thread per friend per day, the caps of hearts and AP).
import { describe, expect, it } from 'vitest';
import { CHARACTERS, JP_PACK, scenarioById } from '@lw/content';
import { ConversationSession } from '@lw/engine';
import {
  BALANCE,
  chapterDef,
  createGameState,
  emptyFriend,
  evalPred,
  grantItem,
  heartsForAp,
  queueThreads,
  reduce,
  type ConversationFacts,
  type GameState,
  type GameView,
  type InputEvent,
  type ReduceResult,
} from '@lw/game';
import { createConvoGame } from '../src/game/convoHooks';
import { canMessage, isCasual } from '../src/game/friendsLogic';
import { PLACE_IDS, chatFlags, mapPins, openerLine, planAccepted, planChat, planFlagEvent, planToday, runnableThreads, threadRows, totalUnread } from '../src/game/phoneLogic';
import { en, ar } from '../src/strings/phone';

const NOW = new Date(2030, 0, 15, 12).getTime();
const VIEW: GameView = {
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: '2030-01-15T00:00:00.000Z' },
};
const CHATS = JP_PACK.scenarioMeta.filter((m) => m.kind === 'chat').map((m) => m.id);
const FRIENDS = JP_PACK.friends.map((f) => f.id);
const AP = BALANCE.ap.thresholds;

const ctx = { pack: JP_PACK, now: NOW, view: VIEW, rng: () => 0.5 };
const step = (s: GameState, ev: InputEvent): ReduceResult => reduce(s, ev, ctx);
const withAp = (id: string, ap: number, more: Partial<GameState['friends'][string]> = {}) => (s: GameState): GameState => ({
  ...s,
  friends: { ...s.friends, [id]: { ...(s.friends[id] ?? emptyFriend(s.clock.dayIndex)), ap, met: true, ...more } },
});
const onDay = (day: number) => (s: GameState): GameState => ({ ...s, clock: { ...s.clock, dayIndex: day, activeDays: Math.max(s.clock.activeDays, day + 1) } });
const compose = (...fs: Array<(s: GameState) => GameState>) => (s: GameState): GameState => fs.reduce((x, f) => f(x), s);
/** a game in Chapter 4 with the phone bought, the friends at the given affinities (default 2 hearts for Mio and Tanaka) */
function game(...patches: Array<(s: GameState) => GameState>): GameState {
  const s0 = createGameState(JP_PACK, NOW);
  const s: GameState = { ...s0, chapter: { ...s0.chapter, n: 4, done: {} } };
  return compose(...patches)(s);
}
const phone = (s: GameState): GameState => grantItem(s, JP_PACK, 'phone_used', 1, 'd0');
const twoFriends = compose(withAp('mio', AP[1]!), withAp('tanaka', AP[1]!), phone);
/** the next day, with the new threads the rollover queues */
const nextDay = (s: GameState): GameState => queueThreads(JP_PACK, onDay(s.clock.dayIndex + 1)(s), VIEW, () => 0.5);

interface Played {
  state: GameState;
  facts: ConversationFacts;
  session: ConversationSession;
}
/** What Conversation.tsx does for a phone thread, without a screen: the chat plan, the hooks, the player's turns, the facts, `conversation_done`, the plan flag. */
function playChat(start: GameState, scenarioId: string, friendId: string, turns: (s: ConversationSession) => void = (s) => { for (let i = 0; i < 30 && !s.ended; i++) s.pickSuggestion(0); }): Played {
  let state = start;
  const commit = (ev: InputEvent): ReduceResult => {
    const r = step(state, ev);
    state = r.state;
    return r;
  };
  const sessionId = `s_${scenarioId}_${friendId}_${start.clock.dayIndex}`;
  const friend = planChat(JP_PACK, start, friendId);
  const g = createConvoGame({ pack: JP_PACK, scenarioId, sessionId, state: () => state, view: () => VIEW, commit, friend });
  const session = new ConversationSession({
    scenario: scenarioById(scenarioId)!,
    character: CHARACTERS.find((c) => c.id === friendId)!,
    l1: 'en',
    profileName: 'Sam',
    topics: [],
    sessionId,
    game: g.hooks,
    flags: g.flags,
    recalled: g.recalled,
    policy: BALANCE,
  });
  session.start();
  turns(session);
  const facts = session.facts({ mode: 'guided', prepared: false });
  commit({ t: 'conversation_done', facts });
  if (planAccepted(scenarioId, session.stepsDone)) commit(planFlagEvent(friendId, state.clock.dayIndex));
  return { state, facts, session };
}

describe('the chat templates the phone runs', () => {
  it('are the five P0 threads, all in the pack as scenarios', () => {
    expect(CHATS.sort()).toEqual(['chat_first', 'chat_food', 'chat_greet', 'chat_miss', 'chat_plan']);
    for (const id of CHATS) expect(scenarioById(id), id).toBeDefined();
  });
});

describe('the flags of a thread (the host contract of scenarios-chat.ts)', () => {
  it('names the friend, and nobody for a character who is not a friend', () => {
    expect(chatFlags(JP_PACK, game(), 'tanaka')).toEqual({ f_tanaka: true });
    expect(chatFlags(JP_PACK, game(), 'aoi')).toEqual({});
  });

  it('sets casual and fc_<id> for a friend who speaks plain form now: Mio at 2 hearts, Yuki and Kenji at 3, never Tanaka, Sato or Hanako', () => {
    expect(chatFlags(JP_PACK, game(withAp('mio', AP[1]!)), 'mio')).toEqual({ f_mio: true, casual: true, fc_mio: true });
    expect(chatFlags(JP_PACK, game(withAp('mio', AP[0]!)), 'mio')).toEqual({ f_mio: true });
    expect(chatFlags(JP_PACK, game(withAp('yuki', AP[1]!)), 'yuki')).toEqual({ f_yuki: true });
    expect(chatFlags(JP_PACK, game(withAp('yuki', AP[2]!)), 'yuki')).toEqual({ f_yuki: true, casual: true, fc_yuki: true });
    expect(chatFlags(JP_PACK, game(withAp('kenji', AP[2]!)), 'kenji')).toEqual({ f_kenji: true, casual: true, fc_kenji: true });
    for (const id of ['tanaka', 'sato', 'hanako']) expect(chatFlags(JP_PACK, game(withAp(id, AP[4]!)), id)).toEqual({ [`f_${id}`]: true });
  });

  it('follows the casual flag Mio\'s beat sets, for anyone, and is the same rule as the Friends screen', () => {
    const s = game(withAp('tanaka', AP[1]!, { flags: ['casual'] }));
    expect(isCasual(JP_PACK, s, 'tanaka')).toBe(true);
    expect(chatFlags(JP_PACK, s, 'tanaka').casual).toBe(true);
    // Tanaka never switches by hearts, so there is no plain-speaking place line (fc_) for him: he keeps his f_ line
    expect(chatFlags(JP_PACK, s, 'tanaka').fc_tanaka).toBeUndefined();
    for (const id of FRIENDS) expect(chatFlags(JP_PACK, s, id).casual === true, id).toBe(isCasual(JP_PACK, s, id));
  });

  it('plans a thread as a plain talk with no variables, topic or reveal', () => {
    const p = planChat(JP_PACK, game(withAp('mio', AP[1]!)), 'mio');
    expect(p).toEqual({ friendId: 'mio', kind: 'talk', casual: true, flags: { f_mio: true, casual: true, fc_mio: true }, vars: {} });
  });
});

describe('what the friend says first', () => {
  const written = (id: string, flags: Record<string, boolean>) => openerLine(id, flags)!.tokens.map((t) => t.s).join('');

  it('is the plain line for a plain-speaking friend, the polite line otherwise, and names the friend\'s place in chat_plan', () => {
    expect(written('chat_plan', chatFlags(JP_PACK, game(withAp('mio', AP[1]!)), 'mio'))).toBe('今日、公園で会わない？');
    expect(written('chat_plan', chatFlags(JP_PACK, game(withAp('yuki', AP[1]!)), 'yuki'))).toBe('今日、カフェで会いませんか？');
    expect(written('chat_plan', chatFlags(JP_PACK, game(withAp('yuki', AP[2]!)), 'yuki'))).toBe('今日、カフェで会わない？');
    expect(written('chat_plan', chatFlags(JP_PACK, game(withAp('sato', AP[1]!)), 'sato'))).toBe('今日、駅で会いませんか？');
    expect(written('chat_plan', {})).toBe('今日、会いませんか？');
  });

  it('is the same line the conversation says first', () => {
    for (const id of CHATS) {
      for (const f of FRIENDS) {
        const s = game(withAp(f, AP[2]!), phone);
        const flags = chatFlags(JP_PACK, s, f);
        const session = new ConversationSession({ scenario: scenarioById(id)!, character: CHARACTERS.find((c) => c.id === f)!, l1: 'en', profileName: 'Sam', topics: [], flags: { ...flags }, policy: BALANCE });
        const first = session.start();
        expect(openerLine(id, flags)!.tokens.map((t) => t.s).join(''), `${id} ${f}`).toBe(first.line.written);
      }
    }
  });

  it('has an English and an Arabic translation, and is undefined for a scenario that does not exist', () => {
    for (const id of CHATS) {
      const o = openerLine(id, {})!;
      expect(o.line.en.trim(), id).toBeTruthy();
      expect(o.line.ar.trim(), id).toBeTruthy();
    }
    expect(openerLine('chat_nope', {})).toBeUndefined();
  });
});

describe('the thread list', () => {
  it('lists the friends of the chapter, threads waiting first, then by hearts', () => {
    let s = game(twoFriends);
    s = queueThreads(JP_PACK, s, VIEW, () => 0.5);
    const rows = threadRows(JP_PACK, s);
    expect(rows.map((r) => r.friendId).slice(0, 2).sort()).toEqual(['mio', 'tanaka']);
    expect(rows).toHaveLength(FRIENDS.length);
    expect(rows.filter((r) => r.unread > 0).map((r) => r.friendId).sort()).toEqual(['mio', 'tanaka']);
    expect(totalUnread(rows)).toBe(2);
    expect(rows.find((r) => r.friendId === 'yuki')!.open).toBe(false);
    expect(rows.find((r) => r.friendId === 'mio')!.open).toBe(true);
  });

  it('keeps the HUD badge and the list in step: unread is the number of threads waiting', () => {
    const s = queueThreads(JP_PACK, game(twoFriends), VIEW, () => 0.5);
    const hud = Object.values(s.friends).reduce((n, f) => n + f.unread, 0);
    expect(totalUnread(threadRows(JP_PACK, s))).toBe(hud);
  });

  it('offers only threads the pack can run', () => {
    const row = { friendId: 'mio', hearts: 2, unread: 2, open: true, plan: false, threads: [{ template: 'chat_first', day: 0 }, { template: 'chat_missing', day: 0 }] };
    expect(runnableThreads(row).map((t) => t.template)).toEqual(['chat_first']);
  });

  it('shows no messages from a friend below 2 hearts, and says so', () => {
    const s = queueThreads(JP_PACK, game(phone, withAp('yuki', AP[0]!)), VIEW, () => 0.5);
    expect(s.friends.yuki!.threads).toEqual([]);
    expect(threadRows(JP_PACK, s).find((r) => r.friendId === 'yuki')).toMatchObject({ open: false, unread: 0 });
  });

  it('turns on with the phone', () => {
    expect(canMessage(JP_PACK, game())).toBe(false);
    expect(canMessage(JP_PACK, game(phone))).toBe(true);
  });
});

describe('map pins', () => {
  it('pins each friend whose place the world has, with their hearts', () => {
    const pins = mapPins(JP_PACK, game(withAp('mio', AP[1]!)));
    expect(pins.map((p) => p.friendId).sort()).toEqual([...FRIENDS].sort());
    expect(pins.find((p) => p.friendId === 'mio')).toMatchObject({ placeId: 'park', hearts: 2, plan: false });
    for (const p of pins) expect(PLACE_IDS).toContain(p.placeId);
  });

  it('puts the friend the player agreed to meet today first, for today only', () => {
    let s = game(twoFriends);
    expect(planToday(s, 'tanaka')).toBe(false);
    s = step(s, planFlagEvent('tanaka', s.clock.dayIndex)).state;
    expect(planToday(s, 'tanaka')).toBe(true);
    expect(mapPins(JP_PACK, s)[0]).toMatchObject({ friendId: 'tanaka', plan: true });
    expect(planToday(onDay(s.clock.dayIndex + 1)(s), 'tanaka')).toBe(false);
  });

  it('has a string for every place it names, in both languages', () => {
    for (const id of PLACE_IDS) {
      expect(en[`phone.place.${id}` as keyof typeof en], id).toBeTruthy();
      expect(ar[`phone.place.${id}` as keyof typeof ar], id).toMatch(/[؀-ۿ]/);
    }
  });
});

describe('every chat, played by tapping suggestions only', () => {
  for (const id of CHATS) {
    for (const f of FRIENDS) {
      it(`${id} with ${f} completes both ways of speaking (plain form and polite form)`, () => {
        for (const ap of [AP[1]!, AP[2]!]) {
          const start = game(phone, withAp(f, ap), (s) => ({ ...s, friends: { ...s.friends, [f]: { ...s.friends[f]!, threads: [{ template: id, day: 0 }], unread: 1 } } }));
          const r = playChat(start, id, f);
          expect(r.session.ended, `${id} ${f} ${ap}`).toBe(true);
          expect(r.facts.goalDone, `${id} ${f} ${ap}`).toBe(r.facts.goalTotal);
          expect(r.state.friends[f]!.threads).toEqual([]);
          expect(r.state.friends[f]!.unread).toBe(0);
        }
      });
    }
  }
});

describe('typing in a thread', () => {
  const thread = (id: string, f = 'mio') => game(phone, withAp(f, AP[1]!), (s) => ({ ...s, friends: { ...s.friends, [f]: { ...s.friends[f]!, threads: [{ template: id, day: 0 }], unread: 1 } } }));

  it('takes a reply typed in Japanese and in romaji, each as an independent turn', () => {
    const typed = playChat(thread('chat_first'), 'chat_first', 'mio', (s) => {
      s.submit({ text: 'はい、買いました！', mode: 'typed_ja' });
      s.submit({ text: '黒いスマホです。', mode: 'typed_ja' });
      s.submit({ text: 'ありがとう！', mode: 'typed_ja' });
    });
    expect(typed.session.ended).toBe(true);
    expect(typed.facts.turns.filter((t) => t.substantive).every((t) => t.cls === 'I')).toBe(true);
    expect(typed.state.friends.mio!.facts['purchase:phone']).toBe('phone');

    const rom = playChat(thread('chat_first'), 'chat_first', 'mio', (s) => {
      s.submit({ text: 'hai, kaimashita', kana: 'はい、かいました', mode: 'typed_romaji' });
      s.submit({ text: 'kuroi sumaho desu', kana: 'くろいスマホです', mode: 'typed_romaji' });
      s.submit({ text: 'arigatou', kana: 'ありがとう', mode: 'typed_romaji' });
    });
    expect(rom.session.ended).toBe(true);
  });

  it('accepts the plain forms a friend answers to, and plans a time or declines politely (a goal step either way)', () => {
    const plain = playChat(thread('chat_plan'), 'chat_plan', 'mio', (s) => {
      s.submit({ text: 'いいよ', mode: 'typed_ja' });
      s.submit({ text: '三時に行く', mode: 'typed_ja' });
    });
    expect(plain.session.ended).toBe(true);
    expect(plain.session.stepsDone.has('time')).toBe(true);
    expect(planToday(plain.state, 'mio')).toBe(true);

    const decline = playChat(thread('chat_plan'), 'chat_plan', 'mio', (s) => {
      s.submit({ text: 'すみません、今日はちょっと難しいです。', mode: 'typed_ja' });
      s.pickSuggestion(0);
    });
    expect(decline.session.stepsDone.has('reply')).toBe(true);
    expect(decline.session.stepsDone.has('time')).toBe(false);
    expect(planToday(decline.state, 'mio')).toBe(false);
  });

  it('remembers the food a friend is told (chat_food), the callback of a later talk', () => {
    const r = playChat(thread('chat_food'), 'chat_food', 'mio', (s) => {
      s.submit({ text: 'ラーメンを食べました', mode: 'typed_ja' });
      for (let i = 0; i < 6 && !s.ended; i++) s.pickSuggestion(0);
    });
    expect(r.state.friends.mio!.facts.favFood).toBe('ramen');
  });
});

describe('planAccepted', () => {
  it('is true only for chat_plan with the time step done', () => {
    expect(planAccepted('chat_plan', ['reply', 'time'])).toBe(true);
    expect(planAccepted('chat_plan', ['reply'])).toBe(false);
    expect(planAccepted('chat_greet', ['reply', 'time'])).toBe(false);
  });
});

describe('Chapter 4 through the real reducer: the first message and four chats with two friends', () => {
  const preds = Object.fromEntries(chapterDef(JP_PACK, 4)!.objectives.map((o) => [o.id, o.pred]));
  const holds = (s: GameState, id: string) => evalPred(preds[id]!, s, { pack: JP_PACK, view: VIEW });

  it('has the predicates the design names', () => {
    expect(preds.c4_2).toEqual({ k: 'phone_chat', n: 1 });
    expect(preds.c4_3).toEqual({ k: 'phone_chat', n: 4, friends: 2 });
  });

  it('buying the phone queues Mio\'s chat_first the same day; answering it is the first message (c4_2)', () => {
    // the purchase is the real event: the phone is the item that switches Messages on and queues the first threads
    let s = game(withAp('mio', AP[1]!), withAp('tanaka', AP[1]!), (x) => ({ ...x, wallet: { ...x.wallet, cash: 100_000 } }));
    expect(s.friends.mio!.threads).toEqual([]);
    const bought = step(s, { t: 'purchase', sessionId: 'buy1', n: 1, shopId: 'denki', itemId: 'phone_used', qty: 1, total: 24_800, method: 'cash', lines: [] });
    s = bought.state;
    expect(canMessage(JP_PACK, s)).toBe(true);
    expect(s.friends.mio!.threads).toEqual([{ template: 'chat_first', day: s.clock.dayIndex }]);
    expect(s.friends.mio!.unread).toBe(1);
    expect(holds(s, 'c4_2')).toBe(false);
    const before = s.friends.mio!.ap;
    s = playChat(s, 'chat_first', 'mio').state;
    expect(holds(s, 'c4_2')).toBe(true);
    expect(s.friends.mio!.ap - before).toBe(BALANCE.ap.chat.ap);
    expect(s.stats.chats).toEqual({ n: 1, friends: { mio: 1 } });
  });

  it('needs four chats with two friends over at least two days, one thread per friend per day, and never above the AP caps (c4_3)', () => {
    let s = queueThreads(JP_PACK, game(twoFriends), VIEW, () => 0.5);
    let day = 0;
    const chatsOf = (st: GameState) => st.stats.chats.n;
    const open = (st: GameState, f: string) => st.friends[f]!.threads[0]?.template;
    for (; day < 6 && !holds(s, 'c4_3'); day++) {
      for (const f of ['mio', 'tanaka']) {
        const template = open(s, f);
        // one new thread per friend per day: exactly one is waiting at the start of a day
        expect(s.friends[f]!.threads, `${f} day ${day}`).toHaveLength(1);
        const apBefore = s.friends[f]!.ap;
        s = playChat(s, template!, f).state;
        expect(s.friends[f]!.ap - apBefore, `${f} chat AP`).toBe(BALANCE.ap.chat.ap);
        expect(s.friends[f]!.chatApToday).toBeLessThanOrEqual(BALANCE.ap.chat.dailyCap);
        // the day is over for this friend until tomorrow
        expect(s.friends[f]!.threads).toEqual([]);
      }
      expect(holds(s, 'c4_3'), `after ${(day + 1) * 2} chats`).toBe(chatsOf(s) >= 4);
      if (!holds(s, 'c4_3')) s = nextDay(s);
    }
    expect(holds(s, 'c4_3')).toBe(true);
    expect(chatsOf(s)).toBe(4);
    expect(day).toBe(2);
    expect(Object.values(s.stats.chats.friends).filter((n) => n > 0)).toHaveLength(2);
  });

  it('never queues a second thread for a friend on the same day, never more than the unread cap, and ignoring a friend costs no hearts', () => {
    let s = queueThreads(JP_PACK, game(twoFriends), VIEW, () => 0.5);
    const again = queueThreads(JP_PACK, s, VIEW, () => 0.1);
    expect(again.friends.mio!.threads).toHaveLength(1);
    const ap = s.friends.mio!.ap;
    for (let d = 0; d < 8; d++) {
      s = nextDay(s);
      expect(s.friends.mio!.unread).toBeLessThanOrEqual(BALANCE.ap.chat.unreadMax);
    }
    expect(s.friends.mio!.ap).toBe(ap);
    expect(heartsForAp(s.friends.mio!.ap)).toBe(2);
  });

  it('a thread left unanswered is not lost and a thread left half-done (abandoned) counts for nothing', () => {
    const s = queueThreads(JP_PACK, game(twoFriends), VIEW, () => 0.5);
    const r = playChat(s, 'chat_first', 'mio', () => {});
    expect(r.state.stats.chats.n).toBe(0);
    expect(r.state.friends.mio!.threads).toHaveLength(1);
  });
});

describe('strings', () => {
  it('have the same {placeholders} in English and Arabic, Latin digits only, and Arabic text in Arabic', () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    for (const k of Object.keys(en) as Array<keyof typeof en>) {
      expect(ph(ar[k]), k).toEqual(ph(en[k]));
      expect(ar[k], k).toMatch(/[؀-ۿ]/);
      expect(en[k], k).not.toMatch(/[؀-ۿ]/);
      expect(en[k] + ar[k], k).not.toMatch(/[٠-٩۰-۹]/);
    }
  });
});
