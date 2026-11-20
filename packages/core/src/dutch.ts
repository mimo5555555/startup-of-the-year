// Dutch text: the forms the engine matches on, numbers said and written, prices in euro, a name or a country given in a sentence.
// Pure functions; the dictionary lives in @lw/content (amsterdam/), the engine's `NL` target language puts them together.

/** sounds a learner says while thinking; never part of a request */
const FILLERS = new Set(['eh', 'ehm', 'uh', 'uhm', 'hm', 'hmm', 'ehh']);

/** Lower case, apostrophes dropped (auto's = autos, zo'n = zon), punctuation as spaces, fillers out, spaces collapsed; ĳ is ij. */
export function nlBase(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/ĳ/g, 'ij')
    .replace(/['’‘`´]/g, '')
    .replace(/[^\p{L}\p{N}\s,]+/gu, ' ')
    // a comma between digits is a decimal comma (2,50); any other is punctuation
    .replace(/(?<!\d),|,(?!\d)/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLERS.has(w))
    .join(' ');
}

/**
 * The two forms a Dutch key and a Dutch utterance are compared in. `loose`: the base form with accents folded (één = een, café = cafe,
 * tweeëntwintig = tweeentwintig); `folded`: also ij as y (a learner's 「lekker ys」 or 「blyf」), the same on both sides.
 */
export function nlMatchForms(text: string): { loose: string; folded: string } {
  const loose = nlBase(text).normalize('NFD').replace(/\p{M}/gu, '');
  const folded = loose.replace(/ij/g, 'y');
  return { loose, folded };
}

/** A key matches at the start of a word: 「een」 is in 「eentje」 but not in 「geen」 or 「alleen」. */
export const nlContains = (text: string, key: string): boolean => (' ' + text).includes(' ' + key);

/** The fold the dictionary check uses: a typed 「cafe」 or 「een」 is the word café, één. */
export const nlFoldWord = (word: string): string => nlMatchForms(word).folded;

// ---------- numbers ----------

const UNITS = ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien'];
const TENS = ['', '', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig', 'zeventig', 'tachtig', 'negentig'];

/** 「en」 between the unit and the tens, 「ën」 after a vowel it would run into (tweeëntwintig, drieëndertig) */
const joiner = (unit: string) => (/[ae]$/.test(unit) ? 'ën' : 'en');

function under100(n: number): string {
  if (n < 20) return n === 1 ? 'één' : UNITS[n]!;
  const u = n % 10;
  const t = TENS[Math.floor(n / 10)]!;
  return u ? `${UNITS[u]}${joiner(UNITS[u]!)}${t}` : t;
}

function under1000(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hundreds = h ? `${h === 1 ? '' : UNITS[h]}honderd` : '';
  return hundreds + (rest ? (h ? under100(rest).replace(/^één$/, 'een') : under100(rest)) : h ? '' : 'nul');
}

/** 0..999,999 in words, written as one word the way Dutch writes them: 21 → eenentwintig, 22 → tweeëntwintig, 1250 → twaalfhonderdvijftig is
 * also said, but written duizendtweehonderdvijftig here. */
export function dutchNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) throw new RangeError(`dutchNumber: ${n} is outside 0..999999`);
  if (n < 1000) return under1000(n);
  const k = Math.floor(n / 1000);
  const rest = n % 1000;
  return `${k === 1 ? '' : under1000(k)}duizend${rest ? under1000(rest).replace(/^één$/, 'een') : ''}`;
}

const WORD_VALUE = new Map<string, number>();
for (let i = 0; i < 20; i++) WORD_VALUE.set(UNITS[i]!, i);
for (let i = 2; i < 10; i++) WORD_VALUE.set(TENS[i]!, i * 10);

/** One number word to its value (eenentwintig → 21, tweehonderdvijftig → 250), or null. The article 「een」 alone is not a number; 「één」 is. */
export function parseDutchNumberWord(word: string): number | null {
  const raw = word.toLowerCase();
  if (raw === 'één' || raw === 'eén') return 1;
  const w = raw.normalize('NFD').replace(/\p{M}/gu, '');
  if (w === 'een') return null;
  const parse = (s: string): number | null => {
    if (!s) return 0;
    const th = s.indexOf('duizend');
    if (th >= 0) {
      const left = th === 0 ? 1 : parse(s.slice(0, th));
      const right = parse(s.slice(th + 7));
      return left === null || right === null ? null : left * 1000 + right;
    }
    const hu = s.indexOf('honderd');
    if (hu >= 0) {
      const left = hu === 0 ? 1 : WORD_VALUE.get(s.slice(0, hu));
      const right = parse(s.slice(hu + 7));
      return left === undefined || left > 19 || right === null ? null : left * 100 + right;
    }
    // unit + en (ën, folded) + tens: eenentwintig, tweeentwintig, negenennegentig
    for (let i = 2; i < s.length - 2; i++) {
      if (!s.startsWith('en', i)) continue;
      const u = WORD_VALUE.get(s.slice(0, i));
      const t = WORD_VALUE.get(s.slice(i + 2));
      if (u !== undefined && u > 0 && u < 10 && t !== undefined && t >= 20 && t % 10 === 0) return t + u;
    }
    return WORD_VALUE.get(s) ?? null;
  };
  return parse(w);
}

/**
 * Every number in a Dutch utterance, in order: digits (2, 2,50, 2.50) and words (twee, eenentwintig, één). A price said in words counts
 * as one number: 「twee euro vijftig」 → 2.5, 「vijftig cent」 → 0.5. The text comes back as it was.
 */
export function parseDutchNumbers(text: string): { text: string; numbers: number[] } {
  const words = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/€\s*(\d)/g, '$1 euro ')
    .replace(/(\d)\s*€/g, '$1 euro')
    .split(/[^\p{L}\p{N}\p{M},.]+/u)
    .map((w) => w.replace(/^[,.]+|[,.]+$/g, ''))
    .filter(Boolean);
  const numbers: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const v = /^\d+(?:[.,]\d{1,2})?$/.test(w) ? Number(w.replace(',', '.')) : parseDutchNumberWord(w);
    if (v === null || Number.isNaN(v)) continue;
    const next = words[i + 1];
    if (next === 'cent') {
      numbers.push(v / 100);
      i++;
      continue;
    }
    if (next === 'euro') {
      const c = words[i + 2];
      const cents = c === undefined ? null : /^\d{1,2}$/.test(c) ? Number(c) : parseDutchNumberWord(c);
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

/** A price in cents as the Dutch write and say it: 250 → € 2,50 / twee euro vijftig; 300 → € 3,00 / drie euro; 50 → € 0,50 / vijftig cent. */
export function euroTextNl(cents: number): { written: string; words: string; en: string; ar: string } {
  if (!Number.isInteger(cents) || cents < 0 || cents > 99_999_999) throw new RangeError(`euroTextNl: ${cents} cents`);
  const e = Math.floor(cents / 100);
  const c = cents % 100;
  const grouped = String(e).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const written = `€ ${grouped},${String(c).padStart(2, '0')}`;
  const words = e === 0 ? `${under100(c)} cent` : `${e === 1 ? 'één' : dutchNumber(e)} euro${c ? ` ${under100(c)}` : ''}`;
  const plain = `${e.toLocaleString('en-US')}.${String(c).padStart(2, '0')}`;
  return { written, words, en: `€${plain}`, ar: `${plain} يورو` };
}

// ---------- a name, a country ----------

/** words that follow 「ik ben」 without being a name: ik ben moe, ik ben hier, ik ben student */
const NOT_A_NAME = new Set([
  'ook', 'uit', 'er', 'klaar', 'goed', 'hier', 'moe', 'nieuw', 'niet', 'nog', 'al', 'zo', 'student', 'studente', 'heel', 'een', 'de', 'het',
  'ja', 'nee', 'te', 'bij', 'in', 'op', 'vandaag', 'nu', 'blij', 'ziek', 'jarig', 'thuis', 'okay', 'ok', 'oké',
]);

/** Pulls a name out of 「Ik heet Sam」, 「Ik ben Sam」, 「Mijn naam is Sam」 or a bare 「Sam.」 (the answer to 「Hoe heet je?」). */
export function captureDutchName(text: string): string | null {
  const t = text.normalize('NFKC').trim().replace(/^(?:hallo|hoi|hey|dag|goedemorgen|goedemiddag|goedenavond|ja|nou)[,!.\s]+/i, '');
  const m =
    /(?:ik heet|mijn naam is|ik ben|ze noemen me|noem me)\s+([\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]*)?)/iu.exec(t) ?? /^([\p{Lu}][\p{L}'-]*)[.!]?$/u.exec(t);
  if (!m) return null;
  const name = m[1]!.trim();
  if (!name || name.length > 24 || NOT_A_NAME.has(name.toLowerCase())) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Pulls a country out of 「Ik kom uit Egypte」 or 「Ik ben uit Japan」. */
export function captureDutchCountry(text: string): string | null {
  const m = /\b(?:kom|ben)\s+uit\s+(?:het\s+|de\s+)?([\p{L}-]+(?:\s+[\p{Lu}][\p{L}-]*)?)/iu.exec(text.normalize('NFKC'));
  if (!m) return null;
  const v = m[1]!;
  return v.charAt(0).toUpperCase() + v.slice(1);
}
