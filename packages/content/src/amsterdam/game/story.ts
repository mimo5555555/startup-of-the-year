// Amsterdam's story, Chapters 1-3 (Dutch step 2): arriving on the canal, getting to know the neighbourhood, and a Saturday at the market
// and the cheese shop; the beats (Dutch lines, every word in the Dutch dictionary), two dreams, titles, culture cards, daily goals, tags.
import type { Beat, BeatLine, ChapterDef, ChapterOpen, CultureCard, DailyTemplate, DreamDef, DreamStep, TitleDef } from '@lw/game';

const o = (kind: ChapterOpen['kind'], id: string): ChapterOpen => ({ kind, id });
/** the closing of the last chapter (6): the end of the story, then Free Walk */
export const NL_EPILOGUE = 'b_nc6_close';

const obj = (id: string, pred: ChapterDef['objectives'][number]['pred'], en: string, ar: string, more: Partial<ChapterDef['objectives'][number]> = {}) => ({ id, pred, text: { en, ar }, ...more });

export const NL_CHAPTERS: ChapterDef[] = [
  {
    n: 1,
    title: { ja: 'Welkom in Amsterdam', en: 'Welcome to Amsterdam', ar: 'أهلًا بك في أمستردام' },
    minDays: 1,
    reward: 3000,
    rewardTitle: 't_nieuw_in_amsterdam',
    rewardCulture: ['cc_gezellig'],
    opens: [o('place', 'ams_boot'), o('place', 'ams_cafe'), o('shop', 'cafe'), o('feature', 'prepare'), o('feature', 'culture')],
    beats: { open: 'b_nc1_open', close: 'b_nc1_close' },
    objectives: [
      obj('nc1_1', { k: 'scenario', id: 'ams_sanne', complete: true }, 'Meet Sanne, your neighbour on the houseboat', 'تعرّف على سانه، جارتك في البيت العائم', { pin: { friend: 'sanne' } }),
      obj('nc1_2', { k: 'scenario', id: 'ams_cafe', complete: true }, 'Order a coffee at Café De Gracht', 'اطلب قهوة في مقهى «دي خراخت»', { pin: { place: 'ams_cafe' } }),
      obj('nc1_3', { k: 'words_saved', n: 5 }, 'Save 5 words to your notebook', 'احفظ 5 كلمات في دفترك', { hint: { en: 'Tap a word in any Dutch line, then save it.', ar: 'اضغط على كلمة في أي جملة هولندية ثم احفظها.' } }),
      obj('nc1_4', { k: 'say_new', n: 3 }, 'Say 3 different new words yourself in conversations', 'انطق 3 كلمات جديدة مختلفة بنفسك في المحادثات', { easier: { pred: { k: 'say_new', n: 2 }, afterTries: 3 } }),
    ],
  },
  {
    n: 2,
    title: { ja: 'Mijn buurt', en: 'My neighbourhood', ar: 'حيّي' },
    minDays: 2,
    reward: 3000,
    rewardTitle: 't_buurtgenoot',
    rewardCulture: ['cc_patatje'],
    opens: [o('shop', 'snackbar'), o('shop', 'gvb'), o('place', 'ams_snackbar'), o('place', 'ams_gvb'), o('place', 'ams_straat'), o('feature', 'friends')],
    beats: { open: 'b_nc2_open', close: 'b_nc2_close' },
    objectives: [
      obj('nc2_1', { k: 'scenario', id: 'ams_daan', complete: true }, 'Meet Daan, your neighbour down the street', 'تعرّف على دان، جارك في الشارع', { pin: { friend: 'daan' } }),
      obj('nc2_2', { k: 'scenario', id: 'ams_snackbar', complete: true }, 'Order a snack at the snack bar', 'اطلب وجبة خفيفة في محل الوجبات السريعة', { pin: { place: 'ams_snackbar' } }),
      obj('nc2_3', { k: 'scenario', id: 'ams_gvb', complete: true }, 'Buy a tram ticket at the GVB desk', 'اشترِ تذكرة ترام من مكتب «خي في بي»', { pin: { place: 'ams_gvb' } }),
      obj('nc2_4', { k: 'purchases', n: 4 }, 'Buy 4 things by talking in Dutch', 'اشترِ 4 أشياء بالحديث بالهولندية'),
    ],
  },
  {
    n: 3,
    title: { ja: 'Markt en kaas', en: 'Market and cheese', ar: 'السوق والجبن' },
    minDays: 3,
    reward: 4000,
    rewardTitle: 't_kaaskenner',
    rewardCulture: ['cc_proeven'],
    opens: [o('shop', 'kaas'), o('shop', 'markt'), o('place', 'ams_kaas'), o('place', 'ams_markt'), o('place', 'ams_taalcafe'), o('feature', 'gift'), o('interaction', 'sanne_gift'), o('interaction', 'daan_gift'), o('interaction', 'noor_gift')],
    beats: { open: 'b_nc3_open', close: 'b_nc3_close' },
    objectives: [
      obj('nc3_1', { k: 'scenario', id: 'ams_noor', complete: true }, 'Meet Noor at the language café', 'قابل نور في مقهى اللغات', { pin: { friend: 'noor' } }),
      obj('nc3_2', { k: 'scenario', id: 'ams_kaas', steps: ['taste'] }, 'Taste the cheese before you buy', 'تذوّق الجبن قبل أن تشتري', { pin: { place: 'ams_kaas' } }),
      obj('nc3_3', { k: 'scenario', id: 'ams_markt', complete: true }, 'Buy stroopwafels at the market', 'اشترِ «ستروبفافل» من السوق', { pin: { place: 'ams_markt' } }),
      obj('nc3_4', { k: 'culture', n: 5 }, 'Collect 5 Amsterdam culture cards', 'اجمع 5 بطاقات ثقافية عن أمستردام'),
    ],
  },
  {
    n: 4,
    title: { ja: 'Goede vrienden', en: 'Good friends', ar: 'أصدقاء طيّبون' },
    minDays: 4,
    reward: 4000,
    rewardTitle: 't_goede_vriend',
    opens: [o('shop', 'drogist'), o('place', 'ams_drogist'), o('interaction', 'mirjam_shop'), o('interaction', 'sanne_hang'), o('interaction', 'daan_hang'), o('interaction', 'noor_hang')],
    beats: { open: 'b_nc4_open', close: 'b_nc4_close' },
    objectives: [
      obj('nc4_1', { k: 'all', of: [{ k: 'scenario', id: 'smalltalk_sanne', complete: true }, { k: 'scenario', id: 'smalltalk_daan', complete: true }, { k: 'scenario', id: 'smalltalk_noor', complete: true }] }, 'Have a chat with Sanne, Daan and Noor', 'دردش مع سانه ودان ونور', {
        hint: { en: 'Talk to a friend: say hello, answer their question, react. One chat a day each counts.', ar: 'تحدّث مع صديق: قل مرحبًا وأجب عن سؤاله وعلّق. تُحتسب دردشة واحدة يوميًا مع كل منهم.' },
        pin: { friend: 'daan' },
      }),
      obj('nc4_2', { k: 'gift', n: 1 }, 'Give a friend a present', 'قدّم هدية لصديق', {
        hint: { en: 'Buy something they like (apple pie for Sanne?), then: Ik heb … voor je!', ar: 'اشترِ شيئًا يحبه (فطيرة تفاح لسانه؟) ثم قل: Ik heb … voor je!' },
        pin: { friend: 'sanne' },
      }),
      obj('nc4_3', { k: 'scenario', id: 'ams_drogist', complete: true }, 'Get something for your cold at the drogist', 'اشترِ شيئًا لنزلة البرد من «الدروخيست»', {
        hint: { en: 'Say what hurts: Ik heb keelpijn.', ar: 'قل ما يؤلمك: Ik heb keelpijn.' },
        pin: { place: 'ams_drogist' },
      }),
      obj('nc4_4', { k: 'hearts_count', atLeast: 3, n: 1 }, 'Become close friends with someone (3 hearts)', 'كوّن صداقة قريبة مع أحدهم (3 قلوب)', {
        hint: { en: 'Chat with the same friend on different days, and give a present they like.', ar: 'دردش مع الصديق نفسه في أيام مختلفة، وقدّم هدية يحبها.' },
      }),
    ],
  },
  {
    n: 5,
    title: { ja: 'Uitgaan', en: 'Going out', ar: 'الخروج' },
    minDays: 5,
    reward: 5000,
    rewardTitle: 't_nachtuil',
    opens: [o('shop', 'bruincafe'), o('place', 'ams_kroeg'), o('interaction', 'joop_bar')],
    beats: { open: 'b_nc5_open', close: 'b_nc5_close' },
    objectives: [
      obj('nc5_1', { k: 'hangout', n: 1 }, 'Hang out with a friend', 'اقضِ وقتًا مع صديق', {
        hint: { en: 'A friend at 3 hearts has time: pancakes with Sanne, a bike ride with Daan, a birthday with Noor.', ar: 'الصديق ذو القلوب الثلاثة لديه وقت: فطائر مع سانه، أو جولة بالدرّاجة مع دان، أو عيد ميلاد مع نور.' },
      }),
      obj('nc5_2', { k: 'scenario', id: 'ams_kroeg', complete: true }, 'An evening at the brown café: order, say Proost, pay', 'أمسية في المقهى البنّي: اطلب، قل «Proost»، ادفع', {
        hint: { en: '’t Hoekje takes cards only. Mag ik afrekenen?', ar: '«تهوكيه» يقبل البطاقة فقط. Mag ik afrekenen?' },
        pin: { place: 'ams_kroeg' },
      }),
      obj('nc5_3', { k: 'culture_said', n: 3 }, 'Say 3 Amsterdam phrases from your culture cards', 'قل 3 عبارات أمستردامية من بطاقاتك الثقافية'),
      obj('nc5_4', { k: 'stars', atLeast: 2, n: 6 }, 'Get 2 stars in 6 different conversations', 'احصل على نجمتين في 6 محادثات مختلفة'),
    ],
  },
  {
    n: 6,
    title: { ja: 'Thuis in Amsterdam', en: 'At home in Amsterdam', ar: 'في بيتي في أمستردام' },
    minDays: 6,
    reward: 6000,
    rewardTitle: 't_amsterdammer',
    opens: [o('place', 'ams_gemeente'), o('interaction', 'ilse_desk')],
    beats: { open: 'b_nc6_open', close: NL_EPILOGUE },
    objectives: [
      obj('nc6_1', { k: 'scenario', id: 'ams_gemeente', complete: true }, 'Register at the gemeente for your BSN', 'سجّل في البلدية لتحصل على رقم الخدمة المدنية', {
        hint: { en: 'Ilse wants your passport and your new address: Ik wil me inschrijven.', ar: 'إلسه تريد جواز سفرك وعنوانك الجديد: Ik wil me inschrijven.' },
        pin: { place: 'ams_gemeente' },
      }),
      obj('nc6_2', { k: 'hearts_count', atLeast: 4, n: 1 }, 'Become best friends with someone (4 hearts)', 'كوّن صداقة متينة مع أحدهم (4 قلوب)'),
      obj('nc6_3', { k: 'hangout', n: 3 }, 'Hang out 3 times with your friends', 'اقضِ وقتًا مع أصدقائك 3 مرات'),
      obj('nc6_4', { k: 'words_known', n: 40 }, 'Know 40 words (reviewed at least once)', 'تعرّف على 40 كلمة (راجعتها مرة على الأقل)', {
        hint: { en: 'Review the words in your notebook.', ar: 'راجع الكلمات في دفترك.' },
      }),
    ],
  },
];

const B = (who: string, ja: string, en: string, ar: string): BeatLine => ({ who, line: { ja, en, ar } });
const beat = (id: string, place: string, lines: BeatLine[], more: Partial<Beat> = {}): Beat => ({ id, place, lines, ...more });

const BEATS: Beat[] = [
  beat('b_nc1_open', 'ams_cafe', [
    B('femke', 'Hallo! Bent u nieuw hier? Welkom in Amsterdam!', 'Hello! Are you new here? Welcome to Amsterdam!', 'أهلًا! هل أنت جديد هنا؟ أهلًا بك في أمستردام!'),
    B('femke', 'De woonboot van Sanne ligt daar, aan de gracht.', 'Sanne’s houseboat is over there, on the canal.', 'بيت سانه العائم هناك، على القناة.'),
    B('femke', 'En morgen: koffie bij mij, in Café De Gracht!', 'And tomorrow: coffee at mine, in Café De Gracht!', 'وغدًا: قهوة عندي، في مقهى «دي خراخت»!'),
  ]),
  beat(
    'b_nc1_close',
    'ams_boot',
    [
      B('sanne', 'Goed gedaan, {name}! Je spreekt al een beetje Nederlands.', 'Well done, {name}! You already speak a little Dutch.', 'أحسنت يا {name}! أنت تتكلّم قليلًا من الهولندية بالفعل.'),
      B('sanne', 'Wat is jouw droom hier in Amsterdam?', 'What is your dream here in Amsterdam?', 'ما هو حلمك هنا في أمستردام؟'),
    ],
    { ask: 'dream' },
  ),
  beat('b_nc2_open', 'ams_straat', [
    B('sanne', 'Daan woont verderop. Hij fietst de hele dag.', 'Daan lives further down the street. He cycles all day.', 'دان يسكن في آخر الشارع. يركب الدرّاجة طوال اليوم.'),
    B('sanne', 'En bij de snackbar van Mo is het altijd gezellig!', 'And it’s always lovely at Mo’s snack bar!', 'والجوّ دائمًا لطيف في محل «مو»!'),
  ]),
  beat('b_nc2_close', 'ams_boot', [B('sanne', 'Super, {name}! Nu ken je de buurt.', 'Great, {name}! Now you know the neighbourhood.', 'رائع يا {name}! الآن تعرف الحيّ.')], { ask: 'diary' }),
  beat('b_nc3_open', 'ams_markt', [
    B('sanne', 'Zaterdag gaan we naar de markt. En daarna kaas proeven bij Kees!', 'On Saturday we go to the market. And after that, cheese tasting at Kees’s!', 'يوم السبت نذهب إلى السوق. وبعدها تذوّق الجبن عند كيس!'),
  ]),
  beat('b_nc3_close', 'ams_boot', [
    B('sanne', 'Wat een maand, {name}! Koffie, kaas, stroopwafels en de tram.', 'What a month, {name}! Coffee, cheese, stroopwafels and the tram.', 'يا له من شهر يا {name}! القهوة والجبن و«ستروبفافل» والترام.'),
    B('sanne', 'En nu heb je drie vrienden in Amsterdam.', 'And now you have three friends in Amsterdam.', 'والآن لديك ثلاثة أصدقاء في أمستردام.'),
  ]),
  beat('b_nc4_open', 'ams_boot', [
    B('sanne', 'Je klinkt verkouden, {name}! De drogist is hier om de hoek.', 'You sound like you have a cold, {name}! The chemist is just round the corner.', 'يبدو أنك مصاب بالزكام يا {name}! محلّ «الدروخيست» قريب، عند الناصية.'),
    B('sanne', 'En daarna: koffie op de boot? Ik wil je beter leren kennen.', 'And afterwards: coffee on the boat? I’d like to get to know you better.', 'وبعدها: قهوة على القارب؟ أودّ أن أتعرّف عليك أكثر.'),
  ]),
  beat('b_nc4_close', 'ams_straat', [
    B('daan', 'Hé {name}! Jij hoort nu bij de buurt.', 'Hey {name}! You belong to the neighbourhood now.', 'أهلًا يا {name}! أنت الآن من أهل الحيّ.'),
    B('daan', 'Dit weekend doen we iets samen, oké?', 'This weekend we’ll do something together, okay?', 'في عطلة نهاية الأسبوع هذه سنفعل شيئًا معًا، اتفقنا؟'),
  ]),
  beat('b_nc5_open', 'ams_taalcafe', [
    B('noor', 'Vanavond gaan we uit! Ken je café ’t Hoekje al?', 'Tonight we’re going out! Do you know the café ’t Hoekje yet?', 'الليلة نخرج! هل تعرف مقهى «تهوكيه»؟'),
    B('noor', 'Joop heeft alleen pin. En vergeet niet: bij proost kijk je elkaar aan!', 'Joop only takes cards. And don’t forget: at proost you look each other in the eye!', 'يوب يقبل البطاقة فقط. ولا تنسَ: عند «proost» تنظران في عيني بعضكما!'),
  ]),
  beat('b_nc5_close', 'ams_boot', [
    B('sanne', 'Nu ken je Amsterdam bij dag en bij nacht, {name}!', 'Now you know Amsterdam by day and by night, {name}!', 'الآن تعرف أمستردام في النهار والليل يا {name}!'),
    B('sanne', 'Maar heb je je al ingeschreven? Zonder BSN gaat er in Nederland niets.', 'But have you registered yet? Nothing works in the Netherlands without a BSN.', 'لكن هل سجّلت بعد؟ لا شيء يسير في هولندا بلا رقم الخدمة المدنية.'),
  ], { ask: 'diary' }),
  beat('b_nc6_open', 'ams_gemeente', [
    B('ilse', 'Goedemorgen. Stadsloket Zuid.', 'Good morning. City desk, South.', 'صباح الخير. مكتب خدمات البلدية، الجنوب.'),
    B('ilse', 'Met een afspraak, uw paspoort en uw huurcontract gaat het heel snel.', 'With an appointment, your passport and your rental contract it all goes very quickly.', 'مع موعد وجواز سفرك وعقد الإيجار يسير كل شيء بسرعة.'),
  ]),
  beat(NL_EPILOGUE, 'ams_boot', [
    B('sanne', 'Je bent ingeschreven, je hebt vrienden, je spreekt Nederlands. Nu ben je echt thuis in Amsterdam, {name}!', 'You’re registered, you have friends, you speak Dutch. Now you’re really at home in Amsterdam, {name}!', 'سجّلت، ولديك أصدقاء، وتتكلّم الهولندية. الآن أنت حقًا في بيتك في أمستردام يا {name}!'),
    B('daan', 'Welkom thuis!', 'Welcome home!', 'أهلًا بك في بيتك!'),
    B('noor', 'En dit is pas het begin. Tot snel!', 'And this is only the beginning. See you soon!', 'وهذه مجرد البداية. إلى اللقاء قريبًا!'),
  ]),
  beat('b_dream_step', 'ams_boot', [B('sanne', 'Goed zo! Je bent er bijna.', 'That’s it! You’re almost there.', 'هكذا! اقتربت.')]),
  beat('b_phone_fund', 'ams_boot', [B('sanne', 'Hier, een beetje geld van mij. Je kunt het!', 'Here, a little money from me. You can do it!', 'خذ، قليل من المال مني. ستنجح!')]),
  beat('b_welcome_back', 'ams_boot', [
    B('sanne', 'Daar ben je weer! Leuk je te zien.', 'There you are again! Nice to see you.', 'ها أنت ذا من جديد! سعيدة برؤيتك.'),
    B('sanne', 'We gaan rustig verder.', 'We’ll carry on slowly.', 'سنكمل بهدوء.'),
  ]),
  beat('b_rankup', 'ams_cafe', [B('femke', 'Super gedaan!', 'Great job!', 'عمل رائع!')]),
  beat('b_dream_gift', 'ams_markt', [
    B('jesse', 'Een mooi cadeau! Thuis gaan ze het heerlijk vinden.', 'A lovely present! They’ll love it at home.', 'هدية جميلة! سيحبّونها في البيت.'),
    B('sanne', 'Goede reis naar huis, {name}, en kom snel terug!', 'Safe travels home, {name}, and come back soon!', 'رحلة سعيدة إلى البيت يا {name}، وعد قريبًا!'),
  ]),
  beat('b_dream_friends', 'ams_boot', [
    B('sanne', 'We zijn nu echte vrienden, {name}!', 'We’re real friends now, {name}!', 'نحن الآن أصدقاء حقيقيون يا {name}!'),
    B('noor', 'En volgende week: taalcafé, zoals altijd!', 'And next week: the language café, as always!', 'والأسبوع القادم: مقهى اللغات، كالعادة!'),
  ]),
];
export const NL_BEATS: Record<string, Beat> = Object.fromEntries(BEATS.map((b) => [b.id, b]));

const step = (id: string, gate: number, pred: DreamStep['pred'], en: string, ar: string): DreamStep => ({ id, gate, pred, text: { en, ar } });

export const NL_DREAMS: DreamDef[] = [
  {
    id: 'gift',
    name: { ja: 'Een cadeau voor thuis', reading: 'Een cadeau voor thuis', en: 'A present for home', ar: 'هدية للبيت' },
    horizon: 'short',
    items: ['ams_wafel_blik'],
    title: 't_dream_gift',
    beat: 'b_dream_gift',
    sticker: 'st_gift',
    defaultFor: ['travel', 'relocation'],
    steps: [
      step('gift_1', 1, { k: 'scenario', id: 'ams_cafe', complete: true }, 'Have your first coffee in Amsterdam', 'اشرب قهوتك الأولى في أمستردام'),
      step('gift_2', 3, { k: 'scenario', id: 'ams_markt', complete: true }, 'Find Jesse’s stroopwafel stall at the market', 'جِد كشك «ستروبفافل» عند يسه في السوق'),
      step('gift_3', 3, { k: 'own', item: 'ams_wafel_blik' }, 'Buy a tin of stroopwafels to take home', 'اشترِ علبة «ستروبفافل» لتأخذها إلى البيت'),
    ],
  },
  {
    id: 'friends',
    name: { ja: 'Vrienden in Amsterdam', reading: 'Vrienden in Amsterdam', en: 'Friends in Amsterdam', ar: 'أصدقاء في أمستردام' },
    horizon: 'short',
    items: [],
    title: 't_dream_friends',
    beat: 'b_dream_friends',
    sticker: 'st_friends',
    defaultFor: ['casual', 'work'],
    steps: [
      step('friends_1', 1, { k: 'scenario', id: 'ams_sanne', complete: true }, 'Meet your neighbour', 'تعرّف على جارتك'),
      step('friends_2', 3, { k: 'hearts_count', atLeast: 2, n: 3 }, 'Become good friends with Sanne, Daan and Noor (2 hearts each)', 'كوّن صداقة جيدة مع سانه ودان ونور (قلبان لكل منهم)'),
      step('friends_3', 3, { k: 'culture_said', n: 2 }, 'Say 2 Amsterdam phrases from your culture cards', 'قل عبارتين أمستردامية من بطاقاتك الثقافية'),
    ],
  },
];

const title = (id: string, nl: string, en: string, ar: string, source: TitleDef['source']): TitleDef => ({ id, name: { ja: nl, en, ar }, source });
export const NL_TITLES: TitleDef[] = [
  title('t_nieuw_in_amsterdam', 'Nieuw in Amsterdam', 'New in Amsterdam', 'جديد في أمستردام', { kind: 'chapter', n: 1 }),
  title('t_buurtgenoot', 'Buurtgenoot', 'Neighbour', 'ابن الحيّ', { kind: 'chapter', n: 2 }),
  title('t_kaaskenner', 'Kaaskenner', 'Cheese expert', 'خبير الأجبان', { kind: 'chapter', n: 3 }),
  title('t_goede_vriend', 'Goede vriend', 'Good friend', 'صديق طيّب', { kind: 'chapter', n: 4 }),
  title('t_nachtuil', 'Nachtuil', 'Night owl', 'بومة الليل', { kind: 'chapter', n: 5 }),
  title('t_amsterdammer', 'Amsterdammer', 'Amsterdammer', 'أمستردامي', { kind: 'chapter', n: 6 }),
  title('t_dream_gift', 'Gulle gever', 'Generous giver', 'كريم العطاء', { kind: 'dream', id: 'gift' }),
  title('t_dream_friends', 'Vriend voor het leven', 'Friend for life', 'صديق العمر', { kind: 'dream', id: 'friends' }),
];

const card = (id: string, trigger: CultureCard['trigger'], phrase: [string, string, string], en: string, ar: string, more: Partial<CultureCard> = {}): CultureCard => ({ id, trigger, phrase: { ja: phrase[0], en: phrase[1], ar: phrase[2] }, text: { en, ar }, ...more });

export const NL_CULTURE: CultureCard[] = [
  card('cc_gezellig', { on: 'talk_start', ids: ['sanne'] }, ['Gezellig!', 'Lovely and cosy!', 'لطيف ودافئ!'],
    'Gezellig has no one English word: cosy, friendly, nice to be together. A café, an evening with friends, even a busy street can be gezellig. You will hear it every day.',
    'كلمة «خيزيليخ» ليس لها مقابل واحد: دافئ، ودود، جميل أن نكون معًا. المقهى والسهرة مع الأصدقاء وحتى الشارع المزدحم قد يكون «خيزيليخ». ستسمعها كل يوم.', { say: true }),
  card('cc_pinnen', { on: 'payment', ids: ['cafe'] }, ['Pinnen, graag.', 'By card, please.', 'بالبطاقة من فضلك.'],
    'The Dutch pay by card almost everywhere (pinnen, from the PIN). Many shops and every tram take no cash at all: look for the sign 「Wij accepteren alleen pin」.',
    'يدفع الهولنديون بالبطاقة في كل مكان تقريبًا («بينن»). كثير من المحلات وكل الترامات لا تقبل النقد أبدًا: ابحث عن لافتة «نقبل البطاقة فقط».', { say: true }),
  card('cc_inchecken', { on: 'scenario_done', ids: ['ams_gvb'] }, ['Vergeet niet in te checken!', 'Don’t forget to check in!', 'لا تنسَ تسجيل الدخول!'],
    'On Amsterdam’s trams you hold your card to the reader when you get on (inchecken) and again when you get off (uitchecken). Forget to check out and the full fare is charged.',
    'في ترام أمستردام تضع بطاقتك على القارئ حين تصعد («إنتشيكن») ومرة أخرى حين تنزل («أوتتشيكن»). إن نسيت تسجيل الخروج تُخصم الأجرة كاملة.'),
  card('cc_verkeerd', { on: 'scenario_done', ids: ['ams_cafe'] }, ['Een koffie verkeerd, graag.', 'A milky coffee, please.', 'قهوة بالحليب من فضلك.'],
    'Koffie verkeerd means wrong coffee: more milk than coffee, the wrong way round. With it comes a biscuit, and often a slice of apple pie with whipped cream.',
    '«كوفي فركيرد» تعني القهوة الخاطئة: حليب أكثر من القهوة، بالعكس. ومعها بسكويتة، وغالبًا قطعة فطيرة تفاح بالكريمة.', { say: true }),
  card('cc_proeven', { on: 'scenario_done', ids: ['ams_kaas'] }, ['Mag ik proeven?', 'May I have a taste?', 'هل أستطيع التذوّق؟'],
    'In a Dutch cheese shop you may always taste first. Gouda is sold by age (jong, belegen, oud) and by weight: a pond is 500 grams, a half pond 250.',
    'في متجر الأجبان الهولندي تستطيع التذوّق أولًا دائمًا. تُباع الغاودا حسب عمرها (طرية، متوسطة، معتّقة) وبالوزن: الرطل 500 غرام ونصفه 250.', { say: true }),
  card('cc_stroopwafel', { on: 'scenario_done', ids: ['ams_markt'] }, ['Een verse stroopwafel, graag.', 'A fresh stroopwafel, please.', '«ستروبفافل» طازجة من فضلك.'],
    'A stroopwafel is two thin waffles with caramel syrup in between. Put it on top of your hot coffee for a minute and the syrup turns soft.',
    '«الستروبفافل» فافلتان رقيقتان بينهما شراب الكراميل. ضعها فوق قهوتك الساخنة دقيقة فيلين الشراب.'),
  card('cc_patatje', { on: 'scenario_done', ids: ['ams_snackbar'] }, ['Een patatje met, graag.', 'Fries with mayonnaise, please.', 'بطاطا مقلية بالمايونيز من فضلك.'],
    'Patatje met means fries with mayonnaise; patatje oorlog (war) comes with mayonnaise, peanut sauce and onions. The snack bar greets you with 「Zeg het maar!」: tell me.',
    '«باتاتيه مت» بطاطا مقلية بالمايونيز؛ و«باتاتيه أورلوخ» (الحرب) بالمايونيز وصلصة الفول السوداني والبصل. يستقبلك المحل بـ«زيخ هت مار!»: تفضّل.', { say: true }),
  card('cc_fiets', { on: 'talk_start', ids: ['daan'] }, ['Heb je een fiets?', 'Do you have a bike?', 'هل عندك درّاجة؟'],
    'Amsterdam has more bikes than people. Bike lanes are red, cyclists have right of way in many places, and every bike needs two locks.',
    'في أمستردام درّاجات أكثر من السكان. ممرّات الدرّاجات حمراء، ولراكبي الدرّاجات الأولوية في أماكن كثيرة، وكل درّاجة تحتاج قفلين.', { say: true }),
  card('cc_je_u', { on: 'talk_start', ids: ['noor'] }, ['Hoe heet jij?', 'What’s your name? (to a friend)', 'ما اسمك؟ (لصديق)'],
    'Dutch has two yous: u for staff, officials and older people, je for friends and people your age. Amsterdam says je quickly, but with u you are never wrong.',
    'في الهولندية صيغتان للمخاطَب: u للموظفين والمسؤولين وكبار السن، وje للأصدقاء ومن في سنّك. أهل أمستردام ينتقلون إلى je بسرعة، لكنك مع u لا تخطئ أبدًا.'),
  // Chapters 4-6
  card('cc_drogist', { on: 'scenario_done', ids: ['ams_drogist'] }, ['Beterschap!', 'Get well soon!', 'أتمنى لك الشفاء العاجل!'],
    'For a headache or a cold the Dutch go to the drogist: paracetamol, throat sweets, nasal spray, without a prescription. The apotheek is for medicine a doctor prescribes. And everyone wishes you Beterschap.',
    'للصداع أو الزكام يذهب الهولنديون إلى «الدروخيست»: باراسيتامول وحلوى للحلق وبخاخ للأنف بلا وصفة. أما الصيدلية فللأدوية التي يصفها الطبيب. والجميع يتمنى لك «Beterschap».', { say: true }),
  card('cc_pannenkoek', { on: 'scenario_done', ids: ['hang_sanne_pannenkoek'] }, ['Met stroop, graag!', 'With syrup, please!', 'مع الشراب الحلو من فضلك!'],
    'Dutch pancakes are big and thin and eaten for dinner as often as for dessert: with apple, bacon or cheese baked in, and stroop (thick syrup) or powdered sugar on top.',
    'الفطائر الهولندية كبيرة ورقيقة وتؤكل عشاءً بقدر ما تؤكل حلوى: يُخبز فيها التفاح أو اللحم المقدّد أو الجبن، ويوضع فوقها شراب «ستروب» الكثيف أو السكر الناعم.', { say: true }),
  card('cc_fietsregels', { on: 'scenario_done', ids: ['hang_daan_vondelpark'] }, ['Ik steek mijn hand uit.', 'I stick my hand out.', 'أمدّ يدي.'],
    'On a Dutch bike you stick your hand out before you turn, keep to the red bike path, never ride on the pavement, and turn your lights on after dark: riding without a light costs a fine.',
    'على الدرّاجة في هولندا تمدّ يدك قبل الانعطاف، وتلتزم بممر الدرّاجات الأحمر، ولا تركب على الرصيف أبدًا، وتشغّل الأضواء بعد حلول الظلام: الركوب بلا ضوء غرامته مالية.', { say: true }),
  card('cc_verjaardag', { on: 'scenario_done', ids: ['hang_noor_verjaardag'] }, ['Gefeliciteerd met je moeder!', 'Congratulations on your mother!', 'مبروك على والدتك!'],
    'A Dutch birthday is often a circle (kringverjaardag): the guests sit in a ring, and you congratulate not only the one whose birthday it is but everyone in the family: Gefeliciteerd met je moeder!',
    'عيد الميلاد الهولندي كثيرًا ما يكون دائرة: يجلس الضيوف في حلقة، وتهنّئ ليس صاحب العيد وحده بل كل أفراد العائلة: «مبروك على والدتك!».', { say: true }),
  card('cc_bruin_cafe', { on: 'intent', ids: ['ams_kroeg:proost'] }, ['Proost!', 'Cheers!', 'في صحتك!'],
    'A bruin café (brown café) is an old Amsterdam pub with dark wood and walls browned by years of smoke: gezellig, bitterballen with mustard. When glasses clink, say Proost and look each other in the eye. Many cafés now take only cards.',
    'المقهى البنّي حانة قديمة في أمستردام، خشبها داكن وجدرانها بُنّية من دخان السنين: «خيزيليخ»، و«بِترْبالن» بالخردل. عند قرع الكؤوس قل «Proost» وانظرا في عيني بعضكما. وكثير من المقاهي اليوم تقبل البطاقة فقط.', { say: true, adultOnly: true }),
  card('cc_inschrijven', { on: 'scenario_done', ids: ['ams_gemeente'] }, ['Ik wil me inschrijven.', 'I’d like to register.', 'أودّ التسجيل.'],
    'Everyone who comes to live in the Netherlands registers at the gemeente (the town hall) and gets a BSN, the citizen service number, needed for work, a bank account and the doctor. Book an appointment online and bring your passport and rental contract.',
    'كل من يأتي للعيش في هولندا يسجّل في البلدية ويحصل على رقم الخدمة المدنية (BSN)، وهو ضروري للعمل وفتح حساب مصرفي والطبيب. احجز موعدًا على الإنترنت وأحضر جواز سفرك وعقد الإيجار.', { say: true }),
];

export const NL_DAILY: DailyTemplate[] = [
  { id: 'g_conv2', slot: 'speak', counter: 'conv_distinct', target: 2, text: { en: 'Finish 2 different conversations', ar: 'أنهِ محادثتين مختلفتين' } },
  { id: 'g_indep6', slot: 'speak', counter: 'indep_lines', target: 6, text: { en: 'Say 6 lines in your own words', ar: 'قل 6 جمل بكلماتك أنت' } },
  { id: 'g_newphrase2', slot: 'speak', counter: 'new_intents', target: 2, text: { en: 'Use 2 new ways of saying things', ar: 'استخدم طريقتين جديدتين للتعبير' } },
  { id: 'g_buy', slot: 'do', counter: 'purchase', target: 1, requires: { chapter: 1 }, text: { en: 'Buy something in Dutch', ar: 'اشترِ شيئًا باللغة الهولندية' } },
  { id: 'g_friend', slot: 'do', counter: 'friend_contact', target: 1, requires: { chapter: 2, friends: true }, text: { en: 'Spend time with a friend', ar: 'اقضِ وقتًا مع صديق' } },
  { id: 'g_place', slot: 'do', counter: 'places_distinct', target: 2, text: { en: 'Talk to people in 2 different places', ar: 'تحدّث مع أشخاص في مكانين مختلفين' } },
  { id: 'g_review8', slot: 'review', counter: 'review_checked', target: 8, requires: { vocabCards: true }, text: { en: 'Review 8 words that are due', ar: 'راجع 8 كلمات مستحقة' } },
  { id: 'g_culture', slot: 'review', counter: 'culture_new', target: 1, requires: { unseenCulture: true }, text: { en: 'Learn one new thing about Amsterdam', ar: 'تعلّم شيئًا جديدًا عن أمستردام' } },
];

export const NL_WORD_TAGS: Record<string, string[]> = {
  transport: ['tram', 'uurkaart', 'dagkaart', 'fiets', 'fietsen', 'reis'],
  numbers: ['één', 'twee', 'drie', 'vier', 'twaalf'],
  cafe: ['koffie', 'thee', 'appeltaart', 'slagroom', 'chocolademelk'],
};
