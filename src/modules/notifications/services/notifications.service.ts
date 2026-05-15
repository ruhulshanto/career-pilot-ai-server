import { notificationsRepository } from '../repositories/notifications.repository.js';
import { careerContextService } from '@modules/career/services/career-context.service.js';
import { dashboardCacheService } from '@modules/dashboard/services/dashboard-cache.service.js';
import { getNotificationQueue } from '@queues/index.js';
import { ApiError } from '@shared/errors/api-error.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import type { 
  SendNotificationPayload, 
  GetNotificationsQuery,
  NotificationResponse 
} from '../types/notifications.types.js';
import { NotificationStatus, NotificationType } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

const formatWhen = (date: Date) =>
  date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

const weekKey = (date = new Date()) => {
  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOffset = Math.floor(
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      firstDay.getTime()) /
      DAY_MS
  );
  return `${date.getUTCFullYear()}-W${Math.ceil((dayOffset + firstDay.getUTCDay() + 1) / 7)}`;
};

export const notificationsService = {
  /**
   * Send a notification through multiple channels
   */
  async sendNotification(payload: SendNotificationPayload) {
    const {
      userId,
      type,
      title,
      message,
      actionLink,
      metadata,
      dedupeKey,
      channels
    } = payload;

    // 1. Handle In-App Notification (Persistence)
    if (channels.includes('IN_APP')) {
      await notificationsRepository.create({
        userId,
        type,
        title,
        message,
        actionLink,
        metadata: metadata || {},
        dedupeKey
      });
    }
    await dashboardCacheService.invalidate(userId);

    // 2. Handle Email/Push via Queue
    if (channels.includes('EMAIL')) {
      await getNotificationQueue().add('send-email', {
        userId,
        type: 'EMAIL',
        title,
        message,
        metadata
      });
    }

    return { success: true };
  },

  /**
   * Get user notifications
   */
  async getNotifications(userId: string, query: GetNotificationsQuery) {
    const { page = 1, limit = 10, status, types } = query;
    
    const { items, total } = await notificationsRepository.findByUserId(userId, {
      page,
      limit,
      status,
      types
    });

    return {
      data: items,
      pagination: createPaginationMeta(page, limit, total)
    };
  },

  async getUnreadCount(userId: string) {
    return { count: await notificationsRepository.countUnread(userId) };
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string) {
    const result = await notificationsRepository.markAsRead(id, userId);
    if (result.count === 0) {
      throw new ApiError(404, 'Notification not found');
    }
    await dashboardCacheService.invalidate(userId);
    return { success: true };
  },

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string) {
    await notificationsRepository.markAllAsRead(userId);
    await dashboardCacheService.invalidate(userId);
    return { success: true };
  },

  /**
   * Delete notification
   */
  async deleteNotification(id: string, userId: string) {
    const result = await notificationsRepository.delete(id, userId);
    if (result.count === 0) {
      throw new ApiError(404, 'Notification not found');
    }
    await dashboardCacheService.invalidate(userId);
    return { success: true };
  },

  async notifyInterviewFeedbackAvailable(data: {
    userId: string;
    sessionId: string;
    title?: string;
    roleTarget?: string;
    score?: number;
    feedbackId?: string;
  }) {
    const scoreText =
      typeof data.score === 'number' ? ` You scored ${Math.round(data.score)}%.` : '';
    return this.sendNotification({
      userId: data.userId,
      type: NotificationType.INTERVIEW_FEEDBACK,
      title: 'Interview feedback is ready',
      message: `${data.title ?? data.roleTarget ?? 'Your mock interview'} feedback is available.${scoreText}`,
      actionLink: `/dashboard/user/interview?sessionId=${data.sessionId}`,
      metadata: {
        interviewSessionId: data.sessionId,
        feedbackId: data.feedbackId,
        score: data.score
      },
      dedupeKey: `interview-feedback:${data.feedbackId ?? data.sessionId}`,
      channels: ['IN_APP']
    });
  },

  async notifyJobMatches(userId: string, jobs: Array<{
    id: string;
    title: string;
    company: string;
    matchScore: number;
    metadata?: unknown;
  }>) {
    if (jobs.length === 0) return { success: true };
    const topJob = jobs[0];
    const context = (topJob.metadata ?? {}) as { matcherContextKey?: string; targetRole?: string };

    return this.sendNotification({
      userId,
      type: NotificationType.JOB_MATCH,
      title: `${jobs.length} matched jobs found`,
      message: `Your newest match is ${topJob.title} at ${topJob.company} with a ${Math.round(topJob.matchScore)}% fit.`,
      actionLink: '/dashboard/user/skills',
      metadata: {
        jobIds: jobs.map((job) => job.id),
        targetRole: context.targetRole
      },
      dedupeKey: `job-match:${context.matcherContextKey ?? jobs.map((job) => job.id).join('-')}`,
      channels: ['IN_APP']
    });
  },

  async runInterviewReminderScan() {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + DAY_MS);
    const interviews =
      await notificationsRepository.getUpcomingScheduledInterviews(now, windowEnd);

    let created = 0;
    for (const interview of interviews) {
      if (!interview.scheduledAt) continue;
      const result = await notificationsRepository.create({
        userId: interview.userId,
        type: NotificationType.INTERVIEW_REMINDER,
        title: 'Interview coming up',
        message: `${interview.user.firstName}, your ${interview.roleTarget} interview is scheduled for ${formatWhen(interview.scheduledAt)}.`,
        actionLink: `/dashboard/user/interview?sessionId=${interview.id}`,
        metadata: {
          interviewSessionId: interview.id,
          scheduledAt: interview.scheduledAt.toISOString(),
          roleTarget: interview.roleTarget
        },
        dedupeKey: `interview-reminder:${interview.id}:24h`
      });
      if (result) {
        created += 1;
        await dashboardCacheService.invalidate(interview.userId);
      }
    }

    return { created };
  },

  async runRoadmapReminderScan() {
    const now = new Date();
    const milestones = await notificationsRepository.getOverdueRoadmapMilestones(now);
    let created = 0;

    for (const milestone of milestones) {
      const result = await notificationsRepository.create({
        userId: milestone.roadmap.userId,
        type: NotificationType.ROADMAP_REMINDER,
        title: 'Roadmap milestone needs attention',
        message: `${milestone.roadmap.user.firstName}, "${milestone.title}" is overdue on your ${milestone.roadmap.targetRole} roadmap.`,
        actionLink: '/dashboard/user/roadmap',
        metadata: {
          roadmapId: milestone.roadmap.id,
          milestoneId: milestone.id,
          dueDate: milestone.dueDate?.toISOString()
        },
        dedupeKey: `roadmap-overdue:${milestone.id}`
      });
      if (result) {
        created += 1;
        await dashboardCacheService.invalidate(milestone.roadmap.userId);
      }
    }

    return { created };
  },

  async runInterviewFeedbackReminderScan() {
    const feedbacks =
      await notificationsRepository.getCompletedInterviewFeedbackWithoutNotification(
        new Date(Date.now() - DAY_MS)
      );
    let created = 0;

    for (const feedback of feedbacks) {
      const result = await this.notifyInterviewFeedbackAvailable({
        userId: feedback.userId,
        sessionId: feedback.interviewSessionId!,
        title: feedback.interviewSession?.title,
        roleTarget: feedback.interviewSession?.roleTarget,
        score: feedback.score ?? undefined,
        feedbackId: feedback.id
      });
      if (result.success) created += 1;
    }

    return { created };
  },

  async runLowReadinessReminderScan() {
    const users = await notificationsRepository.getActiveUsersForReminders();
    let created = 0;
    const currentWeek = weekKey();

    for (const user of users) {
      const context = await careerContextService.getCareerContext(user.id);
      if (context.readiness.overall >= 60) continue;

      const result = await notificationsRepository.create({
        userId: user.id,
        type: NotificationType.CAREER_GOAL,
        title: 'Readiness check-in',
        message: `${user.firstName}, your readiness is ${context.readiness.overall}%. ${context.nextAction.reason}`,
        actionLink: context.nextAction.href,
        metadata: {
          readiness: context.readiness,
          nextAction: context.nextAction
        },
        dedupeKey: `low-readiness:${currentWeek}`
      });
      if (result) {
        created += 1;
        await dashboardCacheService.invalidate(user.id);
      }
    }

    return { created };
  },

  async runWeeklyMentoringReminderScan() {
    const users = await notificationsRepository.getActiveUsersForReminders();
    let created = 0;
    const currentWeek = weekKey();

    for (const user of users) {
      const context = await careerContextService.getCareerContext(user.id);
      const result = await notificationsRepository.create({
        userId: user.id,
        type: NotificationType.SYSTEM,
        title: 'Weekly mentoring plan',
        message: `${user.firstName}, your next best move is: ${context.nextAction.label}.`,
        actionLink: '/dashboard/user/chat',
        metadata: {
          readiness: context.readiness,
          nextAction: context.nextAction,
          jobMatches: context.jobs.jobMatches.slice(0, 3)
        },
        dedupeKey: `weekly-mentoring:${currentWeek}`
      });
      if (result) {
        created += 1;
        await dashboardCacheService.invalidate(user.id);
      }
    }

    return { created };
  }
};
