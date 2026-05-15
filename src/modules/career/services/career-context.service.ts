import { prisma } from '@config/prisma.js';
import { ProcessingStatus } from '@prisma/client';
import type { CareerContextResponse } from '../types/career-context.types.js';

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

const clampScore = (value?: number | null) =>
  Math.max(0, Math.min(100, Math.round(value ?? 0)));

const getResumeContext = async (userId: string) => {
  const resume = await prisma.resume.findFirst({
    where: {
      userId,
      deletedAt: null,
      status: ProcessingStatus.COMPLETED
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      aiFeedbacks: {
        where: { type: 'RESUME_ANALYSIS', status: ProcessingStatus.COMPLETED },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          score: true,
          strengths: true,
          weaknesses: true,
          suggestions: true,
          rawResponse: true
        }
      }
    }
  });

  const feedback = resume?.aiFeedbacks[0];
  const raw = (feedback?.rawResponse ?? {}) as Record<string, unknown>;

  return {
    latestResumeId: resume?.id,
    title: resume?.title,
    atsScore: clampScore(
      typeof raw.atsScore === 'number' ? raw.atsScore : feedback?.score
    ),
    inferredTargetRole: firstText(raw.inferredTargetRole),
    experienceLevel: firstText(raw.experienceLevel),
    missingSkills: asStringArray(raw.missingSkills),
    keywordGaps: asStringArray(raw.keywordGaps),
    strengths: asStringArray(raw.strengths ?? feedback?.strengths),
    improvementSuggestions: asStringArray(
      raw.recommendedNextActions ?? raw.improvementSuggestions ?? feedback?.suggestions
    )
  };
};

const getRoadmapContext = async (userId: string) => {
  const roadmap = await prisma.careerRoadmap.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      targetRole: true,
      currentLevel: true,
      progress: true,
      milestoneRecords: {
        orderBy: { sequence: 'asc' },
        select: {
          title: true,
          status: true,
          progress: true
        }
      },
      skillRecords: {
        orderBy: [{ status: 'asc' }, { name: 'asc' }],
        take: 6,
        select: {
          name: true,
          priority: true,
          status: true
        }
      }
    }
  });

  const activeMilestone =
    roadmap?.milestoneRecords.find((item) => item.status === 'IN_PROGRESS') ??
    roadmap?.milestoneRecords.find((item) => item.progress > 0 && item.progress < 100);
  const nextMilestone =
    roadmap?.milestoneRecords.find((item) => item.status === 'PENDING') ??
    roadmap?.milestoneRecords.find((item) => item.progress < 100);

  return {
    latestRoadmapId: roadmap?.id,
    targetRole: roadmap?.targetRole,
    currentLevel: roadmap?.currentLevel,
    progress: clampScore(roadmap?.progress),
    activeMilestone: activeMilestone?.title,
    nextMilestone: nextMilestone?.title,
    skillsToBuild: roadmap?.skillRecords.map((skill) => skill.name) ?? []
  };
};

const getInterviewContext = async (userId: string) => {
  const session = await prisma.interviewSession.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      status: true,
      score: true,
      scheduledAt: true,
      questions: true,
      aiFeedbacks: {
        where: { type: 'INTERVIEW_FEEDBACK' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          score: true,
          weaknesses: true,
          suggestions: true,
          rawResponse: true
        }
      }
    }
  });

  const feedback = session?.aiFeedbacks[0];
  const raw = (feedback?.rawResponse ?? {}) as Record<string, unknown>;
  const feedbackPayload = (raw.feedback ?? {}) as Record<string, unknown>;
  const questionFeedback = asQuestionFeedback(feedbackPayload.questionFeedback);
  const weakQuestions = questionFeedback
    .filter((item) => item !== null && item.score < 70)
    .slice(0, 3)
    .map((item) => item.prompt || item.questionId);

  return {
    latestSessionId: session?.id,
    latestScore: clampScore(feedback?.score ?? session?.score),
    scheduledAt: session?.scheduledAt ?? undefined,
    status: session?.status,
    weakestQuestions: weakQuestions,
    suggestedPracticeAreas: asStringArray(feedback?.suggestions ?? feedback?.weaknesses)
  };
};

const asQuestionFeedback = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      return {
        questionId: firstText(record.questionId) ?? 'question',
        prompt: firstText(record.prompt),
        score: typeof record.score === 'number' ? record.score : 0
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
};

const getChatbotContext = async (userId: string) => {
  const session = await prisma.chatbotSession.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { lastMessageAt: 'desc' },
    select: {
      id: true,
      lastMessageAt: true,
      context: true
    }
  });

  const context = (session?.context ?? {}) as Record<string, unknown>;
  const metadata = (context.sessionMetadata ?? {}) as Record<string, unknown>;

  return {
    latestSessionId: session?.id,
    lastMessageAt: session?.lastMessageAt ?? undefined,
    actionPlan: asStringArray(metadata.actionPlan)
  };
};

const getJobContext = async (userId: string) => {
  const [jobs, applications, goals] = await Promise.all([
    prisma.jobRecommendation.findMany({
      where: {
        userId,
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      orderBy: { matchScore: 'desc' },
      take: 3,
      select: { title: true, company: true, matchScore: true }
    }),
    prisma.jobApplication.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 3,
      select: {
        status: true,
        jobRecommendation: { select: { title: true, company: true } }
      }
    }),
    prisma.careerGoal.findMany({
      where: { userId, status: { not: 'ARCHIVED' } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 3,
      select: { title: true, status: true, progress: true, nextSteps: true }
    })
  ]);

  return {
    jobMatches: jobs.map((job) => ({
      title: job.title,
      company: job.company,
      matchScore: clampScore(job.matchScore)
    })),
    applications: applications.map((application) => ({
      title: application.jobRecommendation.title,
      company: application.jobRecommendation.company,
      status: application.status
    })),
    goals: goals.map((goal) => ({
      title: goal.title,
      status: goal.status,
      progress: clampScore(goal.progress),
      nextSteps: asStringArray(goal.nextSteps)
    }))
  };
};

const buildNextAction = (
  resume: Awaited<ReturnType<typeof getResumeContext>>,
  roadmap: Awaited<ReturnType<typeof getRoadmapContext>>,
  interview: Awaited<ReturnType<typeof getInterviewContext>>
) => {
  if (!resume.latestResumeId) {
    return {
      label: 'Analyze your resume',
      href: '/dashboard/user/resume',
      reason: 'Resume analysis unlocks personalized roadmap and interview guidance.'
    };
  }

  if (!roadmap.latestRoadmapId) {
    return {
      label: 'Generate your roadmap',
      href: '/dashboard/user/roadmap',
      reason: 'Use your resume gaps to build a focused career path.'
    };
  }

  if ((roadmap.progress ?? 0) < 100 && roadmap.nextMilestone) {
    return {
      label: `Continue milestone: ${roadmap.nextMilestone}`,
      href: '/dashboard/user/roadmap',
      reason: 'Your next milestone is the strongest step toward interview readiness.'
    };
  }

  if (!interview.latestSessionId || (interview.latestScore ?? 0) < 75) {
    return {
      label: 'Practice a role-specific interview',
      href: '/dashboard/user/interview',
      reason: 'Interview practice turns your roadmap skills into confident answers.'
    };
  }

  return {
    label: 'Ask the career mentor for your weekly plan',
    href: '/dashboard/user/chat',
    reason: 'Your mentor can turn your progress into a concrete action plan.'
  };
};

export const careerContextService = {
  async getCareerContext(userId: string): Promise<CareerContextResponse> {
    const [resume, roadmap, interview, chatbot, jobs] = await Promise.all([
      getResumeContext(userId),
      getRoadmapContext(userId),
      getInterviewContext(userId),
      getChatbotContext(userId),
      getJobContext(userId)
    ]);

    const readiness = {
      resume: clampScore(resume.atsScore),
      roadmap: clampScore(roadmap.progress),
      interview: clampScore(interview.latestScore),
      overall: clampScore(
        (clampScore(resume.atsScore) +
          clampScore(roadmap.progress) +
          clampScore(interview.latestScore)) /
          3
      )
    };

    return {
      resume,
      roadmap,
      interview,
      chatbot,
      jobs,
      readiness,
      nextAction: buildNextAction(resume, roadmap, interview)
    };
  }
};
