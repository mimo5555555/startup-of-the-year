import './_fakeStorage';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrate, reduce, validateState } from '@lw/game';
import { PACK } from '../src/game/pack';
import { gameView } from '../src/game/selectors';

const fixture = (name: string): any => JSON.parse(readFileSync(new URL(`../../../packages/game/test/saves/${name}.json`, import.meta.url), 'utf8'));
function rng(seed: number) { let a = seed; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const JUNK: any[] = [null, 'x', '', 0, -1, 1e15, 1.5, [], {}, [1, 'a', null], { a: 1 }, true, false, '2026-13-45', -0, 9007199254740993, 'constructor', '__proto__'];
function paths(o: any, p: string[] = [], out: string[][] = []): string[][] {
  out.push(p);
  if (o && typeof o === 'object') for (const k of Object.keys(o)) paths(o[k], [...p, k], out);
  return out;
}
function setAt(o: any, p: string[], v: any) { if (!p.length) return v; let c = o; for (let i = 0; i < p.length - 1; i++) c = c[p[i]!]; c[p[p.length - 1]!] = v; return o; }

const seenErr = new Map<string,string>();
// Adversarial review (slices 1+2): random junk written over random paths of the frozen v1 fixtures. `migrate` must never throw, must
// return a state `validateState` accepts, and the reducer must play on from it.
describe('migrate fuzz over the frozen saves', () => {
  it('never throws, always validates, and the reducer plays on', () => {
    for (const name of ['v1-typical', 'v1-heavy', 'v1-corrupt', 'v1-empty']) {
      const base = fixture(name);
      const ps = paths(base).filter((p) => p.length);
      const r = rng(name.length * 31);
      for (let i = 0; i < 500; i++) {
        const s = structuredClone(base);
        const n = 1 + Math.floor(r() * 3);
        for (let j = 0; j < n; j++) {
          const p = ps[Math.floor(r() * ps.length)]!;
          try { setAt(s, p, JUNK[Math.floor(r() * JUNK.length)]); } catch { /* path vanished */ }
        }
        let g;
        try { g = migrate(s, 1, PACK); } catch (e) { throw new Error(`${name} #${i} migrate threw: ${(e as Error).stack}\n${JSON.stringify(s).slice(0, 400)}`); }
        const errs = validateState(g, PACK);
        for (const e of errs) { const k = e.code + ' ' + e.path.replace(/[0-9]+/g,'#'); if (!seenErr.has(k)) { seenErr.set(k, `${name} #${i} ${e.message}`); } }
        try {
          const view = gameView({ vocab: [], discovered: [], lessonsDone: [], streak: { days: 0 }, profile: null });
          const res = reduce(g, { t: 'day_observed', nowMs: Date.now() }, { pack: PACK, now: Date.now(), view, rng: Math.random });
          const e2 = validateState(res.state, PACK);
          for (const e of e2) { const k = 'AFTER ' + e.code + ' ' + e.path.replace(/[0-9]+/g,'#'); if (!seenErr.has(k)) seenErr.set(k, `${name} #${i} ${e.message}`); }
          reduce(res.state, { t: 'conversation_done', facts: { sessionId: 'z', scenarioId: 'konbini', characterId: 'tanaka', mode: 'guided', abandoned: false, durationSec: 60, goalDone: 1, goalTotal: 2, turns: [], fallbacks: 0, hintUses: 0, accuracy: null, requestsPolite: true, prepared: false, remembered: {} } }, { pack: PACK, now: Date.now(), view, rng: Math.random });
        } catch (e) { throw new Error(`${name} #${i} reduce threw: ${(e as Error).stack}\n${JSON.stringify(g).slice(0, 300)}`); }
      }
    }
    expect([...seenErr].map(([k, v]) => `${k} :: ${v}`)).toEqual([]);
  }, 120_000);
});
