-- Mentor profile fields and mentor interaction infrastructure.
-- Safe for existing data: additive columns, additive enum types, and CREATE TABLE IF NOT EXISTS.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MENTOR';

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "mentorSpecialties" JSONB,
  ADD COLUMN IF NOT EXISTS "mentorExpertise" JSONB,
  ADD COLUMN IF NOT EXISTS "mentorRating" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "mentorCompletedReviews" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorAssignmentStatus') THEN
    CREATE TYPE "MentorAssignmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorReviewType') THEN
    CREATE TYPE "MentorReviewType" AS ENUM ('ROADMAP', 'RESUME', 'INTERVIEW', 'MILESTONE', 'GENERAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorReviewStatus') THEN
    CREATE TYPE "MentorReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'COMPLETED', 'REJECTED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorCommentVisibility') THEN
    CREATE TYPE "MentorCommentVisibility" AS ENUM ('USER_AND_MENTOR', 'MENTOR_ONLY');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorSessionStatus') THEN
    CREATE TYPE "MentorSessionStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "mentor_assignments" (
  "id" TEXT NOT NULL,
  "mentorId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "MentorAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mentor_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mentor_assignments_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mentor_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "mentor_reviews" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mentorId" TEXT,
  "assignmentId" TEXT,
  "type" "MentorReviewType" NOT NULL,
  "status" "MentorReviewStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "message" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "score" DOUBLE PRECISION,
  "verdict" TEXT,
  "suggestedEdits" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mentor_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mentor_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mentor_reviews_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "mentor_reviews_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "mentor_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "mentor_comments" (
  "id" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "parentId" TEXT,
  "body" TEXT NOT NULL,
  "visibility" "MentorCommentVisibility" NOT NULL DEFAULT 'USER_AND_MENTOR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mentor_comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mentor_comments_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "mentor_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mentor_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mentor_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "mentor_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "mentor_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mentorId" TEXT,
  "reviewId" TEXT,
  "status" "MentorSessionStatus" NOT NULL DEFAULT 'REQUESTED',
  "topic" TEXT NOT NULL,
  "message" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mentor_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mentor_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mentor_sessions_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "mentor_sessions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "mentor_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "mentor_assignments_mentorId_status_idx" ON "mentor_assignments"("mentorId", "status");
CREATE INDEX IF NOT EXISTS "mentor_assignments_userId_status_idx" ON "mentor_assignments"("userId", "status");
CREATE INDEX IF NOT EXISTS "mentor_reviews_userId_status_createdAt_idx" ON "mentor_reviews"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "mentor_reviews_mentorId_status_createdAt_idx" ON "mentor_reviews"("mentorId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "mentor_reviews_type_status_idx" ON "mentor_reviews"("type", "status");
CREATE INDEX IF NOT EXISTS "mentor_reviews_entityType_entityId_idx" ON "mentor_reviews"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "mentor_comments_reviewId_createdAt_idx" ON "mentor_comments"("reviewId", "createdAt");
CREATE INDEX IF NOT EXISTS "mentor_comments_authorId_createdAt_idx" ON "mentor_comments"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "mentor_comments_parentId_idx" ON "mentor_comments"("parentId");
CREATE INDEX IF NOT EXISTS "mentor_sessions_userId_status_scheduledAt_idx" ON "mentor_sessions"("userId", "status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "mentor_sessions_mentorId_status_scheduledAt_idx" ON "mentor_sessions"("mentorId", "status", "scheduledAt");
