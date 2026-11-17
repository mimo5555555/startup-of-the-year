import { hasArabic, romajiAsKana } from '@lw/core';
import type { L1 } from '@lw/content';
import { targetLanguage, type TargetLanguage } from './matching';
import { translatePhrase, type TranslationResult } from './translator';

export type InputKind =
  | { kind: 'ja'; text: string }
  | { kind: 'romaji'; text: string; kana: string }
  | { kind: 'l1'; lang: L1; text: string; translation: TranslationResult | null };

/**
 * Decide what the learner typed or said. Japanese script goes straight to the conversation;
 * a bare number (60000, 450円) is Japanese too, so it reaches `say_total` instead of the translator;
 * Arabic and English are treated as "say it your way" and translated; clean romaji is converted to kana.
 */
export function classifyInput(text: string, lang: TargetLanguage = targetLanguage()): InputKind {
  const t = text.trim();
  // kind 'ja' is "the target language" (the name is older than the second language)
  if (lang.isTarget(t)) return { kind: 'ja', text: t };
  // the "say it your way" translator holds Japanese phrases only: another language is not translated (yet)
  if (lang.id !== 'ja') return { kind: 'l1', lang: hasArabic(t) ? 'ar' : 'en', text: t, translation: null };
  if (hasArabic(t)) return { kind: 'l1', lang: 'ar', text: t, translation: translatePhrase(t, 'ar') };
  const en = translatePhrase(t, 'en');
  if (en && en.confidence >= 0.6) return { kind: 'l1', lang: 'en', text: t, translation: en };
  const kana = romajiAsKana(t);
  if (kana) return { kind: 'romaji', text: t, kana };
  return { kind: 'l1', lang: 'en', text: t, translation: en };
}
