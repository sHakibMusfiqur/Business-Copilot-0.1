'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import {
  brandFontStack,
  fontCssUrl,
  hexToHsl,
  pickForeground,
  type BrandingTheme,
} from '@/lib/branding';
import { useAuthStore } from '@/store/auth-store';
import { useBrandingStore, type BrandingStatus } from '@/store/branding-store';
import { useThemeStore } from '@/store/theme-store';

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
    root.style.setProperty('--brand-secondary', hexToHsl(brand.secondaryColor));
    root.style.setProperty('--brand-accent', hexToHsl(brand.accentColor));
  }, [brand.primaryColor, brand.secondaryColor, brand.accentColor]);

  // Logo assets: expose light + dark variants as CSS vars so any surface can
  // swap them reactively based on the active theme.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--brand-logo', brand.logoUrl ? `url("${brand.logoUrl}")` : 'none');
    root.style.setProperty(
      '--brand-logo-dark',
      brand.darkLogoUrl ? `url("${brand.darkLogoUrl}")` : 'none',
    );
  }, [brand.logoUrl, brand.darkLogoUrl]);

  // Company fonts: apply a brand font stack to body and a distinct heading font.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-body', brand.fontFamily.trim() ? brandFontStack(brand.fontFamily) : '');
    const heading =
      brand.headingFont.trim()
        ? brandFontStack(brand.headingFont)
        : brand.fontFamily.trim()
          ? brandFontStack(brand.fontFamily)
          : '';
    root.style.setProperty('--font-heading', heading);
  }, [brand.fontFamily, brand.headingFont]);

  // Company fonts: load brand fonts from Google Fonts when a family is set.
  useEffect(() => {
    const families = new Set<string>();
    for (const f of [brand.fontFamily, brand.headingFont]) {
      const url = fontCssUrl(f);
      if (url) families.add(url);
    }
    if (families.size === 0) return;

    const links: HTMLLinkElement[] = [];
    families.forEach((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      links.push(link);
    });

    return () => links.forEach((link) => link.remove());
  }, [brand.fontFamily, brand.headingFont]);

  // Dashboard theme: apply the org's default theme only when the user has not
  // explicitly overridden it at the OS/application level.
  useEffect(() => {
    useThemeStore
      .getState()
      .setOrgTheme(
        brand.dashboardTheme === 'light' || brand.dashboardTheme === 'dark'
          ? brand.dashboardTheme
          : null,
      );
  }, [brand.dashboardTheme]);

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
