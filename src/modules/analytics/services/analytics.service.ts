import { analyticsRepository } from '../repositories/analytics.repository.js';
import { getRedis } from '@config/redis.js';
import { logger } from '@/logging/logger.js';
import type { 
  DashboardSummary, 
  AiUsageMetrics, 
  InterviewPerformanceMetrics, 
  ResumeTrends 
} from '../types/analytics.types.js';

const CACHE_TTL = 300; // 5 minutes

export const analyticsService = {
  /**
   * Get main dashboard summary
   * Uses Redis caching for performance
   */
  async getDashboardSummary(userId: string): Promise<DashboardSummary> {
    const cacheKey = `analytics:summary:${userId}`;
    const redis = getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.error({ err }, 'Redis error in analytics service');
    }

    const counts = await analyticsRepository.getCounts(userId);
    const avgScore = await analyticsRepository.getAverageInterviewScore(userId);

    const summary: DashboardSummary = {
      ...counts,
      activeApplications: 0, // Future feature
      overallScore: avgScore
    };

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(summary));
    } catch (err) {
      logger.error({ err }, 'Redis set error in analytics service');
    }

    return summary;
  },

  /**
   * Get AI usage metrics
   */
  async getAiMetrics(userId: string): Promise<AiUsageMetrics> {
    return analyticsRepository.getAiUsageMetrics(userId);
  },

  /**
   * Get interview performance metrics
   */
  async getInterviewMetrics(userId: string): Promise<InterviewPerformanceMetrics> {
    const avgScore = await analyticsRepository.getAverageInterviewScore(userId);
    const trends = await analyticsRepository.getInterviewTrends(userId);
    const counts = await analyticsRepository.getCounts(userId);

    return {
      averageScore: avgScore,
      totalInterviews: counts.totalInterviews,
      scoreDistribution: {}, // Simplified for now
      topSkills: [], // Placeholder
      improvementTrend: trends
    };
  },

  /**
   * Get resume trends
   */
  async getResumeTrends(userId: string): Promise<ResumeTrends> {
    const distribution = await analyticsRepository.getResumeStatusDistribution(userId);
    
    return {
      submissionTrend: [], // Placeholder
      statusDistribution: distribution,
      averageScoreOverTime: [] // Placeholder
    };
  },

  /**
   * Get user activity log
   */
  async getActivityLog(userId: string) {
    const logs = await analyticsRepository.getRecentActivity(userId);
    return logs.map(log => ({
      id: log.id,
      eventType: log.eventType,
      eventName: log.eventName,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString()
    }));
  }
};
