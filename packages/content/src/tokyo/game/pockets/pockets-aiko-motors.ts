import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/** Phrase Pocket lines for Aiko's (3D) and Nakamura Motors (3D-lite): pocket line id -> line. Each is language an intent of its scenario accepts. */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const AIKO_MOTORS_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  // Aiko's tea house (aiko_tea): a present, who it is for, the ribbon
  P('p_aiko_1', L('プレゼント|を|探しています。', 'I am looking for a present.', 'أبحث عن هدية.'), true),
  P('p_aiko_2', L('ミオ|さん|に|あげます。', 'I will give it to Mio.', 'سأعطيها لميو.')),
  P('p_aiko_3', L('赤|を|お願いします。', 'Red, please.', 'الأحمر من فضلك.')),
  // Nakamura Motors: the bicycle, the drive-away price, the polite request for a lower price
  P('p_motors_1', L('自転車|が|ほしい|です|が。', 'I would like a bicycle.', 'أريد دراجة.'), true),
  P('p_motors_2', L('乗り出し価格|は|いくら|です|か？', 'How much is the drive-away price?', 'كم السعر النهائي؟'), true),
  P('p_motors_3', L('もう少し|安く|なりませんか？', 'Could you make it a little cheaper?', 'هل يمكن أن تجعله أرخص قليلًا؟')),
]);
