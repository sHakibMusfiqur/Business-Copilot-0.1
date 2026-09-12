-- Invoice Module Migration
-- Adds salesOrderId and paidAmount columns to existing Invoice table
-- Invoice and InvoiceItem tables already exist from 20260723144553_add_organization_member

-- Add salesOrderId column to Invoice
ALTER TABLE "Invoice" ADD COLUMN "salesOrderId" TEXT;

-- Add paidAmount column to Invoice
ALTER TABLE "Invoice" ADD COLUMN "paidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- Create unique constraint on salesOrderId
CREATE UNIQUE INDEX "Invoice_salesOrderId_key" ON "Invoice"("salesOrderId");

-- Create index on salesOrderId for foreign key lookups
CREATE INDEX "Invoice_salesOrderId_idx" ON "Invoice"("salesOrderId");

-- Create composite unique index for organization-scoped invoice numbering
CREATE UNIQUE INDEX "Invoice_organizationId_invoiceNumber_key" ON "Invoice"("organizationId", "invoiceNumber");

-- Create composite performance indexes for dashboard queries
CREATE INDEX "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");
CREATE INDEX "Invoice_organizationId_paymentStatus_idx" ON "Invoice"("organizationId", "paymentStatus");

-- Add foreign key for salesOrderId
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
