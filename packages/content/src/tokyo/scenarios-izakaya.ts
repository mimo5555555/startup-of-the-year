import type { IntentDef, Scenario } from '../types';
import { L, S, say, node, asRecord } from './dsl';

// 居酒屋「なごみ」 (Nagomi, the izakaya at the west end of the south row, Chapter 6). One conversation with Misaki, the server, for an evening
// out with a friend:
//  - how many (二人です), the drinks for the two of you (ウーロン茶を二つください; 生ビール for an adult, while a younger player is told
//    「お酒は二十歳からです」 and offered a soft drink), the お通し that comes unasked (お通しって何ですか: a small dish, ¥300 a person, the cover
//    charge), a dish to share (焼き鳥 / 枝豆 / 唐揚げ), 乾杯, calling the staff (すみません！お会計お願いします),
//  - and the bill: 「お会計はご一緒でよろしいですか？」 → 「一緒でお願いします」 (you pay it all) or 「割り勘でお願いします」 (you pay your half:
//    the game's split bill takes your friend's share off), then cash or card.
// Menu: izakaya:oolong / orange / beer (the drinks, `qty` of them), izakaya:yakitori / edamame / karaage (the dish), izakaya:otoshi (the
// cover, two of them, on every order).

const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });

/** Fixed prices of the menu (checked against the menu in the tests). */
export const IZAKAYA_PRICES: Record<string, number> = { oolong: 350, orange: 350, beer: 550, yakitori: 680, edamame: 380, karaage: 580, otoshi: 300 };

const payIntents: IntentDef[] = [
  { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, next: 'done' },
  { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'done' },
  { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ', 'わりかん', '割り勘', 'べつべつ', '別々'], next: 'done' },
];
const PAY_CHIPS = [S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.'), S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.'), S('はい、|どうぞ。', 'Yes, here you are.', 'نعم، تفضّلي.')];

export const IZAKAYA_DINNER: Scenario = {
  id: 'izakaya_dinner',
  locationId: 'izakaya',
  characterId: 'misaki',
  level: 'A2',
  title: { en: 'An evening at the izakaya', ar: 'أمسية في الإيزاكايا' },
  setup: {
    en: 'You and a friend go to the izakaya Nagomi. Say how many you are, order drinks for two and a dish to share, make a toast, call the staff for the bill, and pay it all or split it (割り勘).',
    ar: 'تذهب مع صديق إلى إيزاكايا ناغومي. قل كم عددكم، واطلب مشروبين وطبقًا للمشاركة، واشربا نخبًا، وادعُ الموظفة للحساب، وادفعه كله أو قسّمه (واريكان).',
  },
  minutes: 5,
  steps: [
    { id: 'people', text: { en: 'Say how many you are', ar: 'قل كم عددكم' } },
    { id: 'drinks', text: { en: 'Order drinks for two', ar: 'اطلب مشروبين' } },
    { id: 'food', text: { en: 'Order a dish to share', ar: 'اطلب طبقًا للمشاركة' } },
    { id: 'kanpai', text: { en: 'Make a toast', ar: 'اشربا نخبًا' } },
    { id: 'bill', text: { en: 'Call the staff for the bill', ar: 'اطلب الحساب' } },
    { id: 'split', text: { en: 'Pay together or split the bill', ar: 'ادفعا معًا أو قسّما الحساب' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませー！|何名様|です|か？', 'Welcome! How many people?', 'أهلًا بكم! كم عددكم؟'))],
      suggestions: [S('二人|です。', 'Two people.', 'شخصان.'), S('友達|と|二人|です。', 'Two, with a friend.', 'اثنان، مع صديق.')],
      intents: [{ id: 'people', any: ['ふたり', '二人', '2人', 'にめい', '二名'], next: 'drinks', step: 'people', request: true, ideal: L('二人|です。', 'Two people.', 'شخصان.') }, later()],
    }),
    node({
      id: 'drinks',
      say: [say(L('二名様|です|ね。|こちら|の|お席|へ|どうぞ。|お飲み物|は|何|に|します|か？', 'Two, right. This way to your table, please. What would you like to drink?', 'اثنان، حسنًا. تفضّلوا إلى طاولتكم من هنا. ماذا تشربون؟'))],
      suggestions: [
        S('ウーロン茶|を|二つ|ください。', 'Two oolong teas, please.', 'كوبان من شاي أولونغ من فضلك.'),
        S('オレンジジュース|を|二つ|ください。', 'Two orange juices, please.', 'كوبان من عصير البرتقال من فضلك.'),
        { ...S('生ビール|を|二つ|ください。', 'Two draft beers, please.', 'كأسان من البيرة من فضلك.'), when: { flag: 'adult' } },
      ],
      intents: [
        {
          id: 'pick_drink',
          slot: 'izaDrink',
          slotOptions: ['oolong', 'orange'],
          slotRequired: true,
          alsoSlots: ['qty'],
          next: 'otoshi',
          step: 'drinks',
          request: true,
          ideal: L('ウーロン茶|を|二つ|ください。', 'Two oolong teas, please.', 'كوبان من شاي أولونغ من فضلك.'),
        },
        { id: 'pick_beer', when: { flag: 'adult' }, slot: 'izaDrink', slotOptions: ['beer'], slotRequired: true, alsoSlots: ['qty'], next: 'otoshi', step: 'drinks', request: true },
        {
          id: 'beer_no',
          when: { flag: 'minor' },
          any: ['ビール', 'びーる', 'おさけ', 'お酒', 'さけ'],
          stay: true,
          reply: L('すみません、|お酒|は|二十歳|から|です。|ソフトドリンク|は|いかが|です|か？', 'Sorry, alcohol is from 20 years old. How about a soft drink?', 'آسفة، المشروبات الكحولية من سن العشرين. ما رأيك بمشروب غازي؟'),
        },
        later(),
      ],
    }),
    // the お通し comes with the drinks, unasked: a small dish that is the table charge
    node({
      id: 'otoshi',
      say: [say(L('{izaDrink}|です|ね。|かしこまりました。|こちら、|お通し|です。|お食事|は|どう|します|か？', '{izaDrink}, right. Certainly. Here is your otoshi. What would you like to eat?', '{izaDrink}، حسنًا. بكل سرور. هذا الأوتوشي. ماذا تأكلون؟'))],
      suggestions: [S('焼き鳥|を|ください。', 'Yakitori, please.', 'ياكيتوري من فضلك.'), S('お通し|って|何|です|か？', 'What is otoshi?', 'ما هو الأوتوشي؟'), S('おすすめ|は|何|です|か？', 'What do you recommend?', 'ماذا تنصحين؟')],
      intents: [
        {
          id: 'ask_otoshi',
          all: [['おとおし', 'お通し'], ['なん', '何', 'って']],
          stay: true,
          reply: L('お店|が|最初|に|出す|小さい|料理|です。|お一人様|三|百|円|です。', 'It is a small dish the restaurant serves first. It is 300 yen per person.', 'إنه طبق صغير يقدّمه المطعم أولًا. سعره 300 ين للشخص.'),
        },
        { id: 'pick_food', slot: 'izaFood', slotRequired: true, next: 'served', step: 'food', request: true, ideal: L('焼き鳥|を|ください。', 'Yakitori, please.', 'ياكيتوري من فضلك.') },
        { id: 'ask_reco', any: ['おすすめ', 'オススメ', '人気', 'にんき'], stay: true, reply: L('焼き鳥|が|おすすめ|です。|枝豆|と|唐揚げ|も|人気|です|よ。', 'I recommend the yakitori. Edamame and karaage are popular too.', 'أنصح بالياكيتوري. الإيدامامي والكاراغي مشهوران أيضًا.') },
        later(),
      ],
    }),
    node({
      id: 'served',
      emotion: 'happy',
      say: [say(L('お待たせしました！|{izaFood}|です。|どうぞ、|ごゆっくり！', 'Sorry to keep you waiting! Here is the {izaFood}. Enjoy!', 'آسفة على الانتظار! تفضّلوا {izaFood}. استمتعوا!'))],
      suggestions: [S('乾杯！', 'Cheers!', 'في صحتك!'), S('いただきます！', 'Let us eat!', 'بالهناء!'), S('ありがとうございます。', 'Thank you.', 'شكرًا.')],
      intents: [
        { id: 'toast', any: ['かんぱい', '乾杯', 'いただきます'], next: 'enjoy', step: 'kanpai' },
        { id: 'thanks', any: ['ありがとう'], stay: true, reply: L('どういたしまして！', 'You are welcome!', 'عفوًا!') },
      ],
    }),
    // the table: the player calls the staff when it is time to go
    node({
      id: 'enjoy',
      say: [say(L('はい、|乾杯！|楽しんで|ください|ね。', 'Cheers! Have a good time.', 'في صحتكم! استمتعوا بوقتكم.'))],
      suggestions: [S('すみません！|お会計|お願いします。', 'Excuse me! The bill, please.', 'لو سمحتِ! الحساب من فضلك.'), S('ごちそうさまでした。', 'Thank you for the meal.', 'شكرًا على الطعام.'), S('おいしい|です！', 'It is delicious!', 'إنه لذيذ!')],
      intents: [
        { id: 'ask_bill', any: ['おかいけい', 'お会計', 'かいけい', 'おあいそ'], next: 'bill', step: 'bill', request: true, ideal: L('すみません！|お会計|お願いします。', 'Excuse me! The bill, please.', 'لو سمحتِ! الحساب من فضلك.') },
        { id: 'gochisosama', any: ['ごちそうさま'], stay: true, reply: L('ありがとう|ございます！|お会計|は|あちら|で|も|できます|よ。', 'Thank you! You can also pay over there.', 'شكرًا! يمكنكم الدفع هناك أيضًا.') },
        { id: 'delicious', any: ['おいしい', '美味しい', 'うまい'], stay: true, reply: L('ありがとう|ございます！', 'Thank you very much!', 'شكرًا جزيلًا!') },
      ],
    }),
    // together or split: the question every izakaya asks a table
    node({
      id: 'bill',
      say: [
        say(L('ありがとう|ございます。|全部|で|{total}|です。|お会計|は|ご一緒|で|よろしい|です|か？', 'Thank you. That is {total} in all. Will that be one bill?', 'شكرًا. المجموع {total}. هل الحساب واحد؟'), { flag: 'priced' }),
        say(L('ありがとう|ございます。|お会計|は|ご一緒|で|よろしい|です|か？', 'Thank you. Will that be one bill?', 'شكرًا. هل الحساب واحد؟')),
      ],
      suggestions: [S('割り勘|で|お願いします。', 'We will split it, please.', 'سنقسّمه من فضلك.'), S('一緒|で|お願いします。', 'Together, please.', 'معًا من فضلك.'), S('別々|に|払えます|か？', 'Can we pay separately?', 'هل يمكننا الدفع كلٌّ على حدة؟')],
      intents: [
        { id: 'split_half', slot: 'billSplit', slotOptions: ['half'], slotRequired: true, next: 'split', step: 'split', request: true, ideal: L('割り勘|で|お願いします。', 'We will split it, please.', 'سنقسّمه من فضلك.') },
        { id: 'together', any: ['いっしょ', '一緒', 'まとめて', 'はい'], none: ['わりかん', '割り勘', 'べつべつ', '別々', 'はんぶん', '半分'], next: 'pay', step: 'split' },
        later(),
      ],
    }),
    node({
      id: 'split',
      say: [
        say(L('割り勘|です|ね。|お一人様|{total}|です。|お支払い|は|現金|です|か、|カード|です|か？', 'Splitting it, right. That is {total} each. Cash or card?', 'تقسيم الحساب، حسنًا. على كل شخص {total}. نقدًا أم بالبطاقة؟'), { flag: 'priced' }),
        say(L('割り勘|です|ね。|かしこまりました。|お支払い|は|現金|です|か、|カード|です|か？', 'Splitting it, right. Certainly. Cash or card?', 'تقسيم الحساب، حسنًا. بكل سرور. نقدًا أم بالبطاقة؟')),
      ],
      suggestions: PAY_CHIPS,
      intents: [...payIntents, later()],
    }),
    node({
      id: 'pay',
      say: [say(L('かしこまりました。|お支払い|は|現金|です|か、|カード|です|か？', 'Certainly. Cash or card?', 'بكل سرور. نقدًا أم بالبطاقة؟'))],
      suggestions: PAY_CHIPS,
      intents: [...payIntents, later()],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('ありがとう|ございました！|また|お越し|ください！', 'Thank you very much! Please come again!', 'شكرًا جزيلًا! تفضّلوا بزيارتنا مجددًا!'))],
      intents: [],
    }),
    node({
      id: 'short',
      say: [say(L('あの、|お客様、|少し|足りません。', 'Excuse me, that is a little short.', 'عذرًا، المبلغ ناقص قليلًا.'))],
      suggestions: [S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.'), S('割り勘|で|お願いします。', 'We will split it, please.', 'سنقسّمه من فضلك.')],
      intents: [{ id: 'split_half', slot: 'billSplit', slotOptions: ['half'], slotRequired: true, next: 'split', step: 'split' }, later()],
    }),
    node({ id: 'leave', end: true, say: [say(L('はい。|また|お越し|ください。', 'All right. Please come again.', 'حسنًا. تفضّلوا بزيارتنا مجددًا.'))], intents: [] }),
  ]),
};

export const IZAKAYA_SCENARIOS: Scenario[] = [IZAKAYA_DINNER];
