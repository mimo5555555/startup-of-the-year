import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for the karaoke box (カラオケ「うたひろば」): Nanami's desk (`karaoke_desk`: 何名様, 二人, 一時間 / 二時間, paying first) and
// the room with a friend (`karaoke_room`: choosing a song, the drinks, 乾杯, singing the chorus of the town's own song 「桜通り」, praise).
// Surfaces are unique across the lexicon; 桜 明日 楽しい 楽しかった 上手 声 一緒に live in other modules.

export const KARAOKE_LEXICON: LexEntry[] = [
  w('カラオケ', '', 'karaoke', 'كاريوكي'),
  w('うたひろば', '', 'Uta Hiroba (the karaoke box; "song square")', 'أوتا هيروبا (صالة الكاريوكي؛ "ساحة الأغاني")'),
  w('何名様', 'なんめいさま', 'how many people (polite)', 'كم شخصًا (بأدب)'),
  w('二人', 'ふたり', 'two people', 'شخصان'),
  w('一時間', 'いちじかん', 'one hour', 'ساعة واحدة'),
  w('二時間', 'にじかん', 'two hours', 'ساعتان'),
  w('お時間', 'おじかん', 'the time (polite)', 'الوقت (بأدب)'),
  w('番', 'ばん', 'number (room number three: 三番)', 'رقم (الغرفة رقم ثلاثة: 三番)'),
  w('先に', 'さきに', 'first, in advance', 'أولًا، مسبقًا'),
  w('どうしますか', '', 'what will you do? how would you like it?', 'ماذا ستفعل؟ كيف تريده؟'),
  w('歌いたい', 'うたいたい', 'want to sing', 'أريد أن أغنّي'),
  w('歌おう', 'うたおう', "let's sing", 'لنغنِّ'),
  w('歌う', 'うたう', 'to sing', 'يغنّي'),
  w('来よう', 'こよう', "let's come (again)", 'لنأتِ (مجددًا)'),
  w('来ましょう', 'きましょう', "let's come (again, polite)", 'لنأتِ (مجددًا، بأدب)'),
  w('乾杯', 'かんぱい', 'cheers! (a toast)', 'في صحتك! (نخب)'),
  w('ウーロン茶', 'ウーロンちゃ', 'oolong tea', 'شاي أولونغ'),
  w('コーラ', '', 'cola', 'كولا'),
  w('メロンソーダ', '', 'melon soda', 'صودا البطيخ'),
  w('飲み物', 'のみもの', 'a drink', 'مشروب'),
  w('頼もう', 'たのもう', "let's order", 'لنطلب'),
  w('サビ', '', 'the chorus (of a song)', 'اللازمة (مقطع الأغنية المتكرر)'),
  w('桜通り', 'さくらどおり', 'Sakura Street (the town\'s song)', 'شارع ساكورا (أغنية البلدة)'),
  w('会おう', 'あおう', "let's meet", 'لنلتقِ'),
  w('風', 'かぜ', 'wind', 'ريح'),
  w('吹いている', 'ふいている', 'is blowing', 'تهبّ'),
  w('笑おう', 'わらおう', "let's laugh", 'لنضحك'),
  w('いくよ', '', "here we go!", 'هيا بنا!'),
  w('しよう', '', "let's do (it)", 'لنفعل (ذلك)'),
  w('あっという間', 'あっというま', 'in a flash, before you know it', 'في لمح البصر'),
  w('いきます', '', 'here we go (polite), will go', 'هيا بنا (بأدب)، سأذهب'),
  w('そちら', '', 'you, your side (polite)', 'أنت، جهتك (بأدب)'),
  w('だった', '', 'was (plain)', 'كان (عادي)'),
  w('歌いましょう', 'うたいましょう', "let's sing (polite)", 'لنغنِّ (بأدب)'),
  w('頼みましょう', 'たのみましょう', "let's order (polite)", 'لنطلب (بأدب)'),
];
