import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/** Phrase Pocket lines for Hikari Denki and Fuku-Fuku (3C): pocket line id -> line. Each is language an intent of its scenario accepts. */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const DENKI_FUKU_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  P('p_denki_1', L('スマホ|が|ほしい|の|です|が。', 'I would like a smartphone.', 'أريد هاتفًا ذكيًا.'), true),
  P('p_denki_2', L('どちら|が|安い|です|か？', 'Which one is cheaper?', 'أيّهما أرخص؟')),
  P('p_denki_3', L('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.')),
  P('p_denki_4', L('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.'), true),
  // Fuku-Fuku (fuku_clothes)
  P('p_fuku_1', L('Tシャツ|を|探しています。', 'I am looking for a T-shirt.', 'أبحث عن قميص تي شيرت.'), true),
  P('p_fuku_2', L('試着|して|も|いい|です|か？', 'May I try it on?', 'هل يمكنني تجربته؟')),
  P('p_fuku_3', L('ちょうどいい|です。', 'It is just right.', 'مناسب تمامًا.')),
  P('p_fuku_4', L('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.'), true),
]);
