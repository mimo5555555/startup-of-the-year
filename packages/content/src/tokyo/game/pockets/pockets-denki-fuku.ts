import type { PocketLine } from '@lw/game';
import { L } from '../../dsl';

/** Phrase Pocket lines for Hikari Denki and Fuku-Fuku (3C): pocket line id -> line. Each is language an intent of its scenario accepts. */
const P = (id: string, line: PocketLine['line'], key?: true): [string, PocketLine] => [id, key ? { id, line, key } : { id, line }];

export const DENKI_FUKU_POCKETS: Record<string, PocketLine> = Object.fromEntries([
  P('p_denki_1', L('スマホ|が|ほしい|の|です|が。', 'I would like a smartphone.', 'أريد هاتفًا ذكيًا.'), true),
  P('p_denki_2', L('どちら|が|安い|です|か？', 'Which one is cheaper?', 'أيّهما أرخص؟')),
  P('p_denki_3', L('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.')),
  P('p_denki_4', L('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.'), true),
  // the karaoke box (karaoke_desk, karaoke_room)
  P('p_karaoke_1', L('二人|で|一時間|お願いします。', 'Two people, one hour, please.', 'شخصان، ساعة واحدة من فضلك.'), true),
  P('p_karaoke_2', L('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.')),
  P('p_karaoke_3', L('桜通り|を|歌いたい|です。', 'I would like to sing Sakura Street.', 'أريد أن أغنّي شارع ساكورا.'), true),
  P('p_karaoke_4', L('じゃあ、|乾杯！', 'Okay, cheers!', 'حسنًا، في صحتك!'), true),
  // the game centre (arcade_crane)
  P('p_arcade_1', L('両替|お願いします。', 'Change, please.', 'صرف النقود من فضلك.'), true),
  P('p_arcade_2', L('三回|お願いします。', 'Three goes, please.', 'ثلاث محاولات من فضلك.'), true),
  P('p_arcade_3', L('すみません、|取りやすく|して|もらえますか？', 'Excuse me, could you make it easier to get?', 'عذرًا، هل يمكنك جعلها أسهل في الإمساك؟')),
  // ほしぞらホビー (hobby_figures)
  P('p_hobby_1', L('フィギュア|を|探しています。', 'I am looking for a figure.', 'أبحث عن مجسّم.'), true),
  P('p_hobby_2', L('赤い|の|を|ください。', 'The red one, please.', 'الأحمر من فضلك.'), true),
  P('p_hobby_3', L('どちら|が|人気|です|か？', 'Which one is more popular?', 'أيّهما أكثر رواجًا؟')),
  P('p_hobby_4', L('ラッピング|を|お願いします。', 'Gift wrapping, please.', 'التغليف من فضلك.')),
  // 銭湯「桜の湯」 (sento_desk, sento_after)
  P('p_sento_1', L('大人|一人|お願いします。', 'One adult, please.', 'شخص بالغ واحد من فضلك.'), true),
  P('p_sento_2', L('タオル|を|借りたい|です。', 'I would like to rent a towel.', 'أريد أن أستأجر منشفة.')),
  P('p_sento_3', L('いい|お湯|でした！', 'It was a lovely bath!', 'كان حمّامًا رائعًا!'), true),
  P('p_sento_4', L('コーヒー牛乳|を|ください。', 'A coffee milk, please.', 'حليب بالقهوة من فضلك.')),
  // Fuku-Fuku (fuku_clothes)
  P('p_fuku_1', L('Tシャツ|を|探しています。', 'I am looking for a T-shirt.', 'أبحث عن قميص تي شيرت.'), true),
  P('p_fuku_2', L('試着|して|も|いい|です|か？', 'May I try it on?', 'هل يمكنني تجربته؟')),
  P('p_fuku_3', L('ちょうどいい|です。', 'It is just right.', 'مناسب تمامًا.')),
  P('p_fuku_4', L('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.'), true),
]);
