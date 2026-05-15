import { AiFeedbackType, ProcessingStatus } from '@prisma/client';

export type RoadmapMilestoneStatus = 'pending' | 'in-progress' | 'completed';
export type RoadmapSkillStatus =
  | 'not-started'
  | 'learning'
  | 'practicing'
  | 'proficient';

export type RoadmapMilestone = {
  id: string;
  title: string;
  description: string;
  durationWeeks: number;
  requiredSkills: string[];
  recommendedResources: string[];
  projectSuggestions: string[];
  successCriteria: string[];
  progress: number;
  status: RoadmapMilestoneStatus;
};

export type RoadmapSkill = {
  name: string;
  category: string;
  currentLevel: string;
  targetLevel: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number;
  status: RoadmapSkillStatus;
};

export type RoadmapProject = {
  title: string;
  description: string;
  difficulty: string;
  estimatedWeeks: number;
  technologies: string[];
  skillsDemonstrated: string[];
  portfolioValue: string;
};

export type LearningGoal = {
  title: string;
  description: string;
  resources: string[];
  progress: number;
  status: RoadmapMilestoneStatus;
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
  experienceLevel?: string;
  preferredPath: string;
  careerGoals: string;
  industry?: string;
  sourceResumeId?: string;
  regenerateFromId?: string;
}

export interface UpdateRoadmapProgressRequest {
  milestones?: Array<{
    id: string;
    progress?: number;
    status?: RoadmapMilestoneStatus;
  }>;
  skills?: Array<{
    name: string;
    progress?: number;
    status?: RoadmapSkillStatus;
  }>;
}

export interface RoadmapResponse {
  id: string;
  userId: string;
  title?: string;
  targetRole: string;
  currentLevel: string;
  preferredPath?: string;
  estimatedDurationMonths?: number;
  summary?: string;
  progress: number;
  version: number;
  sourceResumeId?: string;
  regeneratedFromId?: string;
  status: ProcessingStatus;
  milestones: RoadmapMilestone[];
  skills: RoadmapSkill[];
  projects: RoadmapProject[];
  certifications: string[];
  learningRecommendations: string[];
  timeline: RoadmapTimeline;
  failureReason?: string;
  retryAfterMs?: number;
  retryAvailableAt?: Date;
  retryAttempt?: number;
  retryLimit?: number;
  retryLimitReached?: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
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
  sortBy?: 'createdAt' | 'updatedAt' | 'targetRole' | 'progress';
  sortOrder?: 'asc' | 'desc';
}
