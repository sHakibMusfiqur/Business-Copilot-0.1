import type { EnvironmentContext } from '../environment';

/** Lifecycle phase of the platform application. */
export type PlatformPhase = 'uninitialized' | 'booting' | 'ready' | 'failed';

/** Lifecycle status of a registered engine. */
export type EngineStatus = 'registered' | 'initializing' | 'ready' | 'failed' | 'disabled';

/** Functional category of a registered engine. */
export type EngineKind =
  | 'core'
  | 'workspace'
  | 'service'
  | 'plugin'
  | 'workflow'
  | 'automation'
  | 'ai'
  | 'notification'
  | 'search'
  | 'storage'
  | 'feature-flags'
  | 'rules'
  | 'integration'
  | 'webhook'
  | 'event-bus'
  | 'analytics'
  | 'sdk';

/** Engine health verdict. */
export type EngineHealthStatus = 'ok' | 'degraded' | 'unknown';

/** Health snapshot for a registered engine. */
export interface EngineHealth {
  status: EngineHealthStatus;
  message?: string;
  checkedAt: string;
}

/** Static engine identity + metadata (never mutates after registration). */
export interface EngineDescriptor {
  id: string;
  name: string;
  description?: string;
  version: string;
  kind: EngineKind;
  dependencies?: readonly string[];
}

/** Full registered record: descriptor + dynamic status + implementation. */
export interface EngineRecord<T extends object> extends EngineDescriptor {
  status: EngineStatus;
  health: EngineHealth;
  implementation: T;
}

/** Input accepted by `registerEngine`. */
export interface EngineRegistrationInput {
  id: string;
  name: string;
  description?: string;
  version: string;
  kind: EngineKind;
  dependencies?: readonly string[];
  implementation: unknown;
}

/** Immutable platform/application metadata. */
export interface PlatformMetadata {
  name: string;
  codeName: string;
  shortName: string;
  vendor: string;
  version: string;
}

/** Build information for the running platform bundle. */
export interface BuildInfo {
  id: string;
  environment: 'development' | 'production';
  builtAt: string;
}

/** Current signed-in principal + tenant, populated by the host application. */
export interface PlatformSession {
  user: { id: string; email: string; name: string } | null;
  tenantId: string | null;
  organizationName: string | null;
}

/** Centralized platform runtime context — the global platform state. */
export interface PlatformContext {
  platform: PlatformMetadata;
  build: BuildInfo;
  environment: EnvironmentContext;
  session: PlatformSession;
  phase: PlatformPhase;
}

/** Aggregate platform status snapshot. */
export interface PlatformStatus {
  phase: PlatformPhase;
  engineCount: number;
  readyEngines: number;
  failedEngines: number;
  healthy: boolean;
}

/** Catalog entry for an engine a future phase will implement. */
export interface ReservedEngine {
  id: string;
  name: string;
  kind: EngineKind;
}
