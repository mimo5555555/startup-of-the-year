// Content schema. Everything a language pack contains is plain data described here.

export type L1 = 'en' | 'ar';
export type Cefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type Emotion = 'neutral' | 'happy' | 'surprised' | 'confused' | 'excited' | 'sad';

export interface Gloss {
  en: string;
  ar: string;
}

/** A dictionary entry. `r` (kana reading) is required when `s` contains kanji. */
export interface LexEntry {
  s: string;
  r?: string;
  /** romaji override for words whose spelling differs from their sound (は as "wa") */
  rom?: string;
  en: string;
  ar: string;
  /** grammar/function word: shown in lines but not offered for saving */
  g?: boolean;
}

/** One unit of display text after tokenising authored markup. */
export interface Token {
  s: string;
  r?: string;
  rom: string;
  gloss?: Gloss;
  grammar?: boolean;
  /** user-supplied text (a name) or ASCII text without a dictionary entry */
  raw?: boolean;
  punct?: boolean;
}

/** A line of text: `ja` is markup, tokens separated by `|` and resolved against the lexicon. */
export interface Line {
  ja: string;
  en: string;
  ar: string;
  /** spoken form when it differs from the written text */
  tts?: string;
}

export type Vars = Record<string, { ja: string; raw?: boolean; gloss?: Gloss }>;

export interface SlotOption {
  id: string;
  /** markup shown in Japanese lines */
  ja: string;
  gloss: Gloss;
  keys: { ja: string[]; en: string[]; ar: string[] };
}

export type HairStyle = 'short' | 'bob' | 'ponytail' | 'bun' | 'spiky' | 'long' | 'bald';
export type Accessory = 'apron' | 'glasses' | 'headband' | 'cap' | 'scarf' | 'backpack' | 'camera' | 'tie' | 'mask' | 'beanie' | 'helmet';

export interface AvatarSpec {
  skin: string;
  hair: { style: HairStyle; color: string };
  top: string;
  bottom: string;
  shoes: string;
  accent: string;
  accessories: Accessory[];
  /** body build/height multiplier (1 = average) */
  height?: number;
  stocky?: number;
}

export interface Character {
  id: string;
  name: { ja: string; reading: string; en: string; ar: string };
  age: number;
  job: Gloss;
  bio: Gloss;
  personality: Gloss;
  interests: string[]; // topic ids
  speaking: { rate: number; pitch: number; voice: 'f' | 'm' };
  avatar: AvatarSpec;
  locationId: string;
  scenarioId?: string;
  lessonId?: string;
}

export interface GoalStep {
  id: string;
  text: Gloss;
}

export interface Suggestion {
  ja: string;
  en: string;
  ar: string;
  tts?: string;
}

/** What an intent asks of the game's economy hooks (`SessionGameHooks.intent`, docs/GAME_DESIGN.md §6.2). */
export type IntentEcon = 'say_total' | 'ask_total' | 'haggle' | 'use_points' | 'ask_taxfree' | 'accept_delivery';

export interface IntentDef {
  id: string;
  /** every group must match: any alternative inside a group is enough */
  all?: string[][];
  /** at least one must match */
  any?: string[];
  /** none may match */
  none?: string[];
  slot?: string;
  /** extra slots filled opportunistically from the same utterance (「コーヒーをふたつ」 fills `item` and `qty`); they never block the turn */
  alsoSlots?: string[];
  /** limit which slot options count for this intent */
  slotOptions?: string[];
  slotRequired?: boolean;
  /** capture a spoken name, country etc. as raw text when no slot option matched */
  capture?: 'name' | 'country';
  next?: string;
  step?: string;
  /** answer without changing node */
  stay?: boolean;
  reply?: Line;
  /** a request that should sound polite (feeds naturalness feedback) */
  request?: boolean;
  /** a model answer for corrections */
  ideal?: Line;
  /** asks the game hook (`SessionGameHooks.intent`); `ok: false` routes to `nextIfNo` */
  econ?: IntentEcon;
  nextIfNo?: string;
  /** keeps what the learner said as a fact the friend remembers: the slot option id, the captured text or a literal */
  remember?: { fact: string; from: 'slot' | 'capture' | 'literal'; value?: string };
}

export interface SayVariant {
  line: Line;
  when?: { slot: string; in: string[] } | { flag: string };
}

export interface SceneNode {
  id: string;
  say: SayVariant[];
  emotion?: Emotion;
  suggestions?: Suggestion[];
  suggestionsByL1?: Partial<Record<L1, Suggestion[]>>;
  /** suggestions are replaced by ones built from the learner's topics when a hobby slot is open */
  topicSuggestions?: boolean;
  intents: IntentDef[];
  step?: string;
  end?: boolean;
  /** entering the node charges the learner (`SessionGameHooks.charge`); when the money is not there the engine enters `onShort` instead */
  econ?: 'charge';
  onShort?: string;
}

export interface Scenario {
  id: string;
  locationId: string;
  characterId: string;
  level: Cefr;
  title: Gloss;
  setup: Gloss;
  steps: GoalStep[];
  start: string;
  nodes: Record<string, SceneNode>;
  minutes: number;
}

export interface PhraseEntry {
  id: string;
  ja: string; // markup, may contain {slot} variables
  tts?: string;
  en: string[];
  ar: string[];
  slot?: string;
  /** slot values must come from the slot list (otherwise free text is accepted) */
  closedSlot?: boolean;
}

export interface LessonCard {
  ja: string;
  en: string;
  ar: string;
  note?: Gloss;
}

export interface Lesson {
  id: string;
  title: Gloss;
  intro: Gloss;
  cards: LessonCard[];
  sayCount: number;
}

export interface SignDef {
  id: string;
  lex: string; // lexicon surface
}

export interface Topic {
  id: string;
  name: Gloss;
  hobby?: string; // slot option id for hobby suggestions
  adult?: boolean;
}

export interface AgeGroup {
  id: 'kids' | 'teens' | 'adults' | 'seniors';
  name: Gloss;
  range: string;
}
