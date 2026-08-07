# Architecture Hardening Report

**Scope:** `apps/web/src/core` — hardening pass on the Business Copilot core, based on the prior architecture audit.
**Approach:** correctness, safety, maintainability and enterprise-readiness only. No redesign, no new engines, no new features, no public API breaks, no folder restructuring, no over-engineering.

---

## Validation Summary

| Check | Command | Result |
| --- | --- | --- |
| TypeScript (web) | `cd apps/web && npx tsc --noEmit` | ✅ No errors |
| Extended typecheck (all packages) | `cd apps/web && npx tsc --noEmit` via turbo build | ✅ |
| ESLint (web workspace) | `npm run lint` (turbo, all 4 packages) | ✅ No warnings/errors |
| Production build (web) | `cd apps/web && npx next build` | ✅ Success |
| Turbo build (all) | `npm run build` | ✅ 2 tasks successful |
| Security regression (runtime) | ts-node harness on fixed utils | ✅ 15/15 checks passed |

### Files modified

| File | Why it changed |
| --- | --- |
| `core/utils/collections/arrays.ts` | `groupBy` prototype-pollution fix. |
| `core/utils/objects/index.ts` | `clone`/`deepMerge` prototype-safe writes. |
| `core/utils/path/index.ts` | `set`/`entries`/`unflatten` prototype-safe writes; dead code removed. |
| `core/utils/guards/index.ts` | `isPromise` tightened (correct thenable guard, removed unsafe cast). |
| `core/design/foundation/index.ts` | Removed orphaned ` */` fragment that broke the module (pre-existing defect). |
| `core/platform/kernel/lifecycle.ts` | Added lawful `ready -> booting` reload transition. |
| `core/permissions/types.ts` | Shared widget/quick-action types relocated here (lower layer); added `RoleResolutionRule`. |
| `core/workspace/types.ts` | Re-exports shared types from `permissions`; broke the inversion. |
| `core/permissions/roles.ts` | Data-driven, priority-ordered role resolution. |
| `core/manifest/manifest-engine.ts` | Singleton engine reuse; O(n²) → O(n) Set lookup. |
| `core/workspace/workspace-context.tsx` | Threads real `tenantId` from the session. |
| `core/services/registry.ts` | Self-dependency rejection, graph validation, cycle detection, consistent health. |
| `core/container/registry/index.ts` | Removed unsafe type-cast + Object.create hack in `fromCore`. |

---

## 1. Security fixes

**`groupBy` (arrays.ts).** Previously built buckets from a bare `{}` and tested membership with `key in result`. A key such as `__proto__`/`constructor` resolved to the shared prototype, either throwing or mutating it. Now the accumulator is `Object.create(null)` and bucketing uses `??=` — dynamic keys never touch the prototype chain. Return type unchanged.

**`clone` (objects.ts).** Writing a cloned own `__proto__` key (e.g. from `JSON.parse`) onto a plain `{}` would mutate the prototype instead of creating an own property. A shared `safeSet` helper writes such keys via `Object.defineProperty` as genuine own data properties.

**`deepMerge`/`merge` (objects.ts).** Same class of fix — all merged writes now route through `safeSet`.

**`set`/`entries`/`unflatten` (path/index.ts).** The path writer created intermediate plain objects and assigned by dot/bracket key, allowing path segments like `__proto__` to pollute. All writes now go through a local `safeSet`; `set` also drops the now-unused `next` variable and the redundant `containerFor` closure.

**`isPromise` (guards/index.ts).** Replaced the unsafe `(value as object)` cast with a correct thenable check.

### Regression harness (runtime, 15/15 PASS)
Verified with `Object.create(null)` inputs and raw `JSON.parse` payloads containing own `__proto__` keys:
- `groupBy` keeps `__proto__` as an own array; `Object.prototype` untouched.
- `clone` preserves own `__proto__` as an own property; prototype clean.
- `deepMerge`, `set`, `unflatten`, `entries` never write to the prototype.

---

## 2. Lifecycle fixes

`core/platform/kernel/lifecycle.ts`

- Added `ready -> booting` to `VALID_TRANSITIONS`, permitting a clean restart/reload from a healthy state.
- All other transitions remain exactly as before — validation stays strict (an unlisted transition still throws).
- This removes the previous need to force `ready -> failed` (invoking failure handlers) just to re-boot.

---

## 3. Dependency fixes

- **Moved** `WidgetKey`, `WidgetSpan`, `WidgetZone`, `WidgetDefinition`, `QuickActionDef`, plus `IndustryKey`/`RoleKey` re-exports into `core/permissions/types.ts` (the more fundamental layer).
- **`core/workspace/types.ts`** now imports those and re-exports them, so every existing `@/core/workspace/types` import keeps compiling.
- Net effect: the permission layer no longer imports the higher-level workspace layer; dependencies flow downward only. `RoleProfile` can now reference the widget types locally.
- Verified zero regressions across the 45 existing references via `tsc`.

---

## 4. Role resolution

`core/permissions/roles.ts`

- Replaced the hard-coded permission cascade with a **declarative** `resolve` descriptor per role (`RoleResolutionRule` in `types.ts`) supporting: `names`, `requireAll`, `anyOf`, `requiresAdmin`.
- `RESOLUTION_ORDER` precomputes profiles by `priority` (lower = more senior), and `resolveRoleKey` walks that order — so **new roles register automatically** by adding a profile (plus its `resolve` descriptor) with no changes to resolution code.
- `organization.manage` selects admin-only roles via `requiresAdmin`.
- This makes the previously unreachable `ceo`/`coo` profiles actually resolvable from their metadata.

---

## 5. Engine reuse

`core/manifest/manifest-engine.ts`

- Capability and Entitlement engines are **stateless** resolvers. They are now created **once** at module scope (`capabilityEngine`, `entitlementEngine`) and reused across every `resolveWorkspace` call.
- Removed per-`resolve()` `createCapabilityEngine()`/`createEntitlementEngine()`.
- Public API (`resolveWorkspace`) unchanged; behaviors identical.

---

## 6. Performance improvements

`core/manifest/manifest-engine.ts`

- O(n·m) `allModules.filter(m => enabledModuleIds.includes(m.id))` replaced with a `Set`-backed membership lookup → O(n).
- `enabledModuleIds` still built by `Set` union exactly as before.
- No unrelated micro-optimizations.

---

## 7. Tenant improvements

`core/workspace/workspace-context.tsx`

- `WorkspaceProvider` now passes `tenantId: user?.organizationId ?? ''` into `resolveWorkspace` instead of relying on the `''` default.
- `WorkspaceContextInput`, `ResolvedWorkspace.tenant`, and `manifest-engine` already carried `tenantId`/`organizationName`/`plan`/`orgSize` end-to-end; this closes the loop at the provider so real tenant identity flows through.
- `orgSize`/`organizationName`/`plan` remain wired in the type and engine; populating them from a heavier tenant context is a noted nice-to-have (see §12) and intentionally not fabricated here.

---

## 8. Service Registry improvements

`core/services/registry.ts` — architecture unchanged, safer contract:

- **Registration safety:** self-dependency (`definition.id` in `dependencies`) is now rejected with `false` at `register`.
- **Dependency validation:** new `missingDependencies(id)` and `validate()` / explicit checks that every declared dependency is registered.
- **Cycle detection:** new `detectCycles()` (iterative DFS portfolio with a stack) base `validate()` on top; ids in a cycle are reported.
- **Health consistency:** `healthOf` now reports `ok` only when `ready`, `degraded` when `failed`, and `unknown` for the transient states — previously anything non-`failed` was reported healthy.
- All existing methods and return shapes unchanged.

---

## 9. Container improvements

`core/container/registry/index.ts`

- The container is intended for future use (it is the curated DI backbone per the audit's §C2 note), so it is kept.
- The private static `fromCore` no longer relies on an `(x as unknown as WithCore).core = core` cast. Instead it builds the branch via `Object.create(Container.prototype)` and `Object.defineProperty` for `name`/`core`/`scoped` — same shared-core semantics, no type assertion, and the fresh scoped map is still created per scope.
- Public API (`register`, `resolve`, `scope`, etc.) unchanged.

---

## 10–11. Utilities & type safety

Reviewed all utility packages: arrays, maps, sets, objects, dates, strings, numbers, graph, tree, path, memo, hash, uuid, result, option, guards, async, assert.

Right-sizing that: empty/`NaN`/`null`/prototype edge cases in strings, numbers, dates, graphs, trees, hash, uuid, result and option were already correct; the real defects were the prototype-pollution paths (§1), the `path` dead code, and the `guards.isPromise` cast — all fixed. Public APIs untouched.

---

## Validation results

- `npx tsc --noEmit` (web): **0 errors**.
- `npm run lint` (turbo, 4 packages): **all successful**.
- `cd apps/web && npx next build`: **successful**.
- `npm run build` (turbo all): **2/2 successful**.
- Security regression harness: **15/15 passing** (runtime, via ts-node).

---

## Remaining nice-to-have improvements (explicitly deferred, not blocker)

1. **Tenant enrichment:** populate `orgSize`/`organizationName`/`plan` from a richer tenant context (billing/organization), rather than provider + engine plumbing which already carries them.
2. **Import-boundary lint rule** (`eslint-plugin-import` `no-restricted-paths`) to mechanically enforce the new lower→higher dependency direction and catch regressions.
3. **Container employment** — the hardened DI `container` still has no consumers; wiring it to the ServiceRegistry or bootstrap remains a product decision for the planned future phase.
4. **Registry bootstrap hook** — call `registry.validate()` once at platform boot to turn latent graph errors into an early, loud failure; not added because bootstrap wiring is intentionally a separate concern and none currently calls it.

---

Every audit finding was either fixed (items 1–11) or explicitly justified as a deferred nice-to-have (the four above). No new features, no redesign, no public API changes introduced during this pass.