// German text (core/german.ts): matching forms with and without umlauts, word-start keys, numbers and prices said and written,
// a name or a country given in a sentence.
import { describe, expect, it } from 'vitest';
import { captureGermanCountry, captureGermanName, deContains, deMatchForms, euroText, germanNumber, parseGermanNumberWord, parseGermanNumbers } from '../src';

describe('German matching forms', () => {
  it('folds case, umlauts, ae/oe/ue, punctuation, apostrophes and fillers; keeps a decimal comma', () => {
    expect(deMatchForms('Zwei Brötchen, bitte!')).toEqual({ loose: 'zwei brotchen bitte', folded: 'zwei brotchen bitte' });
    expect(deMatchForms('zwei broetchen bitte').folded).toBe('zwei brotchen bitte');
    expect(deMatchForms('ZWEI BROTCHEN').loose).toBe('zwei brotchen');
    expect(deMatchForms('Äh, wie geht’s?').loose).toBe('wie gehts');
    expect(deMatchForms('Tschüß!').loose).toBe('tschuss');
    expect(deMatchForms('Das macht 2,50 €.').loose).toBe('das macht 2,50');
  });

  it('a key matches from the start of a word only', () => {
    expect(deContains('eine brezel bitte', 'ein')).toBe(true);
    expect(deContains('nein danke', 'ein')).toBe(false);
    expect(deContains('kein problem', 'ein')).toBe(false);
    expect(deContains('zum mitnehmen bitte', 'mitnehmen')).toBe(true);
    expect(deContains('das ist alles', 'das ist alles')).toBe(true);
  });
});

describe('German numbers and prices', () => {
  it('writes numbers as German does', () => {
    expect([0, 1, 7, 16, 21, 99, 100, 101, 250, 1000, 1250].map(germanNumber)).toEqual([
      'null', 'eins', 'sieben', 'sechzehn', 'einundzwanzig', 'neunundneunzig', 'einhundert', 'einhunderteins', 'zweihundertfünfzig', 'eintausend', 'eintausendzweihundertfünfzig',
    ]);
    expect(() => germanNumber(-1)).toThrow();
  });

  it('reads every number word back', () => {
    for (let n = 0; n <= 2500; n++) expect(parseGermanNumberWord(germanNumber(n)), String(n)).toBe(n);
    expect(parseGermanNumberWord('dreissig')).toBe(30);
    expect(parseGermanNumberWord('ein')).toBeNull();
    expect(parseGermanNumberWord('eine')).toBeNull();
    expect(parseGermanNumberWord('brot')).toBeNull();
  });

  it('finds the numbers of an utterance, a price said in words as one', () => {
    expect(parseGermanNumbers('Das macht zwei Euro fünfzig.').numbers).toEqual([2.5]);
    expect(parseGermanNumbers('2,50 €, bitte').numbers).toEqual([2.5]);
    expect(parseGermanNumbers('fünfzig Cent').numbers).toEqual([0.5]);
    expect(parseGermanNumbers('drei Euro').numbers).toEqual([3]);
    expect(parseGermanNumbers('Zwei Brötchen und eine Brezel').numbers).toEqual([2]);
  });

  it('writes and says a price in euro', () => {
    expect(euroText(250)).toEqual({ written: '2,50 €', words: 'zwei Euro fünfzig', en: '€2.50', ar: '2.50 يورو' });
    expect(euroText(300).words).toBe('drei Euro');
    expect(euroText(101).words).toBe('ein Euro eins');
    expect(euroText(45).words).toBe('fünfundvierzig Cent');
    expect(euroText(123456).written).toBe('1.234,56 €');
  });
});

describe('a name, a country', () => {
  it('takes the ways of giving a name, never an adjective', () => {
    expect(captureGermanName('Ich heiße Sam.')).toBe('Sam');
    expect(captureGermanName('ich heisse sam')).toBe('Sam');
    expect(captureGermanName('Mein Name ist Ali Hassan.')).toBe('Ali Hassan');
    expect(captureGermanName('Hallo, ich bin die Lea!')).toBe('Lea');
    expect(captureGermanName('Maria.')).toBe('Maria');
    expect(captureGermanName('Ich bin müde.')).toBeNull();
    expect(captureGermanName('Ich bin hier.')).toBeNull();
  });

  it('takes a country after aus', () => {
    expect(captureGermanCountry('Ich komme aus Ägypten.')).toBe('Ägypten');
    expect(captureGermanCountry('ich bin aus der Schweiz')).toBe('Schweiz');
    expect(captureGermanCountry('Ich möchte eine Brezel.')).toBeNull();
  });
});
