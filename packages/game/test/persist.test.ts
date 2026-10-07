import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { reconcile } from '../src/ledger';
import { GAME_STORE_VERSION, gameStorageKey, migrate, parseSaved, seedFromLegacy, serializeState } from '../src/persist';
import { createGameState, reduce } from '../src/reducer';
import { validateState } from '../src/validate';
import type { GamePack, GameState } from '../src/types';
import { ctx1f, dayAt, facts1f, NOW, pack1f, view1f } from './fixtures-1f';

const pack = pack1f();
const saved = (name: string): unknown => JSON.parse(readFileSync(new URL(`./saves/${name}.json`, import.meta.url), 'utf8'));

describe('storage key and text', () => {
  it('is lw.game.<packId>.v1 and round-trips through JSON', () => {
    expect(GAME_STORE_VERSION).toBe(1);
    expect(gameStorageKey('jp')).toBe('lw.game.jp.v1');
    const s = createGameState(pack, NOW);
    expect(parseSaved(serializeState(s))).toEqual(s);
  });
  it('parseSaved never throws and reads nothing from nothing or broken text', () => {
    for (const raw of [undefined, null, '', '{', 'not json', '[1,', '\u0000']) expect(parseSaved(raw as never)).toBeUndefined();
    expect(parseSaved('null')).toBeNull();
  });
});

describe('migrate: frozen v1 fixtures', () => {
  it('empty: undefined, null and {} all give a valid fresh state, not yet seeded', () => {
    for (const blank of [undefined, null, {}, saved('v1-empty')]) {
      const s = migrate(blank, 1, pack);
      expect(validateState(s, pack), JSON.stringify(blank)).toEqual([]);
      expect(s.wallet).toEqual({ cash: 3000, ic: 0, points: 0 });
      expect(s.chapter.n).toBe(1);
      expect(s.seeded).toBe(false);
    }
    // an empty clock is re-anchored by the first event without a rollover
    const first = reduce(migrate({}, 1, pack), { t: 'day_observed', nowMs: NOW }, ctx1f(pack, NOW)).state;
    expect(first.clock).toMatchObject({ dayIndex: 0, lastLocalDate: '2030-01-15' });
  });

  it('typical: a played save comes back unchanged and validates', () => {
    const raw = saved('v1-typical') as GameState;
    const s = migrate(raw, 1, pack);
    expect(s).toEqual(raw);
    expect(validateState(s, pack)).toEqual([]);
    expect(reconcile(s, 3000).ok).toBe(true);
  });

  it('heavy: full rings, a long game, a rich wallet: unchanged and valid', () => {
    const raw = saved('v1-heavy') as GameState;
    expect(raw.ledger).toHaveLength(BALANCE.ledger.entries);
    expect(raw.seen).toHaveLength(BALANCE.ledger.seen);
    const s = migrate(raw, 1, pack);
    expect(s).toEqual(raw);
    expect(validateState(s, pack)).toEqual([]);
  });

  it('corrupt: every damaged field is repaired, nothing throws, the result validates', () => {
    const raw = saved('v1-corrupt');
    const s = migrate(raw, 1, pack);
    expect(validateState(s, pack)).toEqual([]);
    expect(s.packId).toBe('jp');
    expect(s.clock).toMatchObject({ dayIndex: 0, lastLocalDate: '', activeDays: 1, lastActiveDay: 0 });
    // wallet: negative cash to 0, ic over the cap clamped, non-number points 0; totals rebuilt so it reconciles
    expect(s.wallet).toEqual({ cash: 0, ic: 20_000, points: 0 }); // chapter 42 reads as Free Walk, whose IC cap is 20,000
    expect(reconcile(s, 3000).ok).toBe(true);
    expect(s.ledger.map((e) => e.id)).toEqual(['loop:a']);
    expect(s.ledger[0]!.delta).toBe(12);
    expect(s.seen).toEqual(['a', 'b']);
    expect(s.pay.day).toBe('d0');
    expect(s.runs.konbini).toMatchObject({ count: 0, stars: 3, bestShare: 1 });
    expect(s.stats.purchases).toBe(0);
    expect(s.owned.phone_used).toEqual({ qty: 1, day: 'd1' }); // a single-ownership item never exceeds one
    expect(s.owned.bike_mamachari).toBeUndefined();
    expect(s.home).toEqual({ tier: 'dorm', placed: {} });
    expect(s.chapter.n).toBe(9); // above the last chapter: Free Walk
    expect(s.chapter.done).toEqual({ c1_1: 'd0' });
    expect(s.chapter.easier).toEqual(['c1_5']);
    expect(s.chapter.began.dayIndex).toBe(0);
    expect(s.dream).toEqual({ id: 'phone_pal', steps: { pp_s1: 'd1' }, done: false });
    expect(s.friends.mio).toMatchObject({ ap: 0, unread: 1, facts: { hobby: 'anime' } });
    expect(s.jobs.job_konbini!.rank).toBe(4);
    expect(s.prep).toEqual({ p_konbini_1: { s: 'ready', at: 2 } });
    expect(s.titles).toEqual(['t_newcomer']);
    expect(s.activeTitle).toBeNull();
    expect(s.audio).toEqual({ sttConsent: 'unset', micPref: 'auto', listenPref: 'on', ttsRateScale: 1.5 });
    expect(s.flags).toEqual({ welcomeSeenDay: 4 });
    expect(s.seeded).toBe(false);
    expect(s.daily.goals.map((g) => g.id)).toEqual(['g_buy']);
    expect(s.daily.counters[0]).toEqual({ purchase: 2 });
  });

  it('unknown ids and fields are parked under _extra, never dropped', () => {
    const s = migrate(saved('v1-corrupt'), 1, pack);
    const ids = (s._extra as { ids: Record<string, Record<string, unknown>> }).ids;
    expect(ids.owned).toEqual({ old_lamp: { qty: 1, day: 'd2' }, older_item: { qty: 2, day: 'd0' } });
    expect(ids.runs).toHaveProperty('retired_scenario');
    expect(ids.friends).toHaveProperty('retired_friend');
    expect(ids.jobs).toHaveProperty('job_retired');
    expect(ids.culture).toEqual({ cc_gone: 'd2' });
    expect(ids.prep).toHaveProperty('p_gone');
    expect(ids.done).toEqual({ ghost_objective: 'd1' });
    expect(ids.titles).toEqual(['t_gone']);
    expect(ids.beats).toEqual(['b_gone']);
    expect(ids.dreamSteps).toEqual({ gone_step: 'd2' });
    expect((s._extra as { fields: Record<string, unknown> }).fields).toEqual({ carried: 1, futureField: { keep: 'me' } });
  });

  it('is idempotent: migrating a migrated state changes nothing', () => {
    for (const name of ['v1-typical', 'v1-heavy', 'v1-corrupt', 'v1-empty']) {
      const once = migrate(saved(name), 1, pack);
      expect(migrate(JSON.parse(JSON.stringify(once)), 1, pack), name).toEqual(once);
    }
  });

  it('never throws on any input shape', () => {
    const junk: unknown[] = [0, 1, 'x', true, [], [1, 2], () => 1, { wallet: 'x' }, { clock: [] }, { chapter: null, friends: 3, owned: [] }, { _extra: 5 }, { v: 99, wallet: { cash: 1e30 } }, { totals: { checksum: 5 } }];
    for (const j of junk) {
      const s = migrate(j, 1, pack);
      expect(validateState(s, pack), JSON.stringify(j)).toEqual([]);
    }
  });

  it('a save from a newer build is read best-effort and keeps its unknown fields', () => {
    const raw = { ...(saved('v1-typical') as object), v: 2, newThing: { a: 1 } };
    const s = migrate(raw, 2, pack);
    expect(s.v).toBe(1);
    expect((s._extra as { fields: Record<string, unknown> }).fields.newThing).toEqual({ a: 1 });
    expect(s.wallet).toEqual((saved('v1-typical') as GameState).wallet);
  });

  it('keeps a text that is no object at all, so the app can offer it for download', () => {
    const s = migrate('{"half": ', 1, pack);
    expect((s._extra as { fields: { unreadable: string } }).fields.unreadable).toBe(JSON.stringify('{"half": '));
    expect(s.wallet.cash).toBe(3000);
  });
});

describe('migrate: renames, restoring, derived caches', () => {
  it('applies idAliases to owned items, runs and friends, merging what meets', () => {
    const renamed: GamePack = pack1f({ idAliases: { old_phone: 'phone_used', old_cafe: 'cafe', old_mio: 'mio' } });
    const raw = {
      ...(saved('v1-empty') as object),
      owned: { old_phone: { qty: 1, day: 'd4' }, phone_used: { qty: 1, day: 'd2' } },
      runs: { old_cafe: { count: 2, stars: 1, bestIndependent: 4 }, cafe: { count: 1, stars: 2, bestIndependent: 1, complete: true } },
      friends: { old_mio: { ap: 90 }, mio: { ap: 40 } },
    };
    const s = migrate(raw, 1, renamed);
    // two copies that meet in one single-ownership item stay one, with the earlier day
    expect(s.owned.phone_used).toEqual({ qty: 1, day: 'd2' });
    expect(s.owned.old_phone).toBeUndefined();
    expect(s.runs.cafe).toMatchObject({ count: 3, stars: 2, bestIndependent: 4, complete: true });
    expect(s.friends.mio!.ap).toBe(90);
    expect(s._extra).toBeUndefined();
  });

  it('brings parked ids back when the pack knows them again', () => {
    const raw = saved('v1-corrupt');
    const first = migrate(raw, 1, pack);
    const later = pack1f({ items: [...pack.items, { ...pack.items[0]!, id: 'old_lamp', shop: 'station' }], shops: pack.shops.map((s) => (s.id === 'station' ? { ...s, sells: [...s.sells, 'old_lamp'] } : s)) });
    const back = migrate(JSON.parse(JSON.stringify(first)), 1, later);
    expect(back.owned.old_lamp).toEqual({ qty: 1, day: 'd2' });
    expect((back._extra as { ids: { owned: Record<string, unknown> } }).ids.owned).toEqual({ older_item: { qty: 2, day: 'd0' } });
  });

  it('re-derives the chapter.completed cache from the objectives, whatever was saved', () => {
    const typical = saved('v1-typical') as GameState;
    const tampered = { ...typical, chapter: { ...typical.chapter, completed: [5, 7, 7] } };
    const s = migrate(tampered, 1, pack);
    expect(s.chapter.completed).toEqual([1]);
    expect(validateState(s, pack)).toEqual([]);
    // a pack edit that adds a chapter before the current one: the cache follows
    const swallowed = migrate({ ...typical, chapter: { ...typical.chapter, n: 4, completed: [] } }, 1, pack);
    expect(swallowed.chapter.completed).toEqual([1, 2, 3]);
  });

  it('keeps the wallet within the cap of the chapter (IC 3,000 early, 20,000 from chapter 5)', () => {
    const early = migrate({ ...(saved('v1-empty') as object), wallet: { cash: 1, ic: 15_000, points: 0 }, chapter: { n: 2 } }, 1, pack);
    expect(early.wallet.ic).toBe(3000);
    const late = migrate({ ...(saved('v1-empty') as object), wallet: { cash: 1, ic: 15_000, points: 0 }, chapter: { n: 5 } }, 1, pack);
    expect(late.wallet.ic).toBe(15_000);
  });

  it('a migrated state plays on: the reducer accepts it and the money still reconciles', () => {
    const s = migrate(saved('v1-corrupt'), 1, pack);
    const r = reduce(s, { t: 'conversation_done', facts: facts1f({ ind: 4 }) }, ctx1f(pack, dayAt(3), view1f()));
    expect(reconcile(r.state, 3000).ok).toBe(true);
    expect(validateState(r.state, pack)).toEqual([]);
  });
});

describe('seedFromLegacy (§14.7)', () => {
  const legacy = { completed: { konbini: { count: 2, best: 100 }, cafe: { count: 1, best: 70 }, ramen: { count: 0, best: 0 }, retired: { count: 3, best: 100 } } };
  const run = (s: GameState) => seedFromLegacy(s, pack, legacy);

  it('files met friends and the stars of the old runs, with no retroactive yen', () => {
    const base = createGameState(pack, NOW);
    const s = run(base);
    expect(s.seeded).toBe(true);
    expect(s.runs.konbini).toMatchObject({ count: 2, stars: 2, complete: false });
    expect(s.runs.cafe).toMatchObject({ count: 1, stars: 1 });
    expect(s.runs.ramen).toBeUndefined();
    expect(s.friends.tanaka?.met).toBe(true);
    expect(s.friends.tanaka!.ap).toBe(0);
    expect(s.wallet).toEqual(base.wallet);
    expect(s.totals).toEqual(base.totals);
    expect(s.ledger).toEqual([]);
    expect(validateState(s, pack)).toEqual([]);
  });
  it('is idempotent: a second seed (even with other data) does nothing', () => {
    const once = run(createGameState(pack, NOW));
    expect(run(once)).toBe(once);
    expect(seedFromLegacy(once, pack, { completed: { park: { count: 5, best: 100 } } })).toBe(once);
  });
  it('keeps scenarios the pack does not know under _extra', () => {
    const s = run(createGameState(pack, NOW));
    expect((s._extra as { fields: { legacyCompleted: unknown } }).fields.legacyCompleted).toEqual({ retired: { count: 3, best: 100 } });
    expect(s.runs.retired).toBeUndefined();
    // and a reload keeps it, with the seed marker
    const back = migrate(JSON.parse(serializeState(s)), 1, pack);
    expect(back.seeded).toBe(true);
    expect((back._extra as { fields: { legacyCompleted: unknown } }).fields.legacyCompleted).toEqual({ retired: { count: 3, best: 100 } });
  });
  it('seeded stars are not paid again: a first new conversation only pays the stars above the seed', () => {
    const s = run(createGameState(pack, NOW));
    const r = reduce(s, { t: 'conversation_done', facts: facts1f({ ind: 4, done: 3, total: 3, accuracy: 90 }) }, ctx1f(pack, NOW, view1f()));
    const star = r.state.ledger.filter((e) => e.kind === 'star').map((e) => e.id);
    expect(star).toEqual(['star:konbini:3']);
  });
  it('an empty legacy store still sets the marker', () => {
    expect(seedFromLegacy(createGameState(pack, NOW), pack, { completed: {} }).seeded).toBe(true);
  });
});
