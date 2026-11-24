// Madrid's three friends, first meetings (Spanish step 1). Friends say tú from the first word: Lucía, your flatmate in the piso compartido,
// Javi from the third floor (and football: 「¿Eres del Madrid o del Atleti?」), Nadia at the language exchange (intercambio), who practises
// Arabic. Each asks your name, said back with 「¡Mucho gusto!」 (the same whoever says it: no encantado / encantada to guess); Lucía asks
// where you are from and what you like doing.
import type { AvatarSpec, Character, IntentDef, Line, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';

/** what Madrid's characters say to the global intents (thanks, slow, a greeting, …) and when they did not understand */
export const ES_REACTIONS = {
  greet: L('¡Hola!', 'Hello!', 'مرحبًا!'),
  thanks: L('De nada.', 'You’re welcome.', 'عفوًا.'),
  excuse: L('¿Sí?', 'Yes?', 'نعم؟'),
  how_are_you: L('Muy bien, gracias.', 'Very well, thank you.', 'بخير جدًا، شكرًا.'),
  slow: L('Claro. Hablo más despacio.', 'Of course. I’ll speak more slowly.', 'بالطبع. سأتكلّم أبطأ.'),
  goodbye: L('¡Hasta luego!', 'See you later!', 'إلى اللقاء!'),
  fallback: L('¿Perdón? Otra vez, por favor.', 'Sorry? Once more, please.', 'عفوًا؟ مرة أخرى من فضلك.'),
} satisfies Record<string, Line>;

const tellName = (next: string): IntentDef => ({
  id: 'name',
  any: ['me llamo', 'soy', 'mi nombre es', 'llamame'],
  capture: 'name',
  next,
  step: 'name',
  ideal: L('Me llamo {name}.', 'My name is {name}.', 'اسمي {name}.'),
});
const NAME_CHIPS = [S('Me llamo {name}.', 'My name is {name}.', 'اسمي {name}.'), S('Soy {name}. ¡Mucho gusto!', 'I’m {name}. Nice to meet you!', 'أنا {name}. تشرّفت!')];

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

export const LUCIA = friend('lucia', 'Lucía García', 'لوسيا غارسيا', 25, ['Nursing student, your flatmate', 'طالبة تمريض، شريكتك في السكن'],
  ['Shares the flat in Lavapiés with you and studies nursing. Cooks for the whole flat on Sundays and knows every terraza in the barrio.', 'تشاركك الشقة في لابابييس وتدرس التمريض. تطبخ لكل سكان الشقة أيام الأحد وتعرف كل مقهى خارجي في الحيّ.'],
  ['Open, funny, always busy', 'منفتحة، مرحة، مشغولة دائمًا'], ['food', 'music', 'travel'], 'f',
  { skin: '#e8c3a0', hair: { style: 'long', color: '#3b2a1e' }, top: '#e07a5f', bottom: '#2f3b4f', shoes: '#f0f0f0', accent: '#f2cc8f', accessories: ['scarf'] }, 'mad_lucia', 'mad_piso');
export const JAVI = friend('javi', 'Javi Moreno', 'خافي مورينو', 29, ['Sound engineer, your neighbour on the third floor', 'مهندس صوت، جارك في الطابق الثالث'],
  ['Records bands in a studio by the river and plays the guitar on his balcony. Lives and breathes Atlético de Madrid.', 'يسجّل للفرق الموسيقية في استوديو قرب النهر ويعزف الغيتار على شرفته. يعشق نادي أتلتيكو مدريد.'],
  ['Friendly, talkative, a football fan', 'ودود، كثير الكلام، مشجّع لكرة القدم'], ['music', 'sports'], 'm',
  { skin: '#d9a77f', hair: { style: 'short', color: '#1d1a18' }, top: '#c8102e', bottom: '#222222', shoes: '#ffffff', accent: '#ffffff', accessories: ['backpack'] }, 'mad_javi', 'mad_plaza');
export const NADIA = friend('nadia', 'Nadia Benali', 'نادية بنعلي', 27, ['Translator, your language-exchange partner', 'مترجمة، شريكتك في تبادل اللغة'],
  ['Born in Madrid to a family from Tangier. Speaks darija at home and runs a language exchange every Thursday to practise her standard Arabic.', 'وُلدت في مدريد لعائلة من طنجة. تتكلّم الدارجة في البيت وتدير لقاءً لتبادل اللغة كل خميس لتتمرّن على العربية الفصحى.'],
  ['Warm, curious, very organised', 'دافئة، فضولية، منظّمة جدًا'], ['books', 'travel', 'food'], 'f',
  { skin: '#c99a73', hair: { style: 'ponytail', color: '#1a1412' }, top: '#2e5e4e', bottom: '#2c2c34', shoes: '#4a3526', accent: '#e7b75f', accessories: ['glasses'] }, 'mad_nadia', 'mad_intercambio');

export const LUCIA_MEET: Scenario = {
  id: 'mad_lucia',
  locationId: 'mad_piso',
  characterId: 'lucia',
  level: 'A1',
  title: { en: 'Meet your flatmate', ar: 'تعرّف على شريكتك في السكن' },
  setup: { en: 'Lucía is in the kitchen of your new flat. Tell her your name, where you are from and what you like doing.', ar: 'لوسيا في مطبخ شقتك الجديدة. أخبرها باسمك ومن أين أنت وماذا تحب أن تفعل.' },
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
      say: [say(L('¡Hola! ¡Por fin llegas! Soy Lucía, vivo en la habitación de al lado. ¿Cómo te llamas?', 'Hi! You’re here at last! I’m Lucía, I live in the room next door. What’s your name?', 'مرحبًا! وصلت أخيرًا! أنا لوسيا، أسكن في الغرفة المجاورة. ما اسمك؟'))],
      suggestions: NAME_CHIPS,
      intents: [tellName('from')],
    }),
    node({
      id: 'from',
      say: [say(L('¡Mucho gusto, {name}! ¿De dónde eres?', 'Nice to meet you, {name}! Where are you from?', 'تشرّفت، {name}! من أين أنت؟'))],
      suggestions: [S('Soy de Egipto.', 'I’m from Egypt.', 'أنا من مصر.'), S('Soy de Marruecos.', 'I’m from Morocco.', 'أنا من المغرب.'), S('Soy de Inglaterra.', 'I’m from England.', 'أنا من إنجلترا.')],
      intents: [{ id: 'from_country', slot: 'country', capture: 'country', slotRequired: true, next: 'hobby', step: 'country', ideal: L('Soy de Egipto.', 'I’m from Egypt.', 'أنا من مصر.') }],
    }),
    node({
      id: 'hobby',
      emotion: 'excited',
      say: [say(L('¡Qué bien! Me encantaría conocer {country}. ¿Qué te gusta hacer en tu tiempo libre?', 'How nice! I’d love to see {country}. What do you like doing in your free time?', 'ما أجمل ذلك! أودّ أن أزور {country}. ماذا تحب أن تفعل في وقت فراغك؟'))],
      suggestions: [S('Me gusta cocinar.', 'I like cooking.', 'أحب الطبخ.'), S('Me gusta escuchar música.', 'I like listening to music.', 'أحب سماع الموسيقى.'), S('Me gusta jugar al fútbol.', 'I like playing football.', 'أحب لعب كرة القدم.')],
      intents: [{ id: 'hobby', slot: 'hobby', slotRequired: true, next: 'welcome', step: 'hobby', remember: { fact: 'hobby', from: 'slot' }, ideal: L('Me gusta cocinar.', 'I like cooking.', 'أحب الطبخ.') }],
    }),
    node({
      id: 'welcome',
      end: true,
      emotion: 'happy',
      say: [
        say(L('¡Genial! Pues un día cocinamos juntos. ¡Estás en tu casa, {name}!', 'Great! Then let’s cook together one day. Make yourself at home, {name}!', 'رائع! إذن نطبخ معًا يومًا ما. البيت بيتك يا {name}!'), { slot: 'hobby', in: ['cooking'] }),
        say(L('¡Qué guay! Un día lo hacemos juntos. ¡Estás en tu casa, {name}!', 'How cool! Let’s do that together one day. Make yourself at home, {name}!', 'رائع جدًا! لنفعل ذلك معًا يومًا ما. البيت بيتك يا {name}!')),
      ],
      intents: [],
    }),
  ]),
};

export const JAVI_MEET: Scenario = {
  id: 'mad_javi',
  locationId: 'mad_plaza',
  characterId: 'javi',
  level: 'A1',
  title: { en: 'Meet your neighbour on the plaza', ar: 'تعرّف على جارك في الساحة' },
  setup: { en: 'Javi from the third floor stops you on the plaza. Answer his question, tell him your name, and talk about football.', ar: 'خافي من الطابق الثالث يوقفك في الساحة. أجب عن سؤاله، وأخبره باسمك، وتحدّثا عن كرة القدم.' },
  minutes: 3,
  steps: [
    { id: 'hello', text: { en: 'Answer his question', ar: 'أجب عن سؤاله' } },
    { id: 'name', text: { en: 'Say your name', ar: 'قل اسمك' } },
    { id: 'football', text: { en: 'Talk about football', ar: 'تحدّث عن كرة القدم' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('¡Hola! ¿Acabas de llegar al barrio? Te vi ayer con las maletas.', 'Hi! Have you just arrived in the neighbourhood? I saw you yesterday with your suitcases.', 'مرحبًا! هل وصلت إلى الحيّ للتو؟ رأيتك أمس مع الحقائب.'))],
      suggestions: [S('Sí, acabo de llegar.', 'Yes, I’ve just arrived.', 'نعم، وصلت للتو.'), S('Sí, vivo en el segundo.', 'Yes, I live on the second floor.', 'نعم، أسكن في الطابق الثاني.'), S('No, llevo un mes aquí.', 'No, I’ve been here a month.', 'لا، أنا هنا منذ شهر.')],
      intents: [{ id: 'hello', any: ['si', 'acabo', 'llegar', 'llevo', 'vivo', 'no'], next: 'name', step: 'hello', ideal: L('Sí, acabo de llegar.', 'Yes, I’ve just arrived.', 'نعم، وصلت للتو.') }],
    }),
    node({
      id: 'name',
      say: [say(L('¡Encantado! Yo soy Javi, vivo en el tercero. ¿Y tú cómo te llamas?', 'Nice to meet you! I’m Javi, I live on the third floor. And what’s your name?', 'تشرّفت! أنا خافي، أسكن في الطابق الثالث. وأنت، ما اسمك؟'))],
      suggestions: NAME_CHIPS,
      intents: [tellName('football')],
    }),
    node({
      id: 'football',
      say: [say(L('Mucho gusto, {name}. Oye, ¿te gusta el fútbol? Esta noche hay partido.', 'Nice to meet you, {name}. Listen, do you like football? There’s a match tonight.', 'تشرّفت يا {name}. اسمع، هل تحب كرة القدم؟ هناك مباراة الليلة.'))],
      suggestions: [S('Sí, me encanta el fútbol.', 'Yes, I love football.', 'نعم، أحب كرة القدم كثيرًا.'), S('No mucho, la verdad.', 'Not really, to be honest.', 'ليس كثيرًا، في الحقيقة.'), S('¿Qué partido?', 'Which match?', 'أي مباراة؟')],
      intents: [
        { id: 'which_match', any: ['que partido', 'quien juega', 'contra quien'], next: 'match' },
        { id: 'likes', any: ['si', 'me encanta', 'me gusta', 'claro'], none: ['no mucho', 'no me gusta'], next: 'team', step: 'football' },
        { id: 'not_much', any: ['no', 'no mucho', 'nada', 'no me gusta'], next: 'bye_no', step: 'football' },
      ],
    }),
    node({
      id: 'match',
      emotion: 'excited',
      say: [say(L('¡El derbi! El Atleti contra el Real Madrid. ¿Lo vemos juntos en el bar?', 'The derby! Atleti against Real Madrid. Shall we watch it together at the bar?', 'الديربي! أتلتيكو ضد ريال مدريد. هل نشاهدها معًا في البار؟'))],
      suggestions: [S('¡Sí, vamos!', 'Yes, let’s go!', 'نعم، هيا!'), S('Hoy no puedo, lo siento.', 'I can’t today, sorry.', 'لا أستطيع اليوم، آسف.')],
      intents: [
        { id: 'yes', any: ['si', 'vamos', 'vale', 'claro', 'genial'], none: ['no puedo'], next: 'bye_yes', step: 'football' },
        { id: 'no', any: ['no', 'no puedo', 'lo siento', 'otro dia'], next: 'bye_no', step: 'football' },
      ],
    }),
    node({
      id: 'team',
      emotion: 'excited',
      say: [say(L('¡Genial! ¿Y eres del Madrid o del Atleti? Yo soy del Atleti, claro.', 'Great! And are you for Real Madrid or Atleti? I’m Atleti, of course.', 'رائع! وهل تشجّع ريال مدريد أم أتلتيكو؟ أنا أتلتيكو طبعًا.'))],
      suggestions: [S('Soy del Real Madrid.', 'I support Real Madrid.', 'أشجّع ريال مدريد.'), S('Del Atleti, como tú.', 'Atleti, like you.', 'أتلتيكو، مثلك.'), S('De ninguno, la verdad.', 'Neither, to be honest.', 'لا هذا ولا ذاك، في الحقيقة.')],
      intents: [{ id: 'team', any: ['madrid', 'atleti', 'atletico', 'ninguno', 'los dos', 'real'], next: 'bye_yes', step: 'football' }],
    }),
    node({
      id: 'bye_yes',
      end: true,
      emotion: 'happy',
      say: [say(L('¡Vale! Esta noche a las nueve en el Bar El Rincón. ¡Hasta luego, {name}!', 'Okay! Tonight at nine at Bar El Rincón. See you later, {name}!', 'حسنًا! الليلة في التاسعة في «بار إل رينكون». إلى اللقاء يا {name}!'))],
      intents: [],
    }),
    node({
      id: 'bye_no',
      end: true,
      say: [say(L('No pasa nada. Si necesitas algo, estoy en el tercero. ¡Hasta luego, {name}!', 'No problem. If you need anything, I’m on the third floor. See you later, {name}!', 'لا مشكلة. إن احتجت شيئًا فأنا في الطابق الثالث. إلى اللقاء يا {name}!'))],
      intents: [],
    }),
  ]),
};

export const NADIA_MEET: Scenario = {
  id: 'mad_nadia',
  locationId: 'mad_intercambio',
  characterId: 'nadia',
  level: 'A1',
  title: { en: 'Meet your language-exchange partner', ar: 'قابل شريكتك في تبادل اللغة' },
  setup: { en: 'The language exchange meets every Thursday in a bar in Lavapiés. Nadia runs it. Tell her your name, how long you have been learning, and plan the next meeting.', ar: 'لقاء تبادل اللغة كل خميس في بار في لابابييس، وتديره نادية. أخبرها باسمك ومنذ متى تتعلّم، واتّفقا على اللقاء القادم.' },
  minutes: 3,
  steps: [
    { id: 'name', text: { en: 'Say your name', ar: 'قل اسمك' } },
    { id: 'time', text: { en: 'Say how long you have been learning', ar: 'قل منذ متى تتعلّم' } },
    { id: 'plan', text: { en: 'Agree on the next meeting', ar: 'اتّفقا على اللقاء القادم' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('¡Hola! ¿Vienes al intercambio de idiomas? Yo soy Nadia, la organizadora. ¿Cómo te llamas?', 'Hi! Are you here for the language exchange? I’m Nadia, the organiser. What’s your name?', 'مرحبًا! هل جئت للقاء تبادل اللغة؟ أنا نادية، المنظّمة. ما اسمك؟'))],
      suggestions: [S('¡Sí! Me llamo {name}.', 'Yes! My name is {name}.', 'نعم! اسمي {name}.'), S('Sí, soy {name}. ¡Mucho gusto!', 'Yes, I’m {name}. Nice to meet you!', 'نعم، أنا {name}. تشرّفت!')],
      intents: [tellName('since')],
    }),
    node({
      id: 'since',
      say: [say(L('¡Qué bien, {name}! ¿Cuánto tiempo llevas aprendiendo español?', 'Great, {name}! How long have you been learning Spanish?', 'جميل يا {name}! منذ متى تتعلّم الإسبانية؟'))],
      suggestions: [S('Tres meses.', 'Three months.', 'ثلاثة أشهر.'), S('Llevo un año.', 'A year now.', 'منذ سنة.'), S('Acabo de empezar.', 'I’ve just started.', 'بدأت للتو.')],
      intents: [{ id: 'how_long', any: ['mes', 'meses', 'ano', 'anos', 'semana', 'semanas', 'empezar', 'empece', 'poco', 'llevo'], next: 'next_week', step: 'time', ideal: L('Tres meses.', 'Three months.', 'ثلاثة أشهر.') }],
    }),
    node({
      id: 'next_week',
      emotion: 'excited',
      say: [say(L('¡Pues hablas muy bien! Yo practico árabe. ¿Quedamos el jueves que viene? Media hora en español y media en árabe.', 'Well, you speak very well! I practise Arabic. Shall we meet next Thursday? Half an hour in Spanish and half in Arabic.', 'إذن أنت تتكلّم جيدًا جدًا! أنا أتمرّن على العربية. هل نلتقي الخميس القادم؟ نصف ساعة بالإسبانية ونصف بالعربية.'))],
      suggestions: [S('¡Sí, buena idea!', 'Yes, good idea!', 'نعم، فكرة جيدة!'), S('El jueves no puedo. ¿El viernes?', 'I can’t on Thursday. Friday?', 'لا أستطيع يوم الخميس. الجمعة؟')],
      intents: [
        { id: 'friday', any: ['viernes', 'no puedo', 'otro dia'], next: 'bye_friday', step: 'plan', boost: 5 },
        { id: 'yes', any: ['si', 'buena idea', 'vale', 'claro', 'perfecto', 'genial', 'de acuerdo'], next: 'bye', step: 'plan', ideal: L('¡Sí, buena idea!', 'Yes, good idea!', 'نعم، فكرة جيدة!') },
      ],
    }),
    node({ id: 'bye', end: true, emotion: 'happy', say: [say(L('¡Genial! Hasta el jueves, {name}. ¡Chao!', 'Great! See you on Thursday, {name}. Bye!', 'رائع! إلى الخميس يا {name}. باي!'))], intents: [] }),
    node({ id: 'bye_friday', end: true, emotion: 'happy', say: [say(L('¡Vale, el viernes entonces! Hasta el viernes, {name}.', 'Okay, Friday then! See you on Friday, {name}.', 'حسنًا، الجمعة إذن! إلى الجمعة يا {name}.'))], intents: [] }),
  ]),
};
