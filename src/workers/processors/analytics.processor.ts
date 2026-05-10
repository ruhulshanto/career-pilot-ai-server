import { logger } from '@/logging/logger.js';
import type { JobProcessor } from '@queues/types.js';
import { prisma } from '@config/prisma.js';
import { AnalyticsEventType, type Prisma } from '@prisma/client';

export const analyticsProcessor: JobProcessor = async (job) => {
  logger.info({ jobId: job.id }, 'Starting analytics processing');

  try {
    const { event, data, userId } = job.data as {
      event: string;
      data: Record<string, unknown>;
      userId?: string;
    };

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
        userId,
        eventType,
        eventName: event,
        metadata: data as unknown as Prisma.InputJsonValue
      }
    });

    logger.info({ jobId: job.id, event, userId }, 'Analytics event persisted to database');

    return {
      success: true,
      data: {
        event,
        userId,
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
