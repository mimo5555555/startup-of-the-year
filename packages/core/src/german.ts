// German text: the forms the engine matches on, numbers said and written, prices in euro, a name or a country given in a sentence.
// Pure functions; the dictionary lives in @lw/content (berlin/), the engine's `DE` target language puts them together.

/** Umlauts and ß as typed without a German keyboard: ä → a (loose), ae → a (folded, both ways) */
const UMLAUT: Record<string, string> = { ä: 'a', ö: 'o', ü: 'u', ß: 'ss' };
/** sounds a learner says while thinking; never part of a request */
const FILLERS = new Set(['äh', 'ähm', 'ahm', 'öh', 'hm', 'hmm', 'mmh', 'em', 'ehm']);

/** Lower case, apostrophes dropped (geht's = gehts), punctuation as spaces, fillers out, spaces collapsed. */
export function deBase(text: string): string {
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
 * The two forms a German key and a German utterance are compared in. `loose`: the base form with umlauts folded (Brötchen and
 * brotchen meet); `folded`: also ae/oe/ue folded (broetchen meets them too). Both sides go through the same folding.
 */
export function deMatchForms(text: string): { loose: string; folded: string } {
  const base = deBase(text);
  const loose = base.replace(/[äöüß]/g, (c) => UMLAUT[c]!);
  const folded = loose.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  return { loose, folded };
}

/** A key matches at the start of a word: 「ein」 is in 「eine Brezel」 but not in 「kein」 or 「nein」. */
export const deContains = (text: string, key: string): boolean => (' ' + text).includes(' ' + key);

/** The fold the dictionary check uses: a typed 「brotchen」 or 「broetchen」 is the word Brötchen. */
export const deFoldWord = (word: string): string => deMatchForms(word).folded;

// ---------- numbers ----------

const UNITS = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

function under100(n: number): string {
  if (n < 20) return UNITS[n]!;
  const u = n % 10;
  const t = TENS[Math.floor(n / 10)]!;
  return u ? `${u === 1 ? 'ein' : UNITS[u]}und${t}` : t;
}

function under1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return (h ? `${h === 1 ? 'ein' : UNITS[h]}hundert` : '') + (rest ? under100(rest) : h ? '' : 'null');
}

/** 0..999,999 in words, written as one word the way German writes them: 21 → einundzwanzig, 1250 → eintausendzweihundertfünfzig. */
export function germanNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) throw new RangeError(`germanNumber: ${n} is outside 0..999999`);
  if (n < 1000) return under1000(n);
  const k = Math.floor(n / 1000);
  const rest = n % 1000;
  return `${k === 1 ? 'ein' : under1000(k)}tausend${rest ? under1000(rest) : ''}`;
}

const WORD_VALUE = new Map<string, number>();
for (let i = 0; i < 20; i++) WORD_VALUE.set(UNITS[i]!, i);
for (let i = 2; i < 10; i++) WORD_VALUE.set(TENS[i]!, i * 10);
WORD_VALUE.set('ein', 1);

/** One number word to its value (einundzwanzig → 21, zweihundertfünfzig → 250), or null. Articles (ein, eine) alone are not numbers. */
export function parseGermanNumberWord(word: string): number | null {
  const w = word.toLowerCase().replace(/ss/g, 'ß');
  const parse = (s: string): number | null => {
    if (!s) return 0;
    const th = s.indexOf('tausend');
    if (th >= 0) {
      const left = th === 0 ? 1 : parse(s.slice(0, th));
      const right = parse(s.slice(th + 7));
      return left === null || right === null ? null : left * 1000 + right;
    }
    const hu = s.indexOf('hundert');
    if (hu >= 0) {
      const left = hu === 0 ? 1 : WORD_VALUE.get(s.slice(0, hu));
      const right = parse(s.slice(hu + 7));
      return left === undefined || left > 9 || right === null ? null : left * 100 + right;
    }
    const und = s.indexOf('und');
    if (und > 0) {
      const u = WORD_VALUE.get(s.slice(0, und));
      const t = WORD_VALUE.get(s.slice(und + 3));
      return u !== undefined && u < 10 && t !== undefined && t >= 20 && t % 10 === 0 ? t + u : null;
    }
    return WORD_VALUE.get(s) ?? null;
  };
  if (w === 'ein' || w === 'eine') return null;
  return parse(w);
}

/** an amount in digits: 2, 2,50, 2.50, 1.234 or 1.234,56 (a point before three digits groups thousands) */
const DIGITS = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[.,]\d{1,2})?$/;

/**
 * Every number in a German utterance, in order: digits (2, 2,50, 2.50) and words (zwei, einundzwanzig). A price said in words
 * counts as one number: 「zwei Euro fünfzig」 → 2.5, 「ein Euro fünfzig」 → 1.5, 「fünfzig Cent」 → 0.5. The text comes back as it was.
 */
export function parseGermanNumbers(text: string): { text: string; numbers: number[] } {
  const words = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/(\d)\s*€/g, '$1 euro')
    .split(/[^\p{L}\p{N},.]+/u)
    .map((w) => w.replace(/^[,.]+|[,.]+$/g, ''))
    .filter(Boolean);
  const numbers: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const next = words[i + 1];
    // an article before a price is one: 「ein Euro fünfzig」, 「einen Euro zurück」
    const article = next === 'euro' && /^ein(?:e|en|em)?$/.test(w) ? 1 : null;
    const v = article ?? (DIGITS.test(w) ? Number(w.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.')) : parseGermanNumberWord(w));
    if (v === null || Number.isNaN(v)) continue;
    if (next === 'cent') {
      numbers.push(v / 100);
      i++;
      continue;
    }
    if (next === 'euro') {
      const c = words[i + 2];
      const cents = c === undefined ? null : /^\d{1,2}$/.test(c) ? Number(c) : parseGermanNumberWord(c);
      if (cents !== null && cents < 100) {
        numbers.push(Math.round(v * 100 + cents) / 100);
        i += 2;
        continue;
      }
      i++;
    }
    numbers.push(v);
  }
  return { text, numbers };
}

/** A price in cents as Germans write and say it: 250 → 2,50 € / zwei Euro fünfzig; 300 → 3,00 € / drei Euro; 50 → 0,50 € / fünfzig Cent. */
export function euroText(cents: number): { written: string; words: string; en: string; ar: string } {
  if (!Number.isInteger(cents) || cents < 0 || cents > 99_999_999) throw new RangeError(`euroText: ${cents} cents`);
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  const grouped = String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const written = `${grouped},${String(c).padStart(2, '0')} €`;
  const words = e === 0 ? `${under100(c)} Cent` : `${e === 1 ? 'ein' : germanNumber(e)} Euro${c ? ` ${under100(c)}` : ''}`;
  const plain = `${e.toLocaleString('en-US')}.${String(c).padStart(2, '0')}`;
  return { written, words, en: `€${plain}`, ar: `${plain} يورو` };
}

// ---------- a name, a country ----------

/** words that follow 「ich bin」 without being a name: ich bin müde, ich bin hier, ich bin Student */
const NOT_A_NAME = new Set([
  'auch', 'aus', 'da', 'dran', 'fertig', 'gut', 'hier', 'hungrig', 'krank', 'mude', 'müde', 'neu', 'nicht', 'noch', 'okay', 'ok', 'schon', 'so',
  'student', 'studentin', 'sehr', 'ein', 'eine', 'der', 'die', 'das', 'ja', 'nein', 'zu', 'bei', 'in', 'im', 'am', 'heute', 'jetzt',
]);

/** Pulls a name out of 「Ich heiße Sam」, 「Ich bin Sam」, 「Mein Name ist Sam」, 「Ich bin die Sam」 or a bare 「Sam.」 (the answer to 「Wie heißen Sie?」). */
export function captureGermanName(text: string): string | null {
  const t = text.normalize('NFKC').trim().replace(/^(?:hallo|hi|guten (?:tag|morgen|abend)|ja|also)[,!.\s]+/i, '');
  const m =
    /(?:ich hei(?:ß|ss)e|mein name ist|ich bin(?: (?:die|der))?|ich nenne mich|man nennt mich)\s+([\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]*)?)/iu.exec(t) ??
    /^([\p{Lu}][\p{L}'-]*)[.!]?$/u.exec(t);
  if (!m) return null;
  const name = m[1]!.trim();
  if (!name || name.length > 24 || NOT_A_NAME.has(name.toLowerCase())) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Pulls a country out of 「Ich komme aus Ägypten」 or 「Ich bin aus Japan」. */
export function captureGermanCountry(text: string): string | null {
  const m = /\b(?:komme|bin|stamme)\s+aus\s+(?:der\s+|dem\s+|den\s+)?([\p{L}-]+(?:\s+[\p{Lu}][\p{L}-]*)?)/iu.exec(text.normalize('NFKC'));
  if (!m) return null;
  const v = m[1]!;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/** German letters a learner of English or Arabic would not type by chance */
export const hasGermanLetters = (s: string): boolean => /[äöüßÄÖÜ]/.test(s);
