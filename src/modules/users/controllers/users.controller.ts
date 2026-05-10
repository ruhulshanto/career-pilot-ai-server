
import { usersService } from '@modules/users/services/users.service.js';
import { apiResponse } from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import type { Request, Response } from 'express';

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const profile = await usersService.getProfile(req.user!.id);
  res.json(apiResponse('Profile fetched successfully', profile));
});
