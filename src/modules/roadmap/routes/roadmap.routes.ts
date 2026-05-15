import { authenticate } from '@middlewares/auth.middleware.js';
import {
  generateRoadmap,
  getLatestRoadmap,
  getRoadmapById,
  getRoadmaps,
  updateRoadmapProgress
} from '@modules/roadmap/controllers/roadmap.controller.js';
import {
  createRoadmapSchema,
  getRoadmapsQuerySchema,
  roadmapIdParamSchema,
  updateRoadmapProgressSchema
} from '@modules/roadmap/validations/roadmap.validation.js';
import { validateRequest } from '@shared/validators/validate-request.js';
import { Router } from 'express';

const router = Router();

router.post(
  '/',
  authenticate,
  validateRequest({ body: createRoadmapSchema }),
  generateRoadmap
);
router.get(
  '/',
  authenticate,
  validateRequest({ query: getRoadmapsQuerySchema }),
  getRoadmaps
);
router.get('/latest', authenticate, getLatestRoadmap);
router.get(
  '/:id',
  authenticate,
  validateRequest({ params: roadmapIdParamSchema }),
  getRoadmapById
);
router.patch(
  '/:id/progress',
  authenticate,
  validateRequest({
    params: roadmapIdParamSchema,
    body: updateRoadmapProgressSchema
  }),
  updateRoadmapProgress
);

export default router;
