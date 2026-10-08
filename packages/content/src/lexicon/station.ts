import type { LexEntry } from '../types';
import { w, g } from './helpers';

// Lexicon entries for the station, the IC card and the directions (agent 2G, docs/GAME_DESIGN.md §15.10 "station"). Keep surfaces
// unique across the whole lexicon (the content tests report clashes). Station words that earlier modules already own (駅, 切符, 券売機,
// 出口, 入口, 電車, 三番線, 何番線, ICカード) are not repeated here.

export const STATION_LEXICON: LexEntry[] = [
  // ---- the IC card and the money on it (§15.10) ----
  w('チャージ', '', 'top up / charge (a card)', 'شحن (البطاقة)'),
  w('チャージしました', '', 'topped up (done)', 'تم الشحن'),
  w('払い戻し', 'はらいもどし', 'refund', 'استرداد'),
  w('払い戻ししました', 'はらいもどししました', 'refunded (done)', 'تم الاسترداد'),
  w('残高', 'ざんだか', 'balance (money left on the card)', 'الرصيد (المتبقي على البطاقة)'),
  w('入金', 'にゅうきん', 'paying in (money into the machine)', 'إيداع (نقود في الآلة)'),
  w('手数料', 'てすうりょう', 'handling fee', 'رسوم الخدمة'),
  w('デポジット', '', 'deposit', 'وديعة'),
  w('ゼロ', '', 'zero', 'صفر'),
  w('おいくら', '', 'how much (polite)', 'كم (بأدب)'),
  w('便利', 'べんり', 'convenient', 'مريح'),
  w('ピッと', '', 'with a beep (tapping the card)', 'بنقرة (تمرير البطاقة)'),
  w('乗れます', 'のれます', 'can ride', 'يمكنك الركوب'),
  w('よろしい', '', 'all right (polite)', 'مناسب (بأدب)'),
  w('できません', '', 'cannot do', 'لا يمكن'),
  g('だけ', '(only / just)', 'فقط'),
  g('まで', '(up to / until)', 'حتى'),
  w('やめます', '', 'stop / cancel (I will not)', 'سأتوقف (لا أريد)'),

  // ---- the station ----
  w('改札', 'かいさつ', 'ticket gate', 'بوابة التذاكر'),
  w('ホーム', '', 'platform', 'الرصيف'),
  w('乗り換え', 'のりかえ', 'transfer (changing trains)', 'تبديل القطار'),
  w('次の電車', 'つぎのでんしゃ', 'next train', 'القطار التالي'),
  w('時刻表', 'じこくひょう', 'timetable', 'جدول المواعيد'),

  // ---- the machines (VendingPanel, TicketPanel) ----
  w('あたたかい', '', 'warm / hot (a drink)', 'ساخن (مشروب)'),
  w('つめたい', '', 'cold (a drink)', 'بارد (مشروب)'),
  w('ボタン', '', 'button', 'زر'),
  w('コイン', '', 'coin', 'عملة معدنية'),
  w('運賃', 'うんちん', 'fare', 'أجرة القطار'),

  // ---- directions (§6.3 sato_directions) ----
  w('右', 'みぎ', 'right', 'يمين'),
  w('左', 'ひだり', 'left', 'يسار'),
  w('まっすぐ', '', 'straight ahead', 'مباشرةً للأمام'),
  w('曲がる', 'まがる', 'turn (a corner)', 'يستدير'),
  w('曲がってください', 'まがってください', 'please turn', 'انعطف من فضلك'),
  w('近い', 'ちかい', 'near', 'قريب'),
  w('遠い', 'とおい', 'far', 'بعيد'),
  w('そうです', '', 'that is right', 'هذا صحيح'),

  // ---- two places the `place` slot gains (§5.4) ----
  w('光が丘', 'ひかりがおか', 'Hikarigaoka', 'هيكاريغاأوكا'),
  w('羽田空港', 'はねだくうこう', 'Haneda Airport', 'مطار هانيدا'),
];
