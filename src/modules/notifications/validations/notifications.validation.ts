import { z } from 'zod';
import { NotificationStatus, NotificationType } from '@prisma/client';

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(v => v ? parseInt(v) : 1),
    limit: z.string().optional().transform(v => v ? parseInt(v) : 10),
    status: z.nativeEnum(NotificationStatus).optional(),
    type: z.nativeEnum(NotificationType).optional(),
    types: z.string().optional()
  })
});

export const markAsReadSchema = z.object({
  params: z.object({
    id: z.string().cuid()
  })
});
