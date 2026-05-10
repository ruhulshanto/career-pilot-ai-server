import { notificationsRepository } from '../repositories/notifications.repository.js';
import { getNotificationQueue } from '@queues/index.js';
import { ApiError } from '@shared/errors/api-error.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import type { 
  SendNotificationPayload, 
  GetNotificationsQuery,
  NotificationResponse 
} from '../types/notifications.types.js';
import { NotificationStatus } from '@prisma/client';

export const notificationsService = {
  /**
   * Send a notification through multiple channels
   */
  async sendNotification(payload: SendNotificationPayload) {
    const { userId, type, title, message, metadata, channels } = payload;

    // 1. Handle In-App Notification (Persistence)
    if (channels.includes('IN_APP')) {
      await notificationsRepository.create({
        userId,
        type,
        title,
        message,
        metadata: metadata || {}
      });
    }

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
    const { page = 1, limit = 10, status } = query;
    
    const { items, total } = await notificationsRepository.findByUserId(userId, {
      page,
      limit,
      status
    });

    return {
      data: items,
      pagination: createPaginationMeta(total, page, limit)
    };
  },

  /**
   * Mark notification as read
   */
  async markAsRead(id: string, userId: string) {
    const result = await notificationsRepository.markAsRead(id, userId);
    if (result.count === 0) {
      throw new ApiError(404, 'Notification not found');
    }
    return { success: true };
  },

  /**
   * Mark all as read
   */
  async markAllAsRead(userId: string) {
    await notificationsRepository.markAllAsRead(userId);
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
    return { success: true };
  }
};
