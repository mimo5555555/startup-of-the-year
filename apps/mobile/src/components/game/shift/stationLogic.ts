// Pure logic of the station desk (Release 2 wave C1, docs/GAME_DESIGN.md §9.3-§9.4): what the departure board, the mini map, the timetable
// and the fare table show for a customer, which tap is right, and what the staff say back ("二番線です", "九時五十八分です", "右です").
// No React here, so the rules are tested on their own.
//
// A desk customer's `task` is `{ kind, answer }` (platform | time | fare | direction | announce). The board and the map are DRAWN FROM the
// customer: the platform of the destination the customer names is the `answer`, the target on the map sits where the `answer` points, the
// timetable is built around the answer's departure. So the data of a customer can never disagree with the widget that shows it.
import { SLOTS, parseJaNumber, yenToJa } from '@lw/content';
import { normJa, romajiAsKana } from '@lw/core';
import { BALANCE, type GamePack, type ShiftCustomer } from '@lw/game';
import { amountSaid, totalPhrase } from './shiftLogic';

export type DeskKind = 'platform' | 'time' | 'fare' | 'direction' | 'announce';
export type Dir = 'right' | 'left' | 'straight';

export const deskKindOf = (c: ShiftCustomer): DeskKind | null => (c.task.kind === 'order' ? null : c.task.kind);
export const isDesk = (c: ShiftCustomer): boolean => c.task.kind !== 'order';

/** The line without token bars and kana readings: what the learner reads. */
const plain = (ja: string): string => ja.replace(/\([^)]*\)/g, '').replace(/\|/g, '');

const digits = (s: string): string => s.normalize('NFKC');

// ---------------------------------------------------------------------------------------------------------------
// Numbers said in Japanese (digits, kanji, kana)
// ---------------------------------------------------------------------------------------------------------------

/** 1..99 as markup tokens (`五|十|八`), without a counter. */
export const numMarkup = (n: number): string => yenToJa(n).markup.replace(/\|円$/, '');

/** The whole number a string says: `2`, `二`, `に`, `２`. Null when it is not one number. */
export function plainNumber(text: string): number | null {
  const s = digits(text).replace(/\s+/g, '');
  if (/^\d+$/.test(s)) return Number(s);
  return parseJaNumber(s);
}

/** The platform number a spoken or typed answer names (`2番線`, `二番線です`, `にばんせん`, `2`), or null if it names none or several. */
export function platformSaid(text: string): number | null {
  const raw = digits(text).toLowerCase();
  const tries = [raw, romajiAsKana(raw) ?? ''].filter(Boolean);
  const found = new Set<number>();
  for (const t of tries) {
    const s = t.replace(/(番線|ばんせん|番のりば|ばんのりば|番ホーム|ばんホーム|番|ばん)/g, ' ').replace(/(です|だよ|ですよ|になります|へどうぞ|です。)/g, ' ');
    for (const m of s.matchAll(/\d+|[〇零一二三四五六七八九十]+|[ぁ-ん]+/g)) {
      const n = plainNumber(m[0]);
      if (n !== null && n >= 0 && n < 100) found.add(n);
    }
  }
  return found.size === 1 ? [...found][0]! : null;
}

export const platformOk = (text: string, n: number): boolean => platformSaid(text) === n;

/** The platform number of an answer (`2`, `'2'`, `'二番線'`). */
export function answerNumber(answer: string | number): number | null {
  return typeof answer === 'number' ? answer : platformSaid(answer) ?? plainNumber(answer);
}

// ---------------------------------------------------------------------------------------------------------------
// Places named in a line
// ---------------------------------------------------------------------------------------------------------------

/** Spellings of a destination in a customer's line besides the slot's own. */
const ALIASES: Record<string, string[]> = { hikarigaoka: ['ひかりが丘', 'ひかりがおか', '光が丘'], tokyoStation: ['東京'] };

/** The destination a line names (a `place` slot option other than the station and the toilet), or null. */
export function destIn(line: string): string | null {
  const text = plain(line);
  for (const o of SLOTS.place ?? []) {
    if (o.id === 'toilet' || o.id === 'station') continue;
    const names = [plain(o.ja), ...(ALIASES[o.id] ?? []), ...o.keys.ja];
    if (names.some((n) => n && text.includes(n))) return o.id;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Platform board (platform, announce)
// ---------------------------------------------------------------------------------------------------------------

export interface BoardRow {
  n: number;
  /** a `place` slot id */
  dest: string;
}
const OTHERS = ['shibuya', 'shinjuku', 'tokyoStation', 'ueno', 'akihabara', 'asakusa'];
export const PLATFORMS = [1, 2, 3, 4] as const;

/** Four platforms with the destination written over each. For a "which platform is X" customer X stands over the answer's platform. */
export function boardFor(c: ShiftCustomer): BoardRow[] {
  const n = c.task.kind === 'order' ? 0 : (answerNumber(c.task.answer) ?? 0);
  const dest = c.task.kind === 'platform' ? (destIn(c.line.ja) ?? 'hikarigaoka') : null;
  const rest = OTHERS.filter((d) => d !== dest);
  let k = 0;
  return PLATFORMS.map((p) => ({ n: p, dest: dest && p === n ? dest : rest[k++ % rest.length]! }));
}

// ---------------------------------------------------------------------------------------------------------------
// Timetable (time)
// ---------------------------------------------------------------------------------------------------------------

/** Minutes after midnight of a departure given as `'9:58'`, `'9時58分'`, `958` (HHMM) or minutes since midnight. */
export function minutesOf(answer: string | number): number | null {
  if (typeof answer === 'number') {
    if (!Number.isFinite(answer) || answer < 0) return null;
    const h = Math.floor(answer / 100);
    const m = answer % 100;
    if (answer >= 100 && h < 24 && m < 60) return h * 60 + m;
    return answer < 1440 ? Math.floor(answer) : null;
  }
  const s = digits(answer).replace(/\s+/g, '');
  const m = /^(\d{1,2})[:時じ.](\d{1,2})?/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  const n = Number(s);
  return Number.isFinite(n) && s !== '' ? minutesOf(n) : null;
}

const MOD = 1440;
const wrap = (m: number): number => ((m % MOD) + MOD) % MOD;
export const fmtTime = (m: number): string => `${Math.floor(wrap(m) / 60)}:${String(wrap(m) % 60).padStart(2, '0')}`;

export interface Timetable {
  /** the clock the board shows: a few minutes before the right train */
  now: number;
  /** the departures, earliest first; the first has already left */
  rows: number[];
  /** the right one */
  next: number;
}

/** A timetable around the answer: one train that has left, the next one, and two later. */
export function timetableFor(next: number): Timetable {
  return { now: wrap(next - 7), next: wrap(next), rows: [next - 22, next, next + 16, next + 31].map(wrap) };
}

const hourWords = (h: number): string => numMarkup(h);

/** `九|時|五十八|分|です|。`; on the hour `十|時|です|。`. */
export function timePhrase(m: number): string {
  const h = Math.floor(wrap(m) / 60);
  const mm = wrap(m) % 60;
  return `${hourWords(h === 0 ? 12 : h)}|時|${mm ? `${numMarkup(mm)}|分|` : ''}です|。`;
}

/** Whether a typed or spoken time says `m`: `9:58`, `9時58分`, `九時五十八分`, `くじごじゅうはっぷん`; on the hour `9時` and `9時ちょうど`. */
export function timeSaid(text: string, m: number): boolean {
  const target = wrap(m);
  const hh = Math.floor(target / 60);
  const mm = target % 60;
  const raw = digits(text).replace(/\s+/g, '');
  const tries = [raw, normJa(raw), romajiAsKana(raw) ?? ''].filter(Boolean);
  for (const t of tries) {
    const hm = /^(\d{1,2}):(\d{2})/.exec(t);
    if (hm) return Number(hm[1]) === hh && Number(hm[2]) === mm;
    const parts = /^(.+?)(?:時|じ)(.*)$/.exec(t);
    if (!parts) continue;
    const h = plainNumber(parts[1]!);
    const rest = parts[2]!.replace(/(です|だよ|ですよ|ちょうど|ぴったり)/g, '').replace(/(分|ふん|ぷん|ぶん)$/, '');
    const half = /^(半|はん)$/.test(rest);
    const mi = rest === '' ? 0 : half ? 30 : plainNumber(rest);
    if (h === null || mi === null) continue;
    if ((h === hh || (h === 12 && hh === 0)) && mi === mm) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------
// Fare table (fare)
// ---------------------------------------------------------------------------------------------------------------

export interface FareRow {
  place: string;
  ic: number;
  paper: number;
}

/** Up to five destinations with both fares; the one the customer names first (when the line names one), then the cheapest others. */
export function fareRowsFor(pack: GamePack, c: ShiftCustomer): FareRow[] {
  const named = destIn(c.line.ja);
  const ids = Object.keys(pack.fares).sort((a, b) => pack.fares[a]! - pack.fares[b]!);
  const order = named && pack.fares[named] !== undefined ? [named, ...ids.filter((i) => i !== named)] : ids;
  return order.slice(0, 5).map((place) => ({ place, ic: pack.fares[place]!, paper: pack.fares[place]! + BALANCE.fares.paperExtra }));
}

// ---------------------------------------------------------------------------------------------------------------
// Mini map (direction)
// ---------------------------------------------------------------------------------------------------------------

export const DIRS: readonly Dir[] = ['left', 'straight', 'right'];
export const DIR_JA: Record<Dir, string> = { right: '右', left: '左', straight: 'まっすぐ' };

/** `right` / `左` / `まっすぐ` / `straight`... */
export function dirOf(answer: string | number): Dir | null {
  const s = String(answer).toLowerCase();
  if (/右|みぎ|right/.test(s)) return 'right';
  if (/左|ひだり|left/.test(s)) return 'left';
  if (/まっすぐ|真っ?すぐ|ahead|straight|forward|前/.test(s)) return 'straight';
  return null;
}

/** The only direction a typed or spoken text names (`右です`, `みぎ`, `migi`, `まっすぐ`), or null. */
export function dirSaid(text: string): Dir | null {
  const s = digits(text).toLowerCase();
  const kana = romajiAsKana(s) ?? '';
  const found = new Set<Dir>();
  for (const t of [s, kana]) {
    if (/右|みぎ|ミギ/.test(t)) found.add('right');
    if (/左|ひだり|ヒダリ/.test(t)) found.add('left');
    if (/まっすぐ|真っすぐ|真っ直ぐ|マッスグ|まっすく/.test(t)) found.add('straight');
  }
  return found.size === 1 ? [...found][0]! : null;
}

const TARGETS: Array<[string, string]> = [
  ['トイレ', 'トイレ'],
  ['お手洗い', 'お手洗い'],
  ['出口', '出口'],
  ['券売機', '券売機'],
  ['改札', '改札'],
  ['エレベーター', 'エレベーター'],
  ['ホーム', 'ホーム'],
];

/** The place a "where is it" customer asks for (its Japanese name), from the line; the first words before は as a fallback. */
export function targetIn(line: string): string {
  const text = plain(line);
  const hit = TARGETS.find(([k]) => text.includes(k));
  if (hit) return hit[1];
  return text.split(/は|を|が/)[0]?.slice(0, 8) || '出口';
}

// ---------------------------------------------------------------------------------------------------------------
// What the desk says back, and how it is checked
// ---------------------------------------------------------------------------------------------------------------

/** The answer an `order`-less customer is owed, as the staff say it (markup). Null for a customer with an order. */
export function deskPhrase(c: ShiftCustomer): string | null {
  const t = c.task;
  if (t.kind === 'order') return null;
  if (t.kind === 'platform' || t.kind === 'announce') {
    const n = answerNumber(t.answer);
    return n ? `${numMarkup(n)}|番線|です|。` : null;
  }
  if (t.kind === 'time') {
    const m = minutesOf(t.answer);
    return m === null ? null : timePhrase(m);
  }
  if (t.kind === 'fare') {
    const n = typeof t.answer === 'number' ? t.answer : plainNumber(String(t.answer));
    return n ? totalPhrase(n) : null;
  }
  const d = dirOf(t.answer);
  return d ? `${DIR_JA[d]}|です|。` : null;
}

/** Whether the typed or spoken answer says what the customer is owed. */
export function deskSaid(c: ShiftCustomer, text: string): boolean {
  const t = c.task;
  if (t.kind === 'order') return false;
  if (t.kind === 'platform' || t.kind === 'announce') {
    const n = answerNumber(t.answer);
    return n !== null && platformOk(text, n);
  }
  if (t.kind === 'time') {
    const m = minutesOf(t.answer);
    return m !== null && timeSaid(text, m);
  }
  if (t.kind === 'fare') {
    const n = typeof t.answer === 'number' ? t.answer : plainNumber(String(t.answer));
    return n !== null && amountSaid(text, n);
  }
  const d = dirOf(t.answer);
  return d !== null && dirSaid(text) === d;
}

/** Two wrong sentences and two wrong words for the chips and the tiles of the desk answer. */
export function deskWrong(c: ShiftCustomer): { wrong: string[]; distractors: string[] } {
  const t = c.task;
  if (t.kind === 'order') return { wrong: [], distractors: [] };
  if (t.kind === 'platform' || t.kind === 'announce') {
    const n = answerNumber(t.answer) ?? 1;
    const others = PLATFORMS.filter((p) => p !== n);
    return { wrong: others.slice(0, 2).map((p) => `${numMarkup(p)}|番線|です|。`), distractors: others.slice(-2).map((p) => numMarkup(p)) };
  }
  if (t.kind === 'time') {
    const m = minutesOf(t.answer) ?? 600;
    const wrongs = [m - 22, m + 16, m + 31].map(wrap);
    const hour = Math.floor(wrap(m) / 60);
    return { wrong: wrongs.slice(0, 2).map(timePhrase), distractors: [hour + 1, hour + 2].map((h) => numMarkup(((h - 1) % 12) + 1)) };
  }
  if (t.kind === 'fare') {
    const n = typeof t.answer === 'number' ? t.answer : (plainNumber(String(t.answer)) ?? 170);
    const alt = [n + 20, Math.max(10, n - 20), n + 40].filter((x, i, a) => x !== n && a.indexOf(x) === i);
    return { wrong: alt.slice(0, 2).map(totalPhrase), distractors: ['五', '八'] };
  }
  const d = dirOf(t.answer) ?? 'right';
  const others = DIRS.filter((x) => x !== d);
  return { wrong: others.map((x) => `${DIR_JA[x]}|です|。`), distractors: others.map((x) => DIR_JA[x]) };
}

/** The correct answer written plainly, for the correction after a wrong tap ("Platform 2"). Strings come from the caller's translations. */
export interface DeskAnswerText {
  kind: DeskKind;
  value: string | number;
}
export function deskAnswerOf(c: ShiftCustomer): DeskAnswerText | null {
  const t = c.task;
  if (t.kind === 'order') return null;
  if (t.kind === 'platform' || t.kind === 'announce') return { kind: t.kind, value: answerNumber(t.answer) ?? 0 };
  if (t.kind === 'time') return { kind: t.kind, value: fmtTime(minutesOf(t.answer) ?? 0) };
  if (t.kind === 'fare') return { kind: t.kind, value: typeof t.answer === 'number' ? t.answer : (plainNumber(String(t.answer)) ?? 0) };
  return { kind: t.kind, value: dirOf(t.answer) ?? 'right' };
}

/** Whether a tapped value is the right one. A `value` is a platform number, a minute of the day, a yen amount or a direction. */
export function deskPickOk(c: ShiftCustomer, value: string | number): boolean {
  const t = c.task;
  if (t.kind === 'order') return false;
  if (t.kind === 'platform' || t.kind === 'announce') return answerNumber(t.answer) === Number(value);
  if (t.kind === 'time') return minutesOf(t.answer) === Number(value);
  if (t.kind === 'fare') return (typeof t.answer === 'number' ? t.answer : plainNumber(String(t.answer))) === Number(value);
  return dirOf(t.answer) === value;
}
