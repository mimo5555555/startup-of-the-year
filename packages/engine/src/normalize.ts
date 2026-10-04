// Text normalisation for English and Arabic input, used by the phrasebook translator.

const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\bi'm\b/g, 'i am'],
  [/\bi'd\b/g, 'i would'],
  [/\bi'll\b/g, 'i will'],
  [/\bi've\b/g, 'i have'],
  [/\bwhat's\b/g, 'what is'],
  [/\bwhere's\b/g, 'where is'],
  [/\bhow's\b/g, 'how is'],
  [/\bwho's\b/g, 'who is'],
  [/\bit's\b/g, 'it is'],
  [/\bthat's\b/g, 'that is'],
  [/\bthere's\b/g, 'there is'],
  [/\bhere's\b/g, 'here is'],
  [/\blet's\b/g, 'let us'],
  [/\bcan't\b/g, 'cannot'],
  [/\bwon't\b/g, 'will not'],
  [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'],
  [/\bdidn't\b/g, 'did not'],
  [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'],
  [/\bwasn't\b/g, 'was not'],
  [/\bcouldn't\b/g, 'could not'],
  [/\bwouldn't\b/g, 'would not'],
  [/\byou're\b/g, 'you are'],
  [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'],
  [/\bwanna\b/g, 'want to'],
  [/\bgonna\b/g, 'going to'],
];

const EN_ARTICLES = /\b(a|an|the|some)\b/g;

export function normEn(input: string): string {
  let s = input.toLowerCase().replace(/[’‘`]/g, "'");
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  s = s.replace(/\bwi[\s-]?fi\b/g, 'wifi').replace(/\be-?mail\b/g, 'email');
  s = s.replace(/[^a-z0-9\s{}]/g, ' ');
  s = s.replace(EN_ARTICLES, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

export function normAr(input: string): string {
  let s = input
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
  s = s.replace(/[^ء-يa-z0-9\s{}]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

export const norm = (s: string, lang: 'en' | 'ar') => (lang === 'en' ? normEn(s) : normAr(s));

const STOP: Record<'en' | 'ar', Set<string>> = {
  en: new Set(['please', 'kindly', 'just', 'um', 'uh', 'hmm', 'well', 'so', 'then', 'ok', 'okay', 'to']),
  ar: new Set(['فضلك', 'سمحت', 'لو', 'يا']),
};

export function contentWords(s: string, lang: 'en' | 'ar'): string[] {
  return s.split(' ').filter((w) => w && !STOP[lang].has(w));
}

export function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Strip quantity words so "a cup of coffee" finds "coffee". */
export function stripQuantity(v: string, lang: 'en' | 'ar'): string {
  if (lang === 'en') return v.replace(/^(one|1|two|2)\s+/, '').replace(/^(cup|cups|glass|bottle|bowl|piece|slice|bag|packet) of\s+/, '').trim();
  return v.replace(/^(كوب|فنجان|كأس|كاس|زجاجه|طبق|قطعه|شريحه)\s+/, '').trim();
}

export function stripAl(v: string): string {
  return v.replace(/^ال/, '');
}
