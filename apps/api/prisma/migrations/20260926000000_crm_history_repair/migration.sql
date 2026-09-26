
ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_userId_fkey";
DROP INDEX IF EXISTS "Activity_userId_idx";
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "userId";
ALTER TABLE "Activity" DROP COLUMN IF EXISTS "subject";
ALTER TABLE "Activity" ALTER COLUMN "leadId" SET NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "Activity" DROP CONSTRAINT IF EXISTS "Activity_leadId_fkey";
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lead
ALTER TABLE "Lead" DROP CONSTRAINT IF EXISTS "Lead_customerId_fkey";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "customerId";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "title";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "description";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "value";
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "expectedCloseDate";

-- AuditLog
DROP INDEX IF EXISTS "AuditLog_action_idx";
DROP INDEX IF EXISTS "AuditLog_organizationId_idx";

-- User
DROP INDEX IF EXISTS "User_managerId_idx";
