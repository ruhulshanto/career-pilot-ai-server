import { prisma } from '@config/prisma.js';
import type { Prisma } from '@prisma/client';
import { ProcessingStatus } from '@prisma/client';
import type {
  GetRoadmapsQuery,
  RoadmapMilestone,
  RoadmapSkill,
  RoadmapTimeline
} from '../types/roadmap.types.js';

export const roadmapRepository = {
  createCareerRoadmap(data: {
    userId: string;
    targetRole: string;
    currentLevel: string;
    careerGoals: string;
    experienceSummary: string;
    industry: string;
  }) {
    return prisma.careerRoadmap.create({
      data: {
        userId: data.userId,
        targetRole: data.targetRole,
        currentLevel: data.currentLevel,
        status: ProcessingStatus.PENDING,
        milestones: [] as Prisma.JsonArray,
        skills: [] as Prisma.JsonArray,
        timeline: { phases: [], recommendations: [] } as Prisma.JsonObject
      }
    });
  },

  async getCareerRoadmaps(userId: string, query: GetRoadmapsQuery = {}) {
    const {
      page = 1,
      limit = 10,
      status,
      targetRole,
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

    if (targetRole) {
      where.targetRole = { contains: targetRole, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { targetRole: { contains: search, mode: 'insensitive' } },
        { currentLevel: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [roadmaps, total] = await Promise.all([
      prisma.careerRoadmap.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          userId: true,
          targetRole: true,
          currentLevel: true,
          status: true,
          milestones: true,
          skills: true,
          timeline: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.careerRoadmap.count({ where })
    ]);

    return { roadmaps, total, page, limit };
  },

  async getCareerRoadmapById(id: string, userId: string) {
    return prisma.careerRoadmap.findFirst({
      where: {
        id,
        userId,
        deletedAt: null
      },
      select: {
        id: true,
        userId: true,
        targetRole: true,
        currentLevel: true,
        status: true,
        milestones: true,
        skills: true,
        timeline: true,
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

  async updateCareerRoadmap(
    id: string,
    data: {
      milestones?: RoadmapMilestone[];
      skills?: RoadmapSkill[];
      timeline?: RoadmapTimeline;
      status?: ProcessingStatus;
    }
  ) {
    const updateData: Record<string, unknown> = {};

    if (data.milestones !== undefined) {
      updateData.milestones =
        data.milestones as unknown as Prisma.InputJsonValue;
    }

    if (data.skills !== undefined) {
      updateData.skills = data.skills as unknown as Prisma.InputJsonValue;
    }

    if (data.timeline !== undefined) {
      updateData.timeline = data.timeline as unknown as Prisma.InputJsonValue;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    return prisma.careerRoadmap.update({
      where: { id },
      data: updateData
    });
  },

  createRoadmapAiFeedback(data: {
    userId: string;
    careerRoadmapId: string;
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
        interviewSessionId: null,
        careerRoadmapId: data.careerRoadmapId,
        chatbotSessionId: null,
        type: 'ROADMAP_GENERATION',
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
