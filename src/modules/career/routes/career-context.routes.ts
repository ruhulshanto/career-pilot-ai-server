import { authenticate } from '@middlewares/auth.middleware.js';
import { getCareerContext } from '../controllers/career-context.controller.js';
import { Router } from 'express';

const router = Router();

router.get('/context', authenticate, getCareerContext);

export default router;
