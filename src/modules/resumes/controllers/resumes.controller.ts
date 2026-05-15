import type { Request, Response } from 'express';
import { resumesService } from '@modules/resumes/services/resumes.service.js';
import {
  apiResponse,
  apiErrorResponse
} from '@shared/responses/api-response.js';
import { asyncHandler } from '@shared/utils/async-handler.js';
import { GetResumesQuery } from '../types/resumes.types.js';
import { StatusCodes } from 'http-status-codes';
import { analyzeResumeUploadSchema } from '../validations/resumes.validation.js';
import { unlink } from 'node:fs/promises';

const cleanupUploadedFile = async (file?: Express.Multer.File) => {
  if (!file?.path) return;
  await unlink(file.path).catch(() => undefined);
};

export const rejectDirectResumeSubmission = asyncHandler(
  async (_req: Request, res: Response) =>
    res
      .status(StatusCodes.BAD_REQUEST)
      .json(
        apiErrorResponse(
          'Resume files must be uploaded directly as PDF, DOCX, or TXT files.'
        )
      )
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
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json(apiErrorResponse('No resume file provided'));
    }

    const validation = analyzeResumeUploadSchema.safeParse(req.body);
    if (!validation.success) {
      await cleanupUploadedFile(file);
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json(apiErrorResponse('Invalid resume analysis request'));
    }

    const resume = await resumesService.submitUploadedResume(
      userId,
      file,
      validation.data.title
    );

    return res
      .status(StatusCodes.ACCEPTED)
      .json(apiResponse('Resume analysis queued successfully', resume));
  }
);
