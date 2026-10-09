import type { ItemDef } from '@lw/game';
import { releasedGate } from './chapters';

/**
 * Pack data: the catalog of docs/GAME_DESIGN.md §5.2 and the gift items of §5.3 that THIS RELEASE sells (docs/RELEASE_1.md). Fuku-Fuku
 * clothes, the furniture, Aiko's gifts and the flat are not sold in Release 1 (no scenario sells them), so they have no row here; the
 * ids and prices of the full catalog stay in the design document.
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
];
