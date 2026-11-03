// Goen stage 2 over the real pack (docs/GOEN.md "Stage 2"): bought Goen joins the one balance; a spend uses free Goen first; the bought part
// and the item are queued for the server; a sync is idempotent (credits, refunds, bought Goen spent on another device, once-items given back);
// the checksum holds and the save keeps it all. Bought Goen still never touches yen, the chapter, the objectives or the hearts.
import { describe, expect, it } from 'vitest';
import {
  createGameState,
  earnGoen,
  goenCode,
  goenOutbox,
  migrate,
  paidLeft,
  reconcileGoen,
  reduce,
  validateState,
  type GameState,
  type GameView,
  type InputEvent,
} from '@lw/game';
import { JP_PACK } from '../src';

const pack = JP_PACK;
const AUTUMN = new Date(2026, 9, 20, 12).getTime();
const view = (): GameView => ({
  vocab: { total: 0, known: new Set(), dueCount: 0, reviewedKeys: new Set(), reviewedSurfaces: new Set() },
  discovered: [],
  lessonsDone: [],
  streakDays: 0,
  profile: { age: 'adults', goal: 'travel', level: 'A1', createdAt: '' },
});
const run = (s: GameState, ev: InputEvent) => reduce(s, ev, { pack, now: AUTUMN, view: view(), rng: () => 0.3 });
const fresh = (): GameState => run(createGameState(pack, AUTUMN), { t: 'day_observed', nowMs: AUTUMN }).state;
const untouched = (s: GameState) => ({ wallet: s.wallet, totals: s.totals, ledger: s.ledger, chapter: s.chapter, friends: s.friends });
const CODE = 'ABCD-EFGH-JKMN-PQRS-TV12';
const sync = (credits: { id: string; goen: number }[], more: Partial<Extract<InputEvent, { t: 'goen_sync' }>> = {}): InputEvent => ({
  t: 'goen_sync',
  credits,
  refunded: [],
  spent: 0,
  own: [],
  ...more,
});

describe('bought Goen', () => {
  it('a paid checkout adds its Goen once, as a buy entry; the checksum and the state validate; yen is untouched', () => {
    let s = run(fresh(), { t: 'goen_account', code: CODE }).state;
    expect(goenCode(s)).toBe(CODE);
    const before = untouched(s);
    const r = run(s, sync([{ id: 'cs_test_1', goen: 650 }]));
    s = r.state;
    expect(s.goen.balance).toBe(650);
    expect(paidLeft(s.goen)).toBe(650);
    expect(s.goen.ledger.at(-1)).toMatchObject({ id: 'goen:buy:cs_test_1', delta: 650, kind: 'buy' });
    expect(r.derived).toContainEqual(expect.objectContaining({ t: 'goen_changed', delta: 650, reason: 'buy' }));
    expect(run(s, sync([{ id: 'cs_test_1', goen: 650 }])).state.goen).toEqual(s.goen);
    expect(untouched(s)).toEqual(before);
    expect(reconcileGoen(s).ok).toBe(true);
    expect(validateState(s, pack)).toEqual([]);
  });

  it('a spend uses the free Goen first; the bought part and the item go to the outbox; reported ids leave it', () => {
    let s = run(fresh(), { t: 'goen_account', code: CODE }).state;
    s = earnGoen(s, 'test:free', 'chapter', 100, 0).state;
    s = run(s, sync([{ id: 'cs_a', goen: 120 }])).state;
    s = run(s, { t: 'goen_spend', itemId: 'kimono_momiji', id: 'k' }).state; // 120: 100 free + 20 bought
    expect(s.goen.balance).toBe(100);
    expect(paidLeft(s.goen)).toBe(100);
    expect(goenOutbox(s)).toEqual([{ id: 'goen:spend:kimono_momiji', itemId: 'kimono_momiji', paid: 20, keep: true }]);
    s = run(s, { t: 'goen_spend', itemId: 'omamori_streak', id: 'c1' }).state;
    expect(goenOutbox(s).at(-1)).toMatchObject({ itemId: 'omamori_streak', paid: 30, keep: false });
    s = run(s, { t: 'goen_reported', ids: ['goen:spend:kimono_momiji'] }).state;
    expect(goenOutbox(s).map((r) => r.itemId)).toEqual(['omamori_streak']);
    expect(reconcileGoen(s).ok).toBe(true);
  });

  it('the first account queues the once-items already owned, so a restore gives them back', () => {
    let s = earnGoen(fresh(), 'test:free', 'chapter', 60, 0).state;
    s = run(s, { t: 'goen_spend', itemId: 'room_momiji', id: 'r' }).state;
    s = run(s, { t: 'goen_account', code: CODE }).state;
    expect(goenOutbox(s)).toEqual([{ id: 'own:room_momiji', itemId: 'room_momiji', paid: 0, keep: true }]);
  });

  it('a restore on a new device: the purchases, the bought Goen spent elsewhere taken once, the once-items owned; replays change nothing', () => {
    let s = run(fresh(), { t: 'goen_account', code: CODE }).state;
    const ev = sync(
      [
        { id: 'cs_a', goen: 650 },
        { id: 'cs_b', goen: 120 },
      ],
      { spent: 250, own: ['journey_kyoto', 'omamori_streak', 'nope'] },
    );
    const r = run(s, ev);
    s = r.state;
    expect(s.goen.balance).toBe(650 + 120 - 250);
    expect(s.goen.owned.journey_kyoto).toBeDefined();
    expect(s.goen.journeys.journey_kyoto).toEqual({ done: {}, complete: null });
    expect(s.goen.charms).toBe(0);
    expect(paidLeft(s.goen)).toBe(520);
    expect(run(s, ev).state.goen).toEqual(s.goen);
    expect(reconcileGoen(s).ok).toBe(true);
    expect(validateState(s, pack)).toEqual([]);
  });

  it('a refund takes the Goen back once (never below zero)', () => {
    let s = run(fresh(), { t: 'goen_account', code: CODE }).state;
    s = run(s, sync([{ id: 'cs_a', goen: 120 }])).state;
    s = run(s, { t: 'goen_spend', itemId: 'ride_sakura', id: 'x' }).state; // 70 left, all bought
    s = run(s, sync([{ id: 'cs_a', goen: 120 }], { refunded: ['cs_a'], spent: 50 })).state;
    expect(s.goen.balance).toBe(0);
    expect(s.goen.ledger.at(-1)).toMatchObject({ kind: 'refund', delta: -70 });
    expect(paidLeft(s.goen)).toBe(0);
    expect(reconcileGoen(s).ok).toBe(true);
  });

  it('bad input changes nothing; the save round-trips the bought Goen', () => {
    const s0 = fresh();
    expect(run(s0, { t: 'goen_account', code: 'bad code!' }).state.goen).toEqual(s0.goen);
    let s = run(s0, { t: 'goen_account', code: CODE }).state;
    expect(run(s, sync([{ id: 'cs a', goen: 5 }, { id: 'cs_b', goen: -5 }, { id: 'cs_c', goen: 1e9 }])).state.goen).toEqual(s.goen);
    s = run(s, sync([{ id: 'cs_a', goen: 120 }])).state;
    s = run(s, { t: 'goen_spend', itemId: 'omamori_streak', id: 'c1' }).state;
    const back = migrate(JSON.parse(JSON.stringify(s)), 1, pack);
    expect(back.goen.paid).toEqual(s.goen.paid);
    expect(back.goen.balance).toBe(s.goen.balance);
  });
});
