import { hasArabic, hasJapanese, romajiAsKana } from '@lw/core';
import type { L1 } from '@lw/content';
import { translatePhrase, type TranslationResult } from './translator';

export type InputKind =
  | { kind: 'ja'; text: string }
  | { kind: 'romaji'; text: string; kana: string }
  | { kind: 'l1'; lang: L1; text: string; translation: TranslationResult | null };

/** Only digits (any width, with separators), optionally with ¥ in front or 円 / えん behind: a price or a quantity said as a number (§6.2). */
const NUMERIC = /^[¥￥]?\s*[0-9０-９][0-9０-９,，]*\s*(?:円|えん)?$/;

/**
 * Decide what the learner typed or said. Japanese script goes straight to the conversation;
 * a bare number (60000, 450円) is Japanese too, so it reaches `say_total` instead of the translator;
 * Arabic and English are treated as "say it your way" and translated; clean romaji is converted to kana.
 */
export function classifyInput(text: string): InputKind {
  const t = text.trim();
  if (hasJapanese(t) || NUMERIC.test(t)) return { kind: 'ja', text: t };
  if (hasArabic(t)) return { kind: 'l1', lang: 'ar', text: t, translation: translatePhrase(t, 'ar') };
  const en = translatePhrase(t, 'en');
  if (en && en.confidence >= 0.6) return { kind: 'l1', lang: 'en', text: t, translation: en };
  const kana = romajiAsKana(t);
  if (kana) return { kind: 'romaji', text: t, kana };
  return { kind: 'l1', lang: 'en', text: t, translation: en };
}
