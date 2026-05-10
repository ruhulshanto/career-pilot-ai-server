import { authenticate } from '@middlewares/auth.middleware.js';
import {
  analyzeResume,
  deleteResume,
  getResumeById,
  getResumes,
  submitResume
} from '@modules/resumes/controllers/resumes.controller.js';
import {
  getResumesQuerySchema,
  resumeIdParamSchema,
  submitResumeSchema
} from '@modules/resumes/validations/resumes.validation.js';
import { validateRequest } from '@shared/validators/validate-request.js';
import { Router } from 'express';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const router = Router();

router.post(
  '/analyze',
  authenticate,
  upload.single('resume'),
  analyzeResume
);

router.post(
  '/',
  authenticate,
  validateRequest({ body: submitResumeSchema }),
  submitResume
);
router.get(
  '/',
  authenticate,
  validateRequest({ query: getResumesQuerySchema }),
  getResumes
);
router.get(
  '/:id',
  authenticate,
  validateRequest({ params: resumeIdParamSchema }),
  getResumeById
);
router.delete(
  '/:id',
  authenticate,
  validateRequest({ params: resumeIdParamSchema }),
  deleteResume
);

export default router;
