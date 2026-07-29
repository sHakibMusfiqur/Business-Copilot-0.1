# ADR-001: Event Bus Abstraction

## Status
Accepted

## Context
The provisioning system publishes real-time events (progress, completion, failure) consumed by SSE endpoints. Initially implemented with RxJS `Subject` directly in the orchestrator.

## Decision
Introduce `ProvisionEventBus` interface with `publish()`, `subscribe()`, and `getStream()` methods. Implement with `LocalEventBus` (wraps `Subject`). Orchestrator depends only on the interface.

## Consequences
- + Orchestrator no longer imports RxJS
- + Easy to swap backend (Redis, NATS, Kafka) via `EventBusFactory`
- + EventBusFactory enables provider registration at module init
- - Slight indirection for the common case

## Alternatives Considered
- Direct RxJS: Tight coupling, hard to test, impossible to swap
- Message queue without interface: Vendor lock-in
