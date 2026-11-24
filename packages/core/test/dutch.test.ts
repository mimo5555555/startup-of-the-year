// Dutch text (core/dutch.ts): matching forms with and without accents, word-start keys, numbers and prices said and written,
// a name or a country given in a sentence.
import { describe, expect, it } from 'vitest';
import { captureDutchCountry, captureDutchName, dutchNumber, euroTextNl, nlContains, nlMatchForms, parseDutchNumberWord, parseDutchNumbers } from '../src';

describe('Dutch matching forms', () => {
  it('folds case, accents, ĳ, apostrophes, punctuation and fillers; keeps a decimal comma', () => {
    expect(nlMatchForms('Eén café, alstublieft!')).toEqual({ loose: 'een cafe alstublieft', folded: 'een cafe alstublieft' });
    expect(nlMatchForms('Lekker ĳs').folded).toBe('lekker ys');
    expect(nlMatchForms('Eh, twee auto’s').loose).toBe('twee autos');
    expect(nlMatchForms('Dat is dan € 2,50.').loose).toBe('dat is dan 2,50');
  });

  it('a key matches from the start of a word only', () => {
    expect(nlContains('eentje graag', 'een')).toBe(true);
    expect(nlContains('geen slagroom', 'een')).toBe(false);
    expect(nlContains('alleen pin', 'een')).toBe(false);
    expect(nlContains('een half pond graag', 'half pond')).toBe(true);
  });
});

describe('Dutch numbers and prices', () => {
  it('writes numbers as Dutch does (één, eenentwintig, tweeëntwintig)', () => {
    expect([0, 1, 7, 21, 22, 23, 99, 100, 101, 250, 1000, 1250].map(dutchNumber)).toEqual([
      'nul', 'één', 'zeven', 'eenentwintig', 'tweeëntwintig', 'drieëntwintig', 'negenennegentig', 'honderd', 'honderdeen', 'tweehonderdvijftig', 'duizend', 'duizendtweehonderdvijftig',
    ]);
  });

  it('reads every number word back; the article een is not a number, één is', () => {
    for (let n = 0; n <= 2500; n++) expect(parseDutchNumberWord(dutchNumber(n)), String(n)).toBe(n);
    expect(parseDutchNumberWord('een')).toBeNull();
    expect(parseDutchNumberWord('één')).toBe(1);
    expect(parseDutchNumberWord('tweeentwintig')).toBe(22);
    expect(parseDutchNumberWord('kaas')).toBeNull();
  });

  it('finds the numbers of an utterance, a price said in words as one', () => {
    expect(parseDutchNumbers('Dat is dan twee euro vijftig.').numbers).toEqual([2.5]);
    expect(parseDutchNumbers('€ 2,50 graag').numbers).toEqual([2.5]);
    expect(parseDutchNumbers('vijftig cent').numbers).toEqual([0.5]);
    expect(parseDutchNumbers('Twee stroopwafels en een koffie').numbers).toEqual([2]);
    // the article before euro is one: the change said back
    expect(parseDutchNumbers('U krijgt een euro vijftig terug.').numbers).toEqual([1.5]);
    expect(parseDutchNumbers('één euro vijftig').numbers).toEqual([1.5]);
    // € first, whatever the size of the amount; a point groups thousands
    expect(parseDutchNumbers('Dat is dan € 10,40.').numbers).toEqual([10.4]);
    expect(parseDutchNumbers('€ 1.234,56').numbers).toEqual([1234.56]);
    expect(parseDutchNumbers('€12').numbers).toEqual([12]);
  });

  it('writes and says a price in euro, the Dutch way (€ first)', () => {
    expect(euroTextNl(250)).toEqual({ written: '€ 2,50', words: 'twee euro vijftig', en: '€2.50', ar: '2.50 يورو' });
    expect(euroTextNl(300).words).toBe('drie euro');
    expect(euroTextNl(100).words).toBe('één euro');
    expect(euroTextNl(45).words).toBe('vijfenveertig cent');
    expect(euroTextNl(123456).written).toBe('€ 1.234,56');
  });
});

describe('a name, a country', () => {
  it('takes the ways of giving a name, never an adjective', () => {
    expect(captureDutchName('Ik heet Sam.')).toBe('Sam');
    expect(captureDutchName('ik ben maria')).toBe('Maria');
    expect(captureDutchName('Mijn naam is Ali Hassan.')).toBe('Ali Hassan');
    expect(captureDutchName('Hoi, ik ben Lea!')).toBe('Lea');
    expect(captureDutchName('Sam.')).toBe('Sam');
    expect(captureDutchName('Ik ben moe.')).toBeNull();
    expect(captureDutchName('Ik ben nieuw.')).toBeNull();
  });

  it('takes a country after uit', () => {
    expect(captureDutchCountry('Ik kom uit Marokko.')).toBe('Marokko');
    expect(captureDutchCountry('ik kom uit het Verenigd Koninkrijk')).toBe('Verenigd Koninkrijk');
    expect(captureDutchCountry('Ik wil een koffie.')).toBeNull();
  });
});
