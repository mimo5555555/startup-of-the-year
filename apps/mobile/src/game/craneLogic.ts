// The crane game at ゲームセンター「ピコピコ」 (docs/ROADMAP.md): the machine's four prizes, where they sit, and what one drop of the claw does.
// Pure (no React, no audio) so the odds are testable; Crane.tsx draws the machine and dispatches `crane_play`. Asking Shota to move the prize
// (「取りやすくしてもらえますか」, the intent `arcade_crane:ask_assist`) gives a wider target and a firmer grip for the goes of that visit.
import { create } from 'zustand';

export interface CranePrize {
  /** the item id the game grants (pack.arcade.prizes) */
  id: string;
  /** where it sits, 0..1 across the machine */
  x: number;
  /** body and accent colours of the drawing */
  body: string;
  accent: string;
  kind: 'bear' | 'neko';
}

export const CRANE_PRIZES: readonly CranePrize[] = [
  { id: 'g_plush', x: 0.16, body: '#f4c64a', accent: '#b07a1e', kind: 'bear' },
  { id: 'fig_neko_red', x: 0.39, body: '#e5453d', accent: '#1b1638', kind: 'neko' },
  { id: 'fig_neko_blue', x: 0.62, body: '#3b6fe0', accent: '#1b1638', kind: 'neko' },
  { id: 'fig_neko_white', x: 0.85, body: '#f7f7fb', accent: '#1b1638', kind: 'neko' },
];

/** how far the claw may be from a prize (fraction of the machine's width) and how often it holds on */
export const CRANE_ODDS = {
  plain: { reach: 0.07, grip: 0.5 },
  assisted: { reach: 0.12, grip: 0.85 },
} as const;

/** one claw step of the ◀ ▶ buttons */
export const CRANE_STEP = 0.04;

export const clampClaw = (x: number): number => Math.min(0.95, Math.max(0.05, x));

/** The result of a drop at `clawX`: the prize under the claw (if any) and whether the claw held it. */
export function craneDrop(clawX: number, assisted: boolean, rng: () => number = Math.random): { prize: CranePrize | null; won: boolean } {
  const odds = assisted ? CRANE_ODDS.assisted : CRANE_ODDS.plain;
  let best: CranePrize | null = null;
  for (const p of CRANE_PRIZES) if (Math.abs(p.x - clawX) <= odds.reach && (!best || Math.abs(p.x - clawX) < Math.abs(best.x - clawX))) best = p;
  if (!best) return { prize: null, won: false };
  return { prize: best, won: rng() < odds.grip };
}

/** Shota moved the prizes for this visit's goes (set by the conversation, cleared when the goes run out). */
interface CraneUi {
  assisted: boolean;
  setAssisted(on: boolean): void;
}
export const useCrane = create<CraneUi>()((set) => ({ assisted: false, setAssisted: (assisted) => set({ assisted }) }));
