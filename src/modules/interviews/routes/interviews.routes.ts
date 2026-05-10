import { authenticate } from '@middlewares/auth.middleware.js';
import {
  getInterviewById,
  getInterviews,
  startInterview,
  submitInterviewAnswers
} from '@modules/interviews/controllers/interviews.controller.js';
import {
  getInterviewsQuerySchema,
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

export default router;
