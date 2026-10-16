import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/**
 * Phrase Pocket lines for the player's own room (Release 2 wave B2): pocket line id -> line. Every line is language an intent of its scenario
 * accepts (the content tests check it). The viewing's lines never mention rent, so they are safe for every profile.
 */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const HOME_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  // fuku_home
  P('p_fuku_home_1', L('家具|を|探しています。', 'I am looking for furniture.', 'أبحث عن أثاث.'), true),
  P('p_fuku_home_2', L('配送|で|お願いします。', 'Delivery, please.', 'التوصيل من فضلك.')),
  P('p_fuku_home_3', L('土曜日|に|お願いします。', 'Saturday, please.', 'يوم السبت من فضلك.'), true),
  // aiko_viewing
  P('p_aiko_viewing_1', L('何畳|です|か？', 'How many tatami mats is it?', 'كم حصيرة تاتامي مساحتها؟'), true),
  P('p_aiko_viewing_2', L('日当たり|は|いい|です|か？', 'Does it get good sunlight?', 'هل الشمس جيدة هنا؟')),
  P('p_aiko_viewing_3', L('静か|です|か？', 'Is it quiet?', 'هل المكان هادئ؟')),
  // aiko_contract
  P('p_aiko_contract_1', L('ここ|に|します。', 'I will take this one.', 'سآخذ هذه.'), true),
  P('p_aiko_contract_2', L('六|万|円|です。', 'It is sixty thousand yen in total.', 'المجموع ستون ألف ين.'), true),
  P('p_aiko_contract_3', L('ありがとう|ございます。', 'Thank you very much.', 'شكرًا جزيلًا.')),
  // home_own_guest
  P('p_home_own_guest_1', L('どうぞ、|上がって|ください。', 'Please come in.', 'تفضّل بالدخول.'), true),
  P('p_home_own_guest_2', L('スリッパ|を|どうぞ。', 'Here are slippers.', 'تفضّل هذا الخفّ.')),
  P('p_home_own_guest_3', L('お茶|は|いかが|です|か？', 'Would you like some tea?', 'هل تريد بعض الشاي؟'), true),
]);
