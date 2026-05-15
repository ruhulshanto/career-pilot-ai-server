import type {
  AiFeedbackType,
  AnalyticsEventType,
  ProcessingStatus
} from '@prisma/client';

export type DashboardActivitySource =
  | 'analytics'
  | 'resume'
  | 'interview'
  | 'roadmap'
  | 'ai-feedback';

export type DashboardActivity = {
  id: string;
  source: DashboardActivitySource;
  eventType: AnalyticsEventType | 'RESUME' | 'INTERVIEW' | 'ROADMAP' | 'AI';
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  score?: number;
  createdAt: string;
};

export type DashboardSkillGap = {
  skill: string;
  gapScore: number;
  currentLevel?: string;
  targetLevel?: string;
  source: 'roadmap' | 'ai-feedback';
  recommendation?: string;
};

export type DashboardAiJob = {
  id: string;
  type: AiFeedbackType | 'RESUME_ANALYSIS' | 'ROADMAP_GENERATION' | 'INTERVIEW_FEEDBACK';
  entityType: 'resume' | 'roadmap' | 'interview' | 'ai-feedback';
  entityId: string;
  status: ProcessingStatus | 'WAITING' | 'ACTIVE' | 'DELAYED';
  progressStage: string;
  progress?: number;
  createdAt: string;
  updatedAt?: string;
};

export type DashboardJobMatch = {
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
  applicationStatus?: string;
};

export type DashboardCareerGoal = {
  id: string;
  title: string;
  status: string;
  progress: number;
  nextSteps: string[];
};

export type DashboardReminder = {
  id: string;
  type: 'UPCOMING_INTERVIEW' | 'NEXT_ROADMAP_TASK' | 'NEWEST_JOB_MATCHES' | 'CAREER_MENTORING';
  title: string;
  description: string;
  actionLabel: string;
  actionLink: string;
  dueAt?: string;
  metadata?: Record<string, unknown>;
};

export type DashboardMetricSummary = {
  totalResumes: number;
  resumesAnalyzed: number;
  applicationsTracked: number;
  interviewPracticeCount: number;
  aiUsageCount: number;
  activeCareerGoals: number;
  completedRoadmapMilestones: number;
  totalRoadmapMilestones: number;
  latestResumeScore: number;
  roadmapCompletion: number;
};

export type DashboardTrendKey =
  | 'resumeScore'
  | 'resumeAnalyses'
  | 'applications'
  | 'interviews'
  | 'aiUsage';

export type DashboardTrend = {
  key: DashboardTrendKey;
  label: string;
  current: number;
  previous: number;
  changePercent: number;
  direction: 'up' | 'down' | 'flat';
  unit: 'count' | 'score' | 'percent';
  series?: Array<{ date: string; value: number | null }>;
};

export type DashboardInsight = {
  id: string;
  severity: 'info' | 'success' | 'warning';
  title: string;
  description: string;
  actionLabel: string;
  actionLink: string;
  source: 'resume' | 'roadmap' | 'interview' | 'jobs' | 'ai' | 'goals';
};

export type DashboardSummary = {
  resumeScore: number;
  interviewAverage: number;
  careerReadiness: number;
  roadmapProgress: number;
  jobMatches: number;
  unreadNotifications: number;
  metrics: DashboardMetricSummary;
  trends: DashboardTrend[];
  insights: DashboardInsight[];
  recentActivity: DashboardActivity[];
  topSkillGaps: DashboardSkillGap[];
  processingAiJobs: DashboardAiJob[];
  recommendedJobs: DashboardJobMatch[];
  applications: Array<{
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
    status: string;
    notes?: string;
    appliedAt?: string;
    interviewAt?: string;
    updatedAt?: string;
  }>;
  careerGoals: DashboardCareerGoal[];
  reminders: DashboardReminder[];
  generatedAt: string;
};

export type DashboardRawData = {
  latestResumeFeedbackScore: number | null;
  latestResumeFeedback: {
    id: string;
    status: ProcessingStatus;
    score: number | null;
    summary: string | null;
    weaknesses: unknown;
    suggestions: unknown;
    rawResponse: unknown;
    resumeId: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  interviewAverage: number | null;
  completedInterviewCount: number;
  upcomingInterview: {
    id: string;
    title: string;
    roleTarget: string;
    scheduledAt: Date | null;
  } | null;
  latestRoadmap: {
    id: string;
    targetRole: string;
    milestones: unknown;
    skills: unknown;
    status: ProcessingStatus;
    updatedAt: Date;
    milestoneRecords: Array<{
      id: string;
      title: string;
      dueDate: Date | null;
      status: string;
      progress: number;
    }>;
  } | null;
  activeJobRecommendationCount: number;
  recommendedJobs: Array<{
    id: string;
    title: string;
    company: string;
    location: string | null;
    jobUrl: string | null;
    source: string;
    skillsMatch: unknown;
    metadata: unknown;
    matchScore: number;
    applications: Array<{ status: string }>;
  }>;
  applications: Array<{
    id: string;
    jobRecommendationId: string;
    status: string;
    notes: string | null;
    appliedAt: Date | null;
    interviewAt: Date | null;
    updatedAt: Date;
    jobRecommendation: {
      title: string;
      company: string;
      location: string | null;
      jobUrl: string | null;
      source: string;
      matchScore: number;
      skillsMatch: unknown;
      metadata: unknown;
    };
  }>;
  careerGoals: Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
    nextSteps: unknown;
  }>;
  unreadNotificationCount: number;
  recentAnalyticsEvents: Array<{
    id: string;
    eventType: AnalyticsEventType;
    eventName: string;
    entityType: string | null;
    entityId: string | null;
    metadata: unknown;
    createdAt: Date;
  }>;
  recentResumes: Array<{
    id: string;
    title: string;
    status: ProcessingStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
  recentInterviews: Array<{
    id: string;
    title: string;
    roleTarget: string;
    status: string;
    score: number | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }>;
  recentRoadmaps: Array<{
    id: string;
    targetRole: string;
    status: ProcessingStatus;
    createdAt: Date;
    updatedAt: Date;
  }>;
  recentAiFeedbacks: Array<{
    id: string;
    type: AiFeedbackType;
    status: ProcessingStatus;
    score: number | null;
    summary: string | null;
    weaknesses: unknown;
    suggestions: unknown;
    resumeId: string | null;
    interviewSessionId: string | null;
    careerRoadmapId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  totalResumes: number;
  resumesAnalyzed: number;
  applicationsTracked: number;
  aiUsageCount: number;
  activeCareerGoalCount: number;
  completedRoadmapMilestones: number;
  totalRoadmapMilestones: number;
  resumeScoreHistory: Array<{
    score: number | null;
    createdAt: Date;
  }>;
  weeklyTrendCounts: {
    currentResumeAnalyses: number;
    previousResumeAnalyses: number;
    currentApplications: number;
    previousApplications: number;
    currentInterviews: number;
    previousInterviews: number;
    currentAiUsage: number;
    previousAiUsage: number;
  };
  activeProcessingRecords: {
    resumes: Array<{
      id: string;
      title: string;
      status: ProcessingStatus;
      createdAt: Date;
      updatedAt: Date;
    }>;
    roadmaps: Array<{
      id: string;
      targetRole: string;
      status: ProcessingStatus;
      createdAt: Date;
      updatedAt: Date;
    }>;
    aiFeedbacks: Array<{
      id: string;
      type: AiFeedbackType;
      status: ProcessingStatus;
      resumeId: string | null;
      interviewSessionId: string | null;
      careerRoadmapId: string | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
  };
};
