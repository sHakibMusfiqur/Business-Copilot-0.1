import type { ContainerLike, Token } from '../types';
import { tokenId } from '../types';
import { CircularDependencyError } from '../types';
import type { NormalizedProvider } from '../providers';


export function resolveToken<T>(
  id: string,
  providers: ReadonlyMap<string, NormalizedProvider>,
  state: ResolutionState,
  scope: Map<string, unknown>,
): T {
  const provider = providers.get(id);
  if (!provider) {
    throw new Error(`Container: token "${id}" is not registered.`);
  }

  // ── Lifetime cache read ───────────────────────────────────────────────────
  if (provider.lifetime === 'singleton') {
    if (state.singletons.has(id)) return state.singletons.get(id) as T;
  } else if (provider.lifetime === 'scoped' && scope.has(id)) {
    return scope.get(id) as T;
  }

  // ── Circular dependency detection ─────────────────────────────────────────
  if (state.stack.includes(id)) {
    throw new CircularDependencyError([...state.stack, id]);
  }

  state.stack.push(id);
  try {
    let instance: unknown;

    if (provider.provider !== 'factory') {
      // class or value
      if (provider.provider === 'value') {
        instance = provider.useValue;
      } else {
        const deps = provider.deps.map((depId) =>
          resolveToken(depId, providers, state, scope),
        );
        if (!provider.ctor) {
          throw new Error(`Container: token "${id}" has no class to construct.`);
        }
        instance = new provider.ctor(...deps);
      }
    } else {
      const api: ContainerLike = {
        resolve: <T2>(token: Token<T2>): T2 =>
          resolveToken(tokenId(token), providers, state, scope) as T2,
        has: (token: Token): boolean => providers.has(tokenId(token)),
      };
      if (!provider.useFactory) {
        throw new Error(`Container: token "${id}" has no factory.`);
      }
      instance = provider.useFactory(api);
    }

    // ── Persist per lifetime (transient is never stored) ────────────────────
    if (provider.lifetime === 'singleton') {
      state.singletons.set(id, instance);
    } else if (provider.lifetime === 'scoped') {
      scope.set(id, instance);
    }
    return instance as T;
  } finally {
    state.stack.pop();
  }
}

/** Shared mutable state over one resolution run. */
export interface ResolutionState {
  stack: string[];
  singletons: Map<string, unknown>;
}

/** Inputs required to execute a resolution. */
export interface ResolverInput {
  providers: ReadonlyMap<string, NormalizedProvider>;
}

export type { CircularDependencyError };