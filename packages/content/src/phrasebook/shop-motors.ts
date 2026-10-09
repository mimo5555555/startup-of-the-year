import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases for Nakamura Motors (bikes and cars). English is written without contractions; ids must be unique across modules. */
export const SHOP_MOTORS_PHRASES: PhraseEntry[] = [
  P('motors_want_bike', '自転車|が|ほしい|です|が。', ['i would like a bicycle', 'i want a bicycle', 'i am looking for a bicycle', 'i would like to buy a bicycle', 'i want a bike', 'i would like a bike', 'i want to buy a bike', 'i need a bicycle'], ['اريد دراجة', 'أريد دراجة', 'ابحث عن دراجة', 'أبحث عن دراجة', 'اريد شراء دراجة']),
  P('motors_bike_price', '自転車|は|いくら|です|か？', ['how much is a bicycle', 'how much is the bicycle', 'how much is a bike', 'how much does a bicycle cost', 'what is the price of a bicycle'], ['بكم الدراجة', 'كم سعر الدراجة', 'كم ثمن الدراجة', 'بكم دراجة']),
  P('motors_helmet', 'ヘルメット|を|ください。', ['a helmet please', 'helmet please', 'i would like a helmet', 'i will take the helmet'], ['خوذة من فضلك', 'اريد خوذة', 'أريد خوذة']),
  P('motors_drive_away', '乗り出し価格|は|いくら|です|か？', ['how much is the drive-away price', 'how much is the drive away price', 'what is the drive-away price', 'what is the total price with fees', 'how much is the total with all the fees', 'what is the final price'], ['كم السعر النهائي', 'ما هو السعر النهائي', 'كم السعر الاجمالي مع الرسوم', 'كم السعر الإجمالي مع الرسوم']),
  P('motors_cheaper', 'もう少し|安く|なりませんか？', ['could you make it a little cheaper', 'could it be a bit cheaper', 'could you lower the price a little', 'can you make it a little cheaper', 'can you lower the price a little'], ['هل يمكن ان تجعله ارخص قليلا', 'هل يمكن أن تجعله أرخص قليلا', 'هل يمكن ان يكون ارخص قليلا', 'هل يمكن أن يكون أرخص قليلًا']),
  P('motors_see_car', '軽自動車|を|見たい|です。', ['i would like to see a kei car', 'i want to see a kei car', 'i would like to look at a kei car', 'i want to look at the cars'], ['اريد ان ارى سيارة كي', 'أريد أن أرى سيارة كي', 'اريد رؤية سيارة كي']),
  P('motors_air_freshener', '車の芳香剤|を|ください。', ['a car air freshener please', 'air freshener please', 'i would like a car air freshener', 'i will take the car air freshener'], ['معطر سيارة من فضلك', 'معطّر سيارة من فضلك', 'اريد معطر سيارة']),
];
