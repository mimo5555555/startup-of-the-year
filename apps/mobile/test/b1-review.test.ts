// Wave B1 adversarial review: regression tests for the bugs the review found (one describe per bug).
import './_fakeStorage';
import { describe, expect, it } from 'vitest';
import { JP_PACK, scenarioById } from '@lw/content';
import { BALANCE, createGameState, emptyFriend, reduce, type GameState, type InputEvent } from '@lw/game';
import { ctxOf, makeFacts } from '../../../packages/game/test/fixtures-1e';

const NOW = Date.UTC(2030, 0, 15);
const at = (friend: string, hearts: number): GameState => {
  const s = createGameState(JP_PACK, NOW);
  return { ...s, chapter: { ...s.chapter, n: 3 }, friends: { [friend]: { ...emptyFriend(s.clock.dayIndex), ap: BALANCE.ap.thresholds[hearts - 1] ?? 0, met: true } } };
};
const finish = (state: GameState, id: string, sessionId = `s-${id}`): GameState => {
  const sc = scenarioById(id)!;
  const facts = makeFacts({ scenarioId: id, characterId: sc.characterId, sessionId, ind: 4, ass: 0, done: sc.steps.length, total: sc.steps.length });
  return reduce(state, { t: 'conversation_done', facts } as InputEvent, ctxOf(JP_PACK)).state;
};
const visit = (state: GameState, place: string): GameState => reduce(state, { t: 'visit', place } as InputEvent, ctxOf(JP_PACK)).state;

describe('a hang-out or a visit finished below its heart pays nothing (the reducer checks the hearts as the rows do)', () => {
  it.each([
    ['hang_mio_photo', 'mio', 2],
    ['hang_yuki_jam', 'yuki', 2],
    ['hang_kenji_cook', 'kenji', 2],
    ['hang_aiko_wagashi', 'aiko', 2],
    ['home_mio', 'mio', 3],
    ['home_aiko', 'aiko', 3],
    ['home_kenji', 'kenji', 3],
  ])('%s below the heart: no AP, no keepsake, no item, no visit, no cooldown', (id, who, hearts) => {
    const s0 = at(who, hearts);
    const s = finish(s0, id);
    expect(s.friends[who]!.ap).toBe(s0.friends[who]!.ap);
    expect(s.friends[who]!.hangoutDay).toBeUndefined();
    expect(s.keepsakes).toEqual([]);
    expect(s.owned).toEqual(s0.owned);
    expect(s.stats.visits).toEqual([]);
    expect(s.stats.hangouts).toEqual({});
    expect(s.wallet.cash).toBe(s0.wallet.cash);
  });
  it('the same scenarios at their heart still pay (the gate is not too tight)', () => {
    const hang = finish(at('mio', 3), 'hang_mio_photo');
    expect(hang.friends.mio!.ap).toBeGreaterThan(at('mio', 3).friends.mio!.ap);
    expect(hang.keepsakes).toContain('photo_mio');
    const home = finish(at('kenji', 4), 'home_kenji');
    expect(home.friends.kenji!.ap).toBeGreaterThan(at('kenji', 4).friends.kenji!.ap);
    expect(home.keepsakes).toContain('hina_drawing');
    expect(home.stats.visits).toContain('home:kenji');
  });
  it('the genkan visit event of a home below ♥4 files nothing and unlocks no culture card', () => {
    const s3 = visit(at('mio', 3), 'home:mio');
    expect(s3.stats.visits).toEqual([]);
    expect(s3.culture.cc_shoesoff).toBeUndefined();
    const s4 = visit(at('mio', 4), 'home:mio');
    expect(s4.stats.visits).toEqual(['home:mio']);
    expect(s4.culture.cc_shoesoff).toBeDefined();
  });
  it('other visit places are not touched by the home gate', () => {
    expect(visit(at('mio', 0), 'festival').stats.visits).toEqual(['festival']);
  });
});

describe('Prepare never starts a home as a bare conversation (that would skip the genkan)', () => {
  it('a visit that is already on is not answered by a conversation of another home', async () => {
    const { useHome, beginVisit } = await import('../src/game/homeStore');
    const { useUi } = await import('../src/ui');
    const { talk } = await import('../src/screens/Prepare');
    useUi.getState().clearRequests();
    useUi.getState().endConvo();
    useHome.getState().end();
    expect(beginVisit('home_mio')).toBe(true);
    let went = '';
    talk('home_kenji', 'kenji', 'guided', (s) => (went = s));
    expect(went).toBe('world');
    expect(useUi.getState().convo, 'no conversation without the genkan').toBeNull();
    expect(useHome.getState().visit?.def.scenarioId, 'the visit in progress is untouched').toBe('home_mio');
    // with no visit on, the same call begins the visit of that home (the genkan), still without a conversation
    useHome.getState().end();
    talk('home_kenji', 'kenji', 'real', () => {});
    expect(useHome.getState().visit?.def.scenarioId).toBe('home_kenji');
    expect(useHome.getState().visit?.talk).toBe('real');
    expect(useUi.getState().convo).toBeNull();
    useHome.getState().end();
  });
  it('every other scenario still starts its conversation', async () => {
    const { useUi } = await import('../src/ui');
    const { talk } = await import('../src/screens/Prepare');
    useUi.getState().endConvo();
    talk('hang_mio_photo', 'mio', 'guided', () => {});
    expect(useUi.getState().convo?.scenarioId).toBe('hang_mio_photo');
    useUi.getState().endConvo();
  });
});
