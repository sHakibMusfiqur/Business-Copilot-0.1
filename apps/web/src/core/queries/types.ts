export type Query = { readonly type: string } & Record<string, unknown>;

/** The resolved payload returned by a query handler. */
export type QueryResponse = unknown;

/** Options applied to a single query execution. */
export interface QueryOptions {
  /** Bypass the read cache for this call. */
  readonly forceFresh?: boolean;
  /** Override the query's declared TTL for this call (ms). */
  readonly ttlMs?: number;
}

/** Handler for a query — maps a query to a typed response. May be async. */
export type QueryHandler<Q extends Query, R extends QueryResponse> = (query: Q) => R | Promise<R>;

/** Query descriptor: metadata + handler + caching policy. */
export interface QueryDefinition<Q extends Query, R extends QueryResponse> {
  readonly type: string;
  readonly handler: QueryHandler<Q, R>;
  readonly description?: string;
  /** Cache TTL in ms. When omitted, the query is not cached. */
  readonly ttlMs?: number;
  /** Key builder for cached entries; defaults to JSON of the query. */
  readonly cacheKey?: (query: Q) => string;
}

/** A cached result entry, with an optional absolute expiry. */
export interface CachedQuery<Q extends Query, R extends QueryResponse> {
  readonly query: Q;
  readonly result: R;
  readonly createdAt: number;
  readonly expiresAt?: number;
}

/** Immutable snapshot of the query registry + cache. */
export interface QueryBusSnapshot {
  readonly queryCount: number;
  readonly cachedCount: number;
  readonly cacheSize: number;
  readonly types: readonly string[];
}