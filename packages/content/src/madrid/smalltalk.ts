// Madrid's shopkeepers know you (Spanish step 3), as Berlin's and Amsterdam's do: from the second visit they greet you as a regular (flag
// `regular`), and on some visits they make small talk about the season or the weekend (flag `talk_<topic>`, the flags the app sets for
// every city). You answer yes or no (a chip, or your own words), they reply and go back to the shop's own question. Each shop keeps its
// register: Lola at the bar and Rafa at the churrería say tú (「¿Te gusta el verano?」), Carmen, Andrés and Marisa say usted (「¿Le gusta el
// verano?」). The learner's answers need neither.
import type { Line, Scenario } from '../types';
import { L, S } from '../tokyo/dsl';
import { withShopTalk, type ShopTalk, type TalkTopic } from '../shoptalk';

export const MADRID_SHOP_TALK: Record<string, ShopTalk> = {
  mad_bar: {
    regular: L('¡Hola! ¡Otra vez por aquí! ¿Qué te pongo hoy?', 'Hi! Back again! What can I get you today?', 'أهلًا! عدت إلينا مجددًا! ماذا أحضر لك اليوم؟'),
    hello: L('¡Buenos días!', 'Good morning!', 'صباح الخير!'),
    ask: L('Bueno, ¿qué te pongo?', 'So, what can I get you?', 'إذن، ماذا أحضر لك؟'),
  },
  mad_panaderia: {
    regular: L('Buenos días. ¡Qué alegría verle otra vez! ¿Qué desea hoy?', 'Good morning. How lovely to see you again! What would you like today?', 'صباح الخير. ما أسعدني برؤيتك مجددًا! ماذا تريد اليوم؟'),
    hello: L('Buenos días.', 'Good morning.', 'صباح الخير.'),
    ask: L('Bueno, ¿qué desea?', 'So, what would you like?', 'إذن، ماذا تريد؟'),
  },
  mad_mercado: {
    regular: L('¡Buenos días! ¡Usted otra vez por aquí! ¿Qué le pongo hoy?', 'Good morning! You again! What can I get you today?', 'صباح الخير! أنت هنا مجددًا! ماذا أعطيك اليوم؟'),
    hello: L('¡Buenos días!', 'Good morning!', 'صباح الخير!'),
    ask: L('Bueno, ¿qué le pongo?', 'So, what can I get you?', 'إذن، ماذا أعطيك؟'),
  },
  mad_churreria: {
    regular: L('¡Buenas! ¡Tú otra vez! ¿Churros o porras?', 'Hi there! You again! Churros or porras?', 'أهلًا! أنت مجددًا! «تشوروس» أم «بوراس»؟'),
    hello: L('¡Buenas!', 'Hi there!', 'أهلًا!'),
    ask: L('Bueno, ¿churros o porras?', 'So, churros or porras?', 'إذن، «تشوروس» أم «بوراس»؟'),
  },
  mad_metro: {
    regular: L('Buenos días. Me alegro de verle otra vez. ¿En qué puedo ayudarle?', 'Good morning. Nice to see you again. How can I help you?', 'صباح الخير. يسعدني أن أراك مجددًا. كيف أستطيع مساعدتك؟'),
    hello: L('Buenos días.', 'Good morning.', 'صباح الخير.'),
    ask: L('Bueno, ¿en qué puedo ayudarle?', 'So, how can I help you?', 'إذن، كيف أستطيع مساعدتك؟'),
  },
};

/** the shops that say tú; the others say usted */
const TU = new Set(['mad_bar', 'mad_churreria']);

const LIKE_YES = ['si', 'me encanta', 'me gusta', 'encanta', 'claro', 'por supuesto', 'mucho', 'muchisimo', 'precioso', 'bonito', 'genial'];
const LIKE_NO = ['no', 'no mucho', 'no me gusta', 'no tanto', 'demasiado', 'mucho calor', 'mucho frio', 'tengo frio', 'tengo calor', 'odio'];
/** the words that make a yes key a no (「no me gusta mucho」 is never 「mucho」) */
const NEGATIONS = ['no', 'nada', 'nunca', 'tampoco', 'odio'];

/** a line said with tú or usted: the question's verb is the only difference */
const reg = (tu: boolean, t: [string, string], en: string, ar: string): Line => L(tu ? t[0] : t[1], en, ar);

const ME_TOO = L('¡A mí también!', 'Me too!', 'وأنا أيضًا!');
const LOVE_IT = S('¡Sí, me encanta!', 'Yes, I love it!', 'نعم، أحبه كثيرًا!');
const NOT_MUCH = S('No mucho.', 'Not much.', 'ليس كثيرًا.');

/** the topics, by the flags' names (Tokyo's seasons and weekend; June, Tokyo's rainy season, is the start of Madrid's heat) */
function topics(tu: boolean): Record<string, TalkTopic> {
  return {
    spring: {
      remark: reg(tu, ['¡Por fin la primavera! ¿Te gusta la primavera?', '¡Por fin la primavera! ¿Le gusta la primavera?'], 'Spring at last! Do you like spring?', 'أخيرًا الربيع! هل تحب الربيع؟'),
      yes: LOVE_IT,
      no: NOT_MUCH,
      yesReply: ME_TOO,
      noReply: L('Bueno, pronto llega el verano.', 'Well, summer is coming soon.', 'حسنًا، الصيف قادم قريبًا.'),
      yesKeys: LIKE_YES,
      noKeys: LIKE_NO,
    },
    rainy: {
      remark: reg(tu, ['Ya empieza el calor. ¿Te gusta el verano?', 'Ya empieza el calor. ¿Le gusta el verano?'], 'The heat is starting. Do you like summer?', 'بدأ الحرّ. هل تحب الصيف؟'),
      yes: LOVE_IT,
      no: NOT_MUCH,
      yesReply: ME_TOO,
      noReply: L('Bueno, cada uno tiene sus gustos.', 'Well, everyone has their own taste.', 'حسنًا، لكلٍّ ذوقه.'),
      yesKeys: LIKE_YES,
      noKeys: LIKE_NO,
    },
    summer: {
      remark: reg(tu, ['¡Qué calor hace hoy! ¿Te gusta el verano?', '¡Qué calor hace hoy! ¿Le gusta el verano?'], 'It’s so hot today! Do you like summer?', 'ما أشدّ الحرّ اليوم! هل تحب الصيف؟'),
      yes: S('Sí, me encanta el verano.', 'Yes, I love summer.', 'نعم، أحب الصيف كثيرًا.'),
      no: S('No, hace demasiado calor.', 'No, it’s too hot.', 'لا، الجو حارّ جدًا.'),
      yesReply: ME_TOO,
      noReply: L('Sí, el verano en Madrid es muy fuerte.', 'Yes, summer in Madrid is really tough.', 'نعم، الصيف في مدريد قاسٍ جدًا.'),
      yesKeys: LIKE_YES,
      noKeys: LIKE_NO,
    },
    autumn: {
      remark: reg(tu, ['Ya refresca. ¿Te gusta el otoño?', 'Ya refresca. ¿Le gusta el otoño?'], 'It’s getting cooler. Do you like autumn?', 'بدأ الجو يبرد. هل تحب الخريف؟'),
      yes: S('Sí, el otoño es muy bonito.', 'Yes, autumn is lovely.', 'نعم، الخريف جميل جدًا.'),
      no: NOT_MUCH,
      yesReply: L('¡Pienso lo mismo!', 'I think so too!', 'وأنا أرى ذلك أيضًا!'),
      noReply: L('Bueno, con un chocolate caliente se lleva mejor.', 'Well, it’s easier with a hot chocolate.', 'حسنًا، يصبح أسهل مع شوكولاتة ساخنة.'),
      yesKeys: LIKE_YES,
      noKeys: LIKE_NO,
    },
    winter: {
      remark: reg(tu, ['¡Qué frío hace hoy! ¿Te gusta el invierno?', '¡Qué frío hace hoy! ¿Le gusta el invierno?'], 'It’s so cold today! Do you like winter?', 'ما أشدّ البرد اليوم! هل تحب الشتاء؟'),
      yes: S('Sí, me gusta el invierno.', 'Yes, I like winter.', 'نعم، أحب الشتاء.'),
      no: S('No, tengo frío.', 'No, I’m cold.', 'لا، أشعر بالبرد.'),
      yesReply: L('¡Qué bien! A mí también.', 'Great! Me too.', 'جميل! وأنا أيضًا.'),
      noReply: L('Sí, hoy hace mucho frío.', 'Yes, it’s really cold today.', 'نعم، الجو بارد جدًا اليوم.'),
      yesKeys: LIKE_YES,
      noKeys: LIKE_NO,
    },
    weekend_before: {
      remark: reg(tu, ['¡Ya casi es fin de semana! ¿Tienes planes?', '¡Ya casi es fin de semana! ¿Tiene planes?'], 'It’s almost the weekend! Do you have plans?', 'اقتربت عطلة نهاية الأسبوع! هل لديك خطط؟'),
      yes: S('Sí, voy a ver a unos amigos.', 'Yes, I’m going to see some friends.', 'نعم، سألتقي ببعض الأصدقاء.'),
      no: S('No, todavía no.', 'No, not yet.', 'لا، ليس بعد.'),
      yesReply: reg(tu, ['¡Qué bien! ¡Que lo pases bien!', '¡Qué bien! ¡Que lo pase bien!'], 'Great! Have fun!', 'جميل! استمتع!'),
      noReply: L('¡Pues a descansar!', 'Well then, time to rest!', 'إذن وقت الراحة!'),
      yesKeys: ['si', 'voy', 'vamos', 'amigos', 'familia', 'salir', 'salgo', 'quedar', 'quedo', 'visitar', 'viaje', 'excursion', 'playa', 'sierra'],
      noKeys: ['no', 'todavia no', 'aun no', 'nada', 'ningun', 'ninguno'],
    },
    weekend_now: {
      remark: reg(tu, ['¡Por fin es fin de semana! ¿Hoy descansas?', '¡Por fin es fin de semana! ¿Hoy descansa?'], 'Weekend at last! Are you off today?', 'أخيرًا عطلة نهاية الأسبوع! هل أنت في إجازة اليوم؟'),
      yes: S('Sí, hoy descanso.', 'Yes, I’m off today.', 'نعم، أنا في إجازة اليوم.'),
      no: S('No, tengo que trabajar.', 'No, I have to work.', 'لا، عليّ أن أعمل.'),
      yesReply: L('¡Qué bien! ¡A disfrutar!', 'Great! Enjoy it!', 'رائع! استمتع!'),
      noReply: L('¡Vaya, qué pena!', 'Oh, what a pity!', 'أوه، يا للأسف!'),
      yesKeys: ['si', 'descanso', 'libre', 'libro', 'fiesta'],
      noKeys: ['no', 'trabajar', 'trabajo', 'tengo que'],
    },
    weekend_after: {
      remark: L('¿Qué tal el fin de semana?', 'How was the weekend?', 'كيف كانت عطلة نهاية الأسبوع؟'),
      yes: S('¡Muy bien, gracias!', 'Very good, thanks!', 'جيدة جدًا، شكرًا!'),
      no: S('Regular.', 'So-so.', 'عادية.'),
      yesReply: L('¡Me alegro!', 'I’m glad!', 'يسعدني ذلك!'),
      noReply: L('Bueno, el próximo será mejor.', 'Well, the next one will be better.', 'حسنًا، القادمة ستكون أفضل.'),
      yesKeys: ['bien', 'muy bien', 'genial', 'estupendo', 'fenomenal', 'guay', 'buenisimo', 'divertido'],
      noKeys: ['regular', 'mal', 'normal', 'aburrido', 'asi asi', 'no muy', 'no tan'],
    },
  };
}

/** the topics as the tú shops say them, and as the usted shops do */
export const MADRID_TALK_TOPICS = topics(false);
export const MADRID_TALK_TOPICS_TU = topics(true);

/** A Madrid shop conversation with its regular's greeting and the small talk of every topic, all gated on the app's flags. */
export const withMadridTalk = (sc: Scenario): Scenario =>
  withShopTalk(sc, MADRID_SHOP_TALK, TU.has(sc.id) ? MADRID_TALK_TOPICS_TU : MADRID_TALK_TOPICS, NEGATIONS);
