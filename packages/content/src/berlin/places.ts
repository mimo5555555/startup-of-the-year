// Berlin's places of Chapters 4-6 (German step 5): the Apotheke (a cold: say what hurts, take what the pharmacist recommends, 「Gute
// Besserung!」), the Kneipe 「Zum Eck」 (a drink at the bar, a Bulette, 「Prost!」, 「Zahlen, bitte!」 and cash only), and the Bürgeramt
// (the Anmeldung: an appointment, your papers, your new address). Staff say Sie, as everywhere on the street.
import type { Character, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';
import { PAY_CHIPS, askToPay, payIntents, saleDone, shortOfMoney } from './common';

const person = (c: Omit<Character, 'speaking'> & { voice: 'f' | 'm'; pitch: number }): Character => {
  const { voice, pitch, ...rest } = c;
  return { ...rest, speaking: { rate: 1, pitch, voice } };
};

// ---------------------------------------------------------------------------------------------------------------
// the Apotheke
// ---------------------------------------------------------------------------------------------------------------

/** cents, by the complaint (each has its remedy): throat lozenges, headache tablets, a nasal spray, cough syrup */
export const APOTHEKE_PRICES: Record<string, number> = { hals: 695, kopf: 450, schnupfen: 595, husten: 895 };

export const ANKE: Character = person({
  id: 'anke',
  name: { ja: 'Anke Weber', reading: 'Anke Weber', en: 'Anke Weber', ar: 'أنكه فيبر' },
  age: 48,
  job: { en: 'Pharmacist at the Apotheke am Kiez', ar: 'صيدلانية في صيدلية الحيّ' },
  bio: {
    en: 'Runs the pharmacy with the red A on the corner. Knows every remedy, and every neighbour’s cold by name.',
    ar: 'تدير الصيدلية ذات حرف A الأحمر على الناصية. تعرف كل دواء، وتعرف زكام كل جار باسمه.',
  },
  personality: { en: 'Calm, precise, warm', ar: 'هادئة، دقيقة، ودودة' },
  interests: ['books', 'nature'],
  voice: 'f',
  pitch: 0.97,
  avatar: { skin: '#f0d0b8', hair: { style: 'bob', color: '#8a6a4a' }, top: '#f5f5f2', bottom: '#3a4250', shoes: '#2f2f2f', accent: '#2e8b57', accessories: ['glasses'] },
  locationId: 'berlin_apotheke',
  scenarioId: 'berlin_apotheke',
});

export const APOTHEKE: Scenario = {
  id: 'berlin_apotheke',
  locationId: 'berlin_apotheke',
  characterId: 'anke',
  level: 'A1',
  title: { en: 'Something for a cold', ar: 'شيء لنزلة البرد' },
  setup: {
    en: 'You have a cold. At the Apotheke, say what hurts, take what Frau Weber recommends, and pay.',
    ar: 'أصبت بنزلة برد. في الصيدلية قل ما يؤلمك، وخذ ما تنصحك به السيدة فيبر، ثم ادفع.',
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
      say: [say(L('Guten Tag! Was kann ich für Sie tun?', 'Good afternoon! What can I do for you?', 'مساء الخير! ماذا أستطيع أن أفعل لك؟'))],
      suggestions: [
        S('Ich habe Halsschmerzen.', 'I have a sore throat.', 'عندي التهاب في الحلق.'),
        S('Ich habe Kopfschmerzen.', 'I have a headache.', 'عندي صداع.'),
        S('Ich habe Schnupfen.', 'I have a runny nose.', 'عندي زكام.'),
      ],
      intents: [
        {
          id: 'symptom',
          slot: 'beschwerde',
          slotRequired: true,
          next: 'advice',
          step: 'symptom',
          ideal: L('Ich habe Halsschmerzen.', 'I have a sore throat.', 'عندي التهاب في الحلق.'),
        },
      ],
    }),
    node({
      id: 'advice',
      say: [
        say(L('Oh, das tut mir leid. Ich empfehle Halstabletten. Möchten Sie die?', 'Oh, I’m sorry. I recommend throat lozenges. Would you like them?', 'أوه، آسفة لذلك. أنصح بأقراص للحلق. هل تريدها؟'), { slot: 'beschwerde', in: ['hals'] }),
        say(L('Oh, das tut mir leid. Ich empfehle Tabletten gegen Kopfschmerzen. Möchten Sie die?', 'Oh, I’m sorry. I recommend tablets for headaches. Would you like them?', 'أوه، آسفة لذلك. أنصح بأقراص للصداع. هل تريدها؟'), { slot: 'beschwerde', in: ['kopf'] }),
        say(L('Oh, das tut mir leid. Ich empfehle ein Nasenspray. Möchten Sie das?', 'Oh, I’m sorry. I recommend a nasal spray. Would you like it?', 'أوه، آسفة لذلك. أنصح ببخاخ للأنف. هل تريده؟'), { slot: 'beschwerde', in: ['schnupfen'] }),
        say(L('Oh, das tut mir leid. Ich empfehle einen Hustensaft. Möchten Sie den?', 'Oh, I’m sorry. I recommend a cough syrup. Would you like it?', 'أوه، آسفة لذلك. أنصح بشراب للسعال. هل تريده؟')),
      ],
      suggestions: [S('Ja, bitte.', 'Yes, please.', 'نعم، من فضلك.'), S('Wie oft soll ich das nehmen?', 'How often should I take it?', 'كم مرة يجب أن آخذه؟'), S('Nein, danke.', 'No, thank you.', 'لا، شكرًا.')],
      intents: [
        {
          id: 'dose',
          any: ['wie oft', 'wie viel', 'wann', 'nehmen', 'wie viele'],
          stay: true,
          reply: L('Dreimal am Tag, nach dem Essen. Das steht auch auf der Packung.', 'Three times a day, after meals. It’s on the packet too.', 'ثلاث مرات في اليوم بعد الأكل. هذا مكتوب على العلبة أيضًا.'),
        },
        { id: 'no_thanks', any: ['nein', 'nicht', 'lieber nicht'], next: 'no_buy' },
        { id: 'take', any: ['ja', 'bitte', 'gern', 'gerne', 'nehme', 'okay', 'gut'], none: ['nein', 'nicht'], next: 'pay', step: 'remedy', request: true, ideal: L('Ja, bitte.', 'Yes, please.', 'نعم، من فضلك.') },
      ],
    }),
    node({ id: 'pay', say: askToPay(), suggestions: PAY_CHIPS, intents: payIntents('bye') }),
    saleDone(L('Bitte schön. Gute Besserung!', 'Here you are. Get well soon!', 'تفضّل. أتمنى لك الشفاء العاجل!')),
    node({
      id: 'no_buy',
      end: true,
      emotion: 'happy',
      say: [say(L('Kein Problem. Trinken Sie viel Tee! Gute Besserung!', 'No problem. Drink lots of tea! Get well soon!', 'لا مشكلة. اشرب الكثير من الشاي! أتمنى لك الشفاء العاجل!'))],
      intents: [],
    }),
    shortOfMoney(),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// the Kneipe
// ---------------------------------------------------------------------------------------------------------------

/** cents: a beer (for an adult), a Spezi, an Apfelschorle, a cola; a Bulette (Berlin's meatball) to eat */
export const KNEIPE_PRICES: Record<string, number> = { bier: 380, spezi: 320, schorle: 320, cola: 300, bulette: 350 };

export const UWE: Character = person({
  id: 'uwe',
  name: { ja: 'Uwe Schulz', reading: 'Uwe Schulz', en: 'Uwe Schulz', ar: 'أوفه شولتس' },
  age: 58,
  job: { en: 'Landlord of the Kneipe 「Zum Eck」', ar: 'صاحب حانة «تسوم إك»' },
  bio: {
    en: 'Has stood behind the bar of 「Zum Eck」 for thirty years. Cash only, Buletten made by his wife, and football on the old TV.',
    ar: 'يقف خلف بار «تسوم إك» منذ ثلاثين عامًا. النقد فقط، وكرات اللحم من صنع زوجته، وكرة القدم على التلفاز القديم.',
  },
  personality: { en: 'Gruff, kind underneath, Berliner through and through', ar: 'فظّ ظاهريًا، طيّب في داخله، برليني حتى النخاع' },
  interests: ['sports', 'music'],
  voice: 'm',
  pitch: 0.9,
  avatar: { skin: '#e8c0a0', hair: { style: 'short', color: '#9a9a9a' }, top: '#3b3b3b', bottom: '#2a2a2a', shoes: '#1f1f1f', accent: '#b8860b', accessories: [] },
  locationId: 'berlin_kneipe',
  scenarioId: 'berlin_kneipe',
});

export const KNEIPE: Scenario = {
  id: 'berlin_kneipe',
  locationId: 'berlin_kneipe',
  characterId: 'uwe',
  level: 'A1',
  title: { en: 'An evening at the Kneipe', ar: 'أمسية في الحانة' },
  setup: {
    en: 'The corner Kneipe 「Zum Eck」. Order a drink, maybe a Bulette, say Prost, ask for the bill and pay (cash only!).',
    ar: 'حانة الناصية «تسوم إك». اطلب مشروبًا، وربما «بوليته»، وقل «Prost»، واطلب الحساب وادفع (نقدًا فقط!).',
  },
  minutes: 4,
  steps: [
    { id: 'order', text: { en: 'Order a drink', ar: 'اطلب مشروبًا' } },
    { id: 'prost', text: { en: 'Say Prost', ar: 'قل «Prost»' } },
    { id: 'bill', text: { en: 'Ask for the bill', ar: 'اطلب الحساب' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'neutral',
      say: [say(L('Guten Abend! Was darf es sein?', 'Good evening! What can I get you?', 'مساء الخير! ماذا تشرب؟'))],
      suggestions: [
        { ...S('Ein Bier, bitte.', 'A beer, please.', 'بيرة من فضلك.'), when: { flag: 'adult' } },
        S('Eine Spezi, bitte.', 'A Spezi (cola and orange), please.', 'سبيتسي (كولا وبرتقال) من فضلك.'),
        S('Eine Apfelschorle, bitte.', 'An apple spritzer, please.', 'عصير تفاح بالصودا من فضلك.'),
      ],
      intents: [
        { id: 'order', slot: 'kneipe', slotOptions: ['spezi', 'schorle', 'cola'], none: ['was ist'], slotRequired: true, alsoSlots: ['qty'], next: 'snack', step: 'order', request: true, ideal: L('Eine Spezi, bitte.', 'A Spezi, please.', 'سبيتسي من فضلك.') },
        { id: 'order_beer', when: { flag: 'adult' }, slot: 'kneipe', slotOptions: ['bier'], none: ['was ist'], slotRequired: true, alsoSlots: ['qty'], next: 'snack', step: 'order', request: true },
        // a younger player: no beer here, kindly
        {
          id: 'beer_minor',
          when: { flag: 'minor' },
          slot: 'kneipe',
          slotOptions: ['bier'],
          slotRequired: true,
          stay: true,
          boost: 20,
          reply: L('Bier gibt es nur für Erwachsene. Wie wäre es mit einer Spezi?', 'Beer is for adults only. How about a Spezi?', 'البيرة للكبار فقط. ما رأيك بسبيتسي؟'),
        },
        { id: 'what_spezi', any: ['was ist spezi', 'was ist eine spezi', 'spezi?'], stay: true, reply: L('Spezi ist Cola mit Orangenlimonade. Lecker!', 'Spezi is cola with orange soda. Tasty!', '«سبيتسي» كولا مع صودا البرتقال. لذيذة!') },
      ],
    }),
    node({
      id: 'snack',
      say: [say(L('Kommt sofort. Möchten Sie auch eine Bulette dazu?', 'Coming right up. Would you like a Bulette with it?', 'حالًا. هل تريد «بوليته» معه؟'))],
      suggestions: [S('Ja, eine Bulette, bitte.', 'Yes, a Bulette, please.', 'نعم، «بوليته» من فضلك.'), S('Was ist eine Bulette?', 'What’s a Bulette?', 'ما هي «البوليته»؟'), S('Nein, danke.', 'No, thank you.', 'لا، شكرًا.')],
      intents: [
        { id: 'what_bulette', any: ['was ist'], stay: true, reply: L('Eine Bulette ist eine Frikadelle. So sagt man in Berlin.', 'A Bulette is a meatball. That’s what they say in Berlin.', '«البوليته» كرة لحم. هكذا يقولون في برلين.') },
        { id: 'snack', slot: 'kneipeSnack', none: ['was ist'], slotRequired: true, next: 'prost', request: true, ideal: L('Ja, eine Bulette, bitte.', 'Yes, a Bulette, please.', 'نعم، «بوليته» من فضلك.') },
        { id: 'no_snack', any: ['nein', 'nicht', 'kein', 'nur'], next: 'prost' },
      ],
    }),
    node({
      id: 'prost',
      emotion: 'happy',
      say: [say(L('Bitte schön! Prost!', 'Here you are! Cheers!', 'تفضّل! في صحتك!'))],
      suggestions: [S('Prost!', 'Cheers!', 'في صحتك!'), S('Zum Wohl!', 'To your health!', 'بالهناء!')],
      intents: [{ id: 'prost', any: ['prost', 'wohl', 'cheers'], next: 'later', step: 'prost', ideal: L('Prost!', 'Cheers!', 'في صحتك!') }],
    }),
    node({
      id: 'later',
      say: [say(L('So, möchten Sie noch etwas?', 'So, would you like anything else?', 'هل تريد شيئًا آخر؟'))],
      suggestions: [S('Nein, danke. Zahlen, bitte!', 'No, thanks. The bill, please!', 'لا، شكرًا. الحساب من فضلك!'), S('Ich möchte zahlen.', 'I’d like to pay.', 'أودّ أن أدفع.')],
      intents: [{ id: 'bill', any: ['zahlen', 'rechnung', 'bezahlen', 'nein'], next: 'pay', step: 'bill', ideal: L('Zahlen, bitte!', 'The bill, please!', 'الحساب من فضلك!') }],
    }),
    node({
      id: 'pay',
      say: [
        say(L('Das macht {total}. Bei uns nur bar, bitte.', 'That comes to {total}. Cash only here, please.', 'المجموع {total}. عندنا نقدًا فقط من فضلك.'), { flag: 'priced' }),
        say(L('Bei uns nur bar, bitte.', 'Cash only here, please.', 'عندنا نقدًا فقط من فضلك.')),
      ],
      suggestions: [S('Hier, bitte. Stimmt so!', 'Here you are. Keep the change!', 'تفضّل. احتفظ بالباقي!'), ...PAY_CHIPS],
      intents: payIntents('bye'),
    }),
    saleDone(L('Danke! Schönen Abend noch!', 'Thanks! Have a nice evening!', 'شكرًا! أمسية سعيدة!')),
    shortOfMoney(L('Oh, das reicht nicht. Kein Problem, das nächste Mal!', 'Oh, that’s not enough. No problem, next time!', 'أوه، هذا لا يكفي. لا مشكلة، المرة القادمة!')),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// the Bürgeramt
// ---------------------------------------------------------------------------------------------------------------

export const KRAUSE: Character = person({
  id: 'krause',
  name: { ja: 'Dieter Krause', reading: 'Dieter Krause', en: 'Dieter Krause', ar: 'ديتر كراوزه' },
  age: 55,
  job: { en: 'Clerk at the Bürgeramt Kreuzberg', ar: 'موظف في مكتب شؤون المواطنين في كرويتسبرغ' },
  bio: {
    en: 'Has registered half of Kreuzberg. Forms in order, stamp ready, and a small smile for everyone who brings the right papers.',
    ar: 'سجّل نصف كرويتسبرغ. الاستمارات مرتّبة والختم جاهز، وابتسامة صغيرة لكل من يحضر الأوراق الصحيحة.',
  },
  personality: { en: 'Formal, thorough, secretly friendly', ar: 'رسمي، دقيق، ودود في السرّ' },
  interests: ['books', 'history'],
  voice: 'm',
  pitch: 0.95,
  avatar: { skin: '#f2d2bb', hair: { style: 'short', color: '#6b5a48' }, top: '#5a6b7a', bottom: '#2f3640', shoes: '#2a2a2a', accent: '#c9a227', accessories: ['glasses'] },
  locationId: 'berlin_buergeramt',
  scenarioId: 'berlin_buergeramt',
});

export const BUERGERAMT: Scenario = {
  id: 'berlin_buergeramt',
  locationId: 'berlin_buergeramt',
  characterId: 'krause',
  level: 'A2',
  title: { en: 'Registering your address', ar: 'تسجيل عنوانك' },
  setup: {
    en: 'The Anmeldung: everyone who moves into a flat in Germany registers the address. You have an appointment at the Bürgeramt; bring your papers and say your address.',
    ar: '«الأنميلدونغ»: كل من يسكن في شقة في ألمانيا يسجّل عنوانه. لديك موعد في مكتب شؤون المواطنين؛ أحضر أوراقك وقل عنوانك.',
  },
  minutes: 4,
  steps: [
    { id: 'termin', text: { en: 'Say you have an appointment', ar: 'قل إن لديك موعدًا' } },
    { id: 'anliegen', text: { en: 'Say why you are here', ar: 'قل لماذا أتيت' } },
    { id: 'papiere', text: { en: 'Hand over your papers', ar: 'قدّم أوراقك' } },
    { id: 'adresse', text: { en: 'Say your new address', ar: 'قل عنوانك الجديد' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'neutral',
      say: [say(L('Guten Tag. Haben Sie einen Termin?', 'Good afternoon. Do you have an appointment?', 'مساء الخير. هل لديك موعد؟'))],
      suggestions: [S('Ja, um zehn Uhr.', 'Yes, at ten o’clock.', 'نعم، في الساعة العاشرة.'), S('Ja, ich habe einen Termin.', 'Yes, I have an appointment.', 'نعم، لديّ موعد.'), S('Nein, leider nicht.', 'No, I’m afraid not.', 'لا، للأسف.')],
      intents: [
        { id: 'no_termin', any: ['nein', 'kein', 'nicht'], next: 'lucky', step: 'termin' },
        { id: 'termin', any: ['termin', 'ja', 'uhr', 'zehn'], none: ['nein', 'kein'], next: 'purpose', step: 'termin', ideal: L('Ja, ich habe einen Termin.', 'Yes, I have an appointment.', 'نعم، لديّ موعد.') },
      ],
    }),
    node({
      id: 'lucky',
      say: [say(L('Ohne Termin geht es eigentlich nicht. Aber Sie haben Glück: Gerade ist ein Termin frei. Was kann ich für Sie tun?', 'It doesn’t really work without an appointment. But you’re lucky: one has just come free. What can I do for you?', 'لا يمكن ذلك عادةً بلا موعد. لكنك محظوظ: هناك موعد شاغر الآن. ماذا أستطيع أن أفعل لك؟'))],
      suggestions: [S('Ich möchte mich anmelden.', 'I’d like to register my address.', 'أودّ تسجيل عنواني.'), S('Ich bin umgezogen. Ich möchte mich anmelden.', 'I’ve moved. I’d like to register.', 'انتقلت إلى سكن جديد. أودّ التسجيل.')],
      intents: [{ id: 'anmelden', any: ['anmelden', 'anmeldung', 'umgezogen', 'wohnung', 'adresse', 'melden'], next: 'papers', step: 'anliegen' }],
    }),
    node({
      id: 'purpose',
      say: [say(L('Gut. Was kann ich für Sie tun?', 'Good. What can I do for you?', 'حسنًا. ماذا أستطيع أن أفعل لك؟'))],
      suggestions: [S('Ich möchte mich anmelden.', 'I’d like to register my address.', 'أودّ تسجيل عنواني.'), S('Ich bin umgezogen. Ich möchte mich anmelden.', 'I’ve moved. I’d like to register.', 'انتقلت إلى سكن جديد. أودّ التسجيل.')],
      intents: [{ id: 'anmelden', any: ['anmelden', 'anmeldung', 'umgezogen', 'wohnung', 'adresse', 'melden'], next: 'papers', step: 'anliegen', ideal: L('Ich möchte mich anmelden.', 'I’d like to register my address.', 'أودّ تسجيل عنواني.') }],
    }),
    node({
      id: 'papers',
      say: [say(L('Ihren Pass und die Wohnungsgeberbestätigung, bitte.', 'Your passport and the landlord’s confirmation, please.', 'جواز سفرك وتأكيد المؤجّر من فضلك.'))],
      suggestions: [S('Hier, bitte.', 'Here you are.', 'تفضّل.'), S('Was ist eine Wohnungsgeberbestätigung?', 'What’s a landlord’s confirmation?', 'ما هو تأكيد المؤجّر؟')],
      intents: [
        {
          id: 'what_form',
          any: ['was ist', 'was bedeutet', 'wohnungsgeber'],
          stay: true,
          reply: L('Das ist ein Formular von Ihrem Vermieter. Er bestätigt, dass Sie dort wohnen.', 'It’s a form from your landlord. It confirms that you live there.', 'إنها استمارة من مؤجّرك. يؤكّد فيها أنك تسكن هناك.'),
        },
        { id: 'papers', any: ['hier', 'bitte', 'pass', 'formular', 'bitteschön'], next: 'address', step: 'papiere', ideal: L('Hier, bitte.', 'Here you are.', 'تفضّل.') },
      ],
    }),
    node({
      id: 'address',
      say: [say(L('Danke. Wie ist Ihre neue Adresse?', 'Thank you. What is your new address?', 'شكرًا. ما عنوانك الجديد؟'))],
      suggestions: [S('Oranienstraße zwölf.', 'Oranienstraße twelve.', 'شارع أورانين، رقم اثني عشر.'), S('Meine Adresse ist Oranienstraße zwölf.', 'My address is Oranienstraße twelve.', 'عنواني شارع أورانين، رقم اثني عشر.')],
      intents: [{ id: 'address', any: ['oranienstraße', 'oranienstrasse', 'straße', 'strasse', 'zwölf', 'zwolf', '12', 'adresse'], next: 'floor', step: 'adresse', ideal: L('Meine Adresse ist Oranienstraße zwölf.', 'My address is Oranienstraße twelve.', 'عنواني شارع أورانين، رقم اثني عشر.') }],
    }),
    node({
      id: 'floor',
      say: [say(L('Und in welchem Stock?', 'And on which floor?', 'وفي أيّ طابق؟'))],
      suggestions: [S('Im dritten Stock.', 'On the third floor.', 'في الطابق الثالث.'), S('Dritter Stock, in einer WG.', 'Third floor, in a flat share.', 'الطابق الثالث، في سكن مشترك.')],
      intents: [{ id: 'floor', any: ['dritten', 'dritter', 'dritte', 'stock', '3', 'wg'], next: 'stamp' }],
    }),
    node({
      id: 'stamp',
      emotion: 'happy',
      say: [say(L('Alles klar. Hier ist Ihre Meldebescheinigung. Willkommen in Berlin, {name}!', 'All right. Here is your registration certificate. Welcome to Berlin, {name}!', 'حسنًا. هذه شهادة تسجيلك. أهلًا بك في برلين يا {name}!'))],
      suggestions: [S('Vielen Dank!', 'Thank you very much!', 'شكرًا جزيلًا!'), S('Danke, schönen Tag noch!', 'Thanks, have a nice day!', 'شكرًا، يومًا سعيدًا!')],
      intents: [{ id: 'thanks', any: ['danke', 'dank', 'schön', 'tag', 'wiedersehen'], next: 'end' }],
    }),
    node({ id: 'end', end: true, emotion: 'happy', say: [say(L('Auf Wiedersehen!', 'Goodbye!', 'إلى اللقاء!'))], intents: [] }),
  ]),
};

export const DE_PLACES: Scenario[] = [APOTHEKE, KNEIPE, BUERGERAMT];
export const DE_PLACE_PEOPLE: Character[] = [ANKE, UWE, KRAUSE];
