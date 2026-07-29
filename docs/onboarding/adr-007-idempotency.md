# ADR-007: Database-Backed Idempotency

## Status
Accepted

## Context
Provisioning is a non-idempotent operation (creates org, subscription, roles). Network retries or client double-submit could create duplicate organizations. An idempotency mechanism was required.

## Decision
Create an `IdempotencyRecord` table with columns `key` (unique), `response` (JSON), `expiresAt`. The `IdempotencyGuard` extracts an idempotency key from the request header. If a record exists for the key, the cached response is returned instead of executing the operation. After execution, the response is cached.

## Consequences
- + Guarantees exactly-once semantics for provisioning requests
- + Cached responses avoid duplicate org creation
- + TTL-based expiration prevents unbounded table growth
- + Cleanup job removes expired records daily
- + Sensitive fields (password, token, apiKey) filtered before caching
- - Requires clients to send an idempotency key
- - Slight latency for the upsert operation

## Alternatives Considered
- In-memory cache: Lost on restart, not distributed
- API-level deduplication (composite key of method+path+body): More complex, less explicit
- Database unique constraints alone: Cannot prevent duplicate across retries with different params
