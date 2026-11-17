// Berlin's German content: every word of every line, chip, reaction and slot option is in the German dictionary, lines keep their
// spaces, a word is found whatever its letter case, and a Japanese line still tokenizes exactly as before.
import { describe, expect, it } from 'vitest';
import { BAKERY, BERLIN_CHARACTERS, BERLIN_SCENARIOS, CHARACTERS, DE_LEXICON, DE_REACTIONS, DE_SLOTS, LEXICON, scenarioById, plainText, readingText, resolveLine, segmentWords, tokenize } from '../src';

function allLines(): string[] {
  const out: string[] = Object.values(DE_REACTIONS).map((l) => l.ja);
  for (const sc of BERLIN_SCENARIOS) {
    for (const n of Object.values(sc.nodes)) {
      for (const v of n.say) out.push(v.line.ja);
      for (const s of n.suggestions ?? []) out.push(s.ja);
      for (const it of n.intents) {
        if (it.reply) out.push(it.reply.ja);
        if (it.ideal) out.push(it.ideal.ja);
      }
    }
  }
  for (const opts of Object.values(DE_SLOTS)) for (const o of opts) out.push(o.ja);
  return out;
}

describe('Berlin content', () => {
  it('every word is in the German dictionary', () => {
    const missing = new Set<string>();
    for (const line of allLines()) for (const m of tokenize(line, DE_LEXICON, { total: { ja: '2,50 €', raw: true } }).missing) missing.add(`${m} (${line})`);
    expect([...missing]).toEqual([]);
  });

  it('a German line keeps its spaces and punctuation; the words carry their meaning', () => {
    const r = resolveLine(BAKERY.nodes.start!.say[0]!.line, DE_LEXICON);
    expect(r.written).toBe('Guten Morgen! Was darf es sein?');
    expect(r.plain).toBe('Guten Morgen! Was darf es sein?');
    expect(r.tokens.filter((t) => !t.punct).map((t) => t.gloss?.en)).toEqual(['good (in greetings)', 'morning', 'what', 'may', 'it', 'be']);
    const priced = resolveLine(BAKERY.nodes.pay!.say[0]!.line, DE_LEXICON, { total: { ja: '2,95 €', raw: true } });
    expect(priced.written).toBe('Das macht 2,95 €. Bar oder mit Karte?');
    expect(readingText(priced.tokens)).toBe(priced.written);
  });

  it('a word is found whatever its letter case; the token keeps the spelling as written', () => {
    const [t] = tokenize('Ich', DE_LEXICON).tokens;
    expect(t).toMatchObject({ s: 'Ich', gloss: { en: 'I' } });
    expect(DE_LEXICON.get('brötchen')?.s).toBe('Brötchen');
    const typed = segmentWords('zwei brötchen, bitte', DE_LEXICON);
    expect(typed.map((x) => x.s)).toEqual(['zwei', 'brötchen', ',', 'bitte']);
    expect(plainText(typed)).toBe('zwei brötchen, bitte');
    expect(typed.filter((x) => x.raw)).toEqual([]);
  });

  it('Japanese lines are untouched: no spaces, a name with a space stays one token', () => {
    const r = resolveLine({ ja: 'コーヒー|を|ください。', en: '', ar: '' }, LEXICON);
    expect(r.written).toBe('コーヒーをください。');
    expect(r.tokens.some((t) => t.sp)).toBe(false);
    const name = tokenize('{n}|さん', LEXICON, { n: { ja: '高橋 凜', raw: true } }).tokens;
    expect(name[0]!.s).toBe('高橋 凜');
  });

  it('every character has her or his conversation, at its place; ids are unique and never Tokyo’s', () => {
    expect(BERLIN_CHARACTERS.map((c) => c.id)).toEqual(['jana', 'murat', 'emre', 'sabine', 'greta', 'lena', 'kofi', 'jonas']);
    for (const c of BERLIN_CHARACTERS) {
      const sc = BERLIN_SCENARIOS.find((s) => s.id === c.scenarioId);
      expect(sc?.characterId, c.id).toBe(c.id);
      expect(sc?.locationId, c.id).toBe(c.locationId);
      expect(CHARACTERS.some((t) => t.id === c.id), c.id).toBe(false);
      expect(scenarioById(sc!.id), sc!.id).toBeUndefined();
    }
    expect(new Set(BERLIN_SCENARIOS.map((s) => s.id)).size).toBe(BERLIN_SCENARIOS.length);
    expect(BAKERY.characterId).toBe('jana');
  });

  it('every slot option is dictionary words, and no two options of a slot share a key', () => {
    for (const [slot, opts] of Object.entries(DE_SLOTS)) {
      const seen = new Map<string, string>();
      for (const o of opts) {
        expect(tokenize(o.ja, DE_LEXICON).missing, `${slot}.${o.id}`).toEqual([]);
        for (const k of o.keys.ja) {
          const key = k.toLowerCase();
          expect(seen.get(key), `${slot}: "${k}" in ${o.id} and ${seen.get(key)}`).toBeUndefined();
          seen.set(key, o.id);
        }
      }
    }
  });
});
