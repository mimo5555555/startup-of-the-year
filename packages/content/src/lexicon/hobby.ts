import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for ほしぞらホビー (Hoshizora Hobby), the figure shop at the east end of the street (Daichi's shop, `hobby_figures`):
// the original figure series (ねこ忍者 cat ninjas in three colours, ロボット in two sizes, the limited きつね侍), asking for "the red one",
// comparing sizes, gift wrapping and collecting. Surfaces are unique across the lexicon; 赤い 青い 白い 大きい 小さい 人気 ラッピング かわいい
// live in other modules.

export const HOBBY_LEXICON: LexEntry[] = [
  w('ほしぞらホビー', '', 'Hoshizora Hobby (the figure shop)', 'هوشيزورا هوبي (متجر المجسّمات)'),
  w('フィギュア', '', 'a figure (collectable)', 'مجسّم (للاقتناء)'),
  w('忍者', 'にんじゃ', 'a ninja', 'نينجا'),
  w('ねこ忍者', 'ねこにんじゃ', 'Cat Ninja (a figure series)', 'القط النينجا (سلسلة مجسّمات)'),
  w('ロボット', '', 'a robot', 'روبوت'),
  w('侍', 'さむらい', 'a samurai', 'ساموراي'),
  w('きつね侍', 'きつねざむらい', 'Fox Samurai (a limited figure)', 'الثعلب الساموراي (مجسّم محدود)'),
  w('限定', 'げんてい', 'limited (edition)', 'محدود (إصدار)'),
  w('シリーズ', '', 'a series', 'سلسلة'),
  w('新作', 'しんさく', 'a new release', 'إصدار جديد'),
  w('大人気', 'だいにんき', 'very popular', 'رائج جدًا'),
  w('届きました', 'とどきました', 'arrived (was delivered)', 'وصل'),
  w('方', 'ほう', 'the one (of two, when comparing)', 'الذي (عند المقارنة)'),
  w('一つ', 'ひとつ', 'one (thing)', 'واحد (شيء)'),
  w('残り', 'のこり', 'the rest, what is left', 'المتبقي'),
  w('箱', 'はこ', 'a box', 'علبة'),
  w('種類', 'しゅるい', 'a kind, a type', 'نوع'),
  w('プレゼント用', 'プレゼントよう', 'for a present (gift-wrapped)', 'للهدية (مغلّف)'),
  w('包みます', 'つつみます', 'will wrap', 'سأغلّف'),
  w('かっこいい', '', 'cool, good-looking', 'رائع، أنيق'),
  w('集めています', 'あつめています', 'am collecting', 'أجمع (أقتني)'),
  w('飾ります', 'かざります', 'will display, will decorate with', 'سأعرض، سأزيّن بـ'),
  w('フィギュアケース', '', 'a figure display case', 'خزانة عرض المجسّمات'),
  w('集めた', 'あつめた', 'collected', 'جمعتُ'),
  w('置けます', 'おけます', 'can put (it) there', 'يمكن وضعه'),
  w('飾れます', 'かざれます', 'can display', 'يمكن عرضه'),
  w('飾る', 'かざる', 'to display, to decorate', 'يعرض، يزيّن'),
  w('棚', 'たな', 'a shelf', 'رف'),
];
