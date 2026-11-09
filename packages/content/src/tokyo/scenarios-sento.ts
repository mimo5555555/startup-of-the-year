import type { Gloss, IntentDef, Line, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// 銭湯「桜の湯」 (Sakura-no-yu, the neighbourhood public bath on the south side, east of the game centre). Two conversations with Genzō, the
// old owner at the bandai (the raised desk between the men's and the women's curtains):
//  - `sento_desk`: one adult (大人一人), a rental towel or your own (貸しタオル / 持っています), the bath manners before you go in (かけ湯 first,
//    the towel stays out of the water), and paying: ¥550 for an adult, ¥100 for the towel, CASH ONLY like many sentō (カードは使えますか →
//    うちは現金だけなんです). Menu sento:adult / sento:rent.
//  - `sento_after`, once you have bathed: 「いいお湯でした」 (what you say after a good bath), and the after-bath bottle of coffee milk, fruit milk
//    or plain milk (¥150, sento:coffee / sento:fruit / sento:plain), drunk with a hand on the hip.

const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });

/** Fixed prices of the no-hooks variants (equal to the menu, checked in the tests). */
export const SENTO_PRICES: Record<string, number> = { adult: 550, rent: 100, coffee: 150, fruit: 150, plain: 150 };

const askCard: IntentDef = {
  id: 'ask_card',
  any: ['カード', 'クレジット', 'ペイペイ', 'スマホ', 'でんしまねー', '電子マネー'],
  stay: true,
  reply: L('ごめんなさい、|うち|は|現金|だけ|なんです。', 'Sorry, we only take cash here.', 'آسف، لا نقبل هنا إلا النقد.'),
};
const payCash: IntentDef = { id: 'pay', any: ['げんきん', '現金', 'どうぞ', 'はい', 'おねがい', 'お願い'], none: ['いいえ', 'カード', 'クレジット'], next: 'done' };
const askPrice: IntentDef = { id: 'ask_price', any: ['いくら', 'ねだん', '値段', 'りょうきん', '料金'], next: 'price' };

// ---------------------------------------------------------------------------------------------------------------
// The bandai
// ---------------------------------------------------------------------------------------------------------------

const pickBath: IntentDef = {
  id: 'adult',
  slot: 'bath',
  slotRequired: true,
  next: 'towel',
  step: 'ticket',
  request: true,
  ideal: L('大人|一人|お願いします。', 'One adult, please.', 'شخص بالغ واحد من فضلك.'),
};

export const SENTO_DESK: Scenario = {
  id: 'sento_desk',
  locationId: 'sento',
  characterId: 'genzo',
  level: 'A1',
  title: { en: 'Go to the public bath', ar: 'اذهب إلى الحمّام العام' },
  setup: {
    en: 'You are at the bandai of Sakura-no-yu, the neighbourhood public bath. Ask for one adult, rent a towel if you need one, listen to the bath manners and pay (cash only).',
    ar: 'أنت عند مكتب الاستقبال في ساكورا نو يو، حمّام الحي العام. اطلب تذكرة لشخص بالغ، واستأجر منشفة إن احتجت، واستمع لآداب الحمّام وادفع (نقدًا فقط).',
  },
  minutes: 3,
  steps: [
    { id: 'ticket', text: { en: 'Ask for one adult', ar: 'اطلب تذكرة لبالغ واحد' } },
    { id: 'towel', text: { en: 'Rent a towel or say you have one', ar: 'استأجر منشفة أو قل إن معك واحدة' } },
    { id: 'manners', text: { en: 'Listen to the bath manners', ar: 'استمع لآداب الحمّام' } },
    { id: 'pay', text: { en: 'Pay in cash', ar: 'ادفع نقدًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃい！|桜の湯|へ|ようこそ。|大人|一人|です|か？', 'Welcome! Welcome to Sakura-no-yu. One adult?', 'أهلًا! مرحبًا بك في ساكورا نو يو. شخص بالغ واحد؟'))],
      suggestions: [S('大人|一人|お願いします。', 'One adult, please.', 'شخص بالغ واحد من فضلك.'), S('はい、|一人|です。', 'Yes, just me.', 'نعم، أنا وحدي.'), S('いくら|です|か？', 'How much is it?', 'كم السعر؟')],
      intents: [pickBath, askPrice, later()],
    }),
    node({
      id: 'price',
      say: [say(L('大人|は|五|百|五|十|円|です。|うち|は|現金|だけ|です|よ。', 'Adults are 550 yen. We only take cash.', 'البالغ بـ 550 ينًا. لا نقبل إلا النقد.'))],
      suggestions: [S('大人|一人|お願いします。', 'One adult, please.', 'شخص بالغ واحد من فضلك.'), S('カード|は|使えます|か？', 'Can I use a card?', 'هل يمكنني استخدام البطاقة؟'), REPEAT_S],
      intents: [pickBath, askCard, later()],
    }),
    node({
      id: 'towel',
      say: [say(L('タオル|は|持って|います|か？|貸しタオル|は|百|円|です。', 'Do you have a towel? A rental towel is 100 yen.', 'هل معك منشفة؟ المنشفة المستأجرة بـ 100 ين.'))],
      suggestions: [S('タオル|を|借りたい|です。', 'I would like to rent a towel.', 'أريد أن أستأجر منشفة.'), S('持って|います。', 'I have one.', 'معي واحدة.'), S('タオル|を|お願いします。', 'A towel, please.', 'منشفة من فضلك.')],
      intents: [
        // 「持っています」, or a no-thanks (「タオルは大丈夫です」 / 「いりません」): Genzō takes it that you have your own
        {
          id: 'have_towel',
          any: ['もってい', '持ってい', 'あります', 'だいじょうぶ', '大丈夫', 'いりません', '要りません', 'いらない', '要らない', 'けっこう', '結構'],
          none: ['もっていません', '持っていません', 'もってない', '持ってない', 'ありません', 'ないです'],
          next: 'manners',
          step: 'towel',
        },
        {
          id: 'rent_towel',
          slot: 'towel',
          slotRequired: true,
          none: ['もってい', '持ってい', 'だいじょうぶ', '大丈夫', 'いりません', '要りません', 'いらない', '要らない', 'けっこう', '結構'],
          next: 'manners',
          step: 'towel',
          request: true,
          ideal: L('タオル|を|借りたい|です。', 'I would like to rent a towel.', 'أريد أن أستأجر منشفة.'),
        },
        { id: 'no_towel', any: ['ません', 'ないです'], none: ['いりません', '要りません'], stay: true, reply: L('じゃあ、|貸しタオル|は|どう|です|か？|百|円|です。', 'Then how about a rental towel? It is 100 yen.', 'إذن ما رأيك بمنشفة مستأجرة؟ إنها بـ 100 ين.') },
        later(),
      ],
    }),
    // the bath manners: rinse before you get in (かけ湯), wash first, and the towel never goes in the water
    node({
      id: 'manners',
      say: [
        say(L('入る|前|に、|かけ湯|を|して|ください|ね。|それから、|タオル|は|お湯|に|入れないで|ください。', 'Before you get in, please pour hot water over yourself (kakeyu). And please keep the towel out of the bath.', 'قبل أن تدخل، اسكب الماء الساخن على جسمك (كاكيو). ولا تُدخل المنشفة في ماء الحوض من فضلك.')),
      ],
      suggestions: [S('はい、|わかりました。', 'Yes, I understand.', 'نعم، فهمت.'), S('かけ湯|って|何|です|か？', 'What is kakeyu?', 'ما هو الكاكيو؟'), S('気をつけます。', 'I will be careful.', 'سأنتبه.')],
      intents: [
        {
          id: 'ask_kakeyu',
          all: [['かけゆ', 'かけ湯'], ['なん', '何', 'って']],
          stay: true,
          reply: L('お湯|を|体|に|かける|こと|です。|体|を|洗って|から、|入って|ください|ね。', 'It means pouring hot water over your body. Wash yourself first, then get in.', 'يعني أن تسكب الماء الساخن على جسمك. اغتسل أولًا ثم ادخل.'),
        },
        { id: 'understood', any: ['わかりました', 'わかった', 'はい', 'きをつけ', '気をつけ', 'りょうかい', '了解'], next: 'pay', step: 'manners', ideal: L('はい、|わかりました。', 'Yes, I understand.', 'نعم، فهمت.') },
        later(),
      ],
    }),
    node({
      id: 'pay',
      say: [
        say(L('では、|{total}|です。', 'Then that is {total}.', 'إذن المبلغ {total}.'), { flag: 'priced' }),
        say(L('では、|六|百|五|十|円|です。', 'Then that is 650 yen.', 'إذن المبلغ 650 ينًا.'), { slot: 'towel', in: ['rent'] }),
        say(L('では、|五|百|五|十|円|です。', 'Then that is 550 yen.', 'إذن المبلغ 550 ينًا.')),
      ],
      suggestions: [S('はい、|どうぞ。', 'Yes, here you are.', 'نعم، تفضّل.'), S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.'), S('カード|は|使えます|か？', 'Can I use a card?', 'هل يمكنني استخدام البطاقة؟')],
      intents: [payCash, askCard, later()],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('ありがとう|ございます。|ごゆっくり|どうぞ！|上がったら、|声|を|かけて|ください|ね。', 'Thank you. Enjoy your bath! When you come out, come and say hello.', 'شكرًا. استمتع بحمّامك! عندما تخرج، تعال وقل مرحبًا.'))],
      intents: [],
    }),
    node({
      id: 'short',
      say: [say(L('あれ、|少し|足りません|ね。', 'Oh, that is a little short.', 'أوه، المبلغ ناقص قليلًا.'))],
      suggestions: [S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.')],
      intents: [later()],
    }),
    node({ id: 'leave', end: true, say: [say(L('はい。|また|どうぞ。', 'All right. Come again.', 'حسنًا. تعال مرة أخرى.'))], intents: [] }),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// After the bath
// ---------------------------------------------------------------------------------------------------------------

const noThanks: IntentDef = { id: 'no_thanks', any: ['いいです', 'けっこう', '結構', 'だいじょうぶ', '大丈夫', 'いりません'], next: 'bye' };

export const SENTO_AFTER: Scenario = {
  id: 'sento_after',
  locationId: 'sento',
  characterId: 'genzo',
  level: 'A1',
  title: { en: 'After the bath', ar: 'بعد الحمّام' },
  setup: {
    en: 'You have had your bath. Tell Genzō how it was (the thing to say is 「いいお湯でした」), then have the after-bath bottle of milk, as everyone does.',
    ar: 'انتهيت من حمّامك. قل لغينزو كيف كان (العبارة المعتادة 「いいお湯でした」)، ثم اشرب زجاجة الحليب بعد الحمّام كما يفعل الجميع.',
  },
  minutes: 2,
  steps: [
    { id: 'bath', text: { en: 'Say how the bath was', ar: 'قل كيف كان الحمّام' } },
    { id: 'milk', text: { en: 'Order a bottle of milk', ar: 'اطلب زجاجة حليب' } },
    { id: 'pay', text: { en: 'Pay in cash', ar: 'ادفع نقدًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('おっ、|上がりました|ね。|いい|お湯|でした|か？', 'Oh, you are out. Was the bath nice?', 'أوه، خرجت. هل كان الحمّام لطيفًا؟'))],
      suggestions: [S('いい|お湯|でした！', 'It was a lovely bath!', 'كان حمّامًا رائعًا!'), S('気持ち|よかった|です。', 'It felt great.', 'كان شعورًا رائعًا.'), S('ちょっと|熱かった|です。', 'It was a bit hot.', 'كان ساخنًا قليلًا.')],
      intents: [
        { id: 'good_bath', any: ['いいおゆ', 'いいお湯', 'きもちよかった', '気持ちよかった', 'さっぱり', 'よかった'], next: 'milk', step: 'bath', ideal: L('いい|お湯|でした！', 'It was a lovely bath!', 'كان حمّامًا رائعًا!') },
        { id: 'too_hot', any: ['あつかった', '熱かった', 'あつい', '熱い'], stay: true, reply: L('はは、|うち|の|お湯|は|四十二度|です|から|ね。', 'Ha ha, our water is 42 degrees, you see.', 'ها ها، ماؤنا بدرجة 42، كما ترى.') },
        later(),
      ],
    }),
    node({
      id: 'milk',
      say: [say(L('お風呂|の|後|は、|コーヒー牛乳|が|一番|です|よ。|百|五|十|円|です。', 'After a bath, coffee milk is the best. It is 150 yen.', 'بعد الحمّام، الحليب بالقهوة هو الأفضل. إنه بـ 150 ينًا.'))],
      suggestions: [S('コーヒー牛乳|を|ください。', 'A coffee milk, please.', 'حليب بالقهوة من فضلك.'), S('フルーツ牛乳|は|あります|か？', 'Do you have fruit milk?', 'هل عندكم حليب بالفواكه؟'), S('今日|は|いい|です。', 'I am fine today.', 'لا شكرًا اليوم.')],
      intents: [
        { id: 'milk', slot: 'milk', slotRequired: true, next: 'quote', step: 'milk', request: true, ideal: L('コーヒー牛乳|を|ください。', 'A coffee milk, please.', 'حليب بالقهوة من فضلك.') },
        noThanks,
        later(),
      ],
    }),
    node({
      id: 'quote',
      say: [say(L('{milk}|です|ね。|百|五|十|円|です。', '{milk}, right. That is 150 yen.', '{milk}، حسنًا. المبلغ 150 ينًا.'))],
      suggestions: [S('はい、|どうぞ。', 'Yes, here you are.', 'نعم، تفضّل.'), S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.'), REPEAT_S],
      intents: [payCash, askCard, noThanks],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('はい、|どうぞ。|腰|に|手|を|当てて、|ぐっと|飲んで|ください！|また|来て|ください|ね。', 'Here you go. Put your hand on your hip and drink it in one go! Come again.', 'تفضّل. ضع يدك على خصرك واشربه دفعة واحدة! تعال مرة أخرى.'))],
      intents: [],
    }),
    node({
      id: 'short',
      say: [say(L('あれ、|少し|足りません|ね。|また|今度|どうぞ。', 'Oh, that is a little short. Another time, then.', 'أوه، المبلغ ناقص قليلًا. في مرة أخرى إذن.'))],
      suggestions: [S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.')],
      intents: [later()],
    }),
    node({ id: 'bye', end: true, say: [say(L('そう|です|か。|じゃあ、|また|来て|ください|ね。', 'I see. Then come again.', 'فهمت. إذن تعال مرة أخرى.'))], intents: [] }),
    node({ id: 'leave', end: true, say: [say(L('はい。|また|どうぞ。', 'All right. Come again.', 'حسنًا. تعال مرة أخرى.'))], intents: [] }),
  ]),
};

export const SENTO_SCENARIOS: Scenario[] = [SENTO_DESK, SENTO_AFTER];

// ---------------------------------------------------------------------------------------------------------------
// In the bath: the steps the bath sheet asks the player to put in order (the app shows them shuffled after paying at the bandai)
// ---------------------------------------------------------------------------------------------------------------

export interface BathStep {
  id: string;
  /** the step in Japanese, spoken when it is put in its place */
  line: Line;
  /** why, or how (shown under the step once it is placed) */
  tip: Gloss;
}

/** The bath manners in their right order: rinse, wash, soak (the towel stays out of the water), dry off before the changing room. */
export const SENTO_STEPS: BathStep[] = [
  {
    id: 'kakeyu',
    line: L('かけ湯|を|する', 'Pour hot water over yourself', 'اسكب الماء الساخن على جسمك'),
    tip: { en: 'First, at the edge of the bath: it warms you up and keeps the water clean.', ar: 'أولًا، عند حافة الحوض: يدفئك ويحافظ على نظافة الماء.' },
  },
  {
    id: 'wash',
    line: L('体|を|洗う', 'Wash your body', 'اغسل جسمك'),
    tip: { en: 'Sit on a stool at the taps, wash with soap and rinse it all off.', ar: 'اجلس على كرسي صغير عند الصنابير، واغتسل بالصابون واشطفه كله.' },
  },
  {
    id: 'soak',
    line: L('お湯|に|つかる', 'Soak in the bath', 'انقع في الحوض'),
    tip: { en: 'Slip in slowly. The small towel stays out of the water: fold it on your head.', ar: 'ادخل ببطء. المنشفة الصغيرة تبقى خارج الماء: اطوِها على رأسك.' },
  },
  {
    id: 'dry',
    line: L('体|を|ふいて|から|出る', 'Dry off, then go out', 'جفّف جسمك ثم اخرج'),
    tip: { en: 'Wipe yourself with the small towel before you step back into the changing room.', ar: 'جفّف جسمك بالمنشفة الصغيرة قبل أن تعود إلى غرفة التبديل.' },
  },
];
