import { stableSerialize } from '../utils/hash';
import type {
  CachedQuery,
  Query,
  QueryDefinition,
  QueryHandler,
  QueryResponse,
  QueryBusSnapshot,
} from './types';

interface CacheEntry extends CachedQuery<Query, QueryResponse> {
  readonly type: string;
}

interface QueryRegistration {
  handler: QueryHandler<Query, QueryResponse>;
  cache: Readonly<QueryOptions>;
}

/**
 * Query Bus — the read side of the platform's CQRS-style backbone.
 *
 * Registers typed query handlers and resolves them, optionally caching results
 * per query instance with a TTL. Caching is opt-in per query type; entries are
 * keyed by a deterministic serialization so identical queries share a result.
 */
export class QueryBus {
  private readonly handlers = new Map<string, QueryRegistration>();
  private readonly cache = new Map<string, CacheEntry>();

  /** Register a query handler. Returns false when the query is already bound. */
  register<Q extends Query, R extends QueryResponse>(definition: QueryDefinition<Q, R>): boolean {
    if (this.handlers.has(definition.type)) return false;
    const ttlMs = Math.max(0, definition.ttlMs ?? 0);
    const cacheKey = (definition.cacheKey ?? ((query: Query): string => stableSerialize(query))) as (query: Query) => string;
    this.handlers.set(definition.type, {
      handler: definition.handler as QueryHandler<Query, QueryResponse>,
      cache: { ttlMs, cacheKey },
    });
    return true;
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  /** Resolve a query. For cached types, returns the cached result when valid. */
  async execute<Q extends Query, R extends QueryResponse>(
    query: Q,
    options: { forceFresh?: boolean; ttlMs?: number } = {},
  ): Promise<R> {
    const registration = this.handlers.get(query.type);
    if (!registration) {
      throw new Error(`Query handler not registered: ${query.type}`);
    }
    const key = registration.cache.cacheKey(query);
    const ttlMs = options.ttlMs ?? registration.cache.ttlMs;
    const mayCache = ttlMs > 0;

    if (mayCache && !options.forceFresh) {
      const cached = this.cache.get(key);
      if (cached && (cached.expiresAt === undefined || cached.expiresAt > Date.now())) {
        return cached.result as R;
      }
    }

    const result = await registration.handler(query);
    if (mayCache) {
      const now = Date.now();
      this.cache.set(key, { type: query.type, query, result, createdAt: now, expiresAt: now + ttlMs });
    }
    return result as R;
  }

  /** Drop a single cached query instance (by cache key). */
  invalidate<Q extends Query>(query: Q): boolean {
    const registration = this.handlers.get(query.type);
    if (!registration) return false;
    return this.cache.delete(registration.cache.cacheKey(query));
  }

  /** Drop every cached entry of a query type. */
  clearType(type: string): void {
    for (const [key, entry] of this.cache) {
      if (entry.type === type) this.cache.delete(key);
    }
  }

  /** Drop the entire result cache; handlers remain registered. */
  clearCache(): void {
    this.cache.clear();
  }

  /** Snapshot of registered queries and the cache. */
  snapshot(): QueryBusSnapshot {
    return {
      queryCount: this.handlers.size,
      cachedCount: this.cache.size,
      cacheSize: this.cache.size,
      types: [...this.handlers.keys()],
    };
  }
}

interface QueryOptions {
  readonly ttlMs: number;
  readonly cacheKey: (query: Query) => string;
}

/** Create a new query bus. */
export function createQueryBus(): QueryBus {
  return new QueryBus();
}