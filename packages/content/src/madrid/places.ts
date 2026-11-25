// Madrid's places of Chapters 4-6 (Spanish step 4): the farmacia (say what hurts, take what Pilar recommends, 「¡Que se mejore!」), an
// evening at Taberna El Farolillo (a caña only for an adult, or a mosto; the free tapa that comes with a drink, a ración of bravas,
// 「¡Salud!」, 「¿Me cobras?」) and the citizens' office (getting on the padrón: cita previa, your papers, your new address with its floor and
// door). Pilar and Concha say usted; Manolo, behind a Madrid bar, says tú.
import type { Character, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';
import { PAY_CHIPS_ES, askToPayEs, payIntentsEs, saleDoneEs, shortOfMoneyEs } from './common';

const person = (c: Omit<Character, 'speaking'> & { voice: 'f' | 'm'; pitch: number }): Character => {
  const { voice, pitch, ...rest } = c;
  return { ...rest, speaking: { rate: 1, pitch, voice } };
};

/** cents: the farmacia by the complaint (each has its remedy), the taberna's drinks and raciones */
export const PLACES_PRICES: Record<string, number> = {
  garganta: 650, cabeza: 250, tos: 795, resfriado: 595,
  cana: 220, mosto: 200, refresco: 250,
  bravas: 550, croquetas: 750,
};

// ---------------------------------------------------------------------------------------------------------------
// the farmacia
// ---------------------------------------------------------------------------------------------------------------

export const PILAR: Character = person({
  id: 'pilar',
  name: { ja: 'Pilar Domínguez', reading: 'Pilar Domínguez', en: 'Pilar Domínguez', ar: 'بيلار دومينغيث' },
  age: 58,
  job: { en: 'Pharmacist at the farmacia with the green cross', ar: 'صيدلانية في الصيدلية ذات الصليب الأخضر' },
  bio: {
    en: 'Has run the pharmacy on the corner for thirty years. Half of Lavapiés asks her advice before they see a doctor.',
    ar: 'تدير الصيدلية على الناصية منذ ثلاثين عامًا. نصف سكان لابابييس يستشيرونها قبل أن يذهبوا إلى الطبيب.',
  },
  personality: { en: 'Calm, careful, motherly', ar: 'هادئة، حريصة، حنونة' },
  interests: ['nature', 'books'],
  voice: 'f',
  pitch: 0.96,
  avatar: { skin: '#efcfb4', hair: { style: 'bob', color: '#6b4a32' }, top: '#ffffff', bottom: '#3b4a5a', shoes: '#2a2a2a', accent: '#2e9e5b', accessories: ['glasses'] },
  locationId: 'mad_farmacia',
  scenarioId: 'mad_farmacia',
});

export const MAD_FARMACIA: Scenario = {
  id: 'mad_farmacia',
  locationId: 'mad_farmacia',
  characterId: 'pilar',
  level: 'A1',
  title: { en: 'Something for a cold', ar: 'شيء لنزلة البرد' },
  setup: {
    en: 'You are not feeling well. At the farmacia, say what hurts (Me duele…), take what Pilar recommends, and pay.',
    ar: 'لست على ما يرام. في الصيدلية قل ما يؤلمك (Me duele…)، وخذ ما تنصحك به بيلار، ثم ادفع.',
  },
  minutes: 3,
  steps: [
    { id: 'symptom', text: { en: 'Say what hurts', ar: 'قل ما يؤلمك' } },
    { id: 'remedy', text: { en: 'Take the remedy', ar: 'خذ الدواء' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'neutral',
      say: [say(L('Buenos días. ¿Qué le pasa?', 'Good morning. What’s the matter?', 'صباح الخير. ما بك؟'))],
      suggestions: [S('Me duele la garganta.', 'I have a sore throat.', 'حلقي يؤلمني.'), S('Me duele la cabeza.', 'I have a headache.', 'رأسي يؤلمني.'), S('Tengo tos.', 'I have a cough.', 'عندي سعال.')],
      intents: [{ id: 'symptom', slot: 'sintoma', slotRequired: true, next: 'advice', step: 'symptom', ideal: L('Me duele la garganta.', 'I have a sore throat.', 'حلقي يؤلمني.') }],
    }),
    node({
      id: 'advice',
      say: [
        say(L('Vaya. Le recomiendo estas pastillas para la garganta. ¿Se las lleva?', 'Oh dear. I recommend these throat lozenges. Will you take them?', 'يا للأسف. أنصحك بأقراص الحلق هذه. هل تأخذها؟'), { slot: 'sintoma', in: ['garganta'] }),
        say(L('Vaya. Le recomiendo paracetamol. ¿Se lo lleva?', 'Oh dear. I recommend paracetamol. Will you take it?', 'يا للأسف. أنصحك بالباراسيتامول. هل تأخذه؟'), { slot: 'sintoma', in: ['cabeza'] }),
        say(L('Vaya. Le recomiendo un espray nasal. ¿Se lo lleva?', 'Oh dear. I recommend a nasal spray. Will you take it?', 'يا للأسف. أنصحك ببخاخ للأنف. هل تأخذه؟'), { slot: 'sintoma', in: ['resfriado'] }),
        say(L('Vaya. Le recomiendo un jarabe para la tos. ¿Se lo lleva?', 'Oh dear. I recommend a cough syrup. Will you take it?', 'يا للأسف. أنصحك بشراب للسعال. هل تأخذه؟')),
      ],
      suggestions: [S('Sí, por favor.', 'Yes, please.', 'نعم، من فضلك.'), S('¿Cada cuánto lo tomo?', 'How often do I take it?', 'كل كم أتناوله؟'), S('No, gracias.', 'No, thank you.', 'لا، شكرًا.')],
      intents: [
        { id: 'dose', any: ['cada cuanto', 'cuantas veces', 'como lo tomo', 'como las tomo', 'cuando'], stay: true, reply: L('Cada ocho horas, con un poco de agua. También lo pone en la caja.', 'Every eight hours, with a little water. It says so on the box too.', 'كل ثماني ساعات مع قليل من الماء. هذا مكتوب على العلبة أيضًا.') },
        { id: 'no_thanks', any: ['no', 'no gracias', 'mejor no'], next: 'no_buy' },
        { id: 'take', any: ['si', 'por favor', 'me lo llevo', 'me las llevo', 'vale', 'de acuerdo', 'perfecto'], none: ['no'], next: 'pay', step: 'remedy', request: true, ideal: L('Sí, por favor.', 'Yes, please.', 'نعم، من فضلك.') },
      ],
    }),
    node({ id: 'pay', say: askToPayEs(), suggestions: PAY_CHIPS_ES, intents: payIntentsEs('bye') }),
    saleDoneEs(L('Aquí tiene. ¡Que se mejore!', 'Here you are. Get well soon!', 'تفضّل. أتمنى لك الشفاء العاجل!')),
    node({
      id: 'no_buy',
      end: true,
      emotion: 'happy',
      say: [say(L('Muy bien. Beba mucha agua y descanse. ¡Que se mejore!', 'Very well. Drink plenty of water and rest. Get well soon!', 'حسنًا. اشرب الكثير من الماء وارتح. أتمنى لك الشفاء العاجل!'))],
      intents: [],
    }),
    shortOfMoneyEs(L('Vaya, no le llega. No se preocupe, vuelva luego.', 'Oh, it’s not quite enough. Don’t worry, come back later.', 'أوه، المبلغ لا يكفي. لا تقلق، عد لاحقًا.')),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// the taberna
// ---------------------------------------------------------------------------------------------------------------

export const MANOLO: Character = person({
  id: 'manolo',
  name: { ja: 'Manolo Ortiz', reading: 'Manolo Ortiz', en: 'Manolo Ortiz', ar: 'مانولو أورتيث' },
  age: 61,
  job: { en: 'Waiter at Taberna El Farolillo', ar: 'نادل في حانة «إل فاروليو»' },
  bio: {
    en: 'Has poured cañas at El Farolillo for forty years. A tapa with every drink, the best bravas in Lavapiés, and a joke for every customer.',
    ar: 'يصبّ البيرة في «إل فاروليو» منذ أربعين عامًا. مع كل مشروب طبق صغير مجاني، وأفضل «بطاطا برافاس» في لابابييس، ونكتة لكل زبون.',
  },
  personality: { en: 'Quick, cheeky, generous', ar: 'سريع، مازح، كريم' },
  interests: ['sports', 'food'],
  voice: 'm',
  pitch: 0.9,
  avatar: { skin: '#e2b896', hair: { style: 'short', color: '#9a9a9a' }, top: '#ffffff', bottom: '#1f1f1f', shoes: '#1a1a1a', accent: '#8b1e1e', accessories: ['apron'] },
  locationId: 'mad_taberna',
  scenarioId: 'mad_taberna',
});

export const MAD_TABERNA: Scenario = {
  id: 'mad_taberna',
  locationId: 'mad_taberna',
  characterId: 'manolo',
  level: 'A1',
  title: { en: 'An evening at the taberna', ar: 'أمسية في الحانة' },
  setup: {
    en: 'Taberna El Farolillo, in the evening. Order a drink (it comes with a free tapa), maybe a ración to share, say ¡Salud!, ask for the bill and pay.',
    ar: 'حانة «إل فاروليو» في المساء. اطلب مشروبًا (يأتي معه طبق صغير مجاني)، وربما طبقًا للمشاركة، وقل «¡Salud!»، واطلب الحساب وادفع.',
  },
  minutes: 4,
  steps: [
    { id: 'order', text: { en: 'Order a drink', ar: 'اطلب مشروبًا' } },
    { id: 'salud', text: { en: 'Say ¡Salud!', ar: 'قل «¡Salud!»' } },
    { id: 'bill', text: { en: 'Ask for the bill', ar: 'اطلب الحساب' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('¡Buenas! ¿Qué va a ser?', 'Evening! What’ll it be?', 'أهلًا! ماذا ستطلب؟'))],
      suggestions: [
        { ...S('Una caña, por favor.', 'A small beer, please.', 'بيرة صغيرة من فضلك.'), when: { flag: 'adult' } },
        S('Un mosto, por favor.', 'A grape juice, please.', 'عصير عنب من فضلك.'),
        S('Un refresco de limón, por favor.', 'A lemon soda, please.', 'مشروبًا غازيًا بالليمون من فضلك.'),
      ],
      intents: [
        { id: 'order', slot: 'taberna', slotOptions: ['mosto', 'refresco'], none: ['que es'], slotRequired: true, alsoSlots: ['qty'], next: 'tapa', step: 'order', request: true, ideal: L('Un mosto, por favor.', 'A grape juice, please.', 'عصير عنب من فضلك.') },
        { id: 'order_beer', when: { flag: 'adult' }, slot: 'taberna', slotOptions: ['cana'], none: ['que es'], slotRequired: true, alsoSlots: ['qty'], next: 'tapa', step: 'order', request: true },
        // a younger player: no beer here, kindly
        {
          id: 'beer_minor',
          when: { flag: 'minor' },
          slot: 'taberna',
          slotOptions: ['cana'],
          slotRequired: true,
          stay: true,
          boost: 20,
          reply: L('Lo siento, la cerveza es solo para mayores de edad. ¿Te pongo un mosto?', 'Sorry, beer is only for adults. Shall I get you a grape juice?', 'آسف، البيرة للبالغين فقط. هل أحضر لك عصير عنب؟'),
        },
        { id: 'what_mosto', any: ['que es un mosto', 'que es el mosto', 'que es mosto'], stay: true, boost: 10, reply: L('El mosto es zumo de uva. ¡Muy de Madrid!', 'Mosto is grape juice. Very Madrid!', '«موستو» عصير عنب. مدريدي جدًا!') },
      ],
    }),
    node({
      id: 'tapa',
      say: [say(L('Aquí tienes, con su tapa: unas aceitunas. ¿Quieres una ración?', 'Here you are, with its tapa: some olives. Would you like a ración to share?', 'تفضّل، مع طبقه الصغير: بعض الزيتون. هل تريد طبقًا للمشاركة؟'))],
      suggestions: [S('Sí, unas patatas bravas, por favor.', 'Yes, some patatas bravas, please.', 'نعم، «بطاطا برافاس» من فضلك.'), S('¿Qué son las bravas?', 'What are bravas?', 'ما هي «البرافاس»؟'), S('No, gracias.', 'No, thank you.', 'لا، شكرًا.')],
      intents: [
        { id: 'what_bravas', any: ['que son', 'que es'], stay: true, reply: L('Patatas fritas con salsa brava, un poco picante. ¡Las mejores de Lavapiés!', 'Fried potatoes with brava sauce, a little spicy. The best in Lavapiés!', 'بطاطا مقلية مع صلصة «برافا» حارّة قليلًا. الأفضل في لابابييس!') },
        { id: 'racion', slot: 'racion', none: ['que son', 'que es'], slotRequired: true, next: 'salud', request: true, ideal: L('Sí, unas patatas bravas, por favor.', 'Yes, some patatas bravas, please.', 'نعم، «بطاطا برافاس» من فضلك.') },
        { id: 'no_racion', any: ['no', 'nada', 'solo', 'asi esta bien'], next: 'salud' },
      ],
    }),
    node({
      id: 'salud',
      emotion: 'happy',
      say: [say(L('¡Que aproveche! ¡Salud!', 'Enjoy! Cheers!', 'بالهناء! في صحتك!'))],
      suggestions: [S('¡Salud!', 'Cheers!', 'في صحتك!'), S('¡Gracias! ¡Salud!', 'Thanks! Cheers!', 'شكرًا! في صحتك!')],
      intents: [{ id: 'salud', any: ['salud', 'chinchin', 'chin chin'], next: 'later', step: 'salud', ideal: L('¡Salud!', 'Cheers!', 'في صحتك!') }],
    }),
    node({
      id: 'later',
      say: [say(L('¿Algo más?', 'Anything else?', 'شيء آخر؟'))],
      suggestions: [S('No, gracias. ¿Me cobras?', 'No, thanks. Can I pay?', 'لا، شكرًا. هل تحاسبني؟'), S('La cuenta, por favor.', 'The bill, please.', 'الحساب من فضلك.')],
      intents: [{ id: 'bill', any: ['me cobras', 'cobras', 'cobrar', 'la cuenta', 'cuenta', 'pagar', 'no'], next: 'pay', step: 'bill', ideal: L('¿Me cobras?', 'Can I pay?', 'هل تحاسبني؟') }],
    }),
    node({ id: 'pay', say: askToPayEs(), suggestions: PAY_CHIPS_ES, intents: payIntentsEs('bye') }),
    saleDoneEs(L('¡Gracias! ¡Buenas noches!', 'Thanks! Good night!', 'شكرًا! تصبح على خير!')),
    shortOfMoneyEs(),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// the padrón
// ---------------------------------------------------------------------------------------------------------------

export const CONCHA: Character = person({
  id: 'concha',
  name: { ja: 'Concha Ortega', reading: 'Concha Ortega', en: 'Concha Ortega', ar: 'كونتشا أورتيغا' },
  age: 52,
  job: { en: 'Clerk at the citizens’ office', ar: 'موظفة في مكتب خدمة المواطنين' },
  bio: {
    en: 'Puts new neighbours on the padrón all day. Patient with papers, quick with the certificate, and she always says welcome.',
    ar: 'تسجّل الجيران الجدد في سجل السكان طوال اليوم. صبورة مع الأوراق، سريعة في إصدار الشهادة، وتقول دائمًا أهلًا بك.',
  },
  personality: { en: 'Friendly, efficient, precise', ar: 'ودودة، فعّالة، دقيقة' },
  interests: ['books', 'travel'],
  voice: 'f',
  pitch: 1.0,
  avatar: { skin: '#f0d2bc', hair: { style: 'ponytail', color: '#3a2a20' }, top: '#2b4c7e', bottom: '#2f3640', shoes: '#2a2a2a', accent: '#c0392b', accessories: [] },
  locationId: 'mad_padron',
  scenarioId: 'mad_padron',
});

const purposeChips = [S('Quiero empadronarme.', 'I’d like to register on the padrón.', 'أودّ التسجيل في سجل السكان.'), S('Acabo de mudarme. Vengo a empadronarme.', 'I’ve just moved. I’ve come to register.', 'انتقلت للتو. جئت لأسجّل.')];
const PURPOSE_KEYS = ['empadronar', 'empadronarme', 'padron', 'mudarme', 'mudado', 'registrar', 'direccion'];

export const MAD_PADRON: Scenario = {
  id: 'mad_padron',
  locationId: 'mad_padron',
  characterId: 'concha',
  level: 'A2',
  title: { en: 'Getting on the padrón', ar: 'التسجيل في سجل السكان' },
  setup: {
    en: 'Everyone who lives in Spain registers their address on the padrón at the town hall: you need it for the health centre, school and many forms. You have an appointment (cita previa); bring your papers and say your address.',
    ar: 'كل من يسكن في إسبانيا يسجّل عنوانه في سجل السكان («البادرون») في البلدية: تحتاجه للمركز الصحي والمدرسة وكثير من المعاملات. لديك موعد مسبق؛ أحضر أوراقك وقل عنوانك.',
  },
  minutes: 4,
  steps: [
    { id: 'cita', text: { en: 'Say you have an appointment', ar: 'قل إن لديك موعدًا' } },
    { id: 'motivo', text: { en: 'Say why you are here', ar: 'قل لماذا أتيت' } },
    { id: 'papeles', text: { en: 'Hand over your papers', ar: 'قدّم أوراقك' } },
    { id: 'direccion', text: { en: 'Say your new address', ar: 'قل عنوانك الجديد' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'neutral',
      say: [say(L('Buenos días. ¿Tiene cita previa?', 'Good morning. Do you have an appointment?', 'صباح الخير. هل لديك موعد مسبق؟'))],
      suggestions: [S('Sí, a las diez.', 'Yes, at ten.', 'نعم، في العاشرة.'), S('Sí, tengo cita.', 'Yes, I have an appointment.', 'نعم، لديّ موعد.'), S('No, lo siento.', 'No, I’m sorry.', 'لا، آسف.')],
      intents: [
        { id: 'no_cita', any: ['no', 'lo siento', 'sin cita'], next: 'lucky', step: 'cita' },
        { id: 'cita', any: ['cita', 'si', 'diez', 'las diez', 'tengo'], none: ['no'], next: 'purpose', step: 'cita', ideal: L('Sí, tengo cita.', 'Yes, I have an appointment.', 'نعم، لديّ موعد.') },
      ],
    }),
    node({
      id: 'lucky',
      say: [say(L('Sin cita es difícil, pero hoy tiene suerte: hay un hueco. ¿En qué le puedo ayudar?', 'Without an appointment it’s hard, but you’re lucky today: there’s a slot free. How can I help you?', 'بلا موعد الأمر صعب، لكنك محظوظ اليوم: هناك موعد شاغر. كيف أستطيع مساعدتك؟'))],
      suggestions: purposeChips,
      intents: [{ id: 'padron', any: PURPOSE_KEYS, next: 'papers', step: 'motivo' }],
    }),
    node({
      id: 'purpose',
      say: [say(L('Muy bien. ¿En qué le puedo ayudar?', 'Very good. How can I help you?', 'حسنًا. كيف أستطيع مساعدتك؟'))],
      suggestions: purposeChips,
      intents: [{ id: 'padron', any: PURPOSE_KEYS, next: 'papers', step: 'motivo', ideal: L('Quiero empadronarme.', 'I’d like to register on the padrón.', 'أودّ التسجيل في سجل السكان.') }],
    }),
    node({
      id: 'papers',
      say: [say(L('¿Me da su pasaporte y su contrato de alquiler?', 'May I have your passport and your rental contract?', 'هل تعطيني جواز سفرك وعقد الإيجار؟'))],
      suggestions: [S('Aquí tiene.', 'Here you are.', 'تفضّلي.'), S('¿Para qué es el contrato?', 'What is the contract for?', 'لماذا العقد؟')],
      intents: [
        { id: 'why', any: ['para que', 'por que'], stay: true, reply: L('Para comprobar que usted vive en esa casa.', 'To check that you live in that home.', 'للتأكد من أنك تسكن في ذلك البيت.') },
        { id: 'papers', any: ['aqui tiene', 'aqui', 'pasaporte', 'contrato', 'tome'], next: 'address', step: 'papeles', ideal: L('Aquí tiene.', 'Here you are.', 'تفضّلي.') },
      ],
    }),
    node({
      id: 'address',
      say: [say(L('Gracias. ¿Cuál es su nueva dirección?', 'Thank you. What is your new address?', 'شكرًا. ما عنوانك الجديد؟'))],
      suggestions: [S('Calle del Ave María, número doce.', 'Calle del Ave María, number twelve.', 'شارع آفي ماريا، رقم اثني عشر.'), S('Mi dirección es Calle del Ave María, doce.', 'My address is Calle del Ave María, twelve.', 'عنواني شارع آفي ماريا، اثنا عشر.')],
      intents: [{ id: 'address', any: ['calle', 'ave maria', 'doce', '12', 'numero', 'direccion'], next: 'floor', step: 'direccion', ideal: L('Mi dirección es Calle del Ave María, doce.', 'My address is Calle del Ave María, twelve.', 'عنواني شارع آفي ماريا، اثنا عشر.') }],
    }),
    node({
      id: 'floor',
      say: [say(L('¿Y qué piso y qué puerta?', 'And which floor and which door?', 'وأي طابق وأي باب؟'))],
      suggestions: [S('Segundo B.', 'Second floor, B.', 'الطابق الثاني، الباب B.'), S('Segundo piso, puerta B.', 'Second floor, door B.', 'الطابق الثاني، الباب B.')],
      intents: [{ id: 'floor', any: ['segundo', 'piso', 'puerta', 'b', '2', 'primero', 'tercero', 'bajo', 'izquierda', 'derecha'], next: 'stamp' }],
    }),
    node({
      id: 'stamp',
      emotion: 'happy',
      say: [say(L('Perfecto. Ya está todo. Aquí tiene su certificado de empadronamiento. ¡Le damos la bienvenida a Madrid, {name}!', 'Perfect. All done. Here is your padrón certificate. Welcome to Madrid, {name}!', 'ممتاز. انتهى كل شيء. تفضّل شهادة التسجيل في سجل السكان. أهلًا بك في مدريد يا {name}!'))],
      suggestions: [S('¡Muchas gracias!', 'Thank you very much!', 'شكرًا جزيلًا!'), S('Gracias, ¡que tenga un buen día!', 'Thanks, have a nice day!', 'شكرًا، أتمنى لك يومًا سعيدًا!')],
      intents: [{ id: 'thanks', any: ['gracias', 'buen dia', 'adios', 'hasta luego'], next: 'end' }],
    }),
    node({ id: 'end', end: true, emotion: 'happy', say: [say(L('Adiós, buenos días.', 'Goodbye, have a good day.', 'إلى اللقاء، يومًا سعيدًا.'))], intents: [] }),
  ]),
};

export const ES_PLACES: Scenario[] = [MAD_FARMACIA, MAD_TABERNA, MAD_PADRON];
export const ES_PLACE_PEOPLE: Character[] = [PILAR, MANOLO, CONCHA];
