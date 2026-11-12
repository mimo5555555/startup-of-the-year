// Every static Japanese line the app can speak, with the voice that speaks it (tools/voice/generate.mjs turns them into files).
// Built from the content package's own data and resolvers, so the text is what the screens pass to tts.speak / speakJa.
// A scenario line whose only variables are slot choices ({item}, {flavor}...) is recorded once per choice; lines with any other
// runtime variable ({name}, prices...) are left out: those keep the device voice.
import * as C from '@lw/content';
import { LEXICON, REACTIONS, SCENARIOS, SLOTS, resolveLine, speakableText, tokenize, type Line, type Scenario, type Vars } from '@lw/content';
import { NARRATOR, CUSTOMER, VOICE_SPEAKERS } from '../../apps/mobile/src/voice/voices';
import { splitSentences } from '../../apps/mobile/src/voice/key';

export interface VoiceLine {
  voice: string;
  /** the text VOICEVOX reads */
  text: string;
  /** other texts the app may pass for the same audio (markup stripped, a reading, the surface of a word) */
  alias: string[];
}

const JA = /[぀-ヿ㐀-鿿]/;
const out: VoiceLine[] = [];
const add = (voice: string, text: string | undefined, alias: Array<string | undefined> = []) => {
  if (!text || !JA.test(text) || /[{}]/.test(text)) return;
  out.push({ voice, text, alias: alias.filter((a): a is string => !!a && a !== text && !/[{}]/.test(a)) });
};

/** A Line as the screens say it: `tts`, else the speakable text (prices read in kana); the bare markup is an alias. */
function addLine(voice: string, l: { ja: string; tts?: string; reading?: string; r?: string }) {
  if (/[{}]/.test(l.ja)) return;
  const bare = l.ja.replace(/\|/g, '');
  const spoken = l.tts ?? speakableText(tokenize(l.ja, LEXICON).tokens);
  // a short name with a reading is read from the reading (VOICEVOX guesses names and places)
  const reading = l.reading ?? l.r;
  if (reading && JA.test(reading) && !/[{}]/.test(reading)) add(voice, reading, [spoken, bare]);
  else add(voice, spoken, [bare]);
}

/**
 * A line whose only variable is the player's name ({name}): the device voice has to say the name, but the player plays the line sentence
 * by sentence, so its name-free sentences are recorded in the speaker's voice (「{name}さん！いつもありがとうございます。」 keeps its thanks).
 */
function addNameLine(voice: string, l: Line): boolean {
  const vars = [...new Set([...l.ja.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
  if (l.tts || vars.length !== 1 || vars[0] !== 'name') return false;
  for (const s of splitSentences(l.ja)) if (!/[{}]/.test(s)) addLine(voice, { ja: s.replace(/^\|+|\|+$/g, '') });
  return true;
}

/** most recordings one slot line may add (every combination of its slots' options) */
const SLOT_CAP = 40;

/**
 * A line with slot variables: one recording per combination of options, resolved as the dialogue resolves it. `as` names the slot a
 * variable that is not a slot reads its options from ({last}, the shopkeeper's remembered purchase, is an option of the shop's item slot).
 */
function addSlotLine(voice: string, l: Line, as: Record<string, string> = {}) {
  const vars = [...new Set([...l.ja.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
  const of = (k: string) => SLOTS[as[k] ?? k] ?? [];
  if (!vars.length || l.tts || !vars.every((k) => of(k).length)) return;
  if (vars.reduce((n, k) => n * of(k).length, 1) > SLOT_CAP) return;
  const combos = vars.reduce<Vars[]>((acc, k) => acc.flatMap((v) => of(k).map((o) => ({ ...v, [k]: { ja: o.ja, gloss: o.gloss } }))), [{}]);
  for (const vars of combos) add(voice, resolveLine(l, LEXICON, vars).plain);
}

function addScenario(s: Scenario) {
  const who = VOICE_SPEAKERS[s.characterId] ? s.characterId : NARRATOR;
  // {last}: what the shopkeeper remembers you bought (tokyo/regulars.ts), an option of this conversation's item slot
  const itemSlot = C.JP_PACK.scenarioMeta.find((m) => m.id === s.id)?.shop?.itemSlot;
  const as: Record<string, string> = itemSlot ? { last: itemSlot } : {};
  const line = (voice: string, l: Line) => {
    if (!/[{}]/.test(l.ja)) addLine(voice, l);
    else if (!addNameLine(voice, l)) addSlotLine(voice, l, as);
  };
  for (const node of Object.values(s.nodes)) {
    for (const v of node.say) line(who, v.line);
    for (const sg of node.suggestions ?? []) line(NARRATOR, sg);
    for (const it of node.intents) {
      if (it.reply) line(who, it.reply);
      if (it.ideal) line(NARRATOR, it.ideal);
    }
  }
  for (const r of Object.values(REACTIONS) as Line[]) addLine(who, r);
}

const seen = new Map<object, Set<string>>();
const isScenario = (o: any): o is Scenario => o && typeof o.characterId === 'string' && o.nodes && typeof o.start === 'string';

/** Walk any content: objects with a Japanese `ja` are lines; `who` names the speaker below it; shift archetype lines are customers. */
function walk(o: unknown, voice: string, key = '') {
  if (!o || typeof o !== 'object') return;
  const vs = seen.get(o) ?? new Set<string>();
  if (vs.has(voice)) return;
  vs.add(voice);
  seen.set(o, vs);
  if (isScenario(o)) return addScenario(o);
  if (Array.isArray(o)) {
    for (const x of o) {
      if (typeof x === 'string' && (key === 'thanks' || key === 'tiles')) addLine(NARRATOR, { ja: x });
      else walk(x, voice, key);
    }
    return;
  }
  const rec = o as Record<string, unknown>;
  const who = typeof rec.who === 'string' && VOICE_SPEAKERS[rec.who] ? rec.who : voice;
  if (typeof rec.ja === 'string') addLine(who, rec as { ja: string });
  for (const [k, v] of Object.entries(rec)) {
    if (k === 'en' || k === 'ar' || typeof v !== 'object') continue;
    walk(v, k === 'line' && key === 'archetypes' ? CUSTOMER : who, k);
  }
}

export function voiceLines(): VoiceLine[] {
  out.length = 0;
  seen.clear();
  for (const s of SCENARIOS) addScenario(s);
  // lexicon words: read from the reading when the surface has kanji; Vocab / WordSheet pass the surface
  for (const e of LEXICON.all()) add(NARRATOR, e.r ?? e.s, [e.s]);
  const skip = new Set(['LEXICON', 'LEXICON_ENTRIES', 'LEXICON_PARTS', 'REACTIONS', 'JP_LANGUAGE']);
  for (const [name, v] of Object.entries(C)) if (!skip.has(name) && typeof v === 'object') walk(v, NARRATOR, name);
  return out;
}
