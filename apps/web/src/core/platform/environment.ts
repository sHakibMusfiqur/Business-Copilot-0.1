import type { IndustryKey, RoleKey } from '@/core/types';

export interface BrowserContext {
  locale: string;
  timezone: string;
  platform: string;
  viewport: 'mobile' | 'tablet' | 'desktop' | 'wide';
}

export interface RuntimeContext {
  runtime: 'next';
  env: 'development' | 'production';
  nextPublicUrl?: string;
}

export interface FeatureFlags {
  aiEnabled: boolean;
  commandPaletteEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface EnvironmentContext {
  isServer: boolean;
  isClient: boolean;
  browser: BrowserContext;
  runtime: RuntimeContext;
  features: FeatureFlags;
}

function readBrowser(): BrowserContext {
  if (typeof window === 'undefined') {
    return {
      locale: 'en-US',
      timezone: 'UTC',
      platform: 'server',
      viewport: 'desktop',
    };
  }
  const width = window.innerWidth;
  const viewport =
    width < 640 ? 'mobile' : width < 1024 ? 'tablet' : width < 1536 ? 'desktop' : 'wide';
  return {
    locale: window.navigator.language || 'en-US',
    timezone: window.Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    platform: window.navigator.platform || 'unknown',
    viewport,
  };
}

function readFeatureFlags(): FeatureFlags {
  return {
    aiEnabled: process.env.NEXT_PUBLIC_AI_ENABLED !== 'false',
    commandPaletteEnabled: true,
    notificationsEnabled: true,
  };
}

/** Resolves the current platform environment. Safe to call on the server. */
export function resolveEnvironment(): EnvironmentContext {
  const isServer = typeof window === 'undefined';
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    isServer,
    isClient: !isServer,
    browser: readBrowser(),
    runtime: {
      runtime: 'next',
      env: nodeEnv === 'production' ? 'production' : 'development',
      nextPublicUrl: process.env.NEXT_PUBLIC_APP_URL,
    },
    features: readFeatureFlags(),
  };
}

/** Platform role mapping used by the workspace to surface role context. */
export const PLATFORM_ROLE_KEYS: readonly RoleKey[] = [
  'super-admin',
  'owner',
  'ceo',
  'coo',
  'manager',
  'finance',
  'hr',
  'sales',
  'inventory',
  'support',
  'employee',
  'guest',
];

/** Industry catalog used to validate persisted workspace context. */
export const PLATFORM_INDUSTRY_KEYS: readonly IndustryKey[] = [
  'restaurant',
  'hospital',
  'manufacturing',
  'school',
  'software',
  'retail',
  'pharmacy',
  'garments',
  'it-services',
  'general',
];
