CREATE TABLE "interviewer_availability" (
    "id" TEXT NOT NULL,
    "interviewerId" TEXT,
    "roleTarget" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'General',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "bookedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interviewer_availability_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "interview_sessions" ADD COLUMN "availabilityId" TEXT;

CREATE UNIQUE INDEX "interviewer_availability_roleTarget_level_startsAt_endsAt_key" ON "interviewer_availability"("roleTarget", "level", "startsAt", "endsAt");
CREATE INDEX "interviewer_availability_roleTarget_level_startsAt_idx" ON "interviewer_availability"("roleTarget", "level", "startsAt");
CREATE INDEX "interviewer_availability_interviewerId_startsAt_idx" ON "interviewer_availability"("interviewerId", "startsAt");
CREATE INDEX "interviewer_availability_isActive_startsAt_idx" ON "interviewer_availability"("isActive", "startsAt");
CREATE INDEX "interview_sessions_availabilityId_idx" ON "interview_sessions"("availabilityId");

ALTER TABLE "interviewer_availability" ADD CONSTRAINT "interviewer_availability_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "interviewer_availability"("id") ON DELETE SET NULL ON UPDATE CASCADE;
