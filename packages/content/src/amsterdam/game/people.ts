// Amsterdam's people in the game (Dutch step 2): the three friends (je from the first word), what you can do with each character, and
// the game's view of every conversation.
import type { FriendDef, Interaction, ScenarioMeta } from '@lw/game';
import { L } from '../../tokyo/dsl';

export const NL_FRIENDS: FriendDef[] = [
  {
    id: 'sanne',
    tier: 'A',
    register: 'casual',
    casualAt: 0,
    unlockChapter: 1,
    loves: ['appeltaart', 'markt:choco'],
    likes: ['sweet', 'cheese'],
    dislikes: ['snackbar:frikandel'],
    facts: ['draws_books', 'cat_stroop', 'houseboat'],
    factLines: {
      draws_books: L('Ik teken kinderboeken.', 'I draw children’s books.', 'أرسم كتب الأطفال.'),
      cat_stroop: L('Mijn kat heet Stroop.', 'My cat is called Stroop.', 'قطّتي اسمها «ستروب».'),
      houseboat: L('Ik woon al vijf jaar op de woonboot.', 'I have lived on the houseboat for five years.', 'أعيش في البيت العائم منذ خمس سنوات.'),
    },
    perks: [{ id: 'sanne_taart', heart: 3, text: { en: 'Sanne treats you to apple pie', ar: 'سانه تدعوك إلى فطيرة تفاح' }, fx: { t: 'once_item', itemId: 'cafe:appeltaart' } }],
  },
  {
    id: 'daan',
    tier: 'B',
    register: 'casual',
    casualAt: 0,
    unlockChapter: 2,
    loves: ['kroket', 'patat'],
    likes: ['meal'],
    dislikes: ['cafe:thee'],
    facts: ['courier', 'hundred_km', 'ajax'],
    factLines: {
      courier: L('Ik ben fietskoerier.', 'I’m a bike courier.', 'أنا ساعي بالدرّاجة.'),
      hundred_km: L('Ik fiets honderd kilometer per dag.', 'I cycle a hundred kilometres a day.', 'أقطع مئة كيلومتر يوميًا بالدرّاجة.'),
      ajax: L('Ik ben fan van Ajax.', 'I’m an Ajax fan.', 'أنا من مشجّعي أياكس.'),
    },
    perks: [{ id: 'daan_kroket', heart: 3, text: { en: 'Daan buys you a kroket', ar: 'دان يشتري لك «كروكيت»' }, fx: { t: 'once_item', itemId: 'snackbar:kroket' } }],
  },
  {
    id: 'noor',
    tier: 'A',
    register: 'casual',
    casualAt: 0,
    unlockChapter: 3,
    loves: ['verkeerd', 'kaas:oud'],
    likes: ['coffee', 'cheese'],
    dislikes: [],
    facts: ['teacher', 'grandmother', 'thursday'],
    factLines: {
      teacher: L('Ik ben juf op een basisschool.', 'I’m a primary-school teacher.', 'أنا معلّمة في مدرسة ابتدائية.'),
      grandmother: L('Mijn oma schreef brieven in het Arabisch.', 'My grandmother wrote letters in Arabic.', 'كانت جدّتي تكتب رسائل بالعربية.'),
      thursday: L('Elke donderdag is er taalcafé.', 'Every Thursday there is a language café.', 'كل خميس هناك مقهى للغات.'),
    },
    perks: [{ id: 'noor_koffie', heart: 3, text: { en: 'Noor buys you a koffie verkeerd', ar: 'نور تدعوك إلى قهوة بالحليب' }, fx: { t: 'once_item', itemId: 'cafe:verkeerd' } }],
  },
];

const scenario = (id: string, scenarioId: string, en: string, ar: string, ch = 1): Interaction => ({ id, kind: 'scenario', scenarioId, label: { en, ar }, ch });
const gift = (who: string): Interaction => ({ id: `${who}_gift`, kind: 'gift', label: { en: 'Give a gift', ar: 'قدّم هدية' }, ch: 3 });
/** a chat on any day (`smalltalk_<who>`, social.ts), once the first meeting is done; listed first, so it is what Talk does from then on */
const talk = (who: string, met: string, ch = 1): Interaction => ({
  id: `${who}_talk`,
  kind: 'scenario',
  scenarioId: `smalltalk_${who}`,
  label: { en: 'Small talk', ar: 'دردشة' },
  ch,
  gate: { k: 'scenario', id: met, complete: true },
});
/** a hang-out (hangouts.ts) once the friend is at three hearts, from Chapter 4 */
const hang = (who: string, scenarioId: string): Interaction => ({
  id: `${who}_hang`,
  kind: 'scenario',
  scenarioId,
  label: { en: 'Hang out', ar: 'اقضيا وقتًا معًا' },
  ch: 4,
  gate: { k: 'hearts', friend: who, atLeast: 3 },
});

export const NL_INTERACTIONS: Record<string, Interaction[]> = {
  femke: [scenario('femke_shop', 'ams_cafe', 'Order a coffee', 'اطلب قهوة')],
  mo: [scenario('mo_shop', 'ams_snackbar', 'Order a snack', 'اطلب وجبة خفيفة', 2)],
  ingrid: [scenario('ingrid_shop', 'ams_gvb', 'Buy a ticket', 'اشترِ تذكرة', 2)],
  kees: [scenario('kees_shop', 'ams_kaas', 'Buy cheese', 'اشترِ جبنًا', 3)],
  jesse: [scenario('jesse_shop', 'ams_markt', 'Buy stroopwafels', 'اشترِ «ستروبفافل»', 3)],
  sanne: [talk('sanne', 'ams_sanne'), scenario('sanne_meet', 'ams_sanne', 'Our first chat', 'حديثنا الأول'), gift('sanne'), hang('sanne', 'hang_sanne_pannenkoek')],
  daan: [talk('daan', 'ams_daan', 2), scenario('daan_meet', 'ams_daan', 'Our first chat', 'حديثنا الأول', 2), gift('daan'), hang('daan', 'hang_daan_vondelpark')],
  noor: [talk('noor', 'ams_noor', 3), scenario('noor_meet', 'ams_noor', 'Our first chat', 'حديثنا الأول', 3), gift('noor'), hang('noor', 'hang_noor_verjaardag')],
  // Chapters 4-6 (places.ts)
  mirjam: [scenario('mirjam_shop', 'ams_drogist', 'Get something for a cold', 'اشترِ شيئًا لنزلة البرد', 4)],
  joop: [scenario('joop_bar', 'ams_kroeg', 'An evening at the café', 'أمسية في المقهى', 5)],
  ilse: [scenario('ilse_desk', 'ams_gemeente', 'Register your address', 'سجّل عنوانك', 6)],
};

const map = (shop: string, options: string[]): Record<string, string> => Object.fromEntries(options.map((o) => [o, `${shop}:${o}`]));
const shopMeta = (id: string, place: string, culture: string[], shop: NonNullable<ScenarioMeta['shop']>): ScenarioMeta => ({ id, kind: 'shop', band: 'A1', register: 'polite', pay: 'full', real: true, place, culture, shop });

export const NL_SCENARIO_META: ScenarioMeta[] = [
  shopMeta('ams_cafe', 'ams_cafe', ['cc_verkeerd', 'cc_pinnen'], { shopId: 'cafe', itemSlot: 'cafe', extraSlots: ['taart'], qtySlot: 'qty', payStep: 'pay', itemMap: { ...map('cafe', ['koffie', 'verkeerd', 'thee', 'chocomel']), appeltaart: 'cafe:appeltaart' } }),
  shopMeta('ams_kaas', 'ams_kaas', ['cc_proeven'], { shopId: 'kaas', itemSlot: 'kaas', qtySlot: 'gewicht', payStep: 'pay', itemMap: map('kaas', ['jong', 'belegen', 'oud', 'geit']) }),
  shopMeta('ams_markt', 'ams_markt', ['cc_stroopwafel'], { shopId: 'markt', itemSlot: 'wafel', qtySlot: 'qty', payStep: 'pay', itemMap: { ...map('markt', ['gewoon', 'choco']), blik: 'ams_wafel_blik' } }),
  shopMeta('ams_snackbar', 'ams_snackbar', ['cc_patatje'], { shopId: 'snackbar', itemSlot: 'snack', qtySlot: 'qty', payStep: 'pay', itemMap: map('snackbar', ['patat', 'kroket', 'frikandel', 'kaassouffle']) }),
  shopMeta('ams_gvb', 'ams_gvb', ['cc_inchecken'], { shopId: 'gvb', itemSlot: 'kaartje', qtySlot: 'qty', payStep: 'pay', itemMap: map('gvb', ['uur', 'dag']) }),
  { id: 'ams_sanne', kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place: 'ams_boot', friendId: 'sanne', culture: ['cc_gezellig'] },
  { id: 'ams_daan', kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place: 'ams_straat', friendId: 'daan', culture: ['cc_fiets'] },
  { id: 'ams_noor', kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place: 'ams_taalcafe', friendId: 'noor', culture: ['cc_je_u'] },
  // a friend's chat on any day and the hand-over of a present (social.ts): hearts, not euros
  ...(
    [
      ['sanne', 'ams_boot'],
      ['daan', 'ams_straat'],
      ['noor', 'ams_taalcafe'],
    ] as const
  ).map(([id, place]): ScenarioMeta => ({ id: `smalltalk_${id}`, kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place, friendId: id })),
  { id: 'give_gift', kind: 'friend', band: 'A1', register: 'casual', pay: 'none' },
  // the hang-outs at three hearts (hangouts.ts): hearts, one every few days
  ...(
    [
      ['hang_sanne_pannenkoek', 'sanne', 'ams_boot'],
      ['hang_daan_vondelpark', 'daan', 'ams_straat'],
      ['hang_noor_verjaardag', 'noor', 'ams_taalcafe'],
    ] as const
  ).map(([id, friendId, place]): ScenarioMeta => ({ id, kind: 'hangout', band: 'A1', register: 'casual', pay: 'none', real: true, heart: 3, place, friendId })),
  // Chapters 4-6 (places.ts): the drogist and the brown café sell; the registration costs nothing
  shopMeta('ams_drogist', 'ams_drogist', ['cc_drogist'], { shopId: 'drogist', itemSlot: 'klacht', payStep: 'pay', itemMap: map('drogist', ['keel', 'hoofd', 'verkouden', 'hoest']) }),
  shopMeta('ams_kroeg', 'ams_kroeg', ['cc_bruin_cafe'], { shopId: 'bruincafe', itemSlot: 'kroeg', extraSlots: ['kroegSnack'], qtySlot: 'qty', payStep: 'pay', itemMap: { ...map('bruincafe', ['bier', 'spa', 'cola']), bitterballen: 'bruincafe:bitterballen' } }),
  { id: 'ams_gemeente', kind: 'story', band: 'A2', register: 'polite', pay: 'none', real: true, place: 'ams_gemeente', culture: ['cc_inschrijven'] },
];
