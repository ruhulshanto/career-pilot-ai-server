
import { authenticate } from '@middlewares/auth.middleware.js';
import { getMyProfile } from '@modules/users/controllers/users.controller.js';
import { Router } from 'express';

const router = Router();

router.get('/me', authenticate, getMyProfile);

export default router;
