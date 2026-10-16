// Hang-outs and home visits, the app's side (Release 2 wave B1): the doors, the cooldown, the genkan, the props' word cards, the keepsakes of a
// conversation, the plain-speech flag of a hang-out and the visit store. The 3D room and the panel are covered by tools/e2e/game/home.mjs.
import './_fakeStorage';
import { beforeEach, describe, expect, it } from 'vitest';
import { GENKAN, HOMES, JP_PACK, LEXICON, PROP_WORDS } from '@lw/content';
import { createGameState, emptyFriend, type GameState } from '@lw/game';
import { STRINGS } from '../src/i18n';
import { gameView } from '../src/game/selectors';
import { createConvoGame } from '../src/game/convoHooks';
import { visitFlags } from '../src/game/friendsLogic';
import {
  cooldownDays,
  cooldownText,
  doorsOpen,
  genkanLine,
  genkanPress,
  noteRewards,
  panelForced,
  propOfPick,
  propPick,
  propsFound,
  rewardsOf,
  unlockHint,
} from '../src/game/homeLogic';
import { beginVisit, isHomeScenario, useHome } from '../src/game/homeStore';
import type { TokyoWorld } from '@lw/world';
import { doorStatus, interactionRows, syncWorld, type InteractionEnv } from '../src/game/worldSync';

const NOW = Date.UTC(2030, 0, 15);
const profile = { name: 'Sam', level: 'A1' as const, goal: 'travel', age: 'adults' as const, createdAt: '2030-01-15T00:00:00.000Z' };
const view = gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: profile as never });

const AP = { h2: 80, h3: 150, h4: 240 };
const withFriend = (s: GameState, id: string, ap: number, more: Record<string, unknown> = {}): GameState => ({
  ...s,
  friends: { ...s.friends, [id]: { ...(s.friends[id] ?? emptyFriend(s.clock.dayIndex)), ap, met: true, ...more } },
});
const base = (ch = 3): GameState => {
  const s = createGameState(JP_PACK, NOW);
  return { ...s, chapter: { ...s.chapter, n: ch } };
};
const ALL = new Set(Object.values(JP_PACK.interactions).flat().map((i) => i.scenarioId).filter(Boolean) as string[]);
const envOf = (state: GameState): InteractionEnv => ({ pack: JP_PACK, state, view, scenarios: ALL, lessons: new Set() });

describe('doors', () => {
  it('open at 4 hearts, only for a home whose scenario is registered', () => {
    const at = (ap: number) => Object.fromEntries(doorsOpen(withFriend(base(), 'mio', ap), ALL));
    expect(at(AP.h3).mio).toBe(false);
    expect(at(AP.h4).mio).toBe(true);
    expect(Object.fromEntries(doorsOpen(withFriend(base(), 'mio', AP.h4), new Set())).mio).toBe(false);
  });
  it('covers exactly the three homes', () => {
    expect(doorsOpen(base(), ALL).map(([who]) => who).sort()).toEqual(['aiko', 'kenji', 'mio']);
  });
  it('a tap says the hearts it needs, then how long to wait, then lets the player in', () => {
    const s3 = withFriend(base(), 'mio', AP.h3);
    expect(doorStatus(envOf(s3), 'mio')).toMatchObject({ t: 'hearts', need: 4, have: 3 });
    const s4 = withFriend(base(), 'mio', AP.h4);
    expect(doorStatus(envOf(s4), 'mio').t).toBe('open');
    const recent = withFriend(base(), 'mio', AP.h4, { hangoutDay: s4.clock.dayIndex });
    expect(doorStatus(envOf(recent), 'mio')).toMatchObject({ t: 'wait', days: 3 });
    expect(doorStatus(envOf(s4), 'tanaka').t).toBe('none');
    expect(doorStatus(envOf(s4), null).t).toBe('none');
  });
});

describe('the doors in the world', () => {
  /** a world that only records what syncWorld tells it about the doors */
  const fake = () => {
    const doors: Record<string, boolean> = {};
    const noop = () => {};
    const world = new Proxy({ setDoorOpen: (who: string, open: boolean) => (doors[who] = open) } as Record<string, unknown>, { get: (t, k) => (k in t ? t[k as string] : noop) });
    return { world: world as unknown as TokyoWorld, doors };
  };
  it('syncWorld opens a door with the hearts and shuts it again', () => {
    const { world, doors } = fake();
    syncWorld(world, envOf(withFriend(base(), 'mio', AP.h4)), { completed: [], lessonsDone: [] });
    expect(doors).toEqual({ mio: true, aiko: false, kenji: false, dorm: true, flat: false });
    syncWorld(world, envOf(withFriend(withFriend(base(), 'mio', AP.h3), 'kenji', AP.h4)), { completed: [], lessonsDone: [] });
    expect(doors).toEqual({ mio: false, aiko: false, kenji: true, dorm: true, flat: false });
  });
});

describe('the one-per-3-days limit', () => {
  it('counts the days left, never below 0', () => {
    const s = base();
    const d = s.clock.dayIndex;
    expect(cooldownDays(s, 'mio')).toBe(0);
    expect(cooldownDays(withFriend(s, 'mio', 100, { hangoutDay: d }), 'mio')).toBe(3);
    expect(cooldownDays(withFriend(s, 'mio', 100, { hangoutDay: d - 2 }), 'mio')).toBe(1);
    expect(cooldownDays(withFriend(s, 'mio', 100, { hangoutDay: d - 9 }), 'mio')).toBe(0);
  });
  it('the hang-out row of the Talk list is locked with the days left, instead of a tap that pays nothing', () => {
    const s = withFriend(base(), 'mio', AP.h3);
    const free = interactionRows(envOf(s), 'mio').find((r) => r.it.id === 'mio_hang')!;
    expect(free.lock).toBeNull();
    const recent = withFriend(base(), 'mio', AP.h3, { hangoutDay: s.clock.dayIndex });
    const row = interactionRows(envOf(recent), 'mio').find((r) => r.it.id === 'mio_hang')!;
    expect(row.lock).toEqual({ wait: 3 });
  });
  it('has its own words for tomorrow and the day after', () => {
    const t = (k: string, v?: Record<string, string | number>) => `${k}${v ? JSON.stringify(v) : ''}`;
    expect(cooldownText(t as never, 1)).toBe('home.cooldown1');
    expect(cooldownText(t as never, 2)).toBe('home.cooldown2');
    expect(cooldownText(t as never, 3)).toBe('fv.hang.cooldown{"days":3}');
  });
});

describe('the genkan', () => {
  const none = { shoesOff: false, slippersOn: false };
  it('shoes, then slippers', () => {
    const a = genkanPress(none, 'shoes');
    expect(a).toEqual({ outcome: 'shoes', next: { shoesOff: true, slippersOn: false } });
    const b = genkanPress(a.next, 'slippers');
    expect(b).toEqual({ outcome: 'slippers', next: { shoesOff: true, slippersOn: true } });
  });
  it('slippers first is the gentle wrong, and changes nothing', () => {
    expect(genkanPress(none, 'slippers')).toEqual({ outcome: 'wrong', next: none });
  });
  it('a step that is done does nothing', () => {
    expect(genkanPress({ shoesOff: true, slippersOn: false }, 'shoes').outcome).toBe('noop');
    expect(genkanPress({ shoesOff: true, slippersOn: true }, 'slippers').outcome).toBe('noop');
  });
  it("answers in the friend's register", () => {
    expect(genkanLine('mio', 'wrong', true)?.ja).toBe(GENKAN.mio.wrong.casual.ja);
    expect(genkanLine('mio', 'wrong', false)?.ja.replace(/\|/g, '')).toBe('あっ、靴を脱いでください！');
    expect(genkanLine('kenji', 'ok', true)?.ja).toBe(GENKAN.kenji.ok.casual.ja);
    expect(genkanLine('nobody', 'wrong', false)).toBeNull();
  });
});

describe('the props', () => {
  it('a pick id names a prop of a home and its lexicon card', () => {
    const p = propOfPick('prop:mio_1r:kamera');
    expect(p?.home.scenarioId).toBe('home_mio');
    expect(p?.surface).toBe('カメラ');
    expect(LEXICON.get(p!.surface)).toBeTruthy();
  });
  it('refuses any other id, an unknown prop and a prop of another home', () => {
    for (const id of ['genkan:shoes', 'prop:mio_1r:zzz', 'prop:nowhere:kamera', 'prop:mio_1r:kotatsu', 'door:mio', '']) expect(propOfPick(id)).toBeNull();
  });
  it('every prop of every home is a lexicon word with an English and an Arabic card', () => {
    for (const home of Object.values(HOMES))
      for (const prop of home.props) {
        const e = LEXICON.get(PROP_WORDS[prop]);
        expect(e, `${home.stage}:${prop}`).toBeTruthy();
        expect(e!.en && e!.ar).toBeTruthy();
        expect(propOfPick(propPick(home.stage, prop))?.surface).toBe(PROP_WORDS[prop]);
      }
  });
  it('counts the props found in the room, not words found elsewhere', () => {
    const home = HOMES.home_mio;
    expect(propsFound(home, [])).toBe(0);
    expect(propsFound(home, [propPick('mio_1r', 'kamera'), propPick('mio_1r', 'mado'), 'sign:12', propPick('kenji_flat', 'e')])).toBe(2);
  });
});

describe('the panel switch', () => {
  it('?panel=1 forces the fallback', () => {
    expect(panelForced('?panel=1')).toBe(true);
    expect(panelForced('?x=1&panel=1')).toBe(true);
    expect(panelForced('')).toBe(false);
    expect(panelForced('?panel=0')).toBe(false);
  });
});

describe('the keepsakes of a conversation', () => {
  it('remembers what a conversation added, and nothing when it added nothing', () => {
    const before = base();
    const after = { ...before, keepsakes: [...before.keepsakes, 'photo_mio'] };
    noteRewards('s_a', before, after);
    noteRewards('s_b', after, after);
    expect(rewardsOf('s_a')).toEqual(['photo_mio']);
    expect(rewardsOf('s_b')).toEqual([]);
    expect(rewardsOf('s_unknown')).toEqual([]);
  });
});

describe('plain speech in a hang-out or a visit', () => {
  const meta = (id: string) => JP_PACK.scenarioMeta.find((m) => m.id === id);
  it('casual only once the friend has switched', () => {
    expect(visitFlags(JP_PACK, withFriend(base(), 'mio', AP.h4), meta('hang_mio_photo'))).toEqual({ casual: true });
    expect(visitFlags(JP_PACK, withFriend(base(), 'mio', AP.h3), meta('home_mio'))).toEqual({ casual: true });
    expect(visitFlags(JP_PACK, withFriend(base(), 'aiko', AP.h4), meta('hang_aiko_wagashi'))).toEqual({});
    expect(visitFlags(JP_PACK, withFriend(base(), 'mio', 0), meta('hang_mio_photo'))).toEqual({});
  });
  it('is empty for every other scenario', () => {
    expect(visitFlags(JP_PACK, withFriend(base(), 'mio', AP.h4), meta('cafe'))).toEqual({});
    expect(visitFlags(JP_PACK, withFriend(base(), 'mio', AP.h4), undefined)).toEqual({});
  });
  it('reaches the session as a flag, for the hang-out and the home', () => {
    for (const [scenarioId, friend] of [['hang_mio_photo', 'mio'], ['home_kenji', 'kenji'], ['hang_yuki_jam', 'yuki']] as const) {
      const make = (ap: number) => {
        const state = withFriend(base(), friend, ap, { flags: ['casual'] });
        return createConvoGame({ pack: JP_PACK, scenarioId, sessionId: 's_x', state: () => state, view: () => ({ vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() }, discovered: [], lessonsDone: [], streakDays: 0, profile: { age: 'adults', goal: 'casual', level: 'A1', createdAt: profile.createdAt } }), commit: () => ({ state, derived: [], effects: [] }) as never });
      };
      expect(make(AP.h4).flags.casual).toBe(true);
    }
  });
});

describe('the visit store', () => {
  beforeEach(() => useHome.getState().end());
  it('starts for a home only, and ignores a second tap while it is on', () => {
    expect(isHomeScenario('home_mio')).toBe(true);
    expect(isHomeScenario('hang_mio_photo')).toBe(false);
    expect(beginVisit('cafe')).toBe(false);
    expect(useHome.getState().visit).toBeNull();
    expect(beginVisit('home_mio')).toBe(true);
    expect(beginVisit('home_kenji')).toBe(false);
    expect(useHome.getState().visit).toMatchObject({ phase: 'enter', shoesOff: false, slippersOn: false, done: false });
    expect(useHome.getState().visit?.def.scenarioId).toBe('home_mio');
  });
  it('patches and ends', () => {
    beginVisit('home_aiko', 'real');
    useHome.getState().patch({ phase: 'genkan', shoesOff: true });
    expect(useHome.getState().visit).toMatchObject({ phase: 'genkan', shoesOff: true, talk: 'real' });
    useHome.getState().end();
    expect(useHome.getState().visit).toBeNull();
    useHome.getState().patch({ phase: 'inside' });
    expect(useHome.getState().visit).toBeNull();
  });
});

describe('strings', () => {
  const keys = ['home.shoesOff', 'home.slippers', 'home.cooldown1', 'home.cooldown2', 'home.door.invite', 'home.talk', 'home.leave.ask', 'home.stay', 'fv.hang.cooldown', 'fv.hang.locked', 'fv.props.found', 'fv.genkan.leave'];
  it('exist in English and Arabic', () => {
    for (const k of keys) {
      expect(STRINGS.en[k as never], k).toBeTruthy();
      expect(STRINGS.ar[k as never], k).toBeTruthy();
    }
  });
});

describe('what a new heart opens (the debrief line under "likes you more now")', () => {
  it('3 hearts open the hang-out, 4 the invitation home', () => {
    expect(unlockHint('mio', 2, 3)).toBe('hang');
    expect(unlockHint('mio', 3, 4)).toBe('home');
    expect(unlockHint('aiko', 3, 4)).toBe('home');
    expect(unlockHint('kenji', 2, 3)).toBe('hang');
  });
  it('a jump over both hearts names the home; a heart without a built hang-out or home says nothing', () => {
    expect(unlockHint('mio', 2, 4)).toBe('home');
    expect(unlockHint('yuki', 2, 3)).toBe('hang');
    expect(unlockHint('yuki', 3, 4)).toBeNull(); // Yuki has a hang-out but no home yet
    expect(unlockHint('tanaka', 2, 3)).toBeNull();
    expect(unlockHint('mio', 1, 2)).toBeNull();
    expect(unlockHint('mio', 4, 5)).toBeNull();
  });
  it('both strings exist in English and Arabic', () => {
    for (const k of ['fv.unlock.hang', 'fv.unlock.home'] as const) {
      expect(STRINGS.en[k]).toContain('{name}');
      expect(STRINGS.ar[k]).toContain('{name}');
    }
  });
});
