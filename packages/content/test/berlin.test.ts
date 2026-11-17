// Berlin's German content: every word of every line, chip, reaction and slot option is in the German dictionary, lines keep their
// spaces, a word is found whatever its letter case, and a Japanese line still tokenizes exactly as before.
import { describe, expect, it } from 'vitest';
import { BAKERY, BERLIN_CHARACTERS, BERLIN_SCENARIOS, DE_LEXICON, DE_REACTIONS, DE_SLOTS, LEXICON, plainText, readingText, resolveLine, segmentWords, tokenize } from '../src';

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

  it('the baker is Berlin’s, at her bakery, with her conversation', () => {
    expect(BERLIN_CHARACTERS.map((c) => c.id)).toEqual(['jana']);
    expect(BAKERY.characterId).toBe('jana');
    expect(BERLIN_CHARACTERS[0]!.scenarioId).toBe(BAKERY.id);
  });
});
