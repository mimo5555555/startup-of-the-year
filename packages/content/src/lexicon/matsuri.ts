import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the festival, the speech and the Letter Home (Release 2 wave C2, docs/GAME_DESIGN.md §7.2 Chapters 7-8): Kenji's stalls,
// Hanako's self-introduction on the festival stage, the beats of Chapters 7-8, the Letter's sentence frames and the diary's two-tap lines. Keep
// surfaces unique across the whole lexicon (the content tests report clashes); お祭り, 屋台, 花火, 浴衣, 自己紹介, 皆さん, 土曜日, たこ焼き, 手紙,
// 家族, 書きます and 日記 live in the quests module.

export const MATSURI_LEXICON: LexEntry[] = [
  // ---- the stalls (matsuri_stalls, Kenji) ----
  w('焼きそば', 'やきそば', 'yakisoba (fried noodles)', 'ياكيسوبا (نودلز مقلية)'),
  w('かき氷', 'かきごおり', 'kakigōri (shaved ice)', 'كاكيغوري (ثلج مبشور)'),
  w('りんご飴', 'りんごあめ', 'candy apple', 'تفاحة بالسكر'),
  w('熱い', 'あつい', 'hot (to the touch)', 'ساخن'),
  w('気をつけて', 'きをつけて', 'be careful', 'انتبه'),
  // ---- the speech (matsuri_speech, Hanako) ----
  w('国', 'くに', 'country', 'بلد'),
  w('最後', 'さいご', 'last, the end', 'الأخير، النهاية'),
  w('一言', 'ひとこと', 'a word, a few words', 'كلمة قصيرة'),
  w('すばらしい', '', 'wonderful', 'رائع'),
  w('拍手', 'はくしゅ', 'applause', 'تصفيق'),
  w('前', 'まえ', 'in front of, before', 'أمام، قبل'),
  w('申します', 'もうします', 'am called (humble)', 'اسمي (بتواضع)'),
  // ---- the beats of Chapters 4, 6, 7 and 8 ----
  w('来週', 'らいしゅう', 'next week', 'الأسبوع القادم'),
  w('いっしょ', '', 'together', 'معًا'),
  w('行こう', 'いこう', "let's go (casual)", 'لنذهب (عادي)'),
  w('もうすぐ', '', 'soon', 'قريبًا'),
  w('書きましょう', 'かきましょう', "let's write", 'لنكتب'),
  w('一年', 'いちねん', 'one year', 'سنة واحدة'),
  w('がんばりました', '', 'worked hard, did your best', 'اجتهد، بذل جهده'),
  w('暮らす', 'くらす', 'live (one’s daily life)', 'يعيش'),
  w('暮らして', 'くらして', 'living (and)', 'يعيش'),
  // ---- the Letter Home and the diary ----
  w('お父さん', 'おとうさん', 'Dad, father', 'أبي'),
  w('お母さん', 'おかあさん', 'Mum, mother', 'أمي'),
  w('より', '', 'from (signing a letter)', 'من (في توقيع رسالة)'),
  w('みんな', '', 'everyone', 'الجميع'),
  w('ですか', '', 'is it? (question)', 'هل؟ (سؤال)'),
  w('やさしい', '', 'kind, gentle', 'لطيف'),
  w('話します', 'はなします', 'talk, speak', 'يتحدث'),
  w('話しました', 'はなしました', 'talked', 'تحدّث'),
  w('勉強', 'べんきょう', 'study', 'دراسة'),
  w('かないました', '', 'came true', 'تحقّق'),
  w('つかれました', '', 'got tired', 'تعبت'),
  w('がんばります', '', "I'll do my best", 'سأبذل جهدي'),
  w('会いたい', 'あいたい', 'want to see (someone)', 'أريد أن أرى'),
  w('なつかしい', '', 'missed, dear (a memory)', 'أفتقده، عزيز'),
  w('あげました', '', 'gave', 'أعطى'),
  w('メッセージ', '', 'message', 'رسالة نصية'),
  w('送りました', 'おくりました', 'sent', 'أرسل'),
  w('覚えました', 'おぼえました', 'learned, memorised', 'حفظ، تعلّم'),
  w('働きました', 'はたらきました', 'worked', 'عمل'),
  w('飲みました', 'のみました', 'drank', 'شرب'),
  w('見ました', 'みました', 'saw, looked at', 'رأى، شاهد'),
];
