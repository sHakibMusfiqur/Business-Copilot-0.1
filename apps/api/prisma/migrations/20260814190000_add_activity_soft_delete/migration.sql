-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Activity_deletedAt_idx" ON "Activity"("deletedAt");
