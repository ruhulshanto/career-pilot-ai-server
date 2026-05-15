
import { authenticate } from '@middlewares/auth.middleware.js';
import {
  demoLogin,
  forgotPassword,
  getSessions,
  getCurrentUser,
  login,
  logout,
  refreshToken,
  register,
  resendVerification,
  resetPassword,
  revokeOtherSessions,
  revokeSession,
  verifyEmail
} from '@modules/auth/controllers/auth.controller.js';
import {
  demoLoginSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  sessionIdParamSchema,
  verifyEmailSchema
} from '@modules/auth/validations/auth.validation.js';
import { validateRequest } from '@shared/validators/validate-request.js';
import { authLimiter, passwordResetLimiter } from '@middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/register', authLimiter, validateRequest(registerSchema), register);
router.post('/login', authLimiter, validateRequest(loginSchema), login);
router.post('/demo-login', authLimiter, validateRequest({ body: demoLoginSchema }), demoLogin);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getCurrentUser);
router.post('/verify-email', authLimiter, validateRequest({ body: verifyEmailSchema }), verifyEmail);
router.post('/resend-verification', authenticate, authLimiter, resendVerification);
router.post('/forgot-password', passwordResetLimiter, validateRequest({ body: forgotPasswordSchema }), forgotPassword);
router.post('/reset-password', passwordResetLimiter, validateRequest({ body: resetPasswordSchema }), resetPassword);
router.get('/sessions', authenticate, getSessions);
router.delete(
  '/sessions/:sessionId',
  authenticate,
  validateRequest({ params: sessionIdParamSchema }),
  revokeSession
);
router.post('/sessions/revoke-others', authenticate, revokeOtherSessions);

export default router;
