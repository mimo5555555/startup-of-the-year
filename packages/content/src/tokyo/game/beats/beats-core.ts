import type { Beat, BeatLine } from '@lw/game';
import { RELEASE_EPILOGUE } from '../chapters';

// Story beats of the first two chapters, the standing beats the engine plays by name (welcome back, the phone, the catch-up stipend, a
// dream's second step) and the seven dream finales (docs/GAME_DESIGN.md §7.2, §7.3, §4.5, §14.9). Lines are short A1-A2 Japanese with every
// token in the lexicon (`lexicon/quests.ts`), English and Arabic. `{name}` is the player's name: the screen fills it (the katakana name
// when the player gave one). Chapters 3-8 and the heart and home beats belong to slice 4 / 5 (`beats-story.ts`, `beats-hearts.ts`...).

const L = (who: string, ja: string, en: string, ar: string): BeatLine => ({ who, line: { ja, en, ar } });
const beat = (id: string, place: string, lines: BeatLine[], more: Partial<Beat> = {}): Beat => ({ id, place, lines, ...more });

/** The one-line congratulation that closes most dream finales. */
const CONGRATS = (who: string): BeatLine => L(who, 'おめでとうございます|！', 'Congratulations!', 'مبروك!');

const B: Beat[] = [
  // Chapter 1: Hanako welcomes the player and asks how their name is written in katakana (`ask` shows the name field after the lines)
  beat(
    'b_ch1_open',
    'school',
    [
      L('hanako', 'ようこそ|、|桜町|へ|。|わたし|は|花子|です|。|先生|です|。', "Welcome to Sakura-chō. I'm Hanako. I'm your teacher.", 'أهلًا بك في ساكورا-تشو. أنا هاناكو، معلّمتك.'),
      L('hanako', 'これ|は|最初|の|お金|です|。|三千|円|です|。', "This is your first money. It's 3,000 yen.", 'هذه أول نقودك. ثلاثة آلاف ين.'),
      L('hanako', '一年後|、|日本語|で|家族|に|手紙|を|書きます|。', 'In a year, you will write a letter to your family in Japanese.', 'بعد عام ستكتب رسالة إلى أسرتك باليابانية.'),
      L('hanako', 'まず|、|あいさつ|の|レッスン|を|しましょう|。', "First, let's do a greeting lesson.", 'أولًا، لنبدأ بدرس التحيات.'),
    ],
    { ask: 'nameKana' },
  ),
  // Chapter 1 closing: the question opens the Dream picker
  beat(
    'b_ch1_close',
    'school',
    [
      L('hanako', 'よくできました|。|これから|です|ね|。', 'Well done. This is only the start.', 'أحسنت. هذه مجرد البداية.'),
      L('hanako', '{name}|さん|の|夢|は|何ですか|？', 'What is your dream, {name}?', 'ما هو حلمك يا {name}؟'),
    ],
    { ask: 'dream' },
  ),
  beat('b_ch2_open', 'konbini', [
    L('tanaka', 'あの|、|アルバイト|、|しませんか|？', 'Um, would you like a part-time job?', 'أمم، هل تودّ العمل بدوام جزئي؟'),
    L('tanaka', 'レジ|、|お願いします|。', 'Please work the register.', 'رجاءً، تولَّ الصندوق.'),
  ]),
  beat('b_ch2_close', 'konbini', [
    L('tanaka', 'おつかれさまでした|。|はい|、|今日|の|お給料|です|。', "Good work today. Here's today's pay.", 'أحسنت اليوم. تفضّل، أجرك لهذا اليوم.'),
  ]),
  // the phone is bought (ItemDef.beat of the phone) and the school's catch-up stipend (`b_phone_fund`, §4.5)
  beat('b_phone_bought', 'denki', [L('aoi', 'ありがとうございました|。|いい|電話|です|よ|。', "Thank you very much. It's a good phone.", 'شكرًا جزيلًا. هاتف جيد.')]),
  beat('b_phone_fund', 'school', [L('hanako', '学校|から|少し|だけ|。|がんばって|います|ね|。', "A little from the school. You've been working hard.", 'قليل من المدرسة. تبذل جهدًا.')]),
  // a player who comes back after a few days: no streak scolding (§11.7)
  beat('b_welcome_back', 'school', [
    L('hanako', 'おかえりなさい|。', 'Welcome back!', 'أهلًا بعودتك!'),
    L('hanako', 'また|会えて|、|うれしい|です|。', "I'm glad to see you again.", 'يسعدني أن أراك مرة أخرى.'),
    L('hanako', 'ゆっくり|、|やりましょう|。', "Let's take it slowly.", 'لنأخذ الأمر ببطء.'),
  ]),
  // the release cap (docs/RELEASE_1.md): the last released chapter closes with a short "to be continued" from Hanako, and Free Walk begins
  beat(RELEASE_EPILOGUE, 'school', [
    L('hanako', 'よくできました|。|友だち|も|スマホ|も|あります|ね|。', "Well done. You have friends, and a phone, too.", 'أحسنت. لديك أصدقاء وهاتف أيضًا.'),
    L('hanako', 'まだ|これから|です|よ|。', "It's only the beginning!", 'إنها مجرد البداية!'),
    L('hanako', 'これから|も|桜町|で|たくさん|話しましょう|。', "Let's keep talking a lot in Sakura-chō.", 'لنواصل الحديث كثيرًا في ساكورا-تشو.'),
    L('hanako', 'ゆっくり|、|やりましょう|。|またね|！', "Let's take it slowly. See you!", 'لنأخذ الأمر ببطء. إلى اللقاء!'),
  ]),
  // the second step of any dream
  beat('b_dream_step', 'school', [L('hanako', 'いい|調子|です|ね|。|もう|すこし|です|。', "You're doing well. Almost there.", 'تتقدم جيدًا. اقتربت.')]),

  // dream finales: a title (the dream's), a keepsake and a short beat with the friends involved (D20)
  beat('b_dream_phone_pal', 'konbini', [
    L('tanaka', 'すごい|！|連絡|の|たつじん|です|ね|。', "Wow! You're a real connector.", 'رائع! أنت متواصل ماهر.'),
    L('mio', 'これから|も|いっぱい|話そう|ね|！', "Let's keep chatting a lot!", 'لنواصل الحديث كثيرًا!'),
  ]),
  beat('b_dream_bike', 'park', [
    L('nakamura', 'いい|自転車|です|ね|。', "That's a good bike.", 'إنها دراجة جيدة.'),
    L('sato', 'お気をつけて|。', 'Take care out there.', 'انتبه لنفسك في الطريق.'),
  ]),
  beat('b_dream_flat', 'ono', [L('aiko', 'ここ|が|あなた|の|部屋|です|よ|。', 'This is your room.', 'هذه غرفتك.'), CONGRATS('hanako')]),
  beat('b_dream_festival', 'park', [L('mio', 'お祭り|、|楽しい|ね|！', 'The festival is so much fun!', 'المهرجان ممتع جدًا!'), CONGRATS('hanako')]),
  beat('b_dream_travel', 'station', [L('sato', '旅|の|はじまり|です|ね|。', 'This is the start of a journey.', 'هذه بداية رحلة.'), CONGRATS('hanako')]),
  beat('b_dream_fresh_start', 'ono', [
    L('hanako', '新しい|生活|、|おめでとうございます|！', 'Congratulations on your new life!', 'مبروك حياتك الجديدة!'),
    L('mio', 'あなた|の|部屋|に|行きたい|！', 'I want to come to your room!', 'أريد أن آتي إلى غرفتك!'),
  ]),
  beat('b_dream_car', 'motors', [L('nakamura', 'ドライブ|、|行きましょう|！', "Let's go for a drive!", 'لنذهب في جولة بالسيارة!'), CONGRATS('hanako')]),
];

/** Story beats for chapters 1-2, welcome back, phone bought, the catch-up stipend and the dream beats (2F): beat id -> beat. */
export const CORE_BEATS: Record<string, Beat> = Object.fromEntries(B.map((b) => [b.id, b]));
