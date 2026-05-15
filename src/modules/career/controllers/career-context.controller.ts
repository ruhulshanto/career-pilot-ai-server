import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { careerContextService } from '../services/career-context.service.js';
import { apiResponse } from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';

export const getCareerContext = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const context = await careerContextService.getCareerContext(userId);

    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Career context retrieved successfully', context));
  }
);
