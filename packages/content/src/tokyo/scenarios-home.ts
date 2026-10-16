import type { IntentDef, Line, SayVariant, Scenario, SceneNode, Suggestion } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// The player's own room, the Ono-sō part (Release 2 wave B2, docs/GAME_DESIGN.md D12, D28, §6.3, §8.8): Aiko shows the room (`aiko_viewing`),
// the learner signs for it (`aiko_contract`, 18+) and a friend comes to the housewarming (`home_own_guest`, the learner is the host).
// The furniture shop is in `scenarios-fuku-home.ts`.
//
// HOST CONTRACT (the flags these scenarios read; without them every line is the adult, plain-polite one, so they also run on their own):
//   minor     the profile is under 18 (D28): `aiko_viewing` plays as a visit to Aiko's tea room next door. Her answers say nothing about renting.
//             The rent question cannot be a chip (a chip list has no flag), so it is typed-only: an adult may ask it, a child who types it hears
//             「それはちょっと…」.
//   casual    the guest friend speaks plain form (`home_own_guest`; Mio from ♥2, Yuki and Kenji from ♥3, Aiko never).
//   owned_already / sold_out   set by the game's `charge` hook for the contract (the room is already yours / cannot be rented).
// Money: the contract charges the catalog price of `home_room_ono` (¥60,000 = 敷金 ¥30,000 + 前家賃 ¥30,000) through the shop path; the
// numbers Aiko says (三万円, 六万円) are the design constants, checked against the catalog in `content/test/home-own.test.ts`.

/** The move-in cost: deposit (敷金) and the first month paid in advance (前家賃) are ¥30,000 each. Equal to the catalog row of `home_room_ono`. */
export const FLAT_DEPOSIT = 30000;
export const FLAT_FIRST_MONTH = 30000;
export const FLAT_MOVE_IN = FLAT_DEPOSIT + FLAT_FIRST_MONTH;

/** the minor variant first (the flag), then the adult line */
const byAge = (minor: Line, grown: Line): SayVariant[] => [say(minor, { flag: 'minor' }), say(grown)];
const same = (l: Line): SayVariant[] => [say(l)];

const THINK_S = S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.');
const LATER_S = S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.');
const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます', 'かんがえる'], next: 'leave' });
const LEAVE_LINE = L('はい。|ゆっくり|考えて|ください|ね。', 'All right. Please take your time to think.', 'حسنًا. خذ وقتك في التفكير من فضلك.');

// ---------------------------------------------------------------------------------------------------------------
// aiko_viewing: shoes, three questions, thanks
// ---------------------------------------------------------------------------------------------------------------

/** the questions of the viewing: slot `viewQ` options (typed or tapped), in the order of the chips */
export const VIEW_QUESTIONS = ['size', 'sun', 'quiet', 'since', 'rent'] as const;
type ViewQ = (typeof VIEW_QUESTIONS)[number];

/** Aiko's answer to each question: the adult line (the room for rent) and the minor line (her tea room next door) */
const ANSWERS: Record<ViewQ, { grown: Line; minor: Line }> = {
  size: {
    grown: L('六畳|です。|一人|に|は、|ちょうどいい|広さ|です|よ。', 'It is six tatami mats. It is just the right size for one person.', 'ست حصائر تاتامي. المساحة مناسبة تمامًا لشخص واحد.'),
    minor: L('六畳|です。|お客さん|が|たくさん|座れます|よ。', 'It is six tatami mats. Many guests can sit here.', 'ست حصائر تاتامي. يمكن أن يجلس هنا ضيوف كثيرون.'),
  },
  sun: {
    grown: L('日当たり|は|いい|です|よ。|朝|は、|とても|明るい|です。', 'It gets good sunlight. In the morning it is very bright.', 'الشمس جيدة هنا. في الصباح يكون المكان مشرقًا جدًا.'),
    minor: L('日当たり|は|いい|です|よ。|朝|は、|とても|明るい|です。', 'It gets good sunlight. In the morning it is very bright.', 'الشمس جيدة هنا. في الصباح يكون المكان مشرقًا جدًا.'),
  },
  quiet: {
    grown: L('静か|です|よ。|夜|は、|とても|静か|です。', 'It is quiet. At night it is very quiet.', 'المكان هادئ. في الليل يكون هادئًا جدًا.'),
    minor: L('静か|です|よ。|夜|は、|とても|静か|です。', 'It is quiet. At night it is very quiet.', 'المكان هادئ. في الليل يكون هادئًا جدًا.'),
  },
  since: {
    grown: L('この|部屋|は、|二十年前|から|あります。', 'This room has been here for twenty years.', 'هذه الغرفة موجودة منذ عشرين سنة.'),
    minor: L('この|茶室|は、|四十年前|から|あります。', 'This tea room has been here for forty years.', 'غرفة الشاي هذه موجودة منذ أربعين سنة.'),
  },
  rent: {
    grown: L('家賃|は|三|万|円|です。|あなた|は、|前家賃|だけ|で|いい|です|よ。', 'The rent is thirty thousand yen. For you, the advance rent is enough.', 'الإيجار ثلاثون ألف ين. بالنسبة لك تكفي الدفعة المقدمة.'),
    // a child is never told about rent: this line is only reached by typing the word
    minor: L('それ|は|ちょっと…。', 'Well, that is a little...', 'هذا... صعب قليلًا.'),
  },
};

const MORE = L('ほか|に|何|か|あります|か？', 'Is there anything else?', 'هل هناك شيء آخر؟');
const withMore = (a: Line): Line => L(`${a.ja}|${MORE.ja}`, `${a.en} ${MORE.en}`, `${a.ar} ${MORE.ar}`);
const HOW_ROOM = { grown: L('この|部屋|は|どう|です|か？', 'What do you think of this room?', 'ما رأيك في هذه الغرفة؟'), minor: L('この|茶室|は|どう|です|か？', 'What do you think of this tea room?', 'ما رأيك في غرفة الشاي هذه؟') };
const withHow = (a: Line, k: 'grown' | 'minor'): Line => L(`${a.ja}|${HOW_ROOM[k].ja}`, `${a.en} ${HOW_ROOM[k].en}`, `${a.ar} ${HOW_ROOM[k].ar}`);

const ASK_CHIPS: Suggestion[] = [
  S('何畳|です|か？', 'How many tatami mats is it?', 'كم حصيرة تاتامي مساحتها؟'),
  S('日当たり|は|いい|です|か？', 'Does it get good sunlight?', 'هل الشمس جيدة هنا؟'),
  S('静か|です|か？', 'Is it quiet?', 'هل المكان هادئ؟'),
  S('いつ|から|あります|か？', 'Since when has it been here?', 'منذ متى وهي موجودة؟'),
];

/** one question of the viewing: any of the five, routed to the answer node of that question in the next round */
const ask = (round: 1 | 2 | 3, next: (q: ViewQ) => string): IntentDef[] =>
  VIEW_QUESTIONS.map((q) => ({ id: `ask_${q}`, slot: 'viewQ', slotOptions: [q], slotRequired: true, next: next(q), step: `ask${round}` }));

/** the node that answers question `q` in round `r` and asks for the next one (round 3 asks how the learner likes the room instead) */
const answerNode = (round: 1 | 2 | 3, q: ViewQ): SceneNode => {
  const a = ANSWERS[q];
  const last = round === 3;
  return node({
    id: `a${round}_${q}`,
    emotion: 'happy',
    say: byAge(last ? withHow(a.minor, 'minor') : withMore(a.minor), last ? withHow(a.grown, 'grown') : withMore(a.grown)),
    suggestions: last
      ? [S('いい|部屋|です|ね。', 'It is a nice room.', 'إنها غرفة جميلة.'), S('見せて|くれて、|ありがとう|ございました。', 'Thank you for showing me.', 'شكرًا لأنك أريتني إياها.'), S('ありがとう|ございます。', 'Thank you very much.', 'شكرًا جزيلًا.')]
      : ASK_CHIPS,
    intents: last
      ? [{ id: 'thanks', any: ['ありがとう', 'いい', 'すてき', 'すき', 'きにいり', 'よかった', 'きれい', 'ひろい'], next: 'end', step: 'thanks' }, later()]
      : [...ask((round + 1) as 2 | 3, (x) => `a${round + 1}_${x}`), later()],
  });
};

/**
 * What a profile under 18 reads about the viewing (D28): the same scenario is a visit to Aiko's tea room next door, so the title and the setup
 * (shown in Prepare, over the conversation and in the debrief) say nothing about renting. The host swaps them in for a minor (`shownScenario`).
 */
export const VIEWING_MINOR_TEXT = {
  title: { en: "Visit Aiko's tea room", ar: 'زُر بيت شاي أيكو' },
  setup: {
    en: 'Aiko invites you to the tea room next door. Take your shoes off at the genkan, then ask her three questions about the room (its size, the sunlight, how quiet it is, how old it is) and thank her.',
    ar: 'تدعوك أيكو إلى غرفة الشاي المجاورة. اخلع حذاءك عند الجنكان، ثم اسألها ثلاثة أسئلة عن الغرفة (مساحتها وضوء الشمس وهدوؤها وعمرها) واشكرها.',
  },
} as const;

export const AIKO_VIEWING: Scenario = {
  id: 'aiko_viewing',
  locationId: 'ono',
  characterId: 'aiko',
  level: 'A2',
  title: { en: 'See the room at Ono-sō', ar: 'شاهد الغرفة في أونو-سو' },
  setup: {
    en: "Aiko shows you the room she can rent out at Ono-sō. Take your shoes off at the genkan, then ask her three questions about the room (its size, the sunlight, how quiet it is, how old it is) and thank her.",
    ar: 'تُريك أيكو الغرفة التي يمكنها تأجيرها في أونو-سو. اخلع حذاءك عند الجنكان، ثم اسألها ثلاثة أسئلة عن الغرفة (مساحتها وضوء الشمس وهدوؤها وعمرها) واشكرها.',
  },
  minutes: 5,
  steps: [
    { id: 'shoes', text: { en: 'Take your shoes off and step up', ar: 'اخلع حذاءك واصعد' } },
    { id: 'ask1', text: { en: 'Ask a first question', ar: 'اطرح السؤال الأول' } },
    { id: 'ask2', text: { en: 'Ask a second question', ar: 'اطرح السؤال الثاني' } },
    { id: 'ask3', text: { en: 'Ask a third question', ar: 'اطرح السؤال الثالث' } },
    { id: 'thanks', text: { en: 'Say what you think and thank her', ar: 'قل رأيك واشكرها' } },
  ],
  start: 'shoes',
  nodes: asRecord([
    // the genkan beat: the shoes come off, the slippers go on (the app's genkan buttons may already have been played; this works either way)
    node({
      id: 'shoes',
      emotion: 'happy',
      say: byAge(
        L('いらっしゃい。|ここ|が|隣|の|茶室|です|よ。|まず、|靴|を|脱いで|ください|ね。|スリッパ|も|どうぞ。', "Welcome. This is the tea room next door. First, please take your shoes off. Here are slippers too.", 'أهلًا. هذه غرفة الشاي المجاورة. أولًا، اخلع حذاءك من فضلك. وهذا خفّ البيت أيضًا.'),
        L('いらっしゃい。|ここ|が|小野荘|の|空いている|部屋|です|よ。|まず、|靴|を|脱いで|ください|ね。|スリッパ|も|どうぞ。', 'Welcome. This is the vacant room at Ono-sō. First, please take your shoes off. Here are slippers too.', 'أهلًا. هذه هي الغرفة الشاغرة في أونو-سو. أولًا، اخلع حذاءك من فضلك. وهذا خفّ البيت أيضًا.'),
      ),
      suggestions: [S('はい、|脱ぎます。', 'Yes, I will take them off.', 'نعم، سأخلعهما.'), S('おじゃまします。', 'Ojamashimasu (excuse me for coming in).', 'عن إذنك (أدخل).'), S('スリッパ、|ありがとう|ございます。', 'Thank you for the slippers.', 'شكرًا على الخفّ.')],
      intents: [
        { id: 'shoes_off', any: ['ぬぎ', 'ぬいで', 'おじゃま', 'すりっぱ', 'ありがとう', 'はい'], next: 'ask1', step: 'shoes' },
        later(),
      ],
    }),
    node({
      id: 'ask1',
      emotion: 'happy',
      say: byAge(
        L('どうぞ、|上がって|ください。|ここ|で|お茶|を|飲みます|よ。|何でも|聞いて|ください|ね。', 'Please come up. We drink tea here. Please ask me anything.', 'تفضّل بالصعود. نشرب الشاي هنا. اسألني عن أي شيء من فضلك.'),
        L('どうぞ、|上がって|ください。|畳|の|いい|部屋|でしょう？|何でも|聞いて|ください|ね。', 'Please come up. It is a nice tatami room, is it not? Please ask me anything.', 'تفضّل بالصعود. إنها غرفة تاتامي جميلة، أليس كذلك؟ اسألني عن أي شيء من فضلك.'),
      ),
      suggestions: ASK_CHIPS,
      intents: [...ask(1, (q) => `a1_${q}`), later()],
    }),
    ...([1, 2, 3] as const).flatMap((r) => VIEW_QUESTIONS.map((q) => answerNode(r, q))),
    node({
      id: 'end',
      emotion: 'happy',
      end: true,
      say: byAge(
        L('こちら|こそ、|ありがとう|ございました。|また|お茶|を|飲みに|来て|ください|ね。', 'Thank you too. Please come and have tea again.', 'شكرًا لك أيضًا. تعال لتشرب الشاي مجددًا من فضلك.'),
        L('こちら|こそ、|ありがとう|ございました。|気に入ったら、|また|声|を|かけて|ください|ね。', 'Thank you too. If you like it, please talk to me again.', 'شكرًا لك أيضًا. إن أعجبتك، كلّمني مجددًا من فضلك.'),
      ),
      suggestions: [S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.')],
      intents: [],
    }),
    node({ id: 'leave', end: true, say: same(LEAVE_LINE), suggestions: [S('ありがとう|ございました。', 'Thank you very much.', 'شكرًا جزيلًا.')], intents: [] }),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// aiko_contract: decide, say the total, sign, pay, keys (18+)
// ---------------------------------------------------------------------------------------------------------------

const TOTAL_S = S('六|万|円|です。', 'It is sixty thousand yen in total.', 'المجموع ستون ألف ين.');
const NAME_S = S('{name}|です。', 'I am {name}.', 'أنا {name}.');
/**
 * The amount the learner says goes to the game's `say_total` check (a number that is not the total is wrong). A bare number reads as its
 * numerals (「60000」 is ろくまん), so the round sums are keys too: 「六万」 and 「60000」 count as well as 「六万円」.
 */
const SUMS = ['10000', '20000', '30000', '40000', '50000', '60000', '70000', '80000', '90000', '100000'];
const AMOUNT = ['えん', '円', ...SUMS];
const sayTotal = (): IntentDef[] => [
  { id: 'say_total', any: AMOUNT, econ: 'say_total', next: 'sign', nextIfNo: 'wrong_total', step: 'deposit', request: true, ideal: L('六|万|円|です。', 'It is sixty thousand yen in total.', 'المجموع ستون ألف ين.') },
  { id: 'say_total_bare', any: ['です'], none: AMOUNT, econ: 'say_total', next: 'sign', nextIfNo: 'wrong_total', step: 'deposit' },
];

export const AIKO_CONTRACT: Scenario = {
  id: 'aiko_contract',
  locationId: 'ono',
  characterId: 'aiko',
  level: 'A2',
  title: { en: 'Sign for the room', ar: 'وقّع على الغرفة' },
  setup: {
    en: 'You like the room. Tell Aiko you will take it, say the move-in total (a deposit of 30,000 yen plus the first month of 30,000 yen), sign with your name, pay in cash and receive the key.',
    ar: 'أعجبتك الغرفة. أخبر أيكو أنك ستأخذها، وقل مجموع تكاليف الانتقال (وديعة 30,000 ين وإيجار الشهر الأول 30,000 ين)، ووقّع باسمك، وادفع نقدًا، واستلم المفتاح.',
  },
  minutes: 5,
  steps: [
    { id: 'decide', text: { en: 'Tell Aiko you will take the room', ar: 'أخبر أيكو أنك ستأخذ الغرفة' } },
    { id: 'deposit', text: { en: 'Say the total: deposit plus first month', ar: 'قل المجموع: الوديعة مع الشهر الأول' } },
    { id: 'sign', text: { en: 'Sign the contract with your name', ar: 'وقّع العقد باسمك' } },
    { id: 'pay', text: { en: 'Pay in cash', ar: 'ادفع نقدًا' } },
    { id: 'keys', text: { en: 'Receive the key', ar: 'استلم المفتاح' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: same(L('いらっしゃい。|お部屋|は|どう|でした|か？|ここ|で|いい|です|か？', 'Welcome. How was the room? Is this one all right?', 'أهلًا. كيف كانت الغرفة؟ هل هذه مناسبة؟')),
      suggestions: [S('ここ|に|します。', 'I will take this one.', 'سآخذ هذه.'), S('ここ|で|お願いします。', 'This one, please.', 'هذه من فضلك.'), THINK_S],
      intents: [
        {
          id: 'decide',
          slot: 'room',
          slotRequired: true,
          next: 'deposit',
          step: 'decide',
          request: true,
          ideal: L('ここ|に|します。', 'I will take this one.', 'سآخذ هذه.'),
          // the room can be rented now (open shop, chapter, age): otherwise Aiko says so instead of walking the learner through a contract that could never be paid
          econ: 'in_stock',
          nextIfNo: 'not_yet',
        },
        later(),
      ],
    }),
    node({ id: 'not_yet', end: true, say: same(L('ごめんなさい。|今|は|まだ|お貸し|できません。', 'I am sorry. I cannot rent it out yet.', 'آسفة. لا يمكنني تأجيرها بعد.')), suggestions: [LATER_S], intents: [] }),
    // THE TOTAL: she says the two parts, the learner says the sum (the game checks it against the real quote)
    node({
      id: 'deposit',
      emotion: 'happy',
      say: same(L('ありがとう。|では、|敷金|が|三|万|円、|前家賃|が|三|万|円|です。|全部|で|いくら|です|か？', 'Thank you. The deposit is thirty thousand yen and the first month in advance is thirty thousand yen. How much is that in total?', 'شكرًا. الوديعة ثلاثون ألف ين والإيجار المقدم للشهر الأول ثلاثون ألف ين. كم المجموع؟')),
      suggestions: [TOTAL_S, REPEAT_S, THINK_S],
      intents: [...sayTotal(), later()],
    }),
    node({
      id: 'wrong_total',
      say: same(L('いいえ、|三|万|円|と|三|万|円|です。|全部|で|いくら|です|か？', 'No, it is thirty thousand yen and thirty thousand yen. How much is that in total?', 'لا، ثلاثون ألف ين وثلاثون ألف ين. كم المجموع؟')),
      suggestions: [TOTAL_S, REPEAT_S, THINK_S],
      intents: [...sayTotal(), later()],
    }),
    // the signature: the chip 「{name}です」, or a name typed in any script
    node({
      id: 'sign',
      say: same(L('はい、|そう|です。|それでは、|契約書|に|お名前|を|お願いします。', 'Yes, that is right. Then please write your name on the contract.', 'نعم، هذا صحيح. إذن اكتب اسمك على العقد من فضلك.')),
      suggestions: [NAME_S, S('名前|は|{name}|です。', 'My name is {name}.', 'اسمي {name}.'), REPEAT_S],
      intents: [{ id: 'say_name', any: ['です', 'といいます', 'もうします', 'なまえ'], capture: 'name', next: 'pay', step: 'sign' }, later()],
    }),
    node({
      id: 'pay',
      say: same(L('ありがとう|ございます。|では、|お支払い|を|お願いします。|うち|は|現金|だけ|です。', 'Thank you. Then your payment, please. We only take cash.', 'شكرًا لك. إذن الدفع من فضلك. نحن نقبل النقد فقط.')),
      suggestions: [S('現金|で|お願いします。', 'Cash, please.', 'نقدًا من فضلك.'), S('はい、|どうぞ。', 'Yes, here you are.', 'نعم، تفضّلي.'), THINK_S, S('カード|で|お願いします。', 'By card, please.', 'بالبطاقة من فضلك.')],
      intents: [
        { id: 'pay_cash', slot: 'payMethod', slotOptions: ['cash'], slotRequired: true, next: 'done' },
        { id: 'pay_ok', any: ['はい', 'どうぞ', 'おねがい'], none: ['いいえ', 'かんがえ', 'かーど', 'カード'], next: 'done' },
        { id: 'pay_card', slot: 'payMethod', slotOptions: ['card'], slotRequired: true, stay: true, reply: L('すみません。|うち|は|現金|だけ|です。', 'I am sorry. We only take cash.', 'آسفة. نحن نقبل النقد فقط.') },
        later(),
      ],
    }),
    // the charge: ¥60,000 through the shop path; when the money is not there the scenario ends politely at `short`, nothing charged
    node({
      id: 'done',
      emotion: 'happy',
      step: 'pay',
      econ: 'charge',
      onShort: 'short',
      say: same(L('はい、|確かに|いただきました。|ありがとう|ございます。', 'Yes, I have received it. Thank you very much.', 'نعم، استلمتها. شكرًا جزيلًا.')),
      suggestions: [S('ありがとう|ございます。', 'Thank you very much.', 'شكرًا جزيلًا.'), S('よろしく|お願いします。', 'Please treat me well.', 'أرجو حسن التعامل.')],
      intents: [{ id: 'thanks', any: ['ありがとう', 'よろしく', 'はい', 'どうも'], next: 'keys' }],
    }),
    node({
      id: 'keys',
      emotion: 'happy',
      end: true,
      step: 'keys',
      say: same(L('鍵|です。|どうぞ。|ここ|が|あなた|の|家|です|よ。', 'Here is the key. Please take it. This is your home.', 'هذا هو المفتاح. تفضّل. هذا هو بيتك.')),
      intents: [],
    }),
    // too little money (or the room is already yours): a polite end, nothing was charged (§4.4 rule 6)
    node({
      id: 'short',
      end: true,
      say: [
        say(L('その|部屋|は、|もう|あなた|の|です|よ。', 'That room is already yours.', 'تلك الغرفة لك بالفعل.'), { flag: 'owned_already' }),
        say(L('ごめんなさい。|今|は|まだ|お貸し|できません。', 'I am sorry. I cannot rent it out yet.', 'آسفة. لا يمكنني تأجيرها بعد.'), { flag: 'sold_out' }),
        say(L('あら、|お金|が|少し|足りません|ね。|お金|が|できたら、|また|来て|ください|ね。', 'Oh, the money is a little short. When you have it, please come again.', 'آه، المبلغ ناقص قليلًا. عندما يتوفر المال، تعال مجددًا من فضلك.')),
      ],
      suggestions: [LATER_S, S('ありがとう|ございました。', 'Thank you very much.', 'شكرًا جزيلًا.')],
      intents: [],
    }),
    node({ id: 'leave', end: true, say: same(LEAVE_LINE), suggestions: [S('ありがとう|ございました。', 'Thank you very much.', 'شكرًا جزيلًا.')], intents: [] }),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// home_own_guest: the housewarming; the roles of a home visit are reversed (the learner is the host)
// ---------------------------------------------------------------------------------------------------------------

/** the plain line when the guest is `casual`, the polite one otherwise */
const reg = (plain: Line, polite: Line): SayVariant[] => [say(plain, { flag: 'casual' }), say(polite)];

export const HOME_OWN_GUEST: Scenario = {
  id: 'home_own_guest',
  locationId: 'flat',
  // the friend you invited plays the guest: the app starts the scenario with that friend's character (Mio is only the default)
  characterId: 'mio',
  level: 'A2',
  title: { en: 'Housewarming: your guest', ar: 'حفل الانتقال: ضيفك' },
  setup: {
    en: 'A friend has come to your own room. Welcome them in, offer slippers and tea, answer their compliments and say goodbye warmly.',
    ar: 'جاء صديق إلى غرفتك الخاصة. رحّب به، وقدّم له خفّ البيت والشاي، وردّ على مجاملاته، وودّعه بحرارة.',
  },
  minutes: 6,
  steps: [
    { id: 'welcome', text: { en: 'Welcome your guest in', ar: 'رحّب بضيفك' } },
    { id: 'slippers', text: { en: 'Offer the slippers', ar: 'قدّم له خفّ البيت' } },
    { id: 'compliment', text: { en: 'Answer the compliment', ar: 'ردّ على المجاملة' } },
    { id: 'tea', text: { en: 'Offer tea', ar: 'قدّم له الشاي' } },
    { id: 'goodbye', text: { en: 'Say goodbye', ar: 'ودّعه' } },
  ],
  start: 'welcome',
  nodes: asRecord([
    node({
      id: 'welcome',
      emotion: 'happy',
      say: reg(L('やあ！|おじゃまします！', 'Hi! Excuse me for coming in!', 'مرحبًا! عن إذنك!'), L('こんにちは。|おじゃまします。', 'Hello. Excuse me for coming in.', 'مرحبًا. عن إذنك.')),
      suggestions: [S('いらっしゃい。|どうぞ、|上がって|ください。', 'Welcome. Please come in.', 'أهلًا بك. تفضّل بالدخول.'), S('どうぞ、|入って|ください。', 'Please come in.', 'تفضّل بالدخول.'), S('こんにちは。|いらっしゃい。', 'Hello. Welcome.', 'مرحبًا. أهلًا بك.')],
      intents: [{ id: 'welcome', any: ['どうぞ', 'あがって', 'いらっしゃい', 'はいって', 'ようこそ'], next: 'slippers', step: 'welcome', request: true, ideal: L('どうぞ、|上がって|ください。', 'Please come in.', 'تفضّل بالدخول.') }],
    }),
    node({
      id: 'slippers',
      emotion: 'neutral',
      say: reg(L('靴|は|ここ|で|いい？', 'Is it all right to leave my shoes here?', 'هل أترك حذائي هنا؟'), L('あの、|靴|は|ここ|で|いい|です|か？', 'Um, may I leave my shoes here?', 'عفوًا، هل أترك حذائي هنا؟')),
      suggestions: [S('はい。|スリッパ|を|どうぞ。', 'Yes. Here are slippers.', 'نعم. تفضّل هذا الخفّ.'), S('はい、|ここ|で|脱いで|ください。|スリッパ|も|どうぞ。', 'Yes, please take them off here. Here are slippers too.', 'نعم، اخلعه هنا من فضلك. وهذا خفّ البيت أيضًا.'), REPEAT_S],
      intents: [{ id: 'slippers', any: ['すりっぱ', 'ぬいで', 'はい', 'ここで'], next: 'compliment', step: 'slippers', request: true, ideal: L('スリッパ|を|どうぞ。', 'Here are slippers.', 'تفضّل هذا الخفّ.') }],
    }),
    node({
      id: 'compliment',
      emotion: 'happy',
      say: reg(L('わあ、|いい|部屋|だ|ね！|広くて|きれい。', 'Wow, what a nice room! It is spacious and clean.', 'يا للروعة، غرفة جميلة! واسعة ونظيفة.'), L('わあ、|いい|部屋|です|ね！|広くて|きれい|です。', 'Wow, what a nice room! It is spacious and clean.', 'يا للروعة، غرفة جميلة! واسعة ونظيفة.')),
      suggestions: [S('ありがとう|ございます。', 'Thank you very much.', 'شكرًا جزيلًا.'), S('ありがとう。|まだ|何|も|ない|です|けど。', 'Thank you. I do not have much yet, though.', 'شكرًا. ليس عندي الكثير بعد، لكن.'), S('いえいえ。', 'Not at all.', 'لا شكر على واجب.')],
      intents: [{ id: 'thanks', any: ['ありがとう', 'いえいえ', 'そんな', 'まだ', 'うれしい'], next: 'tea', step: 'compliment', ideal: L('ありがとう|ございます。', 'Thank you very much.', 'شكرًا جزيلًا.') }],
    }),
    node({
      id: 'tea',
      emotion: 'neutral',
      say: reg(L('ここ|に|座って|いい？', 'May I sit here?', 'هل يمكنني الجلوس هنا؟'), L('ここ|に|座って|も|いい|です|か？', 'May I sit here?', 'هل يمكنني الجلوس هنا؟')),
      suggestions: [S('はい、|どうぞ。|お茶|は|いかが|です|か？', 'Yes, please. Would you like some tea?', 'نعم، تفضّل. هل تريد بعض الشاي؟'), S('お茶|を|どうぞ。', 'Please have some tea.', 'تفضّل بعض الشاي.'), S('どうぞ、|座って|ください。|お茶|です。', 'Please sit down. Here is tea.', 'تفضّل بالجلوس. هذا هو الشاي.')],
      intents: [{ id: 'tea', any: ['おちゃ', 'どうぞ', 'いかが', 'すわって'], next: 'drink', step: 'tea', request: true, ideal: L('お茶|は|いかが|です|か？', 'Would you like some tea?', 'هل تريد بعض الشاي؟') }],
    }),
    node({
      id: 'drink',
      emotion: 'happy',
      say: reg(L('いただきます。|…おいしい！|いい|お茶|だ|ね。', 'Itadakimasu. ...Delicious! This is nice tea.', 'إيتاداكيماس. ...لذيذ! شاي جميل.'), L('いただきます。|…おいしい|です！|いい|お茶|です|ね。', 'Itadakimasu. ...Delicious! This is nice tea.', 'إيتاداكيماس. ...لذيذ! شاي جميل.')),
      suggestions: [S('よかった|です。', 'I am glad.', 'يسعدني ذلك.'), S('ありがとう|ございます。', 'Thank you very much.', 'شكرًا جزيلًا.'), S('また|来て|ください|ね。', 'Please come again.', 'تعال مجددًا من فضلك.')],
      intents: [{ id: 'glad', any: ['よかった', 'ありがとう', 'うれしい', 'また', 'どうぞ', 'はい'], next: 'goodbye' }],
    }),
    node({
      id: 'goodbye',
      emotion: 'happy',
      say: reg(L('そろそろ|帰る|ね。|今日|は|ありがとう！', 'I should be going soon. Thank you for today!', 'يجب أن أذهب قريبًا. شكرًا على اليوم!'), L('そろそろ|帰ります。|今日|は|ありがとう|ございました。', 'I should be going soon. Thank you very much for today.', 'يجب أن أذهب قريبًا. شكرًا جزيلًا على اليوم.')),
      suggestions: [S('こちら|こそ。|また|来て|ください|ね。', 'Thank you too. Please come again.', 'شكرًا لك أيضًا. تعال مجددًا من فضلك.'), S('気を付けて。', 'Take care.', 'اعتنِ بنفسك.'), S('今日|は|ありがとう|ございました。', 'Thank you very much for today.', 'شكرًا جزيلًا على اليوم.')],
      intents: [{ id: 'bye', any: ['またきて', 'こちらこそ', 'きをつけて', 'ありがとう', 'またね', 'さようなら'], next: 'end', step: 'goodbye' }],
    }),
    node({
      id: 'end',
      emotion: 'happy',
      end: true,
      say: reg(L('おじゃましました！|またね！', 'Thank you for having me! See you!', 'شكرًا على الاستضافة! إلى اللقاء!'), L('おじゃましました。|ありがとう|ございました。', 'Thank you for having me. Thank you very much.', 'شكرًا على الاستضافة. شكرًا جزيلًا.')),
      suggestions: [S('また|ね！', 'See you!', 'إلى اللقاء!')],
      intents: [],
    }),
  ]),
};

/** Scenarios of the player's own room: the viewing, the contract and the housewarming. */
export const HOME_SCENARIOS: Scenario[] = [AIKO_VIEWING, AIKO_CONTRACT, HOME_OWN_GUEST];
