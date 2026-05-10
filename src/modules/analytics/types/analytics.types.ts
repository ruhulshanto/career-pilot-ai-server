import type { AnalyticsEventType } from '@prisma/client';

export interface DashboardSummary {
  totalResumes: number;
  totalInterviews: number;
  totalRoadmaps: number;
  totalChatbotSessions: number;
  activeApplications: number;
  overallScore: number;
}

export interface AiUsageMetrics {
  totalRequests: number;
  totalTokens: number;
  providerDistribution: {
    openai: number;
    gemini: number;
  };
  usageByFeature: Record<string, number>;
  averageResponseTime: number;
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
  averageScoreOverTime: Array<{ date: string; score: number }>;
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
