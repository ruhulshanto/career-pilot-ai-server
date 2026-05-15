import type { AnalyticsEventType } from '@prisma/client';

export interface DashboardSummary {
  totalResumes: number;
  resumesAnalyzed: number;
  totalInterviews: number;
  completedInterviews: number;
  totalRoadmaps: number;
  totalChatbotSessions: number;
  activeApplications: number;
  totalApplications: number;
  aiUsageCount: number;
  roadmapCompletion: number;
  overallScore: number;
}

export interface AiUsageMetrics {
  totalRequests: number;
  totalTokens: number;
  providerDistribution: Record<string, number>;
  usageByFeature: Record<string, number>;
  averageResponseTime: number;
  averageResponseTimeMs: number;
  completedRequests: number;
  failedRequests: number;
}

export interface InterviewPerformanceMetrics {
  averageScore: number;
  totalInterviews: number;
  scoreDistribution: Record<string, number>;
  topSkills: string[];
  improvementTrend: Array<{ date: string; score: number }>;
}

export interface ResumeTrends {
  submissionTrend: Array<{ date: string; count: number }>;
  statusDistribution: Record<string, number>;
  averageScoreOverTime: Array<{ date: string; score: number | null }>;
}

export interface ActivityLog {
  id: string;
  eventType: AnalyticsEventType;
  eventName: string;
  metadata: any;
  createdAt: string;
}

export interface GetAnalyticsQuery {
  startDate?: string;
  endDate?: string;
  userId?: string;
}
