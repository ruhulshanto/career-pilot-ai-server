import { dashboardCacheService } from '@modules/dashboard/services/dashboard-cache.service.js';
import { ApiError } from '@shared/errors/api-error.js';
import { onboardingRepository } from '../repositories/onboarding.repository.js';
import {
  onboardingStepIds,
  type OnboardingProgressResponse,
  type OnboardingStep,
  type OnboardingStepId
} from '../types/onboarding.types.js';

const stepDefinitions: Omit<OnboardingStep, 'completed'>[] = [
  {
    id: 'UPLOAD_RESUME',
    title: 'Upload resume',
    description: 'Start with your resume so CareerAI can understand your strengths and gaps.',
    actionLabel: 'Upload resume',
    actionLink: '/dashboard/user/resume'
  },
  {
    id: 'GENERATE_ROADMAP',
    title: 'Generate roadmap',
    description: 'Turn resume insights into a practical path toward your target role.',
    actionLabel: 'Open roadmap',
    actionLink: '/dashboard/user/roadmap'
  },
  {
    id: 'TAKE_INTERVIEW',
    title: 'Take interview practice',
    description: 'Practice role-specific questions and capture feedback for readiness.',
    actionLabel: 'Practice interview',
    actionLink: '/dashboard/user/interview'
  },
  {
    id: 'VIEW_JOB_MATCHES',
    title: 'View job matches',
    description: 'Review aligned roles generated from your resume, roadmap, and goals.',
    actionLabel: 'View matches',
    actionLink: '/dashboard/user/jobs'
  },
  {
    id: 'CREATE_CAREER_GOAL',
    title: 'Create career goal',
    description: 'Set one concrete goal, then polish your public profile so your progress is shareable.',
    actionLabel: 'Create goal',
    actionLink: '/dashboard/user/jobs#career-goals'
  }
];

const isStepId = (value: string): value is OnboardingStepId =>
  (onboardingStepIds as readonly string[]).includes(value);

const normalizeCompletedSteps = (value: unknown): OnboardingStepId[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is OnboardingStepId =>
    typeof item === 'string' && isStepId(item)
  );
};

const getDerivedSteps = async (userId: string): Promise<OnboardingStepId[]> => {
  const signals = await onboardingRepository.getCareerSignals(userId);
  return [
    signals.hasResume ? 'UPLOAD_RESUME' : null,
    signals.hasRoadmap ? 'GENERATE_ROADMAP' : null,
    signals.hasInterviewPractice ? 'TAKE_INTERVIEW' : null,
    signals.hasJobMatches ? 'VIEW_JOB_MATCHES' : null,
    signals.hasCareerGoal ? 'CREATE_CAREER_GOAL' : null
  ].filter((step): step is OnboardingStepId => step !== null);
};

const mergeSteps = (...groups: OnboardingStepId[][]) =>
  onboardingStepIds.filter((step) => groups.some((group) => group.includes(step)));

const buildResponse = (data: {
  completedSteps: OnboardingStepId[];
  skippedAt?: Date | null;
  completedAt?: Date | null;
}): OnboardingProgressResponse => {
  const steps = stepDefinitions.map((step) => ({
    ...step,
    completed: data.completedSteps.includes(step.id)
  }));
  const nextAction = steps.find((step) => !step.completed);
  const isComplete = data.completedSteps.length === onboardingStepIds.length;

  return {
    isComplete,
    isSkipped: Boolean(data.skippedAt),
    currentStep: nextAction?.id,
    completedSteps: data.completedSteps,
    nextAction,
    steps,
    progressPercent: Math.round((data.completedSteps.length / onboardingStepIds.length) * 100),
    completedAt: (data.completedAt ?? undefined)?.toISOString(),
    skippedAt: (data.skippedAt ?? undefined)?.toISOString()
  };
};

export const onboardingService = {
  async getProgress(userId: string) {
    const [existing, derivedSteps] = await Promise.all([
      onboardingRepository.findProgress(userId),
      getDerivedSteps(userId)
    ]);
    const completedSteps = mergeSteps(
      normalizeCompletedSteps(existing?.completedSteps),
      derivedSteps
    );
    const isComplete = completedSteps.length === onboardingStepIds.length;
    const currentStep =
      onboardingStepIds.find((step) => !completedSteps.includes(step)) ?? null;
    const completedAt = existing?.completedAt ?? (isComplete ? new Date() : null);

    await onboardingRepository.upsertProgress(userId, {
      completedSteps,
      currentStep,
      completedAt,
      skippedAt: existing?.skippedAt ?? null
    });

    return buildResponse({
      completedSteps,
      skippedAt: existing?.skippedAt,
      completedAt
    });
  },

  async completeStep(userId: string, step: string) {
    if (!isStepId(step)) {
      throw new ApiError(400, 'Invalid onboarding step');
    }

    const existing = await onboardingRepository.findProgress(userId);
    const derivedSteps = await getDerivedSteps(userId);
    const completedSteps = mergeSteps(
      normalizeCompletedSteps(existing?.completedSteps),
      derivedSteps,
      [step]
    );
    const isComplete = completedSteps.length === onboardingStepIds.length;
    const currentStep =
      onboardingStepIds.find((item) => !completedSteps.includes(item)) ?? null;
    const completedAt = isComplete ? (existing?.completedAt ?? new Date()) : null;

    await onboardingRepository.upsertProgress(userId, {
      completedSteps,
      currentStep,
      completedAt,
      skippedAt: existing?.skippedAt ?? null
    });
    await dashboardCacheService.invalidate(userId);

    return buildResponse({
      completedSteps,
      skippedAt: existing?.skippedAt,
      completedAt
    });
  },

  async skip(userId: string) {
    const existing = await onboardingRepository.findProgress(userId);
    const completedSteps = mergeSteps(
      normalizeCompletedSteps(existing?.completedSteps),
      await getDerivedSteps(userId)
    );
    const skippedAt = existing?.skippedAt ?? new Date();

    await onboardingRepository.upsertProgress(userId, {
      completedSteps,
      currentStep: null,
      completedAt: existing?.completedAt ?? null,
      skippedAt
    });
    await dashboardCacheService.invalidate(userId);

    return buildResponse({
      completedSteps,
      skippedAt,
      completedAt: existing?.completedAt
    });
  }
};
