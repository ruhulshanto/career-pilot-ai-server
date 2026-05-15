import { prisma } from '@config/prisma.js';
import { NotificationStatus, NotificationType, Prisma, ProcessingStatus } from '@prisma/client';

export const notificationsRepository = {
  /**
   * Create a new notification
   */
  async create(data: Prisma.NotificationUncheckedCreateInput) {
    try {
      return await prisma.notification.create({ data });
    } catch (error) {
      if (
        data.dedupeKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Get user notifications with pagination
   */
  async findByUserId(userId: string, query: { page: number; limit: number; status?: NotificationStatus; types?: NotificationType[] }) {
    const { page, limit, status, types } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = {
      userId,
      status,
      deletedAt: null,
      ...(types?.length ? { type: { in: types } } : {})
    };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.count({
        where
      })
    ]);

    return { items, total };
  },

  countUnread(userId: string) {
    return prisma.notification.count({
      where: { userId, status: NotificationStatus.UNREAD, deletedAt: null }
    });
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId, deletedAt: null },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date()
      }
    });
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, status: NotificationStatus.UNREAD },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date()
      }
    });
  },

  /**
   * Soft delete notification
   */
  async delete(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: {
        deletedAt: new Date()
      }
    });
  },

  getUpcomingScheduledInterviews(now: Date, windowEnd: Date) {
    return prisma.interviewSession.findMany({
      where: {
        deletedAt: null,
        status: 'SCHEDULED',
        scheduledAt: { gt: now, lte: windowEnd }
      },
      select: {
        id: true,
        userId: true,
        title: true,
        roleTarget: true,
        scheduledAt: true,
        user: { select: { firstName: true } }
      },
      orderBy: { scheduledAt: 'asc' },
      take: 200
    });
  },

  getOverdueRoadmapMilestones(now: Date) {
    return prisma.roadmapMilestone.findMany({
      where: {
        status: { not: 'COMPLETED' },
        dueDate: { lt: now },
        roadmap: {
          deletedAt: null,
          status: ProcessingStatus.COMPLETED
        }
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        roadmap: {
          select: {
            id: true,
            userId: true,
            targetRole: true,
            user: { select: { firstName: true } }
          }
        }
      },
      orderBy: { dueDate: 'asc' },
      take: 200
    });
  },

  getCompletedInterviewFeedbackWithoutNotification(since: Date) {
    return prisma.aiFeedback.findMany({
      where: {
        type: 'INTERVIEW_FEEDBACK',
        status: ProcessingStatus.COMPLETED,
        createdAt: { gte: since },
        interviewSessionId: { not: null }
      },
      select: {
        id: true,
        userId: true,
        interviewSessionId: true,
        score: true,
        interviewSession: {
          select: {
            title: true,
            roleTarget: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
  },

  getActiveUsersForReminders() {
    return prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, firstName: true },
      take: 500
    });
  }
};
