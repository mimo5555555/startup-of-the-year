// Whether the karaoke invite sheet is open (KaraokeInvite.tsx): set by the bridge when a room was just paid for, and by the karaoke door.
import { create } from 'zustand';

interface KaraokeUi {
  open: boolean;
  setOpen(on: boolean): void;
}
export const useKaraoke = create<KaraokeUi>()((set) => ({ open: false, setOpen: (open) => set({ open }) }));
