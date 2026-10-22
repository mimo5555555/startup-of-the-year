import type { Beat, BeatLine } from '@lw/game';

/**
 * Story beats of the chapters beyond the first two (docs/GAME_DESIGN.md §7.2): the opening and the closing of Chapter 3 (Mio, in the park), of
 * Chapter 4 (Tanaka sends the player to the phone shop; Mio congratulates and tells of the festival), Chapter 5 (Sato at the station; the
 * closing on the Hikarigaoka platform), Chapter 6 (Mio's invitation; Aiko's two closings: `b_ch6_close_flat` once the room at Ono-sō is
 * rented, else `b_ch6_close`, picked by the game through `ChapterDef.beats.closeIf`, a beat has no condition; both end with Hanako's Letter
 * preview), Chapter 7 (the festival: Mio, Kenji and Hanako open it; Hanako closes it at night under the fireworks) and Chapter 8 (the Letter
 * Home; its closing is the real ending, then Free Walk). Every closing beat from Chapter 2 on ends by asking for the one-line diary entry
 * (`ask: 'diary'`, §7.2; the two-tap lines are `game/letter.ts`); Chapter 1's asks for the dream and Chapter 8's is the ending.
 * `b_real_try` is Hanako's "try it without chips" (Chapter 6, §7.2 "No cliff"): the app plays it and then starts `REAL_TRY` in Real mode.
 * Every token is in the lexicon (`lexicon/quests.ts`, `lexicon/trip.ts`, `lexicon/matsuri.ts`).
 */
const L = (who: string, ja: string, en: string, ar: string): BeatLine => ({ who, line: { ja, en, ar } });
const beat = (id: string, place: string, lines: BeatLine[], more: Partial<Beat> = {}): Beat => ({ id, place, lines, ...more });
/** A chapter's closing beat: it ends by asking for the one-line diary entry (2 taps or a typed sentence, §7.2). */
const closing = (id: string, place: string, lines: BeatLine[]): Beat => beat(id, place, lines, { ask: 'diary' });
/** Hanako's Letter preview at the close of Chapter 6 (§7.2 reward line "Letter preview"): the Letter Home opens with Chapter 8. */
export const LETTER_PREVIEW_LINE: BeatLine = L('hanako', 'もうすぐ|、|家族|に|手紙|を|書きます|ね|。', 'Soon you will write your letter to your family.', 'قريبًا ستكتب رسالتك إلى أسرتك.');

/**
 * What "try it without chips" runs (Chapter 6, §7.2): one shop scenario in Real mode (the chips hidden, +25% yen as usual). The café is the
 * shop the learner knows best by Chapter 6 (Chapter 2's `c2_1` already asks for lines of their own there) and Yuki hosts it. The app starts
 * it with `startConversation({ scenarioId, characterId, mode: 'real' })` after `beat` has been played (`docs`: the c1-content hand-off).
 */
export const REAL_TRY = { beat: 'b_real_try', scenarioId: 'cafe', characterId: 'yuki', fromChapter: 6 } as const;

const B: Beat[] = [
  beat('b_ch3_open', 'park', [
    L('mio', 'こんにちは|！|わたし|は|ミオ|です|。', "Hello! I'm Mio.", 'مرحبًا! أنا ميو.'),
    L('mio', '友だち|に|なりましょう|！', "Let's be friends!", 'لنصبح أصدقاء!'),
  ]),
  closing('b_ch3_close', 'park', [L('mio', 'また|明日|ね|！', 'See you tomorrow!', 'أراك غدًا!')]),
  beat('b_ch4_open', 'konbini', [
    L('tanaka', 'スマホ|が|ほしい|です|か|？', 'Do you want a phone?', 'هل تريد هاتفًا؟'),
    L('tanaka', '電話|の|お店|は|どう|です|か|？', 'How about the phone shop, Hikari Denki?', 'ما رأيك بمتجر الهواتف، هيكاري دنكي؟'),
  ]),
  // Chapter 4's closing: Mio congratulates on the phone and texts the design's 「来週、お祭りがあるよ！」 (a festival next week): the festival is Chapter 7
  closing('b_ch4_close', 'park', [
    L('mio', 'スマホ|、|いい|ね|！', 'Your phone is great!', 'هاتفك رائع!'),
    L('mio', '来週|、|お祭り|が|ある|よ|！', "There's a festival next week!", 'هناك مهرجان الأسبوع القادم!'),
    L('mio', 'また|話そう|ね|！', "Let's chat again!", 'لنتحدث مرة أخرى!'),
  ]),
  // Chapter 5: Sato at the station (§7.2). The closing is on the Hikarigaoka platform.
  beat('b_ch5_open', 'station', [
    L('sato', 'ICカード|は|便利|です|よ|。|ピッと|乗れます|。', 'An IC card is handy. You just beep and board.', 'بطاقة IC مريحة. تمرّرها وتصعد.'),
    L('sato', '光が丘|まで|行きませんか|？', "Won't you go as far as Hikarigaoka?", 'ألا تذهب حتى هيكاريغاؤكا؟'),
  ]),
  closing('b_ch5_close', 'hikarigaoka', [L('sato', 'ご乗車|ありがとうございました|。', 'Thank you for riding.', 'شكرًا لركوبك القطار.')]),
  // Chapter 6: Mio, in the park, invites the player home (the phone, if there is one, carries the same words)
  beat('b_ch6_open', 'park', [
    L('mio', 'うち|に|来ませんか|？', "Won't you come to my place?", 'ألا تأتي إلى بيتي؟'),
    L('mio', 'どうぞ|、|あがって|ください|。', 'Please, come on up.', 'تفضّل، ادخل.'),
  ]),
  // Chapter 6's two closings (Aiko, at Ono-sō): the first for a player who has rented the room (`closeIf` in chapters.ts), then Hanako's Letter preview
  closing('b_ch6_close_flat', 'ono', [L('aiko', 'ここ|が|あなた|の|家|です|よ|。', 'This is your home.', 'هذا هو بيتك.'), LETTER_PREVIEW_LINE]),
  closing('b_ch6_close', 'ono', [L('aiko', 'いつでも|お茶|を|飲みに|来て|ください|ね|。', 'Come for tea any time.', 'تعال لشرب الشاي في أي وقت.'), LETTER_PREVIEW_LINE]),
  // Chapter 7: the festival (§7.2). Mio, Kenji and Hanako open it; Hanako closes it in the park at night, under the fireworks of the dusk preset
  beat('b_ch7_open', 'park', [
    L('mio', '土曜日|に|お祭り|が|あります|。|いっしょ|に|行こう|！', "There's a festival on Saturday. Let's go together!", 'يوم السبت هناك مهرجان. لنذهب معًا!'),
    L('kenji', 'ラーメン|の|屋台|を|出します|！', "I'm opening a ramen stall!", 'سأفتح بسطة رامن!'),
    L('hanako', '皆さん|の|前|で|、|自己紹介|を|しましょう|。', "Let's do a self-introduction in front of everyone.", 'لنقدّم أنفسنا أمام الجميع.'),
  ]),
  closing('b_ch7_close', 'park', [
    L('hanako', '皆さん|、|ありがとうございました|。', 'Thank you, everyone.', 'شكرًا لكم جميعًا.'),
    L('mio', '花火|、|きれい|です|ね|！', 'The fireworks are beautiful!', 'الألعاب النارية جميلة!'),
  ]),
  // Chapter 8: the Letter Home. The closing is the real ending of the story (`RELEASE_ENDING`): Hanako reads the Letter back, then Free Walk begins
  beat('b_ch8_open', 'school', [
    L('hanako', 'お祭り|、|おつかれさまでした|。', 'Well done at the festival.', 'أحسنت في المهرجان.'),
    L('hanako', '家族|に|手紙|を|書きましょう|。', "Let's write a letter to your family.", 'لنكتب رسالة إلى أسرتك.'),
  ]),
  beat('b_ch8_close', 'school', [
    L('hanako', 'これ|が|あなた|の|日本語|です|。|すばらしい|！', 'This is your Japanese. Wonderful!', 'هذه هي يابانيتك. رائع!'),
    L('hanako', '一年|、|よく|がんばりました|ね|。', 'You worked hard for a whole year.', 'اجتهدت طوال عام كامل.'),
    L('hanako', 'これから|も|、|日本語|で|話しましょう|。', "Let's keep talking in Japanese from now on, too.", 'لنواصل الحديث باليابانية من الآن فصاعدًا أيضًا.'),
    L('hanako', 'おめでとうございます|！', 'Congratulations!', 'مبروك!'),
  ]),
  // Chapter 6, "No cliff" (§7.2): Hanako offers one shop conversation without the chips
  beat(
    'b_real_try',
    'school',
    [
      L('hanako', 'ヒント|なし|で|、|やってみましょう|。', "Let's try without hints.", 'لنجرّب دون تلميحات.'),
      L('hanako', '自分|の|言葉|で|話して|ください|。', 'Please speak in your own words.', 'تحدّث بكلماتك من فضلك.'),
      L('hanako', '大丈夫|です|よ|。|ゆっくり|で|いい|です|。', "It's all right. Slowly is fine.", 'لا بأس. يمكنك أن تتحدث ببطء.'),
    ],
    { effects: [{ t: 'flag', id: 'real_try_seen' }] },
  ),
];

/** Story beats for chapters 3-8 and the Real-mode try: beat id -> beat. */
export const STORY_BEATS: Record<string, Beat> = Object.fromEntries(B.map((b) => [b.id, b]));
