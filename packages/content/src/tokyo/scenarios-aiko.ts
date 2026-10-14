import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';
import { yenToJa } from './game/jp-language';

// Ono Tea House 小野茶房, the street stall (docs/GAME_DESIGN.md §6.3 `aiko_tea`, §5.3, §5.6): Aiko is soft, slow and polite. The steps are
// greet, pick (the present, slot `giftItem`: flower, wagashi, teaSet, tenugui), who (誰にあげますか: a friend by name, or oneself; she
// recommends from that friend's tastes), wrap (the ribbon colour, slot `wrapColour`; wrapping is free) and pay.
// Prices only through Vars ({total}), supplied by the game's hooks; without hooks the fixed-price fallback variants (one per present, from
// AIKO_PRICES) keep the scenario playable on its own, as at the other shops. The lantern fund (svc_lantern) is NOT here: a donation that
// charges and does nothing else needs a service sink the game does not have yet (see the report).
// The flat (aiko_viewing, aiko_contract) is not in this wave.

/** Fixed prices (yen, tax included) of the no-hooks fallback variants; they equal the catalog rows of §5.3 (checked in the tests). */
export const AIKO_PRICES: Record<string, number> = { flower: 1500, wagashi: 1280, teaSet: 1500, tenugui: 1100 };

/** What each friend is recommended: a present that friend LOVES (the tests check this against the taste table). */
export const AIKO_RECOMMENDS: Record<string, string> = { mio: 'wagashi', yuki: 'teaSet', tanaka: 'wagashi', sato: 'teaSet', kenji: 'tenugui', hanako: 'flower' };

const PRESENT = {
  flower: { ja: 'お花', en: 'the bouquet', ar: 'باقة الزهور' },
  wagashi: { ja: '和菓子', en: 'the wagashi', ar: 'الواغاشي' },
  teaSet: { ja: 'お茶セット', en: 'the tea set', ar: 'طقم الشاي' },
  tenugui: { ja: '手ぬぐい', en: 'the tenugui', ar: 'منشفة التينوغوي' },
} as const;
const FRIEND_NAME = {
  mio: { ja: 'ミオ', en: 'Mio', ar: 'ميو' },
  yuki: { ja: 'ゆき', en: 'Yuki', ar: 'يوكي' },
  tanaka: { ja: '田中', en: 'Tanaka', ar: 'تاناكا' },
  sato: { ja: '佐藤', en: 'Sato', ar: 'ساتو' },
  kenji: { ja: 'けんじ', en: 'Kenji', ar: 'كينجي' },
  hanako: { ja: '花子', en: 'Hanako', ar: 'هاناكو' },
} as const;

const yenEn = (yen: number) => `${yen.toLocaleString('en-US')} yen`;
const yenAr = (yen: number) => `${yen.toLocaleString('en-US')} ين`;

/** The live price line (Vars from the hooks, when the app sets `flags.priced`) or, without game hooks, a fixed line so the scenario still runs on its own. */
const quoteVariants = (live: Line, build: (ja: string, en: string, ar: string) => Line, fallback: Line): SayVariant[] => [
  say(live, { flag: 'priced' }),
  ...Object.entries(AIKO_PRICES).map(([id, yen]) => say(build(yenToJa(yen).markup, yenEn(yen), yenAr(yen)), { slot: 'giftItem', in: [id] })),
  say(fallback),
];

/** 「ミオさんなら、和菓子がおすすめですよ。」: the recommendation for each friend, as the variants of a node (the last one, with no condition, is for the others). */
const recommendation = (fallback: Line): SayVariant[] => [
  ...Object.entries(AIKO_RECOMMENDS).map(([friend, item]) => {
    const n = FRIEND_NAME[friend as keyof typeof FRIEND_NAME];
    const p = PRESENT[item as keyof typeof PRESENT];
    const line = L(
      `${n.ja}|さん|なら、|${p.ja}|が|おすすめ|です|よ。|きっと|喜びます|よ。`,
      `For ${n.en}, I recommend ${p.en}. I am sure ${n.en} will be pleased.`,
      `أنصحك بـ${p.ar} لـ${n.ar}. أنا متأكدة أنه سيُسعده.`,
    );
    return say(line, { slot: 'giftFriend', in: [friend] });
  }),
  say(fallback),
];

const SHORT_LINE = L('あら、|ごめんなさい。|少し|足りません|ね。', 'Oh, I am sorry. It is a little short.', 'آه، آسفة. المبلغ ناقص قليلًا.');
const SOLD_OUT_LINE = L('ごめんなさい。|それ|は|品切れ|です。', 'I am sorry. That is sold out.', 'آسفة. هذا نفد.');
const OWNED_LINE = L('それ|は|もう|お持ち|です|よ。', 'You already have that one.', 'لديك هذا بالفعل.');
const LEAVE_LINE = L('はい。|また|ゆっくり|来て|ください|ね。', 'All right. Please come again and take your time.', 'حسنًا. تعال مجددًا وخذ وقتك.');
const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const CASH_S = S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.');
const JUST_LOOKING_S = S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.');
const KEEP_S = S('これ|で|お願いします。', 'This one, please.', 'هذا من فضلك.');

const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });
const askPrice: IntentDef = { id: 'ask_price', any: ['いくら', 'ねだん'], stay: true, reply: L('後で、|お値段|を|お知らせ|します|ね。', 'I will tell you the price in a moment.', 'سأخبرك بالسعر بعد قليل.') };
const justLooking: IntentDef = { id: 'just_looking', any: ['みているだけ', '見ているだけ'], stay: true, reply: L('ごゆっくり|どうぞ。', 'Please take your time.', 'خذ وقتك من فضلك.') };
const PICK_IDEAL = L('{giftItem}|を|ください。', '{giftItem}, please.', '{giftItem} من فضلك.');
/** The presents this stall sells: `giftItem` is shared with every shop's `goods` node, so naming the manga here must not start a sale that could never be charged. */
const PRESENTS = Object.keys(AIKO_PRICES);
const pickPresent = (next: string, step?: string): IntentDef => ({ id: 'pick_gift', slot: 'giftItem', slotOptions: PRESENTS, slotRequired: true, next, ...(step ? { step } : {}), request: true, ideal: PICK_IDEAL });
const SHELF_LINE = L('お花、|和菓子、|お茶セット、|手ぬぐい|が|あります|よ。', 'We have bouquets, wagashi, tea sets and tenugui.', 'لدينا باقات زهور وواغاشي وأطقم شاي ومناشف تينوغوي.');
const CHIPS_GIFT = [S('和菓子|を|ください。', 'Wagashi, please.', 'واغاشي من فضلك.'), S('お花|を|ください。', 'A bouquet, please.', 'باقة زهور من فضلك.'), S('手ぬぐい|を|ください。', 'A tenugui, please.', 'منشفة تينوغوي من فضلك.')];

export const AIKO_TEA: Scenario = {
  id: 'aiko_tea',
  locationId: 'ono',
  characterId: 'aiko',
  level: 'A1',
  title: { en: 'Gifts at the tea house', ar: 'هدايا في بيت الشاي' },
  setup: {
    en: "You are at Aiko's tea stall. Choose a present, say who it is for, pick a ribbon colour (wrapping is free), and pay.",
    ar: 'أنت عند كشك الشاي الخاص بأيكو. اختر هدية، وقل لمن هي، واختر لون الشريط (التغليف مجاني)، ثم ادفع.',
  },
  minutes: 4,
  steps: [
    { id: 'greet', text: { en: 'Greet Aiko', ar: 'حيِّ أيكو' } },
    { id: 'pick', text: { en: 'Choose a present', ar: 'اختر هدية' } },
    { id: 'who', text: { en: 'Say who it is for', ar: 'قل لمن هي' } },
    { id: 'wrap', text: { en: 'Choose a ribbon colour', ar: 'اختر لون الشريط' } },
    { id: 'pay', text: { en: 'Pay and say thanks', ar: 'ادفع واشكر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|ゆっくり|どうぞ。|プレゼント|です|か？', 'Welcome. Please take your time. Is it a present?', 'أهلًا بك. خذ وقتك. هل هي هدية؟'))],
      suggestions: [S('こんにちは。', 'Hello.', 'مرحبًا.'), S('プレゼント|を|探しています。', 'I am looking for a present.', 'أبحث عن هدية.'), CHIPS_GIFT[0], JUST_LOOKING_S],
      intents: [
        { id: 'greet', any: ['こんにちは', 'はじめまして', 'すみません'], next: 'browse', step: 'greet' },
        { id: 'want_present', any: ['ぷれぜんと', 'おくりもの', 'おすすめ', 'なにがあります'], next: 'browse', step: 'greet', request: true, ideal: L('プレゼント|を|探しています。', 'I am looking for a present.', 'أبحث عن هدية.') },
        // naming the present straight away: the greeting is taken as given
        pickPresent('who', 'greet'),
        justLooking,
        later(),
      ],
    }),
    // what the stall has
    node({
      id: 'browse',
      say: [say(SHELF_LINE)],
      suggestions: [...CHIPS_GIFT, REPEAT_S],
      intents: [pickPresent('who'), askPrice, justLooking, later()],
    }),
    // THE WHO STEP: 誰にあげますか
    node({
      id: 'who',
      step: 'pick',
      say: [say(L('{giftItem}|です|ね。|どなた|に|あげます|か？', 'The {giftItem}, I see. Who will you give it to?', '{giftItem}، حسنًا. لمن ستعطيها؟'))],
      suggestions: [S('ミオ|さん|に|あげます。', 'I will give it to Mio.', 'سأعطيها لميو.'), S('ゆき|さん|に|あげます。', 'I will give it to Yuki.', 'سأعطيها ليوكي.'), S('自分|に|買います。', 'I am buying it for myself.', 'أشتريها لنفسي.'), REPEAT_S],
      intents: [
        { id: 'name_friend', slot: 'giftFriend', slotOptions: Object.keys(AIKO_RECOMMENDS), slotRequired: true, next: 'advise', step: 'who', request: true, ideal: L('ミオ|さん|に|あげます。', 'I will give it to Mio.', 'سأعطيها لميو.') },
        { id: 'for_me', slot: 'giftFriend', slotOptions: ['me'], slotRequired: true, next: 'wrap', step: 'who' },
        askPrice,
        later(),
      ],
    }),
    // she recommends from the friend's tastes; the learner keeps the present or looks at the others
    node({
      id: 'advise',
      emotion: 'happy',
      say: recommendation(L('いい|です|ね。', 'That is nice.', 'جميل.')),
      suggestions: [KEEP_S, S('ほか|の|も|見たい|です。', 'I would like to see the others.', 'أريد أن أرى الباقي.'), THINK_S],
      intents: [
        { id: 'keep', any: ['これで', 'それで', 'はい', 'おねがい', 'いいです', 'このまま'], none: ['みたい', 'かんがえ'], next: 'wrap' },
        { id: 'see_others', any: ['ほかの', 'ほかも', 'みたい', 'べつの'], next: 'again' },
        pickPresent('wrap'),
        askPrice,
        later(),
      ],
    }),
    node({
      id: 'again',
      say: [say(SHELF_LINE)],
      suggestions: [...CHIPS_GIFT, REPEAT_S],
      intents: [pickPresent('wrap'), askPrice, justLooking, later()],
    }),
    // WRAPPING: free
    node({
      id: 'wrap',
      emotion: 'happy',
      say: [
        say(L('ごめんなさい。|リボン|は|あと|少し|です。|赤、|青、|白、|ピンク|が|あります。|ラッピング|は|無料|です|よ。', 'I am sorry, the ribbons are almost gone. We have red, blue, white and pink. The wrapping is free.', 'آسفة، الأشرطة تكاد تنفد. لدينا الأحمر والأزرق والأبيض والوردي. التغليف مجاني.'), { flag: 'twist' }),
        say(L('ラッピング|は|無料|です|よ。|リボン|の|色|は|どう|します|か？|赤、|青、|白、|ピンク|が|あります。', 'The wrapping is free. Which colour of ribbon? We have red, blue, white and pink.', 'التغليف مجاني. أي لون للشريط؟ لدينا الأحمر والأزرق والأبيض والوردي.')),
      ],
      suggestions: [S('赤|を|お願いします。', 'Red, please.', 'الأحمر من فضلك.'), S('ピンク|が|いい|です。', 'I would like pink.', 'أريد الوردي.'), S('ラッピング|は|いりません。', 'No wrapping, thank you.', 'بدون تغليف، شكرًا.'), REPEAT_S],
      intents: [
        { id: 'pick_ribbon', slot: 'wrapColour', slotRequired: true, next: 'quote', step: 'wrap', request: true, ideal: L('{wrapColour}|を|お願いします。', '{wrapColour}, please.', '{wrapColour} من فضلك.') },
        { id: 'no_wrap', any: ['いりません', 'いらない', 'けっこうです', 'なしで'], next: 'quote', step: 'wrap' },
        askPrice,
        later(),
      ],
    }),
    // the price and the way to pay (the stall takes cash)
    node({
      id: 'quote',
      say: quoteVariants(
        L('{giftItem}|です|ね。|全部|で|{total}、|税込|です。|現金|で|お願いします|ね。', 'The {giftItem}, I see. {total} in total, tax included. Cash, please.', '{giftItem}، حسنًا. المجموع {total} شاملًا الضريبة. نقدًا من فضلك.'),
        (ja, en, ar) => L(`{giftItem}|です|ね。|全部|で|${ja}、|税込|です。|現金|で|お願いします|ね。`, `The {giftItem}, I see. ${en} in total, tax included. Cash, please.`, `{giftItem}، حسنًا. المجموع ${ar} شاملًا الضريبة. نقدًا من فضلك.`),
        L('{giftItem}|です|ね。|税込|です。|現金|で|お願いします|ね。', 'The {giftItem}, I see. Tax is included. Cash, please.', '{giftItem}، حسنًا. الضريبة شاملة. نقدًا من فضلك.'),
      ),
      suggestions: [CASH_S, S('はい、|どうぞ。', 'Yes, here you are.', 'نعم، تفضّلي.'), THINK_S, S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.')],
      intents: [
        { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'done' },
        { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ', 'かーど'], next: 'done' },
        { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, stay: true, reply: L('すみません。|うち|は|現金|だけ|です。', 'I am sorry. We only take cash.', 'آسفة. نحن نقبل النقد فقط.') },
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
      say: [
        say(L('ありがとうございます。|ゆっくり|楽しんで|ください|ね。', 'Thank you. Please enjoy it at your leisure.', 'شكرًا لك. استمتع بها على مهلك.'), { slot: 'giftFriend', in: ['me'] }),
        say(L('ありがとうございます。|喜んで|くれる|と|いい|です|ね。', 'Thank you. I hope they will be pleased.', 'شكرًا لك. آمل أن تُسعدهم.')),
      ],
      intents: [],
    }),
    // too little money is a scripted branch, never an error (§4.4 rule 6); `short` is also where a refused sale ends (flags set by the game's `charge`)
    node({
      id: 'short',
      say: [say(OWNED_LINE, { flag: 'owned_already' }), say(SOLD_OUT_LINE, { flag: 'sold_out' }), say(SHORT_LINE)],
      suggestions: [LATER_S, S('安い|の|は|あります|か？', 'Do you have something cheaper?', 'هل لديكم شيء أرخص؟'), THINK_S],
      intents: [later(), { id: 'cheaper', any: ['やすいの', 'やすい'], next: 'again' }],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

/** Scenarios for Aiko's tea house: aiko_tea (aiko_viewing and aiko_contract, the flat, are not in this release). */
export const AIKO_SCENARIOS: Scenario[] = [AIKO_TEA];
