import { prisma } from '@config/prisma.js';
import { NotificationStatus, type Prisma } from '@prisma/client';

export const notificationsRepository = {
  /**
   * Create a new notification
   */
  async create(data: Prisma.NotificationUncheckedCreateInput) {
    return prisma.notification.create({
      data
    });
  },

  /**
   * Get user notifications with pagination
   */
  async findByUserId(userId: string, query: { page: number; limit: number; status?: NotificationStatus }) {
    const { page, limit, status } = query;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, status, deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.notification.count({
        where: { userId, status, deletedAt: null }
      })
    ]);

    return { items, total };
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
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
  }
};
