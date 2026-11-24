// Madrid's Spanish content (Spanish step 1): every word of every line, chip, reaction and slot option is in the Spanish dictionary, ¿ and ¡
// open a sentence without sticking to its first word, lines keep their spaces, a word is found whatever its letter case, accents tell
// words apart (sí and si, qué and que), and the slots pick the longer key (café solo over café, medio kilo over kilo).
import { describe, expect, it } from 'vitest';
import { ES_LEXICON, ES_REACTIONS, ES_SLOTS, MADRID_CHARACTERS, MADRID_SCENARIOS, plainText, resolveLine, tokenize } from '../src';

function allLines(): string[] {
  const out: string[] = Object.values(ES_REACTIONS).map((l) => l.ja);
  for (const sc of MADRID_SCENARIOS) {
    for (const n of Object.values(sc.nodes)) {
      for (const v of n.say) out.push(v.line.ja);
      for (const s of n.suggestions ?? []) out.push(s.ja);
      for (const it of n.intents) {
        if (it.reply) out.push(it.reply.ja);
        if (it.ideal) out.push(it.ideal.ja);
      }
    }
  }
  for (const opts of Object.values(ES_SLOTS)) for (const o of opts) out.push(o.ja);
  return out;
}

describe('Madrid content', () => {
  it('every word is in the Spanish dictionary', () => {
    const missing = new Set<string>();
    const vars = { total: { ja: '2,50 €', raw: true }, name: { ja: 'Sam', raw: true }, country: { ja: 'Egipto', raw: true } };
    for (const line of allLines()) for (const m of tokenize(line, ES_LEXICON, vars).missing) missing.add(`${m} (${line})`);
    expect([...missing]).toEqual([]);
  });

  it('¿ and ¡ open a sentence as punctuation: the words keep their meaning and the line its spaces', () => {
    const r = tokenize('¡Hola! ¿Cómo te llamas?', ES_LEXICON);
    expect(r.missing).toEqual([]);
    expect(r.tokens.map((t) => t.s)).toEqual(['¡', 'Hola', '!', '¿', 'Cómo', 'te', 'llamas', '?']);
    expect(r.tokens.filter((t) => t.punct).map((t) => t.s)).toEqual(['¡', '!', '¿', '?']);
    expect(plainText(r.tokens)).toBe('¡Hola! ¿Cómo te llamas?');
    const bar = MADRID_SCENARIOS.find((s) => s.id === 'mad_bar')!;
    expect(resolveLine(bar.nodes.start!.say[0]!.line, ES_LEXICON).written).toBe('¡Buenos días! ¿Qué te pongo?');
  });

  it('accents tell words apart; letter case does not', () => {
    expect(ES_LEXICON.get('sí')?.en).toBe('yes');
    expect(ES_LEXICON.get('si')?.en).toBe('if');
    expect(ES_LEXICON.get('qué')?.g).toBeUndefined();
    expect(ES_LEXICON.get('que')?.g).toBe(true);
    expect(ES_LEXICON.get('Café')?.s).toBe('café');
    expect(ES_LEXICON.get('Buenos')?.s).toBe('buenos');
  });

  it('every slot option has a gloss and is its own key; the characters and scenarios are unique', () => {
    for (const [slot, opts] of Object.entries(ES_SLOTS)) {
      expect(new Set(opts.map((o) => o.id)).size, slot).toBe(opts.length);
      for (const o of opts) {
        expect(o.gloss.en && o.gloss.ar, `${slot}.${o.id}`).toBeTruthy();
        expect(o.keys.ja[0], `${slot}.${o.id}`).toBe(o.ja);
      }
    }
    expect(new Set(MADRID_SCENARIOS.map((s) => s.id)).size).toBe(MADRID_SCENARIOS.length);
    expect(new Set(MADRID_CHARACTERS.map((c) => c.id)).size).toBe(MADRID_CHARACTERS.length);
    for (const sc of MADRID_SCENARIOS) expect(MADRID_CHARACTERS.some((c) => c.id === sc.characterId), sc.id).toBe(true);
  });
});
