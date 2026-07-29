-- Add version column for OCC
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
-- Create IdempotencyRecord table for distributed idempotency
CREATE TABLE IF NOT EXISTS "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_key_key" ON "IdempotencyRecord"("key");
CREATE INDEX IF NOT EXISTS "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
-- Create ChecklistItem table for persistent success checklist
CREATE TABLE IF NOT EXISTS "ChecklistItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "icon" TEXT,
    "href" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "skippable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChecklistItem_sessionId_idx" ON "ChecklistItem"("sessionId");
