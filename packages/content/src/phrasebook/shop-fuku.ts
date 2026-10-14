import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases for Fuku-Fuku (the clothes shop). English is written without contractions; ids must be unique across modules. */
export const SHOP_FUKU_PHRASES: PhraseEntry[] = [
  P('fuku_look_tee', 'Tシャツ|を|探しています。', ['i am looking for a t-shirt', 'i am looking for a tshirt', 'i would like a t-shirt', 'i want a t-shirt', 'i am looking for a shirt'], ['ابحث عن قميص تي شيرت', 'أبحث عن قميص تي شيرت', 'ابحث عن تي شيرت', 'اريد قميص تي شيرت']),
  P('fuku_try_on', '試着|して|も|いい|です|か？', ['may i try it on', 'can i try it on', 'could i try it on', 'may i try this on', 'can i try this on'], ['هل يمكنني تجربته', 'هل استطيع تجربته', 'هل أستطيع تجربته', 'هل يمكنني تجربتها']),
  P('fuku_just_right', 'ちょうどいい|です。', ['it is just right', 'it fits well', 'it fits perfectly', 'it is a perfect fit'], ['مناسب تماما', 'مناسب تمامًا', 'يناسبني تماما', 'مقاسه مناسب']),
  P('fuku_too_big', '大きい|です。', ['it is too big', 'it is big', 'it is too large', 'it is a little big'], ['انه كبير', 'إنه كبير', 'كبير جدا', 'كبير قليلا']),
  P('fuku_too_small', '小さい|です。', ['it is too small', 'it is small', 'it is a little small', 'it is too tight'], ['انه صغير', 'إنه صغير', 'صغير جدا', 'صغير قليلا']),
  P('fuku_size_m', 'エムサイズ|を|お願いします。', ['size m please', 'm size please', 'i would like size m', 'i will take size m'], ['مقاس m من فضلك', 'مقاس M من فضلك', 'اريد مقاس m', 'المتوسط من فضلك']),
  P('fuku_size_l', 'エルサイズ|を|お願いします。', ['size l please', 'l size please', 'i would like size l', 'i will take size l'], ['مقاس l من فضلك', 'مقاس L من فضلك', 'اريد مقاس l', 'الكبير من فضلك']),
  P('fuku_plush', 'ぬいぐるみ|を|ください。', ['a plush toy please', 'plush toy please', 'i would like a plush toy', 'i will take the plush toy'], ['دمية محشوة من فضلك', 'اريد دمية محشوة', 'دمية من فضلك']),
  P('fuku_pick', 'ギターピック|を|ください。', ['a guitar pick please', 'guitar pick please', 'i would like a guitar pick', 'i will take the guitar pick'], ['ريشة غيتار من فضلك', 'اريد ريشة غيتار', 'ريشة من فضلك']),
];
