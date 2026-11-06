import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the game centre (ゲームセンター「ピコピコ」, Shota's crane game, `arcade_crane`): change (両替, 百円玉), how many plays
// (一回 / 二回 / 三回), and the arcade custom of asking the staff to move a prize to an easier spot (取りやすくしてもらえますか).
// Surfaces are unique across the lexicon.

export const ARCADE_LEXICON: LexEntry[] = [
  w('ゲームセンター', '', 'a game centre (arcade)', 'صالة ألعاب'),
  w('クレーンゲーム', '', 'a crane game (claw machine)', 'لعبة الرافعة (آلة المخلب)'),
  w('両替', 'りょうがえ', 'changing money (into coins)', 'صرف النقود (إلى قطع نقدية)'),
  w('百円玉', 'ひゃくえんだま', 'a 100-yen coin', 'قطعة 100 ين'),
  w('千円札', 'せんえんさつ', 'a 1,000-yen note', 'ورقة 1,000 ين'),
  w('枚', 'まい', 'counter for flat things (coins, notes, tickets)', 'عدّاد للأشياء المسطحة (عملات، أوراق، تذاكر)'),
  w('一回', 'いっかい', 'once, one go', 'مرة واحدة'),
  w('二回', 'にかい', 'twice, two goes', 'مرتان'),
  w('三回', 'さんかい', 'three times, three goes', 'ثلاث مرات'),
  w('何回', 'なんかい', 'how many times', 'كم مرة'),
  w('景品', 'けいひん', 'a prize', 'جائزة'),
  w('やりたい', '', 'want to do / play', 'أريد أن ألعب / أفعل'),
  w('取りやすく', 'とりやすく', 'easier to get', 'أسهل في الإمساك'),
  w('動かして', 'うごかして', 'move (it), please', 'حرّك (ه)'),
  w('もらえますか', '', 'could you (do it for me)?', 'هل يمكنك (أن تفعل ذلك لي)؟'),
  w('動かします', 'うごかします', 'will move (it)', 'سأحرّك (ه)'),
  w('取れました', 'とれました', 'got it, caught it', 'أمسكتُها'),
  w('取れたら', 'とれたら', 'if you get (one)', 'إن أمسكتَ (واحدة)'),
  w('取りやすい', 'とりやすい', 'easy to get', 'سهل الإمساك'),
  w('ピコピコ', '', 'Piko Piko (the game centre\'s name; the sound of a beeping game)', 'بيكو بيكو (اسم صالة الألعاب؛ صوت لعبة تصدر صفيرًا)'),
  w('手伝って', 'てつだって', 'help (me), please', 'ساعدني'),
  w('近く', 'ちかく', 'near, close by', 'قريب'),
];
