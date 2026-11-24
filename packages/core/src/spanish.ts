// Spanish text (Spanish step 1, Madrid): the forms the engine matches on, numbers said and written, prices in euro, a name or a country
// given in a sentence. Pure functions; the dictionary lives in @lw/content (madrid/), the engine's `ES` target language puts them together.
// Spanish numbers are phrases, not one word as in German or Dutch (「treinta y cinco」, 「dos mil quinientos」), and a price is said several
// ways (「tres euros con cincuenta」, 「tres euros cincuenta」, 「tres con cincuenta」, 「tres cincuenta」): all of them are one number here.

/** sounds a learner says while thinking; never part of a request */
const FILLERS = new Set(['eh', 'ehm', 'em', 'emm', 'mm', 'mmm', 'hm', 'hmm']);

/** Lower case, ¿ ¡ and other punctuation as spaces, apostrophes dropped, fillers out, spaces collapsed; a decimal comma stays (2,50). */
export function esBase(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’‘`´]/g, '')
    .replace(/[^\p{L}\p{N}\s,]+/gu, ' ')
    // a comma between digits is a decimal comma (2,50); any other is punctuation
    .replace(/(?<!\d),|,(?!\d)/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLERS.has(w))
    .join(' ');
}

/**
 * The two forms a Spanish key and a Spanish utterance are compared in. `loose`: the base form with the accents and the tilde folded
 * (café = cafe, dieciséis = dieciseis, España = espana, as typed without a Spanish keyboard); `folded`: also the letters Madrid says
 * alike, ll as y and v as b (a learner's 「yamo」 or 「bino」), the same on both sides.
 */
export function esMatchForms(text: string): { loose: string; folded: string } {
  const loose = esBase(text).normalize('NFD').replace(/\p{M}/gu, '');
  const folded = loose.replace(/ll/g, 'y').replace(/v/g, 'b');
  return { loose, folded };
}

/** A key matches at the start of a word: 「un」 is in 「una」 but not in 「algún」 or 「ningún」. */
export const esContains = (text: string, key: string): boolean => (' ' + text).includes(' ' + key);

/** The fold the dictionary check uses: a typed 「cafe」 or 「espanol」 is the word café, español. */
export const esFoldWord = (word: string): string => esMatchForms(word).folded;

// ---------- numbers ----------

const UNDER30 = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
  'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
  'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function under100(n: number): string {
  if (n < 30) return UNDER30[n]!;
  const u = n % 10;
  return `${TENS[Math.floor(n / 10)]}${u ? ` y ${UNDER30[u]}` : ''}`;
}

function under1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (!h) return under100(rest);
  if (h === 1 && !rest) return 'cien';
  return `${HUNDREDS[h]}${rest ? ` ${under100(rest)}` : ''}`;
}

/** 「uno」 before a noun (or 「mil」) is 「un」, and 「veintiuno」 is 「veintiún」: 「veintiún euros」, 「treinta y un mil」 */
const apocope = (words: string): string => words.replace(/veintiuno$/, 'veintiún').replace(/(^|\s)uno$/, '$1un');

/** 0..999,999 in words, as Spanish writes them: 21 → veintiuno, 35 → treinta y cinco, 100 → cien, 101 → ciento uno, 2500 → dos mil quinientos. */
export function spanishNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) throw new RangeError(`spanishNumber: ${n} is outside 0..999999`);
  if (n < 1000) return under1000(n);
  const k = Math.floor(n / 1000);
  const rest = n % 1000;
  return `${k === 1 ? 'mil' : `${apocope(under1000(k))} mil`}${rest ? ` ${under1000(rest)}` : ''}`;
}

/** the value of every number word, by its folded form (no accents); the feminine hundreds (doscientas) and 「un」, 「una」 too */
const VALUE = new Map<string, number>();
const fold = (w: string): string => w.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
UNDER30.forEach((w, i) => VALUE.set(fold(w), i));
TENS.forEach((w, i) => w && VALUE.set(w, i * 10));
HUNDREDS.forEach((w, i) => {
  if (!w) return;
  VALUE.set(w, i * 100);
  if (w.endsWith('os')) VALUE.set(w.replace(/os$/, 'as'), i * 100);
});
for (const [w, v] of [['cien', 100], ['veintiun', 21], ['veintiuna', 21], ['un', 1], ['una', 1], ['mil', 1000]] as const) VALUE.set(w, v);
/** 「un」 and 「una」 are articles on their own: a number only in a number phrase or before euro, céntimo or mil */
const ARTICLES = new Set(['un', 'una']);

/** One number word to its value (dieciséis → 16, quinientas → 500, veintiún → 21), or null. The articles 「un」 and 「una」 alone are not numbers; 「uno」 is. */
export function parseSpanishNumberWord(word: string): number | null {
  const w = fold(word);
  if (ARTICLES.has(w)) return null;
  return VALUE.get(w) ?? null;
}

/**
 * The number phrase that starts at words[i] (folded), or null: units and teens (0-29), tens with 「y」 and a unit (treinta y cinco),
 * hundreds (ciento veinte, quinientos), thousands (dos mil quinientos). `end` is the index after the phrase.
 */
function numberPhrase(words: string[], i: number): { value: number; end: number } | null {
  let total = 0;
  let current = 0;
  let j = i;
  let any = false;
  while (j < words.length) {
    const w = words[j]!;
    const v = VALUE.get(w);
    if (v === undefined) break;
    if (w === 'mil') {
      total += (current || 1) * 1000;
      current = 0;
    } else if (v >= 100) {
      if (current % 1000 !== 0) break;
      current += v;
    } else if (v >= 30) {
      if (current % 100 !== 0) break;
      current += v;
      // 「treinta y cinco」: the unit after 「y」
      const u = words[j + 2] !== undefined ? VALUE.get(words[j + 2]!) : undefined;
      if (words[j + 1] === 'y' && u !== undefined && u >= 1 && u <= 9) {
        current += u;
        j += 2;
      }
    } else {
      if (current % 100 !== 0) break;
      // an article opens a phrase only before euro, céntimo, mil or inside a phrase (ciento un, treinta y un)
      if (ARTICLES.has(w) && !any && !/^(?:euros?|centimos?|mil)$/.test(words[j + 1] ?? '')) break;
      current += v;
    }
    any = true;
    j++;
  }
  return any ? { value: total + current, end: j } : null;
}

/** an amount in digits: 2, 2,50, 2.50, 1.234 or 1.234,56 (a point before three digits groups thousands) */
const DIGITS = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[.,]\d{1,2})?$/;
const CENTS = /^(?:centimos?|cents?)$/;

/** the number at words[i]: digits, or a phrase of number words */
function numberAt(words: string[], i: number): { value: number; end: number; digits: boolean } | null {
  const w = words[i]!;
  if (DIGITS.test(w)) return { value: Number(w.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')), end: i + 1, digits: true };
  const p = numberPhrase(words, i);
  return p ? { ...p, digits: false } : null;
}

/**
 * Every number in a Spanish utterance, in order: digits (2, 2,50, 2.50) and words (dos, treinta y cinco, ciento veinte). A price counts as
 * one number however it is said: 「tres euros con cincuenta」, 「tres euros cincuenta」, 「tres con cincuenta」, 「tres cincuenta」 → 3.5;
 * 「cincuenta céntimos」 → 0.5; 「un euro veinte」 → 1.2. The text comes back as it was.
 */
export function parseSpanishNumbers(text: string): { text: string; numbers: number[] } {
  const words = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/€\s*(\d[\d.,]*\d|\d)/g, '$1 euros ')
    .replace(/(\d)\s*€/g, '$1 euros')
    .split(/[^\p{L}\p{N}\p{M},.]+/u)
    .map((w) => fold(w.replace(/^[,.]+|[,.]+$/g, '')))
    .filter(Boolean);
  const numbers: number[] = [];
  /** cents after a price: 「(con) cincuenta (céntimos)」, a number under 100 said in words or two digits */
  const centsAt = (k: number): { value: number; end: number } | null => {
    const start = words[k] === 'con' ? k + 1 : k;
    if (start >= words.length) return null;
    const c = /^\d{1,2}$/.test(words[start]!) ? { value: Number(words[start]), end: start + 1 } : numberPhrase(words, start);
    if (!c || c.value >= 100) return null;
    return { value: c.value, end: CENTS.test(words[c.end] ?? '') ? c.end + 1 : c.end };
  };
  for (let i = 0; i < words.length; ) {
    const n = numberAt(words, i);
    if (!n) {
      i++;
      continue;
    }
    let { value, end } = n;
    const next = words[end];
    if (next && CENTS.test(next)) {
      numbers.push(Math.round(value) / 100);
      i = end + 1;
      continue;
    }
    if (next === 'euro' || next === 'euros') {
      const c = centsAt(end + 1);
      if (c && !n.digits) {
        numbers.push(Math.round(value * 100 + c.value) / 100);
        i = c.end;
        continue;
      }
      numbers.push(value);
      i = end + 1;
      continue;
    }
    // 「tres con cincuenta」 and 「tres cincuenta」: euros and cents, said the short way
    if (!n.digits && value < 1000) {
      const c = next === 'con' ? centsAt(end) : end < words.length && !DIGITS.test(words[end]!) ? numberPhrase(words, end) : null;
      if (c && c.value >= 10 && c.value < 100 && (next === 'con' || value < 100)) {
        numbers.push(Math.round(value * 100 + c.value) / 100);
        i = c.end;
        continue;
      }
    }
    numbers.push(value);
    i = end;
  }
  return { text, numbers };
}

/** A price in cents as Spain writes and says it: 250 → 2,50 € / dos euros con cincuenta; 300 → 3,00 € / tres euros; 100 → un euro; 50 → cincuenta céntimos. */
export function euroTextEs(cents: number): { written: string; words: string; en: string; ar: string } {
  if (!Number.isInteger(cents) || cents < 0 || cents > 99_999_999) throw new RangeError(`euroTextEs: ${cents} cents`);
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  const grouped = String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const written = `${grouped},${String(c).padStart(2, '0')} €`;
  // the cents stand alone after 「con」 (no noun follows, so 21 stays 「veintiuno」): 「dos euros con veintiuno」
  const centWords = c === 1 ? 'un céntimo' : under100(c);
  const words = e === 0 ? `${c === 1 ? 'un céntimo' : `${apocope(under100(c))} céntimos`}` : `${apocope(spanishNumber(e))} ${e === 1 ? 'euro' : 'euros'}${c ? ` con ${centWords}` : ''}`;
  const plain = `${e.toLocaleString('en-US')}.${String(c).padStart(2, '0')}`;
  return { written, words, en: `€${plain}`, ar: `${plain} يورو` };
}

// ---------- a name, a country ----------

/** words that follow 「soy」 without being a name: soy de Egipto, soy estudiante, soy nuevo, soy egipcio */
const NOT_A_NAME = new Set([
  'de', 'del', 'un', 'una', 'el', 'la', 'muy', 'nuevo', 'nueva', 'estudiante', 'profesor', 'profesora', 'medico', 'medica', 'ingeniero',
  'ingeniera', 'turista', 'yo', 'tu', 'aqui', 'asi', 'bien', 'mal', 'feliz', 'alto', 'alta', 'bajo', 'baja', 'joven', 'si', 'no', 'egipcio',
  'egipcia', 'marroqui', 'sirio', 'siria', 'saudi', 'aleman', 'alemana', 'ingles', 'inglesa', 'espanol', 'espanola', 'arabe', 'japones',
  'japonesa', 'americano', 'americana', 'vegetariano', 'vegetariana', 'casado', 'casada', 'soltero', 'soltera', 'ok', 'vale',
]);

/** Pulls a name out of 「Me llamo Sam」, 「Soy Sam」, 「Mi nombre es Sam」 or a bare 「Sam.」 (the answer to 「¿Cómo te llamas?」). */
export function captureSpanishName(text: string): string | null {
  const t = text
    .normalize('NFKC')
    .trim()
    .replace(/[¿¡]/g, '')
    .replace(/^(?:hola|buenas|buenos días|buenos dias|buenas tardes|buenas noches|sí|si|pues|bueno|vale)[,!.\s]+/i, '');
  const m = /(?:me llamo|mi nombre es|soy|llámame|llamame)\s+([\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]*)?)/iu.exec(t) ?? /^([\p{Lu}][\p{L}'-]*)[.!]?$/u.exec(t);
  if (!m) return null;
  const name = m[1]!.trim();
  // the first word decides: 「soy de Egipto」 is a country, 「soy estudiante」 a job
  if (!name || name.length > 24 || NOT_A_NAME.has(fold(name.split(/\s+/)[0]!))) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Pulls a country out of 「Soy de Egipto」, 「Vengo de Marruecos」 or 「Soy de los Estados Unidos」. */
export function captureSpanishCountry(text: string): string | null {
  const m = /\b(?:soy|vengo|vivo|estoy)\s+(?:de|en)\s+(?:los\s+|las\s+|el\s+|la\s+)?([\p{L}-]+(?:\s+[\p{Lu}][\p{L}-]*)?)/iu.exec(text.normalize('NFKC'));
  if (!m) return null;
  const v = m[1]!;
  if (/^(?:aqui|aquí|madrid|casa)$/i.test(v)) return null;
  return v.charAt(0).toUpperCase() + v.slice(1);
}
