-- Phase 1 - Tenancy + Row-Level Security
-- Manual migration. NOT auto-applied by the app. Apply against a real database
-- (psql or prisma db execute) only when ready; the compatibility policy keeps
-- legacy app code working until tenant scoping is turned on.
--
--   psql "$DATABASE_URL" -f packages/db/prisma/phase1-rls/migration.sql
--
-- The DDL below is kept in sync with apps/api/prisma/schema.prisma (the
-- organizationId columns are declared there as nullable + indexed). Run
-- `npm run db:generate` after applying so the client matches the DB.

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Warehouse" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Inventory" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "File" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

CREATE INDEX IF NOT EXISTS "Category_organizationId_idx" ON "Category"("organizationId");
CREATE INDEX IF NOT EXISTS "Warehouse_organizationId_idx" ON "Warehouse"("organizationId");
CREATE INDEX IF NOT EXISTS "Inventory_organizationId_idx" ON "Inventory"("organizationId");
CREATE INDEX IF NOT EXISTS "File_organizationId_idx" ON "File"("organizationId");

CREATE OR REPLACE FUNCTION public.bc_current_org() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.current_org', true), '') $$;

CREATE OR REPLACE FUNCTION public.bc_rls_on() RETURNS boolean
  LANGUAGE sql STABLE
  AS $$ SELECT current_setting('app.rls_enabled', true) = 'on' $$;

ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Warehouse" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Inventory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "File" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bc_tenant_scope" ON "Category";
CREATE POLICY "bc_tenant_scope" ON "Category"
  USING (NOT public.bc_rls_on() OR public.bc_current_org() = "organizationId")
  WITH CHECK (NOT public.bc_rls_on() OR public.bc_current_org() = "organizationId");

DROP POLICY IF EXISTS "bc_tenant_scope" ON "Warehouse";
CREATE POLICY "bc_tenant_scope" ON "Warehouse"
  USING (NOT public.bc_rls_on() OR public.bc_current_org() = "organizationId")
  WITH CHECK (NOT public.bc_rls_on() OR public.bc_current_org() = "organizationId");

DROP POLICY IF EXISTS "bc_tenant_scope" ON "Inventory";
CREATE POLICY "bc_tenant_scope" ON "Inventory"
  USING (NOT public.bc_rls_on() OR public.bc_current_org() = "organizationId")
  WITH CHECK (NOT public.bc_rls_on() OR public.bc_current_org() = "organizationId");

DROP POLICY IF EXISTS "bc_tenant_scope" ON "File";
CREATE POLICY "bc_tenant_scope" ON "File"
  USING (NOT public.bc_rls_on() OR public.bc_current_org() = "organizationId")
  WITH CHECK (NOT public.bc_rls_on() OR public.bc_current_org() = "organizationId");
