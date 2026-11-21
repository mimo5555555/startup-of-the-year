// What Berlin's street sells (German step 2): the menus of the five shops (by their conversations' slots), the one owned thing (a
// second-hand bike from the flea market) and the shops themselves. Prices in cents, VAT included.
import type { ItemDef, MenuItem, ShopDef } from '@lw/game';
import { BAKERY_PRICES } from '../bakery';
import { DOENER_PRICES } from '../doener';
import { FLOHMARKT_PRICES } from '../flohmarkt';
import { SPAETI_PRICES } from '../spaeti';
import { TICKET_PRICES } from '../ubahn';
import { APOTHEKE_PRICES, KNEIPE_PRICES } from '../places';

const menu = (shop: string, slot: string, option: string, de: string, en: string, ar: string, price: number, taxClass: string, tags: string[], giftable?: boolean): MenuItem => ({
  id: `${shop}:${option}`,
  shop,
  slot,
  option,
  name: { ja: de, en, ar },
  price,
  taxClass,
  tags,
  ...(giftable !== undefined ? { giftable } : {}),
});

export const DE_MENU: MenuItem[] = [
  menu('bakery', 'bakery', 'broetchen', 'Brötchen', 'Bread roll', 'خبز صغير', BAKERY_PRICES.broetchen!, 'food', ['food', 'bread']),
  menu('bakery', 'bakery', 'brezel', 'Brezel', 'Pretzel', 'بريتزل', BAKERY_PRICES.brezel!, 'food', ['food', 'bread'], true),
  menu('bakery', 'bakery', 'croissant', 'Croissant', 'Croissant', 'كرواسون', BAKERY_PRICES.croissant!, 'food', ['food', 'sweet'], true),
  menu('bakery', 'bakery', 'pfannkuchen', 'Pfannkuchen', 'Jam doughnut', 'دونات محشوة', BAKERY_PRICES.pfannkuchen!, 'food', ['food', 'sweet'], true),
  menu('bakery', 'bakeryDrink', 'kaffee', 'Kaffee', 'Coffee', 'قهوة', BAKERY_PRICES.kaffee!, 'food', ['drink', 'coffee']),
  menu('bakery', 'bakeryDrink', 'kakao', 'Kakao', 'Hot chocolate', 'كاكاو ساخن', BAKERY_PRICES.kakao!, 'food', ['drink', 'sweet']),
  menu('spaeti', 'spaeti', 'clubmate', 'Club-Mate', 'Club-Mate', 'كلوب ماتيه', SPAETI_PRICES.clubmate!, 'food', ['drink']),
  menu('spaeti', 'spaeti', 'wasser', 'Wasser', 'Water', 'ماء', SPAETI_PRICES.wasser!, 'food', ['drink']),
  menu('spaeti', 'spaeti', 'schorle', 'Apfelschorle', 'Apple spritzer', 'عصير تفاح بالصودا', SPAETI_PRICES.schorle!, 'food', ['drink', 'sweet'], true),
  menu('doener', 'doener', 'doener', 'Döner', 'Döner kebab', 'دونر', DOENER_PRICES.doener!, 'food', ['food', 'meal']),
  menu('doener', 'doener', 'duerum', 'Dürüm', 'Dürüm wrap', 'دوروم', DOENER_PRICES.duerum!, 'food', ['food', 'meal']),
  menu('doener', 'doener', 'falafel', 'Falafel', 'Falafel', 'فلافل', DOENER_PRICES.falafel!, 'food', ['food', 'meal']),
  menu('ubahn', 'ticket', 'einzel', 'Fahrschein', 'Single ticket (AB)', 'تذكرة ذهاب (AB)', TICKET_PRICES.einzel!, 'transport', ['transport']),
  menu('ubahn', 'ticket', 'tageskarte', 'Tageskarte', 'Day ticket', 'تذكرة يومية', TICKET_PRICES.tageskarte!, 'transport', ['transport']),
  menu('ubahn', 'ticket', 'kurzstrecke', 'Kurzstrecke', 'Short-trip ticket', 'تذكرة مسافة قصيرة', TICKET_PRICES.kurzstrecke!, 'transport', ['transport']),
  menu('flohmarkt', 'floh', 'lampe', 'Lampe', 'Old lamp', 'مصباح قديم', FLOHMARKT_PRICES.lampe!, 'standard', ['home', 'vintage'], true),
  menu('flohmarkt', 'floh', 'platte', 'Schallplatte', 'Vinyl record', 'أسطوانة', FLOHMARKT_PRICES.platte!, 'standard', ['music', 'vintage'], true),
  menu('flohmarkt', 'floh', 'jacke', 'Jacke', 'Vintage jacket', 'سترة قديمة', FLOHMARKT_PRICES.jacke!, 'standard', ['fashion', 'vintage'], true),
  menu('flohmarkt', 'floh', 'kamera', 'Kamera', 'Old camera', 'كاميرا قديمة', FLOHMARKT_PRICES.kamera!, 'standard', ['tech', 'vintage'], true),
  // Chapter 4: the Apotheke (a remedy is not a present)
  menu('apotheke', 'beschwerde', 'hals', 'Halstabletten', 'Throat lozenges', 'أقراص للحلق', APOTHEKE_PRICES.hals!, 'standard', ['health'], false),
  menu('apotheke', 'beschwerde', 'kopf', 'Kopfschmerztabletten', 'Headache tablets', 'أقراص للصداع', APOTHEKE_PRICES.kopf!, 'standard', ['health'], false),
  menu('apotheke', 'beschwerde', 'schnupfen', 'Nasenspray', 'Nasal spray', 'بخاخ للأنف', APOTHEKE_PRICES.schnupfen!, 'standard', ['health'], false),
  menu('apotheke', 'beschwerde', 'husten', 'Hustensaft', 'Cough syrup', 'شراب للسعال', APOTHEKE_PRICES.husten!, 'standard', ['health'], false),
  // Chapter 5: the Kneipe (drunk and eaten at the bar)
  menu('kneipe', 'kneipe', 'bier', 'Bier', 'Beer', 'بيرة', KNEIPE_PRICES.bier!, 'standard', ['drink', 'alcohol'], false),
  menu('kneipe', 'kneipe', 'spezi', 'Spezi', 'Spezi (cola and orange)', 'سبيتسي', KNEIPE_PRICES.spezi!, 'food', ['drink'], false),
  menu('kneipe', 'kneipe', 'schorle', 'Apfelschorle', 'Apple spritzer', 'عصير تفاح بالصودا', KNEIPE_PRICES.schorle!, 'food', ['drink'], false),
  menu('kneipe', 'kneipe', 'cola', 'Cola', 'Cola', 'كولا', KNEIPE_PRICES.cola!, 'food', ['drink'], false),
  menu('kneipe', 'kneipeSnack', 'bulette', 'Bulette', 'Bulette (meatball)', 'بوليته (كرة لحم)', KNEIPE_PRICES.bulette!, 'food', ['food', 'meal'], false),
];

/** the bike Kofi told you about: second-hand from Greta's stall, faster through the streets */
export const DE_ITEMS: ItemDef[] = [
  {
    id: 'bike_used',
    name: { ja: 'Fahrrad', en: 'Second-hand bike', ar: 'درّاجة مستعملة' },
    price: FLOHMARKT_PRICES.fahrrad!,
    cat: 'transport',
    shop: 'flohmarkt',
    gate: { ch: 3 },
    fx: [{ t: 'ride', mul: 1.6, mesh: 'bike' }],
    tags: ['bicycle'],
    once: true,
  },
];

const shop = (id: string, placeId: string, de: string, en: string, ar: string, openChapter: number, pay: ShopDef['pay'], sells: string[]): ShopDef => ({
  id,
  placeId,
  name: { en: `${de} (${en})`, ar },
  openChapter,
  surface: 'world',
  register: 'polite',
  pay,
  sells,
});
const sellsOf = (id: string) => DE_MENU.filter((m) => m.shop === id).map((m) => m.id);

export const DE_SHOPS: ShopDef[] = [
  shop('bakery', 'berlin_bakery', 'Bäckerei Krüger', 'bakery', 'مخبز كروغر', 1, ['cash', 'card'], sellsOf('bakery')),
  shop('spaeti', 'berlin_spaeti', 'Späti', 'corner shop', 'محلّ «الشبيتي»', 1, ['cash', 'card'], sellsOf('spaeti')),
  shop('doener', 'berlin_doener', 'Döner am Kotti', 'Döner stand', 'كشك الدونر', 2, ['cash', 'card'], sellsOf('doener')),
  shop('ubahn', 'berlin_ubahn', 'BVG', 'U-Bahn ticket counter', 'شبّاك تذاكر المترو', 2, ['cash', 'card'], sellsOf('ubahn')),
  // a flea market stall takes cash only
  shop('flohmarkt', 'berlin_flohmarkt', 'Flohmarkt im Mauerpark', 'flea market', 'سوق البرغوث في «ماورپارك»', 3, ['cash'], [...sellsOf('flohmarkt'), 'bike_used']),
  shop('apotheke', 'berlin_apotheke', 'Apotheke am Kiez', 'pharmacy', 'صيدلية الحيّ', 4, ['cash', 'card'], sellsOf('apotheke')),
  // the corner Kneipe takes cash only, like many in Berlin
  shop('kneipe', 'berlin_kneipe', 'Zum Eck', 'corner pub', 'حانة الناصية', 5, ['cash'], sellsOf('kneipe')),
];
