# Business Copilot

A multi-tenant business management platform built as a modular monorepo: a
NestJS API backend, a Next.js frontend that ships a client-side Business OS
kernel, and shared packages for database/tenancy helpers and shared types.

## Monorepo structure

This repository is a [turborepo](https://turbo.build) + npm workspaces monorepo.

```
apps/
  api/    NestJS backend (Prisma + PostgreSQL, JWT auth, Redis)
  web/    Next.js frontend (App Router) with the Business OS kernel (src/core)
packages/
  db/     @bc/db — tenancy / row-level-security helpers
  types/  @bc/types — shared TypeScript types (auth, billing, provisioning)
docs/
  onboarding/  ADRs, operations guide, provider SDK, phase plans
```

Root `package.json` wires the workspaces and common scripts (`dev`, `build`,
`lint`, `test`, `db:*`, `docker:*`). `turbo.json` defines the shared task graph
and cache/output rules.

## Business OS kernel (web)

The frontend carries a client-side modular OS under `apps/web/src/core/`:

- **platform/kernel** — engine registry, bootstrap, lifecycle, runtime.
- **modules** — module engine, registry, lifecycle, controller.
- **capabilities**, **permissions**, **entitlements** — gating engines.
- **workspace**, **layout**, **theme**, **dashboard** — shell + presentation.
- **plugins**, **services**, **workflow**, **automation** — extensibility.
- **commands / queries / events** — message buses.
- **manifest**, **sdk** — kernel metadata + extension SDK.

Entry point: `apps/web/src/core/kernel.ts` → `platform/kernel/bootstrap`.

## Domain modules

The API is organized into feature modules in `apps/api/src/`. Each domain owns
its controller, service, and Prisma usage:

- accounting, billing, audit, auth
- categories, crm, customers, departments
- inventory, invitations, mail, onboarding, organization
- platform-admin, products, purchase, rbac, sales, settings, suppliers, system, users

The onboarding module additionally ships a provisioning engine (event bus,
dispatcher, retry, idempotency, industry templates) — see the ADRs.

## Core vs domain boundary

- **Core** is the reusable engine/platform layer: the web Business OS kernel,
  shared tenancy helpers (`@bc/db`), and shared contracts (`@bc/types`).
- **Domain** is the set of vertical business modules that consume the core
  (products, sales, purchase, accounting, crm, etc.).

The boundary keeps engine concerns (layout, gating, messaging, tenancy)
separate from vertical business rules.

## Dashboard engine

Dashboard rendering is resolved by a client-side **DashboardEngine**
(`apps/web/src/core/dashboard/`) that memoizes a per-context
`DashboardManifest` (widget zones/layout) driven by role, industry, plan,
capabilities, permissions, features, and plugins. A simple renderer maps that
manifest to the UI (see `components/workspace/executive-workspace.tsx`). The
API provides the data via `apps/api/src/dashboard/dashboard.service.ts`, whose
panels and insights are permission-gated server-side.

## Permission / entitlement architecture

- **API**: JWT auth (`auth/strategies/jwt.strategy`), global throttler +
  exception filter, decorators (`@Public`, `@Roles`, `@Permissions`), guards
  (`jwt-auth`, `roles`, `permission`, `auth-throttle`), and an RBAC module with
  Permission / Role / RolePermission / UserRoleAssignment models.
- **Web**: `core/permissions` permission engine + `hooks/use-permissions` +
  `components/rbac/require-permission`, plus `core/entitlements` for plan-level
  gates and `core/capabilities` for capability gates.

## Tenancy architecture

Multi-tenancy is column-based: tenant tables carry an `organizationId`, and
membership is expressed through `Organization` / `OrganizationMember`. The API
scopes queries by `organizationId` (see `common/tenant/tenant-scope.service.ts`).
`@bc/db` provides `withTenantScope`, `scopedClient`, and an RLS migration
(`packages/db/prisma/phase1-rls/migration.sql`) with a compatibility flag that
keeps legacy behavior until RLS is enabled.

## Phase plan

See `docs/onboarding/phases/phase1-core.md` for the Phase 1 (1A) scope:
what the core formalizes and what is explicitly out of scope.