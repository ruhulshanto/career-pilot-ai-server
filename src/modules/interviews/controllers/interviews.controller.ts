import type { Request, Response } from 'express';
import { interviewsService } from '@modules/interviews/services/interviews.service.js';
import {
  apiResponse,
  apiErrorResponse
} from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import { StatusCodes } from 'http-status-codes';
import type {
  CreateInterviewSessionRequest,
  GetInterviewSlotsQuery,
  GetInterviewsQuery,
  SubmitInterviewAnswersRequest
} from '../types/interviews.types.js';

export const startInterview = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const payload: CreateInterviewSessionRequest = req.body;

    const interviewSession = await interviewsService.startInterviewSession(
      userId,
      payload
    );

    return res
      .status(StatusCodes.CREATED)
      .json(apiResponse('Interview session created', interviewSession));
  }
);

export const getInterviewSlots = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query: GetInterviewSlotsQuery = req.query;
    const slots = await interviewsService.getAvailableSlots(userId, query);

    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Interview slots retrieved successfully', slots));
  }
);

export const submitInterviewAnswers = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };
    const payload: SubmitInterviewAnswersRequest = req.body;

    const interviewSession = await interviewsService.submitInterviewAnswers(
      userId,
      id,
      payload
    );

    return res
      .status(StatusCodes.ACCEPTED)
      .json(
        apiResponse(
          'Interview answers submitted and feedback queued',
          interviewSession
        )
      );
  }
);

export const getInterviews = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query: GetInterviewsQuery = req.query;

    const result = await interviewsService.getInterviews(userId, query);

    return res
      .status(StatusCodes.OK)
      .json(
        apiResponse(
          'Interview history retrieved successfully',
          result.data,
          result.pagination
        )
      );
  }
);

export const getInterviewById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    const interviewSession = await interviewsService.getInterviewById(
      userId,
      id
    );

    if (!interviewSession) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json(apiErrorResponse('Interview session not found'));
    }

    return res
      .status(StatusCodes.OK)
      .json(
        apiResponse(
          'Interview session retrieved successfully',
          interviewSession
        )
      );
  }
);

export const cancelScheduledInterview = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    await interviewsService.cancelScheduledInterview(userId, id);

    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Scheduled interview cancelled successfully', null));
  }
);
