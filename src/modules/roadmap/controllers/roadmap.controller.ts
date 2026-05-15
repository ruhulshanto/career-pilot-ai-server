import type { Request, Response } from 'express';
import { roadmapService } from '@modules/roadmap/services/roadmap.service.js';
import {
  apiResponse,
  apiErrorResponse
} from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import { StatusCodes } from 'http-status-codes';
import type {
  CreateRoadmapRequest,
  UpdateRoadmapProgressRequest
} from '../types/roadmap.types.js';

export const generateRoadmap = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const payload: CreateRoadmapRequest = req.body;

    const roadmap = await roadmapService.generateRoadmap(userId, payload);

    return res
      .status(StatusCodes.CREATED)
      .json(apiResponse('Career roadmap generation queued', roadmap));
  }
);

export const getRoadmaps = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = req.query as Record<string, unknown>;

  const result = await roadmapService.getRoadmaps(userId, query as any);

  return res
    .status(StatusCodes.OK)
    .json(
      apiResponse(
        'Career roadmaps retrieved successfully',
        result.data,
        result.pagination
      )
    );
});

export const getLatestRoadmap = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const roadmap = await roadmapService.getLatestRoadmap(userId);

    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Latest career roadmap retrieved successfully', roadmap));
  }
);

export const getRoadmapById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    const roadmap = await roadmapService.getRoadmapById(userId, id);

    if (!roadmap) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json(apiErrorResponse('Career roadmap not found'));
    }

    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Career roadmap retrieved successfully', roadmap));
  }
);

export const updateRoadmapProgress = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    const payload: UpdateRoadmapProgressRequest = req.body;

    const roadmap = await roadmapService.updateRoadmapProgress(
      userId,
      id,
      payload
    );

    return res
      .status(StatusCodes.OK)
      .json(
        apiResponse('Career roadmap progress updated successfully', roadmap)
      );
  }
);
