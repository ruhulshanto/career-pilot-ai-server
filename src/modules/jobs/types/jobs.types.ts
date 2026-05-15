import type { CareerGoalStatus, JobApplicationStatus } from '@prisma/client';

export type JobMatchResponse = {
  id: string;
  title: string;
  company: string;
  location?: string;
  jobUrl?: string;
  matchScore: number;
  skillsMatch: string[];
  missingSkills: string[];
  matchReasons: string[];
  recommendedImprovements: string[];
  source: string;
  sourceLabel: string;
  isSearchAssistant: boolean;
  applicationStatus?: JobApplicationStatus;
  createdAt: string;
};

export type JobApplicationResponse = {
  id: string;
  jobId: string;
  title: string;
  company: string;
  location?: string;
  source: string;
  sourceLabel: string;
  jobUrl?: string;
  matchScore?: number;
  skillsMatch: string[];
  missingSkills: string[];
  status: JobApplicationStatus;
  notes?: string;
  appliedAt?: string;
  interviewAt?: string;
  updatedAt: string;
};

export type JobFitAnalysisResponse = {
  atsMatchPercent: number;
  matchingStrengths: string[];
  missingSkills: string[];
  recommendedImprovements: string[];
  insights: string[];
  sourceSignals: {
    resumeScore?: number;
    targetRole?: string;
    roadmapRole?: string;
    experienceLevel?: string;
    matchedSkillCount: number;
    missingSkillCount: number;
  };
};

export type CareerGoalResponse = {
  id: string;
  title: string;
  description?: string;
  targetRole?: string;
  targetDate?: string;
  status: CareerGoalStatus;
  progress: number;
  nextSteps: string[];
  updatedAt: string;
};
