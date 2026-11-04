// Manners (所作, docs/ROADMAP.md) over the real pack: a manner fits a line that contains one of its phrases (kana or kanji, any punctuation);
// done with a met friend it gives BALANCE.ap.manner once per friend per day; not owned, a stranger, a line that does not fit, or a second
// one the same day give nothing. A manner is bought like any Goen item, and never touches yen.
import { describe, expect, it } from 'vitest';
import { BALANCE, createGameState, earnGoen, mannerFits, ownedManners, reduce, validateState, type GameState, type GameView, type InputEvent } from '@lw/game';
import { emptyFriend } from '../../game/src/defaults';
import { JP_PACK } from '../src';

const pack = JP_PACK;
const DAY = 86_400_000;
const T0 = new Date(2026, 9, 21, 12).getTime();
const view = (): GameView => ({
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'travel', level: 'A1', createdAt: '' },
});
const run = (s: GameState, ev: InputEvent, now = T0) => reduce(s, ev, { pack, now, view: view(), rng: () => 0.3 });
const fresh = (): GameState => run(createGameState(pack, T0), { t: 'day_observed', nowMs: T0 }).state;
/** Mio met, the deep bow bought */
function ready(): GameState {
  let s = earnGoen(fresh(), 'test:m', 'chapter', 100, 0).state;
  s = run(s, { t: 'goen_spend', itemId: 'manner_ojigi', id: 'b' }).state;
  s = { ...s, friends: { ...s.friends, mio: { ...(s.friends.mio ?? emptyFriend(s.clock.dayIndex)), met: true, ap: 25 } } };
  return s;
}

describe('manners', () => {
  it('a line fits when it contains one of the phrases, in kana or kanji', () => {
    expect(mannerFits(pack, 'manner_ojigi', '本当にありがとうございます！')).toBe(true);
    expect(mannerFits(pack, 'manner_ojigi', 'よろしくお願いします。')).toBe(true);
    expect(mannerFits(pack, 'manner_ojigi', 'またね')).toBe(false);
    expect(mannerFits(pack, 'manner_wave', 'じゃあね、また明日！')).toBe(true);
    expect(mannerFits(pack, 'manner_itadakimasu', 'イタダキマス')).toBe(true);
    expect(mannerFits(pack, 'manner_ryote', 'これ、どうぞ。')).toBe(true);
    expect(mannerFits(pack, 'nope', 'ありがとう')).toBe(false);
  });

  it('bought at the shrine like any Goen item; listed as owned', () => {
    const s = ready();
    expect(ownedManners(pack, s).map((m) => m.id)).toEqual(['manner_ojigi']);
    expect(validateState(s, pack)).toEqual([]);
  });

  it('with a met friend: a little friendship once a day; nothing for a stranger, a wrong line, or a manner not owned', () => {
    let s = ready();
    const ap0 = s.friends.mio!.ap;
    const r = run(s, { t: 'manner_used', itemId: 'manner_ojigi', characterId: 'mio', text: 'ありがとうございます。' });
    expect(r.state.friends.mio!.ap).toBe(ap0 + BALANCE.ap.manner);
    expect(r.derived).toContainEqual(expect.objectContaining({ t: 'ap_gained', friendId: 'mio', ap: BALANCE.ap.manner }));
    expect(r.state.wallet).toEqual(s.wallet);
    s = r.state;
    // the same day again: nothing
    expect(run(s, { t: 'manner_used', itemId: 'manner_ojigi', characterId: 'mio', text: 'ありがとう' }).state.friends.mio!.ap).toBe(ap0 + BALANCE.ap.manner);
    // a wrong line, a manner not owned, a shop clerk: nothing
    const s2 = ready();
    expect(run(s2, { t: 'manner_used', itemId: 'manner_ojigi', characterId: 'mio', text: 'またね' }).state.friends.mio!.ap).toBe(ap0);
    expect(run(s2, { t: 'manner_used', itemId: 'manner_wave', characterId: 'mio', text: 'またね' }).state.friends.mio!.ap).toBe(ap0);
    expect(run(s2, { t: 'manner_used', itemId: 'manner_ojigi', characterId: 'daichi', text: 'ありがとうございます' }).state.friends.daichi).toBeUndefined();
    // the next day counts again
    const t1 = T0 + DAY;
    s = run(s, { t: 'day_observed', nowMs: t1 }, t1).state;
    expect(run(s, { t: 'manner_used', itemId: 'manner_ojigi', characterId: 'mio', text: 'すみません' }, t1).state.friends.mio!.ap).toBe(ap0 + 2 * BALANCE.ap.manner);
  });
});
