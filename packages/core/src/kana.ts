// Japanese script helpers: kana <-> romaji (modified Hepburn), normalisation for matching.

const HIRA_START = 0x3041;
const HIRA_END = 0x3096;
const KATA_START = 0x30a1;
const KATA_END = 0x30f6;

export function toHiragana(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    out += c >= KATA_START && c <= KATA_END ? String.fromCodePoint(c - 0x60) : ch;
  }
  return out;
}

export function toKatakana(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    out += c >= HIRA_START && c <= HIRA_END ? String.fromCodePoint(c + 0x60) : ch;
  }
  return out;
}

export const hasKanji = (s: string) => /[一-鿿㐀-䶿々〆]/.test(s);
export const hasKana = (s: string) => /[ぁ-ゖァ-ヺー]/.test(s);
export const hasJapanese = (s: string) => hasKanji(s) || hasKana(s);
export const hasArabic = (s: string) => /[؀-ۿݐ-ݿ]/.test(s);
export const hasLatin = (s: string) => /[a-z]/i.test(s);

const BASE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
};

const DIGRAPH: Record<string, string> = {
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  // loan-word combinations
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  ちぇ: 'che', しぇ: 'she', じぇ: 'je',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
};

const MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

/** Hiragana/katakana -> Hepburn romaji with macrons. Non-kana characters pass through. */
export function kanaToRomaji(input: string): string {
  const s = toHiragana(input);
  const chars = Array.from(s);
  let out = '';
  let doubleNext = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const pair = ch + (chars[i + 1] ?? '');
    let rom: string | undefined;
    if (ch === 'っ') {
      doubleNext = true;
      continue;
    }
    if (ch === 'ー') {
      const m = out.match(/[aiueo]$/);
      if (m) out = out.slice(0, -1) + MACRON[m[0]];
      continue;
    }
    if (DIGRAPH[pair]) {
      rom = DIGRAPH[pair];
      i++;
    } else if (BASE[ch]) {
      rom = BASE[ch];
    }
    if (rom === undefined) {
      out += ch;
      doubleNext = false;
      continue;
    }
    if (ch === 'ん' && /^[aiueoy]/.test(romOf(chars[i + 1]))) rom = "n'";
    if (doubleNext) {
      rom = rom.startsWith('ch') ? 't' + rom : rom[0] + rom;
      doubleNext = false;
    }
    out += rom;
  }
  return lengthen(out);
}

function romOf(ch: string | undefined): string {
  if (!ch) return '';
  return BASE[ch] ?? '';
}

/** Standard Hepburn lengthening within a word: ou/oo -> ō, uu -> ū, aa -> ā, ee -> ē. */
function lengthen(r: string): string {
  return r
    .replace(/ou/g, 'ō')
    .replace(/oo/g, 'ō')
    .replace(/uu/g, 'ū')
    .replace(/aa/g, 'ā')
    .replace(/ee/g, 'ē');
}

// ---- romaji -> hiragana (accepts Hepburn and Kunrei spellings, macrons) ----

const R2K: Array<[string, string]> = [
  // longest first
  ['kya', 'きゃ'], ['kyu', 'きゅ'], ['kyo', 'きょ'], ['sha', 'しゃ'], ['shu', 'しゅ'], ['sho', 'しょ'],
  ['sya', 'しゃ'], ['syu', 'しゅ'], ['syo', 'しょ'],
  ['cha', 'ちゃ'], ['chu', 'ちゅ'], ['cho', 'ちょ'], ['tya', 'ちゃ'], ['tyu', 'ちゅ'], ['tyo', 'ちょ'],
  ['nya', 'にゃ'], ['nyu', 'にゅ'], ['nyo', 'にょ'], ['hya', 'ひゃ'], ['hyu', 'ひゅ'], ['hyo', 'ひょ'],
  ['mya', 'みゃ'], ['myu', 'みゅ'], ['myo', 'みょ'], ['rya', 'りゃ'], ['ryu', 'りゅ'], ['ryo', 'りょ'],
  ['gya', 'ぎゃ'], ['gyu', 'ぎゅ'], ['gyo', 'ぎょ'], ['bya', 'びゃ'], ['byu', 'びゅ'], ['byo', 'びょ'],
  ['pya', 'ぴゃ'], ['pyu', 'ぴゅ'], ['pyo', 'ぴょ'],
  ['jya', 'じゃ'], ['jyu', 'じゅ'], ['jyo', 'じょ'], ['zya', 'じゃ'], ['zyu', 'じゅ'], ['zyo', 'じょ'],
  ['ja', 'じゃ'], ['ju', 'じゅ'], ['jo', 'じょ'],
  ['tsu', 'つ'], ['shi', 'し'], ['chi', 'ち'], ['fu', 'ふ'], ['ji', 'じ'],
  ['si', 'し'], ['ti', 'ち'], ['tu', 'つ'], ['hu', 'ふ'], ['zi', 'じ'],
  ['ka', 'か'], ['ki', 'き'], ['ku', 'く'], ['ke', 'け'], ['ko', 'こ'],
  ['sa', 'さ'], ['su', 'す'], ['se', 'せ'], ['so', 'そ'],
  ['ta', 'た'], ['te', 'て'], ['to', 'と'],
  ['na', 'な'], ['ni', 'に'], ['nu', 'ぬ'], ['ne', 'ね'], ['no', 'の'],
  ['ha', 'は'], ['hi', 'ひ'], ['he', 'へ'], ['ho', 'ほ'],
  ['ma', 'ま'], ['mi', 'み'], ['mu', 'む'], ['me', 'め'], ['mo', 'も'],
  ['ya', 'や'], ['yu', 'ゆ'], ['yo', 'よ'],
  ['ra', 'ら'], ['ri', 'り'], ['ru', 'る'], ['re', 'れ'], ['ro', 'ろ'],
  ['wa', 'わ'], ['wo', 'を'],
  ['ga', 'が'], ['gi', 'ぎ'], ['gu', 'ぐ'], ['ge', 'げ'], ['go', 'ご'],
  ['za', 'ざ'], ['zu', 'ず'], ['ze', 'ぜ'], ['zo', 'ぞ'],
  ['da', 'だ'], ['di', 'ぢ'], ['du', 'づ'], ['de', 'で'], ['do', 'ど'],
  ['ba', 'ば'], ['bi', 'び'], ['bu', 'ぶ'], ['be', 'べ'], ['bo', 'ぼ'],
  ['pa', 'ぱ'], ['pi', 'ぴ'], ['pu', 'ぷ'], ['pe', 'ぺ'], ['po', 'ぽ'],
  ['fa', 'ふぁ'], ['fi', 'ふぃ'], ['fe', 'ふぇ'], ['fo', 'ふぉ'],
  ['a', 'あ'], ['i', 'い'], ['u', 'う'], ['e', 'え'], ['o', 'お'],
];

const MACRON_BACK: Record<string, string> = { ā: 'aa', ī: 'ii', ū: 'uu', ē: 'ee', ō: 'ou' };

/** Romaji -> hiragana. `ok` is false when some letters could not be parsed as Japanese sounds. */
export function romajiToHiragana(input: string): { kana: string; ok: boolean } {
  let s = input.toLowerCase().normalize('NFC').replace(/[āīūēō]/g, (m) => MACRON_BACK[m]);
  s = s.replace(/[\s'’-]+/g, (m) => (m.includes("'") ? "'" : ' '));
  let out = '';
  let ok = true;
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    if (rest[0] === ' ') {
      i++;
      continue;
    }
    if (rest[0] === "'") {
      i++;
      continue;
    }
    // sokuon: doubled consonant (not n)
    if (/^([bcdfghjklmpqrstvwxyz])\1/.test(rest) && rest[0] !== 'n') {
      out += 'っ';
      i++;
      continue;
    }
    if (rest.startsWith('tch')) {
      out += 'っ';
      i++;
      continue;
    }
    if (rest[0] === 'n') {
      if (rest[1] === 'n' && !/^nn[aiueoy]/.test(rest)) {
        out += 'ん';
        i += 2;
        continue;
      }
      if (!/^n[aiueoy]/.test(rest)) {
        out += 'ん';
        i++;
        continue;
      }
    }
    const hit = R2K.find(([r]) => rest.startsWith(r));
    if (hit) {
      out += hit[1];
      i += hit[0].length;
      continue;
    }
    ok = false;
    out += rest[0];
    i++;
  }
  return { kana: out, ok: ok && /[ぁ-ゖ]/.test(out) };
}

const STRIP = /[\s、。！？!?.,，・「」『』（）()[\]~〜…ー\-_"'’“”:;：；*]/g;

/** Aggressive normalisation for intent matching: script-insensitive, punctuation-free. */
export function normJa(text: string): string {
  return toHiragana(text.normalize('NFKC').toLowerCase()).replace(STRIP, '').replace(/を/g, 'お');
}

/** If the text looks like romaji (parses fully), return the hiragana reading, else null. */
export function romajiAsKana(text: string): string | null {
  if (hasJapanese(text) || hasArabic(text)) return null;
  const t = text.trim();
  if (!/^[a-zāīūēō'’\-\s]+$/i.test(t)) return null;
  const r = romajiToHiragana(t);
  return r.ok ? r.kana : null;
}
