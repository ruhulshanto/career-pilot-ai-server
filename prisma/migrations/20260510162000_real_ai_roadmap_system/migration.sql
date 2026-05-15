-- Real AI roadmap aggregate metadata
ALTER TABLE "career_roadmaps"
ADD COLUMN "preferredPath" TEXT,
ADD COLUMN "title" TEXT,
ADD COLUMN "summary" TEXT,
ADD COLUMN "estimatedDurationMonths" INTEGER,
ADD COLUMN "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "sourceResumeId" TEXT,
ADD COLUMN "regeneratedFromId" TEXT,
ADD COLUMN "projects" JSONB,
ADD COLUMN "certifications" JSONB,
ADD COLUMN "learningRecommendations" JSONB,
ADD COLUMN "failureReason" TEXT,
ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE TYPE "RoadmapMilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "RoadmapSkillStatus" AS ENUM ('NOT_STARTED', 'LEARNING', 'PRACTICING', 'PROFICIENT');
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "LearningGoalStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

CREATE TABLE "roadmap_milestones" (
  "id" TEXT NOT NULL,
  "roadmapId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "durationWeeks" INTEGER,
  "dueDate" TIMESTAMP(3),
  "status" "RoadmapMilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "requiredSkills" JSONB,
  "resources" JSONB,
  "projectIdeas" JSONB,
  "successCriteria" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roadmap_milestones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roadmap_skills" (
  "id" TEXT NOT NULL,
  "roadmapId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "currentLevel" TEXT,
  "targetLevel" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "RoadmapSkillStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "evidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roadmap_skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roadmap_projects" (
  "id" TEXT NOT NULL,
  "roadmapId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "difficulty" TEXT,
  "estimatedWeeks" INTEGER,
  "technologies" JSONB,
  "skillsDemonstrated" JSONB,
  "portfolioValue" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "roadmap_projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "learning_goals" (
  "id" TEXT NOT NULL,
  "roadmapId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "targetDate" TIMESTAMP(3),
  "status" "LearningGoalStatus" NOT NULL DEFAULT 'PENDING',
  "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "resources" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "career_roadmaps_sourceResumeId_idx" ON "career_roadmaps"("sourceResumeId");
CREATE INDEX "career_roadmaps_regeneratedFromId_idx" ON "career_roadmaps"("regeneratedFromId");
CREATE INDEX "roadmap_milestones_roadmapId_sequence_idx" ON "roadmap_milestones"("roadmapId", "sequence");
CREATE INDEX "roadmap_milestones_roadmapId_status_idx" ON "roadmap_milestones"("roadmapId", "status");
CREATE UNIQUE INDEX "roadmap_skills_roadmapId_name_key" ON "roadmap_skills"("roadmapId", "name");
CREATE INDEX "roadmap_skills_roadmapId_status_idx" ON "roadmap_skills"("roadmapId", "status");
CREATE INDEX "roadmap_projects_roadmapId_status_idx" ON "roadmap_projects"("roadmapId", "status");
CREATE INDEX "learning_goals_roadmapId_status_idx" ON "learning_goals"("roadmapId", "status");

ALTER TABLE "roadmap_milestones" ADD CONSTRAINT "roadmap_milestones_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "career_roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roadmap_skills" ADD CONSTRAINT "roadmap_skills_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "career_roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roadmap_projects" ADD CONSTRAINT "roadmap_projects_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "career_roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "learning_goals" ADD CONSTRAINT "learning_goals_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "career_roadmaps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
