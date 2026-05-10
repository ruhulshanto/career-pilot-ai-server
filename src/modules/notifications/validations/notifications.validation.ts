import { z } from 'zod';
import { NotificationStatus } from '@prisma/client';

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(v => v ? parseInt(v) : 1),
    limit: z.string().optional().transform(v => v ? parseInt(v) : 10),
    status: z.nativeEnum(NotificationStatus).optional()
  })
});

export const markAsReadSchema = z.object({
  params: z.object({
    id: z.string().cuid()
  })
});
