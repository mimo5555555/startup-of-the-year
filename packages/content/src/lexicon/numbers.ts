import type { LexEntry } from '../types';
import { w } from './helpers';

// Lexicon entries for Japanese numbers and prices (agent 1B): 一…九, 十, 百, 千, 万, 円 and the irregular compounds
// 三百 さんびゃく, 六百 ろっぴゃく, 八百 はっぴゃく, 三千 さんぜん, 八千 はっせん (docs/GAME_DESIGN.md §14.4), plus the price words
// 何円, 合計, お釣り, 税込. `yenToJa` (tokyo/game/jp-language.ts) emits only these surfaces, so a price tokenises, ruby-annotates and
// is read aloud like any other line. Keep surfaces unique across the whole lexicon (the content tests report clashes).

/** Plain numeral tokens: surface -> [reading, English, Arabic]. 四 is よん, 七 なな, 九 きゅう (the forms used with prices). */
const PLAIN: Array<[string, string, string, string]> = [
  ['一', 'いち', 'one', 'واحد'],
  ['二', 'に', 'two', 'اثنان'],
  ['三', 'さん', 'three', 'ثلاثة'],
  ['四', 'よん', 'four', 'أربعة'],
  ['五', 'ご', 'five', 'خمسة'],
  ['六', 'ろく', 'six', 'ستة'],
  ['七', 'なな', 'seven', 'سبعة'],
  ['八', 'はち', 'eight', 'ثمانية'],
  ['九', 'きゅう', 'nine', 'تسعة'],
  ['十', 'じゅう', 'ten', 'عشرة'],
  ['百', 'ひゃく', 'hundred', 'مئة'],
  ['千', 'せん', 'thousand', 'ألف'],
  ['万', 'まん', 'ten thousand', 'عشرة آلاف'],
  ['円', 'えん', 'yen', 'ين'],
];

/** Irregular compounds that are single tokens because their reading is not the sum of the parts (rendaku and sokuon). */
const IRREGULAR: Array<[string, string, string, string]> = [
  ['三百', 'さんびゃく', 'three hundred', 'ثلاثمئة'],
  ['六百', 'ろっぴゃく', 'six hundred', 'ستمئة'],
  ['八百', 'はっぴゃく', 'eight hundred', 'ثمانمئة'],
  ['三千', 'さんぜん', 'three thousand', 'ثلاثة آلاف'],
  ['八千', 'はっせん', 'eight thousand', 'ثمانية آلاف'],
];

/** Every numeral token and its reading: the one table `readNumber`, `yenToJa` and `speakableText` agree on. */
export const NUMBER_READINGS: Readonly<Record<string, string>> = Object.fromEntries([...PLAIN, ...IRREGULAR].map(([s, r]) => [s, r]));

/** Reads numeral tokens by their kana; a 四 right before 円 is よ (よえん, じゅうよえん), the one place a token's reading depends on its neighbour. */
export function readNumeralTokens(tokens: readonly string[]): string {
  return tokens.map((t, i) => (t === '四' && tokens[i + 1] === '円' ? 'よ' : NUMBER_READINGS[t] ?? t)).join('');
}

/** Characters a numeral token is made of; `speakableText` reads a token written only with these by its kana reading. */
export const NUMERAL_TOKEN = /^[一二三四五六七八九十百千万円]+$/;

export const NUMBERS_LEXICON: LexEntry[] = [
  ...PLAIN.map(([s, r, en, ar]) => w(s, r, en, ar)),
  ...IRREGULAR.map(([s, r, en, ar]) => w(s, r, en, ar)),
  w('何円', 'なんえん', 'how many yen', 'كم ين'),
  w('合計', 'ごうけい', 'total', 'المجموع'),
  w('お釣り', 'おつり', 'change (money back)', 'الباقي (الفكّة)'),
  w('税込', 'ぜいこみ', 'tax included', 'شامل الضريبة'),
];
