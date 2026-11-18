// Every static German line the app can speak in Berlin, with the voice that speaks it (tools/voice/generate-de.mjs records them).
// Built from the content's own data: the street's conversations (with the regulars' greetings and the small talk), the reactions, the
// story beats, the friends' facts, the culture phrases and every dictionary word. A line with slot variables ({floh}) is recorded once
// per option; a sentence with any other runtime variable ({name}, a price) is left to the device voice, its other sentences recorded.
import { BERLIN_PACK, BERLIN_SCENARIOS, DE_LEXICON, DE_REACTIONS, DE_SLOTS, resolveLine, type Line, type Scenario, type Vars } from '@lw/content';
import { euroText } from '@lw/core';
import { NARRATOR } from '../../apps/mobile/src/voice/voices';
import { DE_VOICES } from '../../apps/mobile/src/voice/voices-de';
import { splitSentences } from '../../apps/mobile/src/voice/key';

export interface VoiceLineDe {
  voice: string;
  /** the text as the app speaks it (the manifest key) */
  text: string;
  /** what Piper reads: prices in words (「2,60 €」 is 「zwei Euro sechzig」), fare zones spelled (「Berlin AB」 is 「Berlin A B」) */
  say: string;
}

const out: VoiceLineDe[] = [];
const seen = new Set<string>();

/** Piper's reading of a line: prices said as Germans say them, letters spelled where they are letters */
export function readingDe(text: string): string {
  return text
    .replace(/(\d+),(\d\d)\s*€/g, (_, e: string, c: string) => euroText(Number(e) * 100 + Number(c)).words)
    .replace(/\bAB\b/g, 'A B')
    .replace(/\bWG\b/g, 'W G')
    .replace(/\bBVG\b/g, 'B V G');
}

function add(voice: string, text: string) {
  const t = text.trim();
  if (!t || /[{}…]/.test(t) || !/\p{L}/u.test(t)) return;
  const k = `${voice}|${t}`;
  if (seen.has(k)) return;
  seen.add(k);
  out.push({ voice, text: t, say: readingDe(t) });
}

/** the written form of a line, as the dialogue resolves it */
const written = (l: Line, vars: Vars = {}) => resolveLine(l, DE_LEXICON, vars).written;

function addLine(voice: string, l: Line) {
  const vars = [...new Set([...l.ja.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))];
  if (!vars.length) return add(voice, written(l));
  // slot variables: one recording per option
  if (vars.every((k) => DE_SLOTS[k]?.length)) {
    const combos = vars.reduce<Vars[]>((acc, k) => acc.flatMap((v) => DE_SLOTS[k]!.map((o) => ({ ...v, [k]: { ja: o.ja, gloss: o.gloss } }))), [{}]);
    if (combos.length <= 40) for (const v of combos) add(voice, written(l, v));
    return;
  }
  // a name or a price: the sentences without one are recorded (the player plays such a line sentence by sentence)
  for (const s of splitSentences(l.ja)) if (!/[{}]/.test(s)) add(voice, written({ ...l, ja: s }));
}

function addScenario(s: Scenario) {
  const who = DE_VOICES[s.characterId] ? s.characterId : NARRATOR;
  for (const node of Object.values(s.nodes)) {
    for (const v of node.say) addLine(who, v.line);
    for (const sg of node.suggestions ?? []) addLine(NARRATOR, sg);
    for (const it of node.intents) {
      if (it.reply) addLine(who, it.reply);
      if (it.ideal) addLine(NARRATOR, it.ideal);
    }
  }
  for (const r of Object.values(DE_REACTIONS) as Line[]) addLine(who, r);
}

export function voiceLinesDe(): VoiceLineDe[] {
  out.length = 0;
  seen.clear();
  for (const s of BERLIN_SCENARIOS) addScenario(s);
  for (const b of Object.values(BERLIN_PACK.beats)) for (const l of b.lines) addLine(DE_VOICES[l.who] ? l.who : NARRATOR, l.line);
  for (const f of BERLIN_PACK.friends) for (const l of Object.values(f.factLines ?? {})) addLine(DE_VOICES[f.id] ? f.id : NARRATOR, l);
  for (const c of BERLIN_PACK.culture) addLine(NARRATOR, c.phrase);
  // the notebook's starters and every word (the word sheet and the review cards say a word by its surface)
  for (const s of ['Hallo!', 'Guten Morgen!', 'Bitte.', 'Danke!', 'Tschüss!']) add(NARRATOR, s);
  for (const e of DE_LEXICON.all()) add(NARRATOR, e.s);
  return out;
}
