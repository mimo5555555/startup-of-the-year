import type { SlotOption } from '../types';
import { opt } from './helpers';

/** Slot lists for Hikari Denki (phones and electronics). Slot names must be unique across all modules. */
export const SHOP_DENKI_SLOTS: Record<string, SlotOption[]> = {
  // the option ids are the ones the item map of `denki_phone` names (docs/GAME_DESIGN.md §5.2, §14.9)
  denkiItem: [
    opt('used', '中古スマホ', ['ちゅうこすまほ', '中古のスマホ', 'ちゅうこ', '中古'], ['refurbished phone', 'the refurbished phone', 'used phone', 'a refurbished phone', 'a used phone', 'second-hand phone', 'refurbished smartphone', 'the used phone'], ['هاتف مجدد', 'الهاتف المجدد', 'هاتف مستعمل', 'الهاتف المستعمل']),
    opt('pro', '最新スマホ', ['さいしんすまほ', '最新のスマホ', 'さいしん', '最新'], ['latest phone', 'the latest phone', 'newest phone', 'the newest phone', 'latest smartphone', 'new phone'], ['احدث هاتف', 'أحدث هاتف', 'الهاتف الأحدث', 'هاتف جديد']),
    opt('case', 'スマホケース', ['すまほけーす', 'ケース', 'けーす'], ['phone case', 'a phone case', 'the phone case', 'case', 'a case'], ['غلاف الهاتف', 'غلاف هاتف', 'غلاف', 'جراب']),
    opt('tv', 'テレビ', ['てれび', 'tv', 'TV'], ['tv', 'the tv', 'a tv', 'television', 'a television'], ['تلفزيون', 'التلفزيون', 'تلفاز', 'التلفاز']),
  ],
  colour: [
    opt('black', '黒', ['くろ', 'くろい', '黒い', 'ブラック'], ['black', 'the black one', 'in black'], ['اسود', 'أسود', 'الاسود', 'الأسود']),
    opt('white', '白', ['しろ', 'しろい', '白い', 'ホワイト'], ['white', 'the white one', 'in white'], ['ابيض', 'أبيض', 'الابيض', 'الأبيض']),
    opt('blue', '青', ['あお', 'あおい', '青い', 'ブルー'], ['blue', 'the blue one', 'in blue'], ['ازرق', 'أزرق', 'الازرق', 'الأزرق']),
    opt('red', '赤', ['あか', 'あかい', '赤い', 'レッド'], ['red', 'the red one', 'in red'], ['احمر', 'أحمر', 'الاحمر', 'الأحمر']),
  ],
};
