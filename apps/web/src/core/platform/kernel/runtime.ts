import { resolveEnvironment, type EnvironmentContext } from '../environment';
import { BUILD_INFO, PLATFORM_METADATA } from './metadata';
import type { PlatformContext, PlatformSession } from './types';

/** Baseline session before the host application populates it. */
export const EMPTY_SESSION: PlatformSession = {
  user: null,
  tenantId: null,
  organizationName: null,
};

export function createPlatformContext(environment?: EnvironmentContext): PlatformContext {
  return {
    platform: PLATFORM_METADATA,
    build: BUILD_INFO,
    environment: environment ?? resolveEnvironment(),
    session: { ...EMPTY_SESSION },
    phase: 'uninitialized',
  };
}
