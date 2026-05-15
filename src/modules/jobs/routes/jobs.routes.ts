import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware.js';
import { validateRequest } from '@shared/validators/validate-request.js';
import { jobsController } from '../controllers/jobs.controller.js';
import {
  analyzeJobDescriptionSchema,
  createApplicationSchema,
  createGoalSchema,
  updateApplicationSchema,
  updateGoalSchema
} from '../validations/jobs.validation.js';

const router = Router();

router.use(authenticate);

router.get('/recommendations', jobsController.getRecommendations);
router.post('/recommendations/refresh', jobsController.refreshRecommendations);
router.get('/applications', jobsController.getApplications);
router.post(
  '/applications',
  validateRequest({ body: createApplicationSchema }),
  jobsController.createApplication
);
router.patch(
  '/applications/:id',
  validateRequest({ body: updateApplicationSchema }),
  jobsController.updateApplication
);
router.post(
  '/analyze-description',
  validateRequest({ body: analyzeJobDescriptionSchema }),
  jobsController.analyzeJobDescription
);
router.get('/goals', jobsController.getGoals);
router.post('/goals', validateRequest({ body: createGoalSchema }), jobsController.createGoal);
router.patch('/goals/:id', validateRequest({ body: updateGoalSchema }), jobsController.updateGoal);
router.post('/:id/save', jobsController.saveJobLead);
router.post('/:id/apply', jobsController.applyToJob);

export default router;
