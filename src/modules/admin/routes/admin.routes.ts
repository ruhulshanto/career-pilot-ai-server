import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware.js';
import {
  getAdminDashboard,
  getAdminSystem,
  getAdminUsers,
  getAdminUserDetail,
  getAdminUserActivity,
  updateAdminUserStatus,
  retryFailedQueueJobs
} from '@modules/admin/controllers/admin.controller.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', getAdminDashboard);
router.get('/system', getAdminSystem);
router.get('/users', getAdminUsers);
router.get('/users/:id', getAdminUserDetail);
router.get('/users/:id/activity', getAdminUserActivity);
router.patch('/users/:id/suspend', updateAdminUserStatus);
router.post('/system/queues/:queueName/retry-failed', retryFailedQueueJobs);

router.get('/security/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Admin security route is protected',
    data: { protected: true }
  });
});

export default router;
