import { logger } from '@/logging/logger.js';
import type { JobProcessor } from '@queues/types.js';
import { prisma } from '@config/prisma.js';
import { AnalyticsEventType, type Prisma } from '@prisma/client';
import { dashboardCacheService } from '@modules/dashboard/services/dashboard-cache.service.js';

export const analyticsProcessor: JobProcessor = async (job) => {
  logger.info({ jobId: job.id }, 'Starting analytics processing');

  try {
    const { event, data, userId } = job.data as {
      event: string;
      data: Record<string, unknown>;
      userId?: string;
    };
    const resolvedUserId =
      userId ?? (typeof data.userId === 'string' ? data.userId : undefined);

    // Map event string to enum if possible, or use SYSTEM as default
    let eventType: AnalyticsEventType = AnalyticsEventType.SYSTEM;
    
    if (event.includes('auth')) eventType = AnalyticsEventType.AUTH;
    else if (event.includes('resume')) eventType = AnalyticsEventType.RESUME;
    else if (event.includes('interview')) eventType = AnalyticsEventType.INTERVIEW;
    else if (event.includes('roadmap')) eventType = AnalyticsEventType.ROADMAP;
    else if (event.includes('chatbot')) eventType = AnalyticsEventType.CHATBOT;
    else if (event.includes('job')) eventType = AnalyticsEventType.JOB;

    await prisma.analyticsEvent.create({
      data: {
        userId: resolvedUserId,
        eventType,
        eventName: event,
        entityType: inferEntityType(data),
        entityId: inferEntityId(data),
        metadata: data as unknown as Prisma.InputJsonValue
      }
    });
    if (resolvedUserId) {
      await dashboardCacheService.invalidate(resolvedUserId);
    }

    logger.info({ jobId: job.id, event, userId: resolvedUserId }, 'Analytics event persisted to database');

    return {
      success: true,
      data: {
        event,
        userId: resolvedUserId,
        persisted: true
      },
      metadata: {
        processingTime: 0,
        recordsProcessed: 1
      }
    };
  } catch (error) {
    logger.error({ jobId: job.id, error }, 'Analytics processing failed');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        attempts: job.attemptsMade
      }
    };
  }
};

const inferEntityType = (data: Record<string, unknown>) => {
  if (typeof data.resumeId === 'string') return 'resume';
  if (typeof data.interviewSessionId === 'string') return 'interview';
  if (typeof data.careerRoadmapId === 'string') return 'roadmap';
  if (typeof data.jobRecommendationId === 'string') return 'jobRecommendation';
  if (typeof data.notificationId === 'string') return 'notification';
  return undefined;
};

const inferEntityId = (data: Record<string, unknown>) => {
  if (typeof data.resumeId === 'string') return data.resumeId;
  if (typeof data.interviewSessionId === 'string') return data.interviewSessionId;
  if (typeof data.careerRoadmapId === 'string') return data.careerRoadmapId;
  if (typeof data.jobRecommendationId === 'string') return data.jobRecommendationId;
  if (typeof data.notificationId === 'string') return data.notificationId;
  return undefined;
};
