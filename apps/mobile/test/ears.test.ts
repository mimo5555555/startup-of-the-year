// 耳トレ: the pool takes fixed, short, recorded lines of the scenarios met (then the first others), each once; the day's rounds are the
// same all day, have three different meanings with the right one among them, and need at least three lines.
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '@lw/content';
import { earPool, earRounds, EARS_ROUNDS } from '../src/game/earsLogic';

const all = () => true;

describe('the ear training', () => {
  it('pools fixed lines with a recording, each once, from the scenarios met first', () => {
    const met = new Set([SCENARIOS[3]!.id]);
    const pool = earPool(SCENARIOS, met, all);
    expect(pool.length).toBeGreaterThanOrEqual(EARS_ROUNDS * 2);
    expect(pool[0]!.scenarioId).toBe(SCENARIOS[3]!.id);
    for (const l of pool) {
      expect(l.ja).not.toMatch(/[{}|]/);
      expect(Array.from(l.ja).length).toBeLessThanOrEqual(30);
      expect(l.en.trim().length).toBeGreaterThan(0);
    }
    expect(new Set(pool.map((l) => l.ja)).size).toBe(pool.length);
    expect(new Set(pool.map((l) => l.en.toLowerCase())).size).toBe(pool.length);
    // no recording, no line
    expect(earPool(SCENARIOS, met, () => false)).toEqual([]);
    // speaker is the scenario's character (the recording's voice)
    const s = SCENARIOS.find((x) => x.id === pool[0]!.scenarioId)!;
    expect(pool[0]!.who).toBe(s.characterId);
  });

  it('the day gives the same five rounds; each has three meanings with the right one', () => {
    const pool = earPool(SCENARIOS, new Set(), all);
    const a = earRounds(pool, 'ears:12');
    expect(a).toHaveLength(EARS_ROUNDS);
    expect(earRounds(pool, 'ears:12')).toEqual(a);
    expect(earRounds(pool, 'ears:13').map((r) => r.line.ja)).not.toEqual(a.map((r) => r.line.ja));
    for (const r of a) {
      expect(r.options).toHaveLength(3);
      expect(r.options).toContain(r.line);
      expect(new Set(r.options.map((o) => o.en)).size).toBe(3);
    }
    expect(new Set(a.map((r) => r.line.ja)).size).toBe(EARS_ROUNDS);
    expect(earRounds(pool.slice(0, 2), 'x')).toEqual([]);
  });
});
