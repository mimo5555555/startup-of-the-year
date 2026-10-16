import type { IntentDef, Scenario } from '../types';
import { L, S, say, node, asRecord, REPEAT_S } from './dsl';

// Job intro scenarios (agent 4D, docs/GAME_DESIGN.md §9.1): "a normal conversation with the boss", the first step of the Shift screen. Tanaka
// offers the konbini job, the learner says yes and says the two phrases of the counter (いらっしゃいませ, ありがとうございました), then the shift
// opens. No money moves here (`pay: 'full'` in the meta is the ordinary loop pay of a short A1 conversation, paid once; a replay pays the
// repeat rate like any scenario).

/** Taught polite refusal (`cc_refuse`): the way out of every offer. */
const later = (): IntentDef => ({ id: 'later', any: ['またきます', 'かんがえます', 'やめます'], next: 'leave' });
const LEAVE_LINE = L('わかりました。|また|どうぞ。', 'I understand. Please come again.', 'حسنًا. تفضّل مرة أخرى.');
const YES = ['はい', 'やります', 'やりたい', 'おねがい', 'します', 'いいですよ', 'いいです'];

export const JOB_KONBINI_INTRO: Scenario = {
  id: 'job_konbini_intro',
  locationId: 'konbini',
  characterId: 'tanaka',
  level: 'A1',
  title: { en: 'Help out at the konbini', ar: 'ساعد في الكونبيني' },
  setup: {
    en: "Tanaka-san needs a hand at the register. Say yes, then say the two things a konbini worker says: welcome and thank you.",
    ar: 'يحتاج السيد تاناكا إلى مساعدة عند الصندوق. قل نعم، ثم قل عبارتين يقولهما موظف الكونبيني: أهلًا وشكرًا.',
  },
  minutes: 2,
  steps: [
    { id: 'accept', text: { en: 'Say you will help out', ar: 'قل إنك ستساعد' } },
    { id: 'greet', text: { en: 'Greet a customer: いらっしゃいませ', ar: 'رحّب بزبون: いらっしゃいませ' } },
    { id: 'thanks', text: { en: 'Thank a customer: ありがとうございました', ar: 'اشكر زبونًا: ありがとうございました' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('こんにちは。|お店|の|お手伝い|を|しませんか？', 'Hello. Would you like to help out at the shop?', 'مرحبًا. هل تريد أن تساعد في المتجر؟'))],
      suggestions: [
        S('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.'),
        S('どんな|お手伝い|です|か？', 'What kind of help?', 'أي نوع من المساعدة؟'),
        S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.'),
      ],
      intents: [
        { id: 'accept', any: YES, none: ['どんな', 'またきます'], next: 'accept', step: 'accept', ideal: L('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.') },
        { id: 'ask_what', any: ['どんな', 'なに', 'しごと'], next: 'explain' },
        later(),
      ],
    }),
    node({
      id: 'explain',
      say: [say(L('レジ|の|お手伝い|です。|お客さん|が|来ます。|やります|か？', 'It is helping at the register. Customers come. Will you do it?', 'إنها مساعدة عند الصندوق. يأتي الزبائن. هل ستفعل؟'))],
      suggestions: [S('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.'), S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.'), REPEAT_S],
      intents: [
        { id: 'accept', any: YES, none: ['かんがえ', 'またきます'], next: 'accept', step: 'accept', ideal: L('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.') },
        { id: 'again', any: ['もういちど', 'もうひとこと'], next: 'explain' },
        later(),
      ],
    }),
    node({
      id: 'accept',
      emotion: 'happy',
      step: 'accept',
      say: [say(L('ありがとう！|お客さん|が|来ます。|いらっしゃいませ|と|言って|ください。', 'Thank you! A customer comes. Please say "irasshaimase".', 'شكرًا! يأتي زبون. قل من فضلك «いらっしゃいませ».'))],
      suggestions: [S('いらっしゃいませ。', 'Welcome!', 'أهلًا بك!'), REPEAT_S],
      intents: [
        { id: 'greet', any: ['いらっしゃいませ', 'いらっしゃい'], next: 'thanks', step: 'greet', ideal: L('いらっしゃいませ。', 'Welcome!', 'أهلًا بك!') },
        { id: 'again', any: ['もういちど'], next: 'accept' },
        later(),
      ],
    }),
    node({
      id: 'thanks',
      emotion: 'happy',
      step: 'greet',
      say: [say(L('いい|です|ね！|お客さん|が|帰ります。|ありがとうございました|と|言って|ください。', 'Nice! The customer is leaving. Please say "arigatou gozaimashita".', 'جميل! الزبون يغادر. قل من فضلك «ありがとうございました».'))],
      suggestions: [S('ありがとうございました。', 'Thank you very much.', 'شكرًا جزيلًا.'), REPEAT_S],
      intents: [
        { id: 'thanks', any: ['ありがとうございました', 'ありがとうございます', 'ありがとう'], next: 'done', step: 'thanks', ideal: L('ありがとうございました。', 'Thank you very much.', 'شكرًا جزيلًا.') },
        { id: 'again', any: ['もういちど'], next: 'thanks' },
        later(),
      ],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'thanks',
      say: [say(L('上手|です！|いつでも|どうぞ。', 'Very good! Come any time.', 'ممتاز! تفضّل في أي وقت.'))],
      intents: [],
    }),
    node({ id: 'leave', end: true, say: [say(L('わかりました。|また|どうぞ。', 'I understand. Please come again.', 'حسنًا. تفضّل مرة أخرى.'))], intents: [] }),
  ]),
};

// ---- the café (Yuki): say yes, greet the customer, serve the drink with 「お待たせしました」 ----
export const JOBINTRO_CAFE: Scenario = {
  id: 'jobintro_cafe',
  locationId: 'cafe',
  characterId: 'yuki',
  level: 'A1',
  title: { en: 'Help out at the café', ar: 'ساعد في المقهى' },
  setup: {
    en: 'Yuki needs a hand in the hall. Say yes, then say the two things a café worker says: welcome, and sorry to keep you waiting when the drink arrives.',
    ar: 'تحتاج يوكي إلى مساعدة في القاعة. قل نعم، ثم قل عبارتين يقولهما موظف المقهى: أهلًا، وآسف على الانتظار عند تقديم المشروب.',
  },
  minutes: 2,
  steps: [
    { id: 'accept', text: { en: 'Say you will help out', ar: 'قل إنك ستساعد' } },
    { id: 'greet', text: { en: 'Greet a customer: いらっしゃいませ', ar: 'رحّب بزبون: いらっしゃいませ' } },
    { id: 'serve', text: { en: 'Serve the drink: お待たせしました', ar: 'قدّم المشروب: お待たせしました' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('こんにちは。|お店|の|お手伝い|を|しませんか？', 'Hello. Would you like to help out at the shop?', 'مرحبًا. هل تريد أن تساعد في المتجر؟'))],
      suggestions: [
        S('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.'),
        S('どんな|お手伝い|です|か？', 'What kind of help?', 'أي نوع من المساعدة؟'),
        S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.'),
      ],
      intents: [
        { id: 'accept', any: YES, none: ['どんな', 'またきます'], next: 'accept', step: 'accept', ideal: L('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.') },
        { id: 'ask_what', any: ['どんな', 'なに', 'しごと'], next: 'explain' },
        later(),
      ],
    }),
    node({
      id: 'explain',
      say: [say(L('お客さん|に|コーヒー|を|出します。|やります|か？', 'You serve coffee to the customers. Will you do it?', 'تقدّم القهوة للزبائن. هل ستفعل؟'))],
      suggestions: [S('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.'), S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.'), REPEAT_S],
      intents: [
        { id: 'accept', any: YES, none: ['かんがえ', 'またきます'], next: 'accept', step: 'accept', ideal: L('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.') },
        { id: 'again', any: ['もういちど', 'もうひとこと'], next: 'explain' },
        later(),
      ],
    }),
    node({
      id: 'accept',
      emotion: 'happy',
      step: 'accept',
      say: [say(L('ありがとう！|お客さん|が|来ます。|いらっしゃいませ|と|言って|ください。', 'Thank you! A customer comes. Please say "irasshaimase".', 'شكرًا! يأتي زبون. قل من فضلك «いらっしゃいませ».'))],
      suggestions: [S('いらっしゃいませ。', 'Welcome!', 'أهلًا بك!'), REPEAT_S],
      intents: [
        { id: 'greet', any: ['いらっしゃいませ', 'いらっしゃい'], next: 'serve', step: 'greet', ideal: L('いらっしゃいませ。', 'Welcome!', 'أهلًا بك!') },
        { id: 'again', any: ['もういちど'], next: 'accept' },
        later(),
      ],
    }),
    node({
      id: 'serve',
      emotion: 'happy',
      step: 'greet',
      say: [say(L('いい|です|ね！|コーヒー|が|できました。|お待たせしました|と|言って|ください。', 'Nice! The coffee is ready. Please say "omatase shimashita".', 'جميل! القهوة جاهزة. قل من فضلك «お待たせしました».'))],
      suggestions: [S('お待たせしました。', 'Sorry to keep you waiting.', 'آسف على الانتظار.'), REPEAT_S],
      intents: [
        { id: 'serve', any: ['おまたせしました', 'おまたせ', 'かしこまりました'], next: 'done', step: 'serve', ideal: L('お待たせしました。', 'Sorry to keep you waiting.', 'آسف على الانتظار.') },
        { id: 'again', any: ['もういちど'], next: 'serve' },
        later(),
      ],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'serve',
      say: [say(L('上手|です！|いつでも|どうぞ。', 'Very good! Come any time.', 'ممتاز! تفضّل في أي وقت.'))],
      intents: [],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

// ---- the station help desk (Sato): say yes, answer a customer with a platform, send them off with 「お気をつけて」 ----
export const JOBINTRO_STATION: Scenario = {
  id: 'jobintro_station',
  locationId: 'station',
  characterId: 'sato',
  level: 'A2',
  title: { en: 'Help out at the station desk', ar: 'ساعد في مكتب المحطة' },
  setup: {
    en: 'Sato-san needs a hand at the help desk. Say yes, tell a customer the platform (三番線です), and send them off with お気をつけて.',
    ar: 'يحتاج السيد ساتو إلى مساعدة في مكتب الاستعلامات. قل نعم، وأخبر الزبون برقم الرصيف (三番線です)، وودّعه بقولك お気をつけて.',
  },
  minutes: 2,
  steps: [
    { id: 'accept', text: { en: 'Say you will help out', ar: 'قل إنك ستساعد' } },
    { id: 'answer', text: { en: 'Tell the customer the platform: 三番線です', ar: 'أخبر الزبون بالرصيف: 三番線です' } },
    { id: 'wish', text: { en: 'Send them off: お気をつけて', ar: 'ودّعه: お気をつけて' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('こんにちは。|駅|の|案内|の|お手伝い|を|しませんか？', 'Hello. Would you like to help out at the station help desk?', 'مرحبًا. هل تريد أن تساعد في مكتب مساعدة المحطة؟'))],
      suggestions: [
        S('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.'),
        S('どんな|お手伝い|です|か？', 'What kind of help?', 'أي نوع من المساعدة؟'),
        S('また|来ます。', 'I will come again.', 'سآتي مرة أخرى.'),
      ],
      intents: [
        { id: 'accept', any: YES, none: ['どんな', 'またきます'], next: 'accept', step: 'accept', ideal: L('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.') },
        { id: 'ask_what', any: ['どんな', 'なに', 'しごと'], next: 'explain' },
        later(),
      ],
    }),
    node({
      id: 'explain',
      say: [say(L('お客さん|に|ホーム|や|道|を|教えます。|やります|か？', 'You tell the customers the platform or the way. Will you do it?', 'تخبر الزبائن بالرصيف أو الطريق. هل ستفعل؟'))],
      suggestions: [S('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.'), S('考えます。', 'I will think about it.', 'سأفكّر في الأمر.'), REPEAT_S],
      intents: [
        { id: 'accept', any: YES, none: ['かんがえ', 'またきます'], next: 'accept', step: 'accept', ideal: L('はい、|やります。', 'Yes, I will do it.', 'نعم، سأفعل.') },
        { id: 'again', any: ['もういちど', 'もうひとこと'], next: 'explain' },
        later(),
      ],
    }),
    node({
      id: 'accept',
      emotion: 'happy',
      step: 'accept',
      say: [say(L('ありがとう！|お客さん|が|聞きます。|「|光が丘|は|何番線|です|か？|」|三番線|です、|と|言って|ください。', 'Thank you! A customer asks: "Which platform is Hikarigaoka?" Please say "sanbansen desu" (platform 3).', 'شكرًا! يسأل زبون: «أي رصيف لهيكاريغاؤكا؟» قل من فضلك «三番線です» (الرصيف 3).'))],
      suggestions: [S('三番線|です。', 'It is platform 3.', 'إنه الرصيف 3.'), REPEAT_S],
      intents: [
        { id: 'answer', any: ['さんばんせん', 'さんばん', '3ばんせん', '3ばん'], next: 'wish', step: 'answer', ideal: L('三番線|です。', 'It is platform 3.', 'إنه الرصيف 3.') },
        { id: 'again', any: ['もういちど'], next: 'accept' },
        later(),
      ],
    }),
    node({
      id: 'wish',
      emotion: 'happy',
      step: 'answer',
      say: [say(L('いい|です|ね！|お客さん|が|行きます。|お気をつけて|と|言って|ください。', 'Nice! The customer is going. Please say "okiotsukete" (take care).', 'جميل! الزبون يغادر. قل من فضلك «お気をつけて» (اعتنِ بنفسك).'))],
      suggestions: [S('お気をつけて。', 'Take care.', 'اعتنِ بنفسك.'), REPEAT_S],
      intents: [
        { id: 'wish', any: ['おきをつけて', 'きをつけて', 'いってらっしゃい'], next: 'done', step: 'wish', ideal: L('お気をつけて。', 'Take care.', 'اعتنِ بنفسك.') },
        { id: 'again', any: ['もういちど'], next: 'wish' },
        later(),
      ],
    }),
    node({
      id: 'done',
      end: true,
      emotion: 'happy',
      step: 'wish',
      say: [say(L('上手|です！|いつでも|どうぞ。', 'Very good! Come any time.', 'ممتاز! تفضّل في أي وقت.'))],
      intents: [],
    }),
    node({ id: 'leave', end: true, say: [say(LEAVE_LINE)], intents: [] }),
  ]),
};

/** Scenarios for the jobs module (see docs/GAME_DESIGN.md). */
export const JOBS_SCENARIOS: Scenario[] = [JOB_KONBINI_INTRO, JOBINTRO_CAFE, JOBINTRO_STATION];
