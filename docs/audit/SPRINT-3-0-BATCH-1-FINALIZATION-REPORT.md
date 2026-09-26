# SPRINT 3.0 — Batch 1 Finalization Report

**Date:** 2026-09-26 · **Repo:** `D:\my projected\Business-Copilot-0.1` · **Base HEAD:** `e25ae75` (external commit) on `main`
**Task history:** restore applied CRM-repair migration to resolve-time content → generate + inspect Batch 1 migration → validate → commit & push verified artifacts (Batch 1 NOT applied).

## Verdict: **PASS**

---

## 1. Why the applied migration was restored

Round 1 recorded `20260926000000_crm_history_repair` as applied with checksum `816484a2…` (hash of the resolve-time file). External commit **`0965edf`** stripped the file's header/section comments (bytes → `dae4a41b…`), which made `prisma migrate dev` abort with *"modified after it was applied"* + a reset proposal. Restoration (authorized; no `migrate resolve`, no history-row changes) puts the file back in byte-exact agreement with the applied record.

**Round-2 regression (this commit's reason):** external commit **`e25ae75`** (base of this commit) did NOT carry the restored comments — it committed a third variant (stripped content minus its leading blank line, on-disk `94ac8c30…` ≠ `816484a2…`), reintroducing a mismatch. The exact resolve-time bytes were recovered from opencode session history (three independent `write` calls to the file, all hashing to the target) and re-restored.

## 2. Restored checksum — EXACT MATCH (current worktree)

```
Get-FileHash -Algorithm SHA256 ...20260926000000_crm_history_repair\migration.sql
→ 816484A29C634C55B82F49D50A57F044E16D903BDA0E322A4CBD2901F55DA4B2
```
Expected applied value `816484a29c634c55b82f49d50a57f044e16d903bda0e322a4cbd2901f55da4b2` → **identical** ✓

## 3. Proof only comments changed

`git diff` vs base `e25ae75` for the repair file shows **+10 lines, zero SQL lines added/removed/modified**: the 8-line header block, the blank separator line (part of resolve-time content; `e25ae75` had removed it), and the `-- Activity` section comment. All 17 DDL statements byte-identical.

## 4. Migration history verification (SELECT-only, earlier this session)

```
totals={"total":36,"applied_clean":35,"rolled_back":1}
repair_row: checksum 816484a2… , finished_at 2026-09-26T14:06:28.940Z , rolled_back_at null
stale_20260922 = 0 ; integrity_issues = [] ; import_job rows retained
```
No `_prisma_migrations` row deleted/updated at any point.

## 5. `npx prisma migrate status`

```
36 migrations found in prisma/migrations
Following migration have not yet been applied:
20260926155915_add_universal_inventory_engine
```
(EXIT=1 solely due to the intentionally-unapplied Batch 1 — **no modified-after-applied warning**.)

## 6. Batch 1 migration — GENERATED, INSPECTED, NOT APPLIED

- `npx prisma migrate dev --create-only --name add_universal_inventory_engine` → **EXIT=0**, no reset proposal (ran on the verified `816484a2…` state).
- Path: `apps/api/prisma/migrations/20260926155915_add_universal_inventory_engine/migration.sql` (438 lines)

| Operation | Count | Notes |
|---|---|---|
| `CREATE TYPE` | **8** ✓ | exact authorized enum value sets |
| `CREATE TABLE` | **9** ✓ | Batch, SerialNumber, Stock, StockMovement, StockReservation, StockAdjustment, WarehouseTransfer, WarehouseTransferItem, OpeningStock |
| `ALTER TABLE "InventoryTransaction" ADD COLUMN` | **7** ✓ | only pre-existing table altered |
| `CREATE INDEX` / `CREATE UNIQUE INDEX` | 49 / 4 | incl. Stock composite unique `[warehouseId, productId, batchId, serialNumberId]` |
| `ADD CONSTRAINT … FOREIGN KEY` | 28 | Organization/Product/Warehouse/etc. only |

**STOP-condition scan:** zero `DROP`/`TRUNCATE`/`DELETE`/`UPDATE` statements · zero references to Invoice, PaymentAllocation, JournalEntry, Payroll, SalesOrder, PurchaseOrder, Activity, Lead, AuditLog, User, Role, Tenant · no duplicate InventoryTransaction table · OpeningStock has no Stock relation.

## 7. Validation results (all green, on this exact code state)

| Check | Result |
|---|---|
| `npx prisma validate` | ✅ EXIT=0 |
| `npx prisma generate` | ✅ Client v6.19.3, EXIT=0 |
| `npx tsc --noEmit` | ✅ EXIT=0 |
| `npm run build` | ✅ EXIT=0 |
| `npx jest` | ✅ 111/111 suites, **2,176/2,176 tests** |
| `git diff --check` | ✅ EXIT=0 |

## 8. Git state

- Base: **`e25ae75`** (external commit: Batch 1 migration `A` + the stripped repair variant — authored externally, already pushed).
- This commit (`chore(inventory): add universal inventory engine batch 1 migration`) adds:
  - repair migration restored to resolve-time comments (only comments; SHA-256 `816484a2…`)
  - `migration_lock.toml` Prisma 6.19.3 boilerplate normalization `(i.e. Git)` → `(e.g., Git)` (provider still `postgresql`)
  - `docs/audit/SPRINT-3-0-BATCH-1-FINALIZATION-REPORT.md`, `docs/audit/SPRINT-3-0-BATCH-1-RECREATION-REPORT.md`
- `schema.prisma`, `apps/api/src/inventory-engine/`, and all application/business code: **unchanged** (`git diff 0965edf..e25ae75` touched only the two migration paths; this commit touches none of them).

## 9. Explicit statements

- **Batch 1 migration: generated, inspected, validated — NOT applied** (`migrate status` lists it as the only pending migration).
- **Batch 2: not started.**
- No `migrate reset`, no `db push`, no `migrate dev` (in any form) since the `--create-only` generation, no `_prisma_migrations` row changes, no migration SQL semantics altered (comments only), no business-data DML/DDL.

## 10. Caveats

- `core.autocrlf` will convert the LF repair file to CRLF on future checkouts → on-disk hash would drift. Keep this file out of renormalization until the checksum-sensitive period passes (or attribute/normalize accordingly).
- The applied-checksum invariant for `20260926000000_crm_history_repair` depends on worktree bytes = `816484a2…`. Verify after any checkout/pull: `Get-FileHash -Algorithm SHA256`.
