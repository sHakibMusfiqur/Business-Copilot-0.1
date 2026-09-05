-- Performance indexes for multi-tenant scalability
-- These indexes are safe to add online in PostgreSQL

-- User: tenant-scoped queries
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX IF NOT EXISTS "User_departmentId_idx" ON "User"("departmentId");

-- RefreshToken: session lookup and cleanup
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX IF NOT EXISTS "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- Department: tenant scoping
CREATE INDEX IF NOT EXISTS "Department_organizationId_idx" ON "Department"("organizationId");

-- Product: category/supplier browsing
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS "Product_supplierId_idx" ON "Product"("supplierId");

-- Inventory: warehouse stock queries
CREATE INDEX IF NOT EXISTS "Inventory_warehouseId_idx" ON "Inventory"("warehouseId");

-- InventoryTransaction: tenant-scoped date ranges
CREATE INDEX IF NOT EXISTS "InventoryTransaction_organizationId_createdAt_idx" ON "InventoryTransaction"("organizationId", "createdAt");

-- Invoice: status/dashboard queries
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_status_idx" ON "Invoice"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_paymentStatus_idx" ON "Invoice"("organizationId", "paymentStatus");

-- PurchaseOrder: order management
CREATE INDEX IF NOT EXISTS "PurchaseOrder_organizationId_status_idx" ON "PurchaseOrder"("organizationId", "status");

-- SalesOrder: order management
CREATE INDEX IF NOT EXISTS "SalesOrder_organizationId_status_idx" ON "SalesOrder"("organizationId", "status");

-- JournalEntry: accounting date ranges
CREATE INDEX IF NOT EXISTS "JournalEntry_organizationId_date_idx" ON "JournalEntry"("organizationId", "date");
CREATE INDEX IF NOT EXISTS "JournalEntry_organizationId_status_idx" ON "JournalEntry"("organizationId", "status");

-- Receivable: AR aging
CREATE INDEX IF NOT EXISTS "Receivable_organizationId_status_idx" ON "Receivable"("organizationId", "status");

-- Payable: AP aging
CREATE INDEX IF NOT EXISTS "Payable_organizationId_status_idx" ON "Payable"("organizationId", "status");

-- Payment: payment history
CREATE INDEX IF NOT EXISTS "Payment_organizationId_createdAt_idx" ON "Payment"("organizationId", "createdAt");

-- Employee: user-to-employee lookup
CREATE INDEX IF NOT EXISTS "Employee_userId_idx" ON "Employee"("userId");

-- Leave: dashboard status counts
CREATE INDEX IF NOT EXISTS "Leave_status_idx" ON "Leave"("status");
CREATE INDEX IF NOT EXISTS "Leave_employeeId_status_idx" ON "Leave"("employeeId", "status");

-- AuditLog: tenant-scoped time ranges
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
