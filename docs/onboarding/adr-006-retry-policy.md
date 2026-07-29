# ADR-006: Retry Policy with Transient Error Detection

## Status
Accepted

## Context
Provisioning involves external dependencies (database, subscriptions, potentially third-party APIs). Transient failures (timeouts, deadlocks, connection drops) should retry. Non-transient failures (validation errors, not-found, auth failures) should fail fast.

## Decision
Implement `isTransientError(error: Error): boolean` predicate that inspects error message and name against known transient/non-transient patterns. Transient patterns: `timeout`, `deadlock`, `ECONNREFUSED`, `5xx`, `rate limit`, etc. Non-transient patterns: `not found`, `invalid`, `unauthorized`, `Unique constraint`, etc. Unknown errors default to transient (retry-safe).

## Consequences
- + Non-transient errors fail immediately, preserving resources
- + Transient errors retry with exponential backoff (1s, 2s, 4s, max 30s)
- + Easy to extend patterns without changing retry service
- + Metrics track retry counts per session
- - Heuristic pattern matching may misclassify edge cases

## Alternatives Considered
- Retry all errors: Wastes resources on permanent failures
- Never retry: Fragile in production with transient network issues
- HTTP status code mapping: Not applicable for non-HTTP errors (DB deadlocks, etc.)
