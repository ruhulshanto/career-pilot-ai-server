CREATE TABLE IF NOT EXISTS "onboarding_progress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "completedSteps" JSONB NOT NULL DEFAULT '[]',
  "currentStep" TEXT,
  "skippedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_progress_userId_key"
ON "onboarding_progress"("userId");

CREATE INDEX IF NOT EXISTS "onboarding_progress_completedAt_idx"
ON "onboarding_progress"("completedAt");

CREATE INDEX IF NOT EXISTS "onboarding_progress_skippedAt_idx"
ON "onboarding_progress"("skippedAt");

ALTER TABLE "onboarding_progress"
ADD CONSTRAINT "onboarding_progress_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
