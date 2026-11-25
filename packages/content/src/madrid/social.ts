// Madrid's friends, after the first meeting (Spanish step 3): the hand-over of a present (`give_gift`) and a chat on any day
// (`smalltalk_<friend>`), in tú. The shape is shared with Berlin and Amsterdam (../friendtalk.ts); these are the Spanish lines. Nothing in
// them guesses the player's gender (「Eres un sol」, never 「eres muy amable」 with an ending to choose).
import type { Line } from '../types';
import { L, S } from '../tokyo/dsl';
import { buildGiveGift, buildSmalltalk, type FriendTopic } from '../friendtalk';
import { ES_FRIENDS } from './game/people';

type Friend = 'lucia' | 'javi' | 'nadia';
export const ES_SMALLTALK_FRIENDS: readonly Friend[] = ['lucia', 'javi', 'nadia'];

const BYE = ['adios', 'chao', 'hasta luego', 'hasta manana', 'hasta pronto', 'nos vemos', 'gracias', 'vale', 'si', 'genial', 'igualmente', 'un beso', 'besos'];
const END = L('¡Chao, {name}!', 'Bye, {name}!', 'إلى اللقاء يا {name}!');

export const ES_GIVE_GIFT = buildGiveGift({
  locationId: 'mad_piso',
  characterId: 'lucia',
  setup: { en: 'Hand your friend a present. Say what it is: Tengo … para ti.', ar: 'قدّم لصديقك هدية. قل ما هي: «Tengo … para ti».' },
  start: L('¡Hola, {name}! ¿Qué pasa?', 'Hi, {name}! What’s up?', 'أهلًا يا {name}! ما الأخبار؟'),
  chips: [
    S('¡Tengo {gift} para ti!', 'I have {gift} for you!', 'لديّ {gift} لك!'),
    S('Toma, {gift}. ¡Para ti!', 'Here, {gift}. For you!', 'تفضّل، {gift}. لك!'),
    S('¡Toma, un regalito!', 'Here, a little present!', 'تفضّل، هدية صغيرة!'),
  ],
  giveWords: ['para ti', 'regalo', 'regalito', 'toma', 'te he traido', 'te traigo'],
  ideal: L('Tengo {giftItem} para ti.', 'I have {giftItem} for you.', 'لديّ {giftItem} لك.'),
  react: {
    loved: L('¿En serio? ¡Qué ilusión! ¡Muchísimas gracias!', 'Really? How exciting! Thank you so much!', 'حقًا؟ يا للفرحة! شكرًا جزيلًا!'),
    liked: L('¡Ay, gracias! ¡Qué detalle!', 'Oh, thanks! How thoughtful!', 'آه، شكرًا! يا لها من لفتة لطيفة!'),
    neutral: L('Gracias.', 'Thank you.', 'شكرًا.'),
    disliked: L('Ah. Bueno, gracias.', 'Oh. Well, thanks.', 'آه. حسنًا، شكرًا.'),
  },
  replyChips: [S('¡De nada!', 'You’re welcome!', 'عفوًا!'), S('¡Me alegro de que te guste!', 'I’m glad you like it!', 'يسعدني أنه أعجبك!')],
  replyKeys: ['de nada', 'me alegro', 'nada', 'no hay de que', 'a ti', 'un placer', 'si', 'claro', 'espero'],
  thanks: L('¡Gracias, {name}! Eres un sol.', 'Thanks, {name}! You’re a sweetheart.', 'شكرًا يا {name}! أنت لطيف جدًا.'),
  thanksChips: [S('¡Hasta luego!', 'See you later!', 'إلى اللقاء!'), S('¡Chao!', 'Bye!', 'باي!')],
  bye: BYE,
  end: END,
  endChips: [S('¡Chao!', 'Bye!', 'باي!')],
});

const OWN_WEEKEND: Record<Friend, Line> = {
  lucia: L('¡Qué bien! Yo el sábado voy al Retiro.', 'Nice! On Saturday I’m going to the Retiro.', 'جميل! يوم السبت سأذهب إلى حديقة «الريتيرو».'),
  javi: L('¡Qué bien! Yo el domingo voy al fútbol.', 'Nice! On Sunday I’m going to the football.', 'جميل! يوم الأحد سأذهب لمشاهدة كرة القدم.'),
  nadia: L('¡Qué bien! Yo el domingo llamo a mi familia.', 'Nice! On Sunday I’m calling my family.', 'جميل! يوم الأحد سأتصل بعائلتي.'),
};
const OWN_FOOD: Record<Friend, Line> = {
  lucia: L('¡Qué rico! A mí me encanta el gazpacho.', 'Yummy! I love gazpacho.', 'لذيذ! أحب «الغاسباتشو» كثيرًا.'),
  javi: L('¡Qué rico! Yo soy más de cocido.', 'Yummy! I’m more of a cocido person.', 'لذيذ! أنا أفضّل «الكوسيدو».'),
  nadia: L('¡Qué rico! A mí me encanta el cuscús de mi madre.', 'Yummy! I love my mum’s couscous.', 'لذيذ! أحب كسكس أمي كثيرًا.'),
};

export const ES_TOPICS: FriendTopic[] = [
  {
    id: 'weather',
    ask: L('¡Qué buen día hace hoy! ¿Vas a dar un paseo?', 'What a nice day today! Are you going for a walk?', 'ما أجمل الطقس اليوم! هل ستتمشى؟'),
    chips: [S('Sí, voy a dar un paseo.', 'Yes, I’m going for a walk.', 'نعم، سأتمشى.'), S('No, me quedo en casa.', 'No, I’m staying at home.', 'لا، سأبقى في البيت.')],
    keys: ['paseo', 'pasear', 'voy', 'me quedo', 'quedo', 'casa', 'retiro', 'parque', 'calor', 'frio', 'lluvia', 'llueve', 'sol'],
    react: L('¡Vale! ¡Disfruta del día!', 'Okay! Enjoy the day!', 'حسنًا! استمتع بيومك!'),
  },
  {
    id: 'weekend',
    ask: L('¿Qué vas a hacer este fin de semana?', 'What are you doing this weekend?', 'ماذا ستفعل في عطلة نهاية الأسبوع هذه؟'),
    chips: [S('Voy a ver a unos amigos.', 'I’m going to see some friends.', 'سألتقي ببعض الأصدقاء.'), S('Voy a descansar.', 'I’m going to rest.', 'سأرتاح.')],
    keys: ['voy', 'amigos', 'descansar', 'descanso', 'dormir', 'compras', 'cine', 'parque', 'trabajar', 'nada', 'cocinar', 'salir', 'rastro'],
    react: (f) => OWN_WEEKEND[f as Friend],
  },
  {
    id: 'food',
    ask: L('¿Cuál es tu comida favorita?', 'What’s your favourite food?', 'ما طعامك المفضل؟'),
    chips: [S('Me encanta la paella.', 'I love paella.', 'أحب الباييا كثيرًا.'), S('Me gusta mucho la tortilla.', 'I really like tortilla.', 'أحب «التورتيا» كثيرًا.')],
    keys: ['me gusta', 'me encanta', 'comida', 'favorita', 'como'],
    react: (f) => OWN_FOOD[f as Friend],
    remember: { id: 'food_named', slot: 'chatfood', slotRequired: true, next: 'f_food', step: 'answer', remember: { fact: 'favFood', from: 'slot' } },
  },
  {
    id: 'music',
    ask: L('¿Qué música te gusta?', 'What music do you like?', 'ما الموسيقى التي تحبها؟'),
    chips: [S('Me gusta el pop.', 'I like pop.', 'أحب البوب.'), S('Escucho de todo.', 'I listen to everything.', 'أستمع إلى كل شيء.')],
    keys: ['pop', 'rock', 'jazz', 'rap', 'flamenco', 'reggaeton', 'clasica', 'escucho', 'de todo', 'musica'],
    react: L('¡Mola! Un día escuchamos música juntos.', 'Cool! Let’s listen to music together one day.', 'رائع! لنستمع إلى الموسيقى معًا يومًا ما.'),
  },
  {
    id: 'travel',
    ask: L('¿Adónde te gustaría viajar?', 'Where would you like to travel?', 'إلى أين تودّ أن تسافر؟'),
    chips: [S('Me gustaría ir a Barcelona.', 'I’d like to go to Barcelona.', 'أودّ الذهاب إلى برشلونة.'), S('Quiero ir a la playa.', 'I want to go to the beach.', 'أريد الذهاب إلى الشاطئ.')],
    keys: ['me gustaria', 'quiero', 'ir a', 'barcelona', 'sevilla', 'granada', 'valencia', 'playa', 'montana', 'viajar'],
    react: L('¡Qué bonito! Yo también quiero ir algún día.', 'How lovely! I want to go there one day too.', 'ما أجمل ذلك! أريد أن أذهب إلى هناك يومًا ما أيضًا.'),
  },
  {
    id: 'study',
    ask: L('¿Qué tal tu español?', 'How’s your Spanish going?', 'كيف حال لغتك الإسبانية؟'),
    chips: [S('Bien, estudio todos los días.', 'Good, I study every day.', 'جيدة، أدرس كل يوم.'), S('Es difícil, pero me gusta.', 'It’s hard, but I like it.', 'إنها صعبة، لكنني أحبها.')],
    keys: ['estudio', 'dificil', 'facil', 'todos los dias', 'poco a poco', 'mejor', 'bien', 'me gusta'],
    react: L('¡Genial! ¡Ya hablas muy bien!', 'Great! You already speak really well!', 'رائع! أنت تتكلم جيدًا حقًا!'),
  },
  {
    id: 'sports',
    ask: L('¿Haces deporte?', 'Do you do any sport?', 'هل تمارس الرياضة؟'),
    chips: [S('Sí, corro en el Retiro.', 'Yes, I run in the Retiro.', 'نعم، أركض في حديقة «الريتيرو».'), S('No, no mucho.', 'No, not much.', 'لا، ليس كثيرًا.')],
    keys: ['deporte', 'corro', 'correr', 'futbol', 'nado', 'nadar', 'gimnasio', 'yoga', 'bici', 'no'],
    react: L('¡Genial! Un día podemos ir juntos.', 'Great! We can go together one day.', 'رائع! يمكننا أن نذهب معًا يومًا ما.'),
    remember: { id: 'hobby_named', slot: 'hobby', slotOptions: ['sports'], slotRequired: true, next: 'f_sports', step: 'answer', remember: { fact: 'hobby', from: 'slot' } },
  },
  {
    id: 'movies',
    ask: L('¿Has visto alguna película buena?', 'Have you seen a good film?', 'هل شاهدت فيلمًا جيدًا؟'),
    chips: [S('Sí, una muy buena.', 'Yes, a really good one.', 'نعم، فيلمًا جيدًا جدًا.'), S('No, no tengo tiempo.', 'No, I don’t have time.', 'لا، ليس لديّ وقت.')],
    keys: ['pelicula', 'peli', 'cine', 'serie', 'tiempo', 'visto', 'buena'],
    react: L('¡Un día vamos juntos al cine!', 'Let’s go to the cinema together one day!', 'لنذهب إلى السينما معًا يومًا ما!'),
  },
  // friend-specific (the picker weighs a friend's own topics higher)
  {
    id: 'lucia_sevilla',
    only: 'lucia',
    ask: L('¿Has estado en Sevilla?', 'Have you been to Seville?', 'هل زرت إشبيلية؟'),
    chips: [S('No, todavía no.', 'No, not yet.', 'لا، ليس بعد.'), S('Sí, ¡es preciosa!', 'Yes, it’s beautiful!', 'نعم، إنها جميلة جدًا!')],
    keys: ['todavia', 'nunca', 'estado', 'preciosa', 'bonita', 'sevilla', 'quiero ir'],
    react: L('¡Tienes que ir! En primavera huele a azahar.', 'You have to go! In spring it smells of orange blossom.', 'يجب أن تذهب! في الربيع تفوح منها رائحة زهر البرتقال.'),
  },
  {
    id: 'javi_guitar',
    only: 'javi',
    ask: L('¿Tocas algún instrumento?', 'Do you play an instrument?', 'هل تعزف على آلة موسيقية؟'),
    chips: [S('Sí, toco el piano.', 'Yes, I play the piano.', 'نعم، أعزف على البيانو.'), S('No, pero me gustaría.', 'No, but I’d like to.', 'لا، لكنني أودّ ذلك.')],
    keys: ['toco', 'piano', 'guitarra', 'violin', 'tambor', 'oud', 'laud', 'me gustaria', 'nada'],
    react: L('¡Mola! Un día hacemos música en mi balcón.', 'Cool! One day we’ll make music on my balcony.', 'رائع! يومًا ما نعزف الموسيقى على شرفتي.'),
  },
  {
    id: 'nadia_arabic',
    only: 'nadia',
    ask: L('¿Me enseñas una palabra en árabe?', 'Will you teach me a word in Arabic?', 'هل تعلّمني كلمة بالعربية؟'),
    chips: [S('Marhaba significa hola.', 'Marhaba means hello.', '«مرحبا» تعني hola.'), S('Shukran significa gracias.', 'Shukran means thank you.', '«شكرًا» تعني gracias.')],
    keys: ['marhaba', 'shukran', 'significa', 'salam', 'habibi', 'yalla'],
    react: L('¡Genial! Lo apunto ahora mismo.', 'Great! I’ll write it down right now.', 'رائع! سأكتبها الآن.'),
  },
];

/** the greeting's callbacks (the app's CALLBACK_KEYS): a remembered hobby, a favourite food, the player's dream */
const CALLBACKS: Record<string, Line> = {
  hobby: L('¡Hola, {name}! ¿Todavía te gusta {hobby}?', 'Hi, {name}! Do you still like {hobby}?', 'أهلًا يا {name}! هل ما زلت تحب {hobby}؟'),
  food: L('¡Hola, {name}! ¿Has comido {food} esta semana?', 'Hi, {name}! Have you had {food} this week?', 'أهلًا يا {name}! هل أكلت {food} هذا الأسبوع؟'),
  dream: L('¡Hola, {name}! ¿Qué tal va tu sueño?', 'Hi, {name}! How’s your dream going?', 'أهلًا يا {name}! كيف يسير حلمك؟'),
};
export const ES_SMALLTALK_CALLBACKS = Object.keys(CALLBACKS);

export const ES_SMALLTALK = ES_SMALLTALK_FRIENDS.map((f) =>
  buildSmalltalk(
    {
      home: { lucia: 'mad_piso', javi: 'mad_plaza', nadia: 'mad_intercambio' },
      hello: L('¡Hola, {name}! ¿Qué tal?', 'Hi, {name}! How are you?', 'أهلًا يا {name}! كيف حالك؟'),
      callbacks: CALLBACKS,
      greetChips: [S('¡Hola! Bien, gracias.', 'Hi! Fine, thanks.', 'أهلًا! بخير، شكرًا.'), S('¡Hola! Genial, ¿y tú?', 'Hi! Great, and you?', 'أهلًا! رائع، وأنت؟')],
      helloKeys: ['hola', 'buenas', 'bien', 'genial', 'gracias', 'fenomenal', 'todo bien'],
      // an answer to the callback (「¡Sí, todavía!」, 「Sí, ayer!」)
      cbKeys: ['si', 'no', 'todavia', 'claro', 'sigo', 'ayer', 'hoy', 'mucho', 'poco', 'va bien', 'despacio', 'aun no', 'esta semana'],
      common: ['si', 'no', 'claro', 'bien', 'a veces', 'siempre', 'nunca', 'mucho', 'no se', 'ni idea'],
      unsure: ['no se', 'no lo se', 'ni idea', 'quizas', 'tal vez', 'depende'],
      reactChips: [S('¿En serio? ¡Qué bien!', 'Really? How nice!', 'حقًا؟ ما أجمل ذلك!'), S('¡Yo también!', 'Me too!', 'وأنا أيضًا!')],
      reactKeys: ['en serio', 'que bien', 'yo tambien', 'genial', 'guay', 'que guay', 'interesante', 'si', 'claro', 'vale', 'me encanta', 'que bonito', 'que rico', 'exacto', 'mola'],
      close: L('¡Me ha encantado charlar contigo! ¡Hasta mañana!', 'I loved chatting with you! See you tomorrow!', 'سعدت كثيرًا بالدردشة معك! أراك غدًا!'),
      closeChips: [S('¡Hasta mañana!', 'See you tomorrow!', 'أراك غدًا!'), S('¡Chao!', 'Bye!', 'باي!')],
      bye: BYE,
      end: END,
      endChips: [S('¡Chao!', 'Bye!', 'باي!')],
      topics: ES_TOPICS,
      factLines: Object.fromEntries(ES_FRIENDS.map((x) => [x.id, x.factLines ?? {}])),
      setup: { en: 'A chat with a friend. Say hello, answer the question of the day and react to what they say.', ar: 'دردشة مع صديق. قل مرحبًا وأجب عن سؤال اليوم وعلّق على ما يقوله.' },
    },
    f,
  ),
);
