// Balance as a test (docs/GAME_DESIGN.md D35, §4.6): the persona simulations of docs/economy-ref-sim.mjs, played through the REAL
// reducer (fixtures-sim.ts has the port and says where its synthetic pack differs from the real JP pack). Run with `npm run economy:sim`.
//
// The windows below are the §4.6 CI assertions. They are the reference model's medians plus a margin, and they are re-baselined
// deliberately (edit the number AND the table in §4.6), never silently. Medians over seeded runs: every run is deterministic.
//
// Measured medians (this port, the reference model in brackets): casual chapters 1..8 on days 1, 2, 7, 11, 13, 22, 25, 29
// (1, 2, 7, 11, 13, 22, 25, 29); phone 9 (9); phone + bike + helmet 22 (21); fresh_start 37 (35); phone + kei car 74 (72);
// light Ch8 69 (68); tap-leaning Ch8 35 (35), car 115 (110); repeat-one 0.23 of the diversified language yen on days 31-60 (0.21),
// shift-only 0.115 (0.11).
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/balance';
import { validatePack, validateState } from '../src/validate';
import { PERSONAS, runMany, simPack, simulate, type SimMedians } from './fixtures-sim';

const cache = new Map<string, SimMedians>();
/** Medians over `n` seeded runs of `days` days; each (persona, n, days) is run once and shared by the tests. */
function many(persona: string, n: number, days: number): SimMedians {
  const key = `${persona}|${n}|${days}`;
  if (!cache.has(key)) cache.set(key, runMany(persona, n, days));
  return cache.get(key)!;
}

const casual = (): SimMedians => many('casual', 11, 100);
const light = (): SimMedians => many('light', 9, 110);
const grinder = (): SimMedians => many('grinder', 5, 45);
const tap = (): SimMedians => many('tapleaning', 9, 130);
const serious = (): SimMedians => many('serious', 3, 40);

const sum = (c: SimMedians['comp']): number => c.conv + c.mastery + c.shift + c.goals + c.chapter;
const inWindow = (v: number | null, lo: number, hi: number, what: string): void => {
  expect(v, `${what} must exist`).not.toBeNull();
  expect(v as number, `${what} = ${v}, window [${lo}, ${hi}]`).toBeGreaterThanOrEqual(lo);
  expect(v as number, `${what} = ${v}, window [${lo}, ${hi}]`).toBeLessThanOrEqual(hi);
};

describe('the synthetic pack', () => {
  it('passes validatePack through level 4 (sale routes, gates, prerequisites, the bot)', () => {
    for (const mul of [1, 1.3]) {
      const issues = validatePack(simPack({ sessionMul: mul }), { level: 4 });
      expect(issues.filter((i) => i.severity === 'error'), `session multiplier ${mul}`).toEqual([]);
    }
  });
  it('uses the reference model\'s chapter table, prices and personas', () => {
    const p = simPack();
    expect(p.chapters.map((c) => [c.n, c.minDays, c.reward])).toEqual([[1, 1, 2500], [2, 2, 2500], [3, 4, 3000], [4, 7, 4000], [5, 10, 5000], [6, 14, 6000], [7, 19, 8000], [8, 25, 10000]]);
    expect(p.chapters.reduce((a, c) => a + c.reward, 0)).toBe(41_000);
    expect(p.items.filter((i) => !i.id.startsWith('g_')).map((i) => [i.id, i.price, i.gate.ch])).toEqual([
      ['phone_used', 24800, 4], ['bike_mamachari', 19800, 5], ['bike_helmet', 2980, 5], ['home_room_ono', 60000, 6], ['plant_pothos', 1200, 5], ['paper_lamp', 2000, 6], ['rice_cooker', 3500, 6], ['car_kei_used', 198000, 9],
    ]);
    expect(p.rules.registrationFee).toBe(600);
    expect(Object.keys(PERSONAS)).toEqual(expect.arrayContaining(['casual', 'light', 'serious', 'grinder', 'tapleaning', 'diversified', 'repeater', 'shiftonly', 'neverSpeaks']));
  });
});

describe('casual 15 minutes a day (§4.6)', () => {
  it('finishes chapter 1 on day 1 and chapter 8 inside [26, 33]', () => {
    const m = casual();
    expect(m.chDay[0]).toBe(1);
    inWindow(m.chDay[7], 26, 33, 'casual Ch8');
  });
  it('owns the phone in [7, 12], and chapter 4 completes at least a day after it (its chats need the phone)', () => {
    const m = casual();
    inWindow(m.phoneDay, 7, 12, 'casual phone');
    for (const r of m.runs) expect(r.chDay[3]!, `run: Ch4 ${r.chDay[3]}, phone ${r.phoneDay}`).toBeGreaterThanOrEqual(r.phoneDay! + 1);
  });
  it('can afford phone + bike + helmet in [17, 25], fresh_start in [30, 42] and phone + car in [60, 85]', () => {
    const m = casual();
    inWindow(m.dreams['Phone + bike + helmet']!, 17, 25, 'casual phone + bike + helmet');
    inWindow(m.dreams.fresh_start!, 30, 42, 'casual fresh_start');
    inWindow(m.dreams['Phone + kei car']!, 60, 85, 'casual phone + car');
  });
  it('earns about 3,600 a day over the first 30 days, from the sources of §4.2', () => {
    const m = casual();
    inWindow(m.perDay30, 3200, 3900, 'casual income per day');
    const total = sum(m.comp);
    const share = (v: number): number => (100 * v) / total;
    // reference shares: conversations 29, mastery pools 11, shifts 6, goals 16, chapter rewards 38 (in percent)
    expect(share(m.comp.conv)).toBeGreaterThan(24);
    expect(share(m.comp.conv)).toBeLessThan(34);
    expect(share(m.comp.mastery)).toBeGreaterThan(8);
    expect(share(m.comp.mastery)).toBeLessThan(15);
    expect(share(m.comp.shift)).toBeLessThan(10);
    expect(share(m.comp.goals)).toBeGreaterThan(13);
    expect(share(m.comp.goals)).toBeLessThan(19);
    expect(m.comp.chapter).toBe(41_000);
  });
  it('pays the daily goals as designed: 100 each, 150 for all three, a streak bonus (about 17,300 in 30 days)', () => {
    inWindow(casual().comp.goals, 15_500, 19_000, 'casual goal yen in 30 days');
  });
});

describe('light 10 minutes, five days a week', () => {
  it('finishes chapter 8 by day 80 (workload, not yen, is what binds)', () => {
    const m = light();
    inWindow(m.chDay[7], 40, 80, 'light Ch8');
    // how many talks a ten-minute player squeezes in is luck (half the days none), so single runs spread from ~60 to ~95
    for (const r of m.runs) expect(r.chDay[7] ?? 999, 'every light run').toBeLessThanOrEqual(100);
  });
});

describe('tap-leaning (p <= 0.4, Prepare recall, easier alternatives)', () => {
  it('finishes chapter 8 within 10 days of the casual player', () => {
    inWindow(tap().chDay[7], 1, casual().chDay[7]! + 10, 'tap-leaning Ch8');
  });
  it('is never blocked by money: every dream item within 1.6x of the casual date', () => {
    for (const [k, v] of Object.entries(tap().dreams)) {
      const base = casual().dreams[k]!;
      expect(v, `tap-leaning ${k}`).not.toBeNull();
      expect(v!, `tap-leaning ${k} = ${v}, casual ${base}`).toBeLessThanOrEqual(1.6 * base);
    }
  });
  it('and finishes chapter 3 with two friends at 2 hearts, as the casual player does, so chapter 4 chats never wait on a friend', () => {
    for (const m of [tap(), casual()]) for (const r of m.runs) expect(r.heartsAtCh3, `${m.persona} run`).toBeGreaterThanOrEqual(2);
  });
});

describe('60 minutes a day and more', () => {
  it('the grinder earns about 5x the casual player, not 6x, and cannot own the car before day 25 (the Free Walk gate)', () => {
    const g = grinder();
    const ratio = g.perDay30 / casual().perDay30;
    expect(ratio, `grinder / casual income per day = ${ratio.toFixed(2)}`).toBeGreaterThan(4);
    expect(ratio).toBeLessThan(6);
    for (const r of g.runs) {
      expect(r.dreams['Phone + kei car']!, 'grinder car').toBeGreaterThanOrEqual(25);
      // the car is bought on or after the day chapter 8 completes: gate FW, minDays 25
      expect(r.dreams['Phone + kei car']!).toBeGreaterThanOrEqual(r.chDay[7]!);
    }
    inWindow(g.chDay[7], 25, 27, 'grinder Ch8 (the day gate binds)');
    inWindow(serious().chDay[7], 25, 27, 'serious Ch8');
  });
  it('language yen per day stays within the soft cap: at most 1.10 x of it for a 60-minute day, and the 90-minute grinder is cut to a quarter beyond it', () => {
    const cap = BALANCE.softCap;
    const div = many('diversified', 5, 62);
    for (const r of div.runs) expect(Math.max(...r.langPerDay), 'diversified peak day').toBeLessThanOrEqual(1.1 * cap);
    for (const r of grinder().runs) {
      // a grinder day plays ~25,000 yen of language at full rate; beyond 14,000 it pays x0.25, so the day pays ~16,900 (1.21 x cap)
      expect(Math.max(...r.langPerDay), 'grinder peak day').toBeLessThanOrEqual(1.25 * cap);
      const mean = r.langPerDay.slice(0, 45).reduce((a, b) => a + b, 0) / 45;
      expect(mean, 'grinder mean day').toBeLessThanOrEqual(1.15 * cap);
    }
  });
});

describe('ratios (CI, §4.6)', () => {
  const div = (): SimMedians => many('diversified', 5, 62);
  it('repeat-one earns at most 25% of the diversified persona\'s language yen on days 31-60 (measured 21%)', () => {
    const ratio = many('repeater', 5, 62).lang3160 / div().lang3160;
    expect(ratio, `repeat-one / diversified = ${ratio.toFixed(3)}`).toBeLessThanOrEqual(0.25);
    expect(ratio).toBeGreaterThan(0.1);
  });
  it('shift-only earns at most 20% (measured 11%)', () => {
    const ratio = many('shiftonly', 5, 62).lang3160 / div().lang3160;
    expect(ratio, `shift-only / diversified = ${ratio.toFixed(3)}`).toBeLessThanOrEqual(0.2);
    expect(ratio).toBeGreaterThan(0.05);
  });
  it('shifts are at most 15% of the first-30-day income of every persona (measured 6-12%, mean of the seeded runs)', () => {
    for (const m of [casual(), light(), serious(), grinder(), tap(), div(), many('repeater', 5, 62), many('shiftonly', 5, 62)]) {
      const share = m.comp.shift / sum(m.comp);
      expect(share, `${m.persona} shifts are ${(100 * share).toFixed(1)}% of income`).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('money and the story, for every persona', () => {
  const all = (): SimMedians[] => [casual(), light(), serious(), grinder(), tap(), many('diversified', 5, 62)];
  it('affords the phone within 3 days of Chapter 4 opening (casual 2 days, light 0-1)', () => {
    for (const m of all()) {
      for (const r of m.runs) {
        const opened = r.chDay[2]!; // chapter 3 completes the day chapter 4 becomes current
        expect(r.phoneDay, `${m.persona}: phone`).not.toBeNull();
        expect(r.phoneDay! - opened, `${m.persona}: Ch4 opened day ${opened}, phone day ${r.phoneDay}`).toBeLessThanOrEqual(3);
      }
    }
  });
  it('never lets the wallet go below zero, and the ledger reconciles with the totals and the checksum at the end', () => {
    for (const m of [...all(), many('repeater', 5, 62), many('shiftonly', 5, 62)]) {
      for (const r of m.runs) {
        expect(r.minCash, `${m.persona} min cash`).toBeGreaterThanOrEqual(0);
        expect(r.reconciles, `${m.persona} reconcile`).toBe(true);
      }
    }
  });
  it('ends every simulated game in a state that validates', () => {
    for (const m of all()) {
      const r = m.runs[0]!;
      const pack = simPack({ sessionMul: PERSONAS[m.persona]!.sessionMul });
      expect(validateState(r.state, pack), `${m.persona} end state`).toEqual([]);
    }
  });
});

describe('a persona that never says a line of its own (blocked at c1_5 by design)', () => {
  it('never leaves chapter 1, still earns a third of what speaking earns per conversation, and is never charged', () => {
    const r = simulate('neverSpeaks', 40, 1);
    expect(r.finalChapter).toBe(1);
    expect(r.chDay).toEqual([]);
    expect(r.state.chapter.done.c1_5).toBeUndefined();
    expect(r.state.chapter.done.c1_s0).toBeDefined();
    expect(r.minCash).toBeGreaterThanOrEqual(0);
    expect(r.state.totals.earned).toBeGreaterThan(0);
    // tapped suggestions and nothing else: an A1 conversation pays about 515 (§3.5 "all tapped"), 570 prepared; never above 700 with the soft cap not reached
    const convs = Object.entries(r.state.runs).filter(([k]) => k.startsWith('f') || k.startsWith('o')).reduce((a, [, v]) => a + v.count, 0);
    expect(r.state.ledger.length).toBeGreaterThan(0);
    const loopYen = r.comp.conv / convs;
    expect(loopYen, `${convs} conversations paid ${r.comp.conv}`).toBeLessThan(700);
    expect(loopYen).toBeGreaterThan(300);
  });
});

describe('against the reference model (docs/economy-ref-sim.mjs)', () => {
  // The plain-JS model pays by formula; this file pays through the reducer. They must stay close: chapter days within 3 days (6 for the
  // slow personas), income per day within 15%. A difference means one of the two moved: re-baseline both, deliberately.
  it('lands within a few days and a few percent of the model for every persona', async () => {
    const ref = (await import(/* @vite-ignore */ new URL('../../../docs/economy-ref-sim.mjs', import.meta.url).href)) as { runMany: (p: string, n: number, d: number) => { chDay: Array<number | null>; perDay30: number; phoneDay: number | null } };
    for (const [name, mine, slack] of [['casual', casual(), 3], ['serious', serious(), 3], ['grinder', grinder(), 3], ['tapleaning', tap(), 4], ['light', light(), 7]] as const) {
      const model = ref.runMany(name, 11, 130);
      mine.chDay.forEach((d, i) => {
        if (d === null || model.chDay[i] == null) return;
        expect(Math.abs(d - (model.chDay[i] as number)), `${name} chapter ${i + 1}: ${d} here, ${model.chDay[i]} in the model`).toBeLessThanOrEqual(slack);
      });
      expect(Math.abs(mine.perDay30 / model.perDay30 - 1), `${name} income per day: ${mine.perDay30} here, ${model.perDay30} in the model`).toBeLessThan(0.15);
      expect(Math.abs((mine.phoneDay ?? 0) - (model.phoneDay ?? 0)), `${name} phone day`).toBeLessThanOrEqual(slack + 1);
    }
  });
});

describe('determinism', () => {
  it('the same persona and seed give the same game, byte for byte', () => {
    const a = simulate('casual', 40, 3);
    const b = simulate('casual', 40, 3);
    expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
    expect(b.chDay).toEqual(a.chDay);
  });
});
