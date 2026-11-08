// Whether the bath sheet is open (SentoBath.tsx): set by the bridge when the bath was just paid for at Genzō's bandai.
import { create } from 'zustand';

/** the menu id of the bath itself (a rental towel is a second line of the same payment) */
export const SENTO_BATH_ITEM = 'sento:adult';

interface SentoUi {
  open: boolean;
  setOpen(on: boolean): void;
}
export const useSento = create<SentoUi>()((set) => ({ open: false, setOpen: (open) => set({ open }) }));
