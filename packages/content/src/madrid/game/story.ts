// Madrid's story, Chapters 1-3 (Spanish step 2): arriving in Lavapiés, getting to know the barrio, and a Saturday at the market; Chapters
// 4-6 (Spanish step 4): good friends (their chats, a present, the farmacia, the hang-outs), going out for tapas, and getting on the padrón,
// whose closing is the ending before Free Walk. The beats (Spanish lines, every word in the Spanish dictionary), two dreams, titles,
// culture cards, daily goals, tags. Nothing in it guesses the player's gender: no bienvenido / bienvenida, no encantado / encantada, no
// madrileño / madrileña (the titles are Buena gente, Alma de la fiesta, Gato de Madrid).
import type { Beat, BeatLine, ChapterDef, ChapterOpen, CultureCard, DailyTemplate, DreamDef, DreamStep, TitleDef } from '@lw/game';

const o = (kind: ChapterOpen['kind'], id: string): ChapterOpen => ({ kind, id });
export const ES_EPILOGUE = 'b_ec6_close';

const obj = (id: string, pred: ChapterDef['objectives'][number]['pred'], en: string, ar: string, more: Partial<ChapterDef['objectives'][number]> = {}) => ({ id, pred, text: { en, ar }, ...more });

export const ES_CHAPTERS: ChapterDef[] = [
  {
    n: 1,
    title: { ja: 'Hola, Madrid', en: 'Hello, Madrid', ar: 'مرحبًا يا مدريد' },
    minDays: 1,
    reward: 3000,
    rewardTitle: 't_hola_madrid',
    rewardCulture: ['cc_dos_besos'],
    opens: [o('place', 'mad_piso'), o('place', 'mad_bar'), o('place', 'mad_panaderia'), o('shop', 'bar'), o('shop', 'panaderia'), o('feature', 'prepare'), o('feature', 'culture')],
    beats: { open: 'b_ec1_open', close: 'b_ec1_close' },
    objectives: [
      obj('ec1_1', { k: 'scenario', id: 'mad_lucia', complete: true }, 'Meet Lucía, your flatmate', 'تعرّف على لوسيا، شريكتك في السكن', { pin: { friend: 'lucia' } }),
      obj('ec1_2', { k: 'scenario', id: 'mad_bar', complete: true }, 'Have breakfast at Bar El Rincón', 'تناول الفطور في «بار إل رينكون»', { pin: { place: 'mad_bar' }, hint: { en: 'Lola will ask 「¿Qué te pongo?」. A café con leche and a tostada?', ar: 'ستسألك لولا «¿Qué te pongo?». قهوة بالحليب وخبز محمّص؟' } }),
      obj('ec1_3', { k: 'words_saved', n: 5 }, 'Save 5 words to your notebook', 'احفظ 5 كلمات في دفترك', { hint: { en: 'Tap a word in any Spanish line, then save it.', ar: 'اضغط على كلمة في أي جملة إسبانية ثم احفظها.' } }),
      obj('ec1_4', { k: 'say_new', n: 3 }, 'Say 3 different new words yourself in conversations', 'انطق 3 كلمات جديدة مختلفة بنفسك في المحادثات', { easier: { pred: { k: 'say_new', n: 2 }, afterTries: 3 } }),
    ],
  },
  {
    n: 2,
    title: { ja: 'Mi barrio', en: 'My neighbourhood', ar: 'حيّي' },
    minDays: 2,
    reward: 3000,
    rewardTitle: 't_del_barrio',
    rewardCulture: ['cc_churros'],
    opens: [o('shop', 'churreria'), o('shop', 'metro'), o('place', 'mad_churreria'), o('place', 'mad_metro'), o('place', 'mad_plaza'), o('feature', 'friends')],
    beats: { open: 'b_ec2_open', close: 'b_ec2_close' },
    objectives: [
      obj('ec2_1', { k: 'scenario', id: 'mad_javi', complete: true }, 'Meet Javi, your neighbour on the third floor', 'تعرّف على خافي، جارك في الطابق الثالث', { pin: { friend: 'javi' } }),
      obj('ec2_2', { k: 'scenario', id: 'mad_churreria', complete: true }, 'Have chocolate con churros', 'تناول الشوكولاتة مع «التشوروس»', { pin: { place: 'mad_churreria' } }),
      obj('ec2_3', { k: 'scenario', id: 'mad_metro', complete: true }, 'Buy a Metro ticket', 'اشترِ تذكرة مترو', { pin: { place: 'mad_metro' } }),
      obj('ec2_4', { k: 'purchases', n: 4 }, 'Buy 4 things by talking in Spanish', 'اشترِ 4 أشياء بالحديث بالإسبانية'),
    ],
  },
  {
    n: 3,
    title: { ja: 'Sábado de mercado', en: 'Market Saturday', ar: 'سبت السوق' },
    minDays: 3,
    reward: 4000,
    rewardTitle: 't_buen_ojo',
    rewardCulture: ['cc_ultimo'],
    opens: [o('shop', 'mercado'), o('place', 'mad_mercado'), o('place', 'mad_intercambio'), o('feature', 'gift'), o('interaction', 'lucia_gift'), o('interaction', 'javi_gift'), o('interaction', 'nadia_gift')],
    beats: { open: 'b_ec3_open', close: 'b_ec3_close' },
    objectives: [
      obj('ec3_1', { k: 'scenario', id: 'mad_nadia', complete: true }, 'Meet Nadia at the language exchange', 'قابل نادية في لقاء تبادل اللغة', { pin: { friend: 'nadia' } }),
      obj('ec3_2', { k: 'scenario', id: 'mad_mercado', steps: ['weight'] }, 'Buy fruit at the market by the kilo', 'اشترِ فاكهة من السوق بالكيلو', { pin: { place: 'mad_mercado' } }),
      obj('ec3_3', { k: 'scenario', id: 'mad_panaderia', complete: true }, 'Buy bread at Carmen’s panadería', 'اشترِ خبزًا من مخبز كارمن', { pin: { place: 'mad_panaderia' } }),
      obj('ec3_4', { k: 'culture', n: 5 }, 'Collect 5 Madrid culture cards', 'اجمع 5 بطاقات ثقافية عن مدريد'),
    ],
  },
  {
    n: 4,
    title: { ja: 'Buenos amigos', en: 'Good friends', ar: 'أصدقاء طيّبون' },
    minDays: 4,
    reward: 4000,
    rewardTitle: 't_buena_gente',
    opens: [o('shop', 'farmacia'), o('place', 'mad_farmacia'), o('interaction', 'pilar_shop'), o('interaction', 'lucia_hang'), o('interaction', 'javi_hang'), o('interaction', 'nadia_hang')],
    beats: { open: 'b_ec4_open', close: 'b_ec4_close' },
    objectives: [
      obj('ec4_1', { k: 'all', of: [{ k: 'scenario', id: 'smalltalk_lucia', complete: true }, { k: 'scenario', id: 'smalltalk_javi', complete: true }, { k: 'scenario', id: 'smalltalk_nadia', complete: true }] }, 'Have a chat with Lucía, Javi and Nadia', 'دردش مع لوسيا وخافي ونادية', {
        hint: { en: 'Talk to a friend: say hello, answer their question, react. One chat a day each counts.', ar: 'تحدّث مع صديق: قل مرحبًا وأجب عن سؤاله وعلّق. تُحتسب دردشة واحدة يوميًا مع كل منهم.' },
        pin: { friend: 'javi' },
      }),
      obj('ec4_2', { k: 'gift', n: 1 }, 'Give a friend a present', 'قدّم هدية لصديق', {
        hint: { en: 'Buy something they like (a napolitana for Lucía?), then: Tengo … para ti.', ar: 'اشترِ شيئًا يحبه («نابوليتانا» للوسيا؟) ثم قل: Tengo … para ti.' },
        pin: { friend: 'lucia' },
      }),
      obj('ec4_3', { k: 'scenario', id: 'mad_farmacia', complete: true }, 'Get something for your cold at the farmacia', 'اشترِ شيئًا لنزلة البرد من الصيدلية', {
        hint: { en: 'Say what hurts: Me duele la garganta.', ar: 'قل ما يؤلمك: Me duele la garganta.' },
        pin: { place: 'mad_farmacia' },
      }),
      obj('ec4_4', { k: 'hearts_count', atLeast: 3, n: 1 }, 'Become close friends with someone (3 hearts)', 'كوّن صداقة قريبة مع أحدهم (3 قلوب)', {
        hint: { en: 'Chat with the same friend on different days, and give a present they like.', ar: 'دردش مع الصديق نفسه في أيام مختلفة، وقدّم هدية يحبها.' },
      }),
    ],
  },
  {
    n: 5,
    title: { ja: 'De tapas', en: 'Out for tapas', ar: 'نخرج لتناول «التاباس»' },
    minDays: 5,
    reward: 5000,
    rewardTitle: 't_alma_fiesta',
    opens: [o('shop', 'taberna'), o('place', 'mad_taberna'), o('interaction', 'manolo_bar')],
    beats: { open: 'b_ec5_open', close: 'b_ec5_close' },
    objectives: [
      obj('ec5_1', { k: 'hangout', n: 1 }, 'Hang out with a friend', 'اقضِ وقتًا مع صديق', {
        hint: { en: 'A friend at 3 hearts has time: a tortilla with Lucía, the match with Javi, the Retiro with Nadia.', ar: 'الصديق ذو القلوب الثلاثة لديه وقت: «تورتيا» مع لوسيا، أو المباراة مع خافي، أو «الريتيرو» مع نادية.' },
      }),
      obj('ec5_2', { k: 'scenario', id: 'mad_taberna', complete: true }, 'An evening at the taberna: order, say ¡Salud!, pay', 'أمسية في الحانة: اطلب، قل «¡Salud!»، ادفع', {
        hint: { en: 'Every drink comes with a free tapa. At the end: ¿Me cobras?', ar: 'كل مشروب يأتي معه طبق صغير مجاني. وفي النهاية: ¿Me cobras?' },
        pin: { place: 'mad_taberna' },
      }),
      obj('ec5_3', { k: 'culture_said', n: 3 }, 'Say 3 Madrid phrases from your culture cards', 'قل 3 عبارات مدريدية من بطاقاتك الثقافية'),
      obj('ec5_4', { k: 'stars', atLeast: 2, n: 6 }, 'Get 2 stars in 6 different conversations', 'احصل على نجمتين في 6 محادثات مختلفة'),
    ],
  },
  {
    n: 6,
    title: { ja: 'Mi casa en Madrid', en: 'My home in Madrid', ar: 'بيتي في مدريد' },
    minDays: 6,
    reward: 6000,
    rewardTitle: 't_gato',
    opens: [o('place', 'mad_padron'), o('interaction', 'concha_desk')],
    beats: { open: 'b_ec6_open', close: ES_EPILOGUE },
    objectives: [
      obj('ec6_1', { k: 'scenario', id: 'mad_padron', complete: true }, 'Get on the padrón at the citizens’ office', 'سجّل في سجل السكان في مكتب خدمة المواطنين', {
        hint: { en: 'Concha wants your passport, your rental contract and your address: Quiero empadronarme.', ar: 'كونتشا تريد جواز سفرك وعقد الإيجار وعنوانك: Quiero empadronarme.' },
        pin: { place: 'mad_padron' },
      }),
      obj('ec6_2', { k: 'hearts_count', atLeast: 4, n: 1 }, 'Become best friends with someone (4 hearts)', 'كوّن صداقة متينة مع أحدهم (4 قلوب)'),
      obj('ec6_3', { k: 'hangout', n: 3 }, 'Hang out 3 times with your friends', 'اقضِ وقتًا مع أصدقائك 3 مرات'),
      obj('ec6_4', { k: 'words_known', n: 40 }, 'Know 40 words (reviewed at least once)', 'تعرّف على 40 كلمة (راجعتها مرة على الأقل)', {
        hint: { en: 'Review the words in your notebook.', ar: 'راجع الكلمات في دفترك.' },
      }),
    ],
  },
];

const B = (who: string, ja: string, en: string, ar: string): BeatLine => ({ who, line: { ja, en, ar } });
const beat = (id: string, place: string, lines: BeatLine[], more: Partial<Beat> = {}): Beat => ({ id, place, lines, ...more });

const BEATS: Beat[] = [
  beat('b_ec1_open', 'mad_bar', [
    B('lola', '¡Hola! Tú vives con Lucía, ¿verdad? ¡Esto es Lavapiés!', 'Hi! You live with Lucía, right? This is Lavapiés!', 'أهلًا! أنت تسكن مع لوسيا، صحيح؟ هذه لابابييس!'),
    B('lola', 'Lucía está en el piso, aquí al lado.', 'Lucía is at the flat, right next door.', 'لوسيا في الشقة، هنا بجانبنا.'),
    B('lola', 'Y mañana, el desayuno aquí, en el Bar El Rincón.', 'And tomorrow, breakfast here, at Bar El Rincón.', 'وغدًا، الفطور هنا، في «بار إل رينكون».'),
  ]),
  beat(
    'b_ec1_close',
    'mad_piso',
    [
      B('lucia', '¡Muy bien, {name}! Ya hablas un poco de español.', 'Well done, {name}! You already speak a little Spanish.', 'أحسنت يا {name}! أنت تتكلّم قليلًا من الإسبانية بالفعل.'),
      B('lucia', '¿Cuál es tu sueño aquí en Madrid?', 'What is your dream here in Madrid?', 'ما هو حلمك هنا في مدريد؟'),
    ],
    { ask: 'dream' },
  ),
  beat('b_ec2_open', 'mad_plaza', [
    B('lucia', 'Javi vive en el tercero. ¡Le encanta el fútbol!', 'Javi lives on the third floor. He loves football!', 'خافي يسكن في الطابق الثالث. يحب كرة القدم كثيرًا!'),
    B('lucia', 'Y los domingos, chocolate con churros en la churrería de Rafa.', 'And on Sundays, chocolate con churros at Rafa’s churrería.', 'وأيام الأحد، الشوكولاتة مع «التشوروس» في محل رافا.'),
  ]),
  beat('b_ec2_close', 'mad_piso', [B('lucia', '¡Genial, {name}! Ya conoces el barrio.', 'Great, {name}! Now you know the neighbourhood.', 'رائع يا {name}! الآن تعرف الحيّ.')], { ask: 'diary' }),
  beat('b_ec3_open', 'mad_mercado', [
    B('lucia', 'El sábado vamos al mercado. ¡Las fresas de Andrés son las mejores!', 'On Saturday we go to the market. Andrés’s strawberries are the best!', 'يوم السبت نذهب إلى السوق. فراولة أندريس هي الأفضل!'),
  ]),
  beat('b_ec3_close', 'mad_piso', [
    B('lucia', '¡Qué mes, {name}! El café, los churros, el mercado y el metro.', 'What a month, {name}! Coffee, churros, the market and the Metro.', 'يا له من شهر يا {name}! القهوة و«التشوروس» والسوق والمترو.'),
    B('lucia', 'Y ahora tienes tres amigos en Madrid.', 'And now you have three friends in Madrid.', 'والآن لديك ثلاثة أصدقاء في مدريد.'),
  ]),
  beat('b_ec4_open', 'mad_piso', [
    B('lucia', '¡Uy, {name}, qué tos! La farmacia está aquí al lado.', 'Oh, {name}, what a cough! The pharmacy is right next door.', 'أوه يا {name}، يا له من سعال! الصيدلية هنا بجانبنا.'),
    B('lucia', 'Y después, ¿un café en casa? Quiero conocerte mejor.', 'And afterwards, a coffee at home? I’d like to get to know you better.', 'وبعدها، قهوة في البيت؟ أودّ أن أتعرّف عليك أكثر.'),
  ]),
  beat('b_ec4_close', 'mad_plaza', [
    B('javi', '¡Hola, {name}! Ya eres parte del barrio.', 'Hi, {name}! You’re part of the neighbourhood now.', 'أهلًا يا {name}! أنت الآن جزء من الحيّ.'),
    B('javi', 'Este fin de semana hacemos algo juntos, ¿vale?', 'This weekend we’ll do something together, okay?', 'في عطلة نهاية الأسبوع هذه سنفعل شيئًا معًا، اتفقنا؟'),
  ]),
  beat('b_ec5_open', 'mad_intercambio', [
    B('nadia', '¡Esta noche salimos! ¿Conoces la Taberna El Farolillo?', 'Tonight we’re going out! Do you know Taberna El Farolillo?', 'الليلة نخرج! هل تعرف حانة «إل فاروليو»؟'),
    B('nadia', 'Con cada bebida te ponen una tapa gratis. ¡Y Manolo tiene las mejores bravas!', 'With every drink they give you a free tapa. And Manolo has the best bravas!', 'مع كل مشروب يقدّمون لك طبقًا صغيرًا مجانًا. ولدى مانولو أفضل «برافاس»!'),
  ]),
  beat('b_ec5_close', 'mad_piso', [
    B('lucia', '¡Ya conoces Madrid de día y de noche, {name}!', 'Now you know Madrid by day and by night, {name}!', 'الآن تعرف مدريد في النهار والليل يا {name}!'),
    B('lucia', 'Pero, ¿ya te has empadronado? Sin el padrón no puedes ir al centro de salud.', 'But have you registered on the padrón yet? Without it you can’t go to the health centre.', 'لكن هل سجّلت في سجل السكان بعد؟ بدونه لا تستطيع الذهاب إلى المركز الصحي.'),
  ], { ask: 'diary' }),
  beat('b_ec6_open', 'mad_padron', [
    B('concha', 'Buenos días. Oficina de Atención al Ciudadano.', 'Good morning. Citizens’ office.', 'صباح الخير. مكتب خدمة المواطنين.'),
    B('concha', 'Con cita previa, su pasaporte y su contrato de alquiler, es muy rápido.', 'With an appointment, your passport and your rental contract, it’s very quick.', 'مع موعد مسبق وجواز سفرك وعقد الإيجار، يتمّ الأمر بسرعة كبيرة.'),
  ]),
  beat(ES_EPILOGUE, 'mad_piso', [
    B('lucia', 'Ya tienes el padrón, tienes amigos y hablas español. ¡Ahora Madrid es tu casa, {name}!', 'You’re on the padrón, you have friends and you speak Spanish. Now Madrid is your home, {name}!', 'سجّلت في سجل السكان، ولديك أصدقاء، وتتكلّم الإسبانية. الآن مدريد بيتك يا {name}!'),
    B('javi', '¡Esta es tu casa!', 'This is your home!', 'هذا بيتك!'),
    B('nadia', 'Y esto es solo el principio. ¡Hasta pronto!', 'And this is only the beginning. See you soon!', 'وهذه مجرد البداية. إلى اللقاء قريبًا!'),
  ]),
  beat('b_dream_step', 'mad_piso', [B('lucia', '¡Muy bien! Ya casi está.', 'That’s it! You’re nearly there.', 'هكذا! اقتربت.')]),
  beat('b_phone_fund', 'mad_piso', [B('lucia', 'Toma, un poco de dinero. ¡Tú puedes!', 'Here, a little money. You can do it!', 'خذ، قليل من المال. ستنجح!')]),
  beat('b_welcome_back', 'mad_piso', [
    B('lucia', '¡Ya estás aquí otra vez! ¡Qué alegría!', 'You’re back again! How lovely!', 'عدت من جديد! يا للفرحة!'),
    B('lucia', 'Seguimos poco a poco.', 'We’ll carry on little by little.', 'سنكمل شيئًا فشيئًا.'),
  ]),
  beat('b_rankup', 'mad_bar', [B('lola', '¡Muy bien hecho!', 'Very well done!', 'أحسنت صنعًا!')]),
  beat('b_dream_gift', 'mad_mercado', [
    B('andres', '¡Un buen regalo! En casa les va a encantar.', 'A good present! They’ll love it at home.', 'هدية جيدة! سيحبّونها في البيت.'),
    B('lucia', '¡Buen viaje a casa, {name}, y vuelve pronto!', 'Have a good trip home, {name}, and come back soon!', 'رحلة سعيدة إلى البيت يا {name}، وعد قريبًا!'),
  ]),
  beat('b_dream_friends', 'mad_piso', [
    B('lucia', '¡Ya somos amigos de verdad, {name}!', 'We’re real friends now, {name}!', 'نحن الآن أصدقاء حقيقيون يا {name}!'),
    B('nadia', 'Y el jueves que viene, ¡intercambio, como siempre!', 'And next Thursday, the language exchange, as always!', 'والخميس القادم، لقاء تبادل اللغة كالعادة!'),
  ]),
];
export const ES_BEATS: Record<string, Beat> = Object.fromEntries(BEATS.map((b) => [b.id, b]));

const step = (id: string, gate: number, pred: DreamStep['pred'], en: string, ar: string): DreamStep => ({ id, gate, pred, text: { en, ar } });

export const ES_DREAMS: DreamDef[] = [
  {
    id: 'gift',
    name: { ja: 'Un regalo de Madrid', reading: 'Un regalo de Madrid', en: 'A present from Madrid', ar: 'هدية من مدريد' },
    horizon: 'short',
    items: ['mad_aceite'],
    title: 't_dream_gift',
    beat: 'b_dream_gift',
    sticker: 'st_gift',
    defaultFor: ['travel', 'relocation'],
    steps: [
      step('gift_1', 1, { k: 'scenario', id: 'mad_bar', complete: true }, 'Have your first breakfast in Madrid', 'تناول فطورك الأول في مدريد'),
      step('gift_2', 3, { k: 'scenario', id: 'mad_mercado', complete: true }, 'Find Andrés’s stall at the market', 'جِد كشك أندريس في السوق'),
      step('gift_3', 3, { k: 'own', item: 'mad_aceite' }, 'Buy a tin of olive oil to take home', 'اشترِ علبة زيت زيتون لتأخذها إلى البيت'),
    ],
  },
  {
    id: 'friends',
    name: { ja: 'Amigos en Madrid', reading: 'Amigos en Madrid', en: 'Friends in Madrid', ar: 'أصدقاء في مدريد' },
    horizon: 'short',
    items: [],
    title: 't_dream_friends',
    beat: 'b_dream_friends',
    sticker: 'st_friends',
    defaultFor: ['casual', 'work'],
    steps: [
      step('friends_1', 1, { k: 'scenario', id: 'mad_lucia', complete: true }, 'Meet your flatmate', 'تعرّف على شريكتك في السكن'),
      step('friends_2', 3, { k: 'hearts_count', atLeast: 2, n: 3 }, 'Become good friends with Lucía, Javi and Nadia (2 hearts each)', 'كوّن صداقة جيدة مع لوسيا وخافي ونادية (قلبان لكل منهم)'),
      step('friends_3', 3, { k: 'culture_said', n: 2 }, 'Say 2 Madrid phrases from your culture cards', 'قل عبارتين مدريديتين من بطاقاتك الثقافية'),
    ],
  },
];

const title = (id: string, es: string, en: string, ar: string, source: TitleDef['source']): TitleDef => ({ id, name: { ja: es, en, ar }, source });
export const ES_TITLES: TitleDef[] = [
  title('t_hola_madrid', 'Hola, Madrid', 'Hello, Madrid', 'مرحبًا يا مدريد', { kind: 'chapter', n: 1 }),
  title('t_del_barrio', 'Del barrio', 'From the neighbourhood', 'ابن الحيّ', { kind: 'chapter', n: 2 }),
  title('t_buen_ojo', 'Buen ojo', 'A good eye', 'عين خبيرة', { kind: 'chapter', n: 3 }),
  title('t_buena_gente', 'Buena gente', 'A good soul', 'طيّب القلب', { kind: 'chapter', n: 4 }),
  title('t_alma_fiesta', 'Alma de la fiesta', 'Life and soul of the party', 'روح الحفلة', { kind: 'chapter', n: 5 }),
  title('t_gato', 'Gato de Madrid', 'A Madrid “cat” (what born Madrileños call themselves)', '«قطّ» مدريدي (لقب أبناء مدريد)', { kind: 'chapter', n: 6 }),
  title('t_dream_gift', 'Corazón generoso', 'Generous heart', 'قلب كريم', { kind: 'dream', id: 'gift' }),
  title('t_dream_friends', 'Amistad para siempre', 'Friends forever', 'صداقة إلى الأبد', { kind: 'dream', id: 'friends' }),
];

const card = (id: string, trigger: CultureCard['trigger'], phrase: [string, string, string], en: string, ar: string, more: Partial<CultureCard> = {}): CultureCard => ({ id, trigger, phrase: { ja: phrase[0], en: phrase[1], ar: phrase[2] }, text: { en, ar }, ...more });

export const ES_CULTURE: CultureCard[] = [
  card('cc_dos_besos', { on: 'talk_start', ids: ['lucia'] }, ['¡Hola! ¡Mucho gusto!', 'Hi! Nice to meet you!', 'مرحبًا! تشرّفت!'],
    'Spaniards often greet friends and new acquaintances with two kisses on the cheeks, right then left; many men shake hands with men. If you are not sure, a smile and 「¡Mucho gusto!」 always work.',
    'كثيرًا ما يحيّي الإسبان الأصدقاء ومن يتعرّفون عليهم بقبلتين على الخدّين، اليمين ثم اليسار؛ وكثير من الرجال يصافحون الرجال. إن لم تكن متأكدًا، فابتسامة و«¡Mucho gusto!» تكفيان دائمًا.', { say: true }),
  card('cc_que_te_pongo', { on: 'scenario_done', ids: ['mad_bar'] }, ['¿Me pones un café con leche?', 'Can I have a milky coffee?', 'هل تعطيني قهوة بالحليب؟'],
    'In a Madrid bar the waiter asks 「¿Qué te pongo?」 (what shall I put out for you?) and you answer 「Ponme un café」 or 「¿Me pones un café?」. Tú is normal at the bar, whoever you are.',
    'في بارات مدريد يسألك النادل «¿Qué te pongo?» (ماذا أضع لك؟) فتجيب «Ponme un café» أو «¿Me pones un café?». مخاطبة النادل بـ tú أمر عادي في البار، أيًّا كنت.', { say: true }),
  card('cc_propina', { on: 'payment', ids: ['bar'] }, ['Quédese con el cambio.', 'Keep the change.', 'احتفظ بالباقي.'],
    'Tipping is small in Spain: round up, or leave the coins of the change on the little plate. Cards are taken almost everywhere, even for a coffee.',
    'البقشيش قليل في إسبانيا: قرّب المبلغ، أو اترك قطع الباقي المعدنية في الصحن الصغير. وتُقبل البطاقة في كل مكان تقريبًا، حتى لثمن قهوة.', { say: true }),
  card('cc_barra', { on: 'scenario_done', ids: ['mad_panaderia'] }, ['Una barra de pan, por favor.', 'A baguette, please.', 'رغيف خبز من فضلك.'],
    'Many Spaniards buy fresh bread every day: a barra, a long loaf, from the panadería in the morning. Some ask for it 「poco hecha」 or 「bien hecha」, lightly or well baked.',
    'يشتري كثير من الإسبان الخبز طازجًا كل يوم: «بارّا»، رغيف طويل، من المخبز صباحًا. وبعضهم يطلبه «قليل الخَبز» أو «جيّد الخَبز».', { say: true }),
  card('cc_churros', { on: 'scenario_done', ids: ['mad_churreria'] }, ['¡Chocolate con churros!', 'Hot chocolate with churros!', 'شوكولاتة مع «تشوروس»!'],
    'Chocolate con churros is Madrid’s classic: for breakfast, on a Sunday, or at dawn after a long night out. Porras are the thick ones, Madrid’s own, and the chocolate is thick enough to dip them in.',
    'الشوكولاتة مع «التشوروس» من كلاسيكيات مدريد: في الفطور، أو يوم الأحد، أو عند الفجر بعد سهرة طويلة. و«البوراس» هي السميكة، خاصة بمدريد، والشوكولاتة كثيفة بما يكفي لغمسها فيها.', { say: true }),
  card('cc_metro', { on: 'scenario_done', ids: ['mad_metro'] }, ['Un billete de diez viajes, por favor.', 'A ten-journey ticket, please.', 'تذكرة عشر رحلات من فضلك.'],
    'Madrid’s Metro tickets live on a travel card, the Tarjeta Multi: you load single tickets or ten journeys onto it, and touch it at the turnstiles on the way in.',
    'تُحمَّل تذاكر مترو مدريد على بطاقة نقل اسمها «تارخيتا مولتي»: تحمّل عليها تذاكر مفردة أو عشر رحلات، وتمرّرها عند البوابات وأنت تدخل.'),
  card('cc_ultimo', { on: 'scenario_done', ids: ['mad_mercado'] }, ['¿Quién es el último?', 'Who is last (in the queue)?', 'من آخر واحد (في الدور)؟'],
    'At a Spanish market stall the queue is often invisible. When you arrive, ask 「¿Quién es el último?」 (who is last?): you go after that person. Fruit is sold by the kilo, medio kilo or un kilo.',
    'عند أكشاك الأسواق الإسبانية يكون الدور غالبًا غير ظاهر. حين تصل اسأل «¿Quién es el último?» (من الأخير؟): ودورك بعده. وتُباع الفاكهة بالكيلو، نصف كيلو أو كيلو.', { say: true }),
  card('cc_futbol', { on: 'talk_start', ids: ['javi'] }, ['¿Eres del Madrid o del Atleti?', 'Are you for Real Madrid or Atleti?', 'هل تشجّع ريال مدريد أم أتلتيكو؟'],
    'Madrid has two big football clubs: Real Madrid, in white, and Atlético de Madrid, Atleti, in red and white. On derby night the bars are full and the whole street watches.',
    'في مدريد ناديان كبيران لكرة القدم: ريال مدريد بالأبيض، وأتلتيكو مدريد («أتلتي») بالأحمر والأبيض. في ليلة الديربي تمتلئ البارات ويتابع الشارع كله.', { say: true }),
  card('cc_tu_usted', { on: 'talk_start', ids: ['nadia'] }, ['¿Cómo te llamas?', 'What’s your name? (informal)', 'ما اسمك؟ (غير رسمي)'],
    'Spanish has two yous: tú and usted. Madrid says tú almost everywhere, in bars, in shops and with people your age. Usted is for older people, officials and formal places, and it is never wrong.',
    'في الإسبانية صيغتان للمخاطَب: tú وusted. أهل مدريد يقولون tú في كل مكان تقريبًا: في البارات والمحلات ومع من في سنّك. أما usted فلكبار السن والمسؤولين والأماكن الرسمية، ولا تكون خطأً أبدًا.'),
  card('cc_horarios', { on: 'scenario_done', ids: ['mad_javi'] }, ['¡Hasta luego!', 'See you later!', 'إلى اللقاء!'],
    'Madrid eats late: lunch at two or three, dinner at nine or ten, and a match or a night out starts even later. 「¡Hasta luego!」 is the everyday goodbye, even when you will not see the person later.',
    'مدريد تأكل متأخرة: الغداء في الثانية أو الثالثة، والعشاء في التاسعة أو العاشرة، والمباراة أو السهرة تبدأ أبعد من ذلك. و«¡Hasta luego!» هي تحية الوداع اليومية، حتى لو لن ترى الشخص لاحقًا.', { say: true }),
  // Spanish step 4: Chapters 4-6
  card('cc_farmacia', { on: 'scenario_done', ids: ['mad_farmacia'] }, ['¡Que se mejore!', 'Get well soon!', 'أتمنى لك الشفاء العاجل!'],
    'Spanish pharmacies, with their green cross, are where people go first: the pharmacist advises on a sore throat or a cold. Some medicines sold in supermarkets elsewhere are only sold here, and there is always one open at night, the farmacia de guardia.',
    'الصيدليات الإسبانية، بصليبها الأخضر، هي أول ما يقصده الناس: الصيدلي ينصح في التهاب الحلق أو الزكام. بعض الأدوية التي تُباع في المتاجر في بلدان أخرى لا تُباع هنا إلا في الصيدلية، وهناك دائمًا صيدلية مفتوحة ليلًا: «صيدلية المناوبة».', { say: true }),
  card('cc_tortilla', { on: 'scenario_done', ids: ['hang_lucia_tortilla'] }, ['¿Con cebolla o sin cebolla?', 'With onion or without?', 'بالبصل أم بدونه؟'],
    'The tortilla de patatas, a thick omelette of potatoes and eggs, is everywhere in Spain, and so is the great debate: with onion or without? Everyone has an opinion and every family its recipe. Flipping it with a plate takes courage.',
    '«تورتيا» البطاطا، عجّة سميكة من البطاطا والبيض، موجودة في كل مكان في إسبانيا، ومعها الجدل الكبير: بالبصل أم بدونه؟ لكلٍّ رأيه، ولكل عائلة وصفتها. وقلبها بالصحن يحتاج إلى شجاعة.', { say: true }),
  card('cc_partido', { on: 'scenario_done', ids: ['hang_javi_partido'] }, ['¡Gol!', 'Goal!', 'هدف!'],
    'Many Spaniards watch the big matches at the bar, with friends and neighbours: the bar is full, everyone argues with the referee, and strangers celebrate a goal together.',
    'كثير من الإسبان يشاهدون المباريات الكبيرة في البار مع الأصدقاء والجيران: البار ممتلئ، والجميع يجادل الحكم، والغرباء يحتفلون بالهدف معًا.', { say: true }),
  card('cc_retiro', { on: 'scenario_done', ids: ['hang_nadia_retiro'] }, ['Perdone, ¿nos puede hacer una foto?', 'Excuse me, could you take a photo of us?', 'عفوًا، هل يمكنك أن تلتقط لنا صورة؟'],
    'El Retiro is Madrid’s great park, once a royal garden: rowing boats on the lake, a glass palace, musicians on Sundays. To ask a stranger a favour, 「Perdone」 and usted are the polite way, even in a city that says tú to everyone.',
    '«الريتيرو» حديقة مدريد الكبرى، وكانت حديقة ملكية: قوارب على البحيرة، وقصر من زجاج، وموسيقيون أيام الأحد. ولتطلب خدمة من غريب، «Perdone» وصيغة usted هما الطريقة المهذبة، حتى في مدينة تخاطب الجميع بـ tú.', { say: true }),
  card('cc_tapas', { on: 'intent', ids: ['mad_taberna:salud'] }, ['¡Salud!', 'Cheers!', 'في صحتك!'],
    'In many Madrid bars a small tapa comes free with your drink: olives, crisps, a bit of tortilla. A ración is a bigger plate to share. You usually pay at the end: 「¿Me cobras?」 or 「La cuenta, por favor」. Mosto, grape juice, is the classic drink without alcohol.',
    'في كثير من بارات مدريد يأتي مع مشروبك طبق صغير مجاني («تابا»): زيتون، رقائق بطاطا، قطعة «تورتيا». و«الراثيون» طبق أكبر للمشاركة. وعادةً تدفع في النهاية: «¿Me cobras?» أو «La cuenta, por favor». و«الموستو»، عصير العنب، هو المشروب الكلاسيكي بلا كحول.', { say: true }),
  card('cc_padron', { on: 'scenario_done', ids: ['mad_padron'] }, ['Quiero empadronarme.', 'I’d like to register on the padrón.', 'أودّ التسجيل في سجل السكان.'],
    'Everyone who lives in Spain registers their address with the town hall: the padrón. You need it for the health card, for school and for many other papers. Book a cita previa online and bring your passport and your rental contract.',
    'كل من يسكن في إسبانيا يسجّل عنوانه لدى البلدية: «البادرون» (سجل السكان). تحتاجه لبطاقة الصحة وللمدرسة ولكثير من الأوراق الأخرى. احجز موعدًا مسبقًا عبر الإنترنت وأحضر جواز سفرك وعقد الإيجار.', { say: true }),
];

export const ES_DAILY: DailyTemplate[] = [
  { id: 'g_conv2', slot: 'speak', counter: 'conv_distinct', target: 2, text: { en: 'Finish 2 different conversations', ar: 'أنهِ محادثتين مختلفتين' } },
  { id: 'g_indep6', slot: 'speak', counter: 'indep_lines', target: 6, text: { en: 'Say 6 lines in your own words', ar: 'قل 6 جمل بكلماتك أنت' } },
  { id: 'g_newphrase2', slot: 'speak', counter: 'new_intents', target: 2, text: { en: 'Use 2 new ways of saying things', ar: 'استخدم طريقتين جديدتين للتعبير' } },
  { id: 'g_buy', slot: 'do', counter: 'purchase', target: 1, requires: { chapter: 1 }, text: { en: 'Buy something in Spanish', ar: 'اشترِ شيئًا باللغة الإسبانية' } },
  { id: 'g_friend', slot: 'do', counter: 'friend_contact', target: 1, requires: { chapter: 2, friends: true }, text: { en: 'Spend time with a friend', ar: 'اقضِ وقتًا مع صديق' } },
  { id: 'g_place', slot: 'do', counter: 'places_distinct', target: 2, text: { en: 'Talk to people in 2 different places', ar: 'تحدّث مع أشخاص في مكانين مختلفين' } },
  { id: 'g_review8', slot: 'review', counter: 'review_checked', target: 8, requires: { vocabCards: true }, text: { en: 'Review 8 words that are due', ar: 'راجع 8 كلمات مستحقة' } },
  { id: 'g_culture', slot: 'review', counter: 'culture_new', target: 1, requires: { unseenCulture: true }, text: { en: 'Learn one new thing about Madrid', ar: 'تعلّم شيئًا جديدًا عن مدريد' } },
];

/** tag -> dictionary words (the dream's 「5 words for getting around」 and the review weighting read them) */
export const ES_WORD_TAGS: Record<string, string[]> = {
  transport: ['metro', 'billete', 'sencillo', 'viajes', 'tarjeta', 'tornos'],
  numbers: ['uno', 'dos', 'tres', 'cuatro', 'diez', 'doce'],
  cafe: ['café', 'leche', 'cortado', 'tostada', 'chocolate', 'churros'],
};
