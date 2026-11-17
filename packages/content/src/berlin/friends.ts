// Berlin's three friends, first meetings (German step 2). Friends say du from the first word: Lena in the flat share (WG) kitchen,
// Kofi from the ground floor with his bike, Jonas at a language exchange (Sprach-Tandem) in a café. Each asks your name (said back
// with 「Freut mich」); Lena asks where you are from and what you like doing.
import type { Character, IntentDef, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';

/** giving your name: 「Ich heiße …」, 「Ich bin …」, 「Mein Name ist …」 */
const tellName = (next: string): IntentDef => ({
  id: 'name',
  any: ['heiße', 'heisse', 'ich bin', 'name ist', 'nenn mich'],
  capture: 'name',
  next,
  step: 'name',
  ideal: L('Ich heiße {name}.', 'My name is {name}.', 'اسمي {name}.'),
});
const NAME_CHIPS = [S('Ich heiße {name}.', 'My name is {name}.', 'اسمي {name}.'), S('Ich bin {name}. Freut mich!', 'I’m {name}. Nice to meet you!', 'أنا {name}. تشرّفت!')];

const friend = ({ voice, pitch, ...c }: Omit<Character, 'speaking'> & { voice: 'f' | 'm'; pitch: number }): Character => ({
  ...c,
  speaking: { rate: 1.02, pitch, voice },
});

export const LENA: Character = friend({
  id: 'lena',
  name: { ja: 'Lena Brandt', reading: 'Lena Brandt', en: 'Lena Brandt', ar: 'لينا براندت' },
  age: 24,
  job: { en: 'Architecture student, your flatmate', ar: 'طالبة عمارة، شريكتك في السكن' },
  bio: {
    en: 'Studies architecture, bakes on Sundays and keeps the WG’s cleaning plan. Grew up in Hamburg and still says Moin.',
    ar: 'تدرس العمارة، وتخبز أيام الأحد، وتحافظ على جدول تنظيف السكن المشترك. نشأت في هامبورغ وما زالت تقول «موين».',
  },
  personality: { en: 'Open, organised, curious about everyone', ar: 'منفتحة، منظّمة، فضولية تجاه الجميع' },
  interests: ['art', 'food', 'travel'],
  voice: 'f',
  pitch: 1.1,
  avatar: { skin: '#f4d7c4', hair: { style: 'ponytail', color: '#c2853f' }, top: '#5f8f6f', bottom: '#2f3b4f', shoes: '#e8e2d6', accent: '#e9a23b', accessories: ['backpack'] },
  locationId: 'berlin_wg',
  scenarioId: 'berlin_lena',
});

export const KOFI: Character = friend({
  id: 'kofi',
  name: { ja: 'Kofi Mensah', reading: 'Kofi Mensah', en: 'Kofi Mensah', ar: 'كوفي منساه' },
  age: 33,
  job: { en: 'Bike mechanic, your neighbour on the ground floor', ar: 'ميكانيكي درّاجات، جارك في الطابق الأرضي' },
  bio: {
    en: 'Came from Accra to study engineering, stayed for the bikes. Repairs half the street’s bicycles in the courtyard on Saturdays.',
    ar: 'جاء من أكرا ليدرس الهندسة وبقي من أجل الدرّاجات. يصلح نصف درّاجات الشارع في الفناء أيام السبت.',
  },
  personality: { en: 'Easy-going, helpful, laughs a lot', ar: 'هادئ الطبع، خدوم، كثير الضحك' },
  interests: ['sports', 'tech', 'music'],
  voice: 'm',
  pitch: 0.95,
  avatar: { skin: '#7b4a2e', hair: { style: 'short', color: '#151210' }, top: '#d6772e', bottom: '#2c3440', shoes: '#3a3a3a', accent: '#2e8bd6', accessories: ['beanie'] },
  locationId: 'berlin_hof',
  scenarioId: 'berlin_kofi',
});

export const JONAS: Character = friend({
  id: 'jonas',
  name: { ja: 'Jonas Weber', reading: 'Jonas Weber', en: 'Jonas Weber', ar: 'يوناس فيبر' },
  age: 27,
  job: { en: 'Software developer, your language-exchange partner', ar: 'مطوّر برمجيات، شريكك في تبادل اللغة' },
  bio: {
    en: 'Writes software by day and learns Arabic in the evenings. Meets you every week at a café for a Sprach-Tandem: half German, half Arabic.',
    ar: 'يكتب البرمجيات نهارًا ويتعلّم العربية مساءً. يلتقيك كل أسبوع في مقهى لتبادل اللغة: نصف ألماني ونصف عربي.',
  },
  personality: { en: 'Patient, nerdy, loves wordplay', ar: 'صبور، مولع بالتقنية، يحب التلاعب بالكلمات' },
  interests: ['tech', 'books', 'gaming'],
  voice: 'm',
  pitch: 1.02,
  avatar: { skin: '#efcdb4', hair: { style: 'short', color: '#5a3d26' }, top: '#3b4f7a', bottom: '#2a2a2a', shoes: '#f0f0f0', accent: '#7ac0a8', accessories: ['glasses'] },
  locationId: 'berlin_cafe',
  scenarioId: 'berlin_jonas',
});

export const LENA_MEET: Scenario = {
  id: 'berlin_lena',
  locationId: 'berlin_wg',
  characterId: 'lena',
  level: 'A1',
  title: { en: 'Meet your flatmate', ar: 'تعرّف على شريكتك في السكن' },
  setup: {
    en: 'Your first evening in the WG (flat share). Lena is in the kitchen. Tell her your name, where you are from and what you like doing.',
    ar: 'أمسيتك الأولى في السكن المشترك. لينا في المطبخ. أخبرها باسمك ومن أين أنت وماذا تحب أن تفعل.',
  },
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
      say: [say(L('Hey! Du bist bestimmt neu in der WG. Ich bin Lena. Und wie heißt du?', "Hey! You must be new in the flat. I'm Lena. And what's your name?", 'مرحبًا! لا بد أنك جديد في السكن. أنا لينا. وما اسمك؟'))],
      suggestions: NAME_CHIPS,
      intents: [tellName('from')],
    }),
    node({
      id: 'from',
      say: [say(L('Freut mich, {name}! Woher kommst du?', 'Nice to meet you, {name}! Where are you from?', 'تشرّفت، {name}! من أين أنت؟'))],
      suggestions: [
        S('Ich komme aus Ägypten.', 'I’m from Egypt.', 'أنا من مصر.'),
        S('Ich komme aus Marokko.', 'I’m from Morocco.', 'أنا من المغرب.'),
        S('Ich komme aus England.', 'I’m from England.', 'أنا من إنجلترا.'),
      ],
      intents: [
        { id: 'from_country', slot: 'country', capture: 'country', slotRequired: true, next: 'hobby', step: 'country', ideal: L('Ich komme aus Ägypten.', 'I’m from Egypt.', 'أنا من مصر.') },
      ],
    }),
    node({
      id: 'hobby',
      emotion: 'excited',
      say: [say(L('Cool! {country} möchte ich auch mal sehen. Was machst du gern in deiner Freizeit?', 'Cool! I’d love to see {country} one day. What do you like doing in your free time?', 'رائع! أودّ أن أرى {country} يومًا ما. ماذا تحب أن تفعل في وقت فراغك؟'))],
      suggestions: [
        S('Ich koche gern.', 'I like cooking.', 'أحب الطبخ.'),
        S('Ich höre gern Musik.', 'I like listening to music.', 'أحب سماع الموسيقى.'),
        S('Ich spiele gern Fußball.', 'I like playing football.', 'أحب لعب كرة القدم.'),
      ],
      intents: [
        {
          id: 'hobby',
          slot: 'hobby',
          slotRequired: true,
          next: 'welcome',
          step: 'hobby',
          remember: { fact: 'hobby', from: 'slot' },
          ideal: L('Ich koche gern.', 'I like cooking.', 'أحب الطبخ.'),
        },
      ],
    }),
    node({
      id: 'welcome',
      end: true,
      emotion: 'happy',
      say: [
        say(L('Super! Dann kochen wir mal zusammen. Willkommen in der WG, {name}!', 'Great! Then let’s cook together sometime. Welcome to the flat, {name}!', 'رائع! إذن نطبخ معًا قريبًا. أهلًا بك في السكن، {name}!'), { slot: 'hobby', in: ['cooking'] }),
        say(L('Schön! Das machen wir mal zusammen. Willkommen in der WG, {name}!', 'Nice! Let’s do that together sometime. Welcome to the flat, {name}!', 'جميل! لنفعل ذلك معًا يومًا ما. أهلًا بك في السكن، {name}!')),
      ],
      intents: [],
    }),
  ]),
};

export const KOFI_MEET: Scenario = {
  id: 'berlin_kofi',
  locationId: 'berlin_hof',
  characterId: 'kofi',
  level: 'A1',
  title: { en: 'Meet your neighbour', ar: 'تعرّف على جارك' },
  setup: {
    en: 'Kofi from the ground floor is fixing a bike in the courtyard. Say hello, tell him your name, and talk about bikes.',
    ar: 'كوفي من الطابق الأرضي يصلح درّاجة في الفناء. سلّم عليه، وأخبره باسمك، وتحدّثا عن الدرّاجات.',
  },
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
      say: [say(L('Hallo! Wohnst du auch hier im Haus?', 'Hi! Do you live in this building too?', 'مرحبًا! هل تسكن في هذا المبنى أيضًا؟'))],
      suggestions: [S('Ja, ich wohne im dritten Stock.', 'Yes, I live on the third floor.', 'نعم، أسكن في الطابق الثالث.'), S('Ja, ich bin neu hier.', 'Yes, I’m new here.', 'نعم، أنا جديد هنا.')],
      intents: [{ id: 'yes', any: ['ja', 'wohne', 'neu', 'genau'], next: 'name', step: 'hello', ideal: L('Ja, ich wohne im dritten Stock.', 'Yes, I live on the third floor.', 'نعم، أسكن في الطابق الثالث.') }],
    }),
    node({
      id: 'name',
      say: [say(L('Cool, willkommen! Ich bin Kofi, aus dem Erdgeschoss. Wie heißt du?', "Cool, welcome! I'm Kofi, from the ground floor. What's your name?", 'رائع، أهلًا بك! أنا كوفي، من الطابق الأرضي. ما اسمك؟'))],
      suggestions: NAME_CHIPS,
      intents: [tellName('bike')],
    }),
    node({
      id: 'bike',
      say: [say(L('Freut mich, {name}! Hast du ein Fahrrad? In Berlin fährt man viel Fahrrad.', 'Nice to meet you, {name}! Do you have a bike? People ride bikes a lot in Berlin.', 'تشرّفت، {name}! هل عندك درّاجة؟ في برلين يركب الناس الدرّاجات كثيرًا.'))],
      suggestions: [S('Ja, ich habe ein Fahrrad.', 'Yes, I have a bike.', 'نعم، عندي درّاجة.'), S('Nein, noch nicht.', 'No, not yet.', 'لا، ليس بعد.')],
      intents: [
        { id: 'has_bike', any: ['ja', 'habe ein', 'hab ein'], next: 'bye_bike', step: 'bike' },
        { id: 'no_bike', any: ['nein', 'noch nicht', 'kein fahrrad', 'habe kein', 'hab kein'], next: 'bye_no_bike', step: 'bike' },
      ],
    }),
    node({
      id: 'bye_bike',
      end: true,
      emotion: 'happy',
      say: [say(L('Super! Wenn es kaputt ist, komm einfach zu mir. Ich repariere Fahrräder!', 'Great! If it breaks, just come to me. I fix bikes!', 'رائع! إذا تعطّلت، تعال إليّ ببساطة. أنا أصلح الدرّاجات!'))],
      intents: [],
    }),
    node({
      id: 'bye_no_bike',
      end: true,
      emotion: 'happy',
      say: [say(L('Kein Problem. Auf dem Flohmarkt gibt es gute alte Fahrräder. Ich helfe dir!', 'No problem. There are good old bikes at the flea market. I’ll help you!', 'لا مشكلة. في سوق البرغوث درّاجات قديمة جيدة. سأساعدك!'))],
      intents: [],
    }),
  ]),
};

export const JONAS_MEET: Scenario = {
  id: 'berlin_jonas',
  locationId: 'berlin_cafe',
  characterId: 'jonas',
  level: 'A1',
  title: { en: 'Meet your language-exchange partner', ar: 'تعرّف على شريكك في تبادل اللغة' },
  setup: {
    en: 'A café in Neukölln, the first Sprach-Tandem: Jonas is learning Arabic, you are learning German. Introduce yourself and plan the next meeting.',
    ar: 'مقهى في نويكولن، أول لقاء لتبادل اللغة: يوناس يتعلّم العربية وأنت تتعلّم الألمانية. عرّف بنفسك وخطّطا للقاء القادم.',
  },
  minutes: 3,
  steps: [
    { id: 'name', text: { en: 'Say your name', ar: 'قل اسمك' } },
    { id: 'german', text: { en: 'Say how long you have been learning German', ar: 'قل منذ متى تتعلّم الألمانية' } },
    { id: 'plan', text: { en: 'Agree to meet again', ar: 'اتّفقا على لقاء آخر' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Hallo! Bist du hier für das Sprach-Tandem? Ich bin Jonas.', "Hi! Are you here for the language exchange? I'm Jonas.", 'مرحبًا! هل أنت هنا من أجل تبادل اللغة؟ أنا يوناس.'))],
      suggestions: [S('Ja! Ich bin {name}.', 'Yes! I’m {name}.', 'نعم! أنا {name}.'), S('Hallo Jonas! Ich heiße {name}.', 'Hi Jonas! My name is {name}.', 'مرحبًا يوناس! اسمي {name}.')],
      intents: [tellName('german')],
    }),
    node({
      id: 'german',
      say: [say(L('Freut mich, {name}! Ich lerne Arabisch. Wie lange lernst du schon Deutsch?', "Nice to meet you, {name}! I'm learning Arabic. How long have you been learning German?", 'تشرّفت، {name}! أنا أتعلّم العربية. منذ متى تتعلّم الألمانية؟'))],
      suggestions: [S('Erst seit ein paar Wochen.', 'Only for a few weeks.', 'منذ بضعة أسابيع فقط.'), S('Seit einem Jahr.', 'For a year.', 'منذ سنة.')],
      intents: [{ id: 'how_long', any: ['seit', 'wochen', 'woche', 'monat', 'jahr', 'tage', 'erst', 'gerade'], next: 'praise', step: 'german', ideal: L('Erst seit ein paar Wochen.', 'Only for a few weeks.', 'منذ بضعة أسابيع فقط.') }],
    }),
    node({
      id: 'praise',
      emotion: 'excited',
      say: [say(L('Wow, dein Deutsch ist schon gut! Sollen wir jede Woche hier üben?', 'Wow, your German is already good! Shall we practise here every week?', 'واو، ألمانيتك جيدة من الآن! هل نتدرّب هنا كل أسبوع؟'))],
      suggestions: [S('Ja, gerne!', 'Yes, I’d love to!', 'نعم، بكل سرور!'), S('Ja, gute Idee!', 'Yes, good idea!', 'نعم، فكرة جيدة!')],
      intents: [
        { id: 'yes', any: ['ja', 'gerne', 'gern', 'gute idee', 'klar', 'okay', 'super'], next: 'bye', step: 'plan' },
        { id: 'not_sure', any: ['nein', 'leider nicht', 'keine zeit', 'weiss nicht', 'vielleicht'], next: 'bye_maybe', step: 'plan' },
      ],
    }),
    node({
      id: 'bye',
      end: true,
      emotion: 'happy',
      say: [say(L('Super! Dann bis nächste Woche, {name}. Tschüss!', 'Great! See you next week then, {name}. Bye!', 'رائع! إلى الأسبوع القادم إذن، {name}. باي!'))],
      intents: [],
    }),
    node({
      id: 'bye_maybe',
      end: true,
      say: [say(L('Kein Problem! Schreib mir einfach, wenn du Zeit hast. Tschüss!', 'No problem! Just text me when you have time. Bye!', 'لا مشكلة! راسلني ببساطة حين يكون لديك وقت. باي!'))],
      intents: [],
    }),
  ]),
};
