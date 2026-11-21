// The slots of Amsterdam's Dutch conversations. Keys are compared the Dutch way (@lw/core nlMatchForms): any letter case, accents or not
// (één = een, café = cafe), from the start of a word (「een」 is in 「eentje」, never in 「geen」).
import type { SlotOption } from '../types';
import { NL_LEXICON } from './lexicon';

/** A slot option whose Dutch is dictionary words (a noun, or an adjective and a noun); the gloss is the last word's unless given; its own words are a key. */
const opt = (id: string, nl: string, keys: string[], en: string[], ar: string[], gloss?: { en: string; ar: string }): SlotOption => {
  const noun = nl.split(' ').at(-1)!;
  const e = NL_LEXICON.get(noun);
  if (!e) throw new Error(`Slot option ${id}: ${noun} is not in the Dutch dictionary`);
  // the option's own words are a key, not its last word alone: 「jonge kaas」 and 「oude kaas」 must not both answer to 「kaas」
  return { id, ja: nl, gloss: gloss ?? { en: e.en.replace(/ \(.*\)$/, ''), ar: e.ar.replace(/ \(.*\)$/, '') }, keys: { ja: [nl, ...keys], en, ar } };
};

export const NL_SLOTS: Record<string, SlotOption[]> = {
  cafe: [
    opt('verkeerd', 'koffie verkeerd', ['verkeerd', 'latte', 'koffie met melk'], ['latte', 'milky coffee', 'coffee with milk'], ['قهوة بالحليب', 'لاتيه'], { en: 'milky coffee', ar: 'قهوة بالحليب' }),
    opt('koffie', 'koffie', ['koffietje', 'zwarte koffie'], ['coffee', 'a coffee'], ['قهوة']),
    opt('thee', 'thee', ['theetje', 'muntthee'], ['tea', 'a tea'], ['شاي']),
    opt('chocomel', 'chocolademelk', ['chocomel', 'warme chocolademelk', 'chocola'], ['hot chocolate', 'cocoa'], ['شوكولاتة ساخنة', 'كاكاو']),
  ],
  taart: [opt('appeltaart', 'appeltaart', ['taart', 'appel', 'stuk taart', 'stukje taart'], ['apple pie', 'pie', 'cake'], ['فطيرة التفاح', 'فطيرة'])],
  kaas: [
    opt('jong', 'jonge kaas', ['jong', 'jonge'], ['young cheese', 'young', 'mild'], ['جبن طري', 'طرية'], { en: 'young cheese', ar: 'الجبن الطري' }),
    opt('belegen', 'belegen kaas', ['belegen'], ['mature cheese', 'mature', 'medium'], ['جبن متوسط', 'متوسطة'], { en: 'mature cheese', ar: 'الجبن المتوسط' }),
    opt('oud', 'oude kaas', ['oud', 'oude', 'pittig', 'pittige'], ['old cheese', 'old', 'strong', 'aged'], ['جبن معتّق', 'معتّقة'], { en: 'old cheese', ar: 'الجبن المعتّق' }),
    opt('geit', 'geitenkaas', ['geit'], ['goat cheese', 'goat'], ['جبن الماعز']),
  ],
  // the cheese is sold by the half pond (250 g): a half pond is one, a pond (500 g) two; the longer key wins (「een half pond」 is not 「een pond」)
  gewicht: [
    opt('one', 'half pond', ['halve pond', '250 gram', 'tweehonderdvijftig', 'klein stuk', 'klein stukje'], ['half a pound', '250 grams', 'a small piece'], ['نصف رطل', '250 غرامًا'], { en: 'half a pound (250 g)', ar: 'نصف رطل (250 غ)' }),
    opt('two', 'pond', ['een pond', '500 gram', 'vijfhonderd', 'groot stuk'], ['a pound', '500 grams', 'a big piece'], ['رطل', '500 غرام'], { en: 'a pound (500 g)', ar: 'رطل (500 غ)' }),
  ],
  wafel: [
    opt('blik', 'blik stroopwafels', ['blik', 'blikje', 'trommel', 'cadeau'], ['tin', 'a tin of stroopwafels', 'gift'], ['علبة', 'علبة «ستروبفافل»'], { en: 'a tin of stroopwafels', ar: 'علبة «ستروبفافل»' }),
    opt('choco', 'stroopwafel met chocolade', ['chocolade', 'choco', 'met chocola'], ['with chocolate', 'chocolate'], ['بالشوكولاتة'], { en: 'stroopwafel with chocolate', ar: '«ستروبفافل» بالشوكولاتة' }),
    opt('gewoon', 'stroopwafel', ['stroopwafels', 'wafel', 'wafels', 'gewoon', 'gewone', 'naturel'], ['stroopwafel', 'waffle', 'plain'], ['«ستروبفافل»', 'فافل']),
  ],
  snack: [
    opt('patat', 'patatje met', ['patat', 'patatje', 'friet', 'frietje', 'patat met', 'frites'], ['fries', 'chips', 'fries with mayo'], ['بطاطا مقلية', 'بطاطا'], { en: 'fries with mayonnaise', ar: 'بطاطا مقلية بالمايونيز' }),
    opt('kroket', 'kroket', ['kroketten', 'kroketje'], ['kroket', 'croquette'], ['«كروكيت»']),
    opt('frikandel', 'frikandel', ['frikandellen', 'frikadel'], ['frikandel', 'sausage'], ['«فريكاندل»', 'نقانق']),
    opt('kaassouffle', 'kaassoufflé', ['kaassouffle', 'souffle', 'kaas souffle'], ['cheese souffle', 'cheese snack'], ['«كاسوفليه»', 'وجبة بالجبن']),
  ],
  kaartje: [
    opt('uur', 'uurkaart', ['een uur', 'uur kaart', 'kaartje voor een uur', 'enkele reis', 'kaartje'], ['one-hour ticket', 'ticket', 'an hour'], ['تذكرة لساعة', 'تذكرة']),
    opt('dag', 'dagkaart', ['dag kaart', '24 uur', 'hele dag', 'dagkaartje'], ['day ticket', 'day pass', '24 hours'], ['تذكرة يومية', 'تذكرة يوم']),
  ],
  // where you are from (a country not listed is taken as said: 「Ik kom uit IJsland」)
  country: [
    opt('egypt', 'Egypte', [], ['egypt'], ['مصر']),
    opt('morocco', 'Marokko', [], ['morocco'], ['المغرب']),
    opt('syria', 'Syrië', ['syrie'], ['syria'], ['سوريا', 'سورية']),
    opt('saudi', 'Saoedi-Arabië', ['saoedi arabie', 'saoedi'], ['saudi arabia', 'saudi'], ['السعودية']),
    opt('turkey', 'Turkije', [], ['turkey', 'türkiye'], ['تركيا']),
    opt('england', 'Engeland', ['groot-brittannie', 'uk'], ['england', 'uk', 'britain'], ['إنجلترا', 'بريطانيا']),
    opt('usa', 'Amerika', ['vs', 'de vs', 'verenigde staten'], ['usa', 'america', 'the us'], ['أمريكا', 'الولايات المتحدة']),
    opt('japan', 'Japan', [], ['japan'], ['اليابان']),
    opt('germany', 'Duitsland', [], ['germany'], ['ألمانيا']),
  ],
  hobby: [
    opt('cooking', 'koken', ['kook', 'kok'], ['cooking', 'cook'], ['الطبخ', 'أطبخ']),
    opt('music', 'muziek', ['luister', 'zing', 'gitaar', 'piano'], ['music'], ['الموسيقى', 'موسيقى']),
    opt('sports', 'sport', ['voetbal', 'voetballen', 'hardlopen', 'loop hard', 'zwem', 'fiets', 'fietsen'], ['sport', 'sports', 'football', 'running'], ['الرياضة', 'كرة القدم']),
    opt('games', 'spelletjes', ['gamen', 'game', 'spelletje', 'spel'], ['games', 'gaming', 'video games'], ['الألعاب', 'ألعاب الفيديو']),
    opt('travel', 'reizen', ['reis'], ['travel', 'travelling'], ['السفر', 'أسافر']),
    opt('movies', 'films', ['film', 'bioscoop', 'series', 'kijk'], ['movies', 'films', 'cinema'], ['الأفلام', 'السينما']),
    opt('books', 'lezen', ['lees', 'boeken', 'boek'], ['reading', 'books'], ['القراءة', 'الكتب']),
    opt('drawing', 'tekenen', ['teken', 'schilder', 'schilderen', 'kunst'], ['drawing', 'painting', 'art'], ['الرسم', 'أرسم']),
  ],
  // a present handed to a friend (give_gift): the street's things as you hand them over (「Ik heb een stroopwafel voor je」); the ids are the
  // shops' slot options, so the gift sheet finds the name of what was bought
  giftItem: [opt('blik', 'een blik stroopwafels', ['blik', 'blikje', 'stroopwafels'], ['a tin of stroopwafels', 'tin'], ['علبة «ستروبفافل»'], { en: 'a tin of stroopwafels', ar: 'علبة «ستروبفافل»' })],
  giftFood: [
    opt('koffie', 'een koffie', ['koffie', 'koffietje'], ['a coffee', 'coffee'], ['قهوة'], { en: 'a coffee', ar: 'قهوة' }),
    opt('verkeerd', 'een koffie verkeerd', ['koffie verkeerd', 'verkeerd'], ['a milky coffee', 'latte'], ['قهوة بالحليب'], { en: 'a milky coffee', ar: 'قهوة بالحليب' }),
    opt('thee', 'een thee', ['thee', 'theetje'], ['a tea', 'tea'], ['شاي'], { en: 'a tea', ar: 'شاي' }),
    opt('chocomel', 'een chocolademelk', ['chocolademelk', 'chocomel'], ['a hot chocolate', 'hot chocolate'], ['شوكولاتة ساخنة'], { en: 'a hot chocolate', ar: 'شوكولاتة ساخنة' }),
    opt('appeltaart', 'een stuk appeltaart', ['appeltaart', 'taart'], ['a slice of apple pie', 'apple pie'], ['قطعة فطيرة تفاح'], { en: 'a slice of apple pie', ar: 'قطعة فطيرة تفاح' }),
    opt('jong', 'een stuk jonge kaas', ['jonge kaas'], ['a piece of young cheese', 'young cheese'], ['قطعة جبن طري'], { en: 'a piece of young cheese', ar: 'قطعة جبن طري' }),
    opt('belegen', 'een stuk belegen kaas', ['belegen kaas', 'belegen'], ['a piece of mature cheese', 'mature cheese'], ['قطعة جبن متوسط'], { en: 'a piece of mature cheese', ar: 'قطعة جبن متوسط' }),
    opt('oud', 'een stuk oude kaas', ['oude kaas'], ['a piece of old cheese', 'old cheese'], ['قطعة جبن معتّق'], { en: 'a piece of old cheese', ar: 'قطعة جبن معتّق' }),
    opt('geit', 'een stuk geitenkaas', ['geitenkaas'], ['a piece of goat cheese', 'goat cheese'], ['قطعة جبن الماعز'], { en: 'a piece of goat cheese', ar: 'قطعة جبن الماعز' }),
    opt('gewoon', 'een stroopwafel', ['stroopwafel'], ['a stroopwafel', 'stroopwafel'], ['«ستروبفافل»'], { en: 'a stroopwafel', ar: '«ستروبفافل»' }),
    opt('choco', 'een stroopwafel met chocolade', ['met chocolade'], ['a chocolate stroopwafel'], ['«ستروبفافل» بالشوكولاتة'], { en: 'a stroopwafel with chocolate', ar: '«ستروبفافل» بالشوكولاتة' }),
    opt('patat', 'een patatje met', ['patatje', 'patat', 'friet'], ['fries', 'fries with mayo'], ['بطاطا مقلية'], { en: 'fries with mayonnaise', ar: 'بطاطا مقلية بالمايونيز' }),
    opt('kroket', 'een kroket', ['kroket'], ['a kroket', 'croquette'], ['«كروكيت»'], { en: 'a kroket', ar: '«كروكيت»' }),
    opt('frikandel', 'een frikandel', ['frikandel'], ['a frikandel'], ['«فريكاندل»'], { en: 'a frikandel', ar: '«فريكاندل»' }),
    opt('kaassouffle', 'een kaassoufflé', ['kaassoufflé', 'kaassouffle', 'souffle'], ['a kaassoufflé'], ['«كاسوفليه»'], { en: 'a kaassoufflé', ar: '«كاسوفليه»' }),
  ],
  // a friend's 「Wat eet je het liefst?」: the favourite food is remembered (fact favFood) and quoted later (「Heb je deze week pizza gegeten?」)
  chatfood: [
    opt('pizza', 'pizza', [], ['pizza'], ['بيتزا']),
    opt('patat', 'patat', ['friet', 'patatje'], ['fries', 'chips'], ['بطاطا مقلية']),
    opt('stamppot', 'stamppot', [], ['stamppot', 'mash'], ['«ستامبوت» (هريس الخضار)']),
    opt('pannenkoeken', 'pannenkoeken', ['pannenkoek', 'pannenkoekjes'], ['pancakes', 'pancake'], ['فطائر', 'بانكيك']),
    opt('haring', 'haring', ['haringen', 'vis'], ['herring', 'fish'], ['رنجة', 'سمك']),
    opt('kaas', 'kaas', ['kaasje'], ['cheese'], ['جبن']),
    opt('rijst', 'rijst', [], ['rice'], ['أرز']),
    opt('salade', 'salade', ['sla'], ['salad'], ['سلطة']),
    opt('chocolade', 'chocolade', ['chocola'], ['chocolate'], ['شوكولاتة']),
    opt('falafel', 'falafel', [], ['falafel'], ['فلافل']),
  ],
  // the drogist (places.ts): what hurts; each complaint has its remedy, which is what is sold
  klacht: [
    opt('keel', 'keelpijn', ['keel', 'zere keel', 'pijn in mijn keel'], ['sore throat', 'throat'], ['التهاب الحلق', 'الحلق']),
    opt('hoofd', 'hoofdpijn', ['hoofd', 'koppijn'], ['headache', 'head'], ['صداع', 'الرأس']),
    opt('verkouden', 'verkouden', ['verkoudheid', 'snotneus', 'neus', 'verstopt'], ['a cold', 'runny nose', 'nose'], ['زكام', 'الأنف'], { en: 'having a cold', ar: 'مصاب بالزكام' }),
    opt('hoest', 'hoest', ['hoesten', 'hoestje'], ['cough'], ['سعال', 'كحة']),
  ],
  // the brown café (places.ts): a drink at the bar (beer for an adult) and bitterballen
  kroeg: [
    opt('bier', 'biertje', ['bier', 'pils', 'pilsje'], ['beer', 'a beer'], ['بيرة']),
    opt('spa', 'spa rood', ['spa', 'bruiswater', 'water met bubbels', 'water'], ['sparkling water', 'water'], ['ماء فوّار', 'ماء'], { en: 'sparkling water', ar: 'ماء فوّار' }),
    opt('cola', 'cola', ['colaatje'], ['cola', 'coke'], ['كولا']),
  ],
  kroegSnack: [opt('bitterballen', 'bitterballen', ['bitterbal', 'bitterballetjes', 'balletjes'], ['bitterballen', 'meatballs'], ['«بِترْبالن»', 'كرات لحم'])],
  payMethod: [
    opt('card', 'pinnen', ['pin', 'pinpas', 'met de kaart', 'kaart', 'pas', 'ik pin'], ['card', 'by card', 'debit card'], ['بطاقة', 'بالبطاقة']),
    opt('cash', 'contant', ['cash', 'met geld', 'contanten'], ['cash', 'in cash'], ['نقدًا', 'كاش']),
  ],
  // `one` comes last: on a tie of key length the first option wins, and 「twee stroopwafels en een koffie」 is two
  qty: [
    opt('two', 'twee', ['2', 'tweemaal'], ['two', '2'], ['اثنان', 'اثنين', '2']),
    opt('three', 'drie', ['3'], ['three', '3'], ['ثلاثة', '3']),
    opt('four', 'vier', ['4'], ['four', '4'], ['أربعة', '4']),
    opt('one', 'één', ['een', 'eentje', '1'], ['one', 'a', '1'], ['واحد', 'واحدة', '1']),
  ],
};
