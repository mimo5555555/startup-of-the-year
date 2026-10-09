// Pure logic of the Shift screen (agent 4D, docs/GAME_DESIGN.md §9): carts, the total and the change in Japanese, answer checking,
// tile and choice sets, and turning what the player did into a `ShiftResult`. No React here, so the rules are tested on their own.
import { LEXICON, parseNumbers, tokenize, yenToJa, type Token } from '@lw/content';
import { normJa, romajiAsKana } from '@lw/core';
import {
  BALANCE,
  type GamePack,
  type JobDef,
  type MenuItem,
  type ShiftAssist,
  type ShiftCustomer,
  type ShiftCustomerResult,
  type ShiftInput,
  type ShiftResult,
  type ShiftTaskResult,
} from '@lw/game';

/** How an answer is given: typed (or spoken), built from tiles, or picked from three. */
export type AnswerMode = 'type' | 'tiles' | 'pick';
export type Cart = Record<string, number>;
export interface Flags {
  heat: boolean;
  nobag: boolean;
}
export const NO_FLAGS: Flags = { heat: false, nobag: false };
/** The most of one item a cart holds: a customer never asks for more than three. */
export const MAX_QTY = 9;

/** An amount that stays left-to-right inside an Arabic sentence: ¥860 as a bidi isolate (the digits stay Latin). */
export const yenLtr = (n: number): string => `\u2066¥${n.toLocaleString('en-US')}\u2069`;

// ---------------------------------------------------------------------------------------------------------------
// The goods and the order
// ---------------------------------------------------------------------------------------------------------------

/** The menu of the job's shop, cheapest last: what the item grid shows (the very goods and prices of the shop). */
export function menuFor(pack: GamePack, job: JobDef): MenuItem[] {
  const shops = new Set(pack.shops.filter((s) => s.placeId === job.place || s.id === job.place).map((s) => s.id));
  return pack.menu.filter((m) => shops.has(m.shop) && m.slot === 'item');
}

/** The menu id a task item names: a full id or a bare option of the job's shop. */
function resolveMenu(menu: MenuItem[], ref: string): string {
  return (menu.find((m) => m.id === ref) ?? menu.find((m) => m.option === ref))?.id ?? ref;
}

/** What the customer asked for, with menu ids resolved. */
export function wantedOf(c: ShiftCustomer, menu: MenuItem[]): { cart: Cart; flags: Flags } {
  if (c.task.kind !== 'order') return { cart: {}, flags: NO_FLAGS };
  const cart: Cart = {};
  for (const i of c.task.items) {
    const id = resolveMenu(menu, i.menu);
    cart[id] = (cart[id] ?? 0) + i.qty;
  }
  const on = new Set(c.task.toggles ?? []);
  return { cart, flags: { heat: on.has('heat'), nobag: on.has('nobag') } };
}

export const cartSize = (cart: Cart): number => Object.values(cart).reduce((a, b) => a + b, 0);

/** The order is exactly what the customer asked for: the same items, the same counts, the same flags. */
export function orderCorrect(c: ShiftCustomer, menu: MenuItem[], cart: Cart, flags: Flags): boolean {
  const want = wantedOf(c, menu);
  const ids = new Set([...Object.keys(want.cart), ...Object.keys(cart)]);
  for (const id of ids) if ((want.cart[id] ?? 0) !== (cart[id] ?? 0)) return false;
  return want.flags.heat === flags.heat && want.flags.nobag === flags.nobag;
}

/** The sum of a cart at the shop's prices (what the register would say). */
export const cartTotal = (menu: MenuItem[], cart: Cart): number =>
  Object.entries(cart).reduce((s, [id, q]) => s + (menu.find((m) => m.id === id)?.price ?? 0) * q, 0);

// ---------------------------------------------------------------------------------------------------------------
// The total and the change, in Japanese
// ---------------------------------------------------------------------------------------------------------------

/** The change owed, when the customer pays with a note (undefined otherwise or when the note does not cover the total). */
export function changeOf(c: ShiftCustomer): number | undefined {
  if (!c.change || c.total === undefined) return undefined;
  const back = c.change.paid - c.total;
  return back > 0 ? back : undefined;
}

/** 三百|二十|円 as markup. */
export const amountMarkup = (n: number): string => yenToJa(n).markup;
/** The staff's sentence for a total: 三百二十円です。 */
export const totalPhrase = (n: number): string => `${amountMarkup(n)}|です|。`;
/** The staff's sentence for the change: お釣りは三百十円です。 */
export const changePhrase = (n: number): string => `お釣り|は|${amountMarkup(n)}|です|。`;

/** The pieces of a markup phrase that are words (no punctuation), in order. */
export const piecesOf = (markup: string): string[] => markup.split('|').filter((p) => p && !/^[。、？！.,?!]+$/.test(p));

/**
 * Whether a typed or spoken answer says `expected` yen: digits (320, ¥320), kanji (三百二十円) or kana, romaji included. It has to name
 * exactly one amount, so a list of prices does not pass by containing the right one.
 */
export function amountSaid(text: string, expected: number): boolean {
  const tries = [text, romajiAsKana(text)].filter((x): x is string => !!x && x.trim().length > 0);
  return tries.some((t) => {
    const found = parseNumbers(t).numbers;
    return found.length === 1 && found[0] === expected;
  });
}

/** The two accepted forms of a thanks phrase for matching: the text up to the first sentence mark, folded to kana. */
const core = (markup: string): string => normJa(markup.replace(/\|/g, '').split(/[。！？]/)[0] ?? '');

/** A typed or spoken staff phrase: it contains one of the accepted phrases (script-insensitive, romaji included). */
export function thanksSaid(text: string, accepted: string[]): boolean {
  const said = [normJa(text), romajiAsKana(text) ? normJa(romajiAsKana(text)!) : ''].filter(Boolean);
  return accepted.some((a) => {
    const want = core(a);
    return want.length > 0 && said.some((s) => s.includes(want));
  });
}

/** Two wrong totals near the right one (multiples of 10, positive, different from each other and from it). */
export function nearAmounts(n: number): [number, number] {
  const offsets = [100, -100, 50, -50, 150, 30, -30, 200];
  const out: number[] = [];
  for (const o of offsets) {
    const v = n + o;
    if (v >= 10 && v !== n && !out.includes(v)) out.push(v);
    if (out.length === 2) break;
  }
  return [out[0] ?? n + 10, out[1] ?? n + 20];
}

// ---------------------------------------------------------------------------------------------------------------
// Tiles and choices (seeded: the same screen always shuffles the same way)
// ---------------------------------------------------------------------------------------------------------------

/** mulberry32, the same small generator the game core uses for plans. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(list: T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** The phrase tiles of an answer: the pieces of the target and two distractors, shuffled. */
export function tilePool(targetMarkup: string, distractors: string[], rng: () => number): string[] {
  const target = piecesOf(targetMarkup);
  const extra = distractors.filter((d) => !target.includes(d)).slice(0, 2);
  return shuffled([...target, ...extra], rng);
}

/** Two number words that are not part of the right amount, for the tile pool of a total or a change. */
export function amountDistractors(n: number): string[] {
  const own = new Set(piecesOf(amountMarkup(n)));
  const out: string[] = [];
  for (const v of [...nearAmounts(n), n + 300, n + 1000]) {
    for (const p of piecesOf(amountMarkup(v))) if (p !== '円' && !own.has(p) && !out.includes(p)) out.push(p);
  }
  // small amounts share most of their words with the near ones: fall back to plain digits that are not in the answer
  for (const d of ['五', '三', '七', '四', '二', '八', '六', '九']) if (out.length < 2 && !own.has(d) && !out.includes(d)) out.push(d);
  return out.slice(0, 2);
}

export const tilesCorrect = (placed: string[], targetMarkup: string): boolean => placed.join('') === piecesOf(targetMarkup).join('');

/** Three sentences to pick from: the right one and two near ones, shuffled. */
export function choicesFor(rightMarkup: string, wrongMarkups: string[], rng: () => number): string[] {
  return shuffled([rightMarkup, ...wrongMarkups.slice(0, 2)], rng);
}

/** Wrong sentences for a thanks answer: other things a worker says at a counter. */
export const THANKS_WRONG = ['いらっしゃいませ|。', 'どういたしまして|。', 'すみません|。', 'いただきます|。'];
export const thanksWrong = (seed: number): string[] => shuffled(THANKS_WRONG, seeded(seed + 3)).slice(0, 2);

// ---------------------------------------------------------------------------------------------------------------
// Credit
// ---------------------------------------------------------------------------------------------------------------

const RANK: Record<ShiftInput, number> = {
  typed: 3,
  spoken: 3,
  tiles: 2,
  pick: 1,
};

/** The lower-credit of two ways of answering. */
export const lowerInput = (a: ShiftInput, b: ShiftInput): ShiftInput => (RANK[a] <= RANK[b] ? a : b);

/** The help a player opened caps the credit of the answer, even if they then type it (the tiles and the chips show the answer). */
export function inputFor(mode: AnswerMode, spoken: boolean, cap: ShiftInput | null): ShiftInput {
  const own: ShiftInput = mode === 'type' ? (spoken ? 'spoken' : 'typed') : mode === 'tiles' ? 'tiles' : 'pick';
  return cap ? lowerInput(own, cap) : own;
}

export const HELP_CAP: Record<'tiles' | 'pick', ShiftInput> = {
  tiles: 'tiles',
  pick: 'pick',
};

// ---------------------------------------------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------------------------------------------

const SILENT_MODES = ['read-and-type', 'type-only'];

/** No Japanese voice to listen to: the player turned listening off, the audio mode is read-and-type / type-only, or auto-speak is off. */
export function voiceOff(a: { listenPref?: string; lastMode?: string }, autoSpeak: boolean): boolean {
  return !autoSpeak || a.listenPref === 'off' || SILENT_MODES.includes(a.lastMode ?? '');
}

// ---------------------------------------------------------------------------------------------------------------
// From play to a ShiftResult
// ---------------------------------------------------------------------------------------------------------------

/** What happened with one customer so far. */
export interface Track {
  templateId: string;
  assistText: boolean;
  assistTrans: boolean;
  greeted: boolean;
  order?: boolean;
  total?: { ok: boolean; input: ShiftInput };
  thanks?: { ok: boolean; input: ShiftInput };
}

export const newTrack = (templateId: string): Track => ({
  templateId,
  assistText: false,
  assistTrans: false,
  greeted: false,
});

export const assistOf = (t: Track): ShiftAssist => (t.assistTrans ? 'translation' : t.assistText ? 'text' : 'none');

/** A customer is served once the thanks answer is in (right or wrong: the customer leaves either way). */
export const isServed = (t: Track): boolean => !!t.thanks;

export function customerResult(t: Track): ShiftCustomerResult {
  const tasks: ShiftTaskResult[] = [
    { kind: 'order', ok: t.order === true },
    {
      kind: 'total',
      ok: t.total?.ok === true,
      ...(t.total ? { input: t.total.input } : {}),
    },
    {
      kind: 'thanks',
      ok: t.thanks?.ok === true,
      ...(t.thanks ? { input: t.thanks.input } : {}),
    },
  ];
  if (t.greeted) tasks.push({ kind: 'greet', ok: true });
  return {
    templateId: t.templateId,
    served: isServed(t),
    assist: assistOf(t),
    tasks,
  };
}

export function buildResult(o: {
  id: string;
  jobId: string;
  tracks: Track[];
  quit: boolean;
  startedAt: number;
  now: number;
  assistWaived: boolean;
}): ShiftResult {
  return {
    id: o.id,
    jobId: o.jobId,
    customers: o.tracks.map(customerResult),
    quit: o.quit,
    durationSec: Math.max(0, Math.round((o.now - o.startedAt) / 1000)),
    assistWaived: o.assistWaived,
  };
}

/** The units a shift is worth, for the progress strip. */
export const SHIFT_CUSTOMERS = BALANCE.shift.customers;

// ---------------------------------------------------------------------------------------------------------------
// Words to keep
// ---------------------------------------------------------------------------------------------------------------

/** Up to `max` words worth saving from the shift: the customers that went wrong or needed help first, then the rest; never one already saved. */
export function wordsFromShift(
  plan: ShiftCustomer[],
  tracks: Track[],
  menu: MenuItem[],
  saved: (surface: string) => boolean,
  max = 3,
): Token[] {
  const out: Token[] = [];
  const seen = new Set<string>();
  const take = (t: Token): void => {
    if (out.length >= max || t.punct || t.raw || !t.gloss || seen.has(t.s) || saved(t.s)) return;
    const entry = LEXICON.get(t.s);
    if (!entry || entry.g) return;
    seen.add(t.s);
    out.push(t);
  };
  const rank = (i: number): number => {
    const tr = tracks[i];
    if (!tr) return 2;
    const wrong = tr.order === false || tr.total?.ok === false || tr.thanks?.ok === false;
    return wrong ? 0 : tr.assistText || tr.assistTrans ? 1 : 2;
  };
  const order = plan.map((_, i) => i).sort((a, b) => rank(a) - rank(b) || a - b);
  for (const i of order) {
    const c = plan[i]!;
    for (const tok of tokenize(c.line.ja, LEXICON).tokens) take(tok);
    if (c.task.kind === 'order') {
      for (const it of c.task.items) {
        const m = menu.find((x) => x.id === it.menu || x.option === it.menu);
        if (m) for (const tok of tokenize(m.name.ja, LEXICON).tokens) take(tok);
      }
    }
  }
  return out;
}
