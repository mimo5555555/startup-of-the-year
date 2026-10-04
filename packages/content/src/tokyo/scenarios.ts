import type { IntentDef, Line, Scenario } from '../types';

import { L, S, say, node, asRecord, REPEAT_S, PAY_ANY } from './dsl';

// ---------- 1. Sakura Café ----------
const CAFE_DRINKS = ['coffee', 'blackTea', 'greenTea', 'latte', 'juice'];
const orderDrink: IntentDef = {
  id: 'order_drink',
  slot: 'item',
  slotOptions: CAFE_DRINKS,
  slotRequired: true,
  next: 'hot_or_iced',
  step: 'order',
  request: true,
  ideal: L('{item}|を|ください。', '{item}, please.', '{item} من فضلك.'),
};
const cafePay: IntentDef[] = [
  { id: 'pay_cash', any: ['げんきん', '現金'], next: 'done', step: 'pay' },
  { id: 'pay_card', any: ['かーど', 'カード', 'くれじっと', 'すいか'], next: 'done', step: 'pay' },
  { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], next: 'done', step: 'pay' },
];

export const CAFE: Scenario = {
  id: 'cafe',
  locationId: 'cafe',
  characterId: 'yuki',
  level: 'A1',
  title: { en: 'Order a coffee', ar: 'اطلب قهوة' },
  setup: {
    en: 'You walk into Sakura Café. Order a drink, ask for the Wi‑Fi password and pay.',
    ar: 'تدخل مقهى ساكورا. اطلب مشروبًا، واسأل عن كلمة مرور الواي فاي، ثم ادفع.',
  },
  minutes: 4,
  steps: [
    { id: 'order', text: { en: 'Order a drink', ar: 'اطلب مشروبًا' } },
    { id: 'temp', text: { en: 'Choose hot or iced', ar: 'اختر ساخنًا أو باردًا' } },
    { id: 'wifi', text: { en: 'Ask for the Wi‑Fi password', ar: 'اسأل عن كلمة مرور الواي فاي' } },
    { id: 'pay', text: { en: 'Pay and say thanks', ar: 'ادفع واشكر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|ご注文|は？', 'Welcome! What would you like to order?', 'أهلًا بك! ماذا تودّ أن تطلب؟'))],
      suggestions: [
        S('コーヒー|を|ください。', 'A coffee, please.', 'قهوة من فضلك.'),
        S('おすすめ|は|何|です|か？', 'What do you recommend?', 'ماذا تنصحني؟'),
        S('こんにちは。', 'Hello.', 'مرحبًا.'),
      ],
      intents: [orderDrink, { id: 'recommend', any: ['おすすめ', 'オススメ'], next: 'recommend' }],
    }),
    node({
      id: 'recommend',
      emotion: 'excited',
      say: [say(L('カフェラテ|が|おすすめ|です。', 'I recommend the café latte.', 'أنصحك بالكافيه لاتيه.'))],
      suggestions: [
        S('カフェラテ|を|ください。', 'A café latte, please.', 'كافيه لاتيه من فضلك.'),
        S('コーヒー|を|ください。', 'A coffee, please.', 'قهوة من فضلك.'),
      ],
      intents: [orderDrink],
    }),
    node({
      id: 'hot_or_iced',
      step: 'order',
      say: [say(L('{item}|です|ね。|ホット|です|か、|アイス|です|か？', '{item}, got it. Hot or iced?', '{item}، حسنًا. ساخن أم بارد؟'))],
      suggestions: [
        S('ホット|を|ください。', 'Hot, please.', 'ساخن من فضلك.'),
        S('アイス|を|お願いします。', 'Iced, please.', 'بارد من فضلك.'),
        REPEAT_S,
      ],
      intents: [
        { id: 'hot', any: ['ほっと', 'あつい', 'あたたかい', '熱い', '温かい', 'hotto'], next: 'anything_else', step: 'temp', request: true, ideal: L('ホット|を|ください。', 'Hot, please.', 'ساخن من فضلك.') },
        { id: 'iced', any: ['あいす', 'つめたい', '冷たい', 'ひえ', 'aisu', 'こおり'], next: 'anything_else', step: 'temp', request: true, ideal: L('アイス|を|お願いします。', 'Iced, please.', 'بارد من فضلك.') },
      ],
    }),
    node({
      id: 'anything_else',
      say: [say(L('はい。|ほかに|何か|あります|か？', 'Okay. Anything else?', 'حسنًا. هل تريد شيئًا آخر؟'))],
      suggestions: [
        S('いいえ、|大丈夫|です。', "No, that's all.", 'لا، هذا كل شيء.'),
        S('Wi-Fi|の|パスワード|を|教えてください。', 'Could you tell me the Wi‑Fi password?', 'هل يمكنك إخباري بكلمة مرور الواي فاي؟'),
        REPEAT_S,
      ],
      intents: [
        { id: 'wifi', any: ['wifi', 'わいふぁい', 'ぱすわど', 'ワイファイ'], next: 'wifi_answer', step: 'wifi', ideal: L('Wi-Fi|の|パスワード|を|教えてください。', 'Could you tell me the Wi‑Fi password?', 'هل يمكنك إخباري بكلمة مرور الواي فاي؟') },
        { id: 'no_more', any: ['だいじょうぶ', '大丈夫', 'いいえ', 'けっこう', 'ありません', 'だけ'], next: 'price' },
      ],
    }),
    node({
      id: 'wifi_answer',
      emotion: 'happy',
      say: [say(L('はい。|パスワード|は|「|sakura1234|」|です。', 'Sure. The password is “sakura1234”.', 'طبعًا. كلمة المرور هي «sakura1234».', 'はい。パスワードは、さくら、いち、に、さん、よん、です。'))],
      suggestions: [
        S('ありがとうございます。', 'Thank you.', 'شكرًا جزيلًا.'),
        S('いいえ、|大丈夫|です。', "No, that's all.", 'لا، هذا كل شيء.'),
        REPEAT_S,
      ],
      intents: [{ id: 'done_after_wifi', any: ['ありがとう', 'だいじょうぶ', '大丈夫', 'いいえ', 'けっこう'], next: 'price' }],
    }),
    node({
      id: 'price',
      say: [say(L('全部で|四百五十円|です。|現金|です|か、|カード|です|か？', "That's 450 yen in total. Cash or card?", 'المجموع 450 ين. نقدًا أم بالبطاقة؟'))],
      suggestions: [
        S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.'),
        S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.'),
        REPEAT_S,
      ],
      intents: cafePay,
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      say: [say(L('ありがとうございました！|また|どうぞ。', 'Thank you very much! Please come again.', 'شكرًا جزيلًا! تفضّل بزيارتنا مرة أخرى.'))],
      intents: [],
    }),
  ]),
};

// ---------- 2. Konbini ----------
const KONBINI_ITEMS = ['onigiri', 'water', 'sandwich', 'bento', 'juice', 'milk', 'greenTea', 'cake', 'coffee'];
const konbiniPay: IntentDef[] = [
  { id: 'pay_cash', any: ['げんきん', '現金'], next: 'done', step: 'pay' },
  { id: 'pay_card', any: ['かーど', 'カード', 'くれじっと', 'すいか'], next: 'done', step: 'pay' },
  { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], next: 'done', step: 'pay' },
];
const konbiniBuy: IntentDef[] = [
  { id: 'this_please', all: [['これ']], any: ['ください', 'おねがい', 'かいます'], next: 'register', request: true, ideal: L('これ|を|ください。', 'This one, please.', 'هذا من فضلك.') },
  { id: 'buy_item', slot: 'item', slotOptions: KONBINI_ITEMS, slotRequired: true, any: ['ください', 'おねがい', 'かいます'], next: 'register', request: true, ideal: L('{item}|を|ください。', '{item}, please.', '{item} من فضلك.') },
];

export const KONBINI: Scenario = {
  id: 'konbini',
  locationId: 'konbini',
  characterId: 'tanaka',
  level: 'A1',
  title: { en: 'At the convenience store', ar: 'في المتجر الصغير' },
  setup: {
    en: 'You need a snack. Find what you want, answer about the bag, and pay.',
    ar: 'تريد وجبة خفيفة. اعثر على ما تريد، وأجب عن سؤال الكيس، ثم ادفع.',
  },
  minutes: 3,
  steps: [
    { id: 'find', text: { en: 'Find what you want', ar: 'اعثر على ما تريد' } },
    { id: 'bag', text: { en: 'Say whether you need a bag', ar: 'قل إن كنت تحتاج كيسًا' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      say: [say(L('いらっしゃいませ。', 'Welcome.', 'أهلًا بك.'))],
      suggestions: [
        S('おにぎり|は|あります|か？', 'Do you have rice balls?', 'هل لديكم أونيغيري؟'),
        S('水|は|どこ|です|か？', 'Where is the water?', 'أين الماء؟'),
        S('トイレ|は|どこ|です|か？', 'Where is the toilet?', 'أين دورة المياه؟'),
      ],
      intents: [
        { id: 'ask_toilet', all: [['といれ', 'toire']], any: ['どこ', 'どちら', 'どっち'], stay: true, reply: L('トイレ|は|あちら|です。', 'The toilet is over there.', 'دورة المياه هناك.') },
        { id: 'ask_have', any: ['あります', 'ある'], slot: 'item', slotOptions: KONBINI_ITEMS, slotRequired: true, next: 'found', step: 'find', ideal: L('{item}|は|あります|か？', 'Do you have {item}?', 'هل لديكم {item}؟') },
        { id: 'ask_where', any: ['どこ', 'どちら', 'どっち'], slot: 'item', slotOptions: KONBINI_ITEMS, slotRequired: true, next: 'found', step: 'find', ideal: L('{item}|は|どこ|です|か？', 'Where is {item}?', 'أين {item}؟') },
        ...konbiniBuy.map((i) => ({ ...i, step: 'find' })),
      ],
    }),
    node({
      id: 'found',
      say: [say(L('{item}|は|あちら|に|あります。', 'The {item} is over there.', '{item} هناك.'))],
      suggestions: [
        S('これ|を|ください。', 'This one, please.', 'هذا من فضلك.'),
        S('いくら|です|か？', 'How much is it?', 'بكم هذا؟'),
        REPEAT_S,
      ],
      intents: [
        ...konbiniBuy,
        { id: 'ask_price', any: ['いくら'], stay: true, reply: L('三百二十円|です。', "It's 320 yen.", '320 ين.') },
      ],
    }),
    node({
      id: 'register',
      step: 'find',
      emotion: 'happy',
      say: [say(L('ありがとうございます。|三百二十円|です。|袋|は|いります|か？', "Thank you. That's 320 yen. Do you need a bag?", 'شكرًا لك. المجموع 320 ين. هل تحتاج إلى كيس؟'))],
      suggestions: [
        S('いいえ、|大丈夫|です。', "No, I'm fine.", 'لا، لا أحتاج.'),
        S('はい、|お願いします。', 'Yes, please.', 'نعم من فضلك.'),
        REPEAT_S,
      ],
      intents: [
        { id: 'bag_no', any: ['だいじょうぶ', '大丈夫', 'いりません', 'いらない', 'いいえ', 'けっこう'], next: 'payment_a', step: 'bag' },
        { id: 'bag_yes', any: ['はい', 'おねがい', 'ください', 'ほしい'], next: 'payment_b', step: 'bag' },
      ],
    }),
    node({
      id: 'payment_a',
      say: [say(L('わかりました。|現金|です|か、|カード|です|か？', 'Understood. Cash or card?', 'حسنًا. نقدًا أم بالبطاقة؟'))],
      suggestions: [S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.'), S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.'), REPEAT_S],
      intents: konbiniPay,
    }),
    node({
      id: 'payment_b',
      say: [say(L('はい。|現金|です|か、|カード|です|か？', 'Sure. Cash or card?', 'طبعًا. نقدًا أم بالبطاقة؟'))],
      suggestions: [S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.'), S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.'), REPEAT_S],
      intents: konbiniPay,
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      say: [say(L('ありがとうございました。|また|どうぞ。', 'Thank you very much. Please come again.', 'شكرًا جزيلًا. تفضّل بزيارتنا مرة أخرى.'))],
      intents: [],
    }),
  ]),
};

// ---------- 3. Station ----------
const STATION_PLACES = ['shibuya', 'shinjuku', 'tokyoStation', 'asakusa', 'akihabara', 'ueno', 'airport'];
const wantGo: IntentDef = {
  id: 'want_go',
  slot: 'place',
  slotOptions: STATION_PLACES,
  slotRequired: true,
  next: 'route',
  step: 'dest',
  ideal: L('{place}|へ|行きたい|です。', 'I want to go to {place}.', 'أريد الذهاب إلى {place}.'),
};
const askPrice: IntentDef = { id: 'ask_price', any: ['いくら'], next: 'price_answer', step: 'info' };
const askTime: IntentDef = { id: 'ask_time', any: ['なんぷん', '何分', 'どのくらい', 'どれくらい', 'かかります', 'じかん'], next: 'time_answer', step: 'info' };
const thanksEnd: IntentDef = { id: 'thanks_end', any: ['ありがとう'], next: 'end', step: 'thanks' };

export const STATION: Scenario = {
  id: 'station',
  locationId: 'station',
  characterId: 'sato',
  level: 'A1',
  title: { en: 'Get a train to Shibuya', ar: 'استقل قطارًا إلى شيبويا' },
  setup: {
    en: 'You are at the station. Tell Sato-san where you are going and ask about the fare or the time.',
    ar: 'أنت في المحطة. أخبر السيد ساتو إلى أين تذهب واسأل عن الأجرة أو المدة.',
  },
  minutes: 3,
  steps: [
    { id: 'dest', text: { en: 'Say where you want to go', ar: 'قل إلى أين تريد الذهاب' } },
    { id: 'info', text: { en: 'Ask the price or how long it takes', ar: 'اسأل عن السعر أو المدة' } },
    { id: 'thanks', text: { en: 'Say thank you', ar: 'قل شكرًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      say: [say(L('こんにちは。|どうしましたか？', 'Hello. How can I help you?', 'مرحبًا. كيف يمكنني مساعدتك؟'))],
      suggestions: [
        S('渋谷|へ|行きたい|です。', 'I want to go to Shibuya.', 'أريد الذهاب إلى شيبويا.'),
        S('切符|は|どこ|で|買います|か？', 'Where can I buy a ticket?', 'أين أشتري تذكرة؟'),
        S('すみません。', 'Excuse me.', 'المعذرة.'),
      ],
      intents: [wantGo, { id: 'ask_ticket', all: [['きっぷ', '切符', 'ちけっと', 'チケット']], next: 'ticket_answer' }],
    }),
    node({
      id: 'ticket_answer',
      say: [say(L('あそこ|の|機械|で|買えます。|どこ|へ|行きます|か？', 'You can buy one at that machine over there. Where are you going?', 'يمكنك شراؤها من تلك الآلة هناك. إلى أين تذهب؟'))],
      suggestions: [
        S('渋谷|へ|行きたい|です。', 'I want to go to Shibuya.', 'أريد الذهاب إلى شيبويا.'),
        S('新宿|へ|行きたい|です。', 'I want to go to Shinjuku.', 'أريد الذهاب إلى شينجوكو.'),
        REPEAT_S,
      ],
      intents: [wantGo],
    }),
    node({
      id: 'route',
      step: 'dest',
      say: [say(L('{place}|です|ね。|三番線|の|電車|に|乗ってください。', '{place}, I see. Please take the train from platform 3.', '{place}، حسنًا. اركب القطار من الرصيف 3.'))],
      suggestions: [
        S('いくら|です|か？', 'How much is it?', 'بكم هذا؟'),
        S('何分|かかります|か？', 'How long does it take?', 'كم يستغرق؟'),
        S('ありがとうございます。', 'Thank you.', 'شكرًا جزيلًا.'),
      ],
      intents: [
        askPrice,
        askTime,
        { id: 'ask_platform', any: ['なんばんせん', '何番線', 'ばんせん'], stay: true, reply: L('三番線|です。', "It's platform 3.", 'إنه الرصيف 3.') },
        thanksEnd,
      ],
    }),
    node({
      id: 'price_answer',
      step: 'info',
      say: [say(L('百九十円|です。', "It's 190 yen.", '190 ين.'))],
      suggestions: [S('ありがとうございます。', 'Thank you.', 'شكرًا جزيلًا.'), S('何分|かかります|か？', 'How long does it take?', 'كم يستغرق؟'), REPEAT_S],
      intents: [askTime, thanksEnd],
    }),
    node({
      id: 'time_answer',
      step: 'info',
      say: [say(L('二十分|ぐらい|です。', 'About 20 minutes.', 'حوالي 20 دقيقة.'))],
      suggestions: [S('ありがとうございます。', 'Thank you.', 'شكرًا جزيلًا.'), S('いくら|です|か？', 'How much is it?', 'بكم هذا؟'), REPEAT_S],
      intents: [askPrice, thanksEnd],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      step: 'thanks',
      say: [say(L('どういたしまして。|お気をつけて。', "You're welcome. Take care.", 'عفوًا. اعتنِ بنفسك.'))],
      intents: [],
    }),
  ]),
};

// ---------- 4. Ramen shop ----------
const orderFlavor: IntentDef = { id: 'order_flavor', all: [['らーめん', 'らめん']], slot: 'flavor', slotRequired: true, next: 'spicy', step: 'order', request: true, ideal: L('{flavor}|ラーメン|を|ください。', '{flavor} ramen, please.', 'رامن {flavor} من فضلك.') };
const flavorOnly: IntentDef = { id: 'flavor_only', slot: 'flavor', slotRequired: true, next: 'spicy', step: 'order' };
const orderPlain: IntentDef = { id: 'order_plain', all: [['らーめん', 'らめん']], next: 'which_flavor' };
const ramenBill: IntentDef[] = [
  { id: 'ask_bill', any: ['おかいけい', 'お会計', 'かいけい', 'おあいそ', 'いくら'], next: 'price', step: 'bill', request: true, ideal: L('お会計|を|お願いします。', 'The bill, please.', 'الحساب من فضلك.') },
  { id: 'gochiso', any: ['ごちそうさま'], next: 'price', step: 'bill' },
];

export const RAMEN: Scenario = {
  id: 'ramen',
  locationId: 'ramen',
  characterId: 'kenji',
  level: 'A2',
  title: { en: 'Order ramen', ar: 'اطلب رامن' },
  setup: {
    en: "Kenji's ramen counter is busy. Order a bowl, say what you think of it and ask for the bill.",
    ar: 'طاولة كينجي للرامن مزدحمة. اطلب وعاءً، وقل رأيك فيه، ثم اطلب الحساب.',
  },
  minutes: 4,
  steps: [
    { id: 'order', text: { en: 'Order a bowl of ramen', ar: 'اطلب وعاء رامن' } },
    { id: 'spice', text: { en: 'Answer about spice', ar: 'أجب عن الحرارة' } },
    { id: 'tasty', text: { en: "Say it's delicious", ar: 'قل إنه لذيذ' } },
    { id: 'bill', text: { en: 'Ask for the bill', ar: 'اطلب الحساب' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'excited',
      say: [say(L('いらっしゃい！|何|に|します|か？', "Welcome! What'll it be?", 'أهلًا بك! ماذا ستأخذ؟'))],
      suggestions: [
        S('ラーメン|を|ください。', 'Ramen, please.', 'رامن من فضلك.'),
        S('みそ|ラーメン|を|ください。', 'Miso ramen, please.', 'رامن ميسو من فضلك.'),
        S('おすすめ|は|何|です|か？', 'What do you recommend?', 'ماذا تنصحني؟'),
      ],
      intents: [orderFlavor, flavorOnly, orderPlain, { id: 'recommend', any: ['おすすめ', 'オススメ'], next: 'rec' }],
    }),
    node({
      id: 'rec',
      emotion: 'excited',
      say: [say(L('うち|の|おすすめ|は|みそ|ラーメン|です！', 'Our recommendation is the miso ramen!', 'توصيتنا هي رامن الميسو!'))],
      suggestions: [S('みそ|ラーメン|を|ください。', 'Miso ramen, please.', 'رامن ميسو من فضلك.'), S('しょうゆ|ラーメン|を|ください。', 'Soy sauce ramen, please.', 'رامن صلصة الصويا من فضلك.'), REPEAT_S],
      intents: [orderFlavor, flavorOnly, orderPlain],
    }),
    node({
      id: 'which_flavor',
      say: [say(L('しょうゆ、|みそ、|とんこつ。|どれ|が|いい|です|か？', 'Soy sauce, miso or tonkotsu. Which would you like?', 'صلصة الصويا أو الميسو أو التونكوتسو. أيها تفضّل؟'))],
      suggestions: [S('みそ|を|ください。', 'Miso, please.', 'ميسو من فضلك.'), S('しょうゆ|を|お願いします。', 'Soy sauce, please.', 'صلصة الصويا من فضلك.'), S('とんこつ|が|いい|です。', 'Tonkotsu, please.', 'التونكوتسو من فضلك.')],
      intents: [{ ...flavorOnly, request: true, ideal: L('{flavor}|を|ください。', '{flavor}, please.', '{flavor} من فضلك.') }],
    }),
    node({
      id: 'spicy',
      step: 'order',
      say: [say(L('{flavor}|ラーメン|です|ね。|辛い|の|は|大丈夫|です|か？', 'One {flavor} ramen. Is spicy okay?', 'رامن {flavor}. هل الحار مناسب؟'))],
      suggestions: [S('はい、|大丈夫|です。', "Yes, that's fine.", 'نعم، لا بأس.'), S('辛くない|の|が|いい|です。', 'I prefer it not spicy.', 'أفضّله غير حار.'), REPEAT_S],
      intents: [
        { id: 'not_spicy', any: ['からくない', 'からくなく', 'からいのはちょっと', 'まいるど'], next: 'served_mild', step: 'spice' },
        { id: 'spicy_ok', any: ['だいじょうぶ', '大丈夫', 'はい', 'だいすき', 'すき', 'からくてもいい'], none: ['からくない'], next: 'served_hot', step: 'spice' },
      ],
    }),
    node({
      id: 'served_hot',
      emotion: 'excited',
      say: [say(L('はい、|お待ち！|どうぞ。', 'Here you go! Enjoy.', 'تفضّل! بالهناء والشفاء.'))],
      suggestions: [S('いただきます！', "Let's eat!", 'بسم الله!'), S('おいしい|です！', "It's delicious!", 'لذيذ!'), REPEAT_S],
      intents: [
        { id: 'itadakimasu', any: ['いただきます', 'itadakimasu'], next: 'tasting' },
        { id: 'delicious', any: ['おいしい', 'うまい', '美味しい', 'おいしー'], next: 'bill_prompt', step: 'tasty' },
      ],
    }),
    node({
      id: 'served_mild',
      emotion: 'excited',
      say: [say(L('はい、|お待ち！|辛くない|ラーメン|です。', 'Here you go! A mild ramen.', 'تفضّل! رامن غير حار.'))],
      suggestions: [S('いただきます！', "Let's eat!", 'بسم الله!'), S('おいしい|です！', "It's delicious!", 'لذيذ!'), REPEAT_S],
      intents: [
        { id: 'itadakimasu', any: ['いただきます', 'itadakimasu'], next: 'tasting' },
        { id: 'delicious', any: ['おいしい', 'うまい', '美味しい', 'おいしー'], next: 'bill_prompt', step: 'tasty' },
      ],
    }),
    node({
      id: 'tasting',
      say: [say(L('どう？|おいしい|です|か？', 'How is it? Is it good?', 'كيف هو؟ هل هو لذيذ؟'))],
      suggestions: [S('おいしい|です！', "It's delicious!", 'لذيذ!'), S('とても|おいしい|です！', "It's very delicious!", 'لذيذ جدًا!'), REPEAT_S],
      intents: [{ id: 'delicious', any: ['おいしい', 'うまい', '美味しい', 'おいしー'], next: 'bill_prompt', step: 'tasty' }],
    }),
    node({
      id: 'bill_prompt',
      emotion: 'happy',
      step: 'tasty',
      say: [say(L('ありがとう！|うれしい|です。', "Thank you! That makes me happy.", 'شكرًا! هذا يسعدني.'))],
      suggestions: [S('お会計|を|お願いします。', 'The bill, please.', 'الحساب من فضلك.'), S('ごちそうさまでした。', 'Thank you for the meal.', 'شكرًا على الوجبة.'), REPEAT_S],
      intents: ramenBill,
    }),
    node({
      id: 'price',
      step: 'bill',
      say: [say(L('九百円|です。', "That's 900 yen.", '900 ين.'))],
      suggestions: [S('はい、|どうぞ。', 'Here you go.', 'تفضّل.'), S('ごちそうさまでした。', 'Thank you for the meal.', 'شكرًا على الوجبة.'), REPEAT_S],
      intents: [
        { id: 'pay', any: PAY_ANY, next: 'end', step: 'bill' },
        { id: 'gochiso', any: ['ごちそうさま'], next: 'end', step: 'bill' },
      ],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      step: 'bill',
      say: [say(L('ありがとうございました！|また|どうぞ。', 'Thank you very much! Come again.', 'شكرًا جزيلًا! تفضّل مرة أخرى.'))],
      intents: [],
    }),
  ]),
};

// ---------- 5. Park ----------
const hobbyIntent: IntentDef = { id: 'hobby', slot: 'hobby', slotRequired: true, next: 'hobby_react', step: 'hobby', ideal: L('{hobby}|が|好き|です。', 'I like {hobby}.', 'أحب {hobby}.') };
const andYou: IntentDef = { id: 'and_you', any: ['あなたは', 'あなたの', 'みおさんは'], stay: true, reply: L('わたし|は|アニメ|と|写真|が|好き|です。', 'I like anime and photography.', 'أنا أحب الأنمي والتصوير.') };

export const PARK: Scenario = {
  id: 'park',
  locationId: 'park',
  characterId: 'mio',
  level: 'A1',
  title: { en: 'Meet Mio in the park', ar: 'قابل ميو في الحديقة' },
  setup: {
    en: 'Mio is photographing cherry blossoms. Introduce yourself, say where you are from and talk about a hobby.',
    ar: 'ميو تصوّر أزهار الكرز. عرّف بنفسك، وقل من أين أنت، وتحدثا عن هواية.',
  },
  minutes: 4,
  steps: [
    { id: 'intro', text: { en: 'Introduce yourself', ar: 'عرّف بنفسك' } },
    { id: 'where', text: { en: "Say where you're from", ar: 'قل من أين أنت' } },
    { id: 'hobby', text: { en: 'Tell Mio your hobby', ar: 'أخبر ميو بهوايتك' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('あ、|こんにちは！', 'Oh, hello!', 'أوه، مرحبًا!'))],
      suggestions: [
        S('はじめまして。', 'Nice to meet you.', 'تشرفنا بمعرفتك.'),
        S('わたし|は|{name}|です。', "I'm {name}.", 'أنا {name}.'),
        S('お名前|は？', "What's your name?", 'ما اسمك؟'),
      ],
      intents: [
        { id: 'intro', any: ['はじめまして', 'わたしは', 'ぼくは', 'おれは', 'です', 'といいます', 'もうします'], capture: 'name', next: 'intro_reply', step: 'intro', ideal: L('はじめまして。|わたし|は|{name}|です。', "Nice to meet you. I'm {name}.", 'تشرفنا. أنا {name}.') },
        { id: 'ask_name', all: [['おなまえ', 'なまえ']], stay: true, reply: L('ミオ|です。|大学生|です。', "I'm Mio. I'm a university student.", 'أنا ميو. أنا طالبة جامعية.') },
      ],
    }),
    node({
      id: 'intro_reply',
      step: 'intro',
      emotion: 'happy',
      say: [say(L('{name}|さん、|はじめまして。|わたし|は|ミオ|です。|どこ|から|来ました|か？', "Nice to meet you, {name}. I'm Mio. Where are you from?", 'تشرفنا يا {name}. أنا ميو. من أين أنت؟'))],
      suggestionsByL1: {
        en: [S('アメリカ|から|来ました。', "I'm from the United States.", 'أنا من الولايات المتحدة.'), S('イギリス|から|来ました。', "I'm from the United Kingdom.", 'أنا من المملكة المتحدة.'), S('どこ|から|来ました|か？', 'Where are you from?', 'من أين أنت؟')],
        ar: [S('エジプト|から|来ました。', "I'm from Egypt.", 'أنا من مصر.'), S('サウジアラビア|から|来ました。', "I'm from Saudi Arabia.", 'أنا من السعودية.'), S('ヨルダン|から|来ました。', "I'm from Jordan.", 'أنا من الأردن.')],
      },
      intents: [
        { id: 'from_country', slot: 'country', capture: 'country', slotRequired: true, next: 'hobby_q', step: 'where', ideal: L('{country}|から|来ました。', "I'm from {country}.", 'أنا من {country}.') },
        { id: 'ask_back', all: [['どこ']], any: ['から', 'きました'], stay: true, reply: L('わたし|は|東京|から|来ました。', "I'm from Tokyo.", 'أنا من طوكيو.') },
      ],
    }),
    node({
      id: 'hobby_q',
      step: 'where',
      emotion: 'excited',
      say: [say(L('{country}|です|か！|いい|です|ね。|趣味|は|何|です|か？', "{country}! How nice. What's your hobby?", '{country}! جميل. ما هي هوايتك؟'))],
      topicSuggestions: true,
      suggestions: [S('アニメ|が|好き|です。', 'I like anime.', 'أحب الأنمي.'), S('音楽|が|好き|です。', 'I like music.', 'أحب الموسيقى.'), S('写真|が|好き|です。', 'I like photography.', 'أحب التصوير.')],
      intents: [hobbyIntent, andYou],
    }),
    node({
      id: 'hobby_react',
      end: true,
      step: 'hobby',
      emotion: 'excited',
      say: [
        say(L('わたし|も|{hobby}|が|大好き|です！|また|話しましょう。', "I love {hobby} too! Let's talk again.", 'أنا أيضًا أحب {hobby} كثيرًا! لنتحدث مجددًا.'), { slot: 'hobby', in: ['anime', 'manga', 'photo'] }),
        say(L('{hobby}|です|か！|いい|です|ね。|わたし|は|アニメ|と|写真|が|好き|です。|また|話しましょう。', "{hobby}! Nice. I like anime and photography. Let's talk again.", '{hobby}! جميل. أنا أحب الأنمي والتصوير. لنتحدث مجددًا.')),
      ],
      intents: [],
    }),
  ]),
};

export const CORE_SCENARIOS: Scenario[] = [CAFE, KONBINI, STATION, RAMEN, PARK];

// Reactions that work at any point in a conversation.
export const REACTIONS = {
  greet: L('こんにちは！', 'Hello!', 'مرحبًا!'),
  thanks: L('どういたしまして。', "You're welcome.", 'عفوًا.'),
  excuse: L('はい、|どうぞ。', 'Yes, go ahead.', 'نعم، تفضّل.'),
  how_are_you: L('元気|です。|ありがとう！', "I'm well, thanks!", 'أنا بخير، شكرًا!'),
  slow: L('はい。|ゆっくり|言います|ね。', "Okay, I'll say it slowly.", 'حسنًا، سأقولها ببطء.'),
  goodbye: L('さようなら。', 'Goodbye.', 'مع السلامة.'),
  fallback: L('すみません。|もう一度|お願いします。', 'Sorry, could you say that again?', 'عذرًا، هل يمكنك أن تعيد ذلك؟'),
} satisfies Record<string, Line>;
