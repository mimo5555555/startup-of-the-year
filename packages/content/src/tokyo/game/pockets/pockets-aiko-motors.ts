import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/** Phrase Pocket lines for Aiko's (3D) and Nakamura Motors (3D-lite): pocket line id -> line. Each is language an intent of its scenario accepts. */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const AIKO_MOTORS_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  // Nakamura Motors: the bicycle, the drive-away price, the polite request for a lower price
  P('p_motors_1', L('自転車|が|ほしい|です|が。', 'I would like a bicycle.', 'أريد دراجة.'), true),
  P('p_motors_2', L('乗り出し価格|は|いくら|です|か？', 'How much is the drive-away price?', 'كم السعر النهائي؟'), true),
  P('p_motors_3', L('もう少し|安く|なりませんか？', 'Could you make it a little cheaper?', 'هل يمكن أن تجعله أرخص قليلًا؟')),
]);
