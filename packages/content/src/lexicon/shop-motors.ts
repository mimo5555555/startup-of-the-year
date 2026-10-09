import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for Nakamura Motors (bikes and cars; agent 3D-lite, docs/GAME_DESIGN.md §15.10 "shop-motors"). Keep surfaces unique across the
// whole lexicon (the content tests report clashes). Every kanji entry has a kana reading.

export const SHOP_MOTORS_LEXICON: LexEntry[] = [
  // ---- the things the shop sells (slots `bikeModel`, `carModel`, `giftItem`) ----
  w('ママチャリ', '', 'everyday bicycle (mamachari)', 'دراجة يومية (ماماتشاري)'),
  w('ヘルメット', '', 'helmet', 'خوذة'),
  w('電動アシスト自転車', 'でんどうアシストじてんしゃ', 'power-assist bicycle', 'دراجة كهربائية مساعدة'),
  w('軽自動車', 'けいじどうしゃ', 'kei car (small car)', 'سيارة كي (سيارة صغيرة)'),
  w('中古の軽自動車', 'ちゅうこのけいじどうしゃ', 'used kei car', 'سيارة كي مستعملة'),
  w('低走行の軽自動車', 'ていそうこうのけいじどうしゃ', 'low-mileage kei car', 'سيارة كي قليلة المسافة'),
  w('車の芳香剤', 'くるまのほうこうざい', 'car air freshener', 'معطّر سيارة'),
  w('芳香剤', 'ほうこうざい', 'air freshener', 'معطّر جو'),

  // ---- purposes (slot `purpose`) ----
  w('通学', 'つうがく', 'going to school', 'الذهاب إلى المدرسة'),
  w('買い物', 'かいもの', 'shopping', 'التسوّق'),
  w('散歩', 'さんぽ', 'a walk / a ride around town', 'نزهة'),
  w('使います', 'つかいます', 'use (polite)', 'أستخدم (بأدب)'),

  // ---- the registration (防犯登録) ----
  w('防犯登録', 'ぼうはんとうろく', 'bicycle registration (anti-theft)', 'تسجيل الدراجة (مكافحة السرقة)'),
  w('住所', 'じゅうしょ', 'address', 'العنوان'),
  w('ご住所', 'ごじゅうしょ', 'address (polite)', 'العنوان (بأدب)'),
  w('保証書', 'ほしょうしょ', 'warranty card', 'بطاقة الضمان'),
  w('入れて', 'いれて', 'including / putting in (te-form)', 'مع احتساب'),
  w('安全', 'あんぜん', 'safety', 'السلامة'),
  w('運転', 'うんてん', 'driving / riding', 'القيادة'),

  // ---- the car ----
  w('本体価格', 'ほんたいかかく', 'body price (the car alone)', 'سعر الهيكل (السيارة وحدها)'),
  w('乗り出し価格', 'のりだしかかく', 'drive-away price (everything included)', 'السعر النهائي (كل شيء مشمول)'),
  w('諸費用', 'しょひよう', 'fees and charges', 'الرسوم والمصاريف'),
  w('走行距離', 'そうこうきょり', 'mileage', 'المسافة المقطوعة'),
  w('低走行', 'ていそうこう', 'low mileage', 'قليلة المسافة'),
  w('年式', 'ねんしき', 'model year', 'سنة الصنع'),
  w('何色', 'なにいろ', 'what colour', 'أيّ لون'),
  w('キロ', '', 'kilometres', 'كيلومتر'),
  w('走ります', 'はしります', 'runs / drives', 'تسير'),
  w('古い', 'ふるい', 'old', 'قديم'),
  w('見たい', 'みたい', 'want to see', 'أريد أن أرى'),
  w('見て', 'みて', 'looking (te-form of 見る)', 'تتفرّج'),
  w('ご契約', 'ごけいやく', 'contract (polite)', 'العقد (بأدب)'),
  w('確認', 'かくにん', 'check / confirmation', 'تحقّق'),
  w('ご確認', 'ごかくにん', 'check (polite)', 'تحقّق (بأدب)'),
  w('金額', 'きんがく', 'amount of money', 'المبلغ'),
  w('五百', 'ごひゃく', 'five hundred', 'خمسمئة'),

  // ---- polite asking and refusing (cc_refuse) ----
  w('安く', 'やすく', 'cheaper (adverb)', 'أرخص'),
  w('お安く', 'おやすく', 'cheaper (polite)', 'أرخص (بأدب)'),
  w('なりませんか', '', 'could it not become...? (polite request)', 'ألا يمكن أن يصبح...؟ (طلب مهذب)'),
  w('もう少し', 'もうすこし', 'a little more', 'قليلًا بعد'),
  w('これ以上', 'これいじょう', 'any more than this', 'أكثر من هذا'),
  w('難しい', 'むずかしい', 'difficult', 'صعب'),

  // ---- shop talk ----
  w('必要', 'ひつよう', 'necessary / needed', 'ضروري'),
  w('ご用意', 'ごようい', 'preparing / having ready (polite)', 'التجهيز (بأدب)'),
  w('お持ち', 'おもち', 'having (polite)', 'امتلاك (بأدب)'),
  w('それでは', '', 'well then', 'إذن'),
  w('それ', '', 'that', 'ذلك'),
  w('なら', '', 'if (that is so)', 'إذا كان كذلك'),
  w('この', '', 'this (before a noun)', 'هذا (قبل الاسم)'),
  w('よく', '', 'well / often', 'جيدًا'),
  w('そう', '', 'so / that way', 'هكذا'),
  w('では', '', 'then / well then', 'إذن'),
];
