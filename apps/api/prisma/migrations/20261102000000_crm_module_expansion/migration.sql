-- CRM module expansion: companies, deal lifecycle, stage history, sales targets,
-- and multi-entity activities. Additive only; existing lead/contact/deal data is preserved.

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- Activity: generalise from lead-only to any CRM entity.
ALTER TABLE "Activity"
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "contactId" TEXT,
  ADD COLUMN "dealId" TEXT,
  ADD COLUMN "organizationId" TEXT,
  ALTER COLUMN "leadId" DROP NOT NULL;

-- Backfill tenant scope from the owning lead. leadId was NOT NULL with an FK, so
-- every legacy row is covered; SET NOT NULL below fails loudly if that ever is not true.
UPDATE "Activity" a
SET "organizationId" = l."organizationId"
FROM "Lead" l
WHERE a."leadId" = l."id" AND a."organizationId" IS NULL;

ALTER TABLE "Activity" ALTER COLUMN "organizationId" SET NOT NULL;

-- Contact additions
ALTER TABLE "Contact"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE';

-- Deal lifecycle
ALTER TABLE "Deal"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "lostAt" TIMESTAMP(3),
  ADD COLUMN "lostReason" TEXT,
  ADD COLUMN "probability" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "wonAt" TIMESTAMP(3);

-- Lead additions
ALTER TABLE "Lead"
  ADD COLUMN "companyId" TEXT,
  ADD COLUMN "convertedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DealStageHistory" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "fromStageName" TEXT,
    "toStageId" TEXT NOT NULL,
    "toStageName" TEXT NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "industry" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT,
    "ownerId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTarget" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealStageHistory_dealId_createdAt_idx" ON "DealStageHistory"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "Company_organizationId_idx" ON "Company"("organizationId");

-- CreateIndex
CREATE INDEX "Company_ownerId_idx" ON "Company"("ownerId");

-- CreateIndex
CREATE INDEX "Company_deletedAt_idx" ON "Company"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_organizationId_name_key" ON "Company"("organizationId", "name");

-- CreateIndex
CREATE INDEX "SalesTarget_organizationId_periodStart_idx" ON "SalesTarget"("organizationId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "SalesTarget_organizationId_ownerId_periodStart_key" ON "SalesTarget"("organizationId", "ownerId", "periodStart");

-- CreateIndex
CREATE INDEX "Activity_organizationId_dueDate_idx" ON "Activity"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "Activity_contactId_idx" ON "Activity"("contactId");

-- CreateIndex
CREATE INDEX "Activity_dealId_idx" ON "Activity"("dealId");

-- CreateIndex
CREATE INDEX "Activity_companyId_idx" ON "Activity"("companyId");

-- CreateIndex
CREATE INDEX "Activity_assignedToId_idx" ON "Activity"("assignedToId");

-- CreateIndex
CREATE INDEX "Activity_organizationId_completed_dueDate_idx" ON "Activity"("organizationId", "completed", "dueDate");

-- CreateIndex
CREATE INDEX "Contact_companyId_idx" ON "Contact"("companyId");

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");

-- CreateIndex
CREATE INDEX "Contact_status_idx" ON "Contact"("status");

-- CreateIndex
CREATE INDEX "Deal_companyId_idx" ON "Deal"("companyId");

-- CreateIndex
CREATE INDEX "Deal_organizationId_wonAt_idx" ON "Deal"("organizationId", "wonAt");

-- CreateIndex
CREATE INDEX "Deal_organizationId_lostAt_idx" ON "Deal"("organizationId", "lostAt");

-- CreateIndex
CREATE INDEX "Lead_companyId_idx" ON "Lead"("companyId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStageHistory" ADD CONSTRAINT "DealStageHistory_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealStageHistory" ADD CONSTRAINT "DealStageHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data backfill (idempotent)
-- ---------------------------------------------------------------------------

-- Promote legacy free-text company names into Company records, then link them.
INSERT INTO "Company" ("id", "organizationId", "name", "createdAt", "updatedAt")
SELECT
  'cmp_' || substr(md5(source."organizationId" || ':' || lower(source."name")), 1, 24),
  source."organizationId",
  source."name",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT "organizationId", btrim("company") AS "name"
  FROM "Lead"
  WHERE "company" IS NOT NULL AND btrim("company") <> ''
  UNION
  SELECT DISTINCT "organizationId", btrim("company") AS "name"
  FROM "Contact"
  WHERE "company" IS NOT NULL AND btrim("company") <> ''
) AS source
ON CONFLICT ("organizationId", "name") DO NOTHING;

UPDATE "Lead" l
SET "companyId" = c."id"
FROM "Company" c
WHERE l."companyId" IS NULL
  AND c."organizationId" = l."organizationId"
  AND lower(c."name") = lower(btrim(l."company"));

UPDATE "Contact" ct
SET "companyId" = c."id"
FROM "Company" c
WHERE ct."companyId" IS NULL
  AND c."organizationId" = ct."organizationId"
  AND lower(c."name") = lower(btrim(ct."company"));

-- Deals inherit the company of their primary contact when available.
UPDATE "Deal" d
SET "companyId" = ct."companyId"
FROM "Contact" ct
WHERE d."companyId" IS NULL
  AND d."contactId" = ct."id"
  AND ct."companyId" IS NOT NULL;

-- Guarantee every organization has a default pipeline with the standard stages.
INSERT INTO "Pipeline" ("id", "name", "description", "organizationId", "isDefault", "isActive", "createdAt", "updatedAt")
SELECT
  'pipe_' || substr(md5(o."id" || ':default-pipeline'), 1, 24),
  'Sales Pipeline',
  'Default sales pipeline',
  o."id",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "Pipeline" p
  WHERE p."organizationId" = o."id" AND p."deletedAt" IS NULL
);

INSERT INTO "PipelineStage" ("id", "pipelineId", "name", "position", "isWon", "isLost", "isActive", "createdAt", "updatedAt")
SELECT
  'stage_' || substr(md5(p."id" || ':' || s."name"), 1, 24),
  p."id",
  s."name",
  s."position",
  s."is_won",
  s."is_lost",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Pipeline" p
CROSS JOIN (VALUES
  ('Qualification', 0, false, false),
  ('Needs Analysis', 1, false, false),
  ('Proposal', 2, false, false),
  ('Negotiation', 3, false, false),
  ('Won', 4, true, false),
  ('Lost', 5, false, true)
) AS s("name", "position", "is_won", "is_lost")
WHERE p."deletedAt" IS NULL
ON CONFLICT ("pipelineId", "name") DO NOTHING;

-- Derive probability from stage for legacy deals.
UPDATE "Deal" d
SET "probability" = CASE
    WHEN s."isWon" THEN 100
    WHEN s."isLost" THEN 0
    ELSE LEAST(95, GREATEST(5, (s."position" + 1) * 20))
  END
FROM "PipelineStage" s
WHERE d."stageId" = s."id" AND d."probability" = 0;

-- Legacy closed deals have no close timestamp; use last update as best evidence.
UPDATE "Deal" d
SET "wonAt" = d."updatedAt"
FROM "PipelineStage" s
WHERE d."stageId" = s."id" AND s."isWon" = true AND d."wonAt" IS NULL;

UPDATE "Deal" d
SET "lostAt" = d."updatedAt"
FROM "PipelineStage" s
WHERE d."stageId" = s."id" AND s."isLost" = true AND d."lostAt" IS NULL;
