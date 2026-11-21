// Amsterdam's Dutch content: every word of every line, chip, reaction and slot option is in the Dutch dictionary, lines keep their
// spaces, slot keys are unique per slot, and no id is Tokyo's or Berlin's.
import { describe, expect, it } from 'vitest';
import { AMSTERDAM_CHARACTERS, AMSTERDAM_SCENARIOS, BERLIN_CHARACTERS, BERLIN_SCENARIOS, CHARACTERS, NL_LEXICON, NL_REACTIONS, NL_SLOTS, resolveLine, scenarioById, tokenize } from '../src';

function allLines(): string[] {
  const out: string[] = Object.values(NL_REACTIONS).map((l) => l.ja);
  for (const sc of AMSTERDAM_SCENARIOS) {
    for (const n of Object.values(sc.nodes)) {
      for (const v of n.say) out.push(v.line.ja);
      for (const s of n.suggestions ?? []) out.push(s.ja);
      for (const it of n.intents) {
        if (it.reply) out.push(it.reply.ja);
        if (it.ideal) out.push(it.ideal.ja);
      }
    }
  }
  for (const opts of Object.values(NL_SLOTS)) for (const o of opts) out.push(o.ja);
  return out;
}

describe('Amsterdam content', () => {
  it('every word is in the Dutch dictionary', () => {
    const missing = new Set<string>();
    for (const line of allLines()) for (const m of tokenize(line, NL_LEXICON, { total: { ja: '€ 2,50', raw: true }, name: { ja: 'Sam', raw: true } }).missing) missing.add(`${m} (${line})`);
    expect([...missing]).toEqual([]);
  });

  it('a Dutch line keeps its spaces; a price reads the Dutch way', () => {
    const cafe = AMSTERDAM_SCENARIOS.find((s) => s.id === 'ams_cafe')!;
    expect(resolveLine(cafe.nodes.start!.say.at(-1)!.line, NL_LEXICON).written).toBe('Goedemorgen! Wat mag het zijn?');
    const pay = resolveLine(cafe.nodes.pay!.say[0]!.line, NL_LEXICON, { total: { ja: '€ 6,80', raw: true } });
    expect(pay.written).toBe('Dat is dan € 6,80. Pinnen of contant?');
  });

  it('every slot option is dictionary words; no two options of a slot share a key', () => {
    for (const [slot, opts] of Object.entries(NL_SLOTS)) {
      const seen = new Map<string, string>();
      for (const o of opts) {
        expect(tokenize(o.ja, NL_LEXICON).missing, `${slot}.${o.id}`).toEqual([]);
        for (const k of o.keys.ja) {
          const key = k.toLowerCase();
          expect(seen.get(key), `${slot}: "${k}" in ${o.id} and ${seen.get(key)}`).toBeUndefined();
          seen.set(key, o.id);
        }
      }
    }
  });

  it('every character has a conversation at its place; ids are never Tokyo’s or Berlin’s', () => {
    expect(AMSTERDAM_CHARACTERS.map((c) => c.id)).toEqual(['femke', 'kees', 'jesse', 'mo', 'ingrid', 'sanne', 'daan', 'noor', 'mirjam', 'joop', 'ilse']);
    const others = new Set([...CHARACTERS, ...BERLIN_CHARACTERS].map((c) => c.id));
    const otherScenarios = new Set(BERLIN_SCENARIOS.map((s) => s.id));
    for (const c of AMSTERDAM_CHARACTERS) {
      const sc = AMSTERDAM_SCENARIOS.find((s) => s.id === c.scenarioId);
      expect(sc?.characterId, c.id).toBe(c.id);
      expect(sc?.locationId, c.id).toBe(c.locationId);
      expect(others.has(c.id), c.id).toBe(false);
      expect(scenarioById(sc!.id), sc!.id).toBeUndefined();
      expect(otherScenarios.has(sc!.id), sc!.id).toBe(false);
    }
  });
});
