import { NotificationType, NotificationStatus } from '@prisma/client';

export interface SendNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionLink?: string;
  metadata?: Record<string, any>;
  dedupeKey?: string;
  channels: ('IN_APP' | 'EMAIL')[];
}

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  actionLink?: string;
  metadata?: any;
  readAt?: string;
  createdAt: string;
}

export interface GetNotificationsQuery {
  page?: number;
  limit?: number;
  status?: NotificationStatus;
  types?: NotificationType[];
}

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  templateId?: string;
  templateData?: Record<string, any>;
}
