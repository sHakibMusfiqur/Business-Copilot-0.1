-- CreateTable
CREATE TABLE "OnboardingSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "completedSteps" JSONB DEFAULT '[]',
    "selectedIndustry" TEXT,
    "selectedCategory" TEXT,
    "orgName" TEXT,
    "orgEmail" TEXT,
    "orgPhone" TEXT,
    "orgWebsite" TEXT,
    "orgCountry" TEXT,
    "orgState" TEXT,
    "orgCity" TEXT,
    "orgAddress" TEXT,
    "orgTimezone" TEXT,
    "orgCurrency" TEXT,
    "orgLanguage" TEXT,
    "businessProfile" JSONB,
    "selectedModules" JSONB DEFAULT '[]',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiLanguage" TEXT,
    "aiPersonality" TEXT,
    "selectedPlanId" TEXT,
    "subscriptionId" TEXT,
    "provisionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "provisionData" JSONB,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingSession_email_idx" ON "OnboardingSession"("email");

-- CreateIndex
CREATE INDEX "OnboardingSession_userId_idx" ON "OnboardingSession"("userId");

-- CreateIndex
CREATE INDEX "OnboardingSession_organizationId_idx" ON "OnboardingSession"("organizationId");
