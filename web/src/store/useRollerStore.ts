import { create } from "zustand";

interface RollerState {
  activeIndex: number;
  /** Set by the roller's own scroll listener (drag/wheel/keyboard all funnel
   *  through native scroll, so this is the single source of truth for "which
   *  section is showing" -- nav buttons read it to highlight, Roller.tsx
   *  writes it). */
  setActiveIndex: (i: number) => void;
  /** Bumped by a nav click; Roller.tsx watches this to scroll-to-index
   *  programmatically without owning a ref the nav component would otherwise
   *  need reaching into. */
  requestedIndex: number | null;
  goTo: (i: number) => void;
  clearRequest: () => void;
}

export const useRollerStore = create<RollerState>((set) => ({
  activeIndex: 0,
  setActiveIndex: (i) => set({ activeIndex: i }),
  requestedIndex: null,
  goTo: (i) => set({ requestedIndex: i }),
  clearRequest: () => set({ requestedIndex: null }),
}));
