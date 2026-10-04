import { describe, expect, it } from 'vitest';
import { levelFromXp, levelProgress, newStreak, touchStreak, xpForLevel, xpForLoop, newSrsCard, reviewCard, isDue, previewIntervals } from '../src';

describe('streak', () => {
  it('starts, extends and resets', () => {
    let s = newStreak();
    s = touchStreak(s, '2026-03-01').state;
    expect(s.days).toBe(1);
    s = touchStreak(s, '2026-03-01').state;
    expect(s.days).toBe(1);
    s = touchStreak(s, '2026-03-02').state;
    expect(s.days).toBe(2);
    const r = touchStreak(s, '2026-03-10');
    expect(r.state.days).toBe(1);
  });
  it('spends a freeze to bridge exactly one missed day', () => {
    let s = newStreak();
    s = touchStreak(s, '2026-03-01').state;
    const r = touchStreak(s, '2026-03-03');
    expect(r.usedFreeze).toBe(true);
    expect(r.state.days).toBe(2);
    expect(r.state.freezes).toBe(1);
  });
  it('handles month boundaries', () => {
    let s = newStreak();
    s = touchStreak(s, '2026-02-28').state;
    s = touchStreak(s, '2026-03-01').state;
    expect(s.days).toBe(2);
  });
});

describe('levels and xp', () => {
  it('uses triangular thresholds', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(299)).toBe(2);
    expect(levelProgress(200).fraction).toBeCloseTo(0.5);
  });
  it('awards more for unaided speech and goal completion', () => {
    const aided = xpForLoop({ goalDone: 4, goalTotal: 4, independentTurns: 0, assistedTurns: 6, durationSec: 120 });
    const unaided = xpForLoop({ goalDone: 4, goalTotal: 4, independentTurns: 6, assistedTurns: 0, durationSec: 120 });
    expect(unaided).toBeGreaterThan(aided);
    expect(xpForLoop({ goalDone: 0, goalTotal: 4, independentTurns: 0, assistedTurns: 0, durationSec: 5 })).toBe(0);
  });
});

describe('srs', () => {
  it('schedules a new card and pushes it out when answered well', () => {
    const t0 = new Date('2026-03-01T10:00:00Z');
    const c0 = newSrsCard(t0);
    expect(isDue(c0, t0)).toBe(true);
    const c1 = reviewCard(c0, 'good', t0);
    expect(isDue(c1, t0)).toBe(false);
    const prev = previewIntervals(c1, new Date(c1.due));
    expect(prev.easy).not.toBe(prev.again);
  });
  it('failing a card keeps it soon', () => {
    const t0 = new Date('2026-03-01T10:00:00Z');
    let c = newSrsCard(t0);
    c = reviewCard(c, 'good', t0);
    c = reviewCard(c, 'good', new Date(c.due));
    const lapsed = reviewCard(c, 'again', new Date(c.due));
    expect(lapsed.lapses).toBe(1);
    expect(new Date(lapsed.due).getTime() - new Date(c.due).getTime()).toBeLessThan(2 * 86400000);
  });
});
