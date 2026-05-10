import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware.js';
import { notificationsController } from '../controllers/notifications.controller.js';

const router = Router();

/**
 * Notification Routes
 * All routes require authentication
 */

// List notifications
router.get('/', authenticate, notificationsController.getNotifications);

// Mark all as read
router.patch('/read-all', authenticate, notificationsController.markAllAsRead);

// Mark specific as read
router.patch('/:id/read', authenticate, notificationsController.markAsRead);

// Delete notification
router.delete('/:id', authenticate, notificationsController.deleteNotification);

export default router;
