// The slots of Madrid's Spanish conversations. Keys are compared the Spanish way (@lw/core esMatchForms): any letter case, accents and ñ or
// not (café = cafe, plátanos = platanos), from the start of a word (「un」 is in 「una」, never in 「algún」). On a tie the longer key wins:
// 「café solo」 is not 「café」, 「medio kilo」 is not 「kilo」.
import type { SlotOption } from '../types';
import { ES_LEXICON } from './lexicon';

/** A slot option whose Spanish is dictionary words; the gloss is the last word's unless given; its own words are a key. */
const opt = (id: string, es: string, keys: string[], en: string[], ar: string[], gloss?: { en: string; ar: string }): SlotOption => {
  const last = es.split(' ').at(-1)!;
  const e = ES_LEXICON.get(last);
  if (!e) throw new Error(`Slot option ${id}: ${last} is not in the Spanish dictionary`);
  return { id, ja: es, gloss: gloss ?? { en: e.en.replace(/ \(.*\)$/, ''), ar: e.ar.replace(/ \(.*\)$/, '') }, keys: { ja: [es, ...keys], en, ar } };
};

export const ES_SLOTS: Record<string, SlotOption[]> = {
  // the bar: a plain 「café」 is a café con leche, the breakfast coffee
  bar: [
    opt('cafe', 'café con leche', ['cafe', 'con leche', 'cafes con leche'], ['milky coffee', 'coffee with milk', 'latte', 'coffee'], ['قهوة بالحليب', 'قهوة'], { en: 'milky coffee', ar: 'قهوة بالحليب' }),
    opt('cortado', 'cortado', ['cortados', 'cafe cortado'], ['cortado', 'small coffee with a dash of milk'], ['كورتادو'], { en: 'cortado (coffee with a dash of milk)', ar: '«كورتادو» (قهوة بقليل من الحليب)' }),
    opt('solo', 'café solo', ['solo', 'cafe solo', 'expreso', 'espresso'], ['black coffee', 'espresso'], ['قهوة سوداء', 'إسبريسو'], { en: 'black coffee', ar: 'قهوة سوداء' }),
    opt('zumo', 'zumo de naranja', ['zumo', 'zumo natural', 'zumos'], ['orange juice', 'juice'], ['عصير برتقال', 'عصير'], { en: 'orange juice', ar: 'عصير برتقال' }),
  ],
  barComida: [
    opt('tostada', 'tostada con tomate', ['tostada', 'tostadas', 'pan con tomate'], ['toast', 'toast with tomato'], ['خبز محمّص', 'خبز بالطماطم'], { en: 'toast with tomato', ar: 'خبز محمّص بالطماطم' }),
    opt('tortilla', 'pincho de tortilla', ['tortilla', 'pincho', 'tortilla de patatas'], ['tortilla', 'spanish omelette', 'omelette'], ['تورتيا', 'عجة البطاطا'], { en: 'a slice of tortilla (potato omelette)', ar: 'قطعة «تورتيا» (عجة بالبطاطا)' }),
  ],
  pan: [
    opt('barra', 'barra de pan', ['barra', 'barras', 'pan', 'baguette'], ['baguette', 'bread', 'a loaf'], ['رغيف', 'خبز'], { en: 'baguette (barra de pan)', ar: 'رغيف خبز طويل' }),
    opt('napolitana', 'napolitana', ['napolitanas', 'napolitana de chocolate'], ['napolitana', 'chocolate pastry'], ['نابوليتانا', 'معجنات بالشوكولاتة']),
    opt('cruasan', 'cruasán', ['cruasanes', 'croissant', 'croissants'], ['croissant'], ['كرواسون']),
  ],
  dulce: [opt('magdalenas', 'magdalenas', ['magdalena', 'bolsa de magdalenas'], ['magdalenas', 'muffins', 'cupcakes'], ['مادالينا', 'كعك'])],
  fruta: [
    opt('naranjas', 'naranjas', ['naranja'], ['oranges', 'orange'], ['برتقال']),
    opt('tomates', 'tomates', ['tomate'], ['tomatoes', 'tomato'], ['طماطم']),
    opt('fresas', 'fresas', ['fresa'], ['strawberries', 'strawberry'], ['فراولة']),
    opt('platanos', 'plátanos', ['platano', 'banana', 'bananas'], ['bananas', 'banana'], ['موز']),
  ],
  // Andrés's olive oil, a present to take home (the dream 「Un regalo de Madrid」)
  aceite: [opt('aceite', 'lata de aceite', ['aceite', 'aceite de oliva', 'una lata'], ['olive oil', 'a tin of olive oil', 'oil'], ['زيت زيتون', 'علبة زيت'], { en: 'tin of olive oil', ar: 'علبة زيت زيتون' })],
  // the fruit is priced by the half kilo: half a kilo is one, a kilo two, two kilos four
  peso: [
    opt('one', 'medio kilo', ['medio', '500 gramos', 'quinientos gramos'], ['half a kilo', 'half kilo', '500 grams'], ['نصف كيلو', '500 غرام'], { en: 'half a kilo', ar: 'نصف كيلو' }),
    opt('four', 'dos kilos', ['2 kilos'], ['two kilos', '2 kilos'], ['كيلوان', '2 كيلو'], { en: 'two kilos', ar: 'كيلوان' }),
    opt('two', 'kilo', ['un kilo', '1 kilo', 'kilos'], ['a kilo', 'one kilo', 'kilo'], ['كيلو', 'كيلوغرام'], { en: 'a kilo', ar: 'كيلو' }),
  ],
  churros: [
    opt('porras', 'porras', ['porra', 'racion de porras'], ['porras', 'thick churros'], ['بوراس'], { en: 'porras (thick churros)', ar: '«بوراس» («تشوروس» سميكة)' }),
    opt('churros', 'churros', ['churro', 'racion de churros'], ['churros'], ['تشوروس']),
  ],
  churroBebida: [
    opt('chocolate', 'chocolate', ['un chocolate', 'chocolate caliente', 'taza de chocolate'], ['hot chocolate', 'chocolate'], ['شوكولاتة ساخنة', 'شوكولاتة'], { en: 'hot chocolate', ar: 'شوكولاتة ساخنة' }),
    opt('cafe', 'café con leche', ['cafe', 'con leche'], ['coffee', 'milky coffee'], ['قهوة', 'قهوة بالحليب'], { en: 'milky coffee', ar: 'قهوة بالحليب' }),
  ],
  billete: [
    opt('diez', 'diez viajes', ['diez', '10 viajes', 'de diez', 'metrobus', 'bono'], ['ten journeys', 'ten trips', '10 trips', 'ten-journey ticket'], ['عشر رحلات', '10 رحلات'], { en: 'ten journeys (Metrobús)', ar: 'عشر رحلات («مترو بوس»)' }),
    opt('sencillo', 'billete sencillo', ['sencillo', 'billete', 'un viaje', 'uno sencillo'], ['single ticket', 'single', 'one ticket', 'a ticket'], ['تذكرة ذهاب', 'تذكرة'], { en: 'single ticket', ar: 'تذكرة ذهاب' }),
  ],
  // where you are from (a country not listed is taken as said: 「Soy de Islandia」)
  country: [
    opt('egypt', 'Egipto', [], ['egypt'], ['مصر']),
    opt('morocco', 'Marruecos', [], ['morocco'], ['المغرب']),
    opt('syria', 'Siria', [], ['syria'], ['سوريا', 'سورية']),
    opt('saudi', 'Arabia Saudí', ['arabia saudita', 'arabia'], ['saudi arabia', 'saudi'], ['السعودية']),
    opt('turkey', 'Turquía', [], ['turkey', 'türkiye'], ['تركيا']),
    opt('england', 'Inglaterra', ['reino unido', 'gran bretana'], ['england', 'uk', 'britain'], ['إنجلترا', 'بريطانيا']),
    opt('usa', 'Estados Unidos', ['eeuu', 'america', 'los estados unidos'], ['usa', 'america', 'the us'], ['أمريكا', 'الولايات المتحدة'], { en: 'the United States', ar: 'الولايات المتحدة' }),
    opt('japan', 'Japón', [], ['japan'], ['اليابان']),
    opt('germany', 'Alemania', [], ['germany'], ['ألمانيا']),
  ],
  // a hobby, as it reads after 「me gusta」 and in a friend's 「¿Todavía te gusta {hobby}?」: a verb, or a noun with its article
  hobby: [
    opt('cooking', 'cocinar', ['cocino', 'cocina', 'la cocina'], ['cooking', 'cook'], ['الطبخ', 'أطبخ']),
    opt('music', 'la música', ['musica', 'escuchar musica', 'escucho', 'cantar', 'canto', 'guitarra', 'piano'], ['music'], ['الموسيقى', 'موسيقى']),
    opt('sports', 'el deporte', ['deporte', 'deportes', 'futbol', 'correr', 'corro', 'nadar', 'nado', 'bici', 'gimnasio'], ['sport', 'sports', 'football', 'running'], ['الرياضة', 'كرة القدم']),
    opt('games', 'jugar a videojuegos', ['videojuegos', 'videojuego', 'juegos', 'consola', 'la play'], ['games', 'gaming', 'video games'], ['الألعاب', 'ألعاب الفيديو'], { en: 'video games', ar: 'ألعاب الفيديو' }),
    opt('travel', 'viajar', ['viajo', 'viajes'], ['travel', 'travelling'], ['السفر', 'أسافر']),
    opt('movies', 'el cine', ['cine', 'pelis', 'peliculas', 'series'], ['movies', 'films', 'cinema'], ['الأفلام', 'السينما'], { en: 'films, the cinema', ar: 'الأفلام، السينما' }),
    opt('books', 'leer', ['leo', 'libros', 'lectura'], ['reading', 'books'], ['القراءة', 'الكتب']),
    opt('drawing', 'dibujar', ['dibujo', 'pintar', 'pinto', 'arte'], ['drawing', 'painting', 'art'], ['الرسم', 'أرسم']),
  ],
  // a present handed to a friend (give_gift): the street's things as you hand them over (「Tengo una lata de aceite para ti」); the ids are
  // the shops' slot options, so the gift sheet finds the name of what was bought
  giftItem: [opt('aceite', 'una lata de aceite', ['lata de aceite', 'aceite', 'aceite de oliva', 'lata'], ['a tin of olive oil', 'olive oil', 'tin'], ['علبة زيت زيتون', 'زيت زيتون'], { en: 'a tin of olive oil', ar: 'علبة زيت زيتون' })],
  giftFood: [
    opt('cafe', 'un café con leche', ['cafe con leche', 'cafe', 'un cafe'], ['a milky coffee', 'coffee'], ['قهوة بالحليب', 'قهوة'], { en: 'a milky coffee', ar: 'قهوة بالحليب' }),
    opt('cortado', 'un cortado', ['cortado'], ['a cortado'], ['«كورتادو»'], { en: 'a cortado', ar: '«كورتادو»' }),
    opt('solo', 'un café solo', ['cafe solo'], ['a black coffee', 'espresso'], ['قهوة سوداء'], { en: 'a black coffee', ar: 'قهوة سوداء' }),
    opt('zumo', 'un zumo de naranja', ['zumo de naranja', 'zumo'], ['an orange juice', 'juice'], ['عصير برتقال'], { en: 'an orange juice', ar: 'عصير برتقال' }),
    opt('tostada', 'una tostada con tomate', ['tostada con tomate', 'tostada'], ['toast with tomato', 'toast'], ['خبز محمّص بالطماطم'], { en: 'toast with tomato', ar: 'خبز محمّص بالطماطم' }),
    opt('tortilla', 'un pincho de tortilla', ['pincho de tortilla', 'tortilla', 'pincho'], ['a slice of tortilla', 'tortilla'], ['قطعة «تورتيا»'], { en: 'a slice of tortilla', ar: 'قطعة «تورتيا»' }),
    opt('barra', 'una barra de pan', ['barra de pan', 'barra', 'pan'], ['a baguette', 'bread'], ['رغيف خبز'], { en: 'a baguette', ar: 'رغيف خبز' }),
    opt('napolitana', 'una napolitana', ['napolitana de chocolate', 'napolitana'], ['a napolitana', 'chocolate pastry'], ['«نابوليتانا»'], { en: 'a napolitana', ar: '«نابوليتانا»' }),
    opt('cruasan', 'un cruasán', ['cruasan', 'croissant'], ['a croissant'], ['كرواسون'], { en: 'a croissant', ar: 'كرواسون' }),
    opt('magdalenas', 'unas magdalenas', ['magdalenas', 'magdalena'], ['some magdalenas', 'muffins'], ['كعكات «مادالينا»'], { en: 'some magdalenas', ar: 'كعكات «مادالينا»' }),
    opt('naranjas', 'unas naranjas', ['naranjas', 'naranja'], ['some oranges', 'oranges'], ['برتقال'], { en: 'some oranges', ar: 'برتقال' }),
    opt('tomates', 'unos tomates', ['tomates', 'tomate'], ['some tomatoes', 'tomatoes'], ['طماطم'], { en: 'some tomatoes', ar: 'طماطم' }),
    opt('fresas', 'unas fresas', ['fresas', 'fresa'], ['some strawberries', 'strawberries'], ['فراولة'], { en: 'some strawberries', ar: 'فراولة' }),
    opt('platanos', 'unos plátanos', ['platanos', 'platano'], ['some bananas', 'bananas'], ['موز'], { en: 'some bananas', ar: 'موز' }),
    opt('churros', 'unos churros', ['churros', 'churro'], ['some churros', 'churros'], ['«تشوروس»'], { en: 'some churros', ar: '«تشوروس»' }),
    opt('porras', 'unas porras', ['porras', 'porra'], ['some porras', 'porras'], ['«بوراس»'], { en: 'some porras', ar: '«بوراس»' }),
    opt('chocolate', 'un chocolate', ['chocolate'], ['a hot chocolate', 'chocolate'], ['شوكولاتة ساخنة'], { en: 'a hot chocolate', ar: 'شوكولاتة ساخنة' }),
  ],
  // a friend's 「¿Cuál es tu comida favorita?」: the favourite food is remembered (fact favFood) and quoted later (「¿Has comido paella esta
  // semana?」)
  chatfood: [
    opt('paella', 'paella', ['paellas'], ['paella'], ['باييا']),
    opt('tortilla', 'tortilla', ['tortilla de patatas'], ['tortilla', 'spanish omelette', 'omelette'], ['تورتيا', 'عجة']),
    opt('cocido', 'cocido', ['cocido madrileno'], ['cocido', 'stew'], ['«كوسيدو» (يخنة مدريدية)']),
    opt('croquetas', 'croquetas', ['croqueta'], ['croquetas', 'croquettes'], ['كروكيت']),
    opt('pizza', 'pizza', ['pizzas'], ['pizza'], ['بيتزا']),
    opt('pescado', 'pescado', ['pescadito', 'pescaito'], ['fish'], ['سمك']),
    opt('arroz', 'arroz', [], ['rice'], ['أرز']),
    opt('ensalada', 'ensalada', ['ensaladas'], ['salad'], ['سلطة']),
    opt('chocolate', 'chocolate', [], ['chocolate'], ['شوكولاتة']),
    opt('falafel', 'falafel', [], ['falafel'], ['فلافل']),
    opt('cuscus', 'cuscús', ['cuscus', 'couscous'], ['couscous'], ['كسكس']),
  ],
  // the farmacia (places.ts): what hurts; each complaint has its remedy, which is what is sold
  sintoma: [
    opt('garganta', 'garganta', ['me duele la garganta', 'dolor de garganta', 'la garganta'], ['sore throat', 'throat'], ['الحلق', 'التهاب الحلق'], { en: 'sore throat', ar: 'ألم الحلق' }),
    opt('cabeza', 'cabeza', ['dolor de cabeza', 'me duele la cabeza', 'jaqueca'], ['headache', 'head'], ['صداع', 'الرأس'], { en: 'headache', ar: 'صداع' }),
    opt('tos', 'tos', ['toso', 'tengo tos'], ['cough'], ['سعال', 'كحة'], { en: 'cough', ar: 'سعال' }),
    opt('resfriado', 'resfriado', ['resfriada', 'constipado', 'constipada', 'mocos', 'nariz', 'gripe', 'congestion'], ['cold', 'a cold', 'runny nose'], ['زكام', 'نزلة برد'], { en: 'a cold', ar: 'زكام' }),
  ],
  // the taberna (places.ts): a caña only for an adult; a mosto (grape juice) or a soft drink for anyone; a ración to share
  taberna: [
    opt('cana', 'caña', ['cana', 'canas', 'cerveza', 'birra'], ['beer', 'a small beer', 'a beer'], ['بيرة'], { en: 'a small beer (caña)', ar: 'بيرة صغيرة' }),
    opt('mosto', 'mosto', ['un mosto', 'zumo de uva'], ['grape juice'], ['عصير عنب'], { en: 'grape juice (mosto)', ar: 'عصير عنب' }),
    opt('refresco', 'refresco', ['refresco de limon', 'limon', 'coca cola', 'cola', 'fanta'], ['soft drink', 'soda', 'lemon soda'], ['مشروب غازي'], { en: 'soft drink', ar: 'مشروب غازي' }),
  ],
  racion: [
    opt('bravas', 'patatas bravas', ['bravas', 'patatas', 'racion de bravas'], ['patatas bravas', 'spicy potatoes', 'fried potatoes'], ['بطاطا برافاس', 'بطاطا حارة'], { en: 'patatas bravas (spicy fried potatoes)', ar: '«بطاطا برافاس» (بطاطا مقلية حارّة)' }),
    opt('croquetas', 'ración de croquetas', ['croquetas', 'croqueta', 'racion de croquetas'], ['croquettes', 'croquetas'], ['كروكيت'], { en: 'a plate of croquetas', ar: 'طبق كروكيت' }),
  ],
  payMethod: [
    opt('card', 'con tarjeta', ['tarjeta', 'con la tarjeta', 'contactless', 'datafono'], ['card', 'by card', 'credit card'], ['بطاقة', 'بالبطاقة']),
    opt('cash', 'en efectivo', ['efectivo', 'en metalico', 'metalico', 'cash'], ['cash', 'in cash'], ['نقدًا', 'كاش']),
  ],
  // `one` comes last: on a tie of key length the first option wins, and 「dos napolitanas y un café」 is two
  qty: [
    opt('two', 'dos', ['2', 'un par'], ['two', '2'], ['اثنان', 'اثنين', '2']),
    opt('three', 'tres', ['3'], ['three', '3'], ['ثلاثة', '3']),
    opt('four', 'cuatro', ['4'], ['four', '4'], ['أربعة', '4']),
    opt('one', 'uno', ['un', 'una', '1'], ['one', 'a', '1'], ['واحد', 'واحدة', '1']),
  ],
};
