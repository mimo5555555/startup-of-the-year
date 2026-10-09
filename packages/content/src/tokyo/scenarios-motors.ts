import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// Nakamura Motors (docs/GAME_DESIGN.md §6.3, §4.4 rule 3, §5.2; docs/RELEASE_1.md): Nakamura-san is polite staff (keigo-lite).
//  * motors_visit: browse the garage, hear a bicycle's price, politely say you will think about it (`cc_refuse`). No purchase.
//  * motors_bike:  purpose, model (the bicycle, the helmet or the power-assist bicycle), price (the 防犯登録 fee is inside the total, it is a
//                  fee line of the quote), name and address for the registration, pay. There is NO haggling here: the price is fixed (定価).
//  * motors_car:   the used kei car. The dealer first says the BODY price (本体価格, `{body}`); the learner must ask for the drive-away price
//                  (乗り出し価格, `{total}`, `ask_total`), may try ONE polite haggle (`haggle`, the only haggle node of the game, the game's
//                  hook caps it at min(6% of the body price, ¥8,880), 40% of that when assisted), then says the total (`say_total`), signs, pays.
// Prices only through Vars: {price} (the item), {total} (the whole bill, fees and a granted haggle in), {body} (the car's body price, no fees).
// The slots `bikeModel` / `carModel` are priced by the game's hooks; the e-bike and the low-mileage car are not in stock while the session
// flags `ebike_locked` / `good_locked` are set (the game sets them when the item is not yet available): their lines say so, and the
// game's `charge` refuses a locked item anyway (it ends at `short`).

/** The live price line (Vars from the hooks, when the app sets `flags.priced`) or, without game hooks, a line with no number in it. */
const priced = (live: Line, legacy: Line): SayVariant[] => [say(live, { flag: 'priced' }), say(legacy)];

const BUY = ['ください', 'おねがい', 'にします', 'かいます', 'ほしい', 'これ'];

const SHORT_LINE = L('申し訳ありません、|少し|足りません。', 'I am sorry, it is a little short.', 'آسف، المبلغ ناقص قليلًا.');
const LEAVE_LINE = L('かしこまりました。|また|お待ち|して|おります。', 'Certainly. We look forward to seeing you again.', 'حسنًا. بانتظار زيارتك مجددًا.');
const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const CARD_S = S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.');
const CASH_S = S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.');
const LOOKING_S = S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.');
const FIXED = L('申し訳ありません。|定価|です。', 'I am sorry. It is a fixed price.', 'آسف. إنه سعر ثابت.');

/** Taught polite refusal (`cc_refuse`): the way out of the shop that costs nothing. */
const later = (step?: string): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます', 'ちょっと', 'けっこうです'], next: 'leave', ...(step ? { step } : {}) });
const payIntents = (next: string): IntentDef[] => [
  { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next },
  { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next },
  { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ'], next },
];
/** asking the price again hears the price line of the node again */
const askPrice = (again: string): IntentDef => ({ id: 'ask_price', any: ['いくら', 'ねだん'], next: again });
/** a bicycle has a fixed price (定価): "it is expensive" and every way of asking for less get the same polite answer (cc_refuse) */
const tooDear: IntentDef = { id: 'too_dear', any: ['たかい', 'やすく', 'まけて', 'ねびき', 'もうすこし'], stay: true, reply: FIXED };
/** the car dealer is the one place a price can move (the haggle node): "expensive" is only agreed with, never answered with 定価 */
const carTooDear: IntentDef = { id: 'too_dear', any: ['たかい'], none: ['やすく', 'まけて', 'ねびき', 'もうすこし'], stay: true, reply: L('そう|です|ね。|少し|高い|です|ね。', 'Yes, it is a little expensive.', 'نعم، إنه غالٍ قليلًا.') };
/** asking for less before the drive-away price is known: the total comes first */
const earlyHaggle: IntentDef = { id: 'early_haggle', any: ['やすく', 'まけて', 'ねびき', 'もうすこし'], stay: true, reply: L('まず|乗り出し価格|を|ご確認|ください。', 'First, please check the drive-away price.', 'أولًا، تأكّد من السعر النهائي من فضلك.') };
const justLooking: IntentDef = { id: 'just_looking', any: ['みているだけ'], stay: true, reply: L('ごゆっくり|どうぞ。', 'Please take your time.', 'خذ وقتك من فضلك.') };

const buyIntent = (next: string, extra: Partial<IntentDef> = {}): IntentDef => ({
  id: 'buy',
  any: BUY,
  none: ['かんがえ', 'やすく', 'まけて', 'ねびき', 'もうすこし', 'たかい'],
  next,
  request: true,
  ideal: L('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'),
  ...extra,
});

// ---------- 1. Look around the garage ----------
export const MOTORS_VISIT: Scenario = {
  id: 'motors_visit',
  locationId: 'motors',
  characterId: 'nakamura',
  level: 'A2',
  title: { en: 'Look around the garage', ar: 'تجوّل في الورشة' },
  setup: {
    en: 'You are at Nakamura Motors. Say hello, ask how much a bicycle is, then say politely that you will think about it.',
    ar: 'أنت في ورشة ناكامورا. ألقِ التحية، واسأل عن سعر الدراجة، ثم قل بأدب إنك ستفكّر في الأمر.',
  },
  minutes: 3,
  steps: [
    { id: 'greet', text: { en: 'Greet Nakamura-san', ar: 'حيِّ السيد ناكامورا' } },
    { id: 'price', text: { en: 'Ask how much a bicycle is', ar: 'اسأل عن سعر الدراجة' } },
    { id: 'decline', text: { en: 'Say politely that you will think about it', ar: 'قل بأدب إنك ستفكّر في الأمر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|ゆっくり|見て|ください。', 'Welcome. Please take your time and look around.', 'أهلًا بك. تفضّل وتفرّج على مهلك.'))],
      suggestions: [
        S('こんにちは。', 'Hello.', 'مرحبًا.'),
        S('自転車|は|いくら|です|か？', 'How much is a bicycle?', 'بكم الدراجة؟'),
        LOOKING_S,
        S('車|も|あります|か？', 'Do you have cars too?', 'هل لديكم سيارات أيضًا؟'),
      ],
      intents: [
        { id: 'greet', any: ['こんにちは', 'はじめまして', 'すみません', 'おじゃまします'], next: 'browse', step: 'greet' },
        // 「自転車はいくらですか」 straight away: the greeting is taken as given
        { id: 'ask_price_bike', any: ['いくら', 'ねだん'], slot: 'bikeModel', slotOptions: ['mamachari'], slotRequired: true, next: 'bike_price', step: 'greet', ideal: L('自転車|は|いくら|です|か？', 'How much is a bicycle?', 'بكم الدراجة؟') },
        { id: 'just_looking', any: ['みているだけ'], next: 'browse', step: 'greet' },
        { id: 'ask_car', any: ['くるま', 'けいじどうしゃ'], stay: true, reply: L('はい、|軽自動車|も|あります。|ゆっくり|どうぞ。', 'Yes, we have kei cars too. Please take your time.', 'نعم، لدينا سيارات كي أيضًا. على مهلك.') },
        later('decline'),
      ],
    }),
    node({
      id: 'browse',
      say: [say(L('自転車|と|軽自動車|が|あります。|ママチャリ|は|人気|です。', 'We have bicycles and kei cars. The everyday bicycle is popular.', 'لدينا دراجات وسيارات كي. الدراجة اليومية رائجة.'))],
      suggestions: [S('自転車|は|いくら|です|か？', 'How much is a bicycle?', 'بكم الدراجة؟'), THINK_S, S('ヘルメット|は|あります|か？', 'Do you have helmets?', 'هل لديكم خوذات؟')],
      intents: [
        { id: 'ask_price_bike', any: ['いくら', 'ねだん'], slot: 'bikeModel', slotOptions: ['mamachari'], slotRequired: true, next: 'bike_price', ideal: L('自転車|は|いくら|です|か？', 'How much is a bicycle?', 'بكم الدراجة؟') },
        { id: 'ask_price', any: ['いくら', 'ねだん'], stay: true, reply: L('自転車|の|お値段|です|か？', 'Do you mean the price of a bicycle?', 'هل تقصد سعر الدراجة؟') },
        { id: 'ask_helmet', slot: 'bikeModel', slotOptions: ['helmet'], slotRequired: true, any: ['ありますか', 'ある'], stay: true, reply: L('はい、|ヘルメット|も|あります。', 'Yes, we have helmets too.', 'نعم، لدينا خوذات أيضًا.') },
        justLooking,
        later('decline'),
      ],
    }),
    node({
      id: 'bike_price',
      step: 'price',
      say: priced(
        L('ママチャリ|は|{price}|です。', 'The everyday bicycle is {price}.', 'الدراجة اليومية بسعر {price}.'),
        L('ママチャリ|は|いい|自転車|です|よ。', 'The everyday bicycle is a good bicycle.', 'الدراجة اليومية دراجة جيدة.'),
      ),
      suggestions: [S('ちょっと|難しい|です。', 'That is a little difficult for me.', 'هذا صعب عليّ قليلًا.'), THINK_S, LATER_S],
      intents: [askPrice('bike_price'), tooDear, later('decline')],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

// ---------- 2. Buy a bicycle ----------
const CHOOSE_IDEAL = L('{bikeModel}|を|ください。', '{bikeModel}, please.', '{bikeModel} من فضلك.');
const PURPOSE_IDEAL = L('{purpose}|に|使います。', 'I will use it for {purpose}.', 'سأستخدمها من أجل {purpose}.');

/** picking a bicycle by name from the start: the purpose is asked next whatever was picked */
const pickAtStart: IntentDef = { id: 'pick_item', slot: 'bikeModel', slotRequired: true, next: 'purpose', request: true, ideal: CHOOSE_IDEAL };

export const MOTORS_BIKE: Scenario = {
  id: 'motors_bike',
  locationId: 'motors',
  characterId: 'nakamura',
  level: 'A2',
  title: { en: 'Buy a bicycle', ar: 'اشترِ دراجة' },
  setup: {
    en: 'You are at Nakamura Motors. Say what you will use a bicycle for, choose a model, hear the price (the registration is in it), give your name and address, and pay.',
    ar: 'أنت في ورشة ناكامورا. قل فيمَ ستستخدم الدراجة، واختر الطراز، واسمع السعر (التسجيل داخل فيه)، وأعطِ اسمك وعنوانك، ثم ادفع.',
  },
  minutes: 5,
  steps: [
    { id: 'purpose', text: { en: 'Say what you will use it for', ar: 'قل فيمَ ستستخدمها' } },
    { id: 'model', text: { en: 'Choose a bicycle or a helmet', ar: 'اختر دراجة أو خوذة' } },
    { id: 'price', text: { en: 'Hear the price and decide to buy', ar: 'اسمع السعر وقرّر الشراء' } },
    { id: 'register', text: { en: 'Give your name and address', ar: 'أعطِ اسمك وعنوانك' } },
    { id: 'pay', text: { en: 'Pay and say thanks', ar: 'ادفع واشكر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|何|を|お探し|です|か？', 'Welcome. What are you looking for?', 'أهلًا بك. عمّ تبحث؟'))],
      suggestions: [
        S('自転車|が|ほしい|です|が。', 'I would like a bicycle.', 'أريد دراجة.'),
        LOOKING_S,
        S('プレゼント|を|探しています。', 'I am looking for a present.', 'أبحث عن هدية.'),
        S('こんにちは。', 'Hello.', 'مرحبًا.'),
      ],
      intents: [
        {
          id: 'want_bike',
          all: [['じてんしゃ', 'ままちゃり', 'ちゃり']],
          any: ['ほしい', 'さがして', '探して', 'かいたい', '買いたい', 'ください', 'おねがい'],
          next: 'purpose',
          request: true,
          ideal: L('自転車|が|ほしい|です|が。', 'I would like a bicycle.', 'أريد دراجة.'),
        },
        pickAtStart,
        justLooking,
        { id: 'hello', any: ['こんにちは', 'すみません'], stay: true, reply: L('自転車|を|お探し|です|か？', 'Are you looking for a bicycle?', 'هل تبحث عن دراجة؟') },
        { id: 'ask_goods', any: ['ぷれぜんと', 'ほかになにが'], next: 'goods' },
        later(),
      ],
    }),
    node({
      id: 'purpose',
      say: [say(L('自転車|です|ね。|何|に|使います|か？|通学、|買い物、|散歩…', 'A bicycle, I see. What will you use it for? School, shopping, a walk...', 'دراجة، حسنًا. فيمَ ستستخدمها؟ للمدرسة أم للتسوق أم للتنزّه...'))],
      suggestions: [S('通学|に|使います。', 'I will use it to go to school.', 'سأستخدمها للذهاب إلى المدرسة.'), S('買い物|に|使います。', 'I will use it for shopping.', 'سأستخدمها للتسوق.'), S('散歩|に|使います。', 'I will use it for a ride around town.', 'سأستخدمها للتنزّه.'), REPEAT_S],
      intents: [{ id: 'pick_purpose', slot: 'purpose', slotRequired: true, next: 'model', step: 'purpose', request: true, ideal: PURPOSE_IDEAL }, askPrice('purpose'), later()],
    }),
    node({
      id: 'model',
      say: [
        // the helmet is suggested, and the power-assist bicycle is mentioned only while it can be bought; the purpose is echoed when one was given
        say(L('ママチャリ|が|おすすめ|です。|ヘルメット|も|あります。', 'I recommend the everyday bicycle. We have helmets too.', 'أنصح بالدراجة اليومية. لدينا خوذات أيضًا.'), { flag: 'ebike_locked' }),
        say(L('{purpose}|です|ね。|それ|なら|ママチャリ|が|おすすめ|です。|ヘルメット|も、|電動アシスト自転車|も|あります。', 'I see, {purpose}. Then I recommend the everyday bicycle. We have helmets and power-assist bicycles too.', '{purpose}، حسنًا. إذن أنصح بالدراجة اليومية. لدينا خوذات ودراجات كهربائية مساعدة أيضًا.'), { slot: 'purpose', in: ['school', 'shopping', 'ride'] }),
        say(L('ママチャリ|が|おすすめ|です。|ヘルメット|も、|電動アシスト自転車|も|あります。', 'I recommend the everyday bicycle. We have helmets and power-assist bicycles too.', 'أنصح بالدراجة اليومية. لدينا خوذات ودراجات كهربائية مساعدة أيضًا.')),
      ],
      suggestions: [
        S('ママチャリ|を|ください。', 'The everyday bicycle, please.', 'الدراجة اليومية من فضلك.'),
        S('ヘルメット|を|ください。', 'A helmet, please.', 'خوذة من فضلك.'),
        S('ママチャリ|は|いくら|です|か？', 'How much is the everyday bicycle?', 'بكم الدراجة اليومية؟'),
        S('電動アシスト自転車|を|ください。', 'A power-assist bicycle, please.', 'دراجة كهربائية مساعدة من فضلك.'),
        THINK_S,
      ],
      intents: [
        // 「ママチャリはいくらですか」: the model and its price, read on the node that follows
        { id: 'ask_price_bike', any: ['いくら', 'ねだん'], slot: 'bikeModel', slotOptions: ['mamachari'], slotRequired: true, next: 'quote_bike', step: 'model', ideal: L('{bikeModel}|は|いくら|です|か？', 'How much is the {bikeModel}?', 'بكم {bikeModel}؟') },
        { id: 'ask_price_helmet', any: ['いくら', 'ねだん'], slot: 'bikeModel', slotOptions: ['helmet'], slotRequired: true, next: 'quote_helmet', step: 'model', ideal: L('{bikeModel}|は|いくら|です|か？', 'How much is the {bikeModel}?', 'بكم {bikeModel}؟') },
        { id: 'ask_price_ebike', any: ['いくら', 'ねだん'], slot: 'bikeModel', slotOptions: ['ebike'], slotRequired: true, next: 'ebike_offer', step: 'model', ideal: L('{bikeModel}|は|いくら|です|か？', 'How much is the {bikeModel}?', 'بكم {bikeModel}؟') },
        { id: 'ask_price', any: ['いくら', 'ねだん'], stay: true, reply: L('どちら|の|お値段|でしょうか？', 'Which one do you mean?', 'أيّها تقصد؟') },
        { id: 'choose_bike', slot: 'bikeModel', slotOptions: ['mamachari'], slotRequired: true, next: 'quote_bike', step: 'model', request: true, ideal: CHOOSE_IDEAL },
        { id: 'choose_helmet', slot: 'bikeModel', slotOptions: ['helmet'], slotRequired: true, next: 'quote_helmet', step: 'model', request: true, ideal: CHOOSE_IDEAL },
        { id: 'choose_ebike', slot: 'bikeModel', slotOptions: ['ebike'], slotRequired: true, next: 'ebike_offer', step: 'model', request: true, ideal: CHOOSE_IDEAL },
        later(),
      ],
    }),
    // the power-assist bicycle needs the helmet first (and opens late): while it cannot be bought Nakamura-san says so and offers the others
    node({
      id: 'ebike_offer',
      say: [
        say(L('電動アシスト自転車|は|ヘルメット|が|必要|です。|まだ|ご用意|できません。|ヘルメット|は|いかが|でしょうか？', 'The power-assist bicycle needs a helmet. I cannot offer it yet. How about a helmet?', 'الدراجة الكهربائية المساعدة تحتاج إلى خوذة. لا أستطيع تقديمها بعد. ما رأيك بخوذة؟'), { flag: 'ebike_locked' }),
        say(L('{bikeModel}|は|{price}|です。|ヘルメット|も|お持ち|です|ね。', 'The {bikeModel} is {price}. You have a helmet already, I see.', '{bikeModel} بسعر {price}. لديك خوذة بالفعل، أرى.'), { flag: 'priced' }),
        say(L('{bikeModel}|です|ね。|ヘルメット|も|お持ち|です|ね。', 'The {bikeModel}, I see. You have a helmet already.', '{bikeModel}، حسنًا. لديك خوذة بالفعل.')),
      ],
      suggestions: [S('ヘルメット|を|ください。', 'A helmet, please.', 'خوذة من فضلك.'), S('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'), S('ママチャリ|を|ください。', 'The everyday bicycle, please.', 'الدراجة اليومية من فضلك.'), THINK_S],
      intents: [
        { id: 'choose_helmet', slot: 'bikeModel', slotOptions: ['helmet'], slotRequired: true, next: 'quote_helmet', request: true, ideal: CHOOSE_IDEAL },
        { id: 'choose_bike', slot: 'bikeModel', slotOptions: ['mamachari'], slotRequired: true, next: 'quote_bike', request: true, ideal: CHOOSE_IDEAL },
        buyIntent('quote_bike'),
        askPrice('ebike_offer'),
        later(),
      ],
    }),
    // the bill: the bicycle and the 防犯登録 fee are one total (the fee is a line of the quote, never typed here)
    node({
      id: 'quote_bike',
      say: priced(
        L('{bikeModel}|です|ね。|防犯登録|も|入れて、|全部で|{total}|です。', 'The {bikeModel}, I see. With the registration, {total} in total.', '{bikeModel}، حسنًا. مع التسجيل، المجموع {total}.'),
        L('{bikeModel}|です|ね。|防犯登録|も|入れて、|全部で|この|お値段|です。', 'The {bikeModel}, I see. With the registration, this is the total.', '{bikeModel}، حسنًا. مع التسجيل، هذا هو المجموع.'),
      ),
      suggestions: [S('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'), THINK_S, S('少し|高い|です。', 'It is a little expensive.', 'إنه غالٍ قليلًا.')],
      intents: [buyIntent('register_name', { step: 'price' }), tooDear, askPrice('quote_bike'), later()],
    }),
    node({
      id: 'quote_helmet',
      say: priced(
        L('{bikeModel}|です|ね。|全部で|{total}|です。', 'The {bikeModel}, I see. {total} in total.', '{bikeModel}، حسنًا. المجموع {total}.'),
        L('{bikeModel}|です|ね。|いい|ヘルメット|です|よ。', 'The {bikeModel}, I see. It is a good helmet.', '{bikeModel}، حسنًا. إنها خوذة جيدة.'),
      ),
      suggestions: [S('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'), THINK_S, S('少し|高い|です。', 'It is a little expensive.', 'إنه غالٍ قليلًا.')],
      intents: [buyIntent('register_name', { step: 'price' }), tooDear, askPrice('quote_helmet'), later()],
    }),
    // the registration: a bicycle is registered with a name and an address (a helmet only gets a warranty card)
    node({
      id: 'register_name',
      say: [
        say(L('防犯登録|を|します。|お名前|を|お願いします。', 'I will register the bicycle. Your name, please.', 'سأسجّل الدراجة. اسمك من فضلك.'), { slot: 'bikeModel', in: ['mamachari', 'ebike'] }),
        say(L('保証書|を|書きます。|お名前|を|お願いします。', 'I will write the warranty card. Your name, please.', 'سأكتب بطاقة الضمان. اسمك من فضلك.')),
      ],
      suggestions: [S('{name}|です。', 'I am {name}.', 'أنا {name}.'), REPEAT_S],
      intents: [{ id: 'say_name', any: ['です', 'といいます', 'もうします'], capture: 'name', next: 'register_addr' }, later()],
    }),
    node({
      id: 'register_addr',
      say: [say(L('ご住所|は？', 'Your address?', 'عنوانك؟'))],
      suggestions: [S('住所|は|桜町|です。', 'My address is Sakura-chō.', 'عنواني هو ساكورا-تشو.'), REPEAT_S],
      intents: [{ id: 'say_address', any: ['さくらちょう', 'じゅうしょ', 'すんで', 'ちょう', 'まち', 'です'], none: ['いいえ'], next: 'pay', step: 'register' }, later()],
    }),
    node({
      id: 'pay',
      // twist (flags.twist): Nakamura-san mentions the receipt; nothing changes in the price
      say: [
        say(L('ありがとうございます。|お支払い|は|現金|です|か、|カード|です|か？|レシート|も|お渡し|します|よ。', 'Thank you. Will you pay in cash or by card? I will give you a receipt too.', 'شكرًا لك. هل ستدفع نقدًا أم بالبطاقة؟ سأعطيك إيصالًا أيضًا.'), { flag: 'twist' }),
        say(L('ありがとうございます。|お支払い|は|現金|です|か、|カード|です|か？', 'Thank you. Will you pay in cash or by card?', 'شكرًا لك. هل ستدفع نقدًا أم بالبطاقة؟')),
      ],
      suggestions: [CARD_S, CASH_S, REPEAT_S],
      intents: [...payIntents('confirm'), later()],
    }),
    node({
      id: 'confirm',
      say: [say(L('こちら|で|よろしい|です|か？', 'Is this all right?', 'هل هذا مناسب؟'))],
      suggestions: [S('はい、|お願いします。', 'Yes, please.', 'نعم من فضلك.'), S('いいえ、|やめます。', 'No, I will not buy it.', 'لا، لن أشتريه.')],
      intents: [
        { id: 'no', any: ['いいえ', 'やめます', 'かんがえ'], next: 'leave' },
        { id: 'yes', any: ['はい', 'おねがい', 'いいです', 'どうぞ'], next: 'done' },
      ],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('{bikeModel}|です。|ありがとうございました。|安全|運転|で|どうぞ。', 'Here is your {bikeModel}. Thank you very much. Please ride safely.', 'تفضّل {bikeModel}. شكرًا جزيلًا. تفضّل بالقيادة بأمان.'), { slot: 'bikeModel', in: ['mamachari', 'helmet', 'ebike'] }), say(L('ありがとうございました。|また|お越し|ください。', 'Thank you very much. Please come again.', 'شكرًا جزيلًا. تفضّل بزيارتنا مجددًا.'))],
      intents: [],
    }),
    // too little money is a scripted branch, never an error (§4.4 rule 6)
    node({
      id: 'short',
      say: [say(SHORT_LINE)],
      suggestions: [LATER_S, S('安い|の|は|あります|か？', 'Do you have something cheaper?', 'هل لديكم شيء أرخص؟'), THINK_S],
      intents: [later(), { id: 'cheaper', any: ['やすいの', 'やすい'], next: 'model' }],
    }),
    // goods (§5.6): the car air freshener, a present
    node({
      id: 'goods',
      say: [say(L('プレゼント|です|ね。|車|の|芳香剤|が|あります。', 'A present, I see. We have car air fresheners.', 'هدية، حسنًا. لدينا معطّرات سيارات.'))],
      suggestions: [S('車の芳香剤|を|ください。', 'A car air freshener, please.', 'معطّر سيارة من فضلك.'), LOOKING_S, REPEAT_S],
      intents: [
        { id: 'pick_gift', slot: 'giftItem', slotOptions: ['carFresh'], slotRequired: true, next: 'pay_gift', request: true, ideal: L('{giftItem}|を|ください。', '{giftItem}, please.', '{giftItem} من فضلك.') },
        { id: 'just_looking', any: ['みているだけ'], next: 'model' },
        later(),
      ],
    }),
    node({
      id: 'pay_gift',
      say: priced(
        L('{giftItem}|です|ね。|{total}、|税込|です。|現金|です|か、|カード|です|か？', 'The {giftItem}, I see. {total}, tax included. Cash or card?', '{giftItem}، حسنًا. {total} شاملًا الضريبة. نقدًا أم بالبطاقة؟'),
        L('{giftItem}|です|ね。|五百|円、|税込|です。|現金|です|か、|カード|です|か？', 'The {giftItem}, I see. 500 yen, tax included. Cash or card?', '{giftItem}، حسنًا. 500 ين شاملًا الضريبة. نقدًا أم بالبطاقة؟'),
      ),
      suggestions: [CARD_S, CASH_S, REPEAT_S],
      intents: [...payIntents('done'), later()],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

// ---------- 3. A used kei car ----------
const CAR_IDEAL = L('{carModel}|を|見たい|です。', 'I would like to see the {carModel}.', 'أريد أن أرى {carModel}.');
const carAsk = (id: string, any: string[], reply: Line): IntentDef => ({ id, any, stay: true, reply });

/** Asking for the drive-away price, in every way a learner says it: the body price is only the start (cc_shaken). */
const askDriveAway = (next: string): IntentDef => ({
  id: 'ask_total',
  any: ['のりだし', 'のりだしかかく', 'ぜんぶで', 'ぜんぶ', 'ごうけい', 'しょひよう', 'そうがく'],
  econ: 'ask_total',
  next,
  step: 'ask_total',
  request: true,
  ideal: L('乗り出し価格|は|いくら|です|か？', 'How much is the drive-away price?', 'كم السعر النهائي؟'),
});

const pickCar = (step?: string): IntentDef[] => [
  { id: 'pick_used', slot: 'carModel', slotOptions: ['used'], slotRequired: true, next: 'look', ...(step ? { step } : {}), request: true, ideal: CAR_IDEAL },
  { id: 'pick_good', slot: 'carModel', slotOptions: ['good'], slotRequired: true, next: 'good_offer', ...(step ? { step } : {}), request: true, ideal: CAR_IDEAL },
];

export const MOTORS_CAR: Scenario = {
  id: 'motors_car',
  locationId: 'motors',
  characterId: 'nakamura',
  level: 'B1',
  title: { en: 'Buy a used kei car', ar: 'اشترِ سيارة كي مستعملة' },
  setup: {
    en: 'You are at Nakamura Motors. Look at a kei car, ask for the drive-away price (not only the body price), try a polite request for a lower price, say the total, sign and pay.',
    ar: 'أنت في ورشة ناكامورا. تفقّد سيارة كي، واسأل عن السعر النهائي (وليس سعر الهيكل فقط)، وجرّب طلبًا مهذبًا لسعر أقل، وقل المبلغ الإجمالي، ووقّع وادفع.',
  },
  minutes: 6,
  steps: [
    { id: 'look', text: { en: 'Look at a car', ar: 'تفقّد سيارة' } },
    { id: 'ask_total', text: { en: 'Ask for the drive-away price', ar: 'اسأل عن السعر النهائي' } },
    { id: 'haggle', text: { en: 'Politely ask for a lower price', ar: 'اطلب سعرًا أقل بأدب' } },
    { id: 'confirm', text: { en: 'Say the total', ar: 'قل المبلغ الإجمالي' } },
    { id: 'sign', text: { en: 'Sign with your name', ar: 'وقّع باسمك' } },
    { id: 'pay', text: { en: 'Pay and say thanks', ar: 'ادفع واشكر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|軽自動車|を|お探し|です|か？', 'Welcome. Are you looking for a kei car?', 'أهلًا بك. هل تبحث عن سيارة كي؟'))],
      suggestions: [
        S('軽自動車|を|見たい|です。', 'I would like to see a kei car.', 'أريد أن أرى سيارة كي.'),
        LOOKING_S,
        S('中古|の|軽自動車|は|あります|か？', 'Do you have a used kei car?', 'هل لديكم سيارة كي مستعملة؟'),
        S('こんにちは。', 'Hello.', 'مرحبًا.'),
      ],
      intents: [
        { id: 'want_car', any: ['くるま', 'けいじどうしゃ', 'じどうしゃ'], none: ['ふくろ'], next: 'models', request: true, ideal: L('軽自動車|を|見たい|です。', 'I would like to see a kei car.', 'أريد أن أرى سيارة كي.') },
        ...pickCar(),
        justLooking,
        { id: 'hello', any: ['こんにちは', 'すみません'], stay: true, reply: L('軽自動車|を|お探し|です|か？', 'Are you looking for a kei car?', 'هل تبحث عن سيارة كي؟') },
        later(),
      ],
    }),
    node({
      id: 'models',
      say: [
        say(L('中古|の|軽自動車|が|あります。|低走行|の|軽自動車|は|まだ|ご用意|できません。', 'We have a used kei car. The low-mileage kei car is not available yet.', 'لدينا سيارة كي مستعملة. سيارة الكي قليلة المسافة غير متاحة بعد.'), { flag: 'good_locked' }),
        say(L('中古|の|軽自動車|と、|低走行|の|軽自動車|が|あります。', 'We have a used kei car and a low-mileage kei car.', 'لدينا سيارة كي مستعملة وسيارة كي قليلة المسافة.')),
      ],
      suggestions: [S('中古|の|軽自動車|を|見たい|です。', 'I would like to see the used kei car.', 'أريد أن أرى سيارة الكي المستعملة.'), S('低走行|の|軽自動車|を|見たい|です。', 'I would like to see the low-mileage kei car.', 'أريد أن أرى سيارة الكي قليلة المسافة.'), THINK_S],
      intents: [...pickCar('look'), later()],
    }),
    node({
      id: 'look',
      step: 'look',
      say: [say(L('中古|の|軽自動車|です。|色|は|白、|走行距離|は|六|万|キロ|です。', 'This is the used kei car. The colour is white and it has 60,000 kilometres.', 'هذه سيارة الكي المستعملة. لونها أبيض وقطعت 60,000 كيلومتر.'))],
      suggestions: [S('値段|は|いくら|です|か？', 'How much is it?', 'بكم هي؟'), S('年式|は？', 'What year is it?', 'ما سنة صنعها؟'), S('色|は|何色|です|か？', 'What colour is it?', 'ما لونها؟'), THINK_S],
      intents: [
        { id: 'ask_price', any: ['いくら', 'ねだん', 'かかく'], none: ['のりだし'], next: 'body_quote', ideal: L('値段|は|いくら|です|か？', 'How much is it?', 'بكم هي؟') },
        askDriveAway('total_quote'),
        carAsk('ask_year', ['ねんしき'], L('年式|は|少し|古い|です|が、|よく|走ります。', 'The year is a little old, but it runs well.', 'سنة الصنع قديمة قليلًا، لكنها تسير جيدًا.')),
        carAsk('ask_km', ['そうこうきょり', 'きょり'], L('走行距離|は|六|万|キロ|です。', 'It has 60,000 kilometres.', 'قطعت 60,000 كيلومتر.')),
        carAsk('ask_colour', ['いろ', 'なにいろ', 'なんいろ'], L('色|は|白|です。', 'The colour is white.', 'لونها أبيض.')),
        earlyHaggle,
        later(),
      ],
    }),
    // the low-mileage car: described here while it can be bought; otherwise Nakamura-san says it is not available and offers the used one
    node({
      id: 'good_offer',
      step: 'look',
      say: [
        say(L('低走行|の|軽自動車|は|まだ|ご用意|できません。|中古|の|軽自動車|は|いかが|でしょうか？', 'The low-mileage kei car is not available yet. How about the used kei car?', 'سيارة الكي قليلة المسافة غير متاحة بعد. ما رأيك بسيارة الكي المستعملة؟'), { flag: 'good_locked' }),
        say(L('低走行|の|軽自動車|です|ね。|色|は|青、|走行距離|は|二|万|キロ|です。', 'The low-mileage kei car, I see. The colour is blue and it has 20,000 kilometres.', 'سيارة الكي قليلة المسافة، حسنًا. لونها أزرق وقطعت 20,000 كيلومتر.')),
      ],
      suggestions: [S('値段|は|いくら|です|か？', 'How much is it?', 'بكم هي؟'), S('中古|の|軽自動車|を|見たい|です。', 'I would like to see the used kei car.', 'أريد أن أرى سيارة الكي المستعملة.'), THINK_S],
      intents: [
        { id: 'ask_price', any: ['いくら', 'ねだん', 'かかく'], none: ['のりだし'], next: 'body_quote', ideal: L('値段|は|いくら|です|か？', 'How much is it?', 'بكم هي؟') },
        askDriveAway('total_quote'),
        { id: 'pick_used', slot: 'carModel', slotOptions: ['used'], slotRequired: true, next: 'look', request: true, ideal: CAR_IDEAL },
        later(),
      ],
    }),
    // the trap (§4.4 rule 3): the first price is the BODY price. "I will take it" at this price is not the end of the story.
    node({
      id: 'body_quote',
      say: priced(
        L('本体価格|は|{body}|です。', 'The body price is {body}.', 'سعر الهيكل هو {body}.'),
        L('本体価格|は|こちら|です。', 'This is the body price.', 'هذا هو سعر الهيكل.'),
      ),
      suggestions: [S('乗り出し価格|は|いくら|です|か？', 'How much is the drive-away price?', 'كم السعر النهائي؟'), S('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'), THINK_S],
      intents: [
        askDriveAway('total_quote'),
        {
          id: 'buy_body',
          any: BUY,
          none: ['かんがえ', 'やすく', 'まけて', 'ねびき', 'もうすこし', 'たかい'],
          stay: true,
          reply: L('それ|は|本体価格|です。|乗り出し価格|を|ご確認|ください。', 'That is only the body price. Please check the drive-away price.', 'هذا سعر الهيكل فقط. تأكّد من السعر النهائي.'),
        },
        earlyHaggle,
        carTooDear,
        askPrice('body_quote'),
        later(),
      ],
    }),
    node({
      id: 'total_quote',
      say: priced(
        L('乗り出し価格|は|諸費用|を|入れて|{total}|です。', 'The drive-away price, with all the fees, is {total}.', 'السعر النهائي، مع جميع الرسوم، هو {total}.'),
        L('乗り出し価格|は|諸費用|を|入れて|この|お値段|です。', 'The drive-away price, with all the fees, is this.', 'السعر النهائي، مع جميع الرسوم، هو هذا.'),
      ),
      suggestions: [S('もう少し|安く|なりませんか？', 'Could you make it a little cheaper?', 'هل يمكن أن تجعله أرخص قليلًا؟'), S('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'), S('少し|高い|です。', 'It is a little expensive.', 'إنه غالٍ قليلًا.'), THINK_S],
      intents: [
        // the one haggle of the game (§4.4 rule 3): a polite request, or a price named by the learner ("190,000 yen, please"); the game's hook bounds it
        { id: 'haggle', any: ['やすく', 'やすくなり', 'まけて', 'ねびき', 'もうすこし'], econ: 'haggle', next: 'haggle_ok', nextIfNo: 'haggle_no', request: true, ideal: L('もう少し|安く|なりませんか？', 'Could you make it a little cheaper?', 'هل يمكن أن تجعله أرخص قليلًا؟') },
        { id: 'haggle_offer', all: [['えん', '円'], ['にして', 'になりません', 'でどう', 'までさげ']], econ: 'haggle', next: 'haggle_ok', nextIfNo: 'haggle_no', request: true, ideal: L('もう少し|安く|なりませんか？', 'Could you make it a little cheaper?', 'هل يمكن أن تجعله أرخص قليلًا؟') },
        buyIntent('haggle_no_buy'),
        carTooDear,
        askPrice('total_quote'),
        later(),
      ],
    }),
    // the haggle was granted (the new total is in `{total}`) or refused / already used (the price stays)
    node({
      id: 'haggle_ok',
      step: 'haggle',
      say: priced(
        L('そう|です|ね…。|では、|{total}|に|します。', 'Let me see... All right, I will make it {total}.', 'لنرَ... حسنًا، سأجعله {total}.'),
        L('そう|です|ね…。|では、|少し|お安く|します。', 'Let me see... All right, I will make it a little cheaper.', 'لنرَ... حسنًا، سأجعله أرخص قليلًا.'),
      ),
      suggestions: [S('ありがとうございます。', 'Thank you very much.', 'شكرًا جزيلًا.'), S('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'), THINK_S],
      intents: [{ id: 'accept', any: [...BUY, 'ありがとう', 'はい'], none: ['かんがえ'], next: 'confirm' }, later()],
    }),
    node({
      id: 'haggle_no',
      step: 'haggle',
      say: [say(L('申し訳ありません。|これ以上|は|難しい|です。', 'I am sorry. That is difficult for me.', 'آسف. هذا صعب عليّ.'))],
      suggestions: [S('では、|これ|を|ください。', 'Then I will take this one.', 'إذن سآخذ هذه.'), THINK_S, LATER_S],
      intents: [{ id: 'accept', any: [...BUY, 'はい', 'わかりました'], none: ['かんがえ'], next: 'confirm' }, later()],
    }),
    // the same buy from the quote, with no haggle: the step is simply skipped by the learner (the scenario then lacks it, so it stays open)
    node({
      id: 'haggle_no_buy',
      say: [say(L('かしこまりました。', 'Certainly.', 'حسنًا.'))],
      suggestions: [S('はい。', 'Yes.', 'نعم.'), THINK_S],
      intents: [{ id: 'go', any: ['はい', 'おねがい', 'どうぞ'], next: 'confirm' }, later()],
    }),
    // say_total: the learner says the amount to pay, in Japanese or in digits ("198000")
    node({
      id: 'confirm',
      say: [say(L('では、|確認|です。|お支払い|の|金額|を|お願いします。', 'Now, a check. Please say the amount you will pay.', 'والآن، تحقّق. قل المبلغ الذي ستدفعه من فضلك.'))],
      suggestions: [S('{total}|です。', 'The total is {total}.', 'المبلغ الإجمالي {total}.'), REPEAT_S, THINK_S],
      intents: [{ id: 'say_total', any: ['えん', '円'], econ: 'say_total', next: 'sign', nextIfNo: 'wrong_total', step: 'confirm', request: true, ideal: L('{total}|です。', 'The total is {total}.', 'المبلغ الإجمالي {total}.') }, { id: 'say_total_bare', any: ['です'], none: ['えん', '円'], econ: 'say_total', next: 'sign', nextIfNo: 'wrong_total', step: 'confirm' }, later()],
    }),
    node({
      id: 'wrong_total',
      say: [say(L('いいえ、|{total}|です。|もう一度|お願いします。', 'No, it is {total}. One more time, please.', 'لا، إنه {total}. مرة أخرى من فضلك.'))],
      suggestions: [S('{total}|です。', 'The total is {total}.', 'المبلغ الإجمالي {total}.'), REPEAT_S, THINK_S],
      intents: [{ id: 'say_total', any: ['えん', '円'], econ: 'say_total', next: 'sign', nextIfNo: 'wrong_total', step: 'confirm', request: true, ideal: L('{total}|です。', 'The total is {total}.', 'المبلغ الإجمالي {total}.') }, { id: 'say_total_bare', any: ['です'], none: ['えん', '円'], econ: 'say_total', next: 'sign', nextIfNo: 'wrong_total', step: 'confirm' }, later()],
    }),
    node({
      id: 'sign',
      say: [say(L('それでは、|お名前|を|お願いします。', 'Then your name, please.', 'إذن، اسمك من فضلك.'))],
      suggestions: [S('{name}|です。', 'I am {name}.', 'أنا {name}.'), REPEAT_S],
      intents: [{ id: 'say_name', any: ['です', 'といいます', 'もうします'], capture: 'name', next: 'pay', step: 'sign' }, later()],
    }),
    node({
      id: 'pay',
      say: [
        say(L('ありがとうございます。|お支払い|は|現金|です|か、|カード|です|か？|レシート|も|お渡し|します|よ。', 'Thank you. Will you pay in cash or by card? I will give you a receipt too.', 'شكرًا لك. هل ستدفع نقدًا أم بالبطاقة؟ سأعطيك إيصالًا أيضًا.'), { flag: 'twist' }),
        say(L('ありがとうございます。|お支払い|は|現金|です|か、|カード|です|か？', 'Thank you. Will you pay in cash or by card?', 'شكرًا لك. هل ستدفع نقدًا أم بالبطاقة؟')),
      ],
      suggestions: [CARD_S, CASH_S, REPEAT_S],
      intents: [...payIntents('done'), later()],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('ご契約|ありがとうございました。|安全|運転|で|どうぞ。', 'Thank you very much for your purchase. Please drive safely.', 'شكرًا جزيلًا على الشراء. تفضّل بالقيادة بأمان.'))],
      intents: [],
    }),
    // too little money is a scripted branch, never an error (§4.4 rule 6)
    node({
      id: 'short',
      say: [say(SHORT_LINE)],
      suggestions: [LATER_S, THINK_S, S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.')],
      intents: [later(), { id: 'again', any: ['みているだけ'], next: 'models' }],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

/** Scenarios for Nakamura Motors: motors_visit, motors_bike, motors_car (see docs/GAME_DESIGN.md). */
export const MOTORS_SCENARIOS: Scenario[] = [MOTORS_VISIT, MOTORS_BIKE, MOTORS_CAR];
