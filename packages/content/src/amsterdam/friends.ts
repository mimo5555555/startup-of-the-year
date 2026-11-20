// Amsterdam's three friends, first meetings (Dutch step 1). Friends say je from the first word: Sanne on her houseboat (woonboot),
// Daan from down the street (and his bike), Noor at the language café (taalcafé). Each asks your name, said back with 「Leuk je te
// ontmoeten」; Sanne asks where you are from and what you like doing.
import type { AvatarSpec, Character, IntentDef, Line, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';

/** what Amsterdam's characters say to the global intents (thanks, slow, a greeting, …) and when they did not understand */
export const NL_REACTIONS = {
  greet: L('Hallo!', 'Hello!', 'مرحبًا!'),
  thanks: L('Graag gedaan.', "You're welcome.", 'عفوًا.'),
  excuse: L('Ja?', 'Yes?', 'نعم؟'),
  how_are_you: L('Goed, dank u!', 'Fine, thank you!', 'بخير، شكرًا!'),
  slow: L('Natuurlijk. Ik praat wat langzamer.', 'Of course. I’ll speak a little more slowly.', 'بالطبع. سأتكلّم أبطأ قليلًا.'),
  goodbye: L('Tot ziens!', 'Goodbye!', 'إلى اللقاء!'),
  fallback: L('Sorry? Kunt u dat herhalen?', 'Sorry? Could you say that again?', 'عفوًا؟ هل يمكنك أن تعيد ذلك؟'),
} satisfies Record<string, Line>;

const tellName = (next: string): IntentDef => ({
  id: 'name',
  any: ['heet', 'ik ben', 'naam is', 'noem me'],
  capture: 'name',
  next,
  step: 'name',
  ideal: L('Ik heet {name}.', 'My name is {name}.', 'اسمي {name}.'),
});
const NAME_CHIPS = [S('Ik heet {name}.', 'My name is {name}.', 'اسمي {name}.'), S('Ik ben {name}. Leuk je te ontmoeten!', 'I’m {name}. Nice to meet you!', 'أنا {name}. تشرّفت!')];

const friend = (id: string, name: string, ar: string, age: number, job: [string, string], bio: [string, string], personality: [string, string], interests: string[], voice: 'f' | 'm', avatar: AvatarSpec, scenarioId: string, locationId: string): Character => ({
  id,
  name: { ja: name, reading: name, en: name, ar },
  age,
  job: { en: job[0], ar: job[1] },
  bio: { en: bio[0], ar: bio[1] },
  personality: { en: personality[0], ar: personality[1] },
  interests,
  speaking: { rate: 1.02, pitch: voice === 'f' ? 1.1 : 0.98, voice },
  avatar,
  locationId,
  scenarioId,
});

export const SANNE = friend('sanne', 'Sanne Visser', 'سانه فيسر', 27, ['Illustrator, your neighbour on the houseboat', 'رسّامة، جارتك في البيت العائم'],
  ['Lives on a green houseboat on the canal with a cat called Stroop. Draws picture books and knows every café in the neighbourhood.', 'تعيش في بيت عائم أخضر على القناة مع قطة اسمها «ستروب». ترسم كتب الأطفال وتعرف كل مقهى في الحيّ.'],
  ['Open, funny, very gezellig', 'منفتحة، مرحة، «خيزيليخ» جدًا'], ['art', 'food', 'nature'], 'f',
  { skin: '#f6dcc8', hair: { style: 'long', color: '#e2b04a' }, top: '#f28c28', bottom: '#2f3b4f', shoes: '#e8e2d6', accent: '#4a8fcf', accessories: ['scarf'] }, 'ams_sanne', 'ams_boot');
export const DAAN = friend('daan', 'Daan de Jong', 'دان دي يونغ', 30, ['Bike courier, your neighbour down the street', 'ساعي بالدرّاجة، جارك في الشارع'],
  ['Cycles a hundred kilometres a day through the city and knows every shortcut. Thinks everyone needs a bike in Amsterdam.', 'يقطع مئة كيلومتر يوميًا بالدرّاجة في المدينة ويعرف كل طريق مختصر. يرى أن الجميع يحتاج درّاجة في أمستردام.'],
  ['Sporty, direct, helpful', 'رياضي، صريح، خدوم'], ['sports', 'travel', 'music'], 'm',
  { skin: '#efcdb4', hair: { style: 'short', color: '#8a5a2b' }, top: '#3b82c4', bottom: '#222222', shoes: '#f0f0f0', accent: '#f2b705', accessories: ['helmet', 'backpack'] }, 'ams_daan', 'ams_straat');
export const NOOR = friend('noor', 'Noor Bakker', 'نور باكر', 26, ['Teacher, your language-exchange partner', 'معلّمة، شريكتك في تبادل اللغة'],
  ['Teaches at a primary school and learns Arabic from her grandmother’s old letters. Runs a language café every Thursday.', 'تدرّس في مدرسة ابتدائية وتتعلّم العربية من رسائل جدّتها القديمة. تدير مقهى للغات كل خميس.'],
  ['Warm, curious, a good listener', 'دافئة، فضولية، مستمعة جيدة'], ['books', 'travel'], 'f',
  { skin: '#d9a77f', hair: { style: 'bun', color: '#2a1d16' }, top: '#7a3b52', bottom: '#2c2c34', shoes: '#4a3526', accent: '#e7b75f', accessories: ['glasses'] }, 'ams_noor', 'ams_taalcafe');

export const SANNE_MEET: Scenario = {
  id: 'ams_sanne',
  locationId: 'ams_boot',
  characterId: 'sanne',
  level: 'A1',
  title: { en: 'Meet your neighbour on the houseboat', ar: 'تعرّف على جارتك في البيت العائم' },
  setup: { en: 'Sanne waves from her houseboat on the canal. Tell her your name, where you are from and what you like doing.', ar: 'سانه تلوّح لك من بيتها العائم على القناة. أخبرها باسمك ومن أين أنت وماذا تحب أن تفعل.' },
  minutes: 4,
  steps: [
    { id: 'name', text: { en: 'Say your name', ar: 'قل اسمك' } },
    { id: 'country', text: { en: 'Say where you are from', ar: 'قل من أين أنت' } },
    { id: 'hobby', text: { en: 'Say what you like doing', ar: 'قل ماذا تحب أن تفعل' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hoi! Jij bent de nieuwe buur, toch? Ik ben Sanne, van de woonboot hier. Hoe heet jij?', "Hi! You're the new neighbour, right? I'm Sanne, from the houseboat here. What's your name?", 'مرحبًا! أنت الجار الجديد، صحيح؟ أنا سانه، من البيت العائم هنا. ما اسمك؟'))],
      suggestions: NAME_CHIPS,
      intents: [tellName('from')],
    }),
    node({
      id: 'from',
      say: [say(L('Leuk je te ontmoeten, {name}! Waar kom je vandaan?', 'Nice to meet you, {name}! Where are you from?', 'تشرّفت، {name}! من أين أنت؟'))],
      suggestions: [S('Ik kom uit Egypte.', 'I’m from Egypt.', 'أنا من مصر.'), S('Ik kom uit Marokko.', 'I’m from Morocco.', 'أنا من المغرب.'), S('Ik kom uit Engeland.', 'I’m from England.', 'أنا من إنجلترا.')],
      intents: [{ id: 'from_country', slot: 'country', capture: 'country', slotRequired: true, next: 'hobby', step: 'country', ideal: L('Ik kom uit Egypte.', 'I’m from Egypt.', 'أنا من مصر.') }],
    }),
    node({
      id: 'hobby',
      emotion: 'excited',
      say: [say(L('Wat leuk! {country} wil ik ook eens zien. Wat doe je graag in je vrije tijd?', 'How nice! I’d love to see {country} one day. What do you like doing in your free time?', 'ما أجمل ذلك! أودّ أن أرى {country} يومًا ما. ماذا تحب أن تفعل في وقت فراغك؟'))],
      suggestions: [S('Ik kook graag.', 'I like cooking.', 'أحب الطبخ.'), S('Ik luister graag naar muziek.', 'I like listening to music.', 'أحب سماع الموسيقى.'), S('Ik voetbal graag.', 'I like playing football.', 'أحب لعب كرة القدم.')],
      intents: [{ id: 'hobby', slot: 'hobby', slotRequired: true, next: 'welcome', step: 'hobby', remember: { fact: 'hobby', from: 'slot' }, ideal: L('Ik kook graag.', 'I like cooking.', 'أحب الطبخ.') }],
    }),
    node({
      id: 'welcome',
      end: true,
      emotion: 'happy',
      say: [
        say(L('Leuk! Dan koken we een keer samen. Welkom in de buurt, {name}!', 'Great! Then let’s cook together sometime. Welcome to the neighbourhood, {name}!', 'رائع! إذن نطبخ معًا يومًا ما. أهلًا بك في الحيّ، {name}!'), { slot: 'hobby', in: ['cooking'] }),
        say(L('Leuk! Dat doen we een keer samen. Welkom in de buurt, {name}!', 'Nice! Let’s do that together sometime. Welcome to the neighbourhood, {name}!', 'جميل! لنفعل ذلك معًا يومًا ما. أهلًا بك في الحيّ، {name}!')),
      ],
      intents: [],
    }),
  ]),
};

export const DAAN_MEET: Scenario = {
  id: 'ams_daan',
  locationId: 'ams_straat',
  characterId: 'daan',
  level: 'A1',
  title: { en: 'Meet your neighbour down the street', ar: 'تعرّف على جارك في الشارع' },
  setup: { en: 'Daan is locking his bike in front of your door. Say hello, tell him your name, and talk about bikes.', ar: 'دان يقفل درّاجته أمام بابك. سلّم عليه، وأخبره باسمك، وتحدّثا عن الدرّاجات.' },
  minutes: 3,
  steps: [
    { id: 'hello', text: { en: 'Answer his question', ar: 'أجب عن سؤاله' } },
    { id: 'name', text: { en: 'Say your name', ar: 'قل اسمك' } },
    { id: 'bike', text: { en: 'Talk about bikes', ar: 'تحدّث عن الدرّاجات' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hé! Woon jij ook in deze straat?', 'Hey! Do you live on this street too?', 'مرحبًا! هل تسكن في هذا الشارع أيضًا؟'))],
      suggestions: [S('Ja, ik woon op nummer twaalf.', 'Yes, I live at number twelve.', 'نعم، أسكن في الرقم اثني عشر.'), S('Ja, ik woon hier net.', 'Yes, I’ve just moved here.', 'نعم، انتقلت للسكن هنا للتوّ.')],
      intents: [{ id: 'yes', any: ['ja', 'woon', 'net', 'klopt'], next: 'name', step: 'hello', ideal: L('Ja, ik woon op nummer twaalf.', 'Yes, I live at number twelve.', 'نعم، أسكن في الرقم اثني عشر.') }],
    }),
    node({
      id: 'name',
      say: [say(L('Gezellig! Ik ben Daan. Hoe heet jij?', 'Lovely! I’m Daan. What’s your name?', 'لطيف! أنا دان. ما اسمك؟'))],
      suggestions: NAME_CHIPS,
      intents: [tellName('bike')],
    }),
    node({
      id: 'bike',
      say: [say(L('Leuk je te ontmoeten, {name}! Heb je al een fiets? In Amsterdam fietst iedereen.', 'Nice to meet you, {name}! Do you have a bike yet? Everyone cycles in Amsterdam.', 'تشرّفت، {name}! هل عندك درّاجة؟ في أمستردام الجميع يركب الدرّاجة.'))],
      suggestions: [S('Ja, ik heb een fiets.', 'Yes, I have a bike.', 'نعم، عندي درّاجة.'), S('Nee, nog niet.', 'No, not yet.', 'لا، ليس بعد.')],
      intents: [
        { id: 'has_bike', any: ['ja', 'heb een', 'heb wel'], none: ['nee', 'geen'], next: 'bye_bike', step: 'bike' },
        { id: 'no_bike', any: ['nee', 'nog niet', 'geen fiets', 'heb geen'], next: 'bye_no_bike', step: 'bike' },
      ],
    }),
    node({
      id: 'bye_bike',
      end: true,
      emotion: 'happy',
      say: [say(L('Top! Dan fietsen we een keer samen naar het Vondelpark.', 'Great! Then let’s cycle to the Vondelpark together sometime.', 'رائع! إذن نذهب معًا بالدرّاجة إلى «فوندلبارك» يومًا ما.'))],
      intents: [],
    }),
    node({
      id: 'bye_no_bike',
      end: true,
      emotion: 'happy',
      say: [say(L('Geen probleem. Op de markt zijn goede tweedehands fietsen. Ik help je!', 'No problem. There are good second-hand bikes at the market. I’ll help you!', 'لا مشكلة. في السوق درّاجات مستعملة جيدة. سأساعدك!'))],
      intents: [],
    }),
  ]),
};

export const NOOR_MEET: Scenario = {
  id: 'ams_noor',
  locationId: 'ams_taalcafe',
  characterId: 'noor',
  level: 'A1',
  title: { en: 'Meet your language-exchange partner', ar: 'تعرّف على شريكتك في تبادل اللغة' },
  setup: { en: 'Thursday’s language café: Noor is learning Arabic, you are learning Dutch. Introduce yourself and plan the next meeting.', ar: 'مقهى اللغات يوم الخميس: نور تتعلّم العربية وأنت تتعلّم الهولندية. عرّف بنفسك وخطّطا للقاء القادم.' },
  minutes: 3,
  steps: [
    { id: 'name', text: { en: 'Say your name', ar: 'قل اسمك' } },
    { id: 'dutch', text: { en: 'Say how long you have been learning Dutch', ar: 'قل منذ متى تتعلّم الهولندية' } },
    { id: 'plan', text: { en: 'Agree to meet again', ar: 'اتّفقا على لقاء آخر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hoi! Ben jij hier voor het taalcafé? Ik ben Noor.', "Hi! Are you here for the language café? I'm Noor.", 'مرحبًا! هل أنت هنا من أجل مقهى اللغات؟ أنا نور.'))],
      suggestions: [S('Ja! Ik ben {name}.', 'Yes! I’m {name}.', 'نعم! أنا {name}.'), S('Hoi Noor! Ik heet {name}.', 'Hi Noor! My name is {name}.', 'مرحبًا نور! اسمي {name}.')],
      intents: [tellName('dutch')],
    }),
    node({
      id: 'dutch',
      say: [say(L('Leuk je te ontmoeten, {name}! Ik leer Arabisch. Hoe lang leer je al Nederlands?', "Nice to meet you, {name}! I'm learning Arabic. How long have you been learning Dutch?", 'تشرّفت، {name}! أنا أتعلّم العربية. منذ متى تتعلّم الهولندية؟'))],
      suggestions: [S('Pas een paar weken.', 'Only a few weeks.', 'منذ بضعة أسابيع فقط.'), S('Sinds een jaar.', 'For a year.', 'منذ سنة.')],
      intents: [{ id: 'how_long', any: ['pas', 'weken', 'week', 'maand', 'maanden', 'jaar', 'sinds', 'net'], next: 'praise', step: 'dutch', ideal: L('Pas een paar weken.', 'Only a few weeks.', 'منذ بضعة أسابيع فقط.') }],
    }),
    node({
      id: 'praise',
      emotion: 'excited',
      say: [say(L('Wauw, je Nederlands is al goed! Zullen we elke week oefenen?', 'Wow, your Dutch is already good! Shall we practise every week?', 'واو، هولنديتك جيدة من الآن! هل نتدرّب كل أسبوع؟'))],
      suggestions: [S('Ja, graag!', 'Yes, I’d love to!', 'نعم، بكل سرور!'), S('Ja, goed idee!', 'Yes, good idea!', 'نعم، فكرة جيدة!')],
      intents: [
        { id: 'yes', any: ['ja', 'graag', 'goed idee', 'leuk', 'top', 'prima', 'oke'], none: ['nee'], next: 'bye', step: 'plan' },
        { id: 'not_sure', any: ['nee', 'liever niet', 'geen tijd', 'weet niet', 'misschien'], next: 'bye_maybe', step: 'plan' },
      ],
    }),
    node({ id: 'bye', end: true, emotion: 'happy', say: [say(L('Top! Tot volgende week, {name}. Doei!', 'Great! See you next week, {name}. Bye!', 'رائع! إلى الأسبوع القادم، {name}. باي!'))], intents: [] }),
    node({ id: 'bye_maybe', end: true, say: [say(L('Geen probleem! App me maar als je tijd hebt. Doei!', 'No problem! Just message me when you have time. Bye!', 'لا مشكلة! راسلني حين يكون لديك وقت. باي!'))], intents: [] }),
  ]),
};
