// The language being learned (German step 3, Dutch step 2): Japanese in Tokyo (the default), German in Berlin or Dutch in Amsterdam.
// It is read once, before any store loads, from `lw.target`; changing it saves the choice and reloads the app, so every module sees
// one language for the whole run. Each language keeps its own saves (profile, notebook, game), so switching never touches another's.
//
// The app reads the content registries through here instead of `@lw/content` directly: the dictionary, the scenarios, the characters,
// the slots and the street's signs of the language being learned, and the free-text splitter that suits it.
import {
  AMSTERDAM_CHARACTERS,
  AMSTERDAM_SCENARIOS,
  AMSTERDAM_SIGNS,
  BERLIN_CHARACTERS,
  BERLIN_SCENARIOS,
  BERLIN_SIGNS,
  CHARACTERS as JA_CHARACTERS,
  DE_LEXICON,
  DE_SLOTS,
  LEXICON as JA_LEXICON,
  NL_LEXICON,
  NL_SLOTS,
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
import { DE, JA, NL, setTargetLanguage, type TargetLanguage } from '@lw/engine';

export type Target = 'ja' | 'de' | 'nl';
/** the languages one can learn, in the pickers' order */
export const TARGETS: readonly Target[] = ['ja', 'de', 'nl'];
/** each language's name in itself, on the pickers and the microphone's switch */
export const TARGET_NAMES: Record<Target, string> = { ja: '日本語', de: 'Deutsch', nl: 'Nederlands' };
export const TARGET_KEY = 'lw.target';
/** the UI language picked during onboarding, carried over the reload into the other language's first run */
export const PENDING_UI_KEY = 'lw.target.ui';

function readTarget(): Target {
  try {
    const v = globalThis.localStorage?.getItem(TARGET_KEY);
    return v === 'de' || v === 'nl' ? v : 'ja';
  } catch {
    return 'ja';
  }
}

export const TARGET: Target = readTarget();
export const IS_JAPANESE = TARGET === 'ja';
export const IS_GERMAN = TARGET === 'de';
export const IS_DUTCH = TARGET === 'nl';

interface TargetSetup {
  /** the engine's view of the language: matching, numbers, reactions */
  tl: TargetLanguage;
  /** BCP-47 (speech recognition and the browser voice) */
  locale: 'ja-JP' | 'de-DE' | 'nl-NL';
  /** prefix of the main store (profile, notebook, settings): Japanese keeps the one it always had */
  storePrefix: string;
  /** where the recorded lines are (public/) */
  voiceBase: string;
  lexicon: Lexicon;
  scenarios: Scenario[];
  characters: Character[];
  slots: Record<string, SlotOption[]>;
  signs: typeof JA_SIGNS;
}

const SETUP: Record<Target, () => TargetSetup> = {
  ja: () => ({ tl: JA, locale: 'ja-JP', storePrefix: 'lw.v1.', voiceBase: 'voice/', lexicon: JA_LEXICON, scenarios: JA_SCENARIOS, characters: JA_CHARACTERS, slots: JA_SLOTS, signs: JA_SIGNS }),
  de: () => ({ tl: DE, locale: 'de-DE', storePrefix: 'lw.de.v1.', voiceBase: 'voice-de/', lexicon: DE_LEXICON, scenarios: BERLIN_SCENARIOS, characters: BERLIN_CHARACTERS, slots: DE_SLOTS, signs: BERLIN_SIGNS }),
  nl: () => ({ tl: NL, locale: 'nl-NL', storePrefix: 'lw.nl.v1.', voiceBase: 'voice-nl/', lexicon: NL_LEXICON, scenarios: AMSTERDAM_SCENARIOS, characters: AMSTERDAM_CHARACTERS, slots: NL_SLOTS, signs: AMSTERDAM_SIGNS }),
};
const S = SETUP[TARGET]();

export const TL: TargetLanguage = S.tl;
setTargetLanguage(TL);

export const TARGET_LOCALE = S.locale;
/** the `lang` attribute of a line in the language being learned */
export const TARGET_HTML_LANG: Target = TARGET;
export const STORE_PREFIX = S.storePrefix;
export const VOICE_BASE = S.voiceBase;
export const TARGET_OWN_NAME = TARGET_NAMES[TARGET];

export const LEXICON: Lexicon = S.lexicon;
export const SCENARIOS: Scenario[] = S.scenarios;
export const CHARACTERS: Character[] = S.characters;
export const SLOTS: Record<string, SlotOption[]> = S.slots;
/** things to tap and read on the street: Tokyo's signs, Berlin's or Amsterdam's signs and things */
export const SIGNS: typeof JA_SIGNS = S.signs;
export const scenarioById = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id);

/** Free text into tokens: Japanese by the dictionary's longest match, German and Dutch word by word. */
export const segmentFree = (text: string, lex: Lexicon = LEXICON, maxLen?: number): Token[] => (IS_JAPANESE ? jaSegmentFree(text, lex, maxLen) : segmentWords(text, lex));

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
