import type { Quote } from '@lw/game';

// Placeholder (2A): agent 2C fills the receipt sheet (小計 / 消費税 / 合計 / お預かり / お釣り) shown after a purchase.
export interface ReceiptSheetProps {
  /** the quote the purchase was committed from (lines, subtotal, tax, total) plus what was handed over when paid in cash */
  receipt: Quote & { paid?: number; change?: number };
}

export function ReceiptSheet(_props: ReceiptSheetProps) {
  return null;
}
