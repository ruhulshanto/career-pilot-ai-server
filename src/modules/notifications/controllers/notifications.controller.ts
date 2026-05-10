import { asyncHandler } from '@shared/utils/async-handler.js';
import { notificationsService } from '../services/notifications.service.js';
import { apiResponse } from '@shared/responses/api-response.js';
import { NotificationStatus } from '@prisma/client';
import type { Request, Response } from 'express';

export const notificationsController = {
  /**
   * GET /api/notifications
   */
  getNotifications: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id!;
    const { page, limit, status } = req.query as any;

    const result = await notificationsService.getNotifications(userId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      status: status as NotificationStatus
    });

    res.status(200).json(apiResponse('Notifications retrieved', result.data, result.pagination));
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
