// Amsterdam's street in Dutch (Dutch step 1): five shops, polite u with the staff. Café De Gracht (koffie verkeerd, appeltaart met
// slagroom), Kaashandel Bakker (taste first, then a half pond), the stroopwafel stall at the Albert Cuyp market, the snack bar
// (「Zeg het maar!」, a patatje met), and the GVB desk (a tram ticket, card only, and 「in- en uitchecken」).
import type { AvatarSpec, Character, IntentDef, Scenario } from '../types';
import { L, S, asRecord, node, say } from '../tokyo/dsl';
import { PAY_CHIPS_NL, askToPayNl, payIntentsNl, saleDoneNl, shortOfMoneyNl } from './common';

/** cents, by slot option (the cheese by the half pond) */
export const AMSTERDAM_PRICES: Record<string, number> = {
  koffie: 300, verkeerd: 380, thee: 280, chocomel: 350, appeltaart: 450,
  jong: 450, belegen: 520, oud: 650, geit: 600,
  gewoon: 250, choco: 350,
  patat: 350, kroket: 300, frikandel: 280, kaassouffle: 290,
  uur: 340, dag: 950,
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

export const FEMKE = person('femke', 'Femke de Vries', 'فيمكه دي فريس', 31, ['Barista at Café De Gracht', 'باريستا في مقهى «دي خراخت»'],
  ['Makes the best koffie verkeerd on the canal and bakes the apple pie herself every morning.', 'تصنع أفضل «كوفي فركيرد» على القناة وتخبز فطيرة التفاح بنفسها كل صباح.'],
  ['Cheerful, quick, says gezellig a lot', 'مرحة، سريعة، تكثر من قول «خيزيليخ»'], ['food', 'music'], 'f',
  { skin: '#f5d7c3', hair: { style: 'ponytail', color: '#d9a441' }, top: '#2e5e4e', bottom: '#2b2b2b', shoes: '#f0f0f0', accent: '#e07a5f', accessories: ['apron'] }, 'ams_cafe');
export const KEES = person('kees', 'Kees Bakker', 'كيس باكر', 61, ['Cheese seller at Kaashandel Bakker', 'بائع جبن في متجر باكر للأجبان'],
  ['Third generation in the family cheese shop. Lets everyone taste before they buy, and knows every Gouda by its age.', 'الجيل الثالث في متجر العائلة للأجبان. يدع الجميع يتذوّقون قبل الشراء، ويعرف كل جبنة غاودا بعمرها.'],
  ['Proud, generous, slow and precise', 'فخور، كريم، متأنٍّ ودقيق'], ['food', 'travel'], 'm',
  { skin: '#f0cbb0', hair: { style: 'short', color: '#cfcac0' }, top: '#f6f1e2', bottom: '#3a4a6a', shoes: '#3a2c22', accent: '#f2b705', accessories: ['apron', 'glasses'] }, 'ams_kaas');
export const JESSE = person('jesse', 'Jesse Smit', 'يسه سميت', 24, ['Stroopwafel baker at the Albert Cuyp market', 'خبّاز «ستروبفافل» في سوق ألبرت كاوب'],
  ['Presses fresh stroopwafels on the market every day, rain or shine, and sings along with the radio.', 'يخبز «ستروبفافل» طازجة في السوق كل يوم، مطرًا كان أو شمسًا، ويغنّي مع الراديو.'],
  ['Loud, friendly, always joking', 'صاخب، ودود، يمزح دائمًا'], ['music', 'sports'], 'm',
  { skin: '#e9c2a0', hair: { style: 'spiky', color: '#3b2a1e' }, top: '#d1495b', bottom: '#2c3e50', shoes: '#ffffff', accent: '#f6c445', accessories: ['cap', 'apron'] }, 'ams_markt');
export const MO = person('mo', 'Mo El Amrani', 'مو العمراني', 42, ['Owner of the snack bar on the corner', 'صاحب محل الوجبات السريعة على الناصية'],
  ['Has fried kroketten and frikandellen for half the neighbourhood since 2009. Asks every customer: zeg het maar!', 'يقلي «الكروكيت» و«الفريكاندل» لنصف الحيّ منذ 2009. يسأل كل زبون: «زيخ هت مار!»'],
  ['Warm, busy, remembers every order', 'دافئ، مشغول، يتذكّر كل طلب'], ['food', 'sports'], 'm',
  { skin: '#c99a73', hair: { style: 'short', color: '#1d1a18' }, top: '#ffffff', bottom: '#33302c', shoes: '#222222', accent: '#f39c12', accessories: ['apron'] }, 'ams_snackbar');
export const INGRID = person('ingrid', 'Ingrid Jansen', 'إنغريد يانسن', 50, ['Service desk at the GVB (Amsterdam’s trams)', 'مكتب الخدمة في «خي في بي» (ترام أمستردام)'],
  ['Has sold tram tickets for twenty years and reminds every newcomer to check in and check out.', 'تبيع تذاكر الترام منذ عشرين عامًا وتذكّر كل قادم جديد بتسجيل الدخول والخروج.'],
  ['Calm, clear, very patient', 'هادئة، واضحة، صبورة جدًا'], ['travel', 'books'], 'f',
  { skin: '#f2d6c2', hair: { style: 'bob', color: '#a8a39a' }, top: '#1f4e9a', bottom: '#2c2c34', shoes: '#1c1c1c', accent: '#e30613', accessories: ['glasses'] }, 'ams_gvb');

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

// ---------- Café De Gracht ----------
const orderCafe: IntentDef = { id: 'order', slot: 'cafe', slotRequired: true, alsoSlots: ['qty'], next: 'extra', step: 'order', request: true, ideal: L('Een koffie verkeerd, graag.', 'A milky coffee, please.', 'قهوة بالحليب من فضلك.') };
export const AMS_CAFE = shop('ams_cafe', 'femke', 'A1', ['Coffee and apple pie by the canal', 'قهوة وفطيرة تفاح عند القناة'],
  ['Café De Gracht, on the canal. Order a coffee, maybe a slice of the famous apple pie, and pay.', 'مقهى «دي خراخت» على القناة. اطلب قهوة، وربما قطعة من فطيرة التفاح الشهيرة، ثم ادفع.'],
  [['order', 'Order a drink', 'اطلب مشروبًا'], ['extra', 'Something with it?', 'شيء معه؟'], ['pay', 'Pay', 'ادفع']],
  asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Goedemorgen! Wat mag het zijn?', 'Good morning! What can I get you?', 'صباح الخير! ماذا تريد؟'))],
      suggestions: [S('Een koffie verkeerd, graag.', 'A milky coffee, please.', 'قهوة بالحليب من فضلك.'), S('Een thee, graag.', 'A tea, please.', 'شاي من فضلك.'), S('Wat raadt u aan?', 'What do you recommend?', 'بماذا تنصحين؟')],
      intents: [orderCafe, { id: 'recommend', any: ['aanraden', 'raadt', 'aanrader', 'wat is lekker'], next: 'tip' }],
    }),
    node({
      id: 'tip',
      emotion: 'excited',
      say: [say(L('Onze appeltaart is beroemd! En de koffie verkeerd is heerlijk.', 'Our apple pie is famous! And the koffie verkeerd is delicious.', 'فطيرة التفاح عندنا مشهورة! والقهوة بالحليب لذيذة.'))],
      suggestions: [S('Dan een koffie verkeerd, graag.', 'Then a milky coffee, please.', 'إذن قهوة بالحليب من فضلك.'), S('Een thee, graag.', 'A tea, please.', 'شاي من فضلك.')],
      intents: [orderCafe],
    }),
    node({
      id: 'extra',
      say: [say(L('Komt eraan. Wilt u er iets bij? We hebben verse appeltaart.', 'Coming up. Would you like something with it? We have fresh apple pie.', 'حالًا. هل تريد شيئًا معه؟ لدينا فطيرة تفاح طازجة.'))],
      suggestions: [S('Ja, een stuk appeltaart, graag.', 'Yes, a slice of apple pie, please.', 'نعم، قطعة فطيرة تفاح من فضلك.'), S('Nee, dank u.', 'No, thank you.', 'لا، شكرًا.'), S('Wat kost dat?', 'How much is that?', 'كم سعر ذلك؟')],
      intents: [
        { id: 'pie', slot: 'taart', slotRequired: true, next: 'cream', step: 'extra', request: true, ideal: L('Ja, een stuk appeltaart, graag.', 'Yes, a slice of apple pie, please.', 'نعم، قطعة فطيرة تفاح من فضلك.') },
        { id: 'no_more', any: ['nee', 'dat is alles', 'niets', 'verder niet', 'dat was het'], next: 'pay' },
        { id: 'ask_price', any: ['wat kost', 'hoeveel', 'kost'], next: 'pay' },
      ],
    }),
    node({
      id: 'cream',
      say: [say(L('Met slagroom?', 'With whipped cream?', 'مع الكريمة المخفوقة؟'))],
      suggestions: [S('Ja, graag!', 'Yes, please!', 'نعم، من فضلك!'), S('Nee, zonder, dank u.', 'No, without, thank you.', 'لا، بدونها، شكرًا.')],
      intents: [
        { id: 'with_cream', any: ['ja', 'graag', 'met slagroom', 'lekker'], none: ['zonder', 'nee'], next: 'pay' },
        { id: 'no_cream', any: ['zonder', 'nee', 'geen slagroom'], next: 'pay' },
      ],
    }),
    node({ id: 'pay', say: askToPayNl(), suggestions: PAY_CHIPS_NL, intents: payIntentsNl('bye') }),
    saleDoneNl(L('Dank u wel! Fijne dag nog!', 'Thank you! Have a nice day!', 'شكرًا جزيلًا! أتمنى لك يومًا سعيدًا!')),
    shortOfMoneyNl(),
  ]),
);

// ---------- Kaashandel Bakker ----------
const pickCheese: IntentDef = { id: 'pick', slot: 'kaas', slotRequired: true, next: 'weight', step: 'cheese', request: true, ideal: L('Een stuk oude kaas, graag.', 'A piece of old cheese, please.', 'قطعة من الجبن المعتّق من فضلك.') };
export const AMS_KAAS = shop('ams_kaas', 'kees', 'A1', ['Tasting at the cheese shop', 'تذوّق في متجر الأجبان'],
  ['Kaashandel Bakker. Ask to taste, choose a Gouda (young, mature or old) and how much, then pay.', 'متجر باكر للأجبان. اطلب التذوّق، واختر جبنة غاودا (طرية أو متوسطة أو معتّقة) والكمية، ثم ادفع.'],
  [['taste', 'Ask to taste', 'اطلب التذوّق'], ['cheese', 'Choose a cheese', 'اختر جبنة'], ['weight', 'Say how much', 'قل الكمية'], ['pay', 'Pay', 'ادفع']],
  asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Goedemiddag! Kan ik u helpen?', 'Good afternoon! Can I help you?', 'مساء الخير! هل أستطيع مساعدتك؟'))],
      suggestions: [S('Mag ik proeven?', 'May I have a taste?', 'هل أستطيع التذوّق؟'), S('Een stuk oude kaas, graag.', 'A piece of old cheese, please.', 'قطعة من الجبن المعتّق من فضلك.'), S('Ik zoek een jonge kaas.', 'I’m looking for a young cheese.', 'أبحث عن جبنة طرية.')],
      intents: [{ id: 'taste', any: ['proeven', 'proef', 'mag ik even'], next: 'taste', step: 'taste', request: true, ideal: L('Mag ik proeven?', 'May I have a taste?', 'هل أستطيع التذوّق؟') }, pickCheese],
    }),
    node({
      id: 'taste',
      emotion: 'excited',
      say: [say(L('Natuurlijk! Proef maar. Dit is jonge kaas, en dit is oude. Pittig, hè?', 'Of course! Have a taste. This is young cheese, and this is old. Strong, isn’t it?', 'بالطبع! تذوّق. هذه جبنة طرية، وهذه معتّقة. قوية، أليس كذلك؟'))],
      suggestions: [S('Lekker! De oude kaas, graag.', 'Tasty! The old cheese, please.', 'لذيذة! الجبنة المعتّقة من فضلك.'), S('De jonge kaas, graag.', 'The young cheese, please.', 'الجبنة الطرية من فضلك.')],
      intents: [pickCheese],
    }),
    node({
      id: 'weight',
      say: [say(L('Prima keuze! Hoeveel mag het zijn?', 'Good choice! How much would you like?', 'اختيار ممتاز! كم تريد؟'))],
      suggestions: [S('Een half pond, graag.', 'Half a pound, please.', 'نصف رطل من فضلك.'), S('Een pond, graag.', 'A pound, please.', 'رطل من فضلك.')],
      intents: [{ id: 'weigh', slot: 'gewicht', slotRequired: true, next: 'pay', step: 'weight', request: true, ideal: L('Een half pond, graag.', 'Half a pound, please.', 'نصف رطل من فضلك.') }],
    }),
    node({ id: 'pay', say: askToPayNl(), suggestions: PAY_CHIPS_NL, intents: payIntentsNl('bye') }),
    saleDoneNl(L('Dank u wel! Eet smakelijk!', 'Thank you! Enjoy!', 'شكرًا جزيلًا! بالهناء!')),
    shortOfMoneyNl(),
  ]),
);

// ---------- the stroopwafel stall ----------
export const AMS_MARKT = shop('ams_markt', 'jesse', 'A1', ['Stroopwafels at the market', '«ستروبفافل» في السوق'],
  ['The Albert Cuyp market. Buy a fresh stroopwafel (or two), maybe with chocolate, and pay.', 'سوق ألبرت كاوب. اشترِ «ستروبفافل» طازجة (أو اثنتين)، وربما بالشوكولاتة، ثم ادفع.'],
  [['order', 'Order', 'اطلب'], ['pay', 'Pay', 'ادفع']],
  asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Goedemiddag! Verse stroopwafels! Hoeveel wilt u?', 'Good afternoon! Fresh stroopwafels! How many would you like?', 'مساء الخير! «ستروبفافل» طازجة! كم تريد؟'))],
      suggestions: [S('Eén stroopwafel, graag.', 'One stroopwafel, please.', '«ستروبفافل» واحدة من فضلك.'), S('Twee stroopwafels, graag.', 'Two stroopwafels, please.', 'اثنتان من «ستروبفافل» من فضلك.'), S('Een met chocolade, graag.', 'One with chocolate, please.', 'واحدة بالشوكولاتة من فضلك.')],
      intents: [{ id: 'buy', slot: 'wafel', slotRequired: true, alsoSlots: ['qty'], next: 'warm', step: 'order', request: true, ideal: L('Twee stroopwafels, graag.', 'Two stroopwafels, please.', 'اثنتان من «ستروبفافل» من فضلك.') }],
    }),
    node({
      id: 'warm',
      say: [say(L('Alstublieft, nog warm! Wilt u er een zakje bij?', 'Here you are, still warm! Would you like a bag for it?', 'تفضّل، ما زالت دافئة! هل تريد كيسًا لها؟'))],
      suggestions: [S('Nee, dank u. Ik eet hem meteen op.', 'No, thanks. I’ll eat it right away.', 'لا، شكرًا. سآكلها فورًا.'), S('Ja, graag.', 'Yes, please.', 'نعم، من فضلك.')],
      intents: [
        { id: 'no_bag', any: ['nee', 'meteen', 'hoeft niet'], next: 'pay' },
        { id: 'bag', any: ['ja', 'graag', 'zakje'], none: ['nee'], next: 'pay' },
      ],
    }),
    node({ id: 'pay', say: askToPayNl(), suggestions: PAY_CHIPS_NL, intents: payIntentsNl('bye') }),
    saleDoneNl(L('Dank u wel! Eet smakelijk!', 'Thank you! Enjoy!', 'شكرًا جزيلًا! بالهناء!')),
    shortOfMoneyNl(),
  ]),
);

// ---------- the snack bar ----------
export const AMS_SNACKBAR = shop('ams_snackbar', 'mo', 'A1', ['A snack at the snack bar', 'وجبة خفيفة في محل الوجبات السريعة'],
  ['The snack bar on the corner. Order fries with mayonnaise (a patatje met), a kroket or a frikandel, and pay.', 'محل الوجبات السريعة على الناصية. اطلب بطاطا مقلية بالمايونيز («باتاتيه مت»)، أو «كروكيت»، أو «فريكاندل»، ثم ادفع.'],
  [['order', 'Order', 'اطلب'], ['pay', 'Pay', 'ادفع']],
  asRecord([
    node({
      id: 'start',
      emotion: 'happy',
      say: [say(L('Zeg het maar!', 'What will it be?', 'تفضّل، ماذا تريد؟'))],
      suggestions: [S('Een patatje met, graag.', 'Fries with mayonnaise, please.', 'بطاطا مقلية بالمايونيز من فضلك.'), S('Een kroket, graag.', 'A kroket, please.', '«كروكيت» من فضلك.'), S('Wat is een frikandel?', 'What is a frikandel?', 'ما هو «الفريكاندل»؟')],
      intents: [
        { id: 'order', slot: 'snack', slotRequired: true, alsoSlots: ['qty'], next: 'anything', step: 'order', request: true, ideal: L('Een patatje met, graag.', 'Fries with mayonnaise, please.', 'بطاطا مقلية بالمايونيز من فضلك.') },
        {
          id: 'ask_frikandel',
          all: [['wat is', 'wat zijn'], ['frikandel']],
          stay: true,
          boost: 10,
          reply: L('Een frikandel is een worstje, gefrituurd. Heel Nederlands!', 'A frikandel is a deep-fried sausage. Very Dutch!', '«الفريكاندل» نقانق مقلية. هولندية جدًا!'),
        },
      ],
    }),
    node({
      id: 'anything',
      say: [say(L('Komt eraan! Verder nog iets?', 'Coming up! Anything else?', 'حالًا! شيء آخر؟'))],
      suggestions: [S('Nee, dat was het.', 'No, that’s it.', 'لا، هذا كل شيء.'), S('Wat kost het?', 'How much is it?', 'كم السعر؟')],
      intents: [
        { id: 'no_more', any: ['nee', 'dat was het', 'dat is alles', 'niets', 'verder niet'], next: 'pay' },
        { id: 'ask_price', any: ['wat kost', 'hoeveel', 'kost'], next: 'pay' },
      ],
    }),
    node({ id: 'pay', say: askToPayNl(), suggestions: PAY_CHIPS_NL, intents: payIntentsNl('bye') }),
    saleDoneNl(L('Alstublieft. Eet smakelijk!', 'Here you are. Enjoy!', 'تفضّل. بالهناء!')),
    shortOfMoneyNl(),
  ]),
);

// ---------- the GVB service desk ----------
export const AMS_GVB = shop('ams_gvb', 'ingrid', 'A1', ['A ticket for the tram', 'تذكرة للترام'],
  ['The GVB service desk at the tram stop. Buy a ticket for an hour or a day; here, as on the tram, you can only pay by card.', 'مكتب خدمة «خي في بي» عند محطة الترام. اشترِ تذكرة لساعة أو ليوم؛ هنا، كما في الترام، الدفع بالبطاقة فقط.'],
  [['ticket', 'Buy a ticket', 'اشترِ تذكرة'], ['pay', 'Pay by card', 'ادفع بالبطاقة']],
  asRecord([
    node({
      id: 'start',
      say: [say(L('Goedendag! Waarmee kan ik u helpen?', 'Good day! How can I help you?', 'نهارك سعيد! بماذا أستطيع مساعدتك؟'))],
      suggestions: [S('Een uurkaart, graag.', 'A one-hour ticket, please.', 'تذكرة لساعة واحدة من فضلك.'), S('Een dagkaart, graag.', 'A day ticket, please.', 'تذكرة يومية من فضلك.'), S('Kan ik contant betalen?', 'Can I pay in cash?', 'هل أستطيع الدفع نقدًا؟')],
      intents: [
        { id: 'buy', slot: 'kaartje', slotRequired: true, alsoSlots: ['qty'], next: 'pay', step: 'ticket', request: true, ideal: L('Een uurkaart, graag.', 'A one-hour ticket, please.', 'تذكرة لساعة واحدة من فضلك.') },
        {
          id: 'ask_cash',
          all: [['contant', 'cash', 'met geld'], ['kan', 'betalen', 'mag']],
          stay: true,
          reply: L('Nee, sorry. Hier en in de tram kunt u alleen pinnen.', 'No, sorry. Here and on the tram you can only pay by card.', 'لا، آسفة. هنا وفي الترام الدفع بالبطاقة فقط.'),
        },
      ],
    }),
    node({
      id: 'pay',
      say: [
        say(L('Dat is dan {total}. U kunt alleen pinnen.', 'That will be {total}, then. You can only pay by card.', 'المجموع {total}. الدفع بالبطاقة فقط.'), { flag: 'priced' }),
        say(L('U kunt alleen pinnen.', 'You can only pay by card.', 'الدفع بالبطاقة فقط.')),
      ],
      suggestions: [S('Pinnen, graag.', 'By card, please.', 'بالبطاقة من فضلك.'), S('Prima, ik pin.', 'Fine, I’ll pay by card.', 'حسنًا، سأدفع بالبطاقة.')],
      intents: [...payIntentsNl('bye', true), { id: 'pin_ok', any: ['ik pin', 'prima', 'oke', 'goed'], none: ['contant'], next: 'bye' }],
    }),
    saleDoneNl(L('Alstublieft. Vergeet niet in en uit te checken! Goede reis!', 'Here you are. Don’t forget to check in and out! Have a good trip!', 'تفضّل. لا تنسَ تسجيل الدخول والخروج! رحلة سعيدة!')),
    shortOfMoneyNl(L('Oei, dat lukt helaas niet. Probeert u het later nog eens!', 'Oops, that didn’t go through, I’m afraid. Please try again later!', 'أوه، لم ينجح ذلك للأسف. حاول مرة أخرى لاحقًا!')),
  ]),
);
