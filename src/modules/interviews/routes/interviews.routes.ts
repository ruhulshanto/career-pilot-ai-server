import { authenticate } from '@middlewares/auth.middleware.js';
import {
  cancelScheduledInterview,
  getInterviewById,
  getInterviewSlots,
  getInterviews,
  startInterview,
  submitInterviewAnswers
} from '@modules/interviews/controllers/interviews.controller.js';
import {
  getInterviewsQuerySchema,
  getInterviewSlotsQuerySchema,
  interviewIdParamSchema,
  startInterviewSchema,
  submitInterviewAnswersSchema
} from '@modules/interviews/validations/interviews.validation.js';
import { validateRequest } from '@shared/validators/validate-request.js';
import { Router } from 'express';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest({ body: startInterviewSchema }),
  startInterview
);
router.get(
  '/slots',
  authenticate,
  validateRequest({ query: getInterviewSlotsQuerySchema }),
  getInterviewSlots
);
router.post(
  '/:id/answers',
  authenticate,
  validateRequest({
    params: interviewIdParamSchema,
    body: submitInterviewAnswersSchema
  }),
  submitInterviewAnswers
);
router.get(
  '/',
  authenticate,
  validateRequest({ query: getInterviewsQuerySchema }),
  getInterviews
);
router.get(
  '/:id',
  authenticate,
  validateRequest({ params: interviewIdParamSchema }),
  getInterviewById
);
router.delete(
  '/:id',
  authenticate,
  validateRequest({ params: interviewIdParamSchema }),
  cancelScheduledInterview
);

export default router;
