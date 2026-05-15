import { analyticsRepository } from '../repositories/analytics.repository.js';
import { getRedis } from '@config/redis.js';
import { logger } from '@/logging/logger.js';
import { ProcessingStatus } from '@prisma/client';
import {
  averageDurationMs,
  buildAverageScoreTrend,
  buildDailyCountTrend,
  clampMetric,
  scoreDistribution,
  topSkillSignals
} from './analytics-calculations.js';
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

    const [counts, avgInterviewScore, avgResumeScore, roadmapCompletion] =
      await Promise.all([
        analyticsRepository.getCounts(userId),
        analyticsRepository.getAverageInterviewScore(userId),
        analyticsRepository.getAverageResumeScore(userId),
        analyticsRepository.getRoadmapCompletion(userId)
      ]);

    const scoreSignals = [avgResumeScore, avgInterviewScore, roadmapCompletion].filter(
      (score) => score > 0
    );

    const summary: DashboardSummary = {
      ...counts,
      roadmapCompletion,
      overallScore: scoreSignals.length
        ? clampMetric(
            scoreSignals.reduce((sum, score) => sum + score, 0) / scoreSignals.length
          )
        : 0
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
    const feedbacks = await analyticsRepository.getAiUsageMetrics(userId);
    const completedOrFailed = feedbacks.filter((feedback) =>
      feedback.status === ProcessingStatus.COMPLETED ||
      feedback.status === ProcessingStatus.FAILED
    );
    const averageResponseTimeMs = averageDurationMs(completedOrFailed);

    return {
      totalRequests: feedbacks.length,
      totalTokens: feedbacks.reduce(
        (sum, feedback) =>
          sum + (feedback.promptTokens ?? 0) + (feedback.completionTokens ?? 0),
        0
      ),
      providerDistribution: feedbacks.reduce<Record<string, number>>((acc, feedback) => {
        const provider = feedback.provider.toLowerCase();
        acc[provider] = (acc[provider] ?? 0) + 1;
        return acc;
      }, {}),
      usageByFeature: feedbacks.reduce<Record<string, number>>((acc, feedback) => {
        acc[feedback.type] = (acc[feedback.type] ?? 0) + 1;
        return acc;
      }, {}),
      averageResponseTime: Math.round(averageResponseTimeMs / 1000),
      averageResponseTimeMs,
      completedRequests: feedbacks.filter(
        (feedback) => feedback.status === ProcessingStatus.COMPLETED
      ).length,
      failedRequests: feedbacks.filter(
        (feedback) => feedback.status === ProcessingStatus.FAILED
      ).length
    };
  },

  /**
   * Get interview performance metrics
   */
  async getInterviewMetrics(userId: string): Promise<InterviewPerformanceMetrics> {
    const [avgScore, trends, counts, scores, skillSignals] = await Promise.all([
      analyticsRepository.getAverageInterviewScore(userId),
      analyticsRepository.getInterviewTrends(userId),
      analyticsRepository.getCounts(userId),
      analyticsRepository.getCompletedInterviewScores(userId),
      analyticsRepository.getInterviewSkillSignals(userId)
    ]);

    return {
      averageScore: clampMetric(avgScore),
      totalInterviews: counts.totalInterviews,
      scoreDistribution: scoreDistribution(scores.map((score) => score.score)),
      topSkills: topSkillSignals(
        skillSignals.flatMap((feedback) => [
          feedback.strengths,
          feedback.weaknesses,
          feedback.suggestions,
          feedback.rawResponse
        ])
      ),
      improvementTrend: trends
    };
  },

  /**
   * Get resume trends
   */
  async getResumeTrends(userId: string): Promise<ResumeTrends> {
    const [distribution, submissions, scoreHistory] = await Promise.all([
      analyticsRepository.getResumeStatusDistribution(userId),
      analyticsRepository.getResumeSubmissions(userId),
      analyticsRepository.getResumeScoreHistory(userId)
    ]);

    return {
      submissionTrend: buildDailyCountTrend(submissions),
      statusDistribution: distribution,
      averageScoreOverTime: buildAverageScoreTrend(scoreHistory)
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
