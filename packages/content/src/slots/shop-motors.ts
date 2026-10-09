import type { SlotOption } from '../types';
import { opt } from './helpers';

/** Slot lists for Nakamura Motors (bikes and cars). Slot names must be unique across all modules. */
export const SHOP_MOTORS_SLOTS: Record<string, SlotOption[]> = {
  // the option ids are the ones the item map of `motors_bike` names (docs/GAME_DESIGN.md §5.2, §14.9); the e-bike opens late (flag `ebike_locked`)
  bikeModel: [
    opt('mamachari', 'ママチャリ', ['ままちゃり', 'ちゃり', '自転車', 'じてんしゃ', '普通の自転車'], ['everyday bicycle', 'the everyday bicycle', 'mamachari', 'the mamachari', 'bicycle', 'a bicycle', 'the bicycle', 'a bike', 'the bike', 'bike', 'city bike'], ['دراجة يومية', 'الدراجة اليومية', 'ماماتشاري', 'دراجة', 'الدراجة']),
    opt('helmet', 'ヘルメット', ['へるめっと', 'ヘルメッと'], ['helmet', 'a helmet', 'the helmet', 'bicycle helmet', 'bike helmet'], ['خوذة', 'الخوذة', 'خوذة دراجة']),
    opt('ebike', '電動アシスト自転車', ['でんどうあしすとじてんしゃ', '電動自転車', 'でんどうじてんしゃ', '電動', 'でんどう', 'イーバイク'], ['power-assist bicycle', 'a power-assist bicycle', 'the power-assist bicycle', 'electric bicycle', 'an electric bicycle', 'e-bike', 'ebike', 'an e-bike', 'electric bike', 'power assist bike'], ['دراجة كهربائية مساعدة', 'الدراجة الكهربائية المساعدة', 'دراجة كهربائية', 'الدراجة الكهربائية']),
  ],
  // a bicycle is bought for something (the answer only steers Nakamura-san's recommendation, it never changes a price)
  purpose: [
    opt('school', '通学', ['つうがく', 'がっこう', '学校', 'がくせい'], ['school', 'going to school', 'to go to school', 'commuting to school', 'for school', 'commute'], ['المدرسة', 'للمدرسة', 'الذهاب إلى المدرسة', 'الذهاب للمدرسة', 'مدرسة']),
    opt('shopping', '買い物', ['かいもの', 'おかいもの'], ['shopping', 'for shopping', 'to go shopping', 'going shopping', 'groceries'], ['التسوق', 'للتسوق', 'التسوّق', 'للتسوّق', 'تسوق']),
    opt('ride', '散歩', ['さんぽ', 'さんぽ'], ['a ride', 'a walk', 'walk', 'riding around town', 'a ride around town', 'strolling', 'for a ride', 'sightseeing', 'around town'], ['التنزه', 'للتنزه', 'التنزّه', 'للتنزّه', 'نزهة', 'جولة']),
  ],
  carModel: [
    opt('used', '中古の軽自動車', ['ちゅうこのけいじどうしゃ', '中古', 'ちゅうこ', 'ちゅうこしゃ', '中古車'], ['used kei car', 'the used kei car', 'a used kei car', 'used car', 'the used car', 'second-hand kei car', 'the cheaper one'], ['سيارة كي مستعملة', 'سيارة الكي المستعملة', 'السيارة المستعملة', 'سيارة مستعملة']),
    opt('good', '低走行の軽自動車', ['ていそうこうのけいじどうしゃ', '低走行', 'ていそうこう'], ['low-mileage kei car', 'the low-mileage kei car', 'a low-mileage kei car', 'low mileage kei car', 'low-mileage car', 'the low-mileage car', 'the better one'], ['سيارة كي قليلة المسافة', 'سيارة الكي قليلة المسافة', 'السيارة قليلة المسافة', 'سيارة قليلة المسافة']),
  ],
};
