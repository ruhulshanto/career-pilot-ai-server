import { resumesRepository } from '@modules/resumes/repositories/resumes.repository.js';
import { getResumeAnalysisQueue } from '@queues/index.js';
import { createPaginationMeta } from '@shared/helpers/pagination.js';
import {
  GetResumesQuery,
  CreateResumeRequest,
  ResumeResponse,
  ResumeWithFeedback
} from '../types/resumes.types.js';

export const resumesService = {
  async submitResume(
    userId: string,
    payload: CreateResumeRequest
  ): Promise<ResumeResponse> {
    const resume = await resumesRepository.createAnalysisJob({
      userId,
      ...payload
    });

    // Trigger AI analysis queue
    await getResumeAnalysisQueue().add('analyze-resume', {
      resumeId: resume.id,
      userId
    });

    return {
      id: resume.id,
      userId: resume.userId,
      title: resume.title,
      fileUrl: resume.fileUrl,
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

    const paginationMeta = createPaginationMeta(total, page, limit);

    return {
      data: resumes.map((resume) => ({
        id: resume.id,
        userId: resume.userId,
        title: resume.title,
        fileUrl: resume.fileUrl,
        fileType: resume.fileType,
        fileSize: resume.fileSize || undefined,
        status: resume.status,
        parsedText: resume.parsedText || undefined,
        createdAt: resume.createdAt,
        updatedAt: resume.updatedAt
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
      fileUrl: resume.fileUrl,
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
        createdAt: feedback.createdAt
      }))
    };
  },

  async deleteResume(id: string, userId: string): Promise<boolean> {
    const resume = await resumesRepository.deleteResume(id, userId);
    return !!resume;
  }
};
