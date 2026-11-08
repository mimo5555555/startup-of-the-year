import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the public bath (銭湯「桜の湯」): Genzō's bandai (`sento_desk`: 大人一人, the rental towel, the bath manners かけ湯 and the
// towel out of the water, cash only) and the talk after the bath (`sento_after`: いいお湯でした, the bottle of coffee milk with a hand on the hip).
// Surfaces are unique across the lexicon; 体 手 一番 お風呂 牛乳 live in other modules.

export const SENTO_LEXICON: LexEntry[] = [
  w('銭湯', 'せんとう', 'sentō, a public bath', 'سنتو، حمّام عام'),
  w('煙突', 'えんとつ', 'chimney', 'مدخنة'),
  w('のれん', '', 'noren, the split curtain over a shop or bath door', 'نورين، الستارة المشقوقة على باب المتجر أو الحمّام'),
  w('桜の湯', 'さくらのゆ', 'Sakura-no-yu (the public bath; "cherry blossom bath")', 'ساكورا نو يو (الحمّام العام؛ "حمّام أزهار الكرز")'),
  w('大人', 'おとな', 'adult', 'شخص بالغ'),
  w('なんです', '', 'it is (that) … (explaining)', 'إنه… (للتوضيح)'),
  w('タオル', '', 'towel', 'منشفة'),
  w('貸しタオル', 'かしタオル', 'rental towel', 'منشفة مستأجرة'),
  w('借りたい', 'かりたい', 'want to borrow, want to rent', 'أريد أن أستعير، أريد أن أستأجر'),
  w('入る', 'はいる', 'to go in, to get in (the bath)', 'يدخل (الحوض)'),
  w('後', 'あと', 'after', 'بعد'),
  w('かけ湯', 'かけゆ', 'kakeyu: pouring hot water over yourself before getting into the bath', 'كاكيو: سكب الماء الساخن على الجسم قبل دخول الحوض'),
  w('それから', '', 'and then, and also', 'ثم، وأيضًا'),
  w('お湯', 'おゆ', 'hot water; the bath water', 'الماء الساخن؛ ماء الحمّام'),
  w('入れないで', 'いれないで', "please don't put (it) in", 'لا تُدخل (ه)'),
  w('気をつけます', 'きをつけます', 'I will be careful', 'سأنتبه'),
  w('かける', '', 'to pour (water) over', 'يسكب (الماء) على'),
  w('こと', '', 'thing; (it) means …ing', 'شيء؛ (يعني) أن…'),
  w('洗って', 'あらって', 'wash (and then)', 'اغسل (ثم)'),
  w('上がったら', 'あがったら', 'when you come out (of the bath)', 'عندما تخرج (من الحمّام)'),
  w('上がりました', 'あがりました', 'came out (of the bath)', 'خرجتَ (من الحمّام)'),
  w('おっ', '', 'oh! (noticing someone)', 'أوه! (عند ملاحظة شخص)'),
  w('熱かった', 'あつかった', 'was hot', 'كان ساخنًا'),
  w('はは', '', 'ha ha', 'ها ها'),
  w('四十二度', 'よんじゅうにど', 'forty-two degrees', 'اثنتان وأربعون درجة'),
  w('コーヒー牛乳', 'コーヒーぎゅうにゅう', 'coffee milk (the after-bath drink)', 'حليب بالقهوة (مشروب ما بعد الحمّام)'),
  w('フルーツ牛乳', 'フルーツぎゅうにゅう', 'fruit milk', 'حليب بالفواكه'),
  w('腰', 'こし', 'hip, lower back', 'الخصر، أسفل الظهر'),
  w('当てて', 'あてて', 'put (your hand) on', 'ضع (يدك) على'),
  w('ぐっと', '', 'in one go, with one big gulp', 'دفعة واحدة، بجرعة كبيرة'),
  w('飲んで', 'のんで', 'drink (please, and then)', 'اشرب'),
  // the bath steps (SENTO_STEPS)
  w('洗う', 'あらう', 'to wash', 'يغسل'),
  w('つかる', '', 'to soak (in hot water)', 'ينقع (في الماء الساخن)'),
  w('ふいて', '', 'wipe, dry off (and then)', 'جفّف (ثم)'),
  w('出る', 'でる', 'to go out, to get out', 'يخرج'),
];
