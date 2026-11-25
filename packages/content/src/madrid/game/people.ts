// Madrid's people in the game (Spanish step 2): the three friends (tú from the first word), what you can do with each character, and
// the game's view of every conversation (kind, register, what it sells and for which menu ids). The bar and the churrería say tú.
import type { FriendDef, Interaction, ScenarioMeta } from '@lw/game';
import { L } from '../../tokyo/dsl';

export const ES_FRIENDS: FriendDef[] = [
  {
    id: 'lucia',
    tier: 'A',
    register: 'casual',
    casualAt: 0,
    unlockChapter: 1,
    loves: ['napolitana', 'mercado:fresas'],
    likes: ['sweet', 'coffee'],
    dislikes: ['bar:solo'],
    facts: ['nursing', 'sunday_cook', 'from_sevilla'],
    factLines: {
      nursing: L('Estudio enfermería.', 'I study nursing.', 'أدرس التمريض.'),
      sunday_cook: L('Los domingos cocino para todo el piso.', 'On Sundays I cook for the whole flat.', 'أطبخ لكل سكان الشقة أيام الأحد.'),
      from_sevilla: L('Soy de Sevilla.', 'I’m from Seville.', 'أنا من إشبيلية.'),
    },
    perks: [{ id: 'lucia_napolitana', heart: 3, text: { en: 'Lucía brings you a napolitana', ar: 'لوسيا تُحضر لك «نابوليتانا»' }, fx: { t: 'once_item', itemId: 'panaderia:napolitana' } }],
  },
  {
    id: 'javi',
    tier: 'B',
    register: 'casual',
    casualAt: 0,
    unlockChapter: 2,
    loves: ['porras', 'bar:tortilla'],
    likes: ['meal'],
    dislikes: ['bar:zumo'],
    facts: ['studio', 'guitar', 'atleti'],
    factLines: {
      studio: L('Grabo discos en un estudio.', 'I record albums in a studio.', 'أسجّل الألبومات في استوديو.'),
      guitar: L('Toco la guitarra en el balcón.', 'I play the guitar on the balcony.', 'أعزف الغيتار على الشرفة.'),
      atleti: L('Soy del Atleti desde niño.', 'I’ve supported Atleti since I was a boy.', 'أشجّع أتلتيكو منذ صغري.'),
    },
    perks: [{ id: 'javi_porras', heart: 3, text: { en: 'Javi treats you to porras', ar: 'خافي يدعوك إلى «بوراس»' }, fx: { t: 'once_item', itemId: 'churreria:porras' } }],
  },
  {
    id: 'nadia',
    tier: 'A',
    register: 'casual',
    casualAt: 0,
    unlockChapter: 3,
    loves: ['chocolate', 'mercado:fresas'],
    likes: ['sweet', 'fruit'],
    dislikes: [],
    facts: ['translator', 'tangier', 'thursday'],
    factLines: {
      translator: L('Soy traductora.', 'I’m a translator.', 'أنا مترجمة.'),
      tangier: L('Mi familia es de Tánger.', 'My family is from Tangier.', 'عائلتي من طنجة.'),
      thursday: L('Cada jueves hay intercambio.', 'Every Thursday there is a language exchange.', 'كل خميس هناك لقاء لتبادل اللغة.'),
    },
    perks: [{ id: 'nadia_chocolate', heart: 3, text: { en: 'Nadia buys you a hot chocolate', ar: 'نادية تدعوك إلى شوكولاتة ساخنة' }, fx: { t: 'once_item', itemId: 'churreria:chocolate' } }],
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

/** characterId -> what you can do with them (the first open one is what Talk does) */
export const ES_INTERACTIONS: Record<string, Interaction[]> = {
  lola: [scenario('lola_shop', 'mad_bar', 'Order breakfast', 'اطلب الفطور')],
  carmen: [scenario('carmen_shop', 'mad_panaderia', 'Buy bread', 'اشترِ خبزًا')],
  rafa: [scenario('rafa_shop', 'mad_churreria', 'Order churros', 'اطلب «تشوروس»', 2)],
  marisa: [scenario('marisa_shop', 'mad_metro', 'Buy a ticket', 'اشترِ تذكرة', 2)],
  andres: [scenario('andres_shop', 'mad_mercado', 'Buy fruit', 'اشترِ فاكهة', 3)],
  lucia: [talk('lucia', 'mad_lucia'), scenario('lucia_meet', 'mad_lucia', 'Our first chat', 'حديثنا الأول'), gift('lucia')],
  javi: [talk('javi', 'mad_javi', 2), scenario('javi_meet', 'mad_javi', 'Our first chat', 'حديثنا الأول', 2), gift('javi')],
  nadia: [talk('nadia', 'mad_nadia', 3), scenario('nadia_meet', 'mad_nadia', 'Our first chat', 'حديثنا الأول', 3), gift('nadia')],
};

const map = (shop: string, options: string[]): Record<string, string> => Object.fromEntries(options.map((o) => [o, `${shop}:${o}`]));
const shopMeta = (id: string, register: ScenarioMeta['register'], culture: string[], shop: NonNullable<ScenarioMeta['shop']>): ScenarioMeta => ({ id, kind: 'shop', band: 'A1', register, pay: 'full', real: true, place: id, culture, shop });

export const ES_SCENARIO_META: ScenarioMeta[] = [
  shopMeta('mad_bar', 'casual', ['cc_que_te_pongo', 'cc_propina'], { shopId: 'bar', itemSlot: 'bar', extraSlots: ['barComida'], qtySlot: 'qty', payStep: 'pay', itemMap: map('bar', ['cafe', 'cortado', 'solo', 'zumo', 'tostada', 'tortilla']) }),
  shopMeta('mad_panaderia', 'polite', ['cc_barra'], { shopId: 'panaderia', itemSlot: 'pan', extraSlots: ['dulce'], qtySlot: 'qty', payStep: 'pay', itemMap: map('panaderia', ['barra', 'napolitana', 'cruasan', 'magdalenas']) }),
  shopMeta('mad_mercado', 'polite', ['cc_ultimo'], { shopId: 'mercado', itemSlot: 'fruta', extraSlots: ['aceite'], qtySlot: 'peso', payStep: 'pay', itemMap: { ...map('mercado', ['naranjas', 'tomates', 'fresas', 'platanos']), aceite: 'mad_aceite' } }),
  shopMeta('mad_churreria', 'casual', ['cc_churros'], { shopId: 'churreria', itemSlot: 'churros', extraSlots: ['churroBebida'], qtySlot: 'qty', payStep: 'pay', itemMap: map('churreria', ['churros', 'porras', 'chocolate', 'cafe']) }),
  shopMeta('mad_metro', 'polite', ['cc_metro'], { shopId: 'metro', itemSlot: 'billete', qtySlot: 'qty', payStep: 'pay', itemMap: map('metro', ['sencillo', 'diez']) }),
  { id: 'mad_lucia', kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place: 'mad_piso', friendId: 'lucia', culture: ['cc_dos_besos'] },
  { id: 'mad_javi', kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place: 'mad_plaza', friendId: 'javi', culture: ['cc_futbol'] },
  { id: 'mad_nadia', kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place: 'mad_intercambio', friendId: 'nadia', culture: ['cc_tu_usted'] },
  // a friend's chat on any day and the hand-over of a present (social.ts): hearts, not euros
  ...(
    [
      ['lucia', 'mad_piso'],
      ['javi', 'mad_plaza'],
      ['nadia', 'mad_intercambio'],
    ] as const
  ).map(([id, place]): ScenarioMeta => ({ id: `smalltalk_${id}`, kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place, friendId: id })),
  { id: 'give_gift', kind: 'friend', band: 'A1', register: 'casual', pay: 'none' },
];
