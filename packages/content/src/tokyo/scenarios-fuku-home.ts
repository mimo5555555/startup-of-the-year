import type { IntentDef, Line, SayVariant, Scenario, SceneNode } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';
import { yenToJa } from './game/jp-language';

// Fuku-Fuku's second-hand corner (Release 2 wave B2, docs/GAME_DESIGN.md §6.3 `fuku_home`, §5.2): Rin sells seven pieces of furniture.
// Steps: choose (name the piece), price (hear it and decide), take (carry it home, or delivery at ¥2,200), day (when it should arrive; a
// carried piece skips the question), pay. Slots: `furniture` (7 pieces), `delivery` (carry / deliver), `deliveryDay` (tomorrow, the day after,
// Saturday), `payMethod`. Rin is polite staff (she is a shopkeeper, not one of the friends, so there is no casual register).
//
// Big pieces (`ItemDef.bulky`: futon, desk, bookshelf, kotatsu) are always delivered and always charged the delivery fee (the quote does it,
// §4.4 rule 5); small ones (plant, rice cooker, lamp) are carried. The two kinds have their own nodes, because one intent cannot branch on the
// piece. A piece that cannot be sold yet (the kotatsu, the cooker and the lamp need a table, a kitchen and a light, so the flat) is "not in
// stock": the game's `in_stock` check sends the learner to `not_yet`.
// Prices only through Vars ({price}, {total}) supplied by the game's hooks; without hooks the fixed-price variants keep the scenario playable
// on its own (they equal the catalog rows, checked in the tests). The delivery day reaches the purchase through the slot `deliveryDay`.

/** Fixed prices (yen, tax included) of the no-hooks fallback variants; they equal the catalog rows of §5.2 (checked in the tests). */
export const FURNITURE_PRICES: Record<string, number> = {
  futon: 8000,
  desk: 6000,
  bookshelf: 4500,
  plant: 1200,
  kotatsu: 7000,
  riceCooker: 3500,
  lamp: 2000,
};
/** The delivery fee Rin names (equal to `rules.deliveryFee`, checked in the tests). */
export const DELIVERY_FEE = 2200;
/** The pieces that are delivered (bulky) and the ones that are carried home. */
export const BIG_PIECES = ['futon', 'desk', 'bookshelf', 'kotatsu'];
export const SMALL_PIECES = ['plant', 'riceCooker', 'lamp'];

const yenEn = (yen: number) => `${yen.toLocaleString('en-US')} yen`;
const yenAr = (yen: number) => `${yen.toLocaleString('en-US')} ين`;
const same = (l: Line): SayVariant[] => [say(l)];

/** a quote line with one fixed variant per piece (the live line first, for the hooks) */
const quoteLines = (ids: string[], extra: number, live: Line, build: (yenJa: string, yenEn: string, yenAr: string) => Line, fallback: Line): SayVariant[] => [
  say(live, { flag: 'priced' }),
  ...ids.map((id) => {
    const yen = FURNITURE_PRICES[id] + extra;
    return say(build(yenToJa(yen).markup, yenEn(yen), yenAr(yen)), { slot: 'furniture', in: [id] });
  }),
  say(fallback),
];

const SHORT_LINE = L('すみません、|少し|足りません。', 'I am sorry, it is a little short.', 'آسفة، المبلغ ناقص قليلًا.');
const SOLD_OUT_LINE = L('すみません、|それ|は|品切れ|です。', 'I am sorry, that is sold out.', 'آسفة، هذا نفد.');
const OWNED_LINE = L('それ|は|もう|お持ち|です|よ。', 'You already have that one.', 'لديك هذا بالفعل.');
const LEAVE_LINE = L('はい。|また|お待ち|して|おります。', 'All right. We look forward to seeing you again.', 'حسنًا. بانتظار زيارتك مجددًا.');
const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const CARD_S = S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.');
const CASH_S = S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.');
const JUST_LOOKING_S = S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.');
const BUY = ['ください', 'おねがい', 'にします', 'かいます', 'ほしい', 'これ'];

const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });
const payIntents = (next: string): IntentDef[] => [
  { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next },
  { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next },
  { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ'], next },
];
const justLooking: IntentDef = { id: 'just_looking', any: ['みているだけ', '見ているだけ'], stay: true, reply: L('ごゆっくり|どうぞ。', 'Please take your time.', 'خذ وقتك من فضلك.') };

const PICK_IDEAL = L('{furniture}|を|ください。', '{furniture}, please.', '{furniture} من فضلك.');
/** naming a piece, wherever the learner is: a big one goes to its delivery price, a small one to its carry price; one that is not in stock goes to `not_yet` */
const pick = (): IntentDef[] => [
  { id: 'pick_big', slot: 'furniture', slotOptions: BIG_PIECES, slotRequired: true, next: 'price_big', step: 'choose', request: true, ideal: PICK_IDEAL, econ: 'in_stock', nextIfNo: 'not_yet' },
  { id: 'pick_small', slot: 'furniture', slotOptions: SMALL_PIECES, slotRequired: true, next: 'price_small', step: 'choose', request: true, ideal: PICK_IDEAL, econ: 'in_stock', nextIfNo: 'not_yet' },
];
const PICK_CHIPS = [S('布団|を|ください。', 'A futon, please.', 'فوتون من فضلك.'), S('観葉植物|を|ください。', 'A houseplant, please.', 'نبتة زينة من فضلك.'), S('本棚|を|ください。', 'A bookshelf, please.', 'رف كتب من فضلك.'), REPEAT_S];
const dear: IntentDef = { id: 'too_dear', any: ['たかい', '高い'], stay: true, reply: L('すみません。|中古|でも、|定価|です。', 'I am sorry. Even second-hand, the price is fixed.', 'آسفة. حتى المستعمل سعره ثابت.') };

const buy = (next: string): IntentDef => ({
  id: 'buy',
  any: BUY,
  none: ['かんがえ'],
  next,
  step: 'price',
  request: true,
  ideal: L('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'),
});

const priceNode = (id: 'price_big' | 'price_small', ids: string[], next: string): SceneNode =>
  node({
    id,
    say: quoteLines(
      ids,
      0,
      L('{furniture}|です|ね。|{price}|です。|中古|です|が、|まだ|きれい|です|よ。', 'The {furniture}, I see. It is {price}. It is second-hand, but still clean.', '{furniture}، حسنًا. السعر {price}. مستعمل، لكنه ما زال نظيفًا.'),
      (ja, en, ar) => L(`{furniture}|です|ね。|${ja}|です。|中古|です|が、|まだ|きれい|です|よ。`, `The {furniture}, I see. It is ${en}. It is second-hand, but still clean.`, `{furniture}، حسنًا. السعر ${ar}. مستعمل، لكنه ما زال نظيفًا.`),
      L('{furniture}|です|ね。|中古|です|が、|まだ|きれい|です|よ。', 'The {furniture}, I see. It is second-hand, but still clean.', '{furniture}، حسنًا. مستعمل، لكنه ما زال نظيفًا.'),
    ),
    suggestions: [S('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'), S('少し|高い|です。', 'It is a little expensive.', 'إنه غالٍ قليلًا.'), THINK_S, REPEAT_S],
    intents: [buy(next), dear, { id: 'ask_price', any: ['いくら', 'ねだん'], next: id }, later()],
  });

export const FUKU_HOME: Scenario = {
  id: 'fuku_home',
  locationId: 'fukufuku',
  characterId: 'rin',
  level: 'A2',
  title: { en: 'Second-hand furniture', ar: 'أثاث مستعمل' },
  setup: {
    en: 'Rin sells second-hand furniture at Fuku-Fuku. Choose a piece for your room, hear the price, decide how to get it home (carry it, or have it delivered for 2,200 yen), choose the day, and pay.',
    ar: 'تبيع رين أثاثًا مستعملًا في فوكو فوكو. اختر قطعة لغرفتك، واسمع السعر، وقرر كيف تأخذها إلى البيت (تحملها، أو تطلب توصيلها مقابل 2,200 ين)، واختر اليوم، ثم ادفع.',
  },
  minutes: 5,
  steps: [
    { id: 'choose', text: { en: 'Say which piece you want', ar: 'قل أي قطعة تريد' } },
    { id: 'price', text: { en: 'Hear the price and decide', ar: 'اسمع السعر وقرر' } },
    { id: 'take', text: { en: 'Carry it home or have it delivered', ar: 'احملها أو اطلب توصيلها' } },
    { id: 'day', text: { en: 'Choose the delivery day (or carry it)', ar: 'اختر يوم التوصيل (أو احملها)' } },
    { id: 'pay', text: { en: 'Pay and say thanks', ar: 'ادفع واشكر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: same(L('いらっしゃいませ。|中古|の|家具|も|あります|よ。|何|か|お探し|です|か？', 'Welcome. We have second-hand furniture too. Are you looking for something?', 'أهلًا بك. لدينا أثاث مستعمل أيضًا. هل تبحث عن شيء؟')),
      suggestions: [S('家具|を|探しています。', 'I am looking for furniture.', 'أبحث عن أثاث.'), S('布団|を|ください。', 'A futon, please.', 'فوتون من فضلك.'), JUST_LOOKING_S, S('こんにちは。', 'Hello.', 'مرحبًا.')],
      intents: [
        ...pick(),
        { id: 'ask_have', any: ['かぐ', 'ありますか', 'なにがありますか', 'ちゅうこ'], next: 'shelves' },
        justLooking,
        { id: 'hello', any: ['こんにちは', 'すみません'], stay: true, reply: L('何|か|お探し|です|か？', 'Are you looking for something?', 'هل تبحث عن شيء؟') },
        later(),
      ],
    }),
    // what the corner has: the pieces are read aloud, the learner names one
    node({
      id: 'shelves',
        say: same(L('布団、|勉強机、|本棚、|観葉植物、|こたつ、|炊飯器、|和風ランプ|が|あります。', 'We have futons, study desks, bookshelves, houseplants, kotatsu, rice cookers and paper lamps.', 'لدينا فوتون ومكاتب دراسة ورفوف كتب ونباتات زينة وكوتاتسو وأجهزة طهي أرز ومصابيح ورقية.')),
      suggestions: PICK_CHIPS,
      intents: [...pick(), { id: 'ask_price', any: ['いくら', 'ねだん'], stay: true, reply: L('どれ|の|お値段|です|か？', 'Which one do you mean?', 'أيّها تقصد؟') }, justLooking, later()],
    }),
    // a piece that cannot be sold yet (the table, the kitchen and the light need the flat): Rin says so and offers the others
    node({
      id: 'not_yet',
      say: same(L('{furniture}|は|まだ|入荷|して|いません。|ほか|の|は|いかが|です|か？', 'We do not have the {furniture} in stock yet. How about another piece?', 'ليس لدينا {furniture} بعد. ما رأيك بقطعة أخرى؟')),
      suggestions: [S('布団|を|ください。', 'A futon, please.', 'فوتون من فضلك.'), S('観葉植物|を|ください。', 'A houseplant, please.', 'نبتة زينة من فضلك.'), JUST_LOOKING_S, REPEAT_S],
      intents: [...pick(), { id: 'just_looking', any: ['みているだけ', '見ているだけ'], next: 'shelves' }, later()],
    }),
    // the price of a big piece, then how it gets home (always delivery, ¥2,200), then the day
    priceNode('price_big', BIG_PIECES, 'take_big'),
    node({
      id: 'take_big',
      say: same(L('大きい|ので、|配送|に|なります。|配送|は|' + yenToJa(DELIVERY_FEE).markup + '|です。', `It is big, so it will be delivered. Delivery is ${yenEn(DELIVERY_FEE)}.`, `إنها كبيرة، لذا ستُوصَّل. التوصيل بـ ${yenAr(DELIVERY_FEE)}.`)),
      suggestions: [S('配送|で|お願いします。', 'Delivery, please.', 'التوصيل من فضلك.'), S('はい、|お願いします。', 'Yes, please.', 'نعم من فضلك.'), THINK_S, REPEAT_S],
      intents: [
        { id: 'take_deliver', slot: 'delivery', slotOptions: ['deliver'], slotRequired: true, next: 'day', step: 'take', request: true, ideal: L('配送|で|お願いします。', 'Delivery, please.', 'التوصيل من فضلك.') },
        { id: 'take_yes', any: ['はい', 'おねがい', 'わかりました', 'いいです'], none: ['もちかえ', 'いいえ', 'かんがえ'], next: 'day', step: 'take' },
        { id: 'take_carry', slot: 'delivery', slotOptions: ['carry'], slotRequired: true, stay: true, reply: L('すみません、|大きい|ので|持ち帰り|は|難しい|です。|配送|で|いい|です|か？', 'I am sorry, it is big, so carrying it home is difficult. Is delivery all right?', 'آسفة، إنها كبيرة، لذا حملها صعب. هل التوصيل مناسب؟') },
        later(),
      ],
    }),
    node({
      id: 'day',
      say: same(L('いつ|が|いい|です|か？|明日、|あさって、|土曜日|に|お届け|できます|よ。', 'When would you like it? We can deliver tomorrow, the day after tomorrow or on Saturday.', 'متى تريدها؟ يمكننا التوصيل غدًا أو بعد غد أو يوم السبت.')),
      suggestions: [S('明日|が|いい|です。', 'Tomorrow, please.', 'غدًا من فضلك.'), S('土曜日|に|お願いします。', 'Saturday, please.', 'يوم السبت من فضلك.'), S('あさって|で|お願いします。', 'The day after tomorrow, please.', 'بعد غد من فضلك.'), S('いつ|届きます|か？', 'When will it arrive?', 'متى ستصل؟')],
      intents: [
        { id: 'pick_day', slot: 'deliveryDay', slotRequired: true, next: 'quote_big', step: 'day', request: true, ideal: L('{deliveryDay}|に|お願いします。', '{deliveryDay}, please.', '{deliveryDay} من فضلك.') },
        { id: 'ask_when', any: ['いつ', 'とどき', 'とどけ'], stay: true, reply: L('明日、|あさって、|土曜日|に|お届け|できます|よ。', 'We can deliver tomorrow, the day after tomorrow or on Saturday.', 'يمكننا التوصيل غدًا أو بعد غد أو يوم السبت.') },
        later(),
      ],
    }),
    // the delivery day and the total (item + delivery) in one breath, then the way to pay
    node({
      id: 'quote_big',
      say: quoteLines(
        BIG_PIECES,
        DELIVERY_FEE,
        L('{furniture}|を|{deliveryDay}、|お届け|します。|全部|で|{total}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'We will deliver the {furniture} on {deliveryDay}. {total} in total, tax included. Will you pay in cash or by card?', 'سنوصّل {furniture} {deliveryDay}. المجموع {total} شاملًا الضريبة. هل ستدفع نقدًا أم بالبطاقة؟'),
        (ja, en, ar) => L(`{furniture}|を|{deliveryDay}、|お届け|します。|全部|で|${ja}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？`, `We will deliver the {furniture} on {deliveryDay}. ${en} in total, tax included. Will you pay in cash or by card?`, `سنوصّل {furniture} {deliveryDay}. المجموع ${ar} شاملًا الضريبة. هل ستدفع نقدًا أم بالبطاقة؟`),
        L('{furniture}|を|{deliveryDay}、|お届け|します。|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'We will deliver the {furniture} on {deliveryDay}. Tax is included. Will you pay in cash or by card?', 'سنوصّل {furniture} {deliveryDay}. الضريبة شاملة. هل ستدفع نقدًا أم بالبطاقة؟'),
      ),
      suggestions: [CARD_S, CASH_S, THINK_S, S('少し|高い|です。', 'It is a little expensive.', 'إنه غالٍ قليلًا.')],
      intents: [...payIntents('done'), dear, { id: 'ask_price', any: ['いくら', 'ねだん'], next: 'quote_big' }, later()],
    }),
    // a small piece: carried home, so there is no day to choose
    priceNode('price_small', SMALL_PIECES, 'take_small'),
    node({
      id: 'take_small',
      say: same(L('小さい|ので、|持ち帰り|できます|よ。|持ち帰り|で|いい|です|か？', 'It is small, so you can carry it home. Is carrying it all right?', 'إنها صغيرة، لذا يمكنك حملها إلى البيت. هل الحمل مناسب؟')),
      suggestions: [S('持ち帰り|で|お願いします。', 'I will carry it, please.', 'سأحملها من فضلك.'), S('はい、|お願いします。', 'Yes, please.', 'نعم من فضلك.'), THINK_S, REPEAT_S],
      intents: [
        { id: 'take_carry', slot: 'delivery', slotOptions: ['carry'], slotRequired: true, next: 'quote_small', step: 'take', request: true, ideal: L('持ち帰り|で|お願いします。', 'I will carry it, please.', 'سأحملها من فضلك.') },
        { id: 'take_yes', any: ['はい', 'おねがい', 'わかりました', 'いいです'], none: ['はいそう', 'いいえ', 'かんがえ'], next: 'quote_small', step: 'take' },
        { id: 'take_deliver', slot: 'delivery', slotOptions: ['deliver'], slotRequired: true, stay: true, reply: L('小さい|ので、|持ち帰り|できます|よ。', 'It is small, so you can carry it home.', 'إنها صغيرة، لذا يمكنك حملها إلى البيت.') },
        later(),
      ],
    }),
    node({
      id: 'quote_small',
      step: 'day',
      say: quoteLines(
        SMALL_PIECES,
        0,
        L('{furniture}|を|お持ち帰り|です|ね。|{total}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'The {furniture}, to take with you. {total}, tax included. Will you pay in cash or by card?', '{furniture} لتأخذها معك. {total} شاملًا الضريبة. هل ستدفع نقدًا أم بالبطاقة؟'),
        (ja, en, ar) => L(`{furniture}|を|お持ち帰り|です|ね。|${ja}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？`, `The {furniture}, to take with you. ${en}, tax included. Will you pay in cash or by card?`, `{furniture} لتأخذها معك. ${ar} شاملًا الضريبة. هل ستدفع نقدًا أم بالبطاقة؟`),
        L('{furniture}|を|お持ち帰り|です|ね。|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'The {furniture}, to take with you. Tax is included. Will you pay in cash or by card?', '{furniture} لتأخذها معك. الضريبة شاملة. هل ستدفع نقدًا أم بالبطاقة؟'),
      ),
      suggestions: [CARD_S, CASH_S, THINK_S, S('少し|高い|です。', 'It is a little expensive.', 'إنه غالٍ قليلًا.')],
      intents: [...payIntents('done'), dear, { id: 'ask_price', any: ['いくら', 'ねだん'], next: 'quote_small' }, later()],
    }),
    // the charge: the quote, the receipt and the ledger agree; a delivered piece is booked for the chosen day, a carried one is handed over
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [
        say(L('ありがとうございました。|{deliveryDay}、|お届け|します|ね。', 'Thank you very much. We will deliver it on {deliveryDay}.', 'شكرًا جزيلًا. سنوصّلها {deliveryDay}.'), { slot: 'furniture', in: BIG_PIECES }),
        say(L('ありがとうございました。|また|お越し|ください。', 'Thank you very much. Please come again.', 'شكرًا جزيلًا. تفضّل بزيارتنا مجددًا.')),
      ],
      intents: [],
    }),
    // too little money is a scripted branch, never an error (§4.4 rule 6)
    node({
      id: 'short',
      say: [say(OWNED_LINE, { flag: 'owned_already' }), say(SOLD_OUT_LINE, { flag: 'sold_out' }), say(SHORT_LINE)],
      suggestions: [LATER_S, S('安い|の|は|あります|か？', 'Do you have something cheaper?', 'هل لديكم شيء أرخص؟'), THINK_S],
      intents: [later(), { id: 'cheaper', any: ['やすいの', 'やすい'], next: 'shelves' }],
    }),
    node({ id: 'leave', end: true, say: same(LEAVE_LINE), intents: [] }),
  ]),
};

/** Scenarios for Fuku-Fuku's second-hand corner. */
export const FUKU_HOME_SCENARIOS: Scenario[] = [FUKU_HOME];
