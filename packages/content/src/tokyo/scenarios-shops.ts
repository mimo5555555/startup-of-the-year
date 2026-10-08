import type { IntentDef, Line, SayVariant, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// Station scenarios (agent 2G, docs/GAME_DESIGN.md §6.3): `station_ic` buys and tops up the IC card (and pays a balance back) and
// `sato_directions` asks the way inside the station. Both are Sato's; the info scenario `station` stays in scenarios.ts.
//
// Money. `station_ic` is a shop scenario whose `charge` node moves yen: the game's hooks (apps/mobile/src/game/icHooks.ts) read the
// slot `icService` (card | charge | refund) and `chargeAmount` and either buy the card and load it, top the card up, or refund the
// balance. Prices come only from Vars ({price} the deposit, {total}, {limit} the IC cap, {balance}, {fee}); without hooks (a session
// that does not set `flags.priced`) every line falls back to its fixed wording, so the scenario also runs bare.

/** A price line: the live one (Vars from the hooks) when the app sets `flags.priced`, the fixed wording otherwise. */
const priced = (live: Line, legacy: Line): SayVariant[] => [say(live, { flag: 'priced' }), say(legacy)];

/** Taught polite refusal (`cc_refuse`): the way out of every scenario that costs something. */
const later = (next = 'leave'): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next });
const LEAVE_LINE = L('わかりました。|また|どうぞ。', 'Understood. Please come again.', 'حسنًا. تفضّل مرة أخرى.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const AMOUNT_S = {
  1000: S('千|円|お願いします。', '1,000 yen, please.', 'ألف ين من فضلك.'),
  2000: S('二|千|円|お願いします。', '2,000 yen, please.', 'ألفا ين من فضلك.'),
  3000: S('三千|円|お願いします。', '3,000 yen, please.', 'ثلاثة آلاف ين من فضلك.'),
};
const YES_KEYS = ['はい', 'おねがい', 'どうぞ'];

// ---------- 1. Buy and top up an IC card ----------
const CASH_ONLY: IntentDef = {
  id: 'pay_other',
  slot: 'payMethod',
  slotOptions: ['card', 'ic'],
  slotRequired: true,
  stay: true,
  reply: L('チャージ|は|現金|だけ|です。', 'Top-ups are cash only.', 'الشحن بالنقود فقط.'),
};

const pickAmount: IntentDef = {
  id: 'pick_amount',
  slot: 'chargeAmount',
  slotRequired: true,
  // the hook refuses an amount the card cannot hold (§4.1 IC cap): Sato says how much it takes
  econ: 'ask_total',
  next: 'quote',
  nextIfNo: 'over',
  request: true,
  ideal: L('{chargeAmount}|お願いします。', '{chargeAmount}, please.', '{chargeAmount} من فضلك.'),
};

export const STATION_IC: Scenario = {
  id: 'station_ic',
  locationId: 'station',
  characterId: 'sato',
  level: 'A1',
  title: { en: 'Buy and top up an IC card', ar: 'اشترِ بطاقة IC واشحنها' },
  setup: {
    en: 'You are at the station counter. Ask Sato-san for an IC card or a top-up, say how much, and pay in cash.',
    ar: 'أنت عند شباك المحطة. اطلب من السيد ساتو بطاقة IC أو شحنًا، وقل المبلغ، ثم ادفع نقدًا.',
  },
  minutes: 3,
  steps: [
    { id: 'want', text: { en: 'Ask for an IC card or a top-up', ar: 'اطلب بطاقة IC أو شحنًا' } },
    { id: 'amount', text: { en: 'Say how much to load', ar: 'قل كم تريد أن تشحن' } },
    { id: 'pay', text: { en: 'Pay in cash', ar: 'ادفع نقدًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      say: [say(L('こんにちは。|どうしましたか？', 'Hello. How can I help you?', 'مرحبًا. كيف يمكنني مساعدتك؟'))],
      suggestions: [
        S('ICカード|を|ください。', 'An IC card, please.', 'بطاقة IC من فضلك.'),
        S('チャージ|を|お願いします。', 'Please top up my card.', 'اشحن البطاقة من فضلك.'),
        S('払い戻し|を|お願いします。', 'A refund, please.', 'استرداد المبلغ من فضلك.'),
      ],
      intents: [
        {
          id: 'buy_card',
          slot: 'icService',
          slotOptions: ['card'],
          slotRequired: true,
          none: ['チャージ', 'ちゃーじ', 'はらいもどし', '払い戻し'],
          next: 'explain',
          step: 'want',
          request: true,
          ideal: L('ICカード|を|ください。', 'An IC card, please.', 'بطاقة IC من فضلك.'),
        },
        {
          id: 'top_up',
          slot: 'icService',
          slotOptions: ['charge'],
          slotRequired: true,
          // 「千円チャージをお願いします」 fills the amount too; Sato still asks, which is the line the learner practises
          alsoSlots: ['chargeAmount'],
          none: ['はらいもどし', '払い戻し'],
          next: 'amount',
          step: 'want',
          request: true,
          ideal: L('チャージ|を|お願いします。', 'Please top up my card.', 'اشحن البطاقة من فضلك.'),
        },
        {
          id: 'refund',
          slot: 'icService',
          slotOptions: ['refund'],
          slotRequired: true,
          next: 'refund_ask',
          request: true,
          ideal: L('払い戻し|を|お願いします。', 'A refund, please.', 'استرداد المبلغ من فضلك.'),
        },
        { id: 'ask_price', any: ['いくら'], next: 'explain' },
      ],
    }),
    node({
      id: 'explain',
      say: priced(
        L('ICカード|は|便利|です|よ。|ピッと|乗れます。|デポジット|は|{price}|です。', 'An IC card is handy. You just beep and board. The deposit is {price}.', 'بطاقة IC مريحة. تمرّرها وتصعد. الوديعة {price}.'),
        L('ICカード|は|便利|です|よ。|ピッと|乗れます。|デポジット|は|五|百|円|です。', 'An IC card is handy. You just beep and board. The deposit is 500 yen.', 'بطاقة IC مريحة. تمرّرها وتصعد. الوديعة 500 ين.'),
      ),
      suggestions: [S('わかりました。', 'I understand.', 'فهمت.'), S('お願いします。', 'Please.', 'من فضلك.'), REPEAT_S],
      intents: [{ id: 'ok_explain', any: ['わかりました', 'はい', 'おねがい', 'だいじょうぶ'], next: 'amount' }, later()],
    }),
    node({
      id: 'amount',
      say: [say(L('おいくら|チャージ|します|か？', 'How much would you like to load?', 'كم تريد أن تشحن؟'))],
      suggestions: [AMOUNT_S[1000], AMOUNT_S[2000], AMOUNT_S[3000]],
      intents: [pickAmount, later()],
    }),
    node({
      id: 'quote',
      step: 'amount',
      say: priced(
        L('全部で|{total}|です。|現金|です|か？', 'That is {total} in all. Cash?', 'المجموع {total}. نقدًا؟'),
        L('{chargeAmount}|チャージ|です|ね。|現金|です|か？', '{chargeAmount} top-up. Cash?', 'شحن {chargeAmount}. نقدًا؟'),
      ),
      suggestions: [S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.'), S('はい、|お願いします。', 'Yes, please.', 'نعم من فضلك.'), REPEAT_S],
      intents: [
        { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'done' },
        { id: 'pay_ok', any: YES_KEYS, next: 'done' },
        CASH_ONLY,
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
      say: [say(L('はい、|チャージしました。|ありがとうございました。', 'There you are, your card is loaded. Thank you very much.', 'تفضّل، تم شحن بطاقتك. شكرًا جزيلًا.'))],
      intents: [],
    }),
    node({
      id: 'short',
      say: [say(L('あ、|お客様、|少し|足りません。', 'Oh, I am sorry, it is a little short.', 'عذرًا، المبلغ ناقص قليلًا.'))],
      suggestions: [LATER_S, AMOUNT_S[1000], THINK_S],
      intents: [later(), pickAmount],
    }),
    node({
      id: 'over',
      say: priced(
        L('ICカード|は|{limit}|まで|です。', 'The card can hold up to {limit}.', 'تتسع البطاقة حتى {limit}.'),
        L('ICカード|は|三千|円|まで|です。', 'The card can hold up to 3,000 yen.', 'تتسع البطاقة حتى 3000 ين.'),
      ),
      suggestions: [LATER_S, AMOUNT_S[1000], THINK_S],
      intents: [later(), pickAmount],
    }),
    node({
      id: 'refund_ask',
      say: priced(
        L('払い戻し|です|ね。|残高|は|{balance}|です。|手数料|が|{fee}|かかります。|よろしい|です|か？', 'A refund, I see. Your balance is {balance}. The fee is {fee}. Is that all right?', 'استرداد، حسنًا. رصيدك {balance}. الرسوم {fee}. هل هذا مناسب؟'),
        L('払い戻し|です|ね。|手数料|が|二|百|二|十|円|かかります。|よろしい|です|か？', 'A refund, I see. The fee is 220 yen. Is that all right?', 'استرداد، حسنًا. الرسوم 220 ين. هل هذا مناسب؟'),
      ),
      suggestions: [S('お願いします。', 'Please.', 'من فضلك.'), S('やめます。', 'I will not.', 'لا أريد.'), REPEAT_S],
      intents: [
        { id: 'refund_yes', any: YES_KEYS, next: 'refund_done', request: true },
        { id: 'refund_no', any: ['やめます', 'いいえ', 'かんがえます'], next: 'leave' },
      ],
    }),
    // a refund is never a goal step (§6.3): the node has no `step`
    node({
      id: 'refund_done',
      end: true,
      emotion: 'happy',
      econ: 'charge',
      onShort: 'refund_none',
      say: [say(L('はい、|払い戻ししました。|ありがとうございました。', 'There you are, your refund. Thank you very much.', 'تفضّل، تم الاسترداد. شكرًا جزيلًا.'))],
      intents: [],
    }),
    node({
      id: 'refund_none',
      say: [say(L('すみません、|払い戻し|は|できません。', 'I am sorry, I cannot refund that.', 'عذرًا، لا يمكنني الاسترداد.'))],
      suggestions: [S('わかりました。', 'I understand.', 'فهمت.'), S('ありがとうございます。', 'Thank you.', 'شكرًا جزيلًا.'), REPEAT_S],
      intents: [{ id: 'ok_none', any: ['わかりました', 'はい', 'ありがとう'], next: 'leave' }],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

// ---------- 2. Ask the way (右 / 左 / まっすぐ) ----------
/** Sato answers with a direction; the learner says it back (the step `repeat`), a wrong direction is corrected. */
const askThe = (id: string, options: string[], next: string): IntentDef => ({
  id,
  slot: 'stationSpot',
  slotOptions: options,
  slotRequired: true,
  next,
  step: 'ask',
  request: true,
  ideal: L('{stationSpot}|は|どこ|です|か？', 'Where is the {stationSpot}?', 'أين {stationSpot}؟'),
});

const sayBack = (dir: 'right' | 'left' | 'straight', word: string, other: string[], en: string, ar: string): IntentDef[] => [
  { id: `say_${dir}`, slot: 'direction', slotOptions: [dir], slotRequired: true, next: 'ok', step: 'repeat' },
  {
    id: `wrong_${dir}`,
    slot: 'direction',
    slotOptions: other,
    slotRequired: true,
    stay: true,
    reply: L(`いいえ、|${word}|です。`, `No, it is ${en}.`, `لا، ${ar}.`),
  },
  { id: `near_${dir}`, any: ['ちかい', 'とおい'], stay: true, reply: L('近い|です|よ。', 'It is close.', 'إنه قريب.') },
];

const direction = (id: string, line: Line, back: ReturnType<typeof S>, sayIt: IntentDef[]) =>
  node({ id, say: [say(line)], suggestions: [back, REPEAT_S, S('ありがとうございます。', 'Thank you.', 'شكرًا جزيلًا.')], intents: sayIt });

export const SATO_DIRECTIONS: Scenario = {
  id: 'sato_directions',
  locationId: 'station',
  characterId: 'sato',
  level: 'A2',
  title: { en: 'Ask the way in the station', ar: 'اسأل عن الطريق في المحطة' },
  setup: {
    en: 'You are lost in the station. Ask Sato-san where the exit, the toilet or the platform is, say his answer back to him, and thank him.',
    ar: 'أنت تائه في المحطة. اسأل السيد ساتو أين المخرج أو الحمام أو الرصيف، ثم أعد عليه جوابه، واشكره.',
  },
  minutes: 3,
  steps: [
    { id: 'ask', text: { en: 'Ask where something is', ar: 'اسأل أين يوجد شيء' } },
    { id: 'repeat', text: { en: 'Say the direction back (右, 左, まっすぐ)', ar: 'أعد الاتجاه (右، 左، まっすぐ)' } },
    { id: 'thanks', text: { en: 'Say thank you', ar: 'قل شكرًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      say: [say(L('こんにちは。|どうしましたか？', 'Hello. How can I help you?', 'مرحبًا. كيف يمكنني مساعدتك؟'))],
      suggestions: [
        S('出口|は|どこ|です|か？', 'Where is the exit?', 'أين المخرج؟'),
        S('トイレ|は|どこ|です|か？', 'Where is the toilet?', 'أين الحمام؟'),
        S('ホーム|は|どこ|です|か？', 'Where is the platform?', 'أين الرصيف؟'),
      ],
      intents: [askThe('ask_right', ['exit', 'ticketMachine'], 'dir_right'), askThe('ask_left', ['toilet'], 'dir_left'), askThe('ask_straight', ['platform', 'gate'], 'dir_straight')],
    }),
    direction(
      'dir_right',
      L('{stationSpot}|は|右|です。|右|に|曲がってください。', 'The {stationSpot} is on the right. Please turn right.', '{stationSpot} على اليمين. انعطف يمينًا من فضلك.'),
      S('右|です|ね。', 'On the right, yes?', 'على اليمين، صحيح؟'),
      sayBack('right', '右', ['left', 'straight'], 'on the right', 'على اليمين'),
    ),
    direction(
      'dir_left',
      L('{stationSpot}|は|左|です。|左|に|曲がってください。', 'The {stationSpot} is on the left. Please turn left.', '{stationSpot} على اليسار. انعطف يسارًا من فضلك.'),
      S('左|です|ね。', 'On the left, yes?', 'على اليسار، صحيح؟'),
      sayBack('left', '左', ['right', 'straight'], 'on the left', 'على اليسار'),
    ),
    direction(
      'dir_straight',
      L('{stationSpot}|は|まっすぐ|です。|あそこ|です。', 'The {stationSpot} is straight ahead, over there.', '{stationSpot} مباشرةً للأمام، هناك.'),
      S('まっすぐ|です|ね。', 'Straight ahead, yes?', 'مباشرةً للأمام، صحيح؟'),
      sayBack('straight', 'まっすぐ', ['right', 'left'], 'straight ahead', 'مباشرةً للأمام'),
    ),
    node({
      id: 'ok',
      say: [say(L('はい、|そうです。', 'Yes, that is right.', 'نعم، هذا صحيح.'))],
      suggestions: [S('ありがとうございます。', 'Thank you.', 'شكرًا جزيلًا.'), REPEAT_S],
      intents: [{ id: 'thanks_end', any: ['ありがとう'], next: 'end', step: 'thanks' }],
    }),
    node({
      id: 'end',
      end: true,
      emotion: 'happy',
      step: 'thanks',
      say: [say(L('どういたしまして。|お気をつけて。', "You're welcome. Take care.", 'عفوًا. اعتنِ بنفسك.'))],
      intents: [],
    }),
  ]),
};

/** Scenarios for the shops module (see docs/GAME_DESIGN.md). */
export const SHOPS_SCENARIOS: Scenario[] = [STATION_IC, SATO_DIRECTIONS];
