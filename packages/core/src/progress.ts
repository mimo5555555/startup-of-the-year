// XP, level, daily streak with freezes, and simple stat counters.

export interface StreakState {
  days: number;
  freezes: number;
  lastActive: string | null; // local date, YYYY-MM-DD
}

export const MAX_FREEZES = 2;

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function newStreak(): StreakState {
  return { days: 0, freezes: MAX_FREEZES, lastActive: null };
}

/** Record activity today. One missed day is bridged by a streak freeze when one is available. */
export function touchStreak(s: StreakState, today = localDate()): { state: StreakState; usedFreeze: boolean; extended: boolean } {
  if (s.lastActive === today) return { state: s, usedFreeze: false, extended: false };
  if (s.lastActive === null) return { state: { ...s, days: 1, lastActive: today }, usedFreeze: false, extended: true };
  const gap = dayDiff(s.lastActive, today);
  let days = s.days;
  let freezes = s.freezes;
  let usedFreeze = false;
  if (gap === 1) {
    days += 1;
  } else if (gap === 2 && freezes > 0) {
    freezes -= 1;
    days += 1;
    usedFreeze = true;
  } else {
    days = 1;
  }
  // earn a freeze back every 7 days of streak
  if (days > 0 && days % 7 === 0 && freezes < MAX_FREEZES) freezes += 1;
  return { state: { days, freezes, lastActive: today }, usedFreeze, extended: true };
}

/** A streak that will be lost if no activity happens today. */
export function streakAtRisk(s: StreakState, today = localDate()): boolean {
  return s.lastActive !== null && s.lastActive !== today && s.days > 0;
}

// Level n starts at 50*(n-1)*n XP: 0, 100, 300, 600, 1000, 1500 ...
export const xpForLevel = (level: number) => 50 * (level - 1) * level;

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}

export function levelProgress(xp: number): { level: number; into: number; span: number; fraction: number } {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const span = xpForLevel(level + 1) - start;
  const into = xp - start;
  return { level, into, span, fraction: span ? into / span : 0 };
}

export interface LoopResult {
  goalDone: number;
  goalTotal: number;
  independentTurns: number;
  assistedTurns: number;
  durationSec: number;
}

/** XP for one finished conversation: base + goal progress + a bonus for speaking unaided. */
export function xpForLoop(r: LoopResult): number {
  const turns = r.independentTurns + r.assistedTurns;
  if (turns === 0) return 0;
  const base = 10 + Math.min(turns, 12) * 2;
  const goal = r.goalTotal ? Math.round((r.goalDone / r.goalTotal) * 30) : 0;
  const indep = Math.min(r.independentTurns, 10) * 3;
  return base + goal + indep;
}

export interface DayStat {
  seconds: number;
  loops: number;
  words: number;
  xp: number;
}

export const emptyDay = (): DayStat => ({ seconds: 0, loops: 0, words: 0, xp: 0 });
