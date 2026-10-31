import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';
import { yenToJa } from './game/jp-language';
import { KYOTO_PRICES } from './game/journeys';

// The Kyoto Journey (Goen stage 1, docs/GOEN.md): three conversations of a panel trip, like Hikarigaoka. The Shinkansen round trip is paid up
// front in yen at the station; the stay at the ryokan comes with the Journey; the temple and the café sell through the ordinary `charge`
// hook (prices are Vars from the hooks, with a fallback line so each scenario runs on its own). Real keigo where the place speaks it: the okami
// at the ryokan and the temple counter answer in 尊敬語 / 謙譲語 (ございます, いたします, お〜ください); the learner answers politely (です / ます),
// which is what a visitor says. Running short of cash is a scripted branch (§4.4 rule 6), so nothing can strand the player: the way back is paid.

const yenEn = (yen: number) => `${yen.toLocaleString('en-US')} yen`;
const yenAr = (yen: number) => `${yen.toLocaleString('en-US')} ين`;

const SHORT_LINE = L('申し訳ございません。|少し|足りません|ね。', 'I am very sorry. It is a little short.', 'أعتذر بشدة. المبلغ ناقص قليلًا.');
const SOLD_OUT_LINE = L('申し訳ございません。|それ|は|品切れ|です。', 'I am very sorry. That is sold out.', 'أعتذر بشدة. هذا نفد.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const CASH_S = S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.');
const IC_S = S('ICカード|で|お願いします。', 'By IC card, please.', 'ببطاقة IC من فضلك.');
const HERE_S = S('はい、|どうぞ。', 'Here you go.', 'تفضّل.');
const later = (next = 'leave'): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next });
const again = (next: string): IntentDef => ({ id: 'again', any: ['もういちど', 'もう一度'], next });

/** The live total (Vars from the hooks, flag `priced`) or, without hooks, a line with no number so the scenario still runs on its own. */
const totalLine = (live: Line, plain: Line): SayVariant[] => [say(live, { flag: 'priced' }), say(plain)];

// ------------------------------------------------------------------------------------------------------------------------------------
// kyoto_ryokan: checking in with the okami, Fujiwara-san. Her keigo (いらっしゃいませ、ご予約のお名前は…、お部屋は…) and the learner's polite
// answers: the name of the reservation, the nights, the dinner time, thanks. Four lines of the learner's own are possible, so the Journey's
// "3+ own lines" leaves room for one slip. No purchase: the stay comes with the Journey.
// ------------------------------------------------------------------------------------------------------------------------------------

const NAME_IDEAL = L('予約|した|{name}|です。', 'I am {name}. I have a reservation.', 'أنا {name}. لديّ حجز.');
const giveName: IntentDef = {
  id: 'give_name',
  any: ['です', 'もうします', '申します', 'といいます', 'よやく', '予約'],
  none: ['なんぱく', '何泊', 'ゆうしょく'],
  capture: 'name',
  next: 'nights',
  step: 'greet',
  ideal: NAME_IDEAL,
};
const helloOnly: IntentDef = {
  id: 'hello_only',
  any: ['こんにちは', 'こんばんは', 'はじめまして', 'おせわになります', 'お世話になります'],
  none: ['です', 'もうします', '申します', 'よやく', '予約'],
  stay: true,
  reply: L('ようこそ|お越し|くださいました。|ご予約|の|お名前|を|お願いいたします。', 'Thank you for coming. Your name for the reservation, please.', 'شكرًا على قدومك. اسم الحجز من فضلك.'),
};
const sayNights = (next: string, step?: string): IntentDef => ({
  id: 'say_nights',
  slot: 'nights',
  slotRequired: true,
  next,
  ...(step ? { step } : {}),
  ideal: L('{nights}|です。', '{nights}.', '{nights}.'),
});
const DINNER_SIX = L('六時|で|お願いします。', 'At six, please.', 'في السادسة من فضلك.');
const DINNER_SEVEN = L('七時|で|お願いします。', 'At seven, please.', 'في السابعة من فضلك.');
const dinner = (id: string, keys: string[], ideal: Line): IntentDef => ({ id, any: keys, next: 'room', step: 'dinner', request: true, ideal });

export const KYOTO_RYOKAN: Scenario = {
  id: 'kyoto_ryokan',
  locationId: 'kyoto',
  characterId: 'fujiwara',
  level: 'A2',
  title: { en: 'Checking in at a ryokan', ar: 'تسجيل الوصول في ريوكان' },
  setup: {
    en: 'You arrived in Kyoto by Shinkansen. The okami, Fujiwara-san, welcomes you at the ryokan in polite keigo. Give the name of your reservation, say how many nights, choose the dinner time and thank her.',
    ar: 'وصلت إلى كيوتو بالشينكانسن. ترحّب بك الأوكامي السيدة فوجيوارا في الريوكان بلغة مهذبة (كيغو). قل اسم حجزك وعدد الليالي واختر وقت العشاء واشكرها.',
  },
  minutes: 4,
  steps: [
    { id: 'greet', text: { en: 'Give the name of your reservation', ar: 'قل اسم حجزك' } },
    { id: 'nights', text: { en: 'Say how many nights you stay', ar: 'قل كم ليلة ستبقى' } },
    { id: 'dinner', text: { en: 'Choose the dinner time', ar: 'اختر وقت العشاء' } },
    { id: 'thanks', text: { en: 'Thank her politely', ar: 'اشكرها بأدب' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|ようこそ|お越し|くださいました。|ご予約|の|お名前|を|お願いいたします。', 'Welcome. Thank you for coming. Your name for the reservation, please.', 'أهلًا وسهلًا. شكرًا على قدومك. اسم الحجز من فضلك.'))],
      suggestions: [S('予約|した|{name}|です。', 'I am {name}. I have a reservation.', 'أنا {name}. لديّ حجز.'), S('{name}|と|申します。', 'My name is {name}.', 'اسمي {name}.'), REPEAT_S],
      intents: [giveName, helloOnly, again('start')],
    }),
    node({
      id: 'nights',
      step: 'greet',
      emotion: 'happy',
      say: [say(L('{name}|様|です|ね。|お待ちして|おりました。|何泊|の|ご予定|です|か？', 'Ah, {name}. We have been expecting you. How many nights will you stay?', '{name}، أهلًا. كنا بانتظارك. كم ليلة ستبقى؟'))],
      suggestions: [S('一泊|です。', 'One night.', 'ليلة واحدة.'), S('二泊|です。', 'Two nights.', 'ليلتان.'), REPEAT_S],
      intents: [sayNights('dinner', 'nights'), again('nights')],
    }),
    node({
      id: 'dinner',
      step: 'nights',
      say: [say(L('{nights}|です|ね。|かしこまりました。|ご夕食|は|六時|と|七時|が|ございます。|何時|が|よろしい|です|か？', '{nights}, certainly. Dinner is at six or at seven. Which time would suit you?', '{nights}، حسنًا. العشاء في السادسة أو السابعة. أي وقت يناسبك؟'))],
      suggestions: [S(DINNER_SIX.ja, DINNER_SIX.en, DINNER_SIX.ar), S(DINNER_SEVEN.ja, DINNER_SEVEN.en, DINNER_SEVEN.ar), REPEAT_S],
      intents: [
        dinner('dinner_six', ['六時', 'ろくじ'], DINNER_SIX),
        dinner('dinner_seven', ['七時', 'しちじ', 'ななじ'], DINNER_SEVEN),
        // a change of mind about the nights is heard (the first answer is kept for the room)
        { ...sayNights('dinner'), id: 'change_nights' },
        again('dinner'),
      ],
    }),
    node({
      id: 'room',
      step: 'dinner',
      emotion: 'happy',
      say: [say(L('かしこまりました。|お部屋|は|二階|で|ございます。|どうぞ|ごゆっくり|お過ごし|ください。', 'Certainly. Your room is on the second floor. Please make yourself at home.', 'حسنًا. غرفتك في الطابق الثاني. خذ راحتك من فضلك.'))],
      suggestions: [S('ありがとうございます。|お世話|に|なります。', 'Thank you. I am in your care.', 'شكرًا. أنا في رعايتكم.'), S('よろしく|お願いします。', 'Thank you for having me.', 'شكرًا على استضافتي.'), S('お風呂|は|どこ|です|か？', 'Where is the bath?', 'أين الحمّام؟')],
      intents: [
        { id: 'thanks', any: ['ありがとう', 'よろしく', 'おせわ', 'お世話'], next: 'done', step: 'thanks', ideal: L('ありがとうございます。|お世話|に|なります。', 'Thank you. I am in your care.', 'شكرًا. أنا في رعايتكم.') },
        { id: 'ask_bath', any: ['おふろ', 'お風呂', 'ふろ', 'どこ'], stay: true, reply: L('お風呂|は|一階|の|奥|で|ございます。|夜|十一時|まで|です。', 'The bath is at the back of the first floor, open until eleven at night.', 'الحمّام في آخر الطابق الأول، مفتوح حتى الحادية عشرة ليلًا.') },
        again('room'),
      ],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'thanks',
      say: [say(L('こちら|こそ。|では、|お部屋|へ|ご案内|いたします。', 'The pleasure is ours. Let me show you to your room.', 'بل الشرف لنا. سأرافقك إلى غرفتك.'))],
      intents: [],
    }),
  ]),
};

// ------------------------------------------------------------------------------------------------------------------------------------
// kyoto_temple: the counter of an old temple, Ishida-san. Ask about the garden (the autumn leaves), choose an omamori (slot `omamori`:
// health, study, safe travel; the counter's menu rows), ask for a goshuin stamp (slot `goshuin`, an extra of the same bill) and pay in cash
// (temples take cash). Every way out is polite (考えます / また来ます).
// ------------------------------------------------------------------------------------------------------------------------------------

const askGarden = (step?: string): IntentDef => ({
  id: 'ask_garden',
  any: ['にわ', '庭', 'こうよう', '紅葉', 'もみじ'],
  none: ['きれいですね', 'きれい'],
  next: 'garden',
  ...(step ? { step } : {}),
  request: true,
  ideal: L('庭|は|どこ|です|か？', 'Where is the garden?', 'أين الحديقة؟'),
});
const wantOmamori: IntentDef = {
  id: 'want_omamori',
  any: ['おまもり', 'お守り'],
  next: 'kinds',
  request: true,
  ideal: L('お守り|を|ください。', 'An omamori, please.', 'تميمة من فضلك.'),
};
const pickOmamori: IntentDef = {
  id: 'pick_omamori',
  slot: 'omamori',
  slotRequired: true,
  next: 'goshuin',
  step: 'omamori',
  request: true,
  ideal: L('{omamori}|の|お守り|を|ください。', 'The {omamori} omamori, please.', 'تميمة {omamori} من فضلك.'),
};
const wantGoshuin: IntentDef = {
  id: 'want_goshuin',
  // 「御朱印は何ですか」 asks what it is
  none: ['なん', 'なに', '何'],
  slot: 'goshuin',
  slotRequired: true,
  next: 'quote',
  step: 'goshuin',
  request: true,
  ideal: L('御朱印|を|お願いします。', 'A goshuin, please.', 'غوشوين من فضلك.'),
};

export const KYOTO_TEMPLE: Scenario = {
  id: 'kyoto_temple',
  locationId: 'kyoto',
  characterId: 'ishida',
  level: 'A2',
  title: { en: 'At a temple in Kyoto', ar: 'في معبد في كيوتو' },
  setup: {
    en: 'An old temple in Kyoto, the leaves are turning red. At the counter, Ishida-san speaks polite keigo. Ask about the garden, buy an omamori, ask for a goshuin stamp and pay in cash.',
    ar: 'معبد قديم في كيوتو، والأوراق تحمرّ. عند الشبّاك يتحدث السيد إيشيدا بلغة مهذبة (كيغو). اسأل عن الحديقة واشترِ تميمة واطلب ختم غوشوين وادفع نقدًا.',
  },
  minutes: 4,
  steps: [
    { id: 'garden', text: { en: 'Ask about the garden', ar: 'اسأل عن الحديقة' } },
    { id: 'omamori', text: { en: 'Choose an omamori', ar: 'اختر تميمة' } },
    { id: 'goshuin', text: { en: 'Ask for a goshuin stamp', ar: 'اطلب ختم غوشوين' } },
    { id: 'pay', text: { en: 'Pay in cash', ar: 'ادفع نقدًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('ようこそ|お参り|くださいました。|何か|お探し|です|か？', 'Welcome to the temple. Are you looking for something?', 'أهلًا بك في المعبد. هل تبحث عن شيء؟'))],
      suggestions: [S('庭|は|どこ|です|か？', 'Where is the garden?', 'أين الحديقة؟'), S('お守り|を|ください。', 'An omamori, please.', 'تميمة من فضلك.'), REPEAT_S],
      intents: [askGarden(), wantOmamori, later(), again('start')],
    }),
    node({
      id: 'garden',
      step: 'garden',
      emotion: 'happy',
      say: [say(L('庭|は|本堂|の|裏|に|ございます。|今|は|紅葉|が|とても|きれい|です|よ。', 'The garden is behind the main hall. The autumn leaves are very beautiful now.', 'الحديقة خلف القاعة الرئيسية. أوراق الخريف جميلة جدًا الآن.'))],
      // the omamori first: the first chip is always the way on (the compliment is answered and stays here)
      suggestions: [S('お守り|を|ください。', 'An omamori, please.', 'تميمة من فضلك.'), S('紅葉|が|きれい|です|ね。', 'The autumn leaves are beautiful.', 'أوراق الخريف جميلة.'), REPEAT_S],
      intents: [
        { id: 'admire', any: ['きれい', 'すてき', 'すごい', 'いいですね'], none: ['おまもり', 'お守り'], stay: true, reply: L('ありがとうございます。|ぜひ|ご覧|ください。|お守り|も|ございます|よ。', 'Thank you. Please do have a look. We also have omamori.', 'شكرًا. تفضّل بالنظر. لدينا تمائم أيضًا.') },
        wantOmamori,
        later(),
        again('garden'),
      ],
    }),
    node({
      id: 'kinds',
      say: [say(L('お守り|は|健康、|学業、|交通安全|が|ございます。|どちら|に|なさいます|か？', 'We have omamori for good health, for study and for safe travel. Which would you like?', 'لدينا تمائم للصحة الجيدة وللدراسة وللسلامة في الطريق. أيّها تريد؟'))],
      suggestions: [S('健康|の|お守り|を|ください。', 'The one for good health, please.', 'تميمة الصحة من فضلك.'), S('学業|の|お守り|を|ください。', 'The one for study, please.', 'تميمة الدراسة من فضلك.'), S('交通安全|の|お守り|を|ください。', 'The one for safe travel, please.', 'تميمة السلامة في الطريق من فضلك.')],
      intents: [pickOmamori, askGarden('garden'), later(), again('kinds')],
    }),
    node({
      id: 'goshuin',
      step: 'omamori',
      emotion: 'happy',
      say: [say(L('{omamori}|の|お守り|です|ね。|御朱印|も|いかが|です|か？', 'The {omamori} omamori, certainly. Would you also like a goshuin stamp?', 'تميمة {omamori}، حسنًا. هل تريد أيضًا ختم غوشوين؟'))],
      suggestions: [S('はい、|御朱印|を|お願いします。', 'Yes, a goshuin, please.', 'نعم، غوشوين من فضلك.'), S('御朱印|は|何|です|か？', 'What is a goshuin?', 'ما هو الغوشوين؟'), REPEAT_S],
      intents: [
        wantGoshuin,
        { id: 'what_goshuin', any: ['なん', 'なに', '何'], stay: true, reply: L(`御朱印|は|お寺|の|しるし|です。|筆|で|書きます。|${yenToJa(KYOTO_PRICES.goshuin).markup}|で|ございます。`, 'A goshuin is the temple’s stamp, written with a brush. It is five hundred yen.', 'الغوشوين ختم المعبد، يُكتب بالفرشاة. سعره خمسمئة ين.') },
        { id: 'no_thanks', any: ['けっこう', 'いいえ', 'だいじょうぶ'], next: 'quote' },
        { ...pickOmamori, id: 'change_omamori', next: 'goshuin' },
        later(),
        again('goshuin'),
      ],
    }),
    node({
      id: 'quote',
      say: totalLine(
        L('全部|で|{total}|で|ございます。|現金|で|お願いいたします。', 'That is {total} in all. Cash, please.', 'المجموع {total}. نقدًا من فضلك.'),
        L('かしこまりました。|お会計|は|現金|で|お願いいたします。', 'Certainly. Please pay in cash.', 'حسنًا. ادفع نقدًا من فضلك.'),
      ),
      suggestions: [CASH_S, HERE_S, S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.')],
      intents: [
        { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'done' },
        { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['かーど', 'カード', 'ic'], next: 'done' },
        { id: 'pay_card', slot: 'payMethod', slotOptions: ['card', 'ic'], slotRequired: true, stay: true, reply: L('申し訳ございません。|こちら|は|現金|だけ|で|ございます。', 'I am very sorry. We take cash only here.', 'أعتذر بشدة. نقبل النقد فقط هنا.') },
        { id: 'ask_price', any: ['いくら', 'ねだん'], next: 'quote' },
        later(),
      ],
    }),
    node({
      id: 'done',
      end: true,
      step: 'pay',
      emotion: 'happy',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('ありがとうございます。|御朱印|は|すぐ|お書き|します。|よい|旅|を。', 'Thank you very much. I will write your goshuin right away. Have a good trip.', 'شكرًا جزيلًا. سأكتب الغوشوين حالًا. رحلة سعيدة.'))],
      intents: [],
    }),
    node({
      id: 'short',
      say: [say(SOLD_OUT_LINE, { flag: 'sold_out' }), say(SHORT_LINE)],
      suggestions: [LATER_S, THINK_S, REPEAT_S],
      intents: [later(), again('short')],
    }),
    node({ id: 'leave', end: true, say: [say(L('かしこまりました。|どうぞ|ごゆっくり|お参り|ください。', 'Of course. Please take your time at the temple.', 'بالطبع. خذ وقتك في المعبد.'))], intents: [] }),
  ]),
};

// ------------------------------------------------------------------------------------------------------------------------------------
// kyoto_matcha: a matcha and wagashi café, Mori-san. Order (slot `matcha`: the matcha set with the season's sweet, or a bowl of matcha), say
// something nice about it, ask what she recommends: Kyoto's yatsuhashi to bring home (slot `kyotogift`, the Journey's souvenir, optional),
// then pay (cash or IC card). The bill is charged once at the end, the order and the souvenir together.
// ------------------------------------------------------------------------------------------------------------------------------------

const order = (step?: string): IntentDef => ({
  id: 'order',
  slot: 'matcha',
  slotRequired: true,
  next: 'served',
  ...(step ? { step } : {}),
  request: true,
  ideal: L('{matcha}|を|ください。', '{matcha}, please.', '{matcha} من فضلك.'),
});
const askReco = (next: string, step?: string): IntentDef => ({
  id: 'ask_reco',
  any: ['おすすめ', 'オススメ', 'なにがいい'],
  next,
  ...(step ? { step } : {}),
  request: true,
  ideal: L('おすすめ|は|何|です|か？', 'What do you recommend?', 'بماذا تنصحين؟'),
});
const buySouvenir: IntentDef = {
  id: 'buy_souvenir',
  slot: 'kyotogift',
  slotRequired: true,
  next: 'quote',
  request: true,
  ideal: L('八ツ橋|を|ください。', 'Yatsuhashi, please.', 'ياتسوهاشي من فضلك.'),
};
const bill: IntentDef = { id: 'bill', any: ['おかいけい', 'お会計', 'かいけい'], next: 'quote', request: true, ideal: L('お会計|を|お願いします。', 'The bill, please.', 'الحساب من فضلك.') };

export const KYOTO_MATCHA: Scenario = {
  id: 'kyoto_matcha',
  locationId: 'kyoto',
  characterId: 'mori',
  level: 'A2',
  title: { en: 'A matcha café in Kyoto', ar: 'مقهى ماتشا في كيوتو' },
  setup: {
    en: 'A small matcha and wagashi café in Kyoto. Order from Mori-san, say something nice about it, ask what she recommends (a souvenir for a friend, perhaps) and pay. Cash or IC card.',
    ar: 'مقهى صغير للماتشا والحلوى اليابانية في كيوتو. اطلب من السيدة موري وقل شيئًا لطيفًا واسألها بماذا تنصح (ربما هدية لصديق) وادفع. نقدًا أو ببطاقة IC.',
  },
  minutes: 4,
  steps: [
    { id: 'order', text: { en: 'Order matcha', ar: 'اطلب الماتشا' } },
    { id: 'compliment', text: { en: 'Say something nice about it', ar: 'قل شيئًا لطيفًا عنه' } },
    { id: 'reco', text: { en: 'Ask what she recommends', ar: 'اسألها بماذا تنصح' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ。|ご注文|は|お決まり|です|か？', 'Welcome. Have you decided what you would like?', 'أهلًا وسهلًا. هل اخترت طلبك؟'))],
      suggestions: [S('抹茶セット|を|ください。', 'The matcha set, please.', 'طقم الماتشا من فضلك.'), S('抹茶|を|ください。', 'A matcha, please.', 'ماتشا من فضلك.'), S('セット|は|何|です|か？', 'What is the set?', 'ما هو الطقم؟')],
      intents: [
        order('order'),
        { id: 'ask_set', any: ['セット', 'せっと', 'なに', '何'], stay: true, reply: L('抹茶|と|秋|の|和菓子|の|セット|です。|今日|は|栗きんとん|です|よ。', 'Matcha with an autumn wagashi. Today it is kuri kinton, a chestnut sweet.', 'ماتشا مع حلوى خريفية. اليوم هي كوري كينتون، حلوى الكستناء.') },
        later(),
      ],
    }),
    node({
      id: 'served',
      step: 'order',
      emotion: 'happy',
      say: [say(L('お待たせしました。|{matcha}|です。|どうぞ。', 'Thank you for waiting. Here is your {matcha}.', 'شكرًا على انتظارك. تفضّل {matcha}.'))],
      suggestions: [S('とても|おいしい|です！', 'It is very good!', 'إنه لذيذ جدًا!'), S('栗きんとん|が|おいしい|です。', 'The kuri kinton is delicious.', 'الكوري كينتون لذيذة.'), S('きれい|な|お菓子|です|ね。', 'What a beautiful sweet.', 'يا لها من حلوى جميلة.')],
      intents: [
        { id: 'compliment', any: ['おいしい', '美味しい', 'きれい', 'すてき', 'すごい', 'いい'], next: 'more', step: 'compliment', ideal: L('とても|おいしい|です！', 'It is very good!', 'إنه لذيذ جدًا!') },
        again('served'),
      ],
    }),
    node({
      id: 'more',
      step: 'compliment',
      emotion: 'happy',
      say: [say(L('ありがとうございます。|ほか|に|何か|ございます|か？', 'Thank you. Is there anything else?', 'شكرًا. هل من شيء آخر؟'))],
      suggestions: [S('おすすめ|の|お土産|は|何|です|か？', 'What souvenir do you recommend?', 'أي هدية تذكارية تنصحين بها؟'), S('お会計|を|お願いします。', 'The bill, please.', 'الحساب من فضلك.'), REPEAT_S],
      intents: [askReco('reco', 'reco'), bill, again('more')],
    }),
    node({
      id: 'reco',
      step: 'reco',
      emotion: 'excited',
      say: [say(L('八ツ橋|が|おすすめ|です。|京都|の|お土産|で|一番|人気|です|よ。|お友達|に|いかが|です|か？', 'I recommend yatsuhashi, the most popular souvenir of Kyoto. How about some for a friend?', 'أنصحك بالياتسوهاشي، أشهر هدية تذكارية من كيوتو. ما رأيك ببعضها لصديق؟'))],
      suggestions: [S('じゃあ、|八ツ橋|を|ください。', 'Then yatsuhashi, please.', 'إذن ياتسوهاشي من فضلك.'), S('友達|に|八ツ橋|を|買います。', 'I will buy yatsuhashi for a friend.', 'سأشتري ياتسوهاشي لصديق.'), THINK_S],
      intents: [buySouvenir, { id: 'think', any: ['かんがえます', 'けっこう', 'いいえ'], next: 'quote' }, bill, again('reco')],
    }),
    node({
      id: 'quote',
      say: totalLine(
        L('全部|で|{total}|です。|現金|か|ICカード|で|お願いします。', 'That is {total} in all. Cash or IC card, please.', 'المجموع {total}. نقدًا أو ببطاقة IC من فضلك.'),
        L('お会計|です|ね。|現金|か|ICカード|で|お願いします。', 'The bill, then. Cash or IC card, please.', 'الحساب إذن. نقدًا أو ببطاقة IC من فضلك.'),
      ),
      suggestions: [CASH_S, IC_S, HERE_S],
      intents: [
        { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'done' },
        { id: 'pay_ic', slot: 'payMethod', slotOptions: ['ic'], slotRequired: true, next: 'done' },
        { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['かーど', 'カード'], next: 'done' },
        { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, stay: true, reply: L('すみません。|カード|は|使えません。|現金|か|ICカード|で|お願いします。', 'I am sorry. We cannot take a credit card. Cash or IC card, please.', 'آسفة. لا نقبل بطاقة الائتمان. نقدًا أو ببطاقة IC من فضلك.') },
        { ...buySouvenir, id: 'add_souvenir', next: 'quote' },
        { id: 'ask_price', any: ['いくら', 'ねだん'], next: 'quote' },
      ],
    }),
    node({
      id: 'done',
      end: true,
      step: 'pay',
      emotion: 'happy',
      econ: 'charge',
      onShort: 'short',
      say: [say(L('ありがとうございました。|また|京都|に|来て|ください|ね。', 'Thank you very much. Please come to Kyoto again.', 'شكرًا جزيلًا. تعال إلى كيوتو مرة أخرى.'))],
      intents: [],
    }),
    node({
      id: 'short',
      say: [say(SOLD_OUT_LINE, { flag: 'sold_out' }), say(SHORT_LINE)],
      suggestions: [LATER_S, THINK_S, REPEAT_S],
      intents: [later(), again('short')],
    }),
    node({ id: 'leave', end: true, say: [say(L('わかりました。|また|どうぞ。', 'All right. Please come again.', 'حسنًا. تفضّل مرة أخرى.'))], intents: [] }),
  ]),
};

export const KYOTO_SCENARIOS: Scenario[] = [KYOTO_RYOKAN, KYOTO_TEMPLE, KYOTO_MATCHA];

/** The fixed prices the scenarios assume (equal the temple and café menu rows and g_yatsuhashi; checked in the tests). */
export const KYOTO_SCENARIO_PRICES = KYOTO_PRICES;
/** The yen amount said back in Japanese, for the tests of the price lines. */
export const kyotoYen = (yen: number) => ({ ja: yenToJa(yen).markup, en: yenEn(yen), ar: yenAr(yen) });
