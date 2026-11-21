// Every static Dutch line the app can speak in Amsterdam, with the voice that speaks it (tools/voice/generate-piper.mjs nl records them).
// Built from the content's own data, the way lines-de.ts builds Berlin's: the canal's conversations, the reactions, the story beats, the
// friends' facts, the culture phrases, the notebook's starters and every dictionary word. A line with slot variables is recorded once per
// option; a sentence with any other runtime variable ({name}, a price) is left to the device voice, its other sentences recorded.
import { AMSTERDAM_PACK, AMSTERDAM_SCENARIOS, NL_GIVE_GIFT, NL_LEXICON, NL_REACTIONS, NL_SLOTS, NL_SMALLTALK_FRIENDS, resolveLine, type Line, type Scenario, type Vars } from '@lw/content';
import { euroTextNl } from '@lw/core';
import { NARRATOR } from '../../apps/mobile/src/voice/voices';
import { NL_VOICES } from '../../apps/mobile/src/voice/voices-nl';
import { splitSentences } from '../../apps/mobile/src/voice/key';

export interface VoiceLineNl {
  voice: string;
  /** the text as the app speaks it (the manifest key) */
  text: string;
  /** what Piper reads: prices in words (「€ 2,50」 is 「twee euro vijftig」), letters spelled where they are letters (「GVB」 is 「G V B」) */
  say: string;
}

const out: VoiceLineNl[] = [];
const seen = new Set<string>();

/** Piper's reading of a line: prices said as the Dutch say them, letters spelled where they are letters */
export function readingNl(text: string): string {
  return text
    .replace(/€\s?(\d+),(\d\d)/g, (_, e: string, c: string) => euroTextNl(Number(e) * 100 + Number(c)).words)
    .replace(/\bGVB\b/g, 'G V B')
    .replace(/\bPIN\b/g, 'pin');
}

function add(voice: string, text: string) {
  const t = text.trim();
  if (!t || /[{}…]/.test(t) || !/\p{L}/u.test(t)) return;
  const k = `${voice}|${t}`;
  if (seen.has(k)) return;
  seen.add(k);
  out.push({ voice, text: t, say: readingNl(t) });
}

/** the written form of a line, as the dialogue resolves it */
const written = (l: Line, vars: Vars = {}) => resolveLine(l, NL_LEXICON, vars).written;

function addLine(voice: string, l: Line) {
  const vars = [...new Set([...l.ja.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))];
  if (!vars.length) return add(voice, written(l));
  // slot variables: one recording per option
  if (vars.every((k) => NL_SLOTS[k]?.length)) {
    const combos = vars.reduce<Vars[]>((acc, k) => acc.flatMap((v) => NL_SLOTS[k]!.map((o) => ({ ...v, [k]: { ja: o.ja, gloss: o.gloss } }))), [{}]);
    if (combos.length <= 40) for (const v of combos) add(voice, written(l, v));
    return;
  }
  // a name or a price: the sentences without one are recorded (the player plays such a line sentence by sentence)
  for (const s of splitSentences(l.ja)) if (!/[{}]/.test(s)) add(voice, written({ ...l, ja: s }));
}

function addScenario(s: Scenario) {
  const who = NL_VOICES[s.characterId] ? s.characterId : NARRATOR;
  for (const node of Object.values(s.nodes)) {
    for (const v of node.say) addLine(who, v.line);
    for (const sg of node.suggestions ?? []) addLine(NARRATOR, sg);
    for (const it of node.intents) {
      if (it.reply) addLine(who, it.reply);
      if (it.ideal) addLine(NARRATOR, it.ideal);
    }
  }
  for (const r of Object.values(NL_REACTIONS) as Line[]) addLine(who, r);
}

/** the notebook's first five (apps/mobile/src/store.ts NL_STARTERS) */
export const NL_STARTER_LINES = ['Hallo!', 'Goedemorgen!', 'Graag.', 'Dank u wel!', 'Doei!'];

export function voiceLinesNl(): VoiceLineNl[] {
  out.length = 0;
  seen.clear();
  for (const s of AMSTERDAM_SCENARIOS) addScenario(s);
  // the hand-over of a present is one conversation each friend speaks in their own voice
  for (const f of NL_SMALLTALK_FRIENDS) addScenario({ ...NL_GIVE_GIFT, characterId: f });
  for (const b of Object.values(AMSTERDAM_PACK.beats)) for (const l of b.lines) addLine(NL_VOICES[l.who] ? l.who : NARRATOR, l.line);
  for (const f of AMSTERDAM_PACK.friends) for (const l of Object.values(f.factLines ?? {})) addLine(NL_VOICES[f.id] ? f.id : NARRATOR, l);
  for (const c of AMSTERDAM_PACK.culture) addLine(NARRATOR, c.phrase);
  for (const s of NL_STARTER_LINES) add(NARRATOR, s);
  for (const e of NL_LEXICON.all()) add(NARRATOR, e.s);
  return out;
}
