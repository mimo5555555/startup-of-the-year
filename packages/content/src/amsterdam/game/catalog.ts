// What Amsterdam's street sells (Dutch step 2): the menus of the five shops (by their conversations' slots), one owned thing (a tin of
// stroopwafels, a present to take home) and the shops themselves. Prices in cents, BTW included.
import type { ItemDef, MenuItem, ShopDef } from '@lw/game';
import { AMSTERDAM_PRICES as P } from '../shops';

const menu = (shop: string, slot: string, option: string, nl: string, en: string, ar: string, taxClass: string, tags: string[], giftable = false): MenuItem => ({
  id: `${shop}:${option}`,
  shop,
  slot,
  option,
  name: { ja: nl, en, ar },
  price: P[option]!,
  taxClass,
  tags,
  ...(giftable ? { giftable } : {}),
});

export const NL_MENU: MenuItem[] = [
  menu('cafe', 'cafe', 'koffie', 'koffie', 'Coffee', 'قهوة', 'food', ['drink', 'coffee']),
  menu('cafe', 'cafe', 'verkeerd', 'koffie verkeerd', 'Milky coffee', 'قهوة بالحليب', 'food', ['drink', 'coffee']),
  menu('cafe', 'cafe', 'thee', 'thee', 'Tea', 'شاي', 'food', ['drink']),
  menu('cafe', 'cafe', 'chocomel', 'chocolademelk', 'Hot chocolate', 'شوكولاتة ساخنة', 'food', ['drink', 'sweet']),
  menu('cafe', 'taart', 'appeltaart', 'appeltaart', 'Apple pie', 'فطيرة التفاح', 'food', ['food', 'sweet'], true),
  menu('kaas', 'kaas', 'jong', 'jonge kaas', 'Young Gouda (half pound)', 'غاودا طرية (نصف رطل)', 'food', ['food', 'cheese'], true),
  menu('kaas', 'kaas', 'belegen', 'belegen kaas', 'Mature Gouda (half pound)', 'غاودا متوسطة (نصف رطل)', 'food', ['food', 'cheese'], true),
  menu('kaas', 'kaas', 'oud', 'oude kaas', 'Old Gouda (half pound)', 'غاودا معتّقة (نصف رطل)', 'food', ['food', 'cheese'], true),
  menu('kaas', 'kaas', 'geit', 'geitenkaas', 'Goat cheese (half pound)', 'جبن الماعز (نصف رطل)', 'food', ['food', 'cheese'], true),
  menu('markt', 'wafel', 'gewoon', 'stroopwafel', 'Stroopwafel', '«ستروبفافل»', 'food', ['food', 'sweet'], true),
  menu('markt', 'wafel', 'choco', 'stroopwafel met chocolade', 'Stroopwafel with chocolate', '«ستروبفافل» بالشوكولاتة', 'food', ['food', 'sweet'], true),
  menu('snackbar', 'snack', 'patat', 'patatje met', 'Fries with mayonnaise', 'بطاطا مقلية بالمايونيز', 'food', ['food', 'meal']),
  menu('snackbar', 'snack', 'kroket', 'kroket', 'Kroket', '«كروكيت»', 'food', ['food', 'meal']),
  menu('snackbar', 'snack', 'frikandel', 'frikandel', 'Frikandel', '«فريكاندل»', 'food', ['food', 'meal']),
  menu('snackbar', 'snack', 'kaassouffle', 'kaassoufflé', 'Kaassoufflé', '«كاسوفليه»', 'food', ['food', 'meal']),
  menu('gvb', 'kaartje', 'uur', 'uurkaart', 'One-hour ticket', 'تذكرة لساعة', 'transport', ['transport']),
  menu('gvb', 'kaartje', 'dag', 'dagkaart', 'Day ticket', 'تذكرة يومية', 'transport', ['transport']),
];

/** a tin of stroopwafels from Jesse's stall: the present to take home (the dream 「Een cadeau voor thuis」) */
export const NL_ITEMS: ItemDef[] = [
  {
    id: 'ams_wafel_blik',
    name: { ja: 'blik stroopwafels', en: 'Tin of stroopwafels', ar: 'علبة «ستروبفافل»' },
    price: P.blik!,
    cat: 'gift',
    shop: 'markt',
    gate: { ch: 3 },
    fx: [{ t: 'gift', tags: ['sweet', 'gift'] }],
    tags: ['gift', 'sweet'],
  },
];

const shop = (id: string, placeId: string, nl: string, en: string, ar: string, openChapter: number, pay: ShopDef['pay'], extra: string[] = []): ShopDef => ({
  id,
  placeId,
  name: { en: `${nl} (${en})`, ar },
  openChapter,
  surface: 'world',
  register: 'polite',
  pay,
  sells: [...NL_MENU.filter((m) => m.shop === id).map((m) => m.id), ...extra],
});

export const NL_SHOPS: ShopDef[] = [
  shop('cafe', 'ams_cafe', 'Café De Gracht', 'café', 'مقهى «دي خراخت»', 1, ['cash', 'card']),
  shop('snackbar', 'ams_snackbar', 'Snackbar Mo', 'snack bar', 'محل وجبات «مو»', 2, ['cash', 'card']),
  // the trams and their desk take cards only
  shop('gvb', 'ams_gvb', 'GVB', 'tram tickets', 'تذاكر الترام', 2, ['card']),
  shop('kaas', 'ams_kaas', 'Kaashandel Bakker', 'cheese shop', 'متجر باكر للأجبان', 3, ['cash', 'card']),
  shop('markt', 'ams_markt', 'Albert Cuypmarkt', 'market', 'سوق ألبرت كاوب', 3, ['cash', 'card'], ['ams_wafel_blik']),
];
