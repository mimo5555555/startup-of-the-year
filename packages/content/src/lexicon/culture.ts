import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the culture cards' key phrases (agent 4F; docs/GAME_DESIGN.md §10). The rest of the phrases use words that other
// modules own. Keep surfaces unique across the whole lexicon (the content tests report clashes).

export const CULTURE_LEXICON: LexEntry[] = [
  w('よろしく', '', 'kindly / best regards', 'بكل ودّ'),
  w('タメ口', 'ためぐち', 'casual speech', 'الكلام العادي'),
  w('お花見', 'おはなみ', 'flower viewing (cherry blossoms)', 'مشاهدة أزهار الكرز'),
  w('降ります', 'おります', 'get off (a train)', 'أنزل (من القطار)'),
  w('おじゃまします', '', 'excuse me for intruding', 'عن إذنك (عند الدخول)'),
  w('敷金', 'しききん', 'security deposit', 'وديعة التأمين'),
  w('ごみの日', 'ごみのひ', 'rubbish day', 'يوم النفايات'),
];
