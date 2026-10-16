import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the Hikarigaoka trip and the beats of Chapters 5-6 (Release 2 wave C1, docs/GAME_DESIGN.md §6.5, §7.2). Keep surfaces unique across
// the whole lexicon (the content tests report clashes); 光が丘, 電車, 乗れます, ホーム, 公園, 近い and お土産 live in other modules.

export const TRIP_LEXICON: LexEntry[] = [
  // ---- Chapter 5: Sato, the train, the platform ----
  w('行きませんか', 'いきませんか', "won't you go?", 'ألا تذهب؟'),
  w('ご乗車', 'ごじょうしゃ', 'riding (a train; polite)', 'ركوب القطار (بأدب)'),
  w('乗りました', 'のりました', 'rode, got on', 'ركب'),
  w('行きました', 'いきました', 'went', 'ذهب'),
  // ---- Kato's shop ----
  w('使えません', 'つかえません', 'cannot be used', 'لا يمكن استخدامه'),
  // ---- Chapter 6: Mio's invitation and Hanako's try without hints ----
  w('来ませんか', 'きませんか', "won't you come?", 'ألا تأتي؟'),
  w('あがって', '', 'come up (into the house)', 'ادخل (إلى البيت)'),
  w('ヒント', '', 'hint', 'تلميح'),
  w('なし', '', 'without, none', 'بدون'),
  w('やってみましょう', '', "let's try it", 'لنجرّب'),
  w('言葉', 'ことば', 'words, language', 'كلمات، لغة'),
  w('話して', 'はなして', 'speak (and)', 'تحدّث'),
];
