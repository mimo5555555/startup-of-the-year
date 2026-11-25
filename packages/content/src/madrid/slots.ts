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
  hobby: [
    opt('cooking', 'cocinar', ['cocino', 'cocina', 'la cocina'], ['cooking', 'cook'], ['الطبخ', 'أطبخ']),
    opt('music', 'música', ['escuchar musica', 'escucho', 'cantar', 'canto', 'guitarra', 'piano'], ['music'], ['الموسيقى', 'موسيقى']),
    opt('sports', 'deporte', ['deportes', 'futbol', 'correr', 'corro', 'nadar', 'nado', 'bici', 'gimnasio'], ['sport', 'sports', 'football', 'running'], ['الرياضة', 'كرة القدم']),
    opt('games', 'videojuegos', ['videojuego', 'juegos', 'consola', 'la play'], ['games', 'gaming', 'video games'], ['الألعاب', 'ألعاب الفيديو']),
    opt('travel', 'viajar', ['viajo', 'viajes'], ['travel', 'travelling'], ['السفر', 'أسافر']),
    opt('movies', 'películas', ['pelis', 'peliculas', 'cine', 'series'], ['movies', 'films', 'cinema'], ['الأفلام', 'السينما']),
    opt('books', 'leer', ['leo', 'libros', 'lectura'], ['reading', 'books'], ['القراءة', 'الكتب']),
    opt('drawing', 'dibujar', ['dibujo', 'pintar', 'pinto', 'arte'], ['drawing', 'painting', 'art'], ['الرسم', 'أرسم']),
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
