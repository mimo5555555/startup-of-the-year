// Amsterdam's places of Chapters 4-6 (Dutch step 4): the drogist (a cold: say what hurts, take what she recommends, 「Beterschap!」), the
// brown café ’t Hoekje (a drink at the bar, bitterballen, 「Proost!」, 「Mag ik afrekenen?」, cards only) and the stadsloket of the
// gemeente (registering your address for a BSN: an appointment, your papers, your new address). Staff say u, as everywhere on the canal.
import type { Character, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';
import { PAY_CHIPS_NL, askToPayNl, payIntentsNl, saleDoneNl, shortOfMoneyNl } from './common';

const person = (c: Omit<Character, 'speaking'> & { voice: 'f' | 'm'; pitch: number }): Character => {
  const { voice, pitch, ...rest } = c;
  return { ...rest, speaking: { rate: 1, pitch, voice } };
};

// ---------------------------------------------------------------------------------------------------------------
// the drogist
// ---------------------------------------------------------------------------------------------------------------

/** cents, by the complaint (each has its remedy): throat sweets, paracetamol, a nasal spray, cough syrup */
export const DROGIST_PRICES: Record<string, number> = { keel: 395, hoofd: 249, verkouden: 495, hoest: 695 };

export const MIRJAM: Character = person({
  id: 'mirjam',
  name: { ja: 'Mirjam de Groot', reading: 'Mirjam de Groot', en: 'Mirjam de Groot', ar: 'ميريام دي خروت' },
  age: 45,
  job: { en: 'Drogist at De Drogist on the corner', ar: 'بائعة في محلّ «دي دروخيست» على الناصية' },
  bio: {
    en: 'Knows every cold remedy and every shampoo in the shop. Gives advice for free and says Beterschap like she means it.',
    ar: 'تعرف كل دواء للزكام وكل شامبو في المحل. تنصح مجانًا وتقول «Beterschap» من قلبها.',
  },
  personality: { en: 'Practical, kind, direct', ar: 'عملية، لطيفة، صريحة' },
  interests: ['nature', 'books'],
  voice: 'f',
  pitch: 0.97,
  avatar: { skin: '#f2d4bf', hair: { style: 'bob', color: '#a0522d' }, top: '#2a9d8f', bottom: '#2f3640', shoes: '#2a2a2a', accent: '#e76f51', accessories: ['glasses'] },
  locationId: 'ams_drogist',
  scenarioId: 'ams_drogist',
});

export const AMS_DROGIST: Scenario = {
  id: 'ams_drogist',
  locationId: 'ams_drogist',
  characterId: 'mirjam',
  level: 'A1',
  title: { en: 'Something for a cold', ar: 'شيء لنزلة البرد' },
  setup: {
    en: 'You have a cold. At the drogist, say what hurts, take what Mirjam recommends, and pay.',
    ar: 'أصبت بنزلة برد. في محلّ «الدروخيست» قل ما يؤلمك، وخذ ما تنصحك به ميريام، ثم ادفع.',
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
      say: [say(L('Goedemiddag! Kan ik u ergens mee helpen?', 'Good afternoon! Can I help you with anything?', 'مساء الخير! هل أستطيع مساعدتك بشيء؟'))],
      suggestions: [S('Ik heb keelpijn.', 'I have a sore throat.', 'عندي التهاب في الحلق.'), S('Ik heb hoofdpijn.', 'I have a headache.', 'عندي صداع.'), S('Ik ben verkouden.', 'I have a cold.', 'عندي زكام.')],
      intents: [{ id: 'symptom', slot: 'klacht', slotRequired: true, next: 'advice', step: 'symptom', ideal: L('Ik heb keelpijn.', 'I have a sore throat.', 'عندي التهاب في الحلق.') }],
    }),
    node({
      id: 'advice',
      say: [
        say(L('Wat vervelend. Ik raad keelpastilles aan. Wilt u die?', 'How annoying. I recommend throat sweets. Would you like them?', 'هذا مزعج. أنصح بحلوى للحلق. هل تريدها؟'), { slot: 'klacht', in: ['keel'] }),
        say(L('Wat vervelend. Ik raad paracetamol aan. Wilt u die?', 'How annoying. I recommend paracetamol. Would you like it?', 'هذا مزعج. أنصح بالباراسيتامول. هل تريده؟'), { slot: 'klacht', in: ['hoofd'] }),
        say(L('Wat vervelend. Ik raad een neusspray aan. Wilt u die?', 'How annoying. I recommend a nasal spray. Would you like it?', 'هذا مزعج. أنصح ببخاخ للأنف. هل تريده؟'), { slot: 'klacht', in: ['verkouden'] }),
        say(L('Wat vervelend. Ik raad hoestsiroop aan. Wilt u die?', 'How annoying. I recommend cough syrup. Would you like it?', 'هذا مزعج. أنصح بشراب للسعال. هل تريده؟')),
      ],
      suggestions: [S('Ja, graag.', 'Yes, please.', 'نعم، من فضلك.'), S('Hoe vaak moet ik die nemen?', 'How often should I take it?', 'كم مرة يجب أن آخذه؟'), S('Nee, dank u.', 'No, thank you.', 'لا، شكرًا.')],
      intents: [
        { id: 'dose', any: ['hoe vaak', 'hoeveel', 'wanneer', 'nemen'], stay: true, reply: L('Drie keer per dag. Het staat ook op de verpakking.', 'Three times a day. It’s on the packet too.', 'ثلاث مرات في اليوم. هذا مكتوب على العلبة أيضًا.') },
        { id: 'no_thanks', any: ['nee', 'niet', 'liever niet'], next: 'no_buy' },
        { id: 'take', any: ['ja', 'graag', 'neem', 'oké', 'goed', 'prima'], none: ['nee', 'niet'], next: 'pay', step: 'remedy', request: true, ideal: L('Ja, graag.', 'Yes, please.', 'نعم، من فضلك.') },
      ],
    }),
    node({ id: 'pay', say: askToPayNl(), suggestions: PAY_CHIPS_NL, intents: payIntentsNl('bye') }),
    saleDoneNl(L('Alstublieft. Beterschap!', 'Here you are. Get well soon!', 'تفضّل. أتمنى لك الشفاء العاجل!')),
    node({
      id: 'no_buy',
      end: true,
      emotion: 'happy',
      say: [say(L('Geen probleem. Drink veel thee! Beterschap!', 'No problem. Drink lots of tea! Get well soon!', 'لا مشكلة. اشرب الكثير من الشاي! أتمنى لك الشفاء العاجل!'))],
      intents: [],
    }),
    shortOfMoneyNl(),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// the brown café
// ---------------------------------------------------------------------------------------------------------------

/** cents: a beer (for an adult), a spa rood, a cola; bitterballen to share */
export const KROEG_PRICES: Record<string, number> = { bier: 350, spa: 280, cola: 290, bitterballen: 650 };

export const JOOP: Character = person({
  id: 'joop',
  name: { ja: 'Joop Mulder', reading: 'Joop Mulder', en: 'Joop Mulder', ar: 'يوب مولدر' },
  age: 62,
  job: { en: 'Landlord of the brown café ’t Hoekje', ar: 'صاحب المقهى البنّي «تهوكيه»' },
  bio: {
    en: 'Has run ’t Hoekje by the bridge for thirty years: dark wood, bitterballen with mustard, and a card reader since last year.',
    ar: 'يدير «تهوكيه» عند الجسر منذ ثلاثين عامًا: خشب داكن، و«بِترْبالن» بالخردل، وجهاز بطاقات منذ العام الماضي.',
  },
  personality: { en: 'Dry humour, gezellig, knows the whole canal', ar: 'دعابة جافة، ودود، يعرف القناة كلها' },
  interests: ['sports', 'music'],
  voice: 'm',
  pitch: 0.88,
  avatar: { skin: '#eac2a4', hair: { style: 'short', color: '#b0b0b0' }, top: '#5a3a24', bottom: '#2a2a2a', shoes: '#1f1f1f', accent: '#c9a227', accessories: [] },
  locationId: 'ams_kroeg',
  scenarioId: 'ams_kroeg',
});

export const AMS_KROEG: Scenario = {
  id: 'ams_kroeg',
  locationId: 'ams_kroeg',
  characterId: 'joop',
  level: 'A1',
  title: { en: 'An evening at the brown café', ar: 'أمسية في المقهى البنّي' },
  setup: {
    en: 'The brown café ’t Hoekje by the bridge. Order a drink, maybe bitterballen, say Proost, ask for the bill and pay (cards only!).',
    ar: 'المقهى البنّي «تهوكيه» عند الجسر. اطلب مشروبًا، وربما «بِترْبالن»، وقل «Proost»، واطلب الحساب وادفع (بالبطاقة فقط!).',
  },
  minutes: 4,
  steps: [
    { id: 'order', text: { en: 'Order a drink', ar: 'اطلب مشروبًا' } },
    { id: 'proost', text: { en: 'Say Proost', ar: 'قل «Proost»' } },
    { id: 'bill', text: { en: 'Ask for the bill', ar: 'اطلب الحساب' } },
    { id: 'pay', text: { en: 'Pay', ar: 'ادفع' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'neutral',
      say: [say(L('Goedenavond! Wat mag het zijn?', 'Good evening! What can I get you?', 'مساء الخير! ماذا تشرب؟'))],
      suggestions: [
        { ...S('Een biertje, graag.', 'A beer, please.', 'بيرة من فضلك.'), when: { flag: 'adult' } },
        S('Een spa rood, graag.', 'A sparkling water, please.', 'ماء فوّار من فضلك.'),
        S('Een cola, graag.', 'A cola, please.', 'كولا من فضلك.'),
      ],
      intents: [
        { id: 'order', slot: 'kroeg', slotOptions: ['spa', 'cola'], none: ['wat is'], slotRequired: true, alsoSlots: ['qty'], next: 'snack', step: 'order', request: true, ideal: L('Een spa rood, graag.', 'A sparkling water, please.', 'ماء فوّار من فضلك.') },
        { id: 'order_beer', when: { flag: 'adult' }, slot: 'kroeg', slotOptions: ['bier'], none: ['wat is'], slotRequired: true, alsoSlots: ['qty'], next: 'snack', step: 'order', request: true },
        // a younger player: no beer here, kindly
        {
          id: 'beer_minor',
          when: { flag: 'minor' },
          slot: 'kroeg',
          slotOptions: ['bier'],
          slotRequired: true,
          stay: true,
          boost: 20,
          reply: L('Bier is alleen voor volwassenen. Wilt u een spa rood?', 'Beer is for adults only. Would you like a sparkling water?', 'البيرة للكبار فقط. هل تريد ماءً فوّارًا؟'),
        },
        { id: 'what_spa', any: ['wat is spa', 'wat is een spa'], stay: true, reply: L('Spa rood is water met bubbels.', 'Spa rood is water with bubbles.', '«سبا رود» ماء فوّار.') },
      ],
    }),
    node({
      id: 'snack',
      say: [say(L('Komt eraan. Wilt u er bitterballen bij?', 'Coming up. Would you like bitterballen with it?', 'حالًا. هل تريد «بِترْبالن» معه؟'))],
      suggestions: [S('Ja, graag, bitterballen!', 'Yes, please, bitterballen!', 'نعم، من فضلك، «بِترْبالن»!'), S('Wat zijn bitterballen?', 'What are bitterballen?', 'ما هي «بِترْبالن»؟'), S('Nee, dank u.', 'No, thank you.', 'لا، شكرًا.')],
      intents: [
        { id: 'what_bitterballen', any: ['wat zijn', 'wat is'], stay: true, reply: L('Bitterballen zijn kleine, krokante balletjes met ragout. Met mosterd!', 'Bitterballen are small, crispy balls of ragout. With mustard!', '«بِترْبالن» كرات صغيرة مقرمشة محشوة بالراغو. مع الخردل!') },
        { id: 'snack', slot: 'kroegSnack', none: ['wat zijn', 'wat is'], slotRequired: true, next: 'proost', request: true, ideal: L('Ja, graag, bitterballen!', 'Yes, please, bitterballen!', 'نعم، من فضلك، «بِترْبالن»!') },
        { id: 'no_snack', any: ['nee', 'niet', 'geen', 'alleen'], next: 'proost' },
      ],
    }),
    node({
      id: 'proost',
      emotion: 'happy',
      say: [say(L('Alstublieft! Proost!', 'Here you are! Cheers!', 'تفضّل! في صحتك!'))],
      suggestions: [S('Proost!', 'Cheers!', 'في صحتك!'), S('Gezondheid!', 'To your health!', 'بالهناء!')],
      intents: [{ id: 'proost', any: ['proost', 'gezondheid', 'santé', 'sante', 'cheers'], next: 'later', step: 'proost', ideal: L('Proost!', 'Cheers!', 'في صحتك!') }],
    }),
    node({
      id: 'later',
      say: [say(L('Wilt u nog iets?', 'Would you like anything else?', 'هل تريد شيئًا آخر؟'))],
      suggestions: [S('Nee, dank u. Mag ik afrekenen?', 'No, thanks. Can I pay?', 'لا، شكرًا. هل أستطيع أن أدفع؟'), S('De rekening, graag.', 'The bill, please.', 'الحساب من فضلك.')],
      intents: [{ id: 'bill', any: ['afrekenen', 'rekening', 'betalen', 'nee'], next: 'pay', step: 'bill', ideal: L('Mag ik afrekenen?', 'Can I pay?', 'هل أستطيع أن أدفع؟') }],
    }),
    node({
      id: 'pay',
      say: [
        say(L('Dat is dan {total}. Hier kunt u alleen pinnen.', 'That will be {total}, then. You can only pay by card here.', 'المجموع {total}. هنا الدفع بالبطاقة فقط.'), { flag: 'priced' }),
        say(L('Hier kunt u alleen pinnen.', 'You can only pay by card here.', 'هنا الدفع بالبطاقة فقط.')),
      ],
      suggestions: PAY_CHIPS_NL,
      intents: payIntentsNl('bye'),
    }),
    saleDoneNl(L('Dank u wel! Fijne avond nog!', 'Thank you! Have a nice evening!', 'شكرًا جزيلًا! أمسية سعيدة!')),
    shortOfMoneyNl(),
  ]),
};

// ---------------------------------------------------------------------------------------------------------------
// the gemeente
// ---------------------------------------------------------------------------------------------------------------

export const ILSE: Character = person({
  id: 'ilse',
  name: { ja: 'Ilse van Dam', reading: 'Ilse van Dam', en: 'Ilse van Dam', ar: 'إلسه فان دام' },
  age: 38,
  job: { en: 'Clerk at the stadsloket (city desk) of the gemeente', ar: 'موظفة في مكتب خدمات البلدية' },
  bio: {
    en: 'Registers new Amsterdammers all day. Patient with forms, quick with the stamp, and she always says welcome.',
    ar: 'تسجّل سكان أمستردام الجدد طوال اليوم. صبورة مع الاستمارات، سريعة بالختم، وتقول دائمًا أهلًا بك.',
  },
  personality: { en: 'Friendly, efficient, precise', ar: 'ودودة، فعّالة، دقيقة' },
  interests: ['books', 'travel'],
  voice: 'f',
  pitch: 1.01,
  avatar: { skin: '#f6dcc8', hair: { style: 'ponytail', color: '#e0c080' }, top: '#3d5a80', bottom: '#2f3640', shoes: '#2a2a2a', accent: '#e63946', accessories: [] },
  locationId: 'ams_gemeente',
  scenarioId: 'ams_gemeente',
});

export const AMS_GEMEENTE: Scenario = {
  id: 'ams_gemeente',
  locationId: 'ams_gemeente',
  characterId: 'ilse',
  level: 'A2',
  title: { en: 'Registering your address', ar: 'تسجيل عنوانك' },
  setup: {
    en: 'Everyone who comes to live in the Netherlands registers at the gemeente and gets a BSN (citizen service number). You have an appointment; bring your papers and say your address.',
    ar: 'كل من يأتي للعيش في هولندا يسجّل في البلدية ويحصل على رقم الخدمة المدنية (BSN). لديك موعد؛ أحضر أوراقك وقل عنوانك.',
  },
  minutes: 4,
  steps: [
    { id: 'afspraak', text: { en: 'Say you have an appointment', ar: 'قل إن لديك موعدًا' } },
    { id: 'doel', text: { en: 'Say why you are here', ar: 'قل لماذا أتيت' } },
    { id: 'papieren', text: { en: 'Hand over your papers', ar: 'قدّم أوراقك' } },
    { id: 'adres', text: { en: 'Say your new address', ar: 'قل عنوانك الجديد' } },
  ],
  start: 'start',
  nodes: asRecord([
    node({
      id: 'start',
      emotion: 'neutral',
      say: [say(L('Goedemorgen. Heeft u een afspraak?', 'Good morning. Do you have an appointment?', 'صباح الخير. هل لديك موعد؟'))],
      suggestions: [S('Ja, om tien uur.', 'Yes, at ten o’clock.', 'نعم، في الساعة العاشرة.'), S('Ja, ik heb een afspraak.', 'Yes, I have an appointment.', 'نعم، لديّ موعد.'), S('Nee, helaas niet.', 'No, I’m afraid not.', 'لا، للأسف.')],
      intents: [
        { id: 'no_afspraak', any: ['nee', 'geen', 'niet'], next: 'lucky', step: 'afspraak' },
        { id: 'afspraak', any: ['afspraak', 'ja', 'uur', 'tien'], none: ['nee', 'geen'], next: 'purpose', step: 'afspraak', ideal: L('Ja, ik heb een afspraak.', 'Yes, I have an appointment.', 'نعم، لديّ موعد.') },
      ],
    }),
    node({
      id: 'lucky',
      say: [say(L('Zonder afspraak kan het eigenlijk niet. Maar u heeft geluk: er is net een plek vrij. Waarmee kan ik u helpen?', 'It doesn’t really work without an appointment. But you’re lucky: a slot has just come free. How can I help you?', 'لا يمكن ذلك عادةً بلا موعد. لكنك محظوظ: هناك موعد شاغر الآن. بماذا أستطيع مساعدتك؟'))],
      suggestions: [S('Ik wil me inschrijven.', 'I’d like to register.', 'أودّ التسجيل.'), S('Ik ben net verhuisd. Ik wil me inschrijven.', 'I’ve just moved. I’d like to register.', 'انتقلت للتو إلى سكن جديد. أودّ التسجيل.')],
      intents: [{ id: 'inschrijven', any: ['inschrijven', 'inschrijving', 'verhuisd', 'adres', 'registreren', 'bsn'], next: 'papers', step: 'doel' }],
    }),
    node({
      id: 'purpose',
      say: [say(L('Goed. Waarmee kan ik u helpen?', 'Good. How can I help you?', 'حسنًا. بماذا أستطيع مساعدتك؟'))],
      suggestions: [S('Ik wil me inschrijven.', 'I’d like to register.', 'أودّ التسجيل.'), S('Ik ben net verhuisd. Ik wil me inschrijven.', 'I’ve just moved. I’d like to register.', 'انتقلت للتو إلى سكن جديد. أودّ التسجيل.')],
      intents: [{ id: 'inschrijven', any: ['inschrijven', 'inschrijving', 'verhuisd', 'adres', 'registreren', 'bsn'], next: 'papers', step: 'doel', ideal: L('Ik wil me inschrijven.', 'I’d like to register.', 'أودّ التسجيل.') }],
    }),
    node({
      id: 'papers',
      say: [say(L('Mag ik uw paspoort en uw huurcontract?', 'May I have your passport and your rental contract?', 'هل لي بجواز سفرك وعقد الإيجار؟'))],
      suggestions: [S('Alstublieft.', 'Here you are.', 'تفضّلي.'), S('Waarom het huurcontract?', 'Why the rental contract?', 'لماذا عقد الإيجار؟')],
      intents: [
        { id: 'why', any: ['waarom', 'wat is'], stay: true, reply: L('Daarmee ziet de gemeente dat u daar echt woont.', 'It shows the gemeente that you really live there.', 'به ترى البلدية أنك تسكن هناك فعلًا.') },
        { id: 'papers', any: ['alstublieft', 'hier', 'paspoort', 'contract'], next: 'address', step: 'papieren', ideal: L('Alstublieft.', 'Here you are.', 'تفضّلي.') },
      ],
    }),
    node({
      id: 'address',
      say: [say(L('Dank u. Wat is uw nieuwe adres?', 'Thank you. What is your new address?', 'شكرًا. ما عنوانك الجديد؟'))],
      suggestions: [S('Ruysdaelkade twaalf.', 'Ruysdaelkade twelve.', 'رصيف رويسدال، رقم اثني عشر.'), S('Mijn adres is Ruysdaelkade twaalf.', 'My address is Ruysdaelkade twelve.', 'عنواني رصيف رويسدال، رقم اثني عشر.')],
      intents: [{ id: 'address', any: ['ruysdaelkade', 'kade', 'straat', 'twaalf', '12', 'adres'], next: 'floor', step: 'adres', ideal: L('Mijn adres is Ruysdaelkade twaalf.', 'My address is Ruysdaelkade twelve.', 'عنواني رصيف رويسدال، رقم اثني عشر.') }],
    }),
    node({
      id: 'floor',
      say: [say(L('En op welke verdieping?', 'And on which floor?', 'وفي أيّ طابق؟'))],
      suggestions: [S('Driehoog.', 'Third floor.', 'الطابق الثالث.'), S('Op de derde verdieping.', 'On the third floor.', 'في الطابق الثالث.')],
      intents: [{ id: 'floor', any: ['driehoog', 'derde', 'verdieping', '3', 'hoog'], next: 'stamp' }],
    }),
    node({
      id: 'stamp',
      emotion: 'happy',
      say: [say(L('Prima. U bent ingeschreven. Uw BSN krijgt u per post. Welkom in Amsterdam, {name}!', 'Fine. You are registered. Your BSN comes by post. Welcome to Amsterdam, {name}!', 'حسنًا. تمّ تسجيلك. سيصلك رقم الخدمة المدنية بالبريد. أهلًا بك في أمستردام يا {name}!'))],
      suggestions: [S('Dank u wel!', 'Thank you very much!', 'شكرًا جزيلًا!'), S('Dank u, fijne dag nog!', 'Thanks, have a nice day!', 'شكرًا، يومًا سعيدًا!')],
      intents: [{ id: 'thanks', any: ['dank', 'bedankt', 'fijne', 'dag', 'ziens'], next: 'end' }],
    }),
    node({ id: 'end', end: true, emotion: 'happy', say: [say(L('Tot ziens!', 'Goodbye!', 'إلى اللقاء!'))], intents: [] }),
  ]),
};

export const NL_PLACES: Scenario[] = [AMS_DROGIST, AMS_KROEG, AMS_GEMEENTE];
export const NL_PLACE_PEOPLE: Character[] = [MIRJAM, JOOP, ILSE];
