import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { apiResponse } from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import { onboardingService } from '../services/onboarding.service.js';

export const onboardingController = {
  getProgress: asyncHandler(async (req: Request, res: Response) => {
    const progress = await onboardingService.getProgress(req.user!.id);
    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Onboarding progress retrieved', progress));
  }),

  completeStep: asyncHandler(async (req: Request, res: Response) => {
    const progress = await onboardingService.completeStep(
      req.user!.id,
      String(req.body.step ?? '')
    );
    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Onboarding step completed', progress));
  }),

  skip: asyncHandler(async (req: Request, res: Response) => {
    const progress = await onboardingService.skip(req.user!.id);
    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Onboarding skipped', progress));
  })
};
