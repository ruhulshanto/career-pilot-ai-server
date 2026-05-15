import { prisma } from '@config/prisma.js';
import type {
  CareerGoalStatus,
  JobApplicationStatus,
  Prisma
} from '@prisma/client';

export const jobsRepository = {
  getLatestCareerSignals(userId: string) {
    return prisma.careerRoadmap.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        targetRole: true,
        currentLevel: true,
        skills: true,
        skillRecords: {
          select: { name: true, priority: true, status: true },
          take: 12
        }
      }
    });
  },

  getLatestResumeSignals(userId: string) {
    return prisma.aiFeedback.findFirst({
      where: {
        userId,
        type: 'RESUME_ANALYSIS',
        status: 'COMPLETED',
        resume: { deletedAt: null }
      },
      orderBy: { createdAt: 'desc' },
      select: {
        score: true,
        strengths: true,
        weaknesses: true,
        suggestions: true,
        rawResponse: true
      }
    });
  },

  getInterviewScoreSignal(userId: string) {
    return prisma.interviewSession.aggregate({
      where: {
        userId,
        deletedAt: null,
        status: 'COMPLETED',
        score: { not: null }
      },
      _avg: { score: true },
      _count: { _all: true }
    });
  },

  async upsertRecommendations(userId: string, jobs: Array<{
    source: string;
    externalId: string;
    title: string;
    company: string;
    location?: string;
    jobUrl?: string;
    matchScore: number;
    skillsMatch: Prisma.InputJsonValue;
    metadata: Prisma.InputJsonValue;
  }>) {
    const sources = Array.from(new Set(jobs.map((job) => job.source)));
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const now = new Date();

    await prisma.$transaction([
      ...(sources.length > 0
        ? [
            prisma.jobRecommendation.updateMany({
              where: {
                userId,
                source: { in: sources },
                deletedAt: null
              },
              data: { deletedAt: now }
            })
          ]
        : []),
      ...jobs.map((job) =>
        prisma.jobRecommendation.upsert({
          where: {
            source_externalId: {
              source: job.source,
              externalId: job.externalId
            }
          },
          create: {
            userId,
            ...job,
            expiresAt
          },
          update: {
            title: job.title,
            company: job.company,
            location: job.location,
            jobUrl: job.jobUrl,
            matchScore: job.matchScore,
            skillsMatch: job.skillsMatch,
            metadata: job.metadata,
            deletedAt: null,
            expiresAt
          }
        })
      )
    ]);
  },

  getRecommendations(userId: string) {
    return prisma.jobRecommendation.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      orderBy: [{ matchScore: 'desc' }, { updatedAt: 'desc' }],
      take: 8,
      include: {
        applications: {
          where: { userId },
          take: 1
        }
      }
    });
  },

  getRecommendationById(userId: string, id: string) {
    return prisma.jobRecommendation.findFirst({
      where: {
        id,
        userId,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      select: { id: true }
    });
  },

  saveJobLead(userId: string, jobRecommendationId: string) {
    return prisma.jobApplication.upsert({
      where: { userId_jobRecommendationId: { userId, jobRecommendationId } },
      create: {
        userId,
        jobRecommendationId,
        status: 'SAVED'
      },
      update: {
        status: 'SAVED'
      }
    });
  },

  createTrackedApplication(
    userId: string,
    data: {
      externalId: string;
      title: string;
      company: string;
      location?: string;
      source: string;
      sourceLabel: string;
      jobUrl?: string;
      status: JobApplicationStatus;
      notes?: string;
      appliedAt?: Date;
      interviewAt?: Date;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const job = await tx.jobRecommendation.create({
        data: {
          userId,
          source: data.source,
          externalId: data.externalId,
          title: data.title,
          company: data.company,
          location: data.location,
          jobUrl: data.jobUrl,
          matchScore: 0,
          skillsMatch: [],
          metadata: {
            sourceLabel: data.sourceLabel,
            isManualTrack: true,
            missingSkills: [],
            matchReasons: ['Manually tracked by the user.'],
            recommendedImprovements: []
          }
        }
      });

      return tx.jobApplication.create({
        data: {
          userId,
          jobRecommendationId: job.id,
          status: data.status,
          notes: data.notes,
          appliedAt: data.appliedAt,
          interviewAt: data.interviewAt
        },
        include: { jobRecommendation: true }
      });
    });
  },

  getApplications(userId: string) {
    return prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { jobRecommendation: true },
      take: 20
    });
  },

  getApplicationById(userId: string, id: string) {
    return prisma.jobApplication.findFirst({
      where: { id, userId },
      select: { id: true, status: true, appliedAt: true }
    });
  },

  updateApplication(
    userId: string,
    id: string,
    data: { status: JobApplicationStatus; notes?: string; interviewAt?: Date }
  ) {
    return prisma.jobApplication.update({
      where: { id, userId },
      data,
      include: { jobRecommendation: true }
    });
  },

  createGoal(userId: string, data: {
    title: string;
    description?: string;
    targetRole?: string;
    targetDate?: Date;
    nextSteps?: string[];
  }) {
    return prisma.careerGoal.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        targetRole: data.targetRole,
        targetDate: data.targetDate,
        nextSteps: data.nextSteps ?? []
      }
    });
  },

  getGoals(userId: string) {
    return prisma.careerGoal.findMany({
      where: { userId, status: { not: 'ARCHIVED' } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 10
    });
  },

  getGoalById(userId: string, id: string) {
    return prisma.careerGoal.findFirst({
      where: { id, userId },
      select: { id: true }
    });
  },

  updateGoal(
    userId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      targetRole?: string;
      targetDate?: Date;
      nextSteps?: string[];
      status?: CareerGoalStatus;
      progress?: number;
    }
  ) {
    return prisma.careerGoal.update({
      where: { id, userId },
      data: {
        ...data,
        completedAt: data.status === 'COMPLETED' ? new Date() : undefined
      }
    });
  }
};
