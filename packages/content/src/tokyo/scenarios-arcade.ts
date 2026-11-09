import type { IntentDef, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// ゲームセンター「ピコピコ」 (the game centre on the south side): Shota is the friendly staff member by the crane machines. The Japanese to learn:
// asking for change (両替お願いします: a 1,000-yen note into ten 100-yen coins, 十枚), asking the price (一回いくらですか), saying how many goes
// (三回お願いします), and the very Japanese arcade custom of asking the staff to move a prize to an easier spot (取りやすくしてもらえますか) — the
// staff really do it, and the app gives the player a better claw for the plays bought in that conversation (intent `ask_assist`).
// A play is ¥100 (the menu id `arcade:play`, item slot `crane`, quantity slot `plays`); the game counts the plays (GameState.arcade).

const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const CASH_S = S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.');

const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます', 'いいです'], next: 'leave' });
/** a request for plays, wherever the player is: the quantity can come with it (三回お願いします) or be asked next */
const wantPlay = (next = 'how_many'): IntentDef => ({
  id: 'want_play',
  slot: 'crane',
  slotRequired: true,
  next,
  step: 'ask',
  request: true,
  ideal: L('クレーンゲーム|を|やりたい|です。', 'I would like to play the crane game.', 'أريد أن ألعب لعبة الرافعة.'),
});
const pickPlays: IntentDef = {
  id: 'pick_plays',
  slot: 'plays',
  slotRequired: true,
  // 「一回いくらですか？」 asks the price of a go: it buys nothing
  none: ['いくら', 'ねだん', '値段'],
  next: 'quote',
  step: 'plays',
  request: true,
  ideal: L('三回|お願いします。', 'Three goes, please.', 'ثلاث محاولات من فضلك.'),
};
const askChange: IntentDef = { id: 'ask_change', any: ['りょうがえ', '両替', 'ひゃくえんだま', '百円玉', 'こまかく'], next: 'change', step: 'change', request: true, ideal: L('両替|お願いします。', 'Change, please.', 'صرف النقود من فضلك.') };
const askPrice: IntentDef = { id: 'ask_price', any: ['いくら', 'ねだん'], next: 'price' };
/** the arcade custom: the staff move the prize closer to the chute; the app reads this intent for a better claw */
const askAssist: IntentDef = {
  id: 'ask_assist',
  any: ['とりやすく', '取りやすく', 'うごかして', '動かして', 'ちかく', '近く', 'てつだって', '手伝って'],
  next: 'assist',
  step: 'assist',
  request: true,
  ideal: L('すみません、|取りやすく|して|もらえますか？', 'Excuse me, could you make it easier to get?', 'عذرًا، هل يمكنك جعلها أسهل في الإمساك؟'),
};

export const ARCADE_CRANE: Scenario = {
  id: 'arcade_crane',
  locationId: 'arcade',
  characterId: 'shota',
  level: 'A1',
  title: { en: 'The crane game', ar: 'لعبة الرافعة' },
  setup: {
    en: 'You are at the game centre. Get change for the machines, ask how much a go is, buy some goes, and ask the staff to move the prize to an easier spot.',
    ar: 'أنت في صالة الألعاب. اصرف نقودًا للآلات، واسأل عن سعر المحاولة، واشترِ بعض المحاولات، واطلب من الموظف تحريك الجائزة إلى مكان أسهل.',
  },
  minutes: 3,
  steps: [
    { id: 'change', text: { en: 'Ask for change', ar: 'اطلب صرف النقود' } },
    { id: 'ask', text: { en: 'Say you want to play', ar: 'قل إنك تريد اللعب' } },
    { id: 'plays', text: { en: 'Say how many goes', ar: 'قل كم محاولة' } },
    { id: 'assist', text: { en: 'Ask him to move the prize closer', ar: 'اطلب منه تقريب الجائزة' } },
    { id: 'pay', text: { en: 'Pay in cash', ar: 'ادفع نقدًا' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('いらっしゃいませ！|ゲームセンター|ピコピコ|です。|クレーンゲーム、|やります|か？', 'Welcome! This is the Piko Piko game centre. Will you try the crane game?', 'أهلًا بك! هذه صالة ألعاب بيكو بيكو. هل ستجرّب لعبة الرافعة؟'))],
      suggestions: [
        S('両替|お願いします。', 'Change, please.', 'صرف النقود من فضلك.'),
        S('一回|いくら|です|か？', 'How much is one go?', 'كم سعر المحاولة الواحدة؟'),
        S('クレーンゲーム|を|やりたい|です。', 'I would like to play the crane game.', 'أريد أن ألعب لعبة الرافعة.'),
      ],
      intents: [askChange, askPrice, pickPlays, wantPlay(), askAssist, later()],
    }),
    // change: a 1,000-yen note into ten 100-yen coins (no money moves: the machines take 100-yen coins)
    node({
      id: 'change',
      say: [say(L('両替|です|ね。|千円札|を|百円玉|十|枚|に|します。|はい、|どうぞ！', 'Change, right. I will make your 1,000-yen note into ten 100-yen coins. Here you are!', 'صرف، حسنًا. سأحوّل ورقة الـ 1,000 ين إلى عشر قطع من فئة 100 ين. تفضّل!'))],
      suggestions: [S('クレーンゲーム|を|やりたい|です。', 'I would like to play the crane game.', 'أريد أن ألعب لعبة الرافعة.'), S('ありがとう|ございます。', 'Thank you very much.', 'شكرًا جزيلًا.'), S('一回|いくら|です|か？', 'How much is one go?', 'كم سعر المحاولة الواحدة؟')],
      intents: [askPrice, pickPlays, wantPlay(), { id: 'thanks', any: ['ありがとう'], next: 'price' }, askAssist, later()],
    }),
    node({
      id: 'price',
      say: [say(L('一回|百|円|です。|景品|は|ぬいぐるみ|と|ねこ忍者|の|フィギュア|です|よ。|何回|やります|か？', 'One go is 100 yen. The prizes are plush toys and Cat Ninja figures. How many goes will you have?', 'المحاولة الواحدة بـ 100 ين. الجوائز دمى محشوة ومجسّمات القط النينجا. كم محاولة ستلعب؟'))],
      suggestions: [S('三回|お願いします。', 'Three goes, please.', 'ثلاث محاولات من فضلك.'), S('一回|お願いします。', 'One go, please.', 'محاولة واحدة من فضلك.'), REPEAT_S],
      intents: [pickPlays, wantPlay('how_many'), askAssist, later()],
    }),
    node({
      id: 'how_many',
      say: [say(L('はい！|何回|に|します|か？|一回|百|円|です。', 'Sure! How many goes? One go is 100 yen.', 'بالتأكيد! كم محاولة؟ المحاولة الواحدة بـ 100 ين.'))],
      suggestions: [S('三回|お願いします。', 'Three goes, please.', 'ثلاث محاولات من فضلك.'), S('二回|お願いします。', 'Two goes, please.', 'محاولتان من فضلك.'), S('一回|お願いします。', 'One go, please.', 'محاولة واحدة من فضلك.')],
      intents: [pickPlays, askPrice, later()],
    }),
    node({
      id: 'quote',
      say: [
        say(L('{plays}|です|ね。|{total}|です。|現金|で|お願いします。', '{plays}, right. That is {total}. Cash, please.', '{plays}، حسنًا. المبلغ {total}. نقدًا من فضلك.'), { flag: 'priced' }),
        say(L('三回|です|ね。|三|百|円|です。|現金|で|お願いします。', 'Three goes, right. That is 300 yen. Cash, please.', 'ثلاث محاولات، حسنًا. المبلغ 300 ين. نقدًا من فضلك.'), { slot: 'plays', in: ['three'] }),
        say(L('二回|です|ね。|二|百|円|です。|現金|で|お願いします。', 'Two goes, right. That is 200 yen. Cash, please.', 'محاولتان، حسنًا. المبلغ 200 ين. نقدًا من فضلك.'), { slot: 'plays', in: ['two'] }),
        say(L('一回|です|ね。|百|円|です。|現金|で|お願いします。', 'One go, right. That is 100 yen. Cash, please.', 'محاولة واحدة، حسنًا. المبلغ 100 ين. نقدًا من فضلك.')),
      ],
      suggestions: [S('すみません、|取りやすく|して|もらえますか？', 'Excuse me, could you make it easier to get?', 'عذرًا، هل يمكنك جعلها أسهل في الإمساك؟'), CASH_S, S('はい、|どうぞ。', 'Yes, here you are.', 'نعم، تفضّل.')],
      intents: [
        { id: 'pay', any: ['げんきん', '現金', 'どうぞ', 'はい', 'おねがい'], none: ['いいえ'], next: 'done' },
        askAssist,
        later(),
      ],
    }),
    // the arcade custom: he moves the prize closer to the chute (the app's claw is kinder for the plays of this visit)
    node({
      id: 'assist',
      emotion: 'happy',
      say: [say(L('いい|です|よ！|少し|動かします|ね。|…はい、|これ|で|取りやすい|です|よ。', 'Sure! I will move it a little. ...There, it is easier to get now.', 'بالتأكيد! سأحرّكها قليلًا. ...ها هي، أصبحت أسهل الآن.'))],
      suggestions: [CASH_S, S('ありがとう|ございます！', 'Thank you very much!', 'شكرًا جزيلًا!'), S('三回|お願いします。', 'Three goes, please.', 'ثلاث محاولات من فضلك.')],
      intents: [
        pickPlays,
        { id: 'pay', any: ['げんきん', '現金', 'どうぞ'], next: 'done' },
        { id: 'thanks', any: ['ありがとう'], next: 'how_many' },
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
      say: [say(L('ありがとう|ございます！|がんばって|ください！|取れたら|教えて|ください|ね。', 'Thank you! Good luck! Tell me if you get one.', 'شكرًا! بالتوفيق! أخبرني إن أمسكت واحدة.'))],
      intents: [],
    }),
    node({
      id: 'short',
      say: [say(L('すみません、|少し|足りません。', 'Sorry, that is a little short.', 'آسف، المبلغ ناقص قليلًا.'))],
      suggestions: [LATER_S, S('一回|お願いします。', 'One go, please.', 'محاولة واحدة من فضلك.')],
      intents: [later(), pickPlays],
    }),
    node({ id: 'leave', end: true, say: [say(L('はい！|また|どうぞ！', 'Okay! Come again!', 'حسنًا! تعال مرة أخرى!'))], intents: [] }),
  ]),
};

export const ARCADE_SCENARIOS: Scenario[] = [ARCADE_CRANE];
