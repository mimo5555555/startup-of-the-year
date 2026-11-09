import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the shopkeepers who know you (tokyo/regulars.ts): the regular's greeting (また来てくれたんですね, いつもありがとうございます),
// the question about the last purchase (前回の…、どうでしたか / 気に入っていますか / 喜んでもらえましたか) and the replies.

export const REGULARS_LEXICON: LexEntry[] = [
  w('前回', 'ぜんかい', 'last time', 'المرة الماضية'),
  w('いつも', '', 'always, every time', 'دائمًا'),
  w('くれた', '', '(you) did for me: 来てくれた = you came (to see me)', '(أنت) فعلتَ لي: 来てくれた = أتيتَ (لرؤيتي)'),
  w('くださった', '', '(you) did for me (polite): 来てくださった = you kindly came', '(أنت) تفضّلت: 来てくださった = تفضّلت بالمجيء'),
  w('んです', '', 'it is that … (explaining, or noticing something)', 'إنه… (للتوضيح أو للملاحظة)'),
  w('お会い', 'おあい', 'meeting (humble): またお会いしましたね = we meet again', 'لقاء (بتواضع): またお会いしましたね = نلتقي مجددًا'),
  w('歌い', 'うたい', 'to sing (歌いに来る = come to sing)', 'الغناء (歌いに来る = يأتي ليغنّي)'),
  w('うまかった', '', 'was tasty (casual)', 'كان لذيذًا (عامية)'),
  w('別', 'べつ', 'another, different', 'آخر، مختلف'),
  w('もの', '', 'thing', 'شيء'),
  w('気に入って', 'きにいって', 'liking (気に入っています = I like it)', 'إعجاب (気に入っています = يعجبني)'),
  w('使って', 'つかって', 'using (使っています = I am using it)', 'استخدام (使っています = أستخدمه)'),
  w('大事', 'だいじ', 'precious; 大事にする = take good care of', 'ثمين؛ 大事にする = يعتني جيدًا'),
  w('もらえました', '', 'could receive; 喜んでもらえました = they were pleased', 'استطعت أن أنال؛ 喜んでもらえました = سُرّوا به'),
  w('まあ', '', 'oh my, well (surprise, delight)', 'يا إلهي، حسنًا (دهشة، سرور)'),
  w('あれば', '', 'if there is (anything)', 'إن كان هناك (شيء)'),
  w('あったら', '', 'if (something) happens, if there is', 'إن حدث (شيء)، إن كان هناك'),
  // small talk about the season (tokyo/smalltalk.ts)
  w('暖かく', 'あたたかく', 'warm (暖かくなりました = it has got warm)', 'دافئ (暖かくなりました = صار الجو دافئًا)'),
  w('涼しく', 'すずしく', 'cool (涼しくなりました = it has got cooler)', 'منعش (涼しくなりました = صار الجو أبرد)'),
  w('なった', '', 'became (plain)', 'صار (عامية)'),
  w('見た', 'みた', 'saw, have seen (plain)', 'رأيتَ (عامية)'),
  w('雨', 'あめ', 'rain', 'مطر'),
  w('梅雨', 'つゆ', 'the rainy season (June)', 'موسم الأمطار (يونيو)'),
  w('夏', 'なつ', 'summer', 'الصيف'),
  w('冬', 'ふゆ', 'winter', 'الشتاء'),
  w('暑い', 'あつい', 'hot (weather)', 'حار (الطقس)'),
  w('苦手', 'にがて', 'not good with, not a fan of', 'لا أتحمّل، لا أحب كثيرًا'),
  w('わかります', '', 'I understand', 'أفهم'),
  w('風邪', 'かぜ', 'a cold', 'زكام'),
  w('ひかないで', '', "don't catch (a cold)", 'لا تُصب (بالزكام)'),
];
