-- Reconcile CRM and tenant-scoping schema additions without removing or changing
-- any existing columns, constraints, or data.

-- AlterTable: Lead (the table is empty in the live database)
ALTER TABLE "Lead"
    ADD COLUMN "leadNumber" TEXT NOT NULL,
    ADD COLUMN "name" TEXT NOT NULL,
    ADD COLUMN "company" TEXT,
    ADD COLUMN "email" TEXT,
    ADD COLUMN "phone" TEXT,
    ADD COLUMN "estimatedValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "convertedToCustomerId" TEXT,
    ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable: Activity (the table is empty in the live database)
ALTER TABLE "Activity"
    ADD COLUMN "title" TEXT NOT NULL,
    ADD COLUMN "createdById" TEXT NOT NULL;

-- AlterTable: tenant scoping. These columns remain nullable to preserve existing rows.
ALTER TABLE "Category" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "File" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Inventory" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Warehouse" ADD COLUMN "organizationId" TEXT;

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_leadNumber_key" ON "Lead"("leadNumber");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_deletedAt_idx" ON "Lead"("deletedAt");
CREATE INDEX "Lead_convertedToCustomerId_idx" ON "Lead"("convertedToCustomerId");

CREATE INDEX "Activity_createdById_idx" ON "Activity"("createdById");

CREATE INDEX "Category_organizationId_idx" ON "Category"("organizationId");
CREATE INDEX "File_organizationId_idx" ON "File"("organizationId");
CREATE INDEX "Inventory_organizationId_idx" ON "Inventory"("organizationId");
CREATE INDEX "Warehouse_organizationId_idx" ON "Warehouse"("organizationId");

CREATE INDEX "TimelineEvent_leadId_idx" ON "TimelineEvent"("leadId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedToCustomerId_fkey" FOREIGN KEY ("convertedToCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Category" ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "File" ADD CONSTRAINT "File_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
