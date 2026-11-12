import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the Mini-theatre (ミニシアター): the episodes (the first konbini, the secret of the ramen, cherry blossoms in the park)
// and the town's song 「桜通り」. Surfaces are unique across the lexicon.

export const THEATRE_LEXICON: LexEntry[] = [
  w('いりますか', '', 'do you need (it)?', 'هل تحتاج (ه)؟'),
  w('寒い', 'さむい', 'cold (weather)', 'بارد (الطقس)'),
  w('食べる', 'たべる', 'to eat', 'يأكل'),
  w('しょうゆラーメン', '', 'soy-sauce ramen', 'رامن بصلصة الصويا'),
  w('十二時間', 'じゅうにじかん', 'twelve hours', 'اثنتا عشرة ساعة'),
  w('かかる', '', 'to take (time)', 'يستغرق (وقتًا)'),
  w('おいしさ', '', 'the taste, deliciousness', 'المذاق، اللذة'),
  w('秘密', 'ひみつ', 'a secret', 'سرّ'),
  w('だよ', '', 'it is (plain, friendly)', 'إنه (عادي، ودود)'),
  w('持ってきました', 'もってきました', 'brought (it)', 'أحضرتُ'),
  w('下', 'した', 'under, below', 'تحت'),
  w('来年', 'らいねん', 'next year', 'العام القادم'),
  w('来たい', 'きたい', 'want to come', 'أريد أن آتي'),
  w('ええ', '', 'yes (soft)', 'نعم (بلطف)'),
  // the game centre, the bath and the figure shop episodes
  w('落ちました', 'おちました', 'fell, dropped', 'سقطت'),
  w('もう一回', 'もういっかい', 'one more time, one more go', 'مرة أخرى، محاولة أخرى'),
  w('やった', '', 'yes! I did it!', 'رائع! نجحت!'),
  w('はじめて', '', 'for the first time; the first time', 'لأول مرة؛ أول مرة'),
  w('ああ', '', 'ahh (a happy sigh)', 'آه (تنهيدة ارتياح)'),
  // the seasons song 「桜町の一年」
  w('咲く', 'さく', 'to bloom', 'يتفتّح'),
  w('海', 'うみ', 'the sea', 'البحر'),
  w('泳ごう', 'およごう', "let's swim", 'لنسبح'),
  w('もみじ', '', 'maple leaves (red in autumn)', 'أوراق القيقب (حمراء في الخريف)'),
  w('雪', 'ゆき', 'snow', 'ثلج'),
  w('降る', 'ふる', 'to fall (rain, snow)', 'يتساقط (المطر، الثلج)'),
  // the station, Hikari Denki and the festival episodes
  w('三分後', 'さんぷんご', 'in three minutes', 'بعد ثلاث دقائق'),
  w('払えます', 'はらえます', 'can pay', 'يمكن الدفع'),
  w('リン', '', 'Rin (a name)', 'رين (اسم)'),
  w('ちゃん', '', '-chan (a friendly way to call a girl or a child)', '-تشان (لقب ودّي لفتاة أو طفل)'),
  w('お腹', 'おなか', 'stomach, belly', 'البطن'),
  w('すいた', '', 'is empty: お腹がすいた = I am hungry', 'فارغ: お腹がすいた = أنا جائع'),
  w('食べよう', 'たべよう', "let's eat", 'لنأكل'),
  w('食べたい', 'たべたい', 'want to eat', 'أريد أن آكل'),
  w('始まる', 'はじまる', 'to start, to begin', 'يبدأ'),
  // the days of the week (the song 「わたしの一週間」); 土曜日 lives in another module
  w('月曜日', 'げつようび', 'Monday', 'يوم الاثنين'),
  w('火曜日', 'かようび', 'Tuesday', 'يوم الثلاثاء'),
  w('水曜日', 'すいようび', 'Wednesday', 'يوم الأربعاء'),
  w('木曜日', 'もくようび', 'Thursday', 'يوم الخميس'),
  w('金曜日', 'きんようび', 'Friday', 'يوم الجمعة'),
  w('日曜日', 'にちようび', 'Sunday', 'يوم الأحد'),
];
