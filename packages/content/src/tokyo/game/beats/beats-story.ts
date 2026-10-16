import type { Beat, BeatLine } from '@lw/game';

/**
 * Story beats of the chapters this release plays beyond the first two (docs/GAME_DESIGN.md §7.2): the opening and the closing of Chapter 3
 * (Mio, in the park), the opening and closing of Chapter 4 (Tanaka sends the player to the phone shop; Mio congratulates), Chapter 5 (Sato at the station; the closing on
 * the Hikarigaoka platform) and Chapter 6 (Mio's invitation; Aiko's closing). Chapter 6 closes with the release epilogue (`beats-core.ts`)
 * for now, so `b_ch6_close` and `b_ch6_close_flat` wait for the release that plays Chapters 7-8 (which one plays depends on whether the room
 * at Ono-sō is rented: the engine picks, a beat has no condition). The beats of chapters 7-8 return with those chapters.
 * `b_real_try` is Hanako's "try it without chips" (Chapter 6, §7.2 "No cliff"): the app plays it and then starts `REAL_TRY` in Real mode.
 * Every token is in the lexicon (`lexicon/quests.ts`, `lexicon/trip.ts`).
 */
const L = (who: string, ja: string, en: string, ar: string): BeatLine => ({ who, line: { ja, en, ar } });
const beat = (id: string, place: string, lines: BeatLine[], more: Partial<Beat> = {}): Beat => ({ id, place, lines, ...more });

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
  beat('b_ch3_close', 'park', [L('mio', 'また|明日|ね|！', 'See you tomorrow!', 'أراك غدًا!')]),
  beat('b_ch4_open', 'konbini', [
    L('tanaka', 'スマホ|が|ほしい|です|か|？', 'Do you want a phone?', 'هل تريد هاتفًا؟'),
    L('tanaka', '電話|の|お店|は|どう|です|か|？', 'How about the phone shop, Hikari Denki?', 'ما رأيك بمتجر الهواتف، هيكاري دنكي؟'),
  ]),
  // Chapter 4's closing, now that the release plays on past it. The design has Mio text 「来週、お祭りがあるよ！」 (a festival next week), but
  // the festival is wave C2: until then she only congratulates on the phone, so no promise is made that the game cannot keep.
  beat('b_ch4_close', 'park', [L('mio', 'スマホ|、|いい|ね|！', 'Your phone is great!', 'هاتفك رائع!'), L('mio', 'また|話そう|ね|！', "Let's chat again!", 'لنتحدث مرة أخرى!')]),
  // Chapter 5: Sato at the station (§7.2). The closing is on the Hikarigaoka platform.
  beat('b_ch5_open', 'station', [
    L('sato', 'ICカード|は|便利|です|よ|。|ピッと|乗れます|。', 'An IC card is handy. You just beep and board.', 'بطاقة IC مريحة. تمرّرها وتصعد.'),
    L('sato', '光が丘|まで|行きませんか|？', "Won't you go as far as Hikarigaoka?", 'ألا تذهب حتى هيكاريغاؤكا؟'),
  ]),
  beat('b_ch5_close', 'hikarigaoka', [L('sato', 'ご乗車|ありがとうございました|。', 'Thank you for riding.', 'شكرًا لركوبك القطار.')]),
  // Chapter 6: Mio, in the park, invites the player home (the phone, if there is one, carries the same words)
  beat('b_ch6_open', 'park', [
    L('mio', 'うち|に|来ませんか|？', "Won't you come to my place?", 'ألا تأتي إلى بيتي؟'),
    L('mio', 'どうぞ|、|あがって|ください|。', 'Please, come on up.', 'تفضّل، ادخل.'),
  ]),
  // Chapter 6's closing, for the release that plays Chapters 7-8 (Aiko, at Ono-sō; the first for a player who has rented the room)
  beat('b_ch6_close_flat', 'ono', [L('aiko', 'ここ|が|あなた|の|家|です|よ|。', 'This is your home.', 'هذا هو بيتك.')]),
  beat('b_ch6_close', 'ono', [L('aiko', 'いつでも|お茶|を|飲みに|来て|ください|ね|。', 'Come for tea any time.', 'تعال لشرب الشاي في أي وقت.')]),
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

/** Story beats for chapters 3-6 and the Real-mode try: beat id -> beat. */
export const STORY_BEATS: Record<string, Beat> = Object.fromEntries(B.map((b) => [b.id, b]));
