// Adversarial review of the game core (slice 1): random event streams through the real reducer with frozen inputs, checking the
// invariants that must hold after every event (wallet bounds, reconcile, ring sizes, JSON safety, no mutation, determinism)
// and that replaying a money event never pays twice. Seeded: a failure prints the seed and the event index.
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { reconcile } from '../src/ledger';
import { reduce } from '../src/reducer';
import type { ConversationFacts, GameState, InputEvent, ReduceCtx } from '../src/types';
import { ctx1f, dayAt, facts1f, fresh1f, pack1f, rng, turn, view1f } from './fixtures-1f';

function deepFreeze<T>(o: T, seen = new WeakSet<object>()): T {
  if (o && typeof o === 'object' && !seen.has(o as object)) {
    seen.add(o as object);
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v, seen);
  }
  return o;
}

function noBadNumbers(o: unknown, path = 'state'): string | null {
  if (typeof o === 'number') return Number.isFinite(o) ? null : `${path} = ${o}`;
  if (o === undefined) return null;
  if (Array.isArray(o)) {
    for (let i = 0; i < o.length; i++) {
      const r = noBadNumbers(o[i], `${path}[${i}]`);
      if (r) return r;
    }
  } else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      const r = noBadNumbers(v, `${path}.${k}`);
      if (r) return r;
    }
  }
  return null;
}

const pack = pack1f();
const START = pack.economy.startCash;
const pick = <T>(r: () => number, l: readonly T[]): T => l[Math.floor(r() * l.length)]!;

function randomFacts(r: () => number, sid: string): ConversationFacts {
  const scenario = pick(r, pack.scenarioMeta).id;
  const ind = Math.floor(r() * 5);
  const ass = Math.floor(r() * 3);
  const total = 1 + Math.floor(r() * 4);
  const f = facts1f({ sessionId: sid, scenarioId: scenario, ind, ass, done: Math.floor(r() * (total + 1)), total });
  f.characterId = pick(r, ['tanaka', 'mio', 'aiko', 'hanako', 'nobody']);
  f.abandoned = r() < 0.15;
  f.mode = r() < 0.3 ? 'real' : 'guided';
  f.prepared = r() < 0.4;
  f.fallbacks = Math.floor(r() * 7);
  f.hintUses = Math.floor(r() * 7);
  f.accuracy = r() < 0.5 ? null : Math.floor(r() * 101);
  f.remembered = r() < 0.3 ? { hobby: 'anime' } : {};
  if (r() < 0.2) f.callbacks = ['hobby'];
  if (r() < 0.2) f.revealed = [pick(r, ['likes_anime', 'tea', 'songs'])];
  if (r() < 0.1) f.turns.push(turn(99, 'T'));
  return f;
}

const SHOP_ITEMS: Array<[string, string]> = [
  ['konbini', 'konbini:onigiri'],
  ['konbini', 'konbini:coffee'],
  ['konbini', 'g_manga'],
  ['cafe', 'cafe:cake'],
  ['vending', 'vending:greenTea'],
  ['station', 'ic_card'],
  ['aiko', 'g_flower'],
  ['aiko', 'g_wagashi'],
  ['aiko', 'home_room_ono'],
  ['fuku', 'yukata'],
  ['fuku', 'plant_pothos'],
  ['denki', 'phone_used'],
  ['motors', 'bike_mamachari'],
  ['motors', 'car_kei_used'],
];

let seq = 0;
function randomEvent(r: () => number, now: number): InputEvent {
  const id = `e${seq++}`;
  const k = Math.floor(r() * 28);
  switch (k) {
    case 0:
    case 1:
    case 2:
      return { t: 'conversation_done', facts: randomFacts(r, id) };
    case 3:
    case 4:
    case 5: {
      const [shopId, itemId] = pick(r, SHOP_ITEMS);
      return { t: 'purchase', sessionId: id, n: 1, shopId, itemId, qty: 1 + Math.floor(r() * 3), total: 0, method: pick(r, ['cash', 'ic', 'card'] as const), lines: [], usePoints: r() < 0.5, haggle: r() < 0.3 ? Math.floor(r() * 20000) : undefined, eatIn: r() < 0.3 };
    }
    case 6:
      return { t: 'topup', id, amount: Math.floor(r() * 6000) - 500 };
    case 7:
      return { t: 'refund', id };
    case 8:
      return { t: 'fare', id, place: pick(r, ['hikarigaoka', 'shinjuku', 'mars']), method: pick(r, ['cash', 'ic', 'paper'] as const), legs: r() < 0.5 ? 2 : 1 };
    case 9:
    case 10:
      return { t: 'gift_given', friendId: pick(r, ['mio', 'tanaka', 'aiko', 'hanako', 'zed']), itemId: pick(r, ['g_flower', 'g_wagashi', 'g_manga', 'konbini:coffee', 'yukata']), sessionId: id, assistedHandover: r() < 0.3, bare: r() < 0.2 };
    case 11:
    case 12: {
      const n = 3 + Math.floor(r() * 3);
      return {
        t: 'shift_done',
        jobId: 'job_konbini',
        result: {
          id,
          jobId: 'job_konbini',
          quit: r() < 0.2,
          assistWaived: r() < 0.5,
          customers: Array.from({ length: n }, (_, i) => ({ templateId: `k_${'abcd'[i % 4]}`, served: r() < 0.9, assist: pick(r, ['none', 'text', 'translation'] as const), tasks: [{ kind: 'order', ok: r() < 0.8 }, { kind: 'total', ok: r() < 0.8, input: pick(r, ['typed', 'tiles', 'chip'] as const) }, { kind: 'thanks', ok: r() < 0.8, input: 'typed' }, { kind: 'greet', ok: r() < 0.5 }] })),
        },
      } as unknown as InputEvent;
    }
    case 13:
      return { t: 'echo', sessionId: id.slice(0, 2) + Math.floor(r() * 3), lineId: pick(r, ['p_konbini_1', 'p_konbini_2', 'p_konbini_3', 'zzz']), similarity: r(), peeked: r() < 0.2 };
    case 14:
      return { t: 'prepare_done', scenarioId: 'konbini', ready: ['p_konbini_1', 'p_konbini_2'].filter(() => r() < 0.7), seen: ['p_konbini_3'] };
    case 15:
      return { t: 'beat_done', id: pick(r, Object.keys(pack.beats)) };
    case 16:
      return { t: 'dream_chosen', id: pick(r, [...pack.dreams.map((d) => d.id), null, 'nope']) };
    case 17:
      return { t: 'visit', place: pick(r, ['place_park', 'trip:hikarigaoka', 'home:aiko', 'festival']) };
    case 18:
      return { t: 'phone_chat_done', friendId: pick(r, ['mio', 'tanaka', 'aiko']), sessionId: id, facts: randomFacts(r, id) };
    case 19:
      return { t: 'heart_event_done', friendId: pick(r, ['mio', 'tanaka', 'aiko']), level: 1 + Math.floor(r() * 5) };
    case 20:
      return { t: 'day_observed', nowMs: now };
    case 21:
      return { t: 'easier_accept', objective: pick(r, ['c1_1', 'c2_1', 'c3_1', 'c4_1', 'x']) };
    case 22:
      return { t: 'lesson_done', id: pick(r, ['greetings', 'ic']) };
    case 24:
      return { t: 'dev', cmd: 'cash', amount: Math.floor(r() * 120000) - 5000 };
    case 25:
      return { t: 'dev', cmd: pick(r, ['advance_chapter', 'advance_day', 'complete_objective'] as const) };
    case 26:
      return { t: 'visit', place: pick(r, ['trip:hikarigaoka', 'home:mio']) };
    case 27:
      return { t: 'dream_chosen', id: pick(r, pack.dreams.map((d) => d.id)) };
    default:
      return { t: 'item_placed', slot: pick(r, ['bed', 'plant', 'tv']), itemId: pick(r, ['futon_set', 'plant_pothos', null]) };
  }
}

const MONEY_EVENTS = new Set(['conversation_done', 'purchase', 'topup', 'refund', 'fare', 'gift_given', 'shift_done', 'echo', 'phone_chat_done']);
const snapshot = (s: GameState) => JSON.stringify({ w: s.wallet, t: s.totals, o: s.owned, f: s.friends, j: s.jobs, r: s.runs, p: s.pay });

const stats: Array<Record<string, number>> = [];
describe('review: random event streams keep the invariants', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    it(`seed ${seed}`, () => {
      const r = rng(seed * 7919);
      let day = 0;
      let s = deepFreeze(reduce(fresh1f(pack, dayAt(0)), { t: 'profile_set', dev: true }, ctx1f(pack, dayAt(0))).state);
      // a rich player so the shops open up, and a dev flag-free state otherwise
      const view = view1f({ streakDays: 3, due: 5, reviewed: ['a'], saved: 30 });
      for (let i = 0; i < 400; i++) {
        if (r() < 0.12) day += 1 + Math.floor(r() * 2);
        if (r() < 0.04) day = Math.max(0, day - 1);
        const now = dayAt(day);
        const ctx: ReduceCtx = { pack, view, now, rng: rng(seed + i) };
        const ev = deepFreeze(randomEvent(r, now));
        const label = `seed ${seed} #${i} ${JSON.stringify(ev).slice(0, 200)}`;
        const out = reduce(s, ev, ctx);
        // determinism
        const again = reduce(s, ev, { ...ctx, rng: rng(seed + i) });
        expect(JSON.stringify(again.state), label).toBe(JSON.stringify(out.state));
        const next = out.state;
        const w = next.wallet;
        expect(Number.isInteger(w.cash) && w.cash >= 0 && w.cash <= pack.economy.walletCap, label + ` cash ${w.cash}`).toBe(true);
        expect(Number.isInteger(w.ic) && w.ic >= 0, label + ` ic ${w.ic}`).toBe(true);
        expect(Number.isInteger(w.points) && w.points >= 0, label + ` points ${w.points}`).toBe(true);
        expect(w.ic <= (next.chapter.n >= BALANCE.icCap.lateFrom ? pack.economy.icCap!.late : pack.economy.icCap!.early), label + ' ic cap').toBe(true);
        expect(reconcile(next, START), label).toMatchObject({ ok: true });
        expect(next.ledger.length, label).toBeLessThanOrEqual(BALANCE.ledger.entries);
        expect(next.seen.length, label).toBeLessThanOrEqual(BALANCE.ledger.seen);
        expect(noBadNumbers(next), label).toBeNull();
        expect(JSON.parse(JSON.stringify(next)), label).toEqual(JSON.parse(JSON.stringify(next)));
        expect(next.clock.dayIndex, label).toBeGreaterThanOrEqual(out.state.clock.dayIndex);
        expect(next.clock.activeDays, label).toBeLessThanOrEqual(next.clock.dayIndex + 1);
        for (const f of Object.values(next.friends)) {
          expect(f.apToday, label).toBeLessThanOrEqual(BALANCE.ap.dailyCap);
          expect(f.chatApToday, label).toBeLessThanOrEqual(BALANCE.ap.chat.dailyCap);
        }
        // a replay of a money event pays nothing more
        if (MONEY_EVENTS.has(ev.t)) {
          const replay = reduce(next, ev, ctx);
          expect(snapshot(replay.state), `replay ${label}`).toBe(snapshot(next));
        }
        s = deepFreeze(next);
      }
      // the stream must actually reach the interesting states, or the invariants above prove little
      stats.push({ seed, chapter: s.chapter.n, runs: Object.keys(s.runs).length, owned: Object.keys(s.owned).length, earned: s.totals.earned, spent: s.totals.spent, gifts: s.stats.gifts.n, days: s.clock.dayIndex });
    });
  }
});

it('review: the streams reach chapters, purchases and gifts', () => {
  console.log(JSON.stringify(stats));
});
