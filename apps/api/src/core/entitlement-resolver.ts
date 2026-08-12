import type {
  EntitlementContext,
  EntitlementInput,
  UsageLimits,
} from '@bc/core';

/**
 * Conservative default usage limits for the fallback entitlement profile. These
 * mirror the existing `free` plan configuration (see `apps/api/prisma/seed.ts`)
 * and the application's default 30-day trial, so no business limits are
 * invented here.
 */
const DEFAULT_LIMITS: UsageLimits = {
  users: 5,
  customers: 50,
  products: 50,
  storageGb: 1,
  aiCredits: 0,
};

const DEFAULT_TRIAL_DAYS = 30;
const DEFAULT_PLAN_KEY = 'default';
const DEFAULT_PLAN_NAME = 'Default';

/** Canonical order of `UsageLimits` fields used to merge partial overrides. */
const USAGE_LIMIT_KEYS = [
  'users',
  'customers',
  'products',
  'storageGb',
  'aiCredits',
] as const;

function dedupeModules(modules: readonly string[]): string[] {
  return Array.from(new Set(modules)).sort();
}

/**
 * Pure, framework-independent entitlement resolver. Converts an optional
 * entitlement input into a canonical `@bc/core` `EntitlementContext`.
 *
 * It only performs deterministic normalization and merging:
 *  - `source` is `'plan'` when a non-empty `plan` is supplied, else `'default'`.
 *  - `features` merge onto an empty base (explicit `false` is preserved).
 *  - `modules` are de-duplicated and deterministically ordered into a map.
 *  - `limits` merge `Partial<UsageLimits>` over conservative defaults.
 *  - `status` is preserved when provided, otherwise omitted.
 *
 * It never queries a DB, touches Prisma/HTTP, calls billing services, performs
 * usage/limit enforcement, or holds mutable state between calls.
 */
export class EntitlementResolver {
  resolve(input?: EntitlementInput | null): EntitlementContext {
    const hasInput = input !== undefined && input !== null;
    const plan = hasInput && typeof input.plan === 'string' ? input.plan.trim() : '';
    const hasPlan = plan.length > 0;

    const features: Record<string, boolean> = {};
    if (hasInput && input.features) {
      for (const [name, value] of Object.entries(input.features)) {
        features[name] = value;
      }
    }

    const modules: Record<string, boolean> = {};
    if (hasInput && Array.isArray(input.modules)) {
      for (const moduleId of dedupeModules(input.modules)) {
        modules[moduleId] = true;
      }
    }

    const limits: UsageLimits = { ...DEFAULT_LIMITS };
    if (hasInput && input.limits) {
      const partial = input.limits as Partial<UsageLimits>;
      for (const key of USAGE_LIMIT_KEYS) {
        const value = partial[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
          limits[key] = value;
        }
      }
    }

    const context: EntitlementContext = {
      key: hasPlan ? plan : DEFAULT_PLAN_KEY,
      name: hasPlan ? plan : DEFAULT_PLAN_NAME,
      features,
      modules,
      limits,
      trialDays: DEFAULT_TRIAL_DAYS,
      source: hasPlan ? 'plan' : 'default',
    };

    if (hasInput && typeof input.status === 'string' && input.status.length > 0) {
      context.status = input.status;
    }

    return context;
  }
}