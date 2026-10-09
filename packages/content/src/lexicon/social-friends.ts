import type { LexEntry } from '../types';
import { w, g } from './helpers';

// Lexicon entries for the story beats of the friends (4A: Mio's heart-2 beat) and for hang-outs and home visits (4E-a). Keep surfaces
// unique across the whole lexicon (the content tests report clashes).
void g;

export const SOCIAL_FRIENDS_LEXICON: LexEntry[] = [
  // ---- Mio's heart-2 beat: the phone number on a paper note, and the switch to plain speech ----
  w('電話番号', 'でんわばんごう', 'phone number', 'رقم الهاتف'),
  w('番号', 'ばんごう', 'number (a list or ID number)', 'رقم'),
  w('メモ', '', 'memo, note', 'مذكرة'),
  w('ない', '', 'not have, there is not', 'لا يوجد، لا يملك'),
  w('敬語', 'けいご', 'polite (honorific) speech', 'لغة الاحترام'),
  w('やめよう', '', "let's stop (casual)", 'لنتوقف (غير رسمي)'),
];
