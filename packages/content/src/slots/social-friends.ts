import type { SlotOption } from '../types';
import { opt } from './helpers';

/**
 * Slot lists for hang-outs and home visits (Release 2 wave B1). Slot names must be unique across all modules. The hang-outs also use the
 * shared slots `wrapColour` (the colour of the wagashi, Aiko's module), and `country` and `chatfood` (Hina's questions in `home_kenji`).
 */
export const SOCIAL_FRIENDS_SLOTS: Record<string, SlotOption[]> = {
  // hang_mio_photo: three things the learner sees in the park (the same slot answers all three)
  seeThing: [
    opt('sakura', '桜', ['さくら', 'サクラ'], ['cherry blossoms', 'cherry blossom', 'the cherry blossoms', 'cherry trees', 'sakura'], ['أشجار الكرز', 'شجرة الكرز', 'زهر الكرز', 'ساكورا']),
    opt('sky', '空', ['そら'], ['the sky', 'sky', 'a blue sky'], ['السماء', 'سماء']),
    opt('flower', '花', ['はな', 'お花'], ['flowers', 'a flower', 'the flowers', 'flower'], ['الزهور', 'زهرة', 'زهور']),
    opt('cat', '猫', ['ねこ', 'ネコ'], ['a cat', 'the cat', 'cats', 'cat'], ['قطة', 'القطة', 'قط', 'قطط']),
    opt('bird', '鳥', ['とり', 'ことり'], ['a bird', 'the bird', 'birds', 'bird'], ['طائرا', 'طائر', 'طيور', 'عصفور']),
    opt('pond', '池', ['いけ'], ['a pond', 'the pond', 'pond'], ['بركة', 'البركة', 'بركة ماء']),
  ],
  // hang_yuki_jam: the genre she plays
  jamGenre: [
    opt('rock', 'ロック', ['ろっく'], ['rock', 'rock please', 'rock music'], ['الروك', 'روك', 'موسيقى الروك']),
    opt('jazz', 'ジャズ', ['じゃず'], ['jazz', 'jazz please', 'jazz music'], ['الجاز', 'جاز', 'موسيقى الجاز']),
    opt('pop', 'ポップ', ['ぽっぷ', 'ポップス'], ['pop', 'pop please', 'pop music'], ['البوب', 'بوب', 'موسيقى البوب']),
  ],
  // hang_kenji_cook: what goes into the bowl
  ingredient: [
    opt('negi', 'ねぎ', ['ネギ', '葱'], ['green onion', 'green onions', 'spring onion', 'scallion', 'negi'], ['البصل الأخضر', 'بصل أخضر', 'نيجي']),
    opt('egg', '卵', ['たまご', 'タマゴ'], ['an egg', 'egg', 'eggs', 'the egg'], ['البيض', 'بيضة', 'بيض']),
    opt('noodles', '麺', ['めん', 'ラーメン'], ['noodles', 'the noodles', 'ramen noodles'], ['النودلز', 'المعكرونة', 'نودلز']),
    opt('chashu', 'チャーシュー', ['ちゃーしゅー'], ['chashu', 'chashu pork', 'braised pork', 'pork'], ['التشاشو', 'تشاشو', 'لحم الخنزير']),
    opt('moyashi', 'もやし', ['モヤシ'], ['bean sprouts', 'sprouts'], ['براعم الفاصولياء', 'براعم']),
    opt('soup', 'スープ', ['すーぷ'], ['soup', 'broth', 'the soup', 'the broth'], ['الحساء', 'حساء', 'المرق']),
  ],
  // hang_aiko_wagashi: how many sweets, and their shape
  sweetCount: [
    opt('one', 'ひとつ', ['一つ', '1つ', 'いっこ'], ['one', 'one sweet', 'a single one'], ['واحدة', 'قطعة واحدة', 'واحد']),
    opt('two', 'ふたつ', ['二つ', '2つ', 'にこ'], ['two', 'two sweets'], ['قطعتين', 'اثنتين', 'اثنين']),
    opt('three', 'みっつ', ['三つ', '3つ', 'さんこ'], ['three', 'three sweets'], ['ثلاث قطع', 'ثلاثة', 'ثلاث']),
  ],
  wagashiShape: [
    opt('round', '丸', ['まる', 'まるい', '丸い'], ['round', 'a round one', 'circle', 'a circle'], ['دائري', 'دائرة', 'مستدير']),
    opt('square', '四角', ['しかく', 'しかくい', '四角い'], ['square', 'a square one'], ['مربع', 'مربّع']),
    opt('flower', '花', ['はな', 'お花'], ['a flower', 'flower', 'a flower shape', 'flower shaped'], ['زهرة', 'على شكل زهرة', 'شكل زهرة']),
  ],
};
