import type { PhraseEntry } from '../types';
import { P } from './helpers';

/** Phrases for Hikari Denki (phones and electronics). English is written without contractions; ids must be unique across modules. */
export const SHOP_DENKI_PHRASES: PhraseEntry[] = [
  P('denki_want_phone', 'スマホ|が|ほしい|の|です|が。', ['i would like a smartphone', 'i want a smartphone', 'i am looking for a smartphone', 'i would like to buy a smartphone', 'i want to buy a phone', 'i would like a phone', 'i need a smartphone', 'i am looking for a phone'], ['اريد هاتفا ذكيا', 'أريد هاتفا ذكيا', 'اريد هاتفا', 'ابحث عن هاتف ذكي', 'أبحث عن هاتف ذكي', 'اريد شراء هاتف']),
  P('denki_cheaper_which', 'どちら|が|安い|です|か？', ['which one is cheaper', 'which is cheaper', 'which one is less expensive', 'which is the cheaper one'], ['ايهما ارخص', 'أيهما أرخص', 'ايهما اقل سعرا', 'أيّهما أرخص']),
  P('denki_too_dear', '少し|高い|です。', ['it is a little expensive', 'it is a bit expensive', 'it is a little pricey', 'that is a little expensive'], ['انه غال قليلا', 'إنه غالٍ قليلا', 'غال قليلا', 'غالٍ قليلًا']),
  P('denki_black', '黒|を|お願いします。', ['black please', 'the black one please', 'i would like black', 'i will take black'], ['الاسود من فضلك', 'الأسود من فضلك', 'اريد الاسود', 'أسود من فضلك']),
  P('denki_blue', '青|が|いい|です。', ['i would like blue', 'blue is good', 'blue please', 'i prefer blue'], ['اريد الازرق', 'أريد الأزرق', 'الازرق جيد', 'ازرق من فضلك']),
  P('denki_white', '白|を|お願いします。', ['white please', 'the white one please', 'i would like white', 'i will take white'], ['الابيض من فضلك', 'الأبيض من فضلك', 'اريد الابيض', 'ابيض من فضلك']),
  P('denki_case', 'スマホケース|を|ください。', ['a phone case please', 'phone case please', 'i would like a phone case', 'i will take the phone case'], ['غلاف هاتف من فضلك', 'غلاف الهاتف من فضلك', 'اريد غلاف هاتف']),
  P('denki_cd', '音楽CD|を|ください。', ['a music cd please', 'music cd please', 'i would like a music cd', 'i will take the music cd'], ['اسطوانة موسيقى من فضلك', 'أسطوانة موسيقى من فضلك', 'اريد اسطوانة موسيقى']),
];
