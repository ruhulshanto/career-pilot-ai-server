import { logger } from '@/logging/logger.js';
import type { JobProcessor } from '@queues/types.js';
import { emailService } from '@shared/email/email.service.js';
import { prisma } from '@config/prisma.js';
import { notificationsService } from '@modules/notifications/services/notifications.service.js';

export const notificationProcessor: JobProcessor = async (job) => {
  logger.info({ jobId: job.id }, 'Starting notification processing');

  try {
    const { event, data } = job.data as {
      event: string;
      data: Record<string, any>;
    };
    const payload = data ?? (job.data as Record<string, any>);

    if (job.name === 'send-email') {
      const { userId, title, message } = payload;

      // 1. Get user email
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true }
      });

      if (!user?.email) {
        throw new Error(`User ${userId} has no email address`);
      }

      // 2. Send email
      await emailService.sendNotificationEmail(user.email, title, message);

      logger.info({ jobId: job.id, userId, email: user.email }, 'Notification email sent');
    }

    if (job.name === 'scan-interview-reminders') {
      return {
        success: true,
        data: await notificationsService.runInterviewReminderScan()
      };
    }

    if (job.name === 'scan-roadmap-reminders') {
      return {
        success: true,
        data: await notificationsService.runRoadmapReminderScan()
      };
    }

    if (job.name === 'scan-interview-feedback') {
      return {
        success: true,
        data: await notificationsService.runInterviewFeedbackReminderScan()
      };
    }

    if (job.name === 'scan-low-readiness') {
      return {
        success: true,
        data: await notificationsService.runLowReadinessReminderScan()
      };
    }

    if (job.name === 'weekly-mentoring-reminders') {
      return {
        success: true,
        data: await notificationsService.runWeeklyMentoringReminderScan()
      };
    }

    return {
      success: true,
      data: {
        processedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    logger.error({ jobId: job.id, error }, 'Notification processing failed');

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        attempts: job.attemptsMade
      }
    };
  }
};
