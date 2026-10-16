import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';
import { yenToJa } from './game/jp-language';

// Story scenes (docs/GAME_DESIGN.md §6.5 TripPanel, §7.2 Chapter 5). Release 2 wave C1 builds `trip_hikarigaoka`; the festival ones
// (matsuri_stalls, matsuri_speech) are wave C2.
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

/** Scenarios for chapter story scenes: trip_hikarigaoka (Release 2 wave C1); matsuri_stalls and matsuri_speech are wave C2. */
export const STORY_SCENARIOS: Scenario[] = [TRIP_HIKARIGAOKA];
