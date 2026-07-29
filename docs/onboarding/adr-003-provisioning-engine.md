# ADR-003: Provisioning Engine Architecture

## Status
Accepted

## Context
Provisioning spans 7 checkpoints, each creating DB records. Failures at any point must roll back cleanly. The system must support retry with resume from the last failed checkpoint.

## Decision
Split into four services:
- **Engine**: Entry point, manages status transitions, metrics, audit, checklist init
- **Orchestrator**: Coordinates retry loop, emits events, calls industry lifecycle hooks
- **Executor**: Runs 7 checkpoints sequentially inside a DB transaction
- **RetryService**: Exponential backoff with transient/non-transient error policy

## Consequences
- + Single Responsibility: each service has one clear job
- + Checkpoint resume: executor starts from the last failed checkpoint
- + Transaction safety: all 7 checkpoints share one `$transaction`
- + Retry policy: transient errors retry, non-transient errors throw immediately
- - More files to maintain

## Alternatives Considered
- Monolithic service: 500+ lines, hard to test, violates SRP
- Per-checkpoint services: Too granular, adds configuration overhead
