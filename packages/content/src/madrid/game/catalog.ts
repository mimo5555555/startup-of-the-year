// What Madrid's street sells (Spanish step 2): the menus of the five shops (by their conversations' slots), one owned thing (a tin of
// Andrés's olive oil, a present to take home) and the shops themselves; from Chapter 4 the farmacia and the taberna (Spanish step 4).
// Prices in cents, IVA included.
import type { ItemDef, MenuItem, ShopDef } from '@lw/game';
import { MADRID_PRICES } from '../shops';
import { PLACES_PRICES } from '../places';

const P: Record<string, number> = { ...MADRID_PRICES, ...PLACES_PRICES };

const menu = (shop: string, slot: string, option: string, es: string, en: string, ar: string, taxClass: string, tags: string[], giftable?: boolean): MenuItem => ({
  id: `${shop}:${option}`,
  shop,
  slot,
  option,
  name: { ja: es, en, ar },
  price: P[option]!,
  taxClass,
  tags,
  ...(giftable !== undefined ? { giftable } : {}),
});

export const ES_MENU: MenuItem[] = [
  menu('bar', 'bar', 'cafe', 'café con leche', 'Milky coffee', 'قهوة بالحليب', 'food', ['drink', 'coffee']),
  menu('bar', 'bar', 'cortado', 'cortado', 'Cortado', 'كورتادو', 'food', ['drink', 'coffee']),
  menu('bar', 'bar', 'solo', 'café solo', 'Black coffee', 'قهوة سوداء', 'food', ['drink', 'coffee']),
  menu('bar', 'bar', 'zumo', 'zumo de naranja', 'Orange juice', 'عصير برتقال', 'food', ['drink']),
  menu('bar', 'barComida', 'tostada', 'tostada con tomate', 'Toast with tomato', 'خبز محمّص بالطماطم', 'food', ['food', 'bread']),
  menu('bar', 'barComida', 'tortilla', 'pincho de tortilla', 'Slice of tortilla', 'قطعة «تورتيا»', 'food', ['food', 'meal']),
  menu('panaderia', 'pan', 'barra', 'barra de pan', 'Baguette', 'رغيف خبز', 'food', ['food', 'bread'], true),
  menu('panaderia', 'pan', 'napolitana', 'napolitana', 'Chocolate napolitana', '«نابوليتانا» بالشوكولاتة', 'food', ['food', 'sweet'], true),
  menu('panaderia', 'pan', 'cruasan', 'cruasán', 'Croissant', 'كرواسون', 'food', ['food', 'sweet'], true),
  menu('panaderia', 'dulce', 'magdalenas', 'magdalenas', 'Bag of magdalenas', 'كيس «مادالينا»', 'food', ['food', 'sweet'], true),
  menu('mercado', 'fruta', 'naranjas', 'naranjas', 'Oranges (half a kilo)', 'برتقال (نصف كيلو)', 'food', ['food', 'fruit'], true),
  menu('mercado', 'fruta', 'tomates', 'tomates', 'Tomatoes (half a kilo)', 'طماطم (نصف كيلو)', 'food', ['food']),
  menu('mercado', 'fruta', 'fresas', 'fresas', 'Strawberries (half a kilo)', 'فراولة (نصف كيلو)', 'food', ['food', 'fruit', 'sweet'], true),
  menu('mercado', 'fruta', 'platanos', 'plátanos', 'Bananas (half a kilo)', 'موز (نصف كيلو)', 'food', ['food', 'fruit'], true),
  menu('churreria', 'churros', 'churros', 'churros', 'Churros (a portion)', '«تشوروس» (حصة)', 'food', ['food', 'sweet'], true),
  menu('churreria', 'churros', 'porras', 'porras', 'Porras (a portion)', '«بوراس» (حصة)', 'food', ['food', 'sweet'], true),
  menu('churreria', 'churroBebida', 'chocolate', 'chocolate', 'Hot chocolate', 'شوكولاتة ساخنة', 'food', ['drink', 'sweet']),
  menu('churreria', 'churroBebida', 'cafe', 'café con leche', 'Milky coffee', 'قهوة بالحليب', 'food', ['drink', 'coffee']),
  menu('metro', 'billete', 'sencillo', 'billete sencillo', 'Single ticket', 'تذكرة ذهاب', 'transport', ['transport']),
  menu('metro', 'billete', 'diez', 'diez viajes', 'Ten journeys', 'عشر رحلات', 'transport', ['transport']),
  // Chapter 4: the farmacia (a remedy is not a present)
  menu('farmacia', 'sintoma', 'garganta', 'pastillas para la garganta', 'Throat lozenges', 'أقراص للحلق', 'medicine', ['health'], false),
  menu('farmacia', 'sintoma', 'cabeza', 'paracetamol', 'Paracetamol', 'باراسيتامول', 'medicine', ['health'], false),
  menu('farmacia', 'sintoma', 'tos', 'jarabe para la tos', 'Cough syrup', 'شراب للسعال', 'medicine', ['health'], false),
  menu('farmacia', 'sintoma', 'resfriado', 'espray nasal', 'Nasal spray', 'بخاخ للأنف', 'medicine', ['health'], false),
  // Chapter 5: the taberna (the caña only for an adult; drunk and eaten there)
  menu('taberna', 'taberna', 'cana', 'caña', 'Small beer', 'بيرة صغيرة', 'standard', ['drink', 'alcohol'], false),
  menu('taberna', 'taberna', 'mosto', 'mosto', 'Grape juice', 'عصير عنب', 'food', ['drink'], false),
  menu('taberna', 'taberna', 'refresco', 'refresco', 'Soft drink', 'مشروب غازي', 'food', ['drink'], false),
  menu('taberna', 'racion', 'bravas', 'patatas bravas', 'Patatas bravas', '«بطاطا برافاس»', 'food', ['food', 'meal'], false),
  menu('taberna', 'racion', 'croquetas', 'ración de croquetas', 'Plate of croquetas', 'طبق كروكيت', 'food', ['food', 'meal'], false),
];

/** a tin of Andrés's olive oil: the present to take home (the dream 「Un regalo de Madrid」) */
export const ES_ITEMS: ItemDef[] = [
  {
    id: 'mad_aceite',
    name: { ja: 'lata de aceite', en: 'Tin of olive oil', ar: 'علبة زيت زيتون' },
    price: P.aceite!,
    cat: 'gift',
    shop: 'mercado',
    gate: { ch: 3 },
    fx: [{ t: 'gift', tags: ['food', 'gift'] }],
    tags: ['gift', 'food'],
  },
];

const shop = (id: string, placeId: string, es: string, en: string, ar: string, openChapter: number, pay: ShopDef['pay'], register: ShopDef['register'], extra: string[] = []): ShopDef => ({
  id,
  placeId,
  name: { en: `${es} (${en})`, ar },
  openChapter,
  surface: 'world',
  register,
  pay,
  sells: [...ES_MENU.filter((m) => m.shop === id).map((m) => m.id), ...extra],
});

/** the bar, the churrería and the taberna say tú, as Madrid's bars do; the panadería, the market stall, the Metro and the farmacia say usted */
export const ES_SHOPS: ShopDef[] = [
  shop('bar', 'mad_bar', 'Bar El Rincón', 'bar', '«بار إل رينكون»', 1, ['cash', 'card'], 'casual'),
  shop('panaderia', 'mad_panaderia', 'Panadería', 'bakery', 'المخبز', 1, ['cash', 'card'], 'polite'),
  shop('churreria', 'mad_churreria', 'Churrería', 'churros', 'محل «التشوروس»', 2, ['cash', 'card'], 'casual'),
  shop('metro', 'mad_metro', 'Metro', 'tickets', 'تذاكر المترو', 2, ['cash', 'card'], 'polite'),
  shop('mercado', 'mad_mercado', 'Mercado', 'market', 'السوق', 3, ['cash', 'card'], 'polite', ['mad_aceite']),
  shop('farmacia', 'mad_farmacia', 'Farmacia', 'pharmacy', 'الصيدلية', 4, ['cash', 'card'], 'polite'),
  shop('taberna', 'mad_taberna', 'Taberna El Farolillo', 'tavern', 'حانة «إل فاروليو»', 5, ['cash', 'card'], 'casual'),
];
