import { prisma } from '@config/prisma.js';
import type { OnboardingStepId } from '../types/onboarding.types.js';

export const onboardingRepository = {
  findProgress(userId: string) {
    return prisma.onboardingProgress.findUnique({
      where: { userId }
    });
  },

  upsertProgress(userId: string, data: {
    completedSteps?: OnboardingStepId[];
    currentStep?: OnboardingStepId | null;
    completedAt?: Date | null;
    skippedAt?: Date | null;
  }) {
    return prisma.onboardingProgress.upsert({
      where: { userId },
      create: {
        userId,
        completedSteps: data.completedSteps ?? [],
        currentStep: data.currentStep,
        completedAt: data.completedAt,
        skippedAt: data.skippedAt
      },
      update: {
        completedSteps: data.completedSteps,
        currentStep: data.currentStep,
        completedAt: data.completedAt,
        skippedAt: data.skippedAt
      }
    });
  },

  async getCareerSignals(userId: string) {
    const [
      resumeCount,
      roadmapCount,
      completedInterviewCount,
      careerGoalCount,
      jobRecommendationCount
    ] = await Promise.all([
      prisma.resume.count({
        where: { userId, deletedAt: null }
      }),
      prisma.careerRoadmap.count({
        where: { userId, deletedAt: null, status: 'COMPLETED' }
      }),
      prisma.interviewSession.count({
        where: { userId, deletedAt: null, status: 'COMPLETED' }
      }),
      prisma.careerGoal.count({
        where: { userId, status: { not: 'ARCHIVED' } }
      }),
      prisma.jobRecommendation.count({
        where: {
          userId,
          deletedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        }
      })
    ]);

    return {
      hasResume: resumeCount > 0,
      hasRoadmap: roadmapCount > 0,
      hasInterviewPractice: completedInterviewCount > 0,
      hasCareerGoal: careerGoalCount > 0,
      hasJobMatches: jobRecommendationCount > 0
    };
  }
};
