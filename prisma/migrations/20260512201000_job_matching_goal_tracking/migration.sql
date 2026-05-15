CREATE TYPE "JobApplicationStatus" AS ENUM ('SAVED', 'APPLIED', 'INTERVIEW_SCHEDULED', 'OFFER', 'REJECTED', 'WITHDRAWN');

CREATE TYPE "CareerGoalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobRecommendationId" TEXT NOT NULL,
    "status" "JobApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3),
    "interviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "career_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetRole" TEXT,
    "targetDate" TIMESTAMP(3),
    "status" "CareerGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nextSteps" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "career_goals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_applications_userId_jobRecommendationId_key" ON "job_applications"("userId", "jobRecommendationId");
CREATE INDEX "job_applications_userId_status_updatedAt_idx" ON "job_applications"("userId", "status", "updatedAt");
CREATE INDEX "career_goals_userId_status_updatedAt_idx" ON "career_goals"("userId", "status", "updatedAt");

ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_jobRecommendationId_fkey" FOREIGN KEY ("jobRecommendationId") REFERENCES "job_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "career_goals" ADD CONSTRAINT "career_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
