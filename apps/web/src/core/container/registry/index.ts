import type {
  ContainerOptions,
  ContainerSnapshot,
  Lifetime,
  Provider,
  Token,
} from '../types';
import { DuplicateTokenError, tokenId, UnregisteredTokenError } from '../types';
import { normalizeProvider, type NormalizedProvider } from '../providers';
import { resolveToken, type ResolutionState } from '../resolver';
import { buildSnapshot } from '../snapshot';
import { CONTAINER_VERSION, DEFAULT_LIFETIME, LIFETIMES } from '../metadata';

/** Shared core referenced by the root and every derived scope. */
interface ContainerCore {
  providers: Map<string, NormalizedProvider>;
  singletons: Map<string, unknown>;
}

/**
 * The container.
 */
export class Container {
  readonly name: string;
  readonly version = CONTAINER_VERSION;

  private readonly core: ContainerCore;
  /** Scoped instances for this container (isolated per scope). */
  private readonly scoped = new Map<string, unknown>();

  constructor(options: ContainerOptions = {}) {
    this.name = options.name ?? 'platform';
    this.core = { providers: new Map(), singletons: new Map() };
  }

  /**
   * Internal scope constructor — shares the parent core, fresh scoped map.
   * Kept private so callers always go through `scope()`.
   */
  private static fromCore(core: ContainerCore, name: string): Container {
    const branch = Object.create(Container.prototype) as Container;
    Object.defineProperty(branch, 'name', {
      value: name,
      writable: true,
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(branch, 'core', {
      value: core,
      writable: true,
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(branch, 'scoped', {
      value: new Map<string, unknown>(),
      writable: true,
      enumerable: false,
      configurable: true,
    });
    return branch;
  }

  // ── Registration ──────────────────────────────────────────────────────────

  /** Register a provider. Throws on duplicate token. Returns the container. */
  register<T>(provider: Provider<T>): this {
    const normalized = normalizeProvider(provider);
    const id = normalized.tokenId;
    if (this.core.providers.has(id)) {
      throw new DuplicateTokenError(id);
    }
    this.core.providers.set(id, normalized);
    return this;
  }

  /** Register many providers at once. */
  registerAll(providers: readonly Provider[]): this {
    for (const provider of providers) this.register(provider);
    return this;
  }

  /** Whether a token is registered (never instantiates). */
  has(token: Token): boolean {
    return this.core.providers.has(tokenId(token));
  }

  /** Remove a token and its cached instances. Returns true when removed. */
  unregister(token: Token): boolean {
    const id = tokenId(token);
    const removed = this.core.providers.delete(id);
    if (removed) {
      this.core.singletons.delete(id);
      this.scoped.delete(id);
    }
    return removed;
  }

  /** Swap a token's provider. Throws when the token is not registered. */
  override<T>(provider: Provider<T>): this {
    const id = tokenId(provider.token);
    if (!this.core.providers.has(id)) {
      throw new UnregisteredTokenError(id);
    }
    const normalized = normalizeProvider(provider);
    if (normalized.tokenId !== id) {
      throw new Error(`Container: override provider must target token "${id}".`);
    }
    this.core.singletons.delete(id);
    this.scoped.delete(id);
    this.core.providers.set(id, normalized);
    return this;
  }

  // ── Resolution ────────────────────────────────────────────────────────────

  /** Resolve a token lazily, with cache reads and cycle detection. */
  resolve<T>(token: Token<T>): T {
    const state: ResolutionState = { stack: [], singletons: this.core.singletons };
    return resolveToken<T>(tokenId(token), this.core.providers, state, this.scoped);
  }

  /** Derive a child scope sharing singletons but isolating scoped instances. */
  scope(name?: string): Container {
    return Container.fromCore(this.core, name ?? `${this.name}:scope`);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** Drop every provider and cached instance. */
  clear(): this {
    this.core.providers.clear();
    this.core.singletons.clear();
    this.scoped.clear();
    return this;
  }

  // ── Introspection ─────────────────────────────────────────────────────────

  /** Lifetime of a token, if registered. */
  lifetimeOf(token: Token): Lifetime | undefined {
    return this.core.providers.get(tokenId(token))?.lifetime;
  }

  /** Immutable snapshot of the registry. */
  snapshot(): ContainerSnapshot {
    return buildSnapshot({
      providers: this.core.providers,
      instantiated: new Set([...this.core.singletons.keys(), ...this.scoped.keys()]),
    });
  }

  /** Number of registered providers. */
  get size(): number {
    return this.core.providers.size;
  }

  /** All supported lifetimes. */
  lifetimes(): readonly Lifetime[] {
    return LIFETIMES;
  }

  /** Default lifetime applied when a provider declares none. */
  default(): Lifetime {
    return DEFAULT_LIFETIME;
  }
}

/** Default platform container instance. */
export const container: Container = new Container({ name: 'platform' });

export type { ContainerOptions };