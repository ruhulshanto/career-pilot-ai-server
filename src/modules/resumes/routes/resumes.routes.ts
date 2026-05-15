import { authenticate } from '@middlewares/auth.middleware.js';
import {
  analyzeResume,
  deleteResume,
  getResumeById,
  getResumes,
  rejectDirectResumeSubmission
} from '@modules/resumes/controllers/resumes.controller.js';
import {
  getResumesQuerySchema,
  resumeIdParamSchema
} from '@modules/resumes/validations/resumes.validation.js';
import {
  RESUME_ALLOWED_EXTENSIONS,
  RESUME_ALLOWED_MIME_TYPES,
  RESUME_MAX_FILE_SIZE_BYTES,
  RESUME_PRIVATE_UPLOAD_DIR,
  UNSUPPORTED_RESUME_FILE_MESSAGE,
  isSupportedResumeUpload
} from '@modules/resumes/services/resume-text-extraction.service.js';
import { ApiError } from '@shared/errors/api-error.js';
import { validateRequest } from '@shared/validators/validate-request.js';
import { uploadLimiter } from '@middlewares/rate-limit.middleware.js';
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const upload = multer({
  storage: multer.diskStorage({
    destination: RESUME_PRIVATE_UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${randomUUID()}${extension}`);
    }
  }),
  limits: {
    fileSize: RESUME_MAX_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const allowedMime = RESUME_ALLOWED_MIME_TYPES.includes(
      file.mimetype as (typeof RESUME_ALLOWED_MIME_TYPES)[number]
    );
    const allowedExtension = RESUME_ALLOWED_EXTENSIONS.includes(
      extension as (typeof RESUME_ALLOWED_EXTENSIONS)[number]
    );

    if (
      !allowedMime ||
      !allowedExtension ||
      !isSupportedResumeUpload(file.originalname, file.mimetype)
    ) {
      cb(
        new ApiError(400, UNSUPPORTED_RESUME_FILE_MESSAGE, {
          code: 'UNSUPPORTED_RESUME_FILE_TYPE'
        })
      );
      return;
    }

    cb(null, true);
  }
});
const router = Router();

router.post(
  '/analyze',
  authenticate,
  uploadLimiter,
  upload.single('resume'),
  analyzeResume
);

router.post(
  '/',
  authenticate,
  rejectDirectResumeSubmission
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
