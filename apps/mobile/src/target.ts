// The language being learned (German step 3): Japanese in Tokyo (the default) or German in Berlin. It is read once, before any store
// loads, from `lw.target`; changing it saves the choice and reloads the app, so every module sees one language for the whole run.
// Each language keeps its own saves (profile, notebook, game), so switching never touches the other one's progress.
//
// The app reads the content registries through here instead of `@lw/content` directly: the dictionary, the scenarios, the characters,
// the slots and the shop signs of the language being learned, and the free-text splitter that suits it.
import {
  BERLIN_CHARACTERS,
  BERLIN_SCENARIOS,
  BERLIN_SIGNS,
  CHARACTERS as JA_CHARACTERS,
  DE_LEXICON,
  DE_SLOTS,
  LEXICON as JA_LEXICON,
  SCENARIOS as JA_SCENARIOS,
  SIGNS as JA_SIGNS,
  SLOTS as JA_SLOTS,
  segmentFree as jaSegmentFree,
  segmentWords,
  type Character,
  type Lexicon,
  type Scenario,
  type SlotOption,
  type Token,
} from '@lw/content';
import { DE, JA, setTargetLanguage, type TargetLanguage } from '@lw/engine';

export type Target = 'ja' | 'de';
export const TARGET_KEY = 'lw.target';
/** the UI language picked during onboarding, carried over the reload into the other language's first run */
export const PENDING_UI_KEY = 'lw.target.ui';

function readTarget(): Target {
  try {
    return globalThis.localStorage?.getItem(TARGET_KEY) === 'de' ? 'de' : 'ja';
  } catch {
    return 'ja';
  }
}

export const TARGET: Target = readTarget();
export const IS_GERMAN = TARGET === 'de';
/** the engine's view of the language: matching, numbers, reactions */
export const TL: TargetLanguage = IS_GERMAN ? DE : JA;
setTargetLanguage(TL);

/** BCP-47 of the language being learned (speech recognition and the browser voice) */
export const TARGET_LOCALE: 'ja-JP' | 'de-DE' = IS_GERMAN ? 'de-DE' : 'ja-JP';
/** prefix of the main store (profile, notebook, settings): Japanese keeps the one it always had */
export const STORE_PREFIX = IS_GERMAN ? 'lw.de.v1.' : 'lw.v1.';

export const LEXICON: Lexicon = IS_GERMAN ? DE_LEXICON : JA_LEXICON;
export const SCENARIOS: Scenario[] = IS_GERMAN ? BERLIN_SCENARIOS : JA_SCENARIOS;
export const CHARACTERS: Character[] = IS_GERMAN ? BERLIN_CHARACTERS : JA_CHARACTERS;
export const SLOTS: Record<string, SlotOption[]> = IS_GERMAN ? DE_SLOTS : JA_SLOTS;
/** things to tap and read on the street: Tokyo's signs, Berlin's signs and things */
export const SIGNS: typeof JA_SIGNS = IS_GERMAN ? BERLIN_SIGNS : JA_SIGNS;
export const scenarioById = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id);

/** Free text into tokens: Japanese by the dictionary's longest match, German word by word. */
export const segmentFree = (text: string, lex: Lexicon = LEXICON, maxLen?: number): Token[] => (IS_GERMAN ? segmentWords(text, lex) : jaSegmentFree(text, lex, maxLen));

/** Saves the choice and restarts the app in that language (its own saves load). */
export function chooseTarget(t: Target, uiLang?: string): void {
  if (t === TARGET) return;
  try {
    globalThis.localStorage?.setItem(TARGET_KEY, t);
    if (uiLang) globalThis.localStorage?.setItem(PENDING_UI_KEY, uiLang);
  } catch {
    /* private mode: the choice lasts for this run only */
  }
  globalThis.location?.reload();
}

/** the UI language carried over from the other language's onboarding, once */
export function takePendingUiLang(): string | null {
  try {
    const v = globalThis.localStorage?.getItem(PENDING_UI_KEY) ?? null;
    if (v) globalThis.localStorage?.removeItem(PENDING_UI_KEY);
    return v;
  } catch {
    return null;
  }
}
