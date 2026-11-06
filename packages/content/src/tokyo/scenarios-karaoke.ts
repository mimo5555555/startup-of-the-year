import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// カラオケ「うたひろば」 (the karaoke box on the south side). Two conversations:
//  - `karaoke_desk` with Nanami at the desk: how many people (二人です), how long (一時間 / 二時間), paying first (先にお願いします), the room
//    number (三番のお部屋). The room is ¥1,000 an hour / ¥1,800 for two, for two people, drink bar included (menu karaoke:h1 / karaoke:h2).
//  - `karaoke_room` with the friend the player invites (the app starts it with that friend as the character, like the housewarming): choose
//    the song (歌いたいです), order drinks from the room phone, 乾杯, sing the chorus of the town's own song 「桜通り」 by saying the lines (the
//    friend sings the middle one), answer the praise (上手だね), and agree to come again (また来ましょう). The flag `casual` (the app, for a
//    friend who speaks plain form) picks the friend's plain lines.

const reg = (plain: Line, polite: Line): SayVariant[] => [say(plain, { flag: 'casual' }), say(polite)];
const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });

// ---------------------------------------------------------------------------------------------------------------
// The desk
// ---------------------------------------------------------------------------------------------------------------

/** Fixed prices of the no-hooks variants (equal to the menu, checked in the tests). */
export const KARAOKE_PRICES: Record<string, number> = { h1: 1000, h2: 1800 };

const pickHours: IntentDef = {
  id: 'pick_hours',
  slot: 'hours',
  slotRequired: true,
  next: 'quote',
  step: 'hours',
  request: true,
  ideal: L('一時間|お願いします。', 'One hour, please.', 'ساعة واحدة من فضلك.'),
};
const payIntents: IntentDef[] = [
  { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next: 'done' },
  { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'done' },
  { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ'], next: 'done' },
];

export const KARAOKE_DESK: Scenario = {
  id: 'karaoke_desk',
  locationId: 'karaoke',
  characterId: 'nanami',
  level: 'A1',
  title: { en: 'Book a karaoke room', ar: 'احجز غرفة كاريوكي' },
  setup: {
    en: 'You are at the desk of the karaoke box. Say how many people you are and how long you want the room, then pay first, as everyone does.',
    ar: 'أنت عند مكتب صالة الكاريوكي. قل كم عددكم وكم من الوقت تريد الغرفة، ثم ادفع مسبقًا كما يفعل الجميع.',
  },
  minutes: 3,
  steps: [
    { id: 'people', text: { en: 'Say how many people', ar: 'قل كم عددكم' } },
    { id: 'hours', text: { en: 'Say how long', ar: 'قل كم من الوقت' } },
    { id: 'pay', text: { en: 'Pay first', ar: 'ادفع مسبقًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ！|うたひろば|です。|何名様|です|か？', 'Welcome! This is Uta Hiroba. How many people?', 'أهلًا بك! هذه أوتا هيروبا. كم عددكم؟'))],
      suggestions: [S('二人|です。', 'Two people.', 'شخصان.'), S('二人|で|一時間|お願いします。', 'Two people, one hour, please.', 'شخصان، ساعة واحدة من فضلك.'), S('いくら|です|か？', 'How much is it?', 'كم السعر؟')],
      intents: [
        { ...pickHours, id: 'people_hours', step: 'people' },
        { id: 'people', any: ['ふたり', '二人', '2人', 'にめい', '二名'], next: 'hours', step: 'people', request: true, ideal: L('二人|です。', 'Two people.', 'شخصان.') },
        { id: 'ask_price', any: ['いくら', 'ねだん', 'りょうきん', '料金'], next: 'hours' },
        later(),
      ],
    }),
    node({
      id: 'hours',
      say: [say(L('二人|です|ね。|お時間|は|どうしますか？|一時間|千|円、|二時間|千|八|百|円|です。', 'Two people, right. How long would you like? One hour is 1,000 yen, two hours is 1,800 yen.', 'شخصان، حسنًا. كم من الوقت تريد؟ الساعة بـ 1,000 ين، والساعتان بـ 1,800 ين.'))],
      suggestions: [S('一時間|お願いします。', 'One hour, please.', 'ساعة واحدة من فضلك.'), S('二時間|お願いします。', 'Two hours, please.', 'ساعتان من فضلك.'), REPEAT_S],
      intents: [pickHours, later()],
    }),
    node({
      id: 'quote',
      say: [
        say(L('{hours}|です|ね。|{total}|です。|お支払い|は|先に|お願いします。', '{hours}, right. That is {total}. Please pay first.', '{hours}، حسنًا. المبلغ {total}. ادفع مسبقًا من فضلك.'), { flag: 'priced' }),
        say(L('二時間|です|ね。|千|八|百|円|です。|お支払い|は|先に|お願いします。', 'Two hours, right. That is 1,800 yen. Please pay first.', 'ساعتان، حسنًا. المبلغ 1,800 ين. ادفع مسبقًا من فضلك.'), { slot: 'hours', in: ['h2'] }),
        say(L('一時間|です|ね。|千|円|です。|お支払い|は|先に|お願いします。', 'One hour, right. That is 1,000 yen. Please pay first.', 'ساعة واحدة، حسنًا. المبلغ 1,000 ين. ادفع مسبقًا من فضلك.')),
      ],
      suggestions: [S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.'), S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.'), S('はい、|どうぞ。', 'Yes, here you are.', 'نعم، تفضّل.')],
      intents: [...payIntents, later()],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('ありがとう|ございます。|三番|の|お部屋|です。|ごゆっくり|どうぞ！', 'Thank you very much. Your room is number three. Enjoy!', 'شكرًا جزيلًا. غرفتكم رقم ثلاثة. استمتعوا!'))],
      intents: [],
    }),
    node({
      id: 'short',
      say: [say(L('すみません、|少し|足りません。', 'Sorry, that is a little short.', 'آسفة، المبلغ ناقص قليلًا.'))],
      suggestions: [S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.'), S('一時間|お願いします。', 'One hour, please.', 'ساعة واحدة من فضلك.')],
      intents: [later(), pickHours],
    }),
    node({ id: 'leave', end: true, say: [say(L('はい。|また|お待ち|して|おります。', 'All right. We look forward to seeing you again.', 'حسنًا. بانتظار زيارتك مجددًا.'))], intents: [] }),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// The room, with a friend
// ---------------------------------------------------------------------------------------------------------------

/** The chorus of 「桜通り」 (the town's own song, written for the game): the player sings lines 1 and 3, the friend line 2. */
export const SAKURA_STREET = {
  line1: L('桜通り|で|会おう|よ。', "Let's meet on Sakura Street.", 'لنلتقِ في شارع ساكورا.'),
  line2: L('春|の|風|が|吹いている。', 'The spring wind is blowing.', 'ريح الربيع تهبّ.'),
  line3: L('明日|も|一緒に|笑おう|よ。', "Let's laugh together tomorrow too.", 'لنضحك معًا غدًا أيضًا.'),
};

export const KARAOKE_ROOM: Scenario = {
  id: 'karaoke_room',
  locationId: 'karaoke',
  // the friend you invite plays this: the app starts the scenario with that friend's character (Mio is only the default)
  characterId: 'mio',
  level: 'A1',
  title: { en: 'Karaoke with a friend', ar: 'كاريوكي مع صديق' },
  setup: {
    en: 'You are in room three with a friend. Choose a song, order drinks, make a toast, sing the chorus of 「桜通り」 together and answer the compliments.',
    ar: 'أنت في الغرفة رقم ثلاثة مع صديق. اختر أغنية، واطلب المشروبات، واشرب نخبًا، وغنِّيا لازمة 「桜通り」 معًا، وردّ على المجاملات.',
  },
  minutes: 5,
  steps: [
    { id: 'song', text: { en: 'Choose the song', ar: 'اختر الأغنية' } },
    { id: 'drink', text: { en: 'Order a drink', ar: 'اطلب مشروبًا' } },
    { id: 'toast', text: { en: 'Make the toast', ar: 'اشرب النخب' } },
    { id: 'sing', text: { en: 'Sing the chorus', ar: 'غنِّ اللازمة' } },
    { id: 'bye', text: { en: 'Agree to come again', ar: 'اتفقا على المجيء مجددًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: reg(L('わあ、|広い|部屋|だ|ね！|何|を|歌う？', 'Wow, what a big room! What shall we sing?', 'يا للروعة، غرفة واسعة! ماذا سنغنّي؟'), L('わあ、|広い|部屋|です|ね！|何|を|歌いましょう|か？', 'Wow, what a big room! What shall we sing?', 'يا للروعة، غرفة واسعة! ماذا سنغنّي؟')),
      suggestions: [S('桜通り|を|歌いたい|です。', 'I would like to sing Sakura Street.', 'أريد أن أغنّي شارع ساكورا.'), S('一緒に|歌おう！', "Let's sing together!", 'لنغنِّ معًا!'), S('何|でも|いい|です|よ。', 'Anything is fine.', 'أي شيء جيد.')],
      intents: [
        { id: 'song', any: ['さくらどおり', '桜通り', 'うたいたい', '歌いたい', 'うたおう', '歌おう', 'いっしょに', '一緒に', 'なんでも'], next: 'drink', step: 'song', request: true, ideal: L('桜通り|を|歌いたい|です。', 'I would like to sing Sakura Street.', 'أريد أن أغنّي شارع ساكورا.') },
      ],
    }),
    node({
      id: 'drink',
      say: reg(L('いい|ね！|先に|飲み物|を|頼もう。|何|が|いい？', 'Nice! Let us order drinks first. What would you like?', 'جميل! لنطلب المشروبات أولًا. ماذا تريد؟'), L('いい|です|ね！|先に|飲み物|を|頼みましょう。|何|が|いい|です|か？', 'Nice! Let us order drinks first. What would you like?', 'جميل! لنطلب المشروبات أولًا. ماذا تريد؟')),
      suggestions: [S('ウーロン茶|が|いい|です。', 'Oolong tea, please.', 'شاي أولونغ من فضلك.'), S('コーラ|が|いい|です。', 'Cola, please.', 'كولا من فضلك.'), S('メロンソーダ|が|いい|です。', 'Melon soda, please.', 'صودا البطيخ من فضلك.')],
      intents: [
        { id: 'pick_drink', slot: 'karaokeDrink', slotRequired: true, next: 'toast', step: 'drink', request: true, ideal: L('ウーロン茶|が|いい|です。', 'Oolong tea, please.', 'شاي أولونغ من فضلك.') },
      ],
    }),
    node({
      id: 'toast',
      emotion: 'happy',
      say: reg(L('飲み物|が|来た！|じゃあ、|乾杯|しよう！', 'The drinks are here! Okay, let us make a toast!', 'وصلت المشروبات! حسنًا، لنشرب نخبًا!'), L('飲み物|が|来ました！|じゃあ、|乾杯|しましょう！', 'The drinks are here! Okay, let us make a toast!', 'وصلت المشروبات! حسنًا، لنشرب نخبًا!')),
      suggestions: [S('乾杯！', 'Cheers!', 'في صحتك!')],
      intents: [{ id: 'toast', any: ['かんぱい', '乾杯'], next: 'sing1', step: 'toast', ideal: L('乾杯！', 'Cheers!', 'في صحتك!') }],
    }),
    // the chorus: the player says the first line, the friend sings the second, the player the third
    node({
      id: 'sing1',
      emotion: 'happy',
      say: reg(L('サビ|は|一緒に|歌おう！|いくよ！', 'Let us sing the chorus together! Here we go!', 'لنغنِّ اللازمة معًا! هيا بنا!'), L('サビ|は|一緒に|歌いましょう！|いきます|よ！', 'Let us sing the chorus together! Here we go!', 'لنغنِّ اللازمة معًا! هيا بنا!')),
      suggestions: [S('桜通り|で|会おう|よ。', "Let's meet on Sakura Street.", 'لنلتقِ في شارع ساكورا.')],
      intents: [{ id: 'line1', any: ['さくらどおりで', '桜通りで', 'あおうよ', '会おうよ', 'あおう', '会おう'], next: 'sing2', step: 'sing', ideal: SAKURA_STREET.line1 }],
    }),
    node({
      id: 'sing2',
      emotion: 'happy',
      say: [say(SAKURA_STREET.line2)],
      suggestions: [S('明日|も|一緒に|笑おう|よ。', "Let's laugh together tomorrow too.", 'لنضحك معًا غدًا أيضًا.')],
      intents: [{ id: 'line3', any: ['わらおうよ', '笑おうよ', 'わらおう', '笑おう', 'あしたも', '明日も'], next: 'praise', ideal: SAKURA_STREET.line3 }],
    }),
    node({
      id: 'praise',
      emotion: 'happy',
      say: reg(L('上手|だ|ね！|声|が|きれい！', 'You are good! What a lovely voice!', 'أنت بارع! صوتك جميل!'), L('上手|です|ね！|声|が|きれい|です！', 'You are good! What a lovely voice!', 'أنت بارع! صوتك جميل!')),
      suggestions: [S('ありがとう！|楽しい|です！', 'Thanks! This is fun!', 'شكرًا! هذا ممتع!'), S('いえいえ、|まだ|まだ|です。', 'Not at all, I still have a long way to go.', 'لا، ما زال أمامي الكثير.'), S('そちら|も|上手|です|よ。', 'You are good too.', 'أنت بارع أيضًا.')],
      intents: [{ id: 'thanks', any: ['ありがとう', 'いえいえ', 'まだまだ', 'たのしい', '楽しい', 'じょうず', '上手', 'うれしい'], next: 'bye' }],
    }),
    node({
      id: 'bye',
      emotion: 'happy',
      say: reg(L('あっという間|だった|ね。|楽しかった！|また|来よう|ね。', 'That went by so fast. It was fun! Let us come again.', 'مرّ الوقت بسرعة. كان ممتعًا! لنأتِ مجددًا.'), L('あっという間|でした|ね。|楽しかった|です！|また|来ましょう|ね。', 'That went by so fast. It was fun! Let us come again.', 'مرّ الوقت بسرعة. كان ممتعًا! لنأتِ مجددًا.')),
      suggestions: [S('うん、|また|来よう！', "Yes, let's come again!", 'نعم، لنأتِ مجددًا!'), S('はい、|また|来ましょう！', "Yes, let's come again!", 'نعم، لنأتِ مجددًا!'), S('楽しかった|です。|ありがとう！', 'It was fun. Thank you!', 'كان ممتعًا. شكرًا!')],
      intents: [{ id: 'again', any: ['またこよう', 'また来よう', 'またきましょう', 'また来ましょう', 'たのしかった', '楽しかった', 'ありがとう', 'また'], next: 'end', step: 'bye' }],
    }),
    node({ id: 'end', end: true, emotion: 'happy', say: reg(L('じゃあ、|またね！', 'See you!', 'إلى اللقاء!'), L('じゃあ、|また|今度！', 'See you next time!', 'إلى المرة القادمة!')), intents: [] }),
  ]),
};

export const KARAOKE_SCENARIOS: Scenario[] = [KARAOKE_DESK, KARAOKE_ROOM];
