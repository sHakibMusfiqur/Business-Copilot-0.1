-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAID');

-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "Payroll" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "Payroll" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Payroll" ADD COLUMN "rejectedBy" TEXT;
ALTER TABLE "Payroll" ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Payroll_status_idx" ON "Payroll"("status");

-- CreateIndex
CREATE INDEX "Payroll_employeeId_status_idx" ON "Payroll"("employeeId", "status");
