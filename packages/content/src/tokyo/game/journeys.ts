import type { JourneyDef, MenuItem, ShopDef } from '@lw/game';

// Journeys (docs/GOEN.md "The Kyoto Journey"): content packs bought with Goen. A panel trip like Hikarigaoka (no 3D town): a Shinkansen
// ticket at the station (the round trip charged up front in yen earned by speaking, `FARES.kyoto` a leg), three conversations over CSS
// backdrops, and a mini objective set shown on the Quests screen while the Journey is owned. Completion: +20 Goen, keepsake kp_kyoto,
// title t_kyoto (paid once by @lw/game's Goen stage).

/**
 * The names the app and the tests share. The station row charges `{ t: 'fare', id, place: 'kyoto', method, legs: 2 }` (ledger `fare:<id>`,
 * 2 × `FARES.kyoto`, through `fareFor`), the Kyoto panel plays the three scenarios, and `{ t: 'trip_done', id: 'kyoto' }` is filed when the
 * player rides back (it adds `trip:kyoto` to the visits: the objective "there and back").
 */
export const TRIP_KYOTO = {
  id: 'kyoto',
  legs: 2,
  visit: 'trip:kyoto',
  journey: 'journey_kyoto',
  scenarios: { ryokan: 'kyoto_ryokan', temple: 'kyoto_temple', matcha: 'kyoto_matcha' },
  /** the temple's and the café's panel shops; the café sells the souvenir */
  shops: { temple: 'kyoto_temple', cafe: 'kyoto_cafe' },
  souvenir: 'g_yatsuhashi',
} as const;

/** The Shinkansen fare a leg (yen, game price): the round trip is ¥3,600 up front (a paper ticket adds BALANCE.fares.paperExtra a leg). */
export const KYOTO_FARE = 1800;

/** What the temple and the café sell (yen, tax included): the scenarios' fixed-price fallbacks and the menu rows read these (checked in the tests). */
export const KYOTO_PRICES = {
  omamori: 800,
  goshuin: 500,
  set: 900,
  usucha: 600,
  yatsuhashi: 1000,
} as const;

/** The two panel shops of Kyoto: the temple's counter (cash only, as at most temples) and the matcha café (cash or IC). */
export const KYOTO_SHOPS: ShopDef[] = [
  {
    id: 'kyoto_temple',
    placeId: 'kyoto',
    name: { en: 'Temple counter (Kyoto)', ar: 'شبّاك المعبد (كيوتو)' },
    openChapter: 1,
    surface: 'panel',
    register: 'keigo',
    pay: ['cash'],
    sells: ['kyoto_temple:kenko', 'kyoto_temple:gakugyo', 'kyoto_temple:kotsu', 'kyoto_temple:goshuin'],
  },
  {
    id: 'kyoto_cafe',
    placeId: 'kyoto',
    name: { en: 'Matcha café (Kyoto)', ar: 'مقهى الماتشا (كيوتو)' },
    openChapter: 1,
    surface: 'panel',
    register: 'polite',
    pay: ['cash', 'ic'],
    sells: ['kyoto_cafe:set', 'kyoto_cafe:usucha', TRIP_KYOTO.souvenir],
  },
];

/** The temple's omamori (three kinds, slot `omamori`; a present a friend may like) and the goshuin (slot `goshuin`), the café's matcha (slot `matcha`). */
export const KYOTO_MENU: MenuItem[] = [
  ...(
    [
      ['kenko', '健康のお守り', 'けんこうのおまもり', 'Omamori for good health', 'تميمة للصحة الجيدة'],
      ['gakugyo', '学業のお守り', 'がくぎょうのおまもり', 'Omamori for study', 'تميمة للدراسة'],
      ['kotsu', '交通安全のお守り', 'こうつうあんぜんのおまもり', 'Omamori for safe travel', 'تميمة للسلامة في الطريق'],
    ] as const
  ).map(
    ([option, ja, reading, en, ar]): MenuItem => ({
      id: `kyoto_temple:${option}`,
      shop: 'kyoto_temple',
      slot: 'omamori',
      option,
      name: { ja, reading, en, ar },
      price: KYOTO_PRICES.omamori,
      taxClass: 'standard',
      tags: ['tradition', 'travel'],
      giftable: true,
    }),
  ),
  {
    id: 'kyoto_temple:goshuin',
    shop: 'kyoto_temple',
    slot: 'goshuin',
    option: 'goshuin',
    name: { ja: '御朱印', reading: 'ごしゅいん', en: 'Goshuin (temple stamp)', ar: 'غوشوين (ختم المعبد)' },
    price: KYOTO_PRICES.goshuin,
    taxClass: 'standard',
    tags: ['tradition'],
  },
  {
    id: 'kyoto_cafe:set',
    shop: 'kyoto_cafe',
    slot: 'matcha',
    option: 'set',
    name: { ja: '抹茶セット', reading: 'まっちゃセット', en: 'Matcha set (with a seasonal sweet)', ar: 'طقم ماتشا (مع حلوى الموسم)' },
    price: KYOTO_PRICES.set,
    taxClass: 'standard',
    tags: ['tea', 'sweet'],
  },
  {
    id: 'kyoto_cafe:usucha',
    shop: 'kyoto_cafe',
    slot: 'matcha',
    option: 'usucha',
    name: { ja: '抹茶', reading: 'まっちゃ', en: 'Matcha', ar: 'ماتشا' },
    price: KYOTO_PRICES.usucha,
    taxClass: 'standard',
    tags: ['tea', 'drink'],
  },
];

/** The Kyoto Journey: owned with `journey_kyoto`; its objectives are judged from state like a chapter's and never revert. */
export const JOURNEY_KYOTO: JourneyDef = {
  id: 'journey_kyoto',
  itemId: 'journey_kyoto',
  name: { ja: '京都の旅', reading: 'きょうとのたび', en: 'The Kyoto Journey', ar: 'رحلة كيوتو' },
  trip: TRIP_KYOTO.id,
  scenarios: [TRIP_KYOTO.scenarios.ryokan, TRIP_KYOTO.scenarios.temple, TRIP_KYOTO.scenarios.matcha],
  objectives: [
    {
      id: 'jk_travel',
      pred: { k: 'visit', place: TRIP_KYOTO.visit },
      text: { en: 'Take the Shinkansen to Kyoto and back', ar: 'اركب الشينكانسن إلى كيوتو وعُد' },
      pin: { place: 'station' },
    },
    {
      id: 'jk_ryokan',
      pred: { k: 'scenario', id: TRIP_KYOTO.scenarios.ryokan, complete: true, minIndependent: 3 },
      text: { en: 'Check in at the ryokan with 3 lines of your own', ar: 'سجّل وصولك في الريوكان بثلاث جمل من كلامك' },
      hint: { en: 'Your name, how many nights, the dinner time: say them yourself', ar: 'اسمك وعدد الليالي ووقت العشاء: قلها بنفسك' },
    },
    {
      id: 'jk_temple',
      pred: { k: 'scenario', id: TRIP_KYOTO.scenarios.temple, complete: true },
      text: { en: 'At the temple: ask about the garden, buy an omamori and ask for a goshuin', ar: 'في المعبد: اسأل عن الحديقة واشترِ تميمة واطلب غوشوين' },
    },
    {
      id: 'jk_cafe',
      pred: { k: 'scenario', id: TRIP_KYOTO.scenarios.matcha, complete: true },
      text: { en: 'At the matcha café: order, compliment and ask for a recommendation', ar: 'في مقهى الماتشا: اطلب وامدح واسأل عن توصية' },
    },
    {
      id: 'jk_souvenir',
      pred: { k: 'own', item: TRIP_KYOTO.souvenir },
      text: { en: 'Buy a souvenir (yatsuhashi) for a friend', ar: 'اشترِ هدية تذكارية (ياتسوهاشي) لصديق' },
    },
  ],
  reward: { goen: 20, keepsake: 'kp_kyoto', title: 't_kyoto' },
};

export const JOURNEYS: JourneyDef[] = [JOURNEY_KYOTO];
