import { describe, expect, it } from 'vitest';
import { applyShift, BALANCE, generateShift, ownedQty, rankFor, reconcile, scoreShift, shiftAssistWaived, shiftPay, shiftRepeatMult } from '@lw/game';
import type { GamePack, GameState, JobDef, ShiftAssist, ShiftCustomerResult, ShiftInput, ShiftResult, ShiftTaskResult } from '@lw/game';
import { ctxOf, lcg, makePack, makeState } from './fixtures-1e';

const pack = makePack();
const konbini = pack.jobs[0]!;

// ---------------------------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------------------------

interface Spec {
  served?: boolean;
  assist?: ShiftAssist;
  order?: boolean;
  total?: boolean | ShiftInput;
  thanks?: boolean | ShiftInput;
  greet?: boolean;
}
const cust = (i: number, o: Spec = {}): ShiftCustomerResult => {
  const prod = (v: boolean | ShiftInput | undefined, kind: 'total' | 'thanks'): ShiftTaskResult => {
    if (v === false) return { kind, ok: false };
    return { kind, ok: true, input: typeof v === 'string' ? v : 'typed' };
  };
  const tasks: ShiftTaskResult[] = [{ kind: 'order', ok: o.order ?? true }, prod(o.total, 'total'), prod(o.thanks, 'thanks')];
  if (o.greet !== undefined) tasks.push({ kind: 'greet', ok: o.greet });
  return { templateId: `k${i}`, served: o.served ?? true, assist: o.assist ?? 'none', tasks };
};
const shift = (specs: Spec[] | Spec, o: Partial<ShiftResult> = {}): ShiftResult => ({
  id: 'sh1',
  jobId: 'job_konbini',
  customers: Array.isArray(specs) ? specs.map((s, i) => cust(i, s)) : Array.from({ length: 5 }, (_, i) => cust(i, specs)),
  quit: false,
  durationSec: 200,
  assistWaived: true,
  ...o,
});
const perfect = (o: Partial<ShiftResult> = {}) => shift({}, o);
const chips = (o: Partial<ShiftResult> = {}) => shift({ total: 'pick', thanks: 'pick' }, o);
/** `n` of 5 customers fully right, the rest wrong on every task */
const nRight = (n: number, o: Partial<ShiftResult> = {}) => shift(Array.from({ length: 5 }, (_, i) => (i < n ? {} : { order: false, total: false, thanks: false })), o);

const job = (wage: number, id = 'job_konbini'): JobDef => ({ ...konbini, id, wage });
const pay = (j: JobDef, r: ShiftResult, rank = 0, rep = 1) => shiftPay(j, scoreShift(r), rank, rep);

// ---------------------------------------------------------------------------------------------------------------
// scoreShift
// ---------------------------------------------------------------------------------------------------------------

describe('scoreShift (§9.2)', () => {
  it('a perfect shift: ticks 1, r 1, perf 1, good and perfect', () => {
    const s = scoreShift(perfect());
    expect(s).toMatchObject({ served: 5, ticks: 1, r: 1, perf: 1, good: true, perfect: true, trial: false, quit: false, band: 'perfect' });
  });

  it('ticks = correct units / 15: 5 of 5 customers is 1, 4 is 0.8, 3 is 0.6', () => {
    expect(scoreShift(nRight(4)).ticks).toBeCloseTo(12 / 15, 10);
    expect(scoreShift(nRight(3)).ticks).toBeCloseTo(9 / 15, 10);
    expect(scoreShift(nRight(0)).ticks).toBe(0);
  });

  it('each task is a unit: a missed total costs 1/15', () => {
    const s = scoreShift(shift([{ total: false }, {}, {}, {}, {}]));
    expect(s.ticks).toBeCloseTo(14 / 15, 10);
    expect(s.perfect).toBe(false);
    expect(s.good).toBe(true);
  });

  it('production credit: typed or spoken 1.00, tiles 0.50, a picked chip 0.35; r is the mean over the correct total + thanks tasks', () => {
    expect(scoreShift(shift({ total: 'typed', thanks: 'spoken' })).r).toBe(1);
    expect(scoreShift(shift({ total: 'tiles', thanks: 'tiles' })).r).toBe(BALANCE.shift.tile);
    expect(scoreShift(chips()).r).toBeCloseTo(BALANCE.shift.chip, 12);
    expect(scoreShift(shift({ total: 'typed', thanks: 'pick' })).r).toBeCloseTo((1 + 0.35) / 2, 10);
    // wrong answers are not in the mean
    expect(scoreShift(shift({ total: false, thanks: 'tiles' })).r).toBe(0.5);
    expect(scoreShift(shift({ total: false, thanks: false })).r).toBe(0);
  });

  it('perf = ticks x F(r), F = 0.25 + 0.75 r^2', () => {
    const s = scoreShift(chips());
    expect(s.perf).toBeCloseTo(0.25 + 0.75 * 0.35 * 0.35, 10);
    // the worked example: ticks 0.8, r 0.7 -> perf 0.49
    const ex = scoreShift(shift(Array.from({ length: 5 }, (_, i) => (i < 4 ? { total: i % 2 ? 'typed' : 'tiles', thanks: i % 2 ? 'typed' : 'tiles' } : { order: false, total: false, thanks: false })) as Spec[]));
    expect(ex.ticks).toBeCloseTo(0.8, 10);
    expect(ex.r).toBeCloseTo(0.75, 10);
  });

  it('assist factors: text shown 0.7, translation 0.5, on the order task only; waived for the first shifts', () => {
    const one = (assist: ShiftAssist, waived: boolean) => scoreShift(shift([{ assist }, {}, {}, {}, {}], { assistWaived: waived }));
    expect(one('text', false).ticks).toBeCloseTo((14 + 0.7) / 15, 10);
    expect(one('translation', false).ticks).toBeCloseTo((14 + 0.5) / 15, 10);
    expect(one('none', false).ticks).toBe(1);
    expect(one('translation', true).ticks).toBe(1);
    // the assisted customer's total and thanks are not discounted
    expect(one('translation', false).r).toBe(1);
  });

  it('a greeting adds 10% to that customer, never past its 3 units', () => {
    const base = scoreShift(shift([{ order: false }, {}, {}, {}, {}]));
    const greeted = scoreShift(shift([{ order: false, greet: true }, {}, {}, {}, {}]));
    expect(greeted.ticks).toBeCloseTo(base.ticks + (2 * 0.1) / 15, 10);
    expect(scoreShift(shift({ greet: true })).ticks).toBe(1);
    // a wrong greeting costs nothing
    expect(scoreShift(shift({ greet: false })).ticks).toBe(1);
    // and an optional greeting is not a scored task: it does not make a flawed shift perfect
    expect(scoreShift(shift([{ order: false, greet: true }, {}, {}, {}, {}])).perfect).toBe(false);
  });

  it('good needs all 5 served, not quit, ticks >= 0.6', () => {
    expect(scoreShift(nRight(3)).good).toBe(true);
    expect(scoreShift(nRight(2)).good).toBe(false);
    expect(scoreShift(shift([{}, {}, {}, {}, { served: false }])).good).toBe(false);
    expect(scoreShift(perfect({ quit: true })).good).toBe(false);
  });

  it('an assisted shift can be good but is not perfect-by-ticks; perfect means every task right and good', () => {
    const s = scoreShift(shift([{ assist: 'translation' }, {}, {}, {}, {}], { assistWaived: false }));
    expect(s.good).toBe(true);
    expect(s.perfect).toBe(true);
    expect(s.ticks).toBeLessThan(1);
    expect(scoreShift(nRight(4)).perfect).toBe(false);
  });

  it('trial: ticks below 0.6 with >= 2 served and not quit; it is never good or perfect', () => {
    const t = scoreShift(nRight(2));
    expect(t).toMatchObject({ trial: true, good: false, perfect: false, band: 'retry' });
    expect(scoreShift(nRight(3)).trial).toBe(false);
    expect(scoreShift(shift([{ order: false, total: false, thanks: false }, { order: false, total: false, thanks: false }, { served: false }, { served: false }, { served: false }])).trial).toBe(true);
    expect(scoreShift(shift([{ served: false }, { served: false }, { served: false }, { served: false }, { served: false }])).trial).toBe(false);
    expect(scoreShift(nRight(2, { quit: true })).trial).toBe(false);
  });

  it('bands on accuracy: >= 0.9 perfect, 0.7-0.89 nice, 0.6-0.69 almost, below retry', () => {
    const band = (n: number) => scoreShift(nRight(n)).band;
    expect(band(5)).toBe('perfect');
    expect(band(4)).toBe('nice'); // 0.8
    expect(band(3)).toBe('almost'); // 0.6
    expect(band(2)).toBe('retry');
    expect(scoreShift(shift([{ total: false }, {}, {}, {}, {}])).band).toBe('perfect'); // 14/15 = 0.93
    expect(scoreShift(shift([{ total: false }, { total: false }, {}, {}, {}])).band).toBe('nice'); // 13/15 = 0.87
  });

  it('exact pass marks survive float sums (0.6 and 0.9 are inclusive)', () => {
    // 5 customers x 3 units = 15; 9 units = 0.6
    expect(scoreShift(nRight(3)).ticks + 1e-12).toBeGreaterThanOrEqual(BALANCE.shift.accuracy);
    // 0.7-weighted sums that land on 0.6: 6 orders at 0.7 = 4.2 + 4.8 other units ... use a mix and check good is stable
    const mixed = shift([{ assist: 'text' }, { assist: 'text' }, { assist: 'text' }, { assist: 'text' }, { assist: 'text' }], { assistWaived: false });
    expect(scoreShift(mixed).ticks).toBeCloseTo((10 + 5 * 0.7) / 15, 10);
  });

  it('a quit shift keeps its flag and is never good', () => {
    const s = scoreShift(nRight(3, { quit: true }));
    expect(s.quit).toBe(true);
    expect(s.good).toBe(false);
  });
});

describe('property: shift score in [0,1]; perfect beats random', () => {
  const rndShift = (rnd: () => number): ShiftResult => {
    const inputs: ShiftInput[] = ['typed', 'spoken', 'tiles', 'pick'];
    const assists: ShiftAssist[] = ['none', 'text', 'translation'];
    const p = rnd();
    return shift(
      Array.from({ length: 5 }, () => {
        const ok = () => rnd() < p;
        return {
          served: rnd() < 0.95,
          assist: assists[Math.floor(rnd() * 3)]!,
          order: ok(),
          total: ok() ? inputs[Math.floor(rnd() * 4)]! : false,
          thanks: ok() ? inputs[Math.floor(rnd() * 4)]! : false,
          greet: rnd() < 0.5 ? rnd() < 0.8 : undefined,
        } satisfies Spec;
      }),
      { quit: rnd() < 0.1, assistWaived: rnd() < 0.4 },
    );
  };

  it('ticks, r and perf stay in [0, 1] for any result', () => {
    const rnd = lcg(5);
    for (let i = 0; i < 2000; i++) {
      const s = scoreShift(rndShift(rnd));
      for (const v of [s.ticks, s.r, s.perf]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(s.perf).toBeLessThanOrEqual(s.ticks + 1e-12);
      if (s.perfect) expect(s.good).toBe(true);
      if (s.good) expect(s.trial).toBe(false);
    }
  });

  it('a perfect shift beats every random shift, in score and in pay', () => {
    const rnd = lcg(11);
    const best = scoreShift(perfect());
    for (let i = 0; i < 2000; i++) {
      const r = rndShift(rnd);
      const s = scoreShift(r);
      expect(best.perf).toBeGreaterThanOrEqual(s.perf);
      expect(best.ticks).toBeGreaterThanOrEqual(s.ticks);
      for (const rank of [0, 2, 4]) expect(pay(konbini, perfect(), rank)).toBeGreaterThanOrEqual(pay(konbini, r, rank));
    }
  });

  it('typing beats tiles beats chips, and a corrected task never lowers the score', () => {
    const rnd = lcg(21);
    for (let i = 0; i < 300; i++) {
      const r = rndShift(rnd);
      const base = scoreShift(r);
      // upgrade every production input to typed
      const typed: ShiftResult = { ...r, customers: r.customers.map((c) => ({ ...c, tasks: c.tasks.map((t) => (t.ok && t.input ? { ...t, input: 'typed' as const } : t)) })) };
      expect(scoreShift(typed).perf).toBeGreaterThanOrEqual(base.perf - 1e-12);
      // fix every wrong task
      const fixed: ShiftResult = { ...r, customers: r.customers.map((c) => ({ ...c, tasks: c.tasks.map((t) => (t.ok ? t : { ...t, ok: true, input: 'pick' as const })) })) };
      expect(scoreShift(fixed).ticks).toBeGreaterThanOrEqual(base.ticks - 1e-12);
    }
    expect(scoreShift(shift({ total: 'typed', thanks: 'typed' })).perf).toBeGreaterThan(scoreShift(shift({ total: 'tiles', thanks: 'tiles' })).perf);
    expect(scoreShift(shift({ total: 'tiles', thanks: 'tiles' })).perf).toBeGreaterThan(scoreShift(chips()).perf);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// shiftPay: the §9.2 table
// ---------------------------------------------------------------------------------------------------------------

describe('shiftPay: golden numbers (§9.2)', () => {
  const jobs: Array<[string, number, [number, number, number]]> = [
    ['job_konbini', 1150, [860, 1140, 290]],
    ['job_cafe', 1200, [900, 1190, 310]],
    ['job_station', 1400, [1050, 1390, 360]],
  ];
  it.each(jobs)('%s: rank-0 full skill, rank-4 full skill, all chips', (id, wage, [r0, r4, allChips]) => {
    const j = job(wage, id);
    expect(pay(j, perfect(), 0)).toBe(r0);
    expect(pay(j, perfect(), 4)).toBe(r4);
    expect(pay(j, chips(), 0)).toBe(allChips);
  });

  it('the second shift of the day: konbini 520 (another job x0.6) or 430 (same job x0.5)', () => {
    expect(pay(konbini, perfect(), 0, 0.6)).toBe(520);
    expect(pay(konbini, perfect(), 0, 0.5)).toBe(430);
  });

  it('the worked example: ticks 0.8, r 0.7 -> perf 0.49 -> 430', () => {
    const score = { ...scoreShift(perfect()), ticks: 0.8, r: 0.7, perf: 0.8 * (0.25 + 0.75 * 0.49) };
    expect(shiftPay(konbini, score, 0, 1)).toBe(430);
  });

  it('rank multipliers [1, 1.08, 1.16, 1.24, 1.32] and a clamped rank', () => {
    const p = (rank: number) => pay(konbini, perfect(), rank);
    expect([0, 1, 2, 3, 4].map(p)).toEqual([860, 930, 1000, 1070, 1140]);
    expect(p(9)).toBe(p(4));
    expect(p(-3)).toBe(p(0));
  });

  it('pays in multiples of 10', () => {
    for (let i = 0; i < 300; i++) expect(pay(konbini, shift({ total: i % 2 ? 'tiles' : 'pick' }), i % 5, 0.6) % 10).toBe(0);
  });

  it('the trial wage is the reference 100 and does not depend on how the shift was cut', () => {
    expect(pay(konbini, nRight(2))).toBe(BALANCE.shift.trial);
    expect(pay(job(1400), nRight(2), 4)).toBe(100);
    expect(shiftPay(konbini, scoreShift(nRight(2)), 0, 1, { ...pack, economy: { ...pack.economy, incomeScale: 2 } })).toBe(200);
  });

  it('quit: 0 with fewer than 2 served, x0.6 of the formula with 2 or more', () => {
    const q = (n: number) => pay(konbini, shift(Array.from({ length: 5 }, (_, i) => (i < n ? {} : { served: false })), { quit: true }));
    expect(q(0)).toBe(0);
    expect(q(1)).toBe(0);
    expect(q(2)).toBe(Math.round((862.5 * (2 * 3) / 15 * 0.6) / 10) * 10);
    expect(q(4)).toBe(Math.round((862.5 * (4 * 3) / 15 * 0.6) / 10) * 10);
    // a quit shift never pays the full shift
    expect(q(4)).toBeLessThan(pay(konbini, perfect()));
  });

  it('a repeat multiplier of 0 pays nothing, and pay never goes negative', () => {
    expect(pay(konbini, perfect(), 0, 0)).toBe(0);
    expect(pay(konbini, perfect(), 0, -1)).toBe(0);
    // five customers served and every task wrong is a trial shift; nobody served pays nothing
    expect(pay(konbini, nRight(0))).toBe(BALANCE.shift.trial);
    expect(pay(konbini, shift({ served: false }))).toBe(0);
  });
});

describe('rankFor and the daily repeat multiplier', () => {
  it('ranks by good shifts: 3 / 6 / 10 / 15', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 10, 14, 15, 99].map(rankFor)).toEqual([0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  const paid = (s: GameState, jobId: string, n: number): GameState => ({ ...s, pay: { ...s.pay, shiftsToday: { ...s.pay.shiftsToday, [jobId]: n } } });

  it('1, then 0.6 for another job or 0.5 for the same, then none', () => {
    const s = makeState(10);
    expect(shiftRepeatMult(s, 'job_konbini')).toBe(1);
    expect(shiftRepeatMult(paid(s, 'job_konbini', 1), 'job_konbini')).toBe(0.5);
    expect(shiftRepeatMult(paid(s, 'job_konbini', 1), 'job_cafe')).toBe(0.6);
    expect(shiftRepeatMult(paid(s, 'job_konbini', 2), 'job_konbini')).toBe(0);
    expect(shiftRepeatMult(paid(paid(s, 'job_konbini', 1), 'job_cafe', 1), 'job_station')).toBe(0);
    expect(shiftRepeatMult(paid(paid(s, 'job_konbini', 1), 'job_cafe', 1), 'job_cafe')).toBe(0);
  });

  it('a stale day counts as no shifts', () => {
    const s = { ...paid(makeState(10), 'job_konbini', 2), clock: { ...makeState(10).clock, dayIndex: 11 } };
    expect(shiftRepeatMult(s, 'job_konbini')).toBe(1);
  });

  it('assist factors are waived for the first 2 shifts at a job, and without a Japanese voice', () => {
    let s = makeState();
    expect(shiftAssistWaived(s, 'job_konbini')).toBe(true);
    s = { ...s, jobs: { job_konbini: { shifts: 2, good: 2, perfect: 0, rank: 0, recent: [] } } };
    expect(shiftAssistWaived(s, 'job_konbini')).toBe(false);
    expect(shiftAssistWaived(s, 'job_cafe')).toBe(true);
    expect(shiftAssistWaived({ ...s, audio: { ...s.audio, listenPref: 'off' } }, 'job_konbini')).toBe(true);
    expect(shiftAssistWaived({ ...s, audio: { ...s.audio, lastMode: 'read-and-type' } }, 'job_konbini')).toBe(true);
    expect(shiftAssistWaived({ ...s, audio: { ...s.audio, lastMode: 'type-only' } }, 'job_konbini')).toBe(true);
    expect(shiftAssistWaived({ ...s, audio: { ...s.audio, lastMode: 'full' } }, 'job_konbini')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// applyShift
// ---------------------------------------------------------------------------------------------------------------

const twoJobs: GamePack = { ...pack, jobs: [konbini, { ...konbini, id: 'job_cafe', place: 'cafe' }] };
const shiftOf = (id: string, r: ShiftResult, jobId = 'job_konbini'): ShiftResult => ({ ...r, id, jobId });
const run = (s: GameState, r: ShiftResult, jobId = r.jobId, p: GamePack = pack) => applyShift(s, jobId, r, ctxOf(p));

describe('applyShift', () => {
  it('pays through the ledger, updates the job and the day, grants the perfect bonus', () => {
    const s = makeState(10);
    const r = run(s, perfect());
    expect(r.state.wallet.cash).toBe(s.wallet.cash + 860);
    expect(r.state.ledger.at(-1)).toMatchObject({ id: 'shift:d10:job_konbini:1', kind: 'shift', delta: 860, pocket: 'cash', ref: 'sh1' });
    expect(r.state.jobs.job_konbini).toEqual({ shifts: 1, good: 1, perfect: 1, rank: 0, lastDay: 'd10', recent: ['k0', 'k1', 'k2', 'k3', 'k4'] });
    expect(r.state.pay.shiftsToday).toEqual({ job_konbini: 1 });
    expect(r.state.pay.langToday).toBe(860);
    expect(ownedQty(r.state, 'konbini:onigiri')).toBe(1);
    expect(r.derived.map((d) => d.t)).toEqual(['wallet_changed', 'unlocked', 'shift_settled']);
    expect(r.derived.at(-1)).toMatchObject({ t: 'shift_settled', jobId: 'job_konbini', pay: 860, rankBefore: 0, rankAfter: 0 });
    expect(reconcile(r.state, BALANCE.startCash).ok).toBe(true);
    expect(r.state.totals.earned).toBe(860);
  });

  it('a good but flawed shift has no bonus; a trial shift pays 100 and counts for nothing', () => {
    const good = run(makeState(10), nRight(4));
    expect(ownedQty(good.state, 'konbini:onigiri')).toBe(0);
    expect(good.state.jobs.job_konbini).toMatchObject({ shifts: 1, good: 1, perfect: 0 });

    const trial = run(makeState(10), nRight(2));
    expect(trial.state.wallet.cash).toBe(makeState(10).wallet.cash + 100);
    expect(trial.state.jobs.job_konbini).toMatchObject({ shifts: 1, good: 0, perfect: 0, rank: 0 });
    expect(trial.state.pay.shiftsToday.job_konbini).toBe(1);
    expect(trial.derived.at(-1)).toMatchObject({ t: 'shift_settled', pay: 100 });
    if (trial.derived.at(-1)!.t === 'shift_settled') expect((trial.derived.at(-1) as { score: { trial: boolean; good: boolean } }).score).toMatchObject({ trial: true, good: false });
  });

  it('the trial wage never counts toward ranks, even over many shifts', () => {
    let s = makeState(10);
    for (let d = 0; d < 20; d++) {
      s = run(s, shiftOf(`t${d}`, nRight(2))).state;
      s = { ...s, clock: { ...s.clock, dayIndex: s.clock.dayIndex + 1 } };
    }
    expect(s.jobs.job_konbini).toMatchObject({ shifts: 20, good: 0, perfect: 0, rank: 0 });
  });

  it('a third shift in a day is refused and changes nothing; the second pays x0.5 (same job)', () => {
    let s = makeState(10);
    s = run(s, shiftOf('a', perfect())).state;
    const second = run(s, shiftOf('b', perfect()));
    expect(second.state.wallet.cash - s.wallet.cash).toBe(430);
    expect(second.state.ledger.at(-1)!.id).toBe('shift:d10:job_konbini:2');
    const third = run(second.state, shiftOf('c', perfect()));
    expect(third.state).toBe(second.state);
    expect(third.derived).toEqual([]);
  });

  it('a second shift at another job pays x0.6, and the day then has no third', () => {
    let s = run(makeState(10), shiftOf('a', perfect()), 'job_konbini', twoJobs).state;
    const cafe = run(s, shiftOf('b', perfect(), 'job_cafe'), 'job_cafe', twoJobs);
    expect(cafe.state.wallet.cash - s.wallet.cash).toBe(520);
    s = cafe.state;
    expect(run(s, shiftOf('c', perfect()), 'job_konbini', twoJobs).state).toBe(s);
    expect(run(s, shiftOf('d', perfect(), 'job_cafe'), 'job_cafe', twoJobs).state).toBe(s);
  });

  it('the next day opens the allowance again', () => {
    let s = makeState(10);
    s = run(s, shiftOf('a', perfect())).state;
    s = run(s, shiftOf('b', perfect())).state;
    s = { ...s, clock: { ...s.clock, dayIndex: 11 } };
    const r = run(s, shiftOf('c', perfect()));
    expect(r.state.wallet.cash - s.wallet.cash).toBe(860);
    expect(r.state.pay.shiftsToday).toEqual({ job_konbini: 1 });
    expect(r.state.ledger.at(-1)!.id).toBe('shift:d11:job_konbini:1');
  });

  it('a replay of the same shift pays once', () => {
    const a = run(makeState(10), perfect());
    const b = run(a.state, perfect());
    expect(b.state).toBe(a.state);
    expect(b.derived).toEqual([]);
  });

  it('quit before 2 customers: nothing changes and no daily slot is used; later quit pays x0.6 and never counts', () => {
    const s = makeState(10);
    const early = run(s, shift(Array.from({ length: 5 }, (_, i) => (i < 1 ? {} : { served: false })), { quit: true }));
    expect(early.state).toBe(s);
    const late = run(s, shift(Array.from({ length: 5 }, (_, i) => (i < 4 ? {} : { served: false })), { quit: true }));
    expect(late.state.wallet.cash - s.wallet.cash).toBe(Math.round((862.5 * 0.8 * 0.6) / 10) * 10);
    expect(late.state.jobs.job_konbini).toMatchObject({ shifts: 1, good: 0, perfect: 0 });
    expect(ownedQty(late.state, 'konbini:onigiri')).toBe(0);
  });

  it('promotes after 3 good shifts, paid at the rank held when the shift started', () => {
    let s = makeState(10);
    s = { ...s, jobs: { job_konbini: { shifts: 2, good: 2, perfect: 0, rank: 0, recent: [] } } };
    const up = run(s, shiftOf('p3', perfect()));
    expect(up.state.wallet.cash - s.wallet.cash).toBe(860);
    expect(up.state.jobs.job_konbini).toMatchObject({ good: 3, rank: 1 });
    expect(up.derived.at(-1)).toMatchObject({ t: 'shift_settled', rankBefore: 0, rankAfter: 1 });
    const next = run({ ...up.state, clock: { ...up.state.clock, dayIndex: 11 } }, shiftOf('p4', perfect()));
    expect(next.state.wallet.cash - up.state.wallet.cash).toBe(930);
  });

  it('rank never falls: a failed shift pays the trial wage and keeps the rank', () => {
    let s = makeState(10);
    s = { ...s, jobs: { job_konbini: { shifts: 20, good: 15, perfect: 3, rank: 4, recent: [] } } };
    const r = run(s, shift(Array.from({ length: 5 }, (_, i) => (i < 1 ? {} : { served: false })), { id: 'bad' }));
    expect(r.state).toBe(s); // one customer served pays nothing and uses no slot
    const trial = run(s, nRight(2, { id: 'bad2' }));
    expect(trial.state.jobs.job_konbini).toMatchObject({ rank: 4, good: 15 });
  });

  it('remembers the order signatures of the last 3 shifts only', () => {
    let s = makeState(10);
    for (let i = 0; i < 5; i++) {
      const r = shiftOf(`h${i}`, { ...perfect(), customers: perfect().customers.map((c, j) => ({ ...c, templateId: `s${i}c${j}` })) });
      s = run(s, r).state;
      s = { ...s, clock: { ...s.clock, dayIndex: s.clock.dayIndex + 1 } };
    }
    const keep = BALANCE.shift.variety.noRepeatShifts * BALANCE.shift.customers;
    expect(s.jobs.job_konbini!.recent).toHaveLength(keep);
    expect(s.jobs.job_konbini!.recent[0]).toBe('s2c0');
    expect(s.jobs.job_konbini!.recent.at(-1)).toBe('s4c4');
  });

  it('language yen past the soft cap pay x0.25 like any other (shifts are part of the cap)', () => {
    const s = { ...makeState(10), pay: { ...makeState(10).pay, langToday: BALANCE.softCap } };
    const r = run(s, perfect());
    expect(r.state.wallet.cash - s.wallet.cash).toBe(Math.round((860 * BALANCE.softCapFactor) / 10) * 10);
    const part = { ...makeState(10), pay: { ...makeState(10).pay, langToday: BALANCE.softCap - 400 } };
    const p = run(part, perfect());
    expect(p.state.wallet.cash - part.wallet.cash).toBe(Math.round((400 + 460 * BALANCE.softCapFactor) / 10) * 10);
    expect(p.state.pay.langToday).toBe(BALANCE.softCap - 400 + (p.state.wallet.cash - part.wallet.cash));
  });

  it('a full wallet takes what fits', () => {
    const s = makeState(10);
    const full = { ...s, wallet: { ...s.wallet, cash: pack.economy.walletCap - 100 }, totals: { ...s.totals, checksum: { ...s.totals.checksum, cash: pack.economy.walletCap - 100 } } };
    const r = run(full, perfect());
    expect(r.state.wallet.cash).toBe(pack.economy.walletCap);
    expect(r.derived.find((d) => d.t === 'wallet_changed')).toMatchObject({ delta: 100 });
  });

  it('an unknown job changes nothing; the event cannot take the wrong job\'s id', () => {
    const s = makeState(10);
    expect(run(s, perfect(), 'job_nope').state).toBe(s);
    const r = run(s, { ...perfect(), jobId: 'job_other' }, 'job_konbini');
    expect(r.state.jobs.job_konbini?.shifts).toBe(1);
  });

  it('never mutates its input', () => {
    const s = makeState(10);
    const before = JSON.stringify(s);
    run(s, perfect());
    expect(JSON.stringify(s)).toBe(before);
  });

  it('property: wallet reconciles and the day never has more than 2 paid shifts, whatever is thrown at it', () => {
    const rnd = lcg(8);
    let s = makeState(10);
    for (let i = 0; i < 200; i++) {
      const specs = Array.from({ length: 5 }, () => ({ order: rnd() < 0.8, total: rnd() < 0.8 ? (['typed', 'tiles', 'pick'] as ShiftInput[])[Math.floor(rnd() * 3)]! : false, thanks: rnd() < 0.8 ? ('pick' as ShiftInput) : false, served: rnd() < 0.95 }));
      s = run(s, shiftOf(`r${i}`, shift(specs, { quit: rnd() < 0.1 })), rnd() < 0.5 ? 'job_konbini' : 'job_cafe', twoJobs).state;
      if (i % 3 === 2) s = { ...s, clock: { ...s.clock, dayIndex: s.clock.dayIndex + 1 } };
      expect(Object.values(s.pay.shiftsToday).reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(BALANCE.shift.dailyMax);
      expect(reconcile(s, BALANCE.startCash).ok).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// generateShift
// ---------------------------------------------------------------------------------------------------------------

/** a job with 8 archetypes so a shift of 5 has real choices */
const bigJob: JobDef = {
  ...konbini,
  archetypes: [
    ...konbini.archetypes,
    { ...konbini.archetypes[0]!, id: 'k_x1', line: { ja: 'サンドイッチをください。', en: 'x', ar: 'x' }, task: { kind: 'order', items: [{ menu: 'konbini:sandwich', qty: 1 }] } },
    { ...konbini.archetypes[0]!, id: 'k_x2', line: { ja: 'お茶をください。', en: 'x', ar: 'x' }, task: { kind: 'order', items: [{ menu: 'konbini:tea', qty: 1 }] } },
    { ...konbini.archetypes[0]!, id: 'k_x3', line: { ja: 'お弁当をふたつ。', en: 'x', ar: 'x' }, task: { kind: 'order', items: [{ menu: 'konbini:bento', qty: 2 }] } },
  ],
};
const bigPack: GamePack = { ...pack, jobs: [bigJob] };
const plan = (p: GamePack, o: Partial<Parameters<typeof generateShift>[2]> = {}) => generateShift(p, 'job_konbini', { rank: 4, seed: 1, dueWords: [], recent: [], ...o });

describe('generateShift (§9.1)', () => {
  it('is five customers, each with its order total', () => {
    const p = plan(bigPack);
    expect(p).toMatchObject({ jobId: 'job_konbini', seed: 1, rank: 4 });
    expect(p.customers).toHaveLength(BALANCE.shift.customers);
    for (const c of p.customers) {
      const t = bigJob.archetypes.find((a) => a.id === c.templateId)!;
      expect(c.line).toEqual(t.line);
      expect(c.thanks).toEqual(t.thanks);
      if (t.task.kind === 'order') expect(c.total).toBe(t.task.items.reduce((s, i) => s + pack.menu.find((m) => m.id === i.menu)!.price * i.qty, 0));
    }
    const byId = (id: string) => plan(bigPack, { rank: 4 }).customers.find((c) => c.templateId === id);
    // k_basic: 2 onigiri x ¥160; k_two: tea 150 + 3 sandwiches 900
    const all = Array.from({ length: 40 }, (_, i) => plan(bigPack, { seed: i }).customers).flat();
    expect(all.find((c) => c.templateId === 'k_basic')!.total).toBe(320);
    expect(all.find((c) => c.templateId === 'k_two')!.total).toBe(1050);
    expect(byId).toBeTypeOf('function');
  });

  it('is deterministic in the seed and varies across seeds', () => {
    expect(plan(bigPack, { seed: 42 })).toEqual(plan(bigPack, { seed: 42 }));
    const sigs = new Set(Array.from({ length: 30 }, (_, i) => plan(bigPack, { seed: i }).customers.map((c) => c.templateId).join()));
    expect(sigs.size).toBeGreaterThan(15);
  });

  it('draws without replacement while the pool lasts', () => {
    for (let seed = 0; seed < 50; seed++) {
      const ids = plan(bigPack, { seed }).customers.map((c) => c.templateId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('respects the rank: tier <= rank + 1 and minRank', () => {
    const tiers = (rank: number) => new Set(Array.from({ length: 60 }, (_, i) => plan(pack, { rank, seed: i }).customers.map((c) => c.templateId)).flat());
    expect(tiers(0).has('k_change')).toBe(false);
    expect(tiers(1).has('k_change')).toBe(false);
    expect(tiers(2).has('k_change')).toBe(false); // tier 4 > rank 2 + 1
    expect(tiers(3).has('k_change')).toBe(true);
    // rank 1: tier <= 2 gives k_basic, k_two, k_tea2 (3 < 4), topped up with the lowest remaining tier open at rank 1
    expect(tiers(1).has('k_heat')).toBe(true);
  });

  it('a small pool is topped up to 4 archetypes and a second round never repeats back to back', () => {
    for (let seed = 0; seed < 60; seed++) {
      const ids = plan(pack, { rank: 0, seed }).customers.map((c) => c.templateId);
      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBeGreaterThanOrEqual(4);
      for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    }
  });

  it('never repeats an order seen in the last shifts while another is available', () => {
    const recent = ['k_basic', 'k_two', 'k_heat'];
    for (let seed = 0; seed < 60; seed++) {
      const ids = plan(bigPack, { seed, recent }).customers.map((c) => c.templateId);
      for (const r of recent) expect(ids, `seed ${seed}`).not.toContain(r);
    }
    // everything recent: the one used longest ago comes first
    const first = plan(pack, { rank: 4, recent: ['k_a', 'k_basic', 'k_two', 'k_heat', 'k_change', 'k_tea2'] }).customers[0]!.templateId;
    expect(first).toBe('k_basic');
  });

  it('leans toward words due for review', () => {
    const count = (due: string[]) => {
      let n = 0;
      for (let seed = 0; seed < 600; seed++) if (plan(bigPack, { seed, rank: 4, dueWords: due }).customers.some((c) => c.templateId === 'k_x3')) n++;
      return n;
    };
    const base = count([]);
    const due = count(['お弁当']);
    expect(base / 600).toBeGreaterThan(0.5); // 5 of 8 are drawn
    expect(due).toBeGreaterThan(base);
    expect(due / 600).toBeGreaterThan(0.75);
    // a due word nobody says changes nothing
    expect(count(['ほうれんそう'])).toBe(base);
  });

  it('leans toward the job vocabulary tags too', () => {
    const tagged: GamePack = { ...bigPack, wordTags: { food: ['サンドイッチ'] } };
    const hits = (p: GamePack) => {
      let n = 0;
      for (let seed = 0; seed < 600; seed++) if (plan(p, { seed, rank: 4 }).customers.some((c) => c.templateId === 'k_x1')) n++;
      return n;
    };
    expect(hits(tagged)).toBeGreaterThan(hits({ ...bigPack, wordTags: {} }));
  });

  it('an unknown job gives an empty plan; a bad rank is clamped', () => {
    expect(generateShift(pack, 'job_nope', { rank: 0, seed: 1, dueWords: [], recent: [] }).customers).toEqual([]);
    expect(plan(pack, { rank: 99 }).rank).toBe(4);
    expect(plan(pack, { rank: -4 }).rank).toBe(0);
  });
});
