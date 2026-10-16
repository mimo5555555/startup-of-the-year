import type { LexEntry } from '../types';
import { w, g } from './helpers';

// Lexicon entries for part-time jobs and shifts (agent 4D; docs/GAME_DESIGN.md §9, §7.6). The konbini shift: what the customers say,
// what the staff say back, the boss's lines and the rank names. Keep surfaces unique across the whole lexicon (the content tests report clashes).

export const JOBS_LEXICON: LexEntry[] = [
  // ---- the work ----
  w('お手伝い', 'おてつだい', 'helping out', 'مساعدة'),
  w('お店', 'おみせ', 'shop', 'المتجر'),
  w('お客さん', 'おきゃくさん', 'customer', 'الزبون'),
  w('やります', '', 'I will do it', 'سأفعل ذلك'),
  w('どんな', '', 'what kind of', 'أي نوع من'),
  w('言って', 'いって', 'say (and)', 'قل'),
  w('帰ります', 'かえります', 'goes home / leaves', 'يغادر'),
  w('上手', 'じょうず', 'skilful', 'ماهر'),
  w('いつでも', '', 'any time', 'في أي وقت'),

  // ---- customers and staff at the register ----
  w('温めて', 'あたためて', 'heat it up (and)', 'سخّن'),
  w('お待たせしました', 'おまたせしました', 'sorry to keep you waiting', 'آسف على الانتظار'),

  // ---- the boss and the result card ----
  w('休んで', 'やすんで', 'rest (and)', 'ارتح'),
  w('完璧', 'かんぺき', 'perfect', 'ممتاز'),
  w('時給', 'じきゅう', 'hourly wage', 'الأجر بالساعة'),
  w('上がります', 'あがります', 'goes up', 'يرتفع'),
  w('なりました', '', 'became', 'أصبح'),

  // ---- the café (Release 2 wave C1): the hall, the table and the changes of mind ----
  w('テーブル', '', 'table', 'طاولة'),
  w('一番', 'いちばん', 'number 1 (a table)', 'رقم 1'),
  w('二番', 'にばん', 'number 2 (a table)', 'رقم 2'),
  w('三番', 'さんばん', 'number 3 (a table)', 'رقم 3'),
  w('四番', 'よんばん', 'number 4 (a table)', 'رقم 4'),
  w('やっぱり', '', 'after all, actually', 'في النهاية، بل'),
  w('別々', 'べつべつ', 'separately', 'كلٌّ على حدة'),
  w('出します', 'だします', 'serve, put out', 'يقدّم'),
  w('できました', '', 'it is ready / done', 'جاهز'),

  // ---- the station help desk: platforms, times and what the staff announce ----
  w('案内', 'あんない', 'guidance, information desk', 'إرشاد، مكتب استعلامات'),
  w('道', 'みち', 'way, road', 'طريق'),
  g('や', '(and, among others)', '(و، ومنها)'),
  w('番線', 'ばんせん', 'platform number (counter)', 'رقم الرصيف'),
  w('二番線', 'にばんせん', 'platform 2', 'الرصيف 2'),
  w('四番線', 'よんばんせん', 'platform 4', 'الرصيف 4'),
  w('時', 'じ', "o'clock", 'الساعة'),
  w('分', 'ふん', 'minutes', 'دقائق'),
  // hours and minutes whose reading is not digit + counter (九時 is くじ, not きゅうじ; 八分 is はっぷん): the desk's time phrases use these
  w('四時', 'よじ', "4 o'clock", 'الساعة 4'),
  w('七時', 'しちじ', "7 o'clock", 'الساعة 7'),
  w('九時', 'くじ', "9 o'clock", 'الساعة 9'),
  w('一分', 'いっぷん', '1 minute', 'دقيقة واحدة'),
  w('三分', 'さんぷん', '3 minutes', '3 دقائق'),
  w('四分', 'よんぷん', '4 minutes', '4 دقائق'),
  w('六分', 'ろっぷん', '6 minutes', '6 دقائق'),
  w('八分', 'はっぷん', '8 minutes', '8 دقائق'),
  w('十分', 'じゅっぷん', '10 minutes', '10 دقائق'),
  w('まもなく', '', 'soon, shortly', 'قريبًا'),
  w('参ります', 'まいります', 'arrives (humble, station announcement)', 'يصل (إعلان المحطة)'),
  w('行く', 'いく', 'go', 'يذهب'),
  w('お気をつけて', 'おきをつけて', 'take care', 'اعتنِ بنفسك'),

  // ---- ranks ----
  w('見習い', 'みならい', 'trainee', 'متدرّب'),
  w('一人前', 'いちにんまえ', 'full-fledged', 'متمكّن'),
  w('ベテラン', '', 'veteran', 'محترف'),
  w('エース', '', 'ace', 'نجم'),
  w('店長代理', 'てんちょうだいり', 'acting manager', 'نائب المدير'),
];
