
import adminRoutes from '@modules/admin/routes/admin.routes.js';
import analyticsRoutes from '@modules/analytics/routes/analytics.routes.js';
import authRoutes from '@modules/auth/routes/auth.routes.js';
import chatbotRoutes from '@modules/chatbot/routes/chatbot.routes.js';
import interviewsRoutes from '@modules/interviews/routes/interviews.routes.js';
import jobsRoutes from '@modules/jobs/routes/jobs.routes.js';
import notificationsRoutes from '@modules/notifications/routes/notifications.routes.js';
import resumesRoutes from '@modules/resumes/routes/resumes.routes.js';
import roadmapRoutes from '@modules/roadmap/routes/roadmap.routes.js';
import usersRoutes from '@modules/users/routes/users.routes.js';
import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Career platform API is healthy'
  });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/resume', resumesRoutes);
router.use('/roadmap', roadmapRoutes);
router.use('/interviews', interviewsRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/jobs', jobsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/admin', adminRoutes);

export default router;
