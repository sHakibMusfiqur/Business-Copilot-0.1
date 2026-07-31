ALTER TABLE "OnboardingSession"
ADD COLUMN IF NOT EXISTS "selectedCategories" JSONB DEFAULT '[]';