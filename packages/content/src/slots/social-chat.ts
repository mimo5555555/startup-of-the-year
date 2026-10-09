import type { SlotOption } from '../types';
import { opt } from './helpers';

/** Slot lists for phone chat. Slot names must be unique across all modules. `chat_first` reuses the `colour` slot of Hikari Denki. */
export const SOCIAL_CHAT_SLOTS: Record<string, SlotOption[]> = {
  // what the learner ate for lunch (`chat_food`); stored as the fact `favFood`
  chatfood: [
    opt('ramen', 'ラーメン', ['らーめん', 'らあめん'], ['ramen', 'ramen noodles', 'some ramen', 'a bowl of ramen'], ['رامن', 'الرامن', 'رامين']),
    opt('onigiri', 'おにぎり', ['お握り', 'おむすび'], ['onigiri', 'rice ball', 'a rice ball', 'rice balls'], ['اونيغيري', 'أونيغيري', 'كرة ارز', 'كرة أرز']),
    opt('bento', 'お弁当', ['おべんとう', 'べんとう', '弁当'], ['bento', 'a bento', 'lunch box', 'a lunch box', 'bento box'], ['بينتو', 'علبة غداء', 'وجبة بينتو']),
    opt('sandwich', 'サンドイッチ', ['さんどいっち'], ['sandwich', 'a sandwich', 'sandwiches'], ['ساندويتش', 'سندويتش', 'ساندوتش']),
    opt('curry', 'カレー', ['かれー', 'カレーライス'], ['curry', 'curry rice', 'some curry'], ['كاري', 'الكاري']),
    opt('sushi', '寿司', ['すし', 'おすし', 'お寿司'], ['sushi'], ['سوشي']),
    opt('udon', 'うどん', ['ウドン'], ['udon', 'udon noodles'], ['اودون', 'أودون']),
    opt('bread', 'パン', ['ぱん'], ['bread', 'some bread', 'toast'], ['خبز', 'الخبز']),
  ],
};
