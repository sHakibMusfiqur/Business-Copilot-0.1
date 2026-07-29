-- Add soft delete fields to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "deletedReason" TEXT;

-- Create SystemSettingVersion table
CREATE TABLE IF NOT EXISTS "SystemSettingVersion" (
    "id" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedById" TEXT,
    "reason" TEXT,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemSettingVersion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SystemSettingVersion_settingKey_idx" ON "SystemSettingVersion"("settingKey");
CREATE INDEX IF NOT EXISTS "SystemSettingVersion_createdAt_idx" ON "SystemSettingVersion"("createdAt");
ALTER TABLE "SystemSettingVersion" ADD CONSTRAINT IF NOT EXISTS "SystemSettingVersion_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
