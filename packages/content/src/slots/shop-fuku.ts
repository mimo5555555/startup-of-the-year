import type { SlotOption } from '../types';
import { opt } from './helpers';

/** Slot lists for Fuku-Fuku (the clothes shop). Slot names must be unique across all modules (`colour` belongs to the Denki module, so the clothes colour is `clothesColour`). */
export const SHOP_FUKU_SLOTS: Record<string, SlotOption[]> = {
  // the option ids are the ones the item map of `fuku_clothes` names (docs/GAME_DESIGN.md §5.2)
  clothes: [
    opt('tee', 'Tシャツ', ['てぃーしゃつ', 'ティーシャツ', 'tシャツ', 'しゃつ'], ['t-shirt', 'a t-shirt', 'the t-shirt', 'tee', 'shirt', 'a shirt', 'tshirt'], ['قميص', 'تي شيرت', 'قميص تي شيرت', 'التي شيرت']),
    opt('hoodie', 'パーカー', ['ぱーかー', 'フーディー'], ['hoodie', 'a hoodie', 'the hoodie', 'sweatshirt', 'hooded sweatshirt'], ['هودي', 'الهودي', 'سترة بقلنسوة', 'سويت شيرت']),
    opt('jeans', 'ジーンズ', ['じーんず', 'ジーパン', 'じーぱん', 'デニム'], ['jeans', 'a pair of jeans', 'the jeans', 'denim'], ['جينز', 'بنطال جينز', 'بنطلون جينز', 'الجينز']),
    opt('sneakers', 'スニーカー', ['すにーかー', '靴', 'くつ'], ['sneakers', 'a pair of sneakers', 'the sneakers', 'trainers', 'shoes', 'running shoes'], ['حذاء رياضي', 'الحذاء الرياضي', 'سنيكرز', 'حذاء']),
    opt('cap', '帽子', ['ぼうし', 'キャップ', 'きゃっぷ'], ['cap', 'a cap', 'the cap', 'baseball cap', 'a baseball cap', 'hat', 'a hat'], ['قبعة', 'القبعة', 'قبعة بيسبول', 'كاب']),
    opt('jacket', 'ダウンジャケット', ['だうんじゃけっと', 'ジャケット', 'じゃけっと', 'ダウン'], ['down jacket', 'a down jacket', 'winter jacket', 'the jacket', 'a jacket', 'winter coat', 'puffer jacket'], ['سترة منفوخة', 'سترة شتوية', 'جاكيت', 'السترة']),
    opt('glasses', 'メガネ', ['めがね', '眼鏡'], ['glasses', 'a pair of glasses', 'the glasses', 'spectacles'], ['نظارات', 'نظارة', 'النظارات', 'نظارة طبية']),
    opt('backpack', 'リュック', ['りゅっく', 'リュックサック', 'バックパック', 'かばん'], ['backpack', 'a backpack', 'the backpack', 'rucksack', 'bag'], ['حقيبة ظهر', 'الحقيبة', 'شنطة ظهر', 'حقيبة']),
    opt('suit', 'スーツ', ['すーつ', '背広', 'せびろ'], ['suit', 'a suit', 'the suit', 'business suit', 'a business suit'], ['بدلة', 'بدلة رسمية', 'البدلة', 'سوت']),
  ],
  // the sizes (a letter on its own is too short for the matcher, so the keys carry サイズ, a particle or the katakana spelling)
  size: [
    opt('s', 'エスサイズ', ['えすさいず', 'えすで', 'えすを', 'えすが', 'Sサイズ', 'Sで', 'Sを', 'Sが', 'ちいさいサイズ'], ['size s', 's size', 'small size', 'the small size', 'small', 'a small'], ['مقاس s', 'مقاس اس', 'الصغير', 'مقاس صغير', 'صغير']),
    opt('m', 'エムサイズ', ['えむさいず', 'えむで', 'えむを', 'えむが', 'Mサイズ', 'Mで', 'Mを', 'Mが', 'ふつうのサイズ'], ['size m', 'm size', 'medium size', 'the medium size', 'medium', 'a medium'], ['مقاس m', 'مقاس ام', 'المتوسط', 'مقاس متوسط', 'متوسط']),
    opt('l', 'エルサイズ', ['えるさいず', 'えるで', 'えるを', 'えるが', 'Lサイズ', 'Lで', 'Lを', 'Lが', 'おおきいサイズ'], ['size l', 'l size', 'large size', 'the large size', 'large', 'a large'], ['مقاس l', 'مقاس ال', 'الكبير', 'مقاس كبير', 'كبير']),
  ],
  clothesColour: [
    opt('black', '黒', ['くろ', 'くろい', '黒い', 'ブラック'], ['black', 'the black one', 'in black'], ['اسود', 'أسود', 'الاسود', 'الأسود']),
    opt('white', '白', ['しろ', 'しろい', '白い', 'ホワイト'], ['white', 'the white one', 'in white'], ['ابيض', 'أبيض', 'الابيض', 'الأبيض']),
    opt('red', '赤', ['あか', 'あかい', '赤い', 'レッド'], ['red', 'the red one', 'in red'], ['احمر', 'أحمر', 'الاحمر', 'الأحمر']),
    opt('blue', '青', ['あお', 'あおい', '青い', 'ブルー'], ['blue', 'the blue one', 'in blue'], ['ازرق', 'أزرق', 'الازرق', 'الأزرق']),
    opt('green', '緑', ['みどり', 'みどりいろ', 'グリーン'], ['green', 'the green one', 'in green'], ['اخضر', 'أخضر', 'الاخضر', 'الأخضر']),
    opt('yellow', '黄色', ['きいろ', '黄色い', 'きいろい', 'イエロー'], ['yellow', 'the yellow one', 'in yellow'], ['اصفر', 'أصفر', 'الاصفر', 'الأصفر']),
  ],
  // how the item fits in the fitting room
  fit: [
    opt('just', 'ちょうどいい', ['ちょうど', 'ぴったり', 'ピッタリ', 'ちょうどいいです'], ['just right', 'perfect', 'it fits', 'it fits well', 'fits well', 'good', 'fine'], ['مناسب تماما', 'مناسب', 'مقاسه مناسب', 'ممتاز', 'يناسبني']),
    opt('big', '大きい', ['おおきい', '大きすぎ', 'おおきすぎ', 'ゆるい', 'ぶかぶか'], ['too big', 'it is too big', 'big', 'it is big', 'too large', 'loose', 'a little big'], ['كبير', 'كبير جدا', 'واسع', 'كبير قليلا', 'فضفاض']),
    opt('small', '小さい', ['ちいさい', '小さすぎ', 'ちいさすぎ', 'きつい'], ['too small', 'it is too small', 'small', 'it is small', 'too tight', 'tight', 'a little small'], ['صغير', 'صغير جدا', 'ضيق', 'صغير قليلا']),
  ],
};
