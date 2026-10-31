import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the Kyoto Journey (Goen stage 1, docs/GOEN.md): the ryokan's keigo (Fujiwara-san), the temple counter (Ishida-san) and the
// matcha café (Mori-san). Keep surfaces unique across the whole lexicon (the content tests report clashes); 京都, 新幹線 (if any), お土産, 庭,
// 七時, 現金 and ICカード live in other modules.

export const KYOTO_LEXICON: LexEntry[] = [
  // ---- the ryokan (kyoto_ryokan) ----
  w('くださいました', '', 'kindly did (honorific)', 'تفضّلتم بـ (احترام)'),
  w('予約', 'よやく', 'a reservation', 'حجز'),
  w('ご予約', 'ごよやく', 'your reservation (polite)', 'حجزكم (بأدب)'),
  w('した', '', 'did, made', 'قمتُ بـ'),
  w('お願いいたします', 'おねがいいたします', 'please (very polite)', 'من فضلك (بأدب شديد)'),
  w('様', 'さま', 'Mr. / Ms. (very polite)', 'السيد / السيدة (بأدب شديد)'),
  w('お待ちして', 'おまちして', 'waiting (humble)', 'ننتظر (بتواضع)'),
  w('おりました', '', 'have been (humble)', 'كنّا (بتواضع)'),
  w('何泊', 'なんぱく', 'how many nights', 'كم ليلة'),
  w('ご予定', 'ごよてい', 'your plan (polite)', 'خطتكم (بأدب)'),
  w('一泊', 'いっぱく', 'one night (a stay)', 'ليلة واحدة (إقامة)'),
  w('二泊', 'にはく', 'two nights', 'ليلتان'),
  w('三泊', 'さんぱく', 'three nights', 'ثلاث ليالٍ'),
  w('ご夕食', 'ごゆうしょく', 'dinner (polite)', 'العشاء (بأدب)'),
  w('六時', 'ろくじ', "six o'clock", 'الساعة السادسة'),
  w('十一時', 'じゅういちじ', "eleven o'clock", 'الساعة الحادية عشرة'),
  w('一階', 'いっかい', 'the first (ground) floor', 'الطابق الأول (الأرضي)'),
  w('二階', 'にかい', 'the second floor', 'الطابق الثاني'),
  w('お過ごし', 'おすごし', 'spending your time (honorific)', 'قضاء وقتك (احترام)'),
  w('お世話', 'おせわ', 'care, looking after (お世話になります: I am in your care)', 'رعاية (お世話になります: أنا في رعايتكم)'),
  w('お風呂', 'おふろ', 'the bath', 'الحمّام (حوض الاستحمام)'),
  w('ご案内', 'ごあんない', 'showing the way (polite)', 'الإرشاد (بأدب)'),
  w('いたします', '', 'do (humble)', 'أقوم بـ (بتواضع)'),
  // ---- the temple (kyoto_temple) ----
  w('お参り', 'おまいり', 'a visit to a temple or shrine', 'زيارة معبد'),
  w('お寺', 'おてら', 'a Buddhist temple', 'معبد بوذي'),
  w('本堂', 'ほんどう', 'the main hall (of a temple)', 'القاعة الرئيسية (في المعبد)'),
  w('裏', 'うら', 'behind, the back', 'خلف، الجهة الخلفية'),
  w('ぜひ', '', 'by all means, please do', 'بكل تأكيد، تفضّل'),
  w('ご覧', 'ごらん', 'looking (honorific; ご覧ください: please look)', 'النظر (احترام؛ ご覧ください: تفضّل بالنظر)'),
  w('健康', 'けんこう', 'health', 'الصحة'),
  w('学業', 'がくぎょう', 'studies', 'الدراسة'),
  w('交通安全', 'こうつうあんぜん', 'traffic safety, safe travel', 'السلامة المرورية، السلامة في الطريق'),
  w('なさいます', '', 'do (honorific)', 'تفعلون (احترام)'),
  w('御朱印', 'ごしゅいん', "goshuin (a temple's brush-written stamp)", 'غوشوين (ختم المعبد المكتوب بالفرشاة)'),
  w('しるし', '', 'a mark, a sign', 'علامة'),
  w('筆', 'ふで', 'a writing brush', 'فرشاة كتابة'),
  w('申し訳ございません', 'もうしわけございません', 'I am very sorry (very polite)', 'أعتذر بشدة (بأدب شديد)'),
  w('すぐ', '', 'right away', 'حالًا'),
  w('お書き', 'おかき', 'writing (humble; お書きします: I will write it)', 'الكتابة (بتواضع؛ お書きします: سأكتبه)'),
  w('よい', '', 'good', 'جيد'),
  // ---- the matcha café (kyoto_matcha) ----
  w('お決まり', 'おきまり', 'decided (polite)', 'تم الاختيار (بأدب)'),
  w('抹茶', 'まっちゃ', 'matcha (powdered green tea)', 'ماتشا (شاي أخضر مطحون)'),
  w('抹茶セット', 'まっちゃセット', 'a matcha set (with a sweet)', 'طقم ماتشا (مع حلوى)'),
  w('セット', '', 'a set', 'طقم'),
  w('八ツ橋', 'やつはし', 'yatsuhashi (a Kyoto cinnamon sweet)', 'ياتسوهاشي (حلوى كيوتو بالقرفة)'),
  w('友達', 'ともだち', 'a friend', 'صديق'),
  w('お友達', 'おともだち', 'a friend (polite)', 'صديق (بأدب)'),
];
