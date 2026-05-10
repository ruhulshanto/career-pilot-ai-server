import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware.js';
import { chatbotController } from '@modules/chatbot/controllers/chatbot.controller.js';
import { aiLimiter } from '@middlewares/rate-limit.middleware.js';

const router = Router();

/**
 * Chatbot Routes
 * All routes require authentication
 */

// Session management
router.post('/sessions', authenticate, chatbotController.createSession);
router.get('/sessions', authenticate, chatbotController.getSessions);
router.get('/sessions/:sessionId', authenticate, chatbotController.getSession);
router.patch(
  '/sessions/:sessionId',
  authenticate,
  chatbotController.updateSession
);
router.delete(
  '/sessions/:sessionId',
  authenticate,
  chatbotController.deleteSession
);

// Message management
router.get(
  '/sessions/:sessionId/messages',
  authenticate,
  chatbotController.getSessionMessages
);
router.post(
  '/sessions/:sessionId/messages',
  authenticate,
  aiLimiter,
  chatbotController.sendMessage
);
router.get(
  '/sessions/:sessionId/stream',
  authenticate,
  chatbotController.streamMessages
);

export default router;
