/*
  Warnings:

  - You are about to drop the `AnalyticsEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ChatbotSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InterviewSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JobRecommendation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Notification` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Resume` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ResumeAnalysis` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Roadmap` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AiFeedbackType" AS ENUM ('RESUME_ANALYSIS', 'INTERVIEW_FEEDBACK', 'ROADMAP_GENERATION', 'CHATBOT_RESPONSE', 'JOB_RECOMMENDATION');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('AUTH', 'RESUME', 'INTERVIEW', 'ROADMAP', 'CHATBOT', 'JOB', 'NOTIFICATION', 'ADMIN', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "AnalyticsEvent" DROP CONSTRAINT "AnalyticsEvent_userId_fkey";

-- DropForeignKey
ALTER TABLE "ChatbotSession" DROP CONSTRAINT "ChatbotSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "InterviewSession" DROP CONSTRAINT "InterviewSession_userId_fkey";

-- DropForeignKey
ALTER TABLE "JobRecommendation" DROP CONSTRAINT "JobRecommendation_userId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "Resume" DROP CONSTRAINT "Resume_userId_fkey";

-- DropForeignKey
ALTER TABLE "ResumeAnalysis" DROP CONSTRAINT "ResumeAnalysis_resumeId_fkey";

-- DropForeignKey
ALTER TABLE "Roadmap" DROP CONSTRAINT "Roadmap_userId_fkey";

-- DropTable
DROP TABLE "AnalyticsEvent";

-- DropTable
DROP TABLE "ChatbotSession";

-- DropTable
DROP TABLE "InterviewSession";

-- DropTable
DROP TABLE "JobRecommendation";

-- DropTable
DROP TABLE "Notification";

-- DropTable
DROP TABLE "RefreshToken";

-- DropTable
DROP TABLE "Resume";

-- DropTable
DROP TABLE "ResumeAnalysis";

-- DropTable
DROP TABLE "Roadmap";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "AnalysisStatus";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "headline" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "parsedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "roleTarget" TEXT NOT NULL,
    "level" TEXT,
    "status" "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "questions" JSONB,
    "transcript" JSONB,
    "score" DOUBLE PRECISION,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_feedbacks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT,
    "interviewSessionId" TEXT,
    "careerRoadmapId" TEXT,
    "chatbotSessionId" TEXT,
    "type" "AiFeedbackType" NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'COMPLETED',
    "score" DOUBLE PRECISION,
    "summary" TEXT,
    "strengths" JSONB,
    "weaknesses" JSONB,
    "suggestions" JSONB,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "rawResponse" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_roadmaps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "currentLevel" TEXT NOT NULL,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "milestones" JSONB NOT NULL,
    "skills" JSONB,
    "timeline" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "career_roadmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chatbot_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "context" JSONB,
    "messages" JSONB NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chatbot_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_recommendations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "jobUrl" TEXT,
    "matchScore" DOUBLE PRECISION NOT NULL,
    "skillsMatch" JSONB,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "job_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" "AnalyticsEventType" NOT NULL,
    "eventName" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_expiresAt_idx" ON "refresh_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_revokedAt_idx" ON "refresh_tokens"("revokedAt");

-- CreateIndex
CREATE INDEX "resumes_userId_status_createdAt_idx" ON "resumes"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "resumes_deletedAt_idx" ON "resumes"("deletedAt");

-- CreateIndex
CREATE INDEX "interview_sessions_userId_status_scheduledAt_idx" ON "interview_sessions"("userId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "interview_sessions_roleTarget_idx" ON "interview_sessions"("roleTarget");

-- CreateIndex
CREATE INDEX "interview_sessions_deletedAt_idx" ON "interview_sessions"("deletedAt");

-- CreateIndex
CREATE INDEX "ai_feedbacks_userId_type_createdAt_idx" ON "ai_feedbacks"("userId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "ai_feedbacks_resumeId_idx" ON "ai_feedbacks"("resumeId");

-- CreateIndex
CREATE INDEX "ai_feedbacks_interviewSessionId_idx" ON "ai_feedbacks"("interviewSessionId");

-- CreateIndex
CREATE INDEX "ai_feedbacks_careerRoadmapId_idx" ON "ai_feedbacks"("careerRoadmapId");

-- CreateIndex
CREATE INDEX "ai_feedbacks_chatbotSessionId_idx" ON "ai_feedbacks"("chatbotSessionId");

-- CreateIndex
CREATE INDEX "ai_feedbacks_provider_status_idx" ON "ai_feedbacks"("provider", "status");

-- CreateIndex
CREATE INDEX "career_roadmaps_userId_status_idx" ON "career_roadmaps"("userId", "status");

-- CreateIndex
CREATE INDEX "career_roadmaps_targetRole_idx" ON "career_roadmaps"("targetRole");

-- CreateIndex
CREATE INDEX "career_roadmaps_deletedAt_idx" ON "career_roadmaps"("deletedAt");

-- CreateIndex
CREATE INDEX "chatbot_sessions_userId_lastMessageAt_idx" ON "chatbot_sessions"("userId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "chatbot_sessions_deletedAt_idx" ON "chatbot_sessions"("deletedAt");

-- CreateIndex
CREATE INDEX "job_recommendations_userId_matchScore_idx" ON "job_recommendations"("userId", "matchScore");

-- CreateIndex
CREATE INDEX "job_recommendations_company_idx" ON "job_recommendations"("company");

-- CreateIndex
CREATE INDEX "job_recommendations_expiresAt_idx" ON "job_recommendations"("expiresAt");

-- CreateIndex
CREATE INDEX "job_recommendations_deletedAt_idx" ON "job_recommendations"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_recommendations_source_externalId_key" ON "job_recommendations"("source", "externalId");

-- CreateIndex
CREATE INDEX "notifications_userId_type_status_createdAt_idx" ON "notifications"("userId", "type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_deletedAt_idx" ON "notifications"("deletedAt");

-- CreateIndex
CREATE INDEX "analytics_events_eventType_createdAt_idx" ON "analytics_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_eventName_createdAt_idx" ON "analytics_events"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_userId_createdAt_idx" ON "analytics_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_entityType_entityId_idx" ON "analytics_events"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_careerRoadmapId_fkey" FOREIGN KEY ("careerRoadmapId") REFERENCES "career_roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_feedbacks" ADD CONSTRAINT "ai_feedbacks_chatbotSessionId_fkey" FOREIGN KEY ("chatbotSessionId") REFERENCES "chatbot_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_roadmaps" ADD CONSTRAINT "career_roadmaps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_sessions" ADD CONSTRAINT "chatbot_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_recommendations" ADD CONSTRAINT "job_recommendations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
