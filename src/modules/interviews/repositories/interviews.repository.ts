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
    availabilityId?: string;
    title: string;
    roleTarget: string;
    level?: string;
    scheduledAt?: Date;
    status?: InterviewStatus;
    startedAt?: Date;
  }) {
    return prisma.interviewSession.create({
      data: {
        ...data,
        status: data.status ?? InterviewStatus.SCHEDULED,
        questions: []
      }
    });
  },

  async getInterviewSessionMeta(id: string) {
    return prisma.interviewSession.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        scheduledAt: true,
        status: true
      }
    });
  },

  async getScheduledInterviewsInRange(
    userId: string,
    startAt: Date,
    endAt: Date,
    filters: {
      roleTarget?: string;
      level?: string;
    } = {}
  ) {
    const where: Prisma.InterviewSessionWhereInput = {
      userId,
      deletedAt: null,
      scheduledAt: {
        gte: startAt,
        lt: endAt
      },
      status: {
        in: [InterviewStatus.SCHEDULED, InterviewStatus.IN_PROGRESS]
      }
    };

    if (filters.roleTarget) {
      where.roleTarget = {
        equals: filters.roleTarget,
        mode: 'insensitive'
      };
    }

    if (filters.level) {
      where.level = {
        equals: filters.level,
        mode: 'insensitive'
      };
    }

    return prisma.interviewSession.findMany({
      where,
      select: {
        scheduledAt: true
      }
    });
  },

  async ensureAvailabilityForRoleLevel(data: {
    roleTarget: string;
    level?: string;
    localDate: {
      year: number;
      month: number;
      day: number;
    };
    timezoneOffsetMinutes: number;
    days: number;
    slotHours: number[];
    durationMinutes: number;
    capacity: number;
  }) {
    const slots: Prisma.InterviewerAvailabilityCreateManyInput[] = [];
    const roleTarget = data.roleTarget.replace(/\s+/g, ' ').trim();
    const level = (data.level ?? 'General').replace(/\s+/g, ' ').trim();
    const baseLocalMidnightUtcMs =
      Date.UTC(data.localDate.year, data.localDate.month - 1, data.localDate.day) +
      data.timezoneOffsetMinutes * 60_000;

    for (let dayOffset = 0; dayOffset < data.days; dayOffset += 1) {
      for (const hour of data.slotHours) {
        const startsAt = new Date(
          baseLocalMidnightUtcMs +
            dayOffset * 24 * 60 * 60_000 +
            hour * 60 * 60_000
        );
        const endsAt = new Date(startsAt);
        endsAt.setMinutes(startsAt.getMinutes() + data.durationMinutes);

        slots.push({
          roleTarget,
          level,
          startsAt,
          endsAt,
          capacity: data.capacity
        });
      }
    }

    if (slots.length) {
      await prisma.interviewerAvailability.createMany({
        data: slots,
        skipDuplicates: true
      });
    }
  },

  async getAvailableInterviewerSlots(data: {
    roleTarget: string;
    level?: string;
    startAt: Date;
    endAt: Date;
  }) {
    return prisma.interviewerAvailability.findMany({
      where: {
        roleTarget: {
          equals: data.roleTarget,
          mode: 'insensitive'
        },
        ...(data.level
          ? {
              level: {
                equals: data.level,
                mode: 'insensitive'
              }
            }
          : {}),
        startsAt: {
          gte: data.startAt > new Date() ? data.startAt : new Date(),
          lt: data.endAt
        },
        isActive: true
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        bookedCount: true,
        roleTarget: true,
        level: true
      },
      orderBy: {
        startsAt: 'asc'
      }
    });
  },

  async bookAvailabilitySlot(data: {
    userId: string;
    title: string;
    roleTarget: string;
    level?: string;
    scheduledAt: Date;
    status: InterviewStatus;
  }) {
    return prisma.$transaction(async (tx) => {
      const roleTarget = data.roleTarget.replace(/\s+/g, ' ').trim();
      const level = (data.level ?? 'General').replace(/\s+/g, ' ').trim();
      const availability = await tx.interviewerAvailability.findFirst({
        where: {
          roleTarget: {
            equals: roleTarget,
            mode: 'insensitive'
          },
          level: {
            equals: level,
            mode: 'insensitive'
          },
          startsAt: data.scheduledAt,
          isActive: true
        },
        select: {
          id: true,
          capacity: true,
          bookedCount: true
        }
      });

      if (!availability || availability.bookedCount >= availability.capacity) {
        return null;
      }

      const updated = await tx.interviewerAvailability.updateMany({
        where: {
          id: availability.id,
          bookedCount: {
            lt: availability.capacity
          }
        },
        data: {
          bookedCount: {
            increment: 1
          }
        }
      });

      if (updated.count !== 1) {
        return null;
      }

      return tx.interviewSession.create({
        data: {
          userId: data.userId,
          availabilityId: availability.id,
          title: data.title,
          roleTarget,
          level,
          scheduledAt: data.scheduledAt,
          status: data.status,
          questions: []
        }
      });
    });
  },

  async cancelScheduledInterview(userId: string, sessionId: string) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.interviewSession.findFirst({
        where: {
          id: sessionId,
          userId,
          deletedAt: null
        },
        select: {
          id: true,
          availabilityId: true,
          status: true,
          scheduledAt: true
        }
      });

      if (!session) {
        return null;
      }

      if (
        session.status !== InterviewStatus.SCHEDULED ||
        !session.scheduledAt ||
        session.scheduledAt.getTime() <= Date.now()
      ) {
        return false;
      }

      await tx.interviewSession.update({
        where: { id: session.id },
        data: {
          status: InterviewStatus.CANCELLED,
          deletedAt: new Date()
        }
      });

      if (session.availabilityId) {
        await tx.interviewerAvailability.updateMany({
          where: {
            id: session.availabilityId,
            bookedCount: { gt: 0 }
          },
          data: {
            bookedCount: {
              decrement: 1
            }
          }
        });
      }

      return true;
    });
  },

  async hasScheduledInterviewAt(
    userId: string,
    scheduledAt: Date,
    filters: {
      roleTarget?: string;
      level?: string;
    } = {}
  ) {
    const where: Prisma.InterviewSessionWhereInput = {
      userId,
      deletedAt: null,
      scheduledAt,
      status: {
        in: [InterviewStatus.SCHEDULED, InterviewStatus.IN_PROGRESS]
      }
    };

    if (filters.roleTarget) {
      where.roleTarget = {
        equals: filters.roleTarget,
        mode: 'insensitive'
      };
    }

    if (filters.level) {
      where.level = {
        equals: filters.level,
        mode: 'insensitive'
      };
    }

    const count = await prisma.interviewSession.count({
      where
    });

    return count > 0;
  },

  async activateDueScheduledInterviews(userId: string, now: Date) {
    return prisma.interviewSession.updateMany({
      where: {
        userId,
        deletedAt: null,
        status: InterviewStatus.SCHEDULED,
        OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }]
      },
      data: {
        status: InterviewStatus.IN_PROGRESS,
        startedAt: now
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
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
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
        scheduledAt: true,
        startedAt: true,
        completedAt: true,
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
      status?: InterviewStatus;
      score?: number;
      startedAt?: Date;
      completedAt?: Date;
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

    if (data.startedAt !== undefined) {
      updateData.startedAt = data.startedAt;
    }

    if (data.completedAt !== undefined) {
      updateData.completedAt = data.completedAt;
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
