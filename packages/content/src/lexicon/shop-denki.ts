import type { LexEntry } from '../types';
import { w, g } from './helpers';

// Lexicon entries for Hikari Denki (phones and electronics; agent 3C, docs/GAME_DESIGN.md §15.10 "shop-denki"). Keep surfaces unique across the whole lexicon (the content tests report clashes).

export const SHOP_DENKI_LEXICON: LexEntry[] = [
  // ---- the things the shop sells (slot `denkiItem`) ----
  w('スマホ', '', 'smartphone', 'هاتف ذكي'),
  w('中古スマホ', 'ちゅうこスマホ', 'refurbished smartphone', 'هاتف ذكي مجدّد'),
  w('最新スマホ', 'さいしんスマホ', 'latest smartphone', 'أحدث هاتف ذكي'),
  w('スマホケース', '', 'phone case', 'غلاف الهاتف'),
  w('テレビ', '', 'TV', 'تلفزيون'),
  w('音楽CD', 'おんがくシーディー', 'music CD', 'أسطوانة موسيقى'),

  // ---- the words of §15.10 ----
  w('中古', 'ちゅうこ', 'second-hand / refurbished', 'مستعمل / مجدّد'),
  w('最新', 'さいしん', 'latest', 'الأحدث'),
  w('色', 'いろ', 'colour', 'لون'),
  w('黒', 'くろ', 'black', 'أسود'),
  w('白', 'しろ', 'white', 'أبيض'),
  w('青', 'あお', 'blue', 'أزرق'),
  w('赤', 'あか', 'red', 'أحمر'),
  w('画面', 'がめん', 'screen', 'الشاشة'),
  w('電池', 'でんち', 'battery', 'البطارية'),
  w('充電', 'じゅうでん', 'charging', 'الشحن'),
  w('保証', 'ほしょう', 'warranty', 'الضمان'),
  w('ケース', '', 'case', 'غلاف'),
  w('入荷', 'にゅうか', 'arrival of stock', 'وصول البضاعة'),
  w('免税', 'めんぜい', 'tax-free', 'معفى من الضريبة'),

  // ---- shop talk ----
  w('お探し', 'おさがし', 'looking for (polite)', 'تبحث عن (بأدب)'),
  w('お値段', 'おねだん', 'price (polite)', 'السعر (بأدب)'),
  w('お支払い', 'おしはらい', 'payment (polite)', 'الدفع (بأدب)'),
  w('対象外', 'たいしょうがい', 'not eligible', 'غير مؤهل'),
  w('人気', 'にんき', 'popular', 'رائج'),
  w('いかが', '', 'how about (polite)', 'ما رأيك (بأدب)'),
  w('越し', 'こし', 'coming (in お越し)', 'القدوم (في お越し)'),
  w('お越し', 'おこし', 'coming (polite)', 'القدوم (بأدب)'),
  w('入荷して', 'にゅうかして', 'being in stock', 'وصول البضاعة'),
  w('よろしい', '', 'all right (polite)', 'مناسب (بأدب)'),
  w('支払い', 'しはらい', 'payment', 'الدفع'),
  w('申し訳ありません', 'もうしわけありません', 'I am very sorry (polite)', 'أعتذر بشدّة (بأدب)'),
  w('見ている', 'みている', 'am looking (just browsing)', 'أتفرّج'),
  w('お渡し', 'おわたし', 'handing over (polite)', 'التسليم (بأدب)'),
  w('こちら', '', 'this (polite)', 'هذا (بأدب)'),
  w('ごゆっくり', '', 'take your time', 'خذ وقتك'),
  w('まだ', '', 'not yet / still', 'ليس بعد'),
  w('いません', '', 'is not (there; polite negative of いる)', 'ليس موجودًا'),
  w('ほう', '', 'the side / the one (in comparisons)', 'الجانب (في المقارنة)'),
  w('おります', '', 'am / is (humble)', 'أكون (بتواضع)'),
  w('かしこまりました', '', 'certainly (humble)', 'حسنًا (بتواضع)'),
  g('して', '(te-form of する)', 'صيغة التّصريف'),
  w('ほしい', '', 'want (I would like)', 'أريد'),
  w('どちら', '', 'which one (of two)', 'أيّ (من اثنين)'),
  g('でしょうか', '(polite "is it...?")', '(سؤال مهذّب)'),
];
