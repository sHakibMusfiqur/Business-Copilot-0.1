import { CONTAINER_ENGINE_VERSION, type Lifetime, type ProviderKind } from '../types';

/** Current DI container schema version. */
export const CONTAINER_VERSION: string = CONTAINER_ENGINE_VERSION;

/** All supported lifetimes, in display order. */
export const LIFETIMES: readonly Lifetime[] = ['singleton', 'scoped', 'transient'];

/** All supported provider kinds. */
export const PROVIDER_KINDS: readonly ProviderKind[] = ['class', 'factory', 'value'];

/** Default lifetime applied to every provider. */
export const DEFAULT_LIFETIME: Lifetime = 'singleton';

/** Descriptive catalog of the DI model. */
export const CONTAINER_METADATA = {
  version: CONTAINER_ENGINE_VERSION,
  lifetimes: [...LIFETIMES],
  providerKinds: [...PROVIDER_KINDS],
  note: 'Enterprise Dependency Injection Foundation (non-NestJS, no decorators, no reflection).',
} as const;

export type { Lifetime, ProviderKind };