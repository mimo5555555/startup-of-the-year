import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases for Aiko's tea house (`aiko_tea`). English is written without contractions; ids must be unique across modules. */
export const SHOP_AIKO_PHRASES: PhraseEntry[] = [
  P('aiko_wagashi', '和菓子|を|ください。', ['wagashi please', 'i would like wagashi', 'i will take the wagashi', 'i would like some wagashi'], ['واغاشي من فضلك', 'اريد واغاشي', 'أريد واغاشي']),
  P('aiko_flower', 'お花|を|ください。', ['a bouquet please', 'flowers please', 'i would like a bouquet', 'i would like some flowers'], ['باقة زهور من فضلك', 'اريد باقة زهور', 'أريد زهورا']),
  P('aiko_tea_set', 'お茶セット|を|ください。', ['a tea set please', 'i would like a tea set', 'i will take the tea set'], ['طقم شاي من فضلك', 'اريد طقم شاي', 'أريد طقم شاي']),
  P('aiko_tenugui', '手ぬぐい|を|ください。', ['a tenugui please', 'i would like a tenugui', 'i would like a hand towel'], ['منشفة تينوغوي من فضلك', 'اريد منشفة تينوغوي', 'تينوغوي من فضلك']),
  P('aiko_for_mio', 'ミオ|さん|に|あげます。', ['i will give it to mio', 'it is for mio', 'i am giving it to mio'], ['سأعطيها لميو', 'هي لميو', 'انها لميو', 'إنها لميو']),
  P('aiko_for_me', '自分|に|買います。', ['i am buying it for myself', 'it is for myself', 'it is for me', 'i will buy it for myself'], ['اشتريها لنفسي', 'أشتريها لنفسي', 'هي لي', 'لنفسي']),
  P('aiko_ribbon_pink', 'ピンク|が|いい|です。', ['i would like pink', 'pink is good', 'pink please', 'i want pink'], ['اريد الوردي', 'أريد الوردي', 'الوردي من فضلك']),
  P('aiko_no_wrap', 'ラッピング|は|いりません。', ['no wrapping thank you', 'i do not need wrapping', 'no wrapping please', 'no wrapping'], ['بدون تغليف شكرا', 'بدون تغليف', 'لا احتاج تغليفا', 'لا أحتاج تغليفًا']),
  P('aiko_see_others', 'ほか|の|も|見たい|です。', ['i would like to see the others', 'i want to see the others', 'may i see the others'], ['اريد ان ارى الباقي', 'أريد أن أرى الباقي', 'اريد رؤية الباقي']),
];
