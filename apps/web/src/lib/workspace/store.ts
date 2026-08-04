'use client';

import { create } from 'zustand';

import type { IndustryKey } from './types';

export const WORKSPACE_CONTEXT_STORAGE_KEY = 'workspace:context';

interface WorkspaceContextStorage {
  industry: IndustryKey | null;
  aiEnabled: boolean;
}

interface WorkspaceStoreState extends WorkspaceContextStorage {
  hydrated: boolean;
  setIndustry: (industry: IndustryKey | null) => void;
  setAiEnabled: (aiEnabled: boolean) => void;
  hydrate: () => void;
}

function readPersisted(): Partial<WorkspaceContextStorage> {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_CONTEXT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WorkspaceContextStorage>;
    return {
      industry: parsed.industry && parsed.industry in INDUSTRY_VALUES ? parsed.industry : null,
      aiEnabled: typeof parsed.aiEnabled === 'boolean' ? parsed.aiEnabled : true,
    };
  } catch {
    return {};
  }
}

const INDUSTRY_VALUES: Record<string, true> = {
  restaurant: true,
  hospital: true,
  manufacturing: true,
  school: true,
  software: true,
  retail: true,
  pharmacy: true,
  garments: true,
  'it-services': true,
  general: true,
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  industry: null,
  aiEnabled: true,
  hydrated: false,
  setIndustry: (industry) => set({ industry }),
  setAiEnabled: (aiEnabled) => set({ aiEnabled }),
  hydrate: () => {
    if (get().hydrated) return;
    const persisted = readPersisted();
    set({ ...persisted, hydrated: true });
  },
}));
