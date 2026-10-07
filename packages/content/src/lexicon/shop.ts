import type { LexEntry } from '../types';
import { w, g } from './helpers';

// Lexicon entries for shops, items and prices (agent 2D, docs/GAME_DESIGN.md §15.10 "shop"). Keep surfaces unique across the whole lexicon (the content tests report clashes).
// The shop words other shop modules lean on (値段 安い 高い 定価 品切れ ...) are defined here once.

export const SHOP_LEXICON: LexEntry[] = [
  // ---- prices and paying ----
  w('値段', 'ねだん', 'price', 'السعر'),
  w('安い', 'やすい', 'cheap', 'رخيص'),
  w('高い', 'たかい', 'expensive', 'غالٍ'),
  w('定価', 'ていか', 'fixed price', 'سعر ثابت'),
  w('ポイント', '', 'points', 'نقاط'),
  w('レシート', '', 'receipt', 'إيصال'),
  w('領収書', 'りょうしゅうしょ', 'formal receipt (with your name)', 'إيصال رسمي (باسمك)'),
  w('ICカード', '', 'IC card (transit and shop card)', 'بطاقة IC (للمواصلات والدفع)'),
  w('足りません', 'たりません', 'is not enough', 'لا يكفي'),
  w('少し', 'すこし', 'a little', 'قليلًا'),
  w('お客様', 'おきゃくさま', 'customer (polite)', 'الزبون (بأدب)'),
  w('使えます', 'つかえます', 'can be used', 'يمكن استخدامه'),

  // ---- in the shop ----
  w('温める', 'あたためる', 'heat up (food)', 'يسخّن (الطعام)'),
  w('温めます', 'あたためます', 'heat up (polite)', 'أسخّن'),
  w('お箸', 'おはし', 'chopsticks', 'عيدان الطعام'),
  w('店内', 'てんない', 'inside the shop (eat in)', 'داخل المتجر (للأكل في المكان)'),
  w('持ち帰り', 'もちかえり', 'take-out', 'للأخذ'),
  w('品切れ', 'しなぎれ', 'sold out', 'نفدت الكمية'),
  w('ひとつ', '', 'one (thing)', 'واحد (شيء)'),
  w('ふたつ', '', 'two (things)', 'اثنان (شيئان)'),
  w('みっつ', '', 'three (things)', 'ثلاثة (أشياء)'),
  w('今日', 'きょう', 'today', 'اليوم'),
  w('ありません', '', "there isn't / I don't have", 'لا يوجد / ليس لدي'),
  w('できます', '', 'can do / is possible', 'يمكن / ممكن'),
  w('来ます', 'きます', 'come', 'يأتي'),
  w('考えます', 'かんがえます', 'think about it', 'أفكّر'),
  w('プレゼント', '', 'present / gift', 'هدية'),
  w('探しています', 'さがしています', 'am looking for', 'أبحث عن'),
  g('よ', '(softener: "you know")', 'أداة تلطيف وتأكيد'),

  // ---- goods the konbini sells as presents (§5.3) ----
  w('チョコレート', '', 'chocolate', 'شوكولاتة'),
  w('マンガ', '', 'manga', 'مانغا'),
  w('ゲームカード', '', 'game card', 'بطاقة ألعاب'),

  // ---- ramen ----
  w('食券', 'しょっけん', 'meal ticket (from the machine)', 'تذكرة الوجبة (من الآلة)'),
  w('麺', 'めん', 'noodles', 'نودلز'),
  w('かたさ', '', 'firmness', 'الصلابة'),
  w('かため', '', 'firm', 'صلب'),
  w('ふつう', '', 'regular', 'عادي'),
  w('やわらかめ', '', 'soft', 'طري'),
  w('味玉', 'あじたま', 'seasoned egg', 'بيضة متبّلة'),
  w('大盛', 'おおもり', 'large portion', 'حصة كبيرة'),
  w('替え玉', 'かえだま', 'extra noodles', 'نودلز إضافية'),
  w('餃子', 'ぎょうざ', 'gyoza', 'جيوزا (فطائر محشوة)'),

  // ---- vending machines (the VendingPanel, 2G, shows the drink names) ----
  w('缶コーヒー', 'かんコーヒー', 'canned coffee', 'قهوة معلّبة'),
];
