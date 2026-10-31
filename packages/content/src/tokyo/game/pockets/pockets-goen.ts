import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/** Phrase Pocket lines of Goen stage 1 (docs/GOEN.md): the shrine's wish and the Kyoto Journey: pocket line id -> line. Every line is language an intent of its scenario accepts. */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const GOEN_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  P('p_shrine_wish_1', L('毎日|話せます|ように。', 'I hope I can speak every day.', 'أتمنى أن أتحدّث كل يوم.'), true),
  P('p_shrine_wish_2', L('京都|に|行けます|ように。', 'I hope I can go to Kyoto.', 'أتمنى أن أذهب إلى كيوتو.')),
  P('p_kyoto_ryokan_1', L('予約|が|あります。', 'I have a reservation.', 'لديّ حجز.'), true),
  P('p_kyoto_ryokan_2', L('二泊|です。', 'Two nights.', 'ليلتان.'), true),
  P('p_kyoto_ryokan_3', L('ありがとうございます。|お世話|に|なります。', 'Thank you. I am in your care.', 'شكرًا. أنا في رعايتكم.')),
  P('p_kyoto_temple_1', L('お守り|を|ください。', 'An omamori, please.', 'تميمة من فضلك.'), true),
  P('p_kyoto_temple_2', L('御朱印|を|お願いします。', 'A goshuin, please.', 'غوشوين من فضلك.'), true),
  P('p_kyoto_temple_3', L('庭|は|どこ|です|か？', 'Where is the garden?', 'أين الحديقة؟')),
  P('p_kyoto_matcha_1', L('抹茶セット|を|ください。', 'The matcha set, please.', 'طقم الماتشا من فضلك.'), true),
  P('p_kyoto_matcha_2', L('おすすめ|の|お土産|は|何|です|か？', 'What souvenir do you recommend?', 'أي هدية تذكارية تنصحين بها؟'), true),
  P('p_kyoto_matcha_3', L('とても|おいしい|です！', 'It is very good!', 'إنه لذيذ جدًا!')),
]);
