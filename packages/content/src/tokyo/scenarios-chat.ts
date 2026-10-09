import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// Phone chat templates (agent 4B-b, docs/GAME_DESIGN.md §8.7): the five P0 text threads. They are short text-message
// conversations with any of the six friends (the friend is the thread's character; `characterId` here is only the default),
// pay 'none' (hearts, not yen). The register follows the flags the conversation host sets for the thread's friend:
//   `casual`        the friend speaks plain form with the player (Mio from the start, Yuki and Kenji at heart 3)
//   `f_<id>`        the friend's id (mio, yuki, tanaka, kenji, sato, hanako): picks the friend's place in chat_plan / chat_greet
//   `fc_<id>`       both of the above for a plain-speaking friend (mio, yuki, kenji)
// Without any flag every line is the polite, place-less one, so the scenarios also run on their own. The player's chips are
// polite (never wrong with a friend); the plain forms are accepted when typed.

// ---------- the friends' places and the register variants ----------

interface Place {
  id: string;
  ja: string;
  en: string;
  ar: string;
  /** speaks plain form once the thread is open (heart 2 for Mio; Yuki and Kenji switch later but can) */
  plain: boolean;
}
const PLACES: Place[] = [
  { id: 'mio', ja: '公園', en: 'the park', ar: 'الحديقة', plain: true },
  { id: 'yuki', ja: 'カフェ', en: 'the café', ar: 'المقهى', plain: true },
  { id: 'tanaka', ja: 'コンビニ', en: 'the konbini', ar: 'الكونبيني', plain: false },
  { id: 'kenji', ja: 'ラーメン屋', en: 'the ramen shop', ar: 'مطعم الرامن', plain: true },
  { id: 'sato', ja: '駅', en: 'the station', ar: 'المحطة', plain: false },
  { id: 'hanako', ja: '学校', en: 'the school', ar: 'المدرسة', plain: false },
];

/** a plain line for `casual`, the polite one otherwise */
const reg = (plain: Line, polite: Line): SayVariant[] => [say(plain, { flag: 'casual' }), say(polite)];

/** Plain and polite lines that name the friend's place: plain-speaking friends first, then every friend's polite line, then the place-less pair. */
const withPlace = (plain: (p: Place) => Line, polite: (p: Place) => Line, fallback: [Line, Line]): SayVariant[] => [
  ...PLACES.filter((p) => p.plain).map((p) => say(plain(p), { flag: `fc_${p.id}` })),
  ...PLACES.map((p) => say(polite(p), { flag: `f_${p.id}` })),
  ...reg(fallback[0], fallback[1]),
];

/** any reply that is some kind of thanks or goodbye, so a closing node never strands a typed answer */
const BYE_KEYS = ['ありがとう', 'またね', 'また', 'こんど', '今度', 'はい', 'うん', 'ばいばい', 'じゃあね', 'いいね', 'いいです', 'よろしく', 'こちらこそ', 'さようなら', 'おやすみ'];
const THANKS_KEYS = ['ありがとう', 'どうも', 'うれしい', 'はい', 'うん'];

/** The last exchange of a thread: the friend's closing line, the player's goodbye, the friend's own goodbye. */
const closer = (id: string, plain: Line, polite: Line, emotion: 'happy' | 'neutral' = 'happy') =>
  node({
    id,
    emotion,
    say: reg(plain, polite),
    suggestions: [S('ありがとう！', 'Thank you!', 'شكرًا!'), S('また|ね！', 'See you!', 'إلى اللقاء!')],
    intents: [{ id: 'bye', any: BYE_KEYS, next: 'end' }],
  });
/** the friend's goodbye, which ends the thread */
const endNode = () =>
  node({
    id: 'end',
    emotion: 'happy',
    say: reg(L('うん、|また|ね！', 'Yeah, see you!', 'نعم، إلى اللقاء!'), L('はい、|また。', 'Yes, see you.', 'نعم، إلى اللقاء.')),
    end: true,
    suggestions: [S('また|ね！', 'See you!', 'إلى اللقاء!')],
    intents: [],
  });

// ---------- chat_first: "you bought a phone!" (story thread, §8.7) ----------

export const CHAT_FIRST: Scenario = {
  id: 'chat_first',
  locationId: 'park',
  characterId: 'mio',
  level: 'A1',
  title: { en: 'Chat: your new phone', ar: 'محادثة: هاتفك الجديد' },
  setup: {
    en: 'A friend texts you about your new phone. Say yes and tell them which colour you bought.',
    ar: 'يراسلك صديق بخصوص هاتفك الجديد. قل نعم وأخبره بلون الهاتف الذي اشتريته.',
  },
  minutes: 2,
  steps: [
    { id: 'reply', text: { en: 'Say you bought a phone', ar: 'قل إنك اشتريت هاتفًا' } },
    { id: 'colour', text: { en: 'Say which colour', ar: 'قل أي لون' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'excited',
      say: reg(
        L('スマホ、|買った？|やったー！', 'Did you buy a phone? Yay!', 'اشتريت هاتفًا؟ رائع!'),
        L('スマホ、|買いました|か？|よかった|です。', 'Did you buy a phone? I am glad.', 'اشتريت هاتفًا؟ يسعدني ذلك.'),
      ),
      suggestions: [
        S('はい、|買いました！', 'Yes, I bought one!', 'نعم، اشتريت واحدًا!'),
        S('はい。|黒い|スマホ|です。', 'Yes. It is a black phone.', 'نعم. إنه هاتف أسود.'),
        S('ありがとう！', 'Thank you!', 'شكرًا!'),
      ],
      intents: [
        { id: 'yes_colour', slot: 'colour', slotRequired: true, next: 'done', step: 'reply', remember: { fact: 'purchase:phone', from: 'literal', value: 'phone' } },
        { id: 'yes', any: ['はい', '買いました', 'かいました', '買った', 'かった', 'うん', 'ありがとう'], none: ['いいえ'], next: 'which', step: 'reply', remember: { fact: 'purchase:phone', from: 'literal', value: 'phone' } },
      ],
    }),
    node({
      id: 'which',
      emotion: 'happy',
      say: reg(L('いい|ね！|何色？', 'Nice! What colour?', 'جميل! أي لون؟'), L('いい|です|ね！|何色|です|か？', 'Nice! What colour is it?', 'جميل! ما لونه؟')),
      suggestions: [
        S('黒い|スマホ|です。', 'It is a black phone.', 'إنه هاتف أسود.'),
        S('白い|スマホ|です。', 'It is a white phone.', 'إنه هاتف أبيض.'),
        S('青い|スマホ|です。', 'It is a blue phone.', 'إنه هاتف أزرق.'),
      ],
      intents: [{ id: 'colour', slot: 'colour', slotRequired: true, next: 'done' }],
    }),
    {
      ...closer(
        'done',
        L('いい|ね！|これから、|よろしく！', 'Nice! I look forward to chatting from now on!', 'جميل! أتطلع إلى محادثاتنا من الآن!'),
        L('いい|です|ね！|これから、|よろしく|お願いします。', 'Nice! I look forward to chatting from now on.', 'جميل! أتطلع إلى محادثاتنا من الآن.'),
      ),
      step: 'colour',
    },
    endNode(),
  ]),
};

// ---------- chat_greet: "what are you doing today?" ----------

const greetPlan: IntentDef = {
  id: 'plan',
  any: ['いきます', '行きます', 'します', 'しました', 'やすみます', '休みます', 'いく', '行く', 'べんきょう', '勉強', 'がっこう', '学校', 'かいもの', '買い物', 'さんぽ', '散歩', 'こうえん', '公園', 'うち'],
  next: 'react',
  step: 'plan',
};

export const CHAT_GREET: Scenario = {
  id: 'chat_greet',
  locationId: 'park',
  characterId: 'mio',
  level: 'A1',
  title: { en: 'Chat: good morning', ar: 'محادثة: صباح الخير' },
  setup: { en: 'A friend says good morning and asks about your day. Tell them one thing you will do.', ar: 'يقول لك صديق صباح الخير ويسأل عن يومك. أخبره بشيء واحد ستفعله.' },
  minutes: 2,
  steps: [
    { id: 'plan', text: { en: 'Say what you will do today', ar: 'قل ماذا ستفعل اليوم' } },
    { id: 'react', text: { en: 'Answer the reply', ar: 'أجب على الرد' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: reg(L('おはよう！|今日|は|何|する？', 'Morning! What are you doing today?', 'صباح الخير! ماذا ستفعل اليوم؟'), L('おはようございます。|今日|は|何|を|します|か？', 'Good morning. What will you do today?', 'صباح الخير. ماذا ستفعل اليوم؟')),
      suggestions: [
        S('学校|に|行きます。', 'I will go to school.', 'سأذهب إلى المدرسة.'),
        S('買い物|を|します。', 'I will go shopping.', 'سأتسوق.'),
        S('公園|に|行きます。', 'I will go to the park.', 'سأذهب إلى الحديقة.'),
        S('うち|で|休みます。', 'I will rest at home.', 'سأرتاح في البيت.'),
      ],
      intents: [greetPlan],
    }),
    node({
      id: 'react',
      emotion: 'happy',
      say: reg(L('いい|ね！|がんばって|ね。', 'Nice! Do your best!', 'جميل! بالتوفيق!'), L('いい|です|ね。|がんばって|ください。', 'That sounds good. Do your best.', 'يبدو جيدًا. بالتوفيق.')),
      suggestions: [S('ありがとう！', 'Thank you!', 'شكرًا!'), S('あなた|は？', 'And you?', 'وأنت؟')],
      intents: [
        { id: 'ask_back', any: ['あなたは', 'あなたも', 'きみは'], next: 'mine', step: 'react' },
        { id: 'thanks', any: THANKS_KEYS, next: 'done', step: 'react' },
      ],
    }),
    node({
      id: 'mine',
      emotion: 'neutral',
      say: withPlace(
        (p) => L(`わたし|は、|今日|も|${p.ja}|に|いる|よ。`, `I am at ${p.en} today too.`, `أنا في ${p.ar} اليوم أيضًا.`),
        (p) => L(`わたし|は、|今日|も|${p.ja}|に|います。`, `I am at ${p.en} today too.`, `أنا في ${p.ar} اليوم أيضًا.`),
        [L('わたし|も、|ここ|に|いる|よ。', 'I am here too.', 'أنا هنا أيضًا.'), L('わたし|も、|ここ|に|います。', 'I am here too.', 'أنا هنا أيضًا.')],
      ),
      suggestions: [S('ありがとう！', 'Thank you!', 'شكرًا!'), S('また|ね！', 'See you!', 'إلى اللقاء!')],
      intents: [{ id: 'bye', any: BYE_KEYS, next: 'done' }],
    }),
    node({
      id: 'done',
      emotion: 'happy',
      say: reg(L('じゃあ、|また|ね！', 'See you!', 'إلى اللقاء!'), L('では、|また。', 'See you later.', 'إلى اللقاء.')),
      end: true,
      suggestions: [S('また|ね！', 'See you!', 'إلى اللقاء!')],
      intents: [],
    }),
  ]),
};

// ---------- chat_plan: "shall we meet?" (the worked example of §8.7, A1-A2) ----------

export const CHAT_PLAN: Scenario = {
  id: 'chat_plan',
  locationId: 'park',
  characterId: 'mio',
  level: 'A2',
  title: { en: 'Chat: meet today?', ar: 'محادثة: نلتقي اليوم؟' },
  setup: {
    en: 'A friend asks whether you can meet today. Say yes and agree a time, or politely say no.',
    ar: 'يسألك صديق إن كان بإمكانكما اللقاء اليوم. قل نعم واتفق على موعد، أو اعتذر بلطف.',
  },
  minutes: 3,
  steps: [
    { id: 'reply', text: { en: 'Answer the invitation', ar: 'أجب على الدعوة' } },
    { id: 'time', text: { en: 'Agree a time', ar: 'اتفق على موعد' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: withPlace(
        (p) => L(`今日、|${p.ja}|で|会わない？`, `Want to meet at ${p.en} today?`, `هل نلتقي في ${p.ar} اليوم؟`),
        (p) => L(`今日、|${p.ja}|で|会いません|か？`, `Would you like to meet at ${p.en} today?`, `هل تودّ أن نلتقي في ${p.ar} اليوم؟`),
        [L('今日、|会わない？', 'Want to meet today?', 'هل نلتقي اليوم؟'), L('今日、|会いません|か？', 'Would you like to meet today?', 'هل تودّ أن نلتقي اليوم؟')],
      ),
      suggestions: [
        S('いい|です|よ！', 'Sure!', 'حسنا!'),
        S('すみません、|今日|は|ちょっと|難しい|です。', 'Sorry, today is a bit difficult.', 'آسف، اليوم صعب قليلًا.'),
        S('何時|です|か？', 'What time?', 'في أي ساعة؟'),
      ],
      intents: [
        { id: 'ask_time', any: ['なんじ', '何時', 'いつ', 'じかん'], next: 'time', step: 'reply' },
        { id: 'no_polite', any: ['ごめん', 'すみません', 'ちょっと', 'むり', '無理', 'だめ', 'いけません', 'いけない', 'またこんど', 'また今度'], next: 'decline_ok', step: 'reply' },
        { id: 'yes', any: ['いいよ', 'いいです', 'はい', 'うん', 'いきます', '行きます', 'いく', '行く', 'もちろん', 'あいましょう', '会いましょう'], none: ['いいえ', 'ごめん', 'ちょっと', 'すみません'], next: 'time', step: 'reply' },
      ],
    }),
    node({
      id: 'time',
      emotion: 'happy',
      say: reg(L('じゃあ、|三時|ね！', 'Then three o’clock!', 'إذًا، الساعة الثالثة!'), L('では、|三時|に|しましょう。', 'Then, let us make it three o’clock.', 'إذًا، لنجعلها الساعة الثالثة.')),
      suggestions: [S('はい、|三時|です|ね。', 'Yes, three o’clock.', 'نعم، الساعة الثالثة.'), S('三時|に|行きます。', 'I will come at three.', 'سآتي في الثالثة.'), REPEAT_S],
      intents: [{ id: 'ok_time', any: ['さんじ', '三時', 'わかりました', 'わかった', 'はい', 'うん', 'いいよ', 'いいです', 'おーけー', 'オーケー', 'ok'], none: ['いいえ'], next: 'done', step: 'time' }],
    }),
    node({
      id: 'decline_ok',
      emotion: 'neutral',
      say: reg(L('そっか、|じゃあ|また|今度|ね！', 'I see, another time then!', 'حسنًا، في مرة أخرى إذًا!'), L('そう|です|か。|では、|また|今度。', 'I see. Another time, then.', 'فهمت. في مرة أخرى إذًا.')),
      suggestions: [S('ありがとう。', 'Thank you.', 'شكرًا.'), S('また|今度|ね。', 'Another time.', 'في مرة أخرى.')],
      intents: [{ id: 'ok', any: BYE_KEYS, next: 'bye' }],
    }),
    node({
      id: 'done',
      emotion: 'excited',
      say: reg(L('楽しみ！|じゃあ|ね！', 'Can’t wait! Bye!', 'أتطلع لذلك! إلى اللقاء!'), L('楽しみ|に|して|います。|では、|また。', 'I am looking forward to it. See you.', 'أتطلع لذلك. إلى اللقاء.')),
      end: true,
      suggestions: [S('また|ね！', 'See you!', 'إلى اللقاء!')],
      intents: [],
    }),
    node({
      id: 'bye',
      emotion: 'happy',
      say: reg(L('うん、|また|ね！', 'Yeah, see you!', 'نعم، إلى اللقاء!'), L('はい、|また。', 'Yes, see you.', 'نعم، إلى اللقاء.')),
      end: true,
      suggestions: [S('また|ね！', 'See you!', 'إلى اللقاء!')],
      intents: [],
    }),
  ]),
};

// ---------- chat_food: "what did you eat for lunch?" (stores `favFood`) ----------

export const CHAT_FOOD: Scenario = {
  id: 'chat_food',
  locationId: 'park',
  characterId: 'mio',
  level: 'A1',
  title: { en: 'Chat: lunch', ar: 'محادثة: الغداء' },
  setup: { en: 'A friend asks what you ate for lunch. Name a food; your friend will remember it.', ar: 'يسألك صديق عمّا أكلته على الغداء. اذكر طعامًا؛ وسيتذكره صديقك.' },
  minutes: 2,
  steps: [
    { id: 'food', text: { en: 'Say what you ate', ar: 'قل ماذا أكلت' } },
    { id: 'react', text: { en: 'Answer the question about it', ar: 'أجب عن السؤال حوله' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: reg(L('昼ごはん、|何|食べた？', 'What did you eat for lunch?', 'ماذا أكلت على الغداء؟'), L('昼ごはん|は、|何|を|食べました|か？', 'What did you eat for lunch?', 'ماذا أكلت على الغداء؟')),
      suggestions: [
        S('ラーメン|を|食べました。', 'I ate ramen.', 'أكلت الرامن.'),
        S('おにぎり|を|食べました。', 'I ate an onigiri.', 'أكلت أونيغيري.'),
        S('サンドイッチ|を|食べました。', 'I ate a sandwich.', 'أكلت ساندويتش.'),
      ],
      intents: [{ id: 'food', slot: 'chatfood', slotRequired: true, next: 'react', step: 'food', remember: { fact: 'favFood', from: 'slot' } }],
    }),
    node({
      id: 'react',
      emotion: 'excited',
      say: reg(
        L('{chatfood}、|いい|ね！|おいしかった？', '{chatfood}, nice! Was it good?', '{chatfood}، جميل! هل كان لذيذًا؟'),
        L('{chatfood}|です|か。|いい|です|ね！|おいしかった|です|か？', '{chatfood}? Nice! Was it good?', '{chatfood}؟ جميل! هل كان لذيذًا؟'),
      ),
      suggestions: [S('はい、|おいしかった|です。', 'Yes, it was good.', 'نعم، كان لذيذًا.'), S('とても|おいしかった|です！', 'It was very good!', 'كان لذيذًا جدًا!')],
      intents: [{ id: 'tasty', any: ['おいしかった', 'おいしい', 'はい', 'うん', 'とても', 'よかった', 'すき', '好き'], next: 'done', step: 'react' }],
    }),
    closer(
      'done',
      L('よかった！|また|教えて|ね。', 'Great! Tell me more another time.', 'رائع! أخبرني المزيد في وقت آخر.'),
      L('よかった|です。|また|教えてください。', 'I am glad. Please tell me more another time.', 'يسعدني ذلك. أخبرني المزيد في وقت آخر من فضلك.'),
    ),
    endNode(),
  ]),
};

// ---------- chat_miss: "how are you?" (after a few days away; any reply is enough) ----------

export const CHAT_MISS: Scenario = {
  id: 'chat_miss',
  locationId: 'park',
  characterId: 'mio',
  level: 'A1',
  title: { en: 'Chat: how are you?', ar: 'محادثة: كيف حالك؟' },
  setup: { en: 'A friend has not heard from you for a few days and asks how you are. Any friendly reply is welcome.', ar: 'لم يسمع صديق منك منذ أيام ويسأل عن حالك. أي رد ودّي مرحّب به.' },
  minutes: 1,
  steps: [{ id: 'reply', text: { en: 'Say how you are', ar: 'قل كيف حالك' } }],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: reg(L('元気？', 'How are you?', 'كيف حالك؟'), L('お元気|です|か？', 'How are you?', 'كيف حالك؟')),
      suggestions: [
        S('元気|です！', 'I am fine!', 'أنا بخير!'),
        S('元気|です。|あなた|は？', 'I am fine. And you?', 'أنا بخير. وأنت؟'),
        S('ちょっと|疲れて|います。', 'I am a little tired.', 'أنا متعب قليلًا.'),
      ],
      intents: [
        { id: 'tired', any: ['つかれ', '疲れ', 'ねむい', 'いそがしい'], next: 'rest', step: 'reply' },
        { id: 'ask_back', any: ['あなたは', 'あなたも', 'きみは'], next: 'fine', step: 'reply' },
        { id: 'reply', any: ['げんき', '元気', 'だいじょうぶ', 'まあまあ', 'はい', 'うん', 'ありがとう', 'いいえ', 'ちょっと', 'こんにちは', 'ひさしぶり', 'ごめん', 'すみません', 'いい'], next: 'done', step: 'reply' },
      ],
    }),
    closer(
      'done',
      L('よかった！|また|話そう|ね。', 'Great! Let’s talk again.', 'رائع! لنتحدث مجددًا.'),
      L('よかった|です。|また|話しましょう。', 'I am glad. Let us talk again.', 'يسعدني ذلك. لنتحدث مجددًا.'),
    ),
    closer(
      'fine',
      L('わたし|も|元気！|また|話そう。', 'I am fine too! Let’s talk again.', 'أنا بخير أيضًا! لنتحدث مجددًا.'),
      L('わたし|も|元気|です。|また|話しましょう。', 'I am fine too. Let us talk again.', 'أنا بخير أيضًا. لنتحدث مجددًا.'),
    ),
    closer(
      'rest',
      L('大丈夫？|ゆっくり|休んで|ね。', 'Are you OK? Rest well.', 'هل أنت بخير؟ ارتح جيدًا.'),
      L('大丈夫|です|か？|ゆっくり|休んで|ください。', 'Are you all right? Please rest well.', 'هل أنت بخير؟ ارتح جيدًا من فضلك.'),
      'neutral',
    ),
    endNode(),
  ]),
};

/** Scenarios for phone chat templates (see docs/GAME_DESIGN.md §8.7). */
export const CHAT_SCENARIOS: Scenario[] = [CHAT_FIRST, CHAT_GREET, CHAT_PLAN, CHAT_FOOD, CHAT_MISS];
