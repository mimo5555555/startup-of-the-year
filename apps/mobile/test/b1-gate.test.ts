// Wave B1 gate: the hand-offs of world, content and app seen together. Which rows and doors a friend offers at which heart, what a spam of
// hang-outs and visits can earn, that keepsakes come once, and that the frozen saves of earlier waves load beside the seventh friend.
import './_fakeStorage';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HANGOUTS, HOMES, JP_PACK, scenarioById } from '@lw/content';
import { BALANCE, createGameState, emptyFriend, friendActions, heartsForAp, migrate, reduce, validateState, type GameState, type InputEvent } from '@lw/game';
import { ctxOf, makeFacts } from '../../../packages/game/test/fixtures-1e';
import { FREE_WALK } from '../../../packages/content/src/tokyo/game/chapters';
import { gameView } from '../src/game/selectors';
import { doorsOpen } from '../src/game/homeLogic';
import { interactionRows, type InteractionEnv } from '../src/game/worldSync';

const NOW = Date.UTC(2030, 0, 15);
const profile = { name: 'Sam', level: 'A1' as const, goal: 'travel', age: 'adults' as const, createdAt: '2030-01-15T00:00:00.000Z' };
const view = gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: profile as never });
const SCENARIOS = new Set(Object.values(JP_PACK.interactions).flat().map((i) => i.scenarioId).filter(Boolean) as string[]);
const envOf = (state: GameState): InteractionEnv => ({ pack: JP_PACK, state, view, scenarios: SCENARIOS, lessons: new Set() });

const HANG_FRIENDS = { mio: 'hang_mio_photo', yuki: 'hang_yuki_jam', kenji: 'hang_kenji_cook', aiko: 'hang_aiko_wagashi' } as const;
const HOME_FRIENDS = { mio: 'home_mio', aiko: 'home_aiko', kenji: 'home_kenji' } as const;
const fixture = (name: string): GameState => JSON.parse(readFileSync(new URL(`../../../packages/game/test/saves/${name}.json`, import.meta.url), 'utf8'));

const at = (friend: string, hearts: number, ch = 3, more: Record<string, unknown> = {}): GameState => {
  const s = createGameState(JP_PACK, NOW);
  return {
    ...s,
    chapter: { ...s.chapter, n: ch },
    friends: { [friend]: { ...emptyFriend(s.clock.dayIndex), ap: BALANCE.ap.thresholds[hearts - 1] ?? 0, met: true, ...more } },
  };
};
const finish = (state: GameState, id: string, sessionId = `s-${id}-${state.clock.dayIndex}`): GameState => {
  const sc = scenarioById(id)!;
  const facts = makeFacts({ scenarioId: id, characterId: sc.characterId, sessionId, ind: 4, ass: 0, done: sc.steps.length, total: sc.steps.length });
  return reduce(state, { t: 'conversation_done', facts } as InputEvent, ctxOf(JP_PACK)).state;
};
const apOf = (s: GameState, f: string): number => s.friends[f]?.ap ?? 0;

describe('rows: hang-outs from 3 hearts, home visits from 4, and no dead row for anyone else', () => {
  const FRIENDS = JP_PACK.friends.map((f) => f.id);
  it('there are seven friends and Aiko is one of them', () => {
    expect(FRIENDS).toHaveLength(7);
    expect(FRIENDS).toContain('aiko');
  });
  it.each(FRIENDS)('%s', (who) => {
    for (const hearts of [2, 3, 4]) {
      const rows = interactionRows(envOf(at(who, hearts)), who);
      const hang = rows.find((r) => r.it.id.endsWith('_hang'));
      const home = rows.find((r) => r.it.id.startsWith('home_'));
      if (who in HANG_FRIENDS) {
        expect(hang?.it.scenarioId, `${who} hang row`).toBe(HANG_FRIENDS[who as keyof typeof HANG_FRIENDS]);
        expect(!!hang!.lock, `${who} hang locked at ${hearts}`).toBe(hearts < 3);
      } else expect(hang, `${who} has no hang-out row`).toBeUndefined();
      if (who in HOME_FRIENDS) {
        expect(home?.it.scenarioId, `${who} home row`).toBe(HOME_FRIENDS[who as keyof typeof HOME_FRIENDS]);
        expect(!!home!.lock, `${who} home locked at ${hearts}`).toBe(hearts < 4);
      } else expect(home, `${who} has no home row`).toBeUndefined();
    }
  });
  it('the reducer-side actions agree with the rows', () => {
    for (const who of Object.keys(HANG_FRIENDS)) {
      expect(friendActions(JP_PACK, at(who, 2), view, who).hangout, `${who}@2`).toBe(false);
      expect(friendActions(JP_PACK, at(who, 3), view, who).hangout, `${who}@3`).toBe(true);
    }
  });
});

describe('doors', () => {
  it('open exactly at 4 hearts for the three hosts, and only those', () => {
    for (const who of ['mio', 'aiko', 'kenji', 'yuki', 'tanaka']) {
      for (const hearts of [3, 4, 5]) {
        const open = Object.fromEntries(doorsOpen(at(who, hearts), SCENARIOS));
        expect(open[who] ?? false, `${who}@${hearts}`).toBe(who in HOME_FRIENDS && hearts >= 4);
        expect(Object.values(open).filter(Boolean).length, `${who}@${hearts} others shut`).toBe(who in HOME_FRIENDS && hearts >= 4 ? 1 : 0);
      }
    }
  });
  it('survive a reload: the state is saved as JSON, migrated and read again', () => {
    const s = at('kenji', 4);
    const back = migrate(JSON.parse(JSON.stringify(s)), 1, JP_PACK);
    expect(Object.fromEntries(doorsOpen(back, SCENARIOS)).kenji).toBe(true);
    expect(Object.fromEntries(doorsOpen(back, SCENARIOS)).mio).toBe(false);
  });
});

describe('what spam can earn', () => {
  const spamDay = 40;
  it('ten hang-outs and ten visits in one day pay one hang-out: +25 AP, no yen, one keepsake', () => {
    let s = at('mio', 3, 3, { hangoutDay: undefined });
    s = { ...s, clock: { ...s.clock, dayIndex: spamDay } };
    const cash = s.wallet.cash;
    const ap0 = apOf(s, 'mio');
    for (let i = 0; i < 10; i++) s = finish(s, 'hang_mio_photo', `spam-${i}`);
    expect(apOf(s, 'mio') - ap0).toBe(BALANCE.ap.hangout.good);
    expect(s.stats.hangouts.mio).toBe(1);
    for (let i = 0; i < 10; i++) s = finish(s, 'home_mio', `spam-home-${i}`);
    expect(apOf(s, 'mio') - ap0, 'a visit the same day shares the 3-day limit').toBe(BALANCE.ap.hangout.good);
    // the only yen of the day is the daily goal's own reward (it pays once a day for any finished conversation), never the hang-out
    expect(s.ledger.filter((e) => !['goal', 'streak'].includes(e.kind) && e.delta !== 0)).toEqual([]);
    expect(s.wallet.cash - cash).toBeLessThanOrEqual(BALANCE.goals.each);
    expect(s.keepsakes.filter((k) => k === 'photo_mio')).toHaveLength(1);
  });
  it('a hang-out every third day pays every time, and the day never goes over the 60 AP cap', () => {
    let s = at('yuki', 3);
    s = { ...s, clock: { ...s.clock, dayIndex: spamDay } };
    const cash = s.wallet.cash;
    for (let i = 0; i < 10; i++) {
      const before = apOf(s, 'yuki');
      s = finish(s, 'hang_yuki_jam', `r-${i}`);
      expect(apOf(s, 'yuki') - before, `round ${i}`).toBeLessThanOrEqual(BALANCE.ap.dailyCap);
      expect(s.friends.yuki!.apToday).toBeLessThanOrEqual(BALANCE.ap.dailyCap);
      s = { ...s, clock: { ...s.clock, dayIndex: s.clock.dayIndex + 3 } };
    }
    expect(s.stats.hangouts.yuki).toBe(10);
    expect(s.wallet.cash).toBe(cash);
    expect(s.keepsakes.filter((k) => k === 'stamp_card')).toHaveLength(1);
  });
  it('every hang-out and visit is pay:none, so it can create no yen', () => {
    for (const id of [...Object.values(HANG_FRIENDS), ...Object.values(HOME_FRIENDS)]) {
      const meta = JP_PACK.scenarioMeta.find((m) => m.id === id)!;
      expect(meta.pay, id).toBe('none');
      const s = at(meta.friendId!, 4);
      expect(finish(s, id).wallet.cash, id).toBe(s.wallet.cash);
    }
  });
  it('the table of hang-outs and the table of homes agree with the pack', () => {
    expect(Object.keys(HANGOUTS).sort()).toEqual(Object.values(HANG_FRIENDS).sort());
    expect(Object.keys(HOMES).sort()).toEqual(Object.values(HOME_FRIENDS).sort());
  });
});

describe('release cap and saves', () => {
  it('the release plays the whole story, chapters 1-8 (wave C2), and then Free Walk', () => {
    expect(JP_PACK.release.lastChapter).toBe(8);
    expect(FREE_WALK).toBe(9);
  });
  it.each(['v1-empty', 'v1-typical', 'v1-heavy'])('the frozen save %s loads beside the seventh friend', (name) => {
    const s = migrate(fixture(name), 1, JP_PACK);
    expect(validateState(s, JP_PACK)).toEqual([]);
    expect(s.friends.aiko === undefined || heartsOf(s, 'aiko') >= 0).toBe(true);
    for (const who of JP_PACK.friends.map((f) => f.id)) {
      expect(() => interactionRows(envOf(s), who)).not.toThrow();
      expect(() => friendActions(JP_PACK, s, view, who)).not.toThrow();
    }
    expect(() => doorsOpen(s, SCENARIOS)).not.toThrow();
  });
});

const heartsOf = (s: GameState, who: string): number => heartsForAp(s.friends[who]?.ap ?? 0);
