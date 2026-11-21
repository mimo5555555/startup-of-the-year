// Amsterdam's friends, after the first meeting (Dutch step 4): the hand-over of a present (`give_gift`) and a chat on any day
// (`smalltalk_<friend>`), in je. The shape is shared with Berlin (../friendtalk.ts); these are the Dutch lines.
import type { Line } from '../types';
import { L, S } from '../tokyo/dsl';
import { buildGiveGift, buildSmalltalk, type FriendTopic } from '../friendtalk';
import { NL_FRIENDS } from './game/people';

type Friend = 'sanne' | 'daan' | 'noor';
export const NL_SMALLTALK_FRIENDS: readonly Friend[] = ['sanne', 'daan', 'noor'];

const BYE = ['doei', 'dag', 'tot snel', 'tot morgen', 'tot ziens', 'ciao', 'dank', 'graag', 'ja', 'super', 'leuk', 'goed', 'fijn'];
const END = L('Doei, {name}!', 'Bye, {name}!', 'إلى اللقاء يا {name}!');

export const NL_GIVE_GIFT = buildGiveGift({
  locationId: 'ams_boot',
  characterId: 'sanne',
  setup: { en: 'Hand your friend a present. Say what it is: Ik heb … voor je.', ar: 'قدّم لصديقك هدية. قل ما هي: «Ik heb … voor je».' },
  start: L('Hé {name}! Wat is er?', 'Hey {name}! What’s up?', 'أهلًا يا {name}! ما الأخبار؟'),
  chips: [
    S('Ik heb {gift} voor je!', 'I have {gift} for you!', 'لديّ {gift} لك!'),
    S('Hier, {gift}. Voor jou!', 'Here, {gift}. For you!', 'تفضّل، {gift}. لك!'),
    S('Hier, een klein cadeautje!', 'Here, a little present!', 'تفضّل، هدية صغيرة!'),
  ],
  giveWords: ['voor je', 'voor jou', 'cadeau', 'cadeautje', 'hier', 'alsjeblieft', 'geef'],
  ideal: L('Ik heb {giftItem} voor je.', 'I have {giftItem} for you.', 'لديّ {giftItem} لك.'),
  react: {
    loved: L('Echt? Wat leuk! Heel erg bedankt!', 'Really? How lovely! Thank you so much!', 'حقًا؟ ما أجمل ذلك! شكرًا جزيلًا!'),
    liked: L('Oh, dank je! Wat lief!', 'Oh, thanks! How sweet!', 'أوه، شكرًا! ما ألطفك!'),
    neutral: L('Dank je wel.', 'Thank you.', 'شكرًا لك.'),
    disliked: L('Oh. Nou ja, dank je.', 'Oh. Well, thanks.', 'أوه. حسنًا، شكرًا.'),
  },
  replyChips: [S('Graag gedaan!', 'You’re welcome!', 'عفوًا!'), S('Fijn dat je het leuk vindt!', 'I’m glad you like it!', 'يسعدني أنه أعجبك!')],
  replyKeys: ['graag', 'fijn', 'leuk', 'geen probleem', 'alsjeblieft', 'super', 'ja', 'dank', 'hoop'],
  thanks: L('Dank je, {name}! Dat is echt lief van je.', 'Thanks, {name}! That’s really sweet of you.', 'شكرًا يا {name}! هذا لطف كبير منك.'),
  thanksChips: [S('Tot snel!', 'See you soon!', 'إلى اللقاء قريبًا!'), S('Doei!', 'Bye!', 'باي!')],
  bye: BYE,
  end: END,
  endChips: [S('Doei!', 'Bye!', 'باي!')],
});

const OWN_WEEKEND: Record<Friend, Line> = {
  sanne: L('Leuk! Ik ga zaterdag naar het museum.', 'Nice! I’m going to a museum on Saturday.', 'جميل! سأذهب إلى المتحف يوم السبت.'),
  daan: L('Leuk! Ik ga zondag naar Ajax.', 'Nice! I’m going to see Ajax on Sunday.', 'جميل! سأذهب لمشاهدة أياكس يوم الأحد.'),
  noor: L('Leuk! Ik ga zondag naar mijn oma.', 'Nice! I’m going to my grandma’s on Sunday.', 'جميل! سأزور جدّتي يوم الأحد.'),
};
const OWN_FOOD: Record<Friend, Line> = {
  sanne: L('Lekker! Ik hou van appeltaart.', 'Yummy! I love apple pie.', 'لذيذ! أحب فطيرة التفاح.'),
  daan: L('Lekker! Ik eet het liefst een kroket.', 'Yummy! My favourite is a kroket.', 'لذيذ! طعامي المفضل «الكروكيت».'),
  noor: L('Lekker! Ik eet het liefst stamppot.', 'Yummy! My favourite is stamppot.', 'لذيذ! طعامي المفضل «الستامبوت».'),
};

export const NL_TOPICS: FriendTopic[] = [
  {
    id: 'weather',
    ask: L('Lekker weer vandaag, hè? Ga je wandelen?', 'Nice weather today, isn’t it? Are you going for a walk?', 'الطقس جميل اليوم، أليس كذلك؟ هل ستتمشى؟'),
    chips: [S('Ja, ik ga wandelen.', 'Yes, I’m going for a walk.', 'نعم، سأتمشى.'), S('Nee, ik blijf thuis.', 'No, I’m staying at home.', 'لا، سأبقى في البيت.')],
    keys: ['wandelen', 'ga', 'blijf', 'thuis', 'weer', 'regen', 'zon', 'koud', 'warm', 'park', 'fietsen'],
    react: L('Oké! Geniet van de dag!', 'Okay! Enjoy the day!', 'حسنًا! استمتع بيومك!'),
  },
  {
    id: 'weekend',
    ask: L('Wat ga je dit weekend doen?', 'What are you doing this weekend?', 'ماذا ستفعل في عطلة نهاية الأسبوع هذه؟'),
    chips: [S('Ik zie vrienden.', 'I’m seeing friends.', 'سألتقي بأصدقاء.'), S('Ik ga lekker uitrusten.', 'I’m going to have a good rest.', 'سأرتاح جيدًا.')],
    keys: ['zie', 'vrienden', 'uitrusten', 'rusten', 'winkelen', 'bioscoop', 'park', 'slapen', 'werken', 'niks', 'niets', 'koken'],
    react: (f) => OWN_WEEKEND[f as Friend],
  },
  {
    id: 'food',
    ask: L('Wat eet je het liefst?', 'What do you like eating most?', 'ما أكثر طعام تحب أن تأكله؟'),
    chips: [S('Ik eet graag pizza.', 'I like eating pizza.', 'أحب أكل البيتزا.'), S('Ik eet het liefst pannenkoeken.', 'My favourite is pancakes.', 'طعامي المفضل الفطائر.')],
    keys: ['eet', 'eten', 'lekker', 'liefst'],
    react: (f) => OWN_FOOD[f as Friend],
    remember: { id: 'food_named', slot: 'chatfood', slotRequired: true, next: 'f_food', step: 'answer', remember: { fact: 'favFood', from: 'slot' } },
  },
  {
    id: 'music',
    ask: L('Naar wat voor muziek luister je graag?', 'What kind of music do you like listening to?', 'ما نوع الموسيقى التي تحب أن تسمعها؟'),
    chips: [S('Ik luister graag naar pop.', 'I like listening to pop.', 'أحب سماع البوب.'), S('Ik luister naar van alles.', 'I listen to all sorts.', 'أستمع إلى كل الأنواع.')],
    keys: ['luister', 'muziek', 'pop', 'rock', 'jazz', 'rap', 'techno', 'klassiek', 'alles'],
    react: L('Gaaf! Laten we een keer samen muziek luisteren.', 'Cool! Let’s listen to music together sometime.', 'رائع! لنستمع إلى الموسيقى معًا يومًا ما.'),
  },
  {
    id: 'travel',
    ask: L('Waar wil je graag een keer naartoe?', 'Where would you like to go one day?', 'إلى أين تودّ أن تذهب يومًا ما؟'),
    chips: [S('Ik wil naar Utrecht.', 'I’d like to go to Utrecht.', 'أودّ الذهاب إلى أوترخت.'), S('Ik wil naar de zee.', 'I’d like to go to the sea.', 'أودّ الذهاب إلى البحر.')],
    keys: ['wil', 'naar', 'reizen', 'zee', 'utrecht', 'rotterdam', 'parijs', 'vakantie', 'strand'],
    react: L('Mooi! Daar wil ik ook een keer heen!', 'Nice! I want to go there too one day!', 'جميل! أريد أن أذهب إلى هناك أيضًا يومًا ما!'),
  },
  {
    id: 'study',
    ask: L('Hoe gaat het met je Nederlands?', 'How is your Dutch going?', 'كيف حال لغتك الهولندية؟'),
    chips: [S('Goed, ik leer elke dag.', 'Good, I study every day.', 'جيدة، أدرس كل يوم.'), S('Het is moeilijk, maar het is leuk.', 'It’s hard, but it’s fun.', 'إنها صعبة، لكنها ممتعة.')],
    keys: ['leer', 'moeilijk', 'leuk', 'elke dag', 'langzaam', 'beter', 'goed'],
    react: L('Super! Je spreekt al heel goed!', 'Great! You already speak really well!', 'رائع! أنت تتكلّم جيدًا حقًا!'),
  },
  {
    id: 'sports',
    ask: L('Doe je aan sport?', 'Do you do any sport?', 'هل تمارس الرياضة؟'),
    chips: [S('Ja, ik fiets veel.', 'Yes, I cycle a lot.', 'نعم، أركب الدرّاجة كثيرًا.'), S('Nee, niet zo veel.', 'No, not much.', 'لا، ليس كثيرًا.')],
    keys: ['sport', 'fiets', 'hardlopen', 'voetbal', 'zwem', 'yoga', 'fitness', 'nee'],
    react: L('Gaaf! Sporten in het park is top.', 'Cool! Sport in the park is great.', 'رائع! الرياضة في الحديقة ممتعة.'),
    remember: { id: 'hobby_named', slot: 'hobby', slotOptions: ['sports'], slotRequired: true, next: 'f_sports', step: 'answer', remember: { fact: 'hobby', from: 'slot' } },
  },
  {
    id: 'movies',
    ask: L('Heb je een goede film gezien?', 'Have you seen a good film?', 'هل شاهدت فيلمًا جيدًا؟'),
    chips: [S('Ja, een hele leuke film!', 'Yes, a really nice film!', 'نعم، فيلمًا جميلًا جدًا!'), S('Nee, ik heb geen tijd.', 'No, I don’t have time.', 'لا، ليس لديّ وقت.')],
    keys: ['film', 'films', 'bioscoop', 'gezien', 'serie', 'tijd'],
    react: L('Laten we een keer samen naar de bioscoop gaan!', 'Let’s go to the cinema together sometime!', 'لنذهب إلى السينما معًا يومًا ما!'),
  },
  // friend-specific (the picker weighs a friend's own topics higher)
  {
    id: 'sanne_drawing',
    only: 'sanne',
    ask: L('Teken jij ook weleens?', 'Do you ever draw?', 'هل ترسم أحيانًا؟'),
    chips: [S('Ja, ik teken graag.', 'Yes, I like drawing.', 'نعم، أحب الرسم.'), S('Nee, ik kan niet tekenen.', 'No, I can’t draw.', 'لا، لا أجيد الرسم.')],
    keys: ['teken', 'tekenen', 'schilder', 'kan', 'soms'],
    react: L('Leuk! Dan tekenen we een keer samen op de boot.', 'Nice! Then let’s draw together on the boat sometime.', 'جميل! إذن نرسم معًا على القارب يومًا ما.'),
  },
  {
    id: 'daan_place',
    only: 'daan',
    ask: L('Wat is jouw favoriete plek in Amsterdam?', 'What’s your favourite place in Amsterdam?', 'ما مكانك المفضّل في أمستردام؟'),
    chips: [S('Het Vondelpark!', 'The Vondelpark!', 'حديقة «فوندلبارك»!'), S('De grachten.', 'The canals.', 'القنوات.')],
    keys: ['vondelpark', 'gracht', 'grachten', 'markt', 'park', 'museum', 'boot', 'plek'],
    react: L('Goede keuze! Daar fiets ik elke dag langs.', 'Good choice! I cycle past there every day.', 'اختيار موفّق! أمرّ من هناك بالدرّاجة كل يوم.'),
  },
  {
    id: 'noor_arabic',
    only: 'noor',
    ask: L('Kun je me een Arabisch woord leren?', 'Can you teach me an Arabic word?', 'هل تستطيع أن تعلّمني كلمة عربية؟'),
    chips: [S('Marhaba betekent hallo.', 'Marhaba means hello.', '«مرحبا» تعني hallo.'), S('Shukran betekent dank je.', 'Shukran means thank you.', '«شكرًا» تعني dank je.')],
    keys: ['marhaba', 'shukran', 'betekent', 'salam', 'yalla', 'habibi'],
    react: L('Super! Dat schrijf ik meteen op.', 'Great! I’ll write that down right away.', 'رائع! سأكتبها فورًا.'),
  },
];

/** the greeting's callbacks (the app's CALLBACK_KEYS): a remembered hobby, a favourite food, the player's dream */
const CALLBACKS: Record<string, Line> = {
  hobby: L('Hé {name}! Hoe gaat het met je hobby? Nog steeds {hobby}?', 'Hey {name}! How’s the hobby? Still {hobby}?', 'أهلًا يا {name}! كيف الهواية؟ ما زلت تحب {hobby}؟'),
  food: L('Hé {name}! Heb je deze week {food} gegeten?', 'Hey {name}! Did you have {food} this week?', 'أهلًا يا {name}! هل أكلت {food} هذا الأسبوع؟'),
  dream: L('Hé {name}! En, hoe gaat het met je droom?', 'Hey {name}! So, how’s your dream going?', 'أهلًا يا {name}! كيف يسير حلمك؟'),
};
export const NL_SMALLTALK_CALLBACKS = Object.keys(CALLBACKS);

export const NL_SMALLTALK = NL_SMALLTALK_FRIENDS.map((f) =>
  buildSmalltalk(
    {
      home: { sanne: 'ams_boot', daan: 'ams_straat', noor: 'ams_taalcafe' },
      hello: L('Hé {name}! Hoe gaat het?', 'Hey {name}! How are you?', 'أهلًا يا {name}! كيف حالك؟'),
      callbacks: CALLBACKS,
      greetChips: [S('Hoi! Goed, dank je!', 'Hi! Good, thanks!', 'أهلًا! بخير، شكرًا!'), S('Hé! Super, en met jou?', 'Hey! Great, and you?', 'أهلًا! ممتاز، وأنت؟')],
      helloKeys: ['hoi', 'hallo', 'hé', 'hey', 'goed', 'super', 'dank', 'prima'],
      // an answer to the callback (「Ja, nog steeds!」, 「Ja, gisteren!」)
      cbKeys: ['ja', 'nee', 'nog steeds', 'gisteren', 'vandaag', 'zeker', 'gaat', 'langzaam', 'helaas', 'nog niet', 'veel'],
      common: ['ja', 'nee', 'graag', 'niet', 'goed', 'soms', 'vaak', 'altijd', 'weet niet', 'geen idee'],
      unsure: ['weet niet', 'weet ik niet', 'geen idee', 'misschien'],
      reactChips: [S('Echt? Leuk!', 'Really? Nice!', 'حقًا؟ جميل!'), S('Ik ook!', 'Me too!', 'وأنا أيضًا!')],
      reactKeys: ['echt', 'leuk', 'ik ook', 'top', 'super', 'mooi', 'interessant', 'gaaf', 'ja', 'precies', 'zeker', 'graag', 'lekker', 'tof'],
      close: L('Leuk om even te kletsen! Tot morgen!', 'Nice to have a chat! See you tomorrow!', 'سعدت بالدردشة! أراك غدًا!'),
      closeChips: [S('Tot morgen!', 'See you tomorrow!', 'أراك غدًا!'), S('Doei!', 'Bye!', 'باي!')],
      bye: BYE,
      end: END,
      endChips: [S('Doei!', 'Bye!', 'باي!')],
      topics: NL_TOPICS,
      factLines: Object.fromEntries(NL_FRIENDS.map((x) => [x.id, x.factLines ?? {}])),
      setup: { en: 'A chat with a friend. Say hello, answer the question of the day and react to what they say.', ar: 'دردشة مع صديق. قل مرحبًا وأجب عن سؤال اليوم وعلّق على ما يقوله.' },
    },
    f,
  ),
);
