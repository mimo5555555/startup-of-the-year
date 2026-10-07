// Placeholder (2A): agent 2E fills the hidden-line "Say it" (the meaning is shown, the Japanese hidden; mic or type; Peek forfeits the yen).
// Agent 2C places it in the debrief with these props. `onDone` reports the outcome so the debrief can show the pay line.
export interface EchoButtonProps {
  /** the line's id: a pocket line id, or the debrief line's id (`echo:<sessionId>:<lineId>` in the ledger) */
  lineId: string;
  /** the Japanese markup of the line (hidden until Peek) */
  ja: string;
  /** the meaning shown instead, EN and AR */
  meaning: { en: string; ar: string };
  onDone: (r: { similarity: number; peeked: boolean }) => void;
}

export function EchoButton(_props: EchoButtonProps) {
  return null;
}
