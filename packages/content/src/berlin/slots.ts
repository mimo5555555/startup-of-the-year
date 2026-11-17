// The slots of Berlin's German conversations: `bakery` (what you eat), `bakeryDrink` (what you drink with it), `qty` (how many).
// Keys are compared the German way (@lw/core deMatchForms): any letter case, umlauts or not (Brötchen = Broetchen = Brotchen), from
// the start of a word (「ein」 is in 「eine」, never in 「kein」).
import type { SlotOption } from '../types';
import { DE_LEXICON } from './lexicon';

/** A slot option whose German is a dictionary word; its own spelling is always a key. */
const opt = (id: string, de: string, keys: string[], en: string[], ar: string[]): SlotOption => {
  const e = DE_LEXICON.get(de);
  if (!e) throw new Error(`Slot option ${id}: ${de} is not in the German dictionary`);
  return { id, ja: de, gloss: { en: e.en.replace(/ \(.*\)$/, ''), ar: e.ar.replace(/ \(.*\)$/, '') }, keys: { ja: [de, ...keys], en, ar } };
};

export const DE_SLOTS: Record<string, SlotOption[]> = {
  bakery: [
    // Berliners say Schrippe; the rest of Germany says Brötchen (or Semmel in the south)
    opt('broetchen', 'Brötchen', ['schrippe', 'schrippen', 'semmel', 'semmeln'], ['roll', 'rolls', 'bread roll', 'bread'], ['خبز صغير', 'خبز', 'خبزة']),
    opt('brezel', 'Brezel', ['brezeln', 'breze'], ['pretzel', 'pretzels'], ['بريتزل', 'بريتزل مملح']),
    opt('croissant', 'Croissant', ['croissants'], ['croissant', 'croissants'], ['كرواسون', 'كرواسان']),
    // in Berlin a Pfannkuchen is the jam doughnut that the rest of Germany calls a Berliner
    opt('pfannkuchen', 'Pfannkuchen', ['berliner', 'krapfen'], ['doughnut', 'donut', 'jam doughnut'], ['دونات', 'دونات محشوة']),
  ],
  bakeryDrink: [
    opt('kaffee', 'Kaffee', ['kaffe', 'cafe'], ['coffee', 'a coffee'], ['قهوة']),
    opt('kakao', 'Kakao', ['heisse schokolade', 'schokolade'], ['hot chocolate', 'cocoa'], ['كاكاو', 'شوكولاتة ساخنة']),
  ],
  // how you pay (read by the game's charge, like Tokyo's payMethod): a card or cash
  payMethod: [
    opt('card', 'Karte', ['kreditkarte', 'ec karte', 'girokarte', 'mit karte'], ['card', 'by card', 'credit card'], ['بطاقة', 'بالبطاقة']),
    opt('cash', 'bar', ['bargeld', 'in bar'], ['cash', 'in cash'], ['نقدًا', 'كاش']),
  ],
  // `one` comes last: on a tie of key length the first option wins, and 「zwei Brötchen und einen Kaffee」 is two rolls
  qty: [
    opt('two', 'zwei', ['2', 'zweimal'], ['two', '2'], ['اثنان', 'اثنين', '2']),
    opt('three', 'drei', ['3', 'dreimal'], ['three', '3'], ['ثلاثة', '3']),
    opt('four', 'vier', ['4', 'viermal'], ['four', '4'], ['أربعة', '4']),
    opt('one', 'eins', ['ein', '1', 'einmal'], ['one', 'a', '1'], ['واحد', 'واحدة', '1']),
  ],
};
