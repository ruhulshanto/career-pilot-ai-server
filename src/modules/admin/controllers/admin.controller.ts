import { adminService } from '@modules/admin/services/admin.service.js';
import { apiResponse } from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const getAdminDashboard = asyncHandler(
  async (_req: Request, res: Response) => {
    const dashboard = await adminService.getDashboard();

    res
      .status(StatusCodes.OK)
      .json(apiResponse('Admin dashboard fetched successfully', dashboard));
  }
);

export const getAdminSystem = asyncHandler(
  async (_req: Request, res: Response) => {
    const system = await adminService.getSystem();

    res
      .status(StatusCodes.OK)
      .json(apiResponse('Admin system diagnostics fetched successfully', system));
  }
);

export const retryFailedQueueJobs = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await adminService.retryFailedJobs(
      req.params.queueName as any,
      req.body?.limit
    );

    res
      .status(StatusCodes.OK)
      .json(apiResponse('Failed queue jobs retry requested', result));
  }
);
