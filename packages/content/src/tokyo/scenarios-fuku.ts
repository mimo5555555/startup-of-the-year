import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// Fuku-Fuku, the clothes shop (docs/GAME_DESIGN.md §6.3, §6.2): Rin is polite staff (a quick, cheeky young clerk; her casual register at
// friendship is not in this release). Prices only through Vars ({price}, {total}), supplied by the game's hooks (the price of `clothes`,
// or of `giftItem`); without hooks the fixed-price fallback variants (one per item, from FUKU_PRICES) keep the scenario playable on its own.
// Slots: `clothes` (9 pieces), `size` (S/M/L), `clothesColour`, `fit`, `payMethod`, and the shared `giftItem` (plush, guitar pick).
//
// The fitting-room beat: the node `fitting` is the preview moment. While the session is at `fitting` the app may show the picked piece
// (slots `clothes`, `clothesColour`) on the avatar; the node is entered again after every `resize`. The purchased item appears on the
// avatar through the item catalog, not through this scenario.
//
// A line never names {clothesColour} or {size}: a piece with one colour (or a free size) never fills those slots, and a variable that
// was not filled would print as "…".

/** Fixed prices (yen, tax included) of the no-hooks fallback variants; they equal the catalog rows of §5.2 / §5.3 (checked in the tests). */
export const FUKU_PRICES: Record<string, number> = {
  tee: 1990,
  cap: 2490,
  hoodie: 4990,
  jeans: 5990,
  sneakers: 7990,
  jacket: 12900,
  glasses: 9900,
  backpack: 6900,
  suit: 19800,
  plush: 800,
  guitarPick: 300,
};

/** The pieces that come in one size for everyone (the size line says so) and the ones that come in several colours. */
const FREE_SIZE = ['cap', 'glasses', 'backpack'];
const COLOURFUL = ['tee', 'hoodie', 'sneakers'];

const KANJI_DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** A price as the `|`-separated pieces of a Japanese line: 12900 -> 一|万|二|千|九|百|円 (a leading 1 before 十, 百, 千 is not said). */
const yenPieces = (yen: number): string => {
  const parts: string[] = [];
  const place = (n: number, unit: string, bare: boolean) => {
    if (!n) return;
    if (!(bare && n === 1)) parts.push(KANJI_DIGITS[n]);
    parts.push(unit);
  };
  const man = Math.floor(yen / 10000);
  if (man) {
    parts.push(KANJI_DIGITS[man], '万');
  }
  place(Math.floor(yen / 1000) % 10, '千', true);
  place(Math.floor(yen / 100) % 10, '百', true);
  place(Math.floor(yen / 10) % 10, '十', true);
  const ones = yen % 10;
  if (ones) parts.push(KANJI_DIGITS[ones]);
  parts.push('円');
  return parts.join('|');
};
const yenEn = (yen: number) => `${yen.toLocaleString('en-US')} yen`;
const yenAr = (yen: number) => `${yen.toLocaleString('en-US')} ين`;

/** The live price line (Vars from the hooks, when the app sets `flags.priced`) or, without game hooks, a fixed line so the scenario still runs on its own. */
const priced = (live: Line, legacy: Line): SayVariant[] => [say(live, { flag: 'priced' }), say(legacy)];

/** A quote line with one fixed variant per item (`slot` is the slot that names it): `build` makes the line for a price. */
const quoteLines = (slot: string, ids: string[], live: Line, build: (yenJa: string, yenEn: string, yenAr: string) => Line, fallback: Line): SayVariant[] => [
  say(live, { flag: 'priced' }),
  ...ids.map((id) => say(build(yenPieces(FUKU_PRICES[id]), yenEn(FUKU_PRICES[id]), yenAr(FUKU_PRICES[id])), { slot, in: [id] })),
  say(fallback),
];

const BUY = ['ください', 'おねがい', 'にします', 'かいます', 'ほしい', 'これ'];

const SHORT_LINE = L('すみません、|少し|足りません。', 'I am sorry, it is a little short.', 'آسفة، المبلغ ناقص قليلًا.');
/** `short` is also where a refused sale ends: a piece the player already owns, or one that is not released yet (flags set by the game's `charge`) */
const SOLD_OUT_LINE = L('すみません、|それ|は|品切れ|です。', 'I am sorry, that is sold out.', 'آسفة، هذا نفد.');
const OWNED_LINE = L('それ|は|もう|お持ち|です|よ。', 'You already have that one.', 'لديك هذا بالفعل.');
const LEAVE_LINE = L('はい。|また|お待ち|して|おります。', 'All right. We look forward to seeing you again.', 'حسنًا. بانتظار زيارتك مجددًا.');
const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const CARD_S = S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.');
const CASH_S = S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.');
const JUST_LOOKING_S = S('見ている|だけ|です。', 'I am just looking.', 'أنا أتفرّج فقط.');
const YES_S = S('はい、|お願いします。', 'Yes, please.', 'نعم من فضلك.');
const sizeS = (jaSize: string, en: string, ar: string) => S(`${jaSize}|を|お願いします。`, `${en}, please.`, `${ar} من فضلك.`);

/** Taught polite refusal (`cc_refuse`): the way out of the shop that costs nothing. */
const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });
const payIntents = (next: string): IntentDef[] => [
  { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next },
  { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next },
  { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ'], next },
];
/** asking the price again hears the price line of the node again */
const askPrice = (again: string): IntentDef => ({ id: 'ask_price', any: ['いくら', 'ねだん'], next: again });

const CHOOSE_IDEAL = L('{clothes}|を|ください。', '{clothes}, please.', '{clothes} من فضلك.');
/** picking a piece by name, wherever the learner is: the sale goes on to the size */
const pickClothes = (): IntentDef => ({ id: 'choose_clothes', slot: 'clothes', slotRequired: true, next: 'size', step: 'look', request: true, ideal: CHOOSE_IDEAL });
const goodsIntent: IntentDef = { id: 'ask_goods', any: ['ぷれぜんと', 'ほかになにが'], next: 'goods' };
const justLooking: IntentDef = { id: 'just_looking', any: ['みているだけ', '見ているだけ'], stay: true, reply: L('ごゆっくり|どうぞ。', 'Please take your time.', 'خذ وقتك من فضلك.') };
const sizePick = (next: string): IntentDef => ({
  id: 'size_pick',
  slot: 'size',
  slotRequired: true,
  next,
  request: true,
  ideal: L('エムサイズ|を|お願いします。', 'Size M, please.', 'مقاس M من فضلك.'),
});

export const FUKU_CLOTHES: Scenario = {
  id: 'fuku_clothes',
  locationId: 'fukufuku',
  characterId: 'rin',
  level: 'A1',
  title: { en: 'Buy clothes', ar: 'اشترِ ملابس' },
  setup: {
    en: 'You are at Fuku-Fuku. Ask for a piece of clothing, choose a size and a colour, try it on, say how it fits, and pay.',
    ar: 'أنت في متجر فوكو فوكو. اطلب قطعة ملابس، واختر المقاس واللون، وجرّبها، وقل كيف تناسبك، ثم ادفع.',
  },
  minutes: 4,
  steps: [
    { id: 'look', text: { en: 'Say what you are looking for', ar: 'قل ما تبحث عنه' } },
    { id: 'size', text: { en: 'Choose a size', ar: 'اختر المقاس' } },
    { id: 'colour', text: { en: 'Choose a colour', ar: 'اختر اللون' } },
    { id: 'try', text: { en: 'Ask to try it on', ar: 'اطلب تجربتها' } },
    { id: 'fit', text: { en: 'Say how it fits', ar: 'قل كيف تناسبك' } },
    { id: 'pay', text: { en: 'Pay and say thanks', ar: 'ادفع واشكر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|何|か|お探し|です|か？', 'Welcome. Are you looking for something?', 'أهلًا بك. هل تبحث عن شيء؟'))],
      suggestions: [
        S('Tシャツ|を|探しています。', 'I am looking for a T-shirt.', 'أبحث عن قميص تي شيرت.'),
        JUST_LOOKING_S,
        S('プレゼント|を|探しています。', 'I am looking for a present.', 'أبحث عن هدية.'),
        S('こんにちは。', 'Hello.', 'مرحبًا.'),
      ],
      intents: [
        pickClothes(),
        { id: 'ask_have', any: ['ありますか', 'なにがありますか', 'ふく', 'ようふく'], next: 'shelves' },
        justLooking,
        { id: 'hello', any: ['こんにちは', 'すみません'], stay: true, reply: L('何|か|お探し|です|か？', 'Are you looking for something?', 'هل تبحث عن شيء؟') },
        goodsIntent,
        later(),
      ],
    }),
    // what the shop has: the pieces are read aloud, the learner picks one by name
    node({
      id: 'shelves',
      step: 'look',
      say: [say(L('Tシャツ、|パーカー、|ジーンズ、|スニーカー、|帽子、|メガネ、|リュック、|ダウンジャケット、|スーツ|が|あります。', 'We have T-shirts, hoodies, jeans, sneakers, caps, glasses, backpacks, down jackets and suits.', 'لدينا قمصان تي شيرت وهوديات وجينز وأحذية رياضية وقبعات ونظارات وحقائب ظهر وسترات منفوخة وبدلات.'))],
      suggestions: [S('パーカー|を|ください。', 'A hoodie, please.', 'هودي من فضلك.'), S('帽子|は|あります|か？', 'Do you have caps?', 'هل لديكم قبعات؟'), S('Tシャツ|を|ください。', 'A T-shirt, please.', 'قميص تي شيرت من فضلك.'), REPEAT_S],
      intents: [
        pickClothes(),
        { id: 'ask_price', any: ['いくら', 'ねだん'], stay: true, reply: L('どれ|の|お値段|です|か？', 'Which one do you mean?', 'أيّها تقصد؟') },
        justLooking,
        goodsIntent,
        later(),
      ],
    }),
    // the size: a piece in one size says so; the other pieces hear their price here, as soon as the piece is known (the rest hear it at the offer)
    node({
      id: 'size',
      step: 'size',
      say: [
        say(L('{clothes}|です|ね。|これ|は|フリーサイズ|です。', 'The {clothes}, I see. This one is one size.', '{clothes}، حسنًا. هذا بمقاس واحد.'), { slot: 'clothes', in: FREE_SIZE }),
        ...priced(
          L('{clothes}|です|ね。|{price}|です。|サイズ|は|どう|します|か？|エスサイズ、|エムサイズ、|エルサイズ|が|あります。', 'The {clothes}, I see. It is {price}. Which size? We have S, M and L.', '{clothes}، حسنًا. السعر {price}. أي مقاس؟ لدينا S وM وL.'),
          L('{clothes}|です|ね。|サイズ|は|どう|します|か？|エスサイズ、|エムサイズ、|エルサイズ|が|あります。', 'The {clothes}, I see. Which size? We have S, M and L.', '{clothes}، حسنًا. أي مقاس؟ لدينا S وM وL.'),
        ),
      ],
      suggestions: [sizeS('エムサイズ', 'Size M', 'مقاس M'), sizeS('エルサイズ', 'Size L', 'مقاس L'), YES_S, REPEAT_S],
      intents: [
        sizePick('colour'),
        { id: 'size_ok', any: ['はい', 'おねがい', 'いいです', 'わかりました'], next: 'colour' },
        askPrice('size'),
        later(),
      ],
    }),
    // the colour: six colours for the T-shirt, the hoodie and the sneakers; the other pieces come in one colour
    node({
      id: 'colour',
      step: 'colour',
      say: [
        say(L('色|は|どう|します|か？|黒、|白、|赤、|青、|緑、|黄色|が|あります。', 'Which colour? We have black, white, red, blue, green and yellow.', 'أي لون؟ لدينا أسود وأبيض وأحمر وأزرق وأخضر وأصفر.'), { slot: 'clothes', in: COLOURFUL }),
        say(L('これ|は|この|色|だけ|です。|いい|です|か？', 'This one only comes in this colour. Is that all right?', 'هذا بهذا اللون فقط. هل هذا مناسب؟')),
      ],
      suggestions: [S('黒|を|お願いします。', 'Black, please.', 'الأسود من فضلك.'), S('青|が|いい|です。', 'I would like blue.', 'أريد الأزرق.'), YES_S, REPEAT_S],
      intents: [
        { id: 'pick_colour', slot: 'clothesColour', slotRequired: true, next: 'offer', request: true, ideal: L('{clothesColour}|を|お願いします。', '{clothesColour}, please.', '{clothesColour} من فضلك.') },
        { id: 'colour_ok', any: ['はい', 'おねがい', 'いいです', 'これ'], next: 'offer' },
        // the price is read at the fitting-room offer that follows
        { id: 'ask_price', any: ['いくら', 'ねだん'], stay: true, reply: L('後で、|お値段|を|お知らせ|します。', 'I will tell you the price in a moment.', 'سأخبرك بالسعر بعد قليل.') },
        later(),
      ],
    }),
    // the piece is chosen: Rin offers the fitting room, the learner asks to try it on
    node({
      id: 'offer',
      say: [
        say(L('いい|です|ね。|{price}|です。|試着|も|できます|よ。', 'Nice choice. It is {price}. You can try it on too.', 'اختيار جميل. السعر {price}. يمكنك تجربته أيضًا.'), { flag: 'priced' }),
        say(L('いい|です|ね。|試着|も|できます|よ。', 'Nice choice. You can try it on too.', 'اختيار جميل. يمكنك تجربته أيضًا.')),
      ],
      suggestions: [S('試着|して|も|いい|です|か？', 'May I try it on?', 'هل يمكنني تجربته؟'), THINK_S, REPEAT_S],
      intents: [
        { id: 'ask_try', any: ['しちゃく', 'きてみ', 'きてもいい', 'はいてみ', 'かぶってみ'], next: 'fitting', step: 'try', request: true, ideal: L('試着|して|も|いい|です|か？', 'May I try it on?', 'هل يمكنني تجربته؟') },
        askPrice('offer'),
        later(),
      ],
    }),
    // THE FITTING-ROOM BEAT: the app previews the piece on the avatar while the session is at this node
    node({
      id: 'fitting',
      emotion: 'happy',
      say: [
        // twist (flags.twist): the fitting room is busy for a moment; nothing changes in the price
        say(L('少し|待って|ください|ね。|はい、|どうぞ。|あちら|です。|サイズ|は|どう|です|か？', 'Please wait a moment. All right, go ahead. It is over there. How is the size?', 'انتظر قليلًا من فضلك. حسنًا، تفضّل. إنها هناك. كيف المقاس؟'), { flag: 'twist' }),
        say(L('試着|できます|よ。|あちら|へ|どうぞ。|サイズ|は|どう|です|か？', 'You can try it on. Over there, please. How is the size?', 'يمكنك تجربته. تفضّل من هناك. كيف المقاس؟')),
      ],
      suggestions: [S('ちょうどいい|です。', 'It is just right.', 'مناسب تمامًا.'), S('大きい|です。', 'It is too big.', 'إنه كبير.'), S('小さい|です。', 'It is too small.', 'إنه صغير.'), REPEAT_S],
      intents: [
        { id: 'fit_ok', slot: 'fit', slotOptions: ['just'], slotRequired: true, next: 'suits', step: 'fit', request: true, ideal: L('ちょうどいい|です。', 'It is just right.', 'مناسب تمامًا.') },
        { id: 'fit_big', slot: 'fit', slotOptions: ['big'], slotRequired: true, next: 'resize', step: 'fit' },
        { id: 'fit_small', slot: 'fit', slotOptions: ['small'], slotRequired: true, next: 'resize', step: 'fit' },
        later(),
      ],
    }),
    // too big or too small: another size, and back to the fitting room
    node({
      id: 'resize',
      say: [
        say(L('少し|大きい|です|ね。|小さい|サイズ|は|いかが|です|か？', 'It is a little big. How about a smaller size?', 'كبير قليلًا. ما رأيك بمقاس أصغر؟'), { slot: 'fit', in: ['big'] }),
        say(L('少し|小さい|です|ね。|大きい|サイズ|は|いかが|です|か？', 'It is a little small. How about a bigger size?', 'صغير قليلًا. ما رأيك بمقاس أكبر؟')),
      ],
      suggestions: [sizeS('エスサイズ', 'Size S', 'مقاس S'), sizeS('エルサイズ', 'Size L', 'مقاس L'), sizeS('エムサイズ', 'Size M', 'مقاس M'), REPEAT_S],
      intents: [sizePick('fitting'), later()],
    }),
    // the compliment: 似合いますよ (teaches 似合う); the learner thanks her or buys
    node({
      id: 'suits',
      emotion: 'happy',
      say: [say(L('とても|似合います|よ。', 'It suits you very much.', 'يليق بك كثيرًا.'))],
      suggestions: [S('ありがとうございます。', 'Thank you.', 'شكرًا لك.'), S('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.'), THINK_S],
      intents: [
        { id: 'buy', any: BUY, none: ['かんがえ'], next: 'quote', request: true, ideal: L('これ|を|ください。', 'I will take this one.', 'سآخذ هذا.') },
        { id: 'thanks', any: ['ありがとう'], next: 'quote' },
        later(),
      ],
    }),
    // the price and the way to pay in one breath, as at the other small shops
    node({
      id: 'quote',
      say: quoteLines(
        'clothes',
        Object.keys(FUKU_PRICES).filter((k) => !['plush', 'guitarPick'].includes(k)),
        L('{clothes}|です|ね。|全部|で|{total}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'The {clothes}, I see. {total} in total, tax included. Will you pay in cash or by card?', '{clothes}، حسنًا. المجموع {total} شاملًا الضريبة. هل ستدفع نقدًا أم بالبطاقة؟'),
        (ja, en, ar) => L(`{clothes}|です|ね。|全部|で|${ja}、|税込|です。|お支払い|は|現金|です|か、|カード|です|か？`, `The {clothes}, I see. ${en} in total, tax included. Will you pay in cash or by card?`, `{clothes}، حسنًا. المجموع ${ar} شاملًا الضريبة. هل ستدفع نقدًا أم بالبطاقة؟`),
        L('{clothes}|です|ね。|税込|です。|お支払い|は|現金|です|か、|カード|です|か？', 'The {clothes}, I see. Tax is included. Will you pay in cash or by card?', '{clothes}، حسنًا. الضريبة شاملة. هل ستدفع نقدًا أم بالبطاقة؟'),
      ),
      suggestions: [CARD_S, CASH_S, THINK_S, S('少し|高い|です。', 'It is a little expensive.', 'إنه غالٍ قليلًا.')],
      intents: [
        ...payIntents('done'),
        { id: 'too_dear', any: ['たかい', '高い'], stay: true, reply: L('すみません。|定価|です。', 'I am sorry. It is a fixed price.', 'آسفة. إنه سعر ثابت.') },
        askPrice('quote'),
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
      say: [say(L('ありがとうございました。|また|お越し|ください。', 'Thank you very much. Please come again.', 'شكرًا جزيلًا. تفضّل بزيارتنا مجددًا.'))],
      intents: [],
    }),
    // too little money is a scripted branch, never an error (§4.4 rule 6)
    node({
      id: 'short',
      say: [say(OWNED_LINE, { flag: 'owned_already' }), say(SOLD_OUT_LINE, { flag: 'sold_out' }), say(SHORT_LINE)],
      suggestions: [LATER_S, S('安い|の|は|あります|か？', 'Do you have something cheaper?', 'هل لديكم شيء أرخص؟'), THINK_S],
      intents: [later(), { id: 'cheaper', any: ['やすいの', 'やすい'], next: 'shelves' }],
    }),
    // goods (§5.6): the plush toy and the guitar pick, presents
    node({
      id: 'goods',
      say: [say(L('プレゼント|です|ね。|ぬいぐるみ|と|ギターピック|が|あります。', 'A present, I see. We have plush toys and guitar picks.', 'هدية، حسنًا. لدينا دمى محشوة وريش غيتار.'))],
      suggestions: [S('ぬいぐるみ|を|ください。', 'A plush toy, please.', 'دمية محشوة من فضلك.'), S('ギターピック|を|ください。', 'A guitar pick, please.', 'ريشة غيتار من فضلك.'), JUST_LOOKING_S, REPEAT_S],
      intents: [
        { id: 'pick_gift', slot: 'giftItem', slotOptions: ['plush', 'guitarPick'], slotRequired: true, next: 'pay_gift', request: true, ideal: L('{giftItem}|を|ください。', '{giftItem}, please.', '{giftItem} من فضلك.') },
        { id: 'just_looking', any: ['みているだけ', '見ているだけ'], next: 'shelves' },
        later(),
      ],
    }),
    node({
      id: 'pay_gift',
      say: quoteLines(
        'giftItem',
        ['plush', 'guitarPick'],
        L('{giftItem}|です|ね。|{total}、|税込|です。|現金|です|か、|カード|です|か？', 'The {giftItem}, I see. {total}, tax included. Cash or card?', '{giftItem}، حسنًا. {total} شاملًا الضريبة. نقدًا أم بالبطاقة؟'),
        (ja, en, ar) => L(`{giftItem}|です|ね。|${ja}、|税込|です。|現金|です|か、|カード|です|か？`, `The {giftItem}, I see. ${en}, tax included. Cash or card?`, `{giftItem}، حسنًا. ${ar} شاملًا الضريبة. نقدًا أم بالبطاقة؟`),
        L('{giftItem}|です|ね。|税込|です。|現金|です|か、|カード|です|か？', 'The {giftItem}, I see. Tax is included. Cash or card?', '{giftItem}، حسنًا. الضريبة شاملة. نقدًا أم بالبطاقة؟'),
      ),
      suggestions: [CARD_S, CASH_S, REPEAT_S],
      intents: [...payIntents('done'), later()],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

/** Scenarios for Fuku-Fuku: fuku_clothes (fuku_home, the furniture, is not in this release). */
export const FUKU_SCENARIOS: Scenario[] = [FUKU_CLOTHES];
