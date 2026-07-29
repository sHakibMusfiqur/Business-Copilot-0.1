# ADR-005: Session Versioning (Optimistic Concurrency Control)

## Status
Accepted

## Context
Multi-page onboarding wizard can be open in multiple browser tabs. Simultaneous updates would cause data loss. The MVC pattern (model-view-controller) frontend and decoupled API require a server-side conflict detection mechanism.

## Decision
Use Optimistic Concurrency Control (OCC) with a `version` integer column. Each `updateSession` call includes the client's known version. The `updateMany` call checks `WHERE version = :clientVersion`. If zero rows affected, a conflict is detected and a structured `SessionConflictError` is thrown with `conflictVersion`, `incomingVersion`, `changedFields`, and `timestamp`.

## Consequences
- + No locks, no deadlocks, no performance overhead
- + Client can display a meaningful "modified by another device" message
- + Structured error payload enables automatic reload, merge, or overwrite
- - Client must always send the known version
- - Last writer wins if clients ignore conflict errors

## Alternatives Considered
- Pessimistic locking: Would block concurrent wizard usage, poor UX
- Last-write-wins without version: Silent data loss
- ETags: Equivalent but requires header plumbing; version is simpler for JSON API
