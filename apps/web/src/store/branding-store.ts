import { create } from 'zustand';

import { getSettings } from '@/lib/api';
import {
  DEFAULT_BRANDING,
  normalizeBranding,
  readBrandCache,
  readLastOrgId,
  readStoredBrand,
  writeBrandCache,
  writeStoredBrand,
  type BrandingTheme,
} from '@/lib/branding';

export type BrandingStatus = 'idle' | 'loading' | 'loaded' | 'error';

interface BrandingState {
  orgId: string | null;
  brand: BrandingTheme;
  status: BrandingStatus;
  load: (orgId: string | null) => Promise<void>;
  refresh: () => Promise<void>;
  setBrand: (brand: BrandingTheme) => void;
  reset: () => void;
}

export const useBrandingStore = create<BrandingState>((set, get) => ({
  orgId: null,
  brand: DEFAULT_BRANDING,
  status: 'idle',

  load: async (orgId) => {
    const { orgId: current, status } = get();
    if (current === orgId && (status === 'loading' || status === 'loaded')) {
      return;
    }

    set({ orgId, status: 'loading' });

    if (!orgId) {
      const lastOrg = readLastOrgId();
      const stored = lastOrg ? readStoredBrand(lastOrg) : null;
      set({ status: 'loaded', brand: stored ?? DEFAULT_BRANDING });
      return;
    }

    const cached = readBrandCache(orgId);
    if (cached) {
      set({ status: 'loaded', brand: cached });
      return;
    }

    const stored = readStoredBrand(orgId);
    if (stored) {
      set({ status: 'loaded', brand: stored });
    }

    try {
      const raw = await getSettings<Record<string, unknown>>('branding');
      const brand = normalizeBranding(raw);
      writeBrandCache(orgId, brand);
      writeStoredBrand(orgId, brand);
      set({ brand, status: 'loaded' });
    } catch {
      if (!stored) {
        set({ status: 'error', brand: DEFAULT_BRANDING });
      }
    }
  },

  refresh: async () => {
    const orgId = get().orgId;
    if (!orgId) return;

    try {
      const raw = await getSettings<Record<string, unknown>>('branding');
      const brand = normalizeBranding(raw);
      writeBrandCache(orgId, brand);
      writeStoredBrand(orgId, brand);
      set({ brand, status: 'loaded' });
    } catch {
      // keep current brand on refresh failure
    }
  },

  setBrand: (brand) => {
    const orgId = get().orgId ?? readLastOrgId();
    if (orgId) {
      writeBrandCache(orgId, brand);
      writeStoredBrand(orgId, brand);
    }
    set({ brand, status: 'loaded' });
  },

  reset: () => {
    set({ orgId: null, brand: DEFAULT_BRANDING, status: 'idle' });
  },
}));
