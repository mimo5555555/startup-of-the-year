// App-side helpers over the content pack.
import {
  CHARACTERS,
  LEXICON,
  SCENARIOS,
  SIGNS,
  entryToToken,
  plainText,
  romajiText,
  tokenize,
  type Character,
  type Gloss,
  type LexEntry,
  type Line,
  type Scenario,
  type Token,
} from '@lw/content';
import type { UiLang } from './i18n';

export const NPC_ORDER = ['hanako', 'yuki', 'tanaka', 'sato', 'kenji', 'mio'];
export const TOTAL_SIGNS = SIGNS.length;

export const characterById = (id: string): Character | undefined => CHARACTERS.find((c) => c.id === id);
export const scenarioForCharacter = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.characterId === id);

export function displayName(c: Character, lang: UiLang): string {
  return lang === 'ar' ? c.name.ar : c.name.en;
}

/** Labels shown above characters in the 3D view. */
export function npcLabels(lang: UiLang): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of CHARACTERS) out[c.id] = `${c.name.ja}  ${displayName(c, lang)}`;
  return out;
}

export const meaningOf = (m: Partial<Gloss>, lang: UiLang) => m[lang] ?? m.en ?? m.ar ?? '';

export function entryForSign(signId: string): LexEntry | undefined {
  const sign = SIGNS.find((s) => s.id === signId);
  return sign ? LEXICON.get(sign.lex) : undefined;
}

export function tokenOf(e: LexEntry): Token {
  return entryToToken(e);
}

export interface Example {
  ja: string;
  en: string;
  ar: string;
}

let exampleIndex: Map<string, Example> | null = null;

function lineExample(line: Line): Example | null {
  if (line.ja.includes('{')) return null;
  const tokens = tokenize(line.ja, LEXICON).tokens;
  return { ja: plainText(tokens), en: line.en, ar: line.ar };
}

/** A real sentence from the conversations that contains this word, for cloze practice. */
export function exampleFor(surface: string): Example | null {
  if (!exampleIndex) {
    exampleIndex = new Map();
    const add = (line: Line) => {
      const ex = lineExample(line);
      if (!ex) return;
      for (const piece of line.ja.split('|')) {
        const core = piece.replace(/[。、！？!?,.「」]/g, '');
        if (core && !exampleIndex!.has(core) && ex.ja.length <= 24) exampleIndex!.set(core, ex);
      }
    };
    for (const sc of SCENARIOS) {
      for (const n of Object.values(sc.nodes)) {
        n.say.forEach((v) => add(v.line));
        (n.suggestions ?? []).forEach(add);
        n.intents.forEach((i) => i.reply && add(i.reply));
      }
    }
  }
  return exampleIndex.get(surface) ?? null;
}

export function lineTokens(markup: string): Token[] {
  return tokenize(markup, LEXICON).tokens;
}

export const romaji = romajiText;

export const SKINS = ['#fbe0cc', '#f3cdb0', '#d9a77d', '#a8744f'];
export const JACKETS = ['#4f86f7', '#ef6f91', '#2fb58b', '#f4a340', '#8c6bf0', '#2d3a56'];
export const HAIRS: Array<{ id: 'short' | 'bob' | 'ponytail' | 'bun'; color: string }> = [
  { id: 'short', color: '#3a2b2a' },
  { id: 'bob', color: '#5a3b2e' },
  { id: 'ponytail', color: '#2d2a4a' },
  { id: 'bun', color: '#8a5a3a' },
];
