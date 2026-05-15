import { asyncHandler } from '@shared/utils/async-handler.js';
import { notificationsService } from '../services/notifications.service.js';
import { apiResponse } from '@shared/responses/api-response.js';
import { NotificationStatus, NotificationType } from '@prisma/client';
import type { Request, Response } from 'express';

export const notificationsController = {
  /**
   * GET /api/notifications
   */
  getNotifications: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const { page, limit, status, type, types } = req.query as any;
    const rawTypes = types ?? type;
    const typeFilters = rawTypes
      ? String(rawTypes)
          .split(',')
          .map((value) => value.trim())
          .filter((value): value is NotificationType =>
            Object.values(NotificationType).includes(value as NotificationType)
          )
      : undefined;

    const result = await notificationsService.getNotifications(userId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status: status as NotificationStatus,
      types: typeFilters?.length ? typeFilters : undefined
    });

    res.status(200).json(apiResponse('Notifications retrieved', result.data, result.pagination));
  }),

  /**
   * GET /api/notifications/unread-count
   */
  getUnreadCount: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const result = await notificationsService.getUnreadCount(userId);

    res.status(200).json(apiResponse('Unread notifications retrieved', result));
  }),

  /**
   * PATCH /api/notifications/:id/read
   */
  markAsRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const id = req.params.id as string;

    await notificationsService.markAsRead(id, userId);

    res.status(200).json(apiResponse('Notification marked as read'));
  }),

  /**
   * PATCH /api/notifications/read-all
   */
  markAllAsRead: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;

    await notificationsService.markAllAsRead(userId);

    res.status(200).json(apiResponse('All notifications marked as read'));
  }),

  /**
   * DELETE /api/notifications/:id
   */
  deleteNotification: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const id = req.params.id as string;

    await notificationsService.deleteNotification(id, userId);

    res.status(200).json(apiResponse('Notification deleted'));
  })
};
