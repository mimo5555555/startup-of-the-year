// Every static Spanish line the app can speak in Madrid, with the voice that speaks it (tools/voice/generate-piper.mjs es records them).
// Built from the content's own data, the way lines-de.ts and lines-nl.ts build theirs: the street's conversations (with the regulars' small
// talk, the friends' chats and the hand-over of a present in each friend's voice), the reactions, the story beats, the friends' facts, the
// culture phrases, the notebook's starters and every dictionary word. A line with slot variables is recorded once per option; a sentence
// with any other runtime variable ({name}, a price) is left to the device voice, its other sentences recorded.
import { ES_GIVE_GIFT, ES_LEXICON, ES_REACTIONS, ES_SHIFT_TALK, ES_SLOTS, ES_SMALLTALK_FRIENDS, MADRID_PACK, MADRID_SCENARIOS, customerVoice, resolveLine, type Line, type Scenario, type ShiftTalk, type Vars } from '@lw/content';
import type { GamePack } from '@lw/game';
import { euroTextEs } from '@lw/core';
import { NARRATOR } from '../../apps/mobile/src/voice/voices';
import { ES_VOICES } from '../../apps/mobile/src/voice/voices-es';
import { splitSentences } from '../../apps/mobile/src/voice/key';

export interface VoiceLineEs {
  voice: string;
  /** the text as the app speaks it (the manifest key) */
  text: string;
  /** what Piper reads: prices in words (「2,50 €」 is 「dos euros con cincuenta」) */
  say: string;
}

const out: VoiceLineEs[] = [];
const seen = new Set<string>();

/** Piper's reading of a line: prices said as Madrid says them */
export function readingEs(text: string): string {
  return text.replace(/(\d+),(\d\d)\s*€/g, (_, e: string, c: string) => euroTextEs(Number(e) * 100 + Number(c)).words);
}

function add(voice: string, text: string) {
  const t = text.trim();
  if (!t || /[{}…]/.test(t) || !/\p{L}/u.test(t)) return;
  const k = `${voice}|${t}`;
  if (seen.has(k)) return;
  seen.add(k);
  out.push({ voice, text: t, say: readingEs(t) });
}

/** the written form of a line, as the dialogue resolves it */
const written = (l: Line, vars: Vars = {}) => resolveLine(l, ES_LEXICON, vars).written;

function addLine(voice: string, l: Line) {
  const vars = [...new Set([...l.ja.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))];
  if (!vars.length) return add(voice, written(l));
  // slot variables: one recording per option
  if (vars.every((k) => ES_SLOTS[k]?.length)) {
    const combos = vars.reduce<Vars[]>((acc, k) => acc.flatMap((v) => ES_SLOTS[k]!.map((o) => ({ ...v, [k]: { ja: o.ja, gloss: o.gloss } }))), [{}]);
    if (combos.length <= 40) for (const v of combos) add(voice, written(l, v));
    return;
  }
  // a name or a price: the sentences without one are recorded (the player plays such a line sentence by sentence)
  for (const s of splitSentences(l.ja)) if (!/[{}]/.test(s)) add(voice, written({ ...l, ja: s }));
}

function addScenario(s: Scenario) {
  const who = ES_VOICES[s.characterId] ? s.characterId : NARRATOR;
  for (const node of Object.values(s.nodes)) {
    for (const v of node.say) addLine(who, v.line);
    for (const sg of node.suggestions ?? []) addLine(NARRATOR, sg);
    for (const it of node.intents) {
      if (it.reply) addLine(who, it.reply);
      if (it.ideal) addLine(NARRATOR, it.ideal);
    }
  }
  for (const r of Object.values(ES_REACTIONS) as Line[]) addLine(who, r);
}

/** the notebook's first five (apps/mobile/src/store.ts ES_STARTERS) */
export const ES_STARTER_LINES = ['¡Hola!', '¡Buenos días!', 'Por favor.', '¡Gracias!', '¡Hasta luego!'];

/** The shifts behind a counter (a job, when Madrid has one): each customer in their voice, the staff's sentences in the narrator's. */
function addShifts(pack: GamePack, talk: ShiftTalk) {
  for (const job of pack.jobs) {
    const shops = new Set(pack.shops.filter((s) => s.placeId === job.place || s.id === job.place).map((s) => s.id));
    const price = (id: string): number => pack.menu.find((m) => m.id === id && shops.has(m.shop))?.price ?? 0;
    for (const a of job.archetypes) {
      addLine(customerVoice(talk.id, a.id), a.line);
      if (a.task.kind !== 'order') continue;
      const lines = a.task.items.map((i) => price(i.menu) * i.qty);
      const total = lines.reduce((s, x) => s + x, 0);
      const split = (a.task.toggles ?? []).includes('split') && lines.length > 1;
      for (const n of split ? [lines[0]!, total - lines[0]!] : [total]) add(NARRATOR, talk.total(n));
      if (a.change) add(NARRATOR, talk.change(a.change.paid - total));
      add(NARRATOR, a.thanks[0]!);
    }
  }
  if (pack.jobs.length) add(NARRATOR, talk.welcome);
}

export function voiceLinesEs(): VoiceLineEs[] {
  out.length = 0;
  seen.clear();
  for (const s of MADRID_SCENARIOS) addScenario(s);
  // the hand-over of a present is one conversation each friend speaks in their own voice
  for (const f of ES_SMALLTALK_FRIENDS) addScenario({ ...ES_GIVE_GIFT, characterId: f });
  for (const b of Object.values(MADRID_PACK.beats)) for (const l of b.lines) addLine(ES_VOICES[l.who] ? l.who : NARRATOR, l.line);
  for (const f of MADRID_PACK.friends) for (const l of Object.values(f.factLines ?? {})) addLine(ES_VOICES[f.id] ? f.id : NARRATOR, l);
  for (const c of MADRID_PACK.culture) addLine(NARRATOR, c.phrase);
  addShifts(MADRID_PACK, ES_SHIFT_TALK);
  for (const s of ES_STARTER_LINES) add(NARRATOR, s);
  for (const e of ES_LEXICON.all()) add(NARRATOR, e.s);
  return out;
}
