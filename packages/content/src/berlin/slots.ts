// The slots of Berlin's German conversations: `bakery` (what you eat), `bakeryDrink` (what you drink with it), `qty` (how many).
// Keys are compared the German way (@lw/core deMatchForms): any letter case, umlauts or not (Brötchen = Broetchen = Brotchen), from
// the start of a word (「ein」 is in 「eine」, never in 「kein」).
import type { SlotOption } from '../types';
import { DE_LEXICON } from './lexicon';

/**
 * A slot option whose German is dictionary words (a noun, or a noun with its article: 「die Lampe」); the gloss is the noun's (its last
 * word); its own spelling is always a key, and the noun alone too.
 */
const opt = (id: string, de: string, keys: string[], en: string[], ar: string[]): SlotOption => {
  const noun = de.split(' ').at(-1)!;
  const e = DE_LEXICON.get(noun);
  if (!e) throw new Error(`Slot option ${id}: ${noun} is not in the German dictionary`);
  const own = noun === de ? [de] : [de, noun];
  return { id, ja: de, gloss: { en: e.en.replace(/ \(.*\)$/, ''), ar: e.ar.replace(/ \(.*\)$/, '') }, keys: { ja: [...own, ...keys], en, ar } };
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
  spaeti: [
    opt('clubmate', 'Club-Mate', ['club mate', 'clubmate', 'mate'], ['club-mate', 'mate'], ['كلوب ماتيه', 'ماتيه']),
    opt('wasser', 'Wasser', ['mineralwasser', 'sprudel', 'sprudelwasser'], ['water', 'a water', 'sparkling water'], ['ماء', 'مياه']),
    opt('schorle', 'Apfelschorle', ['apfelschorlen', 'schorle', 'apfelsaft'], ['apple spritzer', 'apple juice', 'spritzer'], ['عصير تفاح بالصودا', 'عصير تفاح']),
  ],
  doener: [
    opt('doener', 'Döner', ['doner', 'doener', 'kebab', 'döner kebab', 'dönerkebab'], ['doner', 'döner', 'kebab', 'doner kebab'], ['دونر', 'كباب']),
    opt('duerum', 'Dürüm', ['durum', 'dürum', 'yufka', 'wrap'], ['durum', 'dürüm', 'wrap'], ['دوروم', 'لفّة']),
    opt('falafel', 'Falafel', ['falafeln'], ['falafel'], ['فلافل']),
  ],
  ticket: [
    opt('einzel', 'Fahrschein', ['einzelfahrschein', 'einzelticket', 'fahrkarte', 'ticket', 'berlin ab', 'einzelfahrt'], ['ticket', 'single ticket', 'a ticket'], ['تذكرة', 'تذكرة ذهاب']),
    opt('tageskarte', 'Tageskarte', ['tagesticket', '24 stunden', '24-stunden-karte', 'ganzen tag'], ['day ticket', 'day pass', '24 hour ticket'], ['تذكرة يومية', 'تذكرة يوم']),
    opt('kurzstrecke', 'Kurzstrecke', ['kurzstrecken'], ['short trip', 'short-trip ticket', 'short ticket'], ['مسافة قصيرة', 'تذكرة قصيرة']),
  ],
  // with the article, so Greta can say it back: 「Ah, die Lampe!」, 「Ah, das Fahrrad!」
  floh: [
    opt('lampe', 'die Lampe', ['leuchte', 'stehlampe'], ['lamp', 'the lamp'], ['مصباح', 'المصباح']),
    opt('platte', 'die Schallplatte', ['platte', 'vinyl', 'lp', 'schallplatten'], ['record', 'vinyl', 'the record'], ['أسطوانة', 'الأسطوانة']),
    opt('jacke', 'die Jacke', ['lederjacke', 'jeansjacke'], ['jacket', 'the jacket'], ['سترة', 'جاكيت']),
    opt('kamera', 'die Kamera', ['fotoapparat', 'fotokamera'], ['camera', 'the camera'], ['كاميرا', 'الكاميرا']),
    opt('fahrrad', 'das Fahrrad', ['rad', 'velo', 'bike'], ['bike', 'bicycle', 'the bike'], ['درّاجة', 'الدراجة', 'دراجة']),
  ],
  // where you are from (a country not listed is taken as said: 「Ich komme aus Island」)
  country: [
    opt('egypt', 'Ägypten', [], ['egypt'], ['مصر']),
    opt('morocco', 'Marokko', [], ['morocco'], ['المغرب']),
    opt('syria', 'Syrien', [], ['syria'], ['سوريا', 'سورية']),
    opt('saudi', 'Saudi-Arabien', ['saudi arabien', 'saudi'], ['saudi arabia', 'saudi'], ['السعودية']),
    opt('jordan', 'Jordanien', [], ['jordan'], ['الأردن']),
    opt('lebanon', 'Libanon', ['dem libanon'], ['lebanon'], ['لبنان']),
    opt('iraq', 'Irak', ['dem irak'], ['iraq'], ['العراق']),
    opt('uae', 'Emiraten', ['vae', 'den emiraten', 'vereinigten arabischen emiraten'], ['uae', 'emirates'], ['الإمارات']),
    opt('england', 'England', ['großbritannien', 'uk'], ['england', 'uk', 'britain'], ['إنجلترا', 'بريطانيا']),
    opt('usa', 'USA', ['amerika', 'den usa', 'vereinigten staaten'], ['usa', 'america', 'the us'], ['أمريكا', 'الولايات المتحدة']),
    opt('turkey', 'Türkei', ['der turkei'], ['turkey', 'türkiye'], ['تركيا']),
    opt('japan', 'Japan', [], ['japan'], ['اليابان']),
  ],
  // what you like doing (the ids are the topics' hobbies, as in Tokyo)
  hobby: [
    opt('cooking', 'Kochen', ['koche', 'koch'], ['cooking', 'cook'], ['الطبخ', 'أطبخ']),
    opt('music', 'Musik', ['hore', 'singe', 'gitarre', 'klavier'], ['music'], ['الموسيقى', 'موسيقى']),
    opt('sports', 'Sport', ['fussball', 'laufe', 'jogge', 'joggen', 'schwimme', 'tanze', 'basketball'], ['sport', 'sports', 'football', 'running'], ['الرياضة', 'كرة القدم']),
    opt('games', 'Spiele', ['videospiele', 'zocke', 'zocken', 'gaming'], ['games', 'gaming', 'video games'], ['الألعاب', 'ألعاب الفيديو']),
    opt('travel', 'Reisen', ['reise'], ['travel', 'travelling'], ['السفر', 'أسافر']),
    opt('movies', 'Filme', ['film', 'kino', 'serien', 'schaue'], ['movies', 'films', 'cinema'], ['الأفلام', 'السينما']),
    opt('books', 'Lesen', ['lese', 'bucher', 'buch'], ['reading', 'books'], ['القراءة', 'الكتب']),
    opt('drawing', 'Zeichnen', ['zeichne', 'male', 'malen', 'kunst'], ['drawing', 'painting', 'art'], ['الرسم', 'أرسم']),
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
