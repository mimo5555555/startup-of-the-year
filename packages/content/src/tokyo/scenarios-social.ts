import type { IntentDef, Line, SayVariant, Scenario, SceneNode, Suggestion } from '../types';
import { L, S, say, node, asRecord } from './dsl';

// Gifts and small talk (agent 4B-a, docs/GAME_DESIGN.md §8.3a, §8.5). Everything here pays hearts (`pay: 'none'`).
//
// HOST CONTRACT (flags and vars the conversation host sets; without any flag every line is the polite, plain one, so the scenarios
// also run on their own):
//   casual              the friend speaks plain form (Mio from the start, Yuki and Kenji from heart 3)
//   cbc_<key> cb_<key>  small talk: the friend quotes a remembered fact in the greeting. `<key>` is hobby | food | phone | dream
//                       (nextCallbackFact). `cb_` is always set, `cbc_` additionally when `casual`. `{hobby}` / `{food}` are vars.
//                       The callback counts when the learner's matched intent at a `g_<topic>` node is `cb` (facts.callbacks).
//   revc_<id> rev_<id>  small talk: the due profile fact (FriendDef.facts id) is revealed in the follow node. `rev_` is always set,
//                       `revc_` additionally when `casual`. The fact counts as revealed (facts.revealed) when the flag was set.
//   startNode           small talk: `g_<topic>`, the topic the picker chose (facts.topic = `<topic>`); the default start is `g_weather`
//   gift_<r> giftc_<r>  give_gift: the friend's reaction r = loved | liked | neutral | disliked; `giftc_` additionally when `casual`
//   dl_<id> dlc_<id>    give_gift: disliked AND the friend has a humour line (tanaka, yuki); `dlc_` additionally when `casual`
//   var `gift`          give_gift: the item being given as {ja, gloss} (lexicon markup), shown in the three hand-over chips
// Intent ids the host reads: give_gift `give_item` / `give_food` (the hand-over names the item) and `give_bare` (it does not: x0.5 AP);
// small talk `cb` (callback answered), `answer` (the topic question was answered).

type Pair = [Line, Line]; // [plain, polite]

/** the plain line when the friend is `casual`, the polite one otherwise */
const reg = (plain: Line, polite: Line): SayVariant[] => [say(plain, { flag: 'casual' }), say(polite)];
/** two lines spoken one after the other */
const cat = (a: Line, b: Line): Line => ({ ja: `${a.ja}|${b.ja}`, en: `${a.en} ${b.en}`, ar: `${a.ar} ${b.ar}` });

const COMMON = ['です', 'ます', 'はい', 'いいえ', 'うん', 'ううん', 'すき', '好き', 'ちょっと', 'あまり', 'ぜんぜん'];
const UNSURE = ['わかりません', 'わからない', 'しりません', 'しらない'];
const BYE_KEYS = ['ありがとう', 'またね', 'また', 'あした', '明日', 'はい', 'うん', 'ばいばい', 'じゃあね', 'いいね', 'いいです', 'よろしく', 'さようなら', 'おやすみ', 'こちらこそ'];

// ---------------------------------------------------------------------------------------------------------------
// give_gift
// ---------------------------------------------------------------------------------------------------------------

const END: Pair = [L('うん、|またね！', 'Yeah, see you!', 'نعم، إلى اللقاء!'), L('はい、|また。', 'Yes, see you.', 'نعم، إلى اللقاء.')];

const REACTIONS = ['loved', 'liked', 'neutral', 'disliked'] as const;
/** the friend's reaction by taste, [plain, polite] (§8.5) */
const GIFT_REACT: Record<(typeof REACTIONS)[number], Pair> = {
  loved: [L('えっ、|ほんと？|うれしい！|ありがとう！', 'Really? I am so happy! Thank you!', 'حقًا؟ أنا سعيد جدًا! شكرًا!'), L('えっ、|本当|です|か？|うれしい|です！|ありがとう|ございます！', 'Really? I am so happy! Thank you!', 'حقًا؟ أنا سعيد جدًا! شكرًا!')],
  liked: [L('ありがとう！|うれしい！', 'Thank you! I am happy!', 'شكرًا! أنا سعيد!'), L('ありがとう|ございます。|うれしい|です。', 'Thank you. I am happy.', 'شكرًا. أنا سعيد.')],
  neutral: [L('ありがとう。', 'Thank you.', 'شكرًا.'), L('ありがとう|ございます。', 'Thank you.', 'شكرًا.')],
  disliked: [L('あ…|ありがとう。', 'Oh... thank you.', 'آه... شكرًا.'), L('あ…|ありがとう|ございます。', 'Oh... thank you.', 'آه... شكرًا.')],
};
/** the dislike humour lines of §8.5 */
const GIFT_DISLIKE: Record<string, Pair> = {
  tanaka: [L('毎日|見て|います…', 'I see these every day...', 'أراها كل يوم...'), L('毎日|見て|います…', 'I see these every day...', 'أراها كل يوم...')],
  yuki: [L('うーん、|コーヒー|は|お店|の|が|いい|かな。', 'Hmm, I prefer café coffee.', 'همم، أفضّل قهوة المقهى.'), L('うーん、|コーヒー|は|お店|の|が|いい|です。', 'Hmm, I prefer café coffee.', 'همم، أفضّل قهوة المقهى.')],
};

const giftReact = (): SayVariant[] => [
  // the humour lines come first: the host raises them together with `gift_disliked`
  ...Object.entries(GIFT_DISLIKE).flatMap(([id, [p, q]]) => [say(p, { flag: `dlc_${id}` }), say(q, { flag: `dl_${id}` })]),
  ...REACTIONS.map((r) => say(GIFT_REACT[r][0], { flag: `giftc_${r}` })),
  ...REACTIONS.map((r) => say(GIFT_REACT[r][1], { flag: `gift_${r}` })),
  ...reg(GIFT_REACT.neutral[0], GIFT_REACT.neutral[1]),
];

const GIVE_CHIPS: Suggestion[] = [
  S('{gift}、|どうぞ。', 'Here you are, {gift}.', 'تفضل، {gift}.'),
  S('{gift}|を|あげます。', 'I will give you {gift}.', 'سأعطيك {gift}.'),
  S('プレゼント|です。|{gift}|です。', 'It is a present. It is {gift}.', 'إنها هدية. إنها {gift}.'),
];
/** words that make a hand-over a hand-over even when no item is named */
const GIVE_WORDS = ['どうぞ', 'あげます', 'あげる', 'プレゼント', 'ぷれぜんと', 'おくります', 'これ'];
const GIVE_IDEAL = L('{giftItem}|を|あげます。', 'I will give you {giftItem}.', 'سأعطيك {giftItem}.');
const giveIntent = (id: string, slot: string, ideal: Line): IntentDef => ({ id, slot, slotRequired: true, next: 'react', step: 'give', ideal });

export const GIVE_GIFT: Scenario = {
  id: 'give_gift',
  locationId: 'park',
  characterId: 'mio',
  level: 'A1',
  title: { en: 'Give a gift', ar: 'قدّم هدية' },
  setup: {
    en: 'Hand your friend a present. Say what it is: the name of the thing and どうぞ.',
    ar: 'قدّم لصديقك هدية. قل ما هي: اسم الشيء ثم どうぞ.',
  },
  minutes: 1,
  steps: [
    { id: 'give', text: { en: 'Hand over the present and name it', ar: 'قدّم الهدية وسمِّها' } },
    { id: 'reply', text: { en: 'Answer the reaction', ar: 'أجب على ردّ الفعل' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'neutral',
      say: reg(L('{name}、|どうしたの？', '{name}, what is it?', '{name}، ما الأمر؟'), L('{name}|さん、|どうしました|か？', '{name}, what is it?', '{name}، ما الأمر؟')),
      suggestions: GIVE_CHIPS,
      intents: [
        giveIntent('give_item', 'giftItem', GIVE_IDEAL),
        giveIntent('give_food', 'giftFood', GIVE_IDEAL),
        // a hand-over that does not name the item still works, for half the affinity
        { id: 'give_bare', any: GIVE_WORDS, next: 'react', step: 'give', ideal: GIVE_IDEAL },
      ],
    }),
    node({
      id: 'react',
      step: 'give',
      emotion: 'happy',
      say: giftReact(),
      suggestions: [S('どういたしまして。', "You're welcome.", 'عفوًا.'), S('よかった！', 'I am glad!', 'يسعدني ذلك!')],
      intents: [
        {
          id: 'reply',
          any: ['どういたしまして', 'よかった', 'よろこ', 'うれしい', 'はい', 'うん', 'いいえ', 'どうぞ', 'また', 'ありがとう', 'たべて', 'つかって', 'きにいって', '気に入', 'すき', '好き', 'ごめん', 'すみません'],
          next: 'thanks',
          step: 'reply',
        },
      ],
    }),
    node({
      id: 'thanks',
      emotion: 'happy',
      say: reg(L('ありがとう！|大切に|する|ね。', 'Thank you! I will take good care of it.', 'شكرًا! سأعتني بها جيدًا.'), L('ありがとう|ございます。|大切に|します。', 'Thank you. I will take good care of it.', 'شكرًا. سأعتني بها جيدًا.')),
      suggestions: [S('また|ね！', 'See you!', 'إلى اللقاء!'), S('どういたしまして。', "You're welcome.", 'عفوًا.')],
      intents: [{ id: 'bye', any: [...BYE_KEYS, 'どういたしまして'], next: 'end' }],
    }),
    node({ id: 'end', emotion: 'happy', say: reg(END[0], END[1]), end: true, suggestions: [S('また|ね！', 'See you!', 'إلى اللقاء!')], intents: [] }),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// small talk
// ---------------------------------------------------------------------------------------------------------------

export const SMALLTALK_FRIENDS = ['mio', 'yuki', 'tanaka', 'kenji', 'sato', 'hanako'] as const;
type FriendId = (typeof SMALLTALK_FRIENDS)[number];
/** the friends who speak plain form at some heart */
const PLAIN_FRIENDS: FriendId[] = ['mio', 'yuki', 'kenji'];

interface Place {
  locationId: string;
  /** what the friend says about their own favourite food, weekend and the profile facts (§8.4); the plain form only for the plain-speaking */
  food: Pair;
  weekend: Pair;
  facts: Record<string, Pair>;
}
const same = (l: Line): Pair => [l, l];

const FRIEND: Record<FriendId, Place> = {
  mio: {
    locationId: 'park',
    food: [L('わたし|は|ケーキ|が|好き！', 'I like cake!', 'أحب الكعكة!'), L('わたし|は|ケーキ|が|好き|です。', 'I like cake.', 'أحب الكعكة.')],
    weekend: [L('わたし|は|公園|で|写真|を|とる|よ。', 'I take photos in the park.', 'ألتقط صورًا في الحديقة.'), L('わたし|は|公園|で|写真|を|とります。', 'I take photos in the park.', 'ألتقط صورًا في الحديقة.')],
    facts: {
      likes_anime: [L('わたし|は|アニメ|が|好き！', 'I like anime.', 'أحب الأنمي.'), L('わたし|は|アニメ|が|好き|です。', 'I like anime.', 'أحب الأنمي.')],
      photo_sakura: [L('春|に|桜|の|写真|を|とる|よ。', 'In spring I take photos of cherry blossoms.', 'في الربيع ألتقط صورًا لأشجار الكرز.'), L('春|に|桜|の|写真|を|とります。', 'In spring I take photos of cherry blossoms.', 'في الربيع ألتقط صورًا لأشجار الكرز.')],
      lives_alone: [L('ひとり|で|住んで|いる|よ。', 'I live alone.', 'أعيش وحدي.'), L('ひとり|で|住んで|います。', 'I live alone.', 'أعيش وحدي.')],
    },
  },
  yuki: {
    locationId: 'cafe',
    food: [L('わたし|は|パン|が|好き！', 'I like bread!', 'أحب الخبز!'), L('わたし|は|パン|が|好き|です。', 'I like bread.', 'أحب الخبز.')],
    weekend: [L('わたし|は|ギター|を|弾く|よ。', 'I play the guitar.', 'أعزف الغيتار.'), L('わたし|は|ギター|を|弾きます。', 'I play the guitar.', 'أعزف الغيتار.')],
    facts: {
      guitar: [L('週末|に|ギター|を|弾く|よ。', 'I play guitar on weekends.', 'أعزف الغيتار في عطلة نهاية الأسبوع.'), L('週末|に|ギター|を|弾きます。', 'I play guitar on weekends.', 'أعزف الغيتار في عطلة نهاية الأسبوع.')],
      cat: [L('ねこ|が|いる|よ。|名前|は|モカ！', 'I have a cat. Her name is Mocha.', 'لدي قطة اسمها موكا.'), L('ねこ|が|います。|名前|は|モカ|です。', 'I have a cat. Her name is Mocha.', 'لدي قطة اسمها موكا.')],
      dream_live: [L('いつか、|ライブ|を|したい|な。', 'Someday I want to do a live show.', 'أريد يومًا ما أن أقيم حفلًا حيًا.'), L('いつか、|ライブ|を|したい|です。', 'Someday I want to do a live show.', 'أريد يومًا ما أن أقيم حفلًا حيًا.')],
    },
  },
  tanaka: {
    locationId: 'konbini',
    food: same(L('わたし|は|カレー|が|好き|です。', 'I like curry.', 'أحب الكاري.')),
    weekend: same(L('わたし|は|うち|で|ゲーム|を|します。', 'I play games at home.', 'ألعب في البيت.')),
    facts: {
      games_night: same(L('毎晩|ゲーム|を|します。', 'I play games every night.', 'ألعب كل ليلة.')),
      sleepy: same(L('夜|は|ちょっと|眠い|です。', 'At night I get a little sleepy.', 'أشعر بالنعاس قليلًا في الليل.')),
      dream_game: same(L('ゲーム|の|会社|で|働き|たい|です。', 'I want to work at a game company.', 'أريد أن أعمل في شركة ألعاب.')),
    },
  },
  kenji: {
    locationId: 'ramen',
    food: [L('おれ|は|ラーメン|が|好き|だ。', 'I like ramen.', 'أحب الرامن.'), L('わたし|は|ラーメン|が|好き|です。', 'I like ramen.', 'أحب الرامن.')],
    weekend: [L('おれ|は|野球|を|見る|よ。', 'I watch baseball.', 'أشاهد البيسبول.'), L('わたし|は|野球|を|見ます。', 'I watch baseball.', 'أشاهد البيسبول.')],
    facts: {
      broth: [L('スープ|は|十二|時間|煮る|んだ。', 'I simmer the broth for 12 hours.', 'أغلي المرق اثنتي عشرة ساعة.'), L('スープ|は|十二|時間|煮ます。', 'I simmer the broth for 12 hours.', 'أغلي المرق اثنتي عشرة ساعة.')],
      baseball: [L('野球|が|大好き|だ。', 'I love baseball.', 'أحب البيسبول كثيرًا.'), L('野球|が|大好き|です。', 'I love baseball.', 'أحب البيسبول كثيرًا.')],
      daughter_hina: [L('娘|の|ひな|は|七|歳|だ。', 'My daughter Hina is seven.', 'ابنتي هينا عمرها سبع سنوات.'), L('娘|の|ひな|は|七|歳|です。', 'My daughter Hina is seven.', 'ابنتي هينا عمرها سبع سنوات.')],
    },
  },
  sato: {
    locationId: 'station',
    food: same(L('わたし|は|寿司|が|好き|です。', 'I like sushi.', 'أحب السوشي.')),
    weekend: same(L('わたし|は|散歩|を|します。', 'I take a walk.', 'أتمشى.')),
    facts: {
      thirty_years: same(L('三十|年、|この|駅|で|働いて|います。', "I've worked at this station for 30 years.", 'أعمل في هذه المحطة منذ ثلاثين عامًا.')),
      old_trains: same(L('古い|電車|が|好き|です。', 'I like old trains.', 'أحب القطارات القديمة.')),
      grandson: same(L('孫|は|五|歳|です。', 'My grandson is five years old.', 'حفيدي عمره خمس سنوات.')),
    },
  },
  hanako: {
    locationId: 'school',
    food: same(L('わたし|は|うどん|が|好き|です。', 'I like udon.', 'أحب الأودون.')),
    weekend: same(L('わたし|は|本|を|読みます。', 'I read books.', 'أقرأ الكتب.')),
    facts: {
      teach_songs: same(L('歌|で|日本語|を|教えます。', 'I teach Japanese with songs.', 'أعلّم اليابانية بالأغاني.')),
      calligraphy: same(L('書道|が|趣味|です。', 'My hobby is calligraphy.', 'هوايتي الخط.')),
      letters: same(L('毎年、|生徒|の|手紙|を|読みます。', "Every year I read my students' letters.", 'أقرأ كل عام رسائل طلابي.')),
    },
  },
};

/** the callbacks of §8.4: `{hobby}` and `{food}` are vars the host fills from the remembered fact */
const CALLBACKS: Record<string, Pair> = {
  hobby: [L('{hobby}、|最近|どう？', "How's {hobby} lately?", 'كيف حال {hobby} مؤخرًا؟'), L('{hobby}、|最近|どう|です|か？', "How's {hobby} lately?", 'كيف حال {hobby} مؤخرًا؟')],
  food: [L('{food}、|また|食べた？', 'Did you eat {food} again?', 'هل أكلت {food} مرة أخرى؟'), L('{food}、|また|食べました|か？', 'Did you eat {food} again?', 'هل أكلت {food} مرة أخرى؟')],
  phone: [L('スマホ、|使い|やすい？', 'Is the phone easy to use?', 'هل الهاتف سهل الاستخدام؟'), L('スマホ、|使い|やすい|です|か？', 'Is the phone easy to use?', 'هل الهاتف سهل الاستخدام؟')],
  dream: [L('夢、|がんばって|る？', 'Are you working on your dream?', 'هل تعمل على حلمك؟'), L('夢、|がんばって|います|か？', 'Are you working on your dream?', 'هل تعمل على حلمك؟')],
};
export const SMALLTALK_CALLBACKS = Object.keys(CALLBACKS);

const HELLO: Pair = [L('あ、|{name}！|こんにちは！', 'Oh, {name}! Hello!', 'آه، {name}! مرحبًا!'), L('{name}|さん、|こんにちは。', 'Hello, {name}.', 'مرحبًا يا {name}.')];

interface Topic {
  id: string;
  ask: Pair;
  chips: [Suggestion, Suggestion];
  /** what the learner may say, besides the common words */
  keys: string[];
  /** the friend's reaction; the shared templates add the friend's own noun */
  react: Pair | ((f: FriendId) => Pair);
  /** the learner's answer is kept as a fact the friend can quote later */
  remember?: IntentDef;
  /** friend-specific: only this friend raises it */
  only?: FriendId;
}

/** shared reaction + the friend's own sentence */
const withOwn = (r: Pair, pick: (f: FriendId) => Pair) => (f: FriendId): Pair => [cat(r[0], pick(f)[0]), cat(r[1], pick(f)[1])];

/** The 12 shared topic templates (§8.3a). */
export const SHARED_TOPICS: Topic[] = [
  {
    id: 'food',
    ask: [L('好きな|食べ物|は|何？', 'What food do you like?', 'ما الطعام الذي تحبه؟'), L('好きな|食べ物|は|何|です|か？', 'What food do you like?', 'ما الطعام الذي تحبه؟')],
    chips: [S('ラーメン|が|好き|です。', 'I like ramen.', 'أحب الرامن.'), S('カレー|が|好き|です。', 'I like curry.', 'أحب الكاري.')],
    keys: ['ラーメン', 'カレー', 'すし', '寿司', 'たべもの', 'おにぎり', 'パン', 'うどん', 'ケーキ'],
    react: withOwn([L('いい|ね！', 'Nice!', 'جميل!'), L('いい|です|ね。', 'Nice.', 'جميل.')], (f) => FRIEND[f].food),
    remember: { id: 'food_named', slot: 'chatfood', slotRequired: true, next: 'f_food', step: 'answer', remember: { fact: 'favFood', from: 'slot' } },
  },
  {
    id: 'music',
    ask: [L('どんな|音楽|が|好き？', 'What kind of music do you like?', 'ما نوع الموسيقى التي تحبها؟'), L('どんな|音楽|が|好き|です|か？', 'What kind of music do you like?', 'ما نوع الموسيقى التي تحبها؟')],
    chips: [S('いろいろ|聞きます。', 'I listen to all kinds.', 'أستمع إلى أنواع مختلفة.'), S('日本|の|歌|が|好き|です。', 'I like Japanese songs.', 'أحب الأغاني اليابانية.')],
    keys: ['おんがく', '音楽', 'うた', '歌', 'きき', '聞き', 'いろいろ'],
    react: [L('いい|ね！|今度、|一緒に|聞こう。', "Nice! Let's listen together sometime.", 'جميل! لنستمع معًا يومًا ما.'), L('いい|です|ね。|今度、|一緒に|聞きましょう。', "Nice. Let's listen together sometime.", 'جميل. لنستمع معًا يومًا ما.')],
  },
  {
    id: 'anime',
    ask: [L('アニメ、|見る？', 'Do you watch anime?', 'هل تشاهد الأنمي؟'), L('アニメ|を|見ます|か？', 'Do you watch anime?', 'هل تشاهد الأنمي؟')],
    chips: [S('はい、|アニメ|が|好き|です。', 'Yes, I like anime.', 'نعم، أحب الأنمي.'), S('いいえ、|あまり|見ません。', 'No, I do not watch it much.', 'لا، لا أشاهده كثيرًا.')],
    keys: ['アニメ', 'みます', '見ます', 'みません', '見ません', 'まんが', 'マンガ'],
    react: [L('そっか。|アニメ|は|楽しい|よ。', 'I see. Anime is fun.', 'فهمت. الأنمي ممتع.'), L('そう|です|か。|アニメ|は|楽しい|です|よ。', 'I see. Anime is fun.', 'فهمت. الأنمي ممتع.')],
    remember: { id: 'hobby_named', slot: 'hobby', slotOptions: ['anime', 'manga'], slotRequired: true, next: 'f_anime', step: 'answer', remember: { fact: 'hobby', from: 'slot' } },
  },
  {
    id: 'games',
    ask: [L('ゲーム、|する？', 'Do you play games?', 'هل تلعب الألعاب؟'), L('ゲーム|を|します|か？', 'Do you play games?', 'هل تلعب الألعاب؟')],
    chips: [S('はい、|ゲーム|が|好き|です。', 'Yes, I like games.', 'نعم، أحب الألعاب.'), S('いいえ、|あまり|しません。', 'No, I do not play much.', 'لا، لا ألعب كثيرًا.')],
    keys: ['ゲーム', 'します', 'しません', 'よく'],
    react: [L('いい|ね！|ゲーム|は|楽しい|ね。', 'Nice! Games are fun.', 'جميل! الألعاب ممتعة.'), L('いい|です|ね。|ゲーム|は|楽しい|です。', 'Nice. Games are fun.', 'جميل. الألعاب ممتعة.')],
    remember: { id: 'hobby_named', slot: 'hobby', slotOptions: ['games'], slotRequired: true, next: 'f_games', step: 'answer', remember: { fact: 'hobby', from: 'slot' } },
  },
  {
    id: 'travel',
    ask: [L('どこ|へ|行き|たい？', 'Where do you want to go?', 'إلى أين تريد أن تذهب؟'), L('どこ|へ|行き|たい|です|か？', 'Where do you want to go?', 'إلى أين تريد أن تذهب؟')],
    chips: [S('京都|に|行き|たい|です。', 'I want to go to Kyoto.', 'أريد الذهاب إلى كيوتو.'), S('日本|を|旅行|したい|です。', 'I want to travel around Japan.', 'أريد السفر في أنحاء اليابان.')],
    keys: ['きょうと', '京都', 'りょこう', '旅行', 'いきたい', '行きたい', 'にほん', '日本'],
    react: [L('いい|ね！|わたし|も|行き|たい！', 'Nice! I want to go too!', 'جميل! أريد الذهاب أيضًا!'), L('いい|です|ね。|わたし|も|行き|たい|です。', 'Nice. I want to go too.', 'جميل. أريد الذهاب أيضًا.')],
  },
  {
    id: 'weather',
    ask: [L('今日|は|いい|天気|だ|ね。|散歩、|する？', 'Nice weather today. Will you take a walk?', 'الطقس جميل اليوم. هل ستتمشى؟'), L('今日|は|いい|天気|です|ね。|散歩|を|します|か？', 'Nice weather today. Will you take a walk?', 'الطقس جميل اليوم. هل ستتمشى؟')],
    chips: [S('はい、|散歩|します。', 'Yes, I will take a walk.', 'نعم، سأتمشى.'), S('いいえ、|うち|に|います。', 'No, I will stay home.', 'لا، سأبقى في البيت.')],
    keys: ['さんぽ', '散歩', 'うち', 'てんき', '天気', 'あめ', '雨', 'あつい', '暑い', 'さむい', '寒い'],
    react: [L('そっか。|今日|も|がんばろう！', 'I see. Let us do our best today too!', 'فهمت. لنبذل جهدنا اليوم أيضًا!'), L('そう|です|か。|今日|も|がんばりましょう。', 'I see. Let us do our best today too.', 'فهمت. لنبذل جهدنا اليوم أيضًا.')],
  },
  {
    id: 'weekend',
    ask: [L('週末|は|何|を|する？', 'What will you do on the weekend?', 'ماذا ستفعل في عطلة نهاية الأسبوع؟'), L('週末|は|何|を|します|か？', 'What will you do on the weekend?', 'ماذا ستفعل في عطلة نهاية الأسبوع؟')],
    chips: [S('友だち|に|会います。', 'I will meet a friend.', 'سأقابل صديقًا.'), S('うち|で|休みます。', 'I will rest at home.', 'سأرتاح في البيت.')],
    keys: ['しゅうまつ', '週末', 'ともだち', '友だち', '友達', 'うち', 'やすみ', '休み', 'かいもの', '買い物', 'あいます', '会います'],
    react: withOwn([L('いい|ね！', 'Nice!', 'جميل!'), L('いい|です|ね。', 'Nice.', 'جميل.')], (f) => FRIEND[f].weekend),
  },
  {
    id: 'family',
    ask: [L('家族|は|何人？', 'How many people are in your family?', 'كم عدد أفراد عائلتك؟'), L('ご家族|は|何人|です|か？', 'How many people are in your family?', 'كم عدد أفراد عائلتك؟')],
    chips: [S('四人|です。', 'There are four.', 'نحن أربعة.'), S('三人|です。', 'There are three.', 'نحن ثلاثة.')],
    keys: ['かぞく', '家族', 'にん', '人', 'ひとり', 'ふたり', 'さんにん', 'よにん', 'ごにん'],
    react: [L('そう|なんだ。|家族|は|大切|だ|ね。', 'I see. Family is important.', 'فهمت. العائلة مهمة.'), L('そう|です|か。|家族|は|大切|です|ね。', 'I see. Family is important.', 'فهمت. العائلة مهمة.')],
  },
  {
    id: 'town',
    ask: [L('この|町、|どう？', 'How do you like this town?', 'كيف ترى هذه البلدة؟'), L('この|町|は|どう|です|か？', 'How do you like this town?', 'كيف ترى هذه البلدة؟')],
    chips: [S('きれい|で、|好き|です。', 'It is pretty and I like it.', 'إنها جميلة وأحبها.'), S('人|が|多い|です|ね。', 'There are many people.', 'هناك أشخاص كثيرون.')],
    keys: ['まち', '町', 'きれい', 'おおい', '多い', 'にぎやか', 'しずか', '静か', 'ひと', '人'],
    react: [L('そっか。|いい|町|だ|よ！', 'I see. It is a good town!', 'فهمت. إنها بلدة جيدة!'), L('そう|です|か。|いい|町|です|よ。', 'I see. It is a good town.', 'فهمت. إنها بلدة جيدة.')],
  },
  {
    id: 'study',
    ask: [L('日本語、|どう？|難しい？', 'How is Japanese? Is it hard?', 'كيف اليابانية؟ هل هي صعبة؟'), L('日本語|は|どう|です|か？|難しい|です|か？', 'How is Japanese? Is it hard?', 'كيف اليابانية؟ هل هي صعبة؟')],
    chips: [S('ちょっと|難しい|です。', 'It is a little hard.', 'إنها صعبة قليلًا.'), S('楽しい|です！', 'It is fun!', 'إنها ممتعة!')],
    keys: ['にほんご', '日本語', 'むずかしい', '難しい', 'たのしい', '楽しい', 'べんきょう', '勉強'],
    react: [L('がんばって|る|ね！', 'You are doing your best!', 'أنت تبذل جهدك!'), L('がんばって|います|ね！', 'You are doing your best!', 'أنت تبذل جهدك!')],
  },
  {
    id: 'fashion',
    ask: [L('どんな|服|が|好き？', 'What kind of clothes do you like?', 'ما نوع الملابس التي تحبها؟'), L('どんな|服|が|好き|です|か？', 'What kind of clothes do you like?', 'ما نوع الملابس التي تحبها؟')],
    chips: [S('白い|服|が|好き|です。', 'I like white clothes.', 'أحب الملابس البيضاء.'), S('青い|服|が|好き|です。', 'I like blue clothes.', 'أحب الملابس الزرقاء.')],
    keys: ['ふく', '服', 'しろい', '白い', 'あおい', '青い', 'くろい', '黒い', 'ジーンズ', 'くつ'],
    react: [L('いい|ね！|わたし|も|好き。', 'Nice! I like it too.', 'جميل! أحبها أيضًا.'), L('いい|です|ね。|わたし|も|好き|です。', 'Nice. I like it too.', 'جميل. أحبها أيضًا.')],
  },
  {
    id: 'sports',
    ask: [L('スポーツ、|する？', 'Do you play sports?', 'هل تمارس الرياضة؟'), L('スポーツ|を|します|か？', 'Do you play sports?', 'هل تمارس الرياضة؟')],
    chips: [S('はい、|毎週|します。', 'Yes, I play every week.', 'نعم، أمارسها كل أسبوع.'), S('見る|のが|好き|です。', 'I like watching it.', 'أحب مشاهدتها.')],
    keys: ['スポーツ', 'まいしゅう', '毎週', 'みる', '見る', 'やきゅう', '野球', 'サッカー', 'はしり', 'します'],
    react: [L('いい|ね！|体|は|大切|だ|ね。', 'Nice! Your body is important.', 'جميل! الجسم مهم.'), L('いい|です|ね。|体|は|大切|です|ね。', 'Nice. Your body is important.', 'جميل. الجسم مهم.')],
  },
];

/** The one friend-specific topic each friend has (the design's 18 are for all nine friends; these six are in this release). */
export const SPECIFIC_TOPICS: Topic[] = [
  {
    id: 'mio_photo',
    only: 'mio',
    ask: [L('桜、|きれい|だ|よ|ね。|写真、|とる？', 'The cherry blossoms are pretty. Do you take photos?', 'أشجار الكرز جميلة. هل تلتقط الصور؟'), L('桜|は|きれい|です|ね。|写真|を|とります|か？', 'The cherry blossoms are pretty. Do you take photos?', 'أشجار الكرز جميلة. هل تلتقط الصور؟')],
    chips: [S('はい、|桜|の|写真|を|とります。', 'Yes, I take photos of cherry blossoms.', 'نعم، ألتقط صورًا لأشجار الكرز.'), S('桜|は|きれい|です|ね。', 'The cherry blossoms are pretty.', 'أشجار الكرز جميلة.')],
    keys: ['さくら', '桜', 'しゃしん', '写真', 'とり', 'きれい'],
    react: [L('ありがとう！|いい|写真、|いっぱい|とる|ん|だ。', 'Thanks! I take lots of good photos.', 'شكرًا! ألتقط الكثير من الصور الجيدة.'), L('ありがとう！|いい|写真|を|たくさん|とります。', 'Thanks! I take lots of good photos.', 'شكرًا! ألتقط الكثير من الصور الجيدة.')],
  },
  {
    id: 'yuki_cat',
    only: 'yuki',
    ask: [L('うち|の|ねこ|は|モカ。|ねこ、|好き？', 'My cat is Mocha. Do you like cats?', 'قطتي اسمها موكا. هل تحب القطط؟'), L('うち|の|ねこ|は|モカ|です。|ねこ|は|好き|です|か？', 'My cat is Mocha. Do you like cats?', 'قطتي اسمها موكا. هل تحب القطط؟')],
    chips: [S('はい、|ねこ|が|大好き|です。', 'Yes, I love cats.', 'نعم، أحب القطط كثيرًا.'), S('かわいい|名前|です|ね。', 'That is a cute name.', 'إنه اسم لطيف.')],
    keys: ['ねこ', 'モカ', 'かわいい', 'なまえ', '名前', 'だいすき', '大好き'],
    react: [L('ありがとう！|モカ|は|かわいい|よ。', 'Thanks! Mocha is cute.', 'شكرًا! موكا لطيفة.'), L('ありがとう！|モカ|は|かわいい|です|よ。', 'Thanks! Mocha is cute.', 'شكرًا! موكا لطيفة.')],
  },
  {
    id: 'tanaka_games',
    only: 'tanaka',
    ask: same(L('昨日|の|夜|も|ゲーム|を|しました。|ゲーム、|好き|です|か？', 'I played games last night too. Do you like games?', 'لعبت الألعاب ليلة أمس أيضًا. هل تحب الألعاب؟')),
    chips: [S('はい、|好き|です。', 'Yes, I like them.', 'نعم، أحبها.'), S('どんな|ゲーム|です|か？', 'What kind of games?', 'أي نوع من الألعاب؟')],
    keys: ['ゲーム', 'どんな', 'きのう', '昨日', 'よる', '夜'],
    react: same(L('そう|です|か。|ゲーム|は|楽しい|です|よ。', 'I see. Games are fun.', 'فهمت. الألعاب ممتعة.')),
  },
  {
    id: 'kenji_broth',
    only: 'kenji',
    ask: [L('この|スープ、|うまい|だろ？', 'This soup is good, right?', 'هذا الحساء لذيذ، أليس كذلك؟'), L('この|スープ|は|おいしい|です|か？', 'Is this soup tasty?', 'هل هذا الحساء لذيذ؟')],
    chips: [S('はい、|とても|おいしい|です！', 'Yes, it is very tasty!', 'نعم، إنه لذيذ جدًا!'), S('どう|やって|作ります|か？', 'How do you make it?', 'كيف تصنعه؟')],
    keys: ['おいしい', 'スープ', 'つくり', '作り', 'どうやって', 'うまい'],
    react: [L('ありがとう！|時間|を|かけて|作る|んだ。', 'Thanks! I take my time making it.', 'شكرًا! أستغرق وقتًا في صنعه.'), L('ありがとう|ございます。|時間|を|かけて|作ります。', 'Thank you. I take my time making it.', 'شكرًا. أستغرق وقتًا في صنعه.')],
  },
  {
    id: 'sato_trains',
    only: 'sato',
    ask: same(L('電車|は|好き|です|か？', 'Do you like trains?', 'هل تحب القطارات؟')),
    chips: [S('はい、|好き|です。', 'Yes, I like them.', 'نعم، أحبها.'), S('駅|は|大きい|です|ね。', 'The station is big.', 'المحطة كبيرة.')],
    keys: ['でんしゃ', '電車', 'えき', '駅', 'おおきい', '大きい'],
    react: same(L('そう|です|か。|電車|は|面白い|です|よ。', 'I see. Trains are interesting.', 'فهمت. القطارات ممتعة.')),
  },
  {
    id: 'hanako_calligraphy',
    only: 'hanako',
    ask: same(L('字|を|書く|のは|好き|です|か？', 'Do you like writing characters?', 'هل تحب كتابة الحروف؟')),
    chips: [S('はい、|書きます。', 'Yes, I write them.', 'نعم، أكتبها.'), S('ちょっと|難しい|です。', 'It is a little hard.', 'إنه صعب قليلًا.')],
    keys: ['じ', '字', 'かき', '書き', 'かんじ', '漢字', 'むずかしい', '難しい'],
    react: same(L('いい|です|ね。|字|を|書く|のは|楽しい|です|よ。', 'Nice. Writing characters is fun.', 'جميل. كتابة الحروف ممتعة.')),
  },
];

const reactOf = (t: Topic, f: FriendId): Pair => (typeof t.react === 'function' ? t.react(f) : t.react);

/** the greeting, with the callback of §8.4 when the host raises one */
function greetSay(f: FriendId): SayVariant[] {
  const plainOk = PLAIN_FRIENDS.includes(f);
  const keys = Object.keys(CALLBACKS);
  return [
    ...(plainOk ? keys.map((k) => say(cat(HELLO[0], CALLBACKS[k]![0]), { flag: `cbc_${k}` })) : []),
    ...keys.map((k) => say(cat(HELLO[1], CALLBACKS[k]![1]), { flag: `cb_${k}` })),
    ...reg(HELLO[0], HELLO[1]),
  ];
}

/** the follow-up: the reaction, plus the due profile fact (§8.4) */
function followSay(f: FriendId, r: Pair): SayVariant[] {
  const plainOk = PLAIN_FRIENDS.includes(f);
  const facts = Object.entries(FRIEND[f].facts);
  return [
    ...(plainOk ? facts.map(([id, p]) => say(cat(r[0], p[0]), { flag: `revc_${id}` })) : []),
    ...facts.map(([id, p]) => say(cat(r[1], p[1]), { flag: `rev_${id}` })),
    ...reg(r[0], r[1]),
  ];
}

const CLOSE: Pair = [L('今日|も|ありがとう！|また|明日|ね。', 'Thanks for today too! See you tomorrow.', 'شكرًا على اليوم أيضًا! أراك غدًا.'), L('今日|も|ありがとう|ございました。|また|明日。', 'Thank you for today too. See you tomorrow.', 'شكرًا على اليوم أيضًا. أراك غدًا.')];

function topicNodes(f: FriendId, t: Topic, others: string[]): SceneNode[] {
  const g = `g_${t.id}`;
  const tp = `t_${t.id}`;
  const fo = `f_${t.id}`;
  const r = reactOf(t, f);
  return [
    node({
      id: g,
      emotion: 'happy',
      say: greetSay(f),
      suggestions: [S('こんにちは！', 'Hello!', 'مرحبًا!'), S('はい、|元気|です。', 'Yes, I am well.', 'نعم، أنا بخير.'), S('はい、|とても|いい|です。', 'Yes, very good.', 'نعم، جيد جدًا.')],
      intents: [
        { id: 'hello', any: ['こんにちは', 'おはよう', 'こんばんは', 'やあ', 'どうも', 'はじめまして'], next: tp, step: 'greet' },
        {
          id: 'cb',
          any: ['はい', 'いいえ', 'うん', 'ううん', 'いい', 'つかいやすい', '使いやすい', 'たべました', '食べました', 'たべた', '食べた', 'がんばって', 'たのしい', '楽しい', 'げんき', '元気', 'とても', 'さいきん', '最近'],
          next: tp,
          step: 'greet',
        },
        // the picker's other topics: the host enters those nodes directly (startNode); these keys keep the graph connected and are never typed
        ...others.map((o): IntentDef => ({ id: `to_${o}`, any: [`#topic:${o}`], next: `g_${o}` })),
      ],
    }),
    node({
      id: tp,
      emotion: 'neutral',
      say: reg(t.ask[0], t.ask[1]),
      suggestions: [...t.chips],
      intents: [
        ...(t.remember ? [t.remember] : []),
        { id: 'answer', any: [...t.keys, ...COMMON], next: fo, step: 'answer' },
        { id: 'unsure', any: UNSURE, next: fo },
      ],
    }),
    node({
      id: fo,
      emotion: 'happy',
      say: followSay(f, r),
      suggestions: [S('そう|です|ね。', 'That is right.', 'هذا صحيح.'), S('すごい|です|ね！', 'That is great!', 'هذا رائع!')],
      intents: [
        {
          id: 'react',
          any: ['そうですね', 'そうだね', 'そうなんですね', 'そうなんだ', 'ありがとう', 'はい', 'うん', 'いいですね', 'いいね', 'すごい', 'へえ', 'ほんとう', '本当', 'わたしも', 'ぼくも', 'おもしろい', '面白い', 'たのしい', '楽しい'],
          next: 'close',
          step: 'react',
        },
      ],
    }),
  ];
}

function smalltalk(f: FriendId): Scenario {
  const topics = [...SHARED_TOPICS, ...SPECIFIC_TOPICS.filter((t) => t.only === f)];
  const ids = topics.map((t) => t.id);
  const first = 'weather';
  const nodes: SceneNode[] = topics.flatMap((t) =>
    topicNodes(
      f,
      t,
      t.id === first ? ids.filter((i) => i !== first) : [],
    ),
  );
  nodes.push(
    node({
      id: 'close',
      emotion: 'happy',
      say: reg(CLOSE[0], CLOSE[1]),
      suggestions: [S('また|明日！', 'See you tomorrow!', 'أراك غدًا!'), S('ありがとう！', 'Thank you!', 'شكرًا!')],
      intents: [{ id: 'bye', any: BYE_KEYS, next: 'end' }],
    }),
    node({ id: 'end', emotion: 'happy', say: reg(END[0], END[1]), end: true, suggestions: [S('また|ね！', 'See you!', 'إلى اللقاء!')], intents: [] }),
  );
  return {
    id: `smalltalk_${f}`,
    locationId: FRIEND[f].locationId,
    characterId: f,
    level: 'A1',
    title: { en: 'Small talk', ar: 'دردشة' },
    setup: {
      en: 'A friendly chat. Greet your friend, answer the question about today’s topic and react to what they say.',
      ar: 'دردشة ودّية. حيِّ صديقك وأجب عن سؤال موضوع اليوم وعلّق على ما يقوله.',
    },
    minutes: 3,
    steps: [
      { id: 'greet', text: { en: 'Greet your friend', ar: 'حيِّ صديقك' } },
      { id: 'answer', text: { en: 'Answer the question', ar: 'أجب عن السؤال' } },
      { id: 'react', text: { en: 'React to the answer', ar: 'علّق على الرد' } },
    ],
    start: `g_${first}`,
    nodes: asRecord(nodes),
  };
}

export const SMALLTALK_SCENARIOS: Scenario[] = SMALLTALK_FRIENDS.map(smalltalk);

/** Scenarios for the social module (see docs/GAME_DESIGN.md). */
export const SOCIAL_SCENARIOS: Scenario[] = [GIVE_GIFT, ...SMALLTALK_SCENARIOS];
