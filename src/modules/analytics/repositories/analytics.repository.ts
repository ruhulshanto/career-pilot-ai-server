import { prisma } from '@config/prisma.js';
import { AnalyticsEventType, ProcessingStatus } from '@prisma/client';

export const analyticsRepository = {
  /**
   * Get total counts for dashboard summary
   */
  async getCounts(userId: string) {
    const [resumes, interviews, roadmaps, chatbots] = await Promise.all([
      prisma.resume.count({ where: { userId, deletedAt: null } }),
      prisma.interviewSession.count({ where: { userId, deletedAt: null } }),
      prisma.careerRoadmap.count({ where: { userId, deletedAt: null } }),
      prisma.chatbotSession.count({ where: { userId, deletedAt: null } })
    ]);

    return {
      totalResumes: resumes,
      totalInterviews: interviews,
      totalRoadmaps: roadmaps,
      totalChatbotSessions: chatbots
    };
  },

  /**
   * Get average interview scores
   */
  async getAverageInterviewScore(userId: string) {
    const aggregate = await prisma.interviewSession.aggregate({
      where: { userId, status: 'COMPLETED' },
      _avg: { score: true }
    });
    return aggregate._avg.score || 0;
  },

  /**
   * Get AI usage metrics
   */
  async getAiUsageMetrics(userId: string) {
    const feedbacks = await prisma.aiFeedback.findMany({
      where: { userId },
      select: {
        provider: true,
        type: true,
        promptTokens: true,
        completionTokens: true
      }
    });

    const totalRequests = feedbacks.length;
    let totalTokens = 0;
    const providerDistribution = { openai: 0, gemini: 0 };
    const usageByFeature: Record<string, number> = {};

    feedbacks.forEach((f) => {
      totalTokens += (f.promptTokens || 0) + (f.completionTokens || 0);
      
      const provider = f.provider.toLowerCase();
      if (provider === 'openai') providerDistribution.openai++;
      else if (provider === 'gemini') providerDistribution.gemini++;

      usageByFeature[f.type] = (usageByFeature[f.type] || 0) + 1;
    });

    return {
      totalRequests,
      totalTokens,
      providerDistribution,
      usageByFeature,
      averageResponseTime: 0 // Placeholder
    };
  },

  /**
   * Get interview performance trends (last 7 completed interviews)
   */
  async getInterviewTrends(userId: string) {
    const interviews = await prisma.interviewSession.findMany({
      where: { userId, status: 'COMPLETED', score: { not: null } },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { createdAt: true, score: true }
    });

    return interviews.map((i) => ({
      date: i.createdAt.toISOString().split('T')[0],
      score: i.score || 0
    }));
  },

  /**
   * Get resume status distribution
   */
  async getResumeStatusDistribution(userId: string) {
    const statuses = await prisma.resume.groupBy({
      by: ['status'],
      where: { userId, deletedAt: null },
      _count: { _all: true }
    });

    const distribution: Record<string, number> = {};
    statuses.forEach((s) => {
      distribution[s.status] = s._count._all;
    });

    return distribution;
  },

  /**
   * Get recent activity log
   */
  async getRecentActivity(userId: string, limit = 10) {
    return prisma.analyticsEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
};
