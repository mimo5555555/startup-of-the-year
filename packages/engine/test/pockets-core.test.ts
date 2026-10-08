// Pocket data (agent 2E, docs/GAME_DESIGN.md §11.1, §15.9 "pockets matched by an intent"): every pocket line a scenario names is
// language that scenario accepts, spelled with lexicon words, in EN and AR, and the key-line rule holds.
import { describe, expect, it } from 'vitest';
import { JP_PACK, LEXICON, plainText, scenarioById, tokenize } from '@lw/content';
import { matchNodeIntent } from '../src';

const accepted = (scenarioId: string, text: string): boolean =>
  Object.values(scenarioById(scenarioId)!.nodes).some((n) => !n.end && matchNodeIntent(n, text) !== null);
const written = (markup: string) => plainText(tokenize(markup, LEXICON).tokens);

describe('pockets (§11.1)', () => {
  const metas = JP_PACK.scenarioMeta.filter((m) => (m.pocket?.length ?? 0) > 0);

  it('every scenario meta that names pocket lines finds them all in the pack, once', () => {
    const named = metas.flatMap((m) => m.pocket ?? []);
    expect(named.filter((id) => !JP_PACK.pockets[id])).toEqual([]);
    expect(new Set(named).size).toBe(named.length);
  });

  it('the five core scenarios and station_ic have a pocket of 3 or 4 lines', () => {
    for (const id of ['cafe', 'konbini', 'ramen', 'station', 'park', 'station_ic']) {
      const n = JP_PACK.scenarioMeta.find((m) => m.id === id)?.pocket?.length ?? 0;
      expect(n, id).toBeGreaterThanOrEqual(3);
      expect(n, id).toBeLessThanOrEqual(4);
    }
  });

  it('every pocket line is matched by an intent of the scenario that names it', () => {
    const bad: string[] = [];
    for (const m of metas) for (const id of m.pocket ?? []) if (!accepted(m.id, written(JP_PACK.pockets[id].line.ja))) bad.push(`${m.id}:${id}`);
    expect(bad).toEqual([]);
  });

  it('at most 2 key lines per pocket, at least 1, and all lines have EN + AR and lexicon words only', () => {
    for (const m of metas) {
      const keys = (m.pocket ?? []).filter((id) => JP_PACK.pockets[id]?.key).length;
      expect(keys, m.id).toBeLessThanOrEqual(2);
      expect(keys, m.id).toBeGreaterThanOrEqual(1);
      for (const id of m.pocket ?? []) {
        const p = JP_PACK.pockets[id];
        expect(p.id).toBe(id);
        expect(p.line.en.trim() && p.line.ar.trim(), id).toBeTruthy();
        expect(tokenize(p.line.ja, LEXICON).missing, id).toEqual([]);
      }
    }
  });
});
