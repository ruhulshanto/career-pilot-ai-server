import { prisma } from '@config/prisma.js';
import { JobApplicationStatus, ProcessingStatus } from '@prisma/client';

export const analyticsRepository = {
  /**
   * Get total counts for dashboard summary
   */
  async getCounts(userId: string) {
    const [
      resumes,
      resumesAnalyzed,
      roadmaps,
      interviews,
      completedInterviews,
      chatbots,
      activeApplications,
      totalApplications,
      aiUsageCount,
      activeGoals
    ] = await Promise.all([
      prisma.resume.count({ where: { userId, deletedAt: null } }),
      prisma.aiFeedback.count({
        where: {
          userId,
          type: 'RESUME_ANALYSIS',
          status: ProcessingStatus.COMPLETED,
          resume: { deletedAt: null }
        }
      }),
      prisma.careerRoadmap.count({ where: { userId, deletedAt: null } }),
      prisma.interviewSession.count({ where: { userId, deletedAt: null } }),
      prisma.interviewSession.count({
        where: {
          userId,
          deletedAt: null,
          status: 'COMPLETED'
        }
      }),
      prisma.chatbotSession.count({ where: { userId, deletedAt: null } }),
      prisma.jobApplication.count({
        where: {
          userId,
          status: {
            in: [
              JobApplicationStatus.SAVED,
              JobApplicationStatus.APPLIED,
              JobApplicationStatus.INTERVIEW_SCHEDULED,
              JobApplicationStatus.OFFER
            ]
          }
        }
      }),
      prisma.jobApplication.count({ where: { userId } }),
      prisma.aiFeedback.count({ where: { userId } }),
      prisma.careerGoal.count({ where: { userId, status: { not: 'ARCHIVED' } } })
    ]);

    return {
      totalResumes: resumes,
      resumesAnalyzed,
      totalInterviews: interviews,
      completedInterviews,
      totalRoadmaps: roadmaps,
      totalChatbotSessions: chatbots,
      activeApplications,
      totalApplications,
      aiUsageCount,
      activeGoals
    };
  },

  /**
   * Get average interview scores
   */
  async getAverageInterviewScore(userId: string) {
    const aggregate = await prisma.interviewSession.aggregate({
      where: { userId, deletedAt: null, status: 'COMPLETED', score: { not: null } },
      _avg: { score: true }
    });
    return aggregate._avg.score || 0;
  },

  async getAverageResumeScore(userId: string) {
    const aggregate = await prisma.aiFeedback.aggregate({
      where: {
        userId,
        type: 'RESUME_ANALYSIS',
        status: ProcessingStatus.COMPLETED,
        score: { not: null },
        resume: { deletedAt: null }
      },
      _avg: { score: true }
    });
    return aggregate._avg.score || 0;
  },

  async getRoadmapCompletion(userId: string) {
    const [roadmapAggregate, milestoneCounts] = await Promise.all([
      prisma.careerRoadmap.aggregate({
        where: { userId, deletedAt: null },
        _avg: { progress: true }
      }),
      prisma.roadmapMilestone.groupBy({
        by: ['status'],
        where: {
          roadmap: { userId, deletedAt: null }
        },
        _count: { _all: true }
      })
    ]);

    const totalMilestones = milestoneCounts.reduce(
      (sum, item) => sum + item._count._all,
      0
    );
    const completedMilestones =
      milestoneCounts.find((item) => item.status === 'COMPLETED')?._count._all ?? 0;

    if (totalMilestones > 0) {
      return Math.round((completedMilestones / totalMilestones) * 100);
    }

    return Math.round(roadmapAggregate._avg.progress ?? 0);
  },

  /**
   * Get AI usage metrics
   */
  async getAiUsageMetrics(userId: string) {
    const feedbacks = await prisma.aiFeedback.findMany({
      where: { userId },
      select: {
        provider: true,
        type: true,
        promptTokens: true,
        completionTokens: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return feedbacks;
  },

  /**
   * Get interview performance trends (last 7 completed interviews)
   */
  async getInterviewTrends(userId: string) {
    const interviews = await prisma.interviewSession.findMany({
      where: { userId, deletedAt: null, status: 'COMPLETED', score: { not: null } },
      orderBy: { completedAt: 'desc' },
      take: 10,
      select: { createdAt: true, completedAt: true, score: true }
    });

    return interviews.reverse().map((i) => ({
      date: (i.completedAt ?? i.createdAt).toISOString().split('T')[0],
      score: i.score || 0
    }));
  },

  async getCompletedInterviewScores(userId: string) {
    return prisma.interviewSession.findMany({
      where: { userId, deletedAt: null, status: 'COMPLETED', score: { not: null } },
      orderBy: { completedAt: 'asc' },
      select: { score: true, completedAt: true, createdAt: true }
    });
  },

  async getInterviewSkillSignals(userId: string) {
    return prisma.aiFeedback.findMany({
      where: {
        userId,
        type: 'INTERVIEW_FEEDBACK',
        status: ProcessingStatus.COMPLETED
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        strengths: true,
        weaknesses: true,
        suggestions: true,
        rawResponse: true
      }
    });
  },

  /**
   * Get resume status distribution
   */
  async getResumeStatusDistribution(userId: string) {
    const statuses = await prisma.resume.groupBy({
      by: ['status'],
      where: { userId, deletedAt: null },
      _count: { _all: true }
    });

    const distribution: Record<string, number> = {};
    statuses.forEach((s) => {
      distribution[s.status] = s._count._all;
    });

    return distribution;
  },

  async getResumeSubmissions(userId: string) {
    return prisma.resume.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    });
  },

  async getResumeScoreHistory(userId: string) {
    return prisma.aiFeedback.findMany({
      where: {
        userId,
        type: 'RESUME_ANALYSIS',
        status: ProcessingStatus.COMPLETED,
        score: { not: null },
        resume: { deletedAt: null }
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true, score: true }
    });
  },

  /**
   * Get recent activity log
   */
  async getRecentActivity(userId: string, limit = 10) {
    return prisma.analyticsEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
};
