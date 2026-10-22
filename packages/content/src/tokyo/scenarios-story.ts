import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';
import { yenToJa } from './game/jp-language';

// Story scenes (docs/GAME_DESIGN.md §6.5 TripPanel, §7.2 Chapters 5 and 7). Release 2 wave C1 builds `trip_hikarigaoka`; wave C2 the festival
// ones, `matsuri_stalls` (Kenji's stall row) and `matsuri_speech` (the capstone self-introduction on the festival stage, Hanako).
//
// trip_hikarigaoka: the conversation of the Hikarigaoka trip. The TripPanel (the app) has already charged the round trip up front
// (ledger `fare:<id>`, two legs) and shows the town as a backdrop; this is the talk with Kato, who keeps the souvenir shop by the station.
// The learner greets him, asks for something (a recommendation, or where a place is) and buys an omiyage (slot `giftItem`, option
// `souvenir`, ¥1,000, cash or IC). Buying is optional: a polite 「考えます」/「また来ます」 ends the visit with no purchase, and running short
// of cash is a scripted branch (§4.4 rule 6), so nothing here can strand the player: the way back is prepaid. Prices are Vars ({total}),
// filled by the game's hooks; without hooks the fixed-price fallback keeps the scenario playable on its own.

/** The one price of the shop (yen, tax included): equals the catalog row of `g_souvenir` (checked in the tests). */
export const KATO_PRICES: Record<string, number> = { souvenir: 1000 };

const yenEn = (yen: number) => `${yen.toLocaleString('en-US')} yen`;
const yenAr = (yen: number) => `${yen.toLocaleString('en-US')} ين`;

/** The live price line (Vars from the hooks, when the app sets `flags.priced`) or, without game hooks, a fixed line so the scenario still runs on its own. */
const quoteVariants = (live: Line, build: (ja: string, en: string, ar: string) => Line): SayVariant[] => [
  say(live, { flag: 'priced' }),
  ...Object.entries(KATO_PRICES).map(([id, yen]) => say(build(yenToJa(yen).markup, yenEn(yen), yenAr(yen)), { slot: 'giftItem', in: [id] })),
  say(L('{giftItem}|です|ね。|税込|です。|現金|か|ICカード|で|お願いします|ね。', 'The {giftItem}, I see. Tax is included. Cash or IC card, please.', '{giftItem}، حسنًا. الضريبة شاملة. نقدًا أو ببطاقة IC من فضلك.')),
];

const SHORT_LINE = L('あ、|すみません。|少し|足りません|ね。', 'Oh, I am sorry. It is a little short.', 'آه، آسف. المبلغ ناقص قليلًا.');
const SOLD_OUT_LINE = L('すみません。|それ|は|品切れ|です。', 'I am sorry. That is sold out.', 'آسف. هذا نفد.');
const OWNED_LINE = L('それ|は|もう|お持ち|です|よ。', 'You already have that one.', 'لديك هذا بالفعل.');
const LEAVE_LINE = L('わかりました。|また|どうぞ。|お気をつけて。', 'Understood. Please come again. Take care.', 'حسنًا. تفضّل مرة أخرى. اعتنِ بنفسك.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const CASH_S = S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.');
const IC_S = S('ICカード|で|お願いします。', 'By IC card, please.', 'ببطاقة IC من فضلك.');
const JUST_LOOKING_S = S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.');
const SOUVENIR_S = S('お土産|を|ください。', 'A souvenir, please.', 'هدية تذكارية من فضلك.');

/** Taught polite refusal (`cc_refuse`): the way out of every offer. */
const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });
const justLooking: IntentDef = { id: 'just_looking', any: ['みているだけ', '見ているだけ'], stay: true, reply: L('ごゆっくり|どうぞ。', 'Please take your time.', 'خذ وقتك من فضلك.') };
const askPrice: IntentDef = { id: 'ask_price', any: ['いくら', 'ねだん'], stay: true, reply: L('後で、|お値段|を|お知らせ|します|ね。', 'I will tell you the price in a moment.', 'سأخبرك بالسعر بعد قليل.') };
/** Naming the souvenir: `giftItem` is shared with every shop's `goods` node, so only this shop's own present starts a sale. */
const pickSouvenir = (next: string, step?: string): IntentDef => ({
  id: 'pick_souvenir',
  slot: 'giftItem',
  slotOptions: Object.keys(KATO_PRICES),
  slotRequired: true,
  next,
  ...(step ? { step } : {}),
  request: true,
  ideal: L('{giftItem}|を|ください。', '{giftItem}, please.', '{giftItem} من فضلك.'),
});

/** What the learner may ask for at the shop: a recommendation, or where something is. Both are the goal step `ask`. */
const askIntents = (step?: string): IntentDef[] => [
  {
    id: 'ask_reco',
    any: ['おすすめ', 'なにがあります', 'なにがおいしい'],
    none: ['どこ'],
    next: 'reco',
    // (the node it leads to marks `ask`; from the first node the greeting is taken as given)
    ...(step ? { step } : {}),
    request: true,
    ideal: L('おすすめ|は|何|です|か？', 'What do you recommend?', 'بماذا تنصح؟'),
  },
  {
    id: 'ask_where',
    any: ['どこ'],
    next: 'where',
    ...(step ? { step } : {}),
    request: true,
    ideal: L('公園|は|どこ|です|か？', 'Where is the park?', 'أين الحديقة؟'),
  },
];

export const TRIP_HIKARIGAOKA: Scenario = {
  id: 'trip_hikarigaoka',
  locationId: 'hikarigaoka',
  characterId: 'kato',
  level: 'A2',
  title: { en: 'A day in Hikarigaoka', ar: 'يوم في هيكاريغاؤكا' },
  setup: {
    en: 'You came by train to Hikarigaoka. Greet Kato-san at the souvenir shop, ask him for something (what he recommends, or where the park is), and buy an omiyage if you like. The ride back is already paid.',
    ar: 'وصلت بالقطار إلى هيكاريغاؤكا. حيِّ السيد كاتو في متجر الهدايا التذكارية، واسأله عن شيء (بماذا ينصح أو أين الحديقة)، واشترِ أوميياغي إن أحببت. أجرة العودة مدفوعة مسبقًا.',
  },
  minutes: 4,
  steps: [
    { id: 'greet', text: { en: 'Greet Kato and say you came by train', ar: 'حيِّ كاتو وقل إنك جئت بالقطار' } },
    { id: 'ask', text: { en: 'Ask for something (a recommendation, or where a place is)', ar: 'اسأل عن شيء (توصية أو مكان)' } },
    { id: 'souvenir', text: { en: 'Choose an omiyage', ar: 'اختر أوميياغي' } },
    { id: 'pay', text: { en: 'Pay and say thanks', ar: 'ادفع واشكر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|光が丘|へ|ようこそ。|電車|で|来ました|か？', 'Welcome. Welcome to Hikarigaoka. Did you come by train?', 'أهلًا بك. أهلًا بك في هيكاريغاؤكا. هل جئت بالقطار؟'))],
      suggestions: [S('はい、|電車|で|来ました。', 'Yes, I came by train.', 'نعم، جئت بالقطار.'), S('おすすめ|は|何|です|か？', 'What do you recommend?', 'بماذا تنصح؟'), JUST_LOOKING_S, LATER_S],
      intents: [
        // asking or buying at once: the greeting is taken as given
        pickSouvenir('quote', 'greet'),
        ...askIntents('greet'),
        { id: 'greet', any: ['こんにちは', 'はじめまして', 'でんしゃ', '電車', 'きました', 'はい', 'すみません'], next: 'town', step: 'greet', ideal: L('はい、|電車|で|来ました。', 'Yes, I came by train.', 'نعم، جئت بالقطار.') },
        justLooking,
        later(),
      ],
    }),
    node({
      id: 'town',
      emotion: 'happy',
      step: 'greet',
      say: [say(L('いい|です|ね。|光が丘|は|静か|な|町|です。|何か|聞いて|ください。', 'Nice. Hikarigaoka is a quiet town. Please ask me anything.', 'جميل. هيكاريغاؤكا بلدة هادئة. اسألني عن أي شيء من فضلك.'))],
      suggestions: [S('おすすめ|は|何|です|か？', 'What do you recommend?', 'بماذا تنصح؟'), S('公園|は|どこ|です|か？', 'Where is the park?', 'أين الحديقة؟'), JUST_LOOKING_S, REPEAT_S],
      intents: [pickSouvenir('quote'), ...askIntents(), justLooking, later(), { id: 'again', any: ['もういちど'], next: 'town' }],
    }),
    // a recommendation, then the offer
    node({
      id: 'reco',
      step: 'ask',
      emotion: 'happy',
      say: [say(L('お菓子|と|お土産|が|おすすめ|です|よ。|お土産|は|いかが|です|か？', 'I recommend the sweets and the souvenirs. Would you like a souvenir?', 'أنصحك بالحلوى والهدايا التذكارية. هل تريد هدية تذكارية؟'))],
      suggestions: [SOUVENIR_S, JUST_LOOKING_S, THINK_S, REPEAT_S],
      intents: [pickSouvenir('quote', 'souvenir'), askPrice, justLooking, later(), { id: 'again', any: ['もういちど'], next: 'reco' }],
    }),
    // where is something: right by the station, and the offer
    node({
      id: 'where',
      step: 'ask',
      say: [say(L('公園|は|駅|の|右|です。|ここ|から|近い|です|よ。|お土産|は|いかが|です|か？', 'The park is on the right of the station. It is near from here. Would you like a souvenir?', 'الحديقة على يمين المحطة. هي قريبة من هنا. هل تريد هدية تذكارية؟'))],
      suggestions: [SOUVENIR_S, S('右|です|ね。', 'On the right, yes?', 'على اليمين، صحيح؟'), THINK_S, REPEAT_S],
      intents: [
        pickSouvenir('quote', 'souvenir'),
        { id: 'repeat_right', any: ['みぎ', '右', 'そうです'], stay: true, reply: L('はい、|そうです。', 'Yes, that is right.', 'نعم، هذا صحيح.') },
        askPrice,
        justLooking,
        later(),
        { id: 'again', any: ['もういちど'], next: 'where' },
      ],
    }),
    // the price and the way to pay (cash or IC card)
    node({
      id: 'quote',
      step: 'souvenir',
      say: quoteVariants(
        L('{giftItem}|です|ね。|全部|で|{total}、|税込|です。|現金|か|ICカード|で|お願いします|ね。', 'The {giftItem}, I see. {total} in total, tax included. Cash or IC card, please.', '{giftItem}، حسنًا. المجموع {total} شاملًا الضريبة. نقدًا أو ببطاقة IC من فضلك.'),
        (ja, en, ar) =>
          L(`{giftItem}|です|ね。|全部|で|${ja}、|税込|です。|現金|か|ICカード|で|お願いします|ね。`, `The {giftItem}, I see. ${en} in total, tax included. Cash or IC card, please.`, `{giftItem}، حسنًا. المجموع ${ar} شاملًا الضريبة. نقدًا أو ببطاقة IC من فضلك.`),
      ),
      suggestions: [CASH_S, IC_S, THINK_S, S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.')],
      intents: [
        { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'done' },
        { id: 'pay_ic', slot: 'payMethod', slotOptions: ['ic'], slotRequired: true, next: 'done' },
        { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ', 'かーど'], next: 'done' },
        { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, stay: true, reply: L('すみません。|カード|は|使えません。|現金|か|ICカード|で|お願いします。', 'I am sorry. We cannot take a credit card. Cash or IC card, please.', 'آسف. لا نقبل بطاقة الائتمان. نقدًا أو ببطاقة IC من فضلك.') },
        { id: 'ask_price', any: ['いくら', 'ねだん'], next: 'quote' },
        later(),
      ],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('ありがとうございました！|お気をつけて。|また|どうぞ。', 'Thank you very much! Take care. Please come again.', 'شكرًا جزيلًا! اعتنِ بنفسك. تفضّل مرة أخرى.'))],
      intents: [],
    }),
    // too little money is a scripted branch, never an error (§4.4 rule 6): the way back is already paid, so the visit simply ends well
    node({
      id: 'short',
      say: [say(OWNED_LINE, { flag: 'owned_already' }), say(SOLD_OUT_LINE, { flag: 'sold_out' }), say(SHORT_LINE)],
      suggestions: [LATER_S, THINK_S, S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.')],
      intents: [later(), justLooking],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

// ------------------------------------------------------------------------------------------------------------------------------------
// matsuri_stalls (Chapter 7, c7_2): Kenji's stall row in the park at the festival. Kenji has put up his ramen stall (屋台) and, for the
// evening, sells the festival food of the row: yakisoba, takoyaki, kakigōri and a candy apple (slot `yatai`, menu shop `matsuri`,
// `game/menu.ts`). Stalls take cash only (`cc_matsuri`): a card or the IC card gets a kind "cash only" and the question again. Four lines of the
// learner's own are possible (how the festival is, the order, the payment, the thanks), so 3+ of them (c7_2) leaves room for one slip; the
// easier alternative is 2. Prices are Vars ({total}) from the hooks, with a fixed-price fallback. Short of cash is a scripted branch.
// ------------------------------------------------------------------------------------------------------------------------------------

/** Festival food prices (yen, tax included): equal the `matsuri` menu rows (checked in the tests). Modest street prices; §5.1 lists none. */
export const MATSURI_PRICES: Record<string, number> = { yakisoba: 500, takoyaki: 600, kakigori: 300, ringoame: 400 };

const FOOD_S = {
  takoyaki: S('たこ焼き|を|ください。', 'Takoyaki, please.', 'تاكوياكي من فضلك.'),
  yakisoba: S('焼きそば|を|ください。', 'Yakisoba, please.', 'ياكيسوبا من فضلك.'),
  kakigori: S('かき氷|を|ください。', 'Shaved ice, please.', 'كاكيغوري من فضلك.'),
};
const RECO_S = S('おすすめ|は|何|です|か？', 'What do you recommend?', 'بماذا تنصح؟');
const ENJOY_S = S('はい、|とても|楽しい|です。', 'Yes, it is a lot of fun.', 'نعم، ممتع جدًا.');
const CASH_ONLY_LINE = L('すみません。|屋台|は|現金|だけ|です。', 'Sorry. The stalls take cash only.', 'آسف. البسطات تقبل النقد فقط.');

const orderFood = (step?: string): IntentDef => ({
  id: 'order_food',
  slot: 'yatai',
  slotRequired: true,
  next: 'quote',
  ...(step ? { step } : {}),
  request: true,
  ideal: L('{yatai}|を|ください。', '{yatai}, please.', '{yatai} من فضلك.'),
});
const stallReco: IntentDef = { id: 'recommend', any: ['おすすめ', 'オススメ', 'なにがおいしい', 'なにがいい'], next: 'reco', request: true, ideal: L('おすすめ|は|何|です|か？', 'What do you recommend?', 'بماذا تنصح؟') };
const enjoy: IntentDef = {
  id: 'enjoy',
  any: ['たのしい', '楽しい', 'たのしんで', '楽しんで', 'たのしみ', 'すごい', 'きれい', 'はい', 'いいです', 'こんばんは', 'こんにちは'],
  none: ['ください', 'おすすめ'],
  next: 'menu',
  step: 'greet',
  ideal: L('はい、|とても|楽しい|です。', 'Yes, it is a lot of fun.', 'نعم، ممتع جدًا.'),
};

const stallQuote = (live: Line, build: (ja: string, en: string, ar: string) => Line): SayVariant[] => [
  say(live, { flag: 'priced' }),
  ...Object.entries(MATSURI_PRICES).map(([id, yen]) => say(build(yenToJa(yen).markup, yenEn(yen), yenAr(yen)), { slot: 'yatai', in: [id] })),
  say(L('{yatai}|です|ね。|屋台|は|現金|だけ|です|よ。', 'The {yatai}, coming up. The stalls take cash only.', '{yatai}، حسنًا. البسطات تقبل النقد فقط.')),
];

export const MATSURI_STALLS: Scenario = {
  id: 'matsuri_stalls',
  locationId: 'park',
  characterId: 'kenji',
  level: 'A2',
  title: { en: 'Festival stalls', ar: 'بسطات المهرجان' },
  setup: {
    en: 'The park is a festival tonight. Kenji has put up his ramen stall and sells the festival food of the row. Tell him how you like the festival, order something and pay. The stalls take cash only.',
    ar: 'الحديقة مهرجان الليلة. نصب كينجي بسطة الرامن ويبيع طعام المهرجان في الصف. أخبره برأيك في المهرجان واطلب شيئًا وادفع. البسطات تقبل النقد فقط.',
  },
  minutes: 3,
  steps: [
    { id: 'greet', text: { en: 'Say how you like the festival', ar: 'قل رأيك في المهرجان' } },
    { id: 'order', text: { en: 'Order festival food', ar: 'اطلب طعام المهرجان' } },
    { id: 'pay', text: { en: 'Pay in cash', ar: 'ادفع نقدًا' } },
    { id: 'thanks', text: { en: 'Say thanks', ar: 'اشكره' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'excited',
      say: [say(L('いらっしゃい！|お祭り|へ|ようこそ。|楽しんで|います|か？', 'Welcome! Welcome to the festival. Are you enjoying it?', 'أهلًا بك! أهلًا بك في المهرجان. هل تستمتع؟'))],
      suggestions: [ENJOY_S, FOOD_S.takoyaki, RECO_S],
      // ordering at once: the greeting is taken as given
      intents: [orderFood('greet'), { ...stallReco, step: 'greet' }, enjoy, later()],
    }),
    node({
      id: 'menu',
      step: 'greet',
      emotion: 'happy',
      say: [say(L('よかった！|焼きそば、|たこ焼き、|かき氷、|りんご飴|が|あります。|何|に|します|か？', 'Great! There is yakisoba, takoyaki, shaved ice and candy apples. What will you have?', 'رائع! لدينا ياكيسوبا وتاكوياكي وكاكيغوري وتفاح بالسكر. ماذا تأخذ؟'))],
      suggestions: [FOOD_S.yakisoba, FOOD_S.kakigori, RECO_S],
      intents: [orderFood(), stallReco, later(), { id: 'again', any: ['もういちど'], next: 'menu' }],
    }),
    node({
      id: 'reco',
      emotion: 'excited',
      say: [say(L('たこ焼き|が|おすすめ|です|よ。|熱い|です|けど、|おいしい|です。', 'I recommend the takoyaki. They are hot, but delicious.', 'أنصحك بالتاكوياكي. ساخنة لكنها لذيذة.'))],
      suggestions: [FOOD_S.takoyaki, FOOD_S.yakisoba, REPEAT_S],
      intents: [orderFood(), later(), { id: 'again', any: ['もういちど'], next: 'reco' }],
    }),
    // the price, cash only
    node({
      id: 'quote',
      step: 'order',
      say: stallQuote(
        L('{yatai}|です|ね。|{total}|です。|屋台|は|現金|だけ|です|よ。', 'The {yatai}, coming up. That is {total}. The stalls take cash only.', '{yatai}، حسنًا. المبلغ {total}. البسطات تقبل النقد فقط.'),
        (ja, en, ar) =>
          L(`{yatai}|です|ね。|${ja}|です。|屋台|は|現金|だけ|です|よ。`, `The {yatai}, coming up. That is ${en}. The stalls take cash only.`, `{yatai}، حسنًا. المبلغ ${ar}. البسطات تقبل النقد فقط.`),
      ),
      suggestions: [S('はい、|どうぞ。', 'Here you go.', 'تفضّل.'), CASH_S, S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.')],
      intents: [
        { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'served' },
        { id: 'pay_card', slot: 'payMethod', slotOptions: ['card', 'ic'], slotRequired: true, stay: true, reply: CASH_ONLY_LINE },
        { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['かーど', 'カード', 'ic'], next: 'served' },
        { id: 'ask_price', any: ['いくら', 'ねだん'], next: 'quote' },
        { ...orderFood(), id: 'change_food' },
        later(),
      ],
    }),
    // paid (the one charge), the food is handed over
    node({
      id: 'served',
      step: 'pay',
      emotion: 'happy',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('はい、|どうぞ！|熱い|から|気をつけて|ね。', 'Here you go! It is hot, so be careful.', 'تفضّل! إنها ساخنة، فانتبه.'))],
      suggestions: [S('いただきます！', "Let's eat!", 'بسم الله!'), S('ありがとうございます！', 'Thank you!', 'شكرًا!'), S('おいしそう|です！', 'It looks delicious!', 'تبدو لذيذة!')],
      intents: [{ id: 'thanks', any: ['ありがとう', 'いただきます', 'おいしそう', 'おいしい', '美味しい', 'すごい'], next: 'bye', step: 'thanks', ideal: L('ありがとうございます！', 'Thank you!', 'شكرًا!') }],
    }),
    node({
      id: 'bye',
      end: true,
      step: 'thanks',
      emotion: 'excited',
      say: [say(L('楽しんで|ください|ね！|ラーメン|の|屋台|も|よろしく！', 'Enjoy the festival! And remember my ramen stall!', 'استمتع بالمهرجان! ولا تنسَ بسطة الرامن!'))],
      intents: [],
    }),
    // too little cash is a scripted branch, never an error (§4.4 rule 6): nothing was charged
    node({
      id: 'short',
      say: [say(SOLD_OUT_LINE, { flag: 'sold_out' }), say(SHORT_LINE)],
      suggestions: [LATER_S, THINK_S, REPEAT_S],
      intents: [later()],
    }),
    node({ id: 'leave', end: true, say: [say(L('わかりました。|また|どうぞ。|楽しんで|ください|ね。', 'All right. Come again. Enjoy the festival.', 'حسنًا. تعال مرة أخرى. استمتع بالمهرجان.'))], intents: [] }),
  ]),
};

// ------------------------------------------------------------------------------------------------------------------------------------
// matsuri_speech (Chapter 7, c7_3), the CAPSTONE: the learner's self-introduction on the festival stage, in front of everyone. Five prompted
// slots assembled in order (name, country, hobby, what they like about Sakura-chō, thanks) into the target speech of §7.2:
//   「はじめまして。{name}です。{country}から来ました。{hobby}が好きです。桜町はとてもいい町です。ありがとうございました。」
// Hanako is the MC and gives one short cue before each slot. It is played in Real mode (chips hidden; `ScenarioMeta.capstone`): a Hint or a
// translation is shown text and does not count toward `minIndependent` (5, easier 3). The chips below exist for the one-time Guided fallback
// (`guidedFallbackOpen` in @lw/game) and for the rehearsal; the Prepare screen's five-line rehearsal is `speechRehearsal` (`game/festival.ts`).
// ------------------------------------------------------------------------------------------------------------------------------------

/** The name slot: the player's name said with です / と申します / といいます (the katakana name of the Chapter 1 beat is `{name}`). */
const speechName: IntentDef = {
  id: 'say_name',
  any: ['です', 'もうします', '申します', 'といいます', 'わたしは', 'ぼくは', 'なまえは', '名前は'],
  capture: 'name',
  next: 'country',
  step: 'name',
  ideal: L('はじめまして。|{name}|です。', "Nice to meet you. I'm {name}.", 'تشرفنا. أنا {name}.'),
};
const speechHello: IntentDef = { id: 'hello_only', any: ['はじめまして', 'こんばんは', 'こんにちは'], none: ['です', 'もうします', '申します', 'といいます'], stay: true, reply: L('お名前|は？', 'Your name?', 'اسمك؟') };
const SPEECH_TOWN_KEYS = ['いいまち', 'いい町', 'すき', '好き', 'たのしい', '楽しい', 'きれい', 'やさしい', 'すばらしい', 'だいすき', '大好き', 'いいです', 'とても'];

export const MATSURI_SPEECH: Scenario = {
  id: 'matsuri_speech',
  locationId: 'park',
  characterId: 'hanako',
  level: 'A2',
  title: { en: 'Your speech at the festival', ar: 'كلمتك في المهرجان' },
  setup: {
    en: 'Everyone has come to the festival stage. Introduce yourself in five lines: your name, your country, your hobby, what you like about Sakura-chō, and thanks. Hanako gives a short cue before each line.',
    ar: 'جاء الجميع إلى منصة المهرجان. عرّف بنفسك في خمس جمل: اسمك وبلدك وهوايتك وما تحبه في ساكورا-تشو والشكر. تعطيك هاناكو تلميحًا قصيرًا قبل كل جملة.',
  },
  minutes: 3,
  steps: [
    { id: 'name', text: { en: 'Say your name', ar: 'قل اسمك' } },
    { id: 'country', text: { en: 'Say where you are from', ar: 'قل من أين أنت' } },
    { id: 'hobby', text: { en: 'Say your hobby', ar: 'قل هوايتك' } },
    { id: 'town', text: { en: 'Say what you like about Sakura-chō', ar: 'قل ما تحبه في ساكورا-تشو' } },
    { id: 'thanks', text: { en: 'Thank everyone', ar: 'اشكر الجميع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('皆さん、|こんばんは！|では、|自己紹介|を|どうぞ。', 'Good evening, everyone! Now, your self-introduction, please.', 'مساء الخير جميعًا! والآن، عرّف بنفسك من فضلك.'))],
      suggestions: [S('はじめまして。|{name}|です。', "Nice to meet you. I'm {name}.", 'تشرفنا. أنا {name}.'), S('はじめまして。|わたし|は|{name}|です。', "Nice to meet you. I'm {name}.", 'تشرفنا. أنا {name}.'), S('{name}|と|申します。', 'My name is {name}.', 'اسمي {name}.')],
      intents: [speechName, speechHello],
    }),
    node({
      id: 'country',
      step: 'name',
      emotion: 'happy',
      say: [say(L('いい|です|ね。|次|は、|国|です。', 'Good. Next, your country.', 'جيد. التالي، بلدك.'))],
      suggestionsByL1: {
        en: [S('アメリカ|から|来ました。', 'I came from the United States.', 'جئت من الولايات المتحدة.'), S('イギリス|から|来ました。', 'I came from the United Kingdom.', 'جئت من المملكة المتحدة.'), REPEAT_S],
        ar: [S('エジプト|から|来ました。', 'I came from Egypt.', 'جئت من مصر.'), S('サウジアラビア|から|来ました。', 'I came from Saudi Arabia.', 'جئت من السعودية.'), S('ヨルダン|から|来ました。', 'I came from Jordan.', 'جئت من الأردن.')],
      },
      intents: [
        { id: 'from_country', slot: 'country', capture: 'country', slotRequired: true, next: 'hobby', step: 'country', ideal: L('{country}|から|来ました。', 'I came from {country}.', 'جئت من {country}.') },
        { id: 'again', any: ['もういちど'], next: 'country' },
      ],
    }),
    node({
      id: 'hobby',
      step: 'country',
      emotion: 'happy',
      say: [say(L('次|は、|趣味|です。', 'Next, your hobby.', 'التالي، هوايتك.'))],
      topicSuggestions: true,
      suggestions: [S('音楽|が|好き|です。', 'I like music.', 'أحب الموسيقى.'), S('アニメ|が|好き|です。', 'I like anime.', 'أحب الأنمي.'), S('写真|が|好き|です。', 'I like photography.', 'أحب التصوير.')],
      intents: [
        { id: 'hobby', slot: 'hobby', slotRequired: true, next: 'town', step: 'hobby', ideal: L('{hobby}|が|好き|です。', 'I like {hobby}.', 'أحب {hobby}.') },
        // the learner's own hobby when it is not one of the listed ones (サッカー, ダンス, 読書...): the speech is theirs (review: it stayed on
        // 「もう一度お願いします」 for ever in Real mode)
        { id: 'hobby_own', any: ['がすき', 'がだいすき', 'しゅみは'], none: ['さくらちょう', 'もういちど'], next: 'town', step: 'hobby' },
        { id: 'again', any: ['もういちど'], next: 'hobby' },
      ],
    }),
    node({
      id: 'town',
      step: 'hobby',
      say: [say(L('桜町|は|どう|です|か？', 'How do you find Sakura-chō?', 'ما رأيك في ساكورا-تشو؟'))],
      suggestions: [S('桜町|は|とても|いい|町|です。', 'Sakura-chō is a very nice town.', 'ساكورا-تشو مدينة جميلة جدًا.'), S('桜町|が|大好き|です。', 'I love Sakura-chō.', 'أحب ساكورا-تشو كثيرًا.'), S('桜町|は|とても|楽しい|です。', 'Sakura-chō is a lot of fun.', 'ساكورا-تشو ممتعة جدًا.')],
      intents: [
        { id: 'like_town', any: SPEECH_TOWN_KEYS, next: 'thanks', step: 'town', ideal: L('桜町|は|とても|いい|町|です。', 'Sakura-chō is a very nice town.', 'ساكورا-تشو مدينة جميلة جدًا.') },
        { id: 'again', any: ['もういちど'], next: 'town' },
      ],
    }),
    node({
      id: 'thanks',
      step: 'town',
      emotion: 'happy',
      say: [say(L('最後|に、|一言|どうぞ。', 'Finally, a last word, please.', 'وأخيرًا، كلمة أخيرة من فضلك.'))],
      suggestions: [S('ありがとうございました。', 'Thank you very much.', 'شكرًا جزيلًا.'), S('皆さん、|ありがとうございました。', 'Thank you, everyone.', 'شكرًا لكم جميعًا.'), S('どうぞ|よろしく|お願いします。', 'I look forward to knowing you.', 'يسعدني التعرّف عليكم.')],
      intents: [{ id: 'thank_all', any: ['ありがとう', 'よろしく'], next: 'applause', step: 'thanks', ideal: L('ありがとうございました。', 'Thank you very much.', 'شكرًا جزيلًا.') }],
    }),
    node({
      id: 'applause',
      end: true,
      step: 'thanks',
      emotion: 'excited',
      say: [say(L('すばらしい！|皆さん、|拍手|を|お願いします！', 'Wonderful! Everyone, a round of applause, please!', 'رائع! صفّقوا جميعًا من فضلكم!'))],
      intents: [],
    }),
  ]),
};

/** Scenarios for chapter story scenes: trip_hikarigaoka (Release 2 wave C1); matsuri_stalls and matsuri_speech (wave C2). */
export const STORY_SCENARIOS: Scenario[] = [TRIP_HIKARIGAOKA, MATSURI_STALLS, MATSURI_SPEECH];
