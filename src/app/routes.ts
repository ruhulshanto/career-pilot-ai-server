
import adminRoutes from '@modules/admin/routes/admin.routes.js';
import analyticsRoutes from '@modules/analytics/routes/analytics.routes.js';
import authRoutes from '@modules/auth/routes/auth.routes.js';
import chatbotRoutes from '@modules/chatbot/routes/chatbot.routes.js';
import careerRoutes from '@modules/career/routes/career-context.routes.js';
import dashboardRoutes from '@modules/dashboard/routes/dashboard.routes.js';
import interviewsRoutes from '@modules/interviews/routes/interviews.routes.js';
import jobsRoutes from '@modules/jobs/routes/jobs.routes.js';
import mentorRoutes from '@modules/mentor/routes/mentor.routes.js';
import notificationsRoutes from '@modules/notifications/routes/notifications.routes.js';
import onboardingRoutes from '@modules/onboarding/routes/onboarding.routes.js';
import resumesRoutes from '@modules/resumes/routes/resumes.routes.js';
import roadmapRoutes from '@modules/roadmap/routes/roadmap.routes.js';
import usersRoutes from '@modules/users/routes/users.routes.js';
import { systemHealthService } from '@/system/system-health.service.js';
import { Router } from 'express';

const router = Router();

const getHealthMessageStatus = (status: 'online' | 'degraded' | 'offline') =>
  status === 'online' ? 'healthy' : status === 'offline' ? 'unhealthy' : 'degraded';

router.get('/health', async (_req, res) => {
  const health = await systemHealthService.getSystemStatus();
  const statusCode = health.status === 'offline' ? 503 : 200;

  res.status(statusCode).json({
    success: health.status !== 'offline',
    message: `Career platform API is ${getHealthMessageStatus(health.status)}`,
    data: health
  });
});

router.get('/status', async (_req, res) => {
  const status = await systemHealthService.getSystemStatus({ includeDetails: true });
  const statusCode = status.status === 'offline' ? 503 : 200;

  res.status(statusCode).json({
    success: status.status !== 'offline',
    message: 'System status retrieved',
    data: status
  });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/resume', resumesRoutes);
router.use('/roadmap', roadmapRoutes);
router.use('/interviews', interviewsRoutes);
router.use('/chatbot', chatbotRoutes);
router.use('/career', careerRoutes);
router.use('/jobs', jobsRoutes);
router.use('/mentor', mentorRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/admin', adminRoutes);

export default router;
