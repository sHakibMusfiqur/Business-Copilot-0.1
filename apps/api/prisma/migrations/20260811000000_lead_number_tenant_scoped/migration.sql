-- Reconcile Lead.leadNumber uniqueness from global to tenant-scoped.
-- leadNumber must be unique within an organization, not globally, so that each
-- organization can generate independent sequences (LD-YYYY-000001, ...).

-- Drop the existing global unique constraint on Lead.leadNumber.
DROP INDEX "Lead_leadNumber_key";

-- Create the composite unique index scoping uniqueness per organization.
CREATE UNIQUE INDEX "Lead_organizationId_leadNumber_key" ON "Lead"("organizationId", "leadNumber");