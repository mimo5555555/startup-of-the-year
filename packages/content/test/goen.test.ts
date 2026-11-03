// Goen stage 1 over the real pack (docs/GOEN.md): the catalog, earn rules, the spend (once, with enough balance), idempotency, the migration of
// an old save, the streak charm, the season window and tiers, the Kyoto Journey and its fare, and the integrity rule: Goen never touches the
// yen wallet, the yen ledger, the chapter, the objectives or the hearts.
import { describe, expect, it } from 'vitest';
import { touchStreak } from '@lw/core';
import {
  BALANCE,
  canSpend,
  createGameState,
  earnGoen,
  goenCatalog,
  journeyView,
  migrate,
  reconcileGoen,
  reduce,
  seasonView,
  validatePack,
  validateState,
  type ConversationFacts,
  type GameState,
  type GameView,
  type InputEvent,
} from '@lw/game';
import { JP_PACK } from '../src';
import { GOEN_CATALOG, SEASON_AUTUMN } from '../src/tokyo/game/goen';
import { JOURNEY_KYOTO, KYOTO_FARE, KYOTO_PRICES, TRIP_KYOTO } from '../src/tokyo/game/journeys';

const pack = JP_PACK;
const AUTUMN = new Date(2026, 9, 20, 12).getTime();
const WINTER = new Date(2027, 0, 20, 12).getTime();
const view = (streakDays = 0): GameView => ({
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays,
  profile: { age: 'adults', goal: 'travel', level: 'A1', createdAt: '' },
});
const run = (s: GameState, ev: InputEvent, now = AUTUMN, v = view()) => reduce(s, ev, { pack, now, view: v, rng: () => 0.3 });
const fresh = (now = AUTUMN): GameState => run(createGameState(pack, now), { t: 'day_observed', nowMs: now }, now).state;
const rich = (s: GameState, n: number): GameState => earnGoen(s, `test:${n}`, 'chapter', n, 0).state;
/** What Goen must never change. */
const untouched = (s: GameState) => ({ wallet: s.wallet, totals: s.totals, ledger: s.ledger, chapter: s.chapter, friends: s.friends });

function facts(scenarioId: string, own: number, more: Partial<ConversationFacts> = {}): ConversationFacts {
  return {
    sessionId: `s_${scenarioId}_${own}_${more.mode ?? 'guided'}`,
    scenarioId,
    characterId: 'hanako',
    mode: 'guided',
    abandoned: false,
    durationSec: 60,
    goalDone: 1,
    goalTotal: 1,
    turns: Array.from({ length: own }, (_, i) => ({ id: i, cls: 'I' as const, credit: 1, substantive: true, contentTokens: 3, stepIds: [], norm: 'x', newWords: [], words: i === 0 ? ['秋', '紅葉'] : [] })),
    fallbacks: 0,
    hintUses: 0,
    accuracy: 100,
    requestsPolite: true,
    prepared: false,
    remembered: {},
    ...more,
  };
}

describe('the catalog and the pack', () => {
  it('has the six stage-1 rows at the spec prices; every look is a Goen-only item; the pack validates at level 4', () => {
    expect(GOEN_CATALOG.map((c) => [c.id, c.kind, c.price])).toEqual([
      ['journey_kyoto', 'journey', 250],
      ['season_autumn_premium', 'season', 150],
      ['kimono_momiji', 'cosmetic', 120],
      ['room_momiji', 'cosmetic', 60],
      ['ride_sakura', 'cosmetic', 50],
      ['omamori_streak', 'charm', 30],
    ]);
    for (const c of GOEN_CATALOG) expect(c.wish.ja.replace(/\|/g, ''), c.id).toMatch(/ますように。$/);
    expect(SEASON_AUTUMN.tasks).toHaveLength(8);
    expect(SEASON_AUTUMN.tiers).toHaveLength(8);
    expect(pack.fares.kyoto).toBe(KYOTO_FARE);
    expect(KYOTO_FARE * 2).toBe(3600);
    expect(pack.menu.find((m) => m.id === 'kyoto_temple:goshuin')!.price).toBe(KYOTO_PRICES.goshuin);
    expect(pack.items.find((i) => i.id === 'g_yatsuhashi')!.price).toBe(KYOTO_PRICES.yatsuhashi);
    expect(validatePack(pack, { level: 4 }).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('a purchase at a spoken Kyoto counter counts for the daily "Buy something in Japanese"; a vending machine does not', () => {
    const s = fresh();
    const day = s.clock.dayIndex;
    const set = pack.menu.find((m) => m.id === 'kyoto_cafe:set')!;
    const kyoto = run(s, { t: 'purchase', sessionId: 'k1', n: 1, shopId: 'kyoto_cafe', itemId: set.id, qty: 1, total: set.price, method: 'cash', lines: [] }).state;
    expect(kyoto.wallet.cash).toBe(s.wallet.cash - set.price);
    expect(kyoto.daily.counters[day]?.purchase).toBe(1);
    expect(kyoto.stats.purchases).toBe(s.stats.purchases + 1);
    const drink = pack.menu.find((m) => m.shop === 'vending')!;
    const machine = run(s, { t: 'purchase', sessionId: 'v1', n: 1, shopId: 'vending', itemId: drink.id, qty: 1, total: drink.price, method: 'cash', lines: [] }).state;
    expect(machine.daily.counters[day]?.purchase ?? 0).toBe(0);
  });

  it('a Goen look cannot be bought for yen', () => {
    const s = fresh();
    const r = run(s, { t: 'purchase', sessionId: 'p1', n: 1, shopId: 'shrine', itemId: 'kimono_momiji', qty: 1, total: 0, method: 'cash', lines: [] });
    expect(r.state.owned.kimono_momiji).toBeUndefined();
  });
});

describe('earning', () => {
  it('a completed chapter pays +25 once; the capstone in Real mode with 5 own lines +30 once; the Letter +20 once', () => {
    // out of the season's window, so no season tier adds Goen on the way
    const run = (st: GameState, ev: InputEvent) => reduce(st, ev, { pack, now: WINTER, view: view(), rng: () => 0.3 });
    let s = fresh(WINTER);
    s = { ...s, flags: { dev: true } };
    s = run(s, { t: 'dev', cmd: 'advance_chapter' }).state;
    expect(s.chapter.completed).toContain(1);
    expect(s.goen.balance).toBe(BALANCE.goen.chapter);
    s = run(s, { t: 'day_observed', nowMs: WINTER + 1 }).state;
    expect(s.goen.balance).toBe(BALANCE.goen.chapter);
    const b = s.goen.balance;
    s = run(s, { t: 'conversation_done', facts: facts('matsuri_speech', 4, { mode: 'real' }) }).state;
    expect(s.goen.balance).toBe(b);
    s = run(s, { t: 'conversation_done', facts: facts('matsuri_speech', 5, { mode: 'real' }) }).state;
    expect(s.goen.balance).toBe(b + BALANCE.goen.capstone);
    s = run(s, { t: 'conversation_done', facts: { ...facts('matsuri_speech', 6, { mode: 'real' }), sessionId: 'again' } }).state;
    expect(s.goen.balance).toBe(b + BALANCE.goen.capstone);
    const own = Array.from({ length: 5 }, (_, i) => ({ ja: `わたしは${i}です。`, assisted: false }));
    s = run(s, { t: 'letter_saved', sentences: own }).state;
    s = run(s, { t: 'letter_saved', sentences: own }).state;
    expect(s.goen.balance).toBe(b + BALANCE.goen.capstone + BALANCE.goen.letter);
    expect(reconcileGoen(s).ok).toBe(true);
  });

  it('the speaking streak pays +20 at each multiple of 7, once (a stale view the next day pays nothing), again after a break', () => {
    let s = fresh();
    s = run(s, { t: 'day_observed', nowMs: AUTUMN }, AUTUMN, view(7)).state;
    expect(s.goen.balance).toBe(20);
    s = run(s, { t: 'day_observed', nowMs: AUTUMN + 86_400_000 }, AUTUMN + 86_400_000, view(7)).state;
    s = run(s, { t: 'day_observed', nowMs: AUTUMN + 2 * 86_400_000 }, AUTUMN + 2 * 86_400_000, view(8)).state;
    expect(s.goen.balance).toBe(20);
    s = run(s, { t: 'day_observed', nowMs: AUTUMN + 9 * 86_400_000 }, AUTUMN + 9 * 86_400_000, view(14)).state;
    expect(s.goen.balance).toBe(40);
    s = run(s, { t: 'day_observed', nowMs: AUTUMN + 10 * 86_400_000 }, AUTUMN + 10 * 86_400_000, view(1)).state;
    s = run(s, { t: 'day_observed', nowMs: AUTUMN + 16 * 86_400_000 }, AUTUMN + 16 * 86_400_000, view(7)).state;
    expect(s.goen.balance).toBe(60);
  });
});

describe('spending', () => {
  it('succeeds only with enough Goen, once per item, and never touches the wallet, the yen ledger, the chapter, the objectives or the hearts', () => {
    let s = fresh();
    expect(canSpend(pack, s, view(), 'journey_kyoto', AUTUMN)).toEqual({ ok: false, reason: 'funds' });
    const poor = run(s, { t: 'goen_spend', itemId: 'journey_kyoto', id: 'a' });
    expect(poor.state.goen).toEqual(s.goen);
    expect(poor.derived).toEqual([]);
    s = rich(s, 500);
    const before = untouched(s);
    const r = run(s, { t: 'goen_spend', itemId: 'journey_kyoto', id: 'a' });
    expect(r.state.goen.balance).toBe(250);
    expect(r.state.goen.owned.journey_kyoto).toBeDefined();
    expect(r.derived).toContainEqual({ t: 'goen_owned', itemId: 'journey_kyoto' });
    expect(untouched(r.state)).toEqual(before);
    expect(r.state.goen.ledger.at(-1)).toMatchObject({ id: 'goen:spend:journey_kyoto', delta: -250, kind: 'spend' });
    // a replay and a second purchase of an owned item change nothing
    expect(run(r.state, { t: 'goen_spend', itemId: 'journey_kyoto', id: 'a' }).state.goen).toEqual(r.state.goen);
    expect(run(r.state, { t: 'goen_spend', itemId: 'journey_kyoto', id: 'b' }).state.goen).toEqual(r.state.goen);
    expect(reconcileGoen(r.state).ok).toBe(true);
    expect(validateState(r.state, pack)).toEqual([]);
  });

  it('a look is granted into the inventory at the coin toss (the Wardrobe and the placer read it there)', () => {
    let s = rich(fresh(), 300);
    s = run(s, { t: 'goen_spend', itemId: 'kimono_momiji', id: 'k' }).state;
    s = run(s, { t: 'goen_spend', itemId: 'room_momiji', id: 'r' }).state;
    expect(s.owned.kimono_momiji?.qty).toBe(1);
    expect(s.owned.room_momiji?.qty).toBe(1);
    expect(s.goen.balance).toBe(300 - 120 - 60);
    const row = goenCatalog(pack, s, view(), AUTUMN).find((x) => x.item.id === 'kimono_momiji')!;
    expect(row).toMatchObject({ owned: true, canBuy: false, reason: 'owned' });
  });

  it('the streak omamori: at most 2 held; one bridges a missed day once; the core streak uses it only when no freeze is left', () => {
    let s = rich(fresh(), 100);
    s = run(s, { t: 'goen_spend', itemId: 'omamori_streak', id: 'c1' }).state;
    s = run(s, { t: 'goen_spend', itemId: 'omamori_streak', id: 'c2' }).state;
    expect(s.goen.charms).toBe(2);
    expect(run(s, { t: 'goen_spend', itemId: 'omamori_streak', id: 'c3' }).state.goen.balance).toBe(40);
    const before = untouched(s);
    const used = run(s, { t: 'goen_charm_used', day: '2026-10-21' });
    expect(used.state.goen.charms).toBe(1);
    expect(used.derived).toContainEqual({ t: 'charm_used', left: 1 });
    expect(untouched(used.state)).toEqual(before);
    expect(run(used.state, { t: 'goen_charm_used', day: '2026-10-21' }).state.goen.charms).toBe(1);
    const streak = { days: 5, freezes: 0, lastActive: '2026-10-19' };
    expect(touchStreak(streak, '2026-10-21', 0)).toMatchObject({ usedCharm: false, state: { days: 1 } });
    expect(touchStreak(streak, '2026-10-21', 1)).toMatchObject({ usedCharm: true, state: { days: 6 } });
    expect(touchStreak({ ...streak, freezes: 1 }, '2026-10-21', 1)).toMatchObject({ usedFreeze: true, usedCharm: false });
  });
});

describe('migration of an old save', () => {
  it('gets an empty Goen plus +25 per chapter already completed, once; nothing else is retroactive', () => {
    let old = fresh();
    old = { ...old, flags: { dev: true } };
    old = run(old, { t: 'dev', cmd: 'advance_chapter' }).state;
    old = run(old, { t: 'dev', cmd: 'advance_chapter' }).state;
    const raw = JSON.parse(JSON.stringify({ ...old, chapter: { ...old.chapter, flags: [...old.chapter.flags, 'letter_written'] } }));
    delete raw.goen;
    const m = migrate(raw, 1, pack);
    expect(m.goen.balance).toBe(m.chapter.completed.length * BALANCE.goen.chapter);
    expect(m.chapter.completed.length).toBeGreaterThanOrEqual(2);
    expect(m.goen.earned.letter).toBe(true);
    // loading again (the Goen state is there now) grants nothing more
    expect(migrate(JSON.parse(JSON.stringify(m)), 1, pack).goen.balance).toBe(m.goen.balance);
    // the next event pays no Letter and no streak catch-up
    const next = run(m, { t: 'day_observed', nowMs: AUTUMN + 1 }, AUTUMN + 1, view(14)).state;
    expect(next.goen.balance).toBe(m.goen.balance);
    expect(reconcileGoen(next).ok).toBe(true);
  });
});

describe('the autumn season', () => {
  it('counts tasks from its start, grants free tiers once and the premium track once owned; outside the window it is closed', () => {
    let s = fresh();
    for (let d = 0; d < 3; d++) {
      const now = AUTUMN + d * 86_400_000;
      s = run(s, { t: 'day_observed', nowMs: now }, now).state;
      s = run(s, { t: 'omikuji_drawn', words: ['ねこ'] }, now).state;
      // a second draw the same day is refused and counts nothing
      s = run(s, { t: 'omikuji_drawn', words: ['いぬ'] }, now).state;
    }
    expect(s.goen.omikuji?.word).toBe('ねこ');
    expect(s.goen.season.done.au_omikuji).toBeDefined();
    expect(s.goen.season.sp).toBe(1);
    expect(s.stickers).toContain('st_autumn');
    expect(s.owned.scarf_momiji).toBeUndefined();
    s = rich(s, 200);
    s = run(s, { t: 'goen_spend', itemId: 'season_autumn_premium', id: 'p' }).state;
    expect(s.owned.scarf_momiji?.qty).toBe(1);
    const v = seasonView(pack, s, AUTUMN)!;
    expect(v.active).toBe(true);
    expect(v.tiers[0]).toMatchObject({ reached: true, free: { granted: true }, premium: { granted: true } });
    // own lines and the autumn words of a conversation count too
    s = run(s, { t: 'conversation_done', facts: facts('konbini', 3) }).state;
    expect(s.goen.season.counts.au_own).toBe(3);
    expect(s.goen.season.words).toEqual(['秋', '紅葉']);
    // a line typed in kana counts its word by reading (3+ kana only: かき inside かきます is not 柿); a copied line counts nothing
    const kana = facts('kyoto_matcha', 2, { sessionId: 's_kana' });
    kana.turns = [
      { ...kana.turns[0]!, norm: 'くりきんとんがおいしいです', words: ['おいしい'] },
      { ...kana.turns[1]!, norm: 'てがみおかきます', words: [] },
    ];
    s = run(s, { t: 'conversation_done', facts: kana }).state;
    expect(s.goen.season.words).toEqual(['秋', '紅葉', '栗きんとん']);
    const copied = facts('kyoto_matcha', 1, { sessionId: 's_copy' });
    copied.turns = [{ ...copied.turns[0]!, copied: true, norm: 'やきいもください', words: [] }];
    expect(run(s, { t: 'conversation_done', facts: copied }).state.goen.season.words).toEqual(['秋', '紅葉', '栗きんとん']);
    // out of the window: "next season soon", nothing counts and the premium cannot be bought
    const w = fresh(WINTER);
    expect(seasonView(pack, w, WINTER)).toMatchObject({ active: false, nextFrom: '2027-10-15' });
    expect(canSpend(pack, rich(w, 500), view(), 'season_autumn_premium', WINTER)).toEqual({ ok: false, reason: 'closed' });
  });
});

describe('the Kyoto Journey', () => {
  it('the Shinkansen fare is charged in yen only to an owner; the objective set completes once with +20 Goen, kp_kyoto and t_kyoto', () => {
    let s = fresh();
    const fare: InputEvent = { t: 'fare', id: 'k1', place: TRIP_KYOTO.id, method: 'cash', legs: 2 };
    expect(run(s, fare).state.wallet.cash).toBe(s.wallet.cash);
    s = rich(s, 250);
    s = run(s, { t: 'goen_spend', itemId: 'journey_kyoto', id: 'j' }).state;
    s = { ...s, wallet: { ...s.wallet, cash: 10_000 }, totals: { ...s.totals, earned: s.totals.earned + 7000, checksum: { ...s.totals.checksum, cash: 10_000 } } };
    s = run(s, fare).state;
    expect(s.wallet.cash).toBe(10_000 - 2 * KYOTO_FARE);
    const done = { count: 1, complete: true, stars: 2 as const, bestIndependent: 3, bestShare: 1, bestR: 1, steps: [] };
    s = { ...s, runs: { ...s.runs, kyoto_ryokan: done, kyoto_temple: done, kyoto_matcha: done }, owned: { ...s.owned, g_yatsuhashi: { qty: 1, day: 'd0' } } };
    const b = s.goen.balance;
    s = run(s, { t: 'trip_done', id: TRIP_KYOTO.id }).state;
    expect(s.goen.journeys.journey_kyoto?.complete).toBeTruthy();
    expect(s.goen.balance).toBe(b + JOURNEY_KYOTO.reward.goen);
    expect(s.keepsakes).toContain('kp_kyoto');
    expect(s.titles).toContain('t_kyoto');
    expect(run(s, { t: 'day_observed', nowMs: AUTUMN + 5 }).state.goen.balance).toBe(b + JOURNEY_KYOTO.reward.goen);
    expect(journeyView(pack, s, view(), 'journey_kyoto')).toMatchObject({ owned: true, complete: true });
    expect(reconcileGoen(s).ok).toBe(true);
  });
});
