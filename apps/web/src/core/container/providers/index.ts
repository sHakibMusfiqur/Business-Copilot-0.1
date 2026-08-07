import type {
  ClassProvider,
  ContainerLike,
  ContainerToken,
  FactoryProvider,
  Lifetime,
  Provider,
  ProviderKind,
  Token,
  ValueProvider,
} from '../types';
import { tokenId } from '../types';

/** Internal normalized record — the resolved execution shape. */
export interface NormalizedProvider {
  /** Canonical token id this provider resolves. */
  tokenId: string;
  name: string;
  provider: ProviderKind;
  lifetime: Lifetime;
  deps: readonly string[];
  /** For class providers — instantiated with resolved deps. */
  ctor?: new (...deps: unknown[]) => unknown;
  /** For factory providers — builds from the container. */
  useFactory?: (container: ContainerLike) => unknown;
  /** For value providers — the prebuilt instance. */
  useValue?: unknown;
}

/**
 * Normalize a provider declaration into its internal execution shape.
 * Effective lifetime defaults to `singleton` unless the provider declares one.
 */
export function normalizeProvider<T>(input: Provider<T>): NormalizedProvider {
  const id = tokenId(input.token);
  switch (input.kind) {
    case 'value':
      return {
        tokenId: id,
        name: input.token.name,
        provider: 'value',
        lifetime: 'singleton',
        deps: [],
        useValue: input.useValue,
      };
    case 'class':
      return {
        tokenId: id,
        name: input.token.name,
        provider: 'class',
        lifetime: input.lifetime ?? 'singleton',
        ctor: input.useClass,
        deps: (input.deps ?? []).map(tokenId),
      };
    case 'factory':
      return {
        tokenId: id,
        name: input.token.name,
        provider: 'factory',
        lifetime: input.lifetime ?? 'singleton',
        deps: [],
        useFactory: input.useFactory,
      };
  }
}

/** Convenience constructor for a value provider. */
export function valueProvider<T>(
  token: ContainerToken<T>,
  useValue: T,
): ValueProvider<T> {
  return { kind: 'value', token, useValue };
}

/** Convenience constructor for a factory provider. */
export function factoryProvider<T>(
  token: ContainerToken<T>,
  useFactory: (container: ContainerLike) => T,
  lifetime: Lifetime = 'singleton',
): FactoryProvider<T> {
  return { kind: 'factory', token, useFactory, lifetime };
}

/** Convenience constructor for a class provider. */
export function classProvider<T>(
  token: ContainerToken<T>,
  useClass: new (...deps: unknown[]) => T,
  deps: readonly Token[] = [],
  lifetime: Lifetime = 'singleton',
): ClassProvider<T> {
  return { kind: 'class', token, useClass, deps, lifetime };
}

export type { Provider };