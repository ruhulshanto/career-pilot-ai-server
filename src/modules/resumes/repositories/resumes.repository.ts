import { prisma } from '@config/prisma.js';
import { ProcessingStatus } from '@prisma/client';
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
          updatedAt: true
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
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }
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

  async deleteResume(id: string, userId: string) {
    return prisma.resume.update({
      where: {
        id,
        userId
      },
      data: {
        deletedAt: new Date()
      }
    });
  }
};
