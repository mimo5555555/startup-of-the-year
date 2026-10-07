import type { MenuItem } from '@lw/game';

// The consumables of docs/GAME_DESIGN.md §5.1 (agent 2D). Prices are tax-included take-out prices in yen; `option` is the id of the
// EXISTING conversation slot option (`item`, `flavor`, plus the shop slot `ramenExtra`), so the refitted scenarios plug straight in.
// Take-out food and drinks are the reduced `food` class; the konbini eat-in corner and the café add the eat-in surcharge (§4.1), so
// those rows are `eatInCapable`. A ramen bowl is eaten in the shop at the standard rate with no surcharge.

type Row = { option: string; ja: string; reading?: string; en: string; ar: string; price: number; tags: string[] };

const rows = (shop: string, slot: string, taxClass: string, flags: Pick<MenuItem, 'eatInCapable' | 'giftable'>, list: Row[]): MenuItem[] =>
  list.map((r) => ({
    id: `${shop}:${r.option}`,
    shop,
    slot,
    option: r.option,
    name: { ja: r.ja, ...(r.reading ? { reading: r.reading } : {}), en: r.en, ar: r.ar },
    price: r.price,
    taxClass,
    tags: r.tags,
    ...flags,
  }));

const KONBINI: Row[] = [
  { option: 'onigiri', ja: 'おにぎり', en: 'Rice ball', ar: 'أونيغيري (كرة أرز)', price: 160, tags: ['food', 'snack'] },
  { option: 'water', ja: '水', reading: 'みず', en: 'Water', ar: 'ماء', price: 110, tags: ['drink'] },
  { option: 'sandwich', ja: 'サンドイッチ', en: 'Sandwich', ar: 'ساندويتش', price: 320, tags: ['food', 'snack'] },
  { option: 'bento', ja: 'お弁当', reading: 'おべんとう', en: 'Boxed lunch (bento)', ar: 'وجبة غداء (بنتو)', price: 580, tags: ['food', 'meal'] },
  { option: 'juice', ja: 'ジュース', en: 'Juice', ar: 'عصير', price: 160, tags: ['drink'] },
  { option: 'milk', ja: '牛乳', reading: 'ぎゅうにゅう', en: 'Milk', ar: 'حليب', price: 150, tags: ['drink'] },
  { option: 'greenTea', ja: 'お茶', reading: 'おちゃ', en: 'Green tea', ar: 'شاي أخضر', price: 160, tags: ['drink', 'tea'] },
  { option: 'cake', ja: 'ケーキ', en: 'Cake', ar: 'كعكة', price: 330, tags: ['sweet'] },
  { option: 'coffee', ja: 'コーヒー', en: 'Coffee (cup)', ar: 'قهوة (كوب)', price: 130, tags: ['drink', 'coffee'] },
];

const CAFE: Row[] = [
  { option: 'coffee', ja: 'コーヒー', en: 'Coffee', ar: 'قهوة', price: 450, tags: ['drink', 'coffee'] },
  { option: 'blackTea', ja: '紅茶', reading: 'こうちゃ', en: 'Black tea', ar: 'شاي أسود', price: 420, tags: ['drink', 'tea'] },
  { option: 'greenTea', ja: 'お茶', reading: 'おちゃ', en: 'Green tea', ar: 'شاي أخضر', price: 400, tags: ['drink', 'tea'] },
  { option: 'latte', ja: 'カフェラテ', en: 'Café latte', ar: 'كافيه لاتيه', price: 520, tags: ['drink', 'coffee'] },
  { option: 'juice', ja: 'ジュース', en: 'Juice', ar: 'عصير', price: 480, tags: ['drink'] },
  { option: 'cake', ja: 'ケーキ', en: 'Cake', ar: 'كعكة', price: 480, tags: ['sweet'] },
];

// the bowl is a `flavor`; the extras are options of the shared slot `ramenExtra` (slots/shop.ts) and are added to the bill
const RAMEN: Row[] = [
  { option: 'shoyu', ja: 'しょうゆラーメン', en: 'Soy sauce ramen', ar: 'رامن صلصة الصويا', price: 900, tags: ['food', 'meal'] },
  { option: 'miso', ja: 'みそラーメン', en: 'Miso ramen', ar: 'رامن ميسو', price: 950, tags: ['food', 'meal'] },
  { option: 'tonkotsu', ja: 'とんこつラーメン', en: 'Tonkotsu ramen', ar: 'رامن تونكوتسو', price: 1050, tags: ['food', 'meal'] },
];
const RAMEN_EXTRAS: Row[] = [
  { option: 'ajitama', ja: '味玉', reading: 'あじたま', en: 'Seasoned egg', ar: 'بيضة متبّلة', price: 150, tags: ['food'] },
  { option: 'oomori', ja: '大盛', reading: 'おおもり', en: 'Large portion', ar: 'حصة كبيرة', price: 100, tags: ['food'] },
  { option: 'kaedama', ja: '替え玉', reading: 'かえだま', en: 'Extra noodles', ar: 'نودلز إضافية', price: 120, tags: ['food'] },
  { option: 'gyoza', ja: '餃子', reading: 'ぎょうざ', en: 'Gyoza (6)', ar: 'جيوزا (6 قطع)', price: 380, tags: ['food', 'snack'] },
];

// panel-only (VendingPanel, 2G): no conversation slot, drinks from a machine are never gifts (§5.3)
const VENDING: Row[] = [
  { option: 'v_tea', ja: 'お茶', reading: 'おちゃ', en: 'Tea', ar: 'شاي', price: 150, tags: ['drink', 'tea'] },
  { option: 'v_coffee', ja: '缶コーヒー', reading: 'かんコーヒー', en: 'Canned coffee', ar: 'قهوة معلّبة', price: 150, tags: ['drink', 'coffee'] },
  { option: 'v_water', ja: '水', reading: 'みず', en: 'Water', ar: 'ماء', price: 130, tags: ['drink'] },
  { option: 'v_juice', ja: 'ジュース', en: 'Juice', ar: 'عصير', price: 150, tags: ['drink'] },
];

/** Pack data: consumables sold in shops, keyed by shop + slot option (2D). Station fares live in `fares.ts`, the IC card and top-ups in `items.ts` (2G). */
export const MENU: MenuItem[] = [
  ...rows('konbini', 'item', 'food', { eatInCapable: true, giftable: true }, KONBINI),
  ...rows('cafe', 'item', 'food', { eatInCapable: true, giftable: true }, CAFE),
  ...rows('ramen', 'flavor', 'standard', {}, RAMEN),
  ...rows('ramen', 'ramenExtra', 'standard', {}, RAMEN_EXTRAS),
  ...rows('vending', 'vending', 'food', {}, VENDING),
];
