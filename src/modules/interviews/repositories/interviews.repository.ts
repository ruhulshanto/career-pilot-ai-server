import { prisma } from '@config/prisma.js';
import type { Prisma } from '@prisma/client';
import { InterviewStatus, ProcessingStatus } from '@prisma/client';
import type {
  GetInterviewsQuery,
  InterviewQuestion
} from '../types/interviews.types.js';

export const interviewsRepository = {
  createInterviewSession(data: {
    userId: string;
    title: string;
    roleTarget: string;
    level?: string;
  }) {
    return prisma.interviewSession.create({
      data: {
        ...data,
        status: InterviewStatus.SCHEDULED,
        questions: []
      }
    });
  },

  async getInterviews(userId: string, query: GetInterviewsQuery = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      roleTarget,
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

    if (roleTarget) {
      where.roleTarget = {
        contains: roleTarget,
        mode: 'insensitive'
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { roleTarget: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [interviewSessions, total] = await Promise.all([
      prisma.interviewSession.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          title: true,
          roleTarget: true,
          level: true,
          status: true,
          score: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.interviewSession.count({ where })
    ]);

    return { interviewSessions, total, page, limit };
  },

  async getInterviewById(id: string, userId: string) {
    return prisma.interviewSession.findFirst({
      where: {
        id,
        userId,
        deletedAt: null
      },
      select: {
        id: true,
        userId: true,
        title: true,
        roleTarget: true,
        level: true,
        status: true,
        questions: true,
        transcript: true,
        score: true,
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

  async updateInterviewSession(
    id: string,
    data: {
      questions?: InterviewQuestion[];
      transcript?: unknown;
      status?: InterviewStatus | ProcessingStatus;
      score?: number;
    }
  ) {
    const updateData: Record<string, unknown> = {};

    if (data.questions !== undefined) {
      updateData.questions = data.questions as unknown as Prisma.JsonValue;
    }

    if (data.transcript !== undefined) {
      updateData.transcript = data.transcript as unknown as Prisma.JsonValue;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.score !== undefined) {
      updateData.score = data.score;
    }

    return prisma.interviewSession.update({
      where: { id },
      data: updateData
    });
  },

  createInterviewAiFeedback(data: {
    userId: string;
    interviewSessionId: string;
    provider: string;
    status: ProcessingStatus;
    score?: number;
    summary?: string;
    strengths?: string[];
    weaknesses?: string[];
    suggestions?: string[];
    promptTokens?: number;
    completionTokens?: number;
    rawResponse?: unknown;
  }) {
    return prisma.aiFeedback.create({
      data: {
        userId: data.userId,
        resumeId: null,
        interviewSessionId: data.interviewSessionId,
        careerRoadmapId: null,
        chatbotSessionId: null,
        type: 'INTERVIEW_FEEDBACK',
        provider: data.provider as any,
        status: data.status,
        score: data.score,
        summary: data.summary,
        strengths: data.strengths,
        weaknesses: data.weaknesses,
        suggestions: data.suggestions,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        rawResponse: data.rawResponse as unknown as Prisma.InputJsonValue
      }
    });
  }
};
