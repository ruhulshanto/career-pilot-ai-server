import { resumesRepository } from '@modules/resumes/repositories/resumes.repository.js';
import { dashboardCacheService } from '@modules/dashboard/services/dashboard-cache.service.js';
import { createSafeJobId, getResumeAnalysisQueue } from '@queues/index.js';
import { isGroqConfigured } from '@config/ai.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import { ApiError } from '@shared/errors/api-error.js';
import { fileStorageService } from '@shared/storage/file-storage.service.js';
import {
  GetResumesQuery,
  ResumeResponse,
  ResumeWithFeedback
} from '../types/resumes.types.js';

type UploadedResume = {
  originalname: string;
  path: string;
  mimetype: string;
  size: number;
};

const extensionFromName = (name: string) => {
  const parts = name.split('.');
  return parts.length > 1 ? parts.at(-1)?.toLowerCase() : undefined;
};

export const resumesService = {
  async submitUploadedResume(
    userId: string,
    file: UploadedResume,
    title?: string
  ): Promise<ResumeResponse> {
    if (!isGroqConfigured()) {
      await fileStorageService.delete(file.path);
      throw new ApiError(
        503,
        'Groq is not configured. Add a valid GROQ_API_KEY in the backend .env and restart the server.',
        { code: 'GROQ_API_KEY_MISSING' }
      );
    }

    const resume = await resumesRepository.createAnalysisJob({
      userId,
      title: title?.trim() || file.originalname,
      fileUrl: file.path,
      fileType: file.mimetype || extensionFromName(file.originalname) || 'unknown',
      fileSize: file.size
    });

    await getResumeAnalysisQueue().add('analyze-resume', {
      resumeId: resume.id,
      userId
    }, {
      jobId: createSafeJobId('resume', 'analysis', userId, resume.id),
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    });
    await dashboardCacheService.invalidate(userId);

    return {
      id: resume.id,
      userId: resume.userId,
      title: resume.title,
      fileType: resume.fileType,
      fileSize: resume.fileSize || undefined,
      status: resume.status,
      parsedText: resume.parsedText || undefined,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt
    };
  },

  async getResumes(userId: string, query: GetResumesQuery = {}) {
    const { resumes, total, page, limit } = await resumesRepository.getResumes(
      userId,
      query
    );

    const paginationMeta = createPaginationMeta(page, limit, total);

    return {
      data: resumes.map((resume) => ({
        id: resume.id,
        userId: resume.userId,
        title: resume.title,
        fileType: resume.fileType,
        fileSize: resume.fileSize || undefined,
        status: resume.status,
        parsedText: resume.parsedText || undefined,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt,
        latestFeedback: resume.aiFeedbacks[0]
          ? {
              id: resume.aiFeedbacks[0].id,
              status: resume.aiFeedbacks[0].status,
              score: resume.aiFeedbacks[0].score || undefined,
              summary: resume.aiFeedbacks[0].summary || undefined,
              createdAt: resume.aiFeedbacks[0].createdAt
            }
          : undefined
      })),
      pagination: paginationMeta
    };
  },

  async getResumeById(
    id: string,
    userId: string
  ): Promise<ResumeWithFeedback | null> {
    const resume = await resumesRepository.getResumeById(id, userId);

    if (!resume) {
      return null;
    }

    return {
      id: resume.id,
      userId: resume.userId,
      title: resume.title,
      fileType: resume.fileType,
      fileSize: resume.fileSize || undefined,
      status: resume.status,
      parsedText: resume.parsedText || undefined,
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
      aiFeedbacks: resume.aiFeedbacks.map((feedback) => ({
        id: feedback.id,
        type: feedback.type,
        provider: feedback.provider,
        status: feedback.status,
        score: feedback.score || undefined,
        summary: feedback.summary || undefined,
        strengths: feedback.strengths,
        weaknesses: feedback.weaknesses,
        suggestions: feedback.suggestions,
        rawResponse: feedback.rawResponse,
        errorMessage: feedback.errorMessage || undefined,
        createdAt: feedback.createdAt
      }))
    };
  },

  async deleteResume(id: string, userId: string): Promise<boolean> {
    const resume = await resumesRepository.deleteResumeLifecycle(id, userId);
    if (!resume) return false;

    await fileStorageService.delete(resume.fileUrl);
    await dashboardCacheService.invalidate(userId);
    return true;
  }
};
