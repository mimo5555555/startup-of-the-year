import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/**
 * Phrase Pocket lines for cafe, konbini, ramen, station and park, plus station_ic and sato_directions (docs/GAME_DESIGN.md §11.1;
 * ids are the ones `meta-core.ts` / `meta-station.ts` name). Pocket line id -> line. At most 2 `key` lines per pocket; every line is
 * language one of its scenario's intents accepts (packages/engine/test/pockets-core.test.ts plays them all).
 *
 * The station_ic and sato_directions lines are 2G's proposal (pockets-station.ts) with the sentence punctuation set apart as its own
 * piece, as validatePack needs. Register these or pockets-station.ts's, never both.
 */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const CORE_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  P('p_cafe_1', L('コーヒー|を|ください|。', 'A coffee, please.', 'قهوة من فضلك.'), true),
  P('p_cafe_2', L('ホット|を|お願いします|。', 'Hot, please.', 'ساخن من فضلك.')),
  P('p_cafe_3', L('Wi-Fi|の|パスワード|を|教えてください|。', 'Could you tell me the Wi-Fi password?', 'هل يمكنك إخباري بكلمة مرور الواي فاي؟')),
  P('p_cafe_4', L('現金|で|お願いします|。', 'Cash, please.', 'نقدًا من فضلك.')),

  P('p_konbini_1', L('これ|を|ください|。', 'This one, please.', 'هذا من فضلك.'), true),
  P('p_konbini_2', L('いくら|です|か|？', 'How much is it?', 'بكم هذا؟'), true),
  P('p_konbini_3', L('袋|は|いりません|。', "I don't need a bag.", 'لا أحتاج كيسًا.')),
  P('p_konbini_4', L('カード|で|お願いします|。', 'By card, please.', 'بالبطاقة من فضلك.')),

  P('p_ramen_1', L('ラーメン|を|ください|。', 'Ramen, please.', 'رامن من فضلك.')),
  P('p_ramen_2', L('かため|で|お願いします|。', 'Firm, please.', 'صلب من فضلك.')),
  P('p_ramen_3', L('いただきます|！', "Let's eat! (before the meal)", 'بسم الله! (قبل الأكل)'), true),
  P('p_ramen_4', L('ごちそうさまでした|。', 'Thank you for the meal. (after)', 'شكرًا على الوجبة. (بعد الأكل)'), true),

  P('p_station_1', L('渋谷|へ|行きたい|です|。', 'I want to go to Shibuya.', 'أريد الذهاب إلى شيبويا.'), true),
  P('p_station_2', L('いくら|です|か|？', 'How much is it?', 'بكم هذا؟'), true),
  P('p_station_3', L('何分|かかります|か|？', 'How long does it take?', 'كم يستغرق؟')),

  P('p_park_1', L('はじめまして|。', 'Nice to meet you.', 'تشرفنا بمعرفتك.'), true),
  P('p_park_2', L('お名前|は|？', "What's your name?", 'ما اسمك؟')),
  P('p_park_3', L('音楽|が|好き|です|。', 'I like music.', 'أحب الموسيقى.')),

  P('p_station_ic_1', L('ICカード|を|ください|。', 'An IC card, please.', 'بطاقة IC من فضلك.'), true),
  P('p_station_ic_2', L('千|円|チャージ|を|お願いします|。', 'Please load 1,000 yen.', 'اشحن ألف ين من فضلك.'), true),
  P('p_station_ic_3', L('いくら|です|か|？', 'How much is it?', 'بكم هذا؟')),

  P('p_sato_directions_1', L('出口|は|どこ|です|か|？', 'Where is the exit?', 'أين المخرج؟'), true),
  P('p_sato_directions_2', L('トイレ|は|どこ|です|か|？', 'Where is the toilet?', 'أين الحمام؟')),
  P('p_sato_directions_3', L('右|です|ね|。', 'On the right, yes?', 'على اليمين، صحيح؟')),
]);
