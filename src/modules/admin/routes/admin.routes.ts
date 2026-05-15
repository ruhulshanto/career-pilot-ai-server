import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware.js';
import {
  getAdminDashboard,
  getAdminSystem,
  retryFailedQueueJobs
} from '@modules/admin/controllers/admin.controller.js';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', getAdminDashboard);
router.get('/system', getAdminSystem);
router.post('/system/queues/:queueName/retry-failed', retryFailedQueueJobs);

router.get('/security/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Admin security route is protected',
    data: { protected: true }
  });
});

export default router;
