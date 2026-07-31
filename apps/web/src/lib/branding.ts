import { HEX_RE } from './validation';

export interface BrandingTheme {
  brandName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export const DEFAULT_BRANDING: BrandingTheme = {
  brandName: 'Business Copilot',
  tagline: 'Enterprise ERP + AI Business Copilot Platform',
  primaryColor: '#3B82F6',
  secondaryColor: '#8B5CF6',
  accentColor: '#10B981',
  logoUrl: null,
  faviconUrl: null,
};

export function normalizeBranding(stored: Record<string, unknown> | null | undefined): BrandingTheme {
  const s = stored ?? {};
  const color = (value: unknown, fallback: string): string =>
    typeof value === 'string' && HEX_RE.test(value) ? value : fallback;
  const url = (value: unknown): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;

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
    faviconUrl: url(s.faviconUrl),
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
