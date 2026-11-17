// Berlin's story, Chapters 1-3 (German step 2): arriving in the Kiez, getting around it, and a Sunday at the Mauerpark flea market; the
// beats (German lines, every word in the German dictionary), two dreams, the titles, the culture cards, the daily goals and the word tags.
import type { Beat, BeatLine, ChapterDef, ChapterOpen, CultureCard, DailyTemplate, DreamDef, DreamStep, TitleDef } from '@lw/game';

const o = (kind: ChapterOpen['kind'], id: string): ChapterOpen => ({ kind, id });

export const DE_EPILOGUE = 'b_bc3_close';

export const DE_CHAPTERS: ChapterDef[] = [
  {
    n: 1,
    title: { ja: 'Willkommen in Berlin', en: 'Welcome to Berlin', ar: 'أهلًا بك في برلين' },
    minDays: 1,
    reward: 3000,
    rewardTitle: 't_neu_in_berlin',
    rewardCulture: ['cc_sie_du'],
    opens: [o('place', 'berlin_wg'), o('place', 'berlin_bakery'), o('place', 'berlin_spaeti'), o('shop', 'bakery'), o('shop', 'spaeti'), o('feature', 'prepare'), o('feature', 'culture')],
    beats: { open: 'b_bc1_open', close: 'b_bc1_close' },
    objectives: [
      {
        id: 'bc1_1',
        pred: { k: 'scenario', id: 'berlin_lena', complete: true },
        text: { en: 'Meet Lena, your flatmate', ar: 'تعرّف على لينا، شريكتك في السكن' },
        hint: { en: 'Lena is in the WG kitchen. Tell her your name.', ar: 'لينا في مطبخ السكن. أخبرها باسمك.' },
        pin: { friend: 'lena' },
      },
      {
        id: 'bc1_2',
        pred: { k: 'scenario', id: 'berlin_bakery', complete: true },
        text: { en: 'Buy breakfast at the bakery', ar: 'اشترِ الفطور من المخبز' },
        hint: { en: 'Jana’s bakery is on the corner. Brötchen, bitte!', ar: 'مخبز يانا على الناصية. Brötchen, bitte!' },
        pin: { place: 'berlin_bakery' },
      },
      {
        id: 'bc1_3',
        pred: { k: 'words_saved', n: 5 },
        text: { en: 'Save 5 words to your notebook', ar: 'احفظ 5 كلمات في دفترك' },
        hint: { en: 'Tap a word in any German line, then save it.', ar: 'اضغط على كلمة في أي جملة ألمانية ثم احفظها.' },
      },
      {
        id: 'bc1_4',
        pred: { k: 'say_new', n: 3 },
        text: { en: 'Say 3 different new words yourself in conversations', ar: 'انطق 3 كلمات جديدة مختلفة بنفسك في المحادثات' },
        hint: { en: 'Type or say a word yourself instead of tapping a suggestion.', ar: 'اكتب كلمة أو انطقها بنفسك بدل الضغط على اقتراح.' },
        easier: { pred: { k: 'say_new', n: 2 }, afterTries: 3 },
      },
    ],
  },
  {
    n: 2,
    title: { ja: 'Mein Kiez', en: 'My neighbourhood', ar: 'حيّي' },
    minDays: 2,
    reward: 3000,
    rewardTitle: 't_kiez',
    rewardCulture: ['cc_mit_allem'],
    opens: [o('shop', 'doener'), o('shop', 'ubahn'), o('place', 'berlin_doener'), o('place', 'berlin_ubahn'), o('place', 'berlin_hof'), o('feature', 'friends')],
    beats: { open: 'b_bc2_open', close: 'b_bc2_close' },
    objectives: [
      {
        id: 'bc2_1',
        pred: { k: 'scenario', id: 'berlin_kofi', complete: true },
        text: { en: 'Meet Kofi, your neighbour', ar: 'تعرّف على كوفي، جارك' },
        hint: { en: 'Kofi is fixing a bike in the courtyard.', ar: 'كوفي يصلح درّاجة في الفناء.' },
        pin: { friend: 'kofi' },
      },
      {
        id: 'bc2_2',
        pred: { k: 'scenario', id: 'berlin_doener', complete: true },
        text: { en: 'Order a Döner just the way you like it', ar: 'اطلب دونر كما تحبّه' },
        hint: { en: 'Mit allem? Und scharf? Emre will ask.', ar: 'Mit allem? Und scharf? سيسألك أمره.' },
        pin: { place: 'berlin_doener' },
      },
      {
        id: 'bc2_3',
        pred: { k: 'scenario', id: 'berlin_ubahn', complete: true },
        text: { en: 'Buy a ticket for the U-Bahn', ar: 'اشترِ تذكرة للمترو' },
        hint: { en: 'Sabine is at the BVG counter in the station.', ar: 'زابينه عند شبّاك هيئة النقل في المحطة.' },
        pin: { place: 'berlin_ubahn' },
      },
      {
        id: 'bc2_4',
        pred: { k: 'purchases', n: 4 },
        text: { en: 'Buy 4 things by talking in German', ar: 'اشترِ 4 أشياء بالحديث بالألمانية' },
      },
    ],
  },
  {
    n: 3,
    title: { ja: 'Sonntag im Mauerpark', en: 'Sunday in Mauerpark', ar: 'الأحد في «ماورپارك»' },
    minDays: 3,
    reward: 4000,
    rewardTitle: 't_flohmarkt',
    rewardCulture: ['cc_bargeld'],
    opens: [o('shop', 'flohmarkt'), o('place', 'berlin_flohmarkt'), o('place', 'berlin_cafe'), o('feature', 'gift'), o('interaction', 'lena_gift'), o('interaction', 'kofi_gift'), o('interaction', 'jonas_gift')],
    beats: { open: 'b_bc3_open', close: DE_EPILOGUE },
    objectives: [
      {
        id: 'bc3_1',
        pred: { k: 'scenario', id: 'berlin_jonas', complete: true },
        text: { en: 'Meet Jonas at the language exchange', ar: 'قابل يوناس في لقاء تبادل اللغة' },
        hint: { en: 'Jonas is waiting at the café in Neukölln.', ar: 'يوناس ينتظرك في المقهى في نويكولن.' },
        pin: { friend: 'jonas' },
      },
      {
        id: 'bc3_2',
        pred: { k: 'scenario', id: 'berlin_flohmarkt', steps: ['haggle'] },
        text: { en: 'Haggle at the flea market', ar: 'ساوم في سوق البرغوث' },
        hint: { en: 'Ask Greta: Geht es ein bisschen billiger?', ar: 'اسأل غريتا: Geht es ein bisschen billiger?' },
        pin: { place: 'berlin_flohmarkt' },
      },
      {
        id: 'bc3_3',
        pred: { k: 'culture', n: 5 },
        text: { en: 'Collect 5 Berlin culture cards', ar: 'اجمع 5 بطاقات ثقافية عن برلين' },
      },
      {
        id: 'bc3_4',
        pred: { k: 'stars', atLeast: 2, n: 4 },
        text: { en: 'Get 2 stars in 4 different shop conversations', ar: 'احصل على نجمتين في 4 محادثات متاجر مختلفة' },
      },
    ],
  },
];

const B = (who: string, ja: string, en: string, ar: string): BeatLine => ({ who, line: { ja, en, ar } });
const beat = (id: string, place: string, lines: BeatLine[], more: Partial<Beat> = {}): Beat => ({ id, place, lines, ...more });

const BEATS: Beat[] = [
  beat('b_bc1_open', 'berlin_spaeti', [
    B('murat', 'Hallo! Sind Sie neu hier? Willkommen im Kiez!', 'Hello! Are you new here? Welcome to the neighbourhood!', 'أهلًا! هل أنت جديد هنا؟ أهلًا بك في الحيّ!'),
    B('murat', 'Die WG ist da drüben, im dritten Stock.', 'The flat share is over there, on the third floor.', 'السكن المشترك هناك، في الطابق الثالث.'),
    B('murat', 'Und morgen früh: Brötchen bei Jana, an der Ecke!', 'And tomorrow morning: rolls at Jana’s, on the corner!', 'وصباح الغد: خبز من عند يانا، على الناصية!'),
  ]),
  beat(
    'b_bc1_close',
    'berlin_wg',
    [
      B('lena', 'Gut gemacht, {name}! Du sprichst schon ein bisschen Deutsch.', 'Well done, {name}! You already speak a little German.', 'أحسنت يا {name}! أنت تتكلّم قليلًا من الألمانية بالفعل.'),
      B('lena', 'Was ist dein Traum hier in Berlin?', 'What is your dream here in Berlin?', 'ما هو حلمك هنا في برلين؟'),
    ],
    { ask: 'dream' },
  ),
  beat('b_bc2_open', 'berlin_hof', [
    B('lena', 'Unten im Hof wohnt Kofi. Er repariert Fahrräder.', 'Kofi lives downstairs by the courtyard. He fixes bikes.', 'كوفي يسكن في الأسفل عند الفناء. يصلح الدرّاجات.'),
    B('lena', 'Und Emre macht den besten Döner im Kiez!', 'And Emre makes the best Döner in the neighbourhood!', 'وأمره يصنع أفضل دونر في الحيّ!'),
  ]),
  beat('b_bc2_close', 'berlin_wg', [B('lena', 'Super, {name}! Jetzt kennst du den Kiez.', 'Great, {name}! Now you know the neighbourhood.', 'رائع يا {name}! الآن تعرف الحيّ.')], { ask: 'diary' }),
  beat('b_bc3_open', 'berlin_flohmarkt', [
    B('lena', 'Am Sonntag ist fast alles zu. Aber der Flohmarkt im Mauerpark ist offen!', 'On Sundays almost everything is closed. But the flea market in Mauerpark is open!', 'يوم الأحد يكون كل شيء تقريبًا مغلقًا. لكن سوق البرغوث في «ماورپارك» مفتوح!'),
    B('lena', 'Komm, wir gehen zusammen!', 'Come on, let’s go together!', 'تعال، لنذهب معًا!'),
  ]),
  beat(DE_EPILOGUE, 'berlin_wg', [
    B('lena', 'Was für ein Monat, {name}! Bäckerei, Späti, Döner, U-Bahn und Flohmarkt.', 'What a month, {name}! Bakery, Späti, Döner, U-Bahn and flea market.', 'يا له من شهر يا {name}! المخبز و«الشبيتي» والدونر والمترو وسوق البرغوث.'),
    B('lena', 'Und jetzt hast du drei Freunde in Berlin.', 'And now you have three friends in Berlin.', 'والآن لديك ثلاثة أصدقاء في برلين.'),
    B('lena', 'Das ist erst der Anfang. Bis bald!', 'This is only the beginning. See you soon!', 'هذه مجرد البداية. إلى اللقاء قريبًا!'),
  ]),
  // the beats the game plays by name
  beat('b_dream_step', 'berlin_wg', [B('lena', 'Gut so! Du bist fast da.', 'That’s it! You’re almost there.', 'هكذا! اقتربت.')]),
  beat('b_phone_fund', 'berlin_wg', [B('lena', 'Hier, ein bisschen Geld von mir. Du schaffst das!', 'Here, a little money from me. You can do it!', 'خذ، قليل من المال مني. ستنجح!')]),
  beat('b_welcome_back', 'berlin_wg', [
    B('lena', 'Da bist du ja wieder! Schön, dich zu sehen.', 'There you are again! Nice to see you.', 'ها أنت ذا من جديد! سعيدة برؤيتك.'),
    B('lena', 'Wir machen ganz langsam weiter.', 'We’ll carry on very slowly.', 'سنكمل ببطء شديد.'),
  ]),
  beat('b_rankup', 'berlin_spaeti', [B('murat', 'Super gemacht!', 'Great job!', 'عمل رائع!')]),
  // dream finales
  beat('b_dream_bike', 'berlin_hof', [
    B('kofi', 'Dein eigenes Fahrrad! Jetzt ist ganz Berlin dein Kiez.', 'Your own bike! Now all of Berlin is your neighbourhood.', 'درّاجتك الخاصة! الآن كل برلين حيّك.'),
    B('kofi', 'Gute Fahrt, {name}!', 'Have a good ride, {name}!', 'رحلة سعيدة يا {name}!'),
  ]),
  beat('b_dream_friends', 'berlin_wg', [
    B('lena', 'Wir sind jetzt richtige Freunde, {name}!', 'We’re real friends now, {name}!', 'نحن الآن أصدقاء حقيقيون يا {name}!'),
    B('jonas', 'Und nächste Woche: Tandem wie immer!', 'And next week: the language exchange, as always!', 'والأسبوع القادم: تبادل اللغة كالعادة!'),
  ]),
];
export const DE_BEATS: Record<string, Beat> = Object.fromEntries(BEATS.map((b) => [b.id, b]));

const step = (id: string, gate: number, pred: DreamStep['pred'], en: string, ar: string): DreamStep => ({ id, gate, pred, text: { en, ar } });

export const DE_DREAMS: DreamDef[] = [
  {
    id: 'bike',
    name: { ja: 'Mit dem Rad durch Berlin', reading: 'Mit dem Rad durch Berlin', en: 'By bike through Berlin', ar: 'بالدرّاجة عبر برلين' },
    horizon: 'short',
    items: ['bike_used'],
    title: 't_dream_bike',
    beat: 'b_dream_bike',
    sticker: 'st_bike',
    defaultFor: ['travel', 'relocation'],
    steps: [
      step('bike_1', 2, { k: 'words_known', tag: 'transport', n: 5 }, 'Learn 5 words for getting around', 'تعلّم 5 كلمات عن التنقّل'),
      step('bike_2', 2, { k: 'scenario', id: 'berlin_kofi', complete: true }, 'Meet Kofi, the bike mechanic', 'تعرّف على كوفي، ميكانيكي الدرّاجات'),
      step('bike_3', 3, { k: 'own', item: 'bike_used' }, 'Buy a second-hand bike at the flea market', 'اشترِ درّاجة مستعملة من سوق البرغوث'),
    ],
  },
  {
    id: 'friends',
    name: { ja: 'Freunde in Berlin', reading: 'Freunde in Berlin', en: 'Friends in Berlin', ar: 'أصدقاء في برلين' },
    horizon: 'short',
    items: [],
    title: 't_dream_friends',
    beat: 'b_dream_friends',
    sticker: 'st_friends',
    defaultFor: ['casual', 'work'],
    steps: [
      step('friends_1', 1, { k: 'scenario', id: 'berlin_lena', complete: true }, 'Meet your flatmate', 'تعرّف على شريكتك في السكن'),
      step('friends_2', 3, { k: 'hearts_count', atLeast: 2, n: 3 }, 'Become good friends with Lena, Kofi and Jonas (2 hearts each)', 'كوّن صداقة جيدة مع لينا وكوفي ويوناس (قلبان لكل منهم)'),
      step('friends_3', 3, { k: 'culture_said', n: 2 }, 'Say 2 Berlin phrases from your culture cards', 'قل عبارتين برلينيتين من بطاقاتك الثقافية'),
    ],
  },
];

const title = (id: string, de: string, en: string, ar: string, source: TitleDef['source']): TitleDef => ({ id, name: { ja: de, en, ar }, source });
export const DE_TITLES: TitleDef[] = [
  title('t_neu_in_berlin', 'Neu in Berlin', 'New in Berlin', 'جديد في برلين', { kind: 'chapter', n: 1 }),
  title('t_kiez', 'Kiezkenner', 'Knows the Kiez', 'يعرف الحيّ', { kind: 'chapter', n: 2 }),
  title('t_flohmarkt', 'Flohmarkt-Profi', 'Flea-market pro', 'محترف سوق البرغوث', { kind: 'chapter', n: 3 }),
  title('t_dream_bike', 'Radfahrer', 'Cyclist', 'راكب درّاجة', { kind: 'dream', id: 'bike' }),
  title('t_dream_friends', 'Freund fürs Leben', 'Friend for life', 'صديق العمر', { kind: 'dream', id: 'friends' }),
];

const card = (id: string, trigger: CultureCard['trigger'], phrase: [string, string, string], en: string, ar: string, more: Partial<CultureCard> = {}): CultureCard => ({
  id,
  trigger,
  phrase: { ja: phrase[0], en: phrase[1], ar: phrase[2] },
  text: { en, ar },
  ...more,
});

export const DE_CULTURE: CultureCard[] = [
  card(
    'cc_schrippe',
    { on: 'scenario_done', ids: ['berlin_bakery'] },
    ['Eine Schrippe, bitte.', 'A bread roll, please.', 'خبزة صغيرة من فضلك.'],
    'In Berlin a bread roll is a Schrippe; elsewhere it is a Brötchen, in the south a Semmel. Bakeries open early, and Sunday-morning rolls are a ritual.',
    'في برلين يسمّى الخبز الصغير «شريبه»، وفي غيرها «بروتشن»، وفي الجنوب «زيمل». تفتح المخابز باكرًا، وخبز صباح الأحد طقس عائلي.',
    { say: true },
  ),
  card(
    'cc_pfand',
    { on: 'intent', ids: ['berlin_spaeti:pfand'] },
    ['Das ist Pfand.', 'That’s the deposit.', 'هذا تأمين العبوة.'],
    'Pfand is a deposit on bottles and cans (8 to 25 cents). Take them back to a machine in any supermarket and you get it back. Bottles left next to a bin are for people who collect them.',
    '«بفاند» تأمين على الزجاجات والعلب (من 8 إلى 25 سنتًا). أعدها إلى آلة في أي سوبرماركت فتستردّه. والزجاجات التي تُترك بجانب سلة المهملات هي لمن يجمعها.',
  ),
  card(
    'cc_sie_du',
    { on: 'talk_start', ids: ['lena'] },
    ['Wie heißt du?', 'What’s your name? (to a friend)', 'ما اسمك؟ (لصديق)'],
    'German has two yous: Sie with staff, officials and people you do not know; du with friends, flatmates, children and, in Berlin, in many cafés and bars. When unsure, say Sie and let the other person offer du.',
    'في الألمانية صيغتان للمخاطَب: Sie مع الموظفين والمسؤولين ومن لا تعرفهم، وdu مع الأصدقاء وشركاء السكن والأطفال، وفي برلين في كثير من المقاهي والحانات. إن لم تكن متأكدًا فقل Sie ودع الآخر يقترح du.',
    { say: true },
  ),
  card(
    'cc_mit_allem',
    { on: 'scenario_done', ids: ['berlin_doener'] },
    ['Mit allem und scharf, bitte.', 'With everything and spicy, please.', 'مع كل شيء وحار من فضلك.'],
    'The Döner in bread, as Berlin knows it, was made popular in Berlin in the 1970s by Turkish-Berliners. Mit allem means salad, onions and all three sauces.',
    'شطيرة الدونر في الخبز كما تعرفها برلين انتشرت في برلين في السبعينيات على أيدي البرلينيين الأتراك. «مع كل شيء» تعني السلطة والبصل والصلصات الثلاث.',
    { say: true },
  ),
  card(
    'cc_entwerten',
    { on: 'scenario_done', ids: ['berlin_ubahn'] },
    ['Den Fahrschein entwerten!', 'Validate the ticket!', 'اختم التذكرة!'],
    'Berlin’s U-Bahn has no gates. A paper ticket counts only once you stamp it in the small machine on the platform; inspectors in plain clothes check, and riding without a valid ticket costs €60.',
    'لا بوّابات في مترو برلين. التذكرة الورقية لا تُحتسب إلا بعد ختمها في الآلة الصغيرة على الرصيف؛ ومفتّشون بملابس عادية يتحقّقون، والركوب بلا تذكرة صالحة غرامته 60 يورو.',
  ),
  card(
    'cc_bargeld',
    { on: 'payment', ids: ['flohmarkt'] },
    ['Nur bar, bitte.', 'Cash only, please.', 'نقدًا فقط من فضلك.'],
    'Germany still loves cash: flea markets, many Spätis, small bakeries and some bars take nothing else. Carry a few coins and notes.',
    'ما زالت ألمانيا تحب النقد: أسواق البرغوث وكثير من محلات «الشبيتي» والمخابز الصغيرة وبعض الحانات لا تقبل غيره. احمل بعض العملات والأوراق النقدية.',
  ),
  card(
    'cc_sonntag',
    { on: 'visit', ids: ['berlin_flohmarkt'] },
    ['Am Sonntag ist alles zu.', 'On Sunday everything is closed.', 'يوم الأحد كل شيء مغلق.'],
    'Sunday is a quiet day (Sonntagsruhe): supermarkets and most shops are closed, and loud work is frowned upon. Bakeries open in the morning, Spätis all day, and flea markets fill the parks.',
    'الأحد يوم هادئ: المتاجر الكبرى ومعظم المحلات مغلقة، والأعمال الصاخبة غير مستحبّة. المخابز تفتح صباحًا، و«الشبيتي» طوال اليوم، وأسواق البرغوث تملأ الحدائق.',
  ),
  card(
    'cc_tandem',
    { on: 'talk_start', ids: ['jonas'] },
    ['Sollen wir üben?', 'Shall we practise?', 'هل نتدرّب؟'],
    'A Sprach-Tandem is two people who teach each other their languages, half the time in each. Berlin has hundreds of them every week, in cafés, libraries and online.',
    'تبادل اللغة لقاء بين شخصين يعلّم كل منهما الآخر لغته، نصف الوقت لكل لغة. في برلين مئات اللقاءات كل أسبوع في المقاهي والمكتبات وعلى الإنترنت.',
    { say: true },
  ),
];

export const DE_DAILY: DailyTemplate[] = [
  { id: 'g_conv2', slot: 'speak', counter: 'conv_distinct', target: 2, text: { en: 'Finish 2 different conversations', ar: 'أنهِ محادثتين مختلفتين' } },
  { id: 'g_indep6', slot: 'speak', counter: 'indep_lines', target: 6, text: { en: 'Say 6 lines in your own words', ar: 'قل 6 جمل بكلماتك أنت' } },
  { id: 'g_newphrase2', slot: 'speak', counter: 'new_intents', target: 2, text: { en: 'Use 2 new ways of saying things', ar: 'استخدم طريقتين جديدتين للتعبير' } },
  { id: 'g_buy', slot: 'do', counter: 'purchase', target: 1, requires: { chapter: 1 }, text: { en: 'Buy something in German', ar: 'اشترِ شيئًا باللغة الألمانية' } },
  { id: 'g_friend', slot: 'do', counter: 'friend_contact', target: 1, requires: { chapter: 2, friends: true }, text: { en: 'Spend time with a friend', ar: 'اقضِ وقتًا مع صديق' } },
  { id: 'g_place', slot: 'do', counter: 'places_distinct', target: 2, text: { en: 'Talk to people in 2 different places', ar: 'تحدّث مع أشخاص في مكانين مختلفين' } },
  { id: 'g_review8', slot: 'review', counter: 'review_checked', target: 8, requires: { vocabCards: true }, text: { en: 'Review 8 words that are due', ar: 'راجع 8 كلمات مستحقة' } },
  { id: 'g_culture', slot: 'review', counter: 'culture_new', target: 1, requires: { unseenCulture: true }, text: { en: 'Learn one new thing about Berlin', ar: 'تعلّم شيئًا جديدًا عن برلين' } },
];

/** tag -> dictionary words (the dream's 「5 words for getting around」 and the review weighting read them) */
export const DE_WORD_TAGS: Record<string, string[]> = {
  transport: ['U-Bahn', 'Fahrschein', 'Tageskarte', 'Kurzstrecke', 'Fahrt', 'Stationen', 'Fahrrad', 'fahren', 'entwerten', 'Automaten'],
  numbers: ['eins', 'zwei', 'drei', 'vier', 'fünf', 'fünfzehn'],
  cafe: ['Kaffee', 'Kakao', 'Brötchen', 'Brezel', 'Croissant', 'Pfannkuchen'],
};
