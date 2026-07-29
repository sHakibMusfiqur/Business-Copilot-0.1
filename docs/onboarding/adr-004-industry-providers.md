# ADR-004: Industry Provider Lifecycle

## Status
Accepted

## Context
Each industry (retail, manufacturing, hospitality, services) requires specific provisioning logic: chart of accounts, tax defaults, inventory categories, etc. A clean extension mechanism was needed.

## Decision
Define `IndustryTemplateProvider` interface with 5 lifecycle hooks: `validate`, `prepare`, `provision`, `postProvision`, `cleanup`. Base class provides default no-op implementations. Providers registered via `IndustryTemplateFactory`.

## Consequences
- + New industries added by creating one class + registering it
- + Lifecycle hooks map to transaction boundaries clearly
- + Default no-ops minimize boilerplate for simple providers
- + Hook names document the intended side effects

## Alternatives Considered
- Single method: Insufficient for multi-phase provisioning
- Configuration-only approach: Too rigid, cannot handle complex industry logic
- Inheritance hierarchy: Leads to deep, fragile class hierarchies
