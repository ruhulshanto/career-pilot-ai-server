import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware.js';
import { onboardingController } from '../controllers/onboarding.controller.js';

const router = Router();

router.use(authenticate);

router.get('/progress', onboardingController.getProgress);
router.post('/complete-step', onboardingController.completeStep);
router.post('/skip', onboardingController.skip);

export default router;
