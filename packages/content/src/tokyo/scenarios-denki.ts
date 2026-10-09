import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// Hikari Denki, the phone shop (docs/GAME_DESIGN.md §6.3, §6.7): Aoi is polite staff (keigo-lite). Prices only through Vars
// ({price}, {total}), supplied by the game's hooks (the price of `denkiItem`, plus `giftItem`). The slot `denkiItem` has four options; the
// latest phone (`pro`) and the TV (`tv`) are not yet in stock while the session flags `pro_locked` / `tv_locked` are set: their lines say
// so. The conversation cannot branch on a flag, so the game's `charge` / `vars` must refuse a locked item (it ends at `short`).

/** The live price line (Vars from the hooks, when the app sets `flags.priced`) or, without game hooks, a fixed line so the scenario still runs on its own. */
const priced = (live: Line, legacy: Line): SayVariant[] => [say(live, { flag: 'priced' }), say(legacy)];

const BUY = ['ください', 'おねがい', 'にします', 'かいます', 'ほしい', 'これ'];

const SHORT_LINE = L('申し訳ありません、|少し|足りません。', 'I am sorry, it is a little short.', 'آسفة، المبلغ ناقص قليلًا.');
const LEAVE_LINE = L('かしこまりました。|また|お待ち|して|おります。', 'Certainly. We look forward to seeing you again.', 'حسنًا. بانتظار زيارتك مجددًا.');
const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const CARD_S = S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.');
const CASH_S = S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.');

/** Taught polite refusal (`cc_refuse`): the way out of the shop that costs nothing. */
const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });
const payIntents = (next: string): IntentDef[] => [
  { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next },
  { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next },
  { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ'], next },
];
/** asking the price again hears the price line of the node again */
const askPrice = (again: string): IntentDef => ({ id: 'ask_price', any: ['いくら', 'ねだん'], next: again });

const CHOOSE_IDEAL = L('{denkiItem}|を|ください。', '{denkiItem}, please.', '{denkiItem} من فضلك.');
/** picking an item by name: the phone and the case go on to the colour, the latest phone and the TV through their stock check */
const pickItems = (step?: string): IntentDef[] => [
  { id: 'choose_used', slot: 'denkiItem', slotOptions: ['used', 'case'], slotRequired: true, next: 'colour', ...(step ? { step } : {}), request: true, ideal: CHOOSE_IDEAL },
  { id: 'choose_pro', slot: 'denkiItem', slotOptions: ['pro'], slotRequired: true, next: 'pro_offer', ...(step ? { step } : {}), request: true, ideal: CHOOSE_IDEAL },
  { id: 'choose_tv', slot: 'denkiItem', slotOptions: ['tv'], slotRequired: true, next: 'tv_offer', ...(step ? { step } : {}), request: true, ideal: CHOOSE_IDEAL },
];
const goodsIntent: IntentDef = { id: 'ask_goods', any: ['ぷれぜんと', 'ほかになにが'], next: 'goods' };
const cheaperIntent: IntentDef = { id: 'ask_cheaper', any: ['やすい', 'やすいの', 'どちらがやすい'], stay: true, reply: L('中古スマホ|の|ほう|が|安い|です。', 'The refurbished phone is the cheaper one.', 'الهاتف المجدّد هو الأرخص.') };
const taxfreeIntent: IntentDef = {
  id: 'ask_taxfree',
  any: ['めんぜい'],
  stay: true,
  reply: L('申し訳ありません、|免税|の|対象外|です。', 'I am sorry, this is not eligible for tax-free.', 'آسفة، هذا غير مؤهل للإعفاء الضريبي.'),
};
const colourPick: IntentDef = { id: 'pick_colour', slot: 'colour', slotRequired: true, next: 'quote', step: 'choose', request: true, ideal: L('{colour}|を|お願いします。', '{colour}, please.', '{colour} من فضلك.') };

/** The price line: the item (and colour), the total with tax; the learner buys, thinks about it or objects to the price. */
const quoteNode = (id: string, say_: SayVariant[]) =>
  node({
    id,
    step: 'choose',
    say: say_,
    suggestions: [S('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'), THINK_S, S('少し|高い|です。', 'It is a little expensive.', 'إنه غالٍ قليلًا.')],
    intents: [
      { id: 'buy', any: BUY, none: ['かんがえ'], next: 'pay', step: 'price', request: true, ideal: L('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.') },
      { id: 'too_dear', any: ['たかい', '高い'], stay: true, reply: L('申し訳ありません。|定価|です。', 'I am sorry. It is a fixed price.', 'آسفة. إنه سعر ثابت.') },
      askPrice(id),
      taxfreeIntent,
      later(),
    ],
  });

export const DENKI_PHONE: Scenario = {
  id: 'denki_phone',
  locationId: 'denki',
  characterId: 'aoi',
  level: 'A2',
  title: { en: 'Buy a phone', ar: 'اشترِ هاتفًا' },
  setup: {
    en: 'You are at Hikari Denki. Ask for a smartphone, choose a colour, hear the price, think or buy, give your name and pay.',
    ar: 'أنت في متجر هيكاري دنكي. اطلب هاتفًا ذكيًا، واختر اللون، واسمع السعر، ثم فكّر أو اشترِ، وأعطِ اسمك وادفع.',
  },
  minutes: 5,
  steps: [
    { id: 'want', text: { en: 'Say you want a smartphone', ar: 'قل إنك تريد هاتفًا ذكيًا' } },
    { id: 'choose', text: { en: 'Choose a model and a colour', ar: 'اختر الطراز واللون' } },
    { id: 'price', text: { en: 'Hear the price and decide to buy', ar: 'اسمع السعر وقرّر الشراء' } },
    { id: 'name', text: { en: 'Give your name', ar: 'أعطِ اسمك' } },
    { id: 'pay', text: { en: 'Pay and say thanks', ar: 'ادفع واشكر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|何|を|お探し|でしょうか？', 'Welcome. What are you looking for?', 'أهلًا بك. عمّ تبحث؟'))],
      suggestions: [
        S('スマホ|が|ほしい|の|です|が。', 'I would like a smartphone.', 'أريد هاتفًا ذكيًا.'),
        S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.'),
        S('プレゼント|を|探しています。', 'I am looking for a present.', 'أبحث عن هدية.'),
        S('こんにちは。', 'Hello.', 'مرحبًا.'),
      ],
      intents: [
        {
          id: 'want_phone',
          all: [['すまほ', 'けいたい', '携帯', 'でんわ', '電話']],
          any: ['ほしい', 'さがして', '探して', 'かいたい', '買いたい', 'ください', 'おねがい'],
          next: 'models',
          step: 'want',
          request: true,
          ideal: L('スマホ|が|ほしい|の|です|が。', 'I would like a smartphone.', 'أريد هاتفًا ذكيًا.'),
        },
        ...pickItems('want'),
        { id: 'just_looking', any: ['みているだけ', '見ているだけ', 'みているだけです'], stay: true, reply: L('ごゆっくり|どうぞ。', 'Please take your time.', 'خذ وقتك من فضلك.') },
        { id: 'hello', any: ['こんにちは', 'すみません'], stay: true, reply: L('何|か|お探し|でしょうか？', 'Are you looking for something?', 'هل تبحث عن شيء؟') },
        goodsIntent,
        later(),
      ],
    }),
    node({
      id: 'models',
      step: 'want',
      say: [
        say(L('こちら|が|中古スマホ|です。|スマホケース|も|あります。|最新スマホ|と|テレビ|は|まだ|入荷|して|いません。', 'This is the refurbished phone. We also have phone cases. The latest phone and the TV are not in stock yet.', 'هذا هاتف مجدّد. لدينا أيضًا أغلفة هواتف. أحدث هاتف والتلفزيون لم يصلا بعد.'), { flag: 'tv_locked' }),
        say(L('こちら|が|中古スマホ|です。|スマホケース|と|テレビ|も|あります。|最新スマホ|は|まだ|入荷|して|いません。', 'This is the refurbished phone. We also have phone cases and TVs. The latest phone is not in stock yet.', 'هذا هاتف مجدّد. لدينا أيضًا أغلفة وتلفزيونات. أحدث هاتف لم يصل بعد.'), { flag: 'pro_locked' }),
        say(L('こちら|が|中古スマホ|です。|最新スマホ|も|あります。|スマホケース|と|テレビ|も|あります。', 'This is the refurbished phone. We also have the latest phone, phone cases and TVs.', 'هذا هاتف مجدّد. لدينا أيضًا أحدث هاتف وأغلفة وتلفزيونات.')),
      ],
      suggestions: [
        S('中古スマホ|を|ください。', 'The refurbished phone, please.', 'الهاتف المجدّد من فضلك.'),
        S('どちら|が|安い|です|か？', 'Which one is cheaper?', 'أيّهما أرخص؟'),
        S('中古スマホ|は|いくら|です|か？', 'How much is the refurbished phone?', 'بكم الهاتف المجدّد؟'),
        S('スマホケース|を|ください。', 'A phone case, please.', 'غلاف هاتف من فضلك.'),
      ],
      intents: [
        // 「中古スマホはいくらですか」: the item and its price, read on the node that follows
        { id: 'ask_price_used', any: ['いくら', 'ねだん'], slot: 'denkiItem', slotOptions: ['used', 'case'], slotRequired: true, next: 'colour', step: 'choose', ideal: L('{denkiItem}|は|いくら|です|か？', 'How much is the {denkiItem}?', 'بكم {denkiItem}؟') },
        { id: 'ask_price_pro', any: ['いくら', 'ねだん'], slot: 'denkiItem', slotOptions: ['pro'], slotRequired: true, next: 'pro_offer', step: 'choose', ideal: L('{denkiItem}|は|いくら|です|か？', 'How much is the {denkiItem}?', 'بكم {denkiItem}؟') },
        { id: 'ask_price_tv', any: ['いくら', 'ねだん'], slot: 'denkiItem', slotOptions: ['tv'], slotRequired: true, next: 'tv_offer', step: 'choose', ideal: L('{denkiItem}|は|いくら|です|か？', 'How much is the {denkiItem}?', 'بكم {denkiItem}؟') },
        { id: 'ask_price', any: ['いくら', 'ねだん'], stay: true, reply: L('どちら|の|お値段|でしょうか？', 'Which one do you mean?', 'أيّهما تقصد؟') },
        cheaperIntent,
        ...pickItems('choose'),
        goodsIntent,
        later(),
      ],
    }),
    node({
      id: 'colour',
      step: 'choose',
      say: priced(
        L('{denkiItem}|です|ね。|{price}|です。|色|は|どう|します|か？|黒、|白、|青、|赤|が|あります。', 'The {denkiItem}, I see. It is {price}. Which colour? We have black, white, blue and red.', '{denkiItem}، حسنًا. السعر {price}. أي لون؟ لدينا أسود وأبيض وأزرق وأحمر.'),
        L('{denkiItem}|です|ね。|二|万|四|千|八百|円|です。|色|は|どう|します|か？|黒、|白、|青、|赤|が|あります。', 'The {denkiItem}, I see. It is 24,800 yen. Which colour? We have black, white, blue and red.', '{denkiItem}، حسنًا. السعر 24,800 ين. أي لون؟ لدينا أسود وأبيض وأزرق وأحمر.'),
      ),
      suggestions: [S('黒|を|お願いします。', 'Black, please.', 'الأسود من فضلك.'), S('青|が|いい|です。', 'I would like blue.', 'أريد الأزرق.'), S('白|を|お願いします。', 'White, please.', 'الأبيض من فضلك.'), REPEAT_S],
      intents: [colourPick, askPrice('colour'), taxfreeIntent, later()],
    }),
    // the latest phone and the TV: while they are not in stock Aoi says so and offers the others; the chips stay the safe ones
    node({
      id: 'pro_offer',
      step: 'choose',
      say: [
        say(L('最新スマホ|は|まだ|入荷|して|いません。|中古スマホ|は|いかが|でしょうか？', 'The latest phone is not in stock yet. How about the refurbished phone?', 'أحدث هاتف لم يصل بعد. ما رأيك بالهاتف المجدّد؟'), { flag: 'pro_locked' }),
        say(L('最新スマホ|は|{price}|です。|色|は|どう|します|か？|黒、|白、|青、|赤|が|あります。', 'The latest phone is {price}. Which colour? We have black, white, blue and red.', 'أحدث هاتف بسعر {price}. أي لون؟ لدينا أسود وأبيض وأزرق وأحمر.'), { flag: 'priced' }),
        say(L('最新スマホ|は|十|二|万|八千|円|です。|色|は|どう|します|か？|黒、|白、|青、|赤|が|あります。', 'The latest phone is 128,000 yen. Which colour? We have black, white, blue and red.', 'أحدث هاتف بسعر 128,000 ين. أي لون؟ لدينا أسود وأبيض وأزرق وأحمر.')),
      ],
      suggestions: [S('中古スマホ|を|ください。', 'The refurbished phone, please.', 'الهاتف المجدّد من فضلك.'), S('黒|を|お願いします。', 'Black, please.', 'الأسود من فضلك.'), S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.')],
      intents: [
        colourPick,
        askPrice('pro_offer'),
        { id: 'choose_used', slot: 'denkiItem', slotOptions: ['used', 'case'], slotRequired: true, next: 'colour', request: true, ideal: CHOOSE_IDEAL },
        { id: 'just_looking', any: ['みているだけ', '見ているだけ'], next: 'models' },
        later(),
      ],
    }),
    node({
      id: 'tv_offer',
      step: 'choose',
      say: [
        say(L('テレビ|は|まだ|入荷|して|いません。|中古スマホ|は|いかが|でしょうか？', 'The TV is not in stock yet. How about the refurbished phone?', 'التلفزيون لم يصل بعد. ما رأيك بالهاتف المجدّد؟'), { flag: 'tv_locked' }),
        say(L('テレビ|は|{price}|です。|税込|です。', 'The TV is {price}, tax included.', 'التلفزيون بسعر {price} شاملًا الضريبة.'), { flag: 'priced' }),
        say(L('テレビ|は|二|万|四|千|八百|円|です。|税込|です。', 'The TV is 24,800 yen, tax included.', 'التلفزيون بسعر 24,800 ين شاملًا الضريبة.')),
      ],
      suggestions: [S('中古スマホ|を|ください。', 'The refurbished phone, please.', 'الهاتف المجدّد من فضلك.'), S('これ|を|ください。', 'This one, please.', 'هذا من فضلك.'), S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.')],
      intents: [
        { id: 'choose_used', slot: 'denkiItem', slotOptions: ['used', 'case'], slotRequired: true, next: 'colour', request: true, ideal: CHOOSE_IDEAL },
        askPrice('tv_offer'),
        { id: 'take_tv', any: BUY, next: 'quote_tv', request: true, ideal: L('これ|を|ください。', 'This one, please.', 'هذا من فضلك.') },
        { id: 'just_looking', any: ['みているだけ', '見ているだけ'], next: 'models' },
        later(),
      ],
    }),
    quoteNode('quote', priced(
      L('{colour}|の|{denkiItem}|です|ね。|全部で|{total}、|税込|です。', 'The {colour} {denkiItem}, I see. {total} in total, tax included.', '{denkiItem} باللون {colour}، حسنًا. المجموع {total} شاملًا الضريبة.'),
      L('{colour}|の|{denkiItem}|です|ね。|全部で|二|万|四|千|八百|円、|税込|です。', 'The {colour} {denkiItem}, I see. 24,800 yen in total, tax included.', '{denkiItem} باللون {colour}، حسنًا. المجموع 24,800 ين شاملًا الضريبة.'),
    )),
    // the TV has no colour
    quoteNode('quote_tv', priced(
      L('{denkiItem}|です|ね。|全部で|{total}、|税込|です。', 'The {denkiItem}, I see. {total} in total, tax included.', '{denkiItem}، حسنًا. المجموع {total} شاملًا الضريبة.'),
      L('{denkiItem}|です|ね。|全部で|二|万|四|千|八百|円、|税込|です。', 'The {denkiItem}, I see. 24,800 yen in total, tax included.', '{denkiItem}، حسنًا. المجموع 24,800 ين شاملًا الضريبة.'),
    )),
    node({
      id: 'pay',
      // twist (flags.twist): Aoi mentions the receipt; nothing changes in the price
      say: [
        say(L('ありがとうございます。|お支払い|は|現金|です|か、|カード|です|か？|レシート|も|お渡し|します|よ。', 'Thank you. Will you pay in cash or by card? I will give you a receipt too.', 'شكرًا لك. هل ستدفع نقدًا أم بالبطاقة؟ سأعطيك إيصالًا أيضًا.'), { flag: 'twist' }),
        say(L('ありがとうございます。|お支払い|は|現金|です|か、|カード|です|か？', 'Thank you. Will you pay in cash or by card?', 'شكرًا لك. هل ستدفع نقدًا أم بالبطاقة؟')),
      ],
      suggestions: [CARD_S, CASH_S, REPEAT_S],
      intents: [...payIntents('name'), later()],
    }),
    node({
      id: 'name',
      say: [say(L('お名前|を|お願いします。', 'Your name, please.', 'اسمك من فضلك.'))],
      suggestions: [S('{name}|です。', 'I am {name}.', 'أنا {name}.'), REPEAT_S],
      intents: [{ id: 'say_name', any: ['です', 'といいます', 'もうします'], capture: 'name', next: 'confirm', step: 'name' }, later()],
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
      say: [say(L('{denkiItem}|です。|ありがとうございました。|また|お越し|ください。', 'Here is your {denkiItem}. Thank you very much. Please come again.', 'تفضّل {denkiItem}. شكرًا جزيلًا. تفضّل بزيارتنا مجددًا.'), { slot: 'denkiItem', in: ['used', 'pro', 'case', 'tv'] }), say(L('ありがとうございました。|また|お越し|ください。', 'Thank you very much. Please come again.', 'شكرًا جزيلًا. تفضّل بزيارتنا مجددًا.'))],
      intents: [],
    }),
    // too little money is a scripted branch, never an error (§4.4 rule 6)
    node({
      id: 'short',
      say: [say(SHORT_LINE)],
      suggestions: [LATER_S, S('安い|の|は|あります|か？', 'Do you have something cheaper?', 'هل لديكم شيء أرخص؟'), THINK_S],
      intents: [later(), { id: 'cheaper', any: ['やすいの', 'やすい'], next: 'models' }],
    }),
    // goods (§5.6): the music CD, a present
    node({
      id: 'goods',
      say: [say(L('プレゼント|です|ね。|音楽CD|が|あります。', 'A present, I see. We have music CDs.', 'هدية، حسنًا. لدينا أسطوانات موسيقى.'))],
      suggestions: [S('音楽CD|を|ください。', 'A music CD, please.', 'أسطوانة موسيقى من فضلك.'), S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.'), REPEAT_S],
      intents: [
        { id: 'pick_gift', slot: 'giftItem', slotOptions: ['musicCd'], slotRequired: true, next: 'pay_gift', request: true, ideal: L('{giftItem}|を|ください。', '{giftItem}, please.', '{giftItem} من فضلك.') },
        { id: 'just_looking', any: ['みているだけ', '見ているだけ'], next: 'models' },
        later(),
      ],
    }),
    node({
      id: 'pay_gift',
      say: priced(
        L('{giftItem}|です|ね。|{total}、|税込|です。|現金|です|か、|カード|です|か？', 'The {giftItem}, I see. {total}, tax included. Cash or card?', '{giftItem}، حسنًا. {total} شاملًا الضريبة. نقدًا أم بالبطاقة؟'),
        L('{giftItem}|です|ね。|三千|三百|円、|税込|です。|現金|です|か、|カード|です|か？', 'The {giftItem}, I see. 3,300 yen, tax included. Cash or card?', '{giftItem}، حسنًا. 3,300 ين شاملًا الضريبة. نقدًا أم بالبطاقة؟'),
      ),
      suggestions: [CARD_S, CASH_S, REPEAT_S],
      intents: [...payIntents('done'), later()],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

/** Scenarios for Hikari Denki: denki_phone (see docs/GAME_DESIGN.md). */
export const DENKI_SCENARIOS: Scenario[] = [DENKI_PHONE];
