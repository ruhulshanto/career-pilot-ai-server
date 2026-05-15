import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware.js';
import { validateRequest } from '@shared/validators/validate-request.js';
import { mentorController } from '../controllers/mentor.controller.js';
import {
  addMentorCommentSchema,
  mentorIdParamSchema,
  requestMentorReviewSchema,
  requestMentorSessionSchema,
  updateMentorReviewSchema,
  updateMentorSessionSchema
} from '../validations/mentor.validation.js';

const router = Router();

router.use(authenticate);

router.get('/me', mentorController.getMyMentor);
router.get('/reviews', mentorController.listReviews);
router.post(
  '/reviews',
  authorize('USER', 'ADMIN'),
  validateRequest({ body: requestMentorReviewSchema }),
  mentorController.requestReview
);
router.patch(
  '/reviews/:id',
  authorize('MENTOR', 'COACH', 'ADMIN'),
  validateRequest({ params: mentorIdParamSchema, body: updateMentorReviewSchema }),
  mentorController.updateReview
);
router.post(
  '/reviews/:id/comments',
  validateRequest({ params: mentorIdParamSchema, body: addMentorCommentSchema }),
  mentorController.addComment
);

router.post(
  '/sessions',
  authorize('USER', 'ADMIN'),
  validateRequest({ body: requestMentorSessionSchema }),
  mentorController.requestSession
);
router.patch(
  '/sessions/:id',
  authorize('MENTOR', 'COACH', 'ADMIN'),
  validateRequest({ params: mentorIdParamSchema, body: updateMentorSessionSchema }),
  mentorController.updateSession
);

router.get('/dashboard', authorize('MENTOR', 'COACH', 'ADMIN'), mentorController.getDashboard);

export default router;
