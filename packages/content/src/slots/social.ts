import type { SlotOption } from '../types';
import { opt } from './helpers';

/**
 * Slot lists for the social module. Slot names must be unique across all modules.
 * `giftFood`: the food and drink presents (cafe and konbini goods, §8.5) that a gift hand-over can name besides the shared `giftItem` list.
 */
export const SOCIAL_SLOTS: Record<string, SlotOption[]> = {
  giftFood: [
    opt('coffee', 'コーヒー', ['こーひー'], ['coffee', 'a coffee', 'a cup of coffee'], ['قهوة', 'القهوة']),
    opt('greenTea', 'お茶', ['おちゃ', '緑茶', 'りょくちゃ'], ['green tea', 'tea', 'a green tea'], ['شاي أخضر', 'شاي', 'الشاي']),
    opt('cake', 'ケーキ', ['けーき'], ['cake', 'a cake', 'a slice of cake'], ['كعكة', 'كيك', 'الكعكة']),
    opt('onigiri', 'おにぎり', ['お握り', 'おむすび'], ['onigiri', 'rice ball', 'a rice ball'], ['اونيغيري', 'أونيغيري', 'كرة ارز', 'كرة أرز']),
    opt('bento', 'お弁当', ['おべんとう', 'べんとう', '弁当'], ['bento', 'a bento', 'lunch box', 'a lunch box'], ['بينتو', 'علبة غداء']),
  ],
};
