import type { SlotOption } from '../types';
import { opt } from './helpers';

/**
 * Slot lists for the festival stalls (`matsuri_stalls`, Release 2 wave C2). The option ids are the menu options of the `matsuri` stalls (`game/menu.ts`).
 * The slot name is one lower-case word: the translator lower-cases a phrasebook pattern before it reads the slot name.
 */
export const MATSURI_SLOTS: Record<string, SlotOption[]> = {
  yatai: [
    opt('yakisoba', '焼きそば', ['やきそば', 'ヤキソバ', 'そば'], ['yakisoba', 'fried noodles', 'the fried noodles', 'some yakisoba', 'noodles'], ['ياكيسوبا', 'نودلز مقلية', 'المعكرونة المقلية', 'نودلز']),
    opt('takoyaki', 'たこ焼き', ['たこやき', 'タコヤキ', 'たこ'], ['takoyaki', 'octopus balls', 'the octopus balls', 'some takoyaki', 'octopus'], ['تاكوياكي', 'كرات الأخطبوط', 'أخطبوط', 'اخطبوط']),
    opt('kakigori', 'かき氷', ['かきごおり', 'かきごーり', 'カキ氷', 'こおり', '氷'], ['kakigori', 'shaved ice', 'the shaved ice', 'an ice', 'ice'], ['كاكيغوري', 'ثلج مبشور', 'الثلج المبشور', 'ثلج']),
    opt('ringoame', 'りんご飴', ['りんごあめ', 'リンゴ飴', 'りんご', 'あめ'], ['candy apple', 'a candy apple', 'the candy apple', 'toffee apple', 'apple'], ['تفاحة بالسكر', 'تفاحة', 'التفاحة', 'تفاحة مسكرة']),
  ],
};
