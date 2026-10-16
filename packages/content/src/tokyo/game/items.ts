import type { ItemDef } from '@lw/game';
import { releasedGate } from './chapters';

/**
 * Pack data: the catalog of docs/GAME_DESIGN.md §5.2 and the gift items of §5.3 that THIS RELEASE sells (docs/RELEASE_1.md, RELEASE_2.md
 * wave A). Fuku-Fuku's clothes (nine of the ten: the yukata waits for the festival) and its two presents are sold from Release 2 wave A; the
 * seven pieces of second-hand furniture (`fuku_home`) and the room at Ono-sō (`aiko_contract`) from wave B2; Aiko's four presents (bouquet, wagashi, tea set, tenugui) are sold from Chapter 2 by `aiko_tea`, so they have no row here; the ids and prices of the full
 * catalog stay in the design document.
 *
 * Every id equals the `itemMap` of the scenario metas that sell it (konbini, station_ic, denki_phone, motors_bike, motors_car), so
 * `validatePack` level 3 finds a sale route for each. Gates are the design's chapter numbers written through `releasedGate`: a chapter
 * that is never played opens its things at Free Walk (9). Prices are whole yen, tax included (税込); the cars carry the body price
 * (`body`: the haggle and the 8% cap look at it) and sell at the drive-away price.
 *
 * Tags: `phone`, `bicycle` and `car` are the `own category:` words of the story (so the phone CASE is not tagged `phone`), the rest are
 * the gift tastes of §8.5. IC top-ups and the refund are transfers (§4.1), not catalog items.
 */

/** Ride multipliers of §5.5 (street speed ×1.5 bicycle, ×1.8 power-assist, ×2.5 car); `world.setMoveMultiplier` receives them. */
const RIDE = { bike: 1.5, ebike: 1.8, car: 2.5 } as const;
/** The flagship phone earns Sakura Points at 2% instead of 1% (§5.2). */
const FLAGSHIP_POINTS_RATE = 0.02;
/** Cars and the flat are for adults (D28). */
const ADULT = 18;
/** The low-mileage car also asks for six scenarios at two stars (§5.2). */
const GOOD_CAR_STARS = { n: 6, atLeast: 2 } as const;

const gift = (id: string, ja: string, reading: string | undefined, en: string, ar: string, price: number, shop: string, ch: number, tags: string[]): ItemDef => ({
  id,
  name: { ja, ...(reading ? { reading } : {}), en, ar },
  price,
  cat: 'gift',
  shop,
  gate: { ch: releasedGate(ch) },
  fx: [{ t: 'gift', tags }],
  tags,
});

/**
 * The six free colours of the T-shirt, the hoodie and the sneakers (§5.2 "6 free colours"): the option ids of the `clothesColour` slot of
 * `fuku_clothes` and the hex the avatar wears. The order is the slot's; the avatar patch palette below lists the hex in this order.
 */
export const CLOTHES_COLOURS: Readonly<Record<string, string>> = {
  black: '#2b2b36',
  white: '#f5f5f5',
  red: '#d8433f',
  blue: '#4f86f7',
  green: '#2fb58b',
  yellow: '#f4c340',
};
const CLOTHES_PALETTE = Object.values(CLOTHES_COLOURS);
/** What a T-shirt, a hoodie and sneakers look like before a colour is picked (the player bought it without choosing). */
const TEE_COLOUR = CLOTHES_COLOURS.white;
const HOODIE_COLOUR = CLOTHES_COLOURS.blue;
const SNEAKERS_COLOUR = CLOTHES_COLOURS.white;
/** Jeans: the design's blue, then the other denim washes of §5.5 (the bottoms palette) for the Wardrobe's colour pick; the names are Wardrobe labels. */
export const DENIM_COLOURS: Readonly<Record<string, string>> = { denim: '#35507a', navy: '#2f3a57', wash: '#5a6b8c', charcoal: '#3a3f50', khaki: '#8a6f4a' };
const JEANS_COLOUR = DENIM_COLOURS.denim;
const JEANS_WASHES = Object.values(DENIM_COLOURS);
/** The winter jacket's fixed blue (§5.5). */
const JACKET_COLOUR = '#2f5ea8';
/** The business suit's charcoal (§5.5). */
const SUIT_COLOUR = '#2b2f3a';

type Avatar = Extract<ItemDef['fx'][number], { t: 'avatar' }>['patch'];

/** A piece of clothing from Fuku-Fuku: a catalog item with an avatar patch (§5.5); the owner keeps one (`once`), the Wardrobe changes its colour. */
const clothes = (id: string, ja: string, reading: string | undefined, en: string, ar: string, price: number, ch: number, patch: Avatar, tags: string[], more: Partial<ItemDef> = {}): ItemDef => ({
  id,
  name: { ja, ...(reading ? { reading } : {}), en, ar },
  price,
  cat: 'clothing',
  shop: 'fukufuku',
  gate: { ch: releasedGate(ch) },
  fx: [{ t: 'avatar', patch }, ...(more.fx ?? [])],
  tags: ['clothing', ...tags],
  once: true,
  ...(more.beat ? { beat: more.beat } : {}),
});

/** The comfort and slot of every piece of furniture (§5.2, §8.8): the dorm's four slots sum to 6 on top of the base 1, the flat's eight to 13 on top of 3 (max 16). */
const furniture = (id: string, ja: string, reading: string, en: string, ar: string, price: number, ch: number, slot: string, comfort: number, more: Partial<ItemDef> = {}): ItemDef => ({
  id,
  name: { ja, ...(reading ? { reading } : {}), en, ar },
  price,
  cat: 'home',
  shop: 'fukufuku',
  // a piece for a slot the dorm does not have (table, kitchen, light) is sold to a tenant of the flat only: a kotatsu in a box warms nobody
  gate: { ch: releasedGate(ch), ...(['table', 'kitchen', 'light'].includes(slot) ? { needs: ['home_room_ono'] } : {}) },
  fx: [{ t: 'home', slot, comfort }, ...(more.fx ?? [])],
  tags: ['home', 'furniture'],
  ...(more.bulky ? { bulky: true } : {}),
  once: true,
});

export const ITEMS: ItemDef[] = [
  {
    id: 'ic_card',
    name: { ja: 'ICカード', reading: 'アイシーカード', en: 'IC card', ar: 'بطاقة IC للمواصلات' },
    // the ¥500 deposit: the card stays yours, only its balance is refundable (§4.1)
    price: 500,
    cat: 'transport',
    shop: 'station',
    gate: { ch: 1 },
    // tap to ride and pay at the konbini, the café, vending machines and the station (§4.1)
    fx: [{ t: 'feature', id: 'ic' }],
    tags: ['ic', 'transport'],
    once: true,
  },

  // ---- Hikari Denki (opens in Chapter 4) ----
  {
    id: 'phone_used',
    name: { ja: '中古スマホ', reading: 'ちゅうこスマホ', en: 'Refurbished smartphone', ar: 'هاتف ذكي مجدّد' },
    price: 24800,
    cat: 'electronics',
    shop: 'denki',
    gate: { ch: 4 },
    // Messages (friend chat) and Map pins switch on the moment it is owned (D17); Aoi's goodbye plays after the purchase
    fx: [{ t: 'feature', id: 'phone' }],
    tags: ['phone', 'electronics'],
    beat: 'b_phone_bought',
    once: true,
  },
  {
    id: 'phone_case',
    name: { ja: 'スマホケース', en: 'Phone case', ar: 'غلاف الهاتف' },
    price: 1980,
    cat: 'electronics',
    shop: 'denki',
    gate: { ch: 4 },
    // cosmetic, colour pick; deliberately NOT tagged `phone`: owning a case is not owning a phone
    fx: [{ t: 'cosmetic', id: 'phone_case' }],
    tags: ['accessory'],
    once: true,
  },
  {
    id: 'phone_pro',
    name: { ja: '最新スマホ', reading: 'さいしんスマホ', en: 'Latest flagship phone', ar: 'أحدث هاتف رائد' },
    price: 128000,
    cat: 'electronics',
    shop: 'denki',
    gate: { ch: releasedGate(7) },
    // a gold frame on the HUD phone icon, the boast lines of Tanaka and Aoi, 2% points
    fx: [
      { t: 'feature', id: 'phone' },
      { t: 'cosmetic', id: 'phone_gold_frame' },
      { t: 'trait', id: 'points_rate', value: FLAGSHIP_POINTS_RATE },
      { t: 'trait', id: 'boast' },
    ],
    tags: ['phone', 'electronics', 'flagship'],
    once: true,
  },
  {
    id: 'tv_small',
    name: { ja: 'テレビ', en: '32-inch TV', ar: 'تلفزيون 32 بوصة' },
    price: 24800,
    cat: 'electronics',
    shop: 'denki',
    gate: { ch: releasedGate(6) },
    // bulky: delivery ¥2,200. The home slot waits for the flat (not in Release 1); the "watch Japanese TV" snippet is its trait
    fx: [
      { t: 'home', slot: 'tv', comfort: 2 },
      { t: 'trait', id: 'tv_snippet' },
    ],
    tags: ['tv', 'electronics', 'home'],
    bulky: true,
    once: true,
  },
  gift('g_music_cd', '音楽CD', 'おんがくシーディー', 'Music CD', 'أسطوانة موسيقى', 3300, 'denki', 4, ['music']),

  // ---- Nakamura Motors (open at Free Walk in this release) ----
  {
    id: 'bike_mamachari',
    name: { ja: 'ママチャリ', en: 'Everyday bicycle', ar: 'دراجة يومية (ماماتشاري)' },
    // + the ¥600 registration (防犯登録, a fee line of the quote, `rules.registrationFee`)
    price: 19800,
    cat: 'transport',
    shop: 'motors',
    gate: { ch: releasedGate(5) },
    fx: [{ t: 'ride', mul: RIDE.bike, mesh: 'bike' }],
    tags: ['bicycle', 'transport'],
    once: true,
  },
  {
    id: 'bike_helmet',
    name: { ja: 'ヘルメット', en: 'Bicycle helmet', ar: 'خوذة الدراجة' },
    price: 2980,
    cat: 'transport',
    shop: 'motors',
    gate: { ch: releasedGate(5) },
    // the world draws a small dome for the `helmet` accessory (§5.5)
    fx: [{ t: 'avatar', patch: { accessory: 'helmet' } }],
    tags: ['helmet', 'transport'],
    once: true,
  },
  {
    id: 'ebike',
    name: { ja: '電動アシスト自転車', reading: 'でんどうアシストじてんしゃ', en: 'Power-assist bicycle', ar: 'دراجة كهربائية مساعدة' },
    // + the ¥600 registration; it replaces the bicycle mesh and needs the helmet
    price: 89000,
    cat: 'transport',
    shop: 'motors',
    gate: { ch: releasedGate(7), needs: ['bike_helmet'] },
    fx: [{ t: 'ride', mul: RIDE.ebike, mesh: 'ebike' }],
    tags: ['bicycle', 'transport', 'ebike'],
    once: true,
  },
  {
    id: 'car_kei_used',
    name: { ja: '中古の軽自動車', reading: 'ちゅうこのけいじどうしゃ', en: 'Used kei car (drive-away price)', ar: 'سيارة كي مستعملة (السعر النهائي)' },
    // body 148,000 + fees 50,000: the drive-away price (乗り出し価格) is the lesson of the trap at the dealer (§4.4 rule 3)
    price: 198000,
    body: 148000,
    cat: 'transport',
    shop: 'motors',
    gate: { ch: releasedGate(9), ageMin: ADULT },
    fx: [{ t: 'ride', mul: RIDE.car, mesh: 'car' }],
    tags: ['car', 'transport'],
    once: true,
  },
  {
    id: 'car_kei_good',
    name: { ja: '低走行の軽自動車', reading: 'ていそうこうのけいじどうしゃ', en: 'Low-mileage kei car', ar: 'سيارة كي قليلة المسافة' },
    // body 458,000 + fees 90,000; replaces the used car, colour pick
    price: 548000,
    body: 458000,
    cat: 'transport',
    shop: 'motors',
    gate: { ch: releasedGate(9), ageMin: ADULT, stars: GOOD_CAR_STARS },
    fx: [
      { t: 'ride', mul: RIDE.car, mesh: 'car' },
      { t: 'cosmetic', id: 'car_colour' },
    ],
    tags: ['car', 'transport'],
    once: true,
  },
  gift('g_carfresh', '車の芳香剤', 'くるまのほうこうざい', 'Car air freshener', 'معطّر سيارة', 500, 'motors', 5, ['cars']),

  // ---- the presents of the konbini `goods` node (open from Chapter 1) ----
  gift('g_choco', 'チョコレート', undefined, 'Chocolate', 'شوكولاتة', 220, 'konbini', 1, ['sweet', 'snack']),
  gift('g_manga', 'マンガ（1巻）', 'いっかん', 'Manga volume', 'مجلد مانغا واحد', 680, 'konbini', 1, ['media', 'anime']),
  gift('g_game_card', 'ゲームカード', undefined, 'Game card', 'بطاقة ألعاب', 1000, 'konbini', 1, ['game', 'tech']),

  // ---- Fuku-Fuku (opens in Chapter 2): the clothes and the two presents of its `goods` node ----
  clothes('tee_basic', 'Tシャツ', undefined, 'T-shirt', 'قميص تي شيرت', 1990, 2, { top: TEE_COLOUR, pick: 'top', colours: CLOTHES_PALETTE }, ['top']),
  clothes('cap', '帽子', 'ぼうし', 'Baseball cap', 'قبعة بيسبول', 2490, 2, { accessory: 'cap' }, ['head']),
  clothes('hoodie', 'パーカー', undefined, 'Hoodie', 'هودي (سترة بقلنسوة)', 4990, 2, { top: HOODIE_COLOUR, pick: 'top', colours: CLOTHES_PALETTE, lightenAccent: true }, ['top']),
  clothes('jeans', 'ジーンズ', undefined, 'Jeans', 'بنطال جينز', 5990, 3, { bottom: JEANS_COLOUR, pick: 'bottom', colours: JEANS_WASHES }, ['bottom']),
  clothes('sneakers', 'スニーカー', undefined, 'Sneakers', 'حذاء رياضي', 7990, 3, { shoes: SNEAKERS_COLOUR, pick: 'shoes', colours: CLOTHES_PALETTE }, ['shoes']),
  clothes('jacket_winter', 'ダウンジャケット', undefined, 'Winter down jacket + scarf', 'سترة شتوية منفوخة مع وشاح', 12900, 4, { top: JACKET_COLOUR, accessories: ['scarf'] }, ['top', 'winter']),
  clothes('glasses_round', 'メガネ', undefined, 'Glasses', 'نظارات', 9900, 5, { accessory: 'glasses' }, ['face']),
  clothes('backpack', 'リュック', undefined, 'Backpack', 'حقيبة ظهر', 6900, 5, { accessory: 'backpack' }, ['bag'], { fx: [{ t: 'trait', id: 'fewer_bags' }] }),
  clothes('suit_set', 'スーツ', undefined, 'Business suit + tie', 'بدلة رسمية مع ربطة عنق', 19800, 6, { top: SUIT_COLOUR, bottom: SUIT_COLOUR, accessories: ['tie'] }, ['top', 'bottom', 'formal'], {
    fx: [{ t: 'trait', id: 'formal_register' }],
  }),
  // ---- Fuku-Fuku's second-hand corner (fuku_home, Release 2 wave B2): the dorm's pieces open in Chapter 5, the flat's in Chapter 6 ----
  furniture('futon_set', '布団セット', 'ふとんセット', 'Futon set', 'طقم فوتون (فراش ياباني)', 8000, 5, 'bed', 2, { bulky: true }),
  furniture('desk_study', '勉強机', 'べんきょうづくえ', 'Study desk', 'مكتب للدراسة', 6000, 5, 'desk', 2, { bulky: true }),
  furniture('bookshelf', '本棚', 'ほんだな', 'Bookshelf', 'رف كتب', 4500, 5, 'shelf', 1, { bulky: true }),
  furniture('plant_pothos', '観葉植物', 'かんようしょくぶつ', 'Pothos plant', 'نبتة زينة', 1200, 5, 'plant', 1),
  // the friend-visit hangout bonus (kotatsu x1.5 AP) only counts while it is placed
  furniture('kotatsu', 'こたつ', '', 'Kotatsu table', 'كوتاتسو (طاولة تدفئة)', 7000, 6, 'table', 3, { bulky: true, fx: [{ t: 'trait', id: 'hangout_mult', value: 1.5 }] }),
  furniture('rice_cooker', '炊飯器', 'すいはんき', 'Rice cooker', 'جهاز طهي الأرز', 3500, 6, 'kitchen', 1, { fx: [{ t: 'trait', id: 'cook_together' }] }),
  furniture('paper_lamp', '和風ランプ', 'わふうランプ', 'Paper lantern lamp', 'مصباح ورقي ياباني', 2000, 6, 'light', 1),

  // ---- the room at Ono-sō (aiko_contract): deposit 30,000 + first month 30,000, no rent afterwards, 18+ (D12, D28) ----
  {
    id: 'home_room_ono',
    name: { ja: '小野荘の部屋', reading: 'おのそうのへや', en: 'Room at Ono-sō (move-in costs)', ar: 'غرفة في عمارة أونو (تكاليف الانتقال)' },
    price: 60000,
    // a rental is a service, not a good you place (the dream tracker counts only `home` goods as furniture)
    cat: 'service',
    shop: 'aiko',
    gate: { ch: releasedGate(6), ageMin: ADULT },
    fx: [{ t: 'homeTier', tier: 'ono' }],
    // `own category:flat`
    tags: ['flat'],
    once: true,
  },

  // Aiko's tea house (aiko_tea): sold from Chapter 2, when the stall opens
  gift('g_flower', '花束', 'はなたば', 'Small bouquet', 'باقة زهور صغيرة', 1500, 'aiko', 2, ['flower', 'nature']),
  gift('g_wagashi', '和菓子の詰め合わせ', 'わがしのつめあわせ', 'Wagashi assortment', 'علبة حلويات يابانية (واغاشي)', 1280, 'aiko', 2, ['sweet', 'tradition']),
  gift('g_tea_set', 'お茶セット', 'おちゃセット', 'Tea set', 'طقم شاي', 1500, 'aiko', 2, ['tea', 'tradition']),
  gift('g_tenugui', '手ぬぐい', 'てぬぐい', 'Tenugui hand towel', 'منشفة تينوغوي', 1100, 'aiko', 2, ['craft', 'tradition']),
  gift('g_plush', 'ぬいぐるみ', undefined, 'Plush toy', 'دمية محشوة', 800, 'fukufuku', 2, ['cute']),
  gift('g_guitar_pick', 'ギターピック', undefined, 'Guitar pick', 'ريشة غيتار', 300, 'fukufuku', 2, ['music']),
];
