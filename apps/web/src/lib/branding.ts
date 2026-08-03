import { HEX_RE } from './validation';

export interface BrandingTheme {
  brandName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  darkLogoUrl: string | null;
  faviconUrl: string | null;
  loginBackgroundUrl: string | null;
  loginIllustrationUrl: string | null;
  fontFamily: string;
  headingFont: string;
  dashboardTheme: 'light' | 'dark' | 'system' | 'default';
  letterheadEnabled: boolean;
  letterheadText: string;
  documentFooterText: string;
  invoiceFooterText: string;
  reportFooterText: string;
  emailFooterText: string;
}

export const DEFAULT_BRANDING: BrandingTheme = {
  brandName: 'Business Copilot',
  tagline: 'Enterprise ERP + AI Business Copilot Platform',
  primaryColor: '#3B82F6',
  secondaryColor: '#8B5CF6',
  accentColor: '#10B981',
  logoUrl: null,
  darkLogoUrl: null,
  faviconUrl: null,
  loginBackgroundUrl: null,
  loginIllustrationUrl: null,
  fontFamily: '',
  headingFont: '',
  dashboardTheme: 'default',
  letterheadEnabled: false,
  letterheadText: '',
  documentFooterText: '',
  invoiceFooterText: '',
  reportFooterText: '',
  emailFooterText: '',
};

export const SYSTEM_DEFAULT_FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function normalizeBranding(stored: Record<string, unknown> | null | undefined): BrandingTheme {
  const s = stored ?? {};
  const color = (value: unknown, fallback: string): string =>
    typeof value === 'string' && HEX_RE.test(value) ? value : fallback;
  const url = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;
  const text = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

  return {
    brandName:
      typeof s.brandName === 'string' && s.brandName.trim()
        ? s.brandName.trim()
        : DEFAULT_BRANDING.brandName,
    tagline: typeof s.tagline === 'string' ? s.tagline : '',
    primaryColor: color(s.primaryColor, DEFAULT_BRANDING.primaryColor),
    secondaryColor: color(s.secondaryColor, DEFAULT_BRANDING.secondaryColor),
    accentColor: color(s.accentColor, DEFAULT_BRANDING.accentColor),
    logoUrl: url(s.logoUrl),
    darkLogoUrl: url(s.darkLogoUrl),
    faviconUrl: url(s.faviconUrl),
    loginBackgroundUrl: url(s.loginBackgroundUrl),
    loginIllustrationUrl: url(s.loginIllustrationUrl),
    fontFamily: text(s.fontFamily),
    headingFont: text(s.headingFont),
    dashboardTheme:
      s.dashboardTheme === 'light' ||
      s.dashboardTheme === 'dark' ||
      s.dashboardTheme === 'system'
        ? s.dashboardTheme
        : 'default',
    letterheadEnabled: s.letterheadEnabled === true,
    letterheadText: text(s.letterheadText),
    documentFooterText: text(s.documentFooterText),
    invoiceFooterText: text(s.invoiceFooterText),
    reportFooterText: text(s.reportFooterText),
    emailFooterText: text(s.emailFooterText),
  };
}

/** A plain app-default font stack with the chosen brand family first. */
export function brandFontStack(family: string): string {
  const trimmed = family.trim().replace(/["']/g, '');
  if (!trimmed) return SYSTEM_DEFAULT_FONT;
  return `'${trimmed}', ${SYSTEM_DEFAULT_FONT}`;
}

const GOOGLE_FONT_RE = /^[A-Za-z0-9][A-Za-z0-9 _'-]{0,60}$/;

/** True when the value is a safe Google Fonts family name (can be injected). */
export function isGoogleFont(name: string): boolean {
  const trimmed = name.trim().replace(/["']/g, '');
  if (!trimmed || trimmed.includes(',')) return false;
  return GOOGLE_FONT_RE.test(trimmed);
}

export function fontCssUrl(family: string): string | null {
  const trimmed = family.trim().replace(/["']/g, '');
  if (!isGoogleFont(family)) return null;
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(trimmed)}&display=swap`;
}

/** Returns the logo to use on a light or dark surface. */
export function resolveLogo(
  brand: Pick<BrandingTheme, 'logoUrl' | 'darkLogoUrl'>,
  opts?: { dark?: boolean },
): string | null {
  if (opts?.dark && brand.darkLogoUrl) return brand.darkLogoUrl;
  return brand.logoUrl;
}

/** Document brand context used by PDF / invoice / report / letterhead surfaces. */
export function documentBrand(brand: BrandingTheme): {
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  headingFont: string;
  letterheadEnabled: boolean;
  letterheadText: string;
  footerText: string;
} {
  return {
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    accentColor: brand.accentColor,
    fontFamily: brandFontStack(brand.fontFamily),
    headingFont: brand.headingFont.trim() ? brandFontStack(brand.headingFont) : brandFontStack(brand.fontFamily),
    letterheadEnabled: brand.letterheadEnabled,
    letterheadText: brand.letterheadText,
    footerText: brand.documentFooterText,
  };
}

/** Email brand context used by the branded email template. */
export function emailBrand(brand: BrandingTheme): {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  companyName: string;
  tagline: string;
  fontFamily: string;
  footerText: string;
} {
  return {
    companyName: brand.brandName,
    tagline: brand.tagline,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    accentColor: brand.accentColor,
    logoUrl: brand.logoUrl,
    fontFamily: brand.fontFamily,
    footerText: brand.emailFooterText,
  };
}

export function hexToHsl(hex: string): string {
  const match = hex.match(HEX_RE);
  if (!match) return '221.2 83.2% 53.3%';

  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  h *= 60;

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const match = hex.match(HEX_RE);
  if (!match) return `rgba(59, 130, 246, ${alpha})`;

  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 0xff}, ${(value >> 8) & 0xff}, ${value & 0xff}, ${alpha})`;
}

export function pickForeground(hex: string): string {
  const match = hex.match(HEX_RE);
  if (!match) return '#ffffff';

  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
}

export function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'BC';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const CACHE = new Map<string, BrandingTheme>();
const LAST_ORG_KEY = 'bc_last_org';
const brandKey = (orgId: string) => `bc_brand:${orgId}`;

export function readBrandCache(orgId: string): BrandingTheme | null {
  return CACHE.get(orgId) ?? null;
}

export function writeBrandCache(orgId: string, brand: BrandingTheme): void {
  CACHE.set(orgId, brand);
}

export function readStoredBrand(orgId: string): BrandingTheme | null {
  try {
    const raw = localStorage.getItem(brandKey(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BrandingTheme>;
    return normalizeBranding(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function writeStoredBrand(orgId: string, brand: BrandingTheme): void {
  try {
    localStorage.setItem(brandKey(orgId), JSON.stringify(brand));
    localStorage.setItem(LAST_ORG_KEY, orgId);
  } catch {
    // storage unavailable — cache in memory only
  }
}

export function readLastOrgId(): string | null {
  try {
    return localStorage.getItem(LAST_ORG_KEY);
  } catch {
    return null;
  }
}
