import type { LexEntry } from '../types';
import { w } from './helpers';

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

  // ---- ranks ----
  w('見習い', 'みならい', 'trainee', 'متدرّب'),
  w('一人前', 'いちにんまえ', 'full-fledged', 'متمكّن'),
  w('ベテラン', '', 'veteran', 'محترف'),
  w('エース', '', 'ace', 'نجم'),
  w('店長代理', 'てんちょうだいり', 'acting manager', 'نائب المدير'),
];
