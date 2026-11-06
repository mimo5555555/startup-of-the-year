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
];
