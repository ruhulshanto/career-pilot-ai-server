import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { dashboardService } from '../services/dashboard.service.js';
import { apiResponse } from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';

export const dashboardController = {
  getSummary: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const summary = await dashboardService.getSummary(userId);

    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Dashboard summary retrieved successfully', summary));
  })
};
