import { prisma } from '@config/prisma.js';
import {
  CareerGoalStatus,
  InterviewStatus,
  NotificationStatus,
  ProcessingStatus
} from '@prisma/client';

export const dashboardRepository = {
  async getSummaryData(userId: string) {
    const now = new Date();
    const currentWindowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const previousWindowStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      latestResumeFeedback,
      latestResumeFeedbackDetail,
      interviewAggregate,
      completedInterviewCount,
      upcomingInterview,
      latestRoadmap,
      activeJobRecommendationCount,
      recommendedJobs,
      applications,
      careerGoals,
      unreadNotificationCount,
      recentAnalyticsEvents,
      recentResumes,
      recentInterviews,
      recentRoadmaps,
      recentAiFeedbacks,
      activeResumes,
      activeRoadmaps,
      activeAiFeedbacks,
      totalResumes,
      resumesAnalyzed,
      applicationsTracked,
      aiUsageCount,
      activeCareerGoalCount,
      roadmapMilestoneCounts,
      resumeScoreHistory,
      currentResumeAnalyses,
      previousResumeAnalyses,
      currentApplications,
      previousApplications,
      currentInterviews,
      previousInterviews,
      currentAiUsage,
      previousAiUsage
    ] = await Promise.all([
      prisma.aiFeedback.findFirst({
        where: {
          userId,
          type: 'RESUME_ANALYSIS',
          status: ProcessingStatus.COMPLETED,
          score: { not: null },
          resume: {
            deletedAt: null
          }
        },
        orderBy: { createdAt: 'desc' },
        select: { score: true }
      }),
      prisma.aiFeedback.findFirst({
        where: {
          userId,
          type: 'RESUME_ANALYSIS',
          status: ProcessingStatus.COMPLETED,
          resume: {
            deletedAt: null
          }
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          score: true,
          summary: true,
          weaknesses: true,
          suggestions: true,
          rawResponse: true,
          resumeId: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.interviewSession.aggregate({
        where: {
          userId,
          deletedAt: null,
          status: InterviewStatus.COMPLETED,
          score: { not: null }
        },
        _avg: { score: true }
      }),
      prisma.interviewSession.count({
        where: {
          userId,
          deletedAt: null,
          status: InterviewStatus.COMPLETED,
          score: { not: null }
        }
      }),
      prisma.interviewSession.findFirst({
        where: {
          userId,
          deletedAt: null,
          status: InterviewStatus.SCHEDULED,
          scheduledAt: { gt: now }
        },
        orderBy: { scheduledAt: 'asc' },
        select: {
          id: true,
          title: true,
          roleTarget: true,
          scheduledAt: true
        }
      }),
      prisma.careerRoadmap.findFirst({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          targetRole: true,
          milestones: true,
          skills: true,
          status: true,
          updatedAt: true,
          milestoneRecords: {
            where: { status: { not: 'COMPLETED' } },
            orderBy: [{ dueDate: 'asc' }, { sequence: 'asc' }],
            take: 3,
            select: {
              id: true,
              title: true,
              dueDate: true,
              status: true,
              progress: true
            }
          }
        }
      }),
      prisma.jobRecommendation.count({
        where: {
          userId,
          deletedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        }
      }),
      prisma.jobRecommendation.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        orderBy: [{ matchScore: 'desc' }, { updatedAt: 'desc' }],
        take: 4,
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          jobUrl: true,
          source: true,
          skillsMatch: true,
          metadata: true,
          matchScore: true,
          applications: {
            where: { userId },
            select: { status: true },
            take: 1
          }
        }
      }),
      prisma.jobApplication.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          jobRecommendationId: true,
          status: true,
          notes: true,
          appliedAt: true,
          interviewAt: true,
          updatedAt: true,
          jobRecommendation: {
            select: {
              title: true,
              company: true,
              location: true,
              jobUrl: true,
              source: true,
              matchScore: true,
              skillsMatch: true,
              metadata: true
            }
          }
        }
      }),
      prisma.careerGoal.findMany({
        where: { userId, status: { not: 'ARCHIVED' } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          progress: true,
          nextSteps: true
        }
      }),
      prisma.notification.count({
        where: {
          userId,
          deletedAt: null,
          status: NotificationStatus.UNREAD
        }
      }),
      prisma.analyticsEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          eventType: true,
          eventName: true,
          entityType: true,
          entityId: true,
          metadata: true,
          createdAt: true
        }
      }),
      prisma.resume.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.interviewSession.findMany({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          roleTarget: true,
          status: true,
          score: true,
          createdAt: true,
          updatedAt: true,
          completedAt: true
        }
      }),
      prisma.careerRoadmap.findMany({
        where: { userId, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          targetRole: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.aiFeedback.findMany({
        where: {
          userId,
          OR: [
            { resumeId: null },
            {
              resume: {
                deletedAt: null
              }
            }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          status: true,
          score: true,
          summary: true,
          weaknesses: true,
          suggestions: true,
          resumeId: true,
          interviewSessionId: true,
          careerRoadmapId: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.resume.findMany({
        where: {
          userId,
          deletedAt: null,
          status: { in: [ProcessingStatus.PENDING, ProcessingStatus.PROCESSING] }
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.careerRoadmap.findMany({
        where: {
          userId,
          deletedAt: null,
          status: { in: [ProcessingStatus.PENDING, ProcessingStatus.PROCESSING] }
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          targetRole: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.aiFeedback.findMany({
        where: {
          userId,
          status: { in: [ProcessingStatus.PENDING, ProcessingStatus.PROCESSING] },
          OR: [
            { resumeId: null },
            {
              resume: {
                deletedAt: null
              }
            }
          ]
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          status: true,
          resumeId: true,
          interviewSessionId: true,
          careerRoadmapId: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.resume.count({ where: { userId, deletedAt: null } }),
      prisma.aiFeedback.count({
        where: {
          userId,
          type: 'RESUME_ANALYSIS',
          status: ProcessingStatus.COMPLETED,
          resume: { deletedAt: null }
        }
      }),
      prisma.jobApplication.count({ where: { userId } }),
      prisma.aiFeedback.count({ where: { userId } }),
      prisma.careerGoal.count({
        where: { userId, status: { notIn: [CareerGoalStatus.ARCHIVED] } }
      }),
      prisma.roadmapMilestone.groupBy({
        by: ['status'],
        where: { roadmap: { userId, deletedAt: null } },
        _count: { _all: true }
      }),
      prisma.aiFeedback.findMany({
        where: {
          userId,
          type: 'RESUME_ANALYSIS',
          status: ProcessingStatus.COMPLETED,
          score: { not: null },
          resume: { deletedAt: null }
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { score: true, createdAt: true }
      }),
      prisma.aiFeedback.count({
        where: {
          userId,
          type: 'RESUME_ANALYSIS',
          status: ProcessingStatus.COMPLETED,
          createdAt: { gte: currentWindowStart, lte: now },
          resume: { deletedAt: null }
        }
      }),
      prisma.aiFeedback.count({
        where: {
          userId,
          type: 'RESUME_ANALYSIS',
          status: ProcessingStatus.COMPLETED,
          createdAt: { gte: previousWindowStart, lt: currentWindowStart },
          resume: { deletedAt: null }
        }
      }),
      prisma.jobApplication.count({
        where: { userId, createdAt: { gte: currentWindowStart, lte: now } }
      }),
      prisma.jobApplication.count({
        where: { userId, createdAt: { gte: previousWindowStart, lt: currentWindowStart } }
      }),
      prisma.interviewSession.count({
        where: {
          userId,
          deletedAt: null,
          status: InterviewStatus.COMPLETED,
          completedAt: { gte: currentWindowStart, lte: now }
        }
      }),
      prisma.interviewSession.count({
        where: {
          userId,
          deletedAt: null,
          status: InterviewStatus.COMPLETED,
          completedAt: { gte: previousWindowStart, lt: currentWindowStart }
        }
      }),
      prisma.aiFeedback.count({
        where: { userId, createdAt: { gte: currentWindowStart, lte: now } }
      }),
      prisma.aiFeedback.count({
        where: { userId, createdAt: { gte: previousWindowStart, lt: currentWindowStart } }
      })
    ]);

    const totalRoadmapMilestones = roadmapMilestoneCounts.reduce(
      (sum, item) => sum + item._count._all,
      0
    );
    const completedRoadmapMilestones =
      roadmapMilestoneCounts.find((item) => item.status === 'COMPLETED')?._count._all ??
      0;

    return {
      latestResumeFeedbackScore: latestResumeFeedback?.score ?? null,
      latestResumeFeedback: latestResumeFeedbackDetail,
      interviewAverage: interviewAggregate._avg.score ?? null,
      completedInterviewCount,
      upcomingInterview,
      latestRoadmap,
      activeJobRecommendationCount,
      recommendedJobs,
      applications,
      careerGoals,
      unreadNotificationCount,
      recentAnalyticsEvents,
      recentResumes,
      recentInterviews,
      recentRoadmaps,
      recentAiFeedbacks,
      totalResumes,
      resumesAnalyzed,
      applicationsTracked,
      aiUsageCount,
      activeCareerGoalCount,
      completedRoadmapMilestones,
      totalRoadmapMilestones,
      resumeScoreHistory: resumeScoreHistory.reverse(),
      weeklyTrendCounts: {
        currentResumeAnalyses,
        previousResumeAnalyses,
        currentApplications,
        previousApplications,
        currentInterviews,
        previousInterviews,
        currentAiUsage,
        previousAiUsage
      },
      activeProcessingRecords: {
        resumes: activeResumes,
        roadmaps: activeRoadmaps,
        aiFeedbacks: activeAiFeedbacks
      }
    };
  }
};
