import type { PhraseEntry } from '../types';
import { P } from './helpers';

/**
 * Phrases for the station counter, the IC card and the directions (agent 2G). Each Japanese side is language a scenario of
 * scenarios-shops.ts accepts (`engine/test/station.test.ts` plays every one at the node it belongs to). English is written without
 * contractions; ids must be unique across modules. One phrase per option rather than a `{slot}` pattern for the camelCase slots
 * (`icService`, `stationSpot`, `chargeAmount`): the translator lower-cases a pattern before it reads the slot name.
 */
export const STATION_PHRASES: PhraseEntry[] = [
  // ---- the counter ----
  P('ic_buy_card', 'ICカード|を|ください。', ['i would like an ic card', 'i want an ic card', 'can i have an ic card', 'i would like to buy an ic card', 'i want to buy an ic card', 'i need an ic card', 'i would like to get an ic card'], ['اريد بطاقة ic', 'اريد شراء بطاقة ic', 'هل يمكنني الحصول على بطاقة ic', 'بطاقة مواصلات من فضلك', 'اريد بطاقة مواصلات']),
  P('ic_top_up', 'チャージ|を|お願いします。', ['please top up my card', 'top up please', 'i would like to top up my card', 'i want to top up my card', 'can you top up my card', 'please charge my card', 'i would like to charge my card', 'top up my ic card please', 'charge please'], ['اشحن البطاقة من فضلك', 'اريد شحن البطاقة', 'اشحن بطاقتي من فضلك', 'شحن من فضلك', 'هل يمكنك شحن البطاقة', 'اريد ان اشحن بطاقتي']),
  P('ic_refund', '払い戻し|を|お願いします。', ['a refund please', 'i would like a refund', 'i want a refund', 'i would like my money back', 'please refund my card', 'can i get a refund', 'refund please'], ['استرداد المبلغ من فضلك', 'اريد استرداد المبلغ', 'اريد استرجاع النقود', 'استرداد من فضلك', 'هل يمكنني استرداد المبلغ']),
  P('ic_load_1000', '千|円|お願いします。', ['1000 yen please', 'one thousand yen please', 'a thousand yen please', 'load 1000 yen', 'load one thousand yen', '1000 yen', 'one thousand yen'], ['الف ين من فضلك', '1000 ين من فضلك', 'اشحن الف ين', 'الف ين']),
  P('ic_load_2000', '二|千|円|お願いします。', ['2000 yen please', 'two thousand yen please', 'load 2000 yen', 'load two thousand yen', '2000 yen', 'two thousand yen'], ['الفين ين من فضلك', '2000 ين من فضلك', 'اشحن الفين ين', 'الفين ين']),
  P('ic_load_3000', '三千|円|お願いします。', ['3000 yen please', 'three thousand yen please', 'load 3000 yen', 'load three thousand yen', '3000 yen', 'three thousand yen'], ['ثلاثة الاف ين من فضلك', '3000 ين من فضلك', 'اشحن ثلاثة الاف ين', 'ثلاثة الاف ين']),
  P('ic_load_5000', '五|千|円|お願いします。', ['5000 yen please', 'five thousand yen please', 'load 5000 yen', 'load five thousand yen', '5000 yen', 'five thousand yen'], ['خمسة الاف ين من فضلك', '5000 ين من فضلك', 'اشحن خمسة الاف ين', 'خمسة الاف ين']),

  // ---- asking the way ----
  P('dir_where_exit', '出口|は|どこ|です|か？', ['where is the exit', 'where is the way out', 'how do i get to the exit', 'which way is the exit', 'where is the exit please'], ['اين المخرج', 'اين الخروج', 'كيف اصل الى المخرج', 'اين مخرج المحطة']),
  P('dir_where_toilet', 'トイレ|は|どこ|です|か？', ['where is the toilet', 'where is the restroom', 'where is the bathroom', 'where are the toilets', 'where is the washroom'], ['اين الحمام', 'اين دورة المياه', 'اين المرحاض', 'اين الحمامات']),
  P('dir_where_platform', 'ホーム|は|どこ|です|か？', ['where is the platform', 'which way is the platform', 'where do i find the platform', 'how do i get to the platform'], ['اين الرصيف', 'اين المنصة', 'كيف اصل الى الرصيف']),
  P('dir_where_gate', '改札|は|どこ|です|か？', ['where is the ticket gate', 'where is the gate', 'where are the ticket gates', 'which way is the ticket gate'], ['اين بوابة التذاكر', 'اين البوابة', 'اين بوابات التذاكر']),
  P('dir_where_machine', '券売機|は|どこ|です|か？', ['where are the ticket machines', 'where can i find the ticket machine', 'which way is the ticket machine', 'where can i find the ticket machines'], ['اين آلة التذاكر', 'اين ماكينة التذاكر', 'اين الة التذاكر']),
  P('dir_right', '右|です|ね。', ['on the right', 'it is on the right', 'to the right', 'on the right yes', 'the right', 'right'], ['على اليمين', 'يمين', 'إلى اليمين', 'على اليمين صحيح', 'اليمين']),
  P('dir_left', '左|です|ね。', ['on the left', 'it is on the left', 'to the left', 'on the left yes', 'the left', 'left'], ['على اليسار', 'يسار', 'إلى اليسار', 'على اليسار صحيح', 'اليسار']),
  P('dir_straight', 'まっすぐ|です|ね。', ['straight ahead', 'it is straight ahead', 'go straight', 'straight on', 'straight', 'straight ahead yes'], ['مباشرة للأمام', 'للأمام', 'إلى الأمام', 'مباشرة', 'امش مباشرة']),
];
