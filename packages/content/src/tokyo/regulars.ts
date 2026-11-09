import type { IntentDef, Line, Scenario, Suggestion } from '../types';
import { L, S, say } from './dsl';

// Shopkeepers who know you (docs/ROADMAP.md, "better conversations"). The app starts a shop conversation that was played before with the
// flag `regular`, and on every other return visit, when you bought something there, with `remembers` and the var {last} (that item, as its
// slot option). Each shop's opening node then:
//  - greets a regular in the shopkeeper's own voice (「あ、また来てくれたんですね！」),
//  - or asks about what you bought last time (「前回のメロンパン、どうでしたか？」, Daichi: 「前回の赤いねこ忍者、元気にしていますか？」),
//  - offers two answer chips while it remembers (a good answer and a so-so one), understands those answers in your own words and replies
//    before you order (the answer turns `remembers` off: the chips go),
//  - understands 「また来ました」 from a regular.
// The scenarios themselves are unchanged: `withRegulars` adds these to the opening node when the registry builds SCENARIOS.

interface Regular {
  /** the greeting for a returning customer (flag `regular`) */
  regular: Line;
  /** the question about the last purchase (flag `remembers`, reads {last}) */
  remembers?: Line;
  /** the replies to a good and to a so-so answer */
  good?: Line;
  meh?: Line;
  /** the answer chips shown while remembering: a good one, a so-so one */
  chips?: [Suggestion, Suggestion];
  /** the reply to 「また来ました」 */
  back?: Line;
}

const FOOD_CHIPS: [Suggestion, Suggestion] = [S('おいしかった|です！', 'It was delicious!', 'كان لذيذًا!'), S('まあまあ|でした。', 'It was OK.', 'كان مقبولًا.')];
const THING_CHIPS: [Suggestion, Suggestion] = [S('とても|気に入って|います！', 'I really like it!', 'يعجبني كثيرًا!'), S('まあまあ|です。', 'It is OK.', 'لا بأس به.')];
const BACK = L('ありがとう|ございます！', 'Thank you!', 'شكرًا!');

/** scenario id -> what its shopkeeper says to a regular */
export const REGULARS: Record<string, Regular> = {
  cafe: {
    regular: L('あ、|また|来て|くれた|んです|ね！|いらっしゃいませ。|ご注文|は？', 'Oh, you came again! Welcome. What would you like?', 'أوه، أتيت مجددًا! أهلًا بك. ماذا تطلب؟'),
    remembers: L('いらっしゃいませ！|前回|の|{last}、|どう|でした|か？', 'Welcome! How was the {last} last time?', 'أهلًا بك! كيف كان {last} في المرة الماضية؟'),
    good: L('よかった！|今日|は|何|に|します|か？', 'Great! What will you have today?', 'رائع! ماذا ستطلب اليوم؟'),
    meh: L('そう|です|か。|じゃあ、|今日|は|別|の|もの|を|どうぞ。', 'I see. Then try something else today.', 'فهمت. إذن جرّب شيئًا آخر اليوم.'),
    chips: FOOD_CHIPS,
  },
  konbini: {
    regular: L('いらっしゃいませ！|あ、|いつも|ありがとう|ございます。', 'Welcome! Oh, thank you for always coming.', 'أهلًا بك! أوه، شكرًا لأنك تأتي دائمًا.'),
    remembers: L('いらっしゃいませ！|前回|の|{last}、|どう|でした|か？', 'Welcome! How was the {last} last time?', 'أهلًا بك! كيف كان {last} في المرة الماضية؟'),
    good: L('よかった|です！|ごゆっくり|どうぞ。', 'Glad to hear it! Take your time.', 'يسعدني ذلك! خذ وقتك.'),
    meh: L('そう|です|か。|今日|は|新しい|の|も|あります|よ。', 'I see. We have new ones today too.', 'فهمت. عندنا أشياء جديدة اليوم أيضًا.'),
    chips: FOOD_CHIPS,
  },
  ramen: {
    regular: L('おっ、|また|来て|くれた|ね！|いらっしゃい！|何|に|します|か？', 'Oh, you came back! Welcome! What will you have?', 'أوه، عدت! أهلًا! ماذا ستطلب؟'),
    remembers: L('いらっしゃい！|前回|の|{last}、|うまかった|か？', 'Welcome! Was the {last} good last time?', 'أهلًا! هل كان {last} لذيذًا في المرة الماضية؟'),
    good: L('そう|か、|よかった！|今日|は|何|に|します|か？', 'Is that so, great! What will you have today?', 'حقًا، رائع! ماذا ستطلب اليوم؟'),
    meh: L('そう|か…。|じゃあ、|今日|は|ほか|の|味|も|どうぞ。', 'I see... Then try another flavour today.', 'فهمت... إذن جرّب نكهة أخرى اليوم.'),
    chips: FOOD_CHIPS,
    back: L('ありがとう！|うれしい|ね。', 'Thanks! That makes me happy.', 'شكرًا! هذا يسعدني.'),
  },
  station_ic: {
    regular: L('こんにちは。|また|お会い|しました|ね。|どうしましたか？', 'Hello. We meet again. How can I help?', 'مرحبًا. نلتقي مجددًا. كيف أساعدك؟'),
  },
  karaoke_desk: {
    regular: L('いらっしゃいませ！|あ、|また|歌い|に|来て|くれた|んです|ね！|何名様|です|か？', 'Welcome! Oh, you came to sing again! How many people?', 'أهلًا بك! أوه، أتيت لتغنّي مجددًا! كم عددكم؟'),
  },
  arcade_crane: {
    regular: L('いらっしゃいませ！|あ、|また|来て|くれた|んです|ね！|今日|も|クレーンゲーム、|やります|か？', 'Welcome! Oh, you came again! Playing the crane game today too?', 'أهلًا بك! أوه، أتيت مجددًا! هل ستلعب لعبة الرافعة اليوم أيضًا؟'),
  },
  hobby_figures: {
    regular: L('いらっしゃいませ！|あ、|また|来て|くれた|んです|ね！|うれしい|です。', 'Welcome! Oh, you came again! I am so happy.', 'أهلًا بك! أوه، أتيت مجددًا! هذا يسعدني جدًا.'),
    remembers: L('いらっしゃいませ！|前回|の|{last}、|元気|に|して|います|か？', 'Welcome! Is the {last} from last time doing well?', 'أهلًا بك! هل {last} من المرة الماضية بخير؟'),
    good: L('よかった！|大事|に|して|ください|ね。', 'Great! Take good care of it.', 'رائع! اعتنِ به جيدًا.'),
    meh: L('そう|です|か…。|今日|は|ほか|の|も|見て|みて|ください。', 'I see... Have a look at the others today.', 'فهمت... ألقِ نظرة على غيره اليوم.'),
    chips: [S('元気|です！|とても|気に入って|います。', 'It is doing well! I really like it.', 'إنه بخير! يعجبني كثيرًا.'), S('まあまあ|です。', 'It is OK.', 'لا بأس به.')],
  },
  denki_phone: {
    regular: L('いらっしゃいませ。|あ、|また|来て|くださった|んです|ね。', 'Welcome. Oh, you have come again.', 'أهلًا بك. أوه، أتيت مجددًا.'),
    remembers: L('いらっしゃいませ。|前回|の|{last}、|いかが|です|か？', 'Welcome. How is the {last} from last time?', 'أهلًا بك. كيف حال {last} من المرة الماضية؟'),
    good: L('それ|は|よかった|です。|今日|は|何|を|お探し|でしょうか？', 'I am glad. What are you looking for today?', 'يسعدني ذلك. عمّ تبحث اليوم؟'),
    meh: L('そう|です|か…。|何|か|あれば、|いつでも|聞いて|ください|ね。', 'I see... If anything comes up, ask me any time.', 'فهمت... إن احتجت شيئًا، اسألني في أي وقت.'),
    chips: THING_CHIPS,
  },
  fuku_clothes: {
    regular: L('いらっしゃいませ！|あ、|また|来て|くれた|んです|ね！', 'Welcome! Oh, you came again!', 'أهلًا بك! أوه، أتيت مجددًا!'),
    remembers: L('いらっしゃいませ！|前回|の|{last}、|どう|です|か？', 'Welcome! How is the {last} from last time?', 'أهلًا بك! كيف حال {last} من المرة الماضية؟'),
    good: L('よかった！|今日|は|何|か|お探し|です|か？', 'Great! Are you looking for something today?', 'رائع! هل تبحث عن شيء اليوم؟'),
    meh: L('そう|です|か。|じゃあ、|今日|は|別|の|も|見て|みて|ください！', 'I see. Then have a look at something else today!', 'فهمت. إذن ألقِ نظرة على شيء آخر اليوم!'),
    chips: THING_CHIPS,
  },
  fuku_home: {
    regular: L('いらっしゃいませ！|あ、|また|来て|くれた|んです|ね！', 'Welcome! Oh, you came again!', 'أهلًا بك! أوه، أتيت مجددًا!'),
    remembers: L('いらっしゃいませ！|前回|の|{last}、|使って|います|か？', 'Welcome! Are you using the {last} from last time?', 'أهلًا بك! هل تستخدم {last} من المرة الماضية؟'),
    good: L('よかった！|今日|は|何|か|お探し|です|か？', 'Great! Are you looking for something today?', 'رائع! هل تبحث عن شيء اليوم؟'),
    meh: L('そう|です|か。|じゃあ、|今日|は|別|の|も|見て|みて|ください！', 'I see. Then have a look at something else today!', 'فهمت. إذن ألقِ نظرة على شيء آخر اليوم!'),
    chips: THING_CHIPS,
  },
  aiko_tea: {
    regular: L('いらっしゃいませ。|また|来て|くれた|の|ね。|ゆっくり|どうぞ。', 'Welcome. You came again. Take your time.', 'أهلًا بك. أتيت مجددًا. خذ وقتك.'),
    remembers: L('いらっしゃいませ。|前回|の|{last}、|喜んで|もらえました|か？', 'Welcome. Did they like the {last} from last time?', 'أهلًا بك. هل أعجبهم {last} من المرة الماضية؟'),
    good: L('まあ、|よかった。|今日|も|プレゼント|です|か？', 'Oh, how nice. Is it a present today too?', 'ما أجمل ذلك. هل هي هدية اليوم أيضًا؟'),
    meh: L('そう|でした|か。|今日|は|ほか|の|も|見て|みて|ね。', 'I see. Have a look at the others today.', 'فهمت. ألقِ نظرة على غيره اليوم.'),
    chips: [S('はい、|とても|喜んで|もらえました！', 'Yes, they loved it!', 'نعم، أحبّوه كثيرًا!'), S('まあまあ|でした。', 'It was OK.', 'كان مقبولًا.')],
  },
  motors_bike: {
    regular: L('いらっしゃいませ。|あ、|また|来て|くれた|んです|ね。', 'Welcome. Oh, you came again.', 'أهلًا بك. أوه، أتيت مجددًا.'),
    remembers: L('いらっしゃいませ。|前回|の|{last}、|調子|は|どう|です|か？', 'Welcome. How is the {last} from last time running?', 'أهلًا بك. كيف حال {last} من المرة الماضية؟'),
    good: L('それ|は|よかった！|今日|は|何|を|お探し|です|か？', 'Glad to hear it! What are you looking for today?', 'يسعدني ذلك! عمّ تبحث اليوم؟'),
    meh: L('そう|です|か。|何|か|あったら、|いつでも|見ます|よ。', 'I see. If anything goes wrong, I will look at it any time.', 'فهمت. إن حدث شيء، سأفحصه في أي وقت.'),
    chips: [S('とても|調子|が|いい|です！', 'It runs really well!', 'يعمل بشكل ممتاز!'), S('まあまあ|です。', 'It is OK.', 'لا بأس به.')],
  },
  motors_car: {
    regular: L('いらっしゃいませ。|あ、|また|来て|くれた|んです|ね。', 'Welcome. Oh, you came again.', 'أهلًا بك. أوه، أتيت مجددًا.'),
    remembers: L('いらっしゃいませ。|前回|の|{last}、|調子|は|どう|です|か？', 'Welcome. How is the {last} from last time running?', 'أهلًا بك. كيف حال {last} من المرة الماضية؟'),
    good: L('それ|は|よかった！|今日|は|何|を|お探し|です|か？', 'Glad to hear it! What are you looking for today?', 'يسعدني ذلك! عمّ تبحث اليوم؟'),
    meh: L('そう|です|か。|何|か|あったら、|いつでも|見ます|よ。', 'I see. If anything goes wrong, I will look at it any time.', 'فهمت. إن حدث شيء، سأفحصه في أي وقت.'),
    chips: [S('とても|調子|が|いい|です！', 'It runs really well!', 'يعمل بشكل ممتاز!'), S('まあまあ|です。', 'It is OK.', 'لا بأس به.')],
  },
  matsuri_stalls: {
    regular: L('おっ、|また|来て|くれた|ね！|楽しんで|います|か？', 'Oh, you came back! Are you having fun?', 'أوه، عدت! هل تستمتع؟'),
    back: L('ありがとう！|うれしい|ね。', 'Thanks! That makes me happy.', 'شكرًا! هذا يسعدني.'),
  },
  sento_desk: {
    regular: L('おっ、|また|来て|くれた|ね！|大人|一人|です|か？', 'Oh, you came again! One adult?', 'أوه، أتيت مجددًا! شخص بالغ واحد؟'),
    back: L('ありがとう！|うれしい|ね。', 'Thanks! That makes me happy.', 'شكرًا! هذا يسعدني.'),
  },
  sento_after: {
    regular: L('おっ、|今日|も|上がりました|ね。|いい|お湯|でした|か？', 'Oh, out of the bath again today. Was the bath nice?', 'أوه، خرجت من الحمّام اليوم أيضًا. هل كان الحمّام لطيفًا؟'),
  },
};
const GOOD_KEYS = ['おいしかった', '美味しかった', 'うまかった', 'よかった', '良かった', 'きにいって', '気に入って', 'げんき', '元気', 'よろこんで', '喜んで', 'ちょうしがいい', '調子がいい', 'さいこう', '最高', 'だいすき', '大好き', 'つかって', '使って', 'すごくいい', 'とてもいい'];
const MEH_KEYS = ['まあまあ', 'ふつう', '普通', 'いまいち', 'あんまり', 'あまり'];
const AGAIN_KEYS = ['またきました', 'また来ました', 'またきたよ', 'また来たよ'];

/** The opening node of a shop conversation with the regular's greeting, the remembered purchase and their answers added. */
export function withRegulars(sc: Scenario): Scenario {
  const r = REGULARS[sc.id];
  const start = sc.nodes[sc.start];
  if (!r || !start) return sc;
  const intents: IntentDef[] = [];
  if (r.remembers && r.good) {
    intents.push({ id: 'last_good', when: { flag: 'remembers' }, unflag: 'remembers', any: GOOD_KEYS, none: ['いいえ', ...MEH_KEYS], stay: true, reply: r.good });
  }
  if (r.remembers && r.meh) intents.push({ id: 'last_meh', when: { flag: 'remembers' }, unflag: 'remembers', any: MEH_KEYS, stay: true, reply: r.meh });
  intents.push({ id: 'back_again', when: { flag: 'regular' }, any: AGAIN_KEYS, stay: true, reply: r.back ?? BACK });
  const chips: Suggestion[] = r.remembers && r.chips ? r.chips.map((c) => ({ ...c, when: { flag: 'remembers' } })) : [];
  return {
    ...sc,
    nodes: {
      ...sc.nodes,
      [sc.start]: {
        ...start,
        say: [...(r.remembers ? [say(r.remembers, { flag: 'remembers' })] : []), say(r.regular, { flag: 'regular' }), ...start.say],
        suggestions: [...chips, ...(start.suggestions ?? [])],
        intents: [...start.intents, ...intents],
      },
    },
  };
}
