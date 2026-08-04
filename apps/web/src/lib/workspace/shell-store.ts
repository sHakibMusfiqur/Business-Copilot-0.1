'use client';

import { create } from 'zustand';

interface ShellState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  paletteOpen: boolean;
  aiPanelOpen: boolean;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setAiPanelOpen: (open: boolean) => void;
  closeAll: () => void;
}

export const useShellStore = create<ShellState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  paletteOpen: false,
  aiPanelOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed, mobileSidebarOpen: false })),
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setAiPanelOpen: (open) => set({ aiPanelOpen: open }),
  closeAll: () => set({ mobileSidebarOpen: false, paletteOpen: false, aiPanelOpen: false }),
}));
