import type { SlotOption } from '../types';
import { opt } from './helpers';

/**
 * Slot lists for Aiko's tea house (`aiko_tea`). Slot names must be unique across all modules: the presents are the shared `giftItem` slot
 * (flower, wagashi, teaSet, tenugui), the way to pay is the shared `payMethod`; `giftFriend` (who the present is for) and `wrapColour`
 * (the ribbon; `colour` belongs to Denki and `clothesColour` to Fuku-Fuku) are new here.
 */
export const SHOP_AIKO_SLOTS: Record<string, SlotOption[]> = {
  // the six friends of the street by the name the learner knows them by, and `me` (a present for oneself)
  giftFriend: [
    opt('mio', 'ミオ', ['みお', 'ミオさん', 'みおさん', 'ミオちゃん'], ['mio', 'for mio', 'to mio', 'mio san'], ['ميو', 'لميو', 'الى ميو', 'إلى ميو']),
    opt('yuki', 'ゆき', ['ユキ', 'ゆきさん', 'ユキさん'], ['yuki', 'for yuki', 'to yuki', 'yuki san'], ['يوكي', 'ليوكي', 'الى يوكي', 'إلى يوكي']),
    opt('tanaka', '田中', ['たなか', 'タナカ', '田中さん', 'たなかさん'], ['tanaka', 'for tanaka', 'to tanaka', 'tanaka san'], ['تاناكا', 'لتاناكا', 'الى تاناكا', 'إلى تاناكا']),
    opt('sato', '佐藤', ['さとう', 'サトウ', '佐藤さん', 'さとうさん'], ['sato', 'for sato', 'to sato', 'sato san'], ['ساتو', 'لساتو', 'الى ساتو', 'إلى ساتو']),
    opt('kenji', 'けんじ', ['ケンジ', 'けんじさん', 'ケンジさん', '健二'], ['kenji', 'for kenji', 'to kenji', 'kenji san'], ['كينجي', 'لكينجي', 'الى كينجي', 'إلى كينجي']),
    opt('hanako', '花子', ['はなこ', 'ハナコ', '花子先生', 'はなこせんせい', '花子さん'], ['hanako', 'for hanako', 'to hanako', 'hanako sensei', 'for hanako sensei'], ['هاناكو', 'لهاناكو', 'للمعلمة هاناكو', 'المعلمة هاناكو']),
    opt('me', '自分', ['じぶん', 'わたし', '私', '自分用', 'じぶんよう', '自分で'], ['myself', 'for myself', 'for me', 'me', 'to myself', 'my own'], ['لنفسي', 'لي', 'لنفسى', 'نفسي', 'لي انا']),
  ],
  // the ribbon of the wrapping (wrapping is free)
  wrapColour: [
    opt('red', '赤', ['あか', 'あかい', '赤い', 'レッド'], ['red', 'a red ribbon', 'red ribbon', 'the red one'], ['احمر', 'أحمر', 'الاحمر', 'الأحمر']),
    opt('blue', '青', ['あお', 'あおい', '青い', 'ブルー'], ['blue', 'a blue ribbon', 'blue ribbon', 'the blue one'], ['ازرق', 'أزرق', 'الازرق', 'الأزرق']),
    opt('white', '白', ['しろ', 'しろい', '白い', 'ホワイト'], ['white', 'a white ribbon', 'white ribbon', 'the white one'], ['ابيض', 'أبيض', 'الابيض', 'الأبيض']),
    opt('pink', 'ピンク', ['ぴんく', 'ももいろ', '桃色'], ['pink', 'a pink ribbon', 'pink ribbon', 'the pink one'], ['وردي', 'زهري', 'الوردي', 'الزهري']),
  ],
};
