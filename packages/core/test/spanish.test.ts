// Spanish text (core/spanish.ts): matching forms with and without accents, word-start keys, numbers as phrases said and written, a
// price said every way Madrid says it, a name or a country given in a sentence.
import { describe, expect, it } from 'vitest';
import { captureSpanishCountry, captureSpanishName, esContains, esMatchForms, euroTextEs, parseSpanishNumberWord, parseSpanishNumbers, spanishNumber } from '../src';

describe('Spanish matching forms', () => {
  it('folds case, accents, ñ, ¿ ¡, punctuation and fillers; keeps a decimal comma', () => {
    expect(esMatchForms('¡Un café, por favor!')).toEqual({ loose: 'un cafe por favor', folded: 'un cafe por fabor' });
    expect(esMatchForms('¿Cuánto es?').loose).toBe('cuanto es');
    expect(esMatchForms('Eh, soy de España').loose).toBe('soy de espana');
    expect(esMatchForms('Son 2,50 €.').loose).toBe('son 2,50');
    // ll and y, v and b sound alike in Madrid: a learner's spelling still matches
    expect(esMatchForms('Me yamo Sam').folded).toBe(esMatchForms('Me llamo Sam').folded);
    expect(esMatchForms('un bino').folded).toBe(esMatchForms('un vino').folded);
  });

  it('a key matches from the start of a word only', () => {
    expect(esContains('una cana por fabor', 'una')).toBe(true);
    expect(esContains('dos naranjas', 'naranja')).toBe(true);
    expect(esContains('algun dia', 'un')).toBe(false);
    expect(esContains('ningun problema', 'un')).toBe(false);
    expect(esContains('un cafe con leche', 'cafe con leche')).toBe(true);
  });

  it('a key of one or two letters is a whole word (no is not in noche, si not in siempre)', () => {
    expect(esContains('no gracias', 'no')).toBe(true);
    expect(esContains('pues no', 'no')).toBe(true);
    expect(esContains('si esta noche salgo', 'no')).toBe(false);
    expect(esContains('nos vemos', 'no')).toBe(false);
    expect(esContains('siempre', 'si')).toBe(false);
    expect(esContains('si claro', 'si')).toBe(true);
    expect(esContains('una cana', 'un')).toBe(false);
    expect(esContains('un cafe', 'un')).toBe(true);
  });
});

describe('Spanish numbers and prices', () => {
  it('writes numbers as Spanish does (veintiuno, treinta y cinco, cien, ciento uno)', () => {
    expect([0, 1, 7, 16, 21, 22, 35, 99, 100, 101, 250, 500, 1000, 1250, 2500, 21000].map(spanishNumber)).toEqual([
      'cero', 'uno', 'siete', 'dieciséis', 'veintiuno', 'veintidós', 'treinta y cinco', 'noventa y nueve', 'cien', 'ciento uno',
      'doscientos cincuenta', 'quinientos', 'mil', 'mil doscientos cincuenta', 'dos mil quinientos', 'veintiún mil',
    ]);
  });

  it('reads every number back, as words or phrases; the articles un and una alone are not numbers, uno is', () => {
    for (let n = 0; n <= 3000; n++) expect(parseSpanishNumbers(spanishNumber(n)).numbers, String(n)).toEqual([n]);
    expect(parseSpanishNumberWord('un')).toBeNull();
    expect(parseSpanishNumberWord('una')).toBeNull();
    expect(parseSpanishNumberWord('uno')).toBe(1);
    expect(parseSpanishNumberWord('dieciseis')).toBe(16);
    expect(parseSpanishNumberWord('quinientas')).toBe(500);
    expect(parseSpanishNumberWord('café')).toBeNull();
  });

  it('finds the numbers of an utterance, a price said any way as one', () => {
    for (const said of ['Son tres euros con cincuenta.', 'tres euros cincuenta', 'Tres con cincuenta.', 'tres cincuenta', '3,50 €', '3,50', '3.50', 'tres euros con cincuenta céntimos'])
      expect(parseSpanishNumbers(said).numbers, said).toEqual([3.5]);
    expect(parseSpanishNumbers('cincuenta céntimos').numbers).toEqual([0.5]);
    expect(parseSpanishNumbers('un euro veinte').numbers).toEqual([1.2]);
    expect(parseSpanishNumbers('Le devuelvo un euro con veinte.').numbers).toEqual([1.2]);
    expect(parseSpanishNumbers('veintiún euros').numbers).toEqual([21]);
    expect(parseSpanishNumbers('treinta y un euros').numbers).toEqual([31]);
    expect(parseSpanishNumbers('Son 12,40 €.').numbers).toEqual([12.4]);
    expect(parseSpanishNumbers('1.234,56 €').numbers).toEqual([1234.56]);
    expect(parseSpanishNumbers('Dos cafés con leche y una tostada.').numbers).toEqual([2]);
    expect(parseSpanishNumbers('Una caña, por favor.').numbers).toEqual([]);
    expect(parseSpanishNumbers('Quiero uno con leche.').numbers).toEqual([1]);
    expect(parseSpanishNumbers('dos tres').numbers).toEqual([2, 3]);
  });

  it('writes and says a price in euro, the Spanish way', () => {
    expect(euroTextEs(250)).toEqual({ written: '2,50 €', words: 'dos euros con cincuenta', en: '€2.50', ar: '2.50 يورو' });
    expect(euroTextEs(300).words).toBe('tres euros');
    expect(euroTextEs(100).words).toBe('un euro');
    expect(euroTextEs(120).words).toBe('un euro con veinte');
    expect(euroTextEs(2100).words).toBe('veintiún euros');
    expect(euroTextEs(321).words).toBe('tres euros con veintiuno');
    expect(euroTextEs(50).words).toBe('cincuenta céntimos');
    expect(euroTextEs(123456).written).toBe('1.234,56 €');
    // every price reads back
    for (let c = 0; c <= 5000; c += 7) expect(parseSpanishNumbers(euroTextEs(c).words).numbers, euroTextEs(c).words).toEqual([c / 100]);
  });
});

describe('a name, a country', () => {
  it('takes the ways of giving a name, never an adjective or a nationality', () => {
    expect(captureSpanishName('Me llamo Sam.')).toBe('Sam');
    expect(captureSpanishName('me llamo maría')).toBe('María');
    expect(captureSpanishName('Mi nombre es Ali Hassan.')).toBe('Ali Hassan');
    expect(captureSpanishName('¡Hola, soy Lea!')).toBe('Lea');
    expect(captureSpanishName('Sam.')).toBe('Sam');
    expect(captureSpanishName('Soy estudiante.')).toBeNull();
    expect(captureSpanishName('Soy de Egipto.')).toBeNull();
    expect(captureSpanishName('soy egipcio')).toBeNull();
  });

  it('takes a country after de', () => {
    expect(captureSpanishCountry('Soy de Marruecos.')).toBe('Marruecos');
    expect(captureSpanishCountry('Vengo de los Estados Unidos')).toBe('Estados Unidos');
    expect(captureSpanishCountry('soy de egipto')).toBe('Egipto');
    expect(captureSpanishCountry('Vivo en Madrid.')).toBeNull();
    expect(captureSpanishCountry('Quiero un café.')).toBeNull();
  });
});
