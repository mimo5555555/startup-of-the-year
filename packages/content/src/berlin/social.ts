// Berlin's friends, after the first meeting (German step 5): the hand-over of a present (`give_gift`) and a chat on any day
// (`smalltalk_<friend>`), in du. The shape is shared with Amsterdam (../friendtalk.ts); these are the German lines.
import type { Line } from '../types';
import { L, S } from '../tokyo/dsl';
import { buildGiveGift, buildSmalltalk, type FriendTopic } from '../friendtalk';
import { DE_FRIENDS } from './game/people';

type Friend = 'lena' | 'kofi' | 'jonas';
export const DE_SMALLTALK_FRIENDS: readonly Friend[] = ['lena', 'kofi', 'jonas'];

const BYE = ['tschüss', 'tschuss', 'bis morgen', 'bis bald', 'bis dann', 'ciao', 'danke', 'gern', 'gerne', 'ja', 'super', 'schön', 'mach', 'gut'];
const END = L('Tschüss, {name}!', 'Bye, {name}!', 'إلى اللقاء يا {name}!');

export const DE_GIVE_GIFT = buildGiveGift({
  locationId: 'berlin_wg',
  characterId: 'lena',
  setup: { en: 'Hand your friend a present. Say what it is: Ich habe … für dich.', ar: 'قدّم لصديقك هدية. قل ما هي: «Ich habe … für dich».' },
  start: L('Hey {name}! Was gibt es?', 'Hey {name}! What’s up?', 'أهلًا يا {name}! ما الأخبار؟'),
  chips: [
    S('Ich habe {gift} für dich!', 'I have {gift} for you!', 'لديّ {gift} لك!'),
    S('Hier, {gift}. Für dich!', 'Here, {gift}. For you!', 'تفضّل، {gift}. لك!'),
    S('Hier, ein kleines Geschenk!', 'Here, a little present!', 'تفضّل، هدية صغيرة!'),
  ],
  giveWords: ['für dich', 'geschenk', 'hier', 'bitte schön', 'bitteschön', 'schenke', 'nimm'],
  ideal: L('Ich habe {giftItem} für dich.', 'I have {giftItem} for you.', 'لديّ {giftItem} لك.'),
  react: {
    loved: L('Echt? Wie toll! Vielen Dank!', 'Really? How wonderful! Thank you so much!', 'حقًا؟ ما أروع ذلك! شكرًا جزيلًا!'),
    liked: L('Oh, danke! Das freut mich!', 'Oh, thanks! That makes me happy!', 'أوه، شكرًا! هذا يسعدني!'),
    neutral: L('Danke schön.', 'Thank you.', 'شكرًا لك.'),
    disliked: L('Oh. Na ja, danke.', 'Oh. Well, thanks.', 'أوه. حسنًا، شكرًا.'),
  },
  replyChips: [S('Gern geschehen!', 'You’re welcome!', 'عفوًا!'), S('Das freut mich!', 'I’m glad!', 'يسعدني ذلك!')],
  replyKeys: ['gern', 'gerne', 'freut', 'bitte', 'kein problem', 'schön', 'toll', 'super', 'ja', 'danke', 'hoffe'],
  thanks: L('Danke, {name}! Das ist echt lieb von dir.', 'Thanks, {name}! That’s really sweet of you.', 'شكرًا يا {name}! هذا لطف كبير منك.'),
  thanksChips: [S('Bis bald!', 'See you soon!', 'إلى اللقاء قريبًا!'), S('Tschüss!', 'Bye!', 'باي!')],
  bye: BYE,
  end: END,
  endChips: [S('Tschüss!', 'Bye!', 'باي!')],
});

const OWN_WEEKEND: Record<Friend, Line> = {
  lena: L('Schön! Ich gehe am Samstag ins Museum.', 'Nice! I’m going to a museum on Saturday.', 'جميل! سأذهب إلى المتحف يوم السبت.'),
  kofi: L('Gut! Ich spiele am Samstag Fußball.', 'Good! I’m playing football on Saturday.', 'جيد! سألعب كرة القدم يوم السبت.'),
  jonas: L('Super! Ich fahre am Wochenende an den See.', 'Great! I’m going to the lake at the weekend.', 'رائع! سأذهب إلى البحيرة في عطلة نهاية الأسبوع.'),
};
const OWN_FOOD: Record<Friend, Line> = {
  lena: L('Lecker! Ich liebe Pfannkuchen.', 'Yummy! I love jam doughnuts.', 'لذيذ! أحب الدونات المحشوة.'),
  kofi: L('Lecker! Ich esse am liebsten Reis mit Huhn.', 'Yummy! My favourite is rice with chicken.', 'لذيذ! طعامي المفضل الأرز مع الدجاج.'),
  jonas: L('Lecker! Ich esse am liebsten Falafel.', 'Yummy! My favourite is falafel.', 'لذيذ! طعامي المفضل الفلافل.'),
};

export const DE_TOPICS: FriendTopic[] = [
  {
    id: 'weather',
    ask: L('Schönes Wetter heute, oder? Gehst du spazieren?', 'Nice weather today, isn’t it? Are you going for a walk?', 'الطقس جميل اليوم، أليس كذلك؟ هل ستتمشى؟'),
    chips: [S('Ja, ich gehe spazieren.', 'Yes, I’m going for a walk.', 'نعم، سأتمشى.'), S('Nein, ich bleibe zu Hause.', 'No, I’m staying at home.', 'لا، سأبقى في البيت.')],
    keys: ['spazieren', 'gehe', 'bleibe', 'zu hause', 'wetter', 'regen', 'sonne', 'kalt', 'warm', 'park'],
    react: L('Okay! Genieß den Tag!', 'Okay! Enjoy the day!', 'حسنًا! استمتع بيومك!'),
  },
  {
    id: 'weekend',
    ask: L('Was machst du am Wochenende?', 'What are you doing at the weekend?', 'ماذا ستفعل في عطلة نهاية الأسبوع؟'),
    chips: [S('Ich treffe Freunde.', 'I’m meeting friends.', 'سألتقي بأصدقاء.'), S('Ich ruhe mich aus.', 'I’m having a rest.', 'سأرتاح.')],
    keys: ['treffe', 'freunde', 'ruhe', 'ausruhen', 'einkaufen', 'kino', 'park', 'schlafe', 'arbeite', 'nichts', 'koche'],
    react: (f) => OWN_WEEKEND[f as Friend],
  },
  {
    id: 'food',
    ask: L('Was isst du am liebsten?', 'What do you like eating most?', 'ما أكثر طعام تحب أن تأكله؟'),
    chips: [S('Ich esse gern Pizza.', 'I like eating pizza.', 'أحب أكل البيتزا.'), S('Ich esse am liebsten Döner.', 'My favourite is Döner.', 'طعامي المفضل الدونر.')],
    keys: ['esse', 'essen', 'lecker', 'liebsten'],
    react: (f) => OWN_FOOD[f as Friend],
    remember: { id: 'food_named', slot: 'chatfood', slotRequired: true, next: 'f_food', step: 'answer', remember: { fact: 'favFood', from: 'slot' } },
  },
  {
    id: 'music',
    ask: L('Was für Musik hörst du gern?', 'What kind of music do you like listening to?', 'ما نوع الموسيقى التي تحب أن تسمعها؟'),
    chips: [S('Ich höre gern Pop.', 'I like listening to pop.', 'أحب سماع البوب.'), S('Ich höre alles Mögliche.', 'I listen to all sorts.', 'أستمع إلى كل الأنواع.')],
    keys: ['höre', 'hore', 'musik', 'pop', 'rock', 'jazz', 'rap', 'techno', 'klassik', 'alles'],
    react: L('Cool! Lass uns mal zusammen Musik hören.', 'Cool! Let’s listen to music together sometime.', 'رائع! لنستمع إلى الموسيقى معًا يومًا ما.'),
  },
  {
    id: 'travel',
    ask: L('Wohin möchtest du mal reisen?', 'Where would you like to travel one day?', 'إلى أين تودّ أن تسافر يومًا ما؟'),
    chips: [S('Ich möchte nach München.', 'I’d like to go to Munich.', 'أودّ الذهاب إلى ميونخ.'), S('Ich möchte ans Meer.', 'I’d like to go to the sea.', 'أودّ الذهاب إلى البحر.')],
    keys: ['möchte', 'mochte', 'reisen', 'nach', 'meer', 'münchen', 'hamburg', 'paris', 'urlaub', 'berge'],
    react: L('Schön! Da will ich auch mal hin!', 'Nice! I want to go there too one day!', 'جميل! أريد أن أذهب إلى هناك أيضًا يومًا ما!'),
  },
  {
    id: 'study',
    ask: L('Wie läuft es mit dem Deutsch?', 'How is your German going?', 'كيف حال لغتك الألمانية؟'),
    chips: [S('Gut, ich lerne jeden Tag.', 'Good, I study every day.', 'جيدة، أدرس كل يوم.'), S('Es ist schwer, aber es macht Spaß.', 'It’s hard, but it’s fun.', 'إنها صعبة، لكنها ممتعة.')],
    keys: ['lerne', 'schwer', 'spaß', 'spass', 'jeden tag', 'langsam', 'besser', 'gut'],
    react: L('Super! Du sprichst schon richtig gut!', 'Great! You already speak really well!', 'رائع! أنت تتكلّم جيدًا حقًا!'),
  },
  {
    id: 'sports',
    ask: L('Machst du Sport?', 'Do you do any sport?', 'هل تمارس الرياضة؟'),
    chips: [S('Ja, ich jogge gern.', 'Yes, I like jogging.', 'نعم، أحب الجري.'), S('Nein, nicht so viel.', 'No, not much.', 'لا، ليس كثيرًا.')],
    keys: ['sport', 'jogge', 'laufe', 'fußball', 'fussball', 'schwimme', 'yoga', 'fitness', 'nein'],
    react: L('Cool! Sport im Park ist toll.', 'Cool! Sport in the park is great.', 'رائع! الرياضة في الحديقة ممتعة.'),
    remember: { id: 'hobby_named', slot: 'hobby', slotOptions: ['sports'], slotRequired: true, next: 'f_sports', step: 'answer', remember: { fact: 'hobby', from: 'slot' } },
  },
  {
    id: 'movies',
    ask: L('Hast du einen guten Film gesehen?', 'Have you seen a good film?', 'هل شاهدت فيلمًا جيدًا؟'),
    chips: [S('Ja, einen tollen Film!', 'Yes, a great film!', 'نعم، فيلمًا رائعًا!'), S('Nein, ich habe keine Zeit.', 'No, I don’t have time.', 'لا، ليس لديّ وقت.')],
    keys: ['film', 'filme', 'kino', 'gesehen', 'serie', 'zeit'],
    react: L('Lass uns mal zusammen ins Kino gehen!', 'Let’s go to the cinema together sometime!', 'لنذهب إلى السينما معًا يومًا ما!'),
  },
  // friend-specific (the picker weighs a friend's own topics higher)
  {
    id: 'lena_buildings',
    only: 'lena',
    ask: L('Welches Gebäude in Berlin gefällt dir am besten?', 'Which building in Berlin do you like best?', 'أيّ مبنى في برلين يعجبك أكثر؟'),
    chips: [S('Der Fernsehturm!', 'The TV tower!', 'برج التلفزيون!'), S('Das Brandenburger Tor.', 'The Brandenburg Gate.', 'بوابة براندنبورغ.')],
    keys: ['fernsehturm', 'tor', 'brandenburger', 'reichstag', 'gebäude', 'kirche', 'alle'],
    react: L('Gute Wahl! Das zeichne ich auch gern.', 'Good choice! I like drawing that too.', 'اختيار موفّق! أحب رسمه أيضًا.'),
  },
  {
    id: 'kofi_ride',
    only: 'kofi',
    ask: L('Wie fährst du durch Berlin? Mit dem Rad?', 'How do you get around Berlin? By bike?', 'كيف تتنقّل في برلين؟ بالدرّاجة؟'),
    chips: [S('Ja, mit dem Fahrrad!', 'Yes, by bike!', 'نعم، بالدرّاجة!'), S('Nein, mit der U-Bahn.', 'No, by U-Bahn.', 'لا، بالمترو.')],
    keys: ['fahrrad', 'rad', 'u-bahn', 'bus', 'laufe', 'zu fuß', 'zu fuss', 'tram'],
    react: L('Ha! Wenn dein Rad kaputt ist, komm zu mir.', 'Ha! If your bike is broken, come to me.', 'ها! إن تعطّلت درّاجتك فتعال إليّ.'),
  },
  {
    id: 'jonas_arabic',
    only: 'jonas',
    ask: L('Kannst du mir ein arabisches Wort beibringen?', 'Can you teach me an Arabic word?', 'هل تستطيع أن تعلّمني كلمة عربية؟'),
    chips: [S('Marhaba heißt Hallo.', 'Marhaba means hello.', '«مرحبا» تعني Hallo.'), S('Shukran heißt Danke.', 'Shukran means thank you.', '«شكرًا» تعني Danke.')],
    keys: ['marhaba', 'shukran', 'heißt', 'heisst', 'bedeutet', 'salam', 'yalla', 'habibi'],
    react: L('Super! Das schreibe ich mir gleich auf.', 'Great! I’ll write that down right away.', 'رائع! سأكتبها فورًا.'),
  },
];

/** the greeting's callbacks (the app's CALLBACK_KEYS): a remembered hobby, a favourite food, the player's dream */
const CALLBACKS: Record<string, Line> = {
  hobby: L('Hey {name}! Was macht das Hobby? Immer noch {hobby}?', 'Hey {name}! How’s the hobby? Still {hobby}?', 'أهلًا يا {name}! كيف الهواية؟ ما زلت تحب {hobby}؟'),
  food: L('Hey {name}! Hast du diese Woche {food} gegessen?', 'Hey {name}! Did you have {food} this week?', 'أهلًا يا {name}! هل أكلت {food} هذا الأسبوع؟'),
  dream: L('Hey {name}! Und, wie läuft es mit deinem Traum?', 'Hey {name}! So, how’s your dream going?', 'أهلًا يا {name}! كيف يسير حلمك؟'),
};
export const DE_SMALLTALK_CALLBACKS = Object.keys(CALLBACKS);

export const DE_SMALLTALK = DE_SMALLTALK_FRIENDS.map((f) =>
  buildSmalltalk(
    {
      home: { lena: 'berlin_wg', kofi: 'berlin_hof', jonas: 'berlin_cafe' },
      hello: L('Hey {name}! Wie geht es dir?', 'Hey {name}! How are you?', 'أهلًا يا {name}! كيف حالك؟'),
      callbacks: CALLBACKS,
      greetChips: [S('Hallo! Gut, danke!', 'Hi! Good, thanks!', 'أهلًا! بخير، شكرًا!'), S('Hey! Super, und dir?', 'Hey! Great, and you?', 'أهلًا! ممتاز، وأنت؟')],
      helloKeys: ['hallo', 'hey', 'hi', 'moin', 'servus', 'na', 'super', 'gut', 'danke'],
      // an answer to the callback (「Ja, immer noch!」, 「Ja, gestern!」, 「Es geht voran」)
      cbKeys: ['ja', 'nein', 'immer noch', 'gestern', 'heute', 'klar', 'voran', 'langsam', 'leider', 'noch nicht', 'viel'],
      common: ['ja', 'nein', 'gern', 'gerne', 'nicht', 'gut', 'manchmal', 'oft', 'immer', 'weiß nicht', 'keine ahnung'],
      unsure: ['weiß nicht', 'weiss nicht', 'keine ahnung', 'mal sehen', 'vielleicht'],
      reactChips: [S('Echt? Cool!', 'Really? Cool!', 'حقًا؟ رائع!'), S('Ich auch!', 'Me too!', 'وأنا أيضًا!')],
      reactKeys: ['echt', 'cool', 'ich auch', 'toll', 'super', 'schön', 'interessant', 'wirklich', 'ja', 'genau', 'klar', 'gerne', 'gern', 'lecker'],
      close: L('Danke fürs Quatschen! Bis morgen!', 'Thanks for the chat! See you tomorrow!', 'شكرًا على الدردشة! أراك غدًا!'),
      closeChips: [S('Bis morgen!', 'See you tomorrow!', 'أراك غدًا!'), S('Tschüss!', 'Bye!', 'باي!')],
      bye: BYE,
      end: END,
      endChips: [S('Tschüss!', 'Bye!', 'باي!')],
      topics: DE_TOPICS,
      // each friend's facts, as the game pack defines them (FriendDef.factLines): said after a reaction once the friend reveals them
      factLines: Object.fromEntries(DE_FRIENDS.map((x) => [x.id, x.factLines ?? {}])),
      setup: { en: 'A chat with a friend. Say hello, answer the question of the day and react to what they say.', ar: 'دردشة مع صديق. قل مرحبًا وأجب عن سؤال اليوم وعلّق على ما يقوله.' },
    },
    f,
  ),
);
