import type { Request, Response } from 'express';
import { resumesService } from '@modules/resumes/services/resumes.service.js';
import {
  apiResponse,
  apiErrorResponse
} from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import {
  CreateResumeRequest,
  GetResumesQuery
} from '../types/resumes.types.js';
import { StatusCodes } from 'http-status-codes';

export const submitResume = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const payload: CreateResumeRequest = req.body;

    const resume = await resumesService.submitResume(userId, payload);

    return res
      .status(StatusCodes.CREATED)
      .json(apiResponse('Resume submitted successfully', resume));
  }
);

export const getResumes = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query: GetResumesQuery = req.query;

  const result = await resumesService.getResumes(userId, query);

  return res
    .status(StatusCodes.OK)
    .json(apiResponse('Resumes retrieved successfully', result));
});

export const getResumeById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    const resume = await resumesService.getResumeById(id, userId);

    if (!resume) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json(apiErrorResponse('Resume not found'));
    }

    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Resume retrieved successfully', resume));
  }
);

export const deleteResume = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { id } = req.params as { id: string };

    const deleted = await resumesService.deleteResume(id, userId);

    if (!deleted) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json(apiErrorResponse('Resume not found'));
    }

    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Resume deleted successfully', null));
  }
);

type ResumeUploadRequest = Request & { file?: Express.Multer.File };

export const analyzeResume = asyncHandler(
  async (req: ResumeUploadRequest, res: Response) => {
    const file = req.file;

    if (!file) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json(apiErrorResponse('No resume file provided'));
    }

    // Simulate analysis result
    const result = {
      score: 85,
      suggestions: [
        'Add more quantifiable achievements in your AI Engineer role.',
        'Highlight your experience with BullMQ and Redis more clearly.',
        'Include your contributions to open-source neural architectures.'
      ],
      stats: {
        keywordMatch: 78,
        formatting: 92,
        impact: 81
      }
    };

    return res
      .status(StatusCodes.OK)
      .json(apiResponse('Resume analysis complete', result));
  }
);
