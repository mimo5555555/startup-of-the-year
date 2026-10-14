import type { LexEntry } from '../types';
import { w, g } from './helpers';

// Lexicon entries for Fuku-Fuku (the clothes shop; agent A2, docs/GAME_DESIGN.md §15.10 "shop-fuku"). Keep surfaces unique across the whole lexicon (the content tests report clashes).
// 服 and 大きい are in the social module, いらっしゃいませ in core, この in the Motors module; the colours 黒 白 青 赤 and 色 are in the Denki module.

export const SHOP_FUKU_LEXICON: LexEntry[] = [
  // ---- the clothes the shop sells (slot `clothes`) ----
  w('Tシャツ', 'ティーシャツ', 'T-shirt', 'قميص تي شيرت'),
  w('パーカー', '', 'hoodie', 'هودي'),
  w('ジーンズ', '', 'jeans', 'بنطال جينز'),
  w('スニーカー', '', 'sneakers', 'حذاء رياضي'),
  w('帽子', 'ぼうし', 'cap', 'قبعة'),
  w('ダウンジャケット', '', 'down jacket', 'سترة منفوخة'),
  w('メガネ', '', 'glasses', 'نظارات'),
  w('リュック', '', 'backpack', 'حقيبة ظهر'),
  w('スーツ', '', 'business suit', 'بدلة رسمية'),

  // ---- the presents (the `goods` node; slot `giftItem`) ----
  w('ぬいぐるみ', '', 'plush toy', 'دمية محشوة'),
  w('ギターピック', '', 'guitar pick', 'ريشة غيتار'),

  // ---- sizes and colours ----
  w('サイズ', '', 'size', 'مقاس'),
  w('エスサイズ', '', 'size S (small)', 'مقاس S (صغير)'),
  w('エムサイズ', '', 'size M (medium)', 'مقاس M (متوسط)'),
  w('エルサイズ', '', 'size L (large)', 'مقاس L (كبير)'),
  w('フリーサイズ', '', 'one size (fits all)', 'مقاس واحد (يناسب الجميع)'),
  w('緑', 'みどり', 'green', 'أخضر'),
  w('黄色', 'きいろ', 'yellow', 'أصفر'),

  // ---- the fitting room and the fit ----
  w('試着', 'しちゃく', 'trying on', 'تجربة الملابس'),
  w('似合います', 'にあいます', 'suits (you)', 'يليق بك'),
  w('小さい', 'ちいさい', 'small', 'صغير'),
  w('ちょうどいい', '', 'just right', 'مناسب تمامًا'),

  // ---- shop talk ----
  w('待って', 'まって', 'wait (te-form)', 'انتظر'),
  w('後で', 'あとで', 'later / afterwards', 'لاحقًا'),
  w('お知らせ', 'おしらせ', 'letting (you) know', 'إبلاغك'),
  w('全部', 'ぜんぶ', 'all / in total', 'المجموع'),
];

void g;
