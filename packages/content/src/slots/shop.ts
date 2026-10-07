import type { SlotOption } from '../types';
import { opt } from './helpers';

/**
 * Slot lists the shop scenarios share (agent 2D, docs/GAME_DESIGN.md §14.9). Slot names are unique across all modules, so every shop
 * scenario (the five existing, station_ic, the Hikari Denki / Fuku-Fuku / Aiko / Motors ones) reuses these and never redefines them:
 * `payMethod`, `qty`, `chargeAmount`, `giftItem` (every shop's `goods` node restricts the options it accepts with `slotOptions`),
 * `ramenExtra` and `firmness` (ramen).
 */

/** An option whose Japanese is not (yet) a lexicon entry of this module: markup shown in lines, glosses and keys given here. */
const raw = (id: string, ja: string, en: string, ar: string, keys: { ja: string[]; en: string[]; ar: string[] }): SlotOption => ({ id, ja, gloss: { en, ar }, keys: { ja: [ja, ...keys.ja], en: keys.en, ar: keys.ar } });

const PAY: SlotOption[] = [
  opt('cash', '現金', ['げんきん', 'かね', 'お金'], ['cash', 'in cash', 'with cash', 'by cash'], ['نقدا', 'نقداً', 'كاش', 'بالنقد', 'نقد']),
  opt('card', 'カード', ['かーど', 'くれじっと', 'クレジット', 'クレジットカード', 'デビット'], ['card', 'by card', 'credit card', 'with card', 'debit card'], ['بطاقة', 'بالبطاقة', 'كارت', 'بالكارت', 'بطاقة ائتمان']),
  // 「ICカード」 is longer than 「カード」, so "ICカードで" is the IC card, not the plain card (the longest key wins)
  opt('ic', 'ICカード', ['あいしーかーど', 'アイシーカード', 'アイシー', 'あいしー', 'すいか', 'スイカ', 'ぱすも', 'パスモ', 'suica', 'pasmo', 'ic'], ['ic card', 'ic', 'suica', 'pasmo', 'transit card', 'my ic card'], ['بطاقة ic', 'بطاقة المواصلات', 'سويكا', 'باسمو']),
];

const QTY: SlotOption[] = [
  opt('one', 'ひとつ', ['一つ', '1つ', 'ひとこ', '一個', '1個'], ['one', '1', 'a', 'single', 'just one'], ['واحد', 'واحدة', 'وحدة', '1']),
  opt('two', 'ふたつ', ['二つ', '2つ', 'ふたこ', '二個', '2個'], ['two', '2', 'a pair', 'two of them'], ['اثنين', 'اثنان', 'اثنتين', 'ثنتين', '2']),
  opt('three', 'みっつ', ['三つ', '3つ', 'みつ', '三個', '3個'], ['three', '3', 'three of them'], ['ثلاثة', 'ثلاث', 'ثلاثه', '3']),
];

/** IC top-up steps (§5.4). The option id is the amount itself ('1000'), so the game reads it with `Number(id)`. */
const CHARGE: SlotOption[] = [
  raw('1000', '千|円', '1,000 yen', '1,000 ين', { ja: ['せんえん', '1000円', '1000', '千', '1,000'], en: ['1000', '1,000', '1000 yen', 'one thousand', 'a thousand', 'one thousand yen'], ar: ['1000', 'الف', 'ألف', '1000 ين', 'الف ين'] }),
  raw('2000', '二|千|円', '2,000 yen', '2,000 ين', { ja: ['にせんえん', '2000円', '2000', '二千', '2,000'], en: ['2000', '2,000', '2000 yen', 'two thousand', 'two thousand yen'], ar: ['2000', 'الفين', 'ألفين', '2000 ين'] }),
  raw('3000', '三千|円', '3,000 yen', '3,000 ين', { ja: ['さんぜんえん', '3000円', '3000', '三千', '3,000'], en: ['3000', '3,000', '3000 yen', 'three thousand', 'three thousand yen'], ar: ['3000', 'ثلاثة الاف', 'ثلاثة آلاف', '3000 ين'] }),
  raw('5000', '五|千|円', '5,000 yen', '5,000 ين', { ja: ['ごせんえん', '5000円', '5000', '五千', '5,000'], en: ['5000', '5,000', '5000 yen', 'five thousand', 'five thousand yen'], ar: ['5000', 'خمسة الاف', 'خمسة آلاف', '5000 ين'] }),
];

/** Everything a shop sells as a present (§5.3, §5.6). The Japanese is the §5.3 spelling; the shop module that sells a gift registers the words. */
const GIFT: SlotOption[] = [
  raw('choco', 'チョコレート', 'chocolate', 'شوكولاتة', { ja: ['ちょこ', 'チョコ'], en: ['chocolate', 'chocolates', 'choco', 'a chocolate'], ar: ['شوكولاتة', 'شوكولا', 'الشوكولاتة', 'شوكولاته'] }),
  raw('manga', 'マンガ', 'manga', 'مانغا', { ja: ['漫画', 'まんが', 'まんが1巻'], en: ['manga', 'a manga', 'manga volume', 'comic', 'comics'], ar: ['مانغا', 'مانجا', 'المانغا', 'مجلد مانغا'] }),
  raw('gameCard', 'ゲームカード', 'game card', 'بطاقة ألعاب', { ja: ['げーむかーど'], en: ['game card', 'a game card', 'gift card', 'game gift card'], ar: ['بطاقة ألعاب', 'بطاقة العاب', 'كرت ألعاب'] }),
  raw('musicCd', '音楽CD', 'music CD', 'أسطوانة موسيقى', { ja: ['おんがくしーでぃー', 'シーディー', 'cd', 'CD'], en: ['music cd', 'a music cd', 'cd', 'a cd'], ar: ['أسطوانة موسيقى', 'اسطوانة موسيقى', 'سي دي', 'اسطوانة'] }),
  raw('plush', 'ぬいぐるみ', 'plush toy', 'دمية محشوة', { ja: ['ぬいぐるみ'], en: ['plush toy', 'a plush toy', 'plush', 'stuffed toy', 'soft toy'], ar: ['دمية محشوة', 'دمية', 'لعبة محشوة'] }),
  raw('guitarPick', 'ギターピック', 'guitar pick', 'ريشة غيتار', { ja: ['ぎたーぴっく', 'ピック'], en: ['guitar pick', 'a guitar pick', 'pick', 'plectrum'], ar: ['ريشة غيتار', 'ريشة جيتار', 'ريشة'] }),
  raw('flower', '花束', 'small bouquet', 'باقة زهور صغيرة', { ja: ['はなたば', 'お花', 'はな', '花'], en: ['bouquet', 'a bouquet', 'small bouquet', 'flowers', 'a small bouquet'], ar: ['باقة زهور', 'باقة زهور صغيرة', 'زهور', 'ورد'] }),
  raw('wagashi', '和菓子', 'wagashi assortment', 'علبة حلويات يابانية', { ja: ['わがし', '和菓子の詰め合わせ'], en: ['wagashi', 'japanese sweets', 'a wagashi assortment', 'wagashi assortment', 'sweets'], ar: ['واغاشي', 'حلويات يابانية', 'علبة حلويات'] }),
  raw('teaSet', 'お茶セット', 'tea set', 'طقم شاي', { ja: ['おちゃせっと', 'お茶のセット'], en: ['tea set', 'a tea set'], ar: ['طقم شاي', 'طقم الشاي'] }),
  raw('tenugui', '手ぬぐい', 'tenugui hand towel', 'منشفة تينوغوي', { ja: ['てぬぐい', '手拭い'], en: ['tenugui', 'hand towel', 'a tenugui', 'a hand towel'], ar: ['تينوغوي', 'منشفة تينوغوي', 'منشفة يد'] }),
  raw('lantern', '灯籠', 'lantern', 'فانوس', { ja: ['とうろう', '灯ろう'], en: ['lantern', 'a lantern', 'lantern fund'], ar: ['فانوس', 'فانوس ورقي'] }),
  raw('carFresh', '車の芳香剤', 'car air freshener', 'معطّر سيارة', { ja: ['くるまのほうこうざい', '芳香剤'], en: ['air freshener', 'car air freshener', 'an air freshener', 'car freshener'], ar: ['معطر سيارة', 'معطر', 'معطر جو للسيارة'] }),
  raw('souvenir', 'おみやげ', 'souvenir', 'هدية تذكارية', { ja: ['お土産', 'みやげ'], en: ['souvenir', 'a souvenir', 'omiyage', 'gift from the trip'], ar: ['هدية تذكارية', 'تذكار', 'أوميياغي'] }),
];

const RAMEN_EXTRA: SlotOption[] = [
  opt('ajitama', '味玉', ['あじたま', '味付け卵', 'たまご', '玉子', '卵'], ['seasoned egg', 'egg', 'flavored egg', 'flavoured egg', 'marinated egg', 'an egg'], ['بيضة متبلة', 'بيضة', 'بيض']),
  opt('oomori', '大盛', ['おおもり', '大もり', 'おおもりで'], ['large portion', 'large', 'big portion', 'extra large', 'bigger portion', 'a large portion'], ['حصة كبيرة', 'حجم كبير', 'كبير']),
  opt('kaedama', '替え玉', ['かえだま', 'かえ玉', 'おかわり'], ['extra noodles', 'more noodles', 'noodle refill', 'refill', 'a refill'], ['نودلز إضافية', 'نودلز اضافية', 'مزيد من النودلز']),
  opt('gyoza', '餃子', ['ぎょうざ', 'ギョーザ', 'ギョウザ'], ['gyoza', 'dumplings', 'potstickers', 'some gyoza'], ['جيوزا', 'فطائر محشوة', 'دمبلنغ']),
];

const FIRMNESS: SlotOption[] = [
  opt('katame', 'かため', ['硬め', '固め', 'かたい', '硬い', '固い'], ['firm', 'hard', 'al dente', 'firm noodles'], ['صلب', 'قاسي', 'قاسية']),
  opt('futsu', 'ふつう', ['普通', 'れぎゅらー', 'レギュラー'], ['regular', 'normal', 'medium', 'standard'], ['عادي', 'عادية', 'متوسط']),
  opt('yawarakame', 'やわらかめ', ['柔らかめ', '軟らかめ', 'やわらかい', '柔らかい'], ['soft', 'soft noodles', 'tender'], ['طري', 'طرية', 'ناعم']),
];

/** Slot lists for the shop module. Slot names must be unique across all modules. */
export const SHOP_SLOTS: Record<string, SlotOption[]> = {
  payMethod: PAY,
  qty: QTY,
  chargeAmount: CHARGE,
  giftItem: GIFT,
  ramenExtra: RAMEN_EXTRA,
  firmness: FIRMNESS,
};
