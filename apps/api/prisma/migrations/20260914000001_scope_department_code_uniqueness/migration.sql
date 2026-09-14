-- Drop global unique constraint on Department.code
DROP INDEX "Department_code_key";


CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");

-- Create index on code for search performance
CREATE INDEX "Department_code_idx" ON "Department"("code");
