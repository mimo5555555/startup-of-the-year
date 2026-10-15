import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/**
 * Phrase Pocket lines for hang-outs and home visits (Release 2 wave B1): pocket line id -> line. Every line is language an intent of its
 * scenario accepts (the content tests check it). A hang-out has two; a home visit has three, of which the door and the table words
 * (おじゃまします, いただきます) are the key lines.
 */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

const HOME = (who: string): Array<[string, PocketLine]> => [
  P(`p_home_${who}_1`, L('おじゃまします|。', 'Excuse me for coming in.', 'عن إذنك.'), true),
  P(`p_home_${who}_2`, L('いただきます|。', 'Itadakimasu (said before eating or drinking).', 'إيتاداكيماس (تُقال قبل الأكل أو الشرب).'), true),
  P(`p_home_${who}_3`, L('おじゃましました|。|ありがとう|ございました|。', 'Excuse me for having intruded. Thank you very much.', 'عن إذنك (أغادر). شكرًا جزيلًا.')),
];

export const FRIENDS_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  P('p_hang_mio_photo_1', L('ピース|！', 'Peace sign!', 'علامة النصر!'), true),
  P('p_hang_mio_photo_2', L('こっち|が|いい|です|。', 'This one is better.', 'هذه أفضل.')),
  P('p_hang_yuki_jam_1', L('上手|です|ね|！', 'You play well!', 'تعزفين بمهارة!'), true),
  P('p_hang_yuki_jam_2', L('もう|一|曲|お願いします|。', 'One more song, please.', 'أغنية أخرى من فضلك.')),
  P('p_hang_kenji_cook_1', L('もう|少し|塩|が|いい|です|。', 'It needs a little more salt.', 'يحتاج إلى قليل من الملح.')),
  P('p_hang_kenji_cook_2', L('ごちそうさまでした|。', 'Thank you for the meal.', 'شكرًا على الوجبة.'), true),
  P('p_hang_aiko_wagashi_1', L('きれい|です|ね|！', 'It is pretty!', 'إنها جميلة!')),
  P('p_hang_aiko_wagashi_2', L('ありがとう|ございます|。', 'Thank you very much.', 'شكرًا جزيلًا.'), true),
  ...HOME('mio'),
  ...HOME('aiko'),
  ...HOME('kenji'),
]);
