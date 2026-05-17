import { prisma } from '@config/prisma.js';
import { ProcessingStatus } from '@prisma/client';

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const adminRepository = {
  async getPlatformCounts() {
    const [
      totalUsers,
      activeUsers,
      resumesAnalyzed,
      roadmapsGenerated,
      interviewsCompleted,
      chatbotMessages,
      jobApplications,
      notificationsSent
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({
        where: {
          deletedAt: null,
          OR: [
            { lastLoginAt: { gte: daysAgo(30) } },
            { updatedAt: { gte: daysAgo(30) } }
          ]
        }
      }),
      prisma.resume.count({
        where: { deletedAt: null, status: ProcessingStatus.COMPLETED }
      }),
      prisma.careerRoadmap.count({
        where: { deletedAt: null, status: ProcessingStatus.COMPLETED }
      }),
      prisma.interviewSession.count({
        where: { deletedAt: null, status: 'COMPLETED' }
      }),
      prisma.chatbotMessage.count(),
      prisma.jobApplication.count(),
      prisma.notification.count({ where: { deletedAt: null } })
    ]);

    return {
      totalUsers,
      activeUsers,
      resumesAnalyzed,
      roadmapsGenerated,
      interviewsCompleted,
      chatbotMessages,
      jobApplications,
      notificationsSent
    };
  },

  async getAiUsage() {
    const [aggregate, failedRequests, providerGroups, typeGroups] =
      await Promise.all([
        prisma.aiFeedback.aggregate({
          _count: { _all: true },
          _sum: { promptTokens: true, completionTokens: true }
        }),
        prisma.aiFeedback.count({ where: { status: ProcessingStatus.FAILED } }),
        prisma.aiFeedback.groupBy({
          by: ['provider'],
          _count: { _all: true }
        }),
        prisma.aiFeedback.groupBy({
          by: ['type'],
          _count: { _all: true },
          _sum: { promptTokens: true, completionTokens: true }
        })
      ]);

    return {
      totalRequests: aggregate._count._all,
      failedRequests,
      retryCountEstimate: failedRequests,
      averageResponseTimeMs: 0,
      totalTokens:
        (aggregate._sum.promptTokens ?? 0) +
        (aggregate._sum.completionTokens ?? 0),
      providerUsage: providerGroups.map((group) => ({
        provider: group.provider,
        count: group._count._all
      })),
      usageByType: typeGroups.map((group) => ({
        type: group.type,
        count: group._count._all,
        tokens:
          (group._sum.promptTokens ?? 0) +
          (group._sum.completionTokens ?? 0)
      }))
    };
  },

  async getTrendSeries(days = 14) {
    const since = daysAgo(days - 1);
    const [users, roadmaps, interviews, aiRequests] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: since }, deletedAt: null },
        select: { createdAt: true }
      }),
      prisma.careerRoadmap.findMany({
        where: { createdAt: { gte: since }, deletedAt: null },
        select: { createdAt: true }
      }),
      prisma.interviewSession.findMany({
        where: { createdAt: { gte: since }, deletedAt: null },
        select: { createdAt: true }
      }),
      prisma.aiFeedback.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true }
      })
    ]);

    const buckets = Array.from({ length: days }, (_, index) => {
      const date = daysAgo(days - 1 - index);
      const key = date.toISOString().slice(0, 10);
      return {
        date: key,
        users: 0,
        roadmaps: 0,
        interviews: 0,
        aiRequests: 0
      };
    });
    const bucketMap = new Map(buckets.map((bucket) => [bucket.date, bucket]));

    const addToBucket = (
      records: Array<{ createdAt: Date }>,
      key: 'users' | 'roadmaps' | 'interviews' | 'aiRequests'
    ) => {
      for (const record of records) {
        const bucket = bucketMap.get(record.createdAt.toISOString().slice(0, 10));
        if (bucket) bucket[key] += 1;
      }
    };

    addToBucket(users, 'users');
    addToBucket(roadmaps, 'roadmaps');
    addToBucket(interviews, 'interviews');
    addToBucket(aiRequests, 'aiRequests');

    return buckets;
  },

  async getNewestUsers() {
    return prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true
      }
    });
  },

  async getUsers(params: {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    status?: string; // 'active', 'unverified', 'suspended', 'deleted'
  }) {
    const { page, limit, search, role, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      switch (status) {
        case 'active':
          where.deletedAt = null;
          where.isActive = true;
          break;
        case 'suspended':
          where.deletedAt = null;
          where.isActive = false;
          break;
        case 'deleted':
          where.deletedAt = { not: null };
          break;
        case 'unverified':
          where.emailVerifiedAt = null;
          where.deletedAt = null;
          break;
        default:
          where.deletedAt = null;
          break;
      }
    } else {
      where.deletedAt = null;
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          role: true,
          emailVerifiedAt: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          deletedAt: true
        }
      })
    ]);

    return { total, users, page, limit };
  },

  async getUserDetail(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        headline: true,
        bio: true,
        location: true,
        currentCompany: true,
        currentPosition: true,
        emailVerifiedAt: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        deletedAt: true,
        _count: {
          select: {
            resumes: { where: { deletedAt: null } },
            careerRoadmaps: { where: { deletedAt: null } },
            interviewSessions: { where: { deletedAt: null } },
            chatbotSessions: { where: { deletedAt: null } }
          }
        }
      }
    });

    if (!user) return null;

    const aiUsage = await prisma.aiFeedback.aggregate({
      where: { userId: id },
      _count: { _all: true },
      _sum: { promptTokens: true, completionTokens: true }
    });

    return {
      ...user,
      aiUsage: {
        totalRequests: aiUsage._count._all,
        totalTokens: (aiUsage._sum.promptTokens ?? 0) + (aiUsage._sum.completionTokens ?? 0)
      }
    };
  },

  async getUserActivityLogs(userId: string) {
    const [events, sessions] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          eventType: true,
          eventName: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true
        }
      }),
      prisma.accountSession.findMany({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
        take: 10,
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          lastSeenAt: true,
          createdAt: true,
          revokedAt: true
        }
      })
    ]);

    return { events, sessions };
  },

  async updateUserStatus(userId: string, isActive: boolean, adminId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, email: true, isActive: true }
    });

    // Log the admin action
    await prisma.analyticsEvent.create({
      data: {
        userId: adminId,
        eventType: 'ADMIN',
        eventName: isActive ? 'USER_RESTORED' : 'USER_SUSPENDED',
        entityType: 'USER',
        entityId: userId,
        metadata: { targetEmail: user.email }
      }
    });

    return user;
  },

  async getRecentFailures() {
    return prisma.aiFeedback.findMany({
      where: { status: ProcessingStatus.FAILED },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        type: true,
        provider: true,
        errorMessage: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            username: true
          }
        }
      }
    });
  },

  async getRecentAiJobs() {
    return prisma.aiFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        type: true,
        provider: true,
        status: true,
        score: true,
        promptTokens: true,
        completionTokens: true,
        createdAt: true
      }
    });
  },

  async getRecentNotifications() {
    return prisma.notification.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        type: true,
        status: true,
        title: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            username: true
          }
        }
      }
    });
  },

  async pingDatabase() {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  }
};
