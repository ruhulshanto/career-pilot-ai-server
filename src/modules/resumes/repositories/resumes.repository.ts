import { prisma } from '@config/prisma.js';
import {
  AiFeedbackType,
  AiProvider,
  ProcessingStatus,
  type Prisma
} from '@prisma/client';
import { GetResumesQuery } from '../types/resumes.types.js';

export const resumesRepository = {
  createAnalysisJob(data: {
    userId: string;
    title: string;
    fileUrl: string;
    fileType: string;
    fileSize?: number;
  }) {
    return prisma.resume.create({ data });
  },

  async getResumes(userId: string, query: GetResumesQuery = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = query;

    const where: any = {
      userId,
      deletedAt: null
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { parsedText: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [resumes, total] = await Promise.all([
      prisma.resume.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          title: true,
          fileUrl: true,
          fileType: true,
          fileSize: true,
          status: true,
          parsedText: true,
          createdAt: true,
          updatedAt: true,
          aiFeedbacks: {
            select: {
              id: true,
              status: true,
              score: true,
              summary: true,
              createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }),
      prisma.resume.count({ where })
    ]);

    return { resumes, total, page, limit };
  },

  async getResumeById(id: string, userId: string) {
    return prisma.resume.findFirst({
      where: {
        id,
        userId,
        deletedAt: null
      },
      select: {
        id: true,
        userId: true,
        title: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        status: true,
        parsedText: true,
        createdAt: true,
        updatedAt: true,
        aiFeedbacks: {
          select: {
            id: true,
            type: true,
            provider: true,
            status: true,
            score: true,
            summary: true,
            strengths: true,
            weaknesses: true,
            suggestions: true,
            rawResponse: true,
            errorMessage: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  },

  async getResumeForAnalysis(id: string) {
    return prisma.resume.findFirst({
      where: {
        id,
        deletedAt: null
      },
      select: {
        id: true,
        userId: true,
        title: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        status: true,
        parsedText: true,
        createdAt: true,
        updatedAt: true
      }
    });
  },

  async updateResumeStatus(
    id: string,
    status: ProcessingStatus,
    parsedText?: string
  ) {
    return prisma.resume.update({
      where: { id },
      data: {
        status,
        parsedText,
        updatedAt: new Date()
      }
    });
  },

  async createResumeAnalysisFeedback(data: {
    userId: string;
    resumeId: string;
    provider: AiProvider;
    status: ProcessingStatus;
    score?: number;
    summary?: string;
    strengths?: Prisma.InputJsonValue;
    weaknesses?: Prisma.InputJsonValue;
    suggestions?: Prisma.InputJsonValue;
    rawResponse?: Prisma.InputJsonValue;
    errorMessage?: string;
    promptTokens?: number;
    completionTokens?: number;
  }) {
    return prisma.aiFeedback.create({
      data: {
        userId: data.userId,
        resumeId: data.resumeId,
        type: AiFeedbackType.RESUME_ANALYSIS,
        provider: data.provider,
        status: data.status,
        score: data.score,
        summary: data.summary,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        suggestions: data.suggestions,
        rawResponse: data.rawResponse,
        errorMessage: data.errorMessage,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens
      }
    });
  },

  async deleteResumeLifecycle(id: string, userId: string) {
    const resume = await prisma.resume.findFirst({
      where: {
        id,
        userId,
        deletedAt: null
      },
      select: {
        id: true,
        userId: true,
        title: true,
        fileUrl: true
      }
    });

    if (!resume) return null;

    await prisma.$transaction([
      prisma.analyticsEvent.deleteMany({
        where: {
          userId,
          entityType: 'resume',
          entityId: id
        }
      }),
      prisma.notification.updateMany({
        where: {
          userId,
          deletedAt: null,
          metadata: {
            path: ['resumeId'],
            equals: id
          }
        },
        data: {
          deletedAt: new Date()
        }
      }),
      prisma.careerRoadmap.updateMany({
        where: {
          userId,
          sourceResumeId: id,
          deletedAt: null
        },
        data: {
          sourceResumeId: null
        }
      }),
      prisma.resume.delete({
        where: { id }
      })
    ]);

    return resume;
  }
};
