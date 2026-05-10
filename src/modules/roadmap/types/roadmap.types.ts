import { AiFeedbackType, ProcessingStatus } from '@prisma/client';

export type RoadmapMilestone = {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: 'pending' | 'in-progress' | 'completed';
  recommendation: string;
};

export type RoadmapSkill = {
  name: string;
  currentLevel: string;
  targetLevel: string;
  progress: number;
  importance: string;
};

export type RoadmapTimelinePhase = {
  title: string;
  durationMonths: number;
  milestones: string[];
};

export type RoadmapTimeline = {
  phases: RoadmapTimelinePhase[];
  recommendations: string[];
};

export interface CreateRoadmapRequest {
  targetRole: string;
  currentLevel: string;
  careerGoals: string;
  experienceSummary: string;
  industry: string;
}

export interface UpdateRoadmapProgressRequest {
  milestones?: Array<{
    id: string;
    progress?: number;
    status?: 'pending' | 'in-progress' | 'completed';
  }>;
  skills?: Array<{
    name: string;
    currentLevel?: string;
    targetLevel?: string;
    progress?: number;
  }>;
  timeline?: RoadmapTimeline;
}

export interface RoadmapResponse {
  id: string;
  userId: string;
  targetRole: string;
  currentLevel: string;
  status: ProcessingStatus;
  milestones: RoadmapMilestone[];
  skills: RoadmapSkill[];
  timeline: RoadmapTimeline;
  createdAt: Date;
  updatedAt: Date;
  aiFeedbacks: Array<{
    id: string;
    type: AiFeedbackType;
    provider: string;
    status: ProcessingStatus;
    score?: number;
    summary?: string;
    strengths?: unknown;
    weaknesses?: unknown;
    suggestions?: unknown;
    createdAt: Date;
  }>;
}

export interface GetRoadmapsQuery {
  page?: number;
  limit?: number;
  status?: ProcessingStatus;
  targetRole?: string;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'targetRole';
  sortOrder?: 'asc' | 'desc';
}
