import type { ChapterDef, ChapterOpen, Objective } from '@lw/game';

// The 8 story chapters (docs/GAME_DESIGN.md §7.2, gates and rewards of §4.5). Rules this table follows:
//  - D36: a chapter's `opens` take effect when it BECOMES CURRENT, so its own objectives can use them; the reward lists yen, a title,
//    culture cards and beats only. `validatePack` (level 4) proves every objective's prerequisites are open at its chapter's start.
//  - D40: every objective that asks for "your own words" carries an `easier` alternative after three attempts, and never one at zero.
//  - ids ending `_dream` are the optional dream slot (★); the Story tab fills it from the tracked dream's step of that chapter.
//  - ids of items, scenarios, friends, culture cards and titles that later slices author are named here already; `validatePack` is
//    tolerant of them below level 3 / 5 (§14.5).
//  - amounts equal BALANCE.catchUp (asserted in quests-pack.test.ts): content never imports @lw/game at runtime.

const o = (kind: ChapterOpen['kind'], id: string): ChapterOpen => ({ kind, id });

/** The optional dream slot of a chapter: never evaluated (the engine skips `dream` objectives), shown with the tracked dream's step. */
const dreamSlot = (n: number): Objective => ({
  id: `c${n}_dream`,
  dream: true,
  pred: { k: 'flag', id: `dream_slot_c${n}` },
  text: { en: 'Your dream step', ar: 'خطوة حلمك' },
});

export const CHAPTERS: ChapterDef[] = [
  {
    n: 1,
    title: { ja: 'はじめまして', en: 'First Hello', ar: 'أول لقاء' },
    minDays: 1,
    reward: 2500,
    rewardTitle: 't_newcomer',
    rewardCulture: ['cc_irasshaimase', 'cc_bow'],
    opens: [o('place', 'konbini'), o('place', 'cafe'), o('place', 'station'), o('feature', 'prepare'), o('feature', 'culture')],
    beats: { open: 'b_ch1_open', close: 'b_ch1_close' },
    objectives: [
      {
        id: 'c1_1',
        pred: { k: 'lesson', id: 'greetings' },
        text: { en: "Finish Hanako-sensei's Greetings lesson", ar: 'أنهِ درس التحيات مع المعلّمة هاناكو' },
        hint: { en: 'Hanako-sensei is at the school. Tap her to start.', ar: 'المعلّمة هاناكو في المدرسة. اضغط عليها لتبدأ.' },
        pin: { friend: 'hanako' },
      },
      {
        id: 'c1_2',
        pred: { k: 'scenario', id: 'konbini', complete: true },
        text: { en: 'Buy something at the konbini (finish the conversation)', ar: 'اشترِ شيئًا من الكونبيني (أكمل المحادثة)' },
        hint: { en: 'Get ready first: three short lines make it easier.', ar: 'استعدّ أولًا: ثلاث جمل قصيرة تجعلها أسهل.' },
        pin: { place: 'konbini' },
      },
      {
        id: 'c1_3',
        pred: { k: 'discover', n: 4 },
        text: { en: 'Read 4 shop signs around town', ar: 'اقرأ 4 لافتات متاجر في الحيّ' },
        hint: { en: 'Walk around and tap the signs above the shops.', ar: 'تجوّل واضغط على اللافتات فوق المتاجر.' },
      },
      {
        id: 'c1_4',
        pred: { k: 'words_saved', n: 5 },
        text: { en: 'Save 5 words to your notebook (the 5 starter words do not count)', ar: 'احفظ 5 كلمات في دفترك (كلمات البداية الخمس لا تُحتسب)' },
        hint: { en: 'Tap a word in any Japanese line, then save it.', ar: 'اضغط على كلمة في أي جملة يابانية ثم احفظها.' },
      },
      {
        id: 'c1_5',
        pred: { k: 'say_new', n: 3 },
        text: { en: 'Say 3 different new words yourself in conversations', ar: 'انطق 3 كلمات جديدة مختلفة بنفسك في المحادثات' },
        hint: { en: 'Type or say a word yourself instead of tapping a suggestion.', ar: 'اكتب كلمة أو انطقها بنفسك بدل الضغط على اقتراح.' },
        easier: { pred: { k: 'say_new', n: 2 }, afterTries: 3 },
      },
    ],
  },
  {
    n: 2,
    title: { ja: 'いらっしゃいませ', en: 'Welcome!', ar: 'أهلًا بك!' },
    minDays: 2,
    reward: 2500,
    rewardCulture: ['cc_notip', 'cc_konbini', 'cc_itadakimasu'],
    opens: [
      o('shop', 'fukufuku'),
      o('shop', 'aiko'),
      o('place', 'fukufuku'),
      o('place', 'ono'),
      o('job', 'job_konbini'),
      o('interaction', 'tanaka_shift'),
      o('interaction', 'aoi_window'),
      o('interaction', 'nakamura_window'),
    ],
    beats: { open: 'b_ch2_open', close: 'b_ch2_close' },
    objectives: [
      {
        id: 'c2_1',
        pred: { k: 'scenario', id: 'cafe', minIndependent: 2 },
        text: { en: 'Order at Sakura Café with at least 2 lines of your own', ar: 'اطلب في مقهى ساكورا مع جملتين على الأقل من عندك' },
        hint: { en: 'Prepare helps: a line you say from memory counts as your own.', ar: 'الاستعداد يساعد: الجملة التي تقولها من الذاكرة تُحتسب من عندك.' },
        pin: { place: 'cafe' },
        easier: { pred: { k: 'scenario', id: 'cafe', minIndependent: 1 }, afterTries: 3 },
      },
      {
        id: 'c2_2',
        pred: { k: 'scenario', id: 'ramen', complete: true },
        text: { en: "Eat at Kenji's ramen shop and ask for the bill", ar: 'تناول الطعام عند كينجي واطلب الحساب' },
        pin: { place: 'ramen' },
      },
      {
        id: 'c2_3',
        pred: { k: 'shift', job: 'job_konbini', n: 1, minAcc: 0.6 },
        text: { en: 'Work your first konbini shift (all 5 customers)', ar: 'اعمل أول وردية في الكونبيني (الزبائن الخمسة جميعهم)' },
        hint: { en: 'Tanaka offers the job. Talk to him at the konbini.', ar: 'يعرض تاناكا العمل. تحدّث معه في الكونبيني.' },
        pin: { friend: 'tanaka' },
      },
      {
        id: 'c2_4',
        pred: { k: 'culture_said', n: 2 },
        text: { en: 'Use 2 culture-card phrases yourself (for example いただきます at the ramen shop)', ar: 'استخدم عبارتين من البطاقات الثقافية بنفسك (مثل «いただきます» عند كينجي)' },
      },
      dreamSlot(2),
    ],
  },
  {
    n: 3,
    title: { ja: 'ともだち', en: 'First Friend', ar: 'أول صديق' },
    minDays: 4,
    reward: 3000,
    rewardTitle: 't_friend',
    rewardCulture: ['cc_gift', 'cc_name', 'cc_hanami'],
    opens: [o('feature', 'friends'), o('feature', 'gift'), o('feature', 'smalltalk'), o('job', 'job_cafe'), o('interaction', 'yuki_shift')],
    beats: { open: 'b_ch3_open', close: 'b_ch3_close' },
    objectives: [
      {
        id: 'c3_1',
        pred: { k: 'scenario', id: 'park', minIndependent: 4 },
        text: { en: "Meet Mio: say your name, where you're from and your hobby (4+ lines of your own)", ar: 'قابل ميو: قل اسمك وبلدك وهوايتك (4 جمل على الأقل من عندك)' },
        pin: { friend: 'mio' },
        easier: { pred: { k: 'scenario', id: 'park', minIndependent: 2 }, afterTries: 3 },
      },
      {
        id: 'c3_2',
        pred: { k: 'hearts', friend: 'mio', atLeast: 2 },
        text: { en: 'Reach 2 hearts with Mio', ar: 'اوصل إلى قلبين مع ميو' },
        hint: { en: 'Talk to her again on another day and bring a gift.', ar: 'تحدّث معها مرة أخرى في يوم آخر وأحضر هدية.' },
        pin: { friend: 'mio' },
      },
      {
        id: 'c3_3',
        pred: { k: 'gift', n: 1 },
        text: { en: 'Give a gift to a friend (buy it first!)', ar: 'قدّم هدية لصديق (اشترِها أولًا!)' },
        hint: { en: "Aiko's tea house sells small gifts.", ar: 'بيت الشاي عند أيكو يبيع هدايا صغيرة.' },
      },
      {
        id: 'c3_4',
        pred: { k: 'hearts_count', atLeast: 2, n: 2 },
        text: { en: 'Have two 2-heart friends (Mio and one more)', ar: 'اجعل لك صديقين بقلبين (ميو وشخصًا آخر)' },
      },
      dreamSlot(3),
    ],
  },
  {
    n: 4,
    title: { ja: 'つながる', en: 'Stay Connected', ar: 'ابقَ على تواصل' },
    minDays: 7,
    reward: 4000,
    rewardTitle: 't_connected',
    rewardCulture: ['cc_tax', 'cc_vending', 'cc_points'],
    opens: [o('shop', 'denki'), o('place', 'denki'), o('interaction', 'aoi_shop')],
    beats: { open: 'b_ch4_open', close: 'b_ch4_close' },
    // the one saving goal of the story (D38): after 7 active days the school closes any gap (BALANCE.catchUp)
    catchUp: { afterActiveDays: 7, item: 'phone_used', maxYen: 12000 },
    objectives: [
      {
        id: 'c4_1',
        pred: { k: 'own', category: 'phone' },
        text: { en: 'Buy your own phone at Hikari Denki', ar: 'اشترِ هاتفك الخاص من متجر هيكاري دنكي' },
        hint: { en: 'Conversations and shifts pay yen.', ar: 'المحادثات والورديات تدرّ الين.' },
        pin: { place: 'denki' },
      },
      {
        id: 'c4_2',
        pred: { k: 'phone_chat', n: 1 },
        text: { en: 'Send your first message to a friend', ar: 'أرسل أول رسالة إلى صديق' },
      },
      {
        id: 'c4_3',
        pred: { k: 'phone_chat', n: 4, friends: 2 },
        text: { en: 'Chat 4 times with 2 different friends (one thread per friend per day)', ar: 'تحدّث 4 مرات مع صديقين مختلفين (محادثة واحدة لكل صديق يوميًا)' },
        hint: { en: 'Make sure two friends are at 2 hearts', ar: 'تأكد أن صديقين وصلا إلى قلبين' },
        pin: { friend: 'mio' },
      },
      {
        id: 'c4_4',
        pred: { k: 'words_known', n: 25 },
        text: { en: 'Know 25 words (reviewed at least once)', ar: 'تعرّف على 25 كلمة (راجعتها مرة على الأقل)' },
        hint: { en: 'Review the words in your notebook.', ar: 'راجع الكلمات في دفترك.' },
      },
      dreamSlot(4),
    ],
  },
  {
    n: 5,
    title: { ja: 'でかけよう', en: "Let's Go Out", ar: 'لنخرج' },
    minDays: 10,
    reward: 5000,
    rewardTitle: 't_traveller',
    rewardCulture: ['cc_ic', 'cc_trainmanner', 'cc_ticketmachine', 'cc_refuse'],
    opens: [
      o('shop', 'motors'),
      o('place', 'motors'),
      o('place', 'hikarigaoka'),
      o('job', 'job_station'),
      o('interaction', 'sato_shift'),
      o('interaction', 'trip_hikarigaoka'),
      o('interaction', 'nakamura_visit'),
      o('interaction', 'nakamura_bike'),
      o('interaction', 'rin_home'),
    ],
    beats: { open: 'b_ch5_open', close: 'b_ch5_close' },
    objectives: [
      {
        id: 'c5_1',
        pred: { k: 'visit', place: 'trip:hikarigaoka' },
        text: { en: 'Ride the train to Hikarigaoka and back', ar: 'اركب القطار إلى هيكاريغاؤكا وعد' },
        pin: { friend: 'sato' },
      },
      {
        id: 'c5_2',
        pred: { k: 'scenario', id: 'sato_directions', minIndependent: 3 },
        text: { en: 'Ask Sato the way in Japanese (3+ lines of your own)', ar: 'اسأل ساتو عن الطريق باليابانية (3 جمل على الأقل من عندك)' },
        pin: { friend: 'sato' },
        easier: { pred: { k: 'scenario', id: 'sato_directions', minIndependent: 2 }, afterTries: 3 },
      },
      {
        id: 'c5_3',
        pred: { k: 'shift', job: 'job_station', n: 1, minAcc: 0.6 },
        text: { en: 'Work a shift at the station help desk', ar: 'اعمل وردية في مكتب مساعدة المحطة' },
        pin: { friend: 'sato' },
      },
      {
        id: 'c5_4',
        pred: { k: 'scenario', id: 'motors_visit', complete: true },
        text: { en: "Browse Nakamura Motors and politely say you'll think about it", ar: 'تصفّح ورشة ناكامورا وقل بأدب إنك ستفكّر' },
        pin: { friend: 'nakamura' },
      },
      dreamSlot(5),
    ],
  },
  {
    n: 6,
    title: { ja: 'おじゃまします', en: 'Visiting Homes', ar: 'زيارة البيوت' },
    minDays: 14,
    reward: 6000,
    rewardTitle: 't_guest',
    rewardCulture: ['cc_shoesoff', 'cc_rent', 'cc_trash'],
    // someone must like you enough to invite you: judged when Chapter 5 completes, so Chapter 6 waits for it
    startGate: { k: 'hearts_count', atLeast: 3, n: 1 },
    opens: [
      o('place', 'home_mio'),
      o('place', 'home_aiko'),
      o('place', 'home_kenji'),
      o('interaction', 'home_mio'),
      o('interaction', 'home_kenji'),
      o('interaction', 'home_aiko'),
      o('interaction', 'aiko_viewing'),
      o('interaction', 'aiko_contract'),
    ],
    beats: { open: 'b_ch6_open', close: 'b_ch6_close' },
    objectives: [
      {
        id: 'c6_1',
        pred: { k: 'hearts_count', atLeast: 4, n: 1 },
        text: { en: "Get to 4 hearts with one friend (they'll invite you home)", ar: 'اوصل إلى 4 قلوب مع صديق (سيدعوك إلى بيته)' },
      },
      {
        id: 'c6_2',
        pred: { k: 'visit', place: 'home:*' },
        text: { en: "Visit a friend's home with good manners (shoes, 「おじゃまします」, tea)", ar: 'زر بيت صديق بأدب (الحذاء، «おじゃまします»، الشاي)' },
      },
      {
        id: 'c6_3',
        pred: { k: 'scenario', id: 'aiko_viewing', complete: true },
        text: { en: "Look at Aiko's room and ask 3 questions", ar: 'شاهد غرفة أيكو واطرح 3 أسئلة' },
        pin: { place: 'ono' },
      },
      {
        id: 'c6_4',
        pred: { k: 'shift', n: 5, minAcc: 0.6 },
        text: { en: 'Work 5 shifts in total (all customers served)', ar: 'اعمل 5 ورديات في المجموع (خدمة جميع الزبائن)' },
      },
      dreamSlot(6),
    ],
  },
  {
    n: 7,
    title: { ja: 'お祭り', reading: 'おまつり', en: 'Festival', ar: 'المهرجان' },
    minDays: 19,
    reward: 8000,
    rewardTitle: 't_resident',
    rewardCulture: ['cc_matsuri'],
    opens: [o('feature', 'festival'), o('interaction', 'nakamura_car')],
    beats: { open: 'b_ch7_open', close: 'b_ch7_close' },
    objectives: [
      {
        id: 'c7_1',
        pred: { k: 'hearts_count', atLeast: 2, n: 4 },
        text: { en: 'Have 4 friends (2 hearts or more) come to the festival', ar: 'اجعل 4 أصدقاء (قلبان فأكثر) يأتون إلى المهرجان' },
      },
      {
        id: 'c7_2',
        pred: { k: 'scenario', id: 'matsuri_stalls', minIndependent: 3 },
        text: { en: 'Buy festival food at the stalls (3+ lines of your own)', ar: 'اشترِ طعام المهرجان من البسطات (3 جمل على الأقل من عندك)' },
        easier: { pred: { k: 'scenario', id: 'matsuri_stalls', minIndependent: 2 }, afterTries: 3 },
      },
      {
        id: 'c7_3',
        pred: { k: 'scenario', id: 'matsuri_speech', minIndependent: 5 },
        text: { en: 'Give your self-introduction speech (5+ lines of your own)', ar: 'ألقِ كلمة التعريف بنفسك (5 جمل على الأقل من عندك)' },
        hint: { en: 'The speech rehearsal in Prepare has all five lines.', ar: 'بروفة الكلمة في شاشة الاستعداد فيها الجمل الخمس.' },
        easier: { pred: { k: 'scenario', id: 'matsuri_speech', minIndependent: 3 }, afterTries: 3 },
      },
      {
        id: 'c7_4',
        pred: { k: 'culture_said', n: 6 },
        text: { en: 'Use 6 culture-card phrases yourself so far', ar: 'استخدم 6 عبارات من البطاقات الثقافية بنفسك حتى الآن' },
      },
      dreamSlot(7),
    ],
  },
  {
    n: 8,
    title: { ja: '手紙', reading: 'てがみ', en: 'Letter Home', ar: 'رسالة إلى الأهل' },
    minDays: 25,
    reward: 10000,
    rewardTitle: 't_lives_in_ja',
    opens: [o('feature', 'letter')],
    beats: { open: 'b_ch8_open', close: 'b_ch8_close' },
    objectives: [
      {
        id: 'c8_1',
        pred: { k: 'flag', id: 'letter_written' },
        text: { en: 'Write your Letter Home (5 sentences; at least 3 of your own, not translated)', ar: 'اكتب رسالتك إلى الأهل (5 جمل، 3 منها على الأقل من عندك دون ترجمة)' },
      },
      {
        id: 'c8_2',
        pred: { k: 'words_known', n: 150 },
        text: { en: 'Know 150 words', ar: 'تعرّف على 150 كلمة' },
      },
      {
        id: 'c8_3',
        pred: { k: 'stars', atLeast: 2, n: 12 },
        text: { en: 'Reach ★★ in 12 different conversations', ar: 'احصل على ★★ في 12 محادثة مختلفة' },
        easier: { pred: { k: 'stars', atLeast: 2, n: 8 }, afterTries: 3 },
      },
      {
        id: 'c8_4',
        pred: { k: 'flag', id: 'dream_epilogue' },
        text: { en: 'Finish your dream, or choose a new one (the car dream opens at Free Walk, so it is never required)', ar: 'أنهِ حلمك أو اختر حلمًا جديدًا (حلم السيارة يُفتح في المشي الحر فلا يُشترط)' },
      },
    ],
  },
];

// ---------------------------------------------------------------------------------------------------------------
// The release cap (docs/RELEASE_1.md): chapters 1-4, then Free Walk
// ---------------------------------------------------------------------------------------------------------------

/** Free Walk: `chapter.n = 9`, current once the last released chapter is completed (D36). */
export const FREE_WALK = 9;
/** The last chapter this release plays; the later chapters stay authored above for the release that adds them (lift the cap by raising this). */
export const RELEASE_LAST_CHAPTER = 4;
/** Beat id of the short "to be continued" (Hanako) that closes the last released chapter and hands over to Free Walk (`beats-core.ts`). */
export const RELEASE_EPILOGUE = 'b_release_epilogue';

/**
 * The chapter in which something designed for chapter `ch` opens in this release: a chapter that is never played opens its things at
 * Free Walk (Nakamura Motors, the bike and the helmet, the car), so a closed sheet never says "Opens in Chapter 6" for a chapter
 * that does not exist. Item, shop and dream tables write the design number through this; `validatePack` rejects a gate in between.
 */
export const releasedGate = (ch: number): number => (ch > RELEASE_LAST_CHAPTER && ch < FREE_WALK ? FREE_WALK : ch);

/**
 * The chapters this release plays: 1..RELEASE_LAST_CHAPTER of the table above. The last one closes with the epilogue instead of its
 * designed closing beat (Mio's festival invitation would promise a festival that is not in this release).
 */
export const RELEASED_CHAPTERS: ChapterDef[] = CHAPTERS.filter((c) => c.n <= RELEASE_LAST_CHAPTER).map((c) =>
  c.n === RELEASE_LAST_CHAPTER ? { ...c, beats: { ...c.beats, close: RELEASE_EPILOGUE } } : c,
);
