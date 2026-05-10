
import { authenticate } from '@middlewares/auth.middleware.js';
import {
  getCurrentUser,
  login,
  logout,
  refreshToken,
  register
} from '@modules/auth/controllers/auth.controller.js';
import { loginSchema, registerSchema } from '@modules/auth/validations/auth.validation.js';
import { validateRequest } from '@shared/validators/validate-request.js';
import { authLimiter } from '@middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/register', authLimiter, validateRequest(registerSchema), register);
router.post('/login', authLimiter, validateRequest(loginSchema), login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getCurrentUser);

export default router;
