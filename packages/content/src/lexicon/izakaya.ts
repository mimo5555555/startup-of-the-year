import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the izakaya (居酒屋「なごみ」, `izakaya_dinner`): two at a table, drinks for two, the お通し, the dishes, the toast, the
// bill together or split (割り勘). Surfaces are unique across the lexicon; ウーロン茶 乾杯 お会計 全部 かしこまりました live in other modules.

export const IZAKAYA_LEXICON: LexEntry[] = [
  w('居酒屋', 'いざかや', 'izakaya, a Japanese pub-restaurant', 'إيزاكايا، حانة ومطعم ياباني'),
  w('いらっしゃいませー', '', 'welcome! (called out across the room)', 'أهلًا بكم! (تُقال بصوت عالٍ)'),
  w('二名様', 'にめいさま', 'two people (polite)', 'شخصان (بأدب)'),
  w('お席', 'おせき', 'your seat, your table (polite)', 'مقعدكم، طاولتكم (بأدب)'),
  w('お飲み物', 'おのみもの', 'drinks (polite)', 'المشروبات (بأدب)'),
  w('二つ', 'ふたつ', 'two (things)', 'اثنان (من الأشياء)'),
  w('オレンジジュース', '', 'orange juice', 'عصير البرتقال'),
  w('生ビール', 'なまビール', 'draft beer', 'بيرة طازجة'),
  w('お酒', 'おさけ', 'alcohol; sake', 'المشروبات الكحولية؛ ساكي'),
  w('二十歳', 'はたち', 'twenty years old', 'عشرون عامًا'),
  w('ソフトドリンク', '', 'soft drink', 'مشروب غازي، مشروب بلا كحول'),
  w('お通し', 'おとおし', 'otoshi: the small starter served unasked, the table charge', 'أوتوشي: المقبّلات التي تُقدَّم دون طلب، رسم الطاولة'),
  w('お食事', 'おしょくじ', 'the meal, food (polite)', 'الطعام (بأدب)'),
  w('焼き鳥', 'やきとり', 'yakitori, grilled chicken skewers', 'ياكيتوري، أسياخ دجاج مشوي'),
  w('枝豆', 'えだまめ', 'edamame, green soybeans', 'إيدامامي، فول الصويا الأخضر'),
  w('唐揚げ', 'からあげ', 'karaage, Japanese fried chicken', 'كاراغي، دجاج مقلي ياباني'),
  w('出す', 'だす', 'to serve, to bring out', 'يقدّم'),
  w('お一人様', 'おひとりさま', 'per person; one person (polite)', 'للشخص الواحد (بأدب)'),
  w('ご一緒', 'ごいっしょ', 'together (polite): ご一緒でよろしいですか = one bill?', 'معًا (بأدب): ご一緒でよろしいですか = حساب واحد؟'),
  w('一緒', 'いっしょ', 'together', 'معًا'),
  w('割り勘', 'わりかん', 'splitting the bill evenly', 'تقسيم الحساب بالتساوي'),
];
