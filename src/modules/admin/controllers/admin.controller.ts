import { adminService } from '@modules/admin/services/admin.service.js';
import { apiResponse } from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import { ApiError } from '@shared/errors/api-error.js';
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

export const getAdminUsers = asyncHandler(
  async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;

    const result = await adminService.getUsers({
      page,
      limit: Math.min(limit, 50),
      search,
      role,
      status
    });

    res
      .status(StatusCodes.OK)
      .json(apiResponse('Admin users fetched successfully', result));
  }
);

export const getAdminUserDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const user = await adminService.getUserDetail(req.params.id as string);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
    }

    res
      .status(StatusCodes.OK)
      .json(apiResponse('Admin user detail fetched successfully', user));
  }
);

export const getAdminUserActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const activity = await adminService.getUserActivityLogs(req.params.id as string);

    res
      .status(StatusCodes.OK)
      .json(apiResponse('Admin user activity logs fetched successfully', activity));
  }
);

export const updateAdminUserStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const targetId = req.params.id as string;
    const { isActive } = req.body;

    if (req.user?.id === targetId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Admin cannot suspend or modify their own account status'
      );
    }

    const user = await adminService.updateUserStatus(
      targetId,
      typeof isActive === 'boolean' ? isActive : true,
      req.user!.id
    );

    res
      .status(StatusCodes.OK)
      .json(
        apiResponse(
          `User account ${isActive ? 'restored' : 'suspended'} successfully`,
          user
        )
      );
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
