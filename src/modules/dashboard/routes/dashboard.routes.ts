import { authenticate } from '@middlewares/auth.middleware.js';
import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller.js';

const router = Router();

router.get('/summary', authenticate, dashboardController.getSummary);

export default router;
