import { afterEach, describe, expect, it } from 'vitest';
import { BALANCE, dedupe, emptyPay, localDateString, markActive, observeClock, payForDay } from '@lw/game';
import type { GameState } from '@lw/game';
import { lcg, makeState } from './fixtures-1e';

const DAY = 24 * 3600 * 1000;
/** A local timestamp (the wall calendar, whatever the machine's zone). */
const at = (y: number, m: number, d: number, h = 12, min = 0, s = 0, ms = 0) => new Date(y, m - 1, d, h, min, s, ms).getTime();

const start = (): GameState => {
  const s = makeState(10);
  return { ...s, clock: { ...s.clock, lastLocalDate: '2026-10-04' } };
};

const realTz = process.env.TZ;
afterEach(() => {
  if (realTz === undefined) delete process.env.TZ;
  else process.env.TZ = realTz;
});

describe('localDateString', () => {
  it('is the local calendar date, zero-padded', () => {
    expect(localDateString(at(2026, 10, 4, 0, 0))).toBe('2026-10-04');
    expect(localDateString(at(2026, 1, 9, 23, 59, 59, 999))).toBe('2026-01-09');
    expect(localDateString(at(2030, 12, 31, 12))).toBe('2030-12-31');
  });
});

describe('observeClock (D3 / D27, §14.5)', () => {
  it('the same date changes nothing but lastSeenAt', () => {
    const s = start();
    const r = observeClock(s, at(2026, 10, 4, 18));
    expect(r.rolled).toBe(false);
    expect(r.state.clock).toEqual({ ...s.clock, lastSeenAt: at(2026, 10, 4, 18) });
    expect(r.state.pay).toBe(s.pay);
  });

  it('a later date adds exactly one day and resets the day counters', () => {
    const s = { ...start(), pay: { ...makeState(10).pay, langToday: 900, shiftsToday: { job_konbini: 2 }, scenarioToday: { a: 1 } } };
    const r = observeClock(s, at(2026, 10, 5, 8));
    expect(r.rolled).toBe(true);
    expect(r.state.clock).toMatchObject({ dayIndex: 11, lastLocalDate: '2026-10-05' });
    expect(r.state.pay).toMatchObject({ day: 'd11', langToday: 0, shiftsToday: {}, scenarioToday: {} });
  });

  it('keeps the lifetime parts of pay across a rollover', () => {
    const base = makeState(10);
    const s = { ...start(), pay: { ...base.pay, seenIntents: ['konbini:greet'], lastPaid: { konbini: 'd10' }, echoSession: { sessionId: 'x', n: 1 } } };
    const p = observeClock(s, at(2026, 10, 5)).state.pay;
    expect(p.seenIntents).toEqual(['konbini:greet']);
    expect(p.lastPaid).toEqual({ konbini: 'd10' });
    expect(p.echoSession).toEqual({ sessionId: 'x', n: 1 });
    expect(payForDay(p, 'd11')).toBe(p);
    expect(payForDay(emptyPay('d3'), 'd4').day).toBe('d4');
  });

  it('whatever the jump, a later date is one day: +400 days, then back, reopens nothing and does not pin the clock', () => {
    let s = start();
    s = observeClock(s, at(2026, 10, 4, 20)).state;
    const jump = observeClock(s, at(2026, 10, 4, 20) + 400 * DAY);
    expect(jump.rolled).toBe(true);
    expect(jump.state.clock.dayIndex).toBe(11);
    // the clock comes back: nothing reopens
    const back = observeClock({ ...jump.state, pay: { ...jump.state.pay, langToday: 500 } }, at(2026, 10, 5, 9));
    expect(back.rolled).toBe(false);
    expect(back.state.clock).toMatchObject({ dayIndex: 11, lastLocalDate: '2026-10-05' });
    expect(back.state.pay.langToday).toBe(500);
    // and it is not pinned in the future: the next real day rolls normally
    const next = observeClock(back.state, at(2026, 10, 6, 9));
    expect(next.rolled).toBe(true);
    expect(next.state.clock.dayIndex).toBe(12);
    // overall: one spurious day for the whole excursion
    expect(next.state.clock.dayIndex - s.clock.dayIndex).toBe(2);
  });

  it('an earlier date only re-anchors lastLocalDate', () => {
    const s = start();
    const r = observeClock(s, at(2026, 9, 1, 12));
    expect(r.rolled).toBe(false);
    expect(r.state.clock).toMatchObject({ dayIndex: 10, lastLocalDate: '2026-09-01', activeDays: 0 });
    expect(r.state.pay).toBe(s.pay);
  });

  it('a time-zone hop (-1 day then +1 day) grants at most one extra rollover', () => {
    process.env.TZ = 'Pacific/Auckland';
    const instant = Date.UTC(2026, 9, 4, 20, 0); // 09:00 on 5 Oct in Auckland
    expect(localDateString(instant)).toBe('2026-10-05');
    let s = observeClock(start(), instant).state;
    expect(s.clock).toMatchObject({ dayIndex: 11, lastLocalDate: '2026-10-05' });
    // fly east across the date line: the same instant is now 4 Oct
    process.env.TZ = 'Pacific/Honolulu';
    expect(localDateString(instant)).toBe('2026-10-04');
    const west = observeClock(s, instant);
    expect(west.rolled).toBe(false);
    expect(west.state.clock).toMatchObject({ dayIndex: 11, lastLocalDate: '2026-10-04' });
    // and back: the 5th is "later" again, one more rollover, never more
    process.env.TZ = 'Pacific/Auckland';
    const back = observeClock(west.state, instant + 3600 * 1000);
    expect(back.rolled).toBe(true);
    expect(back.state.clock.dayIndex).toBe(12);
    s = observeClock(back.state, instant + 2 * 3600 * 1000).state;
    expect(s.clock.dayIndex).toBe(12);
  });

  it('midnight with the app open rolls once', () => {
    let s = observeClock(start(), at(2026, 10, 4, 23, 59, 59, 999)).state;
    expect(s.clock.dayIndex).toBe(10);
    const r = observeClock(s, at(2026, 10, 5, 0, 0, 0, 0));
    expect(r.rolled).toBe(true);
    s = r.state;
    for (let i = 1; i <= 50; i++) s = observeClock(s, at(2026, 10, 5, 0, 0, i)).state;
    expect(s.clock.dayIndex).toBe(11);
  });

  it.each([
    ['spring forward (23-hour day)', 'America/New_York', Date.UTC(2026, 2, 7, 12, 0), 3],
    ['fall back (25-hour day)', 'America/New_York', Date.UTC(2026, 10, 1, 0, 0), 3],
    ['southern spring forward', 'Australia/Sydney', Date.UTC(2026, 9, 3, 6, 0), 3],
  ])('DST: %s gives one rollover per calendar date, hour by hour', (_n, tz, from, days) => {
    process.env.TZ = tz;
    let s = observeClock(start(), from).state;
    const first = s.clock.dayIndex;
    const seenDates = new Set<string>([localDateString(from)]);
    for (let h = 1; h <= days * 24 + 30; h++) {
      const t = from + h * 3600 * 1000;
      seenDates.add(localDateString(t));
      s = observeClock(s, t).state;
    }
    // one rollover per later date than the first, never two for one date and never none
    expect(s.clock.dayIndex - first).toBe(seenDates.size - 1);
    expect(s.clock.lastLocalDate).toBe(localDateString(from + (days * 24 + 30) * 3600 * 1000));
  });

  it('a non-finite time and a corrupt stored date are tolerated', () => {
    const s = start();
    expect(observeClock(s, Number.NaN)).toEqual({ state: s, rolled: false });
    const bad = { ...s, clock: { ...s.clock, lastLocalDate: '' } };
    const r = observeClock(bad, at(2026, 10, 4));
    expect(r.rolled).toBe(false);
    expect(r.state.clock).toMatchObject({ dayIndex: 10, lastLocalDate: '2026-10-04' });
  });

  it('never mutates its input', () => {
    const s = start();
    const frozen = JSON.stringify(s);
    observeClock(s, at(2027, 1, 1));
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it('property: dayIndex never falls, grows by at most 1 per observation, and equals the count of dates later than the running anchor', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rnd = lcg(seed);
      let s = start();
      let anchor = s.clock.lastLocalDate;
      let expected = s.clock.dayIndex;
      for (let i = 0; i < 80; i++) {
        // mostly small steps with the odd big jump forward or back
        const r = rnd();
        const dt = r < 0.1 ? 400 * DAY : r < 0.2 ? -300 * DAY : r < 0.5 ? DAY : r < 0.7 ? -DAY : (rnd() - 0.5) * 6 * 3600 * 1000;
        const t = (s.clock.lastSeenAt || at(2026, 10, 4)) + dt;
        const d = localDateString(t);
        if (d > anchor) expected++;
        anchor = d;
        const before = s.clock.dayIndex;
        s = observeClock(s, t).state;
        expect(s.clock.dayIndex - before).toBeGreaterThanOrEqual(0);
        expect(s.clock.dayIndex - before).toBeLessThanOrEqual(1);
        expect(s.clock.lastLocalDate).toBe(d);
      }
      expect(s.clock.dayIndex).toBe(expected);
    }
  });
});

describe('dedupe', () => {
  it('lets an id through once', () => {
    const a = dedupe(makeState(), 'conv:s1');
    expect(a.fresh).toBe(true);
    const b = dedupe(a.state, 'conv:s1');
    expect(b.fresh).toBe(false);
    expect(b.state).toBe(a.state);
    expect(dedupe(a.state, 'conv:s2').fresh).toBe(true);
  });

  it('keeps a ring of BALANCE.ledger.seen ids, oldest out first', () => {
    let s = makeState();
    for (let i = 0; i < BALANCE.ledger.seen + 20; i++) s = dedupe(s, `id${i}`).state;
    expect(s.seen).toHaveLength(BALANCE.ledger.seen);
    expect(dedupe(s, `id${BALANCE.ledger.seen + 19}`).fresh).toBe(false);
    expect(dedupe(s, 'id0').fresh).toBe(true);
  });
});

describe('markActive / activeDays', () => {
  it('counts the first meaningful action of each dayIndex once', () => {
    let s = makeState(10);
    expect(s.clock.activeDays).toBe(0);
    s = markActive(s);
    expect(s.clock).toMatchObject({ activeDays: 1, lastActiveDay: 10 });
    expect(markActive(s)).toBe(s);
    s = observeClock({ ...s, clock: { ...s.clock, lastLocalDate: '2026-10-04' } }, at(2026, 10, 5)).state;
    s = markActive(markActive(s));
    expect(s.clock).toMatchObject({ activeDays: 2, lastActiveDay: 11 });
  });

  it('a day with no action is not an active day', () => {
    let s = markActive(makeState(10));
    for (let i = 0; i < 5; i++) s = observeClock(s, at(2026, 10, 5 + i)).state;
    expect(s.clock.activeDays).toBe(1);
    expect(markActive(s).clock.activeDays).toBe(2);
  });

  it('a wrong-clock excursion gives at most one extra active day', () => {
    let s = markActive(start());
    s = observeClock(s, at(2026, 10, 4, 20) + 400 * DAY).state;
    s = markActive(s);
    s = observeClock(s, at(2026, 10, 5, 9)).state;
    s = markActive(s);
    expect(s.clock.activeDays).toBe(2);
  });
});
