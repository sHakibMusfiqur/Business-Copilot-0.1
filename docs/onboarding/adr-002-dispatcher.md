# ADR-002: Dispatcher Abstraction

## Status
Accepted

## Context
Provisioning executes synchronously in the HTTP request lifecycle. Future requirements include async execution via queues, scheduled execution, and remote workers.

## Decision
Introduce `ProvisionDispatcher` interface with a single `dispatch(sessionId)` method. `ImmediateExecutionDispatcher` calls the orchestrator synchronously. Future implementations (Queue, Scheduler, Remote) plug in via `DispatcherFactory`.

## Consequences
- + Engine does not change when execution strategy changes
- + Easy to add queue-based execution (BullMQ, RabbitMQ) without modifying orchestration logic
- + DispatcherFactory enables runtime configuration
- - Slight indirection

## Alternatives Considered
- Direct orchestrator call: Simple but not extensible
- Strategy pattern via module-level binding: Works but less flexible than factory
