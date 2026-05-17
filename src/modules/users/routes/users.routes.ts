
import { authenticate } from '@middlewares/auth.middleware.js';
import { validateRequest } from '@shared/validators/validate-request.js';
import {
  getMyPortfolio,
  getMyProfile,
  getPublicPortfolio,
  updateMyProfile,
  uploadProfilePhoto
} from '@modules/users/controllers/users.controller.js';
import { updateUserProfileSchema } from '../validations/users.validation.js';
import { ApiError } from '@shared/errors/api-error.js';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { env } from '@config/env.js';

const PROFILE_PHOTO_DIR = path.resolve(env.UPLOADS_DIR, 'profile-photos');
mkdirSync(PROFILE_PHOTO_DIR, { recursive: true });

const profilePhotoStorage = multer.diskStorage({
  destination: PROFILE_PHOTO_DIR,
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage: profilePhotoStorage,
  limits: {
    fileSize: 1 * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const isAllowed =
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype) &&
      ['.jpg', '.jpeg', '.png', '.webp'].includes(extension);

    if (!isAllowed) {
      cb(new ApiError(400, 'Unsupported profile photo type. Upload a JPG, PNG, or WEBP image.', {
        code: 'UNSUPPORTED_PROFILE_PHOTO_TYPE'
      }));
      return;
    }

    cb(null, true);
  }
});

const router = Router();

router.get('/public/:username', getPublicPortfolio);
router.get('/me', authenticate, getMyProfile);
router.patch('/me', authenticate, validateRequest({ body: updateUserProfileSchema }), updateMyProfile);
router.post('/me/photo', authenticate, upload.single('photo'), uploadProfilePhoto);
router.get('/me/portfolio', authenticate, getMyPortfolio);

export default router;
