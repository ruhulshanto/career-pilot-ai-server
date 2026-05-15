
import { usersService } from '@modules/users/services/users.service.js';
import { apiErrorResponse, apiResponse } from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import { env } from '@config/env.js';
import type { Request, Response } from 'express';

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await usersService.getProfile(req.user!.id);
  res.json(apiResponse('Profile fetched successfully', profile));
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await usersService.updateProfile(req.user!.id, req.body);
  res.json(apiResponse('Profile updated successfully', profile));
});

export const uploadProfilePhoto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json(apiErrorResponse('Profile photo is required', {
      code: 'PROFILE_PHOTO_REQUIRED'
    }));
    return;
  }

  const uploadBaseUrl =
    env.UPLOAD_PUBLIC_BASE_URL?.replace(/\/$/, '') ??
    `${req.protocol}://${req.get('host')}`;
  const avatarUrl = `${uploadBaseUrl}/uploads/profile-photos/${req.file.filename}`;
  const profile = await usersService.updateProfile(req.user!.id, { avatarUrl });
  res.json(apiResponse('Profile photo uploaded successfully', profile));
});

export const getMyPortfolio = asyncHandler(async (req: Request, res: Response) => {
  const portfolio = await usersService.getMyPortfolio(req.user!.id);
  res.json(apiResponse('Portfolio fetched successfully', portfolio));
});

export const getPublicPortfolio = asyncHandler(async (req: Request, res: Response) => {
  const portfolio = await usersService.getPublicPortfolio(String(req.params.username ?? ''));
  res.json(apiResponse('Public portfolio fetched successfully', portfolio));
});
