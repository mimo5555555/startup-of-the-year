// Madrid's street in Spanish (Spanish step 1), in Lavapiés: five shops. Bar El Rincón (Lola says tú, as Madrid's bars do: 「¿Qué te
// pongo?」, a café con leche and a tostada con tomate), the panadería (Carmen, who says usted: a barra de pan, a napolitana, magdalenas),
// the fruit stall at the mercado (Andrés: a kilo of oranges, half a kilo of strawberries, and his olive oil), the churrería (Rafa: churros or porras, a
// chocolate to dip them in) and the Metro ticket office (Marisa: a single ticket or ten journeys, then 「valide en los tornos」).
import type { AvatarSpec, Character, IntentDef, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';
import { PAY_CHIPS_ES, askToPayEs, payIntentsEs, saleDoneEs, shortOfMoneyEs } from './common';

/** cents, by slot option (the fruit by the half kilo: a kilo is two) */
export const MADRID_PRICES: Record<string, number> = {
  cafe: 180, cortado: 160, solo: 140, zumo: 280, tostada: 250, tortilla: 300,
  barra: 110, napolitana: 150, cruasan: 130, magdalenas: 250,
  naranjas: 95, tomates: 120, fresas: 175, platanos: 110, aceite: 850,
  churros: 250, porras: 280, chocolate: 220,
  sencillo: 150, diez: 1220,
};

const person = (id: string, name: string, ar: string, age: number, job: [string, string], bio: [string, string], personality: [string, string], interests: string[], voice: 'f' | 'm', avatar: AvatarSpec, scenarioId: string): Character => ({
  id,
  name: { ja: name, reading: name, en: name, ar },
  age,
  job: { en: job[0], ar: job[1] },
  bio: { en: bio[0], ar: bio[1] },
  personality: { en: personality[0], ar: personality[1] },
  interests,
  speaking: { rate: 1, pitch: voice === 'f' ? 1.06 : 0.96, voice },
  avatar,
  locationId: scenarioId,
  scenarioId,
});

export const LOLA = person('lola', 'Lola Sánchez', 'لولا سانشيث', 48, ['Owner of Bar El Rincón', 'صاحبة «بار إل رينكون»'],
  ['Has run the bar on the corner of the plaza for twenty years. Knows every regular’s coffee and calls everyone by their name.', 'تدير البار على ناصية الساحة منذ عشرين عامًا. تعرف قهوة كل زبون دائم وتنادي الجميع بأسمائهم.'],
  ['Quick, loud, warm', 'سريعة، عالية الصوت، دافئة'], ['food', 'sports'], 'f',
  { skin: '#e8c3a0', hair: { style: 'bun', color: '#2b1d16' }, top: '#1f1f1f', bottom: '#2b2b2b', shoes: '#1c1c1c', accent: '#c0392b', accessories: ['apron'] }, 'mad_bar');
export const CARMEN = person('carmen', 'Carmen Ruiz', 'كارمن رويث', 66, ['Baker at the panadería', 'خبّازة في المخبز'],
  ['Bakes the bread before dawn, as her mother did. Says usted to everyone and has a magdalena for every child.', 'تخبز الخبز قبل الفجر كما كانت تفعل أمها. تخاطب الجميع بـ«usted» ولديها كعكة «مادالينا» لكل طفل.'],
  ['Kind, proper, unhurried', 'لطيفة، مهذّبة، متأنية'], ['food', 'books'], 'f',
  { skin: '#f0d0b8', hair: { style: 'bob', color: '#d8d2c8' }, top: '#f5f0e6', bottom: '#4a3f35', shoes: '#3a2c22', accent: '#d4a24c', accessories: ['apron', 'glasses'] }, 'mad_panaderia');
export const ANDRES = person('andres', 'Andrés López', 'أندريس لوبيث', 55, ['Fruit seller at the mercado', 'بائع فاكهة في السوق'],
  ['Has had the fruit stall at the market since he was a boy. Lets you taste a strawberry before you buy and knows where every orange comes from.', 'يدير كشك الفاكهة في السوق منذ صغره. يدعك تتذوّق حبة فراولة قبل الشراء ويعرف من أين جاءت كل برتقالة.'],
  ['Cheerful, chatty, generous', 'مرح، كثير الكلام، كريم'], ['food', 'nature'], 'm',
  { skin: '#d9a77f', hair: { style: 'short', color: '#4a4a4a' }, top: '#2e7d32', bottom: '#33302c', shoes: '#2f2f2f', accent: '#f39c12', accessories: ['apron', 'cap'] }, 'mad_mercado');
export const RAFA = person('rafa', 'Rafa Navarro', 'رافا نافارو', 35, ['Churrero at the churrería', 'صانع «تشوروس» في محل التشوروس'],
  ['Fries churros and porras from six in the morning, for night owls on their way home and early birds on their way to work.', 'يقلي «التشوروس» و«البوراس» من السادسة صباحًا، لساهري الليل في طريقهم إلى البيت وللمبكّرين في طريقهم إلى العمل.'],
  ['Easy-going, proud of Madrid, always joking', 'هادئ، فخور بمدريد، يمزح دائمًا'], ['food', 'music'], 'm',
  { skin: '#e9c2a0', hair: { style: 'spiky', color: '#1d1a18' }, top: '#ffffff', bottom: '#2c3e50', shoes: '#222222', accent: '#8e5a2b', accessories: ['apron', 'cap'] }, 'mad_churreria');
export const MARISA = person('marisa', 'Marisa Gómez', 'ماريسا غوميث', 50, ['Ticket office at the Metro', 'شبّاك التذاكر في المترو'],
  ['Has sold Metro tickets at Lavapiés station for fifteen years and explains the Tarjeta Multi to every newcomer, twice if needed.', 'تبيع تذاكر المترو في محطة لابابييس منذ خمسة عشر عامًا وتشرح «بطاقة مولتي» لكل قادم جديد، مرتين إن لزم الأمر.'],
  ['Calm, clear, formal', 'هادئة، واضحة، رسمية'], ['travel', 'books'], 'f',
  { skin: '#f2d6c2', hair: { style: 'short', color: '#7a5a3a' }, top: '#c8102e', bottom: '#2c2c34', shoes: '#1c1c1c', accent: '#1f4e9a', accessories: ['glasses'] }, 'mad_metro');

const steps = (...s: Array<[string, string, string]>) => s.map(([id, en, ar]) => ({ id, text: { en, ar } }));
const shop = (id: string, characterId: string, level: 'A1' | 'A2', title: [string, string], setup: [string, string], st: Array<[string, string, string]>, nodes: Scenario['nodes']): Scenario => ({
  id,
  locationId: id,
  characterId,
  level,
  title: { en: title[0], ar: title[1] },
  setup: { en: setup[0], ar: setup[1] },
  minutes: 3,
  steps: steps(...st),
  start: 'start',
  nodes,
});

// ---------- Bar El Rincón: Madrid's bars say tú ----------
const orderBar: IntentDef = {
  id: 'order',
  slot: 'bar',
  slotRequired: true,
  alsoSlots: ['qty', 'barComida'],
  next: 'food',
  step: 'order',
  request: true,
  ideal: L('Un café con leche, por favor.', 'A milky coffee, please.', 'قهوة بالحليب من فضلك.'),
};
export const MAD_BAR = shop('mad_bar', 'lola', 'A1', ['Breakfast at the bar', 'فطور في البار'],
  ['Bar El Rincón, on the corner of the plaza. Order a coffee, something to eat with it, and pay.', '«بار إل رينكون» على ناصية الساحة. اطلب قهوة وشيئًا تأكله معها، ثم ادفع.'],
  [['order', 'Order a drink', 'اطلب مشروبًا'], ['food', 'Something to eat?', 'شيء تأكله؟'], ['pay', 'Pay', 'ادفع']],
  asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('¡Buenos días! ¿Qué te pongo?', 'Good morning! What can I get you?', 'صباح الخير! ماذا أحضر لك؟'))],
      suggestions: [S('Un café con leche, por favor.', 'A milky coffee, please.', 'قهوة بالحليب من فضلك.'), S('Un cortado, por favor.', 'A cortado, please.', 'قهوة «كورتادو» من فضلك.'), S('¿Qué me recomiendas?', 'What do you recommend?', 'بماذا تنصحينني؟')],
      intents: [orderBar, { id: 'recommend', any: ['recomiendas', 'recomienda', 'recomendar', 'que esta bueno', 'que me aconsejas'], next: 'tip' }],
    }),
    node({
      id: 'tip',
      emotion: 'excited',
      say: [say(L('La tostada con tomate es la mejor del barrio. ¡Y el café, claro!', 'The toast with tomato is the best in the neighbourhood. And the coffee, of course!', 'الخبز المحمّص بالطماطم هو الأفضل في الحيّ. والقهوة طبعًا!'))],
      suggestions: [S('Pues un café con leche, por favor.', 'Then a milky coffee, please.', 'إذن قهوة بالحليب من فضلك.'), S('Un zumo de naranja, por favor.', 'An orange juice, please.', 'عصير برتقال من فضلك.')],
      intents: [orderBar],
    }),
    node({
      id: 'food',
      say: [
        say(L('¡Marchando! ¿Algo más?', 'Coming right up! Anything else?', 'حالًا! شيء آخر؟'), { slot: 'barComida', in: ['tostada', 'tortilla'] }),
        say(L('¡Marchando! ¿Y para comer? Tenemos tostadas y tortilla.', 'Coming right up! And to eat? We have toast and tortilla.', 'حالًا! وماذا تأكل؟ لدينا خبز محمّص و«تورتيا».')),
      ],
      suggestions: [S('Una tostada con tomate, por favor.', 'Toast with tomato, please.', 'خبز محمّص بالطماطم من فضلك.'), S('Un pincho de tortilla, por favor.', 'A slice of tortilla, please.', 'قطعة «تورتيا» من فضلك.'), S('No, nada más, gracias.', 'No, nothing else, thanks.', 'لا، لا شيء آخر، شكرًا.')],
      intents: [
        { id: 'food', slot: 'barComida', slotRequired: true, next: 'pay', step: 'food', request: true, ideal: L('Una tostada con tomate, por favor.', 'Toast with tomato, please.', 'خبز محمّص بالطماطم من فضلك.') },
        { id: 'no_more', any: ['no', 'nada mas', 'nada', 'eso es todo', 'ya esta'], next: 'pay' },
      ],
    }),
    node({ id: 'pay', say: askToPayEs(), suggestions: PAY_CHIPS_ES, intents: payIntentsEs('bye') }),
    saleDoneEs(L('¡Gracias! ¡Que vaya bien!', 'Thanks! Have a good one!', 'شكرًا! أتمنى لك يومًا طيبًا!')),
    shortOfMoneyEs(),
  ]),
);

// ---------- the panadería: Carmen says usted ----------
const buyBread: IntentDef = {
  id: 'buy',
  slot: 'pan',
  slotRequired: true,
  alsoSlots: ['qty'],
  none: ['que es'],
  next: 'more',
  step: 'bread',
  request: true,
  ideal: L('Una barra de pan, por favor.', 'A baguette, please.', 'رغيف خبز من فضلك.'),
};
export const MAD_PANADERIA = shop('mad_panaderia', 'carmen', 'A1', ['Bread at the panadería', 'خبز من المخبز'],
  ['Carmen’s bakery smells of fresh bread. Buy a barra (a baguette) or something sweet, and pay.', 'مخبز كارمن تفوح منه رائحة الخبز الطازج. اشترِ «بارّا» (رغيفًا طويلًا) أو شيئًا حلوًا، ثم ادفع.'],
  [['bread', 'Buy bread', 'اشترِ خبزًا'], ['more', 'Anything else?', 'شيء آخر؟'], ['pay', 'Pay', 'ادفع']],
  asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Buenos días. ¿Qué desea?', 'Good morning. What would you like?', 'صباح الخير. ماذا تريد؟'))],
      suggestions: [S('Una barra de pan, por favor.', 'A baguette, please.', 'رغيف خبز من فضلك.'), S('Dos napolitanas de chocolate, por favor.', 'Two chocolate napolitanas, please.', 'اثنتان من «نابوليتانا» الشوكولاتة من فضلك.'), S('¿Qué es una napolitana?', 'What is a napolitana?', 'ما هي «النابوليتانا»؟')],
      intents: [
        buyBread,
        {
          id: 'ask_napolitana',
          all: [['que es', 'que son'], ['napolitana']],
          next: 'explain',
          boost: 10,
        },
      ],
    }),
    node({
      id: 'explain',
      emotion: 'excited',
      say: [say(L('Es un bollo de hojaldre con chocolate dentro. Están recién hechas, ¡muy ricas!', 'It’s a puff pastry with chocolate inside. They’re freshly made, delicious!', 'إنها معجنات هشّة محشوة بالشوكولاتة. طازجة، لذيذة جدًا!'))],
      suggestions: [S('Pues una napolitana, por favor.', 'Then a napolitana, please.', 'إذن «نابوليتانا» من فضلك.'), S('Una barra de pan, por favor.', 'A baguette, please.', 'رغيف خبز من فضلك.')],
      intents: [buyBread],
    }),
    node({
      id: 'more',
      say: [say(L('¿Algo más? Las magdalenas están recién hechas.', 'Anything else? The magdalenas are freshly made.', 'شيء آخر؟ كعكات «المادالينا» طازجة.'))],
      suggestions: [S('Sí, una bolsa de magdalenas, por favor.', 'Yes, a bag of magdalenas, please.', 'نعم، كيس من «المادالينا» من فضلك.'), S('No, nada más, gracias.', 'No, nothing else, thanks.', 'لا، لا شيء آخر، شكرًا.')],
      intents: [
        { id: 'sweet', slot: 'dulce', slotRequired: true, next: 'pay', step: 'more', request: true, ideal: L('Sí, una bolsa de magdalenas, por favor.', 'Yes, a bag of magdalenas, please.', 'نعم، كيس من «المادالينا» من فضلك.') },
        { id: 'no_more', any: ['no', 'nada mas', 'nada', 'eso es todo', 'ya esta'], next: 'pay', step: 'more' },
      ],
    }),
    node({ id: 'pay', say: askToPayEs(), suggestions: PAY_CHIPS_ES, intents: payIntentsEs('bye') }),
    saleDoneEs(L('Gracias. ¡Que tenga un buen día!', 'Thank you. Have a nice day!', 'شكرًا. أتمنى لك يومًا سعيدًا!')),
    shortOfMoneyEs(L('Vaya, no le llega. No se preocupe, otro día.', 'Oh, it’s not quite enough. Don’t worry, another day.', 'أوه، المبلغ لا يكفي. لا تقلق، في يوم آخر.')),
  ]),
);

// ---------- the fruit stall at the mercado: by the kilo ----------
/** the fruit named with its weight in one breath (「Un kilo de naranjas」): straight to the till */
const FRUITS = ['naranja', 'naranjas', 'tomate', 'tomates', 'fresa', 'fresas', 'platano', 'platanos'];
const pickWeighed: IntentDef = {
  id: 'pick_weighed',
  slot: 'peso',
  slotRequired: true,
  alsoSlots: ['fruta'],
  all: [FRUITS],
  next: 'extra',
  step: 'fruit',
  request: true,
  boost: 5,
  ideal: L('Un kilo de naranjas, por favor.', 'A kilo of oranges, please.', 'كيلو برتقال من فضلك.'),
};
const pickFruit: IntentDef = { id: 'pick', slot: 'fruta', slotRequired: true, next: 'weight', step: 'fruit', request: true, ideal: L('Naranjas, por favor.', 'Oranges, please.', 'برتقال من فضلك.') };
export const MAD_MERCADO = shop('mad_mercado', 'andres', 'A1', ['Fruit at the market', 'فاكهة من السوق'],
  ['The fruit stall at the neighbourhood market. Choose some fruit, say how much (a kilo, half a kilo), maybe take some of Andrés’s olive oil, and pay.', 'كشك الفاكهة في سوق الحيّ. اختر فاكهة، وقل الكمية (كيلو، نصف كيلو)، وربما خذ من زيت زيتون أندريس، ثم ادفع.'],
  [['fruit', 'Choose some fruit', 'اختر فاكهة'], ['weight', 'Say how much', 'قل الكمية'], ['pay', 'Pay', 'ادفع']],
  asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('¡Buenos días! ¿Qué le pongo?', 'Good morning! What can I get you?', 'صباح الخير! ماذا أعطيك؟'))],
      suggestions: [S('Un kilo de naranjas, por favor.', 'A kilo of oranges, please.', 'كيلو برتقال من فضلك.'), S('Medio kilo de fresas, por favor.', 'Half a kilo of strawberries, please.', 'نصف كيلو فراولة من فضلك.'), S('¿Están buenas las fresas?', 'Are the strawberries good?', 'هل الفراولة جيدة؟')],
      intents: [pickWeighed, pickFruit, { id: 'taste', all: [['estan buenas', 'estan dulces', 'puedo probar', 'que tal']], next: 'taste', boost: 10 }],
    }),
    node({
      id: 'taste',
      emotion: 'excited',
      say: [say(L('¡Buenísimas! Son de Aranjuez. Pruebe una, pruebe.', 'Wonderful! They’re from Aranjuez. Try one, go on.', 'رائعة! إنها من أرانخويث. جرّب واحدة، تفضّل.'))],
      suggestions: [
        S('¡Qué ricas! Medio kilo de fresas, por favor.', 'Delicious! Half a kilo of strawberries, please.', 'لذيذة! نصف كيلو فراولة من فضلك.'),
        S('Pues fresas, por favor.', 'Strawberries, then, please.', 'إذن فراولة من فضلك.'),
        S('Mejor un kilo de naranjas.', 'A kilo of oranges instead.', 'بل كيلو برتقال.'),
      ],
      intents: [pickWeighed, pickFruit],
    }),
    node({
      id: 'weight',
      say: [say(L('Muy bien. ¿Cuánto le pongo?', 'Very good. How much shall I give you?', 'حسنًا. كم أعطيك؟'))],
      suggestions: [S('Un kilo, por favor.', 'A kilo, please.', 'كيلو من فضلك.'), S('Medio kilo, por favor.', 'Half a kilo, please.', 'نصف كيلو من فضلك.'), S('Dos kilos, por favor.', 'Two kilos, please.', 'كيلوان من فضلك.')],
      intents: [{ id: 'weigh', slot: 'peso', slotRequired: true, next: 'extra', step: 'weight', request: true, ideal: L('Un kilo, por favor.', 'A kilo, please.', 'كيلو من فضلك.') }],
    }),
    node({
      id: 'extra',
      step: 'weight',
      say: [say(L('Aquí tiene. ¿Algo más? Tengo un aceite de oliva buenísimo.', 'Here you are. Anything else? I have a wonderful olive oil.', 'تفضّل. شيء آخر؟ عندي زيت زيتون رائع.'))],
      suggestions: [S('Sí, una lata de aceite, por favor.', 'Yes, a tin of oil, please.', 'نعم، علبة زيت من فضلك.'), S('No, nada más, gracias.', 'No, nothing else, thanks.', 'لا، لا شيء آخر، شكرًا.')],
      intents: [
        { id: 'oil', slot: 'aceite', slotRequired: true, next: 'pay', request: true, ideal: L('Sí, una lata de aceite, por favor.', 'Yes, a tin of oil, please.', 'نعم، علبة زيت من فضلك.') },
        { id: 'no_more', any: ['no', 'nada mas', 'nada', 'eso es todo', 'ya esta'], next: 'pay' },
      ],
    }),
    node({ id: 'pay', say: askToPayEs(), suggestions: PAY_CHIPS_ES, intents: payIntentsEs('bye') }),
    saleDoneEs(L('¡Gracias! ¡Hasta la próxima!', 'Thanks! Until next time!', 'شكرًا! إلى المرة القادمة!')),
    shortOfMoneyEs(),
  ]),
);

// ---------- the churrería: churros or porras ----------
const buyChurros: IntentDef = {
  id: 'buy',
  slot: 'churros',
  slotRequired: true,
  alsoSlots: ['qty', 'churroBebida'],
  none: ['que son', 'que es'],
  next: 'drink',
  step: 'order',
  request: true,
  ideal: L('Una ración de churros, por favor.', 'A portion of churros, please.', 'حصة «تشوروس» من فضلك.'),
};
export const MAD_CHURRERIA = shop('mad_churreria', 'rafa', 'A1', ['Chocolate and churros', 'شوكولاتة و«تشوروس»'],
  ['The churrería on the corner, open from six in the morning. Order churros (or the thicker porras), a hot chocolate to dip them in, and pay.', 'محل «التشوروس» على الناصية، مفتوح من السادسة صباحًا. اطلب «تشوروس» (أو «البوراس» الأسمك)، وشوكولاتة ساخنة لتغمسها فيها، ثم ادفع.'],
  [['order', 'Order churros or porras', 'اطلب «تشوروس» أو «بوراس»'], ['drink', 'Something to drink', 'شيء تشربه'], ['pay', 'Pay', 'ادفع']],
  asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('¡Buenas! ¿Churros o porras?', 'Hi there! Churros or porras?', 'أهلًا! «تشوروس» أم «بوراس»؟'))],
      suggestions: [S('Una ración de churros, por favor.', 'A portion of churros, please.', 'حصة «تشوروس» من فضلك.'), S('¿Qué son las porras?', 'What are porras?', 'ما هي «البوراس»؟'), S('Una ración de porras, por favor.', 'A portion of porras, please.', 'حصة «بوراس» من فضلك.')],
      intents: [buyChurros, { id: 'ask_porras', all: [['que son', 'que es'], ['porra', 'porras']], next: 'explain', boost: 10 }],
    }),
    node({
      id: 'explain',
      emotion: 'excited',
      say: [say(L('Las porras son churros más gordos. ¡Muy de Madrid! Con chocolate están buenísimas.', 'Porras are thicker churros. Very Madrid! They’re wonderful with chocolate.', '«البوراس» «تشوروس» أسمك. مدريدية جدًا! لذيذة جدًا مع الشوكولاتة.'))],
      suggestions: [S('Pues una ración de porras, por favor.', 'Then a portion of porras, please.', 'إذن حصة «بوراس» من فضلك.'), S('Mejor churros, por favor.', 'Churros instead, please.', 'بل «تشوروس» من فضلك.')],
      intents: [buyChurros],
    }),
    node({
      id: 'drink',
      say: [
        say(L('¡Ahora mismo! Los churros, recién hechos.', 'Right away! The churros, freshly made.', 'حالًا! «التشوروس» طازجة.'), { slot: 'churroBebida', in: ['chocolate', 'cafe'] }),
        say(L('¡Ahora mismo! ¿Y un chocolate para mojar?', 'Right away! And a hot chocolate to dip them in?', 'حالًا! وشوكولاتة ساخنة لتغمسها فيها؟')),
      ],
      suggestions: [S('Sí, un chocolate, por favor.', 'Yes, a hot chocolate, please.', 'نعم، شوكولاتة ساخنة من فضلك.'), S('Un café con leche, por favor.', 'A milky coffee, please.', 'قهوة بالحليب من فضلك.'), S('No, gracias.', 'No, thanks.', 'لا، شكرًا.')],
      intents: [
        { id: 'drink', slot: 'churroBebida', slotRequired: true, next: 'pay', step: 'drink', request: true, ideal: L('Sí, un chocolate, por favor.', 'Yes, a hot chocolate, please.', 'نعم، شوكولاتة ساخنة من فضلك.') },
        { id: 'no_drink', any: ['no', 'nada', 'solo los churros', 'solo churros'], next: 'pay', step: 'drink' },
      ],
    }),
    node({ id: 'pay', say: askToPayEs(), suggestions: PAY_CHIPS_ES, intents: payIntentsEs('bye') }),
    saleDoneEs(L('¡Que aproveche!', 'Enjoy!', 'بالهناء والشفاء!')),
    shortOfMoneyEs(),
  ]),
);

// ---------- the Metro ticket office: usted, and the card is validated at the turnstile ----------
const buyTicket: IntentDef = {
  id: 'buy',
  slot: 'billete',
  slotRequired: true,
  alsoSlots: ['qty'],
  none: ['cuanto cuesta', 'cuanto vale'],
  next: 'pay',
  step: 'ticket',
  request: true,
  ideal: L('Un billete sencillo, por favor.', 'A single ticket, please.', 'تذكرة ذهاب من فضلك.'),
};
export const MAD_METRO = shop('mad_metro', 'marisa', 'A1', ['A ticket for the Metro', 'تذكرة للمترو'],
  ['The ticket office at Lavapiés station. Ask for a single ticket or ten journeys on your Tarjeta Multi, and pay.', 'شبّاك التذاكر في محطة لابابييس. اطلب تذكرة ذهاب أو عشر رحلات على «بطاقة مولتي»، ثم ادفع.'],
  [['ticket', 'Ask for a ticket', 'اطلب تذكرة'], ['pay', 'Pay', 'ادفع']],
  asRecord([
    node({
      id: 'start',
      say: [say(L('Buenos días. ¿En qué puedo ayudarle?', 'Good morning. How can I help you?', 'صباح الخير. كيف أستطيع مساعدتك؟'))],
      suggestions: [S('Un billete sencillo, por favor.', 'A single ticket, please.', 'تذكرة ذهاب من فضلك.'), S('Quería un billete de diez viajes.', 'I’d like a ten-journey ticket.', 'أريد تذكرة لعشر رحلات.'), S('¿Cuánto cuesta un billete?', 'How much is a ticket?', 'كم ثمن التذكرة؟')],
      intents: [buyTicket, { id: 'ask_price', any: ['cuanto cuesta', 'cuanto vale', 'cuanto es', 'precio'], next: 'prices' }],
    }),
    node({
      id: 'prices',
      say: [
        say(
          L(
            'El billete sencillo cuesta un euro con cincuenta. El de diez viajes, doce euros con veinte. ¿Cuál quiere?',
            'A single ticket costs one euro fifty. The ten-journey one, twelve euros twenty. Which would you like?',
            'تذكرة الذهاب بيورو وخمسين سنتًا. وتذكرة العشر رحلات باثني عشر يورو وعشرين سنتًا. أيّهما تريد؟',
          ),
        ),
      ],
      suggestions: [S('El de diez viajes, por favor.', 'The ten-journey one, please.', 'تذكرة العشر رحلات من فضلك.'), S('Uno sencillo, por favor.', 'A single one, please.', 'تذكرة ذهاب من فضلك.')],
      intents: [buyTicket],
    }),
    node({ id: 'pay', say: askToPayEs(), suggestions: PAY_CHIPS_ES, intents: payIntentsEs('bye') }),
    saleDoneEs(L('Aquí tiene su tarjeta. Recuerde validarla en los tornos. ¡Buen viaje!', 'Here is your card. Remember to validate it at the turnstiles. Have a good trip!', 'تفضّل بطاقتك. تذكّر أن تمرّرها عند البوابات. رحلة سعيدة!')),
    shortOfMoneyEs(L('Lo siento, no le llega. Puede pagar con tarjeta, si quiere.', 'I’m sorry, that’s not enough. You can pay by card, if you like.', 'آسفة، المبلغ لا يكفي. يمكنك الدفع بالبطاقة إن أردت.')),
  ]),
);
