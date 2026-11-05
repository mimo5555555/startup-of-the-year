import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// ほしぞらホビー (Hoshizora Hobby), the figure shop at the east end of the street: Daichi is a cheerful young collector behind the counter. The
// figures are an original line made for the game: ねこ忍者 (Cat Ninja) in red, blue and white, ロボット in a big and a small size, and the
// limited きつね侍 (Fox Samurai). The Japanese to learn: asking by look (「赤いのをください」 the red one, 「小さい方」 the smaller one), comparing
// (どちらが人気ですか), 限定 and 残り一つ, and gift wrapping (プレゼント用, ラッピング). Prices through Vars from the game's hooks ({total});
// without hooks the fixed-price variants (HOBBY_PRICES, equal to the item catalog) keep the scenario playable on its own.

/** Fixed prices (yen, tax included) of the no-hooks fallback variants; they equal the catalog rows (checked in the tests). */
export const HOBBY_PRICES: Record<string, number> = {
  nekoRed: 1800,
  nekoBlue: 1800,
  nekoWhite: 1800,
  roboBig: 3600,
  roboSmall: 1200,
  kitsune: 4800,
  figCase: 3500,
};

const KANJI_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** A price as the `|`-separated pieces of a Japanese line: 3600 -> 三|千|六|百|円 (a leading 1 before 千 and 百 is not said). */
const yenPieces = (yen: number): string => {
  const parts: string[] = [];
  const place = (n: number, unit: string) => {
    if (!n) return;
    if (n !== 1) parts.push(KANJI_DIGITS[n]!);
    parts.push(unit);
  };
  place(Math.floor(yen / 1000) % 10, '千');
  place(Math.floor(yen / 100) % 10, '百');
  parts.push('円');
  return parts.join('|');
};
const yenEn = (yen: number) => `${yen.toLocaleString('en-US')} yen`;
const yenAr = (yen: number) => `${yen.toLocaleString('en-US')} ين`;

/** The quote: the live line (the hooks set `flags.priced`), one fixed line per figure, and a line with no price at all. */
const quoteLines = (live: Line, build: (yenJa: string, yenEn: string, yenAr: string) => Line, fallback: Line): SayVariant[] => [
  say(live, { flag: 'priced' }),
  ...Object.keys(HOBBY_PRICES).map((id) => say(build(yenPieces(HOBBY_PRICES[id]!), yenEn(HOBBY_PRICES[id]!), yenAr(HOBBY_PRICES[id]!)), { slot: 'figure', in: [id] })),
  say(fallback),
];

const NEKO = ['nekoRed', 'nekoBlue', 'nekoWhite'];
const ROBO = ['roboBig', 'roboSmall'];
const FIGURES = [...NEKO, ...ROBO, 'kitsune'];

const CARD_S = S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.');
const CASH_S = S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.');
const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const JUST_LOOKING_S = S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.');

const LEAVE_LINE = L('はい！|また|来て|ください|ね。', 'Okay! Please come again.', 'حسنًا! تعال مرة أخرى.');
const SHORT_LINE = L('すみません、|少し|足りません。', 'Sorry, that is a little short.', 'آسف، المبلغ ناقص قليلًا.');
const SOLD_OUT_LINE = L('すみません、|それ|は|品切れ|です。', 'Sorry, that one is sold out.', 'آسف، هذا نفد.');
const NOT_YET_LINE = L('すみません、|それ|は|まだ|入荷|して|いません。', 'Sorry, that one has not come in yet.', 'آسف، هذا لم يصل بعد.');

const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });
const justLooking: IntentDef = { id: 'just_looking', any: ['みているだけ', '見ているだけ'], stay: true, reply: L('ごゆっくり|どうぞ！', 'Take your time!', 'خذ وقتك!') };
const askReco: IntentDef = { id: 'ask_reco', any: ['おすすめ', 'にんき', '人気'], next: 'reco' };
const showNeko: IntentDef = { id: 'show_neko', any: ['ねこ', 'にんじゃ', '忍者', 'neko'], next: 'neko' };
const showRobo: IntentDef = { id: 'show_robo', any: ['ろぼっと', 'ロボ', 'ろぼ'], next: 'robo' };
const askLimited: IntentDef = { id: 'ask_limited', any: ['げんてい', '限定', 'きつね', 'さむらい', '侍'], next: 'limited' };
/** the display case (furniture for the room): no wrapping question, straight to the price */
const pickCase: IntentDef = {
  id: 'pick_case',
  slot: 'figure',
  slotOptions: ['figCase'],
  slotRequired: true,
  next: 'quote',
  step: 'choose',
  request: true,
  ideal: L('フィギュアケース|を|ください。', 'The display case, please.', 'خزانة العرض من فضلك.'),
  econ: 'in_stock',
  nextIfNo: 'not_yet',
};
const askCase: IntentDef = { id: 'ask_case', any: ['けーす', 'ケース', 'かざる', '飾る', 'へや', '部屋'], next: 'case' };
const payIntents = (next: string): IntentDef[] => [
  { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next },
  { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next },
  { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ'], next },
];

/**
 * Asking for a figure (by its look or its name), wherever the learner is: the sale goes on to the wrapping question. `only` keeps a node to
 * the figures it shows (a colour in the cat ninja node, a size in the robot node). A figure that cannot be sold yet goes to `not_yet`.
 */
const pickFigure = (only: string[] = FIGURES): IntentDef => ({
  id: 'pick_figure',
  slot: 'figure',
  slotOptions: only,
  slotRequired: true,
  next: 'wrap',
  step: 'choose',
  request: true,
  ideal: L('{figure}|を|ください。', '{figure}, please.', '{figure} من فضلك.'),
  econ: 'in_stock',
  nextIfNo: 'not_yet',
});

export const HOBBY_FIGURES: Scenario = {
  id: 'hobby_figures',
  locationId: 'hobby',
  characterId: 'daichi',
  level: 'A1',
  title: { en: 'Buy a figure', ar: 'اشترِ مجسّمًا' },
  setup: {
    en: 'You are at Hoshizora Hobby, the figure shop. Ask what they have, choose a figure by its colour or its size, say whether it is a present, and pay.',
    ar: 'أنت في هوشيزورا هوبي، متجر المجسّمات. اسأل عمّا لديهم، واختر مجسّمًا بلونه أو حجمه، وقل إن كان هدية، ثم ادفع.',
  },
  minutes: 4,
  steps: [
    { id: 'look', text: { en: 'Ask what they have', ar: 'اسأل عمّا لديهم' } },
    { id: 'choose', text: { en: 'Choose a figure by its colour or size', ar: 'اختر مجسّمًا بلونه أو حجمه' } },
    { id: 'wrap', text: { en: 'Say if it is a present', ar: 'قل إن كان هدية' } },
    { id: 'pay', text: { en: 'Pay and say thanks', ar: 'ادفع واشكر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ！|ほしぞらホビー|へ|ようこそ。|フィギュア、|好き|です|か？', 'Welcome! Welcome to Hoshizora Hobby. Do you like figures?', 'أهلًا بك! مرحبًا في هوشيزورا هوبي. هل تحب المجسّمات؟'))],
      suggestions: [
        S('はい、|大好き|です！', 'Yes, I love them!', 'نعم، أحبها كثيرًا!'),
        S('フィギュア|を|探しています。', 'I am looking for a figure.', 'أبحث عن مجسّم.'),
        S('おすすめ|は|何|です|か？', 'What do you recommend?', 'ماذا تنصح؟'),
        JUST_LOOKING_S,
      ],
      intents: [
        { id: 'like', any: ['すき', 'だいすき', '好き', '大好き'], next: 'series', step: 'look' },
        { id: 'looking', any: ['さがして', 'ふぃぎゅあ', 'フィギュア', 'ありますか', 'なにが'], next: 'series', step: 'look' },
        askReco,
        showNeko,
        showRobo,
        askLimited,
        pickCase,
        pickFigure(),
        askCase,
        justLooking,
        { id: 'hello', any: ['こんにちは', 'すみません'], stay: true, reply: L('こんにちは！|フィギュア|を|お探し|です|か？', 'Hello! Are you looking for a figure?', 'مرحبًا! هل تبحث عن مجسّم؟') },
        later(),
      ],
    }),
    // the shelves: the two series and the limited figure, read aloud
    node({
      id: 'series',
      step: 'look',
      say: [say(L('今、|ねこ忍者|シリーズ|と|ロボット|シリーズ|が|あります。|限定|の|きつね侍|も|あります|よ！|部屋|に|飾る|フィギュアケース|も|あります。', 'Right now we have the Cat Ninja series and the Robot series. There is also the limited Fox Samurai! And a display case to show them in your room.', 'لدينا الآن سلسلة القط النينجا وسلسلة الروبوت. ولدينا أيضًا الثعلب الساموراي المحدود! وخزانة عرض لعرضها في غرفتك.'))],
      suggestions: [
        S('ねこ忍者|を|見せて|ください。', 'Please show me the Cat Ninjas.', 'أرني القطط النينجا من فضلك.'),
        S('ロボット|を|見せて|ください。', 'Please show me the robots.', 'أرني الروبوتات من فضلك.'),
        S('フィギュアケース|を|ください。', 'The display case, please.', 'خزانة العرض من فضلك.'),
        S('限定|の|は|何|です|か？', 'What is the limited one?', 'ما الإصدار المحدود؟'),
      ],
      intents: [pickCase, showNeko, showRobo, askLimited, askReco, pickFigure(), askCase, justLooking, later()],
    }),
    // the cat ninjas: three colours (teaches 赤い / 青い / 白い and 「〜のをください」)
    node({
      id: 'neko',
      say: [say(L('ねこ忍者|は|赤、|青、|白|の|三|種類|です。|一つ|千|八|百|円|です。|何色|が|いい|です|か？', 'The Cat Ninjas come in three kinds: red, blue and white. They are 1,800 yen each. Which colour would you like?', 'القطط النينجا ثلاثة أنواع: أحمر وأزرق وأبيض. سعر الواحد 1,800 ين. أي لون تريد؟'))],
      suggestions: [
        S('赤い|の|を|ください。', 'The red one, please.', 'الأحمر من فضلك.'),
        S('青い|の|を|ください。', 'The blue one, please.', 'الأزرق من فضلك.'),
        S('白い|の|は|かわいい|です|ね。', 'The white one is cute.', 'الأبيض لطيف.'),
        S('ロボット|は|あります|か？', 'Do you have robots?', 'هل لديكم روبوتات؟'),
      ],
      // a compliment first: 「白いのはかわいいですね」 names a colour but is not a request
      intents: [
        { id: 'cute', any: ['かわいい', 'かっこいい'], stay: true, reply: L('そう|でしょう！|白い|の|が|一番|人気|です。', 'Right? The white one is the most popular.', 'أليس كذلك؟ الأبيض هو الأكثر رواجًا.') },
        pickFigure(NEKO),
        showRobo,
        askLimited,
        later(),
      ],
    }),
    // the robots: two sizes, two prices (teaches 大きい方 / 小さい方 and comparing)
    node({
      id: 'robo',
      say: [say(L('ロボット|は|大きい|の|と|小さい|の|が|あります。|大きい|方|は|三|千|六|百|円、|小さい|方|は|千|二|百|円|です。', 'The robots come big and small. The big one is 3,600 yen and the small one is 1,200 yen.', 'الروبوتات كبيرة وصغيرة. الكبير بـ 3,600 ين والصغير بـ 1,200 ين.'))],
      suggestions: [
        S('大きい|の|を|ください。', 'The big one, please.', 'الكبير من فضلك.'),
        S('小さい|の|を|ください。', 'The small one, please.', 'الصغير من فضلك.'),
        S('どちら|が|人気|です|か？', 'Which one is more popular?', 'أيّهما أكثر رواجًا؟'),
        S('ねこ忍者|は|あります|か？', 'Do you have Cat Ninjas?', 'هل لديكم قطط نينجا؟'),
      ],
      intents: [
        { id: 'which_popular', any: ['どちら', 'どっち', 'にんき', '人気'], stay: true, reply: L('大きい|方|が|大人気|です。|でも、|小さい|方|も|かわいい|です|よ。', 'The big one is very popular. But the small one is cute too.', 'الكبير رائج جدًا. لكن الصغير لطيف أيضًا.') },
        pickFigure(ROBO),
        showNeko,
        askLimited,
        later(),
      ],
    }),
    // the limited fox samurai: 限定, 残り一つ
    node({
      id: 'limited',
      emotion: 'happy',
      say: [say(L('きつね侍|は|限定|の|フィギュア|です。|残り|一つ|です！|四|千|八|百|円|です。', 'The Fox Samurai is a limited figure. There is only one left! It is 4,800 yen.', 'الثعلب الساموراي مجسّم محدود. بقيت قطعة واحدة! سعره 4,800 ين.'))],
      suggestions: [S('きつね侍|を|ください。', 'The Fox Samurai, please.', 'الثعلب الساموراي من فضلك.'), S('かっこいい|です|ね！', 'It is cool!', 'إنه رائع!'), THINK_S],
      intents: [
        { id: 'cool', any: ['かっこいい', 'すごい'], stay: true, reply: L('でしょう！|箱|も|かっこいい|です|よ。', 'Right? The box is cool too.', 'أليس كذلك؟ العلبة رائعة أيضًا.') },
        pickFigure(['kitsune']),
        showNeko,
        showRobo,
        later(),
      ],
    }),
    // the display case for the room: what it holds, the price
    node({
      id: 'case',
      say: [say(L('フィギュアケース|は|三|千|五|百|円|です。|部屋|の|棚|に|置けます|よ。|集めた|フィギュア|を|飾れます！', 'The display case is 3,500 yen. It goes on the shelf spot in your room. You can display the figures you collected!', 'خزانة العرض بـ 3,500 ين. توضع مكان الرف في غرفتك. يمكنك عرض المجسّمات التي جمعتها!'))],
      suggestions: [S('フィギュアケース|を|ください。', 'The display case, please.', 'خزانة العرض من فضلك.'), S('ねこ忍者|を|見せて|ください。', 'Please show me the Cat Ninjas.', 'أرني القطط النينجا من فضلك.'), THINK_S],
      intents: [pickCase, showNeko, showRobo, later()],
    }),
    // a recommendation: the newest cat ninja, arrived yesterday
    node({
      id: 'reco',
      say: [say(L('おすすめ|は|新作|の|ねこ忍者|です。|昨日|届きました！|赤、|青、|白|が|あります。', 'I recommend the new Cat Ninjas. They arrived yesterday! We have red, blue and white.', 'أنصح بالقطط النينجا الجديدة. وصلت أمس! لدينا أحمر وأزرق وأبيض.'))],
      suggestions: [S('赤い|の|を|ください。', 'The red one, please.', 'الأحمر من فضلك.'), S('白い|の|を|ください。', 'The white one, please.', 'الأبيض من فضلك.'), S('ロボット|は|あります|か？', 'Do you have robots?', 'هل لديكم روبوتات؟'), REPEAT_S],
      intents: [pickFigure(NEKO), showRobo, askLimited, later()],
    }),
    // a figure that cannot be sold yet (a later chapter): Daichi says so
    node({
      id: 'not_yet',
      say: [say(NOT_YET_LINE)],
      suggestions: [S('ねこ忍者|を|見せて|ください。', 'Please show me the Cat Ninjas.', 'أرني القطط النينجا من فضلك.'), S('ロボット|を|見せて|ください。', 'Please show me the robots.', 'أرني الروبوتات من فضلك.'), LATER_S],
      intents: [showNeko, showRobo, pickFigure(), later()],
    }),
    // the present question: プレゼント用 / ラッピング (wrapping is free, as in most Japanese shops)
    node({
      id: 'wrap',
      step: 'choose',
      say: [say(L('{figure}|です|ね！|プレゼント用|です|か？|ラッピング|も|できます|よ。', 'The {figure}! Is it a present? We can gift-wrap it too.', '{figure}! هل هو هدية؟ يمكننا تغليفه أيضًا.'))],
      suggestions: [
        S('はい、|プレゼント用|です。', 'Yes, it is a present.', 'نعم، إنه هدية.'),
        S('ラッピング|を|お願いします。', 'Gift wrapping, please.', 'التغليف من فضلك.'),
        S('いいえ、|大丈夫|です。', 'No, that is fine.', 'لا، لا بأس.'),
      ],
      intents: [
        { id: 'wrap_yes', any: ['ぷれぜんとよう', 'プレゼント用', 'らっぴんぐ', 'ラッピング', 'つつんで', '包んで', 'はい'], none: ['いいえ'], next: 'quote_wrap', step: 'wrap', request: true, ideal: L('ラッピング|を|お願いします。', 'Gift wrapping, please.', 'التغليف من فضلك.') },
        { id: 'wrap_no', any: ['いいえ', 'だいじょうぶ', '大丈夫', 'けっこう', 'いらない'], next: 'quote', step: 'wrap' },
        later(),
      ],
    }),
    // the price and the way to pay (unwrapped)
    node({
      id: 'quote',
      say: quoteLines(
        L('{figure}|は|全部|で|{total}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'The {figure} is {total} in total, tax included. Cash or card?', '{figure} المجموع {total} شاملًا الضريبة. نقدًا أم بالبطاقة؟'),
        (ja, en, ar) => L(`{figure}|は|全部|で|${ja}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？`, `The {figure} is ${en} in total, tax included. Cash or card?`, `{figure} المجموع ${ar} شاملًا الضريبة. نقدًا أم بالبطاقة؟`),
        L('{figure}|です|ね。|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'The {figure}. Tax is included. Cash or card?', '{figure}. الضريبة شاملة. نقدًا أم بالبطاقة؟'),
      ),
      suggestions: [CARD_S, CASH_S, THINK_S],
      intents: [...payIntents('done'), later()],
    }),
    // the price and the way to pay (wrapped: かしこまりました, then the same question)
    node({
      id: 'quote_wrap',
      emotion: 'happy',
      say: quoteLines(
        L('かしこまりました。|包みます|ね。|全部|で|{total}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'Certainly. I will wrap it. That is {total} in total, tax included. Cash or card?', 'بكل سرور. سأغلّفه. المجموع {total} شاملًا الضريبة. نقدًا أم بالبطاقة؟'),
        (ja, en, ar) => L(`かしこまりました。|包みます|ね。|全部|で|${ja}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？`, `Certainly. I will wrap it. That is ${en} in total, tax included. Cash or card?`, `بكل سرور. سأغلّفه. المجموع ${ar} شاملًا الضريبة. نقدًا أم بالبطاقة؟`),
        L('かしこまりました。|包みます|ね。|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'Certainly. I will wrap it. Tax is included. Cash or card?', 'بكل سرور. سأغلّفه. الضريبة شاملة. نقدًا أم بالبطاقة؟'),
      ),
      suggestions: [CARD_S, CASH_S, THINK_S],
      intents: [...payIntents('done'), later()],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('ありがとうございました！|また|来て|ください|ね。', 'Thank you very much! Please come again.', 'شكرًا جزيلًا! تعال مرة أخرى.'))],
      intents: [],
    }),
    // too little money is a scripted branch, never an error
    node({
      id: 'short',
      say: [say(SOLD_OUT_LINE, { flag: 'sold_out' }), say(SHORT_LINE)],
      suggestions: [LATER_S, S('小さい|の|は|あります|か？', 'Do you have a small one?', 'هل لديكم واحد صغير؟'), THINK_S],
      intents: [later(), { id: 'cheaper', any: ['ちいさい', '小さい', 'やすい', '安い'], next: 'robo' }],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

export const HOBBY_SCENARIOS: Scenario[] = [HOBBY_FIGURES];
