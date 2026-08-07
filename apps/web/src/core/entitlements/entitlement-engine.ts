import { PLAN_ENTITLEMENTS, FULL_ACCESS } from './plans';
import type { EntitlementContext, EntitlementInput } from './types';

export interface EntitlementEngine {
  resolve(input?: EntitlementInput): EntitlementContext;
  hasFeature: (ctx: EntitlementContext, feature: string) => boolean;
  hasModule: (ctx: EntitlementContext, moduleId: string) => boolean;
  limitOf: (ctx: EntitlementContext, limit: keyof EntitlementContext['limits']) => number;
}

export function createEntitlementEngine(): EntitlementEngine {
  return {
    resolve(input) {
      const profile = input?.plan ? PLAN_ENTITLEMENTS[input.plan] : undefined;
      if (!profile) {
        return {
          ...FULL_ACCESS,
          source: 'default',
          status: input?.status,
        };
      }
      const modules = { ...profile.modules };
      for (const moduleId of input?.modules ?? []) {
        modules[moduleId] = true;
      }
      return {
        ...profile,
        modules,
        features: { ...profile.features, ...input?.features },
        limits: { ...profile.limits, ...input?.limits },
        source: 'plan',
        status: input?.status,
      };
    },
    hasFeature: (ctx, feature) => ctx.features[feature] === true,
    hasModule: (ctx, moduleId) => ctx.modules[moduleId] !== false,
    limitOf: (ctx, limit) => ctx.limits[limit],
  };
}
