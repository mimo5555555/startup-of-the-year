// 銭湯「桜の湯」: the bath steps the app asks the player to put in order are written in lexicon words, with English and Arabic for the step
// and its tip, in the order the bandai teaches them (かけ湯 first, out of the bath last).
import { describe, expect, it } from 'vitest';
import { LEXICON, SENTO_STEPS, tokenize } from '../src';

const hasAr = (s: string) => /[؀-ۿ]/.test(s);

describe('the bath steps', () => {
  it('are the four steps in order: rinse, wash, soak, dry', () => {
    expect(SENTO_STEPS.map((s) => s.id)).toEqual(['kakeyu', 'wash', 'soak', 'dry']);
  });

  it('use only lexicon words, and have English and Arabic for the step and the tip', () => {
    for (const s of SENTO_STEPS) {
      const unknown = tokenize(s.line.ja, LEXICON).tokens.filter((t) => !t.punct && !t.gloss);
      expect(unknown.map((t) => t.s), s.id).toEqual([]);
      for (const g of [s.line.en, s.tip.en]) expect(g.trim(), s.id).not.toBe('');
      for (const g of [s.line.ar, s.tip.ar]) expect(hasAr(g), `${s.id}: ${g}`).toBe(true);
    }
  });
});
