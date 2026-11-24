// Berlin's story, Chapters 1-6: arriving in the Kiez, getting around it, a Sunday at the Mauerpark flea market (German step 2); then
// good friends and a cold (the Apotheke), going out (hang-outs, the Kneipe) and arriving for real (the Anmeldung at the Bürgeramt) (German
// step 5). The beats (German lines, every word in the German dictionary), two dreams, the titles, the culture cards, the daily goals and
// the word tags.
import type { Beat, BeatLine, ChapterDef, ChapterOpen, CultureCard, DailyTemplate, DreamDef, DreamStep, TitleDef } from '@lw/game';

const o = (kind: ChapterOpen['kind'], id: string): ChapterOpen => ({ kind, id });

/** the closing of the last chapter (6): the end of the story, then Free Walk */
export const DE_EPILOGUE = 'b_bc6_close';

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
    opens: [
      o('shop', 'doener'),
      o('shop', 'ubahn'),
      o('place', 'berlin_doener'),
      o('place', 'berlin_ubahn'),
      o('place', 'berlin_hof'),
      o('feature', 'friends'),
      o('job', 'job_spaeti'),
      o('interaction', 'murat_shift'),
    ],
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
      {
        id: 'bc2_5',
        pred: { k: 'shift', job: 'job_spaeti', n: 1, minAcc: 0.6 },
        text: { en: 'Work your first shift at the Späti (all 5 customers)', ar: 'اعمل أول وردية في «الشبيتي» (الزبائن الخمسة جميعهم)' },
        hint: { en: 'Murat needs help at the till in the evenings. Talk to him at the Späti.', ar: 'يحتاج مراد إلى مساعدة عند الصندوق في المساء. تحدّث معه في «الشبيتي».' },
        pin: { place: 'berlin_spaeti' },
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
    beats: { open: 'b_bc3_open', close: 'b_bc3_close' },
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
  {
    n: 4,
    title: { ja: 'Gute Freunde', en: 'Good friends', ar: 'أصدقاء طيّبون' },
    minDays: 4,
    reward: 4000,
    rewardTitle: 't_gute_freunde',
    opens: [
      o('shop', 'apotheke'),
      o('place', 'berlin_apotheke'),
      o('interaction', 'anke_shop'),
      o('interaction', 'lena_hang'),
      o('interaction', 'kofi_hang'),
      o('interaction', 'jonas_hang'),
    ],
    beats: { open: 'b_bc4_open', close: 'b_bc4_close' },
    objectives: [
      {
        id: 'bc4_1',
        pred: { k: 'all', of: [{ k: 'scenario', id: 'smalltalk_lena', complete: true }, { k: 'scenario', id: 'smalltalk_kofi', complete: true }, { k: 'scenario', id: 'smalltalk_jonas', complete: true }] },
        text: { en: 'Have a chat with Lena, Kofi and Jonas', ar: 'دردش مع لينا وكوفي ويوناس' },
        hint: { en: 'Talk to a friend: say hello, answer their question, react. One chat a day each counts.', ar: 'تحدّث مع صديق: قل مرحبًا وأجب عن سؤاله وعلّق. تُحتسب دردشة واحدة يوميًا مع كل منهم.' },
        pin: { friend: 'kofi' },
      },
      {
        id: 'bc4_2',
        pred: { k: 'gift', n: 1 },
        text: { en: 'Give a friend a present', ar: 'قدّم هدية لصديق' },
        hint: { en: 'Buy something they like (a Pfannkuchen for Lena?), then: Ich habe … für dich!', ar: 'اشترِ شيئًا يحبه (دونات للينا؟) ثم قل: Ich habe … für dich!' },
        pin: { friend: 'lena' },
      },
      {
        id: 'bc4_3',
        pred: { k: 'scenario', id: 'berlin_apotheke', complete: true },
        text: { en: 'Get something for your cold at the Apotheke', ar: 'اشترِ شيئًا لنزلة البرد من الصيدلية' },
        hint: { en: 'Say what hurts: Ich habe Halsschmerzen.', ar: 'قل ما يؤلمك: Ich habe Halsschmerzen.' },
        pin: { place: 'berlin_apotheke' },
      },
      {
        id: 'bc4_4',
        pred: { k: 'hearts_count', atLeast: 3, n: 1 },
        text: { en: 'Become close friends with someone (3 hearts)', ar: 'كوّن صداقة قريبة مع أحدهم (3 قلوب)' },
        hint: { en: 'Chat with the same friend on different days, and give a present they like.', ar: 'دردش مع الصديق نفسه في أيام مختلفة، وقدّم هدية يحبها.' },
      },
    ],
  },
  {
    n: 5,
    title: { ja: 'Ausgehen', en: 'Going out', ar: 'الخروج' },
    minDays: 5,
    reward: 5000,
    rewardTitle: 't_nachteule',
    opens: [o('shop', 'kneipe'), o('place', 'berlin_kneipe'), o('interaction', 'uwe_bar')],
    beats: { open: 'b_bc5_open', close: 'b_bc5_close' },
    objectives: [
      {
        id: 'bc5_1',
        pred: { k: 'hangout', n: 1 },
        text: { en: 'Hang out with a friend', ar: 'اقضِ وقتًا مع صديق' },
        hint: { en: 'A friend at 3 hearts has time: cake with Lena, a bike with Kofi, a game with Jonas.', ar: 'الصديق ذو القلوب الثلاثة لديه وقت: كعكة مع لينا، أو درّاجة مع كوفي، أو لعبة مع يوناس.' },
      },
      {
        id: 'bc5_2',
        pred: { k: 'scenario', id: 'berlin_kneipe', complete: true },
        text: { en: 'An evening at the Kneipe: order, say Prost, pay', ar: 'أمسية في الحانة: اطلب، قل «Prost»، ادفع' },
        hint: { en: 'Zum Eck takes cash only. Zahlen, bitte!', ar: 'حانة «تسوم إك» تقبل النقد فقط. Zahlen, bitte!' },
        pin: { place: 'berlin_kneipe' },
      },
      {
        id: 'bc5_3',
        pred: { k: 'culture_said', n: 3 },
        text: { en: 'Say 3 Berlin phrases from your culture cards', ar: 'قل 3 عبارات برلينية من بطاقاتك الثقافية' },
      },
      {
        id: 'bc5_4',
        pred: { k: 'stars', atLeast: 2, n: 6 },
        text: { en: 'Get 2 stars in 6 different conversations', ar: 'احصل على نجمتين في 6 محادثات مختلفة' },
      },
    ],
  },
  {
    n: 6,
    title: { ja: 'Angekommen', en: 'Arrived', ar: 'وصلت' },
    minDays: 6,
    reward: 6000,
    rewardTitle: 't_angekommen',
    opens: [o('place', 'berlin_buergeramt'), o('interaction', 'krause_desk')],
    beats: { open: 'b_bc6_open', close: DE_EPILOGUE },
    objectives: [
      {
        id: 'bc6_1',
        pred: { k: 'scenario', id: 'berlin_buergeramt', complete: true },
        text: { en: 'Register your address at the Bürgeramt (the Anmeldung)', ar: 'سجّل عنوانك في مكتب شؤون المواطنين («الأنميلدونغ»)' },
        hint: { en: 'Herr Krause wants your passport and your new address: Ich möchte mich anmelden.', ar: 'السيد كراوزه يريد جواز سفرك وعنوانك الجديد: Ich möchte mich anmelden.' },
        pin: { place: 'berlin_buergeramt' },
      },
      {
        id: 'bc6_2',
        pred: { k: 'hearts_count', atLeast: 4, n: 1 },
        text: { en: 'Become best friends with someone (4 hearts)', ar: 'كوّن صداقة متينة مع أحدهم (4 قلوب)' },
      },
      {
        id: 'bc6_3',
        pred: { k: 'hangout', n: 3 },
        text: { en: 'Hang out 3 times with your friends', ar: 'اقضِ وقتًا مع أصدقائك 3 مرات' },
      },
      {
        id: 'bc6_4',
        pred: { k: 'words_known', n: 40 },
        text: { en: 'Know 40 words (reviewed at least once)', ar: 'تعرّف على 40 كلمة (راجعتها مرة على الأقل)' },
        hint: { en: 'Review the words in your notebook.', ar: 'راجع الكلمات في دفترك.' },
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
  beat('b_bc3_close', 'berlin_wg', [
    B('lena', 'Was für ein Monat, {name}! Bäckerei, Späti, Döner, U-Bahn und Flohmarkt.', 'What a month, {name}! Bakery, Späti, Döner, U-Bahn and flea market.', 'يا له من شهر يا {name}! المخبز و«الشبيتي» والدونر والمترو وسوق البرغوث.'),
    B('lena', 'Und jetzt hast du drei Freunde in Berlin.', 'And now you have three friends in Berlin.', 'والآن لديك ثلاثة أصدقاء في برلين.'),
  ]),
  beat('b_bc4_open', 'berlin_wg', [
    B('lena', 'Du klingst erkältet, {name}! Die Apotheke ist gleich um die Ecke.', 'You sound like you have a cold, {name}! The pharmacy is just round the corner.', 'يبدو أنك مصاب بالزكام يا {name}! الصيدلية قريبة، عند الناصية.'),
    B('lena', 'Und danach: Kaffee in der Küche? Ich möchte dich besser kennenlernen.', 'And afterwards: coffee in the kitchen? I’d like to get to know you better.', 'وبعدها: قهوة في المطبخ؟ أودّ أن أتعرّف عليك أكثر.'),
  ]),
  beat('b_bc4_close', 'berlin_hof', [
    B('kofi', 'Hey {name}! Du gehörst jetzt zum Hof.', 'Hey {name}! You belong to the courtyard now.', 'أهلًا يا {name}! أنت الآن من أهل الفناء.'),
    B('kofi', 'Am Wochenende machen wir was zusammen, okay?', 'At the weekend we’ll do something together, okay?', 'في عطلة نهاية الأسبوع سنفعل شيئًا معًا، اتفقنا؟'),
  ]),
  beat('b_bc5_open', 'berlin_cafe', [
    B('jonas', 'Heute Abend gehen wir aus! Kennst du schon das Zum Eck?', 'Tonight we’re going out! Do you know Zum Eck yet?', 'الليلة نخرج! هل تعرف حانة «تسوم إك»؟'),
    B('jonas', 'Uwe nimmt nur Bargeld. Und vergiss nicht: Prost mit Augenkontakt!', 'Uwe only takes cash. And don’t forget: Prost with eye contact!', 'أوفه يقبل النقد فقط. ولا تنسَ: «Prost» مع النظر في العينين!'),
  ]),
  beat('b_bc5_close', 'berlin_wg', [
    B('lena', 'Jetzt kennst du Berlin am Tag und in der Nacht, {name}!', 'Now you know Berlin by day and by night, {name}!', 'الآن تعرف برلين في النهار والليل يا {name}!'),
    B('lena', 'Aber hast du dich schon angemeldet? Ohne Meldebescheinigung geht in Deutschland nichts.', 'But have you registered yet? Nothing works in Germany without the certificate.', 'لكن هل سجّلت عنوانك بعد؟ لا شيء يسير في ألمانيا بلا شهادة التسجيل.'),
  ], { ask: 'diary' }),
  beat('b_bc6_open', 'berlin_buergeramt', [
    B('krause', 'Guten Tag. Bürgeramt Kreuzberg.', 'Good afternoon. Bürgeramt Kreuzberg.', 'مساء الخير. مكتب شؤون المواطنين في كرويتسبرغ.'),
    B('krause', 'Mit Termin, Pass und Formular geht alles ganz schnell.', 'With an appointment, a passport and the form, it all goes very quickly.', 'مع موعد وجواز سفر واستمارة يسير كل شيء بسرعة.'),
  ]),
  beat(DE_EPILOGUE, 'berlin_wg', [
    B('lena', 'Du bist angemeldet, du hast Freunde, du sprichst Deutsch. Jetzt bist du wirklich angekommen, {name}!', 'You’re registered, you have friends, you speak German. Now you’ve really arrived, {name}!', 'سجّلت عنوانك، ولديك أصدقاء، وتتكلّم الألمانية. الآن وصلت حقًا يا {name}!'),
    B('kofi', 'Willkommen zu Hause!', 'Welcome home!', 'أهلًا بك في بيتك!'),
    B('jonas', 'Und das ist erst der Anfang. Bis bald!', 'And this is only the beginning. See you soon!', 'وهذه مجرد البداية. إلى اللقاء قريبًا!'),
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
  title('t_gute_freunde', 'Guter Freund', 'Good friend', 'صديق طيّب', { kind: 'chapter', n: 4 }),
  title('t_nachteule', 'Nachteule', 'Night owl', 'بومة الليل', { kind: 'chapter', n: 5 }),
  title('t_angekommen', 'Angekommen', 'Arrived', 'وصلت', { kind: 'chapter', n: 6 }),
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
  // Chapters 4-6
  card(
    'cc_apotheke',
    { on: 'scenario_done', ids: ['berlin_apotheke'] },
    ['Gute Besserung!', 'Get well soon!', 'أتمنى لك الشفاء العاجل!'],
    'In Germany even a headache tablet is sold only at the Apotheke, the shop with the red A. At night and on Sundays one pharmacy in each area stays open (the Notdienst); every pharmacy’s door says which.',
    'في ألمانيا حتى أقراص الصداع لا تُباع إلا في الصيدلية، المحل ذي حرف A الأحمر. وفي الليل وأيام الأحد تبقى صيدلية واحدة مفتوحة في كل حيّ (صيدلية المناوبة)؛ وعلى باب كل صيدلية عنوانها.',
    { say: true },
  ),
  card(
    'cc_kaffee_kuchen',
    { on: 'scenario_done', ids: ['hang_lena_backen'] },
    ['Kaffee und Kuchen?', 'Coffee and cake?', 'قهوة وكعك؟'],
    'Kaffee und Kuchen is a German afternoon ritual, above all on Sundays around three o’clock: a pot of coffee, a homemade cake, family or friends at the table.',
    'القهوة والكعك طقس ألماني بعد الظهر، خاصة أيام الأحد نحو الساعة الثالثة: إبريق قهوة، وكعكة من صنع البيت، والعائلة أو الأصدقاء حول الطاولة.',
    { say: true },
  ),
  card(
    'cc_brettspiel',
    { on: 'scenario_done', ids: ['hang_jonas_spiel'] },
    ['Du bist dran!', 'It’s your turn!', 'دورك!'],
    'Germany loves board games: there is a prize for the game of the year (Spiel des Jahres), and Mensch ärgere dich nicht (Do not get annoyed!) has been played in families for over a hundred years.',
    'ألمانيا تحب ألعاب الطاولة: هناك جائزة للعبة العام (Spiel des Jahres)، ولعبة «Mensch ärgere dich nicht» (لا تنزعج!) تُلعب في العائلات منذ أكثر من مئة عام.',
    { say: true },
  ),
  card(
    'cc_prost',
    { on: 'intent', ids: ['berlin_kneipe:prost'] },
    ['Prost!', 'Cheers!', 'في صحتك!'],
    'When glasses clink, look the other person in the eye and say Prost (or Zum Wohl). Not looking, the joke goes, means seven years of bad luck. A Kneipe is a simple corner pub: beer, a Bulette, often cash only.',
    'عند قرع الكؤوس انظر في عيني الآخر وقل «Prost» (أو «Zum Wohl»). وتقول النكتة إن عدم النظر يجلب سبع سنوات من سوء الحظ. و«الكنايبه» حانة بسيطة على الناصية: بيرة و«بوليته»، وغالبًا نقدًا فقط.',
    { say: true, adultOnly: true },
  ),
  card(
    'cc_trinkgeld',
    { on: 'payment', ids: ['kneipe'] },
    ['Stimmt so!', 'Keep the change!', 'احتفظ بالباقي!'],
    'Tips (Trinkgeld) in Germany are said, not left on the table: round the bill up when you pay and say Stimmt so (keep the change). About five to ten per cent in bars and restaurants.',
    'الإكرامية في ألمانيا تُقال ولا تُترك على الطاولة: قرّب المبلغ إلى الأعلى عند الدفع وقل «Stimmt so» (احتفظ بالباقي). نحو خمسة إلى عشرة بالمئة في الحانات والمطاعم.',
    { say: true },
  ),
  card(
    'cc_anmeldung',
    { on: 'scenario_done', ids: ['berlin_buergeramt'] },
    ['Ich möchte mich anmelden.', 'I’d like to register my address.', 'أودّ تسجيل عنواني.'],
    'Everyone who moves into a flat in Germany registers the address at the Bürgeramt within two weeks (the Anmeldung). In Berlin appointments are booked online, often weeks ahead; bring your passport and the form from your landlord. The certificate you get is needed for a bank account, a phone contract and much more.',
    'كل من يسكن في شقة في ألمانيا يسجّل عنوانه في مكتب شؤون المواطنين خلال أسبوعين («الأنميلدونغ»). في برلين تُحجز المواعيد على الإنترنت، وغالبًا قبل أسابيع؛ أحضر جواز سفرك والاستمارة من المؤجّر. والشهادة التي تحصل عليها ضرورية لفتح حساب مصرفي وعقد هاتف وأمور كثيرة.',
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
  { id: 'g_shift', slot: 'do', counter: 'shift_good', target: 1, requires: { job: true }, text: { en: 'Finish a shift', ar: 'أنهِ وردية' } },
  { id: 'g_review8', slot: 'review', counter: 'review_checked', target: 8, requires: { vocabCards: true }, text: { en: 'Review 8 words that are due', ar: 'راجع 8 كلمات مستحقة' } },
  { id: 'g_culture', slot: 'review', counter: 'culture_new', target: 1, requires: { unseenCulture: true }, text: { en: 'Learn one new thing about Berlin', ar: 'تعلّم شيئًا جديدًا عن برلين' } },
];

/** tag -> dictionary words (the dream's 「5 words for getting around」 and the review weighting read them) */
export const DE_WORD_TAGS: Record<string, string[]> = {
  transport: ['U-Bahn', 'Fahrschein', 'Tageskarte', 'Kurzstrecke', 'Fahrt', 'Stationen', 'Fahrrad', 'fahren', 'entwerten', 'Automaten'],
  numbers: ['eins', 'zwei', 'drei', 'vier', 'fünf', 'fünfzehn'],
  cafe: ['Kaffee', 'Kakao', 'Brötchen', 'Brezel', 'Croissant', 'Pfannkuchen'],
};
