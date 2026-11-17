// Berlin's people in the game (German step 2): the three friends (du from the first word, hearts, tastes, a perk each), what you can do
// with each character, and the game's view of every conversation (kind, register, what it sells and for which menu ids).
import type { FriendDef, Interaction, ScenarioMeta } from '@lw/game';
import { L } from '../../tokyo/dsl';

export const DE_FRIENDS: FriendDef[] = [
  {
    id: 'lena',
    tier: 'A',
    register: 'casual',
    casualAt: 0,
    unlockChapter: 1,
    loves: ['pfannkuchen', 'flohmarkt:platte'],
    likes: ['music', 'vintage', 'sweet'],
    dislikes: ['clubmate'],
    facts: ['architecture', 'bakes_sundays', 'from_hamburg'],
    factLines: {
      architecture: L('Ich studiere Architektur.', 'I study architecture.', 'أدرس العمارة.'),
      bakes_sundays: L('Am Sonntag backe ich gern.', 'On Sundays I like to bake.', 'أحب الخَبز أيام الأحد.'),
      from_hamburg: L('Ich komme aus Hamburg.', 'I’m from Hamburg.', 'أنا من هامبورغ.'),
    },
    perks: [{ id: 'lena_pfannkuchen', heart: 3, text: { en: 'Lena brings you a Pfannkuchen', ar: 'تُحضر لك لينا دونات' }, fx: { t: 'once_item', itemId: 'bakery:pfannkuchen' } }],
  },
  {
    id: 'kofi',
    tier: 'B',
    register: 'casual',
    casualAt: 0,
    unlockChapter: 2,
    loves: ['doener', 'flohmarkt:kamera'],
    likes: ['tech', 'music', 'meal'],
    dislikes: ['flohmarkt:lampe'],
    facts: ['from_accra', 'fixes_bikes', 'drums'],
    factLines: {
      from_accra: L('Ich komme aus Accra.', 'I’m from Accra.', 'أنا من أكرا.'),
      fixes_bikes: L('Ich repariere Fahrräder.', 'I fix bikes.', 'أصلح الدرّاجات.'),
      drums: L('Ich spiele Schlagzeug.', 'I play the drums.', 'أعزف الطبول.'),
    },
    perks: [{ id: 'kofi_bike', heart: 2, text: { en: 'Kofi gets you €10 off a bike', ar: 'كوفي يخصم لك 10 يورو من سعر درّاجة' }, fx: { t: 'once_discount', itemIds: ['bike_used'], amount: 1000 } }],
  },
  {
    id: 'jonas',
    tier: 'A',
    register: 'casual',
    casualAt: 0,
    unlockChapter: 3,
    loves: ['kaffee', 'flohmarkt:platte'],
    likes: ['tech', 'coffee'],
    dislikes: [],
    facts: ['learns_arabic', 'software', 'board_games'],
    factLines: {
      learns_arabic: L('Ich lerne Arabisch.', 'I’m learning Arabic.', 'أتعلّم العربية.'),
      software: L('Ich schreibe Software.', 'I write software.', 'أكتب البرمجيات.'),
      board_games: L('Ich spiele gern Brettspiele.', 'I like playing board games.', 'أحب لعب ألعاب الطاولة.'),
    },
    perks: [{ id: 'jonas_kaffee', heart: 3, text: { en: 'Jonas buys you a coffee', ar: 'يوناس يدعوك إلى قهوة' }, fx: { t: 'once_item', itemId: 'bakery:kaffee' } }],
  },
];

const scenario = (id: string, scenarioId: string, en: string, ar: string, ch = 1): Interaction => ({ id, kind: 'scenario', scenarioId, label: { en, ar }, ch });
const gift = (who: string): Interaction => ({ id: `${who}_gift`, kind: 'gift', label: { en: 'Give a gift', ar: 'قدّم هدية' }, ch: 3 });

/** characterId -> what you can do with them (the first open one is what Talk does) */
export const DE_INTERACTIONS: Record<string, Interaction[]> = {
  jana: [scenario('jana_shop', 'berlin_bakery', 'Buy breakfast', 'اشترِ الفطور')],
  murat: [scenario('murat_shop', 'berlin_spaeti', 'Buy a drink', 'اشترِ مشروبًا')],
  emre: [scenario('emre_shop', 'berlin_doener', 'Order lunch', 'اطلب الغداء', 2)],
  sabine: [scenario('sabine_shop', 'berlin_ubahn', 'Buy a ticket', 'اشترِ تذكرة', 2)],
  greta: [scenario('greta_shop', 'berlin_flohmarkt', 'Look at her stall', 'تفرّج على كشكها', 3)],
  lena: [scenario('lena_talk', 'berlin_lena', 'Talk', 'تحدّث'), gift('lena')],
  kofi: [scenario('kofi_talk', 'berlin_kofi', 'Talk', 'تحدّث', 2), gift('kofi')],
  jonas: [scenario('jonas_talk', 'berlin_jonas', 'Talk', 'تحدّث', 3), gift('jonas')],
};

const itemMap = (slot: string, options: string[], shop: string): Record<string, string> => Object.fromEntries(options.map((o) => [o, `${shop}:${o}`]));

export const DE_SCENARIO_META: ScenarioMeta[] = [
  {
    id: 'berlin_bakery',
    kind: 'shop',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'berlin_bakery',
    culture: ['cc_schrippe'],
    shop: {
      shopId: 'bakery',
      itemSlot: 'bakery',
      extraSlots: ['bakeryDrink'],
      qtySlot: 'qty',
      payStep: 'pay',
      itemMap: { ...itemMap('bakery', ['broetchen', 'brezel', 'croissant', 'pfannkuchen'], 'bakery'), ...itemMap('bakeryDrink', ['kaffee', 'kakao'], 'bakery') },
    },
  },
  {
    id: 'berlin_spaeti',
    kind: 'shop',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'berlin_spaeti',
    culture: ['cc_pfand'],
    shop: { shopId: 'spaeti', itemSlot: 'spaeti', qtySlot: 'qty', payStep: 'pay', itemMap: itemMap('spaeti', ['clubmate', 'wasser', 'schorle'], 'spaeti') },
  },
  {
    id: 'berlin_doener',
    kind: 'shop',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'berlin_doener',
    culture: ['cc_mit_allem'],
    shop: { shopId: 'doener', itemSlot: 'doener', qtySlot: 'qty', payStep: 'pay', itemMap: itemMap('doener', ['doener', 'duerum', 'falafel'], 'doener') },
  },
  {
    id: 'berlin_ubahn',
    kind: 'shop',
    band: 'A1',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'berlin_ubahn',
    culture: ['cc_entwerten'],
    shop: { shopId: 'ubahn', itemSlot: 'ticket', qtySlot: 'qty', payStep: 'pay', itemMap: itemMap('ticket', ['einzel', 'tageskarte', 'kurzstrecke'], 'ubahn') },
  },
  {
    id: 'berlin_flohmarkt',
    kind: 'shop',
    band: 'A2',
    register: 'polite',
    pay: 'full',
    real: true,
    place: 'berlin_flohmarkt',
    culture: ['cc_bargeld', 'cc_sonntag'],
    shop: {
      shopId: 'flohmarkt',
      itemSlot: 'floh',
      payStep: 'pay',
      itemMap: { ...itemMap('floh', ['lampe', 'platte', 'jacke', 'kamera'], 'flohmarkt'), fahrrad: 'bike_used' },
    },
  },
  { id: 'berlin_lena', kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place: 'berlin_wg', friendId: 'lena', culture: ['cc_sie_du'] },
  { id: 'berlin_kofi', kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place: 'berlin_hof', friendId: 'kofi' },
  { id: 'berlin_jonas', kind: 'talk', band: 'A1', register: 'casual', pay: 'none', real: true, place: 'berlin_cafe', friendId: 'jonas', culture: ['cc_tandem'] },
];
