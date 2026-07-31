'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { hexToHsl, pickForeground, type BrandingTheme } from '@/lib/branding';
import { useAuthStore } from '@/store/auth-store';
import { useBrandingStore, type BrandingStatus } from '@/store/branding-store';

interface OrganizationThemeValue {
  brand: BrandingTheme;
  status: BrandingStatus;
  refresh: () => Promise<void>;
  setBrand: (brand: BrandingTheme) => void;
}

const OrganizationThemeContext = createContext<OrganizationThemeValue | null>(null);

export function useOrganizationTheme(): OrganizationThemeValue {
  const ctx = useContext(OrganizationThemeContext);
  if (!ctx) {
    throw new Error('useOrganizationTheme must be used within an OrganizationThemeProvider');
  }
  return ctx;
}

function useApplyBranding(brand: BrandingTheme) {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', hexToHsl(brand.primaryColor));
    root.style.setProperty('--primary-foreground', pickForeground(brand.primaryColor));
    root.style.setProperty('--ring', hexToHsl(brand.primaryColor));
  }, [brand.primaryColor]);

  useEffect(() => {
    if (!brand.faviconUrl) return;

    let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = brand.faviconUrl;

    return () => {
      if (link && link.getAttribute('href') === brand.faviconUrl) {
        link.remove();
      }
    };
  }, [brand.faviconUrl]);

  useEffect(() => {
    const suffix = brand.brandName.trim();
    if (!suffix) return;

    const current = document.title;
    if (current === suffix || current.endsWith(`| ${suffix}`)) return;

    const stripped = current
      .replace(/\s*\|\s*Business Copilot\s*$/, '')
      .replace(/\s*Business Copilot\s*$/, '')
      .trim();

    document.title = stripped ? `${stripped} | ${suffix}` : suffix;
  }, [brand.brandName, pathname]);
}

interface OrganizationThemeProviderProps {
  children: ReactNode;
}

export function OrganizationThemeProvider({ children }: OrganizationThemeProviderProps) {
  const orgId = useAuthStore((s) => s.user?.organizationId ?? null);
  const brand = useBrandingStore((s) => s.brand);
  const status = useBrandingStore((s) => s.status);
  const load = useBrandingStore((s) => s.load);
  const refresh = useBrandingStore((s) => s.refresh);
  const setBrand = useBrandingStore((s) => s.setBrand);

  useEffect(() => {
    if (!orgId) return;
    void load(orgId);
  }, [orgId, load]);

  useApplyBranding(brand);

  const value = useMemo<OrganizationThemeValue>(
    () => ({ brand, status, refresh, setBrand }),
    [brand, status, refresh, setBrand],
  );

  return (
    <OrganizationThemeContext.Provider value={value}>
      {children}
    </OrganizationThemeContext.Provider>
  );
}
